import type { RoomDto } from '../../api/resources';
import type { ScheduleClassEntryDto, ScheduleConflictDto } from '../../api/scheduling';
import { hasConflictCode, resolveClassConflictMessage } from '../../utils/scheduling/conflictCatalog';
import type { RoomAvailabilityStatus } from '../../types/scheduling';

type LocalEntry = ScheduleClassEntryDto;

type ConflictSettings = {
  roomCapacityCheck: boolean;
  professorNoOverlap: boolean;
  studentGroupsNoOverlap: boolean;
};

type OccupancyValue = {
  courseCode: string;
  courseName: string;
};

export type RecomputeClassDraftConflictsInput = {
  entries: LocalEntry[];
  settings: ConflictSettings;
  roomById: Map<string, RoomDto>;
  confirmedOccupancyByRoomTimeslot: Map<string, OccupancyValue>;
  confirmedOccupancyByProfessorTimeslot: Map<string, OccupancyValue>;
};

export function recomputeClassDraftConflicts(input: RecomputeClassDraftConflictsInput): LocalEntry[] {
  const {
    entries,
    settings,
    roomById,
    confirmedOccupancyByRoomTimeslot,
    confirmedOccupancyByProfessorTimeslot,
  } = input;

  const base = entries.map((entry) => ({ ...entry, conflicts: [] as ScheduleConflictDto[] }));
  const byRoomSlot = new Map<string, LocalEntry[]>();
  const byProfessorSlot = new Map<string, LocalEntry[]>();
  const byYearSlot = new Map<string, LocalEntry[]>();

  for (const entry of base) {
    if (!entry.timeslot_id || !entry.room_id) {
      entry.conflicts.push({ code: 'unassigned', message: resolveClassConflictMessage('unassigned') });
    }

    if (entry.timeslot_id && entry.room_id) {
      const occupiedKey = `${entry.room_id}-${entry.timeslot_id}`;
      if (confirmedOccupancyByRoomTimeslot.has(occupiedKey)) {
        entry.conflicts.push({ code: 'room_overlap', message: resolveClassConflictMessage('room_overlap') });
      }

      if (settings.roomCapacityCheck) {
        const roomCapacity = roomById.get(entry.room_id)?.capacity ?? 0;
        const requiredCapacity = entry.required_capacity ?? 0;
        if (requiredCapacity > roomCapacity) {
          entry.conflicts.push({
            code: 'room_capacity_exceeded',
            message: resolveClassConflictMessage('room_capacity_exceeded'),
          });
        }
      }

      const roomSlotKey = `${entry.room_id}-${entry.timeslot_id}`;
      const roomSlotItems = byRoomSlot.get(roomSlotKey) ?? [];
      roomSlotItems.push(entry);
      byRoomSlot.set(roomSlotKey, roomSlotItems);
    }

    if (settings.professorNoOverlap && entry.timeslot_id && entry.professor_id) {
      const occupiedKey = `${entry.professor_id}-${entry.timeslot_id}`;
      if (confirmedOccupancyByProfessorTimeslot.has(occupiedKey)) {
        entry.conflicts.push({ code: 'professor_overlap', message: resolveClassConflictMessage('professor_overlap') });
      }

      const professorSlotKey = `${entry.professor_id}-${entry.timeslot_id}`;
      const professorItems = byProfessorSlot.get(professorSlotKey) ?? [];
      professorItems.push(entry);
      byProfessorSlot.set(professorSlotKey, professorItems);
    }

    if (settings.studentGroupsNoOverlap && entry.timeslot_id) {
      const yearSlotKey = `${entry.year}-${entry.timeslot_id}`;
      const yearSlotItems = byYearSlot.get(yearSlotKey) ?? [];
      yearSlotItems.push(entry);
      byYearSlot.set(yearSlotKey, yearSlotItems);
    }
  }

  applyConflict(byRoomSlot, 'room_overlap');
  applyConflict(byProfessorSlot, 'professor_overlap');
  applyConflict(byYearSlot, 'year_overlap');

  return base;
}

