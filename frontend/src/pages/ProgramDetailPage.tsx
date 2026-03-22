import { ArrowLeft, BookOpen, Check, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card } from '../components/Card';
import { useResourcesCatalog } from '../contexts/ResourcesCatalogContext';

type YearCourse = {
  id: string;
  code: string;
  name: string;
  professorName: string;
};

type YearPlan = {
  year: number;
  courses: YearCourse[];
};

type CourseOption = {
  code: string;
  name: string;
};

type AddCourseDraft = {
  courseCode: string;
  courseName: string;
  professorName: string;
};

const generateId = () => crypto.randomUUID();
const toProgramValue = (value: string) => value.toLowerCase().replace(/\s+/g, '-');

function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  options: string[];
  placeholder: string;
}) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return options.slice(0, 8);
    }

    return options.filter((option) => option.toLowerCase().includes(normalized)).slice(0, 8);
  }, [options, query]);

  const displayValue = isOpen ? query : value;

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-slate-400">
        <Search size={14} />
      </div>
      <input
        value={displayValue}
        onFocus={() => {
          setIsOpen(true);
          setQuery('');
        }}
        onBlur={() => {
          setTimeout(() => {
            setIsOpen(false);
            setQuery('');
          }, 120);
        }}
        onChange={(event) => {
          setIsOpen(true);
          setQuery(event.target.value);
          if (!event.target.value.trim()) {
            onChange('');
          }
        }}
        placeholder={placeholder}
        className="h-9 w-full rounded-md border border-slate-300 bg-white pl-8 pr-3 text-sm text-slate-800 outline-none transition focus:border-[#0A64BC]"
      />

      {isOpen && (
        <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {filteredOptions.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-500">No options found.</p>
          ) : (
            filteredOptions.map((option) => (
              <button
                key={option}
                type="button"
                onMouseDown={() => {
                  onChange(option);
                  setQuery('');
                  setIsOpen(false);
                }}
                className="block w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-[#0A64BC]/10 hover:text-[#0A64BC]"
              >
                {option}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function buildInitialPlan(): YearPlan[] {
  return [1, 2, 3, 4].map((year) => ({ year, courses: [] }));
}

export function ProgramDetailPage() {
  const navigate = useNavigate();
  const { programId } = useParams<{ programId: string }>();
  const { programs, courses, professors, programYearPlans, setProgramYearPlans } = useResourcesCatalog();

  const normalizedProgramId = useMemo(() => toProgramValue(decodeURIComponent(programId ?? '')), [programId]);

  const program = useMemo(
    () => programs.find((item) => toProgramValue(item.value || item.label) === normalizedProgramId),
    [programs, normalizedProgramId],
  );

  const programLabel = program?.label || decodeURIComponent(programId ?? 'Program');
  const programValue = program?.value || normalizedProgramId;

  const courseOptions = useMemo(() => {
    const allowed = courses.filter(
      (course) => !course.studyProgram || course.studyProgram === 'all-programs' || course.studyProgram === programValue,
    );

    const map = new Map<string, CourseOption>();
    allowed.forEach((course) => {
      if (!map.has(course.code)) {
        map.set(course.code, { code: course.code, name: course.name });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [courses, programValue]);

  const professorNames = useMemo(
    () => Array.from(new Set(professors.map((item) => item.name).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [professors],
  );

  useEffect(() => {
    if (!programValue) {
      return;
    }

    setProgramYearPlans((prev) =>
      prev[programValue]
        ? prev
        : {
            ...prev,
            [programValue]: buildInitialPlan(),
          },
    );
  }, [programValue, setProgramYearPlans]);

  const yearPlans = programYearPlans[programValue] ?? buildInitialPlan();
  const [editingCourseIds, setEditingCourseIds] = useState<Record<string, boolean>>({});
  const [addDrafts, setAddDrafts] = useState<Record<number, AddCourseDraft>>({
    1: { courseCode: '', courseName: '', professorName: '' },
    2: { courseCode: '', courseName: '', professorName: '' },
    3: { courseCode: '', courseName: '', professorName: '' },
    4: { courseCode: '', courseName: '', professorName: '' },
  });

  const courseCodeOptions = useMemo(() => courseOptions.map((item) => item.code), [courseOptions]);
  const courseNameOptions = useMemo(() => courseOptions.map((item) => item.name), [courseOptions]);

  const findCourseByCode = (code: string) => courseOptions.find((item) => item.code === code);
  const findCourseByName = (name: string) => courseOptions.find((item) => item.name === name);

  const setYearPlans = (updater: (prev: YearPlan[]) => YearPlan[]) => {
    setProgramYearPlans((prev) => ({
      ...prev,
      [programValue]: updater(prev[programValue] ?? buildInitialPlan()),
    }));
  };

  const updateCourseInYear = (year: number, courseId: string, updater: (course: YearCourse) => YearCourse) => {
    setYearPlans((prev) =>
      prev.map((item) =>
        item.year === year
          ? {
              ...item,
              courses: item.courses.map((course) => (course.id === courseId ? updater(course) : course)),
            }
          : item,
      ),
    );
  };

  return (
    <div className="mx-auto w-full max-w-6xl pb-8">
      <button
        type="button"
        onClick={() => navigate('/resources')}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
      >
        <ArrowLeft size={14} /> Back to Resources
      </button>

      <div className="mt-4">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{programLabel}</h1>
        <p className="mt-1 text-sm text-slate-500">Manage yearly study plan, courses, and professor assignments.</p>
      </div>

      <div className="mt-6 space-y-5">
        {yearPlans.map((yearPlan) => {
          const draft = addDrafts[yearPlan.year] ?? { courseCode: '', courseName: '', professorName: '' };
          const canAddCourse = Boolean(draft.courseCode && draft.courseName && draft.professorName);

          return (
            <Card key={yearPlan.year} title={`Year ${yearPlan.year}`} icon={BookOpen}>
              <div className="divide-y divide-slate-200 border-t border-slate-200">
                {yearPlan.courses.length === 0 ? (
                  <p className="py-4 text-sm text-slate-500">No courses in this year yet.</p>
                ) : (
                  yearPlan.courses.map((course) => {
                    const isEditing = Boolean(editingCourseIds[course.id]);
                    return (
                      <div key={course.id} className="py-3">
                        {isEditing ? (
                          <div className="grid grid-cols-1 gap-2 md:grid-cols-[160px_1fr_280px_auto_auto]">
                            <SearchableSelect
                              value={course.code}
                              onChange={(selectedCode) => {
                                const selected = findCourseByCode(selectedCode);
                                if (!selected) {
                                  return;
                                }

                                updateCourseInYear(yearPlan.year, course.id, (current) => ({
                                  ...current,
                                  code: selected.code,
                                  name: selected.name,
                                }));
                              }}
                              options={courseCodeOptions}
                              placeholder="Search course code"
                            />

                            <SearchableSelect
                              value={course.name}
                              onChange={(selectedName) => {
                                const selected = findCourseByName(selectedName);
                                if (!selected) {
                                  return;
                                }

                                updateCourseInYear(yearPlan.year, course.id, (current) => ({
                                  ...current,
                                  code: selected.code,
                                  name: selected.name,
                                }));
                              }}
                              options={courseNameOptions}
                              placeholder="Search course name"
                            />

                            <SearchableSelect
                              value={course.professorName}
                              onChange={(professorName) =>
                                updateCourseInYear(yearPlan.year, course.id, (current) => ({
                                  ...current,
                                  professorName,
                                }))
                              }
                              options={professorNames}
                              placeholder="Search professor"
                            />

                            <button
                              type="button"
                              onClick={() =>
                                setEditingCourseIds((prev) => ({
                                  ...prev,
                                  [course.id]: false,
                                }))
                              }
                              className="inline-flex h-9 items-center justify-center rounded-md p-2 text-slate-600 transition hover:bg-slate-100 hover:text-[#0A64BC]"
                              aria-label="Done editing"
                            >
                              <Check size={15} />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setYearPlans((prev) =>
                                  prev.map((item) =>
                                    item.year === yearPlan.year
                                      ? {
                                          ...item,
                                          courses: item.courses.filter((row) => row.id !== course.id),
                                        }
                                      : item,
                                  ),
                                )
                              }
                              className="inline-flex h-9 items-center justify-center rounded-md p-2 text-rose-700 transition hover:bg-rose-50"
                              aria-label="Remove course"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 items-center gap-2 md:grid-cols-[160px_1fr_280px_auto_auto]">
                            <p className="text-sm font-medium text-slate-800">{course.code || '—'}</p>
                            <p className="text-sm text-slate-700">{course.name || '—'}</p>
                            <p className="text-sm text-slate-600">{course.professorName || 'Unassigned'}</p>
                            <button
                              type="button"
                              onClick={() =>
                                setEditingCourseIds((prev) => ({
                                  ...prev,
                                  [course.id]: true,
                                }))
                              }
                              className="inline-flex h-8 w-8 items-center justify-center rounded p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-[#0A64BC]"
                              aria-label="Edit course row"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setYearPlans((prev) =>
                                  prev.map((item) =>
                                    item.year === yearPlan.year
                                      ? {
                                          ...item,
                                          courses: item.courses.filter((row) => row.id !== course.id),
                                        }
                                      : item,
                                  ),
                                )
                              }
                              className="inline-flex h-8 w-8 items-center justify-center rounded p-1.5 text-rose-700 transition hover:bg-rose-50"
                              aria-label="Remove course"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Add Course</p>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-[220px_1fr_280px_auto]">
                  <SearchableSelect
                    value={draft.courseCode}
                    onChange={(selectedCode) => {
                      const selected = findCourseByCode(selectedCode);
                      if (!selected) {
                        return;
                      }

                      setAddDrafts((prev) => ({
                        ...prev,
                        [yearPlan.year]: {
                          ...prev[yearPlan.year],
                          courseCode: selected.code,
                          courseName: selected.name,
                        },
                      }));
                    }}
                    options={courseCodeOptions}
                    placeholder="Select course code"
                  />

                  <SearchableSelect
                    value={draft.courseName}
                    onChange={(selectedName) => {
                      const selected = findCourseByName(selectedName);
                      if (!selected) {
                        return;
                      }

                      setAddDrafts((prev) => ({
                        ...prev,
                        [yearPlan.year]: {
                          ...prev[yearPlan.year],
                          courseCode: selected.code,
                          courseName: selected.name,
                        },
                      }));
                    }}
                    options={courseNameOptions}
                    placeholder="Select course name"
                  />

                  <SearchableSelect
                    value={draft.professorName}
                    onChange={(professorName) =>
                      setAddDrafts((prev) => ({
                        ...prev,
                        [yearPlan.year]: {
                          ...prev[yearPlan.year],
                          professorName,
                        },
                      }))
                    }
                    options={professorNames}
                    placeholder="Select professor"
                  />

                  <button
                    type="button"
                    disabled={!canAddCourse}
                    onClick={() => {
                      if (!canAddCourse) {
                        return;
                      }

                      setYearPlans((prev) =>
                        prev.map((item) =>
                          item.year === yearPlan.year
                            ? {
                                ...item,
                                courses: [
                                  ...item.courses,
                                  {
                                    id: generateId(),
                                    code: draft.courseCode,
                                    name: draft.courseName,
                                    professorName: draft.professorName,
                                  },
                                ],
                              }
                            : item,
                        ),
                      );

                      setAddDrafts((prev) => ({
                        ...prev,
                        [yearPlan.year]: {
                          courseCode: '',
                          courseName: '',
                          professorName: '',
                        },
                      }));
                    }}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#0A64BC] px-3 text-sm font-medium text-white transition hover:bg-[#0959A8] disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    <Plus size={14} /> Add
                  </button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
