"""In-memory runtime cache cho cac object nang (FAISS/BM25 index, Document
day du) - khong hop ly de lay lai tu DB moi request. Trace/experiment/
document-metadata ben ben qua backend/app/db (xem routes.py)."""
from __future__ import annotations

from dataclasses import dataclass, field

from ..schemas.documents import Document
from ..services.retriever import HybridRetriever


@dataclass
class AppState:
    documents: dict[str, list[Document]] = field(default_factory=dict)
    retrievers: dict[str, HybridRetriever] = field(default_factory=dict)
    session_candidates: dict[str, list] = field(default_factory=dict)
    session_files: dict[str, list] = field(default_factory=dict)
    experiment_samples: dict[str, list] = field(default_factory=dict)
