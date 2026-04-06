import { useEffect, useMemo, useState } from 'react';
import type { AxiosError } from 'axios';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '../components/Card';
import { Tabs } from '../components/Tabs';
import { listRooms, type RoomDto } from '../api/resources';
import {
  commitClassScheduleDraft,
  deleteClassScheduleDraft,
  getClassScheduleDraft,
  getClassScheduleJob,
  makeClassScheduleAsDraft,
  saveClassScheduleDraft,
  type ClassScheduleDraftDto,
  type ScheduleClassEntryDto,
  type ScheduleConflictDto,
} from '../api/scheduling';
import { useResourcesCatalog } from '../contexts/ResourcesCatalogContext';

type LocalEntry = ScheduleClassEntryDto;

type MatrixBucket = 'morning' | 'afternoon' | 'evening';
type DraftViewTab = 'Time & Days' | 'Room-Centric';

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

const bucketOrder: MatrixBucket[] = ['morning', 'afternoon', 'evening'];
const draftViewTabs: DraftViewTab[] = ['Time & Days', 'Room-Centric'];
const CLASS_PREFS_STORAGE_PREFIX = 'classPreferredSlotsBySnapshot:';

const conflictMessageByCode: Record<string, string> = {
  room_overlap: 'Room has another class at this timeslot.',
  professor_overlap: 'Professor has another class at this timeslot.',
  year_overlap: 'This year already has a class at this timeslot.',
  unassigned: 'Missing room or timeslot assignment.',
  room_capacity_exceeded: 'Room capacity is smaller than expected enrollment.',
};

const yearCardStyles: Record<number, { container: string; badge: string }> = {
  // Year progression palette: foundation -> growth -> specialization -> capstone
  1: {
    container: 'border-sky-200 bg-sky-50 border-l-4 border-l-sky-500',
    badge: 'bg-sky-100 text-sky-800',
  },
  2: {
    container: 'border-emerald-200 bg-emerald-50 border-l-4 border-l-emerald-500',
    badge: 'bg-emerald-100 text-emerald-800',
  },
  3: {
    container: 'border-fuchsia-200 bg-fuchsia-50 border-l-4 border-l-fuchsia-500',
    badge: 'bg-fuchsia-100 text-fuchsia-800',
  },
  4: {
    container: 'border-indigo-200 bg-indigo-50 border-l-4 border-l-indigo-500',
    badge: 'bg-indigo-100 text-indigo-800',
  },
};

const dayAliases: Record<string, (typeof daysOfWeek)[number]> = {
  mon: 'Monday',
  monday: 'Monday',
  tue: 'Tuesday',
  tues: 'Tuesday',
  tuesday: 'Tuesday',
  wed: 'Wednesday',
  weds: 'Wednesday',
  wednesday: 'Wednesday',
  thu: 'Thursday',
  thur: 'Thursday',
  thurs: 'Thursday',
  thursday: 'Thursday',
  fri: 'Friday',
  friday: 'Friday',
  sat: 'Saturday',
  saturday: 'Saturday',
  sun: 'Sunday',
  sunday: 'Sunday',
};

const normalizeDayValue = (dayValue: string | null | undefined): (typeof daysOfWeek)[number] | null => {
  if (!dayValue) {
    return null;
  }
  const key = dayValue.trim().toLowerCase();
  return dayAliases[key] ?? null;
};

const parseDisplayTime = (raw: string): string | null => {
  const trimmed = raw.trim().toLowerCase();
  const twelveHour = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (twelveHour) {
    const hour = Number(twelveHour[1]);
    const minute = twelveHour[2] ? Number(twelveHour[2]) : 0;
    const meridiem = twelveHour[3].toUpperCase();
    return `${hour}:${String(minute).padStart(2, '0')} ${meridiem}`;
  }

  const twentyFourHour = trimmed.match(/^(\d{1,2})(?::(\d{2}))$/);
  if (twentyFourHour) {
    const hour24 = Number(twentyFourHour[1]);
    const minute = Number(twentyFourHour[2]);
    const isPm = hour24 >= 12;
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
    return `${hour12}:${String(minute).padStart(2, '0')} ${isPm ? 'PM' : 'AM'}`;
  }

  return null;
};

const formatTimeslotResourceLabel = (label: string): string => {
  const parts = label
    .split('-')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length !== 2) {
    return label;
  }

  const start = parseDisplayTime(parts[0]);
  const end = parseDisplayTime(parts[1]);
  if (!start || !end) {
    return label;
  }

  return `${start} - ${end}`;
};

const detectBucketFromTimeLabel = (label: string | null | undefined): MatrixBucket | null => {
  if (!label) {
    return null;
  }

  const normalized = label.toLowerCase();
  if (normalized.includes('morning')) {
    return 'morning';
  }
  if (normalized.includes('afternoon')) {
    return 'afternoon';
  }
  if (normalized.includes('evening')) {
    return 'evening';
  }

  const ampmMatch = normalized.match(/(\d{1,2})(?::\d{2})?\s*(am|pm)/);
  if (ampmMatch) {
    const hour = Number(ampmMatch[1]);
    const minutePart = normalized.match(/\d{1,2}:(\d{2})\s*(am|pm)/);
    const minute = minutePart ? Number(minutePart[1]) : 0;
    const meridiem = ampmMatch[2];
    if (meridiem === 'am') {
      return 'morning';
    }

    const hour24 = hour % 12 + 12;
    const totalMinutes = hour24 * 60 + minute;
    if (totalMinutes < 16 * 60 + 30) {
      return 'afternoon';
    }
    return 'evening';
  }

  const twentyFourMatch = normalized.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (twentyFourMatch) {
    const hour = Number(twentyFourMatch[1]);
    const minute = Number(twentyFourMatch[2]);
    const totalMinutes = hour * 60 + minute;
    if (totalMinutes < 12 * 60) {
      return 'morning';
    }
    if (totalMinutes < 16 * 60 + 30) {
      return 'afternoon';
    }
    return 'evening';
  }

  return null;
};

