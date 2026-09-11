"""Orchestrator: chon baseline hay multi-hop pipeline theo `mode`
(TaiLieuKyThuat Muc 3.(2) API Layer/Orchestrator, Muc 9 bang ablation B0..A3).

B0 dense_rag            | Dense-only vanilla RAG
B1 hybrid_rag            | Hybrid RAG (BM25+dense+RRF), khong rerank
B2 hybrid_rerank         | B1 + reranker
Q1 decomp_independent    | Decomposition doc lap, khong dependency
Q2 decomp_dependency     | Q1 + dependency planner + variable binding
Q3 videcomp_full         | Q2 + grounding verifier + corrective retrieval
"""
from __future__ import annotations

import time
import uuid

from ..core.config import settings
from ..core.law_titles import describe_citation
from ..core.llm_provider import LLMProvider, get_llm_provider
from ..schemas.answer import AnswerResult, Citation, HopTraceEntry, VerificationReport
from . import query_analyzer, query_decomposer
from .dependency_planner import validate_and_toposort
from .evidence_memory import EvidenceMemory
from .hop_executor import answer_hop, bind_variables, run_hops
from .retriever import HybridRetriever, RetrievalFilters
from .synthesizer import synthesize
from .verifier import verify_and_correct


def _enrich_citations(citations: list[Citation], memory: EvidenceMemory) -> list[Citation]:
    """Gan law_name/citation_label/article_title cho tung citation dua vao
    doc_id + parent_path da luu trong EvidenceMemory (LLM sinh citation chi
    biet chunk_id/key, khong biet ten van ban - xem synthesizer.py)."""
    evidence_by_chunk = {item.chunk_id: item for item in memory.items}
    enriched = []
    for citation in citations:
        item = evidence_by_chunk.get(citation.chunk_id)
        if item is None:
            enriched.append(citation)
            continue
        info = describe_citation(item.doc_id, item.parent_path)
        enriched.append(citation.model_copy(update=info))
    return enriched

BASELINE_MODES = {"dense_rag", "hybrid_rag", "hybrid_rerank"}
DECOMPOSITION_MODES = {"decomp_independent", "decomp_dependency", "videcomp_full"}


def _run_baseline(
    question: str,
    domain: str,
    mode: str,
    retriever: HybridRetriever,
    llm: LLMProvider,
    top_k: int | None = None,
    extra_candidates: list[EvidenceCandidate] | None = None,
):
    if mode == "dense_rag":
        candidates = retriever.search(question, filters=RetrievalFilters(domain=domain), dense_only=True, top_k=top_k)
    elif mode == "hybrid_rag":
        candidates = retriever.search(
            question, filters=RetrievalFilters(domain=domain), use_reranker=False, top_k=top_k
        )
    else:  # hybrid_rerank
        candidates = retriever.search(
            question, filters=RetrievalFilters(domain=domain), use_reranker=True, top_k=top_k
        )

    if extra_candidates:
        candidates = list(extra_candidates) + candidates

    memory = EvidenceMemory()
    intermediate = answer_hop(question, candidates, llm=llm)
    added = memory.add("baseline", candidates, intermediate)
    draft = synthesize(question, memory, llm=llm)
    trace = [
        HopTraceEntry(
            hop_id="baseline",
            question=question,
            bound_question=question,
            evidence_ids=[item.chunk_id for item in added],
            intermediate_answer=intermediate,
        )
    ]
    return draft, memory, trace, None


