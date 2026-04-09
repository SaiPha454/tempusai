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
} from '../api/scheduling';
import { useResourcesCatalog } from '../contexts/ResourcesCatalogContext';
import {
  buildAllTimeslotsSorted,
  buildBucketRows,
  canPlaceEntryInRoomCell as canPlaceEntryInRoomCellByRules,
  canPlaceEntryInTimeCell as canPlaceEntryInTimeCellByRules,
  buildTimeslotsByDay,
  getRoomCellConflictCodes,
  getClassConflictDetail,
  getRoomCellUnavailableMessages as getRoomCellUnavailableMessagesByRules,
  getRoomAvailabilityStatus,
  getTimeCellUnavailableMessages as getTimeCellUnavailableMessagesByRules,
  recomputeClassDraftConflicts,
  resolveEntryBucket as resolveEntryBucketFromMatrix,
  resolveEntryDay as resolveEntryDayFromMatrix,
  resolveTimeslotIdByDayBucket,
} from '../services/scheduling';
import { DAYS_OF_WEEK, type MatrixBucket } from '../types/scheduling';
import {
  readPreferredTimeslotsBySnapshot,
} from '../utils/scheduling';

type LocalEntry = ScheduleClassEntryDto;

type DraftViewTab = 'Time & Days' | 'Room-Centric';

const daysOfWeek = DAYS_OF_WEEK;
const draftViewTabs: DraftViewTab[] = ['Time & Days', 'Room-Centric'];
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


function readErrorMessage(error: unknown, fallback: string): string {
  const axiosError = error as AxiosError<{ detail?: string }>;
  return axiosError.response?.data?.detail ?? fallback;
}

