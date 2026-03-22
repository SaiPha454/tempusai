export const dummyProgramYearPlans = {
  'computer-engineering': [
    {
      year: 1,
      courses: [
        { id: 'ce-y1-1', code: 'CE1101', name: 'Calculus for Engineers', professorName: 'Prof. Anan Chaiyasit' },
        { id: 'ce-y1-2', code: 'CE1104', name: 'Programming Fundamentals', professorName: 'Prof. Pimchanok Srisuk' },
        { id: 'ce-y1-3', code: 'CE1105', name: 'Digital Systems Basics', professorName: 'Prof. Kittipong Wattanapong' },
      ],
    },
    {
      year: 2,
      courses: [
        { id: 'ce-y2-1', code: 'CE2101', name: 'Digital Logic Design', professorName: 'Prof. Supatcha Limsakul' },
        { id: 'ce-y2-2', code: 'CE2102', name: 'Data Structures for Embedded Systems', professorName: 'Prof. Chonlathorn Boonmee' },
        { id: 'ce-y2-3', code: 'CE2103', name: 'Computer Organization', professorName: 'Prof. Saran Kiatkarn' },
      ],
    },
    {
      year: 3,
      courses: [
        { id: 'ce-y3-1', code: 'CE3101', name: 'Microprocessor Systems', professorName: 'Prof. Thanita Phromraksa' },
        { id: 'ce-y3-2', code: 'CE3102', name: 'Embedded Systems Design', professorName: 'Prof. Rachata Preechawong' },
        { id: 'ce-y3-3', code: 'CE3103', name: 'Computer Networks for CE', professorName: 'Prof. Napatsorn Wichian' },
      ],
    },
    {
      year: 4,
      courses: [
        { id: 'ce-y4-1', code: 'CE4101', name: 'Real-Time Systems', professorName: 'Prof. Kittipong Wattanapong' },
        { id: 'ce-y4-2', code: 'CE4102', name: 'IoT Architecture and Applications', professorName: 'Prof. Supatcha Limsakul' },
        { id: 'ce-y4-3', code: 'CE4106', name: 'Capstone Design Project I', professorName: 'Prof. Anan Chaiyasit' },
      ],
    },
  ],
  'software-engineering': [
    {
      year: 1,
      courses: [
        { id: 'se-y1-1', code: 'SE1101', name: 'Introduction to Software Engineering', professorName: 'Prof. Pimchanok Srisuk' },
        { id: 'se-y1-2', code: 'SE1102', name: 'Programming Fundamentals', professorName: 'Prof. Chonlathorn Boonmee' },
        { id: 'se-y1-3', code: 'SE1104', name: 'Database Concepts', professorName: 'Prof. Saran Kiatkarn' },
      ],
    },
    {
      year: 2,
      courses: [
        { id: 'se-y2-1', code: 'SE2201', name: 'Requirements Engineering', professorName: 'Prof. Thanita Phromraksa' },
        { id: 'se-y2-2', code: 'SE2202', name: 'Software Design and Architecture', professorName: 'Prof. Rachata Preechawong' },
        { id: 'se-y2-3', code: 'SE2203', name: 'Software Testing', professorName: 'Prof. Napatsorn Wichian' },
      ],
    },
    {
      year: 3,
      courses: [
        { id: 'se-y3-1', code: 'SE3101', name: 'Software Project Management', professorName: 'Prof. Supatcha Limsakul' },
        { id: 'se-y3-2', code: 'SE3102', name: 'DevOps Engineering', professorName: 'Prof. Kittipong Wattanapong' },
        { id: 'se-y3-3', code: 'SE3103', name: 'Software Quality Assurance', professorName: 'Prof. Anan Chaiyasit' },
      ],
    },
    {
      year: 4,
      courses: [
        { id: 'se-y4-1', code: 'SE4101', name: 'Enterprise Software Architecture', professorName: 'Prof. Saran Kiatkarn' },
        { id: 'se-y4-2', code: 'SE4102', name: 'Agile Product Development', professorName: 'Prof. Pimchanok Srisuk' },
        { id: 'se-y4-3', code: 'SE4106', name: 'Capstone Software Project I', professorName: 'Prof. Rachata Preechawong' },
      ],
    },
  ],
} as const;
