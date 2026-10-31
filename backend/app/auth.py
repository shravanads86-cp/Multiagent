"""Local account authentication for the DevOps Swarm API.

Passwords are stored as PBKDF2-HMAC hashes; API sessions are signed, expiring
bearer tokens. SQLite keeps accounts persistent even when MongoDB is optional.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import time
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field

router = APIRouter(prefix="/api/auth", tags=["authentication"])
bearer = HTTPBearer(auto_error=False)
DB_PATH = Path(os.getenv("AUTH_DATABASE_PATH", str(Path(__file__).resolve().parents[1] / "data" / "users.sqlite3")))
TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7
PBKDF2_ITERATIONS = 310_000


class SignupPayload(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginPayload(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


def _connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE COLLATE NOCASE,
            password_hash TEXT NOT NULL,
            password_salt TEXT NOT NULL,
            created_at INTEGER NOT NULL
        )
    """)
    return connection


def _hash_password(password: str, salt: bytes | None = None) -> tuple[str, str]:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return base64.urlsafe_b64encode(digest).decode(), base64.urlsafe_b64encode(salt).decode()


def _verify_password(password: str, stored_hash: str, stored_salt: str) -> bool:
    try:
        salt = base64.urlsafe_b64decode(stored_salt.encode())
        expected = base64.urlsafe_b64decode(stored_hash.encode())
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def _token_secret() -> bytes:
    return os.getenv("AUTH_TOKEN_SECRET", "local-development-only-change-this-secret").encode("utf-8")


def _issue_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": int(time.time()) + TOKEN_TTL_SECONDS}
    encoded = base64.urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode()).rstrip(b"=")
    signature = hmac.new(_token_secret(), encoded, hashlib.sha256).digest()
    signed = base64.urlsafe_b64encode(signature).rstrip(b"=")
    return encoded.decode() + "." + signed.decode()


def _read_token(token: str) -> str:
    try:
        encoded, supplied_signature = token.split(".", 1)
        expected = base64.urlsafe_b64encode(
            hmac.new(_token_secret(), encoded.encode(), hashlib.sha256).digest()
        ).rstrip(b"=").decode()
        if not hmac.compare_digest(supplied_signature, expected):
            raise ValueError("Invalid signature")
        payload = json.loads(base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)))
        if int(payload["exp"]) < int(time.time()):
            raise ValueError("Expired token")
        return str(payload["sub"])
    except (ValueError, KeyError, TypeError, json.JSONDecodeError):
        raise HTTPException(status_code=401, detail="Your session is invalid or expired. Please sign in again.")


def _public_user(row: sqlite3.Row) -> dict[str, Any]:
    return {"id": row["id"], "name": row["name"], "email": row["email"]}


def get_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict[str, Any]:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Please sign in to continue.")
    user_id = _read_token(credentials.credentials)
    with _connect() as connection:
        row = connection.execute(
            "SELECT id, name, email FROM users WHERE id = ?", (user_id,)
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=401, detail="Account no longer exists. Please sign in again.")
    return _public_user(row)


@router.post("/signup", status_code=201)
def signup(payload: SignupPayload):
    name = payload.name.strip()
    email = str(payload.email).strip().lower()
    if len(name) < 2:
        raise HTTPException(status_code=422, detail="Please enter your full name.")
    password_hash, password_salt = _hash_password(payload.password)
    user_id = secrets.token_urlsafe(18)
    try:
        with _connect() as connection:
            connection.execute(
                "INSERT INTO users (id, name, email, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (user_id, name, email, password_hash, password_salt, int(time.time())),
            )
            row = connection.execute(
                "SELECT id, name, email FROM users WHERE id = ?", (user_id,)
            ).fetchone()
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="An account with this email already exists. Please sign in.")
    return {"access_token": _issue_token(user_id), "token_type": "bearer", "user": _public_user(row)}


@router.post("/login")
def login(payload: LoginPayload):
    email = str(payload.email).strip().lower()
    with _connect() as connection:
        row = connection.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    if row is None or not _verify_password(payload.password, row["password_hash"], row["password_salt"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    return {"access_token": _issue_token(row["id"]), "token_type": "bearer", "user": _public_user(row)}


@router.get("/me")
def me(user: dict[str, Any] = Depends(get_current_user)):
    return {"user": user}
