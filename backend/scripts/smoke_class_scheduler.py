from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.migrations import run_startup_migrations
from app.models.resource import Program, Room
from app.schemas.scheduling import ClassScheduleGenerateRequest
from app.services.scheduling_service import SchedulingService


def main() -> None:
    run_startup_migrations()

    with SessionLocal() as db:
        _ = db.scalar(select(Program).where(Program.value == "chemical-engineering"))
        rooms = list(db.scalars(select(Room).order_by(Room.capacity.desc(), Room.name).limit(20)))

        payload = ClassScheduleGenerateRequest(
            program_value="chemical-engineering",
            selected_room_names=[r.name for r in rooms],
            constraints={
                "professorNoOverlap": True,
                "studentGroupsNoOverlap": True,
                "roomCapacityCheck": True,
            },
            preferred_timeslot_by_course_id={},
        )

        service = SchedulingService(db)
        job = service.create_class_generation_job(payload)
        draft = service.get_class_draft(job.snapshot_id)

        assigned = sum(1 for e in draft.entries if e.timeslot_id and e.room_id)
        print(f"snapshot_id: {draft.id}")
        print(f"entries: {len(draft.entries)}")
        print(f"assigned: {assigned}")
        print(f"conflict_count: {draft.conflict_count}")


if __name__ == "__main__":
    main()
