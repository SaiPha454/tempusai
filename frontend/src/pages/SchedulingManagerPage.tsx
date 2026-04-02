import { useEffect, useMemo, useRef, useState } from 'react';
import type { AxiosError } from 'axios';
import { useNavigate } from 'react-router-dom';
import { Tabs } from '../components/Tabs';
import { useResourcesCatalog } from '../contexts/ResourcesCatalogContext';
import {
  generateClassSchedule,
  generateExamSchedule,
  getLatestClassScheduleDraft,
  listClassDraftSummary,
  listConfirmedClassScheduleSummary,
} from '../api/scheduling';
import { ScheduleExamTab } from './scheduling/ScheduleExamTab';
import { ScheduleClassTab } from './scheduling/ScheduleClassTab';
import {
  examTimeSlotOptions,
  examTypeOptions,
  semesterOptions,
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
  programYearCourseId: string;
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
  | 'noStudentSameDayTimeslot'
  | 'prioritizePreferredDayAndTimeslot'
  | 'fallbackFlexibleWhenUnavailable';

const initialExamFilters: ExamFilterForm = {
  studyProgram: '',
  semester: '',
  examType: '',
};

const yearValues = ['1', '2', '3', '4'];
const anyTimeOptionValue = 'any-time';
const defaultExamTimeSlotValues = examTimeSlotOptions.map((item) => item.value);

const formatIsoDateLabel = (isoDate: string) => {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

export function SchedulingManagerPage() {
  const navigate = useNavigate();
  const { programs, professors, timeslots, rooms, programYearPlans } = useResourcesCatalog();

  const [activeTab, setActiveTab] = useState<(typeof schedulingTabs)[number]>('Schedule Class');
  const [selectedStudyProgram, setSelectedStudyProgram] = useState('');
  const [roomSearch, setRoomSearch] = useState('');
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [preferredTimeslotByCourseId, setPreferredTimeslotByCourseId] = useState<Record<string, string[]>>({});
  const [isGeneratingClassSchedule, setIsGeneratingClassSchedule] = useState(false);
  const [isCheckingExistingDraft, setIsCheckingExistingDraft] = useState(false);
  const [isGeneratingExamSchedule, setIsGeneratingExamSchedule] = useState(false);
  const [examGenerationError, setExamGenerationError] = useState<string | null>(null);
  const [draftCountByProgram, setDraftCountByProgram] = useState<Record<string, number>>({});
  const [confirmedCountByProgram, setConfirmedCountByProgram] = useState<Record<string, number>>({});

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
    noStudentSameDayTimeslot: true,
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

  const studyProgramOptions = useMemo<SelectOption[]>(
    () => [
      { value: '', label: 'Select study program' },
      ...programs
        .map((program) => ({ value: program.value, label: program.label }))
        .sort((left, right) => left.label.localeCompare(right.label)),
    ],
    [programs],
  );

  const roomDirectory = useMemo(() => rooms.map((room) => room.name).sort((left, right) => left.localeCompare(right)), [rooms]);

  const roomCapacityMap = useMemo(
    () => Object.fromEntries(rooms.map((room) => [room.name, room.capacity])),
    [rooms],
  );

  const filteredRooms = useMemo(() => {
    const normalized = roomSearch.trim().toLowerCase();
    return normalized ? roomDirectory.filter((room) => room.toLowerCase().includes(normalized)) : roomDirectory;
  }, [roomDirectory, roomSearch]);

  const filteredExamCatalogSubjects = useMemo(
    () => {
      if (!examFilters.studyProgram) {
        return [] as Array<{ id: string; code: string; name: string; year: string }>;
      }

      const yearPlans = programYearPlans[examFilters.studyProgram] ?? [];
      return yearPlans.flatMap((yearPlan) =>
        yearPlan.courses.map((course) => ({
          id: course.id,
          code: course.code,
          name: course.name,
          year: String(yearPlan.year),
        })),
      );
    },
    [examFilters.studyProgram, programYearPlans],
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
  }, [examFilters.examType, examFilters.semester, examProgramPlans, studyProgramOptions]);

  const filteredGlobalExamRooms = useMemo(() => {
    const normalized = globalExamRoomSearch.trim().toLowerCase();
    return normalized
      ? roomDirectory.filter((room) => room.toLowerCase().includes(normalized))
      : roomDirectory;
  }, [globalExamRoomSearch, roomDirectory]);

  const activeExamProgram = useMemo(
    () => examProgramPlans.find((program) => program.id === activeExamProgramId) ?? null,
    [activeExamProgramId, examProgramPlans],
  );

  const handleExamFilterChange = (field: keyof ExamFilterForm, value: string) => {
    setExamFilters((prev) => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    setExamGenerationError(null);
  }, [examFilters, examProgramPlans, globalExamDates, globalExamSelectedRooms, examConstraints]);

  useEffect(() => {
    let cancelled = false;

    const loadDraftSummary = async () => {
      try {
        const [draftSummary, confirmedSummary] = await Promise.all([
          listClassDraftSummary(),
          listConfirmedClassScheduleSummary(),
        ]);
        if (cancelled) {
          return;
        }

        const nextDraftMap: Record<string, number> = {};
        for (const item of draftSummary) {
          nextDraftMap[item.program_value] = item.draft_count;
        }

        const nextConfirmedMap: Record<string, number> = {};
        for (const item of confirmedSummary) {
          nextConfirmedMap[item.program_value] = item.confirmed_count;
        }

        setDraftCountByProgram(nextDraftMap);
        setConfirmedCountByProgram(nextConfirmedMap);
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load schedule summary', error);
        }
      }
    };

    void loadDraftSummary();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const openExistingDraftIfAny = async () => {
      if (activeTab !== 'Schedule Class' || !selectedStudyProgram) {
        return;
      }

      try {
        setIsCheckingExistingDraft(true);
        const existingDraft = await getLatestClassScheduleDraft(selectedStudyProgram);
        if (cancelled) {
          return;
        }
        navigate(`/scheduling-draft?snapshotId=${existingDraft.id}`);
      } catch (error) {
        const statusCode = (error as AxiosError)?.response?.status;
        if (!cancelled && statusCode && statusCode !== 404) {
          console.error('Failed to check existing draft', error);
        }
      } finally {
        if (!cancelled) {
          setIsCheckingExistingDraft(false);
        }
      }
    };

    void openExistingDraftIfAny();

    return () => {
      cancelled = true;
    };
  }, [activeTab, navigate, selectedStudyProgram]);

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
        programYearCourseId: subject.id,
        code: subject.code,
        name: subject.name,
        examType: examFilters.examType,
        preferredDateValues: [...globalExamDates],
        preferredTimeSlots: [...defaultExamTimeSlotValues],
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

  const totalExamSubjects = useMemo(
    () =>
      examProgramPlans.reduce(
        (programTotal, program) =>
          programTotal + program.years.reduce((yearTotal, yearPlan) => yearTotal + yearPlan.subjects.length, 0),
        0,
      ),
    [examProgramPlans],
  );

  const examValidationMessage = useMemo(() => {
    if (examGenerationError) {
      return examGenerationError;
    }
    if (globalExamDates.length === 0) {
      return 'Select exam period dates before generation.';
    }
    if (globalExamSelectedRooms.length === 0) {
      return 'Select at least one exam room before generation.';
    }
    if (examProgramPlans.length === 0) {
      return 'Add at least one study program to exam scheduling queue.';
    }
    if (totalExamSubjects === 0) {
      return 'No subjects are queued. Add program subjects before generation.';
    }

    const hasSubjectWithoutPreferredDate = examProgramPlans.some((program) =>
      program.years.some((yearPlan) =>
        yearPlan.subjects.some((subject) => subject.preferredDateValues.length === 0),
      ),
    );
    if (hasSubjectWithoutPreferredDate) {
      return 'Some subjects have no preferred date. Add preferred dates or keep full exam period defaults.';
    }

    const hasSubjectWithoutTimeslot = examProgramPlans.some((program) =>
      program.years.some((yearPlan) =>
        yearPlan.subjects.some((subject) => subject.preferredTimeSlots.length === 0),
      ),
    );
    if (hasSubjectWithoutTimeslot) {
      return 'Some subjects have no preferred exam slot.';
    }

    return null;
  }, [examGenerationError, examProgramPlans, globalExamDates.length, globalExamSelectedRooms.length, totalExamSubjects]);

  const canGenerateExamSchedule =
    examValidationMessage === null;

  const studyProgramOptionsWithDraftFlag = useMemo(
    () =>
      studyProgramOptions.map((option) => {
        if (!option.value) {
          return option;
        }

        const draftCount = draftCountByProgram[option.value] ?? 0;
        if (draftCount > 0) {
          return {
            ...option,
            label: `${option.label} (draft)`,
          };
        }

        const confirmedCount = confirmedCountByProgram[option.value] ?? 0;
        if (confirmedCount > 0) {
          return {
            ...option,
            label: `${option.label} (scheduled)`,
          };
        }

        return option;
      }),
    [confirmedCountByProgram, draftCountByProgram],
  );

  const studyProgramOptionColorByValue = useMemo(() => {
    const colorMap: Record<string, string> = {};
    for (const option of studyProgramOptions) {
      if (!option.value) {
        continue;
      }
      if ((draftCountByProgram[option.value] ?? 0) > 0) {
        colorMap[option.value] = '#dc2626';
      }
    }
    return colorMap;
  }, [draftCountByProgram]);

  const handleGenerateClassSchedule = async () => {
    if (!selectedStudyProgram || selectedProgramCourseCount === 0) {
      return;
    }

    try {
      setIsGeneratingClassSchedule(true);
      const result = await generateClassSchedule({
        program_value: selectedStudyProgram,
        selected_room_names: selectedRooms,
        constraints,
        preferred_timeslot_by_course_id: preferredTimeslotByCourseId,
      });

      if (result.snapshot_id) {
        navigate(`/scheduling-draft?snapshotId=${result.snapshot_id}&jobId=${result.job_id}`);
      }
    } finally {
      setIsGeneratingClassSchedule(false);
    }
  };

  const handleGenerateExamSchedule = async () => {
    if (examValidationMessage) {
      return;
    }

    const selectedDateSet = new Set(globalExamDates);
    const payload = {
      exam_dates: [...globalExamDates].sort(),
      selected_room_names: [...globalExamSelectedRooms].sort(),
      program_plans: examProgramPlans
        .map((program) => ({
          program_value: program.studyProgram,
          semester: program.semester,
          exam_type: program.examType,
          years: program.years
            .map((yearPlan) => ({
              year: Number(yearPlan.year),
              courses: yearPlan.subjects.map((subject) => ({
                program_year_course_id: subject.programYearCourseId,
                course_code: subject.code,
                course_name: subject.name,
                preferred_dates: subject.preferredDateValues.filter((date) => selectedDateSet.has(date)),
                preferred_timeslots:
                  subject.preferredTimeSlots.length > 0
                    ? subject.preferredTimeSlots
                    : [...defaultExamTimeSlotValues],
              })),
            }))
            .filter((yearPlan) => yearPlan.courses.length > 0),
        }))
        .filter((program) => program.years.length > 0),
      constraints: {
        no_same_program_year_day_timeslot:
          examConstraints.noTwoSubjectsSameDay && examConstraints.noTwoSubjectsSameTimeslot,
        no_student_overlap: examConstraints.noStudentSameDayTimeslot,
        room_capacity_check: true,
        prefer_day_timeslot: examConstraints.prioritizePreferredDayAndTimeslot,
        allow_flexible_fallback: examConstraints.fallbackFlexibleWhenUnavailable,
      },
    };

    try {
      setIsGeneratingExamSchedule(true);
      setExamGenerationError(null);
      await generateExamSchedule(payload);
    } catch (error) {
      const statusCode = (error as AxiosError)?.response?.status;
      if (statusCode === 404) {
        setExamGenerationError('Exam scheduling endpoint is not available yet. Frontend payload wiring is ready.');
      } else {
        setExamGenerationError('Failed to generate exam schedule. Please try again.');
      }
    } finally {
      setIsGeneratingExamSchedule(false);
    }
  };

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
          studyProgramOptions={studyProgramOptionsWithDraftFlag}
          studyProgramOptionColorByValue={studyProgramOptionColorByValue}
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
          isGenerating={isGeneratingClassSchedule || isCheckingExistingDraft}
          onGenerate={handleGenerateClassSchedule}
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
          totalExamSubjects={totalExamSubjects}
          examValidationMessage={examValidationMessage}
          isGeneratingExamSchedule={isGeneratingExamSchedule}
          onGenerateExamSchedule={handleGenerateExamSchedule}
        />
      )}

    </>
  );
}
