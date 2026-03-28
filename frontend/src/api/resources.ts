import { apiClient } from './client';

export type ProgramDto = { id: string; value: string; label: string };
export type CourseDto = { id: string; code: string; name: string; study_program: string | null };
export type RoomDto = { id: string; name: string; capacity: number };
export type TimeslotDto = { id: string; day: string; label: string };
export type ProfessorDto = { id: string; name: string; available_slot_ids: string[] };
export type StudentDto = {
  id: string;
  student_id: string;
  name: string;
  study_program: string;
  year: number;
};
export type SpecialEnrollmentDto = { id: string; student_id: string; course_codes: string[] };
export type ProgramYearRowDto = {
  id: string;
  program_value: string;
  year: number;
  course_code: string;
  course_name: string;
  professor_name: string | null;
};

const basePath = '/resources';

export async function listPrograms() {
  const response = await apiClient.get<ProgramDto[]>(`${basePath}/programs`);
  return response.data;
}

export async function createProgram(payload: { label: string; value?: string | null }) {
  const response = await apiClient.post<ProgramDto>(`${basePath}/programs`, payload);
  return response.data;
}

export async function updateProgram(programId: string, payload: { label: string; value?: string | null }) {
  const response = await apiClient.put<ProgramDto>(`${basePath}/programs/${programId}`, payload);
  return response.data;
}

export async function deleteProgram(programId: string) {
  await apiClient.delete(`${basePath}/programs/${programId}`);
}

export async function listCourses(params?: { study_program?: string; search?: string }) {
  const response = await apiClient.get<CourseDto[]>(`${basePath}/courses`, { params });
  return response.data;
}

export async function createCourse(payload: {
  code: string;
  name: string;
  study_program?: string | null;
}) {
  const response = await apiClient.post<CourseDto>(`${basePath}/courses`, payload);
  return response.data;
}

export async function updateCourse(
  courseId: string,
  payload: { code: string; name: string; study_program?: string | null },
) {
  const response = await apiClient.put<CourseDto>(`${basePath}/courses/${courseId}`, payload);
  return response.data;
}

export async function deleteCourse(courseId: string) {
  await apiClient.delete(`${basePath}/courses/${courseId}`);
}

export async function listRooms() {
  const response = await apiClient.get<RoomDto[]>(`${basePath}/rooms`);
  return response.data;
}

export async function createRoom(payload: { name: string; capacity: number }) {
  const response = await apiClient.post<RoomDto>(`${basePath}/rooms`, payload);
  return response.data;
}

export async function updateRoom(roomId: string, payload: { name: string; capacity: number }) {
  const response = await apiClient.put<RoomDto>(`${basePath}/rooms/${roomId}`, payload);
  return response.data;
}

export async function deleteRoom(roomId: string) {
  await apiClient.delete(`${basePath}/rooms/${roomId}`);
}

export async function listTimeslots() {
  const response = await apiClient.get<TimeslotDto[]>(`${basePath}/timeslots`);
  return response.data;
}

export async function createTimeslot(payload: { day: string; label: string }) {
  const response = await apiClient.post<TimeslotDto>(`${basePath}/timeslots`, payload);
  return response.data;
}

export async function updateTimeslot(timeslotId: string, payload: { day: string; label: string }) {
  const response = await apiClient.put<TimeslotDto>(`${basePath}/timeslots/${timeslotId}`, payload);
  return response.data;
}

export async function deleteTimeslot(timeslotId: string) {
  await apiClient.delete(`${basePath}/timeslots/${timeslotId}`);
}

export async function listProfessors(params?: { search?: string }) {
  const response = await apiClient.get<ProfessorDto[]>(`${basePath}/professors`, { params });
  return response.data;
}

export async function createProfessor(payload: { name: string; available_slot_ids: string[] }) {
  const response = await apiClient.post<ProfessorDto>(`${basePath}/professors`, payload);
  return response.data;
}

export async function updateProfessor(
  professorId: string,
  payload: { name: string; available_slot_ids: string[] },
) {
  const response = await apiClient.put<ProfessorDto>(`${basePath}/professors/${professorId}`, payload);
  return response.data;
}

export async function deleteProfessor(professorId: string) {
  await apiClient.delete(`${basePath}/professors/${professorId}`);
}

export async function listStudents(params?: { study_program?: string; year?: number }) {
  const response = await apiClient.get<StudentDto[]>(`${basePath}/students`, { params });
  return response.data;
}

export async function createStudent(payload: {
  student_id: string;
  name: string;
  study_program: string;
  year: number;
}) {
  const response = await apiClient.post<StudentDto>(`${basePath}/students`, payload);
  return response.data;
}

export async function updateStudent(
  studentPk: string,
  payload: { student_id: string; name: string; study_program: string; year: number },
) {
  const response = await apiClient.put<StudentDto>(`${basePath}/students/${studentPk}`, payload);
  return response.data;
}

export async function deleteStudent(studentPk: string) {
  await apiClient.delete(`${basePath}/students/${studentPk}`);
}

export async function listSpecialEnrollments(params?: { study_program?: string; course_code?: string }) {
  const response = await apiClient.get<SpecialEnrollmentDto[]>(`${basePath}/special-enrollments`, {
    params,
  });
  return response.data;
}

export async function createSpecialEnrollment(payload: {
  student_id: string;
  course_codes: string[];
}) {
  const response = await apiClient.post<SpecialEnrollmentDto>(`${basePath}/special-enrollments`, payload);
  return response.data;
}

export async function updateSpecialEnrollment(
  enrollmentId: string,
  payload: { student_id: string; course_codes: string[] },
) {
  const response = await apiClient.put<SpecialEnrollmentDto>(
    `${basePath}/special-enrollments/${enrollmentId}`,
    payload,
  );
  return response.data;
}

export async function deleteSpecialEnrollment(enrollmentId: string) {
  await apiClient.delete(`${basePath}/special-enrollments/${enrollmentId}`);
}

export async function listProgramYearRows(params?: { program_value?: string }) {
  const response = await apiClient.get<ProgramYearRowDto[]>(`${basePath}/program-year-plans`, { params });
  return response.data;
}

export async function createProgramYearRow(payload: {
  program_value: string;
  year: number;
  course_code: string;
  professor_name?: string | null;
}) {
  const response = await apiClient.post<ProgramYearRowDto>(`${basePath}/program-year-plans`, payload);
  return response.data;
}

export async function updateProgramYearRow(
  rowId: string,
  payload: {
    program_value: string;
    year: number;
    course_code: string;
    professor_name?: string | null;
  },
) {
  const response = await apiClient.put<ProgramYearRowDto>(`${basePath}/program-year-plans/${rowId}`, payload);
  return response.data;
}

export async function deleteProgramYearRow(rowId: string) {
  await apiClient.delete(`${basePath}/program-year-plans/${rowId}`);
}
