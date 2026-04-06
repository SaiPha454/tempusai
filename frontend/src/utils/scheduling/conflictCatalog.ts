import type { ScheduleConflictDto } from '../../api/scheduling';

export const CLASS_CONFLICT_MESSAGE_BY_CODE: Record<string, string> = {
  room_overlap: 'Room has another class at this timeslot.',
  professor_overlap: 'Professor has another class at this timeslot.',
  year_overlap: 'This year already has a class at this timeslot.',
  unassigned: 'Missing room or timeslot assignment.',
  room_capacity_exceeded: 'Room capacity is smaller than expected enrollment.',
};

export const EXAM_CONFLICT_MESSAGE_BY_CODE: Record<string, string> = {
  unassigned: 'Missing exam date, slot, or room assignment.',
  room_overlap: 'Room has another exam at the same date and slot.',
  program_year_overlap: 'Same program and year already has an exam at this date and slot.',
  student_overlap: 'One or more students would have two exams at the same date and slot.',
  room_capacity_exceeded: 'Room capacity is smaller than expected enrollment.',
};

export function resolveClassConflictMessage(code: string): string {
  return CLASS_CONFLICT_MESSAGE_BY_CODE[code] ?? 'Conflict detected.';
}

export function resolveExamConflictMessage(code: string): string {
  return EXAM_CONFLICT_MESSAGE_BY_CODE[code] ?? 'Conflict detected.';
}

export function hasConflictCode(conflicts: ScheduleConflictDto[], code: string): boolean {
  return conflicts.some((conflict) => conflict.code === code);
}
