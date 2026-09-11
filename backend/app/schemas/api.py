"""Request/response schemas for the FastAPI layer (TaiLieuKyThuat Muc 7)."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from .documents import Domain

Mode = Literal[
    "dense_rag",
    "hybrid_rag",
    "hybrid_rerank",
    "decomp_independent",
    "decomp_dependency",
    "videcomp_full",
]


class IngestRequest(BaseModel):
    manifest_path: str
    domain: Domain


class IndexBuildRequest(BaseModel):
    domain: Domain
    collection: str


class IndexLoadRequest(BaseModel):
    """Nap index BM25/vector da build san tren dia vao AppState (khong build
    lai/embed lai tu dau) - dung khi index da co qua scripts/build_bm25.py +
    scripts/build_vector_index.py."""

    domain: Domain
    bm25_dir: str
    vector_dir: str


class QueryAnalyzeRequest(BaseModel):
    question: str
    domain: Domain


class QueryDecomposeRequest(BaseModel):
    question: str
    domain: Domain
    max_hops: int = 4


class QARequest(BaseModel):
    question: str
    domain: Domain
    mode: Mode = "videcomp_full"
    top_k: int = 8
    rerank_top_k: int = 5
    max_corrective_rounds: int = 1
    session_id: str | None = None
    web_search: bool = False


class EvaluationRunRequest(BaseModel):
    dataset_path: str
    mode: Mode