export function ScheduleDraftPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const snapshotId = searchParams.get('snapshotId');
  const jobId = searchParams.get('jobId');

  const { timeslots, professors } = useResourcesCatalog();

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
    () => readPreferredTimeslotsBySnapshot(snapshotId),
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
  const professorById = useMemo(() => new Map(professors.map((professor) => [professor.id, professor])), [professors]);

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
    return buildTimeslotsByDay(timeslots);
  }, [timeslots]);

  const allTimeslotsSorted = useMemo(() => {
    return buildAllTimeslotsSorted(timeslots);
  }, [timeslots]);

  const bucketRows = useMemo(() => {
    return buildBucketRows(allTimeslotsSorted);
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

  const recomputeLocalConflicts = (entries: LocalEntry[]): LocalEntry[] =>
    recomputeClassDraftConflicts({
      entries,
      settings: {
        roomCapacityCheck: draft?.constraints.roomCapacityCheck !== false,
        professorNoOverlap: draft?.constraints.professorNoOverlap !== false,
        studentGroupsNoOverlap: draft?.constraints.studentGroupsNoOverlap !== false,
      },
      roomById,
      confirmedOccupancyByRoomTimeslot,
      confirmedOccupancyByProfessorTimeslot,
    });

  const resolveTimeslotId = (day: string, bucket: MatrixBucket): string | null => {
    const normalizedDay = daysOfWeek.find((candidateDay) => candidateDay === day);
    if (!normalizedDay) {
      return null;
    }
    return resolveTimeslotIdByDayBucket(timeslotsByDay, normalizedDay, bucket);
  };

  const resolveEntryBucket = (entry: LocalEntry): MatrixBucket | null => {
    return resolveEntryBucketFromMatrix(entry, timeslotById, timeslotsByDay);
  };

  const resolveEntryDay = (entry: LocalEntry): (typeof daysOfWeek)[number] | null => {
    return resolveEntryDayFromMatrix(entry, timeslotById);
  };

  const getConflictDetail = (entry: LocalEntry, code: string): string =>
    getClassConflictDetail({
      entry,
      code,
      localEntries,
      roomById,
      confirmedOccupancyByProfessorTimeslot,
    });

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

  const buildCandidateRoomIds = (entry: LocalEntry): string[] => {
    const preferredRoomIds = [entry.room_id, ...selectableRooms.map((room) => room.id)].filter(
      (roomId): roomId is string => Boolean(roomId),
    );
    return Array.from(new Set(preferredRoomIds));
  };

  const canPlaceEntryInRoomCell = (entry: LocalEntry, day: string, bucket: MatrixBucket, roomId: string): boolean => {
    const targetTimeslotId = resolveTimeslotId(day, bucket);
    if (!targetTimeslotId) {
      return false;
    }

    return canPlaceEntryInRoomCellByRules({
      entry,
      targetTimeslotId,
      roomId,
      localEntries,
      settings: placementSettings,
      roomById,
      confirmedOccupancyByRoomTimeslot,
      confirmedOccupancyByProfessorTimeslot,
      professorById,
    });
  };

  const getTimeCellUnavailableMessages = (entry: LocalEntry, day: string, bucket: MatrixBucket): string[] => {
    const targetTimeslotId = resolveTimeslotId(day, bucket);
    if (!targetTimeslotId) {
      return ['Not enabled in Timeslot Resources'];
    }

    return getTimeCellUnavailableMessagesByRules({
      entry,
      targetTimeslotId,
      candidateRoomIds: buildCandidateRoomIds(entry),
      localEntries,
      settings: placementSettings,
      roomById,
      confirmedOccupancyByRoomTimeslot,
      confirmedOccupancyByProfessorTimeslot,
      professorById,
    });
  };

  const getRoomCellUnavailableMessages = (
    entry: LocalEntry,
    day: string,
    bucket: MatrixBucket,
    roomId: string,
  ): string[] => {
    const targetTimeslotId = resolveTimeslotId(day, bucket);
    if (!targetTimeslotId) {
      return ['Not enabled in Timeslot Resources'];
    }

    return getRoomCellUnavailableMessagesByRules({
      entry,
      targetTimeslotId,
      roomId,
      localEntries,
      settings: placementSettings,
      roomById,
      confirmedOccupancyByRoomTimeslot,
      confirmedOccupancyByProfessorTimeslot,
      professorById,
    });
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
    const targetTimeslotId = resolveTimeslotId(day, bucket);
    if (!targetTimeslotId) {
      return false;
    }

    // Green hint means at least one room can satisfy all hard constraints at this time cell.
    return canPlaceEntryInTimeCellByRules({
      entry,
      targetTimeslotId,
      candidateRoomIds: buildCandidateRoomIds(entry),
      localEntries,
      settings: placementSettings,
      roomById,
      confirmedOccupancyByRoomTimeslot,
      confirmedOccupancyByProfessorTimeslot,
      professorById,
    });
  };

  const findValidRoomIdForTimeCell = (entry: LocalEntry, day: string, bucket: MatrixBucket): string | null => {
    const uniqueRoomIds = buildCandidateRoomIds(entry);
    const strictlyValidRoomId = uniqueRoomIds.find((roomId) => canPlaceEntryInRoomCell(entry, day, bucket, roomId));
    if (strictlyValidRoomId) {
      return strictlyValidRoomId;
    }

    // If no fully conflict-free room exists, allow staging only when professor availability hard constraint still holds.
    const targetTimeslotId = resolveTimeslotId(day, bucket);
    if (!targetTimeslotId) {
      return null;
    }
    const draftStageRoomId = uniqueRoomIds.find((roomId) => {
      if (!canDropEntryInRoomCell(day, bucket, roomId)) {
        return false;
      }
      return !getRoomCellConflictCodes({
        entry,
        targetTimeslotId,
        roomId,
        localEntries,
        settings: placementSettings,
        roomById,
        confirmedOccupancyByRoomTimeslot,
        confirmedOccupancyByProfessorTimeslot,
        professorById,
      }).includes('professor_unavailable');
    });
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

  const placementSettings = useMemo(
    () => ({
      roomCapacityCheck: draft?.constraints.roomCapacityCheck !== false,
      professorNoOverlap: draft?.constraints.professorNoOverlap !== false,
      studentGroupsNoOverlap: draft?.constraints.studentGroupsNoOverlap !== false,
    }),
    [
      draft?.constraints.professorNoOverlap,
      draft?.constraints.roomCapacityCheck,
      draft?.constraints.studentGroupsNoOverlap,
    ],
  );

  const getEntryRoomAvailabilityStatus = (entry: LocalEntry, roomId: string) =>
    getRoomAvailabilityStatus({
      entry,
      roomId,
      localEntries,
      confirmedOccupancyByRoomTimeslot,
    });

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
        onDragStart={(event) => {
          event.dataTransfer?.setData('text/plain', entry.id);
          if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
          }
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
                const status = getEntryRoomAvailabilityStatus(entry, room.id);
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
                            const cellKey = `${year}-${row.key}-${day}`;
                            const invalidPlacementMessages =
                              hoveredCellKey === cellKey &&
                              !isUnavailableCell &&
                              draggingEntry &&
                              isInvalidPlacementTarget
                                ? getTimeCellUnavailableMessages(draggingEntry as LocalEntry, day, row.key)
                                : [];
                            const isDroppableCell = !isUnavailableCell;
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
                                  {invalidPlacementMessages.length > 0 && (
                                    <div className="pointer-events-none space-y-1 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-700">
                                      {invalidPlacementMessages.map((message) => (
                                        <p key={`${cellKey}-${message}`}>{message}</p>
                                      ))}
                                    </div>
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
                          const cellKey = `${room.id}-${row.key}-${day}`;
                          const invalidPlacementMessages =
                            hoveredCellKey === cellKey &&
                            !isUnavailableCell &&
                            draggingEntry &&
                            isInvalidPlacementTarget
                              ? getRoomCellUnavailableMessages(draggingEntry as LocalEntry, day, row.key, room.id)
                              : [];
                          const isDroppableCell = !isUnavailableCell;
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
                                {invalidPlacementMessages.length > 0 && (
                                  <div className="pointer-events-none space-y-1 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-700">
                                    {invalidPlacementMessages.map((message) => (
                                      <p key={`${cellKey}-${message}`}>{message}</p>
                                    ))}
                                  </div>
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
