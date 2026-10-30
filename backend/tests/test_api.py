"""Isolated tests: no MySQL server, real account, or Google API key required."""
import importlib
import os
import sys
from pathlib import Path

import httpx
import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

# Set environment BEFORE importing the application; never touch the real database.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["JWT_SECRET"] = "automated-test-secret-that-is-at-least-32-characters"
os.environ["COOKIE_SECURE"] = "false"
os.environ["FRONTEND_ORIGIN"] = "http://localhost:5173"

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from database import Base, get_db
from models import User
from auth import COOKIE_NAME, SECRET
from main import app

test_engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestSession = sessionmaker(bind=test_engine)


@pytest.fixture(autouse=True)
def database():
    Base.metadata.create_all(test_engine)
    def override_db():
        with TestSession() as db:
            yield db
    app.dependency_overrides[get_db] = override_db
    yield
    app.dependency_overrides.clear()
    Base.metadata.drop_all(test_engine)


@pytest.fixture
def client():
    # Avoid lifespan creating tables in the application engine: override DB above.
    return TestClient(app)


def signup(client, email="reader@example.com"):
    return client.post("/api/auth/signup", json={"name": "A Reader", "email": email,
                       "password": "reading123", "confirm_password": "reading123"})


def add_book(client):
    return client.post("/api/books", json={"google_books_id": "abc123", "title": "A Test Book",
                        "author": "An Author", "cover_url": "https://books.google.com/cover.jpg"})


JOURNAL = {"status": "finished", "rating": 5, "favourite_quote": "A line worth remembering.",
           "notes": "My private thoughts 📚"}


def test_signup_hashes_password_and_restores_session(client):
    response = signup(client)
    assert response.status_code == 201
    assert response.json()["name"] == "A Reader"
    assert "password_hash" not in response.json()
    assert "HttpOnly" in response.headers["set-cookie"]
    assert client.get("/api/auth/me").status_code == 200
    with TestSession() as db:
        user = db.scalar(select(User))
        assert user.password_hash != "reading123"
        assert user.password_hash.startswith("$argon2")


def test_signup_validation_and_case_insensitive_duplicate(client):
    assert signup(client).status_code == 201
    assert signup(client, "READER@example.com").status_code == 409
    for values in [
        {"email": "not-an-email", "name": "Reader", "password": "reading123", "confirm_password": "reading123"},
        {"email": "other@example.com", "name": " ", "password": "reading123", "confirm_password": "reading123"},
        {"email": "other@example.com", "name": "Reader", "password": "short", "confirm_password": "short"},
        {"email": "other@example.com", "name": "Reader", "password": "reading123", "confirm_password": "different"},
    ]:
        assert client.post("/api/auth/signup", json=values).status_code == 422


