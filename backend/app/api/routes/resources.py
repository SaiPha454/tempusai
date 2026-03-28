from fastapi import APIRouter

from app.api.routes.resources_routes.courses import router as courses_router
from app.api.routes.resources_routes.professors import router as professors_router
from app.api.routes.resources_routes.program_year_plans import router as program_year_plans_router
from app.api.routes.resources_routes.programs import router as programs_router
from app.api.routes.resources_routes.rooms import router as rooms_router
from app.api.routes.resources_routes.special_enrollments import router as special_enrollments_router
from app.api.routes.resources_routes.students import router as students_router
from app.api.routes.resources_routes.timeslots import router as timeslots_router

router = APIRouter()
router.include_router(programs_router, prefix="/programs")
router.include_router(courses_router, prefix="/courses")
router.include_router(rooms_router, prefix="/rooms")
router.include_router(timeslots_router, prefix="/timeslots")
router.include_router(professors_router, prefix="/professors")
router.include_router(students_router, prefix="/students")
router.include_router(special_enrollments_router, prefix="/special-enrollments")
router.include_router(program_year_plans_router, prefix="/program-year-plans")
