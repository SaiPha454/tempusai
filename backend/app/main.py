from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router as api_router
from app.core.config import settings
from app.core.migrations import run_startup_migrations

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
    {
        "name": "scheduling-class",
        "description": "Class schedule generation, draft retrieval, and draft editing operations.",
    },
    {
        "name": "scheduling-exam",
        "description": "Exam schedule generation, draft retrieval, adjustment, and confirmation operations.",
    },
    {
        "name": "scheduling-chat",
        "description": "RAG-style scheduling chatbot that answers natural-language questions using PostgreSQL scheduling data.",
    },
]


@asynccontextmanager
async def lifespan(_: FastAPI):
    run_startup_migrations()
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        description="Resource Management API for programs, courses, rooms, timeslots, professors, students, and planning data.",
        version="1.0.0",
        openapi_tags=openapi_tags,
        lifespan=lifespan,
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
