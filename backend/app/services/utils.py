import re


def to_slug(text: str) -> str:
    normalized = re.sub(r"\s+", "-", text.strip().lower())
    normalized = re.sub(r"[^a-z0-9-]", "", normalized)
    normalized = re.sub(r"-+", "-", normalized)
    return normalized.strip("-")
