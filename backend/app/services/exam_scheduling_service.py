from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models.resource import (
    Course,
    Program,
    ProgramYearCourse,
    Room,
    ScheduleClassEntry,
    ScheduleClassSnapshot,
    ScheduleExamEntry,
    ScheduleExamSnapshot,
    ScheduleGenerationJob,
    SpecialEnrollment,
    SpecialEnrollmentCourse,
    Student,
)
from app.schemas.scheduling import (
    ConfirmedExamOccupancyRead,
    ExamDraftScheduleSummaryRead,
    ExamScheduleDraftRead,
    ExamScheduleGenerateRequest,
    ExamScheduleJobRead,
    ExamScheduleSummaryRead,
    SaveExamScheduleDraftRequest,
    ScheduleConflictRead,
    ScheduleExamEntryRead,
)
from app.services.errors import bad_request, not_found
from app.services.prolog_csp import PrologExamRow, PrologExamScheduler

EXAM_SLOT_LABELS: dict[str, str] = {
    "morning-exam": "09:00 - 12:00",
    "afternoon-exam": "13:30 - 16:30",
}

# Exam scheduling constraint policy is code-defined, not user-configurable.
EXAM_HARD_CONSTRAINTS: dict[str, bool] = {
    "no_same_program_year_day_timeslot": True,
    "no_student_overlap": True,
    "room_capacity_check": True,
}

EXAM_SOFT_CONSTRAINTS: dict[str, bool] = {
    "prefer_day_timeslot": True,
    "allow_flexible_fallback": True,
    "minimize_same_program_year_same_day": True,
}

EXAM_EFFECTIVE_CONSTRAINTS: dict[str, bool] = {
    **EXAM_HARD_CONSTRAINTS,
    **EXAM_SOFT_CONSTRAINTS,
}


@dataclass
class ExamItem:
    idx: int
    program_id: UUID
    program_value: str
    program_label: str
    program_year_course_id: UUID
    course_id: UUID
    course_code: str
    course_name: str
    year: int
    semester: str
    exam_type: str
    demand: int
    slot_candidates: list[tuple[date, str]]
    preferred_slot_candidates: list[tuple[date, str]]


