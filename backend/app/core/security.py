from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
from datetime import timedelta

from app.core.config import settings


PBKDF2_ALGORITHM = "sha256"
PBKDF2_ITERATIONS = 390000


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64url_decode(value: str) -> bytes:
    padded = value + "=" * ((4 - len(value) % 4) % 4)
    return base64.urlsafe_b64decode(padded.encode("ascii"))


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac(PBKDF2_ALGORITHM, password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return f"pbkdf2_{PBKDF2_ALGORITHM}${PBKDF2_ITERATIONS}${_b64url_encode(salt)}${_b64url_encode(digest)}"


def verify_password(password: str, encoded_hash: str) -> bool:
    try:
        _prefix, iteration_text, salt_b64, digest_b64 = encoded_hash.split("$", 3)
        iterations = int(iteration_text)
        salt = _b64url_decode(salt_b64)
        expected = _b64url_decode(digest_b64)
    except (ValueError, TypeError):
        return False

    actual = hashlib.pbkdf2_hmac(PBKDF2_ALGORITHM, password.encode("utf-8"), salt, iterations)
    return hmac.compare_digest(actual, expected)


def create_access_token(*, subject: str, role: str, expires_delta: timedelta | None = None) -> tuple[str, int]:
    now_ts = int(time.time())
    expires_in = int((expires_delta or timedelta(minutes=settings.auth_access_token_ttl_minutes)).total_seconds())

    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": subject,
        "role": role,
        "iat": now_ts,
        "exp": now_ts + expires_in,
    }

    header_encoded = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_encoded = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_encoded}.{payload_encoded}".encode("ascii")
    signature = hmac.new(settings.auth_secret_key.encode("utf-8"), signing_input, hashlib.sha256).digest()

    token = f"{header_encoded}.{payload_encoded}.{_b64url_encode(signature)}"
    return token, expires_in


def decode_access_token(token: str) -> dict[str, object]:
    try:
        header_encoded, payload_encoded, signature_encoded = token.split(".", 2)
    except ValueError as exc:
        raise ValueError("Malformed token") from exc

    signing_input = f"{header_encoded}.{payload_encoded}".encode("ascii")
    expected_signature = hmac.new(settings.auth_secret_key.encode("utf-8"), signing_input, hashlib.sha256).digest()
    provided_signature = _b64url_decode(signature_encoded)

    if not hmac.compare_digest(expected_signature, provided_signature):
        raise ValueError("Invalid token signature")

    try:
        payload_raw = _b64url_decode(payload_encoded)
        payload = json.loads(payload_raw)
    except (ValueError, json.JSONDecodeError) as exc:
        raise ValueError("Invalid token payload") from exc

    exp = payload.get("exp")
    if not isinstance(exp, int) or exp <= int(time.time()):
        raise ValueError("Token expired")

    sub = payload.get("sub")
    if not isinstance(sub, str) or not sub.strip():
        raise ValueError("Token subject missing")

    return payload
