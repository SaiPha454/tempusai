import json
from collections.abc import Sequence
from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import uuid4

from llama_index.llms.openai import OpenAI
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.chat.guardrails import extract_sql, likely_in_scope, validate_generated_sql
from app.chat.knowledge_index import SchedulingKnowledgeIndex
from app.chat.prompt_loader import load_prompt
from app.chat.session_store import ChatTurn, chat_session_store
from app.chat.schema_context import SCHEDULING_SCHEMA_CONTEXT
from app.core.config import settings
from app.schemas.chat import ChatAnswerRead


class SchedulingChatService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.llm = OpenAI(model=settings.openai_chat_model, api_key=settings.openai_api_key)
        self.knowledge_index = SchedulingKnowledgeIndex()

        self.scope_classifier_prompt = load_prompt("scope_classifier_prompt.txt")
        self.sql_generation_prompt = load_prompt("sql_generation_prompt.txt")
        self.answer_synthesis_prompt = load_prompt("answer_synthesis_prompt.txt")
        self.out_of_scope_prompt = load_prompt("out_of_scope_prompt.txt")

    def ask(self, question: str, session_id: str | None = None) -> ChatAnswerRead:
        cleaned_question = question.strip()
        resolved_session_id = session_id.strip() if session_id else str(uuid4())

        if not cleaned_question:
            return ChatAnswerRead(
                session_id=resolved_session_id,
                status="rejected",
                answer="Please provide a scheduling question.",
            )

        if not settings.openai_api_key:
            return ChatAnswerRead(
                session_id=resolved_session_id,
                status="rejected",
                answer="Scheduling chat is not configured yet. Please set OPENAI_API_KEY on the backend.",
            )

        recent_turns = chat_session_store.get_recent_turns(resolved_session_id)

        # Fast lexical pre-check before model classification to reduce irrelevant LLM usage.
        lexical_scope = likely_in_scope(cleaned_question)
        contextual_followup = self._is_contextual_followup(cleaned_question, recent_turns)
        classification = self._classify_scope(cleaned_question)
        is_in_scope = bool(classification.get("is_in_scope", lexical_scope or contextual_followup))

        if not is_in_scope and contextual_followup:
            is_in_scope = True

        if not is_in_scope:
            answer = self._generate_out_of_scope_reply(cleaned_question)
            chat_session_store.append_turn(resolved_session_id, "user", cleaned_question)
            chat_session_store.append_turn(resolved_session_id, "assistant", answer)
            return ChatAnswerRead(
                session_id=resolved_session_id,
                status="rejected",
                answer=answer,
                scope_reason=classification.get("reason", "Question is outside scheduling scope."),
            )

        program_catalog = self._list_program_catalog()
        semantic_context_rows = self.knowledge_index.retrieve_context(cleaned_question, top_k=3)
        sql_query = self._generate_sql_query(
            question=cleaned_question,
            semantic_context_rows=semantic_context_rows,
            recent_turns=recent_turns,
            program_catalog=program_catalog,
        )
        rows = self._execute_readonly_sql(sql_query)

        if not rows:
            fallback_query = self._generate_fallback_sql_query(
                question=cleaned_question,
                recent_turns=recent_turns,
                program_catalog=program_catalog,
                previous_sql=sql_query,
            )
            fallback_rows = self._execute_readonly_sql(fallback_query)
            if fallback_rows:
                sql_query = fallback_query
                rows = fallback_rows

        answer = self._synthesize_answer(cleaned_question, sql_query, rows, recent_turns)
        chat_session_store.append_turn(resolved_session_id, "user", cleaned_question)
        chat_session_store.append_turn(resolved_session_id, "assistant", answer)

        return ChatAnswerRead(
            session_id=resolved_session_id,
            status="answered",
            answer=answer,
            row_count=len(rows),
            sql_query=sql_query if settings.chat_return_sql_query else None,
            rows_preview=rows[: min(5, len(rows))],
        )

    def _classify_scope(self, question: str) -> dict[str, Any]:
        prompt = (
            f"{self.scope_classifier_prompt}\n\n"
            f"User question:\n{question}\n"
        )
        raw = self.llm.complete(prompt).text.strip()
        raw_json = extract_sql(raw)
        try:
            return json.loads(raw_json)
        except json.JSONDecodeError:
            return {"is_in_scope": False, "reason": "Could not classify question reliably."}

    def _generate_sql_query(
        self,
        question: str,
        semantic_context_rows: list[str],
        recent_turns: Sequence[ChatTurn],
        program_catalog: list[dict[str, str]],
    ) -> str:
        conversation_context = self._format_recent_turns(recent_turns)
        prompt = (
            f"{self.sql_generation_prompt}\n\n"
            f"Schema context:\n{SCHEDULING_SCHEMA_CONTEXT}\n\n"
            f"Known program catalog (JSON):\n{json.dumps(program_catalog, ensure_ascii=False)}\n\n"
            f"Recent conversation context:\n{conversation_context}\n\n"
            f"Retrieved semantic context:\n{chr(10).join(semantic_context_rows)}\n\n"
            f"User question:\n{question}\n"
        )
        response_text = self.llm.complete(prompt).text
        sql_query = extract_sql(response_text).strip().rstrip(";")
        validate_generated_sql(sql_query)
        return sql_query

    def _generate_fallback_sql_query(
        self,
        question: str,
        recent_turns: Sequence[ChatTurn],
        program_catalog: list[dict[str, str]],
        previous_sql: str,
    ) -> str:
        conversation_context = self._format_recent_turns(recent_turns)
        fallback_instruction = (
            "Previous SQL returned no rows. Regenerate SQL with broader matching. "
            "Use case-insensitive token-based matching for program names when typos are likely "
            "(for example lower(programs.label) LIKE '%software%' AND LIKE '%engineering%'). "
            "If user asks exam scheduling data and status is not specified, avoid over-filtering by status."
        )
        prompt = (
            f"{self.sql_generation_prompt}\n\n"
            f"{fallback_instruction}\n\n"
            f"Schema context:\n{SCHEDULING_SCHEMA_CONTEXT}\n\n"
            f"Known program catalog (JSON):\n{json.dumps(program_catalog, ensure_ascii=False)}\n\n"
            f"Recent conversation context:\n{conversation_context}\n\n"
            f"Previous SQL that returned no rows:\n{previous_sql}\n\n"
            f"User question:\n{question}\n"
        )
        response_text = self.llm.complete(prompt).text
        sql_query = extract_sql(response_text).strip().rstrip(";")
        validate_generated_sql(sql_query)
        return sql_query

    def _execute_readonly_sql(self, sql_query: str) -> list[dict[str, Any]]:
        result = self.db.execute(text(sql_query))
        rows = result.fetchmany(settings.chat_sql_result_limit)

        output: list[dict[str, Any]] = []
        for row in rows:
            row_dict = dict(row._mapping)
            output.append({key: self._json_safe(value) for key, value in row_dict.items()})
        return output

    def _synthesize_answer(
        self,
        question: str,
        sql_query: str,
        rows: list[dict[str, Any]],
        recent_turns: Sequence[ChatTurn],
    ) -> str:
        conversation_context = self._format_recent_turns(recent_turns)
        prompt = (
            f"{self.answer_synthesis_prompt}\n\n"
            f"Recent conversation context:\n{conversation_context}\n\n"
            f"User question:\n{question}\n\n"
            f"Executed SQL:\n{sql_query}\n\n"
            f"Rows (JSON):\n{json.dumps(rows, ensure_ascii=False)}\n"
        )
        return self.llm.complete(prompt).text.strip()

    def _generate_out_of_scope_reply(self, question: str) -> str:
        prompt = (
            f"{self.out_of_scope_prompt}\n\n"
            f"User question:\n{question}\n"
        )
        return self.llm.complete(prompt).text.strip()

    def _list_program_catalog(self) -> list[dict[str, str]]:
        result = self.db.execute(text("SELECT value, label FROM programs ORDER BY value"))
        return [
            {
                "value": str(row._mapping.get("value") or ""),
                "label": str(row._mapping.get("label") or ""),
            }
            for row in result
        ]

    @staticmethod
    def _format_recent_turns(turns: Sequence[ChatTurn]) -> str:
        if not turns:
            return "(none)"

        lines = [f"{turn.role}: {turn.content}" for turn in turns]
        return "\n".join(lines)

    @staticmethod
    def _is_contextual_followup(question: str, recent_turns: Sequence[ChatTurn]) -> bool:
        if not recent_turns:
            return False

        lowered = question.lower().strip()
        if not lowered:
            return False

        followup_markers = (
            "and",
            "also",
            "what about",
            "how about",
            "for year",
            "only",
            "those",
            "that",
            "them",
            "it",
        )
        is_followup_shape = any(marker in lowered for marker in followup_markers) or len(lowered.split()) <= 7
        if not is_followup_shape:
            return False

        recent_text = " ".join(turn.content.lower() for turn in recent_turns[-4:])
        return likely_in_scope(recent_text)

    @staticmethod
    def _json_safe(value: Any) -> Any:
        if isinstance(value, (datetime, date)):
            return value.isoformat()
        if isinstance(value, Decimal):
            return float(value)
        return value
