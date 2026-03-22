import { useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import clsx from 'clsx';
import { Tabs } from '../components/Tabs';
import { Card } from '../components/Card';
import { InputField } from '../components/InputField';
import { SelectField } from '../components/SelectField';
import { DaySelector } from '../components/DaySelector';
import { TimeSlotSelector } from '../components/TimeSlotSelector';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { CourseItem } from '../components/CourseItem';
import { ExamDateCalendar } from '../components/ExamDateCalendar';
import { ExamSubjectItem } from '../components/ExamSubjectItem';
import { ProfessorSelectField } from '../components/ProfessorSelectField';
import { RoomSelector } from '../components/RoomSelector';
import { CourseSelectField } from '../components/CourseSelectField';
import { SelectedChipSummary } from '../components/SelectedChipSummary';
import {
  courseDirectory,
  examSubjectCatalog,
  examTimeSlotOptions,
  examTypeOptions,
  preferredTimeOptions,
  professorDirectory,
  roomCapacityMap,
  roomDirectory,
  semesterOptions,
  studyProgramOptions,
  weekdays,
  yearOptions,
  type CourseOption,
  type SelectOption,
} from '../data/schedulingData';

const schedulingTabs = ['Schedule Class', 'Schedule Exam'] as const;

type CourseForm = {
  year: string;
  semester: string;
  studentCapacity: string;
};

type AddedCourse = {
  id: string;
  studyProgram: string;
  courseCode: string;
  courseName: string;
  year: string;
  semester: string;
  professorNames: string[];
  studentCapacity: string;
  preferredDays: string[];
  preferredTimes: string[];
};

type ConstraintKey =
  | 'prioritizeProfessorPreferences'
  | 'professorNoOverlap'
  | 'roomCapacityCheck'
  | 'flexibleSlotFallback'
  | 'studentGroupsNoOverlap';

type ExamFilterForm = {
  studyProgram: string;
  semester: string;
  examType: string;
};

type ExamSubjectScheduleItem = {
  id: string;
  code: string;
  name: string;
  examType: string;
  preferredDateValues: string[];
  preferredTimeSlots: string[];
  isDateCustom: boolean;
  isTimeCustom: boolean;
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

type ExamConstraintKey =
  | 'noTwoSubjectsSameDay'
  | 'noTwoSubjectsSameTimeslot'
  | 'prioritizePreferredDayAndTimeslot'
  | 'fallbackFlexibleWhenUnavailable';

const initialForm: CourseForm = {
  year: '',
  semester: '',
  studentCapacity: '',
};

const initialExamFilters: ExamFilterForm = {
  studyProgram: '',
  semester: '',
  examType: '',
};

const yearValues = ['1', '2', '3', '4'];

const formatIsoDateLabel = (isoDate: string) => {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

export function SchedulingManagerPage() {
  const [activeTab, setActiveTab] = useState<(typeof schedulingTabs)[number]>('Schedule Class');

  const [selectedStudyProgram, setSelectedStudyProgram] = useState('');
  const [courseQuery, setCourseQuery] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<CourseOption | null>(null);
  const [courseForm, setCourseForm] = useState<CourseForm>(initialForm);
  const [professorQuery, setProfessorQuery] = useState('');
  const [selectedProfessors, setSelectedProfessors] = useState<string[]>([]);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<string[]>(['any-time']);
  const [roomSearch, setRoomSearch] = useState('');
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [addedCourses, setAddedCourses] = useState<AddedCourse[]>([]);

  const [examFilters, setExamFilters] = useState<ExamFilterForm>(initialExamFilters);
  const [examProgramPlans, setExamProgramPlans] = useState<ExamProgramPlan[]>([]);
  const [activeExamProgramId, setActiveExamProgramId] = useState<string | null>(null);
  const [globalExamDates, setGlobalExamDates] = useState<string[]>([]);
  const [globalExamRoomSearch, setGlobalExamRoomSearch] = useState('');
  const [globalExamSelectedRooms, setGlobalExamSelectedRooms] = useState<string[]>([]);
  const [collapsedExamYears, setCollapsedExamYears] = useState<Record<string, boolean>>({});
  const [isExamPeriodExpanded, setIsExamPeriodExpanded] = useState(true);
  const [isExamRoomsExpanded, setIsExamRoomsExpanded] = useState(true);
  const programNavScrollRef = useRef<HTMLDivElement | null>(null);

  const [constraints, setConstraints] = useState<Record<ConstraintKey, boolean>>({
    prioritizeProfessorPreferences: true,
    professorNoOverlap: true,
    roomCapacityCheck: true,
    flexibleSlotFallback: true,
    studentGroupsNoOverlap: true,
  });

  const [examConstraints, setExamConstraints] = useState<Record<ExamConstraintKey, boolean>>({
    noTwoSubjectsSameDay: true,
    noTwoSubjectsSameTimeslot: true,
    prioritizePreferredDayAndTimeslot: true,
    fallbackFlexibleWhenUnavailable: true,
  });

  const filteredCourses = useMemo(() => {
    const normalized = courseQuery.trim().toLowerCase();
    if (!normalized) {
      return courseDirectory.slice(0, 8);
    }

    return courseDirectory.filter(
      (course) =>
        course.code.toLowerCase().includes(normalized) ||
        course.name.toLowerCase().includes(normalized),
    );
  }, [courseQuery]);

  const filteredProfessors = useMemo(() => {
    const normalized = professorQuery.trim().toLowerCase();
    if (!normalized) {
      return professorDirectory.filter((professor) => !selectedProfessors.includes(professor)).slice(0, 6);
    }

    return professorDirectory.filter(
      (professor) =>
        professor.toLowerCase().includes(normalized) && !selectedProfessors.includes(professor),
    );
  }, [professorQuery, selectedProfessors]);

  const filteredRooms = useMemo(() => {
    const normalized = roomSearch.trim().toLowerCase();
    return normalized ? roomDirectory.filter((room) => room.toLowerCase().includes(normalized)) : roomDirectory;
  }, [roomSearch]);

  const filteredExamCatalogSubjects = useMemo(
    () =>
      examSubjectCatalog.filter(
        (subject) =>
          subject.studyProgram === examFilters.studyProgram &&
          subject.semester === examFilters.semester,
      ),
    [examFilters.studyProgram, examFilters.semester],
  );

  const examStudyProgramOptions = useMemo(() => {
    return studyProgramOptions.map((option) => {
      if (!option.value) {
        return option;
      }

      const isSelected = examProgramPlans.some((plan) => {
        if (plan.studyProgram !== option.value) {
          return false;
        }

        if (examFilters.semester && examFilters.examType) {
          return plan.semester === examFilters.semester && plan.examType === examFilters.examType;
        }

        return true;
      });

      return {
        ...option,
        label: isSelected ? `✓ ${option.label}` : option.label,
      };
    });
  }, [examFilters.examType, examFilters.semester, examProgramPlans]);

  const filteredGlobalExamRooms = useMemo(() => {
    const normalized = globalExamRoomSearch.trim().toLowerCase();
    return normalized
      ? roomDirectory.filter((room) => room.toLowerCase().includes(normalized))
      : roomDirectory;
  }, [globalExamRoomSearch]);

  const activeExamProgram = useMemo(
    () => examProgramPlans.find((program) => program.id === activeExamProgramId) ?? null,
    [activeExamProgramId, examProgramPlans],
  );

  const handleFormChange = (field: keyof CourseForm, value: string) => {
    setCourseForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleExamFilterChange = (field: keyof ExamFilterForm, value: string) => {
    setExamFilters((prev) => ({ ...prev, [field]: value }));
  };

  const getTimeLabel = (timeValue: string) =>
    preferredTimeOptions.find((option) => option.value === timeValue)?.label ?? 'Any time';

  const getTimeLabels = (timeValues: string[]) =>
    timeValues.map((timeValue) => getTimeLabel(timeValue)).join(', ');

  const getOptionLabel = (options: SelectOption[], value: string, fallback = 'N/A') =>
    options.find((option) => option.value === value)?.label ?? fallback;

  const addCourse = () => {
    if (!canAddCourse || !selectedCourse) {
      return;
    }

    const course: AddedCourse = {
      id: crypto.randomUUID(),
      studyProgram: selectedStudyProgram,
      courseCode: selectedCourse.code,
      courseName: selectedCourse.name,
      year: courseForm.year,
      semester: courseForm.semester,
      professorNames: selectedProfessors,
      studentCapacity: courseForm.studentCapacity,
      preferredDays: selectedDays,
      preferredTimes: selectedTimeSlots,
    };

    setAddedCourses((prev) => [...prev, course]);
    setSelectedCourse(null);
    setCourseQuery('');
    setProfessorQuery('');
    setSelectedProfessors([]);
  };

  const removeCourse = (courseId: string) => {
    setAddedCourses((prev) => prev.filter((course) => course.id !== courseId));
  };

  const toggleRoom = (room: string) => {
    setSelectedRooms((prev) =>
      prev.includes(room) ? prev.filter((item) => item !== room) : [...prev, room],
    );
  };

  const removeRoom = (room: string) => {
    setSelectedRooms((prev) => prev.filter((item) => item !== room));
  };

  const toggleConstraint = (key: ConstraintKey) => {
    setConstraints((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleExamConstraint = (key: ExamConstraintKey) => {
    setExamConstraints((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const hasValidCapacity = Number(courseForm.studentCapacity) > 0;
  const canAddCourse =
    Boolean(selectedStudyProgram) &&
    Boolean(selectedCourse) &&
    Boolean(courseForm.year) &&
    Boolean(courseForm.semester) &&
    hasValidCapacity &&
    selectedProfessors.length > 0;

  const canAddExamProgram =
    Boolean(examFilters.studyProgram) &&
    Boolean(examFilters.semester) &&
    Boolean(examFilters.examType) &&
    filteredExamCatalogSubjects.length > 0;

  const addExamProgramPlan = () => {
    if (!canAddExamProgram) {
      return;
    }

    const duplicate = examProgramPlans.find(
      (program) =>
        program.studyProgram === examFilters.studyProgram &&
        program.semester === examFilters.semester &&
        program.examType === examFilters.examType,
    );

    if (duplicate) {
      setActiveExamProgramId(duplicate.id);
      return;
    }

    const buildYearPlan = (year: string): ExamYearPlan => {
      const yearSubjects = filteredExamCatalogSubjects.filter((subject) => subject.year === year);

      const subjects: ExamSubjectScheduleItem[] = yearSubjects.map((subject) => ({
        id: `${subject.code}-${crypto.randomUUID()}`,
        code: subject.code,
        name: subject.name,
        examType: examFilters.examType,
        preferredDateValues: [...globalExamDates],
        preferredTimeSlots: ['morning-exam', 'afternoon-exam'],
        isDateCustom: false,
        isTimeCustom: false,
      }));

      return { year, subjects };
    };

    const planId = crypto.randomUUID();
    const plan: ExamProgramPlan = {
      id: planId,
      studyProgram: examFilters.studyProgram,
      semester: examFilters.semester,
      examType: examFilters.examType,
      years: yearValues.map(buildYearPlan),
    };

    setExamProgramPlans((prev) => [...prev, plan]);
    setActiveExamProgramId(planId);
    setExamFilters((prev) => ({ ...prev, studyProgram: '' }));
  };

  const updateExamProgram = (programId: string, updater: (program: ExamProgramPlan) => ExamProgramPlan) => {
    setExamProgramPlans((prev) => prev.map((program) => (program.id === programId ? updater(program) : program)));
  };

  const removeExamProgram = (programId: string) => {
    setExamProgramPlans((prev) => {
      const next = prev.filter((program) => program.id !== programId);
      if (activeExamProgramId === programId) {
        setActiveExamProgramId(next[0]?.id ?? null);
      }
      return next;
    });
  };

  const scrollProgramNavigation = (direction: 'left' | 'right') => {
    const container = programNavScrollRef.current;
    if (!container) {
      return;
    }

    container.scrollBy({
      left: direction === 'left' ? -320 : 320,
      behavior: 'smooth',
    });
  };

  const getYearCollapseKey = (programId: string, year: string) => `${programId}-${year}`;

  const isExamYearCollapsed = (programId: string, year: string) =>
    collapsedExamYears[getYearCollapseKey(programId, year)] ?? year !== '1';

  const toggleExamYearCollapsed = (programId: string, year: string) => {
    const key = getYearCollapseKey(programId, year);
    setCollapsedExamYears((prev) => {
      const currentCollapsed = prev[key] ?? year !== '1';
      return { ...prev, [key]: !currentCollapsed };
    });
  };

  const toggleGlobalExamDate = (isoDate: string) => {
    setGlobalExamDates((prevDates) => {
      const hasDate = prevDates.includes(isoDate);
      const nextDates = hasDate
        ? prevDates.filter((value) => value !== isoDate)
        : [...prevDates, isoDate];

      setExamProgramPlans((prevPlans) =>
        prevPlans.map((program) => ({
          ...program,
          years: program.years.map((yearPlan) => ({
            ...yearPlan,
            subjects: yearPlan.subjects.map((subject) =>
              subject.isDateCustom
                ? {
                    ...subject,
                    preferredDateValues: subject.preferredDateValues.filter((date) =>
                      nextDates.includes(date),
                    ),
                  }
                : {
                    ...subject,
                    preferredDateValues: [...nextDates],
                  },
            ),
          })),
        })),
      );

      return nextDates;
    });
  };

  const toggleGlobalExamRoom = (room: string) => {
    setGlobalExamSelectedRooms((prev) =>
      prev.includes(room) ? prev.filter((item) => item !== room) : [...prev, room],
    );
  };

  const removeGlobalExamRoom = (room: string) => {
    setGlobalExamSelectedRooms((prev) => prev.filter((item) => item !== room));
  };

  const updateExamSubjectPreferredDates = (
    programId: string,
    year: string,
    subjectId: string,
    values: string[],
  ) => {
    updateExamProgram(programId, (program) => ({
      ...program,
      years: program.years.map((yearPlan) =>
        yearPlan.year === year
          ? {
              ...yearPlan,
              subjects: yearPlan.subjects.map((subject) =>
                subject.id === subjectId
                  ? { ...subject, preferredDateValues: values, isDateCustom: true }
                  : subject,
              ),
            }
          : yearPlan,
      ),
    }));
  };

  const updateExamSubjectTimeSlots = (
    programId: string,
    year: string,
    subjectId: string,
    values: string[],
  ) => {
    updateExamProgram(programId, (program) => ({
      ...program,
      years: program.years.map((yearPlan) =>
        yearPlan.year === year
          ? {
              ...yearPlan,
              subjects: yearPlan.subjects.map((subject) =>
                subject.id === subjectId
                  ? { ...subject, preferredTimeSlots: values, isTimeCustom: true }
                  : subject,
              ),
            }
          : yearPlan,
      ),
    }));
  };

  const removeExamSubject = (programId: string, year: string, subjectId: string) => {
    updateExamProgram(programId, (program) => ({
      ...program,
      years: program.years.map((yearPlan) =>
        yearPlan.year === year
          ? {
              ...yearPlan,
              subjects: yearPlan.subjects.filter((subject) => subject.id !== subjectId),
            }
          : yearPlan,
      ),
    }));
  };

  const canGenerateExamSchedule =
    examProgramPlans.length > 0 && globalExamDates.length > 0 && globalExamSelectedRooms.length > 0;

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Scheduling Manager</h1>

      <div className="mt-6">
        <Tabs
          tabs={[...schedulingTabs]}
          activeTab={activeTab}
          onChange={(tab) => setActiveTab(tab as (typeof schedulingTabs)[number])}
        />
      </div>

      {activeTab === 'Schedule Class' && (
        <div className="mt-6 space-y-6 pb-8">
          <Card title="Study Program">
            <div className="max-w-md">
              <SelectField
                value={selectedStudyProgram}
                onChange={setSelectedStudyProgram}
                options={studyProgramOptions}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Selected study program applies to all courses you add here.
            </p>
          </Card>

          <Card title="Course Information" icon={CalendarDays}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <CourseSelectField
                selectedCourse={selectedCourse}
                query={courseQuery}
                onQueryChange={setCourseQuery}
                suggestions={filteredCourses}
                onSelect={(course) => {
                  setSelectedCourse(course);
                  setCourseQuery('');
                }}
                onRemove={() => setSelectedCourse(null)}
              />
              <SelectField
                value={courseForm.year}
                onChange={(value) => handleFormChange('year', value)}
                options={yearOptions}
              />
              <SelectField
                value={courseForm.semester}
                onChange={(value) => handleFormChange('semester', value)}
                options={semesterOptions}
              />
              <InputField
                value={courseForm.studentCapacity}
                onChange={(value) => handleFormChange('studentCapacity', value)}
                placeholder="Student capacity"
                type="number"
              />

              <div className="md:col-span-2">
                <ProfessorSelectField
                  selectedProfessors={selectedProfessors}
                  query={professorQuery}
                  onQueryChange={setProfessorQuery}
                  suggestions={filteredProfessors}
                  onSelect={(professor) => {
                    setSelectedProfessors((prev) =>
                      prev.includes(professor) ? prev : [...prev, professor],
                    );
                    setProfessorQuery('');
                  }}
                  onRemove={(professor) =>
                    setSelectedProfessors((prev) => prev.filter((item) => item !== professor))
                  }
                />
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <p className="text-sm font-medium text-slate-700">Preferred schedule options</p>
              <DaySelector days={weekdays} selectedDays={selectedDays} onChange={setSelectedDays} />

              <TimeSlotSelector
                options={preferredTimeOptions}
                selectedValues={selectedTimeSlots}
                onChange={setSelectedTimeSlots}
              />
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={addCourse}
                disabled={!canAddCourse}
                className="inline-flex items-center gap-2 rounded-lg bg-[#0A64BC] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#0959A8] active:bg-[#074B8C] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:hover:bg-slate-300"
              >
                <Plus size={16} />
                Add Course
              </button>
            </div>
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

          <Card title="Courses to be scheduled">
            <div
              className={
                addedCourses.length > 3 ? 'max-h-[540px] space-y-3 overflow-y-auto pr-1' : 'space-y-3'
              }
            >
              {addedCourses.length === 0 ? (
                <p className="text-sm text-slate-500">No courses added yet.</p>
              ) : (
                addedCourses.map((course, index) => (
                  <CourseItem
                    key={course.id}
                    order={index + 1}
                    studyProgram={
                      studyProgramOptions.find((item) => item.value === course.studyProgram)?.label ?? 'N/A'
                    }
                    courseCode={course.courseCode}
                    courseName={course.courseName}
                    year={course.year}
                    semester={course.semester}
                    studentCapacity={course.studentCapacity}
                    professorNames={course.professorNames}
                    preferredDays={course.preferredDays}
                    preferredTime={getTimeLabels(course.preferredTimes)}
                    onRemove={() => removeCourse(course.id)}
                  />
                ))
              )}
            </div>
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
              disabled={selectedRooms.length === 0 || addedCourses.length === 0}
              className="rounded-xl bg-[#0A64BC] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0959A8] active:bg-[#074B8C] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:hover:bg-slate-300"
            >
              Generate Schedule
            </button>
          </div>
        </div>
      )}

      {activeTab === 'Schedule Exam' && (
        <div className="mt-6 space-y-6 pb-8">
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
                {filteredExamCatalogSubjects.length} matching subject(s) across Year 1-4.
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
              title="Program navigation"
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
                    ].join(' \u00B7 ');

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
                            <span className="block min-w-max whitespace-nowrap">
                              {programLabel}
                            </span>
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

          {!activeExamProgram ? (
            <Card title="Program scheduling queue">
              <p className="text-sm text-slate-500">
                No program selected yet. Add a program, then choose it from the horizontal navigator.
              </p>
            </Card>
          ) : (
            <Card
              title={getOptionLabel(studyProgramOptions, activeExamProgram.studyProgram)}
              headerRight={
                <>
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

          <Card title="Constraints rules">
            <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
              <ToggleSwitch
                label="Two subjects cannot be on the same day"
                checked={examConstraints.noTwoSubjectsSameDay}
                onChange={() => toggleExamConstraint('noTwoSubjectsSameDay')}
              />
              <ToggleSwitch
                label="Two subjects cannot be in the same timeslot"
                checked={examConstraints.noTwoSubjectsSameTimeslot}
                onChange={() => toggleExamConstraint('noTwoSubjectsSameTimeslot')}
              />
              <ToggleSwitch
                label="Prioritize preferred day and timeslot"
                checked={examConstraints.prioritizePreferredDayAndTimeslot}
                onChange={() => toggleExamConstraint('prioritizePreferredDayAndTimeslot')}
              />
              <ToggleSwitch
                label="Fallback when preferred slot is unavailable (flexible)"
                checked={examConstraints.fallbackFlexibleWhenUnavailable}
                onChange={() => toggleExamConstraint('fallbackFlexibleWhenUnavailable')}
              />
            </div>
          </Card>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={!canGenerateExamSchedule}
              className="rounded-xl bg-[#0A64BC] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0959A8] active:bg-[#074B8C] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:hover:bg-slate-300"
            >
              Generate Exam Schedule
            </button>
          </div>
        </div>
      )}

    </>
  );
}
