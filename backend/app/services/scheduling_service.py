from collections import defaultdict
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
    ScheduleGenerationJob,
    SpecialEnrollment,
    SpecialEnrollmentCourse,
    Student,
    Timeslot,
)
from app.schemas.scheduling import (
    ClassScheduleDraftRead,
    ClassScheduleGenerateRequest,
    ClassScheduleJobRead,
    ConfirmedOccupancyRead,
    ProgramConfirmedScheduleSummaryRead,
    ProgramDraftSummaryRead,
    SaveClassScheduleDraftRequest,
    ScheduleClassEntryRead,
    ScheduleConflictRead,
)
from app.services.errors import bad_request, not_found
from app.services.prolog_csp import PrologClassScheduler, PrologCourseRow


def _normalize_day(day: str | None) -> int:
    if not day:
        return 999
    order = {
        "monday": 1,
        "tuesday": 2,
        "wednesday": 3,
        "thursday": 4,
        "friday": 5,
        "saturday": 6,
        "sunday": 7,
    }
    return order.get(day.lower(), 999)


class SchedulingService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create_class_generation_job(self, payload: ClassScheduleGenerateRequest) -> ClassScheduleJobRead:
        program = self.db.scalar(select(Program).where(Program.value == payload.program_value.strip()))
        if not program:
            raise bad_request("Program does not exist")

        existing_snapshot = self._get_latest_program_snapshot(program.id)
        has_user_inputs = bool(payload.selected_room_names) or bool(payload.preferred_timeslot_by_course_id)
        if existing_snapshot is not None and not has_user_inputs:
            reuse_job = ScheduleGenerationJob(snapshot_id=existing_snapshot.id, status="succeeded", job_type="class")
            self.db.add(reuse_job)
            self.db.commit()
            return ClassScheduleJobRead(job_id=reuse_job.id, snapshot_id=existing_snapshot.id, status=reuse_job.status)

        rooms_query = select(Room)
        if payload.selected_room_names:
            rooms_query = rooms_query.where(Room.name.in_(payload.selected_room_names))

        rooms = list(self.db.scalars(rooms_query))
        if payload.selected_room_names and not rooms:
            rooms = list(self.db.scalars(select(Room)))
        if not rooms:
            raise bad_request("No rooms selected for scheduling")

        timeslots = list(self.db.scalars(select(Timeslot).order_by(Timeslot.day, Timeslot.label)))
        if not timeslots:
            raise bad_request("No timeslots found")

        plan_rows = list(
            self.db.scalars(
                select(ProgramYearCourse)
                .where(ProgramYearCourse.program_id == program.id)
                .options(
                    joinedload(ProgramYearCourse.course),
                    joinedload(ProgramYearCourse.professor),
                )
                .order_by(ProgramYearCourse.year, ProgramYearCourse.id)
            )
        )
        if not plan_rows:
            raise bad_request("Program has no curriculum rows for scheduling")

        course_demand_by_pair = self._build_course_demand_map(
            program_id=program.id,
            course_year_pairs={(row.course_id, row.year) for row in plan_rows},
        )
        occupied_room_slots, occupied_professor_slots = self._get_confirmed_resource_occupancy()

        valid_course_ids = {row.course_id for row in plan_rows}
        course_id_by_plan_row_id = {row.id: row.course_id for row in plan_rows}

        preferred_timeslots_by_course_id: dict[UUID, list[UUID]] = {}
        for raw_preference_key, raw_slot_ids in payload.preferred_timeslot_by_course_id.items():
            try:
                parsed_key_id = UUID(raw_preference_key)
            except (TypeError, ValueError):
                continue

            # Accept both direct course IDs and program-year-plan row IDs from clients.
            if parsed_key_id in valid_course_ids:
                course_id = parsed_key_id
            else:
                course_id = course_id_by_plan_row_id.get(parsed_key_id)
                if course_id is None:
                    continue

            slot_ids: list[UUID] = []
            for raw_slot_id in raw_slot_ids:
                try:
                    slot_ids.append(UUID(raw_slot_id))
                except (TypeError, ValueError):
                    continue

            if slot_ids:
                existing_slot_ids = preferred_timeslots_by_course_id.get(course_id, [])
                preferred_timeslots_by_course_id[course_id] = list(dict.fromkeys(existing_slot_ids + slot_ids))

        try:
            prolog_solver = PrologClassScheduler()
            prolog_assignment_by_course_id = prolog_solver.solve(
                course_rows=[
                    PrologCourseRow(
                        course_id=row.course_id,
                        professor_id=row.professor_id,
                        year=row.year,
                        required_capacity=course_demand_by_pair.get((row.course_id, row.year), 0),
                    )
                    for row in plan_rows
                ],
                room_capacity_by_id={room.id: room.capacity for room in rooms},
                timeslot_ids=[slot.id for slot in timeslots],
                preferred_timeslots_by_course_id=preferred_timeslots_by_course_id,
                occupied_room_slots=occupied_room_slots,
                occupied_professor_slots=occupied_professor_slots,
                professor_no_overlap=payload.constraints.get("professorNoOverlap", True),
                student_groups_no_overlap=payload.constraints.get("studentGroupsNoOverlap", True),
                room_capacity_check=payload.constraints.get("roomCapacityCheck", True),
            )
        except Exception as error:
            raise bad_request(f"Unable to generate schedule using Prolog CSP solver: {error}") from error

        timeslot_by_id = {slot.id: slot for slot in timeslots}
        room_by_id = {room.id: room for room in rooms}

        snapshot = ScheduleClassSnapshot(
            program_id=program.id,
            status="draft",
            constraints=payload.constraints,
            selected_room_names=[room.name for room in rooms],
        )
        self.db.add(snapshot)
        self.db.flush()

        job = ScheduleGenerationJob(snapshot_id=snapshot.id, status="running", job_type="class")
        self.db.add(job)

        entries: list[ScheduleClassEntry] = []
        for row in plan_rows:
            prolog_assignment = prolog_assignment_by_course_id.get(row.course_id)
            chosen_room_id: UUID | None = None
            chosen_timeslot_id: UUID | None = None

            if prolog_assignment:
                prolog_room_id, prolog_timeslot_id = prolog_assignment
                prolog_room = room_by_id.get(prolog_room_id)
                prolog_slot = timeslot_by_id.get(prolog_timeslot_id)
                if prolog_room and prolog_slot:
                    chosen_room_id = prolog_room.id
                    chosen_timeslot_id = prolog_slot.id

            entry = ScheduleClassEntry(
                snapshot_id=snapshot.id,
                course_id=row.course_id,
                professor_id=row.professor_id,
                year=row.year,
                timeslot_id=chosen_timeslot_id,
                room_id=chosen_room_id,
                manually_adjusted=False,
            )
            entries.append(entry)
            self.db.add(entry)

        job.status = "succeeded"
        self.db.commit()

        return ClassScheduleJobRead(job_id=job.id, snapshot_id=snapshot.id, status=job.status)

    def get_latest_class_draft(self, program_value: str) -> ClassScheduleDraftRead:
        program = self.db.scalar(select(Program).where(Program.value == program_value.strip()))
        if not program:
            raise bad_request("Program does not exist")

        snapshot = self._get_latest_program_snapshot(program.id)
        if snapshot is None:
            raise not_found("Class schedule snapshot")
        return self.get_class_draft(snapshot.id)

    def list_program_draft_summary(self) -> list[ProgramDraftSummaryRead]:
        rows = self.db.execute(
            select(
                Program.value,
                Program.label,
                func.count(ScheduleClassSnapshot.id).filter(ScheduleClassSnapshot.status == "draft"),
            )
            .outerjoin(ScheduleClassSnapshot, ScheduleClassSnapshot.program_id == Program.id)
            .group_by(Program.value, Program.label)
            .order_by(Program.value)
        ).all()

        return [
            ProgramDraftSummaryRead(program_value=program_value, program_label=program_label, draft_count=draft_count)
            for program_value, program_label, draft_count in rows
        ]

    def list_program_confirmed_schedule_summary(self) -> list[ProgramConfirmedScheduleSummaryRead]:
        rows = self.db.execute(
            select(
                Program.value,
                Program.label,
                func.count(ScheduleClassSnapshot.id).filter(ScheduleClassSnapshot.status == "confirmed"),
            )
            .outerjoin(ScheduleClassSnapshot, ScheduleClassSnapshot.program_id == Program.id)
            .group_by(Program.value, Program.label)
            .order_by(Program.value)
        ).all()

        return [
            ProgramConfirmedScheduleSummaryRead(
                program_value=program_value,
                program_label=program_label,
                confirmed_count=confirmed_count,
            )
            for program_value, program_label, confirmed_count in rows
            if confirmed_count > 0
        ]

    def get_latest_confirmed_class_schedule(self, program_value: str) -> ClassScheduleDraftRead:
        program = self.db.scalar(select(Program).where(Program.value == program_value.strip()))
        if not program:
            raise bad_request("Program does not exist")

        snapshot = self._get_latest_program_snapshot(program.id, status="confirmed")
        if snapshot is None:
            raise not_found("Confirmed class schedule")
        return self.get_class_draft(snapshot.id)

    def delete_latest_confirmed_class_schedule(self, program_value: str) -> None:
        program = self.db.scalar(select(Program).where(Program.value == program_value.strip()))
        if not program:
            raise bad_request("Program does not exist")

        snapshot = self._get_latest_program_snapshot(program.id, status="confirmed")
        if snapshot is None:
            raise not_found("Confirmed class schedule")

        self.db.delete(snapshot)
        self.db.commit()

    def get_job(self, job_id: UUID) -> ClassScheduleJobRead:
        job = self.db.get(ScheduleGenerationJob, job_id)
        if not job:
            raise not_found("Scheduling job")
        return ClassScheduleJobRead(
            job_id=job.id,
            snapshot_id=job.snapshot_id,
            status=job.status,
            error_message=job.error_message,
        )

    def get_class_draft(self, snapshot_id: UUID) -> ClassScheduleDraftRead:
        snapshot = self._get_snapshot(snapshot_id)
        entries_with_conflicts, conflict_count = self._serialize_entries_with_conflicts(snapshot)
        selected_room_ids = self._get_room_ids_by_names(snapshot.selected_room_names)
        confirmed_occupancies = self._list_confirmed_occupancies(
            exclude_snapshot_id=snapshot.id,
            room_ids=selected_room_ids,
        )

        return ClassScheduleDraftRead(
            id=snapshot.id,
            program_id=snapshot.program_id,
            program_value=snapshot.program.value,
            program_label=snapshot.program.label,
            status=snapshot.status,
            constraints=snapshot.constraints,
            selected_room_names=snapshot.selected_room_names,
            entries=entries_with_conflicts,
            confirmed_occupancies=confirmed_occupancies,
            conflict_count=conflict_count,
            created_at=snapshot.created_at,
            updated_at=snapshot.updated_at,
        )

    def save_class_draft(self, snapshot_id: UUID, payload: SaveClassScheduleDraftRequest) -> ClassScheduleDraftRead:
        snapshot = self._get_snapshot(snapshot_id)
        entry_by_id = {entry.id: entry for entry in snapshot.entries}

        for patch in payload.entries:
            entry = entry_by_id.get(patch.id)
            if not entry:
                raise bad_request("Draft entry does not belong to this snapshot")

            if patch.timeslot_id is not None:
                slot = self.db.get(Timeslot, patch.timeslot_id)
                if not slot:
                    raise bad_request("Timeslot does not exist")
                entry.timeslot_id = slot.id

            if patch.room_id is not None:
                room = self.db.get(Room, patch.room_id)
                if not room:
                    raise bad_request("Room does not exist")
                entry.room_id = room.id

            entry.manually_adjusted = True

        has_unassigned_entry = any(not entry.timeslot_id or not entry.room_id for entry in snapshot.entries)
        if has_unassigned_entry:
            raise bad_request("Cannot save schedule while some courses are unassigned. Assign room and timeslot for all courses.")

        occupied_room_slots, occupied_professor_slots = self._get_confirmed_resource_occupancy(
            exclude_snapshot_id=snapshot.id,
        )
        for entry in snapshot.entries:
            if not entry.timeslot_id:
                continue
            if entry.room_id and (entry.room_id, entry.timeslot_id) in occupied_room_slots:
                raise bad_request("Cannot save schedule due to room overlap with an existing confirmed schedule")
            if (
                snapshot.constraints.get("professorNoOverlap", True)
                and entry.professor_id
                and (entry.professor_id, entry.timeslot_id) in occupied_professor_slots
            ):
                raise bad_request("Cannot save schedule due to professor overlap with an existing confirmed schedule")

        snapshot.status = "confirmed"

        self.db.commit()
        refreshed_snapshot = self._get_snapshot(snapshot_id)
        return self.get_class_draft(refreshed_snapshot.id)

    def delete_class_draft(self, snapshot_id: UUID) -> None:
        snapshot = self.db.get(ScheduleClassSnapshot, snapshot_id)
        if not snapshot:
            raise not_found("Schedule draft snapshot")
        self.db.delete(snapshot)
        self.db.commit()

    def _get_snapshot(self, snapshot_id: UUID) -> ScheduleClassSnapshot:
        snapshot = self.db.scalar(
            select(ScheduleClassSnapshot)
            .where(ScheduleClassSnapshot.id == snapshot_id)
            .options(
                joinedload(ScheduleClassSnapshot.program),
                joinedload(ScheduleClassSnapshot.entries).joinedload(ScheduleClassEntry.course),
                joinedload(ScheduleClassSnapshot.entries).joinedload(ScheduleClassEntry.professor),
                joinedload(ScheduleClassSnapshot.entries).joinedload(ScheduleClassEntry.timeslot),
                joinedload(ScheduleClassSnapshot.entries).joinedload(ScheduleClassEntry.room),
            )
        )
        if not snapshot:
            raise not_found("Schedule draft snapshot")
        return snapshot

    def _get_latest_program_snapshot(self, program_id: UUID, status: str | None = None) -> ScheduleClassSnapshot | None:
        stmt = select(ScheduleClassSnapshot).where(ScheduleClassSnapshot.program_id == program_id)
        if status is not None:
            stmt = stmt.where(ScheduleClassSnapshot.status == status)

        return self.db.scalar(
            stmt.order_by(ScheduleClassSnapshot.updated_at.desc(), ScheduleClassSnapshot.created_at.desc()).limit(1)
        )

    def _serialize_entries_with_conflicts(
        self,
        snapshot: ScheduleClassSnapshot,
    ) -> tuple[list[ScheduleClassEntryRead], int]:
        conflict_codes_by_entry_id = self._compute_conflicts_for_entries(
            entries=snapshot.entries,
            constraints=snapshot.constraints,
            program_id=snapshot.program_id,
            snapshot_id=snapshot.id,
        )
        conflict_count = 0
        serialized: list[ScheduleClassEntryRead] = []

        # Resolve ProgramYearCourse row IDs so frontend can map per-row preferences.
        course_year_pairs = {(entry.course_id, entry.year) for entry in snapshot.entries}
        plan_rows = list(
            self.db.scalars(
                select(ProgramYearCourse)
                .where(ProgramYearCourse.program_id == snapshot.program_id)
                .where(ProgramYearCourse.course_id.in_([course_id for course_id, _ in course_year_pairs]))
                .where(ProgramYearCourse.year.in_([year for _, year in course_year_pairs]))
            )
        )
        plan_row_id_by_course_year = {
            (row.course_id, row.year): row.id
            for row in plan_rows
        }

        course_demand_by_pair = self._build_course_demand_map(
            program_id=snapshot.program_id,
            course_year_pairs=course_year_pairs,
        )

        for entry in sorted(snapshot.entries, key=lambda item: (item.year, item.course.code)):
            codes = conflict_codes_by_entry_id.get(entry.id, [])
            conflicts = [self._build_conflict(code) for code in codes]
            if conflicts:
                conflict_count += 1

            serialized.append(
                ScheduleClassEntryRead(
                    id=entry.id,
                    program_year_course_id=plan_row_id_by_course_year.get((entry.course_id, entry.year)),
                    course_id=entry.course_id,
                    course_code=entry.course.code,
                    course_name=entry.course.name,
                    professor_id=entry.professor_id,
                    professor_name=entry.professor.name if entry.professor else None,
                    year=entry.year,
                    timeslot_id=entry.timeslot_id,
                    timeslot_label=entry.timeslot.label if entry.timeslot else None,
                    day=entry.timeslot.day if entry.timeslot else None,
                    room_id=entry.room_id,
                    room_name=entry.room.name if entry.room else None,
                    required_capacity=course_demand_by_pair.get((entry.course_id, entry.year), 0),
                    manually_adjusted=entry.manually_adjusted,
                    conflicts=conflicts,
                )
            )

        return serialized, conflict_count

    def _compute_conflicts_for_entries(
        self,
        entries: list[ScheduleClassEntry],
        constraints: dict[str, bool],
        program_id: UUID,
        snapshot_id: UUID,
    ) -> dict[UUID, list[str]]:
        conflicts_by_id: defaultdict[UUID, list[str]] = defaultdict(list)
        occupied_room_slots, occupied_professor_slots = self._get_confirmed_resource_occupancy(
            exclude_snapshot_id=snapshot_id,
        )

        course_demand_by_pair = self._build_course_demand_map(
            program_id=program_id,
            course_year_pairs={(entry.course_id, entry.year) for entry in entries},
        )

        by_room_slot: defaultdict[tuple[UUID, UUID], list[ScheduleClassEntry]] = defaultdict(list)
        by_prof_slot: defaultdict[tuple[UUID, UUID], list[ScheduleClassEntry]] = defaultdict(list)
        by_year_slot: defaultdict[tuple[int, UUID], list[ScheduleClassEntry]] = defaultdict(list)

        for entry in entries:
            if not entry.timeslot_id:
                conflicts_by_id[entry.id].append("unassigned")
                continue
            if not entry.room_id:
                conflicts_by_id[entry.id].append("unassigned")

            if constraints.get("roomCapacityCheck", True) and entry.room is not None:
                required_capacity = course_demand_by_pair.get((entry.course_id, entry.year), 0)
                if entry.room.capacity < required_capacity:
                    conflicts_by_id[entry.id].append("room_capacity_exceeded")

            if entry.room_id and entry.timeslot_id and (entry.room_id, entry.timeslot_id) in occupied_room_slots:
                conflicts_by_id[entry.id].append("room_overlap")

            if (
                constraints.get("professorNoOverlap", True)
                and entry.professor_id
                and entry.timeslot_id
                and (entry.professor_id, entry.timeslot_id) in occupied_professor_slots
            ):
                conflicts_by_id[entry.id].append("professor_overlap")

            if entry.room_id and entry.timeslot_id:
                by_room_slot[(entry.room_id, entry.timeslot_id)].append(entry)
            if constraints.get("professorNoOverlap", True) and entry.professor_id and entry.timeslot_id:
                by_prof_slot[(entry.professor_id, entry.timeslot_id)].append(entry)
            if constraints.get("studentGroupsNoOverlap", True) and entry.timeslot_id:
                by_year_slot[(entry.year, entry.timeslot_id)].append(entry)

        for grouped in by_room_slot.values():
            if len(grouped) > 1:
                for entry in grouped:
                    conflicts_by_id[entry.id].append("room_overlap")

        for grouped in by_prof_slot.values():
            if len(grouped) > 1:
                for entry in grouped:
                    conflicts_by_id[entry.id].append("professor_overlap")

        for grouped in by_year_slot.values():
            if len(grouped) > 1:
                for entry in grouped:
                    conflicts_by_id[entry.id].append("year_overlap")

        return conflicts_by_id

    def _compute_conflict_codes_for_candidate(
        self,
        entries: list[ScheduleClassEntry],
        year: int,
        professor_id: UUID | None,
        timeslot_id: UUID,
        room_id: UUID,
        constraints: dict[str, bool],
        occupied_room_slots: set[tuple[UUID, UUID]],
        occupied_professor_slots: set[tuple[UUID, UUID]],
    ) -> list[str]:
        codes: list[str] = []

        if (room_id, timeslot_id) in occupied_room_slots:
            codes.append("room_overlap")

        if constraints.get("professorNoOverlap", True) and professor_id and (professor_id, timeslot_id) in occupied_professor_slots:
            codes.append("professor_overlap")

        for entry in entries:
            if entry.timeslot_id != timeslot_id:
                continue

            if entry.room_id == room_id:
                codes.append("room_overlap")

            if constraints.get("professorNoOverlap", True) and professor_id and entry.professor_id == professor_id:
                codes.append("professor_overlap")

            if constraints.get("studentGroupsNoOverlap", True) and entry.year == year:
                codes.append("year_overlap")

        return codes

    def _get_confirmed_resource_occupancy(
        self,
        exclude_snapshot_id: UUID | None = None,
    ) -> tuple[set[tuple[UUID, UUID]], set[tuple[UUID, UUID]]]:
        stmt = (
            select(
                ScheduleClassEntry.room_id,
                ScheduleClassEntry.professor_id,
                ScheduleClassEntry.timeslot_id,
            )
            .join(ScheduleClassSnapshot, ScheduleClassSnapshot.id == ScheduleClassEntry.snapshot_id)
            .where(
                ScheduleClassSnapshot.status == "confirmed",
                ScheduleClassEntry.timeslot_id.is_not(None),
            )
        )

        if exclude_snapshot_id is not None:
            stmt = stmt.where(ScheduleClassEntry.snapshot_id != exclude_snapshot_id)

        room_slots: set[tuple[UUID, UUID]] = set()
        professor_slots: set[tuple[UUID, UUID]] = set()

        rows = self.db.execute(stmt).all()
        for room_id, professor_id, timeslot_id in rows:
            if not timeslot_id:
                continue
            if room_id:
                room_slots.add((room_id, timeslot_id))
            if professor_id:
                professor_slots.add((professor_id, timeslot_id))

        return room_slots, professor_slots

    def _get_room_ids_by_names(self, room_names: list[str]) -> set[UUID] | None:
        if not room_names:
            return None

        rows = self.db.execute(select(Room.id).where(Room.name.in_(room_names))).all()
        return {room_id for (room_id,) in rows}

    def _list_confirmed_occupancies(
        self,
        *,
        exclude_snapshot_id: UUID,
        room_ids: set[UUID] | None,
    ) -> list[ConfirmedOccupancyRead]:
        if room_ids is not None and len(room_ids) == 0:
            return []

        stmt = (
            select(
                ScheduleClassEntry.room_id,
                ScheduleClassEntry.timeslot_id,
                Course.code,
                Course.name,
            )
            .join(ScheduleClassSnapshot, ScheduleClassSnapshot.id == ScheduleClassEntry.snapshot_id)
            .join(Course, Course.id == ScheduleClassEntry.course_id)
            .where(
                ScheduleClassSnapshot.status == "confirmed",
                ScheduleClassEntry.snapshot_id != exclude_snapshot_id,
                ScheduleClassEntry.room_id.is_not(None),
                ScheduleClassEntry.timeslot_id.is_not(None),
            )
        )

        if room_ids is not None:
            stmt = stmt.where(ScheduleClassEntry.room_id.in_(room_ids))

        rows = self.db.execute(stmt).all()

        if not rows:
            return []

        seen: set[tuple[UUID, UUID]] = set()
        result: list[ConfirmedOccupancyRead] = []
        for room_id, timeslot_id, course_code, course_name in rows:
            key = (room_id, timeslot_id)
            if key in seen:
                continue
            seen.add(key)
            result.append(
                ConfirmedOccupancyRead(
                    room_id=room_id,
                    timeslot_id=timeslot_id,
                    course_code=course_code,
                    course_name=course_name,
                )
            )

        return result

    def _build_course_demand_map(
        self,
        program_id: UUID,
        course_year_pairs: set[tuple[UUID, int]],
    ) -> dict[tuple[UUID, int], int]:
        if not course_year_pairs:
            return {}

        years = {year for _, year in course_year_pairs}
        course_ids = {course_id for course_id, _ in course_year_pairs}

        base_counts = self.db.execute(
            select(Student.year, func.count(Student.id))
            .where(
                Student.program_id == program_id,
                Student.year.in_(years),
            )
            .group_by(Student.year)
        ).all()
        base_students_by_year = {year: count for year, count in base_counts}

        special_rows = self.db.execute(
            select(
                SpecialEnrollmentCourse.course_id,
                Student.id,
                Student.program_id,
                Student.year,
            )
            .join(
                SpecialEnrollment,
                SpecialEnrollment.id == SpecialEnrollmentCourse.enrollment_id,
            )
            .join(Student, Student.id == SpecialEnrollment.student_id)
            .where(SpecialEnrollmentCourse.course_id.in_(course_ids))
        ).all()

        special_students_by_course: dict[UUID, dict[UUID, tuple[UUID, int]]] = defaultdict(dict)
        for course_id, student_id, student_program_id, student_year in special_rows:
            special_students_by_course[course_id][student_id] = (student_program_id, student_year)

        demand_by_pair: dict[tuple[UUID, int], int] = {}
        for course_id, year in course_year_pairs:
            base_demand = base_students_by_year.get(year, 0)
            additional_demand = sum(
                1
                for student_program_id, student_year in special_students_by_course.get(course_id, {}).values()
                if not (student_program_id == program_id and student_year == year)
            )
            demand_by_pair[(course_id, year)] = base_demand + additional_demand

        return demand_by_pair

    @staticmethod
    def _build_conflict(code: str) -> ScheduleConflictRead:
        messages = {
            "room_overlap": "Room has another class at this timeslot.",
            "professor_overlap": "Professor has another class at this timeslot.",
            "year_overlap": "This year already has a class at this timeslot.",
            "unassigned": "Missing room or timeslot assignment.",
            "room_capacity_exceeded": "Room capacity is smaller than expected enrollment.",
        }
        return ScheduleConflictRead(code=code, message=messages.get(code, "Conflict detected."))
