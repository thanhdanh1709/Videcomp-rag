"""Test backend/app/db bang SQLite tam thoi (khong dung file DB that cua dev),
cung mot ORM code se chay voi PostgreSQL khi settings.db_dsn tro sang do
(TaiLieuKyThuat Muc 11: Reproducibility/Traceability)."""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.db import repository
from backend.app.db.models import Base
from backend.app.schemas.answer import AnswerResult, Citation
from backend.app.schemas.documents import Document, DocumentMetadata


@pytest.fixture
def db_session_factory(monkeypatch, tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'test.db'}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    session_local = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, future=True)
    monkeypatch.setattr(repository, "get_session", session_local)
    return session_local


def test_save_and_list_documents(db_session_factory):
    doc = Document(
        doc_id="D1", domain="legal", title="Ti tle", text="abc", source_url="http://x",
        metadata=DocumentMetadata(doc_number="10/2026", effective_date="2026-04-01"),
    )
    repository.save_document(doc)
    docs = repository.list_documents(domain="legal")
    assert len(docs) == 1
    assert docs[0].doc_number == "10/2026"

    # upsert: saving again with same doc_id updates instead of duplicating
    doc.title = "Updated"
    repository.save_document(doc)
    docs = repository.list_documents(domain="legal")
    assert len(docs) == 1
    assert docs[0].title == "Updated"


def test_save_and_get_qa_trace(db_session_factory):
    result = AnswerResult(
        request_id="R1",
        question="q",
        query_plan=None,
        hop_trace=[],
        final_answer="answer text [E1]",
        citations=[Citation(key="[E1]", chunk_id="C1", source_url=None)],
        verification=None,
        latency_ms=12.3,
        config_version="v1",
    )
    repository.save_qa_trace(result, domain="legal", mode="hybrid_rag")
    record = repository.get_qa_trace("R1")
    assert record is not None
    assert record.final_answer == "answer text [E1]"
    assert record.citations[0]["chunk_id"] == "C1"


def test_save_and_get_experiment(db_session_factory):
    repository.save_experiment(
        experiment_id="exp1", mode="hybrid_rag", dataset_path="d.jsonl", n_items=2,
        metrics={"recall@8": 0.5}, config_version="v1",
    )
    record = repository.get_experiment("exp1")
    assert record is not None
    assert record.metrics["recall@8"] == 0.5
    assert len(repository.list_experiments()) == 1


def test_benchmark_annotation_workflow(db_session_factory):
    repository.upsert_benchmark_annotation(item_id="MH-0001", split="test", annotation_status="draft")
    record = repository.get_benchmark_annotation("MH-0001")
    assert record.annotation_status == "draft"

    repository.upsert_benchmark_annotation(item_id="MH-0001", split="test", annotation_status="reviewed", annotator="alice")
    record = repository.get_benchmark_annotation("MH-0001")
    assert record.annotation_status == "reviewed"
    assert record.annotator == "alice"
    assert len(repository.list_benchmark_annotations(status="reviewed")) == 1
