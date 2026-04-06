from __future__ import annotations

from collections import defaultdict
from datetime import date
from uuid import UUID

from app.models.resource import ScheduleExamEntry


class ExamConflictDetector:
    """Pure exam conflict evaluation independent from FastAPI/DB plumbing."""

    @staticmethod
    def compute_entry_conflicts(
        *,
        entries: list[ScheduleExamEntry],
        constraints: dict[str, bool],
        room_demand: dict[UUID, int],
        room_capacity_by_id: dict[UUID, int],
        confirmed_room_slots: set[tuple[UUID, date, str]],
        student_edges_by_index: dict[int, set[int]],
    ) -> dict[UUID, list[str]]:
        conflicts_by_id: defaultdict[UUID, list[str]] = defaultdict(list)

        by_room_slot: defaultdict[tuple[UUID, date, str], list[ScheduleExamEntry]] = defaultdict(list)
        by_program_year_slot: defaultdict[tuple[UUID, int, date, str], list[ScheduleExamEntry]] = defaultdict(list)

        row_by_idx = {index: entry for index, entry in enumerate(entries)}
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
                for conflict_idx in student_edges_by_index.get(idx, set()):
                    other = row_by_idx.get(conflict_idx)
                    if not other or other.id == entry.id:
                        continue
                    if other.exam_date == entry.exam_date and other.timeslot_code == entry.timeslot_code:
                        conflicts_by_id[entry.id].append("student_overlap")
                        break

        return conflicts_by_id
