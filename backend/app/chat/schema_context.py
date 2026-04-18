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
Scheduling database dictionary for SQL generation.
Use these definitions as the source of truth for table meaning, column semantics,
and correct join paths.

1) programs
Table purpose:
- Master list of academic programs (for example software engineering, chemical engineering).
Column definitions:
- id (uuid): primary key of the program.
- value (text): short unique program code used in forms/config payloads.
- label (text): human-readable program name shown in UI and reports.

2) courses
Table purpose:
- Master list of courses that can be offered and scheduled.
Column definitions:
- id (uuid): primary key of the course.
- code (text): unique official course code.
- name (text): full course name.
- program_id (uuid, nullable) -> programs.id: owning/default program for the course when applicable.

3) students
Table purpose:
- Student roster used for enrollment and year-level context.
Column definitions:
- id (uuid): primary key of the student row.
- student_id (text): unique student identifier.
- name (text): student full name.
- program_id (uuid) -> programs.id: student's program.
- year (int, 1..4): student's current academic year.

4) professors
Table purpose:
- Instructor directory and scheduling preference profile.
Column definitions:
- id (uuid): primary key of the professor.
- name (text): professor full name.
- is_any_time (bool): true when professor has no strict time constraints.

5) program_year_courses
Table purpose:
- Curriculum mapping that assigns courses to a program + year and optionally a professor.
Column definitions:
- id (uuid): primary key of the mapping row.
- program_id (uuid) -> programs.id: program that owns the curriculum slot.
- year (int, 1..4): academic year where this course is placed.
- course_id (uuid) -> courses.id: course assigned to that program/year.
- professor_id (uuid, nullable) -> professors.id: planned/default instructor for that course slot.

6) timeslots
Table purpose:
- Canonical timetable slot dimension for class scheduling.
Column definitions:
- id (uuid): primary key of the timeslot.
- day (text): canonical weekday token used by data (commonly abbreviated like Mon, Tue, Wed, Thu, Fri).
- label (text): printable time range (for example 09:00-12:00).

7) rooms
Table purpose:
- Physical classroom/exam room inventory.
Column definitions:
- id (uuid): primary key of the room.
- name (text): room identifier/name.
- capacity (int): maximum supported seat count.

8) schedule_class_snapshots
Table purpose:
- Versioned class-schedule headers. Each snapshot is one generated schedule state.
Column definitions:
- id (uuid): primary key of the class snapshot.
- program_id (uuid) -> programs.id: program this class schedule belongs to.
- status (text): schedule lifecycle status ('draft' or 'confirmed').
- constraints (json): scheduler constraint payload used/generated for this run.
- selected_room_names (json): room selection set captured in this snapshot.
- created_at (timestamptz): snapshot creation time.
- updated_at (timestamptz): last update time.

9) schedule_class_entries
Table purpose:
- Detailed per-course rows inside a class snapshot (what course, when, where, who, for which year).
Column definitions:
- id (uuid): primary key of the class entry.
- snapshot_id (uuid) -> schedule_class_snapshots.id: parent class snapshot.
- course_id (uuid) -> courses.id: scheduled course.
- professor_id (uuid, nullable) -> professors.id: assigned instructor for this row.
- year (int): target academic year for this class row.
- timeslot_id (uuid, nullable) -> timeslots.id: assigned day/time slot.
- room_id (uuid, nullable) -> rooms.id: assigned room.
- manually_adjusted (bool): true if row was edited manually after auto scheduling.

10) schedule_exam_snapshots
Table purpose:
- Versioned exam-schedule headers. Each snapshot groups one exam scheduling run.
Column definitions:
- id (uuid): primary key of the exam snapshot.
- job_name (text, nullable): optional job or batch label for the run.
- status (text): schedule lifecycle status ('draft' or 'confirmed').
- constraints (json): constraint payload used/generated for the exam run.
- selected_room_names (json): room selection set for this exam run.
- exam_dates (json): date options/config for exam generation.
- program_values (json): targeted program codes/values included in this run.
- created_at (timestamptz): snapshot creation time.
- updated_at (timestamptz): last update time.

