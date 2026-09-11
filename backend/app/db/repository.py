"""Repository functions: services/api goi qua day, khong tu viet SQL rai rac
(TaiLieuKyThuat Muc 11: Maintainability - adapter interface ro rang)."""
from __future__ import annotations

from sqlalchemy import select

from ..schemas.answer import AnswerResult
from ..schemas.documents import Document
from .models import BenchmarkAnnotationRecord, DocumentRecord, ExperimentRecord, IndexVersionRecord, QATraceRecord
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
