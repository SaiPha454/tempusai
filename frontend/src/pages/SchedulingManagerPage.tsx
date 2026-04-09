import { useEffect, useMemo, useRef, useState } from 'react';
import type { AxiosError } from 'axios';
import { useNavigate } from 'react-router-dom';
import { Tabs } from '../components/Tabs';
import { useResourcesCatalog } from '../contexts/ResourcesCatalogContext';
import {
  generateClassSchedule,
  generateExamSchedule,
  getExamScheduleJob,
  getLatestConfirmedClassSchedule,
  listClassDraftSummary,
  listConfirmedClassScheduleSummary,
  listExamDraftScheduleSummary,
  listConfirmedExamScheduleSummary,
  type ScheduleClassEntryDto,
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
const CLASS_PREFS_STORAGE_PREFIX = 'classPreferredSlotsBySnapshot:';

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
  defaultPreferredWeekdays: number[];
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

const normalizeWeekdayToMondayBasedIndex = (rawDay: string | null): number | null => {
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
};

const toMondayBasedWeekdayIndexFromIsoDate = (isoDate: string): number | null => {
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
};

const deriveDefaultPreferredDates = (examDates: string[], preferredWeekdays: number[]): string[] => {
  if (examDates.length === 0) {
    return [];
  }

  if (preferredWeekdays.length === 0) {
    return [...examDates];
  }

  const weekdaySet = new Set(preferredWeekdays);
  const matched = examDates.filter((isoDate) => {
    const weekday = toMondayBasedWeekdayIndexFromIsoDate(isoDate);
    return weekday !== null && weekdaySet.has(weekday);
  });

  // If class weekday is outside selected exam period, fallback to all days.
  if (matched.length === 0) {
    return [...examDates];
  }

  return matched;
};

const sortTimeslotOptionsByWeekdayAndLabel = (options: Array<{ value: string; label: string }>) => {
  return [...options].sort((left, right) => {
    const [leftDayRaw] = left.label.split(' · ');
    const [rightDayRaw] = right.label.split(' · ');
    const leftDay = normalizeWeekdayToMondayBasedIndex(leftDayRaw ?? null);
    const rightDay = normalizeWeekdayToMondayBasedIndex(rightDayRaw ?? null);

    if (leftDay !== null && rightDay !== null && leftDay !== rightDay) {
      return leftDay - rightDay;
    }
    if (leftDay !== null && rightDay === null) {
      return -1;
    }
    if (leftDay === null && rightDay !== null) {
      return 1;
    }

    return left.label.localeCompare(right.label);
  });
};

export function SchedulingManagerPage() {
  const navigate = useNavigate();
  const { programs, professors, timeslots, rooms, programYearPlans } = useResourcesCatalog();

  const [activeTab, setActiveTab] = useState<(typeof schedulingTabs)[number]>('Schedule Class');
  const [classJobName, setClassJobName] = useState('');
  const [selectedStudyProgram, setSelectedStudyProgram] = useState('');
  const [roomSearch, setRoomSearch] = useState('');
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [preferredTimeslotByCourseId, setPreferredTimeslotByCourseId] = useState<Record<string, string[]>>({});
  const [isGeneratingClassSchedule, setIsGeneratingClassSchedule] = useState(false);
  const [classGenerationError, setClassGenerationError] = useState<string | null>(null);
  const [isGeneratingExamSchedule, setIsGeneratingExamSchedule] = useState(false);
  const [examGenerationError, setExamGenerationError] = useState<string | null>(null);
  const [examJobName, setExamJobName] = useState('');
  const [examGenerationStatus, setExamGenerationStatus] = useState<string | null>(null);
  const [draftCountByProgram, setDraftCountByProgram] = useState<Record<string, number>>({});
  const [confirmedCountByProgram, setConfirmedCountByProgram] = useState<Record<string, number>>({});
  const [examDraftCountByProgram, setExamDraftCountByProgram] = useState<Record<string, number>>({});
  const [examConfirmedCountByProgram, setExamConfirmedCountByProgram] = useState<Record<string, number>>({});

  const [examFilters, setExamFilters] = useState<ExamFilterForm>(initialExamFilters);
  const [examProgramPlans, setExamProgramPlans] = useState<ExamProgramPlan[]>([]);
  const [confirmedClassEntriesByProgram, setConfirmedClassEntriesByProgram] = useState<Record<string, ScheduleClassEntryDto[]>>({});
  const [activeExamProgramId, setActiveExamProgramId] = useState<string | null>(null);
  const [globalExamDates, setGlobalExamDates] = useState<string[]>([]);
  const [globalExamRoomSearch, setGlobalExamRoomSearch] = useState('');
  const [globalExamSelectedRooms, setGlobalExamSelectedRooms] = useState<string[]>([]);
  const [collapsedExamYears, setCollapsedExamYears] = useState<Record<string, boolean>>({});
  const [isExamPeriodExpanded, setIsExamPeriodExpanded] = useState(true);
  const [isExamRoomsExpanded, setIsExamRoomsExpanded] = useState(true);
  const programNavScrollRef = useRef<HTMLDivElement>(null);

  const defaultProgramYears = useMemo(
    () =>
      yearValues.map((year) => ({
        year,
        courses: [] as Array<{ id: string; code: string; name: string; professorId: string | null; professorName: string }>,
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

  const professorById = useMemo(() => new Map(professors.map((professor) => [professor.id, professor])), [professors]);

  const getPreferredTimeslotOptions = (professorId: string) => {
    const professor = professorById.get(professorId);
    if (!professor) {
      return [] as Array<{ value: string; label: string }>;
    }

    const availableSlotIds = professor.availableSlotIds;
    if (availableSlotIds.length === 0 || availableSlotIds.includes(anyTimeOptionValue)) {
      return sortTimeslotOptionsByWeekdayAndLabel(
        timeslots.map((slot) => ({ value: slot.id, label: `${slot.day} · ${slot.label}` })),
      );
    }

    const options = availableSlotIds
      .map((slotId) => ({ value: slotId, label: timeslotLabelById.get(slotId) ?? slotId }))
      .filter((option) => Boolean(option.label));

    return sortTimeslotOptionsByWeekdayAndLabel(options);
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
        return [] as Array<{
          id: string;
          code: string;
          name: string;
          year: string;
          defaultPreferredWeekdays: number[];
          defaultPreferredDateValues: string[];
        }>;
      }

      const classEntries = confirmedClassEntriesByProgram[examFilters.studyProgram] ?? [];
      const dedup = new Map<
        string,
        {
          id: string;
          code: string;
          name: string;
          year: string;
          weekdaySet: Set<number>;
        }
      >();

      for (const entry of classEntries) {
        if (!entry.program_year_course_id) {
          continue;
        }

        const key = `${entry.course_id}-${entry.year}`;
        const weekday = normalizeWeekdayToMondayBasedIndex(entry.day);
        const existing = dedup.get(key);
        if (!existing) {
          dedup.set(key, {
            id: entry.program_year_course_id,
            code: entry.course_code,
            name: entry.course_name,
            year: String(entry.year),
            weekdaySet: weekday !== null ? new Set([weekday]) : new Set<number>(),
          });
          continue;
        }

        if (weekday !== null) {
          existing.weekdaySet.add(weekday);
        }
      }

      return [...dedup.values()].map((subject) => {
        const defaultPreferredWeekdays = [...subject.weekdaySet].sort((left, right) => left - right);
        return {
          id: subject.id,
          code: subject.code,
          name: subject.name,
          year: subject.year,
          defaultPreferredWeekdays,
          defaultPreferredDateValues: deriveDefaultPreferredDates(globalExamDates, defaultPreferredWeekdays),
        };
      });
    },
    [confirmedClassEntriesByProgram, examFilters.studyProgram, globalExamDates],
  );

  const confirmedExamProgramValueSet = useMemo(() => {
    const values = Object.entries(examConfirmedCountByProgram)
      .filter(([, count]) => count > 0)
      .map(([value]) => value);
    return new Set(values);
  }, [examConfirmedCountByProgram]);

  const selectedExamProgramStatusGroup = useMemo<null | 'confirmed' | 'non-confirmed'>(() => {
    if (examProgramPlans.length === 0) {
      return null;
    }
    const firstProgram = examProgramPlans[0];
    return confirmedExamProgramValueSet.has(firstProgram.studyProgram) ? 'confirmed' : 'non-confirmed';
  }, [confirmedExamProgramValueSet, examProgramPlans]);

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

      const draftCount = examDraftCountByProgram[option.value] ?? 0;
      const confirmedCount = examConfirmedCountByProgram[option.value] ?? 0;
      const statusTokens: string[] = [];
      if (draftCount > 0) {
        statusTokens.push(`${draftCount} draft${draftCount > 1 ? 's' : ''}`);
      }
      if (confirmedCount > 0) {
        statusTokens.push(`${confirmedCount} schedule${confirmedCount > 1 ? 's' : ''}`);
      }

      const withStatusLabel = statusTokens.length > 0 ? `${option.label} (${statusTokens.join(', ')})` : option.label;

      return {
        ...option,
        label: isSelected ? `✓ ${withStatusLabel}` : withStatusLabel,
      };
    });
  }, [examConfirmedCountByProgram, examDraftCountByProgram, examFilters.examType, examFilters.semester, examProgramPlans, studyProgramOptions]);

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
    setClassGenerationError(null);
  }, [classJobName, selectedStudyProgram, selectedRooms, selectedProgramCourseCount, preferredTimeslotByCourseId]);

  useEffect(() => {
    setExamGenerationError(null);
  }, [examFilters, examProgramPlans, globalExamDates, globalExamSelectedRooms, examJobName]);

  useEffect(() => {
    let cancelled = false;

    const loadDraftSummary = async () => {
      try {
        const [draftSummary, confirmedSummary, examDraftSummary, confirmedExamSummary] = await Promise.all([
          listClassDraftSummary(),
          listConfirmedClassScheduleSummary(),
          listExamDraftScheduleSummary(),
          listConfirmedExamScheduleSummary(),
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

        const nextExamDraftMap: Record<string, number> = {};
        for (const draft of examDraftSummary) {
          for (const programValue of draft.program_values) {
            nextExamDraftMap[programValue] = (nextExamDraftMap[programValue] ?? 0) + 1;
          }
        }

        const nextExamConfirmedMap: Record<string, number> = {};
        for (const confirmed of confirmedExamSummary) {
          for (const programValue of confirmed.program_values) {
            nextExamConfirmedMap[programValue] = (nextExamConfirmedMap[programValue] ?? 0) + 1;
          }
        }

        setDraftCountByProgram(nextDraftMap);
        setConfirmedCountByProgram(nextConfirmedMap);
        setExamDraftCountByProgram(nextExamDraftMap);
        setExamConfirmedCountByProgram(nextExamConfirmedMap);
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

    const loadConfirmedClassEntries = async () => {
      const programValue = examFilters.studyProgram;
      if (!programValue) {
        return;
      }

      if (confirmedClassEntriesByProgram[programValue]) {
        return;
      }

      try {
        const draft = await getLatestConfirmedClassSchedule(programValue);
        if (cancelled) {
          return;
        }
        setConfirmedClassEntriesByProgram((prev) => ({
          ...prev,
          [programValue]: draft.entries,
        }));
      } catch {
        if (cancelled) {
          return;
        }
        setConfirmedClassEntriesByProgram((prev) => ({
          ...prev,
          [programValue]: [],
        }));
      }
    };

    void loadConfirmedClassEntries();

    return () => {
      cancelled = true;
    };
  }, [confirmedClassEntriesByProgram, examFilters.studyProgram]);

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

  const canAddExamProgram =
    Boolean(examFilters.studyProgram) &&
    Boolean(examFilters.semester) &&
    Boolean(examFilters.examType) &&
    (selectedExamProgramStatusGroup === null ||
      (selectedExamProgramStatusGroup === 'confirmed'
        ? confirmedExamProgramValueSet.has(examFilters.studyProgram)
        : !confirmedExamProgramValueSet.has(examFilters.studyProgram))) &&
    filteredExamCatalogSubjects.length > 0;

  const addExamProgramPlan = () => {
    if (!canAddExamProgram) {
      return;
    }

    const nextProgramIsConfirmed = confirmedExamProgramValueSet.has(examFilters.studyProgram);
    if (selectedExamProgramStatusGroup === 'confirmed' && !nextProgramIsConfirmed) {
      setExamGenerationError('Cannot mix confirmed-schedule programs with non-confirmed programs in one exam generation batch.');
      return;
    }
    if (selectedExamProgramStatusGroup === 'non-confirmed' && nextProgramIsConfirmed) {
      setExamGenerationError('Cannot mix confirmed-schedule programs with non-confirmed programs in one exam generation batch.');
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
        defaultPreferredWeekdays: [...subject.defaultPreferredWeekdays],
        preferredDateValues: [...subject.defaultPreferredDateValues],
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
                    preferredDateValues: deriveDefaultPreferredDates(nextDates, subject.defaultPreferredWeekdays),
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
                  ? values.length > 0
                    ? { ...subject, preferredDateValues: values, isDateCustom: true }
                    : {
                        ...subject,
                        preferredDateValues: deriveDefaultPreferredDates(
                          globalExamDates,
                          subject.defaultPreferredWeekdays,
                        ),
                        isDateCustom: false,
                      }
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

  const examGenerationProgressPercent = useMemo(() => {
    if (!isGeneratingExamSchedule) {
      return 0;
    }
    const normalized = (examGenerationStatus ?? 'running').toLowerCase();
    if (normalized === 'pending' || normalized === 'queued') {
      return 20;
    }
    if (normalized === 'running') {
      return 70;
    }
    if (normalized === 'succeeded') {
      return 100;
    }
    if (normalized === 'failed') {
      return 100;
    }
    return 50;
  }, [examGenerationStatus, isGeneratingExamSchedule]);

  const examGenerationStatusLabel = useMemo(() => {
    if (!isGeneratingExamSchedule) {
      return null;
    }

    const normalized = (examGenerationStatus ?? 'running').toLowerCase();
    if (normalized === 'pending' || normalized === 'queued') {
      return 'Queued in backend';
    }
    if (normalized === 'running') {
      return 'Generating on backend';
    }
    if (normalized === 'succeeded') {
      return 'Generation completed';
    }
    if (normalized === 'failed') {
      return 'Generation failed';
    }
    return `Backend status: ${examGenerationStatus}`;
  }, [examGenerationStatus, isGeneratingExamSchedule]);

  const examValidationMessage = useMemo(() => {
    if (examGenerationError) {
      return examGenerationError;
    }
    if (!examJobName.trim()) {
      return 'Enter scheduling job name before generation.';
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

    const hasSubjectWithoutTimeslot = examProgramPlans.some((program) =>
      program.years.some((yearPlan) =>
        yearPlan.subjects.some((subject) => subject.preferredTimeSlots.length === 0),
      ),
    );
    if (hasSubjectWithoutTimeslot) {
      return 'Some subjects have no preferred exam slot.';
    }

    return null;
  }, [examGenerationError, examJobName, examProgramPlans, globalExamDates.length, globalExamSelectedRooms.length, totalExamSubjects]);

  const canGenerateExamSchedule =
    examValidationMessage === null;

  const classValidationMessage = useMemo(() => {
    if (classGenerationError) {
      return classGenerationError;
    }
    if (!classJobName.trim()) {
      return 'Enter scheduling job name before generation.';
    }
    if (!selectedStudyProgram) {
      return 'Select a study program before generation.';
    }
    if (selectedProgramCourseCount === 0) {
      return 'No courses found in this program curriculum.';
    }
    if (selectedRooms.length === 0) {
      return 'Select at least one room before generation.';
    }
    return null;
  }, [classGenerationError, classJobName, selectedProgramCourseCount, selectedRooms.length, selectedStudyProgram]);

  const canGenerateClassSchedule = classValidationMessage === null;

  const studyProgramOptionsWithCounts = useMemo(
    () =>
      studyProgramOptions.map((option) => {
        if (!option.value) {
          return option;
        }

        const draftCount = draftCountByProgram[option.value] ?? 0;
        const confirmedCount = confirmedCountByProgram[option.value] ?? 0;
        const statusTokens: string[] = [];

        if (draftCount > 0) {
          statusTokens.push(`${draftCount} draft${draftCount > 1 ? 's' : ''}`);
        }
        if (confirmedCount > 0) {
          statusTokens.push(`${confirmedCount} schedule${confirmedCount > 1 ? 's' : ''}`);
        }

        if (statusTokens.length > 0) {
          return {
            ...option,
            label: `${option.label} (${statusTokens.join(', ')})`,
          };
        }

        return option;
      }),
    [confirmedCountByProgram, draftCountByProgram, studyProgramOptions],
  );

  const handleGenerateClassSchedule = async () => {
    if (classValidationMessage) {
      return;
    }

    try {
      setIsGeneratingClassSchedule(true);
      setClassGenerationError(null);
      const result = await generateClassSchedule({
        job_name: classJobName.trim(),
        program_value: selectedStudyProgram,
        selected_room_names: selectedRooms,
        preferred_timeslot_by_course_id: preferredTimeslotByCourseId,
      });

      if (result.snapshot_id) {
        try {
          sessionStorage.setItem(
            `${CLASS_PREFS_STORAGE_PREFIX}${result.snapshot_id}`,
            JSON.stringify(preferredTimeslotByCourseId),
          );
        } catch {
          // Ignore browser storage issues; schedule generation flow should still continue.
        }
        navigate(`/scheduling-draft?snapshotId=${result.snapshot_id}&jobId=${result.job_id}`);
      }
    } catch (error) {
      const axiosError = error as AxiosError<{ detail?: string }>;
      setClassGenerationError(axiosError.response?.data?.detail ?? 'Failed to generate class schedule. Please try again.');
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
      job_name: examJobName.trim(),
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
    };

    try {
      setIsGeneratingExamSchedule(true);
      setExamGenerationStatus('running');
      setExamGenerationError(null);
      const initialJob = await generateExamSchedule(payload);
      let latestJob = initialJob;
      setExamGenerationStatus(initialJob.status);

      const isTerminalStatus = (status: string) => {
        const normalized = status.toLowerCase();
        return normalized === 'succeeded' || normalized === 'failed';
      };

      if (!isTerminalStatus(initialJob.status)) {
        for (let attempt = 0; attempt < 180; attempt += 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 1000));
          latestJob = await getExamScheduleJob(initialJob.job_id);
          setExamGenerationStatus(latestJob.status);
          if (isTerminalStatus(latestJob.status)) {
            break;
          }
        }
      }

      if (latestJob.status.toLowerCase() === 'failed') {
        setExamGenerationError(latestJob.error_message ?? 'Exam generation failed on backend. Please try again.');
        return;
      }

      if (latestJob.snapshot_id) {
        navigate(`/exam-scheduling-draft?snapshotId=${latestJob.snapshot_id}&jobId=${latestJob.job_id}`);
      } else {
        setExamGenerationError('Exam generation finished without a draft snapshot. Please try again.');
      }
    } catch (error) {
      const axiosError = error as AxiosError<{ detail?: string }>;
      const statusCode = axiosError.response?.status;
      const detail = axiosError.response?.data?.detail;
      if (statusCode === 404) {
        setExamGenerationError('Exam scheduling endpoint is not available yet. Frontend payload wiring is ready.');
      } else {
        setExamGenerationError(detail ?? 'Failed to generate exam schedule. Please try again.');
      }
    } finally {
      setIsGeneratingExamSchedule(false);
      setExamGenerationStatus(null);
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
          classJobName={classJobName}
          setClassJobName={setClassJobName}
          selectedStudyProgram={selectedStudyProgram}
          setSelectedStudyProgram={setSelectedStudyProgram}
          studyProgramOptions={studyProgramOptionsWithCounts}
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
          classValidationMessage={classValidationMessage}
          canGenerateClassSchedule={canGenerateClassSchedule}
          isGenerating={isGeneratingClassSchedule}
          onGenerate={handleGenerateClassSchedule}
        />
      )}

      {activeTab === 'Schedule Exam' && (
        <ScheduleExamTab
          examJobName={examJobName}
          setExamJobName={setExamJobName}
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
          canGenerateExamSchedule={canGenerateExamSchedule}
          totalExamSubjects={totalExamSubjects}
          examValidationMessage={examValidationMessage}
          isGeneratingExamSchedule={isGeneratingExamSchedule}
          examGenerationProgressPercent={examGenerationProgressPercent}
          examGenerationStatusLabel={examGenerationStatusLabel}
          onGenerateExamSchedule={handleGenerateExamSchedule}
        />
      )}

    </>
  );
}
