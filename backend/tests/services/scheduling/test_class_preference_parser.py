from __future__ import annotations

from uuid import uuid4

from app.services.scheduling.class_preference_parser import ClassPreferenceParser


class TestClassPreferenceParser:
    """Validate preferred timeslot normalization from mixed course and plan-row payload keys."""

    def test_parse_preferred_timeslots_accepts_course_or_plan_row_keys_and_deduplicates(self):
        # Arrange
        course_id = uuid4()
        plan_row_id = uuid4()
        mapped_course_id = uuid4()
        slot_a = uuid4()
        slot_b = uuid4()

        raw = {
            str(course_id): [str(slot_a), str(slot_a), "invalid-slot"],
            str(plan_row_id): [str(slot_b)],
            "not-a-uuid": [str(slot_a)],
        }

        # Act
        parsed = ClassPreferenceParser.parse_preferred_timeslots(
            raw_preferred_timeslots=raw,
            valid_course_ids={course_id, mapped_course_id},
            course_id_by_plan_row_id={plan_row_id: mapped_course_id},
        )

        # Assert
        assert parsed[course_id] == [slot_a]
        assert parsed[mapped_course_id] == [slot_b]
        assert len(parsed) == 2

    def test_parse_preferred_timeslots_ignores_unmapped_keys_and_empty_slot_lists(self):
        # Arrange
        raw = {str(uuid4()): ["bad-slot"], str(uuid4()): []}

        # Act
        parsed = ClassPreferenceParser.parse_preferred_timeslots(
            raw_preferred_timeslots=raw,
            valid_course_ids=set(),
            course_id_by_plan_row_id={},
        )

        # Assert
        assert parsed == {}
