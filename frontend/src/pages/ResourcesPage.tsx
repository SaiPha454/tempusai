import { useEffect, useMemo, useRef, useState, type ChangeEvent, type Dispatch, type SetStateAction } from 'react';
import { BookOpen, Building2, CalendarClock, Check, GraduationCap, Pencil, Plus, Trash2, Upload, Users } from 'lucide-react';
import { Card } from '../components/Card';
import { InputField } from '../components/InputField';
import { SelectField } from '../components/SelectField';
import { Tabs } from '../components/Tabs';
import {
  examSubjectCatalog,
  professorDirectory,
  roomCapacityMap,
  roomDirectory,
  studyProgramOptions,
  weekdays,
} from '../data/schedulingData';

type ResourceTab =
  | 'Rooms'
  | 'Programs'
  | 'Year'
  | 'Course (Subject)'
  | 'Timeslots'
  | 'Professors'
  | 'Students'
  | 'Student Enrollments';

type RoomResource = { id: string; name: string; capacity: string };
type ProgramResource = { id: string; value: string; label: string };
type CourseResource = {
  id: string;
  code: string;
  name: string;
  studyProgram: string;
};
type TimeslotResource = { id: string; day: string; label: string };
type ProfessorResource = { id: string; name: string; availableSlotIds: string[] };
type StudentResource = {
  id: string;
  studentId: string;
  name: string;
  studyProgram: string;
  year: string;
};
type EnrollmentResource = {
  id: string;
  studentId: string;
  courseCodes: string[];
};

const resourceTabs: ResourceTab[] = [
  'Rooms',
  'Programs',
  'Year',
  'Course (Subject)',
  'Timeslots',
  'Professors',
  'Students',
  'Student Enrollments',
];

const baseSlotLabels = ['9:00 AM - 12:00 PM', '1:00 PM - 4:00 PM', '4:30 PM - 7:30 PM'];

const generateId = () => crypto.randomUUID();
const toRoomName = (value: string) => value.toUpperCase();
const toTitleCase = (value: string) =>
  value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
const toProgramValue = (label: string) => label.toLowerCase().replace(/\s+/g, '-');

function UploadPanel({
  title,
  description,
  fileName,
  onFileChange,
}: {
  title: string;
  description: string;
  fileName: string;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <Card
      title={title}
      icon={Upload}
      headerRight={
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50">
          Upload Excel
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFileChange} />
        </label>
      }
    >
      <p className="text-sm text-slate-600">{description}</p>
      <p className="mt-2 text-xs text-slate-500">{fileName ? `Latest file: ${fileName}` : 'No file uploaded yet.'}</p>
    </Card>
  );
}

