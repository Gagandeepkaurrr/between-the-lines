from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

ReadingStatus = Literal["want_to_read", "currently_reading", "finished"]


class Signup(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr = Field(max_length=254)
    password: str = Field(min_length=8, max_length=128)
    confirm_password: str

    @field_validator("name")
    @classmethod
    def clean_name(cls, value):
        value = value.strip()
        if not value:
            raise ValueError("Please enter your name")
        return value

    @model_validator(mode="after")
    def passwords_match(self):
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self


class Login(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    email: str


class BookCreate(BaseModel):
    # Keep this API field compatible with existing saved books (now also 'ol:' IDs).
    google_books_id: str = Field(min_length=1, max_length=128)
    title: str = Field(min_length=1, max_length=500)
    author: str = Field(default="Unknown author", max_length=500)
    genre: str = Field(default="", max_length=255)
    cover_url: str = Field(default="", max_length=2048)

    @field_validator("cover_url")
    @classmethod
    def safe_cover(cls, value):
        if value and not value.startswith("https://"):
            raise ValueError("Cover URL must use HTTPS")
        return value


class BookUpdate(BaseModel):
    status: ReadingStatus
    rating: int = Field(ge=0, le=5, strict=True)
    favourite_quote: str = Field(max_length=10000)
    # 15,000 characters fit MySQL TEXT even with four-byte emoji characters.
    notes: str = Field(max_length=15000)


class BookOut(BookCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    status: ReadingStatus
    rating: int
    favourite_quote: str
    notes: str


class Statistics(BaseModel):
    total: int
    currently_reading: int
    finished: int
    want_to_read: int


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2000)

    @field_validator("content")
    @classmethod
    def nonempty_content(cls, value):
        if not value.strip():
            raise ValueError("Enter a message")
        return value.strip()


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=12)

    @model_validator(mode="after")
    def last_message_is_user(self):
        if self.messages[-1].role != "user":
            raise ValueError("The last message must be from the user")
        return self


class ChatReply(BaseModel):
    reply: str
