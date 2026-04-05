from __future__ import annotations

import ast
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from uuid import UUID


@dataclass(frozen=True)
class PrologExamRow:
    exam_idx: int
    program_id: UUID
    year: int
    required_capacity: int
    allowed_slot_keys: list[str]
    preferred_slot_keys: list[str]


class PrologExamScheduler:
    def __init__(self, timeout_seconds: int = 100) -> None:
        self.timeout_seconds = timeout_seconds
        self._swipl = shutil.which("swipl")
        self._solver_path = Path(__file__).with_name("exam_scheduler.pl")

    def solve(
        self,
        *,
        exam_rows: list[PrologExamRow],
        room_capacity_by_id: dict[UUID, int],
        reserved_room_slot_keys: set[tuple[UUID, str]],
        student_conflict_pairs: set[tuple[int, int]],
        no_same_program_year_day_timeslot: bool,
        no_student_overlap: bool,
        room_capacity_check: bool,
        prefer_day_timeslot: bool,
        allow_flexible_fallback: bool,
        minimize_same_program_year_same_day: bool,
    ) -> dict[int, tuple[UUID, str]]:
        if not self._swipl:
            raise RuntimeError("SWI-Prolog executable 'swipl' was not found")

        if not exam_rows:
            return {}

        try:
            with tempfile.TemporaryDirectory(prefix="tempusai-prolog-exam-csp-") as tmp_dir:
                facts_path = Path(tmp_dir) / "facts.pl"
                self._write_facts(
                    file_path=facts_path,
                    exam_rows=exam_rows,
                    room_capacity_by_id=room_capacity_by_id,
                    reserved_room_slot_keys=reserved_room_slot_keys,
                    student_conflict_pairs=student_conflict_pairs,
                    no_same_program_year_day_timeslot=no_same_program_year_day_timeslot,
                    no_student_overlap=no_student_overlap,
                    room_capacity_check=room_capacity_check,
                    prefer_day_timeslot=prefer_day_timeslot,
                    allow_flexible_fallback=allow_flexible_fallback,
                    minimize_same_program_year_same_day=minimize_same_program_year_same_day,
                )

                completed = subprocess.run(
                    [
                        self._swipl,
                        "-q",
                        "-s",
                        str(facts_path),
                        "-s",
                        str(self._solver_path),
                        "-g",
                        f"solve_and_print({self.timeout_seconds}),halt.",
                    ],
                    capture_output=True,
                    text=True,
                    timeout=max(self.timeout_seconds + 12, 15),
                    check=False,
                )

                if completed.returncode != 0:
                    stderr = completed.stderr.strip()
                    raise RuntimeError(stderr or "Prolog exam solver failed")

                return self._parse_output(completed.stdout)
        except subprocess.TimeoutExpired as error:
            # Return whatever was printed before timeout; caller can still persist a partial draft.
            partial_output = error.stdout or ""
            if isinstance(partial_output, bytes):
                partial_output = partial_output.decode("utf-8", errors="ignore")
            return self._parse_output(partial_output)

    def _write_facts(
        self,
        *,
        file_path: Path,
        exam_rows: list[PrologExamRow],
        room_capacity_by_id: dict[UUID, int],
        reserved_room_slot_keys: set[tuple[UUID, str]],
        student_conflict_pairs: set[tuple[int, int]],
        no_same_program_year_day_timeslot: bool,
        no_student_overlap: bool,
        room_capacity_check: bool,
        prefer_day_timeslot: bool,
        allow_flexible_fallback: bool,
        minimize_same_program_year_same_day: bool,
    ) -> None:
        lines: list[str] = []
        lines.extend(
            [
                ":- discontiguous exam/4.",
                ":- discontiguous exam_slot/2.",
                ":- discontiguous preferred_exam_slot/2.",
                ":- discontiguous slot/1.",
                ":- discontiguous slot_day/2.",
                ":- discontiguous slot_rank/2.",
                ":- discontiguous slot_code/2.",
            ]
        )
        lines.append(
            f"constraint_no_same_program_year_day_timeslot({self._bool_atom(no_same_program_year_day_timeslot)})."
        )
        lines.append(f"constraint_no_student_overlap({self._bool_atom(no_student_overlap)}).")
        lines.append(f"constraint_room_capacity_check({self._bool_atom(room_capacity_check)}).")
        lines.append(f"constraint_prefer_day_timeslot({self._bool_atom(prefer_day_timeslot)}).")
        lines.append(f"constraint_allow_flexible_fallback({self._bool_atom(allow_flexible_fallback)}).")
        lines.append(
            f"constraint_minimize_same_program_year_same_day({self._bool_atom(minimize_same_program_year_same_day)})."
        )

        for room_id, capacity in room_capacity_by_id.items():
            lines.append(f"room({self._atom(str(room_id))}, {capacity}).")

        emitted_slots: set[str] = set()
        slot_rank = 0
        for row in exam_rows:
            exam_atom = self._atom(str(row.exam_idx))
            program_atom = self._atom(str(row.program_id))
            lines.append(
                "exam({exam}, {program}, {year}, {demand}).".format(
                    exam=exam_atom,
                    program=program_atom,
                    year=row.year,
                    demand=row.required_capacity,
                )
            )

            for slot_key in row.allowed_slot_keys:
                slot_atom = self._atom(slot_key)
                lines.append(f"exam_slot({exam_atom}, {slot_atom}).")
                if slot_key not in emitted_slots:
                    lines.append(f"slot({slot_atom}).")
                    day_key, slot_code = slot_key.split("|", 1)
                    lines.append(f"slot_day({slot_atom}, {self._atom(day_key)}).")
                    lines.append(f"slot_rank({slot_atom}, {slot_rank}).")
                    lines.append(f"slot_code({slot_atom}, {self._atom(slot_code)}).")
                    slot_rank += 1
                    emitted_slots.add(slot_key)

            for slot_key in row.preferred_slot_keys:
                lines.append(f"preferred_exam_slot({exam_atom}, {self._atom(slot_key)}).")

        for room_id, slot_key in reserved_room_slot_keys:
            lines.append(
                f"reserved_room_slot({self._atom(str(room_id))}, {self._atom(slot_key)})."
            )

        for left, right in sorted(student_conflict_pairs):
            lines.append(f"student_conflict({self._atom(str(left))}, {self._atom(str(right))}).")

        file_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    def _parse_output(self, output: str) -> dict[int, tuple[UUID, str]]:
        assignments: dict[int, tuple[UUID, str]] = {}
        for raw_line in output.splitlines():
            line = raw_line.strip()
            if not line:
                continue
            parts = line.split("\t")
            if len(parts) != 6:
                continue

            exam_atom, _program_atom, _year_atom, room_atom, slot_atom, _pref_atom = parts
            exam_idx = int(ast.literal_eval(exam_atom))
            room_id = UUID(ast.literal_eval(room_atom))
            slot_key = str(ast.literal_eval(slot_atom))
            assignments[exam_idx] = (room_id, slot_key)

        return assignments

    @staticmethod
    def _atom(value: str) -> str:
        escaped = value.replace("\\", "\\\\").replace("'", "\\'")
        return f"'{escaped}'"

    @staticmethod
    def _bool_atom(value: bool) -> str:
        return "true" if value else "false"
