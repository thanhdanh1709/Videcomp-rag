"""Repository functions: services/api goi qua day, khong tu viet SQL rai rac
(TaiLieuKyThuat Muc 11: Maintainability - adapter interface ro rang)."""
from __future__ import annotations

from sqlalchemy import select

from ..schemas.answer import AnswerResult
from ..schemas.documents import Document
from .models import (
    AuditLogRecord,
    BenchmarkAnnotationRecord,
    DocumentRecord,
    ExperimentRecord,
    IndexVersionRecord,
    QATraceRecord,
)
from .session import get_session


def save_document(document: Document) -> None:
    with get_session() as session:
        record = session.get(DocumentRecord, document.doc_id)
        if record is None:
            record = DocumentRecord(doc_id=document.doc_id)
        record.domain = document.domain
        record.title = document.title
        record.source_url = document.source_url
        record.doc_number = document.metadata.doc_number
        record.issued_date = document.metadata.issued_date
        record.effective_date = document.metadata.effective_date
        record.version = document.metadata.version
        session.merge(record)
        session.commit()


def save_documents(documents: list[Document]) -> None:
    for doc in documents:
        save_document(doc)


def list_documents(domain: str | None = None) -> list[DocumentRecord]:
    with get_session() as session:
        stmt = select(DocumentRecord)
        if domain:
            stmt = stmt.where(DocumentRecord.domain == domain)
        return list(session.execute(stmt).scalars().all())


def save_index_version(
    *, domain: str, collection: str, embedding_model: str, backend: str, chunk_count: int
) -> IndexVersionRecord:
    with get_session() as session:
        record = IndexVersionRecord(
            domain=domain,
            collection=collection,
            embedding_model=embedding_model,
            backend=backend,
            chunk_count=chunk_count,
        )
        session.add(record)
        session.commit()
        session.refresh(record)
        return record


def save_qa_trace(result: AnswerResult, *, domain: str, mode: str) -> None:
    with get_session() as session:
        record = QATraceRecord(
            request_id=result.request_id,
            question=result.question,
            domain=domain,
            mode=mode,
            query_plan=result.query_plan,
            hop_trace=[hop.model_dump() for hop in result.hop_trace],
            final_answer=result.final_answer,
            citations=[c.model_dump() for c in result.citations],
            verification=result.verification.model_dump() if result.verification else None,
            latency_ms=result.latency_ms,
            config_version=result.config_version,
        )
        session.merge(record)
        session.commit()


def get_qa_trace(request_id: str) -> QATraceRecord | None:
    with get_session() as session:
        return session.get(QATraceRecord, request_id)


def save_experiment(
    *, experiment_id: str, mode: str, dataset_path: str | None, n_items: int, metrics: dict, config_version: str
) -> None:
    with get_session() as session:
        record = ExperimentRecord(
            experiment_id=experiment_id,
            mode=mode,
            dataset_path=dataset_path,
            n_items=n_items,
            metrics=metrics,
            config_version=config_version,
        )
        session.merge(record)
        session.commit()


def get_experiment(experiment_id: str) -> ExperimentRecord | None:
    with get_session() as session:
        return session.get(ExperimentRecord, experiment_id)


def list_experiments(mode: str | None = None) -> list[ExperimentRecord]:
    with get_session() as session:
        stmt = select(ExperimentRecord).order_by(ExperimentRecord.created_at.desc())
        if mode:
            stmt = stmt.where(ExperimentRecord.mode == mode)
        return list(session.execute(stmt).scalars().all())


def upsert_benchmark_annotation(
    *, item_id: str, split: str, annotation_status: str = "draft", annotator: str | None = None, notes: str | None = None
) -> None:
    with get_session() as session:
        record = session.get(BenchmarkAnnotationRecord, item_id)
        if record is None:
            record = BenchmarkAnnotationRecord(item_id=item_id, split=split)
        record.split = split
        record.annotation_status = annotation_status
        record.annotator = annotator
        record.notes = notes
        session.merge(record)
        session.commit()


