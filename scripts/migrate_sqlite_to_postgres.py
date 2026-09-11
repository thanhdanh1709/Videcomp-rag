"""Script tiện ích sao chép dữ liệu từ SQLite sang PostgreSQL.

Sử dụng khi bạn chuyển đổi từ database SQLite local (data/videcomp.db) sang
PostgreSQL mà muốn giữ lại toàn bộ tài khoản người dùng, vết trace và annotations.

Cách chạy:
    python scripts/migrate_sqlite_to_postgres.py
"""
import sys
import os

# Dam bao terminal Windows khong bi loi cp1252 khi in tieng Viet
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Dam bao import duoc backend
current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.db.models import (
    Base,
    DocumentRecord,
    IndexVersionRecord,
    QATraceRecord,
    ExperimentRecord,
    BenchmarkAnnotationRecord,
    UserRecord,
    ChatSessionRecord,
    ProjectFolderRecord,
    CustomAgentRecord,
)

SQLITE_DSN = "sqlite:///./data/videcomp.db"


def migrate():
    pg_dsn = settings.db_dsn
    if not pg_dsn.startswith("postgresql"):
        print("[LỖI] Biến DB_DSN trong file .env chưa được đổi sang PostgreSQL.")
        print(f"Giá trị hiện tại: {pg_dsn}")
        print("Vui lòng sửa file .env: DB_DSN=postgresql+psycopg://postgres:<password>@localhost:5432/<dbname>")
        sys.exit(1)

    print(f"[1/4] Kết nối cơ sở dữ liệu nguồn SQLite: {SQLITE_DSN}")
    sqlite_engine = create_engine(SQLITE_DSN)

    print(f"[2/4] Kết nối cơ sở dữ liệu đích PostgreSQL: {pg_dsn.split('@')[-1]}")
    try:
        pg_engine = create_engine(pg_dsn, future=True)
        # Khởi tạo bảng nếu chưa có
        Base.metadata.create_all(pg_engine)
    except Exception as e:
        print(f"[LỖI] Không thể kết nối tới PostgreSQL: {e}")
        print("Gợi ý: Kiểm tra xem database đã được tạo chưa, mật khẩu và port 5432 có chính xác không.")
        sys.exit(1)

    models_to_migrate = [
        ("users", UserRecord),
        ("documents", DocumentRecord),
        ("index_versions", IndexVersionRecord),
        ("qa_traces", QATraceRecord),
        ("experiments", ExperimentRecord),
        ("benchmark_annotations", BenchmarkAnnotationRecord),
        ("projects", ProjectFolderRecord),
        ("custom_agents", CustomAgentRecord),
        ("chat_sessions", ChatSessionRecord),
    ]

    print("[3/4] Bắt đầu di chuyển dữ liệu...")
    with Session(sqlite_engine) as sqlite_db, Session(pg_engine) as pg_db:
        total_rows = 0
        for table_name, model_cls in models_to_migrate:
            try:
                items = sqlite_db.execute(select(model_cls)).scalars().all()
                count = 0
                for item in items:
                    sqlite_db.expunge(item)
                    pg_db.merge(item)
                    count += 1
                pg_db.commit()
                total_rows += count
                print(f"  + Bảng {table_name}: Đã sao chép {count} bản ghi.")
            except Exception as e:
                pg_db.rollback()
                print(f"  - Bảng {table_name}: Bỏ qua hoặc gặp lỗi ({e})")

        # Cập nhật sequence cho các bảng có primary key serial/autoincrement
        for table in ["users", "index_versions"]:
            try:
                pg_db.execute(text(f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), COALESCE((SELECT MAX(id) FROM {table}), 0) + 1, false);"))
                pg_db.commit()
            except Exception:
                pg_db.rollback()

    print(f"[4/4] Hoàn tất! Đã đồng bộ thành công {total_rows} bản ghi sang PostgreSQL.")


if __name__ == "__main__":
    migrate()