const readPreferredTimeslotsByKey = (snapshotId: string | null): Record<string, string[]> => {
  if (!snapshotId) {
    return {};
  }

  try {
    const raw = sessionStorage.getItem(`${CLASS_PREFS_STORAGE_PREFIX}${snapshotId}`);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const normalized: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!Array.isArray(value)) {
        continue;
      }
      const slotIds = value.filter((item): item is string => typeof item === 'string');
      if (slotIds.length > 0) {
        normalized[key] = slotIds;
      }
    }
    return normalized;
  } catch {
    return {};
  }
};

function readErrorMessage(error: unknown, fallback: string): string {
  const axiosError = error as AxiosError<{ detail?: string }>;
  return axiosError.response?.data?.detail ?? fallback;
}

export function ScheduleDraftPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const snapshotId = searchParams.get('snapshotId');
  const jobId = searchParams.get('jobId');

  const { timeslots } = useResourcesCatalog();

  const [rooms, setRooms] = useState<RoomDto[]>([]);
  const [draft, setDraft] = useState<ClassScheduleDraftDto | null>(null);
  const [localEntries, setLocalEntries] = useState<LocalEntry[]>([]);
  const [activeDraftView, setActiveDraftView] = useState<DraftViewTab>('Time & Days');
  const [draggingEntryId, setDraggingEntryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [convertingToDraft, setConvertingToDraft] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeConflictPopover, setActiveConflictPopover] = useState<{ entryId: string; code: string } | null>(null);
  const [hoveredCellKey, setHoveredCellKey] = useState<string | null>(null);

  const preferredTimeslotsByKey = useMemo(
    () => readPreferredTimeslotsByKey(snapshotId),
    [snapshotId],
  );

  useEffect(() => {
    let isCancelled = false;

    const load = async () => {
      if (!snapshotId) {
        setErrorMessage('Snapshot id is missing.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setErrorMessage(null);

        if (jobId) {
          await getClassScheduleJob(jobId);
        }

        const [loadedDraft, loadedRooms] = await Promise.all([
          getClassScheduleDraft(snapshotId),
          listRooms(),
        ]);

        if (isCancelled) {
          return;
        }

        setDraft(loadedDraft);
        setRooms(loadedRooms);
        setLocalEntries(loadedDraft.entries);
      } catch {
        if (!isCancelled) {
          setErrorMessage('Unable to load scheduling draft.');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      isCancelled = true;
    };
  }, [jobId, snapshotId]);

  const roomById = useMemo(() => new Map(rooms.map((room) => [room.id, room])), [rooms]);
  const timeslotById = useMemo(() => new Map(timeslots.map((slot) => [slot.id, slot])), [timeslots]);

  const selectedRooms = useMemo(() => {
    if (!draft) {
      return [] as RoomDto[];
    }

    const matched = draft.selected_room_names
      .map((name) => rooms.find((room) => room.name === name))
      .filter((room): room is RoomDto => Boolean(room));

    if (matched.length > 0) {
      return matched;
    }

    const roomIdsUsed = new Set(localEntries.map((entry) => entry.room_id).filter(Boolean));
    return rooms.filter((room) => roomIdsUsed.has(room.id));
  }, [draft, localEntries, rooms]);

  const years = useMemo(
    () => Array.from(new Set(localEntries.map((entry) => entry.year))).sort((left, right) => left - right),
    [localEntries],
  );

  const entriesByYear = useMemo(() => {
    const map = new Map<number, LocalEntry[]>();
    for (const year of years) {
      map.set(year, localEntries.filter((entry) => entry.year === year));
    }
    return map;
  }, [localEntries, years]);

  const timeslotsByDay = useMemo(() => {
    const map = new Map<string, typeof timeslots>();
    for (const day of daysOfWeek) {
      map.set(day, []);
    }

    for (const slot of timeslots) {
      const normalizedDay = normalizeDayValue(slot.day);
      if (!normalizedDay || !map.has(normalizedDay)) {
        continue;
      }

      const daySlots = map.get(normalizedDay) ?? [];
      daySlots.push(slot);
      map.set(normalizedDay, daySlots);
    }

    for (const day of daysOfWeek) {
      const bucketRank = (slotLabel: string) => {
        const bucket = detectBucketFromTimeLabel(slotLabel);
        if (bucket === 'morning') {
          return 0;
        }
        if (bucket === 'afternoon') {
          return 1;
        }
        if (bucket === 'evening') {
          return 2;
        }
        return 9;
      };

      const sorted = [...(map.get(day) ?? [])].sort((left, right) => {
        const rankDiff = bucketRank(left.label) - bucketRank(right.label);
        if (rankDiff !== 0) {
          return rankDiff;
        }
        return left.label.localeCompare(right.label);
      });
      map.set(day, sorted);
    }

    return map;
  }, [timeslots]);

  const allTimeslotsSorted = useMemo(() => {
    const dayOrder = new Map(daysOfWeek.map((day, index) => [day, index]));
    return [...timeslots].sort((left, right) => {
      const leftDay = normalizeDayValue(left.day);
      const rightDay = normalizeDayValue(right.day);
      const leftRank = leftDay ? (dayOrder.get(leftDay) ?? 99) : 99;
      const rightRank = rightDay ? (dayOrder.get(rightDay) ?? 99) : 99;
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }
      return left.label.localeCompare(right.label);
    });
  }, [timeslots]);

  const bucketRows = useMemo(() => {
    const firstByBucket = new Map<MatrixBucket, string>();
    for (const slot of allTimeslotsSorted) {
      const bucket = detectBucketFromTimeLabel(slot.label);
      if (!bucket || firstByBucket.has(bucket)) {
        continue;
      }
      firstByBucket.set(bucket, formatTimeslotResourceLabel(slot.label));
    }

    return bucketOrder.map((bucket) => ({
      key: bucket,
      label: firstByBucket.get(bucket) ?? 'Not configured',
    }));
  }, [allTimeslotsSorted]);

  const confirmedOccupancyByRoomTimeslot = useMemo(() => {
    const map = new Map<string, { courseCode: string; courseName: string }>();
    for (const occupancy of draft?.confirmed_occupancies ?? []) {
      const key = `${occupancy.room_id}-${occupancy.timeslot_id}`;
      if (!map.has(key)) {
        map.set(key, {
          courseCode: occupancy.course_code,
          courseName: occupancy.course_name,
        });
      }
    }
    return map;
  }, [draft?.confirmed_occupancies]);

  const confirmedOccupancyByProfessorTimeslot = useMemo(() => {
    const map = new Map<string, { courseCode: string; courseName: string }>();
    for (const occupancy of draft?.confirmed_professor_occupancies ?? []) {
      const key = `${occupancy.professor_id}-${occupancy.timeslot_id}`;
      if (!map.has(key)) {
        map.set(key, {
          courseCode: occupancy.course_code,
          courseName: occupancy.course_name,
        });
      }
    }
    return map;
  }, [draft?.confirmed_professor_occupancies]);

  const conflictedEntriesCount = useMemo(
    () => localEntries.filter((entry) => entry.conflicts.length > 0).length,
    [localEntries],
  );

  const hasUnsavedChanges = useMemo(() => {
    if (!draft) {
      return false;
    }

    const savedById = new Map(
      draft.entries.map((entry) => [entry.id, { timeslot_id: entry.timeslot_id, room_id: entry.room_id }]),
    );

    if (savedById.size !== localEntries.length) {
      return true;
    }

    for (const entry of localEntries) {
      const saved = savedById.get(entry.id);
      if (!saved) {
        return true;
      }
      if (saved.timeslot_id !== entry.timeslot_id || saved.room_id !== entry.room_id) {
        return true;
      }
    }

    return false;
  }, [draft, localEntries]);

  const unassignedEntriesCount = useMemo(
    () => localEntries.filter((entry) => !entry.timeslot_id || !entry.room_id).length,
    [localEntries],
  );

  const totalEntriesCount = localEntries.length;

  const recomputeLocalConflicts = (entries: LocalEntry[]): LocalEntry[] => {
    const base = entries.map((entry) => ({ ...entry, conflicts: [] as ScheduleConflictDto[] }));
    const byRoomSlot = new Map<string, LocalEntry[]>();
    const byProfessorSlot = new Map<string, LocalEntry[]>();
    const byYearSlot = new Map<string, LocalEntry[]>();

    for (const entry of base) {
      if (!entry.timeslot_id || !entry.room_id) {
        entry.conflicts.push({ code: 'unassigned', message: conflictMessageByCode.unassigned });
      }

      if (entry.timeslot_id && entry.room_id) {
        const occupiedKey = `${entry.room_id}-${entry.timeslot_id}`;
        if (confirmedOccupancyByRoomTimeslot.has(occupiedKey)) {
          entry.conflicts.push({ code: 'room_overlap', message: conflictMessageByCode.room_overlap });
        }

        if (draft?.constraints.roomCapacityCheck !== false) {
          const roomCapacity = roomById.get(entry.room_id)?.capacity ?? 0;
          const requiredCapacity = entry.required_capacity ?? 0;
          if (requiredCapacity > roomCapacity) {
            entry.conflicts.push({ code: 'room_capacity_exceeded', message: conflictMessageByCode.room_capacity_exceeded });
          }
        }

        const key = `${entry.room_id}-${entry.timeslot_id}`;
        const items = byRoomSlot.get(key) ?? [];
        items.push(entry);
        byRoomSlot.set(key, items);
      }

      if (draft?.constraints.professorNoOverlap !== false && entry.timeslot_id && entry.professor_id) {
        const occupiedKey = `${entry.professor_id}-${entry.timeslot_id}`;
        if (confirmedOccupancyByProfessorTimeslot.has(occupiedKey)) {
          entry.conflicts.push({ code: 'professor_overlap', message: conflictMessageByCode.professor_overlap });
        }

        const key = `${entry.professor_id}-${entry.timeslot_id}`;
        const items = byProfessorSlot.get(key) ?? [];
        items.push(entry);
        byProfessorSlot.set(key, items);
      }

      if (draft?.constraints.studentGroupsNoOverlap !== false && entry.timeslot_id) {
        const key = `${entry.year}-${entry.timeslot_id}`;
        const items = byYearSlot.get(key) ?? [];
        items.push(entry);
        byYearSlot.set(key, items);
      }
    }

    const applyConflict = (grouped: Map<string, LocalEntry[]>, code: keyof typeof conflictMessageByCode) => {
      for (const group of grouped.values()) {
        if (group.length <= 1) {
          continue;
        }

        for (const entry of group) {
          if (!entry.conflicts.find((conflict) => conflict.code === code)) {
            entry.conflicts.push({ code, message: conflictMessageByCode[code] });
          }
        }
      }
    };

    applyConflict(byRoomSlot, 'room_overlap');
    applyConflict(byProfessorSlot, 'professor_overlap');
    applyConflict(byYearSlot, 'year_overlap');

    return base;
  };

  const detectBucketFromLabel = (label: string | null): MatrixBucket | null => detectBucketFromTimeLabel(label);

  const resolveTimeslotId = (day: string, bucket: MatrixBucket): string | null => {
    const daySlots = timeslotsByDay.get(day) ?? [];

    const findByBucket = (slots: typeof timeslots) =>
      slots.find((slot) => {
        const detected = detectBucketFromLabel(slot.label);
        return detected === bucket;
      });

    const preferredByLabel = findByBucket(daySlots);
    if (preferredByLabel) {
      return preferredByLabel.id;
    }

    return null;
  };

  const resolveEntryBucket = (entry: LocalEntry): MatrixBucket | null => {
    const byLabel = detectBucketFromLabel(entry.timeslot_label);
    if (byLabel) {
      return byLabel;
    }

    const slotById = entry.timeslot_id ? timeslotById.get(entry.timeslot_id) : undefined;
    const byLookupLabel = detectBucketFromLabel(slotById?.label ?? null);
    if (byLookupLabel) {
      return byLookupLabel;
    }

    if (!entry.day || !entry.timeslot_id) {
      return null;
    }

    const titleDay = normalizeDayValue(slotById?.day ?? entry.day);
    if (!titleDay) {
      return null;
    }
    const daySlots = timeslotsByDay.get(titleDay) ?? [];
    const index = daySlots.findIndex((slot) => slot.id === entry.timeslot_id);
    if (index <= 0) {
      return 'morning';
    }
    if (index === 1) {
      return 'afternoon';
    }
    return 'evening';
  };

  const resolveEntryDay = (entry: LocalEntry): (typeof daysOfWeek)[number] | null => {
    const slotById = entry.timeslot_id ? timeslotById.get(entry.timeslot_id) : undefined;
    return normalizeDayValue(slotById?.day ?? entry.day);
  };

  const getConflictDetail = (entry: LocalEntry, code: string): string => {
    if (code === 'unassigned') {
      return conflictMessageByCode.unassigned;
    }

    const candidates = localEntries.filter((candidate) => candidate.id !== entry.id);

    if (code === 'room_overlap' && entry.room_id && entry.timeslot_id) {
      const matched = candidates.find(
        (candidate) => candidate.room_id === entry.room_id && candidate.timeslot_id === entry.timeslot_id,
      );
      if (matched) {
        return `Conflicts with ${matched.course_code} (${matched.course_name}) in Room ${entry.room_name ?? 'N/A'}.`;
      }
      return conflictMessageByCode.room_overlap;
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
      return conflictMessageByCode.professor_overlap;
    }

    if (code === 'year_overlap' && entry.timeslot_id) {
      const matched = candidates.find(
        (candidate) => candidate.year === entry.year && candidate.timeslot_id === entry.timeslot_id,
      );
      if (matched) {
        return `Conflicts with ${matched.course_code} (${matched.course_name}) in Year ${entry.year}.`;
      }
      return conflictMessageByCode.year_overlap;
    }

    if (code === 'room_capacity_exceeded' && entry.room_id) {
      const roomCapacity = roomById.get(entry.room_id)?.capacity ?? 0;
      const requiredCapacity = entry.required_capacity ?? 0;
      return `Room capacity ${roomCapacity} is below required enrollment ${requiredCapacity}.`;
    }

    return 'Conflict detected.';
  };

  const updateEntryPlacement = (entryId: string, timeslotId: string | null, roomId: string | null) => {
    setLocalEntries((prev) => {
      const next = prev.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              timeslot_id: timeslotId,
              room_id: roomId,
              room_name: roomId ? roomById.get(roomId)?.name ?? null : null,
              timeslot_label: timeslotId ? timeslots.find((slot) => slot.id === timeslotId)?.label ?? null : null,
              day: timeslotId ? timeslots.find((slot) => slot.id === timeslotId)?.day ?? null : null,
              manually_adjusted: true,
            }
          : entry,
      );

      const withConflicts = recomputeLocalConflicts(next);
      setActiveConflictPopover(null);
      return withConflicts;
    });
  };

  const onDropToMatrixCell = (day: string, bucket: MatrixBucket) => {
    if (!draggingEntryId) {
      return;
    }

    const targetTimeslotId = resolveTimeslotId(day, bucket);
    if (!targetTimeslotId) {
      setDraggingEntryId(null);
      setHoveredCellKey(null);
      return;
    }

    const draggingEntry = localEntries.find((entry) => entry.id === draggingEntryId);
    if (!draggingEntry) {
      setDraggingEntryId(null);
      setHoveredCellKey(null);
      return;
    }

    const fallbackRoomId = findValidRoomIdForTimeCell(draggingEntry, day, bucket);
    if (!fallbackRoomId) {
      setErrorMessage('No available room in this cell due to overlap constraints.');
      setDraggingEntryId(null);
      setHoveredCellKey(null);
      return;
    }

    updateEntryPlacement(draggingEntryId, targetTimeslotId, fallbackRoomId);
    setDraggingEntryId(null);
    setHoveredCellKey(null);
    setErrorMessage(null);
  };

  const onDropToRoomCell = (day: string, bucket: MatrixBucket, roomId: string) => {
    if (!draggingEntryId) {
      return;
    }

    const targetTimeslotId = resolveTimeslotId(day, bucket);
    if (!targetTimeslotId) {
      setDraggingEntryId(null);
      setHoveredCellKey(null);
      return;
    }

    updateEntryPlacement(draggingEntryId, targetTimeslotId, roomId);
    setDraggingEntryId(null);
    setHoveredCellKey(null);
    setErrorMessage(null);
  };

  const onDropToUnassigned = () => {
    if (!draggingEntryId) {
      return;
    }
    updateEntryPlacement(draggingEntryId, null, null);
    setDraggingEntryId(null);
    setHoveredCellKey(null);
  };

  const canPlaceEntryInRoomCell = (entry: LocalEntry, day: string, bucket: MatrixBucket, roomId: string): boolean => {
    const targetTimeslotId = resolveTimeslotId(day, bucket);
    if (!targetTimeslotId) {
      return false;
    }

    const occupiedKey = `${roomId}-${targetTimeslotId}`;
    if (confirmedOccupancyByRoomTimeslot.has(occupiedKey)) {
      return false;
    }

    if (draft?.constraints.roomCapacityCheck !== false) {
      const roomCapacity = roomById.get(roomId)?.capacity ?? 0;
      const requiredCapacity = entry.required_capacity ?? 0;
      if (requiredCapacity > roomCapacity) {
        return false;
      }
    }

    if (draft?.constraints.professorNoOverlap !== false && entry.professor_id) {
      const professorKey = `${entry.professor_id}-${targetTimeslotId}`;
      if (confirmedOccupancyByProfessorTimeslot.has(professorKey)) {
        return false;
      }
    }

    for (const candidate of localEntries) {
      if (candidate.id === entry.id || candidate.timeslot_id !== targetTimeslotId) {
        continue;
      }

      if (candidate.room_id === roomId) {
        return false;
      }

      if (
        draft?.constraints.professorNoOverlap !== false &&
        entry.professor_id &&
        candidate.professor_id === entry.professor_id
      ) {
        return false;
      }

      if (draft?.constraints.studentGroupsNoOverlap !== false && candidate.year === entry.year) {
        return false;
      }
    }

    return true;
  };

  const canDropEntryInRoomCell = (day: string, bucket: MatrixBucket, roomId: string): boolean => {
    const targetTimeslotId = resolveTimeslotId(day, bucket);
    if (!targetTimeslotId) {
      return false;
    }

    // Draft entries may overlap during manual staging, but committed occupancy is always blocked.
    const occupiedKey = `${roomId}-${targetTimeslotId}`;
    return !confirmedOccupancyByRoomTimeslot.has(occupiedKey);
  };

  const canPlaceEntryInTimeCell = (entry: LocalEntry, day: string, bucket: MatrixBucket): boolean => {
    if (!resolveTimeslotId(day, bucket)) {
      return false;
    }

    const preferredRoomIds = [entry.room_id, ...selectableRooms.map((room) => room.id)].filter(
      (roomId): roomId is string => Boolean(roomId),
    );
    const uniqueRoomIds = Array.from(new Set(preferredRoomIds));

    // Green hint means at least one room can satisfy all hard constraints at this time cell.
    return uniqueRoomIds.some((roomId) => canPlaceEntryInRoomCell(entry, day, bucket, roomId));
  };

  const findValidRoomIdForTimeCell = (entry: LocalEntry, day: string, bucket: MatrixBucket): string | null => {
    const preferredRoomIds = [entry.room_id, ...selectableRooms.map((room) => room.id)].filter(
      (roomId): roomId is string => Boolean(roomId),
    );

    const uniqueRoomIds = Array.from(new Set(preferredRoomIds));
    const strictlyValidRoomId = uniqueRoomIds.find((roomId) => canPlaceEntryInRoomCell(entry, day, bucket, roomId));
    if (strictlyValidRoomId) {
      return strictlyValidRoomId;
    }

    // If no conflict-free room exists, allow staging on a room that is not blocked by committed occupancy.
    const draftStageRoomId = uniqueRoomIds.find((roomId) => canDropEntryInRoomCell(day, bucket, roomId));
    return draftStageRoomId ?? null;
  };

  const handleSaveDraft = async () => {
    if (!snapshotId) {
      return;
    }

    try {
      setSaving(true);
      const savedDraft = await saveClassScheduleDraft(snapshotId, {
        entries: localEntries.map((entry) => ({
          id: entry.id,
          timeslot_id: entry.timeslot_id,
          room_id: entry.room_id,
        })),
      });

      setDraft(savedDraft);
      setLocalEntries(savedDraft.entries);
      setErrorMessage(null);
      window.alert('Staging drafts saved successfully.');
    } catch (error) {
      setErrorMessage(readErrorMessage(error, 'Failed to save staging draft. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const handleCommitSchedule = async () => {
    if (!snapshotId) {
      return;
    }

    // Recompute local hard-constraint conflicts before commit to keep frontend state aligned.
    const validatedEntries = recomputeLocalConflicts(localEntries);
    const hasBlockingConflicts = validatedEntries.some((entry) => entry.conflicts.length > 0);
    if (hasBlockingConflicts) {
      setLocalEntries(validatedEntries);
      setErrorMessage('Cannot commit schedule while hard-constraint conflicts remain.');
      return;
    }

    try {
      setCommitting(true);
      const savedDraft = await commitClassScheduleDraft(snapshotId, {
        entries: validatedEntries.map((entry) => ({
          id: entry.id,
          timeslot_id: entry.timeslot_id,
          room_id: entry.room_id,
        })),
      });

      setDraft(savedDraft);
      setLocalEntries(savedDraft.entries);
      setErrorMessage(null);
      navigate('/generated-class-schedules');
    } catch (error) {
      setErrorMessage(readErrorMessage(error, 'Failed to commit schedule. Resolve remaining conflicts and try again.'));
    } finally {
      setCommitting(false);
    }
  };

  const handleMakeAsDraft = async () => {
    if (!snapshotId) {
      return;
    }

    try {
      setConvertingToDraft(true);
      const updated = await makeClassScheduleAsDraft(snapshotId);
      setDraft(updated);
      setLocalEntries(updated.entries);
      setErrorMessage(null);
      window.alert('Schedule was converted to draft successfully.');
    } catch (error) {
      setErrorMessage(readErrorMessage(error, 'Failed to convert schedule to draft. Please try again.'));
    } finally {
      setConvertingToDraft(false);
    }
  };

  const handleDeleteDraft = async () => {
    if (!snapshotId) {
      return;
    }

    const confirmed = window.confirm('Delete this draft? This will remove the current snapshot for this program.');
    if (!confirmed) {
      return;
    }

    try {
      setDeleting(true);
      await deleteClassScheduleDraft(snapshotId);
      navigate('/scheduling-manager');
    } catch (error) {
      setErrorMessage(readErrorMessage(error, 'Failed to delete draft. Please try again.'));
    } finally {
      setDeleting(false);
    }
  };

  const selectableRooms = selectedRooms.length > 0 ? selectedRooms : rooms;

  const getRoomAvailabilityStatus = (entry: LocalEntry, roomId: string): 'available' | 'used_draft' | 'used_confirmed' => {
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
  };

  const handleEntryRoomChange = (entry: LocalEntry, roomId: string) => {
    updateEntryPlacement(entry.id, entry.timeslot_id, roomId || null);
    setErrorMessage(null);
  };

  const renderScheduleCard = (
    entry: LocalEntry,
    options: { showRoom?: boolean; showYear?: boolean; enableRoomDropdown?: boolean } = {},
  ) => {
    const { showRoom = true, showYear = false, enableRoomDropdown = false } = options;
    const yearStyle = yearCardStyles[entry.year] ?? {
      container: 'border-slate-200 bg-slate-50',
      badge: 'bg-slate-200 text-slate-700',
    };

    const preferredSlotIds =
      (entry.program_year_course_id ? preferredTimeslotsByKey[entry.program_year_course_id] : undefined) ??
      preferredTimeslotsByKey[entry.course_id] ??
      [];
    const hasPreferences = preferredSlotIds.length > 0;
    const isPreferredMatched = hasPreferences && Boolean(entry.timeslot_id && preferredSlotIds.includes(entry.timeslot_id));
    const isPreferredPending = hasPreferences && !entry.timeslot_id;

    return (
      <div
        key={entry.id}
        draggable
        onDragStart={() => {
          setDraggingEntryId(entry.id);
          setActiveConflictPopover(null);
        }}
        onDragEnd={() => setDraggingEntryId(null)}
        className={`cursor-move rounded-md border p-2 ${yearStyle.container}`}
      >
        <p className="text-xs font-semibold text-slate-900">{entry.course_code}</p>
        <p className="text-xs text-slate-700">{entry.course_name}</p>
        {hasPreferences && (
          <p
            className={`mt-1 inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${
              isPreferredMatched
                ? 'bg-emerald-100 text-emerald-800'
                : isPreferredPending
                  ? 'bg-slate-100 text-slate-700'
                  : 'bg-amber-100 text-amber-800'
            }`}
          >
            {isPreferredMatched
              ? 'Preferred matched'
              : isPreferredPending
                ? 'Preferred pending'
                : 'Preferred not matched'}
          </p>
        )}
        {showYear && (
          <p className={`mt-1 inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${yearStyle.badge}`}>
            Year {entry.year}
          </p>
        )}
        {enableRoomDropdown ? (
          <div className="mt-1">
            <label className="mb-1 block text-[10px] font-medium text-slate-500">Room</label>
            <select
              value={entry.room_id ?? ''}
              onChange={(event) => handleEntryRoomChange(entry, event.target.value)}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-700"
            >
              <option value="">Unassigned</option>
              {selectableRooms.map((room) => {
                const status = getRoomAvailabilityStatus(entry, room.id);
                const statusLabel =
                  status === 'available'
                    ? 'available'
                    : status === 'used_confirmed'
                      ? 'used (confirmed)'
                      : 'used (draft)';
                return (
                  <option key={room.id} value={room.id}>
                    {room.name} · {statusLabel}
                  </option>
                );
              })}
            </select>
          </div>
        ) : (
          showRoom && <p className="text-[11px] text-slate-600">Room: {entry.room_name ?? 'Unassigned'}</p>
        )}
        <p className="text-[11px] text-slate-500">{entry.professor_name ?? 'Unassigned professor'}</p>
        {entry.conflicts.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {entry.conflicts.map((conflict) => (
              <div key={`${entry.id}-${conflict.code}`} className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setActiveConflictPopover((current) =>
                      current?.entryId === entry.id && current?.code === conflict.code
                        ? null
                        : { entryId: entry.id, code: conflict.code },
                    )
                  }
                  className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-700"
                >
                  {conflict.code.replace('_', ' ')}
                </button>
                {activeConflictPopover?.entryId === entry.id && activeConflictPopover?.code === conflict.code && (
                  <div className="absolute left-0 top-6 z-20 w-64 rounded-md border border-slate-200 bg-white p-2 text-[11px] text-slate-700 shadow-lg">
                    {getConflictDetail(entry, conflict.code)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return <p className="mt-6 text-sm text-slate-500">Loading scheduling draft...</p>;
  }

  if (!draft) {
    return (
      <div className="mt-6 space-y-3">
        <p className="text-sm text-rose-600">{errorMessage ?? 'Draft not found.'}</p>
        <Link to="/scheduling-manager" className="text-sm font-semibold text-sky-700 hover:text-sky-800">
          Back to Scheduling Manager
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div>
        <button
          type="button"
          onClick={() => navigate('/scheduling-manager')}
          disabled={deleting}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Back
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Class Scheduling Draft</h1>
          <p className="mt-1 text-sm text-slate-600">
            {draft.program_label} · {totalEntriesCount} courses in this draft
          </p>
          <p className="mt-1 text-sm font-medium text-slate-700">
            Job name: {draft.job_name || 'N/A'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDeleteDraft}
            disabled={deleting || saving || committing || convertingToDraft}
            className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400"
          >
            {deleting ? 'Deleting...' : 'Delete Draft/Schedule'}
          </button>
          {draft.status === 'draft' ? (
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saving || deleting || committing || convertingToDraft || !hasUnsavedChanges}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400"
            >
              {saving ? 'Saving...' : 'Save Staging Drafts'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleMakeAsDraft}
              disabled={saving || deleting || committing || convertingToDraft}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400"
            >
              {convertingToDraft ? 'Converting...' : 'Make as Draft'}
            </button>
          )}
          <button
            type="button"
            onClick={handleCommitSchedule}
            disabled={
              saving ||
              deleting ||
              committing ||
              convertingToDraft ||
              unassignedEntriesCount > 0 ||
              conflictedEntriesCount > 0 ||
              (draft?.status === 'confirmed' && !hasUnsavedChanges)
            }
            className="rounded-lg bg-[#0A64BC] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0959A8] disabled:cursor-not-allowed disabled:bg-slate-300"
            title={
              unassignedEntriesCount > 0 || conflictedEntriesCount > 0
                ? 'Resolve all unassigned entries and conflicts before committing.'
                : draft?.status === 'confirmed' && !hasUnsavedChanges
                  ? 'Make and save staging changes before committing.'
                : undefined
            }
          >
            {committing ? 'Committing...' : 'Commit Schedule'}
          </button>
        </div>
      </div>

      {errorMessage && <p className="text-sm text-rose-600">{errorMessage}</p>}

      <div
        className={`rounded-lg border px-3 py-2 text-sm ${
          conflictedEntriesCount > 0
            ? 'border-rose-200 bg-rose-50 text-rose-700'
            : 'border-emerald-200 bg-emerald-50 text-emerald-700'
        }`}
      >
        {conflictedEntriesCount > 0
          ? `Conflicts: ${conflictedEntriesCount}`
          : 'No conflicts'}
      </div>

      <div className="flex justify-start">
        <Tabs
          tabs={draftViewTabs}
          activeTab={activeDraftView}
          onChange={(tab) => setActiveDraftView(tab as DraftViewTab)}
        />
      </div>

      <div className="mb-1 flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
        <div className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-white ring-1 ring-slate-300" />
          <span>Available cell</span>
        </div>
        <div className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-200 ring-1 ring-slate-300" />
          <span>Unavailable (not enabled in Timeslot Resources)</span>
        </div>
        <div className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-sky-100 ring-1 ring-sky-300" />
          <span>Drop target while dragging</span>
        </div>
        <div className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-100 ring-1 ring-emerald-300" />
          <span>Valid placement for dragged course</span>
        </div>
      </div>

      {activeDraftView === 'Time & Days' ? (
        <div className="space-y-6">
          {years.length === 0 ? (
            <Card title="Timetable board">
              <p className="text-sm text-slate-500">No schedule entries found.</p>
            </Card>
          ) : (
            years.map((year) => {
              const yearEntries = entriesByYear.get(year) ?? [];
              return (
                <Card key={`year-board-${year}`} title={`Year ${year} timetable board`}>
                  <div className="overflow-x-auto">
                    <div className="min-w-[980px] overflow-hidden rounded-xl border border-slate-200">
                      <div className="grid grid-cols-[140px_repeat(7,minmax(120px,1fr))] bg-slate-100">
                        <div className="border-b border-r border-slate-200 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          Timeslot
                        </div>
                        {daysOfWeek.map((day) => (
                          <div
                            key={`${year}-${day}-header`}
                            className="border-b border-r border-slate-200 px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-600 last:border-r-0"
                          >
                            {day}
                          </div>
                        ))}
                      </div>

                      {bucketRows.map((row) => (
                        <div key={`${year}-${row.key}`} className="grid grid-cols-[140px_repeat(7,minmax(120px,1fr))]">
                          <div className="border-r border-b border-slate-200 bg-slate-50 px-2 py-2 text-[11px] font-semibold text-slate-700">
                            {row.label}
                          </div>

                          {daysOfWeek.map((day) => {
                            const availableTimeslotId = resolveTimeslotId(day, row.key);
                            const isUnavailableCell = !availableTimeslotId;
                            const draggingEntry = draggingEntryId
                              ? localEntries.find((entry) => entry.id === draggingEntryId) ?? null
                              : null;
                            const isValidPlacementTarget =
                              !isUnavailableCell &&
                              Boolean(draggingEntry) &&
                              canPlaceEntryInTimeCell(draggingEntry as LocalEntry, day, row.key);
                            const isInvalidPlacementTarget =
                              !isUnavailableCell && Boolean(draggingEntry) && !isValidPlacementTarget;
                            const isDroppableCell = !isUnavailableCell;
                            const cellKey = `${year}-${row.key}-${day}`;
                            const entriesInCell = yearEntries.filter((entry) => {
                              if (!entry.timeslot_id) {
                                return false;
                              }
                              const resolvedDay = resolveEntryDay(entry);
                              if (resolvedDay !== day) {
                                return false;
                              }
                              return resolveEntryBucket(entry) === row.key;
                            });

                            return (
                              <div
                                key={cellKey}
                                onDragOver={(event) => {
                                  if (!isDroppableCell) {
                                    return;
                                  }
                                  event.preventDefault();
                                  setHoveredCellKey(cellKey);
                                }}
                                onDragLeave={() =>
                                  setHoveredCellKey((current) => (current === cellKey ? null : current))
                                }
                                onDrop={() => {
                                  if (!isDroppableCell) {
                                    setHoveredCellKey(null);
                                    return;
                                  }
                                  onDropToMatrixCell(day, row.key);
                                }}
                                className={`min-h-[150px] border-r border-b border-slate-200 p-2 last:border-r-0 ${
                                  hoveredCellKey === cellKey
                                    ? 'bg-sky-100 ring-1 ring-inset ring-sky-300'
                                    : isValidPlacementTarget
                                      ? 'bg-emerald-100 ring-1 ring-inset ring-emerald-400'
                                      : isInvalidPlacementTarget
                                        ? 'bg-rose-100 ring-1 ring-inset ring-rose-400'
                                      : 'bg-white'
                                }`}
                              >
                                <div className="space-y-2">
                                  {isUnavailableCell && (
                                    <p className="rounded border border-slate-300 bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500">
                                      Not enabled in Timeslot Resources
                                    </p>
                                  )}
                                  {entriesInCell.map((entry) =>
                                    renderScheduleCard(entry, { showRoom: false, enableRoomDropdown: true }),
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>

                    <div
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={onDropToUnassigned}
                      className="mt-3 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-3"
                    >
                      <p className="mb-2 text-sm font-semibold text-amber-700">Year {year} unassigned pool</p>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {yearEntries
                          .filter((entry) => !entry.room_id || !entry.timeslot_id)
                          .map((entry) => renderScheduleCard(entry, { showRoom: false, enableRoomDropdown: true }))}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      ) : (
        <Card title="Room-centric board (all years)">
          <div className="space-y-4">
            {selectedRooms.length === 0 ? (
              <p className="text-sm text-slate-500">No rooms available for room-centric view.</p>
            ) : (
              selectedRooms.map((room) => (
                <div key={room.id} className="overflow-x-auto rounded-xl border border-slate-200">
                  <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800">
                    Room {room.name}
                  </div>
                  <div className="min-w-[980px]">
                    <div className="grid grid-cols-[140px_repeat(7,minmax(120px,1fr))] bg-slate-100">
                      <div className="border-b border-r border-slate-200 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Timeslot
                      </div>
                      {daysOfWeek.map((day) => (
                        <div
                          key={`${room.id}-${day}-header`}
                          className="border-b border-r border-slate-200 px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-600 last:border-r-0"
                        >
                          {day}
                        </div>
                      ))}
                    </div>

                    {bucketRows.map((row) => (
                      <div key={`${room.id}-${row.key}`} className="grid grid-cols-[140px_repeat(7,minmax(120px,1fr))]">
                        <div className="border-r border-b border-slate-200 bg-slate-50 px-2 py-2 text-[11px] font-semibold text-slate-700">
                          {row.label}
                        </div>

                        {daysOfWeek.map((day) => {
                          const availableTimeslotId = resolveTimeslotId(day, row.key);
                          const occupiedCell = availableTimeslotId
                            ? confirmedOccupancyByRoomTimeslot.get(`${room.id}-${availableTimeslotId}`)
                            : undefined;
                          const isUnavailableCell = !availableTimeslotId || Boolean(occupiedCell);
                          const draggingEntry = draggingEntryId
                            ? localEntries.find((entry) => entry.id === draggingEntryId) ?? null
                            : null;
                          const isValidPlacementTarget =
                            !isUnavailableCell &&
                            Boolean(draggingEntry) &&
                            canPlaceEntryInRoomCell(draggingEntry as LocalEntry, day, row.key, room.id);
                          const isInvalidPlacementTarget =
                            !isUnavailableCell && Boolean(draggingEntry) && !isValidPlacementTarget;
                          const isDroppableCell = !isUnavailableCell;
                          const cellKey = `${room.id}-${row.key}-${day}`;
                          const entriesInCell = localEntries.filter((entry) => {
                            if (!entry.timeslot_id || entry.room_id !== room.id) {
                              return false;
                            }
                            const resolvedDay = resolveEntryDay(entry);
                            if (resolvedDay !== day) {
                              return false;
                            }
                            return resolveEntryBucket(entry) === row.key;
                          });

                          return (
                            <div
                              key={cellKey}
                              onDragOver={(event) => {
                                if (!isDroppableCell) {
                                  return;
                                }
                                event.preventDefault();
                                setHoveredCellKey(cellKey);
                              }}
                              onDragLeave={() =>
                                setHoveredCellKey((current) => (current === cellKey ? null : current))
                              }
                              onDrop={() => {
                                if (!isDroppableCell) {
                                  setHoveredCellKey(null);
                                  return;
                                }
                                onDropToRoomCell(day, row.key, room.id);
                              }}
                              className={`min-h-[130px] border-r border-b border-slate-200 p-2 last:border-r-0 ${
                                hoveredCellKey === cellKey
                                  ? 'bg-sky-100 ring-1 ring-inset ring-sky-300'
                                  : isValidPlacementTarget
                                    ? 'bg-emerald-100 ring-1 ring-inset ring-emerald-400'
                                    : isInvalidPlacementTarget
                                      ? 'bg-rose-100 ring-1 ring-inset ring-rose-400'
                                      : occupiedCell
                                        ? 'bg-rose-50'
                                        : 'bg-white'
                              }`}
                            >
                              <div className="space-y-2">
                                {isUnavailableCell && (
                                  <p
                                    className={`rounded px-2 py-1 text-[11px] font-medium ${
                                      occupiedCell
                                        ? 'border border-rose-200 bg-rose-50 text-rose-600'
                                        : 'border border-slate-300 bg-slate-100 text-slate-500'
                                    }`}
                                  >
                                    {occupiedCell
                                      ? `Already used by ${occupiedCell.courseCode} (${occupiedCell.courseName})`
                                      : 'Not enabled in Timeslot Resources'}
                                  </p>
                                )}
                                {entriesInCell.map((entry) => renderScheduleCard(entry, { showRoom: false, showYear: true }))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}

            <div
              onDragOver={(event) => event.preventDefault()}
              onDrop={onDropToUnassigned}
              className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-3"
            >
              <p className="mb-2 text-sm font-semibold text-amber-700">Global unassigned pool</p>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                {localEntries
                  .filter((entry) => !entry.room_id || !entry.timeslot_id)
                  .map((entry) => renderScheduleCard(entry, { showRoom: true, showYear: true }))}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