def get_benchmark_annotation(item_id: str) -> BenchmarkAnnotationRecord | None:
    with get_session() as session:
        return session.get(BenchmarkAnnotationRecord, item_id)


def list_benchmark_annotations(status: str | None = None) -> list[BenchmarkAnnotationRecord]:
    with get_session() as session:
        stmt = select(BenchmarkAnnotationRecord)
        if status:
            stmt = stmt.where(BenchmarkAnnotationRecord.annotation_status == status)
        return list(session.execute(stmt).scalars().all())


def save_audit_log(
    *,
    username: str = "anonymous",
    ip_address: str | None = None,
    action: str,
    domain: str | None = None,
    resource: str,
    details: dict | None = None,
    tokens_prompt: int = 0,
    tokens_completion: int = 0,
    tokens_total: int = 0,
    latency_ms: float = 0.0,
    status: str = "success",
) -> AuditLogRecord:
    with get_session() as session:
        record = AuditLogRecord(
            username=username,
            ip_address=ip_address,
            action=action,
            domain=domain,
            resource=resource,
            details=details or {},
            tokens_prompt=tokens_prompt,
            tokens_completion=tokens_completion,
            tokens_total=tokens_total or (tokens_prompt + tokens_completion),
            latency_ms=latency_ms,
            status=status,
        )
        session.add(record)
        session.commit()
        session.refresh(record)
        return record


def list_audit_logs(
    *,
    limit: int = 50,
    offset: int = 0,
    username: str | None = None,
    action: str | None = None,
    search: str | None = None,
) -> tuple[list[AuditLogRecord], int]:
    with get_session() as session:
        from sqlalchemy import func
        stmt = select(AuditLogRecord).order_by(AuditLogRecord.created_at.desc())
        if username and username.strip():
            stmt = stmt.where(AuditLogRecord.username == username.strip())
        if action and action.strip() and action.strip() != "all":
            stmt = stmt.where(AuditLogRecord.action == action.strip())
        if search and search.strip():
            kw = f"%{search.strip()}%"
            stmt = stmt.where(
                (AuditLogRecord.resource.ilike(kw))
                | (AuditLogRecord.username.ilike(kw))
                | (AuditLogRecord.action.ilike(kw))
            )

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = session.execute(count_stmt).scalar() or 0

        stmt = stmt.limit(limit).offset(offset)
        rows = list(session.execute(stmt).scalars().all())
        return rows, total


def get_audit_stats() -> dict:
    with get_session() as session:
        from sqlalchemy import distinct, func
        total_queries = (
            session.query(func.count(AuditLogRecord.id))
            .filter(AuditLogRecord.action.in_(["query_qa", "query_stream"]))
            .scalar()
            or 0
        )
        total_logs = session.query(func.count(AuditLogRecord.id)).scalar() or 0
        total_tokens = session.query(func.sum(AuditLogRecord.tokens_total)).scalar() or 0
        active_users = session.query(func.count(distinct(AuditLogRecord.username))).scalar() or 0
        pii_masked_count = (
            session.query(func.count(AuditLogRecord.id))
            .filter((AuditLogRecord.action == "pii_masked") | (AuditLogRecord.status == "masked"))
            .scalar()
            or 0
        )

        action_rows = (
            session.query(AuditLogRecord.action, func.count(AuditLogRecord.id))
            .group_by(AuditLogRecord.action)
            .all()
        )
        action_counts = {str(a): int(c) for a, c in action_rows}

        user_rows = (
            session.query(AuditLogRecord.username, func.sum(AuditLogRecord.tokens_total))
            .group_by(AuditLogRecord.username)
            .order_by(func.sum(AuditLogRecord.tokens_total).desc())
            .limit(5)
            .all()
        )
        tokens_by_user = [{"username": str(u), "tokens": int(t or 0)} for u, t in user_rows]

        return {
            "total_queries": int(total_queries),
            "total_logs": int(total_logs),
            "total_tokens": int(total_tokens),
            "active_users": int(active_users),
            "pii_masked_count": int(pii_masked_count),
            "action_counts": action_counts,
            "tokens_by_user": tokens_by_user,
        }

