"""SQLAlchemy ORM models (TaiLieuKyThuat Muc 3.(4): PostgreSQL luu
metadata/trace/annotations). Dung chung mot schema cho ca SQLite (dev local,
khong can Docker) va PostgreSQL (production, qua docker-compose)."""
from __future__ import annotations

import datetime as dt

from sqlalchemy import Boolean, JSON, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


def _utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


class DocumentRecord(Base):
    """Metadata cua document da ingest (TaiLieuKyThuat Muc 6.1)."""

    __tablename__ = "documents"

    doc_id: Mapped[str] = mapped_column(String(255), primary_key=True)
    domain: Mapped[str] = mapped_column(String(32), index=True)
    title: Mapped[str] = mapped_column(Text, default="")
    source_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    doc_number: Mapped[str | None] = mapped_column(String(255), nullable=True)
    issued_date: Mapped[str | None] = mapped_column(String(32), nullable=True)
    effective_date: Mapped[str | None] = mapped_column(String(32), nullable=True)
    version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    ingested_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class IndexVersionRecord(Base):
    """Index version log cho tung lan build (TaiLieuKyThuat Muc 11: Reproducibility -
    'index_version phai duoc log cho moi experiment')."""

    __tablename__ = "index_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    domain: Mapped[str] = mapped_column(String(32), index=True)
    collection: Mapped[str] = mapped_column(String(255))
    embedding_model: Mapped[str] = mapped_column(String(255))
    backend: Mapped[str] = mapped_column(String(32))
    chunk_count: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class QATraceRecord(Base):
    """Trace day du cua mot lan hoi-dap (TaiLieuKyThuat Muc 6.3 answer_result.json),
    de co the truy vet request -> plan -> hop -> evidence -> source
    (Muc 11: Traceability)."""

    __tablename__ = "qa_traces"

    request_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    question: Mapped[str] = mapped_column(Text)
    domain: Mapped[str] = mapped_column(String(32), index=True)
    mode: Mapped[str] = mapped_column(String(32), index=True)
    query_plan: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    hop_trace: Mapped[list] = mapped_column(JSON, default=list)
    final_answer: Mapped[str] = mapped_column(Text)
    citations: Mapped[list] = mapped_column(JSON, default=list)
    verification: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    latency_ms: Mapped[float] = mapped_column(Float)
    config_version: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, index=True)


class ExperimentRecord(Base):
    """Ket qua chay evaluation/ablation (TaiLieuKyThuat Muc 9), de so sanh
    lau dai giua cac lan chay thay vi chi giu trong bo nho tien trinh."""

    __tablename__ = "experiments"

    experiment_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    mode: Mapped[str] = mapped_column(String(32), index=True)
    dataset_path: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    n_items: Mapped[int] = mapped_column(Integer)
    metrics: Mapped[dict] = mapped_column(JSON, default=dict)
    config_version: Mapped[str] = mapped_column(String(64), default="")
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, index=True)


class BenchmarkAnnotationRecord(Base):
    """Trang thai gan nhan cua mot benchmark item (HuongDanThucHien Buoc 13:
    annotation_status draft -> reviewed -> adjudicated). Noi dung cau hoi/dap
    an van song trong data/benchmark/*.jsonl; bang nay chi theo doi workflow
    gan nhan (ai gan nhan, luc nao, trang thai hien tai) - khong nhan doi
    du lieu benchmark."""

    __tablename__ = "benchmark_annotations"

    item_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    split: Mapped[str] = mapped_column(String(16))
    annotation_status: Mapped[str] = mapped_column(String(16), default="draft")
    annotator: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


class UserRecord(Base):
    """User account model cho xac thuc JWT va phan quyen RBAC (admin / user)."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255), default="")
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(32), default="user", index=True)  # "admin" | "user"
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class ChatSessionRecord(Base):
    """Lưu trữ phiên hội thoại đa bước theo người dùng trong PostgreSQL."""

    __tablename__ = "chat_sessions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # session_id
    username: Mapped[str] = mapped_column(String(64), index=True)
    title: Mapped[str] = mapped_column(Text, default="")
    domain: Mapped[str] = mapped_column(String(32), default="legal")
    mode: Mapped[str] = mapped_column(String(32), default="videcomp_full")
    folder_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    turns: Mapped[list] = mapped_column(JSON, default=list)  # Danh sách các lượt hỏi đáp đầy đủ
    share_token: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    shared_with: Mapped[list] = mapped_column(JSON, default=list)  # list[{"username": str, "role": "viewer" | "editor", "shared_at": str}]
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, index=True)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


class ProjectFolderRecord(Base):
    """Thư mục dự án gom nhóm các phiên chat theo vụ việc."""

    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # proj-xxxx
    username: Mapped[str] = mapped_column(String(64), index=True)
    title: Mapped[str] = mapped_column(String(255))
    desc: Mapped[str] = mapped_column(Text, default="")
    icon: Mapped[str] = mapped_column(String(64), default="folder")
    color: Mapped[str] = mapped_column(String(32), default="emerald")
    share_token: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    shared_with: Mapped[list] = mapped_column(JSON, default=list)  # list[{"username": str, "role": "viewer" | "editor", "shared_at": str}]
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)



class CustomAgentRecord(Base):
    """Chuyên gia tùy chỉnh / Custom GPTs tạo từ GPT Builder."""

    __tablename__ = "custom_agents"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # agent-xxxx
    username: Mapped[str] = mapped_column(String(64), index=True)  # hoặc "system" cho agent mẫu
    name: Mapped[str] = mapped_column(String(255))
    desc: Mapped[str] = mapped_column(Text, default="")
    author: Mapped[str] = mapped_column(String(255), default="Bởi bạn")
    domain: Mapped[str] = mapped_column(String(32), default="legal")
    category: Mapped[str] = mapped_column(String(64), default="productivity")
    instructions: Mapped[str] = mapped_column(Text, default="")
    starters: Mapped[list] = mapped_column(JSON, default=list)
    icon: Mapped[str] = mapped_column(String(64), default="school")
    session_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    knowledge_files: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


class AuditLogRecord(Base):
    """Nhật ký Kiểm toán (Audit Logs) bảo mật & truy vết tuân thủ Nghị định 13/2023/NĐ-CP."""

    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(64), index=True, default="anonymous")
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    action: Mapped[str] = mapped_column(String(64), index=True)  # "query_qa", "document_upload", "export_dossier", "index_build", "pii_masked"
    domain: Mapped[str | None] = mapped_column(String(32), nullable=True)
    resource: Mapped[str] = mapped_column(Text)  # Câu hỏi, tên file, hoặc resource identifier
    details: Mapped[dict] = mapped_column(JSON, default=dict)  # Metadata, citations, pii_types_detected
    tokens_prompt: Mapped[int] = mapped_column(Integer, default=0)
    tokens_completion: Mapped[int] = mapped_column(Integer, default=0)
    tokens_total: Mapped[int] = mapped_column(Integer, default=0)
    latency_ms: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(32), default="success")  # "success" | "error" | "masked"
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, index=True)



