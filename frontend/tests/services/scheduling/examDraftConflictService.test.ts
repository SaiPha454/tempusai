import { describe, expect, it } from 'vitest';
import type { ScheduleConflictDto, ScheduleExamEntryDto } from '../../../src/api/scheduling';
import {
  canPlaceExamEntryInRoomCell,
  getExamRoomAvailabilityStatus,
  recomputeExamDraftConflicts,
} from '../../../src/services/scheduling/examDraftConflictService';

function makeExamEntry(overrides: Partial<ScheduleExamEntryDto> = {}): ScheduleExamEntryDto {
  return {
    id: 'exam-1',
    program_id: 'program-1',
    program_value: 'software-engineering',
    program_label: 'Software Engineering',
    program_year_course_id: 'pyc-1',
    course_id: 'course-1',
    course_code: 'CS301',
    course_name: 'Software Testing',
    year: 3,
    semester: '1',
    exam_type: 'final',
    exam_date: '2026-05-10',
    timeslot_code: 'morning-exam',
    room_id: 'room-1',
    room_name: 'A101',
    manually_adjusted: false,
    conflicts: [],
    ...overrides,
  };
}

describe('Exam Draft Conflict Service - Constraint Validation and Placement Rules', () => {
  /**
   * Suite description:
   * Validates exam draft hard-constraint logic for overlap detection, preserved backend conflicts,
   * room availability status, and room-cell placement decisions.
   */

  it('should preserve backend student overlap and capacity conflicts while adding dynamic conflicts', () => {
    // Arrange
    const entry = makeExamEntry({ id: 'exam-preserve' });
    const baseConflictsByEntryId = new Map<string, ScheduleConflictDto[]>([
      [entry.id, [
        { code: 'student_overlap', message: 'backend overlap' },
        { code: 'room_capacity_exceeded', message: 'backend capacity' },
      ]],
    ]);

    // Act
    const result = recomputeExamDraftConflicts({
      localEntries: [entry],
      baseConflictsByEntryId,
      confirmedOccupancyByRoomDateSlot: new Map(),
      enforceProgramYearNoOverlap: true,
    });

    // Assert
    const conflictCodes = result[0].conflicts.map((conflict) => conflict.code);
    expect(conflictCodes).toContain('student_overlap');
    expect(conflictCodes).toContain('room_capacity_exceeded');
  });

  it('should add unassigned conflict when exam date, slot, or room is missing', () => {
    // Arrange
    const entry = makeExamEntry({ id: 'exam-unassigned', room_id: null, room_name: null });

    // Act
    const result = recomputeExamDraftConflicts({
      localEntries: [entry],
      baseConflictsByEntryId: new Map(),
      confirmedOccupancyByRoomDateSlot: new Map(),
      enforceProgramYearNoOverlap: true,
    });

    // Assert
    expect(result[0].conflicts.map((conflict) => conflict.code)).toContain('unassigned');
  });

  it('should add room overlap when another draft entry uses same room-date-slot', () => {
    // Arrange
    const first = makeExamEntry({ id: 'exam-a' });
    const second = makeExamEntry({ id: 'exam-b', course_code: 'CS302', course_name: 'Distributed Systems' });

    // Act
    const result = recomputeExamDraftConflicts({
      localEntries: [first, second],
      baseConflictsByEntryId: new Map(),
      confirmedOccupancyByRoomDateSlot: new Map(),
      enforceProgramYearNoOverlap: true,
    });

    // Assert
    expect(result[0].conflicts.map((conflict) => conflict.code)).toContain('room_overlap');
    expect(result[1].conflicts.map((conflict) => conflict.code)).toContain('room_overlap');
  });

  it('should add room overlap when confirmed occupancy already uses same room-date-slot', () => {
    // Arrange
    const entry = makeExamEntry({ id: 'exam-confirmed-room' });

    // Act
    const result = recomputeExamDraftConflicts({
      localEntries: [entry],
      baseConflictsByEntryId: new Map(),
      confirmedOccupancyByRoomDateSlot: new Map([[`${entry.room_id}-${entry.exam_date}-${entry.timeslot_code}`, { courseCode: 'CS999', courseName: 'Legacy Exam' }]]),
      enforceProgramYearNoOverlap: true,
    });

    // Assert
    expect(result[0].conflicts.map((conflict) => conflict.code)).toContain('room_overlap');
  });

  it('should add program year overlap when same cohort shares date and slot and rule is enabled', () => {
    // Arrange
    const first = makeExamEntry({ id: 'exam-cohort-a' });
    const second = makeExamEntry({ id: 'exam-cohort-b', course_code: 'CS303', course_name: 'Cloud Computing' });

    // Act
    const result = recomputeExamDraftConflicts({
      localEntries: [first, second],
      baseConflictsByEntryId: new Map(),
      confirmedOccupancyByRoomDateSlot: new Map(),
      enforceProgramYearNoOverlap: true,
    });

    // Assert
    expect(result[0].conflicts.map((conflict) => conflict.code)).toContain('program_year_overlap');
    expect(result[1].conflicts.map((conflict) => conflict.code)).toContain('program_year_overlap');
  });

  it('should not add program year overlap when rule is disabled', () => {
    // Arrange
    const first = makeExamEntry({ id: 'exam-no-rule-a' });
    const second = makeExamEntry({ id: 'exam-no-rule-b', course_code: 'CS304', course_name: 'DevOps' });

    // Act
    const result = recomputeExamDraftConflicts({
      localEntries: [first, second],
      baseConflictsByEntryId: new Map(),
      confirmedOccupancyByRoomDateSlot: new Map(),
      enforceProgramYearNoOverlap: false,
    });

    // Assert
    expect(result[0].conflicts.map((conflict) => conflict.code)).not.toContain('program_year_overlap');
    expect(result[1].conflicts.map((conflict) => conflict.code)).not.toContain('program_year_overlap');
  });

  it('should return used_confirmed availability when confirmed exam occupancy exists', () => {
    // Arrange
    const entry = makeExamEntry({ id: 'exam-status-confirmed' });

    // Act
    const status = getExamRoomAvailabilityStatus({
      entry,
      roomId: entry.room_id!,
      localEntries: [entry],
      confirmedOccupancyByRoomDateSlot: new Map([[`${entry.room_id}-${entry.exam_date}-${entry.timeslot_code}`, { courseCode: 'CS500', courseName: 'Embedded Systems' }]]),
    });

    // Assert
    expect(status).toBe('used_confirmed');
  });

  it('should return used_draft availability when draft entry occupies same room-date-slot', () => {
    // Arrange
    const current = makeExamEntry({ id: 'exam-status-current' });
    const another = makeExamEntry({ id: 'exam-status-another', course_code: 'CS305' });

    // Act
    const status = getExamRoomAvailabilityStatus({
      entry: current,
      roomId: current.room_id!,
      localEntries: [current, another],
      confirmedOccupancyByRoomDateSlot: new Map(),
    });

    // Assert
    expect(status).toBe('used_draft');
  });

  it('should return available availability when room-date-slot is free in both draft and confirmed sets', () => {
    // Arrange
    const entry = makeExamEntry({ id: 'exam-status-free', room_id: 'room-a', exam_date: '2026-05-11', timeslot_code: 'afternoon-exam' });

    // Act
    const status = getExamRoomAvailabilityStatus({
      entry,
      roomId: entry.room_id!,
      localEntries: [entry],
      confirmedOccupancyByRoomDateSlot: new Map(),
    });

    // Assert
    expect(status).toBe('available');
  });

  it('should reject placement when room-date-slot is already occupied by confirmed schedule', () => {
    // Arrange
    const entry = makeExamEntry({ id: 'exam-place-confirmed' });

    // Act
    const canPlace = canPlaceExamEntryInRoomCell({
      entry,
      examDate: entry.exam_date!,
      slotCode: entry.timeslot_code!,
      roomId: entry.room_id!,
      localEntries: [entry],
      confirmedOccupancyByRoomDateSlot: new Map([[`${entry.room_id}-${entry.exam_date}-${entry.timeslot_code}`, { courseCode: 'CS900', courseName: 'Reserved' }]]),
      enforceProgramYearNoOverlap: true,
    });

    // Assert
    expect(canPlace).toBe(false);
  });

  it('should reject placement when same cohort is already assigned in same date-slot and rule is enabled', () => {
    // Arrange
    const current = makeExamEntry({ id: 'exam-place-current' });
    const cohortConflict = makeExamEntry({ id: 'exam-place-cohort', room_id: 'room-2', course_code: 'CS306' });

    // Act
    const canPlace = canPlaceExamEntryInRoomCell({
      entry: current,
      examDate: current.exam_date!,
      slotCode: current.timeslot_code!,
      roomId: 'room-3',
      localEntries: [current, cohortConflict],
      confirmedOccupancyByRoomDateSlot: new Map(),
      enforceProgramYearNoOverlap: true,
    });

    // Assert
    expect(canPlace).toBe(false);
  });

  it('should allow placement when there is no room conflict and cohort rule is disabled', () => {
    // Arrange
    const current = makeExamEntry({ id: 'exam-place-allowed' });
    const sameCohortDifferentRoom = makeExamEntry({ id: 'exam-place-other', room_id: 'room-2', course_code: 'CS307' });

    // Act
    const canPlace = canPlaceExamEntryInRoomCell({
      entry: current,
      examDate: current.exam_date!,
      slotCode: current.timeslot_code!,
      roomId: 'room-3',
      localEntries: [current, sameCohortDifferentRoom],
      confirmedOccupancyByRoomDateSlot: new Map(),
      enforceProgramYearNoOverlap: false,
    });

    // Assert
    expect(canPlace).toBe(true);
  });
});
