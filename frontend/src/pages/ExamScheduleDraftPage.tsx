import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { AxiosError } from 'axios';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '../components/Card';
import { Tabs } from '../components/Tabs';
import { listRooms, type RoomDto } from '../api/resources';
import {
  buildProgramColorThemeMap,
  getProgramColorKey,
  resolveProgramColorTheme,
} from '../utils/programColorTheme';
import {
  commitExamScheduleDraft,
  deleteExamScheduleProgram,
  deleteExamScheduleDraft,
  getExamScheduleDraft,
  getExamScheduleJob,
  getLatestConfirmedClassSchedule,
  makeExamScheduleAsDraft,
  saveExamScheduleDraft,
  type ExamScheduleDraftDto,
  type ScheduleConflictDto,
  type ScheduleExamEntryDto,
} from '../api/scheduling';

type DraftViewTab = 'Calendar Board' | 'Program Year Board';

type LocalExamEntry = ScheduleExamEntryDto;

const boardYears = [1, 2, 3, 4] as const;
const draftViewTabs: DraftViewTab[] = ['Calendar Board', 'Program Year Board'];

const examSlotLabelByCode: Record<string, string> = {
  'morning-exam': '09:00 - 12:00',
  'afternoon-exam': '13:30 - 16:30',
};

const editableSlotOptions = [
  { value: 'morning-exam', label: examSlotLabelByCode['morning-exam'] },
  { value: 'afternoon-exam', label: examSlotLabelByCode['afternoon-exam'] },
];

const conflictMessageByCode: Record<string, string> = {
  unassigned: 'Missing exam date, slot, or room assignment.',
  room_overlap: 'Room has another exam at the same date and slot.',
  program_year_overlap: 'Same program and year already has an exam at this date and slot.',
  student_overlap: 'One or more students would have two exams at the same date and slot.',
  room_capacity_exceeded: 'Room capacity is smaller than expected enrollment.',
};

const yearCardStyles: Record<number, { border: string; token: string }> = {
  1: {
    border: 'border-l-sky-600',
    token: 'border-sky-300 bg-sky-100 text-sky-900',
  },
  2: {
    border: 'border-l-emerald-600',
    token: 'border-emerald-300 bg-emerald-100 text-emerald-900',
  },
  3: {
    border: 'border-l-fuchsia-600',
    token: 'border-fuchsia-300 bg-fuchsia-100 text-fuchsia-900',
  },
  4: {
    border: 'border-l-indigo-600',
    token: 'border-indigo-300 bg-indigo-100 text-indigo-900',
  },
};

function toPrettyDateLabel(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate;
  }
  return parsed.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function normalizeWeekdayToMondayBasedIndex(rawDay: string | null): number | null {
  if (!rawDay) {
    return null;
  }

  const value = rawDay.trim().toLowerCase();
  const dayMap: Record<string, number> = {
    monday: 0,
    mon: 0,
    tuesday: 1,
    tue: 1,
    tues: 1,
    wednesday: 2,
    wed: 2,
    thursday: 3,
    thu: 3,
    thur: 3,
    thurs: 3,
    friday: 4,
    fri: 4,
    saturday: 5,
    sat: 5,
    sunday: 6,
    sun: 6,
  };

  return dayMap[value] ?? null;
}

function toMondayBasedWeekdayIndexFromIsoDate(isoDate: string | null): number | null {
  if (!isoDate) {
    return null;
  }

  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) {
    return null;
  }

  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const sundayBased = parsed.getDay();
  return (sundayBased + 6) % 7;
}

function buildProgramYearCourseKey(programValue: string, programYearCourseId: string | null): string | null {
  if (!programYearCourseId) {
    return null;
  }
  return `${programValue}:${programYearCourseId}`;
}

function buildCourseYearKey(programValue: string, courseId: string, year: number): string {
  return `${programValue}:${courseId}:${year}`;
}

type PreferredWeekdayStatus = {
  label: string;
  className: string;
  title: string;
};

function readErrorMessage(error: unknown, fallback: string): string {
  const axiosError = error as AxiosError<{ detail?: string }>;
  return axiosError.response?.data?.detail ?? fallback;
}

