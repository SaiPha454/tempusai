from __future__ import annotations

from collections import defaultdict
from uuid import UUID

from app.models.resource import ScheduleClassEntry


class ClassConflictDetector:
    """Pure class scheduling conflict evaluation without database access."""

    @staticmethod
    def compute_entry_conflicts(
        *,
        entries: list[ScheduleClassEntry],
        constraints: dict[str, bool],
        course_demand_by_pair: dict[tuple[UUID, int], int],
        occupied_room_slots: set[tuple[UUID, UUID]],
        occupied_professor_slots: set[tuple[UUID, UUID]],
    ) -> dict[UUID, list[str]]:
        conflicts_by_id: defaultdict[UUID, list[str]] = defaultdict(list)

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

    @staticmethod
    def compute_candidate_conflict_codes(
        *,
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