export type ClassConflictDetailInput = {
  entry: LocalEntry;
  code: string;
  localEntries: LocalEntry[];
  roomById: Map<string, RoomDto>;
  confirmedOccupancyByProfessorTimeslot: Map<string, OccupancyValue>;
};

export function getClassConflictDetail(input: ClassConflictDetailInput): string {
  const { entry, code, localEntries, roomById, confirmedOccupancyByProfessorTimeslot } = input;

  if (code === 'unassigned') {
    return resolveClassConflictMessage('unassigned');
  }

  const candidates = localEntries.filter((candidate) => candidate.id !== entry.id);

  if (code === 'room_overlap' && entry.room_id && entry.timeslot_id) {
    const matched = candidates.find(
      (candidate) => candidate.room_id === entry.room_id && candidate.timeslot_id === entry.timeslot_id,
    );
    if (matched) {
      return `Conflicts with ${matched.course_code} (${matched.course_name}) in Room ${entry.room_name ?? 'N/A'}.`;
    }
    return resolveClassConflictMessage('room_overlap');
  }

  if (code === 'professor_overlap' && entry.professor_id && entry.timeslot_id) {
    const matched = candidates.find(
      (candidate) => candidate.professor_id === entry.professor_id && candidate.timeslot_id === entry.timeslot_id,
    );
    if (matched) {
      return `Conflicts with ${matched.course_code} (${matched.course_name}) for Professor ${entry.professor_name ?? 'N/A'}.`;
    }
    const confirmedMatch = confirmedOccupancyByProfessorTimeslot.get(`${entry.professor_id}-${entry.timeslot_id}`);
    if (confirmedMatch) {
      return `Conflicts with confirmed schedule ${confirmedMatch.courseCode} (${confirmedMatch.courseName}) for Professor ${entry.professor_name ?? 'N/A'}.`;
    }
    return resolveClassConflictMessage('professor_overlap');
  }

  if (code === 'year_overlap' && entry.timeslot_id) {
    const matched = candidates.find(
      (candidate) => candidate.year === entry.year && candidate.timeslot_id === entry.timeslot_id,
    );
    if (matched) {
      return `Conflicts with ${matched.course_code} (${matched.course_name}) in Year ${entry.year}.`;
    }
    return resolveClassConflictMessage('year_overlap');
  }

  if (code === 'room_capacity_exceeded' && entry.room_id) {
    const roomCapacity = roomById.get(entry.room_id)?.capacity ?? 0;
    const requiredCapacity = entry.required_capacity ?? 0;
    return `Room capacity ${roomCapacity} is below required enrollment ${requiredCapacity}.`;
  }

  return resolveClassConflictMessage(code);
}

export function getRoomAvailabilityStatus(input: {
  entry: LocalEntry;
  roomId: string;
  localEntries: LocalEntry[];
  confirmedOccupancyByRoomTimeslot: Map<string, OccupancyValue>;
}): RoomAvailabilityStatus {
  const { entry, roomId, localEntries, confirmedOccupancyByRoomTimeslot } = input;

  if (!entry.timeslot_id) {
    return 'available';
  }

  const occupancyKey = `${roomId}-${entry.timeslot_id}`;
  if (confirmedOccupancyByRoomTimeslot.has(occupancyKey)) {
    return 'used_confirmed';
  }

  const usedInDraft = localEntries.some(
    (candidate) =>
      candidate.id !== entry.id &&
      candidate.timeslot_id === entry.timeslot_id &&
      candidate.room_id === roomId,
  );
  if (usedInDraft) {
    return 'used_draft';
  }

  return 'available';
}

function applyConflict(grouped: Map<string, LocalEntry[]>, code: string): void {
  for (const group of grouped.values()) {
    if (group.length <= 1) {
      continue;
    }

    for (const entry of group) {
      if (!hasConflictCode(entry.conflicts, code)) {
        entry.conflicts.push({ code, message: resolveClassConflictMessage(code) });
      }
    }
  }
}
