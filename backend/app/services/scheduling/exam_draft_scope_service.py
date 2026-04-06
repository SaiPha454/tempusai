from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.resource import Program, ScheduleExamEntry, ScheduleExamSnapshot
from app.services.errors import bad_request, not_found


class ExamDraftScopeService:
    """Handle exam draft scoping operations while preserving confirmed snapshots."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def make_as_draft(
        self,
        *,
        snapshot: ScheduleExamSnapshot,
        program_value: str | None,
    ) -> UUID:
        target_program_value = (program_value or "").strip()
        if not target_program_value:
            if snapshot.status != "draft":
                snapshot.status = "draft"
                self.db.commit()
            return snapshot.id

        target_program = self.db.scalar(select(Program).where(Program.value == target_program_value))
        if not target_program:
            raise bad_request("Program does not exist")

        target_entries = [entry for entry in snapshot.entries if entry.program_id == target_program.id]
        if not target_entries:
            raise not_found("Program schedule entries")

        remaining_entries = [entry for entry in snapshot.entries if entry.program_id != target_program.id]
        if not remaining_entries:
            if snapshot.status != "draft":
                snapshot.status = "draft"
                self.db.commit()
            return snapshot.id

        draft_snapshot = ScheduleExamSnapshot(
            job_name=snapshot.job_name,
            status="draft",
            constraints=snapshot.constraints,
            selected_room_names=snapshot.selected_room_names,
            exam_dates=snapshot.exam_dates,
            program_values=[target_program_value],
        )
        self.db.add(draft_snapshot)
        self.db.flush()

        for entry in target_entries:
            cloned_entry = ScheduleExamEntry(
                snapshot_id=draft_snapshot.id,
                program_id=entry.program_id,
                program_year_course_id=entry.program_year_course_id,
                course_id=entry.course_id,
                year=entry.year,
                semester=entry.semester,
                exam_type=entry.exam_type,
                exam_date=entry.exam_date,
                timeslot_code=entry.timeslot_code,
                room_id=entry.room_id,
                manually_adjusted=entry.manually_adjusted,
            )
            self.db.add(cloned_entry)

        for entry in target_entries:
            self.db.delete(entry)

        remaining_program_ids = {entry.program_id for entry in remaining_entries}
        remaining_program_values = list(
            self.db.scalars(
                select(Program.value)
                .where(Program.id.in_(remaining_program_ids))
                .order_by(Program.value)
            )
        )
        snapshot.program_values = remaining_program_values

        self.db.commit()
        return draft_snapshot.id
