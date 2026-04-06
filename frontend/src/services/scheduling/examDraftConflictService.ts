import type { ScheduleConflictDto, ScheduleExamEntryDto } from '../../api/scheduling';
import type { RoomAvailabilityStatus } from '../../types/scheduling';
import { resolveExamConflictMessage } from '../../utils/scheduling/conflictCatalog';

type LocalExamEntry = ScheduleExamEntryDto;

type OccupancyValue = {
  courseCode: string;
  courseName: string;
};

export type RecomputeExamDraftConflictsInput = {
  localEntries: LocalExamEntry[];
  baseConflictsByEntryId: Map<string, ScheduleConflictDto[]>;
  confirmedOccupancyByRoomDateSlot: Map<string, OccupancyValue>;
  enforceProgramYearNoOverlap: boolean;
};

export function recomputeExamDraftConflicts(input: RecomputeExamDraftConflictsInput): LocalExamEntry[] {
  const { localEntries, baseConflictsByEntryId, confirmedOccupancyByRoomDateSlot, enforceProgramYearNoOverlap } = input;

  const byRoomDateSlot = new Map<string, LocalExamEntry[]>();
  const byProgramYearSlot = new Map<string, LocalExamEntry[]>();

  for (const entry of localEntries) {
    if (entry.room_id && entry.exam_date && entry.timeslot_code) {
      const roomKey = `${entry.room_id}-${entry.exam_date}-${entry.timeslot_code}`;
      const roomEntries = byRoomDateSlot.get(roomKey) ?? [];
      roomEntries.push(entry);
      byRoomDateSlot.set(roomKey, roomEntries);

      const cohortKey = `${entry.program_id}-${entry.year}-${entry.exam_date}-${entry.timeslot_code}`;
      const cohortEntries = byProgramYearSlot.get(cohortKey) ?? [];
      cohortEntries.push(entry);
      byProgramYearSlot.set(cohortKey, cohortEntries);
    }
  }

  return localEntries.map((entry) => {
    const dynamicCodes = new Set<string>();
    if (!entry.exam_date || !entry.timeslot_code || !entry.room_id) {
      dynamicCodes.add('unassigned');
    }

    if (entry.room_id && entry.exam_date && entry.timeslot_code) {
      const roomKey = `${entry.room_id}-${entry.exam_date}-${entry.timeslot_code}`;
      if (confirmedOccupancyByRoomDateSlot.has(roomKey)) {
        dynamicCodes.add('room_overlap');
      }

      if ((byRoomDateSlot.get(roomKey) ?? []).length > 1) {
        dynamicCodes.add('room_overlap');
      }

      if (enforceProgramYearNoOverlap) {
        const cohortKey = `${entry.program_id}-${entry.year}-${entry.exam_date}-${entry.timeslot_code}`;
        if ((byProgramYearSlot.get(cohortKey) ?? []).length > 1) {
          dynamicCodes.add('program_year_overlap');
        }
      }
    }

    const baseConflicts = baseConflictsByEntryId.get(entry.id) ?? [];
    const preserved = baseConflicts.filter(
      (conflict) => conflict.code === 'student_overlap' || conflict.code === 'room_capacity_exceeded',
    );
    const dynamic = Array.from(dynamicCodes).map((code) => ({
      code,
      message: resolveExamConflictMessage(code),
    }));

    return {
      ...entry,
      conflicts: [...preserved, ...dynamic],
    };
  });
}

export function getExamRoomAvailabilityStatus(input: {
  entry: LocalExamEntry;
  roomId: string;
  localEntries: LocalExamEntry[];
  confirmedOccupancyByRoomDateSlot: Map<string, OccupancyValue>;
}): RoomAvailabilityStatus {
  const { entry, roomId, localEntries, confirmedOccupancyByRoomDateSlot } = input;

  if (!entry.exam_date || !entry.timeslot_code) {
    return 'available';
  }

  const occupancyKey = `${roomId}-${entry.exam_date}-${entry.timeslot_code}`;
  if (confirmedOccupancyByRoomDateSlot.has(occupancyKey)) {
    return 'used_confirmed';
  }

  const usedInDraft = localEntries.some(
    (candidate) =>
      candidate.id !== entry.id &&
      candidate.exam_date === entry.exam_date &&
      candidate.timeslot_code === entry.timeslot_code &&
      candidate.room_id === roomId,
  );

  if (usedInDraft) {
    return 'used_draft';
  }

  return 'available';
}

export function canPlaceExamEntryInRoomCell(input: {
  entry: LocalExamEntry;
  examDate: string;
  slotCode: string;
  roomId: string;
  localEntries: LocalExamEntry[];
  confirmedOccupancyByRoomDateSlot: Map<string, OccupancyValue>;
  enforceProgramYearNoOverlap: boolean;
}): boolean {
  const {
    entry,
    examDate,
    slotCode,
    roomId,
    localEntries,
    confirmedOccupancyByRoomDateSlot,
    enforceProgramYearNoOverlap,
  } = input;

  const roomKey = `${roomId}-${examDate}-${slotCode}`;
  if (confirmedOccupancyByRoomDateSlot.has(roomKey)) {
    return false;
  }

  const occupiedInDraft = localEntries.some(
    (candidate) =>
      candidate.id !== entry.id &&
      candidate.room_id === roomId &&
      candidate.exam_date === examDate &&
      candidate.timeslot_code === slotCode,
  );
  if (occupiedInDraft) {
    return false;
  }

  if (enforceProgramYearNoOverlap) {
    const sameCohortConflict = localEntries.some(
      (candidate) =>
        candidate.id !== entry.id &&
        candidate.program_id === entry.program_id &&
        candidate.year === entry.year &&
        candidate.exam_date === examDate &&
        candidate.timeslot_code === slotCode,
    );
    if (sameCohortConflict) {
      return false;
    }
  }

  return true;
}
