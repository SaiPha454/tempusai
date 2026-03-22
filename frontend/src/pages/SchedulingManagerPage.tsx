import { useMemo, useRef, useState } from 'react';
import { Tabs } from '../components/Tabs';
import { useResourcesCatalog } from '../contexts/ResourcesCatalogContext';
import { ScheduleExamTab } from './scheduling/ScheduleExamTab';
import { ScheduleClassTab } from './scheduling/ScheduleClassTab';
import {
  examSubjectCatalog,
  examTimeSlotOptions,
  examTypeOptions,
  roomCapacityMap,
  roomDirectory,
  semesterOptions,
  studyProgramOptions,
  type SelectOption,
} from '../data/schedulingData';

const schedulingTabs = ['Schedule Class', 'Schedule Exam'] as const;

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

const initialExamFilters: ExamFilterForm = {
  studyProgram: '',
  semester: '',
  examType: '',
};

const yearValues = ['1', '2', '3', '4'];
const anyTimeOptionValue = 'any-time';

const formatIsoDateLabel = (isoDate: string) => {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

export function SchedulingManagerPage() {
  const { professors, timeslots, programYearPlans } = useResourcesCatalog();

  const [activeTab, setActiveTab] = useState<(typeof schedulingTabs)[number]>('Schedule Class');
  const [selectedStudyProgram, setSelectedStudyProgram] = useState('');
  const [roomSearch, setRoomSearch] = useState('');
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [preferredTimeslotByCourseId, setPreferredTimeslotByCourseId] = useState<Record<string, string[]>>({});

  const [examFilters, setExamFilters] = useState<ExamFilterForm>(initialExamFilters);
  const [examProgramPlans, setExamProgramPlans] = useState<ExamProgramPlan[]>([]);
  const [activeExamProgramId, setActiveExamProgramId] = useState<string | null>(null);
  const [globalExamDates, setGlobalExamDates] = useState<string[]>([]);
  const [globalExamRoomSearch, setGlobalExamRoomSearch] = useState('');
  const [globalExamSelectedRooms, setGlobalExamSelectedRooms] = useState<string[]>([]);
  const [collapsedExamYears, setCollapsedExamYears] = useState<Record<string, boolean>>({});
  const [isExamPeriodExpanded, setIsExamPeriodExpanded] = useState(true);
  const [isExamRoomsExpanded, setIsExamRoomsExpanded] = useState(true);
  const programNavScrollRef = useRef<HTMLDivElement>(null);

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

  const defaultProgramYears = useMemo(
    () =>
      yearValues.map((year) => ({
        year,
        courses: [] as Array<{ id: string; code: string; name: string; professorName: string }>,
      })),
    [],
  );

  const selectedProgramYearPlans = useMemo(() => {
    if (!selectedStudyProgram) {
      return defaultProgramYears;
    }

    const plans = programYearPlans[selectedStudyProgram];
    return plans && plans.length > 0
      ? plans.map((yearPlan) => ({
          year: String(yearPlan.year),
          courses: yearPlan.courses,
        }))
      : defaultProgramYears;
  }, [defaultProgramYears, programYearPlans, selectedStudyProgram]);

  const selectedProgramCourseCount = useMemo(
    () => selectedProgramYearPlans.reduce((total, yearPlan) => total + yearPlan.courses.length, 0),
    [selectedProgramYearPlans],
  );

  const timeslotLabelById = useMemo(
    () => new Map(timeslots.map((slot) => [slot.id, `${slot.day} · ${slot.label}`])),
    [timeslots],
  );

  const professorByName = useMemo(
    () => new Map(professors.map((professor) => [professor.name, professor])),
    [professors],
  );

  const getPreferredTimeslotOptions = (professorName: string) => {
    const professor = professorByName.get(professorName);
    if (!professor) {
      return [] as Array<{ value: string; label: string }>;
    }

    const availableSlotIds = professor.availableSlotIds;
    if (availableSlotIds.length === 0 || availableSlotIds.includes(anyTimeOptionValue)) {
      return timeslots.map((slot) => ({ value: slot.id, label: `${slot.day} · ${slot.label}` }));
    }

    return availableSlotIds
      .map((slotId) => ({ value: slotId, label: timeslotLabelById.get(slotId) ?? slotId }))
      .filter((option) => Boolean(option.label));
  };

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

  const handleExamFilterChange = (field: keyof ExamFilterForm, value: string) => {
    setExamFilters((prev) => ({ ...prev, [field]: value }));
  };

  const getOptionLabel = (options: SelectOption[], value: string, fallback = 'N/A') =>
    options.find((option) => option.value === value)?.label ?? fallback;

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
        <ScheduleClassTab
          selectedStudyProgram={selectedStudyProgram}
          setSelectedStudyProgram={setSelectedStudyProgram}
          studyProgramOptions={studyProgramOptions}
          selectedProgramCourseCount={selectedProgramCourseCount}
          selectedProgramYearPlans={selectedProgramYearPlans}
          getPreferredTimeslotOptions={getPreferredTimeslotOptions}
          preferredTimeslotByCourseId={preferredTimeslotByCourseId}
          setPreferredTimeslotByCourseId={setPreferredTimeslotByCourseId}
          roomSearch={roomSearch}
          setRoomSearch={setRoomSearch}
          filteredRooms={filteredRooms}
          selectedRooms={selectedRooms}
          toggleRoom={toggleRoom}
          roomCapacityMap={roomCapacityMap}
          removeRoom={removeRoom}
          constraints={constraints}
          toggleConstraint={toggleConstraint}
        />
      )}

      {activeTab === 'Schedule Exam' && (
        <ScheduleExamTab
          isExamPeriodExpanded={isExamPeriodExpanded}
          setIsExamPeriodExpanded={setIsExamPeriodExpanded}
          globalExamDates={globalExamDates}
          toggleGlobalExamDate={toggleGlobalExamDate}
          formatIsoDateLabel={formatIsoDateLabel}
          isExamRoomsExpanded={isExamRoomsExpanded}
          setIsExamRoomsExpanded={setIsExamRoomsExpanded}
          globalExamRoomSearch={globalExamRoomSearch}
          setGlobalExamRoomSearch={setGlobalExamRoomSearch}
          filteredGlobalExamRooms={filteredGlobalExamRooms}
          globalExamSelectedRooms={globalExamSelectedRooms}
          toggleGlobalExamRoom={toggleGlobalExamRoom}
          removeGlobalExamRoom={removeGlobalExamRoom}
          roomCapacityMap={roomCapacityMap}
          examFilters={examFilters}
          handleExamFilterChange={handleExamFilterChange}
          examStudyProgramOptions={examStudyProgramOptions}
          semesterOptions={semesterOptions}
          examTypeOptions={examTypeOptions}
          filteredExamCatalogSubjects={filteredExamCatalogSubjects}
          addExamProgramPlan={addExamProgramPlan}
          canAddExamProgram={canAddExamProgram}
          examProgramPlans={examProgramPlans}
          programNavScrollRef={programNavScrollRef}
          scrollProgramNavigation={scrollProgramNavigation}
          activeExamProgramId={activeExamProgramId}
          setActiveExamProgramId={(id) => setActiveExamProgramId(id)}
          removeExamProgram={removeExamProgram}
          getOptionLabel={getOptionLabel}
          studyProgramOptions={studyProgramOptions}
          activeExamProgram={activeExamProgram}
          toggleExamYearCollapsed={toggleExamYearCollapsed}
          isExamYearCollapsed={isExamYearCollapsed}
          updateExamSubjectPreferredDates={updateExamSubjectPreferredDates}
          updateExamSubjectTimeSlots={updateExamSubjectTimeSlots}
          removeExamSubject={removeExamSubject}
          examTimeSlotOptions={examTimeSlotOptions}
          examConstraints={examConstraints}
          toggleExamConstraint={toggleExamConstraint}
          canGenerateExamSchedule={canGenerateExamSchedule}
        />
      )}

    </>
  );
}
