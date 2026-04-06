ALLOWED_TABLES: tuple[str, ...] = (
    "programs",
    "courses",
    "students",
    "professors",
    "program_year_courses",
    "timeslots",
    "rooms",
    "schedule_class_snapshots",
    "schedule_class_entries",
    "schedule_exam_snapshots",
    "schedule_exam_entries",
)

SCHEDULING_SCHEMA_CONTEXT = """
You can only query the following scheduling domain tables:

1) programs
- id (uuid)
- value (text): short program code/value, unique
- label (text): human-readable program name

2) courses
- id (uuid)
- code (text): unique course code
- name (text)
- program_id (uuid, nullable) -> programs.id

3) students
- id (uuid)
- student_id (text): unique student code
- name (text)
- program_id (uuid) -> programs.id
- year (int, 1..4)

4) professors
- id (uuid)
- name (text)
- is_any_time (bool)

5) program_year_courses
- id (uuid)
- program_id (uuid) -> programs.id
- year (int, 1..4)
- course_id (uuid) -> courses.id
- professor_id (uuid, nullable) -> professors.id

6) timeslots
- id (uuid)
- day (text): Monday..Sunday style day name
- label (text): e.g. 09:00-12:00

7) rooms
- id (uuid)
- name (text)
- capacity (int)

8) schedule_class_snapshots
- id (uuid)
- program_id (uuid) -> programs.id
- status (text): draft/confirmed
- constraints (json)
- selected_room_names (json)
- created_at (timestamptz)
- updated_at (timestamptz)

9) schedule_class_entries
- id (uuid)
- snapshot_id (uuid) -> schedule_class_snapshots.id
- course_id (uuid) -> courses.id
- professor_id (uuid, nullable) -> professors.id
- year (int)
- timeslot_id (uuid, nullable) -> timeslots.id
- room_id (uuid, nullable) -> rooms.id
- manually_adjusted (bool)

10) schedule_exam_snapshots
- id (uuid)
- job_name (text, nullable)
- status (text): draft/confirmed
- constraints (json)
- selected_room_names (json)
- exam_dates (json)
- program_values (json)
- created_at (timestamptz)
- updated_at (timestamptz)

11) schedule_exam_entries
- id (uuid)
- snapshot_id (uuid) -> schedule_exam_snapshots.id
- program_id (uuid) -> programs.id
- program_year_course_id (uuid, nullable) -> program_year_courses.id
- course_id (uuid) -> courses.id
- year (int)
- semester (text, nullable)
- exam_type (text, nullable)
- exam_date (date, nullable)
- timeslot_code (text, nullable)
- room_id (uuid, nullable) -> rooms.id
- manually_adjusted (bool)

Business rules:
- For latest class schedule, prefer schedule_class_snapshots.status = 'confirmed'.
- For draft analysis, use status = 'draft'.
- For questions like "who teaches what", join program_year_courses + professors + courses + programs.
- For active class timetable facts, join schedule_class_entries with schedule_class_snapshots, courses, professors, timeslots, rooms.
""".strip()