function TimeslotMultiSelect({
  value,
  onChange,
  options,
  placeholder = 'Select available times',
  anyOptionValue,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  anyOptionValue?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const selectedLabels = options
    .filter((option) => value.includes(option.value))
    .map((option) => option.label);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex h-10 w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition hover:border-slate-400 focus:border-[#0A64BC]"
      >
        <span className="truncate text-left">
          {selectedLabels.length > 0 ? selectedLabels.join(', ') : placeholder}
        </span>
        <span className="ml-2 text-xs text-slate-500">{selectedLabels.length}</span>
      </button>

      {isOpen && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
          {options.length === 0 ? (
            <p className="px-2 py-1 text-xs text-slate-500">No timeslots available.</p>
          ) : (
            options.map((option) => {
              const checked = value.includes(option.value);
              return (
                <label key={option.value} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-slate-700 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      if (anyOptionValue && option.value === anyOptionValue) {
                        onChange(checked ? [] : [anyOptionValue]);
                        return;
                      }

                      if (anyOptionValue && value.includes(anyOptionValue)) {
                        const withoutAny = value.filter((item) => item !== anyOptionValue);
                        onChange(checked ? withoutAny.filter((item) => item !== option.value) : [...withoutAny, option.value]);
                        return;
                      }

                      if (checked) {
                        onChange(value.filter((item) => item !== option.value));
                        return;
                      }

                      onChange([...value, option.value]);
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-[#0A64BC] focus:ring-[#0A64BC]"
                  />
                  <span className="truncate">{option.label}</span>
                </label>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export function ResourcesPage() {
  const anyTimeOptionValue = 'any-time';
  const [activeTab, setActiveTab] = useState<ResourceTab>('Rooms');

  const [rooms, setRooms] = useState<RoomResource[]>(
    roomDirectory.slice(0, 8).map((name) => ({ id: generateId(), name, capacity: String(roomCapacityMap[name] ?? '') })),
  );
  const [programs, setPrograms] = useState<ProgramResource[]>(
    studyProgramOptions
      .filter((option) => option.value)
      .map((option) => ({ id: generateId(), value: option.value, label: option.label })),
  );
  const [years, setYears] = useState(['1', '2', '3', '4']);
  const [courses, setCourses] = useState<CourseResource[]>(
    examSubjectCatalog.slice(0, 12).map((course) => ({
      id: generateId(),
      code: course.code,
      name: course.name,
      studyProgram: course.studyProgram,
    })),
  );
  const [timeslots, setTimeslots] = useState<TimeslotResource[]>(
    weekdays.flatMap((day) => baseSlotLabels.map((label) => ({ id: generateId(), day, label }))),
  );
  const [professors, setProfessors] = useState<ProfessorResource[]>(
    professorDirectory.slice(0, 6).map((name) => ({ id: generateId(), name, availableSlotIds: [] })),
  );
  const [students, setStudents] = useState<StudentResource[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentResource[]>([]);

  const [roomNameInput, setRoomNameInput] = useState('');
  const [roomCapacityInput, setRoomCapacityInput] = useState('');
  const [programNameInput, setProgramNameInput] = useState('');
  const [yearInput, setYearInput] = useState('');
  const [courseCodeInput, setCourseCodeInput] = useState('');
  const [courseNameInput, setCourseNameInput] = useState('');
  const [courseProgramInput, setCourseProgramInput] = useState('');
  const [courseSearchInput, setCourseSearchInput] = useState('');
  const [courseSuggestionAnchor, setCourseSuggestionAnchor] = useState<'code' | 'name' | null>(null);
  const [professorNameInput, setProfessorNameInput] = useState('');
  const [professorAvailabilityInput, setProfessorAvailabilityInput] = useState<string[]>([]);
  const [studentIdInput, setStudentIdInput] = useState('');
  const [studentNameInput, setStudentNameInput] = useState('');
  const [studentProgramInput, setStudentProgramInput] = useState('');
  const [studentYearInput, setStudentYearInput] = useState('');
  const [professorSearchInput, setProfessorSearchInput] = useState('');
  const [studentFilterProgram, setStudentFilterProgram] = useState('');
  const [studentFilterYear, setStudentFilterYear] = useState('');
  const [enrollmentFilterProgram, setEnrollmentFilterProgram] = useState('');
  const [enrollmentFilterCourseCode, setEnrollmentFilterCourseCode] = useState('');
  const [enrollmentStudentIdInput, setEnrollmentStudentIdInput] = useState('');
  const [enrollmentCourseCodesInput, setEnrollmentCourseCodesInput] = useState<string[]>([]);

  const [courseUploadName, setCourseUploadName] = useState('');
  const [professorUploadName, setProfessorUploadName] = useState('');
  const [studentUploadName, setStudentUploadName] = useState('');
  const [enrollmentUploadName, setEnrollmentUploadName] = useState('');
  const [isRoomNameFocused, setIsRoomNameFocused] = useState(false);
  const [isProgramNameFocused, setIsProgramNameFocused] = useState(false);
  const [editingRoomIds, setEditingRoomIds] = useState<Record<string, boolean>>({});
  const [editingProgramIds, setEditingProgramIds] = useState<Record<string, boolean>>({});
  const [editingProfessorIds, setEditingProfessorIds] = useState<Record<string, boolean>>({});
  const [editingStudentIds, setEditingStudentIds] = useState<Record<string, boolean>>({});
  const [editingEnrollmentIds, setEditingEnrollmentIds] = useState<Record<string, boolean>>({});
  const [editingCourseIds, setEditingCourseIds] = useState<Record<string, boolean>>({});

  const programOptions = useMemo(
    () => [{ value: '', label: 'Select study program' }, ...programs.map((item) => ({ value: item.value, label: item.label }))],
    [programs],
  );

  const courseProgramOptions = useMemo(
    () => [
      { value: '', label: 'Select study program' },
      { value: 'all-programs', label: 'All programs' },
      ...programs.map((item) => ({ value: item.value, label: item.label })),
    ],
    [programs],
  );
  const yearOptions = useMemo(
    () => [{ value: '', label: 'Select year' }, ...years.map((year) => ({ value: year, label: `Year ${year}` }))],
    [years],
  );
  const studentOptions = useMemo(
    () => [{ value: '', label: 'Select student' }, ...students.map((student) => ({ value: student.studentId, label: `${student.studentId} · ${student.name}` }))],
    [students],
  );
  const slotOptions = useMemo(
    () => timeslots.map((slot) => ({ value: slot.id, label: `${slot.day} · ${slot.label}` })),
    [timeslots],
  );

  const professorSlotOptions = useMemo(
    () => [{ value: anyTimeOptionValue, label: 'Any time' }, ...slotOptions],
    [slotOptions],
  );

  const roomSuggestions = useMemo(() => {
    const normalized = roomNameInput.trim().toLowerCase();
    if (!normalized) {
      return [];
    }

    return Array.from(new Set([...rooms.map((room) => room.name), ...roomDirectory.map((room) => toRoomName(room))]))
      .filter((name) => name.toLowerCase().includes(normalized))
      .slice(0, 6);
  }, [roomNameInput, rooms]);

  const isRoomNameAlreadyExists = useMemo(
    () => rooms.some((room) => room.name.trim().toLowerCase() === roomNameInput.trim().toLowerCase()),
    [roomNameInput, rooms],
  );

  const programSuggestions = useMemo(() => {
    const normalized = programNameInput.trim().toLowerCase();
    if (!normalized) {
      return [];
    }

    return Array.from(new Set([...programs.map((program) => program.label), ...studyProgramOptions.map((option) => toTitleCase(option.label))]))
      .filter((label) => label.toLowerCase().includes(normalized))
      .slice(0, 6);
  }, [programNameInput, programs]);

  const isProgramAlreadyExists = useMemo(() => {
    const normalizedValue = toProgramValue(programNameInput.trim());
    if (!normalizedValue) {
      return false;
    }

    return programs.some((program) => program.value.toLowerCase() === normalizedValue.toLowerCase());
  }, [programNameInput, programs]);

  const courseSuggestionPool = useMemo(() => {
    const merged = [
      ...courses,
      ...examSubjectCatalog.map((course) => ({
        id: `catalog-${course.code}-${course.studyProgram || 'all-programs'}`,
        code: course.code,
        name: course.name,
        studyProgram: course.studyProgram,
      })),
    ];

    const seen = new Set<string>();
    return merged.filter((course) => {
      const key = `${course.code.trim().toLowerCase()}|${course.name.trim().toLowerCase()}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }, [courses]);

  const courseSuggestions = useMemo(() => {
    const normalizedCode = courseCodeInput.trim().toLowerCase();
    const normalizedQuery = normalizedCode;

    if (!normalizedQuery) {
      return [];
    }

    return courseSuggestionPool
      .filter((course) => course.code.toLowerCase().includes(normalizedQuery))
      .slice(0, 6);
  }, [courseCodeInput, courseSuggestionPool]);

  const isCourseCodeAlreadyExists = useMemo(() => {
    const normalized = courseCodeInput.trim().toLowerCase();
    if (!normalized) {
      return false;
    }

    return courses.some((course) => course.code.trim().toLowerCase() === normalized);
  }, [courseCodeInput, courses]);

  const filteredCourses = useMemo(() => {
    const normalized = courseSearchInput.trim().toLowerCase();
    if (!normalized) {
      return courses;
    }

    return courses.filter(
      (course) =>
        course.code.toLowerCase().includes(normalized) ||
        course.name.toLowerCase().includes(normalized) ||
        (course.studyProgram || '').toLowerCase().includes(normalized),
    );
  }, [courseSearchInput, courses]);

  const orderedTimeslotLabels = useMemo(() => {
    const labels = [...baseSlotLabels];
    timeslots.forEach((slot) => {
      if (!labels.includes(slot.label)) {
        labels.push(slot.label);
      }
    });
    return labels;
  }, [timeslots]);

  const timeslotMap = useMemo(
    () =>
      new Map(
        timeslots.map((slot) => [`${slot.day}__${slot.label}`, slot]),
      ),
    [timeslots],
  );

  const canAddRoom = roomNameInput.trim().length > 0 && Number(roomCapacityInput) > 0;
  const canAddProgram = programNameInput.trim().length > 0;
  const canAddYear = yearInput.trim().length > 0;
  const canAddCourse =
    courseCodeInput.trim().length > 0 &&
    courseNameInput.trim().length > 0 &&
    Boolean(courseProgramInput) &&
    !isCourseCodeAlreadyExists;
  const canAddProfessor = professorNameInput.trim().length > 0;
  const canAddStudent =
    studentIdInput.trim().length > 0 &&
    studentNameInput.trim().length > 0 &&
    Boolean(studentProgramInput) &&
    Boolean(studentYearInput);
  const canAddEnrollment =
    Boolean(enrollmentStudentIdInput) &&
    enrollmentCourseCodesInput.length > 0;

  const showRoomSuggestions = isRoomNameFocused && roomNameInput.trim().length > 0;
  const showProgramSuggestions = isProgramNameFocused && programNameInput.trim().length > 0;
  const showCourseSuggestions =
    courseSuggestionAnchor === 'code' && courseCodeInput.trim().length > 0;

  const handleUploadName = (event: ChangeEvent<HTMLInputElement>, setter: (value: string) => void) => {
    setter(event.target.files?.[0]?.name ?? '');
  };

  const toggleEditing = (
    id: string,
    setter: Dispatch<SetStateAction<Record<string, boolean>>>,
  ) => {
    setter((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getCoursesForStudent = (studentId: string) => {
    if (!studentId) {
      return [] as CourseResource[];
    }

    const student = students.find((item) => item.studentId === studentId);
    if (!student) {
      return [] as CourseResource[];
    }

    return courses.filter(
      (course) =>
        !course.studyProgram ||
        course.studyProgram === 'all-programs' ||
        course.studyProgram === student.studyProgram,
    );
  };

  const getCourseOptionsForStudent = (studentId: string) => {
    const baseOption = [{ value: '', label: 'Select course' }];
    const allowedCourses = getCoursesForStudent(studentId);

    return [
      ...baseOption,
      ...allowedCourses.map((course) => ({
        value: course.code,
        label: `${course.code} · ${course.name}`,
      })),
    ];
  };

  const getCourseOptionItemsForStudent = (studentId: string) =>
    getCourseOptionsForStudent(studentId).filter((option) => option.value);

  const filteredProfessors = useMemo(() => {
    const normalized = professorSearchInput.trim().toLowerCase();
    if (!normalized) {
      return professors;
    }

    return professors.filter((professor) => professor.name.toLowerCase().includes(normalized));
  }, [professorSearchInput, professors]);

  const filteredStudents = useMemo(
    () =>
      students.filter((student) => {
        const byProgram = studentFilterProgram ? student.studyProgram === studentFilterProgram : true;
        const byYear = studentFilterYear ? student.year === studentFilterYear : true;
        return byProgram && byYear;
      }),
    [students, studentFilterProgram, studentFilterYear],
  );

  const enrollmentFilterCourseOptions = useMemo(() => {
    const programFilteredCourses = courses.filter((course) => {
      if (!enrollmentFilterProgram) {
        return true;
      }

      return (
        !course.studyProgram ||
        course.studyProgram === 'all-programs' ||
        course.studyProgram === enrollmentFilterProgram
      );
    });

    return [
      { value: '', label: 'Filter by course' },
      ...programFilteredCourses.map((course) => ({
        value: course.code,
        label: `${course.code} · ${course.name}`,
      })),
    ];
  }, [courses, enrollmentFilterProgram]);

  const filteredEnrollments = useMemo(
    () =>
      enrollments.filter((enrollment) => {
        const student = students.find((item) => item.studentId === enrollment.studentId);
        const byProgram = enrollmentFilterProgram
          ? student?.studyProgram === enrollmentFilterProgram
          : true;
        const byCourse = enrollmentFilterCourseCode
          ? enrollment.courseCodes.includes(enrollmentFilterCourseCode)
          : true;
        return byProgram && byCourse;
      }),
    [enrollments, students, enrollmentFilterProgram, enrollmentFilterCourseCode],
  );

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Resources</h1>

      <div className="mt-6">
        <Tabs tabs={resourceTabs} activeTab={activeTab} onChange={(tab) => setActiveTab(tab as ResourceTab)} />
      </div>

      <div className="mt-6 space-y-6 pb-8">
        {activeTab === 'Rooms' && (
          <Card title="Rooms" icon={Building2}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="relative">
                <input
                  value={roomNameInput}
                  onChange={(event) => setRoomNameInput(toRoomName(event.target.value))}
                  onFocus={() => setIsRoomNameFocused(true)}
                  onBlur={() => {
                    setTimeout(() => setIsRoomNameFocused(false), 120);
                  }}
                  placeholder="Room name"
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-[#0A64BC] focus:ring-2 focus:ring-[#0A64BC]/20"
                />

                {showRoomSuggestions && (
                  <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                    {roomSuggestions.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-slate-500">No matching room names found.</p>
                    ) : (
                      roomSuggestions.map((roomName) => (
                        <button
                          key={roomName}
                          type="button"
                          onMouseDown={() => {
                            setRoomNameInput(roomName);
                          }}
                          className="block w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-[#0A64BC]/10 hover:text-[#0A64BC]"
                        >
                          {roomName}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <InputField value={roomCapacityInput} onChange={setRoomCapacityInput} placeholder="Capacity" type="number" />
              <button
                type="button"
                onClick={() => {
                  if (!canAddRoom) return;
                  setRooms((prev) => [...prev, { id: generateId(), name: toRoomName(roomNameInput.trim()), capacity: roomCapacityInput.trim() }]);
                  setRoomNameInput('');
                  setRoomCapacityInput('');
                }}
                disabled={!canAddRoom}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0A64BC] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0959A8] disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <Plus size={16} /> Add Room
              </button>
            </div>

            {isRoomNameAlreadyExists && (
              <p className="mt-2 text-xs text-amber-700">This room already exists in your current list.</p>
            )}

            <div className="mt-5 divide-y divide-slate-200 border-t border-slate-200">
              {rooms.map((room) => (
                <div key={room.id} className="grid grid-cols-1 items-center gap-2 py-3 md:grid-cols-[1fr_180px_auto]">
                  {editingRoomIds[room.id] ? (
                    <input
                      value={room.name}
                      onChange={(event) => setRooms((prev) => prev.map((item) => (item.id === room.id ? { ...item, name: toRoomName(event.target.value) } : item)))}
                      className="h-9 rounded-md border border-slate-300 px-3 text-sm text-slate-800 outline-none focus:border-[#0A64BC]"
                    />
                  ) : (
                    <p className="px-1 text-sm text-slate-800">{room.name || '—'}</p>
                  )}
                  {editingRoomIds[room.id] ? (
                    <input
                      value={room.capacity}
                      type="number"
                      onChange={(event) => setRooms((prev) => prev.map((item) => (item.id === room.id ? { ...item, capacity: event.target.value } : item)))}
                      className="h-9 rounded-md border border-slate-300 px-3 text-sm text-slate-800 outline-none focus:border-[#0A64BC]"
                    />
                  ) : (
                    <p className="px-1 text-sm text-slate-600">Capacity: {room.capacity || '—'}</p>
                  )}
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => toggleEditing(room.id, setEditingRoomIds)}
                      className="inline-flex items-center justify-center rounded p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-[#0A64BC]"
                      aria-label={editingRoomIds[room.id] ? 'Done editing room' : 'Edit room'}
                    >
                      {editingRoomIds[room.id] ? <Check size={14} /> : <Pencil size={14} />}
                    </button>
                    <button type="button" onClick={() => setRooms((prev) => prev.filter((item) => item.id !== room.id))} className="inline-flex items-center justify-center rounded p-1.5 text-rose-700 transition hover:bg-rose-50">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {activeTab === 'Programs' && (
          <Card title="Programs" icon={GraduationCap}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
              <div className="relative">
                <input
                  value={programNameInput}
                  onChange={(event) => setProgramNameInput(toTitleCase(event.target.value))}
                  onFocus={() => setIsProgramNameFocused(true)}
                  onBlur={() => {
                    setTimeout(() => setIsProgramNameFocused(false), 120);
                  }}
                  placeholder="Program name"
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-[#0A64BC] focus:ring-2 focus:ring-[#0A64BC]/20"
                />

                {showProgramSuggestions && (
                  <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                    {programSuggestions.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-slate-500">No matching programs found.</p>
                    ) : (
                      programSuggestions.map((programLabel) => (
                        <button
                          key={programLabel}
                          type="button"
                          onMouseDown={() => {
                            setProgramNameInput(toTitleCase(programLabel));
                          }}
                          className="block w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-[#0A64BC]/10 hover:text-[#0A64BC]"
                        >
                          {programLabel}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!canAddProgram) return;
                  const normalizedLabel = toTitleCase(programNameInput.trim());
                  const value = toProgramValue(normalizedLabel);
                  if (programs.some((item) => item.value === value)) return;
                  setPrograms((prev) => [...prev, { id: generateId(), value, label: normalizedLabel }]);
                  setProgramNameInput('');
                }}
                disabled={!canAddProgram}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0A64BC] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0959A8] disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <Plus size={16} /> Add Program
              </button>
            </div>

            {isProgramAlreadyExists && (
              <p className="mt-2 text-xs text-amber-700">This program already exists in your current list.</p>
            )}

            <div className="mt-5 divide-y divide-slate-200 border-t border-slate-200">
              {programs.map((program) => (
                <div key={program.id} className="grid grid-cols-1 items-center gap-2 py-3 md:grid-cols-[1fr_1fr_auto]">
                  {editingProgramIds[program.id] ? (
                    <input value={program.label} onChange={(event) => setPrograms((prev) => prev.map((item) => (item.id === program.id ? { ...item, label: toTitleCase(event.target.value), value: toProgramValue(toTitleCase(event.target.value)) } : item)))} className="h-9 rounded-md border border-slate-300 px-3 text-sm text-slate-800 outline-none focus:border-[#0A64BC]" />
                  ) : (
                    <p className="px-1 text-sm text-slate-800">{program.label || '—'}</p>
                  )}
                  {editingProgramIds[program.id] ? (
                    <input value={program.value} onChange={(event) => setPrograms((prev) => prev.map((item) => (item.id === program.id ? { ...item, value: toProgramValue(event.target.value) } : item)))} className="h-9 rounded-md border border-slate-300 px-3 text-sm text-slate-800 outline-none focus:border-[#0A64BC]" />
                  ) : (
                    <p className="px-1 text-sm text-slate-600">{program.value || '—'}</p>
                  )}
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => toggleEditing(program.id, setEditingProgramIds)}
                      className="inline-flex items-center justify-center rounded p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-[#0A64BC]"
                      aria-label={editingProgramIds[program.id] ? 'Done editing program' : 'Edit program'}
                    >
                      {editingProgramIds[program.id] ? <Check size={14} /> : <Pencil size={14} />}
                    </button>
                    <button type="button" onClick={() => setPrograms((prev) => prev.filter((item) => item.id !== program.id))} className="inline-flex items-center justify-center rounded p-1.5 text-rose-700 transition hover:bg-rose-50">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {activeTab === 'Year' && (
          <Card title="Year" icon={CalendarClock}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
              <InputField value={yearInput} onChange={setYearInput} placeholder="Year (e.g., 1, 2, 3, 4)" />
              <button
                type="button"
                onClick={() => {
                  if (!canAddYear) return;
                  const nextYear = yearInput.trim();
                  if (years.includes(nextYear)) return;
                  setYears((prev) => [...prev, nextYear].sort((a, b) => Number(a) - Number(b)));
                  setYearInput('');
                }}
                disabled={!canAddYear}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0A64BC] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0959A8] disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <Plus size={16} /> Add Year
              </button>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {years.map((year) => (
                <span key={year} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700">
                  Year {year}
                  <button type="button" onClick={() => setYears((prev) => prev.filter((item) => item !== year))} className="rounded p-0.5 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700">
                    <Trash2 size={12} />
                  </button>
                </span>
              ))}
            </div>
          </Card>
        )}

        {activeTab === 'Course (Subject)' && (
          <div className="space-y-6">
            <UploadPanel title="Course bulk import" description="Upload an Excel file to import courses and subject metadata." fileName={courseUploadName} onFileChange={(event) => handleUploadName(event, setCourseUploadName)} />

            <Card title="Course (Subject)" icon={BookOpen}>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="relative">
                  <input
                    value={courseCodeInput}
                    onChange={(event) => setCourseCodeInput(event.target.value)}
                    onFocus={() => setCourseSuggestionAnchor('code')}
                    onBlur={() => {
                      setTimeout(() => setCourseSuggestionAnchor(null), 120);
                    }}
                    placeholder="Course code (required, e.g. 01286232)"
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-[#0A64BC] focus:ring-2 focus:ring-[#0A64BC]/20"
                  />

                  {showCourseSuggestions && (
                    <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                      {courseSuggestions.length === 0 ? (
                        <p className="px-3 py-2 text-sm text-slate-500">No matching existing courses.</p>
                      ) : (
                        courseSuggestions.map((course) => (
                          <button
                            key={course.id}
                            type="button"
                            onMouseDown={() => {
                              setCourseCodeInput(course.code);
                              setCourseNameInput(course.name);
                              setCourseProgramInput(course.studyProgram || 'all-programs');
                            }}
                            className="block w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-[#0A64BC]/10 hover:text-[#0A64BC]"
                          >
                            {course.code} · {course.name}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="relative">
                  <input
                    value={courseNameInput}
                    onChange={(event) => setCourseNameInput(event.target.value)}
                    placeholder="Course name"
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-[#0A64BC] focus:ring-2 focus:ring-[#0A64BC]/20"
                  />
                </div>

                <SelectField value={courseProgramInput} onChange={setCourseProgramInput} options={courseProgramOptions} />
              </div>

              {isCourseCodeAlreadyExists && (
                <p className="mt-2 text-xs text-amber-700">A course with this code already exists in your current list.</p>
              )}

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    if (!canAddCourse) return;
                    setCourses((prev) => [
                      ...prev,
                      {
                        id: generateId(),
                        code: courseCodeInput.trim(),
                        name: courseNameInput.trim(),
                        studyProgram: courseProgramInput,
                      },
                    ]);
                    setCourseCodeInput('');
                    setCourseNameInput('');
                    setCourseProgramInput('');
                  }}
                  disabled={!canAddCourse}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#0A64BC] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0959A8] disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <Plus size={16} /> Add Course
                </button>
              </div>
            </Card>

            <InputField value={courseSearchInput} onChange={setCourseSearchInput} placeholder="Search existing courses" />

            <div className="divide-y divide-slate-200 border-t border-slate-200">
              {filteredCourses.length === 0 ? (
                <p className="py-4 text-sm text-slate-500">No courses found.</p>
              ) : (
                filteredCourses.map((course) => (
                  <div key={course.id} className="grid grid-cols-1 items-center gap-2 py-3 md:grid-cols-[1fr_1fr_220px_auto]">
                    {editingCourseIds[course.id] ? (
                      <input
                        value={course.code}
                        onChange={(event) =>
                          setCourses((prev) =>
                            prev.map((item) =>
                              item.id === course.id ? { ...item, code: event.target.value } : item,
                            ),
                          )
                        }
                        className="h-9 rounded-md border border-slate-300 px-3 text-sm text-slate-800 outline-none focus:border-[#0A64BC]"
                        placeholder="Course code"
                      />
                    ) : (
                      <p className="px-1 text-sm text-slate-800">{course.code || '—'}</p>
                    )}

                    {editingCourseIds[course.id] ? (
                      <input
                        value={course.name}
                        onChange={(event) =>
                          setCourses((prev) =>
                            prev.map((item) =>
                              item.id === course.id ? { ...item, name: event.target.value } : item,
                            ),
                          )
                        }
                        className="h-9 rounded-md border border-slate-300 px-3 text-sm text-slate-800 outline-none focus:border-[#0A64BC]"
                        placeholder="Course name"
                      />
                    ) : (
                      <p className="px-1 text-sm text-slate-700">{course.name || '—'}</p>
                    )}

                    {editingCourseIds[course.id] ? (
                      <SelectField
                        value={course.studyProgram}
                        onChange={(value) =>
                          setCourses((prev) =>
                            prev.map((item) =>
                              item.id === course.id ? { ...item, studyProgram: value } : item,
                            ),
                          )
                        }
                        options={courseProgramOptions}
                      />
                    ) : (
                      <p className="px-1 text-sm text-slate-600">
                        {courseProgramOptions.find((option) => option.value === course.studyProgram)?.label || course.studyProgram || '—'}
                      </p>
                    )}

                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => toggleEditing(course.id, setEditingCourseIds)}
                        className="inline-flex items-center justify-center rounded p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-[#0A64BC]"
                        aria-label={editingCourseIds[course.id] ? 'Done editing course' : 'Edit course'}
                      >
                        {editingCourseIds[course.id] ? <Check size={14} /> : <Pencil size={14} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCourses((prev) => prev.filter((item) => item.id !== course.id))}
                        className="inline-flex items-center justify-center rounded p-1.5 text-rose-700 transition hover:bg-rose-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'Timeslots' && (
          <Card title="Timeslots" icon={CalendarClock}>
            <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full border-collapse text-sm">
                <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Day</th>
                    {orderedTimeslotLabels.map((label) => (
                      <th key={label} className="px-3 py-2 text-center">{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {weekdays.map((day) => (
                    <tr key={day}>
                      <td className="px-3 py-2 font-medium text-slate-800">{day}</td>
                      {orderedTimeslotLabels.map((label) => {
                        const key = `${day}__${label}`;
                        const slot = timeslotMap.get(key);

                        if (!slot) {
                          return (
                            <td key={label} className="px-2 py-2 text-center align-middle">
                              <button
                                type="button"
                                onClick={() =>
                                  setTimeslots((prev) => [
                                    ...prev,
                                    { id: generateId(), day, label },
                                  ])
                                }
                                className="inline-flex items-center justify-center rounded p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-[#0A64BC]"
                                aria-label={`Add timeslot ${day} ${label}`}
                              >
                                <Plus size={14} />
                              </button>
                            </td>
                          );
                        }

                        return (
                          <td key={label} className="px-2 py-2 align-middle">
                            <div className="flex items-center justify-center gap-1">
                              <span className="text-xs text-slate-600">Set</span>
                              <button
                                type="button"
                                onClick={() => setTimeslots((prev) => prev.filter((item) => item.id !== slot.id))}
                                className="inline-flex items-center justify-center rounded p-1.5 text-rose-700 transition hover:bg-rose-50"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {activeTab === 'Professors' && (
          <div className="space-y-6">
            <UploadPanel title="Professor bulk import" description="Upload an Excel file to import professors and availability data." fileName={professorUploadName} onFileChange={(event) => handleUploadName(event, setProfessorUploadName)} />

            <Card title="Professors" icon={Users}>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <InputField value={professorNameInput} onChange={setProfessorNameInput} placeholder="Professor name" />
                <TimeslotMultiSelect
                  value={professorAvailabilityInput}
                  onChange={setProfessorAvailabilityInput}
                  options={professorSlotOptions}
                  anyOptionValue={anyTimeOptionValue}
                  placeholder="Select available times"
                />
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    if (!canAddProfessor) return;
                    setProfessors((prev) => [...prev, { id: generateId(), name: professorNameInput.trim(), availableSlotIds: professorAvailabilityInput }]);
                    setProfessorNameInput('');
                    setProfessorAvailabilityInput([]);
                  }}
                  disabled={!canAddProfessor}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#0A64BC] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0959A8] disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <Plus size={16} /> Add Professor
                </button>
              </div>
            </Card>

            <InputField value={professorSearchInput} onChange={setProfessorSearchInput} placeholder="Search professors" />

            <div className="divide-y divide-slate-200 border-t border-slate-200">
              {filteredProfessors.map((professor) => (
                <div key={professor.id} className="py-3">
                  <div className="grid grid-cols-1 items-center gap-2 md:grid-cols-[1fr_auto]">
                    {editingProfessorIds[professor.id] ? (
                      <input value={professor.name} onChange={(event) => setProfessors((prev) => prev.map((item) => (item.id === professor.id ? { ...item, name: event.target.value } : item)))} className="h-9 rounded-md border border-slate-300 px-3 text-sm text-slate-800 outline-none focus:border-[#0A64BC]" />
                    ) : (
                      <p className="px-1 text-sm text-slate-800">{professor.name || '—'}</p>
                    )}
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => toggleEditing(professor.id, setEditingProfessorIds)}
                        className="inline-flex items-center justify-center rounded p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-[#0A64BC]"
                        aria-label={editingProfessorIds[professor.id] ? 'Done editing professor' : 'Edit professor'}
                      >
                        {editingProfessorIds[professor.id] ? <Check size={14} /> : <Pencil size={14} />}
                      </button>
                      <button type="button" onClick={() => setProfessors((prev) => prev.filter((item) => item.id !== professor.id))} className="inline-flex items-center justify-center rounded p-1.5 text-rose-700 transition hover:bg-rose-50">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Available times</label>
                    {editingProfessorIds[professor.id] ? (
                      <TimeslotMultiSelect
                        value={professor.availableSlotIds}
                        onChange={(nextSlotIds) =>
                          setProfessors((prev) =>
                            prev.map((item) =>
                              item.id === professor.id
                                ? { ...item, availableSlotIds: nextSlotIds }
                                : item,
                            ),
                          )
                        }
                        options={professorSlotOptions}
                        anyOptionValue={anyTimeOptionValue}
                        placeholder="Select available times"
                      />
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {professor.availableSlotIds.includes(anyTimeOptionValue) ? (
                          <span className="inline-flex items-center rounded-full bg-[#0A64BC]/10 px-2.5 py-1 text-xs font-medium text-[#0A64BC]">
                            Any time
                          </span>
                        ) : professor.availableSlotIds.length > 0 ? (
                          professor.availableSlotIds.map((slotId) => {
                            const label = professorSlotOptions.find((option) => option.value === slotId)?.label ?? slotId;
                            return (
                              <span key={slotId} className="inline-flex items-center rounded-full bg-[#0A64BC]/10 px-2.5 py-1 text-xs font-medium text-[#0A64BC]">
                                {label}
                              </span>
                            );
                          })
                        ) : (
                          <p className="text-sm text-slate-600">No available times selected</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'Students' && (
          <div className="space-y-6">
            <UploadPanel title="Student bulk import" description="Upload an Excel file to import student records." fileName={studentUploadName} onFileChange={(event) => handleUploadName(event, setStudentUploadName)} />

            <Card title="Students" icon={Users}>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <InputField value={studentIdInput} onChange={setStudentIdInput} placeholder="Student ID" />
                <InputField value={studentNameInput} onChange={setStudentNameInput} placeholder="Student name" />
                <SelectField value={studentYearInput} onChange={setStudentYearInput} options={yearOptions} />
                <SelectField value={studentProgramInput} onChange={setStudentProgramInput} options={programOptions} />
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    if (!canAddStudent) return;
                    setStudents((prev) => [...prev, { id: generateId(), studentId: studentIdInput.trim(), name: studentNameInput.trim(), studyProgram: studentProgramInput, year: studentYearInput }]);
                    setStudentIdInput('');
                    setStudentNameInput('');
                    setStudentProgramInput('');
                    setStudentYearInput('');
                  }}
                  disabled={!canAddStudent}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#0A64BC] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0959A8] disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <Plus size={16} /> Add Student
                </button>
              </div>
            </Card>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <SelectField value={studentFilterProgram} onChange={setStudentFilterProgram} options={[{ value: '', label: 'Filter by study program' }, ...programOptions.filter((option) => option.value)]} />
              <SelectField value={studentFilterYear} onChange={setStudentFilterYear} options={[{ value: '', label: 'Filter by year' }, ...yearOptions.filter((option) => option.value)]} />
            </div>

            <div className="divide-y divide-slate-200 border-t border-slate-200">
              {filteredStudents.map((student) => (
                <div key={student.id} className="grid grid-cols-1 gap-2 py-3 md:grid-cols-[160px_1fr_130px_200px_auto]">
                  {editingStudentIds[student.id] ? (
                    <input value={student.studentId} onChange={(event) => setStudents((prev) => prev.map((item) => (item.id === student.id ? { ...item, studentId: event.target.value } : item)))} className="h-9 rounded-md border border-slate-300 px-3 text-sm text-slate-800 outline-none focus:border-[#0A64BC]" />
                  ) : (
                    <p className="px-1 text-sm text-slate-800">{student.studentId || '—'}</p>
                  )}
                  {editingStudentIds[student.id] ? (
                    <input value={student.name} onChange={(event) => setStudents((prev) => prev.map((item) => (item.id === student.id ? { ...item, name: event.target.value } : item)))} className="h-9 rounded-md border border-slate-300 px-3 text-sm text-slate-800 outline-none focus:border-[#0A64BC]" />
                  ) : (
                    <p className="px-1 text-sm text-slate-700">{student.name || '—'}</p>
                  )}
                  {editingStudentIds[student.id] ? (
                    <SelectField value={student.year} onChange={(value) => setStudents((prev) => prev.map((item) => (item.id === student.id ? { ...item, year: value } : item)))} options={yearOptions} />
                  ) : (
                    <p className="px-1 text-sm text-slate-600">Year {student.year || '—'}</p>
                  )}
                  {editingStudentIds[student.id] ? (
                    <SelectField value={student.studyProgram} onChange={(value) => setStudents((prev) => prev.map((item) => (item.id === student.id ? { ...item, studyProgram: value } : item)))} options={programOptions} />
                  ) : (
                    <p className="px-1 text-sm text-slate-600">{programs.find((item) => item.value === student.studyProgram)?.label ?? student.studyProgram ?? '—'}</p>
                  )}
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => toggleEditing(student.id, setEditingStudentIds)}
                      className="inline-flex items-center justify-center rounded p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-[#0A64BC]"
                      aria-label={editingStudentIds[student.id] ? 'Done editing student' : 'Edit student'}
                    >
                      {editingStudentIds[student.id] ? <Check size={14} /> : <Pencil size={14} />}
                    </button>
                    <button type="button" onClick={() => setStudents((prev) => prev.filter((item) => item.id !== student.id))} className="inline-flex items-center justify-center rounded p-1.5 text-rose-700 transition hover:bg-rose-50">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'Student Enrollments' && (
          <div className="space-y-6">
            <UploadPanel title="Enrollment bulk import" description="Upload an Excel file to import student enrollments." fileName={enrollmentUploadName} onFileChange={(event) => handleUploadName(event, setEnrollmentUploadName)} />

            <Card title="Student Enrollments" icon={BookOpen}>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <SelectField
                  value={enrollmentStudentIdInput}
                  onChange={(value) => {
                    setEnrollmentStudentIdInput(value);
                    const allowedCodes = new Set(getCourseOptionItemsForStudent(value).map((option) => option.value));
                    setEnrollmentCourseCodesInput((prev) => prev.filter((courseCode) => allowedCodes.has(courseCode)));
                  }}
                  options={studentOptions}
                />
                <TimeslotMultiSelect
                  value={enrollmentCourseCodesInput}
                  onChange={setEnrollmentCourseCodesInput}
                  options={getCourseOptionItemsForStudent(enrollmentStudentIdInput)}
                  placeholder={enrollmentStudentIdInput ? 'Select courses' : 'Select student first'}
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {enrollmentCourseCodesInput.length > 0 ? (
                  enrollmentCourseCodesInput.map((courseCode) => {
                    const label = courses.find((course) => course.code === courseCode)
                      ? `${courseCode} · ${courses.find((course) => course.code === courseCode)?.name}`
                      : courseCode;
                    return (
                      <span key={courseCode} className="inline-flex items-center gap-1 rounded-full bg-[#0A64BC]/10 px-2.5 py-1 text-xs font-medium text-[#0A64BC]">
                        {label}
                        <button
                          type="button"
                          onClick={() =>
                            setEnrollmentCourseCodesInput((prev) => prev.filter((item) => item !== courseCode))
                          }
                          className="rounded p-0.5 text-[#0A64BC] transition hover:bg-[#0A64BC]/20"
                          aria-label={`Remove ${label}`}
                        >
                          ×
                        </button>
                      </span>
                    );
                  })
                ) : (
                  <p className="text-xs text-slate-500">No courses selected yet.</p>
                )}
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    if (!canAddEnrollment) return;
                    setEnrollments((prev) => [...prev, { id: generateId(), studentId: enrollmentStudentIdInput, courseCodes: enrollmentCourseCodesInput }]);
                    setEnrollmentStudentIdInput('');
                    setEnrollmentCourseCodesInput([]);
                  }}
                  disabled={!canAddEnrollment}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#0A64BC] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0959A8] disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <Plus size={16} /> Add Enrollment
                </button>
              </div>
            </Card>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <SelectField
                value={enrollmentFilterProgram}
                onChange={(value) => {
                  setEnrollmentFilterProgram(value);
                  if (value && enrollmentFilterCourseCode) {
                    const validCourseCodes = new Set(
                      courses
                        .filter((course) => !course.studyProgram || course.studyProgram === 'all-programs' || course.studyProgram === value)
                        .map((course) => course.code),
                    );
                    if (!validCourseCodes.has(enrollmentFilterCourseCode)) {
                      setEnrollmentFilterCourseCode('');
                    }
                  }
                }}
                options={[{ value: '', label: 'Filter by study program' }, ...programOptions.filter((option) => option.value)]}
              />
              <SelectField value={enrollmentFilterCourseCode} onChange={setEnrollmentFilterCourseCode} options={enrollmentFilterCourseOptions} />
            </div>

            <div className="divide-y divide-slate-200 border-t border-slate-200">
              {filteredEnrollments.map((enrollment) => (
                <div key={enrollment.id} className="grid grid-cols-1 gap-2 py-3 md:grid-cols-[1fr_1fr_auto]">
                  {editingEnrollmentIds[enrollment.id] ? (
                    <SelectField
                      value={enrollment.studentId}
                      onChange={(value) =>
                        setEnrollments((prev) =>
                          prev.map((item) => {
                            if (item.id !== enrollment.id) {
                              return item;
                            }

                            const validCodes = new Set(getCourseOptionItemsForStudent(value).map((option) => option.value));
                            return {
                              ...item,
                              studentId: value,
                              courseCodes: item.courseCodes.filter((courseCode) => validCodes.has(courseCode)),
                            };
                          }),
                        )
                      }
                      options={studentOptions}
                    />
                  ) : (
                    <p className="px-1 text-sm text-slate-800">{students.find((student) => student.studentId === enrollment.studentId)?.name ?? enrollment.studentId ?? '—'}</p>
                  )}
                  {editingEnrollmentIds[enrollment.id] ? (
                    <TimeslotMultiSelect
                      value={enrollment.courseCodes}
                      onChange={(nextCourseCodes) =>
                        setEnrollments((prev) =>
                          prev.map((item) =>
                            item.id === enrollment.id
                              ? { ...item, courseCodes: nextCourseCodes }
                              : item,
                          ),
                        )
                      }
                      options={getCourseOptionItemsForStudent(enrollment.studentId)}
                      placeholder="Select enrolled courses"
                    />
                  ) : (
                    <div className="flex flex-wrap gap-2 px-1">
                      {enrollment.courseCodes.length > 0 ? (
                        enrollment.courseCodes.map((courseCode) => {
                          const course = courses.find((item) => item.code === courseCode);
                          return (
                            <span key={`${enrollment.id}-${courseCode}`} className="inline-flex items-center rounded-full bg-[#0A64BC]/10 px-2.5 py-1 text-xs font-medium text-[#0A64BC]">
                              {course ? `${course.code} · ${course.name}` : courseCode}
                            </span>
                          );
                        })
                      ) : (
                        <p className="text-sm text-slate-600">No courses selected</p>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => toggleEditing(enrollment.id, setEditingEnrollmentIds)}
                      className="inline-flex items-center justify-center rounded p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-[#0A64BC]"
                      aria-label={editingEnrollmentIds[enrollment.id] ? 'Done editing enrollment' : 'Edit enrollment'}
                    >
                      {editingEnrollmentIds[enrollment.id] ? <Check size={14} /> : <Pencil size={14} />}
                    </button>
                    <button type="button" onClick={() => setEnrollments((prev) => prev.filter((item) => item.id !== enrollment.id))} className="inline-flex items-center justify-center rounded p-1.5 text-rose-700 transition hover:bg-rose-50">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
