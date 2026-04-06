from __future__ import annotations

from datetime import date
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

from app.models.resource import ScheduleExamEntry, ScheduleExamSnapshot
from app.services.scheduling.exam_draft_scope_service import ExamDraftScopeService
from conftest import FakeSession


def make_exam_entry(program_id: UUID, **overrides):
    base = {
        "id": uuid4(),
        "program_id": program_id,
        "program_year_course_id": None,
        "course_id": uuid4(),
        "year": 1,
        "semester": "1",
        "exam_type": "final",
        "exam_date": date(2026, 5, 11),
        "timeslot_code": "morning-exam",
        "room_id": uuid4(),
        "manually_adjusted": False,
    }
    base.update(overrides)
    return SimpleNamespace(**base)


class TestExamDraftScopeService:
    """Validate snapshot-level and program-scoped exam make-draft behavior."""

    def test_make_as_draft_without_program_value_marks_whole_snapshot_as_draft(self):
        # Arrange
        snapshot = SimpleNamespace(id=uuid4(), status="confirmed", entries=[])
        db = FakeSession()
        service = ExamDraftScopeService(db)

        # Act
        result_id = service.make_as_draft(snapshot=snapshot, program_value=None)

        # Assert
        assert result_id == snapshot.id
        assert snapshot.status == "draft"
        assert db.commit_calls == 1

    def test_make_as_draft_raises_bad_request_for_unknown_program(self):
        # Arrange
        snapshot = SimpleNamespace(id=uuid4(), status="confirmed", entries=[])
        db = FakeSession(scalar_queue=[None])
        service = ExamDraftScopeService(db)

        # Act / Assert
        with pytest.raises(HTTPException) as exc:
            service.make_as_draft(snapshot=snapshot, program_value="se")
        assert exc.value.status_code == 400
        assert exc.value.detail == "Program does not exist"

    def test_make_as_draft_raises_not_found_when_program_has_no_entries_in_snapshot(self):
        # Arrange
        target_program = SimpleNamespace(id=uuid4(), value="se")
        snapshot = SimpleNamespace(id=uuid4(), status="confirmed", entries=[])
        db = FakeSession(scalar_queue=[target_program])
        service = ExamDraftScopeService(db)

        # Act / Assert
        with pytest.raises(HTTPException) as exc:
            service.make_as_draft(snapshot=snapshot, program_value="se")
        assert exc.value.status_code == 404
        assert exc.value.detail == "Program schedule entries not found"

    def test_make_as_draft_with_only_target_program_entries_marks_existing_snapshot_as_draft(self):
        # Arrange
        target_program = SimpleNamespace(id=uuid4(), value="se")
        snapshot = SimpleNamespace(
            id=uuid4(),
            status="confirmed",
            entries=[make_exam_entry(target_program.id)],
        )
        db = FakeSession(scalar_queue=[target_program])
        service = ExamDraftScopeService(db)

        # Act
        result_id = service.make_as_draft(snapshot=snapshot, program_value="se")

        # Assert
        assert result_id == snapshot.id
        assert snapshot.status == "draft"
        assert db.commit_calls == 1
        assert db.added == []

    def test_make_as_draft_with_remaining_programs_splits_new_draft_snapshot(self):
        # Arrange
        target_program = SimpleNamespace(id=uuid4(), value="se")
        other_program = SimpleNamespace(id=uuid4(), value="it")

        target_entry = make_exam_entry(target_program.id)
        remaining_entry = make_exam_entry(other_program.id)

        snapshot = SimpleNamespace(
            id=uuid4(),
            job_name="Final Exam Round",
            status="confirmed",
            constraints={"no_student_overlap": True},
            selected_room_names=["R1"],
            exam_dates=["2026-05-11"],
            program_values=["se", "it"],
            entries=[target_entry, remaining_entry],
        )

        db = FakeSession(
            scalar_queue=[target_program],
            scalars_queue=[["it"]],
        )
        service = ExamDraftScopeService(db)

        # Act
        draft_id = service.make_as_draft(snapshot=snapshot, program_value="se")

        # Assert
        created_snapshots = [item for item in db.added if isinstance(item, ScheduleExamSnapshot)]
        created_entries = [item for item in db.added if isinstance(item, ScheduleExamEntry)]

        assert len(created_snapshots) == 1
        assert len(created_entries) == 1
        assert created_entries[0].program_id == target_program.id
        assert target_entry in db.deleted
        assert remaining_entry not in db.deleted
        assert snapshot.program_values == ["it"]
        assert db.commit_calls == 1
        assert draft_id == created_snapshots[0].id