class ExamSchedulingService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create_exam_generation_job(self, payload: ExamScheduleGenerateRequest) -> ExamScheduleJobRead:
        cleaned_job_name = payload.job_name.strip()
        if not cleaned_job_name:
            raise bad_request("Scheduling job name is required")

        requested_program_values = {
            plan.program_value.strip()
            for plan in payload.program_plans
            if plan.program_value and plan.program_value.strip()
        }
        confirmed_programs = self._list_confirmed_programs(requested_program_values)
        if confirmed_programs:
            labels = ", ".join(label or value for value, label in confirmed_programs)
            raise bad_request(
                "These programs already have confirmed exam schedules: "
                f"{labels}. Please edit them from Generated Exam Schedules."
            )

        exam_dates = self._parse_exam_dates(payload.exam_dates)
        if not exam_dates:
            raise bad_request("Exam period must contain at least one date")

        if not payload.selected_room_names:
            raise bad_request("No rooms selected for exam scheduling")

        rooms = list(self.db.scalars(select(Room).where(Room.name.in_(payload.selected_room_names)).order_by(Room.capacity, Room.name)))
        if not rooms:
            raise bad_request("No valid exam rooms found from selected rooms")

        selected_room_names = [room.name for room in rooms]

        all_slot_codes = list(EXAM_SLOT_LABELS.keys())
        if not all_slot_codes:
            raise bad_request("No exam slots configured")

        constraints = dict(EXAM_EFFECTIVE_CONSTRAINTS)

        items = self._build_exam_items(
            payload=payload,
            exam_dates=exam_dates,
            all_slot_codes=all_slot_codes,
            constraints=constraints,
        )
        if not items:
            raise bad_request("No exam subjects were provided for generation")

        confirmed_exam_room_slots = self._get_confirmed_exam_room_slots()
        student_overlap_edges = self._build_student_overlap_edges(items) if constraints["no_student_overlap"] else defaultdict(set)

        slot_keys_by_idx: dict[int, list[str]] = {
            item.idx: [f"{slot_date.isoformat()}|{slot_code}" for slot_date, slot_code in item.slot_candidates]
            for item in items
        }
        preferred_slot_keys_by_idx: dict[int, list[str]] = {
            item.idx: [f"{slot_date.isoformat()}|{slot_code}" for slot_date, slot_code in item.preferred_slot_candidates]
            for item in items
        }
        conflict_pairs: set[tuple[int, int]] = set()
        for left_idx, right_set in student_overlap_edges.items():
            for right_idx in right_set:
                if left_idx == right_idx:
                    continue
                pair = (left_idx, right_idx) if left_idx < right_idx else (right_idx, left_idx)
                conflict_pairs.add(pair)

        solver_warning: str | None = None
        try:
            prolog_solver = PrologExamScheduler(timeout_seconds=100)
            prolog_assignment_by_idx = prolog_solver.solve(
                exam_rows=[
                    PrologExamRow(
                        exam_idx=item.idx,
                        program_id=item.program_id,
                        year=item.year,
                        required_capacity=item.demand,
                        allowed_slot_keys=slot_keys_by_idx.get(item.idx, []),
                        preferred_slot_keys=preferred_slot_keys_by_idx.get(item.idx, []),
                    )
                    for item in items
                ],
                room_capacity_by_id={room.id: room.capacity for room in rooms},
                reserved_room_slot_keys={
                    (room_id, f"{slot_date.isoformat()}|{slot_code}")
                    for room_id, slot_date, slot_code in confirmed_exam_room_slots
                },
                student_conflict_pairs=conflict_pairs,
                no_same_program_year_day_timeslot=constraints["no_same_program_year_day_timeslot"],
                no_student_overlap=constraints["no_student_overlap"],
                room_capacity_check=constraints["room_capacity_check"],
                prefer_day_timeslot=constraints["prefer_day_timeslot"],
                allow_flexible_fallback=constraints["allow_flexible_fallback"],
                minimize_same_program_year_same_day=constraints["minimize_same_program_year_same_day"],
            )
        except Exception as error:
            solver_warning = str(error)
            prolog_assignment_by_idx = {}

        assignment_by_idx: dict[int, tuple[date, str, UUID]] = {}
        for idx, assignment in prolog_assignment_by_idx.items():
            room_id, slot_key = assignment
            try:
                slot_date_raw, slot_code = slot_key.split("|", 1)
                slot_date = date.fromisoformat(slot_date_raw)
            except ValueError:
                continue
            assignment_by_idx[idx] = (slot_date, slot_code, room_id)

        if len(assignment_by_idx) < len(items):
            partial_note = f"Partial assignment {len(assignment_by_idx)}/{len(items)}; unsolved exams remain unassigned"
            if solver_warning:
                solver_warning = f"{solver_warning} | {partial_note}"
            else:
                solver_warning = partial_note

        snapshot = ScheduleExamSnapshot(
            job_name=cleaned_job_name,
            status="draft",
            constraints=constraints,
            selected_room_names=selected_room_names,
            exam_dates=[value.isoformat() for value in exam_dates],
            program_values=sorted({item.program_value for item in items}),
        )
        self.db.add(snapshot)
        self.db.flush()

        job = ScheduleGenerationJob(exam_snapshot_id=snapshot.id, status="running", job_type="exam")
        if solver_warning:
            job.error_message = f"Prolog solver fallback: {solver_warning}"
        self.db.add(job)

        for item in items:
            assignment = assignment_by_idx.get(item.idx)
            entry = ScheduleExamEntry(
                snapshot_id=snapshot.id,
                program_id=item.program_id,
                program_year_course_id=item.program_year_course_id,
                course_id=item.course_id,
                year=item.year,
                semester=item.semester,
                exam_type=item.exam_type,
                exam_date=assignment[0] if assignment else None,
                timeslot_code=assignment[1] if assignment else None,
                room_id=assignment[2] if assignment else None,
                manually_adjusted=False,
            )
            self.db.add(entry)

        job.status = "succeeded"
        self.db.commit()

        return ExamScheduleJobRead(job_id=job.id, snapshot_id=snapshot.id, status=job.status)

    def get_job(self, job_id: UUID) -> ExamScheduleJobRead:
        job = self.db.get(ScheduleGenerationJob, job_id)
        if not job or job.job_type != "exam":
            raise not_found("Exam scheduling job")

        return ExamScheduleJobRead(
            job_id=job.id,
            snapshot_id=job.exam_snapshot_id,
            status=job.status,
            error_message=job.error_message,
        )

    def get_exam_draft(self, snapshot_id: UUID) -> ExamScheduleDraftRead:
        snapshot = self._get_exam_snapshot(snapshot_id)
        entries, conflict_count = self._serialize_exam_entries_with_conflicts(snapshot)
        selected_room_ids = self._get_room_ids_by_names(snapshot.selected_room_names)
        confirmed_occupancies = self._list_confirmed_exam_occupancies(
            exclude_snapshot_id=snapshot.id,
            room_ids=selected_room_ids,
        )

        return ExamScheduleDraftRead(
            id=snapshot.id,
            job_name=snapshot.job_name,
            status=snapshot.status,
            constraints=dict(EXAM_EFFECTIVE_CONSTRAINTS),
            selected_room_names=snapshot.selected_room_names,
            exam_dates=snapshot.exam_dates,
            program_values=snapshot.program_values,
            entries=entries,
            confirmed_occupancies=confirmed_occupancies,
            conflict_count=conflict_count,
            created_at=snapshot.created_at,
            updated_at=snapshot.updated_at,
        )

    def save_exam_draft(self, snapshot_id: UUID, payload: SaveExamScheduleDraftRequest) -> ExamScheduleDraftRead:
        snapshot = self._get_exam_snapshot(snapshot_id)
        entry_by_id = {entry.id: entry for entry in snapshot.entries}

        for patch in payload.entries:
            entry = entry_by_id.get(patch.id)
            if not entry:
                raise bad_request("Draft entry does not belong to this exam snapshot")

            entry.exam_date = patch.exam_date
            entry.timeslot_code = patch.timeslot_code

            if patch.room_id is not None:
                room = self.db.get(Room, patch.room_id)
                if not room:
                    raise bad_request("Room does not exist")
                entry.room_id = room.id
                entry.room = room
            else:
                entry.room_id = None
                entry.room = None

            entry.manually_adjusted = True

        # Ensure relationship/FK changes are synchronized before conflict checks.
        self.db.flush()

        has_unassigned = any(
            entry.exam_date is None or entry.timeslot_code is None or entry.room_id is None
            for entry in snapshot.entries
        )
        if has_unassigned:
            raise bad_request("Cannot save exam schedule while some exams are unassigned")

        conflicts = self._compute_exam_conflicts_for_entries(
            entries=snapshot.entries,
            constraints=dict(EXAM_EFFECTIVE_CONSTRAINTS),
            exclude_snapshot_id=snapshot.id,
        )
        blocking_codes = {
            "unassigned",
            "room_overlap",
            "program_year_overlap",
            "student_overlap",
            "room_capacity_exceeded",
        }
        if any(any(code in blocking_codes for code in codes) for codes in conflicts.values()):
            raise bad_request("Cannot save exam schedule while conflicts still exist")

        snapshot.status = "confirmed"
        self.db.commit()

        return self.get_exam_draft(snapshot.id)

    def delete_exam_draft(self, snapshot_id: UUID) -> None:
        snapshot = self.db.get(ScheduleExamSnapshot, snapshot_id)
        if not snapshot:
            raise not_found("Exam draft snapshot")
        self.db.delete(snapshot)
        self.db.commit()

    def list_draft_exam_summaries(self) -> list[ExamDraftScheduleSummaryRead]:
        snapshots = list(
            self.db.scalars(
                select(ScheduleExamSnapshot)
                .where(ScheduleExamSnapshot.status == "draft")
                .order_by(ScheduleExamSnapshot.updated_at.desc(), ScheduleExamSnapshot.created_at.desc())
            )
        )

        if not snapshots:
            return []

        entry_counts = {
            snapshot_id: count
            for snapshot_id, count in self.db.execute(
                select(ScheduleExamEntry.snapshot_id, func.count(ScheduleExamEntry.id))
                .where(ScheduleExamEntry.snapshot_id.in_([snapshot.id for snapshot in snapshots]))
                .group_by(ScheduleExamEntry.snapshot_id)
            )
        }

        return [
            ExamDraftScheduleSummaryRead(
                id=snapshot.id,
                job_name=snapshot.job_name,
                status=snapshot.status,
                program_values=snapshot.program_values,
                exam_dates=snapshot.exam_dates,
                entry_count=entry_counts.get(snapshot.id, 0),
                created_at=snapshot.created_at,
                updated_at=snapshot.updated_at,
            )
            for snapshot in snapshots
        ]

    def list_confirmed_exam_summaries(self) -> list[ExamScheduleSummaryRead]:
        snapshots = list(
            self.db.scalars(
                select(ScheduleExamSnapshot)
                .where(ScheduleExamSnapshot.status == "confirmed")
                .order_by(ScheduleExamSnapshot.updated_at.desc(), ScheduleExamSnapshot.created_at.desc())
            )
        )

        if not snapshots:
            return []

        entry_counts = {
            snapshot_id: count
            for snapshot_id, count in self.db.execute(
                select(ScheduleExamEntry.snapshot_id, func.count(ScheduleExamEntry.id))
                .where(ScheduleExamEntry.snapshot_id.in_([snapshot.id for snapshot in snapshots]))
                .group_by(ScheduleExamEntry.snapshot_id)
            )
        }

        return [
            ExamScheduleSummaryRead(
                id=snapshot.id,
                job_name=snapshot.job_name,
                status=snapshot.status,
                program_values=snapshot.program_values,
                exam_dates=snapshot.exam_dates,
                entry_count=entry_counts.get(snapshot.id, 0),
                created_at=snapshot.created_at,
                updated_at=snapshot.updated_at,
            )
            for snapshot in snapshots
        ]

    def get_exam_snapshot(self, snapshot_id: UUID) -> ExamScheduleDraftRead:
        return self.get_exam_draft(snapshot_id)

    def _build_exam_items(
        self,
        *,
        payload: ExamScheduleGenerateRequest,
        exam_dates: list[date],
        all_slot_codes: list[str],
        constraints: dict[str, bool],
    ) -> list[ExamItem]:
        items: list[ExamItem] = []
        idx = 0

        demand_by_program_pair: dict[UUID, dict[tuple[UUID, int], int]] = {}
        class_weekdays_by_program_pair: dict[UUID, dict[tuple[UUID, int], set[int]]] = {}

        for plan in payload.program_plans:
            program = self.db.scalar(select(Program).where(Program.value == plan.program_value.strip()))
            if not program:
                raise bad_request(f"Program does not exist: {plan.program_value}")

            course_year_pairs = {
                (course.program_year_course_id, year_plan.year)
                for year_plan in plan.years
                for course in year_plan.courses
            }
            if not course_year_pairs:
                continue

            demand_by_program_pair.setdefault(
                program.id,
                self._build_course_demand_map_for_program(
                    program_id=program.id,
                    course_year_course_pairs=course_year_pairs,
                ),
            )
            class_weekdays_by_program_pair.setdefault(
                program.id,
                self._build_confirmed_class_weekday_map_for_program(program.id),
            )

            for year_plan in plan.years:
                for course in year_plan.courses:
                    row = self.db.scalar(
                        select(ProgramYearCourse)
                        .where(ProgramYearCourse.id == course.program_year_course_id)
                        .options(joinedload(ProgramYearCourse.course))
                    )
                    if not row:
                        raise bad_request(f"Program year course does not exist: {course.program_year_course_id}")
                    if row.program_id != program.id or row.year != year_plan.year:
                        raise bad_request(
                            f"Program year course mismatch for {course.course_code} in {plan.program_value} year {year_plan.year}"
                        )

                    explicit_preferred_dates = self._parse_exam_dates(course.preferred_dates)
                    if explicit_preferred_dates:
                        preferred_dates = explicit_preferred_dates
                    else:
                        preferred_weekdays = class_weekdays_by_program_pair.get(program.id, {}).get(
                            (row.course_id, year_plan.year),
                            set(),
                        )
                        preferred_dates = [value for value in exam_dates if value.weekday() in preferred_weekdays]

                    preferred_date_set = set(preferred_dates)
                    allowed_dates = [value for value in exam_dates if value in preferred_date_set] if preferred_dates else []

                    preferred_slots = [slot for slot in course.preferred_timeslots if slot in all_slot_codes]
                    if allowed_dates and preferred_slots:
                        preferred_slot_candidates = [(exam_date, slot) for exam_date in allowed_dates for slot in preferred_slots]
                    elif allowed_dates:
                        preferred_slot_candidates = [(exam_date, slot) for exam_date in allowed_dates for slot in all_slot_codes]
                    elif preferred_slots:
                        preferred_slot_candidates = [(exam_date, slot) for exam_date in exam_dates for slot in preferred_slots]
                    else:
                        preferred_slot_candidates = []

                    slot_candidates = self._build_slot_candidates(
                        exam_dates=exam_dates,
                        all_slot_codes=all_slot_codes,
                        preferred_dates=allowed_dates,
                        preferred_slots=preferred_slots,
                        prefer_day_timeslot=constraints["prefer_day_timeslot"],
                        allow_flexible_fallback=constraints["allow_flexible_fallback"],
                    )

                    if not slot_candidates:
                        slot_candidates = [(value, slot) for value in exam_dates for slot in all_slot_codes]

                    item = ExamItem(
                        idx=idx,
                        program_id=program.id,
                        program_value=program.value,
                        program_label=program.label,
                        program_year_course_id=row.id,
                        course_id=row.course_id,
                        course_code=row.course.code,
                        course_name=row.course.name,
                        year=year_plan.year,
                        semester=plan.semester,
                        exam_type=plan.exam_type,
                        demand=demand_by_program_pair[program.id].get((row.id, year_plan.year), 0),
                        slot_candidates=slot_candidates,
                        preferred_slot_candidates=preferred_slot_candidates,
                    )
                    items.append(item)
                    idx += 1

        return items

    def _build_confirmed_class_weekday_map_for_program(
        self,
        program_id: UUID,
    ) -> dict[tuple[UUID, int], set[int]]:
        snapshot = self.db.scalar(
            select(ScheduleClassSnapshot)
            .where(
                ScheduleClassSnapshot.program_id == program_id,
                ScheduleClassSnapshot.status == "confirmed",
            )
            .order_by(ScheduleClassSnapshot.updated_at.desc(), ScheduleClassSnapshot.created_at.desc())
            .limit(1)
        )
        if snapshot is None:
            return {}

        entries = list(
            self.db.scalars(
                select(ScheduleClassEntry)
                .where(ScheduleClassEntry.snapshot_id == snapshot.id)
                .options(joinedload(ScheduleClassEntry.timeslot))
            )
        )

        weekday_map: dict[tuple[UUID, int], set[int]] = defaultdict(set)
        for entry in entries:
            weekday = self._normalize_weekday(entry.timeslot.day if entry.timeslot else None)
            if weekday is None:
                continue
            weekday_map[(entry.course_id, entry.year)].add(weekday)

        return dict(weekday_map)

    @staticmethod
    def _normalize_weekday(raw_day: str | None) -> int | None:
        if not raw_day:
            return None

        value = raw_day.strip().lower()
        day_map = {
            "monday": 0,
            "mon": 0,
            "tuesday": 1,
            "tue": 1,
            "tues": 1,
            "wednesday": 2,
            "wed": 2,
            "thursday": 3,
            "thu": 3,
            "thur": 3,
            "thurs": 3,
            "friday": 4,
            "fri": 4,
            "saturday": 5,
            "sat": 5,
            "sunday": 6,
            "sun": 6,
        }
        return day_map.get(value)

    @staticmethod
    def _build_slot_candidates(
        *,
        exam_dates: list[date],
        all_slot_codes: list[str],
        preferred_dates: list[date],
        preferred_slots: list[str],
        prefer_day_timeslot: bool,
        allow_flexible_fallback: bool,
    ) -> list[tuple[date, str]]:
        all_slots = [(exam_date, slot) for exam_date in exam_dates for slot in all_slot_codes]

        preferred: list[tuple[date, str]] = []
        if preferred_dates and preferred_slots:
            preferred = [(exam_date, slot) for exam_date in preferred_dates for slot in preferred_slots]
        elif preferred_dates:
            preferred = [(exam_date, slot) for exam_date in preferred_dates for slot in all_slot_codes]
        elif preferred_slots:
            preferred = [(exam_date, slot) for exam_date in exam_dates for slot in preferred_slots]

        if not prefer_day_timeslot:
            return all_slots

        if allow_flexible_fallback:
            rest = [slot for slot in all_slots if slot not in preferred]
            return preferred + rest

        return preferred

    @staticmethod
    def _parse_exam_dates(raw_values: list[str]) -> list[date]:
        parsed: list[date] = []
        seen: set[date] = set()
        for value in raw_values:
            try:
                parsed_value = date.fromisoformat(value)
            except ValueError:
                continue
            if parsed_value in seen:
                continue
            seen.add(parsed_value)
            parsed.append(parsed_value)
        parsed.sort()
        return parsed

    def _build_student_overlap_edges(self, items: list[ExamItem]) -> dict[int, set[int]]:
        edges: dict[int, set[int]] = defaultdict(set)

        items_by_program_year: dict[tuple[UUID, int], list[int]] = defaultdict(list)
        items_by_course: dict[UUID, list[int]] = defaultdict(list)
        for item in items:
            items_by_program_year[(item.program_id, item.year)].append(item.idx)
            items_by_course[item.course_id].append(item.idx)

        for item_indexes in items_by_program_year.values():
            for left in range(len(item_indexes)):
                for right in range(left + 1, len(item_indexes)):
                    a = item_indexes[left]
                    b = item_indexes[right]
                    edges[a].add(b)
                    edges[b].add(a)

        involved_course_ids = list(items_by_course.keys())
        if not involved_course_ids:
            return edges

        rows = self.db.execute(
            select(
                Student.id,
                Student.program_id,
                Student.year,
                SpecialEnrollmentCourse.course_id,
            )
            .join(SpecialEnrollment, SpecialEnrollment.student_id == Student.id)
            .join(SpecialEnrollmentCourse, SpecialEnrollmentCourse.enrollment_id == SpecialEnrollment.id)
            .where(SpecialEnrollmentCourse.course_id.in_(involved_course_ids))
        ).all()

        special_courses_by_student: dict[UUID, set[UUID]] = defaultdict(set)
        student_home_by_id: dict[UUID, tuple[UUID, int]] = {}
        for student_id, program_id, year, course_id in rows:
            special_courses_by_student[student_id].add(course_id)
            student_home_by_id[student_id] = (program_id, year)

        for student_id, special_course_ids in special_courses_by_student.items():
            home = student_home_by_id.get(student_id)
            if not home:
                continue

            taking_items: set[int] = set(items_by_program_year.get(home, []))
            for course_id in special_course_ids:
                taking_items.update(items_by_course.get(course_id, []))

            taking_list = sorted(taking_items)
            for left in range(len(taking_list)):
                for right in range(left + 1, len(taking_list)):
                    a = taking_list[left]
                    b = taking_list[right]
                    edges[a].add(b)
                    edges[b].add(a)

        return edges

    def _compute_exam_conflicts_for_entries(
        self,
        *,
        entries: list[ScheduleExamEntry],
        constraints: dict[str, bool],
        exclude_snapshot_id: UUID,
    ) -> dict[UUID, list[str]]:
        conflicts_by_id: defaultdict[UUID, list[str]] = defaultdict(list)

        room_demand = self._build_exam_entry_demand(entries)
        confirmed_room_slots = self._get_confirmed_exam_room_slots(exclude_snapshot_id=exclude_snapshot_id)
        involved_room_ids = {entry.room_id for entry in entries if entry.room_id is not None}
        room_capacity_by_id: dict[UUID, int] = {}
        if involved_room_ids:
            room_capacity_by_id = {
                room_id: capacity
                for room_id, capacity in self.db.execute(
                    select(Room.id, Room.capacity).where(Room.id.in_(involved_room_ids))
                ).all()
            }

        by_room_slot: defaultdict[tuple[UUID, date, str], list[ScheduleExamEntry]] = defaultdict(list)
        by_program_year_slot: defaultdict[tuple[UUID, int, date, str], list[ScheduleExamEntry]] = defaultdict(list)

        row_by_idx = {index: entry for index, entry in enumerate(entries)}
        student_edges = self._build_student_overlap_edges_from_entries(entries)

        by_idx = {entry.id: idx for idx, entry in row_by_idx.items()}

        for entry in entries:
            if not entry.exam_date or not entry.timeslot_code or not entry.room_id:
                conflicts_by_id[entry.id].append("unassigned")
                continue

            if constraints.get("room_capacity_check", True):
                required = room_demand.get(entry.id, 0)
                room_capacity = room_capacity_by_id.get(entry.room_id)
                if room_capacity is not None and room_capacity < required:
                    conflicts_by_id[entry.id].append("room_capacity_exceeded")

            room_key = (entry.room_id, entry.exam_date, entry.timeslot_code)
            if room_key in confirmed_room_slots:
                conflicts_by_id[entry.id].append("room_overlap")
            by_room_slot[room_key].append(entry)

            if constraints.get("no_same_program_year_day_timeslot", True):
                by_program_year_slot[(entry.program_id, entry.year, entry.exam_date, entry.timeslot_code)].append(entry)

        for grouped in by_room_slot.values():
            if len(grouped) <= 1:
                continue
            for entry in grouped:
                conflicts_by_id[entry.id].append("room_overlap")

        for grouped in by_program_year_slot.values():
            if len(grouped) <= 1:
                continue
            for entry in grouped:
                conflicts_by_id[entry.id].append("program_year_overlap")

        if constraints.get("no_student_overlap", True):
            for entry in entries:
                idx = by_idx.get(entry.id)
                if idx is None or not entry.exam_date or not entry.timeslot_code:
                    continue
                for conflict_idx in student_edges.get(idx, set()):
                    other = row_by_idx.get(conflict_idx)
                    if not other or other.id == entry.id:
                        continue
                    if other.exam_date == entry.exam_date and other.timeslot_code == entry.timeslot_code:
                        conflicts_by_id[entry.id].append("student_overlap")
                        break

        return conflicts_by_id

    def _serialize_exam_entries_with_conflicts(
        self,
        snapshot: ScheduleExamSnapshot,
    ) -> tuple[list[ScheduleExamEntryRead], int]:
        conflicts_by_id = self._compute_exam_conflicts_for_entries(
            entries=snapshot.entries,
            constraints=EXAM_EFFECTIVE_CONSTRAINTS,
            exclude_snapshot_id=snapshot.id,
        )

        entries: list[ScheduleExamEntryRead] = []
        conflict_count = 0
        for entry in sorted(
            snapshot.entries,
            key=lambda value: (
                value.program.value if value.program else "",
                value.year,
                value.course.code if value.course else "",
            ),
        ):
            conflict_codes = conflicts_by_id.get(entry.id, [])
            if conflict_codes:
                conflict_count += 1
            entries.append(
                ScheduleExamEntryRead(
                    id=entry.id,
                    program_id=entry.program_id,
                    program_value=entry.program.value if entry.program else "",
                    program_label=entry.program.label if entry.program else "",
                    program_year_course_id=entry.program_year_course_id,
                    course_id=entry.course_id,
                    course_code=entry.course.code if entry.course else "",
                    course_name=entry.course.name if entry.course else "",
                    year=entry.year,
                    semester=entry.semester,
                    exam_type=entry.exam_type,
                    exam_date=entry.exam_date,
                    timeslot_code=entry.timeslot_code,
                    room_id=entry.room_id,
                    room_name=entry.room.name if entry.room else None,
                    manually_adjusted=entry.manually_adjusted,
                    conflicts=[self._build_exam_conflict(code) for code in conflict_codes],
                )
            )

        return entries, conflict_count

    def _get_exam_snapshot(self, snapshot_id: UUID) -> ScheduleExamSnapshot:
        snapshot = self.db.scalar(
            select(ScheduleExamSnapshot)
            .where(ScheduleExamSnapshot.id == snapshot_id)
            .options(
                joinedload(ScheduleExamSnapshot.entries).joinedload(ScheduleExamEntry.program),
                joinedload(ScheduleExamSnapshot.entries).joinedload(ScheduleExamEntry.program_year_course),
                joinedload(ScheduleExamSnapshot.entries).joinedload(ScheduleExamEntry.course),
                joinedload(ScheduleExamSnapshot.entries).joinedload(ScheduleExamEntry.room),
            )
        )
        if not snapshot:
            raise not_found("Exam schedule snapshot")
        return snapshot

    def _get_confirmed_exam_room_slots(
        self,
        *,
        exclude_snapshot_id: UUID | None = None,
    ) -> set[tuple[UUID, date, str]]:
        stmt = (
            select(
                ScheduleExamEntry.room_id,
                ScheduleExamEntry.exam_date,
                ScheduleExamEntry.timeslot_code,
            )
            .join(ScheduleExamSnapshot, ScheduleExamSnapshot.id == ScheduleExamEntry.snapshot_id)
            .where(
                ScheduleExamSnapshot.status == "confirmed",
                ScheduleExamEntry.room_id.is_not(None),
                ScheduleExamEntry.exam_date.is_not(None),
                ScheduleExamEntry.timeslot_code.is_not(None),
            )
        )
        if exclude_snapshot_id is not None:
            stmt = stmt.where(ScheduleExamEntry.snapshot_id != exclude_snapshot_id)

        result: set[tuple[UUID, date, str]] = set()
        for room_id, exam_date, slot_code in self.db.execute(stmt).all():
            result.add((room_id, exam_date, slot_code))
        return result

    def _list_confirmed_exam_occupancies(
        self,
        *,
        exclude_snapshot_id: UUID,
        room_ids: set[UUID] | None,
    ) -> list[ConfirmedExamOccupancyRead]:
        if room_ids is not None and len(room_ids) == 0:
            return []

        stmt = (
            select(
                ScheduleExamEntry.room_id,
                ScheduleExamEntry.exam_date,
                ScheduleExamEntry.timeslot_code,
                Course.code,
                Course.name,
            )
            .join(ScheduleExamSnapshot, ScheduleExamSnapshot.id == ScheduleExamEntry.snapshot_id)
            .join(Course, Course.id == ScheduleExamEntry.course_id)
            .where(
                ScheduleExamSnapshot.status == "confirmed",
                ScheduleExamEntry.snapshot_id != exclude_snapshot_id,
                ScheduleExamEntry.room_id.is_not(None),
                ScheduleExamEntry.exam_date.is_not(None),
                ScheduleExamEntry.timeslot_code.is_not(None),
            )
        )

        if room_ids is not None:
            stmt = stmt.where(ScheduleExamEntry.room_id.in_(room_ids))

        rows = self.db.execute(stmt).all()
        if not rows:
            return []

        seen: set[tuple[UUID, date, str]] = set()
        output: list[ConfirmedExamOccupancyRead] = []
        for room_id, exam_date, slot_code, course_code, course_name in rows:
            key = (room_id, exam_date, slot_code)
            if key in seen:
                continue
            seen.add(key)
            output.append(
                ConfirmedExamOccupancyRead(
                    room_id=room_id,
                    exam_date=exam_date,
                    timeslot_code=slot_code,
                    course_code=course_code,
                    course_name=course_name,
                )
            )

        return output

    def _build_course_demand_map_for_program(
        self,
        *,
        program_id: UUID,
        course_year_course_pairs: set[tuple[UUID, int]],
    ) -> dict[tuple[UUID, int], int]:
        if not course_year_course_pairs:
            return {}

        year_values = {year for _, year in course_year_course_pairs}
        plan_row_ids = {row_id for row_id, _ in course_year_course_pairs}

        plan_rows = list(
            self.db.scalars(
                select(ProgramYearCourse)
                .where(ProgramYearCourse.id.in_(plan_row_ids))
            )
        )
        row_by_id = {row.id: row for row in plan_rows}

        base_counts = {
            year: count
            for year, count in self.db.execute(
                select(Student.year, func.count(Student.id))
                .where(Student.program_id == program_id, Student.year.in_(year_values))
                .group_by(Student.year)
            ).all()
        }

        involved_course_ids = {row_by_id[row_id].course_id for row_id in plan_row_ids if row_id in row_by_id}
        special_rows = self.db.execute(
            select(
                SpecialEnrollmentCourse.course_id,
                Student.id,
                Student.program_id,
                Student.year,
            )
            .join(SpecialEnrollment, SpecialEnrollment.id == SpecialEnrollmentCourse.enrollment_id)
            .join(Student, Student.id == SpecialEnrollment.student_id)
            .where(SpecialEnrollmentCourse.course_id.in_(involved_course_ids))
        ).all()

        special_students_by_course: dict[UUID, dict[UUID, tuple[UUID, int]]] = defaultdict(dict)
        for course_id, student_id, student_program_id, student_year in special_rows:
            special_students_by_course[course_id][student_id] = (student_program_id, student_year)

        demand_map: dict[tuple[UUID, int], int] = {}
        for row_id, year in course_year_course_pairs:
            row = row_by_id.get(row_id)
            if not row:
                continue
            base_demand = base_counts.get(year, 0)
            additional = sum(
                1
                for student_program_id, student_year in special_students_by_course.get(row.course_id, {}).values()
                if not (student_program_id == program_id and student_year == year)
            )
            demand_map[(row_id, year)] = base_demand + additional

        return demand_map

    @staticmethod
    def _build_exam_conflict(code: str) -> ScheduleConflictRead:
        message_map = {
            "unassigned": "Missing exam date, slot, or room assignment.",
            "room_overlap": "Room already has another confirmed/scheduled exam at this date and slot.",
            "program_year_overlap": "This program and year already has an exam at this date and slot.",
            "student_overlap": "At least one student would have two exams at the same date and slot.",
            "room_capacity_exceeded": "Room capacity is smaller than expected enrollment.",
        }
        return ScheduleConflictRead(code=code, message=message_map.get(code, "Conflict detected."))

    def _build_exam_entry_demand(self, entries: list[ScheduleExamEntry]) -> dict[UUID, int]:
        grouped: dict[UUID, set[tuple[UUID, int]]] = defaultdict(set)
        for entry in entries:
            if entry.program_year_course_id is None:
                continue
            grouped[entry.program_id].add((entry.program_year_course_id, entry.year))

        demand_maps: dict[UUID, dict[tuple[UUID, int], int]] = {}
        for program_id, pairs in grouped.items():
            demand_maps[program_id] = self._build_course_demand_map_for_program(
                program_id=program_id,
                course_year_course_pairs=pairs,
            )

        result: dict[UUID, int] = {}
        for entry in entries:
            if entry.program_year_course_id is None:
                result[entry.id] = 0
                continue
            result[entry.id] = demand_maps.get(entry.program_id, {}).get((entry.program_year_course_id, entry.year), 0)
        return result

    def _build_student_overlap_edges_from_entries(self, entries: list[ScheduleExamEntry]) -> dict[int, set[int]]:
        pseudo_items = [
            ExamItem(
                idx=index,
                program_id=entry.program_id,
                program_value=entry.program.value if entry.program else "",
                program_label=entry.program.label if entry.program else "",
                program_year_course_id=entry.program_year_course_id or UUID(int=0),
                course_id=entry.course_id,
                course_code=entry.course.code if entry.course else "",
                course_name=entry.course.name if entry.course else "",
                year=entry.year,
                semester=entry.semester or "",
                exam_type=entry.exam_type or "",
                demand=0,
                slot_candidates=[],
                preferred_slot_candidates=[],
            )
            for index, entry in enumerate(entries)
        ]
        return self._build_student_overlap_edges(pseudo_items)

    def _get_room_ids_by_names(self, room_names: list[str]) -> set[UUID] | None:
        if not room_names:
            return None

        rows = self.db.execute(select(Room.id).where(Room.name.in_(room_names))).all()
        return {room_id for (room_id,) in rows}

    def _list_confirmed_programs(self, program_values: set[str]) -> list[tuple[str, str]]:
        if not program_values:
            return []

        rows = self.db.execute(
            select(Program.value, Program.label)
            .join(ScheduleExamEntry, ScheduleExamEntry.program_id == Program.id)
            .join(ScheduleExamSnapshot, ScheduleExamSnapshot.id == ScheduleExamEntry.snapshot_id)
            .where(
                Program.value.in_(program_values),
                ScheduleExamSnapshot.status == "confirmed",
            )
            .group_by(Program.value, Program.label)
            .order_by(Program.value)
        ).all()

        return [(value, label) for value, label in rows]
