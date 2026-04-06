import re

from app.chat.schema_context import ALLOWED_TABLES

BANNED_SQL_KEYWORDS = (
    "insert",
    "update",
    "delete",
    "drop",
    "alter",
    "truncate",
    "create",
    "grant",
    "revoke",
)

_SCOPE_KEYWORDS = (
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
    "curriculum",
    "year",
    "teach",
)


def likely_in_scope(question: str) -> bool:
    lowered = question.lower()
    return any(keyword in lowered for keyword in _SCOPE_KEYWORDS)


def extract_sql(text: str) -> str:
    candidate = text.strip()
    if "```" not in candidate:
        return candidate

    # Accept SQL either in fenced sql code block or plain fenced block.
    blocks = re.findall(r"```(?:sql)?\s*(.*?)```", candidate, flags=re.IGNORECASE | re.DOTALL)
    if not blocks:
        return candidate
    return blocks[0].strip()


def validate_generated_sql(sql: str) -> None:
    cleaned = sql.strip().rstrip(";")
    lowered = cleaned.lower()

    if not lowered.startswith("select"):
        raise ValueError("Generated SQL must start with SELECT")

    if ";" in cleaned:
        raise ValueError("Generated SQL must contain exactly one statement")

    for keyword in BANNED_SQL_KEYWORDS:
        if re.search(rf"\b{keyword}\b", lowered):
            raise ValueError(f"Generated SQL contains forbidden keyword: {keyword}")

    referenced_tables = set(re.findall(r"\b(?:from|join)\s+([a-z_][a-z0-9_]*)", lowered))
    unknown_tables = referenced_tables.difference(ALLOWED_TABLES)
    if unknown_tables:
        unknown_tables_text = ", ".join(sorted(unknown_tables))
        raise ValueError(f"Generated SQL references out-of-scope table(s): {unknown_tables_text}")
