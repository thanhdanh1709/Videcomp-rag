"""Answer synthesis / verification schemas (TaiLieuKyThuat Muc 5.8, 5.9, 6.3)."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

ClaimSupport = Literal["supported", "unsupported", "insufficient"]


class Claim(BaseModel):
    text: str
    citations: list[str] = Field(default_factory=list)  # citation_key list


class Citation(BaseModel):
    key: str
    chunk_id: str
    source_url: str | None = None
    # Lam giau tu core/law_titles.py sau khi LLM sinh citation (LLM chi biet
    # chunk_id/key, khong biet ten van ban) - xem pipeline.py::_enrich_citations.
    law_name: str | None = None
    citation_label: str | None = None  # vd "Khoản 1 Điều 260 Bộ luật Hình sự số 100/2015/QH13"
    article_title: str | None = None  # vd "Tội vi phạm quy định về tham gia giao thông đường bộ"


class HopAnswer(BaseModel):
    """Cau tra loi trung gian ngan cho mot hop (TaiLieuKyThuat 5.6:
    'intermediate = answer_hop(q, evidence) # short, evidence-grounded')."""

    answer: str


class AnswerDraft(BaseModel):
    answer_text: str
    claims: list[Claim] = Field(default_factory=list)
    citations: list[Citation] = Field(default_factory=list)
    uncertainty_note: str | None = None
    evidence_ids_used: list[str] = Field(default_factory=list)


class ClaimVerification(BaseModel):
    claim: str
    status: ClaimSupport
    citations: list[str] = Field(default_factory=list)


class VerificationReport(BaseModel):
    claim_results: list[ClaimVerification] = Field(default_factory=list)
    supported_claim_rate: float
    status: Literal["pass", "fail"]
    corrective_rounds_used: int = 0


class HopTraceEntry(BaseModel):
    hop_id: str
    question: str
    bound_question: str
    evidence_ids: list[str]
    intermediate_answer: str


class AnswerResult(BaseModel):
    request_id: str
    question: str
    query_plan: dict | None = None
    hop_trace: list[HopTraceEntry] = Field(default_factory=list)
    final_answer: str
    citations: list[Citation] = Field(default_factory=list)
    verification: VerificationReport | None = None
    latency_ms: float
    is_cached: bool = False
    cache_similarity: float | None = None
    cached_question: str | None = None
    has_pii: bool = False
    pii_entities: list[dict] = Field(default_factory=list)

