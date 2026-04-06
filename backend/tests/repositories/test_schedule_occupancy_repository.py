from __future__ import annotations

from datetime import date
from uuid import uuid4

from app.repositories.schedule_occupancy_repository import ScheduleOccupancyRepository
from conftest import FakeSession


class TestScheduleOccupancyRepository:
    """Validate occupancy repository transformation and deduplication logic."""

    def test_get_confirmed_class_resource_occupancy_filters_nullable_fields_correctly(self):
        # Arrange
        room_1 = uuid4()
        room_2 = uuid4()
        prof_1 = uuid4()
        prof_2 = uuid4()
        slot_1 = uuid4()
        slot_2 = uuid4()

        db = FakeSession(
            execute_rows_queue=[
                [
                    (room_1, prof_1, slot_1),
                    (None, prof_2, slot_1),
                    (room_2, None, slot_2),
                    (uuid4(), uuid4(), None),
                ]
            ]
        )
        repository = ScheduleOccupancyRepository(db)

        # Act
        room_slots, professor_slots = repository.get_confirmed_class_resource_occupancy()

        # Assert
        assert room_slots == {(room_1, slot_1), (room_2, slot_2)}
        assert professor_slots == {(prof_1, slot_1), (prof_2, slot_1)}

    def test_list_confirmed_class_occupancies_returns_empty_when_room_filter_is_explicitly_empty(self):
        # Arrange
        repository = ScheduleOccupancyRepository(FakeSession())

        # Act
        result = repository.list_confirmed_class_occupancies(exclude_snapshot_id=uuid4(), room_ids=set())

        # Assert
        assert result == []

    def test_list_confirmed_class_occupancies_deduplicates_by_room_and_timeslot(self):
        # Arrange
        room_id = uuid4()
        slot_id = uuid4()
        db = FakeSession(
            execute_rows_queue=[
                [
                    (room_id, slot_id, "CS101", "Intro"),
                    (room_id, slot_id, "CS101", "Intro"),
                ]
            ]
        )
        repository = ScheduleOccupancyRepository(db)

        # Act
        result = repository.list_confirmed_class_occupancies(exclude_snapshot_id=uuid4(), room_ids=None)

        # Assert
        assert len(result) == 1
        assert result[0].room_id == room_id
        assert result[0].timeslot_id == slot_id

    def test_get_confirmed_exam_room_slots_returns_unique_room_date_slot_keys(self):
        # Arrange
        room_id = uuid4()
        exam_day = date(2026, 5, 12)
        db = FakeSession(execute_rows_queue=[[(room_id, exam_day, "morning-exam"), (room_id, exam_day, "morning-exam")]])
        repository = ScheduleOccupancyRepository(db)

        # Act
        result = repository.get_confirmed_exam_room_slots()

        # Assert
        assert result == {(room_id, exam_day, "morning-exam")}

    def test_list_confirmed_exam_occupancies_deduplicates_by_room_date_and_slot(self):
        # Arrange
        room_id = uuid4()
        exam_day = date(2026, 5, 13)
        db = FakeSession(
            execute_rows_queue=[
                [
                    (room_id, exam_day, "afternoon-exam", "CS201", "Algorithms"),
                    (room_id, exam_day, "afternoon-exam", "CS201", "Algorithms"),
                ]
            ]
        )
        repository = ScheduleOccupancyRepository(db)

        # Act
        result = repository.list_confirmed_exam_occupancies(exclude_snapshot_id=uuid4(), room_ids=None)

        # Assert
        assert len(result) == 1
        assert result[0].room_id == room_id
        assert result[0].exam_date == exam_day
        assert result[0].timeslot_code == "afternoon-exam"
