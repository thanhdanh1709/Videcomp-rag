"""module grounding_verifier — Kiem chung & Corrective Retrieval (TaiLieuKyThuat Muc 5.9) [BAT BUOC].

Verifier khong duoc "bia" bang chung moi; chi danh dau
supported/unsupported/insufficient. Voi insufficient, he thong tao corrective
query va gioi han toi da 1-2 vong (HuongDanThucHien Buoc 12).
"""
from __future__ import annotations

from ..core.llm_provider import LLMProvider, get_llm_provider
from ..schemas.answer import AnswerDraft, ClaimVerification, VerificationReport
from .evidence_memory import EvidenceMemory
from .retriever import HybridRetriever, RetrievalFilters
from .synthesizer import synthesize


def verify_claim(claim_text: str, evidence_texts: list[str], citations: list[str], llm: LLMProvider) -> ClaimVerification:
    return llm.structured_output(
        prompt=claim_text,
        schema=ClaimVerification,
        context={"claim_text": claim_text, "evidence_texts": evidence_texts, "citations": citations},
    )


def formulate_corrective_query(claim_text: str, original_question: str) -> str:
    return f"{original_question} — bổ sung bằng chứng cho: {claim_text}"


def verify_and_correct(
    draft: AnswerDraft,
    memory: EvidenceMemory,
    retriever: HybridRetriever,
    original_question: str,
    domain: str,
    max_corrective_rounds: int = 1,
    llm: LLMProvider | None = None,
) -> tuple[AnswerDraft, VerificationReport]:
    llm = llm or get_llm_provider()
    rounds_used = 0

    for round_idx in range(max_corrective_rounds + 1):
        claim_results = []
        needs_correction = False
        for claim in draft.claims:
            evidence_items = memory.evidence_for_citations(claim.citations)
            result = verify_claim(
                claim.text, [e.text for e in evidence_items], claim.citations, llm
            )
            claim_results.append(result)
            if result.status == "insufficient":
                needs_correction = True

        if not needs_correction or round_idx == max_corrective_rounds:
            supported = sum(1 for r in claim_results if r.status == "supported")
            rate = supported / len(claim_results) if claim_results else 1.0
            status = "pass" if all(r.status != "unsupported" for r in claim_results) and rate == 1.0 else "fail"
            report = VerificationReport(
                claim_results=claim_results,
                supported_claim_rate=rate,
                status=status,
                corrective_rounds_used=rounds_used,
            )
            return draft, report

        for claim, result in zip(draft.claims, claim_results):
            if result.status == "insufficient":
                q_fix = formulate_corrective_query(claim.text, original_question)
                extra = retriever.search(q_fix, filters=RetrievalFilters(domain=domain))
                hop_id = memory.items[-1].hop_id if memory.items else "corrective"
                memory.extend(hop_id, extra)
        rounds_used += 1
        draft = synthesize(original_question, memory, llm=llm)

    raise AssertionError("khong the toi day: vong lap corrective phai return trong loop")