export function ExamScheduleDraftPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const snapshotId = searchParams.get('snapshotId');
  const jobId = searchParams.get('jobId');
  const scopedProgramValue = searchParams.get('programValue')?.trim() ?? '';
  const isScopedProgramMode = Boolean(scopedProgramValue);

  const [rooms, setRooms] = useState<RoomDto[]>([]);
  const [draft, setDraft] = useState<ExamScheduleDraftDto | null>(null);
  const [localEntries, setLocalEntries] = useState<LocalExamEntry[]>([]);
  const [activeDraftView, setActiveDraftView] = useState<DraftViewTab>('Calendar Board');
  const [draggingEntryId, setDraggingEntryId] = useState<string | null>(null);
  const [hoveredCellKey, setHoveredCellKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [convertingToDraft, setConvertingToDraft] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [preferredWeekdaysByProgramYearCourseKey, setPreferredWeekdaysByProgramYearCourseKey] = useState<
    Record<string, number[]>
  >({});
  const [preferredWeekdaysByCourseYearKey, setPreferredWeekdaysByCourseYearKey] = useState<Record<string, number[]>>({});

  const [programFilter, setProgramFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const effectiveProgramFilter = isScopedProgramMode ? scopedProgramValue : programFilter;
  const dragAreaRef = useRef<HTMLDivElement | null>(null);
  const dragPointerYRef = useRef<number | null>(null);
  const dragAutoScrollFrameRef = useRef<number | null>(null);
  const dragCardHeightRef = useRef<number>(160);
  const dragCursorOffsetYRef = useRef<number>(80);
  const dragScrollDebugStateRef = useRef<'up' | 'down' | 'idle'>('idle');
  const dragScrollContainerRef = useRef<HTMLElement | null>(null);

  const resolveDragScrollContainer = (): HTMLElement | null => {
    if (dragScrollContainerRef.current) {
      return dragScrollContainerRef.current;
    }

    let current = dragAreaRef.current?.parentElement ?? null;
    while (current) {
      const style = window.getComputedStyle(current);
      const overflowY = style.overflowY;
      const isScrollable = (overflowY === 'auto' || overflowY === 'scroll') && current.scrollHeight > current.clientHeight;
      if (isScrollable) {
        dragScrollContainerRef.current = current;
        return current;
      }
      current = current.parentElement;
    }

    if (document.scrollingElement instanceof HTMLElement) {
      dragScrollContainerRef.current = document.scrollingElement;
      return document.scrollingElement;
    }

    return null;
  };

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
          await getExamScheduleJob(jobId);
        }

        const [loadedDraft, loadedRooms] = await Promise.all([getExamScheduleDraft(snapshotId), listRooms()]);
        if (isCancelled) {
          return;
        }

        setDraft(loadedDraft);
        setLocalEntries(loadedDraft.entries);
        setRooms(loadedRooms);
      } catch (error) {
        if (!isCancelled) {
          setErrorMessage(readErrorMessage(error, 'Unable to load exam scheduling draft.'));
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      isCancelled = true;
    };
  }, [jobId, snapshotId]);

  useEffect(() => {
    let isCancelled = false;

    const loadPreferredWeekdays = async () => {
      if (!draft || draft.program_values.length === 0) {
        setPreferredWeekdaysByProgramYearCourseKey({});
        setPreferredWeekdaysByCourseYearKey({});
        return;
      }

      const pycWeekdays = new Map<string, Set<number>>();
      const courseYearWeekdays = new Map<string, Set<number>>();

      await Promise.all(
        draft.program_values.map(async (programValue) => {
          try {
            const snapshot = await getLatestConfirmedClassSchedule(programValue);
            for (const classEntry of snapshot.entries) {
              const weekday = normalizeWeekdayToMondayBasedIndex(classEntry.day);
              if (weekday === null) {
                continue;
              }

              const pycKey = buildProgramYearCourseKey(programValue, classEntry.program_year_course_id);
              if (pycKey) {
                const pycSet = pycWeekdays.get(pycKey) ?? new Set<number>();
                pycSet.add(weekday);
                pycWeekdays.set(pycKey, pycSet);
              }

              const fallbackKey = buildCourseYearKey(programValue, classEntry.course_id, classEntry.year);
              const fallbackSet = courseYearWeekdays.get(fallbackKey) ?? new Set<number>();
              fallbackSet.add(weekday);
              courseYearWeekdays.set(fallbackKey, fallbackSet);
            }
          } catch {
            // Skip programs without a confirmed class schedule snapshot.
          }
        }),
      );

      if (isCancelled) {
        return;
      }

      const pycObject: Record<string, number[]> = {};
      pycWeekdays.forEach((value, key) => {
        pycObject[key] = Array.from(value).sort((left, right) => left - right);
      });

      const fallbackObject: Record<string, number[]> = {};
      courseYearWeekdays.forEach((value, key) => {
        fallbackObject[key] = Array.from(value).sort((left, right) => left - right);
      });

      setPreferredWeekdaysByProgramYearCourseKey(pycObject);
      setPreferredWeekdaysByCourseYearKey(fallbackObject);
    };

    void loadPreferredWeekdays();

    return () => {
      isCancelled = true;
    };
  }, [draft]);

  const sortedExamDates = useMemo(
    () => [...(draft?.exam_dates ?? [])].sort((left, right) => left.localeCompare(right)),
    [draft?.exam_dates],
  );

  useEffect(() => {
    if (sortedExamDates.length === 0) {
      setActiveDay(null);
      return;
    }
    if (!activeDay || !sortedExamDates.includes(activeDay)) {
      setActiveDay(sortedExamDates[0]);
    }
  }, [activeDay, sortedExamDates]);

  useEffect(() => {
    if (isScopedProgramMode) {
      setProgramFilter(scopedProgramValue);
    }
  }, [isScopedProgramMode, scopedProgramValue]);

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

    const roomIds = new Set(localEntries.map((entry) => entry.room_id).filter(Boolean));
    return rooms.filter((room) => roomIds.has(room.id));
  }, [draft, localEntries, rooms]);

  const roomById = useMemo(() => new Map(rooms.map((room) => [room.id, room])), [rooms]);

  const confirmedOccupancyByRoomDateSlot = useMemo(() => {
    const map = new Map<string, { courseCode: string; courseName: string }>();
    for (const occupancy of draft?.confirmed_occupancies ?? []) {
      const key = `${occupancy.room_id}-${occupancy.exam_date}-${occupancy.timeslot_code}`;
      if (!map.has(key)) {
        map.set(key, {
          courseCode: occupancy.course_code,
          courseName: occupancy.course_name,
        });
      }
    }
    return map;
  }, [draft?.confirmed_occupancies]);

  const baseConflictsByEntryId = useMemo(() => {
    const map = new Map<string, ScheduleConflictDto[]>();
    for (const entry of draft?.entries ?? []) {
      map.set(entry.id, entry.conflicts);
    }
    return map;
  }, [draft?.entries]);

  const entriesWithRecomputedConflicts = useMemo(() => {
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

        if (draft?.constraints.no_same_program_year_day_timeslot !== false) {
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
        message: conflictMessageByCode[code] ?? 'Conflict detected.',
      }));

      return {
        ...entry,
        conflicts: [...preserved, ...dynamic],
      };
    });
  }, [baseConflictsByEntryId, confirmedOccupancyByRoomDateSlot, draft?.constraints.no_same_program_year_day_timeslot, localEntries]);

  const filteredEntries = useMemo(() => {
    return entriesWithRecomputedConflicts.filter((entry) => {
      if (effectiveProgramFilter && entry.program_value !== effectiveProgramFilter) {
        return false;
      }
      if (yearFilter && String(entry.year) !== yearFilter) {
        return false;
      }
      return true;
    });
  }, [effectiveProgramFilter, entriesWithRecomputedConflicts, yearFilter]);

  const hiddenOtherProgramOccupancyByCell = useMemo(() => {
    const map = new Map<string, number>();

    if (!effectiveProgramFilter) {
      return map;
    }

    for (const entry of entriesWithRecomputedConflicts) {
      if (!entry.exam_date || !entry.timeslot_code || !entry.room_id) {
        continue;
      }
      if (entry.program_value === effectiveProgramFilter) {
        continue;
      }

      const key = `${entry.exam_date}-${entry.room_id}-${entry.timeslot_code}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }

    return map;
  }, [effectiveProgramFilter, entriesWithRecomputedConflicts]);

  const unassignedEntries = useMemo(
    () =>
      entriesWithRecomputedConflicts.filter(
        (entry) =>
          (!effectiveProgramFilter || entry.program_value === effectiveProgramFilter) &&
          (!entry.exam_date || !entry.timeslot_code || !entry.room_id),
      ),
    [effectiveProgramFilter, entriesWithRecomputedConflicts],
  );

  const unassignedEntriesCount = unassignedEntries.length;

  const conflictCount = useMemo(
    () =>
      entriesWithRecomputedConflicts.filter(
        (entry) => (!effectiveProgramFilter || entry.program_value === effectiveProgramFilter) && entry.conflicts.length > 0,
      ).length,
    [effectiveProgramFilter, entriesWithRecomputedConflicts],
  );

  const hasUnsavedChanges = useMemo(() => {
    if (!draft) {
      return false;
    }

    const savedById = new Map(
      draft.entries.map((entry) => [
        entry.id,
        {
          exam_date: entry.exam_date,
          timeslot_code: entry.timeslot_code,
          room_id: entry.room_id,
        },
      ]),
    );

    if (savedById.size !== localEntries.length) {
      return true;
    }

    for (const entry of localEntries) {
      const saved = savedById.get(entry.id);
      if (!saved) {
        return true;
      }
      if (
        saved.exam_date !== entry.exam_date ||
        saved.timeslot_code !== entry.timeslot_code ||
        saved.room_id !== entry.room_id
      ) {
        return true;
      }
    }

    return false;
  }, [draft, localEntries]);

  const conflictSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const entry of entriesWithRecomputedConflicts) {
      if (effectiveProgramFilter && entry.program_value !== effectiveProgramFilter) {
        continue;
      }
      const uniqueCodes = new Set(entry.conflicts.map((conflict) => conflict.code));
      for (const code of uniqueCodes) {
        counts[code] = (counts[code] ?? 0) + 1;
      }
    }
    return counts;
  }, [effectiveProgramFilter, entriesWithRecomputedConflicts]);

  const programOptions = useMemo(
    () =>
      Array.from(new Map(localEntries.map((entry) => [entry.program_value, entry.program_label])).entries()).map(
        ([value, label]) => ({ value, label }),
      ),
    [localEntries],
  );

  const programYearFilterValue = useMemo(
    () => (isScopedProgramMode ? scopedProgramValue : effectiveProgramFilter || programOptions[0]?.value || ''),
    [effectiveProgramFilter, isScopedProgramMode, programOptions, scopedProgramValue],
  );

  const selectedProgramEntries = useMemo(
    () => entriesWithRecomputedConflicts.filter((entry) => entry.program_value === programYearFilterValue),
    [entriesWithRecomputedConflicts, programYearFilterValue],
  );

  const selectedProgramLabel = useMemo(
    () => programOptions.find((program) => program.value === programYearFilterValue)?.label ?? 'Selected Program',
    [programOptions, programYearFilterValue],
  );

  const preferredWeekdayStatusByEntryId = useMemo(() => {
    const result = new Map<string, PreferredWeekdayStatus>();

    for (const entry of entriesWithRecomputedConflicts) {
      const pycKey = buildProgramYearCourseKey(entry.program_value, entry.program_year_course_id);
      const preferredByPyc = pycKey ? preferredWeekdaysByProgramYearCourseKey[pycKey] ?? [] : [];
      const fallbackKey = buildCourseYearKey(entry.program_value, entry.course_id, entry.year);
      const preferredWeekdays = preferredByPyc.length > 0 ? preferredByPyc : preferredWeekdaysByCourseYearKey[fallbackKey] ?? [];

      if (!entry.exam_date) {
        result.set(entry.id, {
          label: 'Preferred weekday: pending',
          className: 'bg-slate-100 text-slate-700',
          title: 'Exam date is not assigned yet.',
        });
        continue;
      }

      if (preferredWeekdays.length === 0) {
        result.set(entry.id, {
          label: 'Preferred weekday: no data',
          className: 'bg-slate-100 text-slate-700',
          title: 'No class weekday preference data was found for this subject.',
        });
        continue;
      }

      const assignedWeekday = toMondayBasedWeekdayIndexFromIsoDate(entry.exam_date);
      if (assignedWeekday !== null && preferredWeekdays.includes(assignedWeekday)) {
        result.set(entry.id, {
          label: 'Preferred weekday: matched',
          className: 'bg-emerald-100 text-emerald-800',
          title: 'Assigned exam date matches this subject\'s preferred weekday.',
        });
      } else {
        result.set(entry.id, {
          label: 'Preferred weekday: not matched',
          className: 'bg-amber-100 text-amber-800',
          title: 'Assigned exam date does not match this subject\'s preferred weekday.',
        });
      }
    }

    return result;
  }, [entriesWithRecomputedConflicts, preferredWeekdaysByCourseYearKey, preferredWeekdaysByProgramYearCourseKey]);

  const programStylesByValue = useMemo(() => {
    const values = localEntries.map((entry) => getProgramColorKey(entry));
    return buildProgramColorThemeMap(values);
  }, [localEntries]);

  const updateEntryPlacement = (
    entryId: string,
    patch: { exam_date: string | null; timeslot_code: string | null; room_id: string | null },
  ) => {
    setLocalEntries((prev) =>
      prev.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              exam_date: patch.exam_date,
              timeslot_code: patch.timeslot_code,
              room_id: patch.room_id,
              room_name: patch.room_id ? roomById.get(patch.room_id)?.name ?? null : null,
              manually_adjusted: true,
            }
          : entry,
      ),
    );
  };

  const getRoomAvailabilityStatus = (
    entry: LocalExamEntry,
    roomId: string,
  ): 'available' | 'used_draft' | 'used_confirmed' => {
    if (!entry.exam_date || !entry.timeslot_code) {
      return 'available';
    }

    const occupancyKey = `${roomId}-${entry.exam_date}-${entry.timeslot_code}`;
    if (confirmedOccupancyByRoomDateSlot.has(occupancyKey)) {
      return 'used_confirmed';
    }

    const usedInDraft = entriesWithRecomputedConflicts.some(
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
  };

  const canPlaceEntryInRoomCell = (
    entry: LocalExamEntry,
    examDate: string,
    slotCode: string,
    roomId: string,
  ): boolean => {
    const roomKey = `${roomId}-${examDate}-${slotCode}`;
    if (confirmedOccupancyByRoomDateSlot.has(roomKey)) {
      return false;
    }

    const occupiedInDraft = entriesWithRecomputedConflicts.some(
      (candidate) =>
        candidate.id !== entry.id &&
        candidate.room_id === roomId &&
        candidate.exam_date === examDate &&
        candidate.timeslot_code === slotCode,
    );
    if (occupiedInDraft) {
      return false;
    }

    if (draft?.constraints.no_same_program_year_day_timeslot !== false) {
      const sameCohortConflict = entriesWithRecomputedConflicts.some(
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
  };

  const stopDragAutoScroll = () => {
    if (dragAutoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(dragAutoScrollFrameRef.current);
      dragAutoScrollFrameRef.current = null;
    }
  };

  const runDragAutoScroll = () => {
    dragAutoScrollFrameRef.current = null;

    if (!draggingEntryId || dragPointerYRef.current === null) {
      return;
    }

    const scrollContainer = resolveDragScrollContainer();
    if (!scrollContainer) {
      return;
    }

    const pointerY = dragPointerYRef.current;
    const maxStep = 30;
    const minStep = 12;
    const configuredEdgeBuffer = 80;
    const edgeBuffer = Math.min(configuredEdgeBuffer, Math.max(40, Math.floor(scrollContainer.clientHeight / 2) - 1));

    const containerRect = scrollContainer.getBoundingClientRect();
    const viewportTop = containerRect.top;
    const viewportBottom = containerRect.bottom;
    const maxScrollTop = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight);
    const canScrollUp = scrollContainer.scrollTop > 0;
    const canScrollDown = scrollContainer.scrollTop < maxScrollTop;

    let scrollDelta = 0;
    let debugState: 'up' | 'down' | 'idle' = 'idle';

    const shouldScrollUp = canScrollUp && pointerY <= viewportTop + edgeBuffer;
    const shouldScrollDown = canScrollDown && pointerY >= viewportBottom - edgeBuffer;

    if (shouldScrollUp) {
      const overlap = Math.max(0, viewportTop + edgeBuffer - pointerY);
      scrollDelta = -Math.min(maxStep, Math.round(minStep + overlap * 0.12));
      debugState = 'up';
    } else if (shouldScrollDown) {
      const overlap = Math.max(0, pointerY - (viewportBottom - edgeBuffer));
      scrollDelta = Math.min(maxStep, Math.round(minStep + overlap * 0.12));
      debugState = 'down';
    }

    if (dragScrollDebugStateRef.current !== debugState) {
      dragScrollDebugStateRef.current = debugState;
      console.debug('[ExamDraftDragScroll]', {
        state: debugState,
        shouldScrollUp,
        shouldScrollDown,
        scrollDelta,
        pointerY,
        configuredEdgeBuffer,
        edgeBuffer,
        viewportTop,
        viewportBottom,
        containerScrollTop: scrollContainer.scrollTop,
        containerMaxScrollTop: maxScrollTop,
      });
    }

    if (scrollDelta !== 0) {
      scrollContainer.scrollTop = Math.max(0, Math.min(maxScrollTop, scrollContainer.scrollTop + scrollDelta));
      dragAutoScrollFrameRef.current = window.requestAnimationFrame(runDragAutoScroll);
    }
  };

  const handleDragAreaOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!draggingEntryId) {
      return;
    }

    event.preventDefault();
    dragPointerYRef.current = event.clientY;

    if (dragAutoScrollFrameRef.current === null) {
      dragAutoScrollFrameRef.current = window.requestAnimationFrame(runDragAutoScroll);
    }
  };

  useEffect(() => {
    if (!draggingEntryId) {
      stopDragAutoScroll();
      dragPointerYRef.current = null;
      dragCardHeightRef.current = 160;
      dragCursorOffsetYRef.current = 80;
      dragScrollDebugStateRef.current = 'idle';
      dragScrollContainerRef.current = null;
    }
  }, [draggingEntryId]);

  useEffect(() => {
    if (!draggingEntryId) {
      return;
    }

    const handleWindowDragOver = (event: DragEvent) => {
      dragPointerYRef.current = event.clientY;
      if (dragAutoScrollFrameRef.current === null) {
        dragAutoScrollFrameRef.current = window.requestAnimationFrame(runDragAutoScroll);
      }
    };

    window.addEventListener('dragover', handleWindowDragOver);
    return () => {
      window.removeEventListener('dragover', handleWindowDragOver);
    };
  }, [draggingEntryId]);

  useEffect(() => {
    return () => {
      stopDragAutoScroll();
    };
  }, []);

  const onDropToRoomCell = (examDate: string, slotCode: string, roomId: string) => {
    if (!draggingEntryId) {
      return;
    }

    const draggingEntry = entriesWithRecomputedConflicts.find((entry) => entry.id === draggingEntryId);
    if (!draggingEntry) {
      setDraggingEntryId(null);
      setHoveredCellKey(null);
      stopDragAutoScroll();
      return;
    }

    if (!canPlaceEntryInRoomCell(draggingEntry, examDate, slotCode, roomId)) {
      setDraggingEntryId(null);
      setHoveredCellKey(null);
      stopDragAutoScroll();
      return;
    }

    updateEntryPlacement(draggingEntryId, {
      exam_date: examDate,
      timeslot_code: slotCode,
      room_id: roomId,
    });
    setDraggingEntryId(null);
    setHoveredCellKey(null);
    setErrorMessage(null);
    stopDragAutoScroll();
  };

  const onDropToUnassigned = () => {
    if (!draggingEntryId) {
      return;
    }

    updateEntryPlacement(draggingEntryId, {
      exam_date: null,
      timeslot_code: null,
      room_id: null,
    });
    setDraggingEntryId(null);
    setHoveredCellKey(null);
    stopDragAutoScroll();
  };

  const handleSaveDraft = async () => {
    if (!snapshotId) {
      return;
    }

    try {
      setSaving(true);
      const saved = await saveExamScheduleDraft(snapshotId, {
        entries: localEntries.map((entry) => ({
          id: entry.id,
          exam_date: entry.exam_date,
          timeslot_code: entry.timeslot_code,
          room_id: entry.room_id,
        })),
      });

      setDraft(saved);
      setLocalEntries(saved.entries);
      setErrorMessage(null);
      window.alert('Staging drafts saved successfully.');
    } catch (error) {
      setErrorMessage(readErrorMessage(error, 'Failed to save staging exam draft. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const handleCommitSchedule = async () => {
    if (!snapshotId) {
      return;
    }

    try {
      setCommitting(true);
      const saved = await commitExamScheduleDraft(snapshotId, {
        entries: localEntries.map((entry) => ({
          id: entry.id,
          exam_date: entry.exam_date,
          timeslot_code: entry.timeslot_code,
          room_id: entry.room_id,
        })),
      });

      setDraft(saved);
      setLocalEntries(saved.entries);
      setErrorMessage(null);
      navigate('/generated-exam-schedules');
    } catch (error) {
      setErrorMessage(readErrorMessage(error, 'Failed to commit exam schedule. Resolve conflicts and try again.'));
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
      const updated = await makeExamScheduleAsDraft(snapshotId);
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

    const confirmed = window.confirm(
      isScopedProgramMode
        ? `Delete exam schedule for ${scopedProgramValue} from this snapshot?`
        : 'Delete this exam draft?',
    );
    if (!confirmed) {
      return;
    }

    try {
      setDeleting(true);
      if (isScopedProgramMode) {
        await deleteExamScheduleProgram(snapshotId, scopedProgramValue);
        navigate('/generated-exam-schedules');
      } else {
        await deleteExamScheduleDraft(snapshotId);
        navigate('/scheduling-manager');
      }
    } catch (error) {
      setErrorMessage(readErrorMessage(error, 'Failed to delete exam draft.'));
    } finally {
      setDeleting(false);
    }
  };

  const renderExamCard = (
    entry: LocalExamEntry,
    options: { showPlacementInfo?: boolean; enableRoomDropdown?: boolean; enableDayDropdown?: boolean } = {},
  ) => {
    const { showPlacementInfo = true, enableRoomDropdown = true, enableDayDropdown = true } = options;
    const programColorKey = getProgramColorKey(entry);
    const programStyle = resolveProgramColorTheme(programStylesByValue, programColorKey);
    const yearStyle = yearCardStyles[entry.year] ?? {
      border: 'border-l-slate-500',
      token: 'border-slate-300 bg-slate-100 text-slate-800',
    };
    const isAssigned = Boolean(entry.exam_date && entry.timeslot_code && entry.room_id);
    const preferredWeekdayStatus = preferredWeekdayStatusByEntryId.get(entry.id) ?? {
      label: 'Preferred weekday: no data',
      className: 'bg-slate-100 text-slate-700',
      title: 'No class weekday preference data was found for this subject.',
    };

    return (
      <div
        key={entry.id}
        draggable
        onDragStart={(event) => {
          const cardRect = event.currentTarget.getBoundingClientRect();
          dragPointerYRef.current = event.clientY;
          dragCardHeightRef.current = cardRect.height;
          const rawOffset = event.clientY - cardRect.top;
          dragCursorOffsetYRef.current = Math.max(0, Math.min(cardRect.height, rawOffset));
          setDraggingEntryId(entry.id);
        }}
        onDrag={(event) => {
          if (event.clientY !== 0) {
            dragPointerYRef.current = event.clientY;
            if (dragAutoScrollFrameRef.current === null) {
              dragAutoScrollFrameRef.current = window.requestAnimationFrame(runDragAutoScroll);
            }
          }
        }}
        onDragEnd={() => {
          setDraggingEntryId(null);
          dragCardHeightRef.current = 160;
          dragCursorOffsetYRef.current = 80;
          dragScrollDebugStateRef.current = 'idle';
          stopDragAutoScroll();
        }}
        className={`cursor-move rounded-md border border-slate-200 border-l-4 p-3 ${yearStyle.border}`}
        style={{ backgroundColor: programStyle.cardBackground }}
      >
        <div className="mb-2.5 flex items-start justify-between gap-3">
          <div className="min-w-0 pr-2">
            <div className="flex items-start gap-2.5">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-black ${yearStyle.token}`}
                title={`Year ${entry.year}`}
              >
                {entry.year}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-extrabold leading-tight text-slate-900">{entry.course_name}</p>
                <p className="mt-1 text-[11px] font-semibold tracking-wide text-slate-600">{entry.course_code}</p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              if (!isAssigned) {
                return;
              }
              updateEntryPlacement(entry.id, {
                exam_date: null,
                timeslot_code: null,
                room_id: null,
              });
            }}
            disabled={!isAssigned}
            className="shrink-0 rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
            title="Unassign this exam"
          >
            Unassign
          </button>
        </div>

        <div className="mb-2">
          <span
            className="inline-flex max-w-full rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{
              backgroundColor: programStyle.tagBackground,
              color: programStyle.tagText,
            }}
          >
            <span className="truncate">{entry.program_label}</span>
          </span>
        </div>

        {showPlacementInfo && (
          <p className="mt-2 text-[11px] text-slate-600">
            {entry.exam_date ? toPrettyDateLabel(entry.exam_date) : 'Unassigned date'} ·{' '}
            {entry.timeslot_code ? examSlotLabelByCode[entry.timeslot_code] ?? entry.timeslot_code : 'Unassigned slot'}
          </p>
        )}

        <div className="mt-2">
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${preferredWeekdayStatus.className}`}
            title={preferredWeekdayStatus.title}
          >
            {preferredWeekdayStatus.label}
          </span>
        </div>

        {(enableDayDropdown || enableRoomDropdown) && (
          <div
            className={`mt-2.5 grid gap-2 ${
              enableDayDropdown && enableRoomDropdown ? 'grid-cols-2' : 'grid-cols-1'
            }`}
          >
            {enableDayDropdown && (
              <div>
                <label className="mb-1 block text-[10px] font-medium text-slate-500">Day</label>
                <select
                  value={entry.exam_date ?? ''}
                  onChange={(event) =>
                    updateEntryPlacement(entry.id, {
                      exam_date: event.target.value || null,
                      timeslot_code: entry.timeslot_code,
                      room_id: entry.room_id,
                    })
                  }
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                  className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-700"
                >
                  <option value="">Unassigned</option>
                  {sortedExamDates.map((examDate) => (
                    <option key={examDate} value={examDate}>
                      {toPrettyDateLabel(examDate)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {enableRoomDropdown && (
              <div>
                <label className="mb-1 block text-[10px] font-medium text-slate-500">Room</label>
                <select
                  value={entry.room_id ?? ''}
                  onChange={(event) =>
                    updateEntryPlacement(entry.id, {
                      exam_date: entry.exam_date,
                      timeslot_code: entry.timeslot_code,
                      room_id: event.target.value || null,
                    })
                  }
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                  className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-700"
                >
                  <option value="">Unassigned</option>
                  {selectedRooms.map((room) => {
                    const status = getRoomAvailabilityStatus(entry, room.id);
                    const statusLabel =
                      status === 'available' ? 'available' : status === 'used_confirmed' ? 'used (confirmed)' : 'used (draft)';
                    return (
                      <option key={room.id} value={room.id}>
                        {room.name} · {statusLabel}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
          </div>
        )}

        {entry.conflicts.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {entry.conflicts.map((conflict) => (
              <span
                key={`${entry.id}-${conflict.code}`}
                className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-700"
                title={conflict.message ?? conflictMessageByCode[conflict.code] ?? 'Conflict detected'}
              >
                {conflict.code.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return <p className="mt-6 text-sm text-slate-500">Loading exam scheduling draft...</p>;
  }

  if (!draft) {
    return (
      <div className="mt-6 space-y-3">
        <p className="text-sm text-rose-600">{errorMessage ?? 'Exam draft not found.'}</p>
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
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Exam Scheduling Draft</h1>
          <p className="mt-1 text-sm text-slate-600">
            {(isScopedProgramMode ? scopedProgramValue : draft.program_values.join(', ')) || 'N/A'} ·{' '}
            {(isScopedProgramMode
              ? entriesWithRecomputedConflicts.filter((entry) => entry.program_value === scopedProgramValue).length
              : entriesWithRecomputedConflicts.length)} exams in this draft
          </p>
          <p className="mt-1 text-sm font-medium text-slate-700">
            Job name: {draft.job_name ?? `Exam Draft ${draft.id.slice(0, 8)}`}
          </p>
        </div>
        <div className="ml-auto flex items-center justify-end gap-2">
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
              conflictCount > 0 ||
              (draft?.status === 'confirmed' && !hasUnsavedChanges)
            }
            className="rounded-lg bg-[#0A64BC] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0959A8] disabled:cursor-not-allowed disabled:bg-slate-300"
            title={
              unassignedEntriesCount > 0 || conflictCount > 0
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
          conflictCount > 0 ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
        }`}
      >
        {conflictCount > 0 ? `Conflicts: ${conflictCount}` : 'No conflicts'}
      </div>

      {Object.keys(conflictSummary).length > 0 && (
        <Card title="Conflict Summary">
          <div className="flex flex-wrap gap-2">
            {Object.entries(conflictSummary)
              .sort((left, right) => right[1] - left[1])
              .map(([code, count]) => (
                <span key={code} className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
                  {code.replace(/_/g, ' ')}: {count}
                </span>
              ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Student overlap and room capacity are always revalidated by backend during Commit Schedule.
          </p>
        </Card>
      )}

      <div className="flex justify-start">
        <Tabs tabs={draftViewTabs} activeTab={activeDraftView} onChange={(tab) => setActiveDraftView(tab as DraftViewTab)} />
      </div>

      {activeDraftView === 'Calendar Board' ? (
      <>
      <Card title="Calendar Filters">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-sm text-slate-700">
            Program
            <select
              value={programFilter}
              onChange={(event) => setProgramFilter(event.target.value)}
              disabled={isScopedProgramMode}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
            >
              {!isScopedProgramMode && <option value="">All programs</option>}
              {programOptions.map((program) => (
                <option key={program.value} value={program.value}>
                  {program.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-slate-700">
            Year
            <select
              value={yearFilter}
              onChange={(event) => setYearFilter(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
            >
              <option value="">All years</option>
              <option value="1">Year 1</option>
              <option value="2">Year 2</option>
              <option value="3">Year 3</option>
              <option value="4">Year 4</option>
            </select>
          </label>
        </div>
      </Card>

      <Card title="Exam Calendar Board">
        {sortedExamDates.length === 0 ? (
          <p className="text-sm text-slate-500">No exam dates configured in this draft.</p>
        ) : (
          <div className="space-y-3" ref={dragAreaRef} onDragOver={handleDragAreaOver}>
            <div className="overflow-x-auto">
              <div className="flex min-w-max gap-2">
                {sortedExamDates.map((examDate) => (
                  <button
                    key={examDate}
                    type="button"
                    onClick={() => setActiveDay(examDate)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                      activeDay === examDate
                        ? 'border-sky-300 bg-sky-100 text-sky-800'
                        : 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {toPrettyDateLabel(examDate)}
                  </button>
                ))}
              </div>
            </div>

            {activeDay && (
              <div className="overflow-x-auto">
                {selectedRooms.length === 0 ? (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                    No rooms are available in this draft for board view.
                  </p>
                ) : (
                  <div
                    className="grid min-w-[860px] border border-slate-200"
                    style={{ gridTemplateColumns: `220px repeat(${editableSlotOptions.length}, minmax(260px, 1fr))` }}
                  >
                    <div className="border-r border-b border-slate-200 bg-slate-100 px-2 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Room
                    </div>
                    {editableSlotOptions.map((slot) => (
                      <div
                        key={`slot-header-${slot.value}`}
                        className="border-r border-b border-slate-200 bg-slate-100 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-600 last:border-r-0"
                      >
                        {slot.label}
                      </div>
                    ))}

                    {selectedRooms.map((room) => (
                      <Fragment key={room.id}>
                        <div className="border-r border-b border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700">
                          {room.name}
                          <p className="text-[10px] font-medium text-slate-500">Capacity {room.capacity}</p>
                        </div>

                        {editableSlotOptions.map((slot) => {
                          const cellKey = `${activeDay}-${room.id}-${slot.value}`;
                          const draggingEntry = draggingEntryId
                            ? entriesWithRecomputedConflicts.find((entry) => entry.id === draggingEntryId) ?? null
                            : null;

                          const isValidPlacementTarget = Boolean(
                            draggingEntry && canPlaceEntryInRoomCell(draggingEntry, activeDay, slot.value, room.id),
                          );

                          const entriesInCell = filteredEntries.filter(
                            (entry) =>
                              entry.exam_date === activeDay &&
                              entry.timeslot_code === slot.value &&
                              entry.room_id === room.id,
                          );

                          const confirmedBlocking = confirmedOccupancyByRoomDateSlot.get(
                            `${room.id}-${activeDay}-${slot.value}`,
                          );

                          const hiddenOtherProgramCount = hiddenOtherProgramOccupancyByCell.get(cellKey) ?? 0;

                          return (
                            <div
                              key={cellKey}
                              onDragOver={(event) => {
                                if (!isValidPlacementTarget && draggingEntry) {
                                  return;
                                }
                                event.preventDefault();
                                setHoveredCellKey(cellKey);
                              }}
                              onDragLeave={() =>
                                setHoveredCellKey((current) => (current === cellKey ? null : current))
                              }
                              onDrop={() => {
                                if (draggingEntry && !isValidPlacementTarget) {
                                  setHoveredCellKey(null);
                                  return;
                                }
                                onDropToRoomCell(activeDay, slot.value, room.id);
                              }}
                              className={`min-h-[170px] border-r border-b border-slate-200 p-2 last:border-r-0 ${
                                confirmedBlocking ? 'bg-rose-50' : 'bg-white'
                              } ${
                                hoveredCellKey === cellKey
                                  ? 'bg-sky-50 ring-1 ring-inset ring-sky-300'
                                  : isValidPlacementTarget
                                    ? 'bg-emerald-50 ring-1 ring-inset ring-emerald-300'
                                    : ''
                              }`}
                            >
                              {hiddenOtherProgramCount > 0 && (
                                <div
                                  className="mb-1 inline-flex rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-500"
                                  title="This cell is occupied by hidden courses from other programs."
                                >
                                  Other program allocated ({hiddenOtherProgramCount})
                                </div>
                              )}
                              {confirmedBlocking && (
                                <div className="mb-1 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-600">
                                  Already used by {confirmedBlocking.courseCode} ({confirmedBlocking.courseName})
                                </div>
                              )}
                              <div className="space-y-2">
                                {entriesInCell.map((entry) =>
                                  renderExamCard(entry, { showPlacementInfo: false, enableRoomDropdown: true }),
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </Fragment>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div
              onDragOver={(event) => event.preventDefault()}
              onDrop={onDropToUnassigned}
              className="min-h-[220px] rounded-xl border border-dashed border-amber-300 bg-amber-50 p-3"
            >
              <p className="mb-2 text-sm font-semibold text-amber-700">Unassigned pool</p>
              <div className="grid min-h-[170px] grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                {unassignedEntries.map((entry) =>
                  renderExamCard(entry, { showPlacementInfo: true, enableRoomDropdown: true }),
                )}
              </div>
            </div>
          </div>
        )}
      </Card>
      </>
      ) : (
      <>
        <Card title="Program Year Board Filters">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-sm text-slate-700">
              Program
              <select
                value={programYearFilterValue}
                onChange={(event) => setProgramFilter(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                disabled={programOptions.length === 0}
              >
                {programOptions.map((program) => (
                  <option key={program.value} value={program.value}>
                    {program.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </Card>

        <Card title={`Program Year Board · ${selectedProgramLabel}`}>
          {!programYearFilterValue ? (
            <p className="text-sm text-slate-500">No program available to display.</p>
          ) : (
            <div className="space-y-5">
              {boardYears.map((year) => {
                const yearEntries = selectedProgramEntries
                  .filter((entry) => entry.year === year)
                  .sort((left, right) => left.course_code.localeCompare(right.course_code));

                return (
                  <div key={year} className="space-y-2">
                    <h3 className="text-sm font-semibold text-slate-800">Year {year}</h3>
                    {yearEntries.length === 0 ? (
                      <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                        No subjects for Year {year} in this program.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[880px] border-collapse text-sm">
                          <thead>
                            <tr className="bg-slate-100 text-left text-slate-700">
                              <th className="border border-slate-200 px-3 py-2">Subject</th>
                              <th className="border border-slate-200 px-3 py-2">Day</th>
                              <th className="border border-slate-200 px-3 py-2">Timeslot</th>
                              <th className="border border-slate-200 px-3 py-2">Room</th>
                              <th className="border border-slate-200 px-3 py-2">Preferred Weekday</th>
                            </tr>
                          </thead>
                          <tbody>
                            {yearEntries.map((entry) => (
                              <tr key={`year-${year}-${entry.id}`} className="align-top">
                                <td className="border border-slate-200 px-3 py-2">
                                  <p className="font-semibold text-slate-900">{entry.course_code}</p>
                                  <p className="text-xs text-slate-600">{entry.course_name}</p>
                                </td>
                                <td className="border border-slate-200 px-3 py-2 text-slate-700">
                                  {entry.exam_date ? toPrettyDateLabel(entry.exam_date) : 'Unassigned'}
                                </td>
                                <td className="border border-slate-200 px-3 py-2 text-slate-700">
                                  {entry.timeslot_code ? examSlotLabelByCode[entry.timeslot_code] ?? entry.timeslot_code : 'Unassigned'}
                                </td>
                                <td className="border border-slate-200 px-3 py-2 text-slate-700">
                                  {entry.room_name ?? 'Unassigned'}
                                </td>
                                <td className="border border-slate-200 px-3 py-2 text-slate-700">
                                  <span
                                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                                      preferredWeekdayStatusByEntryId.get(entry.id)?.className ?? 'bg-slate-100 text-slate-700'
                                    }`}
                                    title={
                                      preferredWeekdayStatusByEntryId.get(entry.id)?.title ??
                                      'No class weekday preference data was found for this subject.'
                                    }
                                  >
                                    {preferredWeekdayStatusByEntryId.get(entry.id)?.label ?? 'Preferred weekday: no data'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </>
      )}
    </div>
  );
}
