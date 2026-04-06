import { CalendarDays } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/Card';
import { SelectField } from '../../components/SelectField';
import { MultiSelectDropdown } from '../../components/MultiSelectDropdown';
import { RoomSelector } from '../../components/RoomSelector';
import { SelectedChipSummary } from '../../components/SelectedChipSummary';
import { Tabs } from '../../components/Tabs';

const ESTIMATED_GENERATION_SECONDS = 45;
const curriculumTabs = ['Program Curriculum', 'Professor Availability'] as const;

type SelectOption = {
  value: string;
  label: string;
};

type ProgramCourse = {
  id: string;
  code: string;
  name: string;
  professorId: string | null;
  professorName: string;
};

type ProgramYearPlan = {
  year: string;
  courses: ProgramCourse[];
};

type ScheduleClassTabProps = {
  classJobName: string;
  setClassJobName: React.Dispatch<React.SetStateAction<string>>;
  selectedStudyProgram: string;
  setSelectedStudyProgram: (value: string) => void;
  studyProgramOptions: SelectOption[];
  studyProgramOptionColorByValue?: Record<string, string>;
  selectedProgramCourseCount: number;
  selectedProgramYearPlans: ProgramYearPlan[];
  getPreferredTimeslotOptions: (professorId: string) => Array<{ value: string; label: string }>;
  preferredTimeslotByCourseId: Record<string, string[]>;
  setPreferredTimeslotByCourseId: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  roomSearch: string;
  setRoomSearch: React.Dispatch<React.SetStateAction<string>>;
  filteredRooms: string[];
  selectedRooms: string[];
  toggleRoom: (room: string) => void;
  roomCapacityMap: Record<string, number>;
  removeRoom: (room: string) => void;
  isGenerating: boolean;
  onGenerate: () => void;
};

