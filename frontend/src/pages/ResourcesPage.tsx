import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
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
import { weekdays } from '../data/schedulingData';
import {
  createCourse,
  createProfessor,
  createProgram,
  createRoom,
  createSpecialEnrollment,
  createStudent,
  createTimeslot,
  deleteCourse,
  deleteProfessor,
  deleteRoom,
  deleteSpecialEnrollment,
  deleteStudent,
  deleteTimeslot,
  listRooms,
  listSpecialEnrollments,
  listStudents,
  updateCourse,
  updateProfessor,
  updateRoom,
  updateSpecialEnrollment,
  updateStudent,
} from '../api/resources';

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

const baseSlotLabels = ['09:00 AM - 12:00 PM', '01:00 PM - 04:00 PM', '04:30 PM - 07:30 PM'];

const canonicalTimeslotLabel = (label: string): string => {
  const normalized = label.trim();
  const map: Record<string, string> = {
    '09:00 AM - 12:00 PM': '09:00 AM - 12:00 PM',
    '01:00 PM - 04:00 PM': '01:00 PM - 04:00 PM',
    '04:30 PM - 07:30 PM': '04:30 PM - 07:30 PM',
  };
  return map[normalized] ?? normalized;
};
const studyYears = ['1', '2', '3', '4'];

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

  const [rooms, setRooms] = useState<RoomResource[]>([]);
  const [students, setStudents] = useState<StudentResource[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentResource[]>([]);
  const [resourceError, setResourceError] = useState('');

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

  const [isRoomNameFocused, setIsRoomNameFocused] = useState(false);
  const [isProgramNameFocused, setIsProgramNameFocused] = useState(false);
  const [editingRoomIds, setEditingRoomIds] = useState<Record<string, boolean>>({});
  const [editingProfessorIds, setEditingProfessorIds] = useState<Record<string, boolean>>({});
  const [editingStudentIds, setEditingStudentIds] = useState<Record<string, boolean>>({});
  const [editingEnrollmentIds, setEditingEnrollmentIds] = useState<Record<string, boolean>>({});
  const [editingCourseIds, setEditingCourseIds] = useState<Record<string, boolean>>({});

  const reportError = (message: string, error: unknown) => {
    console.error(message, error);
    setResourceError(message);
  };

  useEffect(() => {
    let isMounted = true;

    const loadPageResources = async () => {
      try {
        const [roomList, studentList, enrollmentList] = await Promise.all([
          listRooms(),
          listStudents(),
          listSpecialEnrollments(),
        ]);

        if (!isMounted) {
          return;
        }

        setRooms(roomList.map((room) => ({ id: room.id, name: room.name, capacity: String(room.capacity) })));
        setStudents(
          studentList.map((student) => ({
            id: student.id,
            studentId: student.student_id,
            name: student.name,
            studyProgram: student.study_program,
            year: String(student.year),
          })),
        );
        setEnrollments(
          enrollmentList.map((enrollment) => ({
            id: enrollment.id,
            studentId: enrollment.student_id,
            courseCodes: enrollment.course_codes,
          })),
        );
      } catch (error) {
        reportError('Failed to load resources from backend.', error);
      }
    };

    void loadPageResources();

    return () => {
      isMounted = false;
    };
  }, []);

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

    return Array.from(new Set(rooms.map((room) => room.name)))
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

    return Array.from(new Set(programs.map((program) => program.label)))
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
    const seen = new Set<string>();
    return courses.filter((course) => {
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
      const normalizedLabel = canonicalTimeslotLabel(slot.label);
      if (!labels.includes(normalizedLabel)) {
        labels.push(normalizedLabel);
      }
    });
    return labels;
  }, [timeslots]);

  const timeslotMap = useMemo(
    () =>
      new Map(
        timeslots.map((slot) => [`${slot.day}__${canonicalTimeslotLabel(slot.label)}`, slot]),
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

  const toggleEditing = (id: string, setter: Dispatch<SetStateAction<Record<string, boolean>>>) => {
    setter((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const addRoom = async () => {
    if (!canAddRoom) return;
    try {
      const created = await createRoom({
        name: toRoomName(roomNameInput.trim()),
        capacity: Number(roomCapacityInput),
      });
      setRooms((prev) => [...prev, { id: created.id, name: created.name, capacity: String(created.capacity) }]);
      setRoomNameInput('');
      setRoomCapacityInput('');
      setResourceError('');
    } catch (error) {
      reportError('Failed to create room.', error);
    }
  };

  const removeRoom = async (roomId: string) => {
    try {
      await deleteRoom(roomId);
      setRooms((prev) => prev.filter((item) => item.id !== roomId));
      setResourceError('');
    } catch (error) {
      reportError('Failed to delete room.', error);
    }
  };

  const toggleRoomEditing = async (roomId: string) => {
    const isEditing = Boolean(editingRoomIds[roomId]);
    if (!isEditing) {
      toggleEditing(roomId, setEditingRoomIds);
      return;
    }

    const room = rooms.find((item) => item.id === roomId);
    if (!room) {
      toggleEditing(roomId, setEditingRoomIds);
      return;
    }

    try {
      const updated = await updateRoom(roomId, {
        name: toRoomName(room.name.trim()),
        capacity: Number(room.capacity),
      });
      setRooms((prev) =>
        prev.map((item) =>
          item.id === roomId ? { id: updated.id, name: updated.name, capacity: String(updated.capacity) } : item,
        ),
      );
      setResourceError('');
      toggleEditing(roomId, setEditingRoomIds);
    } catch (error) {
      reportError('Failed to update room.', error);
    }
  };

  const addProgram = async () => {
    if (!canAddProgram) return;
    const normalizedLabel = toTitleCase(programNameInput.trim());
    const value = toProgramValue(normalizedLabel);
    if (programs.some((item) => item.value === value)) return;

    try {
      const created = await createProgram({ label: normalizedLabel, value });
      setPrograms((prev) => [...prev, { id: created.id, value: created.value, label: created.label }]);
      setProgramNameInput('');
      setResourceError('');
    } catch (error) {
      reportError('Failed to create program.', error);
    }
  };

  const addCourse = async () => {
    if (!canAddCourse) return;
    try {
      const created = await createCourse({
        code: courseCodeInput.trim(),
        name: courseNameInput.trim(),
        study_program: courseProgramInput,
      });
      setCourses((prev) => [
        ...prev,
        {
          id: created.id,
          code: created.code,
          name: created.name,
          studyProgram: created.study_program ?? '',
        },
      ]);
      setCourseCodeInput('');
      setCourseNameInput('');
      setCourseProgramInput('');
      setResourceError('');
    } catch (error) {
      reportError('Failed to create course.', error);
    }
  };

  const removeCourseById = async (courseId: string) => {
    try {
      await deleteCourse(courseId);
      setCourses((prev) => prev.filter((item) => item.id !== courseId));
      setResourceError('');
    } catch (error) {
      reportError('Failed to delete course.', error);
    }
  };

  const toggleCourseEditing = async (courseId: string) => {
    const isEditing = Boolean(editingCourseIds[courseId]);
    if (!isEditing) {
      toggleEditing(courseId, setEditingCourseIds);
      return;
    }

    const course = courses.find((item) => item.id === courseId);
    if (!course) {
      toggleEditing(courseId, setEditingCourseIds);
      return;
    }

    try {
      const updated = await updateCourse(courseId, {
        code: course.code.trim(),
        name: course.name.trim(),
        study_program: course.studyProgram || null,
      });
      setCourses((prev) =>
        prev.map((item) =>
          item.id === courseId
            ? {
                id: updated.id,
                code: updated.code,
                name: updated.name,
                studyProgram: updated.study_program ?? '',
              }
            : item,
        ),
      );
      setResourceError('');
      toggleEditing(courseId, setEditingCourseIds);
    } catch (error) {
      reportError('Failed to update course.', error);
    }
  };

  const addTimeslot = async (payload: { day: string; label: string }) => {
    try {
      const created = await createTimeslot(payload);
      setTimeslots((prev) => [...prev, { id: created.id, day: created.day, label: created.label }]);
      setResourceError('');
    } catch (error) {
      reportError('Failed to create timeslot.', error);
    }
  };

  const removeTimeslotById = async (timeslotId: string) => {
    try {
      await deleteTimeslot(timeslotId);
      setTimeslots((prev) => prev.filter((item) => item.id !== timeslotId));
      setResourceError('');
    } catch (error) {
      reportError('Failed to delete timeslot.', error);
    }
  };

  const addProfessor = async () => {
    if (!canAddProfessor) return;
    try {
      const created = await createProfessor({
        name: professorNameInput.trim(),
        available_slot_ids:
          professorAvailabilityInput.length > 0 ? professorAvailabilityInput : [anyTimeOptionValue],
      });
      setProfessors((prev) => [
        ...prev,
        { id: created.id, name: created.name, availableSlotIds: created.available_slot_ids },
      ]);
      setProfessorNameInput('');
      setProfessorAvailabilityInput([]);
      setResourceError('');
    } catch (error) {
      reportError('Failed to create professor.', error);
    }
  };

  const removeProfessorById = async (professorId: string) => {
    try {
      await deleteProfessor(professorId);
      setProfessors((prev) => prev.filter((item) => item.id !== professorId));
      setResourceError('');
    } catch (error) {
      reportError('Failed to delete professor.', error);
    }
  };

  const toggleProfessorEditing = async (professorId: string) => {
    const isEditing = Boolean(editingProfessorIds[professorId]);
    if (!isEditing) {
      toggleEditing(professorId, setEditingProfessorIds);
      return;
    }

    const professor = professors.find((item) => item.id === professorId);
    if (!professor) {
      toggleEditing(professorId, setEditingProfessorIds);
      return;
    }

    try {
      const updated = await updateProfessor(professorId, {
        name: professor.name.trim(),
        available_slot_ids: professor.availableSlotIds,
      });
      setProfessors((prev) =>
        prev.map((item) =>
          item.id === professorId
            ? { id: updated.id, name: updated.name, availableSlotIds: updated.available_slot_ids }
            : item,
        ),
      );
      setResourceError('');
      toggleEditing(professorId, setEditingProfessorIds);
    } catch (error) {
      reportError('Failed to update professor.', error);
    }
  };

  const addStudent = async () => {
    if (!canAddStudent) return;

    try {
      const created = await createStudent({
        student_id: studentIdInput.trim(),
        name: studentNameInput.trim(),
        study_program: studentProgramInput,
        year: Number(studentYearInput),
      });
      setStudents((prev) => [
        ...prev,
        {
          id: created.id,
          studentId: created.student_id,
          name: created.name,
          studyProgram: created.study_program,
          year: String(created.year),
        },
      ]);
      setStudentIdInput('');
      setStudentNameInput('');
      setStudentProgramInput('');
      setStudentYearInput('');
      setResourceError('');
    } catch (error) {
      reportError('Failed to create student.', error);
    }
  };

  const removeStudentById = async (studentPk: string) => {
    try {
      await deleteStudent(studentPk);
      setStudents((prev) => prev.filter((item) => item.id !== studentPk));
      setResourceError('');
    } catch (error) {
      reportError('Failed to delete student.', error);
    }
  };

  const toggleStudentEditing = async (studentPk: string) => {
    const isEditing = Boolean(editingStudentIds[studentPk]);
    if (!isEditing) {
      toggleEditing(studentPk, setEditingStudentIds);
      return;
    }

    const student = students.find((item) => item.id === studentPk);
    if (!student) {
      toggleEditing(studentPk, setEditingStudentIds);
      return;
    }

    try {
      const updated = await updateStudent(studentPk, {
        student_id: student.studentId.trim(),
        name: student.name.trim(),
        study_program: student.studyProgram,
        year: Number(student.year),
      });
      setStudents((prev) =>
        prev.map((item) =>
          item.id === studentPk
            ? {
                id: updated.id,
                studentId: updated.student_id,
                name: updated.name,
                studyProgram: updated.study_program,
                year: String(updated.year),
              }
            : item,
        ),
      );
      setResourceError('');
      toggleEditing(studentPk, setEditingStudentIds);
    } catch (error) {
      reportError('Failed to update student.', error);
    }
  };

  const addEnrollment = async () => {
    if (!canAddEnrollment) return;
    try {
      const created = await createSpecialEnrollment({
        student_id: enrollmentStudentIdInput,
        course_codes: enrollmentCourseCodesInput,
      });
      setEnrollments((prev) => [
        ...prev,
        { id: created.id, studentId: created.student_id, courseCodes: created.course_codes },
      ]);
      setEnrollmentStudentIdInput('');
      setEnrollmentCourseCodesInput([]);
      setResourceError('');
    } catch (error) {
      reportError('Failed to create special enrollment.', error);
    }
  };

  const removeEnrollmentById = async (enrollmentId: string) => {
    try {
      await deleteSpecialEnrollment(enrollmentId);
      setEnrollments((prev) => prev.filter((item) => item.id !== enrollmentId));
      setResourceError('');
    } catch (error) {
      reportError('Failed to delete special enrollment.', error);
    }
  };

  const toggleEnrollmentEditing = async (enrollmentId: string) => {
    const isEditing = Boolean(editingEnrollmentIds[enrollmentId]);
    if (!isEditing) {
      toggleEditing(enrollmentId, setEditingEnrollmentIds);
      return;
    }

    const enrollment = enrollments.find((item) => item.id === enrollmentId);
    if (!enrollment) {
      toggleEditing(enrollmentId, setEditingEnrollmentIds);
      return;
    }

    try {
      const updated = await updateSpecialEnrollment(enrollmentId, {
        student_id: enrollment.studentId,
        course_codes: enrollment.courseCodes,
      });
      setEnrollments((prev) =>
        prev.map((item) =>
          item.id === enrollmentId
            ? { id: updated.id, studentId: updated.student_id, courseCodes: updated.course_codes }
            : item,
        ),
      );
      setResourceError('');
      toggleEditing(enrollmentId, setEditingEnrollmentIds);
    } catch (error) {
      reportError('Failed to update special enrollment.', error);
    }
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
      {resourceError && (
        <p className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {resourceError}
        </p>
      )}

      <div className="mt-6">
        <Tabs tabs={resourceTabs} activeTab={activeTab} onChange={(tab) => setActiveTab(tab as ResourceTab)} />
      </div>

      <div className="mt-6 space-y-6 pb-8">
        {activeTab === 'Rooms' && (
          <RoomsSection
            roomNameInput={roomNameInput}
            setRoomNameInput={setRoomNameInput}
            roomCapacityInput={roomCapacityInput}
            setRoomCapacityInput={setRoomCapacityInput}
            canAddRoom={canAddRoom}
            onAddRoom={addRoom}
            onRemoveRoom={removeRoom}
            setRooms={setRooms}
            toRoomName={toRoomName}
            sortedRooms={sortedRooms}
            roomSuggestions={roomSuggestions}
            showRoomSuggestions={showRoomSuggestions}
            isRoomNameAlreadyExists={isRoomNameAlreadyExists}
            setIsRoomNameFocused={setIsRoomNameFocused}
            editingRoomIds={editingRoomIds}
            toggleRoomEditing={toggleRoomEditing}
          />
        )}

        {activeTab === 'Programs' && (
          <ProgramsSection
            programNameInput={programNameInput}
            setProgramNameInput={setProgramNameInput}
            canAddProgram={canAddProgram}
            programs={programs}
            toTitleCase={toTitleCase}
            showProgramSuggestions={showProgramSuggestions}
            programSuggestions={programSuggestions}
            setIsProgramNameFocused={setIsProgramNameFocused}
            isProgramAlreadyExists={isProgramAlreadyExists}
            onAddProgram={addProgram}
            onOpenProgramDetail={(program) =>
              navigate(`/programs/${encodeURIComponent(program.value || toProgramValue(program.label))}`)
            }
          />
        )}

        {activeTab === 'Course (Subject)' && (
          <CourseSection
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
            addCourse={() => void addCourse()}
            courseFilterProgram={courseFilterProgram}
            setCourseFilterProgram={setCourseFilterProgram}
            courseFilterProgramOptions={courseFilterProgramOptions}
            courseSearchInput={courseSearchInput}
            setCourseSearchInput={setCourseSearchInput}
            filteredCourses={filteredCourses}
            editingCourseIds={editingCourseIds}
            toggleCourseEditing={(id) => void toggleCourseEditing(id)}
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
            removeCourse={(id) => void removeCourseById(id)}
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
            onAddTimeslot={(payload) => void addTimeslot(payload)}
            onRemoveTimeslot={(timeslotId) => void removeTimeslotById(timeslotId)}
          />
        )}

        {activeTab === 'Professors' && (
          <ProfessorsSection
            professorNameInput={professorNameInput}
            setProfessorNameInput={setProfessorNameInput}
            professorAvailabilityInput={professorAvailabilityInput}
            setProfessorAvailabilityInput={setProfessorAvailabilityInput}
            professorSlotOptions={professorSlotOptions}
            anyTimeOptionValue={anyTimeOptionValue}
            canAddProfessor={canAddProfessor}
            addProfessor={() => void addProfessor()}
            professorSearchInput={professorSearchInput}
            setProfessorSearchInput={setProfessorSearchInput}
            filteredProfessors={filteredProfessors}
            editingProfessorIds={editingProfessorIds}
            toggleProfessorEditing={(id) => void toggleProfessorEditing(id)}
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
            removeProfessor={(id) => void removeProfessorById(id)}
          />
        )}

        {activeTab === 'Students' && (
          <StudentsSection
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
            addStudent={() => void addStudent()}
            studentFilterProgram={studentFilterProgram}
            setStudentFilterProgram={setStudentFilterProgram}
            studentFilterYear={studentFilterYear}
            setStudentFilterYear={setStudentFilterYear}
            filteredStudents={filteredStudents}
            editingStudentIds={editingStudentIds}
            toggleStudentEditing={(id) => void toggleStudentEditing(id)}
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
            removeStudent={(id) => void removeStudentById(id)}
            programs={programs}
          />
        )}

        {activeTab === 'Special Enrollements' && (
          <SpecialEnrollementsSection
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
            onAddEnrollment={() => void addEnrollment()}
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
            onToggleEnrollmentEditing={(id) => void toggleEnrollmentEditing(id)}
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
            onRemoveEnrollment={(id) => void removeEnrollmentById(id)}
            students={students}
            courses={courses}
          />
        )}
      </div>
    </div>
  );
}
