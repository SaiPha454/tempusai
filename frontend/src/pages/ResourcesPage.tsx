import { useMemo, useState, type ChangeEvent, type Dispatch, type SetStateAction } from 'react';
import { useNavigate } from 'react-router-dom';
import { useResourcesCatalog, type CourseResource } from '../contexts/ResourcesCatalogContext';
import { Tabs } from '../components/Tabs';
import { SpecialEnrollementsSection } from './resources/SpecialEnrollementsSection';
import { RoomsSection } from './resources/RoomsSection';
import { ProgramsSection } from './resources/ProgramsSection';
import { CourseSection } from './resources/CourseSection';
import { TimeslotsSection } from './resources/TimeslotsSection';
import { ProfessorsSection } from './resources/ProfessorsSection';
import { StudentsSection } from './resources/StudentsSection';
import {
  examSubjectCatalog,
  roomCapacityMap,
  roomDirectory,
  studyProgramOptions,
  weekdays,
} from '../data/schedulingData';

type ResourceTab =
  | 'Rooms'
  | 'Programs'
  | 'Course (Subject)'
  | 'Timeslots'
  | 'Professors'
  | 'Students'
  | 'Special Enrollements';

type RoomResource = { id: string; name: string; capacity: string };
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
  'Course (Subject)',
  'Timeslots',
  'Professors',
  'Students',
  'Special Enrollements',
];

const baseSlotLabels = ['9:00 AM - 12:00 PM', '1:00 PM - 4:00 PM', '4:30 PM - 7:30 PM'];
const studyYears = ['1', '2', '3', '4'];

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
const normalizeRoomNameForSort = (value: string) => toRoomName(value).replace(/[^A-Z0-9]/g, '');
const compareRoomNames = (left: string, right: string) =>
  normalizeRoomNameForSort(left).localeCompare(normalizeRoomNameForSort(right), undefined, {
    numeric: true,
    sensitivity: 'base',
  });

