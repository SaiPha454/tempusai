from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router as api_router
from app.core.config import settings

openapi_tags = [
    {"name": "system", "description": "System health and service status."},
    {
        "name": "resources-programs",
        "description": "Study program master data used across courses, students, and planning.",
    },
    {
        "name": "resources-courses",
        "description": "Course/subject catalog and program mapping.",
    },
    {
        "name": "resources-rooms",
        "description": "Room resources and capacities.",
    },
    {
        "name": "resources-timeslots",
        "description": "Available time windows used for teaching and exams.",
    },
    {
        "name": "resources-professors",
        "description": "Professor master data and availability preferences.",
    },
    {
        "name": "resources-students",
        "description": "Student records by program and year.",
    },
    {
        "name": "resources-special-enrollments",
        "description": "Special enrollment overrides for exceptional student-course assignments.",
    },
    {
        "name": "resources-program-year-plans",
        "description": "Program-year planning rows (program, year, course, professor).",
    },
]


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        description="Resource Management API for programs, courses, rooms, timeslots, professors, students, and planning data.",
        version="1.0.0",
        openapi_tags=openapi_tags,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health", tags=["system"])
    def health_check() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(api_router, prefix=settings.api_v1_prefix)
    return app


app = create_app()
