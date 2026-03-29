import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { SelectField } from '../components/SelectField';
import {
  getLatestConfirmedClassSchedule,
  listConfirmedClassScheduleSummary,
  type ClassScheduleDraftDto,
  type ProgramConfirmedScheduleSummaryDto,
  type ScheduleClassEntryDto,
} from '../api/scheduling';
import { useResourcesCatalog } from '../contexts/ResourcesCatalogContext';

type MatrixBucket = 'morning' | 'afternoon' | 'evening';

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
const bucketOrder: MatrixBucket[] = ['morning', 'afternoon', 'evening'];

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

export function GeneratedClassSchedulesPage() {
  const navigate = useNavigate();
  const { timeslots } = useResourcesCatalog();

  const [programsWithConfirmedSchedules, setProgramsWithConfirmedSchedules] = useState<ProgramConfirmedScheduleSummaryDto[]>([]);
  const [selectedProgramValue, setSelectedProgramValue] = useState('');
  const [schedule, setSchedule] = useState<ClassScheduleDraftDto | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadSummary = async () => {
      try {
        setLoadingSummary(true);
        setErrorMessage(null);
        const summary = await listConfirmedClassScheduleSummary();
        if (cancelled) {
          return;
        }
        setProgramsWithConfirmedSchedules(summary);
        setSelectedProgramValue((current) => current || summary[0]?.program_value || '');
      } catch {
        if (!cancelled) {
          setErrorMessage('Unable to load confirmed schedule list.');
        }
      } finally {
        if (!cancelled) {
          setLoadingSummary(false);
        }
      }
    };

    void loadSummary();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadSchedule = async () => {
      if (!selectedProgramValue) {
        setSchedule(null);
        return;
      }

      try {
        setLoadingSchedule(true);
        setErrorMessage(null);
        const confirmedSchedule = await getLatestConfirmedClassSchedule(selectedProgramValue);
        if (!cancelled) {
          setSchedule(confirmedSchedule);
        }
      } catch {
        if (!cancelled) {
          setErrorMessage('Unable to load confirmed schedule for selected program.');
          setSchedule(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingSchedule(false);
        }
      }
    };

    void loadSchedule();
    return () => {
      cancelled = true;
    };
  }, [selectedProgramValue]);

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

    return map;
  }, [timeslots]);

  const bucketRows = useMemo(() => {
    const sorted = [...timeslots].sort((left, right) => left.label.localeCompare(right.label));
    const firstByBucket = new Map<MatrixBucket, string>();

    for (const slot of sorted) {
      const bucket = detectBucketFromTimeLabel(slot.label);
      if (!bucket || firstByBucket.has(bucket)) {
        continue;
      }
      firstByBucket.set(bucket, slot.label);
    }

    return bucketOrder.map((bucket) => ({ key: bucket, label: firstByBucket.get(bucket) ?? 'Not configured' }));
  }, [timeslots]);

  const entriesByYear = useMemo(() => {
    const map = new Map<number, ScheduleClassEntryDto[]>();
    for (const year of [1, 2, 3, 4]) {
      map.set(year, schedule?.entries.filter((entry) => entry.year === year) ?? []);
    }
    return map;
  }, [schedule]);

  const resolveTimeslotId = (day: string, bucket: MatrixBucket): string | null => {
    const daySlots = timeslotsByDay.get(day) ?? [];
    const matched = daySlots.find((slot) => detectBucketFromTimeLabel(slot.label) === bucket);
    return matched?.id ?? null;
  };

  const selectedProgramLabel =
    programsWithConfirmedSchedules.find((program) => program.program_value === selectedProgramValue)?.program_label ??
    'N/A';

  const handleEditSchedule = () => {
    if (!schedule) {
      return;
    }
    navigate(`/scheduling-draft?snapshotId=${schedule.id}`);
  };

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Generated Class Schedules</h1>
        <p className="mt-1 text-sm text-slate-600">View confirmed schedules by program.</p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-slate-700">Programs</p>
        {loadingSummary ? (
          <p className="text-sm text-slate-500">Loading confirmed programs...</p>
        ) : programsWithConfirmedSchedules.length === 0 ? (
          <p className="text-sm text-slate-500">No confirmed schedules found yet.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-full max-w-md">
              <SelectField
                value={selectedProgramValue}
                onChange={setSelectedProgramValue}
                options={[
                  { value: '', label: 'Select program' },
                  ...programsWithConfirmedSchedules.map((program) => ({
                    value: program.program_value,
                    label: program.program_label,
                  })),
                ]}
              />
            </div>
            <button
              type="button"
              onClick={handleEditSchedule}
              disabled={!selectedProgramValue || !schedule || loadingSchedule}
              className="ml-auto rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400"
            >
              Edit
            </button>
          </div>
        )}
      </div>

      {errorMessage && <p className="text-sm text-rose-600">{errorMessage}</p>}

      {loadingSchedule ? (
        <p className="text-sm text-slate-500">Loading confirmed schedule...</p>
      ) : schedule ? (
        <div className="space-y-6">
          <p className="text-sm font-medium text-slate-700">{selectedProgramLabel}</p>
          {[1, 2, 3, 4].map((year) => {
            const yearEntries = entriesByYear.get(year) ?? [];
            return (
              <Card key={`confirmed-year-${year}`} title={`Year ${year}`}>
                <div className="overflow-x-auto">
                  <div className="min-w-[980px] overflow-hidden rounded-xl border border-slate-200">
                    <div className="grid grid-cols-[140px_repeat(7,minmax(120px,1fr))] bg-slate-100">
                      <div className="border-b border-r border-slate-200 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Timeslot
                      </div>
                      {daysOfWeek.map((day) => (
                        <div
                          key={`confirmed-${year}-${day}`}
                          className="border-b border-r border-slate-200 px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-600 last:border-r-0"
                        >
                          {day}
                        </div>
                      ))}
                    </div>

                    {bucketRows.map((row) => (
                      <div key={`confirmed-${year}-${row.key}`} className="grid grid-cols-[140px_repeat(7,minmax(120px,1fr))]">
                        <div className="border-r border-b border-slate-200 bg-slate-50 px-2 py-2 text-[11px] font-semibold text-slate-700">
                          {row.label}
                        </div>
                        {daysOfWeek.map((day) => {
                          const slotId = resolveTimeslotId(day, row.key);
                          const entriesInCell = yearEntries.filter(
                            (entry) =>
                              entry.timeslot_id === slotId ||
                              (normalizeDayValue(entry.day) === day && detectBucketFromTimeLabel(entry.timeslot_label) === row.key),
                          );

                          return (
                            <div
                              key={`confirmed-cell-${year}-${row.key}-${day}`}
                              className="min-h-[130px] border-r border-b border-slate-200 bg-white p-2 last:border-r-0"
                            >
                              <div className="space-y-2">
                                {entriesInCell.map((entry) => (
                                  <div key={entry.id} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                                    <p className="text-xs font-semibold text-slate-900">{entry.course_code}</p>
                                    <p className="text-xs text-slate-700">{entry.course_name}</p>
                                    <p className="text-[11px] text-slate-600">Room: {entry.room_name ?? 'Unassigned'}</p>
                                    <p className="text-[11px] text-slate-500">{entry.professor_name ?? 'Unassigned professor'}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}