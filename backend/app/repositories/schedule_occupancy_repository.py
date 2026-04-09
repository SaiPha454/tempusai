from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.resource import Course, ScheduleClassEntry, ScheduleClassSnapshot, ScheduleExamEntry, ScheduleExamSnapshot
from app.schemas.scheduling import ConfirmedExamOccupancyRead, ConfirmedOccupancyRead, ConfirmedProfessorOccupancyRead


class ScheduleOccupancyRepository:
    """Persistence-only accessors for confirmed class/exam occupancy state."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_confirmed_class_resource_occupancy(
        self,
        *,
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

        for room_id, professor_id, timeslot_id in self.db.execute(stmt).all():
            if not timeslot_id:
                continue
            if room_id:
                room_slots.add((room_id, timeslot_id))
            if professor_id:
                professor_slots.add((professor_id, timeslot_id))

        return room_slots, professor_slots

    def list_confirmed_class_occupancies(
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

    def list_confirmed_class_professor_occupancies(
        self,
        *,
        exclude_snapshot_id: UUID,
    ) -> list[ConfirmedProfessorOccupancyRead]:
        stmt = (
            select(
                ScheduleClassEntry.professor_id,
                ScheduleClassEntry.timeslot_id,
                Course.code,
                Course.name,
            )
            .join(ScheduleClassSnapshot, ScheduleClassSnapshot.id == ScheduleClassEntry.snapshot_id)
            .join(Course, Course.id == ScheduleClassEntry.course_id)
            .where(
                ScheduleClassSnapshot.status == "confirmed",
                ScheduleClassEntry.snapshot_id != exclude_snapshot_id,
                ScheduleClassEntry.professor_id.is_not(None),
                ScheduleClassEntry.timeslot_id.is_not(None),
            )
        )

        rows = self.db.execute(stmt).all()
        if not rows:
            return []

        seen: set[tuple[UUID, UUID]] = set()
        result: list[ConfirmedProfessorOccupancyRead] = []
        for professor_id, timeslot_id, course_code, course_name in rows:
            key = (professor_id, timeslot_id)
            if key in seen:
                continue
            seen.add(key)
            result.append(
                ConfirmedProfessorOccupancyRead(
                    professor_id=professor_id,
                    timeslot_id=timeslot_id,
                    course_code=course_code,
                    course_name=course_name,
                )
            )

        return result

    def get_confirmed_exam_room_slots(
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

        return {
            (room_id, exam_date, slot_code)
            for room_id, exam_date, slot_code in self.db.execute(stmt).all()
        }

    def list_confirmed_exam_occupancies(
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
