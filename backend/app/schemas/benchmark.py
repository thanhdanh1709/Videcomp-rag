"""benchmark_item.json schema (TaiLieuKyThuat Muc 6.2)."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Split = Literal["train", "dev", "test"]
AnnotationStatus = Literal["draft", "reviewed", "adjudicated"]


class BenchmarkSubQuestion(BaseModel):
    id: str
    question: str
    depends_on: list[str] = Field(default_factory=list)


class SupportingEvidence(BaseModel):
    hop_id: str
    doc_id: str
    chunk_id: str


class BenchmarkCandidateDraft(BaseModel):
    """Output cua LLM khi de xuat cau hoi multi-hop tu mot nhom chunk cho truoc
    (HuongDanThucHien Buoc 13: 'co the dung LLM de de xuat cau hoi/decomposition
    nham giam cong suc, nhung gold label cuoi cung phai duoc nguoi gan nhan
    xac nhan'). KHONG co id/split/annotation_status - script gan sau va
    annotation_status LUON la 'draft' cho toi khi con nguoi xac nhan."""

    question: str
    answer: str
    hop_count: int = Field(ge=1, le=4)
    reasoning_type: str
    subquestions: list[BenchmarkSubQuestion]
    supporting_evidence: list[SupportingEvidence]


class BenchmarkItem(BaseModel):
    id: str
    domain: str
    question: str
    answer: str
    hop_count: int = Field(ge=1, le=4)
    reasoning_type: str
    subquestions: list[BenchmarkSubQuestion]
    supporting_evidence: list[SupportingEvidence]
    split: Split
    annotation_status: AnnotationStatus = "draft"
