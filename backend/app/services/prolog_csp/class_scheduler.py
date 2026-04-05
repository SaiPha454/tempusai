from __future__ import annotations

import ast
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from uuid import UUID


@dataclass(frozen=True)
class PrologCourseRow:
    course_id: UUID
    professor_id: UUID | None
    year: int
    required_capacity: int


class PrologClassScheduler:
    def __init__(self, timeout_seconds: int = 75) -> None:
        self.timeout_seconds = timeout_seconds
        self._swipl = shutil.which("swipl")
        self._solver_path = Path(__file__).with_name("class_scheduler.pl")

    def solve(
        self,
        *,
        course_rows: list[PrologCourseRow],
        room_capacity_by_id: dict[UUID, int],
        timeslot_ids: list[UUID],
        preferred_timeslots_by_course_id: dict[UUID, list[UUID]],
        occupied_room_slots: set[tuple[UUID, UUID]],
        occupied_professor_slots: set[tuple[UUID, UUID]],
        professor_no_overlap: bool,
        student_groups_no_overlap: bool,
        room_capacity_check: bool,
    ) -> dict[UUID, tuple[UUID, UUID]]:
        if not self._swipl:
            raise RuntimeError("SWI-Prolog executable 'swipl' was not found")

        if not course_rows:
            return {}

        with tempfile.TemporaryDirectory(prefix="tempusai-prolog-csp-") as tmp_dir:
            facts_path = Path(tmp_dir) / "facts.pl"
            self._write_facts(
                file_path=facts_path,
                course_rows=course_rows,
                room_capacity_by_id=room_capacity_by_id,
                timeslot_ids=timeslot_ids,
                preferred_timeslots_by_course_id=preferred_timeslots_by_course_id,
                occupied_room_slots=occupied_room_slots,
                occupied_professor_slots=occupied_professor_slots,
                professor_no_overlap=professor_no_overlap,
                student_groups_no_overlap=student_groups_no_overlap,
                room_capacity_check=room_capacity_check,
            )

            command = [
                self._swipl,
                "-q",
                "-s",
                str(facts_path),
                "-s",
                str(self._solver_path),
                "-g",
                f"solve_and_print({self.timeout_seconds}),halt.",
            ]
            try:
                completed = subprocess.run(
                    command,
                    capture_output=True,
                    text=True,
                    timeout=max(self.timeout_seconds + 20, 25),
                    check=False,
                )
            except subprocess.TimeoutExpired as error:
                partial_output = error.stdout or ""
                if isinstance(partial_output, bytes):
                    partial_output = partial_output.decode("utf-8", errors="ignore")
                return self._parse_output(partial_output)

            if completed.returncode != 0:
                stderr = completed.stderr.strip()
                raise RuntimeError(stderr or "Prolog solver failed to find a schedule")

            assignments = self._parse_output(completed.stdout)
            return assignments

    def _write_facts(
        self,
        *,
        file_path: Path,
        course_rows: list[PrologCourseRow],
        room_capacity_by_id: dict[UUID, int],
        timeslot_ids: list[UUID],
        preferred_timeslots_by_course_id: dict[UUID, list[UUID]],
        occupied_room_slots: set[tuple[UUID, UUID]],
        occupied_professor_slots: set[tuple[UUID, UUID]],
        professor_no_overlap: bool,
        student_groups_no_overlap: bool,
        room_capacity_check: bool,
    ) -> None:
        lines: list[str] = []
        lines.append(f"constraint_professor_no_overlap({self._bool_atom(professor_no_overlap)}).")
        lines.append(f"constraint_student_groups_no_overlap({self._bool_atom(student_groups_no_overlap)}).")
        lines.append(f"constraint_room_capacity_check({self._bool_atom(room_capacity_check)}).")

        for room_id, capacity in room_capacity_by_id.items():
            lines.append(f"room({self._atom(str(room_id))}, {capacity}).")

        for timeslot_id in timeslot_ids:
            lines.append(f"time_slot({self._atom(str(timeslot_id))}).")

        for slot_rank, timeslot_id in enumerate(timeslot_ids):
            lines.append(f"slot_rank({self._atom(str(timeslot_id))}, {slot_rank}).")

        for row in course_rows:
            professor_key = self._professor_key(row.course_id, row.professor_id)
            lines.append(
                "course({course}, {prof}, {year}, {cap}).".format(
                    course=self._atom(str(row.course_id)),
                    prof=self._atom(professor_key),
                    year=row.year,
                    cap=row.required_capacity,
                )
            )

        for course_id, slot_ids in preferred_timeslots_by_course_id.items():
            for slot_id in slot_ids:
                lines.append(
                    f"preferred_slot({self._atom(str(course_id))}, {self._atom(str(slot_id))})."
                )

        for room_id, timeslot_id in occupied_room_slots:
            lines.append(
                f"reserved_room({self._atom(str(room_id))}, {self._atom(str(timeslot_id))})."
            )

        for professor_id, timeslot_id in occupied_professor_slots:
            lines.append(
                f"reserved_prof({self._atom(str(professor_id))}, {self._atom(str(timeslot_id))})."
            )

        file_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    def _parse_output(self, output: str) -> dict[UUID, tuple[UUID, UUID]]:
        assignments: dict[UUID, tuple[UUID, UUID]] = {}
        for raw_line in output.splitlines():
            line = raw_line.strip()
            if not line:
                continue
            parts = line.split("\t")
            if len(parts) != 5:
                continue

            course_atom, _prof_atom, _year_atom, room_atom, slot_atom = parts
            course_id = UUID(ast.literal_eval(course_atom))
            room_id = UUID(ast.literal_eval(room_atom))
            slot_id = UUID(ast.literal_eval(slot_atom))
            assignments[course_id] = (room_id, slot_id)

        return assignments

    @staticmethod
    def _atom(value: str) -> str:
        escaped = value.replace("\\", "\\\\").replace("'", "\\'")
        return f"'{escaped}'"

    @staticmethod
    def _bool_atom(value: bool) -> str:
        return "true" if value else "false"

    @staticmethod
    def _professor_key(course_id: UUID, professor_id: UUID | None) -> str:
        if professor_id is None:
            return f"none-{course_id}"
        return str(professor_id)
