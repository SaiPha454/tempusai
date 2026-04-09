import { describe, expect, it } from 'vitest';
import type { RoomDto } from '../../../src/api/resources';
import type { ScheduleClassEntryDto } from '../../../src/api/scheduling';
import {
  canPlaceEntryInRoomCell,
  canPlaceEntryInTimeCell,
  getRoomCellConflictCodes,
  getRoomCellUnavailableMessages,
  getTimeCellUnavailableMessages,
} from '../../../src/services/scheduling/classPlacementHintService';

function makeClassEntry(overrides: Partial<ScheduleClassEntryDto> = {}): ScheduleClassEntryDto {
  return {
    id: 'entry-1',
    program_year_course_id: 'pyc-1',
    course_id: 'course-1',
    course_code: 'CS101',
    course_name: 'Intro to Computing',
    professor_id: 'prof-1',
    professor_name: 'Dr. One',
    year: 1,
    timeslot_id: 'slot-origin',
    timeslot_label: 'Morning 09:00 - 12:00',
    day: 'Monday',
    room_id: 'room-a',
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

function makeProfessorMap(data: Array<{ id: string; availableSlotIds: string[] }>): Map<string, { availableSlotIds: string[] }> {
  return new Map(data.map((item) => [item.id, { availableSlotIds: item.availableSlotIds }]));
}

const settings = {
  roomCapacityCheck: true,
  professorNoOverlap: true,
  studentGroupsNoOverlap: true,
};

describe('Class Placement Hint Service - Placement and Unavailable Reason Rules', () => {
  it('should return professor_unavailable when target slot is outside professor availability', () => {
    const entry = makeClassEntry();

    const codes = getRoomCellConflictCodes({
      entry,
      targetTimeslotId: 'slot-2',
      roomId: 'room-a',
      localEntries: [entry],
      settings,
      roomById: makeRoomMap([{ id: 'room-a', name: 'A101', capacity: 40 }]),
      confirmedOccupancyByRoomTimeslot: new Map(),
      confirmedOccupancyByProfessorTimeslot: new Map(),
      professorById: makeProfessorMap([{ id: 'prof-1', availableSlotIds: ['slot-1'] }]),
    });

    expect(codes).toContain('professor_unavailable');
  });

  it('should treat cell as placeable when at least one candidate room is fully valid', () => {
    const entry = makeClassEntry({ required_capacity: 30, room_id: 'room-a' });

    const placeable = canPlaceEntryInTimeCell({
      entry,
      targetTimeslotId: 'slot-1',
      candidateRoomIds: ['room-a', 'room-b'],
      localEntries: [entry],
      settings,
      roomById: makeRoomMap([
        { id: 'room-a', name: 'A101', capacity: 20 },
        { id: 'room-b', name: 'B201', capacity: 50 },
      ]),
      confirmedOccupancyByRoomTimeslot: new Map(),
      confirmedOccupancyByProfessorTimeslot: new Map(),
      professorById: makeProfessorMap([{ id: 'prof-1', availableSlotIds: ['slot-1'] }]),
    });

    expect(placeable).toBe(true);
  });

  it('should hide room-based reasons when an alternative room exists without room-level blocking', () => {
    const entry = makeClassEntry({ required_capacity: 30, room_id: 'room-a' });

    const reasons = getTimeCellUnavailableMessages({
      entry,
      targetTimeslotId: 'slot-1',
      candidateRoomIds: ['room-a', 'room-b'],
      localEntries: [entry],
      settings,
      roomById: makeRoomMap([
        { id: 'room-a', name: 'A101', capacity: 40 },
        { id: 'room-b', name: 'B201', capacity: 40 },
      ]),
      confirmedOccupancyByRoomTimeslot: new Map([[`room-a-slot-1`, { courseCode: 'CS999', courseName: 'Legacy' }]]),
      confirmedOccupancyByProfessorTimeslot: new Map([[`prof-1-slot-1`, { courseCode: 'CS888', courseName: 'OS' }]]),
      professorById: makeProfessorMap([{ id: 'prof-1', availableSlotIds: ['slot-1'] }]),
    });

    expect(reasons).toContain('Professor has another class at this timeslot.');
    expect(reasons).not.toContain('Room has another class at this timeslot.');
  });

  it('should keep room-based reasons when every alternative room is room-blocked', () => {
    const entry = makeClassEntry({ required_capacity: 50, room_id: 'room-a' });

    const reasons = getTimeCellUnavailableMessages({
      entry,
      targetTimeslotId: 'slot-1',
      candidateRoomIds: ['room-a', 'room-b'],
      localEntries: [entry],
      settings,
      roomById: makeRoomMap([
        { id: 'room-a', name: 'A101', capacity: 20 },
        { id: 'room-b', name: 'B201', capacity: 20 },
      ]),
      confirmedOccupancyByRoomTimeslot: new Map(),
      confirmedOccupancyByProfessorTimeslot: new Map(),
      professorById: makeProfessorMap([{ id: 'prof-1', availableSlotIds: ['slot-1'] }]),
    });

    expect(reasons).toContain('Room capacity is smaller than expected enrollment.');
  });

  it('should map room-cell conflict codes into human-readable unavailable messages', () => {
    const entry = makeClassEntry({ required_capacity: 30, room_id: 'room-a' });
    const other = makeClassEntry({
      id: 'entry-2',
      course_id: 'course-2',
      course_code: 'CS102',
      course_name: 'Data Structures',
      room_id: 'room-a',
      timeslot_id: 'slot-1',
      professor_id: 'prof-2',
      professor_name: 'Dr. Two',
      year: 2,
    });

    const messages = getRoomCellUnavailableMessages({
      entry,
      targetTimeslotId: 'slot-1',
      roomId: 'room-a',
      localEntries: [entry, other],
      settings,
      roomById: makeRoomMap([{ id: 'room-a', name: 'A101', capacity: 50 }]),
      confirmedOccupancyByRoomTimeslot: new Map(),
      confirmedOccupancyByProfessorTimeslot: new Map(),
      professorById: makeProfessorMap([{ id: 'prof-1', availableSlotIds: ['slot-1'] }]),
    });

    expect(messages).toContain('Room has another class at this timeslot.');
  });

  it('should return false for room placement when conflict codes are present', () => {
    const entry = makeClassEntry();

    const placeable = canPlaceEntryInRoomCell({
      entry,
      targetTimeslotId: 'slot-2',
      roomId: 'room-a',
      localEntries: [entry],
      settings,
      roomById: makeRoomMap([{ id: 'room-a', name: 'A101', capacity: 50 }]),
      confirmedOccupancyByRoomTimeslot: new Map(),
      confirmedOccupancyByProfessorTimeslot: new Map(),
      professorById: makeProfessorMap([{ id: 'prof-1', availableSlotIds: ['slot-1'] }]),
    });

    expect(placeable).toBe(false);
  });
});
