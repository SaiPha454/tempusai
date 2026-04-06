from typing import Any, Literal

from pydantic import BaseModel, Field


class ChatAskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=800)
    session_id: str | None = Field(default=None, min_length=8, max_length=128)


class ChatAnswerRead(BaseModel):
    session_id: str
    status: Literal["answered", "rejected"]
    answer: str
    row_count: int | None = None
    sql_query: str | None = None
    rows_preview: list[dict[str, Any]] = Field(default_factory=list)
    scope_reason: str | None = None
