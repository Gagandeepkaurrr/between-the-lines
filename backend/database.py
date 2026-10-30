"""One engine (connection pool), and one short-lived session per request."""
import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import URL, create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

load_dotenv(Path(__file__).with_name(".env"))

# DATABASE_URL is used only by automated tests with a temporary SQLite database.
# Normal application setup always builds a MySQL URL from the .env values.
database_url = os.getenv("DATABASE_URL") or URL.create(
    "mysql+pymysql",
    username=os.getenv("DB_USER", "reading_app"),
    password=os.getenv("DB_PASSWORD", ""),
    host=os.getenv("DB_HOST", "localhost"),
    port=int(os.getenv("DB_PORT", "3306")),
    database=os.getenv("DB_NAME", "between_the_lines"),
    query={"charset": "utf8mb4"},
)
# Hosted MySQL can verify its TLS certificate using a downloaded CA file.
# Leave DB_SSL_CA unset for your existing local MySQL setup.
connect_args = {}
if os.getenv("DB_SSL_CA"):
    connect_args = {
        "ssl_ca": os.environ["DB_SSL_CA"],
        "ssl_verify_cert": True,
        "ssl_verify_identity": True,
    }
engine = create_engine(database_url, pool_pre_ping=True, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
