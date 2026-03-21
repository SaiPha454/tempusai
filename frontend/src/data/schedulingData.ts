export type CourseOption = {
  code: string;
  name: string;
};

export type ExamSubjectCatalogItem = {
  code: string;
  name: string;
  studyProgram: string;
  year: string;
  semester: string;
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
  { value: 'computer-engineering', label: 'Computer Engineering' },
  { value: 'software-engineering', label: 'Software Engineering' },
  { value: 'computer-science', label: 'Computer Science' },
  { value: 'information-technology', label: 'Information Technology' },
  { value: 'information-security', label: 'Information Security' },
  { value: 'data-science', label: 'Data Science' },
  { value: 'artificial-intelligence', label: 'Artificial Intelligence' },
  { value: 'cybersecurity', label: 'Cybersecurity' },
];

export const examTypeOptions: SelectOption[] = [
  { value: '', label: 'Select exam type' },
  { value: 'midterm', label: 'Midterm' },
  { value: 'final', label: 'Final' },
];

export const examTimeSlotOptions: SelectOption[] = [
  { value: 'morning-exam', label: '9:30 AM - 12:30 PM' },
  { value: 'afternoon-exam', label: '1:30 PM - 4:30 PM' },
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

export const roomCapacityMap: Record<string, number> = {
  'HM-301': 60,
  'HM-302': 60,
  'HM-303': 55,
  'HM-304': 55,
  'HM-401': 70,
  'HM-402': 70,
  'HM-403': 70,
  'ENG-201': 45,
  'ENG-202': 45,
  'ENG-203': 45,
  'ENG-301': 50,
  'ENG-302': 50,
  'SCI-101': 40,
  'SCI-102': 40,
  'SCI-201': 50,
  'SCI-202': 50,
  'BIZ-101': 60,
  'BIZ-201': 60,
  'BIZ-202': 60,
  'IT-501': 35,
  'IT-502': 35,
  'IT-503': 35,
};

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

export const examSubjectCatalog: ExamSubjectCatalogItem[] = [
  { code: 'CE1101', name: 'Calculus for Engineers', studyProgram: 'computer-engineering', year: '1', semester: '1' },
  { code: 'CE1102', name: 'Physics for Computer Engineering', studyProgram: 'computer-engineering', year: '1', semester: '1' },
  { code: 'CE1103', name: 'Engineering Drawing', studyProgram: 'computer-engineering', year: '1', semester: '1' },
  { code: 'CE1104', name: 'Programming Fundamentals', studyProgram: 'computer-engineering', year: '1', semester: '1' },
  { code: 'CE1105', name: 'Digital Systems Basics', studyProgram: 'computer-engineering', year: '1', semester: '1' },
  { code: 'CE1106', name: 'Introduction to Computer Engineering', studyProgram: 'computer-engineering', year: '1', semester: '1' },
  { code: 'CE2101', name: 'Digital Logic Design', studyProgram: 'computer-engineering', year: '2', semester: '1' },
  { code: 'CE2102', name: 'Data Structures for Embedded Systems', studyProgram: 'computer-engineering', year: '2', semester: '1' },
  { code: 'CE2103', name: 'Computer Organization', studyProgram: 'computer-engineering', year: '2', semester: '1' },
  { code: 'CE2104', name: 'Electronic Circuits', studyProgram: 'computer-engineering', year: '2', semester: '1' },
  { code: 'CE2105', name: 'Signals and Systems', studyProgram: 'computer-engineering', year: '2', semester: '1' },
  { code: 'CE2106', name: 'Discrete Mathematics for CE', studyProgram: 'computer-engineering', year: '2', semester: '1' },
  { code: 'CE3101', name: 'Microprocessor Systems', studyProgram: 'computer-engineering', year: '3', semester: '1' },
  { code: 'CE3102', name: 'Embedded Systems Design', studyProgram: 'computer-engineering', year: '3', semester: '1' },
  { code: 'CE3103', name: 'Computer Networks for CE', studyProgram: 'computer-engineering', year: '3', semester: '1' },
  { code: 'CE3104', name: 'Control Systems', studyProgram: 'computer-engineering', year: '3', semester: '1' },
  { code: 'CE3105', name: 'Operating Systems for Embedded Platforms', studyProgram: 'computer-engineering', year: '3', semester: '1' },
  { code: 'CE3106', name: 'Instrumentation and Measurement', studyProgram: 'computer-engineering', year: '3', semester: '1' },
  { code: 'CE4101', name: 'Real-Time Systems', studyProgram: 'computer-engineering', year: '4', semester: '1' },
  { code: 'CE4102', name: 'IoT Architecture and Applications', studyProgram: 'computer-engineering', year: '4', semester: '1' },
  { code: 'CE4103', name: 'VLSI Design Fundamentals', studyProgram: 'computer-engineering', year: '4', semester: '1' },
  { code: 'CE4104', name: 'Computer Engineering Project Management', studyProgram: 'computer-engineering', year: '4', semester: '1' },
  { code: 'CE4105', name: 'Industrial Automation', studyProgram: 'computer-engineering', year: '4', semester: '1' },
  { code: 'CE4106', name: 'Capstone Design Project I', studyProgram: 'computer-engineering', year: '4', semester: '1' },
  { code: 'SE1101', name: 'Introduction to Software Engineering', studyProgram: 'software-engineering', year: '1', semester: '1' },
  { code: 'SE1102', name: 'Programming Fundamentals', studyProgram: 'software-engineering', year: '1', semester: '1' },
  { code: 'SE1103', name: 'Discrete Mathematics', studyProgram: 'software-engineering', year: '1', semester: '1' },
  { code: 'SE1104', name: 'Database Concepts', studyProgram: 'software-engineering', year: '1', semester: '1' },
  { code: 'SE1105', name: 'Web Fundamentals', studyProgram: 'software-engineering', year: '1', semester: '1' },
  { code: 'SE1106', name: 'Software Development Workshop', studyProgram: 'software-engineering', year: '1', semester: '1' },
  { code: 'SE2201', name: 'Requirements Engineering', studyProgram: 'software-engineering', year: '2', semester: '1' },
  { code: 'SE2202', name: 'Software Design and Architecture', studyProgram: 'software-engineering', year: '2', semester: '1' },
  { code: 'SE2203', name: 'Software Testing', studyProgram: 'software-engineering', year: '2', semester: '1' },
  { code: 'SE2204', name: 'Object-Oriented Analysis and Design', studyProgram: 'software-engineering', year: '2', semester: '1' },
  { code: 'SE2205', name: 'Human-Computer Interaction', studyProgram: 'software-engineering', year: '2', semester: '1' },
  { code: 'SE2206', name: 'Software Configuration Management', studyProgram: 'software-engineering', year: '2', semester: '1' },
  { code: 'SE3101', name: 'Software Project Management', studyProgram: 'software-engineering', year: '3', semester: '1' },
  { code: 'SE3102', name: 'DevOps Engineering', studyProgram: 'software-engineering', year: '3', semester: '1' },
  { code: 'SE3103', name: 'Software Quality Assurance', studyProgram: 'software-engineering', year: '3', semester: '1' },
  { code: 'SE3104', name: 'Cloud-Native Application Development', studyProgram: 'software-engineering', year: '3', semester: '1' },
  { code: 'SE3105', name: 'Mobile Application Engineering', studyProgram: 'software-engineering', year: '3', semester: '1' },
  { code: 'SE3106', name: 'Secure Software Engineering', studyProgram: 'software-engineering', year: '3', semester: '1' },
  { code: 'SE4101', name: 'Enterprise Software Architecture', studyProgram: 'software-engineering', year: '4', semester: '1' },
  { code: 'SE4102', name: 'Agile Product Development', studyProgram: 'software-engineering', year: '4', semester: '1' },
  { code: 'SE4103', name: 'Software Process Improvement', studyProgram: 'software-engineering', year: '4', semester: '1' },
  { code: 'SE4104', name: 'AI-Assisted Software Development', studyProgram: 'software-engineering', year: '4', semester: '1' },
  { code: 'SE4105', name: 'Reliability Engineering', studyProgram: 'software-engineering', year: '4', semester: '1' },
  { code: 'SE4106', name: 'Capstone Software Project I', studyProgram: 'software-engineering', year: '4', semester: '1' },
  { code: 'CS2101', name: 'Computer Networks', studyProgram: 'computer-science', year: '2', semester: '1' },
  { code: 'CS2102', name: 'Database Systems', studyProgram: 'computer-science', year: '2', semester: '1' },
  { code: 'CS2103', name: 'Software Engineering', studyProgram: 'computer-science', year: '2', semester: '1' },
  { code: 'CS3101', name: 'Operating Systems', studyProgram: 'computer-science', year: '3', semester: '2' },
  { code: 'CS3201', name: 'Artificial Intelligence', studyProgram: 'computer-science', year: '3', semester: '2' },
  { code: 'IT2201', name: 'Information Security', studyProgram: 'information-technology', year: '2', semester: '1' },
  { code: 'IT2202', name: 'Web Application Development', studyProgram: 'information-technology', year: '2', semester: '1' },
  { code: 'IT3201', name: 'Cloud Infrastructure', studyProgram: 'information-technology', year: '3', semester: '2' },
  { code: 'IS2201', name: 'Security Governance', studyProgram: 'information-security', year: '2', semester: '1' },
  { code: 'IS2202', name: 'Identity and Access Management', studyProgram: 'information-security', year: '2', semester: '1' },
  { code: 'IS3201', name: 'Incident Response', studyProgram: 'information-security', year: '3', semester: '2' },
  { code: 'DS2101', name: 'Statistical Data Analysis', studyProgram: 'data-science', year: '2', semester: '1' },
  { code: 'DS2102', name: 'Data Mining', studyProgram: 'data-science', year: '2', semester: '1' },
  { code: 'AI3101', name: 'Deep Learning', studyProgram: 'artificial-intelligence', year: '3', semester: '2' },
  { code: 'AI3102', name: 'Natural Language Processing', studyProgram: 'artificial-intelligence', year: '3', semester: '2' },
  { code: 'CY2101', name: 'Network Security', studyProgram: 'cybersecurity', year: '2', semester: '1' },
  { code: 'CY2102', name: 'Secure Software Development', studyProgram: 'cybersecurity', year: '2', semester: '1' },
];
