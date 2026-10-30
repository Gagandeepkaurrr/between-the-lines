import os
from contextlib import asynccontextmanager

import httpx
from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database import Base, engine, get_db
from models import Book, User
from schemas import BookCreate, BookOut, BookUpdate, Login, Signup, Statistics, UserOut
from auth import COOKIE_NAME, COOKIE_SECURE, current_user, password_hasher, set_login_cookie


@asynccontextmanager
async def lifespan(app):
    # Creates the two tables on first startup. It does not create the database.
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="Between the Lines", lifespan=lifespan)
frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173").rstrip("/")
app.add_middleware(CORSMiddleware, allow_origins=[frontend_origin], allow_credentials=True,
                   allow_methods=["GET", "POST", "PUT", "DELETE"], allow_headers=["Content-Type"])


@app.middleware("http")
async def check_origin(request: Request, call_next):
    # Protect cookie-authenticated writes against requests from another website.
    if request.method in {"POST", "PUT", "DELETE", "PATCH"}:
        origin = request.headers.get("origin")
        if origin and origin != frontend_origin:
            return JSONResponse(status_code=403, content={"detail": "This origin is not allowed."})
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/auth/signup", response_model=UserOut, status_code=201)
def signup(data: Signup, response: Response, db: Session = Depends(get_db)):
    user = User(name=data.name, email=str(data.email).lower(),
                password_hash=password_hasher.hash(data.password))
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "An account with this email already exists.")
    db.refresh(user)
    set_login_cookie(response, user)
    return user


@app.post("/api/auth/login", response_model=UserOut)
def login(data: Login, response: Response, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == str(data.email).lower()))
    if not user or not password_hasher.verify(data.password, user.password_hash):
        raise HTTPException(401, "Email or password is incorrect.")
    set_login_cookie(response, user)
    return user


@app.get("/api/auth/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user


@app.post("/api/auth/logout", status_code=204)
def logout(response: Response, user: User = Depends(current_user), db: Session = Depends(get_db)):
    user.token_version += 1
    db.commit()
    response.delete_cookie(COOKIE_NAME, path="/", secure=COOKIE_SECURE, httponly=True, samesite="lax")


@app.get("/api/books", response_model=list[BookOut])
def list_books(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return db.scalars(select(Book).where(Book.owner_id == user.id).order_by(Book.id.desc())).all()


@app.get("/api/stats", response_model=Statistics)
def stats(user: User = Depends(current_user), db: Session = Depends(get_db)):
    statuses = db.scalars(select(Book.status).where(Book.owner_id == user.id)).all()
    return {"total": len(statuses), "currently_reading": statuses.count("currently_reading"),
            "finished": statuses.count("finished"), "want_to_read": statuses.count("want_to_read")}


@app.post("/api/books", response_model=BookOut, status_code=201)
def add_book(data: BookCreate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    book = Book(**data.model_dump(), owner_id=user.id)
    db.add(book)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "This book is already on your shelf.")
    db.refresh(book)
    return book


def owned_book(book_id: int, user_id: int, db: Session):
    # Always check BOTH the book ID and the logged-in owner's ID.
    book = db.scalar(select(Book).where(Book.id == book_id, Book.owner_id == user_id))
    if not book:
        raise HTTPException(404, "Book not found.")
    return book


@app.get("/api/books/{book_id}", response_model=BookOut)
def get_book(book_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return owned_book(book_id, user.id, db)


@app.put("/api/books/{book_id}", response_model=BookOut)
def update_book(book_id: int, data: BookUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    book = owned_book(book_id, user.id, db)
    for field, value in data.model_dump().items():
        setattr(book, field, value)
    db.commit()
    db.refresh(book)
    return book


@app.delete("/api/books/{book_id}", status_code=204)
def delete_book(book_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.delete(owned_book(book_id, user.id, db))
    db.commit()


@app.get("/api/search", response_model=list[BookCreate])
async def search_books(q: str = Query(min_length=1, max_length=200), user: User = Depends(current_user)):
    if not q.strip():
        raise HTTPException(422, "Enter a title or author.")
    # Open Library is public: no API key or Google account is needed.
    params = {"q": q.strip(), "limit": 20,
              "fields": "key,title,author_name,cover_i,subject"}
    try:
        async with httpx.AsyncClient(
            timeout=20, follow_redirects=True,
            headers={"User-Agent": "BetweenTheLines/1.0 (personal reading journal)"},
        ) as client:
            response = await client.get("https://openlibrary.org/search.json", params=params)
            response.raise_for_status()
            results = response.json()
            if not isinstance(results, dict) or not isinstance(results.get("docs"), list):
                raise ValueError("Unexpected search response")
    except (httpx.HTTPError, ValueError):
        raise HTTPException(502, "Cannot reach Open Library right now. Please try searching again shortly.")
    books = []
    for item in results["docs"]:
        if not isinstance(item, dict) or not item.get("key") or not item.get("title"):
            continue
        cover_id = item.get("cover_i")
        cover = f"https://covers.openlibrary.org/b/id/{cover_id}-M.jpg?default=false" if cover_id else ""
        # Retain the existing field/column so previously saved books still work.
        # The 'ol:' prefix distinguishes new Open Library IDs from old Google IDs.
        books.append({"google_books_id": "ol:" + item["key"].split("/")[-1],
                      "title": item["title"][:500],
                      "author": ", ".join(item.get("author_name") or ["Unknown author"])[:500],
                      "genre": ", ".join((item.get("subject") or [])[:3])[:255], "cover_url": cover})
    return books
