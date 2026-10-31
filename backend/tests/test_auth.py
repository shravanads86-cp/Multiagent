from fastapi.testclient import TestClient

from app import auth
from main import app


def test_signup_login_and_current_user(tmp_path, monkeypatch):
    monkeypatch.setattr(auth, "DB_PATH", tmp_path / "users.sqlite3")
    with TestClient(app) as client:
        signup = client.post(
            "/api/auth/signup",
            json={"name": "Test User", "email": "test@example.com", "password": "strong-pass-123"},
        )
        assert signup.status_code == 201
        data = signup.json()
        assert data["user"]["email"] == "test@example.com"
        assert data["access_token"]

        me = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {data['access_token']}"},
        )
        assert me.status_code == 200
        assert me.json()["user"]["name"] == "Test User"

        login = client.post(
            "/api/auth/login",
            json={"email": "TEST@example.com", "password": "strong-pass-123"},
        )
        assert login.status_code == 200
        assert login.json()["user"]["id"] == data["user"]["id"]


def test_duplicate_email_and_invalid_password(tmp_path, monkeypatch):
    monkeypatch.setattr(auth, "DB_PATH", tmp_path / "users.sqlite3")
    with TestClient(app) as client:
        payload = {"name": "Test User", "email": "test@example.com", "password": "strong-pass-123"}
        assert client.post("/api/auth/signup", json=payload).status_code == 201
        assert client.post("/api/auth/signup", json=payload).status_code == 409
        bad_login = client.post(
            "/api/auth/login",
            json={"email": payload["email"], "password": "incorrect-password"},
        )
        assert bad_login.status_code == 401


def test_auth_me_requires_valid_token():
    with TestClient(app) as client:
        assert client.get("/api/auth/me").status_code == 401
