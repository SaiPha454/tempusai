import { createContext, useContext, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { dummyProgramYearPlans } from '../data/programYearPlansDummy';
import { examSubjectCatalog, professorDirectory, studyProgramOptions, weekdays } from '../data/schedulingData';

export type ProgramResource = { id: string; value: string; label: string };
export type CourseResource = {
  id: string;
  code: string;
  name: string;
  studyProgram: string;
};
export type ProfessorResource = { id: string; name: string; availableSlotIds: string[] };
export type TimeslotResource = { id: string; day: string; label: string };
export type ProgramYearCourse = {
  id: string;
  code: string;
  name: string;
  professorName: string;
};
export type ProgramYearPlan = {
  year: number;
  courses: ProgramYearCourse[];
};
export type ProgramYearPlansByProgram = Record<string, ProgramYearPlan[]>;

type ResourcesCatalogContextValue = {
  programs: ProgramResource[];
  setPrograms: Dispatch<SetStateAction<ProgramResource[]>>;
  courses: CourseResource[];
  setCourses: Dispatch<SetStateAction<CourseResource[]>>;
  professors: ProfessorResource[];
  setProfessors: Dispatch<SetStateAction<ProfessorResource[]>>;
  timeslots: TimeslotResource[];
  setTimeslots: Dispatch<SetStateAction<TimeslotResource[]>>;
  programYearPlans: ProgramYearPlansByProgram;
  setProgramYearPlans: Dispatch<SetStateAction<ProgramYearPlansByProgram>>;
};

const ResourcesCatalogContext = createContext<ResourcesCatalogContextValue | undefined>(undefined);

const generateId = () => crypto.randomUUID();
const baseSlotLabels = ['9:00 AM - 12:00 PM', '1:00 PM - 4:00 PM', '4:30 PM - 7:30 PM'];

export function ResourcesCatalogProvider({ children }: { children: ReactNode }) {
  const [programs, setPrograms] = useState<ProgramResource[]>(
    studyProgramOptions
      .filter((option) => option.value)
      .map((option) => ({ id: generateId(), value: option.value, label: option.label })),
  );

  const [courses, setCourses] = useState<CourseResource[]>(
    examSubjectCatalog.slice(0, 12).map((course) => ({
      id: generateId(),
      code: course.code,
      name: course.name,
      studyProgram: course.studyProgram,
    })),
  );

  const [professors, setProfessors] = useState<ProfessorResource[]>(
    professorDirectory.slice(0, 6).map((name) => ({ id: generateId(), name, availableSlotIds: [] })),
  );

  const [timeslots, setTimeslots] = useState<TimeslotResource[]>(
    weekdays.flatMap((day) => baseSlotLabels.map((label) => ({ id: generateId(), day, label }))),
  );

  const [programYearPlans, setProgramYearPlans] = useState<ProgramYearPlansByProgram>(
    () =>
      Object.entries(dummyProgramYearPlans).reduce<ProgramYearPlansByProgram>((acc, [programKey, yearPlans]) => {
        acc[programKey] = yearPlans.map((yearPlan) => ({
          year: yearPlan.year,
          courses: yearPlan.courses.map((course) => ({
            id: course.id,
            code: course.code,
            name: course.name,
            professorName: course.professorName,
          })),
        }));
        return acc;
      }, {}),
  );

  const value = useMemo(
    () => ({
      programs,
      setPrograms,
      courses,
      setCourses,
      professors,
      setProfessors,
      timeslots,
      setTimeslots,
      programYearPlans,
      setProgramYearPlans,
    }),
    [programs, courses, professors, timeslots, programYearPlans],
  );

  return <ResourcesCatalogContext.Provider value={value}>{children}</ResourcesCatalogContext.Provider>;
}

export function useResourcesCatalog() {
  const context = useContext(ResourcesCatalogContext);
  if (!context) {
    throw new Error('useResourcesCatalog must be used within ResourcesCatalogProvider');
  }

  return context;
}
