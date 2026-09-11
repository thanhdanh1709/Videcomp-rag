"""Engine/session cho backend/app/db. Dung chung code cho SQLite (dev, mac
dinh) va PostgreSQL (production qua docker-compose) - chi khac connection
string settings.db_dsn."""
from __future__ import annotations

from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from ..core.config import settings
from .models import Base


def _make_engine():
    dsn = settings.db_dsn
    connect_args = {}
    if dsn.startswith("sqlite"):
        # sqlite:///./data/videcomp.db -> dam bao thu muc data/ ton tai
        db_path = dsn.split("///", 1)[-1]
        if db_path and db_path != ":memory:":
            Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        connect_args["check_same_thread"] = False
    return create_engine(dsn, connect_args=connect_args, future=True)


engine = _make_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, future=True)


def init_db() -> None:
    """Tao bang neu chua ton tai va khoi tao tai khoan admin mac dinh."""
    Base.metadata.create_all(engine)
    try:
        from ..services.auth_service import seed_default_admin
        with SessionLocal() as db:
            seed_default_admin(db)
    except Exception as exc:
        print(f"[init_db] Seed admin warning: {exc}")



def get_session() -> Session:
    return SessionLocal()
