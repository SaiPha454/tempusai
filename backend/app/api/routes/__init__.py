from fastapi import APIRouter, Depends

from app.api.deps import current_user_dependency
from app.api.routes.auth import router as auth_router
from app.api.routes.chat import router as chat_router
from app.api.routes.resources import router as resources_router
from app.api.routes.scheduling import router as scheduling_router

router = APIRouter()
router.include_router(auth_router, prefix="/auth")
router.include_router(resources_router, prefix="/resources", dependencies=[Depends(current_user_dependency)])
router.include_router(scheduling_router, prefix="/scheduling", dependencies=[Depends(current_user_dependency)])
router.include_router(chat_router, prefix="/chat", dependencies=[Depends(current_user_dependency)])
