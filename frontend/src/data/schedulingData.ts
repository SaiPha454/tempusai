export type CourseOption = {
  code: string;
  name: string;
};

export type SelectOption = {
  value: string;
  label: string;
};

export const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const yearOptions: SelectOption[] = [
  { value: '', label: 'Select year' },
  { value: '1', label: 'Year 1' },
  { value: '2', label: 'Year 2' },
  { value: '3', label: 'Year 3' },
  { value: '4', label: 'Year 4' },
];

export const semesterOptions: SelectOption[] = [
  { value: '', label: 'Select semester' },
  { value: '1', label: 'Semester 1' },
  { value: '2', label: 'Semester 2' },
  { value: 'summer', label: 'Summer' },
];

export const preferredTimeOptions: SelectOption[] = [
  { value: 'any-time', label: 'Any time' },
  { value: 'morning', label: 'Morning (9:00 AM - 12:00 PM)' },
  { value: 'afternoon', label: 'Afternoon (1:00 PM - 4:00 PM)' },
  { value: 'evening', label: 'Evening (4:30 PM - 7:30 PM)' },
];

export const studyProgramOptions: SelectOption[] = [
  { value: '', label: 'Select study program' },
  { value: 'software-engineering', label: 'Software Engineering' },
  { value: 'computer-science', label: 'Computer Science' },
  { value: 'information-technology', label: 'Information Technology' },
  { value: 'data-science', label: 'Data Science' },
  { value: 'artificial-intelligence', label: 'Artificial Intelligence' },
  { value: 'cybersecurity', label: 'Cybersecurity' },
];

export const professorDirectory = [
  'Prof. Anan Chaiyasit',
  'Prof. Narin Rattanakul',
  'Prof. Pimchanok Srisuk',
  'Prof. Kittipong Wattanapong',
  'Prof. Supatcha Limsakul',
  'Prof. Chonlathorn Boonmee',
  'Prof. Saran Kiatkarn',
  'Prof. Thanita Phromraksa',
  'Prof. Rachata Preechawong',
  'Prof. Napatsorn Wichian',
];

export const roomDirectory = [
  'HM-301',
  'HM-302',
  'HM-303',
  'HM-304',
  'HM-401',
  'HM-402',
  'HM-403',
  'ENG-201',
  'ENG-202',
  'ENG-203',
  'ENG-301',
  'ENG-302',
  'SCI-101',
  'SCI-102',
  'SCI-201',
  'SCI-202',
  'BIZ-101',
  'BIZ-201',
  'BIZ-202',
  'IT-501',
  'IT-502',
  'IT-503',
];

export const courseDirectory: CourseOption[] = [
  { code: 'CS2101', name: 'Computer Networks' },
  { code: 'CS2102', name: 'Database Systems' },
  { code: 'CS2103', name: 'Software Engineering' },
  { code: 'CS2104', name: 'Data Structures and Algorithms' },
  { code: 'CS3101', name: 'Operating Systems' },
  { code: 'CS3102', name: 'Computer Architecture' },
  { code: 'CS3201', name: 'Artificial Intelligence' },
  { code: 'CS3202', name: 'Machine Learning Fundamentals' },
  { code: 'CS3301', name: 'Distributed Systems' },
  { code: 'CS3302', name: 'Cloud Computing' },
  { code: 'IT2201', name: 'Information Security' },
  { code: 'IT2202', name: 'Web Application Development' },
];
