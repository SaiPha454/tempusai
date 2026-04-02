import { apiClient } from './client';

const classBasePath = '/scheduling/class';
const examBasePath = '/scheduling/exam';

export type ClassScheduleGeneratePayload = {
  program_value: string;
  selected_room_names: string[];
  constraints: Record<string, boolean>;
  preferred_timeslot_by_course_id: Record<string, string[]>;
};

export type ClassScheduleJobDto = {
  job_id: string;
  snapshot_id: string | null;
  status: string;
  error_message?: string | null;
};

export type ProgramDraftSummaryDto = {
  program_value: string;
  program_label: string;
  draft_count: number;
};

export type ProgramConfirmedScheduleSummaryDto = {
  program_value: string;
  program_label: string;
  confirmed_count: number;
};

export type ScheduleConflictDto = {
  code: string;
  message: string;
};

export type ScheduleClassEntryDto = {
  id: string;
  course_id: string;
  course_code: string;
  course_name: string;
  professor_id: string | null;
  professor_name: string | null;
  year: number;
  timeslot_id: string | null;
  timeslot_label: string | null;
  day: string | null;
  room_id: string | null;
  room_name: string | null;
  manually_adjusted: boolean;
  conflicts: ScheduleConflictDto[];
};

export type ConfirmedOccupancyDto = {
  room_id: string;
  timeslot_id: string;
  course_code: string;
  course_name: string;
};

export type ClassScheduleDraftDto = {
  id: string;
  program_id: string;
  program_value: string;
  program_label: string;
  status: string;
  constraints: Record<string, boolean>;
  selected_room_names: string[];
  entries: ScheduleClassEntryDto[];
  confirmed_occupancies: ConfirmedOccupancyDto[];
  conflict_count: number;
  created_at: string;
  updated_at: string;
};

export type SaveClassScheduleDraftPayload = {
  entries: Array<{
    id: string;
    timeslot_id: string | null;
    room_id: string | null;
  }>;
};

export type ExamConstraintPayload = {
  no_same_program_year_day_timeslot: boolean;
  no_student_overlap: boolean;
  room_capacity_check: boolean;
  prefer_day_timeslot: boolean;
  allow_flexible_fallback: boolean;
};

export type ExamCoursePreferencePayload = {
  program_year_course_id: string;
  course_code: string;
  course_name: string;
  preferred_dates: string[];
  preferred_timeslots: string[];
};

export type ExamProgramYearPayload = {
  year: number;
  courses: ExamCoursePreferencePayload[];
};

export type ExamProgramPlanPayload = {
  program_value: string;
  semester: string;
  exam_type: string;
  years: ExamProgramYearPayload[];
};

export type ExamScheduleGeneratePayload = {
  exam_dates: string[];
  selected_room_names: string[];
  program_plans: ExamProgramPlanPayload[];
  constraints: ExamConstraintPayload;
};

export type ExamScheduleJobDto = {
  job_id: string;
  snapshot_id: string | null;
  status: string;
  error_message?: string | null;
};

export async function generateClassSchedule(payload: ClassScheduleGeneratePayload): Promise<ClassScheduleJobDto> {
  const response = await apiClient.post<ClassScheduleJobDto>(`${classBasePath}/jobs`, payload);
  return response.data;
}

export async function getClassScheduleJob(jobId: string): Promise<ClassScheduleJobDto> {
  const response = await apiClient.get<ClassScheduleJobDto>(`${classBasePath}/jobs/${jobId}`);
  return response.data;
}

export async function generateExamSchedule(payload: ExamScheduleGeneratePayload): Promise<ExamScheduleJobDto> {
  const response = await apiClient.post<ExamScheduleJobDto>(`${examBasePath}/jobs`, payload);
  return response.data;
}

export async function getExamScheduleJob(jobId: string): Promise<ExamScheduleJobDto> {
  const response = await apiClient.get<ExamScheduleJobDto>(`${examBasePath}/jobs/${jobId}`);
  return response.data;
}

export async function listClassDraftSummary(): Promise<ProgramDraftSummaryDto[]> {
  const response = await apiClient.get<ProgramDraftSummaryDto[]>(`${classBasePath}/drafts/summary`);
  return response.data;
}

export async function listConfirmedClassScheduleSummary(): Promise<ProgramConfirmedScheduleSummaryDto[]> {
  const response = await apiClient.get<ProgramConfirmedScheduleSummaryDto[]>(`${classBasePath}/schedules/summary`);
  return response.data;
}

export async function getClassScheduleDraft(snapshotId: string): Promise<ClassScheduleDraftDto> {
  const response = await apiClient.get<ClassScheduleDraftDto>(`${classBasePath}/drafts/${snapshotId}`);
  return response.data;
}

export async function getLatestClassScheduleDraft(programValue: string): Promise<ClassScheduleDraftDto> {
  const response = await apiClient.get<ClassScheduleDraftDto>(`${classBasePath}/drafts/latest`, {
    params: {
      program_value: programValue,
    },
  });
  return response.data;
}

export async function getLatestConfirmedClassSchedule(programValue: string): Promise<ClassScheduleDraftDto> {
  const response = await apiClient.get<ClassScheduleDraftDto>(`${classBasePath}/schedules/latest`, {
    params: {
      program_value: programValue,
    },
  });
  return response.data;
}

export async function deleteLatestConfirmedClassSchedule(programValue: string): Promise<void> {
  await apiClient.delete(`${classBasePath}/schedules/latest`, {
    params: {
      program_value: programValue,
    },
  });
}

export async function saveClassScheduleDraft(
  snapshotId: string,
  payload: SaveClassScheduleDraftPayload,
): Promise<ClassScheduleDraftDto> {
  const response = await apiClient.put<ClassScheduleDraftDto>(`${classBasePath}/drafts/${snapshotId}`, payload);
  return response.data;
}

export async function deleteClassScheduleDraft(snapshotId: string): Promise<void> {
  await apiClient.delete(`${classBasePath}/drafts/${snapshotId}`);
}
