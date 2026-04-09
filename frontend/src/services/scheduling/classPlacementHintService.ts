import type { RoomDto } from '../../api/resources';
import type { ScheduleClassEntryDto } from '../../api/scheduling';
import { resolveClassConflictMessage } from '../../utils/scheduling/conflictCatalog';

export type PlacementHintCode =
  | 'room_overlap'
  | 'professor_overlap'
  | 'year_overlap'
  | 'room_capacity_exceeded'
  | 'professor_unavailable';

type OccupancyValue = {
  courseCode: string;
  courseName: string;
};

type ProfessorAvailabilityView = {
  availableSlotIds: string[];
};

export type PlacementSettings = {
  roomCapacityCheck: boolean;
  professorNoOverlap: boolean;
  studentGroupsNoOverlap: boolean;
};

type RoomCellInput = {
  entry: ScheduleClassEntryDto;
  targetTimeslotId: string;
  roomId: string;
  localEntries: ScheduleClassEntryDto[];
  settings: PlacementSettings;
  roomById: Map<string, RoomDto>;
  confirmedOccupancyByRoomTimeslot: Map<string, OccupancyValue>;
  confirmedOccupancyByProfessorTimeslot: Map<string, OccupancyValue>;
  professorById: Map<string, ProfessorAvailabilityView>;
  anyTimeOptionValue?: string;
};

type TimeCellInput = Omit<RoomCellInput, 'roomId'> & {
  candidateRoomIds: string[];
};

const DEFAULT_ANY_TIME_OPTION_VALUE = 'any-time';

export function getPlacementHintMessage(code: PlacementHintCode): string {
  if (code === 'professor_unavailable') {
    return 'Professor is not available at this timeslot.';
  }
  return resolveClassConflictMessage(code);
}

export function getRoomCellConflictCodes(input: RoomCellInput): PlacementHintCode[] {
  const {
    entry,
    targetTimeslotId,
    roomId,
    localEntries,
    settings,
    roomById,
    confirmedOccupancyByRoomTimeslot,
    confirmedOccupancyByProfessorTimeslot,
    professorById,
    anyTimeOptionValue = DEFAULT_ANY_TIME_OPTION_VALUE,
  } = input;

  const codes: PlacementHintCode[] = [];
  const pushCode = (code: PlacementHintCode) => {
    if (!codes.includes(code)) {
      codes.push(code);
    }
  };

  if (entry.professor_id) {
    const professor = professorById.get(entry.professor_id);
    if (professor) {
      const availableSlotIds = professor.availableSlotIds;
      const isAnyTime = availableSlotIds.length === 0 || availableSlotIds.includes(anyTimeOptionValue);
      if (!isAnyTime && !availableSlotIds.includes(targetTimeslotId)) {
        pushCode('professor_unavailable');
      }
    }
  }

  const occupiedRoomKey = `${roomId}-${targetTimeslotId}`;
  if (confirmedOccupancyByRoomTimeslot.has(occupiedRoomKey)) {
    pushCode('room_overlap');
  }

  if (settings.roomCapacityCheck) {
    const roomCapacity = roomById.get(roomId)?.capacity ?? 0;
    const requiredCapacity = entry.required_capacity ?? 0;
    if (requiredCapacity > roomCapacity) {
      pushCode('room_capacity_exceeded');
    }
  }

  if (settings.professorNoOverlap && entry.professor_id) {
    const occupiedProfessorKey = `${entry.professor_id}-${targetTimeslotId}`;
    if (confirmedOccupancyByProfessorTimeslot.has(occupiedProfessorKey)) {
      pushCode('professor_overlap');
    }
  }

  for (const candidate of localEntries) {
    if (candidate.id === entry.id || candidate.timeslot_id !== targetTimeslotId) {
      continue;
    }

    if (candidate.room_id === roomId) {
      pushCode('room_overlap');
    }

    if (settings.professorNoOverlap && entry.professor_id && candidate.professor_id === entry.professor_id) {
      pushCode('professor_overlap');
    }

    if (settings.studentGroupsNoOverlap && candidate.year === entry.year) {
      pushCode('year_overlap');
    }
  }

  return codes;
}

export function canPlaceEntryInRoomCell(input: RoomCellInput): boolean {
  return getRoomCellConflictCodes(input).length === 0;
}

export function canPlaceEntryInTimeCell(input: TimeCellInput): boolean {
  const { candidateRoomIds, ...base } = input;
  return candidateRoomIds.some((roomId) =>
    canPlaceEntryInRoomCell({
      ...base,
      roomId,
    }),
  );
}

export function getTimeCellUnavailableMessages(input: TimeCellInput): string[] {
  const { candidateRoomIds, ...base } = input;

  const uniqueRoomIds = Array.from(new Set(candidateRoomIds.filter(Boolean)));
  const roomScopedCodes = new Set<PlacementHintCode>(['room_overlap', 'room_capacity_exceeded']);

  const roomEvaluations = uniqueRoomIds.map((roomId) => ({
    roomId,
    codes: getRoomCellConflictCodes({
      ...base,
      roomId,
    }),
  }));

  const hasAnyValidRoom = roomEvaluations.some(({ codes }) => codes.length === 0);
  if (hasAnyValidRoom) {
    return [];
  }

  const hasAlternativeWithoutRoomBlock = roomEvaluations.some(({ codes }) =>
    codes.every((code) => !roomScopedCodes.has(code)),
  );

  const messageSet = new Set<string>();
  for (const { codes } of roomEvaluations) {
    for (const code of codes) {
      if (hasAlternativeWithoutRoomBlock && roomScopedCodes.has(code)) {
        continue;
      }
      messageSet.add(getPlacementHintMessage(code));
    }
  }

  return Array.from(messageSet);
}

export function getRoomCellUnavailableMessages(input: RoomCellInput): string[] {
  return getRoomCellConflictCodes(input).map(getPlacementHintMessage);
}