def _run_decomposition(
    question: str,
    domain: str,
    mode: str,
    retriever: HybridRetriever,
    llm: LLMProvider,
    top_k: int | None = None,
    max_corrective_rounds: int | None = None,
    extra_candidates: list[EvidenceCandidate] | None = None,
):
    analysis = query_analyzer.analyze(question, domain, llm=llm)
    if not query_analyzer.should_decompose(analysis, settings.multi_hop_threshold):
        # Muc 4.2: xac suat multi-hop < nguong tau => chay standard hybrid RAG
        # de tranh chi phi decomposition khong can thiet.
        draft, memory, trace, _ = _run_baseline(
            question, domain, "hybrid_rerank", retriever, llm, top_k=top_k, extra_candidates=extra_candidates
        )
        return draft, memory, trace, {"plan": None, "verification": None}

    plan = query_decomposer.decompose(
        question,
        domain,
        max_hops=settings.max_hops,
        reasoning_type=analysis.reasoning_type,
        llm=llm,
    )

    if mode == "decomp_independent":
        ordered = validate_and_toposort(plan)
        memory = EvidenceMemory()
        trace: list[HopTraceEntry] = []
        for hop in ordered:
            # Q1: khong bind_variables, khong cho depends_on anh huong retrieval.
            candidates = retriever.search(hop.question, filters=RetrievalFilters(domain=domain), top_k=top_k)
            intermediate = answer_hop(hop.question, candidates, llm=llm)
            added = memory.add(hop.id, candidates, intermediate)
            trace.append(
                HopTraceEntry(
                    hop_id=hop.id,
                    question=hop.question,
                    bound_question=hop.question,
                    evidence_ids=[item.chunk_id for item in added],
                    intermediate_answer=intermediate,
                )
            )
    else:
        memory, trace = run_hops(plan, retriever, domain, llm=llm, top_k=top_k)

    if extra_candidates:
        memory.add("supplemental", extra_candidates, "Tài liệu đính kèm & kết quả tìm kiếm web")

    draft = synthesize(question, memory, llm=llm)

    verification: VerificationReport | None = None
    if mode == "videcomp_full":
        draft, verification = verify_and_correct(
            draft,
            memory,
            retriever,
            question,
            domain,
            max_corrective_rounds=(
                max_corrective_rounds if max_corrective_rounds is not None else settings.max_corrective_rounds
            ),
            llm=llm,
        )

    return draft, memory, trace, {"plan": plan, "verification": verification}


def run_qa(
    question: str,
    domain: str,
    mode: str = "videcomp_full",
    retriever: HybridRetriever | None = None,
    llm: LLMProvider | None = None,
    request_id: str | None = None,
    top_k: int | None = None,
    max_corrective_rounds: int | None = None,
    extra_candidates: list[EvidenceCandidate] | None = None,
) -> AnswerResult:
    """top_k/max_corrective_rounds la override per-request (vd tu QARequest
    o routes.py); None => dung mac dinh trong settings. Truyen tuong minh
    thay vi mutate settings.* truc tiep - FastAPI xu ly nhieu request dong
    thoi trong cung 1 process nen mutate global se lam request nay ghi de
    cau hinh cua request khac dang chay song song, va gia tri con ton tai
    vinh vien sau khi request ket thuc (xem bug cu o routes.py::qa_answer)."""
    if retriever is None:
        raise ValueError("retriever la bat buoc (xay index truoc, xem HuongDanThucHien Buoc 5)")
    llm = llm or get_llm_provider()
    start = time.perf_counter()

    if mode in BASELINE_MODES:
        draft, memory, trace, extra = _run_baseline(
            question, domain, mode, retriever, llm, top_k=top_k, extra_candidates=extra_candidates
        )
    elif mode in DECOMPOSITION_MODES:
        draft, memory, trace, extra = _run_decomposition(
            question,
            domain,
            mode,
            retriever,
            llm,
            top_k=top_k,
            max_corrective_rounds=max_corrective_rounds,
            extra_candidates=extra_candidates,
        )
    else:
        raise ValueError(f"mode khong ho tro: {mode}")

    latency_ms = (time.perf_counter() - start) * 1000
    plan = extra.get("plan") if extra else None
    verification = extra.get("verification") if extra else None

    return AnswerResult(
        request_id=request_id or str(uuid.uuid4()),
        question=question,
        query_plan=plan.model_dump() if plan else None,
        hop_trace=trace,
        final_answer=draft.answer_text,
        citations=_enrich_citations(draft.citations, memory),
        verification=verification,
        latency_ms=latency_ms,
        config_version=settings.config_version,
    )
