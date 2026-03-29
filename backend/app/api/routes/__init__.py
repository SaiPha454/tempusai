from fastapi import APIRouter

from app.api.routes.resources import router as resources_router
from app.api.routes.scheduling import router as scheduling_router

router = APIRouter()
router.include_router(resources_router, prefix="/resources")
router.include_router(scheduling_router, prefix="/scheduling")
