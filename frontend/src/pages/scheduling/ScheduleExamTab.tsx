import { type RefObject } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import clsx from 'clsx';
import { Card } from '../../components/Card';
import { SelectField } from '../../components/SelectField';
import { ExamDateCalendar } from '../../components/ExamDateCalendar';
import { RoomSelector } from '../../components/RoomSelector';
import { SelectedChipSummary } from '../../components/SelectedChipSummary';
import { ExamSubjectItem } from '../../components/ExamSubjectItem';

type SelectOption = {
  value: string;
  label: string;
};

type ExamSubjectScheduleItem = {
  id: string;
  code: string;
  name: string;
  examType: string;
  preferredDateValues: string[];
  preferredTimeSlots: string[];
};

type ExamYearPlan = {
  year: string;
  subjects: ExamSubjectScheduleItem[];
};

type ExamProgramPlan = {
  id: string;
  studyProgram: string;
  semester: string;
  examType: string;
  years: ExamYearPlan[];
};

type ExamFilterForm = {
  studyProgram: string;
  semester: string;
  examType: string;
};

type ScheduleExamTabProps = {
  examJobName: string;
  setExamJobName: React.Dispatch<React.SetStateAction<string>>;
  isExamPeriodExpanded: boolean;
  setIsExamPeriodExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  globalExamDates: string[];
  toggleGlobalExamDate: (isoDate: string) => void;
  formatIsoDateLabel: (isoDate: string) => string;
  isExamRoomsExpanded: boolean;
  setIsExamRoomsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  globalExamRoomSearch: string;
  setGlobalExamRoomSearch: React.Dispatch<React.SetStateAction<string>>;
  filteredGlobalExamRooms: string[];
  globalExamSelectedRooms: string[];
  toggleGlobalExamRoom: (room: string) => void;
  removeGlobalExamRoom: (room: string) => void;
  roomCapacityMap: Record<string, number>;
  examFilters: ExamFilterForm;
  handleExamFilterChange: (field: keyof ExamFilterForm, value: string) => void;
  examStudyProgramOptions: SelectOption[];
  semesterOptions: SelectOption[];
  examTypeOptions: SelectOption[];
  filteredExamCatalogSubjects: Array<{ id?: string; code: string }>;
  addExamProgramPlan: () => void;
  canAddExamProgram: boolean;
  examProgramPlans: ExamProgramPlan[];
  programNavScrollRef: RefObject<HTMLDivElement>;
  scrollProgramNavigation: (direction: 'left' | 'right') => void;
  activeExamProgramId: string | null;
  setActiveExamProgramId: (id: string) => void;
  removeExamProgram: (id: string) => void;
  getOptionLabel: (options: SelectOption[], value: string, fallback?: string) => string;
  studyProgramOptions: SelectOption[];
  activeExamProgram: ExamProgramPlan | null;
  toggleExamYearCollapsed: (programId: string, year: string) => void;
  isExamYearCollapsed: (programId: string, year: string) => boolean;
  updateExamSubjectPreferredDates: (
    programId: string,
    year: string,
    subjectId: string,
    values: string[],
  ) => void;
  updateExamSubjectTimeSlots: (
    programId: string,
    year: string,
    subjectId: string,
    values: string[],
  ) => void;
  removeExamSubject: (programId: string, year: string, subjectId: string) => void;
  examTimeSlotOptions: SelectOption[];
  canGenerateExamSchedule: boolean;
  totalExamSubjects: number;
  examValidationMessage: string | null;
  isGeneratingExamSchedule: boolean;
  examGenerationProgressPercent: number;
  examGenerationStatusLabel: string | null;
  onGenerateExamSchedule: () => void;
};

