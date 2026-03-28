import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import {
  listCourses,
  listProgramYearRows,
  listPrograms,
  listProfessors,
  listTimeslots,
  type ProgramYearRowDto,
} from '../api/resources';

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

const createBaseYearPlans = (): ProgramYearPlan[] =>
  [1, 2, 3, 4].map((year) => ({ year, courses: [] }));

const mapProgramYearRowsToPlans = (rows: ProgramYearRowDto[]): ProgramYearPlansByProgram => {
  const grouped = rows.reduce<Record<string, ProgramYearPlan[]>>((acc, row) => {
    if (!acc[row.program_value]) {
      acc[row.program_value] = createBaseYearPlans();
    }

    const yearPlan = acc[row.program_value].find((item) => item.year === row.year);
    if (yearPlan) {
      yearPlan.courses.push({
        id: row.id,
        code: row.course_code,
        name: row.course_name,
        professorName: row.professor_name ?? '',
      });
    }

    return acc;
  }, {});

  return grouped;
};

export function ResourcesCatalogProvider({ children }: { children: ReactNode }) {
  const [programs, setPrograms] = useState<ProgramResource[]>([]);
  const [courses, setCourses] = useState<CourseResource[]>([]);
  const [professors, setProfessors] = useState<ProfessorResource[]>([]);
  const [timeslots, setTimeslots] = useState<TimeslotResource[]>([]);
  const [programYearPlans, setProgramYearPlans] = useState<ProgramYearPlansByProgram>({});

  useEffect(() => {
    let isMounted = true;

    const loadCatalog = async () => {
      try {
        const [programList, courseList, professorList, timeslotList, planRows] = await Promise.all([
          listPrograms(),
          listCourses(),
          listProfessors(),
          listTimeslots(),
          listProgramYearRows(),
        ]);

        if (!isMounted) {
          return;
        }

        setPrograms(programList.map((item) => ({ id: item.id, value: item.value, label: item.label })));
        setCourses(
          courseList.map((item) => ({
            id: item.id,
            code: item.code,
            name: item.name,
            studyProgram: item.study_program ?? '',
          })),
        );
        setProfessors(
          professorList.map((item) => ({
            id: item.id,
            name: item.name,
            availableSlotIds: item.available_slot_ids,
          })),
        );
        setTimeslots(timeslotList.map((item) => ({ id: item.id, day: item.day, label: item.label })));
        setProgramYearPlans(mapProgramYearRowsToPlans(planRows));
      } catch (error) {
        console.error('Failed to load resource catalog from backend', error);
      }
    };

    void loadCatalog();

    return () => {
      isMounted = false;
    };
  }, []);

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