export function ResourcesPage() {
  const navigate = useNavigate();
  const { programs, setPrograms, courses, setCourses, professors, setProfessors, timeslots, setTimeslots } = useResourcesCatalog();
  const anyTimeOptionValue = 'any-time';
  const [activeTab, setActiveTab] = useState<ResourceTab>('Rooms');

  const [rooms, setRooms] = useState<RoomResource[]>(
    roomDirectory.slice(0, 8).map((name) => ({ id: generateId(), name, capacity: String(roomCapacityMap[name] ?? '') })),
  );
  const [students, setStudents] = useState<StudentResource[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentResource[]>([]);

  const [roomNameInput, setRoomNameInput] = useState('');
  const [roomCapacityInput, setRoomCapacityInput] = useState('');
  const [programNameInput, setProgramNameInput] = useState('');
  const [courseCodeInput, setCourseCodeInput] = useState('');
  const [courseNameInput, setCourseNameInput] = useState('');
  const [courseProgramInput, setCourseProgramInput] = useState('');
  const [courseFilterProgram, setCourseFilterProgram] = useState('');
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

  const [roomUploadName, setRoomUploadName] = useState('');
  const [courseUploadName, setCourseUploadName] = useState('');
  const [professorUploadName, setProfessorUploadName] = useState('');
  const [studentUploadName, setStudentUploadName] = useState('');
  const [enrollmentUploadName, setEnrollmentUploadName] = useState('');
  const [isRoomNameFocused, setIsRoomNameFocused] = useState(false);
  const [isProgramNameFocused, setIsProgramNameFocused] = useState(false);
  const [editingRoomIds, setEditingRoomIds] = useState<Record<string, boolean>>({});
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
      ...programs.map((item) => ({ value: item.value, label: item.label })),
    ],
    [programs],
  );
  const courseFilterProgramOptions = useMemo(
    () => [{ value: '', label: 'Filter by study program' }, ...programs.map((item) => ({ value: item.value, label: item.label }))],
    [programs],
  );
  const sortedRooms = useMemo(
    () => [...rooms].sort((left, right) => compareRoomNames(left.name, right.name)),
    [rooms],
  );
  const yearOptions = useMemo(
    () => [{ value: '', label: 'Select year' }, ...studyYears.map((year) => ({ value: year, label: `Year ${year}` }))],
    [],
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
    return courses.filter(
      (course) => {
        const byProgram = courseFilterProgram ? course.studyProgram === courseFilterProgram : true;
        const bySearch = normalized
          ? course.code.toLowerCase().includes(normalized) ||
            course.name.toLowerCase().includes(normalized) ||
            (course.studyProgram || '').toLowerCase().includes(normalized)
          : true;

        return byProgram && bySearch;
      },
    );
  }, [courseFilterProgram, courseSearchInput, courses]);

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
          <RoomsSection
            roomUploadName={roomUploadName}
            onRoomUploadNameChange={(event) => handleUploadName(event, setRoomUploadName)}
            roomNameInput={roomNameInput}
            setRoomNameInput={setRoomNameInput}
            roomCapacityInput={roomCapacityInput}
            setRoomCapacityInput={setRoomCapacityInput}
            canAddRoom={canAddRoom}
            setRooms={setRooms}
            generateId={generateId}
            toRoomName={toRoomName}
            sortedRooms={sortedRooms}
            roomSuggestions={roomSuggestions}
            showRoomSuggestions={showRoomSuggestions}
            isRoomNameAlreadyExists={isRoomNameAlreadyExists}
            setIsRoomNameFocused={setIsRoomNameFocused}
            editingRoomIds={editingRoomIds}
            toggleRoomEditing={(id) => toggleEditing(id, setEditingRoomIds)}
          />
        )}

        {activeTab === 'Programs' && (
          <ProgramsSection
            programNameInput={programNameInput}
            setProgramNameInput={setProgramNameInput}
            canAddProgram={canAddProgram}
            programs={programs}
            setPrograms={setPrograms}
            generateId={generateId}
            toTitleCase={toTitleCase}
            toProgramValue={toProgramValue}
            showProgramSuggestions={showProgramSuggestions}
            programSuggestions={programSuggestions}
            setIsProgramNameFocused={setIsProgramNameFocused}
            isProgramAlreadyExists={isProgramAlreadyExists}
            onOpenProgramDetail={(program) =>
              navigate(`/programs/${encodeURIComponent(program.value || toProgramValue(program.label))}`)
            }
          />
        )}

        {activeTab === 'Course (Subject)' && (
          <CourseSection
            courseUploadName={courseUploadName}
            onCourseUploadNameChange={(event) => handleUploadName(event, setCourseUploadName)}
            courseCodeInput={courseCodeInput}
            setCourseCodeInput={setCourseCodeInput}
            courseNameInput={courseNameInput}
            setCourseNameInput={setCourseNameInput}
            courseProgramInput={courseProgramInput}
            setCourseProgramInput={setCourseProgramInput}
            courseSuggestionAnchor={courseSuggestionAnchor}
            setCourseSuggestionAnchor={setCourseSuggestionAnchor}
            showCourseSuggestions={showCourseSuggestions}
            courseSuggestions={courseSuggestions}
            courseProgramOptions={courseProgramOptions}
            isCourseCodeAlreadyExists={isCourseCodeAlreadyExists}
            canAddCourse={canAddCourse}
            addCourse={() => {
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
            courseFilterProgram={courseFilterProgram}
            setCourseFilterProgram={setCourseFilterProgram}
            courseFilterProgramOptions={courseFilterProgramOptions}
            courseSearchInput={courseSearchInput}
            setCourseSearchInput={setCourseSearchInput}
            filteredCourses={filteredCourses}
            editingCourseIds={editingCourseIds}
            toggleCourseEditing={(id) => toggleEditing(id, setEditingCourseIds)}
            updateCourseCode={(id, value) =>
              setCourses((prev) =>
                prev.map((item) => (item.id === id ? { ...item, code: value } : item)),
              )
            }
            updateCourseName={(id, value) =>
              setCourses((prev) =>
                prev.map((item) => (item.id === id ? { ...item, name: value } : item)),
              )
            }
            updateCourseProgram={(id, value) =>
              setCourses((prev) =>
                prev.map((item) => (item.id === id ? { ...item, studyProgram: value } : item)),
              )
            }
            removeCourse={(id) =>
              setCourses((prev) => prev.filter((item) => item.id !== id))
            }
            applyCourseSuggestion={(course) => {
              setCourseCodeInput(course.code);
              setCourseNameInput(course.name);
              setCourseProgramInput(course.studyProgram || '');
            }}
          />
        )}

        {activeTab === 'Timeslots' && (
          <TimeslotsSection
            orderedTimeslotLabels={orderedTimeslotLabels}
            weekdays={weekdays}
            timeslotMap={timeslotMap}
            setTimeslots={setTimeslots}
            generateId={generateId}
          />
        )}

        {activeTab === 'Professors' && (
          <ProfessorsSection
            professorUploadName={professorUploadName}
            onProfessorUploadNameChange={(event) =>
              handleUploadName(event, setProfessorUploadName)
            }
            professorNameInput={professorNameInput}
            setProfessorNameInput={setProfessorNameInput}
            professorAvailabilityInput={professorAvailabilityInput}
            setProfessorAvailabilityInput={setProfessorAvailabilityInput}
            professorSlotOptions={professorSlotOptions}
            anyTimeOptionValue={anyTimeOptionValue}
            canAddProfessor={canAddProfessor}
            addProfessor={() => {
              if (!canAddProfessor) return;
              setProfessors((prev) => [
                ...prev,
                {
                  id: generateId(),
                  name: professorNameInput.trim(),
                  availableSlotIds:
                    professorAvailabilityInput.length > 0
                      ? professorAvailabilityInput
                      : [anyTimeOptionValue],
                },
              ]);
              setProfessorNameInput('');
              setProfessorAvailabilityInput([]);
            }}
            professorSearchInput={professorSearchInput}
            setProfessorSearchInput={setProfessorSearchInput}
            filteredProfessors={filteredProfessors}
            editingProfessorIds={editingProfessorIds}
            toggleProfessorEditing={(id) => toggleEditing(id, setEditingProfessorIds)}
            updateProfessorName={(id, name) =>
              setProfessors((prev) =>
                prev.map((item) => (item.id === id ? { ...item, name } : item)),
              )
            }
            updateProfessorSlots={(id, slotIds) =>
              setProfessors((prev) =>
                prev.map((item) => (item.id === id ? { ...item, availableSlotIds: slotIds } : item)),
              )
            }
            removeProfessor={(id) =>
              setProfessors((prev) => prev.filter((item) => item.id !== id))
            }
          />
        )}

        {activeTab === 'Students' && (
          <StudentsSection
            studentUploadName={studentUploadName}
            onStudentUploadNameChange={(event) => handleUploadName(event, setStudentUploadName)}
            studentIdInput={studentIdInput}
            setStudentIdInput={setStudentIdInput}
            studentNameInput={studentNameInput}
            setStudentNameInput={setStudentNameInput}
            studentYearInput={studentYearInput}
            setStudentYearInput={setStudentYearInput}
            studentProgramInput={studentProgramInput}
            setStudentProgramInput={setStudentProgramInput}
            yearOptions={yearOptions}
            programOptions={programOptions}
            canAddStudent={canAddStudent}
            addStudent={() => {
              if (!canAddStudent) return;
              setStudents((prev) => [
                ...prev,
                {
                  id: generateId(),
                  studentId: studentIdInput.trim(),
                  name: studentNameInput.trim(),
                  studyProgram: studentProgramInput,
                  year: studentYearInput,
                },
              ]);
              setStudentIdInput('');
              setStudentNameInput('');
              setStudentProgramInput('');
              setStudentYearInput('');
            }}
            studentFilterProgram={studentFilterProgram}
            setStudentFilterProgram={setStudentFilterProgram}
            studentFilterYear={studentFilterYear}
            setStudentFilterYear={setStudentFilterYear}
            filteredStudents={filteredStudents}
            editingStudentIds={editingStudentIds}
            toggleStudentEditing={(id) => toggleEditing(id, setEditingStudentIds)}
            updateStudentId={(id, value) =>
              setStudents((prev) =>
                prev.map((item) => (item.id === id ? { ...item, studentId: value } : item)),
              )
            }
            updateStudentName={(id, value) =>
              setStudents((prev) =>
                prev.map((item) => (item.id === id ? { ...item, name: value } : item)),
              )
            }
            updateStudentYear={(id, value) =>
              setStudents((prev) =>
                prev.map((item) => (item.id === id ? { ...item, year: value } : item)),
              )
            }
            updateStudentProgram={(id, value) =>
              setStudents((prev) =>
                prev.map((item) => (item.id === id ? { ...item, studyProgram: value } : item)),
              )
            }
            removeStudent={(id) =>
              setStudents((prev) => prev.filter((item) => item.id !== id))
            }
            programs={programs}
          />
        )}

        {activeTab === 'Special Enrollements' && (
          <SpecialEnrollementsSection
            enrollmentUploadName={enrollmentUploadName}
            onEnrollmentUploadNameChange={(event) => handleUploadName(event, setEnrollmentUploadName)}
            enrollmentStudentIdInput={enrollmentStudentIdInput}
            onEnrollmentStudentIdInputChange={(value) => {
              setEnrollmentStudentIdInput(value);
              const allowedCodes = new Set(getCourseOptionItemsForStudent(value).map((option) => option.value));
              setEnrollmentCourseCodesInput((prev) =>
                prev.filter((courseCode) => allowedCodes.has(courseCode)),
              );
            }}
            enrollmentCourseCodesInput={enrollmentCourseCodesInput}
            onEnrollmentCourseCodesInputChange={setEnrollmentCourseCodesInput}
            studentOptions={studentOptions}
            getCourseOptionItemsForStudent={getCourseOptionItemsForStudent}
            canAddEnrollment={canAddEnrollment}
            onAddEnrollment={() => {
              if (!canAddEnrollment) return;
              setEnrollments((prev) => [
                ...prev,
                {
                  id: generateId(),
                  studentId: enrollmentStudentIdInput,
                  courseCodes: enrollmentCourseCodesInput,
                },
              ]);
              setEnrollmentStudentIdInput('');
              setEnrollmentCourseCodesInput([]);
            }}
            enrollmentFilterProgram={enrollmentFilterProgram}
            onEnrollmentFilterProgramChange={(value) => {
              setEnrollmentFilterProgram(value);
              if (value && enrollmentFilterCourseCode) {
                const validCourseCodes = new Set(
                  courses
                    .filter(
                      (course) =>
                        !course.studyProgram ||
                        course.studyProgram === 'all-programs' ||
                        course.studyProgram === value,
                    )
                    .map((course) => course.code),
                );
                if (!validCourseCodes.has(enrollmentFilterCourseCode)) {
                  setEnrollmentFilterCourseCode('');
                }
              }
            }}
            enrollmentFilterCourseCode={enrollmentFilterCourseCode}
            onEnrollmentFilterCourseCodeChange={setEnrollmentFilterCourseCode}
            programFilterOptions={[
              { value: '', label: 'Filter by study program' },
              ...programOptions.filter((option) => option.value),
            ]}
            enrollmentFilterCourseOptions={enrollmentFilterCourseOptions}
            filteredEnrollments={filteredEnrollments}
            editingEnrollmentIds={editingEnrollmentIds}
            onToggleEnrollmentEditing={(id) => toggleEditing(id, setEditingEnrollmentIds)}
            onEnrollmentStudentChange={(id, value) =>
              setEnrollments((prev) =>
                prev.map((item) => {
                  if (item.id !== id) {
                    return item;
                  }

                  const validCodes = new Set(
                    getCourseOptionItemsForStudent(value).map((option) => option.value),
                  );
                  return {
                    ...item,
                    studentId: value,
                    courseCodes: item.courseCodes.filter((courseCode) => validCodes.has(courseCode)),
                  };
                }),
              )
            }
            onEnrollmentCourseCodesChange={(id, nextCourseCodes) =>
              setEnrollments((prev) =>
                prev.map((item) =>
                  item.id === id ? { ...item, courseCodes: nextCourseCodes } : item,
                ),
              )
            }
            onRemoveEnrollment={(id) =>
              setEnrollments((prev) => prev.filter((item) => item.id !== id))
            }
            students={students}
            courses={courses}
          />
        )}
      </div>
    </div>
  );
}