export function ScheduleExamTab({
  examJobName,
  setExamJobName,
  isExamPeriodExpanded,
  setIsExamPeriodExpanded,
  globalExamDates,
  toggleGlobalExamDate,
  formatIsoDateLabel,
  isExamRoomsExpanded,
  setIsExamRoomsExpanded,
  globalExamRoomSearch,
  setGlobalExamRoomSearch,
  filteredGlobalExamRooms,
  globalExamSelectedRooms,
  toggleGlobalExamRoom,
  removeGlobalExamRoom,
  roomCapacityMap,
  examFilters,
  handleExamFilterChange,
  examStudyProgramOptions,
  semesterOptions,
  examTypeOptions,
  filteredExamCatalogSubjects,
  addExamProgramPlan,
  canAddExamProgram,
  examProgramPlans,
  programNavScrollRef,
  scrollProgramNavigation,
  activeExamProgramId,
  setActiveExamProgramId,
  removeExamProgram,
  getOptionLabel,
  studyProgramOptions,
  activeExamProgram,
  toggleExamYearCollapsed,
  isExamYearCollapsed,
  updateExamSubjectPreferredDates,
  updateExamSubjectTimeSlots,
  removeExamSubject,
  examTimeSlotOptions,
  canGenerateExamSchedule,
  totalExamSubjects,
  examValidationMessage,
  isGeneratingExamSchedule,
  examGenerationProgressPercent,
  examGenerationStatusLabel,
  onGenerateExamSchedule,
}: ScheduleExamTabProps) {
  return (
    <div className="mt-6 space-y-6 pb-8">
      <Card title="Scheduling Job">
        <label className="block text-sm text-slate-700">
          Scheduling job name <span className="text-rose-600">*</span>
          <input
            type="text"
            value={examJobName}
            onChange={(event) => setExamJobName(event.target.value)}
            placeholder="Enter job name (e.g. Midterm Draft v1)"
            maxLength={120}
            required
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
          />
        </label>
      </Card>

      <Card
        title="Exam Period"
        headerRight={
          <button
            type="button"
            onClick={() => setIsExamPeriodExpanded((prev) => !prev)}
            className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 transition hover:bg-slate-50"
            aria-label={isExamPeriodExpanded ? 'Collapse Exam Period' : 'Expand Exam Period'}
            aria-expanded={isExamPeriodExpanded}
          >
            {isExamPeriodExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        }
      >
        {isExamPeriodExpanded && (
          <>
            <ExamDateCalendar selectedDates={globalExamDates} onToggleDate={toggleGlobalExamDate} />

            <SelectedChipSummary
              title="Selected dates"
              items={[...globalExamDates].sort()}
              emptyMessage="No exam dates selected yet."
              onRemove={toggleGlobalExamDate}
              formatItemLabel={formatIsoDateLabel}
              removeAriaLabel={(isoDate) => `Remove ${isoDate}`}
            />
          </>
        )}
      </Card>

      <Card
        title="Exam Rooms"
        headerRight={
          <button
            type="button"
            onClick={() => setIsExamRoomsExpanded((prev) => !prev)}
            className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 transition hover:bg-slate-50"
            aria-label={isExamRoomsExpanded ? 'Collapse Exam Rooms' : 'Expand Exam Rooms'}
            aria-expanded={isExamRoomsExpanded}
          >
            {isExamRoomsExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        }
      >
        {isExamRoomsExpanded && (
          <>
            <RoomSelector
              query={globalExamRoomSearch}
              onQueryChange={setGlobalExamRoomSearch}
              filteredRooms={filteredGlobalExamRooms}
              selectedRooms={globalExamSelectedRooms}
              onToggleRoom={toggleGlobalExamRoom}
              roomCapacityMap={roomCapacityMap}
            />

            <SelectedChipSummary
              title="Selected rooms"
              items={globalExamSelectedRooms}
              emptyMessage="Please select at least one exam room."
              emptyMessageClassName="text-rose-600"
              onRemove={removeGlobalExamRoom}
            />
          </>
        )}
      </Card>

      <Card title="Subjects information" icon={CalendarDays}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <SelectField
            value={examFilters.studyProgram}
            onChange={(value) => handleExamFilterChange('studyProgram', value)}
            options={examStudyProgramOptions}
          />
          <SelectField
            value={examFilters.semester}
            onChange={(value) => handleExamFilterChange('semester', value)}
            options={semesterOptions}
          />
          <SelectField
            value={examFilters.examType}
            onChange={(value) => handleExamFilterChange('examType', value)}
            options={examTypeOptions}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            {filteredExamCatalogSubjects.length} matching subject(s) from selected program year plans.
          </p>
          <button
            type="button"
            onClick={addExamProgramPlan}
            disabled={!canAddExamProgram}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0A64BC] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#0959A8] active:bg-[#074B8C] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:hover:bg-slate-300"
          >
            <Plus size={16} />
            Add Program Subjects
          </button>
        </div>
      </Card>

      {examProgramPlans.length > 0 && (
        <Card
          title="List of study programs"
          headerRight={
            <>
              <button
                type="button"
                onClick={() => scrollProgramNavigation('left')}
                className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 transition hover:bg-slate-50"
                aria-label="Scroll programs left"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => scrollProgramNavigation('right')}
                className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 transition hover:bg-slate-50"
                aria-label="Scroll programs right"
              >
                <ChevronRight size={16} />
              </button>
            </>
          }
        >
          <div className="w-full max-w-full overflow-hidden">
            <div
              ref={programNavScrollRef}
              className="w-full max-w-full overflow-x-auto overflow-y-hidden pb-1 [scrollbar-width:thin]"
            >
              <div className="inline-flex min-w-max flex-nowrap gap-2 pr-1">
                {examProgramPlans.map((program) => {
                  const isActive = program.id === activeExamProgramId;
                  const programLabel = [
                    getOptionLabel(studyProgramOptions, program.studyProgram),
                    getOptionLabel(semesterOptions, program.semester),
                    getOptionLabel(examTypeOptions, program.examType),
                  ].join(' · ');

                  return (
                    <div
                      key={program.id}
                      className={clsx(
                        'min-w-max flex-none items-center rounded-lg border text-sm font-medium transition',
                        isActive
                          ? 'border-[#0A64BC]/30 bg-[#0A64BC]/10 text-[#0A64BC]'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-[#0A64BC]/20 hover:text-[#0A64BC]',
                      )}
                    >
                      <div className="flex items-center">
                        <button
                          type="button"
                          onClick={() => setActiveExamProgramId(program.id)}
                          className="px-3 py-2 text-left"
                          aria-label={`Select ${programLabel}`}
                        >
                          <span className="block min-w-max whitespace-nowrap">{programLabel}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeExamProgram(program.id)}
                          className="mr-1 inline-flex items-center justify-center rounded p-1 text-inherit/80 transition hover:bg-black/5 hover:text-inherit"
                          aria-label={`Remove ${programLabel}`}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>
      )}

      {!activeExamProgram ? (
        <Card title="Program scheduling queue">
          <p className="text-sm text-slate-500">
            No program selected yet. Add a program, then choose it from the horizontal navigator.
          </p>
        </Card>
      ) : (
        <Card
          title="Years of study programs"
          headerRight={
            <>
              <p className="text-xs font-medium text-slate-700">
                {getOptionLabel(studyProgramOptions, activeExamProgram.studyProgram)}
              </p>
              <p className="text-xs text-slate-600">
                {getOptionLabel(semesterOptions, activeExamProgram.semester)} ·{' '}
                {getOptionLabel(examTypeOptions, activeExamProgram.examType)}
              </p>
              <button
                type="button"
                onClick={() => removeExamProgram(activeExamProgram.id)}
                className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700 transition hover:bg-rose-100"
              >
                Remove Program
              </button>
            </>
          }
        >
          <div className="mt-4 divide-y divide-slate-200">
            {activeExamProgram.years.map((yearPlan) => (
              <div key={yearPlan.year} className="py-4">
                <button
                  type="button"
                  onClick={() => toggleExamYearCollapsed(activeExamProgram.id, yearPlan.year)}
                  className="mb-2 flex w-full items-center justify-between rounded-md px-1 py-1 text-left text-base font-semibold text-slate-800 transition hover:bg-slate-50"
                >
                  <span>Year {yearPlan.year}</span>
                  {isExamYearCollapsed(activeExamProgram.id, yearPlan.year) ? (
                    <ChevronRight size={16} className="text-slate-500" />
                  ) : (
                    <ChevronDown size={16} className="text-slate-500" />
                  )}
                </button>

                {!isExamYearCollapsed(activeExamProgram.id, yearPlan.year) &&
                  (yearPlan.subjects.length === 0 ? (
                    <div className="px-2 py-4 text-center">
                      <p className="text-sm font-medium text-slate-600">No subjects</p>
                      <p className="mt-1 text-xs text-slate-500">
                        No subjects are available for Year {yearPlan.year} in this program setup.
                      </p>
                    </div>
                  ) : (
                    <div
                      className={
                        yearPlan.subjects.length > 3
                          ? 'max-h-[560px] divide-y divide-slate-200 overflow-y-auto pr-1'
                          : 'divide-y divide-slate-200'
                      }
                    >
                      {yearPlan.subjects.map((subject) => (
                        <ExamSubjectItem
                          key={subject.id}
                          subjectCode={subject.code}
                          subjectName={subject.name}
                          examType={getOptionLabel(examTypeOptions, subject.examType, subject.examType)}
                          availableDateOptions={[...globalExamDates]
                            .sort()
                            .map((isoDate) => ({ value: isoDate, label: formatIsoDateLabel(isoDate) }))}
                          selectedPreferredDates={subject.preferredDateValues}
                          selectedTimeSlots={subject.preferredTimeSlots}
                          examTimeSlotOptions={examTimeSlotOptions}
                          onPreferredDateChange={(values) =>
                            updateExamSubjectPreferredDates(
                              activeExamProgram.id,
                              yearPlan.year,
                              subject.id,
                              values,
                            )
                          }
                          onTimeSlotChange={(values) =>
                            updateExamSubjectTimeSlots(
                              activeExamProgram.id,
                              yearPlan.year,
                              subject.id,
                              values,
                            )
                          }
                          onRemove={() =>
                            removeExamSubject(activeExamProgram.id, yearPlan.year, subject.id)
                          }
                        />
                      ))}
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title="Constraint rules">
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          <p>
            <span className="font-semibold text-slate-900">Hard constraints:</span> same program/year cannot share
            the same day and slot, one student cannot have two exams at the same day/slot, and room capacity is
            enforced.
          </p>
          <p className="mt-1">
            <span className="font-semibold text-slate-900">Soft constraints:</span> preferred day and slot are
            prioritized, but may be relaxed when no feasible allocation exists.
          </p>
        </div>
      </Card>

      <Card title="Generation Review">
        <div className="space-y-2 text-sm text-slate-700">
          {isGeneratingExamSchedule && (
            <div className="mb-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-3">
              <p className="text-xs font-semibold text-sky-800">
                {examGenerationStatusLabel ?? 'Generating on backend'}
              </p>
              <div className="mt-2 h-2.5 w-full rounded-full bg-sky-100">
                <div
                  className="h-2.5 rounded-full bg-sky-600 transition-all"
                  style={{ width: `${Math.max(10, examGenerationProgressPercent)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-sky-700">
                Progress {examGenerationProgressPercent}% · Source: backend job status
              </p>
            </div>
          )}
          <p>
            Programs selected: <span className="font-semibold text-slate-900">{examProgramPlans.length}</span>
          </p>
          <p>
            Subjects queued: <span className="font-semibold text-slate-900">{totalExamSubjects}</span>
          </p>
          <p>
            Exam dates selected: <span className="font-semibold text-slate-900">{globalExamDates.length}</span>
          </p>
          <p>
            Exam rooms selected: <span className="font-semibold text-slate-900">{globalExamSelectedRooms.length}</span>
          </p>
          {examValidationMessage && (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs font-medium text-rose-700">
              {examValidationMessage}
            </p>
          )}
        </div>
      </Card>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onGenerateExamSchedule}
          disabled={!canGenerateExamSchedule || isGeneratingExamSchedule}
          className="rounded-xl bg-[#0A64BC] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0959A8] active:bg-[#074B8C] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:hover:bg-slate-300"
        >
          {isGeneratingExamSchedule ? 'Generating Exam Schedule...' : 'Generate Exam Schedule'}
        </button>
      </div>
    </div>
  );
}
