"""JWT = a signed, expiring proof of login; never put a password in it."""
import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Cookie, Depends, HTTPException, Response
from pwdlib import PasswordHash
from sqlalchemy.orm import Session

from database import get_db
from models import User

SECRET = os.getenv("JWT_SECRET", "")
if len(SECRET) < 32 or SECRET.startswith("replace-"):
    raise RuntimeError("Set JWT_SECRET in backend/.env to a random value of at least 32 characters.")

password_hasher = PasswordHash.recommended()
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"
COOKIE_NAME = "reading_session"
SESSION_HOURS = 24


def set_login_cookie(response: Response, user: User):
    token = jwt.encode(
        {"sub": str(user.id), "version": user.token_version,
         "exp": datetime.now(timezone.utc) + timedelta(hours=SESSION_HOURS)},
        SECRET, algorithm="HS256",
    )
    # HttpOnly means JavaScript cannot read the token. The browser sends it for us.
    response.set_cookie(COOKIE_NAME, token, httponly=True, secure=COOKIE_SECURE,
                        samesite="lax", max_age=SESSION_HOURS * 3600, path="/")


def current_user(reading_session: str | None = Cookie(default=None), db: Session = Depends(get_db)):
    unauthorized = HTTPException(status_code=401, detail="Please log in to continue.")
    if not reading_session:
        raise unauthorized
    try:
        payload = jwt.decode(reading_session, SECRET, algorithms=["HS256"],
                             options={"require": ["sub", "exp", "version"]})
        user_id = int(payload["sub"])
    except (jwt.InvalidTokenError, ValueError, TypeError):
        raise unauthorized
    user = db.get(User, user_id)
    if not user or payload["version"] != user.token_version:
        raise unauthorized
    return user
