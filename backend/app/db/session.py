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


def _migrate_schema_columns(eng) -> None:
    """Tự động bổ sung các cột mới (share_token, is_public, shared_with) nếu bảng đã tồn tại."""
    from sqlalchemy import text

    try:
        with eng.connect() as conn:
            dialect = eng.dialect.name
            if dialect == "sqlite":
                res = conn.execute(text("PRAGMA table_info(chat_sessions)")).fetchall()
                cols = [r[1] for r in res]
                if cols:
                    if "share_token" not in cols:
                        conn.execute(text("ALTER TABLE chat_sessions ADD COLUMN share_token VARCHAR(64)"))
                    if "is_public" not in cols:
                        conn.execute(text("ALTER TABLE chat_sessions ADD COLUMN is_public BOOLEAN DEFAULT 0"))
                    if "shared_with" not in cols:
                        conn.execute(text("ALTER TABLE chat_sessions ADD COLUMN shared_with JSON DEFAULT '[]'"))

                res_p = conn.execute(text("PRAGMA table_info(projects)")).fetchall()
                cols_p = [r[1] for r in res_p]
                if cols_p:
                    if "share_token" not in cols_p:
                        conn.execute(text("ALTER TABLE projects ADD COLUMN share_token VARCHAR(64)"))
                    if "is_public" not in cols_p:
                        conn.execute(text("ALTER TABLE projects ADD COLUMN is_public BOOLEAN DEFAULT 0"))
                    if "shared_with" not in cols_p:
                        conn.execute(text("ALTER TABLE projects ADD COLUMN shared_with JSON DEFAULT '[]'"))
                conn.commit()
            else:
                # PostgreSQL
                conn.execute(text("ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS share_token VARCHAR(64)"))
                conn.execute(text("ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE"))
                conn.execute(text("ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS shared_with JSON DEFAULT '[]'::json"))
                conn.execute(text("ALTER TABLE projects ADD COLUMN IF NOT EXISTS share_token VARCHAR(64)"))
                conn.execute(text("ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE"))
                conn.execute(text("ALTER TABLE projects ADD COLUMN IF NOT EXISTS shared_with JSON DEFAULT '[]'::json"))
                conn.commit()
    except Exception as ex:
        print(f"[init_db] Column migration notice: {ex}")


def init_db() -> None:
    """Tao bang neu chua ton tai va khoi tao tai khoan admin mac dinh."""
    Base.metadata.create_all(engine)
    _migrate_schema_columns(engine)
    try:
        from ..services.auth_service import seed_default_admin
        with SessionLocal() as db:
            seed_default_admin(db)
    except Exception as exc:
        print(f"[init_db] Seed admin warning: {exc}")



def get_session() -> Session:
    return SessionLocal()

