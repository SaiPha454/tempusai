from app.models.schema.course import Course
from app.models.schema.professor import Professor
from app.models.schema.professor_availability import ProfessorAvailability
from app.models.schema.program import Program
from app.models.schema.program_year_course import ProgramYearCourse
from app.models.schema.room import Room
from app.models.schema.schedule_class_entry import ScheduleClassEntry
from app.models.schema.schedule_class_snapshot import ScheduleClassSnapshot
from app.models.schema.schedule_exam_entry import ScheduleExamEntry
from app.models.schema.schedule_exam_snapshot import ScheduleExamSnapshot
from app.models.schema.schedule_generation_job import ScheduleGenerationJob
from app.models.schema.special_enrollment import SpecialEnrollment
from app.models.schema.special_enrollment_course import SpecialEnrollmentCourse
from app.models.schema.student import Student
from app.models.schema.timeslot import Timeslot

__all__ = [
    "Program",
    "Course",
    "Room",
    "Timeslot",
    "Professor",
    "ProfessorAvailability",
    "Student",
    "SpecialEnrollment",
    "SpecialEnrollmentCourse",
    "ProgramYearCourse",
    "ScheduleClassSnapshot",
    "ScheduleClassEntry",
    "ScheduleExamSnapshot",
    "ScheduleExamEntry",
    "ScheduleGenerationJob",
]
