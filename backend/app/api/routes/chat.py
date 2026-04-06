from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import db_dependency
from app.schemas.chat import ChatAnswerRead, ChatAskRequest
from app.services.errors import bad_request
from app.chat.service import SchedulingChatService

router = APIRouter(tags=["scheduling-chat"])


@router.post(
    "/ask",
    response_model=ChatAnswerRead,
    summary="Ask scheduling chatbot over PostgreSQL data",
)
def ask_scheduling_chat(
    payload: ChatAskRequest,
    db: Session = Depends(db_dependency),
) -> ChatAnswerRead:
    if not payload.question.strip():
        raise bad_request("Question must not be empty")

    return SchedulingChatService(db).ask(payload.question, session_id=payload.session_id)
