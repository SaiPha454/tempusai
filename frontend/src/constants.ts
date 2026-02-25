
import { Room, Course, Constraint } from './types';

export const ALL_ROOMS: Room[] = [
  { id: 'CB-104',  name: 'Seminar Room',       cap: 40,  type: 'seminar'  },
  { id: 'CB-202',  name: 'Computer Lab',        cap: 60,  type: 'lab'      },
  { id: 'CB-301',  name: 'Lecture Hall A',      cap: 120, type: 'lecture'  },
  { id: 'CB-403',  name: 'Lab Room B',          cap: 50,  type: 'lab'      },
  { id: 'CB-501',  name: 'Lecture Hall B',      cap: 80,  type: 'lecture'  },
  { id: 'ENG-101', name: 'Engineering Lab',     cap: 45,  type: 'lab'      },
  { id: 'ENG-205', name: 'Project Room',        cap: 30,  type: 'seminar'  },
  { id: 'HALL-A',  name: 'Main Auditorium',     cap: 300, type: 'event'    },
  { id: 'LIB-201', name: 'Library Room A',      cap: 25,  type: 'seminar'  },
  { id: 'SCI-302', name: 'Science Lab',         cap: 55,  type: 'lab'      },
  { id: 'CB-105',  name: 'Tutorial Room',       cap: 35,  type: 'seminar'  },
  { id: 'CB-602',  name: 'Innovation Studio',   cap: 70,  type: 'lecture'  },
];

export const KNOWN_COURSES: Course[] = [
  { code: 'CS101',  name: 'Introduction to Programming', professors: ['Dr. Smith'], faculty: 'Software Engineering', year: 'Year 1', semester: '1', defaultDay: 'Mon' },
  { code: 'CS201',  name: 'Data Structures', professors: ['Prof. Johnson'], faculty: 'Software Engineering', year: 'Year 2', semester: '1', defaultDay: 'Tue' },
  { code: 'CS202',  name: 'Discrete Mathematics', professors: ['Dr. Brown'], faculty: 'Software Engineering', year: 'Year 2', semester: '1', defaultDay: 'Wed' },
  { code: 'CS301',  name: 'Software Engineering', professors: ['Prof. Davis'], faculty: 'Software Engineering', year: 'Year 3', semester: '1', defaultDay: 'Thu' },
  { code: 'CS305',  name: 'Database Systems', professors: ['Dr. Wilson'], faculty: 'Software Engineering', year: 'Year 3', semester: '1', defaultDay: 'Fri' },
  { code: 'CS310',  name: 'Algorithms & Data Structures', professors: ['Prof. Martinez'], faculty: 'Software Engineering', year: 'Year 3', semester: '2', defaultDay: 'Mon' },
  { code: 'CS315',  name: 'Computer Networks', professors: ['Dr. Anderson'], faculty: 'Software Engineering', year: 'Year 3', semester: '2', defaultDay: 'Tue' },
  { code: 'CS320',  name: 'Machine Learning Fundamentals', professors: ['Prof. Taylor'], faculty: 'Software Engineering', year: 'Year 3', semester: '2', defaultDay: 'Wed' },
  { code: 'CS401',  name: 'Senior Project I', professors: ['Dr. Thomas'], faculty: 'Software Engineering', year: 'Year 4', semester: '1', defaultDay: 'Fri' },
  { code: 'CS402',  name: 'Senior Project II', professors: ['Dr. Thomas'], faculty: 'Software Engineering', year: 'Year 4', semester: '2', defaultDay: 'Fri' },
  { code: 'EE101',  name: 'Circuit Theory', professors: ['Prof. Hernandez'], faculty: 'Electrical Engineering', year: 'Year 1', semester: '1', defaultDay: 'Mon' },
  { code: 'EE204',  name: 'Digital Systems', professors: ['Dr. Moore'], faculty: 'Electrical Engineering', year: 'Year 2', semester: '1', defaultDay: 'Thu' },
  { code: 'MATH201', name: 'Calculus II', professors: ['Prof. Martin'], faculty: 'Software Engineering', year: 'Year 1', semester: '2', defaultDay: 'Wed' },
  { code: 'MATH301', name: 'Linear Algebra', professors: ['Dr. Jackson'], faculty: 'Software Engineering', year: 'Year 2', semester: '2', defaultDay: 'Thu' },
];

export const SUGGESTIONS = [
  "When is Prof. Tanaka available?",
  "Any room conflicts this week?",
  "Show CS Year 3 timetable",
  "List exams in March",
  "Pending change requests"
];

export const DEFAULT_CONSTRAINTS: Constraint[] = [
  { 
    id: 'prof-pref', 
    label: 'Prioritize Professor Preferences', 
    description: 'Professors get all preferred time slots where possible.', 
    enabled: true,
    type: 'soft'
  },
  { 
    id: 'fallback-slots', 
    label: 'Flexible Slot Fallback', 
    description: 'Use user available slots if preferred is not available.', 
    enabled: true,
    type: 'soft'
  },
  { 
    id: 'prof-conflict', 
    label: 'Professor Availability Check', 
    description: 'Professor cannot have two classes at the same time.', 
    enabled: true,
    type: 'hard'
  },
  { 
    id: 'group-overlap', 
    label: 'Prevent Course Overlaps', 
    description: 'Student groups cannot have two classes at the same time.', 
    enabled: true,
    type: 'hard'
  },
  { 
    id: 'room-cap', 
    label: 'Room Capacity Check', 
    description: 'Students group size must be less than room capacity.', 
    enabled: true,
    type: 'hard'
  }
];