export function ScheduleClassTab({
  classJobName,
  setClassJobName,
  selectedStudyProgram,
  setSelectedStudyProgram,
  studyProgramOptions,
  studyProgramOptionColorByValue,
  selectedProgramCourseCount,
  selectedProgramYearPlans,
  getPreferredTimeslotOptions,
  preferredTimeslotByCourseId,
  setPreferredTimeslotByCourseId,
  roomSearch,
  setRoomSearch,
  filteredRooms,
  selectedRooms,
  toggleRoom,
  roomCapacityMap,
  removeRoom,
  isGenerating,
  onGenerate,
}: ScheduleClassTabProps) {
  const [remainingSeconds, setRemainingSeconds] = useState(ESTIMATED_GENERATION_SECONDS);
  const [activeCurriculumTab, setActiveCurriculumTab] = useState<(typeof curriculumTabs)[number]>('Program Curriculum');

  useEffect(() => {
    if (!isGenerating) {
      setRemainingSeconds(ESTIMATED_GENERATION_SECONDS);
      return;
    }

    const intervalId = window.setInterval(() => {
      setRemainingSeconds((previous) => Math.max(0, previous - 1));
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isGenerating]);

  const progressWidth = `${Math.round((remainingSeconds / ESTIMATED_GENERATION_SECONDS) * 100)}%`;

  const professorPlans = useMemo(() => {
    const grouped = new Map<
      string,
      {
        professorId: string;
        professorName: string;
        courses: Array<{ id: string; year: string; code: string; name: string }>;
        slotOptions: Array<{ value: string; label: string }>;
      }
    >();

    for (const yearPlan of selectedProgramYearPlans) {
      for (const course of yearPlan.courses) {
        const professorId = course.professorId?.trim();
        const professorName = course.professorName?.trim();
        if (!professorName) {
          continue;
        }

        if (!professorId) {
          continue;
        }

        if (!grouped.has(professorId)) {
          const slotOptions = getPreferredTimeslotOptions(professorId);

          grouped.set(professorId, {
            professorId,
            professorName,
            courses: [],
            slotOptions,
          });
        }

        grouped.get(professorId)?.courses.push({
          id: course.id,
          year: yearPlan.year,
          code: course.code,
          name: course.name,
        });
      }
    }

    return [...grouped.values()].sort((left, right) => left.professorName.localeCompare(right.professorName));
  }, [getPreferredTimeslotOptions, selectedProgramYearPlans]);

  const resolveSelectedTimeslotsForProfessor = (professorPlan: (typeof professorPlans)[number]) => {
    if (professorPlan.courses.length === 0) {
      return [] as string[];
    }

    const courseSlotSets = professorPlan.courses.map(
      (course) => new Set(preferredTimeslotByCourseId[course.id] ?? []),
    );

    const [firstSet, ...otherSets] = courseSlotSets;
    if (!firstSet) {
      return [];
    }

    return professorPlan.slotOptions
      .filter((option) => firstSet.has(option.value) && otherSets.every((slotSet) => slotSet.has(option.value)))
      .map((option) => option.value);
  };

  const handleProfessorPreferredTimeslotsChange = (
    professorPlan: (typeof professorPlans)[number],
    selectedTimeslotIds: string[],
  ) => {
    const dedupedTimeslotIds = [...new Set(selectedTimeslotIds)];

    setPreferredTimeslotByCourseId((prev) => {
      const next = { ...prev };

      for (const course of professorPlan.courses) {
        if (dedupedTimeslotIds.length === 0) {
          delete next[course.id];
        } else {
          next[course.id] = dedupedTimeslotIds;
        }
      }

      return next;
    });
  };

  return (
    <div className="mt-6 space-y-6 pb-8">
      <Card title="Scheduling Job Name">
        <div className="max-w-md">
          <label className="block text-sm text-slate-700">
            Job name
            <input
              type="text"
              value={classJobName}
              onChange={(event) => setClassJobName(event.target.value)}
              maxLength={120}
              placeholder="e.g. CS Year Plan Draft A"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
              required
            />
          </label>
        </div>
      </Card>

      <Card title="Study Program">
        <div className="max-w-md">
          <SelectField
            value={selectedStudyProgram}
            onChange={setSelectedStudyProgram}
            options={studyProgramOptions}
            optionColorByValue={studyProgramOptionColorByValue}
          />
        </div>
      </Card>

      <Card
        title="Program curriculum"
        icon={CalendarDays}
        headerRight={
          <Tabs
            tabs={[...curriculumTabs]}
            activeTab={activeCurriculumTab}
            onChange={(tab) => setActiveCurriculumTab(tab as (typeof curriculumTabs)[number])}
          />
        }
      >
        {!selectedStudyProgram ? (
          <p className="text-sm text-slate-500">Please select a study program to view its Year 1-4 courses.</p>
        ) : selectedProgramCourseCount === 0 ? (
          <p className="text-sm text-slate-500">No courses assigned yet. Configure courses in Program Detail first.</p>
        ) : activeCurriculumTab === 'Program Curriculum' ? (
          <div className="space-y-5">
            {selectedProgramYearPlans.map((yearPlan) => (
              <div key={yearPlan.year} className="rounded-lg border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800">
                  Year {yearPlan.year}
                </div>
                <div className="divide-y divide-slate-200">
                  {yearPlan.courses.length === 0 ? (
                    <p className="px-3 py-3 text-sm text-slate-500">No courses in this year.</p>
                  ) : (
                    yearPlan.courses.map((course) => (
                      <div
                        key={course.id}
                        className="grid grid-cols-1 gap-2 px-3 py-2 md:grid-cols-[140px_1fr_240px] md:items-center"
                      >
                        <p className="text-sm font-medium text-slate-800">{course.code || '—'}</p>
                        <p className="text-sm text-slate-700">{course.name || '—'}</p>
                        <p className="text-sm text-slate-600">{course.professorName || 'Unassigned'}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {professorPlans.length === 0 ? (
              <p className="text-sm text-slate-500">No assigned professors found in this program curriculum.</p>
            ) : (
              professorPlans.map((professorPlan) => {
                const selectedTimeslots = resolveSelectedTimeslotsForProfessor(professorPlan);
                const hasAvailability = professorPlan.slotOptions.length > 0;

                return (
                  <div key={professorPlan.professorId} className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-800">{professorPlan.professorName}</p>
                      <div className="w-full max-w-sm">
                        {hasAvailability ? (
                          <MultiSelectDropdown
                            value={selectedTimeslots}
                            onChange={(nextTimeslots) =>
                              handleProfessorPreferredTimeslotsChange(professorPlan, nextTimeslots)
                            }
                            options={professorPlan.slotOptions}
                            placeholder="Select preferred timeslots"
                          />
                        ) : (
                          <p className="text-xs text-slate-500">
                            No available timeslots configured in Resources for this professor.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {professorPlan.courses.map((course) => (
                        <span
                          key={course.id}
                          className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700"
                        >
                          Y{course.year}.{course.name}.{course.code}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </Card>

      <Card title="Rooms to be included">
        <RoomSelector
          query={roomSearch}
          onQueryChange={setRoomSearch}
          filteredRooms={filteredRooms}
          selectedRooms={selectedRooms}
          onToggleRoom={toggleRoom}
          roomCapacityMap={roomCapacityMap}
        />

        <SelectedChipSummary
          title="Selected rooms"
          items={selectedRooms}
          emptyMessage="Please select at least one room. Rooms are required."
          emptyMessageClassName="text-rose-600"
          onRemove={removeRoom}
        />
      </Card>

      <Card title="Constraint policy">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          <p>
            <span className="font-semibold text-slate-900">Hard constraints (fixed in backend code):</span>{' '}
            professor overlap is not allowed, same-year overlap is not allowed, room capacity must satisfy enrollment,
            and room-timeslot collisions are not allowed.
          </p>
          <p className="mt-1">
            <span className="font-semibold text-slate-900">Soft constraints (fixed in backend code):</span>{' '}
            only professor-selected preferred timeslots are currently active. Other soft constraints are
            temporarily turned off.
          </p>
        </div>
      </Card>

      <div className="flex justify-end">
        <div className="w-full max-w-sm">
          {isGenerating ? (
            <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                <span>Scheduling in progress</span>
                <span>~{remainingSeconds}s left</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-[#0A64BC] transition-all duration-1000 ease-linear"
                  style={{ width: progressWidth }}
                />
              </div>
            </div>
          ) : null}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onGenerate}
              disabled={
                isGenerating ||
                classJobName.trim().length === 0 ||
                selectedRooms.length === 0 ||
                selectedProgramCourseCount === 0
              }
              className="rounded-xl bg-[#0A64BC] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0959A8] active:bg-[#074B8C] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:hover:bg-slate-300"
            >
              {isGenerating ? 'Generating...' : 'Generate Schedule'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
