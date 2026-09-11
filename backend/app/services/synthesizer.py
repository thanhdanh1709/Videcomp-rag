"""module answer_synthesizer — Tong hop cau tra loi (TaiLieuKyThuat Muc 5.8) [BAT BUOC].

Output gom answer_text, claims[], citations[], uncertainty_note (neu co) va
evidence_ids_used. Chi duoc dung bang chung trong evidence_bundle.
"""
from __future__ import annotations

from ..core.llm_provider import LLMProvider, get_llm_provider
from ..schemas.answer import AnswerDraft
from .evidence_memory import EvidenceMemory

_CONSTRAINTS = [
    "Chỉ dùng bằng chứng được cung cấp",
    "Mọi mệnh đề quan trọng phải có citation_key",
    "Nếu thiếu dữ liệu, nói rõ chưa đủ bằng chứng",
]


def build_answer_prompt(question: str, evidence_bundle_context: str) -> str:
    constraints_text = "\n".join(f"- {c}" for c in _CONSTRAINTS)
    return (
        f"Câu hỏi: {question}\n\n"
        f"Bằng chứng (evidence bundle):\n{evidence_bundle_context}\n\n"
        f"Ràng buộc:\n{constraints_text}"
    )


def synthesize(question: str, memory: EvidenceMemory, llm: LLMProvider | None = None) -> AnswerDraft:
    llm = llm or get_llm_provider()
    prompt = build_answer_prompt(question, memory.to_context())
    evidence_items = [
        {
            "chunk_id": item.chunk_id,
            "text": item.text,
            "citation_key": item.citation_key,
            "source_url": item.source_url,
        }
        for item in memory.items
    ]
    return llm.structured_output(
        prompt=prompt,
        schema=AnswerDraft,
        context={"question": question, "evidence_items": evidence_items},
    )