def test_login_logout_and_revoked_cookie(client):
    signup(client)
    old_cookie = client.cookies.get(COOKIE_NAME)
    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/auth/me").status_code == 401
    client.cookies.set(COOKIE_NAME, old_cookie)
    assert client.get("/api/auth/me").status_code == 401
    client.cookies.clear()
    assert client.post("/api/auth/login", json={"email": "reader@example.com", "password": "wrong"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": "reader@example.com", "password": "reading123"}).status_code == 200
    assert client.get("/api/auth/me").status_code == 200


def test_unauthenticated_routes_and_invalid_tokens(client):
    for path in ["/api/books", "/api/books/1", "/api/stats", "/api/search?q=test"]:
        assert client.get(path).status_code == 401
    assert add_book(client).status_code == 401
    assert client.put("/api/books/1", json=JOURNAL).status_code == 401
    assert client.delete("/api/books/1").status_code == 401
    for token in ["not-a-token", jwt.encode({"sub": "1", "version": 0, "exp": 1}, SECRET, algorithm="HS256")]:
        client.cookies.set(COOKIE_NAME, token)
        assert client.get("/api/auth/me").status_code == 401


def test_book_lifecycle_and_persistence_across_login(client):
    signup(client)
    response = add_book(client)
    assert response.status_code == 201
    book_id = response.json()["id"]
    assert add_book(client).status_code == 409
    assert client.put(f"/api/books/{book_id}", json=JOURNAL).json()["rating"] == 5
    assert client.get("/api/stats").json() == {"total": 1, "finished": 1, "currently_reading": 0, "want_to_read": 0}
    client.post("/api/auth/logout")
    client.post("/api/auth/login", json={"email": "reader@example.com", "password": "reading123"})
    saved = client.get(f"/api/books/{book_id}").json()
    assert saved["notes"] == JOURNAL["notes"]
    assert saved["favourite_quote"] == JOURNAL["favourite_quote"]
    assert len(client.get("/api/books").json()) == 1
    for bad in [{**JOURNAL, "rating": 6}, {**JOURNAL, "rating": 1.5}, {**JOURNAL, "status": "invalid"}]:
        assert client.put(f"/api/books/{book_id}", json=bad).status_code == 422
    assert client.delete(f"/api/books/{book_id}").status_code == 204
    assert client.get(f"/api/books/{book_id}").status_code == 404
    assert client.get("/api/stats").json()["total"] == 0


def test_books_are_private_for_all_operations(client):
    signup(client)
    book_id = add_book(client).json()["id"]
    other = TestClient(app)
    signup(other, "other@example.com")
    assert other.get("/api/books").json() == []
    assert other.get("/api/stats").json()["total"] == 0
    assert other.get(f"/api/books/{book_id}").status_code == 404
    assert other.put(f"/api/books/{book_id}", json=JOURNAL).status_code == 404
    assert other.delete(f"/api/books/{book_id}").status_code == 404
    # Same Google book can belong to two different readers.
    assert add_book(other).status_code == 201
    assert client.get(f"/api/books/{book_id}").status_code == 200


def test_cross_origin_write_is_rejected(client):
    assert client.post("/api/auth/login", headers={"Origin": "https://untrusted.example"},
                       json={"email": "reader@example.com", "password": "reading123"}).status_code == 403
    assert signup(client).status_code == 201
    assert client.get("/api/auth/me", headers={"Origin": "http://localhost:5173"}).headers["access-control-allow-origin"] == "http://localhost:5173"


def test_open_library_search_normalizes_books_and_handles_failure(client, monkeypatch):
    signup(client)
    main = importlib.import_module("main")
    async def fake_get(self, url, params):
        assert url == "https://openlibrary.org/search.json"
        assert params["q"] == "A title"
        assert params["limit"] == 20
        return httpx.Response(200, request=httpx.Request("GET", url), json={"docs": [
            {"key": "/works/OL1W", "title": "A title", "author_name": ["A", "B"],
             "subject": ["Fiction"], "cover_i": 123},
            {"key": "/works/OL2W", "title": "No cover", "author_name": None, "subject": None},
            {"key": "/works/OL3W"},
        ]})
    monkeypatch.setattr(main.httpx.AsyncClient, "get", fake_get)
    result = client.get("/api/search", params={"q": "A title"})
    assert result.status_code == 200
    assert len(result.json()) == 2
    assert result.json()[0]["google_books_id"] == "ol:OL1W"
    assert result.json()[0]["author"] == "A, B"
    assert result.json()[0]["cover_url"] == "https://covers.openlibrary.org/b/id/123-M.jpg?default=false"
    assert result.json()[1]["cover_url"] == ""
    assert result.json()[1]["author"] == "Unknown author"
    # Search results can be added using the existing book API without a migration.
    saved = client.post("/api/books", json=result.json()[0])
    assert saved.status_code == 201
    assert client.post("/api/books", json=result.json()[0]).status_code == 409
    async def fail_get(self, url, params):
        raise httpx.ConnectError("Service down")
    monkeypatch.setattr(main.httpx.AsyncClient, "get", fail_get)
    assert client.get("/api/search?q=test").status_code == 502
    assert client.get("/api/search?q=%20").status_code == 422


@pytest.mark.parametrize("status,payload", [(429, {}), (200, {}), (200, {"docs": None})])
def test_open_library_bad_responses_show_a_useful_error(client, monkeypatch, status, payload):
    signup(client)
    async def fake_get(self, url, params):
        return httpx.Response(status, request=httpx.Request("GET", url), json=payload)
    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)
    response = client.get("/api/search?q=books")
    assert response.status_code == 502
    assert "Open Library" in response.json()["detail"]


def test_open_library_empty_results(client, monkeypatch):
    signup(client)
    async def fake_get(self, url, params):
        return httpx.Response(200, request=httpx.Request("GET", url), json={"docs": []})
    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)
    assert client.get("/api/search?q=unknown-title").json() == []
