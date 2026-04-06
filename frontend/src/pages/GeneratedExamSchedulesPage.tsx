import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import {
  getExamScheduleDraft,
  listConfirmedExamScheduleSummary,
  type ExamScheduleDraftDto,
  type ExamScheduleSummaryDto,
  type ScheduleExamEntryDto,
} from '../api/scheduling';

const examSlotLabelByCode: Record<string, string> = {
  'morning-exam': '09:00 - 12:00',
  'afternoon-exam': '13:30 - 16:30',
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

export function GeneratedExamSchedulesPage() {
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState<ExamScheduleSummaryDto[]>([]);
  const [selectedSchedule, setSelectedSchedule] = useState<ExamScheduleDraftDto | null>(null);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState('');
  const [selectedProgramValue, setSelectedProgramValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setErrorMessage(null);
        const result = await listConfirmedExamScheduleSummary();
        if (!cancelled) {
          setSchedules(result);

          const latest = [...result].sort(
            (left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime(),
          )[0];
          setSelectedSnapshotId(latest?.id ?? '');
        }
      } catch {
        if (!cancelled) {
          setErrorMessage('Unable to load confirmed exam schedules.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadSchedule = async () => {
      if (!selectedSnapshotId) {
        setSelectedSchedule(null);
        return;
      }

      try {
        setLoadingSchedule(true);
        setErrorMessage(null);
        const result = await getExamScheduleDraft(selectedSnapshotId);
        if (!cancelled) {
          setSelectedSchedule(result);
        }
      } catch {
        if (!cancelled) {
          setErrorMessage('Unable to load selected exam schedule details.');
          setSelectedSchedule(null);
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
  }, [selectedSnapshotId]);

  const selectedSummary = useMemo(
    () => schedules.find((schedule) => schedule.id === selectedSnapshotId) ?? null,
    [schedules, selectedSnapshotId],
  );

  const scheduleOptions = useMemo(
    () =>
      [...schedules].sort((left, right) => {
        return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
      }),
    [schedules],
  );

  const programOptions = useMemo(
    () =>
      Array.from(
        new Map((selectedSchedule?.entries ?? []).map((entry) => [entry.program_value, entry.program_label])).entries(),
      ).map(([value, label]) => ({ value, label })),
    [selectedSchedule?.entries],
  );

  useEffect(() => {
    if (programOptions.length === 0) {
      if (selectedProgramValue) {
        setSelectedProgramValue('');
      }
      return;
    }

    if (!selectedProgramValue || !programOptions.some((program) => program.value === selectedProgramValue)) {
      setSelectedProgramValue(programOptions[0].value);
    }
  }, [programOptions, selectedProgramValue]);

  const selectedProgramEntries = useMemo(
    () => (selectedSchedule?.entries ?? []).filter((entry) => entry.program_value === selectedProgramValue),
    [selectedProgramValue, selectedSchedule?.entries],
  );

  const selectedProgramLabel =
    programOptions.find((program) => program.value === selectedProgramValue)?.label ?? 'Selected Program';

  const entriesByYear = useMemo(() => {
    const map = new Map<number, ScheduleExamEntryDto[]>();
    for (const year of [1, 2, 3, 4]) {
      map.set(
        year,
        selectedProgramEntries
          .filter((entry) => entry.year === year)
          .sort((left, right) => left.course_code.localeCompare(right.course_code)),
      );
    }
    return map;
  }, [selectedProgramEntries]);

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Generated Exam Schedules</h1>
        <p className="mt-1 text-sm text-slate-600">Select a confirmed schedule and view each program across 4 years.</p>
      </div>

      {errorMessage && <p className="text-sm text-rose-600">{errorMessage}</p>}

      {loading ? (
        <p className="text-sm text-slate-500">Loading confirmed exam schedules...</p>
      ) : schedules.length === 0 ? (
        <p className="text-sm text-slate-500">No confirmed exam schedules yet.</p>
      ) : (
        <div className="space-y-6">
          <Card title="Filters">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-sm text-slate-700">
                  Schedule
                  <select
                    value={selectedSnapshotId}
                    onChange={(event) => setSelectedSnapshotId(event.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                    disabled={loading || scheduleOptions.length === 0}
                  >
                    {scheduleOptions.map((schedule) => {
                      const scheduleLabel = schedule.job_name?.trim() ? schedule.job_name : `Schedule ${schedule.id.slice(0, 8)}`;
                      const programsLabel = schedule.program_values.join(', ') || 'No program';
                      const updatedLabel = new Date(schedule.updated_at).toLocaleDateString();
                      return (
                        <option key={schedule.id} value={schedule.id}>
                          {`${scheduleLabel} · ${programsLabel} · ${updatedLabel}`}
                        </option>
                      );
                    })}
                  </select>
                </label>

              <label className="text-sm text-slate-700">
                Program
                <select
                  value={selectedProgramValue}
                  onChange={(event) => setSelectedProgramValue(event.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                  disabled={loadingSchedule || programOptions.length === 0}
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

          {loadingSchedule ? (
            <p className="text-sm text-slate-500">Loading selected schedule...</p>
          ) : !selectedSchedule ? (
            <p className="text-sm text-slate-500">No schedule loaded for the selected snapshot.</p>
          ) : (
            <Card title={`Program Schedule · ${selectedProgramLabel}`}>
              <div className="space-y-2 text-sm text-slate-700">
                <p>
                  Snapshot:{' '}
                  <span className="font-medium text-slate-900">
                    {selectedSummary?.job_name?.trim() ? selectedSummary.job_name : `Schedule ${selectedSchedule.id.slice(0, 8)}`}
                  </span>
                </p>
                <p>
                  Last updated:{' '}
                  <span className="font-medium text-slate-900">{new Date(selectedSchedule.updated_at).toLocaleString()}</span>
                </p>
              </div>

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => navigate(`/exam-scheduling-draft?snapshotId=${selectedSchedule.id}&fromGenerated=1`)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Edit
                </button>
              </div>

              <div className="mt-4 space-y-6">
                {[1, 2, 3, 4].map((year) => {
                  const yearEntries = entriesByYear.get(year) ?? [];
                  return (
                    <div key={`program-year-${year}`} className="space-y-2">
                      <h3 className="text-sm font-semibold text-slate-800">Year {year}</h3>
                      {yearEntries.length === 0 ? (
                        <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                          No subjects for Year {year}.
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[860px] border-collapse text-sm">
                            <thead>
                              <tr className="bg-slate-100 text-left text-slate-700">
                                <th className="border border-slate-200 px-3 py-2">Subject</th>
                                <th className="border border-slate-200 px-3 py-2">Day</th>
                                <th className="border border-slate-200 px-3 py-2">Timeslot</th>
                                <th className="border border-slate-200 px-3 py-2">Room</th>
                              </tr>
                            </thead>
                            <tbody>
                              {yearEntries.map((entry) => (
                                <tr key={entry.id} className="align-top">
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
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
