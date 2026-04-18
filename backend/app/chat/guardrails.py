import re

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

SENSITIVE_COLUMNS = (
    "password",
    "password_hash",
    "password_salt",
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


def extract_fenced_block(text: str, preferred_language: str | None = None) -> str:
    candidate = text.strip()
    if "```" not in candidate:
        return candidate

    # Prefer a language-specific fenced block if requested.
    if preferred_language:
        preferred_blocks = re.findall(
            rf"```{re.escape(preferred_language)}\s*(.*?)```",
            candidate,
            flags=re.IGNORECASE | re.DOTALL,
        )
        if preferred_blocks:
            return preferred_blocks[0].strip()

    # Fall back to first fenced block with optional language tag.
    blocks = re.findall(r"```(?:[a-zA-Z0-9_-]+)?\s*(.*?)```", candidate, flags=re.IGNORECASE | re.DOTALL)
    if not blocks:
        return candidate
    return blocks[0].strip()


def extract_sql(text: str) -> str:
    return extract_fenced_block(text, preferred_language="sql")


def split_sql_statements(sql: str) -> list[str]:
    statements: list[str] = []
    buffer: list[str] = []
    in_single_quote = False

    for ch in sql:
        if ch == "'":
            in_single_quote = not in_single_quote

        if ch == ";" and not in_single_quote:
            candidate = "".join(buffer).strip()
            if candidate:
                statements.append(candidate)
            buffer = []
            continue

        buffer.append(ch)

    tail = "".join(buffer).strip()
    if tail:
        statements.append(tail)

    return statements


def validate_generated_sql(sql: str) -> None:
    cleaned = sql.strip()
    if not cleaned:
        raise ValueError("Generated SQL is empty")

    statements = split_sql_statements(cleaned)
    if not statements:
        raise ValueError("Generated SQL is empty")

    for statement in statements:
        lowered = statement.lower().strip()

        if not (lowered.startswith("select") or lowered.startswith("with")):
            raise ValueError("Generated SQL statements must be SELECT/CTE-only")

        for keyword in BANNED_SQL_KEYWORDS:
            if re.search(rf"\b{keyword}\b", lowered):
                raise ValueError(f"Generated SQL contains forbidden keyword: {keyword}")

        if re.search(r"\bselect\s+\*", lowered) or re.search(r"\b[a-z_][a-z0-9_]*\.\*", lowered):
            raise ValueError("Wildcard SELECT is not allowed. Select explicit columns only.")

        for column in SENSITIVE_COLUMNS:
            if re.search(rf"\b{re.escape(column)}\b", lowered):
                raise ValueError(f"Generated SQL references forbidden sensitive column: {column}")
