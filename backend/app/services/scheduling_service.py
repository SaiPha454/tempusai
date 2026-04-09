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
    ClassDraftScheduleSummaryRead,
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
from app.repositories.schedule_occupancy_repository import ScheduleOccupancyRepository
from app.services.errors import bad_request, not_found
from app.services.prolog_csp import PrologClassScheduler, PrologCourseRow
from app.services.scheduling.class_commit_validator import ClassCommitValidator
from app.services.scheduling.class_conflict_detector import ClassConflictDetector
from app.services.scheduling.class_demand_service import ClassDemandService
from app.services.scheduling.class_patch_service import ClassDraftPatchService
from app.services.scheduling.class_preference_parser import ClassPreferenceParser


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
        self._occupancy_repository = ScheduleOccupancyRepository(db)
        self._demand_service = ClassDemandService(db)
        self._patch_service = ClassDraftPatchService(db)
        self._conflict_detector = ClassConflictDetector()
        self._commit_validator = ClassCommitValidator()

    def create_class_generation_job(self, payload: ClassScheduleGenerateRequest) -> ClassScheduleJobRead:
        cleaned_job_name = payload.job_name.strip()
        if not cleaned_job_name:
            raise bad_request("Scheduling job name is required")

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

        course_demand_by_pair = self._demand_service.build_course_demand_map(
            program_id=program.id,
            course_year_pairs={(row.course_id, row.year) for row in plan_rows},
        )
        occupied_room_slots, occupied_professor_slots = self._occupancy_repository.get_confirmed_class_resource_occupancy()

        valid_course_ids = {row.course_id for row in plan_rows}
        course_id_by_plan_row_id = {row.id: row.course_id for row in plan_rows}

        preferred_timeslots_by_course_id = ClassPreferenceParser.parse_preferred_timeslots(
            raw_preferred_timeslots=payload.preferred_timeslot_by_course_id,
            valid_course_ids=valid_course_ids,
            course_id_by_plan_row_id=course_id_by_plan_row_id,
        )

        self._ensure_class_generation_feasible(
            plan_rows=plan_rows,
            rooms=rooms,
            timeslots=timeslots,
            course_demand_by_pair=course_demand_by_pair,
            preferred_timeslots_by_course_id=preferred_timeslots_by_course_id,
            occupied_room_slots=occupied_room_slots,
            occupied_professor_slots=occupied_professor_slots,
            constraints=payload.constraints,
        )

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
            job_name=cleaned_job_name,
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

    def _ensure_class_generation_feasible(
        self,
        *,
        plan_rows: list[ProgramYearCourse],
        rooms: list[Room],
        timeslots: list[Timeslot],
        course_demand_by_pair: dict[tuple[UUID, int], int],
        preferred_timeslots_by_course_id: dict[UUID, list[UUID]],
        occupied_room_slots: set[tuple[UUID, UUID]],
        occupied_professor_slots: set[tuple[UUID, UUID]],
        constraints: dict[str, bool],
    ) -> None:
        if not plan_rows:
            raise bad_request("Program has no curriculum rows for scheduling")

        room_capacity_check = constraints.get("roomCapacityCheck", True)
        professor_no_overlap = constraints.get("professorNoOverlap", True)
        student_groups_no_overlap = constraints.get("studentGroupsNoOverlap", True)

        all_timeslot_ids = [slot.id for slot in timeslots]
        all_room_slot_pairs = {
            (room.id, timeslot_id)
            for room in rooms
            for timeslot_id in all_timeslot_ids
        }
        available_room_slot_pairs = {
            pair for pair in all_room_slot_pairs if pair not in occupied_room_slots
        }

        if len(available_room_slot_pairs) < len(plan_rows):
            raise bad_request(
                "Scheduling is not feasible with selected resources. "
                f"Available room-timeslot combinations: {len(available_room_slot_pairs)}, "
                f"required course assignments: {len(plan_rows)}."
            )

        feasible_slot_ids_by_course: dict[UUID, set[UUID]] = {}
        zero_candidate_courses: list[str] = []

        for row in plan_rows:
            preferred_timeslot_ids = preferred_timeslots_by_course_id.get(row.course_id)
            candidate_timeslot_ids = preferred_timeslot_ids if preferred_timeslot_ids else all_timeslot_ids
            required_capacity = course_demand_by_pair.get((row.course_id, row.year), 0)

            feasible_slot_ids: set[UUID] = set()
            feasible_pair_count = 0
            for timeslot_id in candidate_timeslot_ids:
                if professor_no_overlap and row.professor_id and (row.professor_id, timeslot_id) in occupied_professor_slots:
                    continue

                has_room_for_slot = False
                for room in rooms:
                    if (room.id, timeslot_id) in occupied_room_slots:
                        continue
                    if room_capacity_check and required_capacity > room.capacity:
                        continue
                    has_room_for_slot = True
                    feasible_pair_count += 1

                if has_room_for_slot:
                    feasible_slot_ids.add(timeslot_id)

            feasible_slot_ids_by_course[row.id] = feasible_slot_ids
            if feasible_pair_count == 0:
                zero_candidate_courses.append(f"{row.course.code} (year {row.year})")

        if zero_candidate_courses:
            preview = ", ".join(zero_candidate_courses[:5])
            if len(zero_candidate_courses) > 5:
                preview = f"{preview}, ..."
            raise bad_request(
                "Scheduling is not feasible for the current class resources. "
                f"No valid room-timeslot candidate for: {preview}."
            )

        if student_groups_no_overlap:
            rows_by_year: dict[int, list[ProgramYearCourse]] = {}
            for row in plan_rows:
                rows_by_year.setdefault(row.year, []).append(row)

            for year, rows in rows_by_year.items():
                available_slots_for_year: set[UUID] = set()
                for row in rows:
                    available_slots_for_year.update(feasible_slot_ids_by_course.get(row.id, set()))
                if len(available_slots_for_year) < len(rows):
                    raise bad_request(
                        "Scheduling is not feasible for student-group overlap constraints. "
                        f"Year {year} has {len(rows)} courses but only {len(available_slots_for_year)} usable timeslots."
                    )

        if professor_no_overlap:
            rows_by_professor: dict[UUID, list[ProgramYearCourse]] = {}
            for row in plan_rows:
                if row.professor_id is None:
                    continue
                rows_by_professor.setdefault(row.professor_id, []).append(row)

            for rows in rows_by_professor.values():
                if len(rows) <= 1:
                    continue
                available_slots_for_professor: set[UUID] = set()
                for row in rows:
                    available_slots_for_professor.update(feasible_slot_ids_by_course.get(row.id, set()))
                if len(available_slots_for_professor) < len(rows):
                    professor_name = rows[0].professor.name if rows[0].professor else "Unknown"
                    raise bad_request(
                        "Scheduling is not feasible for professor availability constraints. "
                        f"Professor {professor_name} has {len(rows)} courses but only "
                        f"{len(available_slots_for_professor)} usable timeslots."
                    )

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

    def list_class_draft_summaries(self) -> list[ClassDraftScheduleSummaryRead]:
        snapshots = list(
            self.db.scalars(
                select(ScheduleClassSnapshot)
                .where(ScheduleClassSnapshot.status == "draft")
                .options(joinedload(ScheduleClassSnapshot.program))
                .order_by(ScheduleClassSnapshot.updated_at.desc(), ScheduleClassSnapshot.created_at.desc())
            )
        )

        if not snapshots:
            return []

        entry_counts = {
            snapshot_id: count
            for snapshot_id, count in self.db.execute(
                select(ScheduleClassEntry.snapshot_id, func.count(ScheduleClassEntry.id))
                .where(ScheduleClassEntry.snapshot_id.in_([snapshot.id for snapshot in snapshots]))
                .group_by(ScheduleClassEntry.snapshot_id)
            )
        }

        return [
            ClassDraftScheduleSummaryRead(
                id=snapshot.id,
                job_name=snapshot.job_name,
                program_value=snapshot.program.value,
                program_label=snapshot.program.label,
                status=snapshot.status,
                entry_count=entry_counts.get(snapshot.id, 0),
                created_at=snapshot.created_at,
                updated_at=snapshot.updated_at,
            )
            for snapshot in snapshots
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
            job_name=snapshot.job_name,
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

        self._patch_service.apply_entry_patches(entry_by_id=entry_by_id, patches=payload.entries)

        self.db.commit()
        refreshed_snapshot = self._get_snapshot(snapshot_id)
        return self.get_class_draft(refreshed_snapshot.id)

    def commit_class_draft(self, snapshot_id: UUID, payload: SaveClassScheduleDraftRequest) -> ClassScheduleDraftRead:
        snapshot = self._get_snapshot(snapshot_id)
        entry_by_id = {entry.id: entry for entry in snapshot.entries}

        self._patch_service.apply_entry_patches(entry_by_id=entry_by_id, patches=payload.entries)

        occupied_room_slots, occupied_professor_slots = self._occupancy_repository.get_confirmed_class_resource_occupancy(
            exclude_snapshot_id=snapshot.id,
        )

        existing_confirmed = self.db.scalar(
            select(ScheduleClassSnapshot.id)
            .where(ScheduleClassSnapshot.program_id == snapshot.program_id)
            .where(ScheduleClassSnapshot.status == "confirmed")
            .where(ScheduleClassSnapshot.id != snapshot.id)
            .limit(1)
        )
        errors = self._commit_validator.validate(
            snapshot=snapshot,
            occupied_room_slots=occupied_room_slots,
            occupied_professor_slots=occupied_professor_slots,
            has_existing_confirmed_snapshot=existing_confirmed is not None,
        )
        if errors:
            raise bad_request(errors[0])

        snapshot.status = "confirmed"

        self.db.commit()
        refreshed_snapshot = self._get_snapshot(snapshot_id)
        return self.get_class_draft(refreshed_snapshot.id)

    def make_class_schedule_as_draft(self, snapshot_id: UUID) -> ClassScheduleDraftRead:
        snapshot = self._get_snapshot(snapshot_id)
        if snapshot.status != "draft":
            snapshot.status = "draft"
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

        course_demand_by_pair = self._demand_service.build_course_demand_map(
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
        occupied_room_slots, occupied_professor_slots = self._occupancy_repository.get_confirmed_class_resource_occupancy(
            exclude_snapshot_id=snapshot_id,
        )

        course_demand_by_pair = self._demand_service.build_course_demand_map(
            program_id=program_id,
            course_year_pairs={(entry.course_id, entry.year) for entry in entries},
        )

        return self._conflict_detector.compute_entry_conflicts(
            entries=entries,
            constraints=constraints,
            course_demand_by_pair=course_demand_by_pair,
            occupied_room_slots=occupied_room_slots,
            occupied_professor_slots=occupied_professor_slots,
        )

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
        return self._conflict_detector.compute_candidate_conflict_codes(
            entries=entries,
            year=year,
            professor_id=professor_id,
            timeslot_id=timeslot_id,
            room_id=room_id,
            constraints=constraints,
            occupied_room_slots=occupied_room_slots,
            occupied_professor_slots=occupied_professor_slots,
        )

    def _get_confirmed_resource_occupancy(
        self,
        exclude_snapshot_id: UUID | None = None,
    ) -> tuple[set[tuple[UUID, UUID]], set[tuple[UUID, UUID]]]:
        return self._occupancy_repository.get_confirmed_class_resource_occupancy(
            exclude_snapshot_id=exclude_snapshot_id,
        )

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

        return self._occupancy_repository.list_confirmed_class_occupancies(
            exclude_snapshot_id=exclude_snapshot_id,
            room_ids=room_ids,
        )

    def _build_course_demand_map(
        self,
        program_id: UUID,
        course_year_pairs: set[tuple[UUID, int]],
    ) -> dict[tuple[UUID, int], int]:
        return self._demand_service.build_course_demand_map(
            program_id=program_id,
            course_year_pairs=course_year_pairs,
        )

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
