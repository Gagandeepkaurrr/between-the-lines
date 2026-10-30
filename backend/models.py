from sqlalchemy import CheckConstraint, Column, ForeignKey, Integer, String, Text, UniqueConstraint

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    email = Column(String(254), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    # Logout increases this number, making previously issued JWTs invalid.
    token_version = Column(Integer, nullable=False, default=0)


class Book(Base):
    __tablename__ = "books"
    __table_args__ = (
        UniqueConstraint("owner_id", "google_books_id", name="unique_owner_book"),
        CheckConstraint("rating >= 0 AND rating <= 5", name="valid_rating"),
        CheckConstraint("status IN ('want_to_read', 'currently_reading', 'finished')", name="valid_status"),
    )

    id = Column(Integer, primary_key=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    # Legacy column name; new search results store Open Library IDs with 'ol:'.
    google_books_id = Column(String(128), nullable=False)
    title = Column(String(500), nullable=False)
    author = Column(String(500), nullable=False, default="Unknown author")
    genre = Column(String(255), nullable=False, default="")
    cover_url = Column(Text, nullable=False, default="")
    status = Column(String(30), nullable=False, default="want_to_read")
    rating = Column(Integer, nullable=False, default=0)
    favourite_quote = Column(Text, nullable=False, default="")
    notes = Column(Text, nullable=False, default="")
