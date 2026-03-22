import { CalendarDays } from 'lucide-react';
import { Card } from '../../components/Card';
import { SelectField } from '../../components/SelectField';
import { MultiSelectDropdown } from '../../components/MultiSelectDropdown';
import { RoomSelector } from '../../components/RoomSelector';
import { SelectedChipSummary } from '../../components/SelectedChipSummary';
import { ToggleSwitch } from '../../components/ToggleSwitch';

type SelectOption = {
  value: string;
  label: string;
};

type ProgramCourse = {
  id: string;
  code: string;
  name: string;
  professorName: string;
};

type ProgramYearPlan = {
  year: string;
  courses: ProgramCourse[];
};

type ConstraintState = {
  prioritizeProfessorPreferences: boolean;
  professorNoOverlap: boolean;
  roomCapacityCheck: boolean;
  flexibleSlotFallback: boolean;
  studentGroupsNoOverlap: boolean;
};

type ScheduleClassTabProps = {
  selectedStudyProgram: string;
  setSelectedStudyProgram: (value: string) => void;
  studyProgramOptions: SelectOption[];
  selectedProgramCourseCount: number;
  selectedProgramYearPlans: ProgramYearPlan[];
  getPreferredTimeslotOptions: (professorName: string) => Array<{ value: string; label: string }>;
  preferredTimeslotByCourseId: Record<string, string[]>;
  setPreferredTimeslotByCourseId: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  roomSearch: string;
  setRoomSearch: React.Dispatch<React.SetStateAction<string>>;
  filteredRooms: string[];
  selectedRooms: string[];
  toggleRoom: (room: string) => void;
  roomCapacityMap: Record<string, number>;
  removeRoom: (room: string) => void;
  constraints: ConstraintState;
  toggleConstraint: (
    key:
      | 'prioritizeProfessorPreferences'
      | 'professorNoOverlap'
      | 'roomCapacityCheck'
      | 'flexibleSlotFallback'
      | 'studentGroupsNoOverlap',
  ) => void;
};

export function ScheduleClassTab({
  selectedStudyProgram,
  setSelectedStudyProgram,
  studyProgramOptions,
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
  constraints,
  toggleConstraint,
}: ScheduleClassTabProps) {
  return (
    <div className="mt-6 space-y-6 pb-8">
      <Card title="Study Program">
        <div className="max-w-md">
          <SelectField
            value={selectedStudyProgram}
            onChange={setSelectedStudyProgram}
            options={studyProgramOptions}
          />
        </div>
      </Card>

      <Card title="Program curriculum" icon={CalendarDays}>
        {!selectedStudyProgram ? (
          <p className="text-sm text-slate-500">Please select a study program to view its Year 1-4 courses.</p>
        ) : selectedProgramCourseCount === 0 ? (
          <p className="text-sm text-slate-500">No courses assigned yet. Configure courses in Program Detail first.</p>
        ) : (
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
                    yearPlan.courses.map((course) => {
                      const preferredOptions = getPreferredTimeslotOptions(course.professorName);
                      const hasAvailability = preferredOptions.length > 0;
                      const selectedPreferredTimeslots = preferredTimeslotByCourseId[course.id] ?? [];

                      return (
                        <div key={course.id} className="grid grid-cols-1 gap-2 px-3 py-2 md:grid-cols-[140px_1fr_240px_280px] md:items-center">
                          <p className="text-sm font-medium text-slate-800">{course.code || '—'}</p>
                          <p className="text-sm text-slate-700">{course.name || '—'}</p>
                          <p className="text-sm text-slate-600">{course.professorName || 'Unassigned'}</p>
                          {course.professorName ? (
                            hasAvailability ? (
                              <div>
                                <MultiSelectDropdown
                                  value={selectedPreferredTimeslots}
                                  onChange={(next) =>
                                    setPreferredTimeslotByCourseId((prev) => ({
                                      ...prev,
                                      [course.id]: next,
                                    }))
                                  }
                                  options={preferredOptions}
                                  placeholder="Select preferred timeslots"
                                />
                              </div>
                            ) : (
                              <p className="text-xs text-slate-500">No vailable timeslots. Please add in Reouces</p>
                            )
                          ) : (
                            <p className="text-xs text-slate-500">Assign professor in Program Detail first.</p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
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

      <Card title="Constraints rules">
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
          <ToggleSwitch
            label="Prioritize professor preferences"
            checked={constraints.prioritizeProfessorPreferences}
            onChange={() => toggleConstraint('prioritizeProfessorPreferences')}
          />
          <ToggleSwitch
            label="Flexible slot fallback"
            checked={constraints.flexibleSlotFallback}
            onChange={() => toggleConstraint('flexibleSlotFallback')}
          />
          <ToggleSwitch
            label="Professor cannot have overlapping classes"
            checked={constraints.professorNoOverlap}
            onChange={() => toggleConstraint('professorNoOverlap')}
          />
          <ToggleSwitch
            label="Student groups cannot overlap"
            checked={constraints.studentGroupsNoOverlap}
            onChange={() => toggleConstraint('studentGroupsNoOverlap')}
          />
          <ToggleSwitch
            label="Room capacity check"
            checked={constraints.roomCapacityCheck}
            onChange={() => toggleConstraint('roomCapacityCheck')}
          />
        </div>
      </Card>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={selectedRooms.length === 0 || selectedProgramCourseCount === 0}
          className="rounded-xl bg-[#0A64BC] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0959A8] active:bg-[#074B8C] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:hover:bg-slate-300"
        >
          Generate Schedule
        </button>
      </div>
    </div>
  );
}
