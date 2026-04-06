from __future__ import annotations

from uuid import UUID


class ClassPreferenceParser:
    """Normalize class preferred timeslot payload values into stable course-id keyed mapping."""

    @staticmethod
    def parse_preferred_timeslots(
        *,
        raw_preferred_timeslots: dict[str, list[str]],
        valid_course_ids: set[UUID],
        course_id_by_plan_row_id: dict[UUID, UUID],
    ) -> dict[UUID, list[UUID]]:
        preferred_timeslots_by_course_id: dict[UUID, list[UUID]] = {}

        for raw_preference_key, raw_slot_ids in raw_preferred_timeslots.items():
            try:
                parsed_key_id = UUID(raw_preference_key)
            except (TypeError, ValueError):
                continue

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

        return preferred_timeslots_by_course_id
