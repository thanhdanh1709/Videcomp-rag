"""Evidence candidate / evidence memory item schemas (TaiLieuKyThuat Muc 5.3, 5.7)."""
from __future__ import annotations

from pydantic import BaseModel, Field


class EvidenceCandidate(BaseModel):
    chunk_id: str
    doc_id: str
    text: str
    source_url: str | None = None
    parent_path: list[str] = Field(default_factory=list)
    version: str | None = None
    effective_date: str | None = None
    sparse_rank: int | None = None
    dense_rank: int | None = None
    rrf_score: float | None = None
    rerank_score: float | None = None


class EvidenceItem(EvidenceCandidate):
    hop_id: str
    citation_key: str  # e.g. "[E1]"


class EvidenceBundle(BaseModel):
    items: list[EvidenceItem] = Field(default_factory=list)

    def to_context(self) -> str:
        lines = []
        for item in self.items:
            lines.append(f"{item.citation_key} ({item.chunk_id}): {item.text}")
        return "\n".join(lines)
