import { describe, expect, it } from 'vitest';
import type { RoomDto } from '../../../src/api/resources';
import type { ScheduleClassEntryDto, ScheduleConflictDto } from '../../../src/api/scheduling';
import {
  getClassConflictDetail,
  getRoomAvailabilityStatus,
  recomputeClassDraftConflicts,
} from '../../../src/services/scheduling/classDraftConflictService';

function makeClassEntry(overrides: Partial<ScheduleClassEntryDto> = {}): ScheduleClassEntryDto {
  return {
    id: 'entry-1',
    program_year_course_id: 'pyc-1',
    course_id: 'course-1',
    course_code: 'CS101',
    course_name: 'Introduction to Computing',
    professor_id: 'prof-1',
    professor_name: 'Dr. Alpha',
    year: 1,
    timeslot_id: 'slot-1',
    timeslot_label: 'Morning 09:00 - 12:00',
    day: 'Monday',
    room_id: 'room-1',
    room_name: 'A101',
    required_capacity: 30,
    manually_adjusted: false,
    conflicts: [],
    ...overrides,
  };
}

function makeRoomMap(rooms: RoomDto[]): Map<string, RoomDto> {
  return new Map(rooms.map((room) => [room.id, room]));
}

describe('Class Draft Conflict Service - Hard Constraint and Conflict Resolution', () => {
  /**
   * Suite description:
   * Validates class scheduling hard-constraint behavior for room/professor/year overlap,
   * unassigned entries, room capacity checks, and conflict detail messaging.
   */

  it('should mark entry as unassigned when either timeslot or room assignment is missing', () => {
    // Arrange
    const entryWithoutRoom = makeClassEntry({ id: 'entry-unassigned', room_id: null, room_name: null });

    // Act
    const result = recomputeClassDraftConflicts({
      entries: [entryWithoutRoom],
      settings: {
        roomCapacityCheck: true,
        professorNoOverlap: true,
        studentGroupsNoOverlap: true,
      },
      roomById: makeRoomMap([{ id: 'room-1', name: 'A101', capacity: 50 }]),
      confirmedOccupancyByRoomTimeslot: new Map(),
      confirmedOccupancyByProfessorTimeslot: new Map(),
    });

    // Assert
    expect(result[0].conflicts.map((conflict) => conflict.code)).toContain('unassigned');
  });

  it('should detect room, professor, and year overlaps for two entries in the same timeslot', () => {
    // Arrange
    const first = makeClassEntry({ id: 'entry-a' });
    const second = makeClassEntry({
      id: 'entry-b',
      course_code: 'CS102',
      course_name: 'Data Structures',
    });

    // Act
    const result = recomputeClassDraftConflicts({
      entries: [first, second],
      settings: {
        roomCapacityCheck: true,
        professorNoOverlap: true,
        studentGroupsNoOverlap: true,
      },
      roomById: makeRoomMap([{ id: 'room-1', name: 'A101', capacity: 50 }]),
      confirmedOccupancyByRoomTimeslot: new Map(),
      confirmedOccupancyByProfessorTimeslot: new Map(),
    });

    // Assert
    for (const entry of result) {
      const conflictCodes = entry.conflicts.map((conflict) => conflict.code);
      expect(conflictCodes).toContain('room_overlap');
      expect(conflictCodes).toContain('professor_overlap');
      expect(conflictCodes).toContain('year_overlap');
    }
  });

  it('should enforce room capacity when required capacity exceeds room capacity', () => {
    // Arrange
    const crowdedEntry = makeClassEntry({ id: 'entry-capacity', required_capacity: 120 });

    // Act
    const result = recomputeClassDraftConflicts({
      entries: [crowdedEntry],
      settings: {
        roomCapacityCheck: true,
        professorNoOverlap: true,
        studentGroupsNoOverlap: true,
      },
      roomById: makeRoomMap([{ id: crowdedEntry.room_id!, name: 'A101', capacity: 80 }]),
      confirmedOccupancyByRoomTimeslot: new Map(),
      confirmedOccupancyByProfessorTimeslot: new Map(),
    });

    // Assert
    expect(result[0].conflicts.map((conflict) => conflict.code)).toContain('room_capacity_exceeded');
  });

  it('should skip room capacity violation when room capacity check is disabled', () => {
    // Arrange
    const crowdedEntry = makeClassEntry({ id: 'entry-capacity-off', required_capacity: 120 });

    // Act
    const result = recomputeClassDraftConflicts({
      entries: [crowdedEntry],
      settings: {
        roomCapacityCheck: false,
        professorNoOverlap: true,
        studentGroupsNoOverlap: true,
      },
      roomById: makeRoomMap([{ id: crowdedEntry.room_id!, name: 'A101', capacity: 80 }]),
      confirmedOccupancyByRoomTimeslot: new Map(),
      confirmedOccupancyByProfessorTimeslot: new Map(),
    });

    // Assert
    expect(result[0].conflicts.map((conflict) => conflict.code)).not.toContain('room_capacity_exceeded');
  });

  it('should mark overlaps against confirmed occupancy for room and professor', () => {
    // Arrange
    const entry = makeClassEntry({ id: 'entry-confirmed' });

    // Act
    const result = recomputeClassDraftConflicts({
      entries: [entry],
      settings: {
        roomCapacityCheck: true,
        professorNoOverlap: true,
        studentGroupsNoOverlap: true,
      },
      roomById: makeRoomMap([{ id: 'room-1', name: 'A101', capacity: 80 }]),
      confirmedOccupancyByRoomTimeslot: new Map([[`${entry.room_id}-${entry.timeslot_id}`, { courseCode: 'CS999', courseName: 'Legacy Class' }]]),
      confirmedOccupancyByProfessorTimeslot: new Map([[`${entry.professor_id}-${entry.timeslot_id}`, { courseCode: 'CS888', courseName: 'Another Class' }]]),
    });

    // Assert
    const conflictCodes = result[0].conflicts.map((conflict) => conflict.code);
    expect(conflictCodes).toContain('room_overlap');
    expect(conflictCodes).toContain('professor_overlap');
  });

  it('should provide detailed message for professor overlap against confirmed occupancy', () => {
    // Arrange
    const entry = makeClassEntry({ id: 'entry-prof-detail' });

    // Act
    const message = getClassConflictDetail({
      entry,
      code: 'professor_overlap',
      localEntries: [entry],
      roomById: makeRoomMap([{ id: 'room-1', name: 'A101', capacity: 80 }]),
      confirmedOccupancyByProfessorTimeslot: new Map([[`${entry.professor_id}-${entry.timeslot_id}`, { courseCode: 'CS777', courseName: 'Operating Systems' }]]),
    });

    // Assert
    expect(message).toContain('Conflicts with confirmed schedule CS777');
  });

  it('should provide capacity detail message with actual and required enrollment values', () => {
    // Arrange
    const entry = makeClassEntry({ id: 'entry-capacity-detail', required_capacity: 60, room_id: 'room-2' });

    // Act
    const message = getClassConflictDetail({
      entry,
      code: 'room_capacity_exceeded',
      localEntries: [entry],
      roomById: makeRoomMap([{ id: 'room-2', name: 'B201', capacity: 40 }]),
      confirmedOccupancyByProfessorTimeslot: new Map(),
    });

    // Assert
    expect(message).toBe('Room capacity 40 is below required enrollment 60.');
  });

  it('should return used_confirmed availability when room is occupied in confirmed schedule', () => {
    // Arrange
    const entry = makeClassEntry({ id: 'entry-availability-confirmed' });

    // Act
    const status = getRoomAvailabilityStatus({
      entry,
      roomId: entry.room_id!,
      localEntries: [entry],
      confirmedOccupancyByRoomTimeslot: new Map([[`${entry.room_id}-${entry.timeslot_id}`, { courseCode: 'CS404', courseName: 'Networks' }]]),
    });

    // Assert
    expect(status).toBe('used_confirmed');
  });

  it('should return used_draft availability when another draft entry already uses the room at same timeslot', () => {
    // Arrange
    const current = makeClassEntry({ id: 'entry-current' });
    const another = makeClassEntry({ id: 'entry-another' });

    // Act
    const status = getRoomAvailabilityStatus({
      entry: current,
      roomId: current.room_id!,
      localEntries: [current, another],
      confirmedOccupancyByRoomTimeslot: new Map(),
    });

    // Assert
    expect(status).toBe('used_draft');
  });

  it('should return available availability when there are no confirmed or draft conflicts for the room-timeslot', () => {
    // Arrange
    const current = makeClassEntry({ id: 'entry-available', room_id: 'room-a', timeslot_id: 'slot-a' });
    const unrelated = makeClassEntry({ id: 'entry-unrelated', room_id: 'room-b', timeslot_id: 'slot-b' });

    // Act
    const status = getRoomAvailabilityStatus({
      entry: current,
      roomId: current.room_id!,
      localEntries: [current, unrelated],
      confirmedOccupancyByRoomTimeslot: new Map(),
    });

    // Assert
    expect(status).toBe('available');
  });
});
