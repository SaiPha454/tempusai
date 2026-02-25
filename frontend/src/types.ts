
export interface Room {
  id: string;
  name: string;
  cap: number;
  type: 'lecture' | 'lab' | 'seminar' | 'event';
}

export interface Course {
  code: string;
  name: string;
  professors: string[];
  faculty?: string;
  year?: string;
  semester?: string;
  defaultDay?: string; // The day the class usually happens
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  isTyping?: boolean;
}

export interface QueuedCourse {
  id: string;
  code: string;
  name: string;
  professors: string[];
  year: string;
  semester: string;
  studentGroup: string;
  studentCount?: number;
  preferredRoom?: string;
  preferredTime?: string;
}

export interface ExamSubjectConfig {
  code: string;
  name: string;
  duration: number;
  selectedDays: string[];
  selectedSlots: string[];
}

export interface QueuedExamBatch {
  id: string;
  faculty: string;
  year: string;
  semester: string;
  term: 'Final' | 'Midterm';
  selectedRooms: string[];
  subjects: ExamSubjectConfig[];
}

export interface Constraint {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  type: 'hard' | 'soft';
}
