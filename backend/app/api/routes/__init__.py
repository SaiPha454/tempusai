from fastapi import APIRouter

from app.api.routes.resources import router as resources_router

router = APIRouter()
router.include_router(resources_router, prefix="/resources")
