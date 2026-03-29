import { apiClient } from './client';

const basePath = '/scheduling/class';

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

export async function generateClassSchedule(payload: ClassScheduleGeneratePayload): Promise<ClassScheduleJobDto> {
  const response = await apiClient.post<ClassScheduleJobDto>(`${basePath}/jobs`, payload);
  return response.data;
}

export async function getClassScheduleJob(jobId: string): Promise<ClassScheduleJobDto> {
  const response = await apiClient.get<ClassScheduleJobDto>(`${basePath}/jobs/${jobId}`);
  return response.data;
}

export async function listClassDraftSummary(): Promise<ProgramDraftSummaryDto[]> {
  const response = await apiClient.get<ProgramDraftSummaryDto[]>(`${basePath}/drafts/summary`);
  return response.data;
}

export async function listConfirmedClassScheduleSummary(): Promise<ProgramConfirmedScheduleSummaryDto[]> {
  const response = await apiClient.get<ProgramConfirmedScheduleSummaryDto[]>(`${basePath}/schedules/summary`);
  return response.data;
}

export async function getClassScheduleDraft(snapshotId: string): Promise<ClassScheduleDraftDto> {
  const response = await apiClient.get<ClassScheduleDraftDto>(`${basePath}/drafts/${snapshotId}`);
  return response.data;
}

export async function getLatestClassScheduleDraft(programValue: string): Promise<ClassScheduleDraftDto> {
  const response = await apiClient.get<ClassScheduleDraftDto>(`${basePath}/drafts/latest`, {
    params: {
      program_value: programValue,
    },
  });
  return response.data;
}

export async function getLatestConfirmedClassSchedule(programValue: string): Promise<ClassScheduleDraftDto> {
  const response = await apiClient.get<ClassScheduleDraftDto>(`${basePath}/schedules/latest`, {
    params: {
      program_value: programValue,
    },
  });
  return response.data;
}

export async function deleteLatestConfirmedClassSchedule(programValue: string): Promise<void> {
  await apiClient.delete(`${basePath}/schedules/latest`, {
    params: {
      program_value: programValue,
    },
  });
}

export async function saveClassScheduleDraft(
  snapshotId: string,
  payload: SaveClassScheduleDraftPayload,
): Promise<ClassScheduleDraftDto> {
  const response = await apiClient.put<ClassScheduleDraftDto>(`${basePath}/drafts/${snapshotId}`, payload);
  return response.data;
}

export async function deleteClassScheduleDraft(snapshotId: string): Promise<void> {
  await apiClient.delete(`${basePath}/drafts/${snapshotId}`);
}
