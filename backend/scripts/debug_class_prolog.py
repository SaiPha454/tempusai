from pathlib import Path
import subprocess
import tempfile

from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.core.database import SessionLocal
from app.core.migrations import run_startup_migrations
from app.models.resource import Program, ProgramYearCourse, Room, Timeslot
from app.services.scheduling_service import SchedulingService, _normalize_day
from app.services.prolog_csp.class_scheduler import PrologClassScheduler, PrologCourseRow


def main() -> None:
    run_startup_migrations()

    with SessionLocal() as db:
        service = SchedulingService(db)
        program = db.scalar(select(Program).where(Program.value == "chemical-engineering"))
        rooms = list(db.scalars(select(Room).order_by(Room.capacity.desc(), Room.name).limit(20)))
        timeslots = list(db.scalars(select(Timeslot)))
        timeslots.sort(key=lambda slot: (_normalize_day(slot.day), slot.label or ""))

        plan_rows = list(
            db.scalars(
                select(ProgramYearCourse)
                .where(ProgramYearCourse.program_id == program.id)
                .options(joinedload(ProgramYearCourse.course), joinedload(ProgramYearCourse.professor))
                .order_by(ProgramYearCourse.year, ProgramYearCourse.id)
            )
        )

        demand = service._build_course_demand_map(
            program_id=program.id,
            course_year_pairs={(row.course_id, row.year) for row in plan_rows},
        )
        occupied_room_slots, occupied_professor_slots = service._get_confirmed_resource_occupancy()

    solver = PrologClassScheduler(timeout_seconds=30)

    with tempfile.TemporaryDirectory(prefix="tempusai-class-debug-") as tmp:
        facts = Path(tmp) / "facts.pl"
        solver._write_facts(
            file_path=facts,
            course_rows=[
                PrologCourseRow(
                    course_id=row.course_id,
                    professor_id=row.professor_id,
                    year=row.year,
                    required_capacity=demand.get((row.course_id, row.year), 0),
                )
                for row in plan_rows
            ],
            room_capacity_by_id={room.id: room.capacity for room in rooms},
            timeslot_ids=[slot.id for slot in timeslots],
            preferred_timeslots_by_course_id={},
            occupied_room_slots=occupied_room_slots,
            occupied_professor_slots=occupied_professor_slots,
            professor_no_overlap=True,
            student_groups_no_overlap=True,
            room_capacity_check=True,
        )

        query = "findall(C,course(C,_,_,_),Cs),length(Cs,N),writeln(courses=N),(member(C1,Cs),candidate_domain(mode(relaxed),C1,D),length(D,L),writeln(dom(C1,L)),fail;true),halt."
        cmd = [
            solver._swipl,
            "-q",
            "-s",
            str(facts),
            "-s",
            str(Path(__file__).resolve().parents[1] / "app/services/prolog_csp/class_scheduler.pl"),
            "-g",
            query,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, check=False)
        print("returncode:", result.returncode)
        print(result.stdout)
        if result.stderr.strip():
            print("stderr:", result.stderr)


if __name__ == "__main__":
    main()