11) schedule_exam_entries
Table purpose:
- Detailed per-course exam rows inside an exam snapshot.
Column definitions:
- id (uuid): primary key of the exam entry.
- snapshot_id (uuid) -> schedule_exam_snapshots.id: parent exam snapshot.
- program_id (uuid) -> programs.id: program this exam row belongs to.
- program_year_course_id (uuid, nullable) -> program_year_courses.id: linked curriculum row when available.
- course_id (uuid) -> courses.id: course being examined.
- year (int): target academic year for this exam row.
- semester (text, nullable): semester label associated with this exam.
- exam_type (text, nullable): type/category of exam.
- exam_date (date, nullable): calendar date of the exam.
- timeslot_code (text, nullable): encoded exam time slot label/code.
- room_id (uuid, nullable) -> rooms.id: assigned exam room.
- manually_adjusted (bool): true if row was edited manually after auto scheduling.

Querying rules and join guidance:
- For latest class schedule facts, prefer schedule_class_snapshots.status = 'confirmed'.
- For draft scenario analysis, use status = 'draft'.
- For latest exam schedule facts, prefer schedule_exam_snapshots.status = 'confirmed'.
- For "who teaches what" questions, join program_year_courses -> professors -> courses -> programs.
- For class timetable questions, join schedule_class_entries -> schedule_class_snapshots -> courses -> professors -> timeslots -> rooms.
- For exam timetable questions, join schedule_exam_entries -> schedule_exam_snapshots -> courses -> programs -> rooms.
- IMPORTANT: schedule_exam_entries.exam_date and schedule_exam_entries.timeslot_code live on schedule_exam_entries.
- IMPORTANT: if you alias a CTE as se and schedule_exam_entries as se2, exam_date/timeslot_code must be read from se2.

Relationship graph (foreign-key level):
- programs.id <- courses.program_id (nullable)
- programs.id <- students.program_id
- programs.id <- program_year_courses.program_id
- programs.id <- schedule_class_snapshots.program_id
- programs.id <- schedule_exam_entries.program_id
- courses.id <- program_year_courses.course_id
- courses.id <- schedule_class_entries.course_id
- courses.id <- schedule_exam_entries.course_id
- professors.id <- program_year_courses.professor_id (nullable)
- professors.id <- schedule_class_entries.professor_id (nullable)
- timeslots.id <- schedule_class_entries.timeslot_id (nullable)
- rooms.id <- schedule_class_entries.room_id (nullable)
- rooms.id <- schedule_exam_entries.room_id (nullable)
- schedule_class_snapshots.id <- schedule_class_entries.snapshot_id
- schedule_exam_snapshots.id <- schedule_exam_entries.snapshot_id
- program_year_courses.id <- schedule_exam_entries.program_year_course_id (nullable)

Canonical join recipes (use these first):
1) Class timetable by day/program/year/professor:
- schedule_class_entries sce
- join schedule_class_snapshots scs on scs.id = sce.snapshot_id
- join timeslots t on t.id = sce.timeslot_id
- left join professors p on p.id = sce.professor_id
- join courses c on c.id = sce.course_id
- left join rooms r on r.id = sce.room_id
- join programs pr on pr.id = scs.program_id

2) Exam timetable by program/year/course/date:
- schedule_exam_entries see
- join schedule_exam_snapshots ses on ses.id = see.snapshot_id
- join programs pr on pr.id = see.program_id
- join courses c on c.id = see.course_id
- left join rooms r on r.id = see.room_id
- left join program_year_courses pyc on pyc.id = see.program_year_course_id
- optional left join professors p on p.id = pyc.professor_id

3) "Who teaches what" curriculum mapping:
- program_year_courses pyc
- join programs pr on pr.id = pyc.program_id
- join courses c on c.id = pyc.course_id
- left join professors p on p.id = pyc.professor_id

Anti-patterns to avoid:
- Never join professors directly to schedule_exam_entries via program_id.
- Never assume schedule_exam_snapshots has program_id.
- For class day-of-week questions, use timeslots.day (not timeslot_code, not exam_date).
- For exam day-of-week questions, derive from exam_date when available (for example EXTRACT(DOW FROM see.exam_date)).

Day-token normalization guidance:
- User may ask full names (Monday) while data stores abbreviations (Mon).
- For weekday text filters on timeslots.day, prefer robust prefix matching with ILIKE:
    Monday -> 'Mon%'
    Tuesday -> 'Tue%'
    Wednesday -> 'Wed%'
    Thursday -> 'Thu%'
    Friday -> 'Fri%'
    Saturday -> 'Sat%'
    Sunday -> 'Sun%'
""".strip()
