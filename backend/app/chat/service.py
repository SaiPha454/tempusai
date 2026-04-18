import json
import logging
import re
from collections.abc import Sequence
from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from llama_index.llms.openai import OpenAI
from sqlalchemy import text
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.chat.guardrails import extract_sql, likely_in_scope, split_sql_statements, validate_generated_sql
from app.chat.knowledge_index import SchedulingKnowledgeIndex
from app.chat.prompt_loader import load_prompt
from app.chat.session_store import ChatTurn, chat_session_store
from app.chat.schema_context import SCHEDULING_SCHEMA_CONTEXT
from app.core.config import settings
from app.schemas.chat import ChatAnswerRead


logger = logging.getLogger(__name__)


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

        try:
            recent_turns = chat_session_store.get_recent_turns(resolved_session_id)

            # Fast lexical pre-check before model classification to reduce irrelevant LLM usage.
            lexical_scope = likely_in_scope(cleaned_question)
            contextual_followup = self._is_contextual_followup(cleaned_question, recent_turns)
            classification = self._classify_scope(cleaned_question)
            classified_scope = classification.get("is_in_scope")
            if isinstance(classified_scope, bool):
                is_in_scope = classified_scope
            else:
                is_in_scope = lexical_scope or contextual_followup

            if not is_in_scope and contextual_followup:
                is_in_scope = True

            # Guard against occasional classifier false negatives on clearly scheduling-focused queries.
            if not is_in_scope and lexical_scope and self._has_strong_scope_signals(cleaned_question):
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
            database_tables = self._list_database_tables()
            semantic_context_rows = self.knowledge_index.retrieve_context(cleaned_question, top_k=3)
            sql_query = self._generate_sql_query(
                question=cleaned_question,
                semantic_context_rows=semantic_context_rows,
                recent_turns=recent_turns,
                program_catalog=program_catalog,
                database_tables=database_tables,
            )
            primary_sql_query = sql_query
            query_contexts: list[dict[str, Any]] = []
            try:
                rows, query_contexts = self._execute_readonly_sql(sql_query, database_tables)
            except (SQLAlchemyError, ValueError) as sql_error:
                self.db.rollback()
                logger.warning("Primary SQL failed; attempting repair", exc_info=True)
                try:
                    repaired_query = self._generate_repair_sql_query(
                        question=cleaned_question,
                        recent_turns=recent_turns,
                        program_catalog=program_catalog,
                        database_tables=database_tables,
                        previous_sql=sql_query,
                        db_error=str(sql_error),
                    )
                    rows, query_contexts = self._execute_readonly_sql(repaired_query, database_tables)
                    sql_query = repaired_query
                except (SQLAlchemyError, ValueError):
                    self.db.rollback()
                    logger.warning("Repair SQL failed; proceeding to fallback generation", exc_info=True)
                    rows = []

            if not rows:
                fallback_query = primary_sql_query
                try:
                    fallback_query = self._generate_fallback_sql_query(
                        question=cleaned_question,
                        recent_turns=recent_turns,
                        program_catalog=program_catalog,
                        database_tables=database_tables,
                        previous_sql=primary_sql_query,
                    )
                    fallback_rows, fallback_contexts = self._execute_readonly_sql(fallback_query, database_tables)
                except (SQLAlchemyError, ValueError) as sql_error:
                    self.db.rollback()
                    logger.warning("Fallback SQL failed; attempting fallback repair", exc_info=True)
                    try:
                        fallback_query = self._generate_repair_sql_query(
                            question=cleaned_question,
                            recent_turns=recent_turns,
                            program_catalog=program_catalog,
                            database_tables=database_tables,
                            previous_sql=fallback_query,
                            db_error=str(sql_error),
                        )
                        fallback_rows, fallback_contexts = self._execute_readonly_sql(fallback_query, database_tables)
                    except (SQLAlchemyError, ValueError):
                        self.db.rollback()
                        logger.warning("Fallback repair SQL failed; returning answer without row data", exc_info=True)
                        fallback_rows = []
                        fallback_contexts = []
                if fallback_rows:
                    sql_query = fallback_query
                    rows = fallback_rows
                    query_contexts = fallback_contexts

            answer = self._synthesize_answer(cleaned_question, sql_query, rows, query_contexts, recent_turns)
            if not answer.strip():
                answer = self._recover_empty_answer(cleaned_question, sql_query, rows, query_contexts, recent_turns)
            answer = self._normalize_answer_text(answer, rows)
            chat_session_store.append_turn(resolved_session_id, "user", cleaned_question)
            chat_session_store.append_turn(resolved_session_id, "assistant", answer)

            return ChatAnswerRead(
                session_id=resolved_session_id,
                status="answered",
                answer=answer,
                presentation=None,
                row_count=len(rows),
                sql_query=sql_query if settings.chat_return_sql_query else None,
                rows_preview=rows[: min(5, len(rows))],
            )
        except Exception:
            logger.exception("Scheduling chat request failed")
            return ChatAnswerRead(
                session_id=resolved_session_id,
                status="rejected",
                answer=(
                    "Scheduling chat is temporarily unavailable due to a backend processing issue. "
                    "Please try again in a moment."
                ),
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
        database_tables: list[str],
    ) -> str:
        conversation_context = self._format_recent_turns(recent_turns)
        base_prompt = (
            f"{self.sql_generation_prompt}\n\n"
            f"Schema context:\n{SCHEDULING_SCHEMA_CONTEXT}\n\n"
            f"Available database tables (runtime):\n{json.dumps(database_tables, ensure_ascii=False)}\n\n"
            f"Known program catalog (JSON):\n{json.dumps(program_catalog, ensure_ascii=False)}\n\n"
            f"Recent conversation context:\n{conversation_context}\n\n"
            f"Retrieved semantic context:\n{chr(10).join(semantic_context_rows)}\n\n"
            f"User question:\n{question}\n"
        )

        previous_sql = ""
        last_error: Exception | None = None
        for _ in range(3):
            prompt = base_prompt
            if last_error is not None:
                prompt = (
                    f"{base_prompt}\n"
                    "Previous SQL was invalid. Regenerate SQL and strictly follow all rules.\n\n"
                    f"Validation error:\n{str(last_error)}\n\n"
                    f"Previous SQL:\n{previous_sql}\n"
                )

            response_text = self.llm.complete(prompt).text
            sql_query = extract_sql(response_text).strip().rstrip(";")
            try:
                validate_generated_sql(sql_query)
                return sql_query
            except ValueError as validation_error:
                previous_sql = sql_query
                last_error = validation_error

        raise ValueError(f"Unable to generate valid SQL after retries: {str(last_error)}")

    def _generate_fallback_sql_query(
        self,
        question: str,
        recent_turns: Sequence[ChatTurn],
        program_catalog: list[dict[str, str]],
        database_tables: list[str],
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
            f"Available database tables (runtime):\n{json.dumps(database_tables, ensure_ascii=False)}\n\n"
            f"Known program catalog (JSON):\n{json.dumps(program_catalog, ensure_ascii=False)}\n\n"
            f"Recent conversation context:\n{conversation_context}\n\n"
            f"Previous SQL that returned no rows:\n{previous_sql}\n\n"
            f"User question:\n{question}\n"
        )
        response_text = self.llm.complete(prompt).text
        sql_query = extract_sql(response_text).strip().rstrip(";")
        validate_generated_sql(sql_query)
        return sql_query

    def _generate_repair_sql_query(
        self,
        question: str,
        recent_turns: Sequence[ChatTurn],
        program_catalog: list[dict[str, str]],
        database_tables: list[str],
        previous_sql: str,
        db_error: str,
    ) -> str:
        conversation_context = self._format_recent_turns(recent_turns)
        repair_instruction = (
            "Previous SQL failed during execution. Generate a corrected SQL query using ONLY valid "
            "tables/columns from schema context and available runtime table list. "
            "Keep intent unchanged and avoid unsupported columns."
        )
        prompt = (
            f"{self.sql_generation_prompt}\n\n"
            f"{repair_instruction}\n\n"
            f"Schema context:\n{SCHEDULING_SCHEMA_CONTEXT}\n\n"
            f"Available database tables (runtime):\n{json.dumps(database_tables, ensure_ascii=False)}\n\n"
            f"Known program catalog (JSON):\n{json.dumps(program_catalog, ensure_ascii=False)}\n\n"
            f"Recent conversation context:\n{conversation_context}\n\n"
            f"Previous SQL that failed:\n{previous_sql}\n\n"
            f"Database error:\n{db_error}\n\n"
            f"User question:\n{question}\n"
        )
        response_text = self.llm.complete(prompt).text
        sql_query = extract_sql(response_text).strip().rstrip(";")
        validate_generated_sql(sql_query)
        return sql_query

    def _execute_readonly_sql(
        self,
        sql_query: str,
        database_tables: list[str],
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        statements = split_sql_statements(sql_query)
        merged_rows: list[dict[str, Any]] = []
        query_contexts: list[dict[str, Any]] = []
        allowed_tables = {table.lower() for table in database_tables}

        for idx, statement in enumerate(statements):
            self._validate_statement_tables(statement, allowed_tables)
            result = self.db.execute(text(statement))
            rows = result.fetchmany(settings.chat_sql_result_limit)

            safe_rows: list[dict[str, Any]] = []
            for row in rows:
                row_dict = dict(row._mapping)
                safe_rows.append({key: self._json_safe(value) for key, value in row_dict.items()})

            query_contexts.append(
                {
                    "index": idx + 1,
                    "sql": statement,
                    "row_count": len(safe_rows),
                    "rows": safe_rows,
                }
            )
            merged_rows.extend(safe_rows)

        return merged_rows, query_contexts

    @staticmethod
    def _validate_statement_tables(statement: str, allowed_tables: set[str]) -> None:
        cte_names = {
            name.lower()
            for name in re.findall(r"\b([a-zA-Z_][a-zA-Z0-9_]*)\s+as\s*\(", statement, flags=re.IGNORECASE)
        }

        referenced: set[str] = set()
        for match in re.findall(r"\b(?:from|join)\s+([a-zA-Z_][a-zA-Z0-9_\.]*)", statement, flags=re.IGNORECASE):
            table_name = match.split(".")[-1].lower()
            referenced.add(table_name)

        if not referenced:
            return

        unknown = sorted(name for name in referenced if name not in allowed_tables and name not in cte_names)
        if unknown:
            raise ValueError(f"Generated SQL references unknown runtime table(s): {', '.join(unknown)}")

    def _synthesize_answer(
        self,
        question: str,
        sql_query: str,
        rows: list[dict[str, Any]],
        query_contexts: list[dict[str, Any]],
        recent_turns: Sequence[ChatTurn],
    ) -> str:
        conversation_context = self._format_recent_turns(recent_turns)
        prompt = (
            f"{self.answer_synthesis_prompt}\n\n"
            f"Recent conversation context:\n{conversation_context}\n\n"
            f"User question:\n{question}\n\n"
            f"Executed SQL script:\n{sql_query}\n\n"
            f"Query execution details (JSON):\n{json.dumps(query_contexts, ensure_ascii=False)}\n\n"
            f"Merged rows (JSON):\n{json.dumps(rows, ensure_ascii=False)}\n"
        )
        return self.llm.complete(prompt).text.strip()

    def _generate_out_of_scope_reply(self, question: str) -> str:
        prompt = (
            f"{self.out_of_scope_prompt}\n\n"
            f"User question:\n{question}\n"
        )
        return self.llm.complete(prompt).text.strip()

    def _recover_empty_answer(
        self,
        question: str,
        sql_query: str,
        rows: list[dict[str, Any]],
        query_contexts: list[dict[str, Any]],
        recent_turns: Sequence[ChatTurn],
    ) -> str:
        conversation_context = self._format_recent_turns(recent_turns)
        prompt = (
            f"{self.answer_synthesis_prompt}\n\n"
            "Important: your previous output was empty. Return a non-empty markdown answer now.\n\n"
            f"Recent conversation context:\n{conversation_context}\n\n"
            f"User question:\n{question}\n\n"
            f"Executed SQL script:\n{sql_query}\n\n"
            f"Query execution details (JSON):\n{json.dumps(query_contexts, ensure_ascii=False)}\n\n"
            f"Merged rows (JSON):\n{json.dumps(rows, ensure_ascii=False)}\n"
        )
        return self.llm.complete(prompt).text.strip()

    @staticmethod
    def _normalize_answer_text(answer: str, rows: list[dict[str, Any]]) -> str:
        cleaned = answer.strip()
        if cleaned:
            return cleaned

        if not rows:
            return "No matching scheduling data was found."

        if len(rows) == 1 and len(rows[0]) == 1:
            metric_name, metric_value = next(iter(rows[0].items()))
            label = metric_name.replace("_", " ").strip().capitalize() or "Result"
            return f"### {label}\n\n- **Value:** {metric_value}"

        return f"Found {len(rows)} matching scheduling row(s)."

    def _list_program_catalog(self) -> list[dict[str, str]]:
        result = self.db.execute(text("SELECT value, label FROM programs ORDER BY value"))
        return [
            {
                "value": str(row._mapping.get("value") or ""),
                "label": str(row._mapping.get("label") or ""),
            }
            for row in result
        ]

    def _list_database_tables(self) -> list[str]:
        result = self.db.execute(
            text(
                """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                ORDER BY table_name
                """
            )
        )
        return [str(row._mapping.get("table_name") or "") for row in result if row._mapping.get("table_name")]

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
    def _has_strong_scope_signals(question: str) -> bool:
        lowered = question.lower()
        signals = (
            "schedule",
            "scheduling",
            "class",
            "exam",
            "course",
            "professor",
            "student",
            "program",
            "timeslot",
            "room",
            "year",
        )
        score = sum(1 for signal in signals if signal in lowered)
        return score >= 2

    @staticmethod
    def _json_safe(value: Any) -> Any:
        if isinstance(value, UUID):
            return str(value)
        if isinstance(value, (datetime, date)):
            return value.isoformat()
        if isinstance(value, Decimal):
            return float(value)
        return value
