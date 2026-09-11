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

import asyncio
import re
import time
import uuid
from typing import Any, AsyncGenerator

from ..core.config import settings
from ..core.law_titles import describe_citation
from ..core.llm_provider import LLMProvider, get_llm_provider
from ..core.semantic_cache import get_semantic_cache
from ..schemas.answer import AnswerResult, Citation, HopTraceEntry, VerificationReport
from ..schemas.evidence import EvidenceCandidate
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
    o routes.py); None => dung mac dinh trong settings."""
    if retriever is None:
        raise ValueError("retriever la bat buoc (xay index truoc, xem HuongDanThucHien Buoc 5)")

    # 0. Lọc và Làm mờ Dữ liệu Nhạy cảm (PII Masking) theo Nghị định 13/2023/NĐ-CP
    from .pii_masker import mask_pii
    pii_res = mask_pii(question)
    safe_question = pii_res.masked_text if pii_res.has_pii else question

    # 1. Kiểm tra Semantic Cache
    cache = get_semantic_cache()
    cached_data, sim, cache_lat = cache.lookup(safe_question, domain=domain, mode=mode)
    if cached_data is not None:
        cached_result = AnswerResult(**cached_data)
        cached_result.has_pii = pii_res.has_pii
        cached_result.pii_entities = [e.model_dump() for e in pii_res.detected_entities] if pii_res.has_pii else []
        return cached_result

    llm = llm or get_llm_provider()
    start = time.perf_counter()

    if mode in BASELINE_MODES:
        draft, memory, trace, extra = _run_baseline(
            safe_question, domain, mode, retriever, llm, top_k=top_k, extra_candidates=extra_candidates
        )
    elif mode in DECOMPOSITION_MODES:
        draft, memory, trace, extra = _run_decomposition(
            safe_question,
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

    result = AnswerResult(
        request_id=request_id or str(uuid.uuid4()),
        question=question,
        query_plan=plan.model_dump() if plan else None,
        hop_trace=trace,
        final_answer=draft.answer_text,
        citations=_enrich_citations(draft.citations, memory),
        verification=verification,
        latency_ms=latency_ms,
        config_version=settings.config_version,
        is_cached=False,
        has_pii=pii_res.has_pii,
        pii_entities=[e.model_dump() for e in pii_res.detected_entities] if pii_res.has_pii else [],
    )

    # Lưu vào bộ đệm ngữ nghĩa
    cache.store(safe_question, domain, mode, result)
    return result


async def run_qa_stream(
    question: str,
    domain: str,
    mode: str = "videcomp_full",
    retriever: HybridRetriever | None = None,
    llm: LLMProvider | None = None,
    request_id: str | None = None,
    top_k: int | None = None,
    max_corrective_rounds: int | None = None,
    extra_candidates: list[EvidenceCandidate] | None = None,
) -> AsyncGenerator[dict[str, Any], None]:
    """Phản hồi dòng thời gian thực chuẩn SSE (Server-Sent Events) kết hợp Semantic Cache.

    Chuỗi sự kiện theo thứ tự:
    - `cache_hit`: Nếu câu hỏi tương đồng ngữ nghĩa (Cosine > 0.93), trả về tức thì < 150ms.
    - `step`: Trạng thái xử lý hệ thống ('analyzing', 'decomposing', 'retrieving', 'synthesizing', 'verifying').
    - `plan`: [Dòng 1] Kế hoạch phân rã ngay lập tức (Hop 1, Hop 2...).
    - `hop_start`: Bắt đầu thực thi một hop.
    - `hop_retrieval`: [Dòng 2] Danh sách các văn bản luật / y tế đang được truy xuất theo thời gian thực.
    - `hop_done`: Hoàn thành xử lý hop trung gian.
    - `token`: [Dòng 3] Từng token câu trả lời bắn ra liên tục (Typewriter Effect như DeepSeek R1 / ChatGPT).
    - `verification`: Kết quả kiểm chứng luận điểm NLI.
    - `done`: Kết quả hoàn chỉnh AnswerResult đầy đủ.
    """
    if retriever is None:
        yield {"type": "error", "message": "Retriever chưa được khởi tạo"}
        return

    req_id = request_id or str(uuid.uuid4())
    start_time = time.perf_counter()

    # Bước 0: Bảo vệ Dữ liệu Cá nhân (PII Masking) theo Nghị định 13/2023/NĐ-CP
    from .pii_masker import mask_pii
    pii_res = mask_pii(question)
    safe_question = pii_res.masked_text if pii_res.has_pii else question

    if pii_res.has_pii:
        yield {
            "type": "pii_masked",
            "detected": [e.model_dump() for e in pii_res.detected_entities],
            "masked_question": safe_question,
            "message": f"Đã tự động bảo vệ {len(pii_res.detected_entities)} thông tin cá nhân (CCCD/SĐT/Biển số) theo NĐ 13/2023/NĐ-CP.",
        }
        await asyncio.sleep(0.01)

    # Bước 0.1: Kiểm tra Semantic Cache
    cache = get_semantic_cache()
    cached_data, sim, cache_lat = cache.lookup(safe_question, domain=domain, mode=mode)
    if cached_data is not None:
        cached_data["request_id"] = req_id
        cached_data["has_pii"] = pii_res.has_pii
        cached_data["pii_entities"] = [e.model_dump() for e in pii_res.detected_entities] if pii_res.has_pii else []
        yield {
            "type": "cache_hit",
            "similarity": round(sim, 4),
            "cached_question": cached_data.get("cached_question", safe_question),
            "latency_ms": round(cache_lat, 2),
        }
        # Bắn chuỗi token siêu tốc để kích hoạt hiệu ứng Typewriter mượt mà
        full_text = cached_data.get("final_answer", "")
        tokens = re.findall(r"\S+|\s+", full_text)
        chunk_size = 3
        for i in range(0, len(tokens), chunk_size):
            chunk = "".join(tokens[i : i + chunk_size])
            yield {"type": "token", "token": chunk}
            await asyncio.sleep(0.01)
        yield {"type": "done", "result": cached_data}
        return

    llm = llm or get_llm_provider()

    # Bước 1: Phân tích & Phân rã câu hỏi (Dòng 1)
    yield {"type": "step", "step": "analyzing", "message": "Đang phân tích cấu trúc và ý đồ câu hỏi..."}
    await asyncio.sleep(0.01)

    if mode in BASELINE_MODES:
        yield {"type": "step", "step": "retrieving", "message": f"Đang truy xuất tài liệu căn cứ ({mode})..."}
        if mode == "dense_rag":
            candidates = retriever.search(question, filters=RetrievalFilters(domain=domain), dense_only=True, top_k=top_k)
        elif mode == "hybrid_rag":
            candidates = retriever.search(question, filters=RetrievalFilters(domain=domain), use_reranker=False, top_k=top_k)
        else:
            candidates = retriever.search(question, filters=RetrievalFilters(domain=domain), use_reranker=True, top_k=top_k)

        if extra_candidates:
            candidates = list(extra_candidates) + candidates

        # Dòng 2: Hiển thị tài liệu đang truy xuất
        docs = []
        for c in candidates[:6]:
            info = describe_citation(c.doc_id, c.parent_path)
            docs.append({
                "chunk_id": c.chunk_id,
                "doc_id": c.doc_id,
                "law_name": info.get("law_name") or c.doc_id,
                "citation_label": info.get("citation_label") or c.doc_id,
                "article_title": info.get("article_title") or "",
                "score": round(float(getattr(c, "rerank_score", None) or getattr(c, "rrf_score", None) or 1.0), 3),
            })
        yield {"type": "hop_retrieval", "hop_id": "baseline", "docs": docs}

        memory = EvidenceMemory()
        intermediate = answer_hop(question, candidates, llm=llm)
        added = memory.add("baseline", candidates, intermediate)

        yield {"type": "step", "step": "synthesizing", "message": "Đang tổng hợp câu trả lời căn cứ..."}
        draft = synthesize(question, memory, llm=llm)

        # Dòng 3: Bắn từng token typewriter
        tokens = re.findall(r"\S+|\s+", draft.answer_text)
        chunk_size = 2
        for i in range(0, len(tokens), chunk_size):
            chunk = "".join(tokens[i : i + chunk_size])
            yield {"type": "token", "token": chunk}
            await asyncio.sleep(0.02)

        trace = [
            HopTraceEntry(
                hop_id="baseline",
                question=question,
                bound_question=question,
                evidence_ids=[item.chunk_id for item in added],
                intermediate_answer=intermediate,
            )
        ]
        latency_ms = (time.perf_counter() - start_time) * 1000
        result = AnswerResult(
            request_id=req_id,
            question=question,
            query_plan=None,
            hop_trace=trace,
            final_answer=draft.answer_text,
            citations=_enrich_citations(draft.citations, memory),
            verification=None,
            latency_ms=latency_ms,
            config_version=settings.config_version,
            is_cached=False,
        )
        cache.store(question, domain, mode, result)
        yield {"type": "done", "result": result.model_dump()}
        return

    # Chế độ Decomposition (Q1, Q2, Q3)
    analysis = query_analyzer.analyze(question, domain, llm=llm)
    should_decompose = query_analyzer.should_decompose(analysis, settings.multi_hop_threshold)

    if not should_decompose:
        yield {"type": "step", "step": "single_hop", "message": "Câu hỏi đơn ngữ cảnh, chuyển sang chế độ Hybrid RAG tăng tốc..."}
        candidates = retriever.search(question, filters=RetrievalFilters(domain=domain), use_reranker=True, top_k=top_k)
        if extra_candidates:
            candidates = list(extra_candidates) + candidates
        docs = []
        for c in candidates[:6]:
            info = describe_citation(c.doc_id, c.parent_path)
            docs.append({
                "chunk_id": c.chunk_id,
                "doc_id": c.doc_id,
                "law_name": info.get("law_name") or c.doc_id,
                "citation_label": info.get("citation_label") or c.doc_id,
                "article_title": info.get("article_title") or "",
                "score": round(float(getattr(c, "rerank_score", None) or getattr(c, "rrf_score", None) or 1.0), 3),
            })
        yield {"type": "hop_retrieval", "hop_id": "single_hop", "docs": docs}
        memory = EvidenceMemory()
        intermediate = answer_hop(question, candidates, llm=llm)
        added = memory.add("single_hop", candidates, intermediate)
        yield {"type": "step", "step": "synthesizing", "message": "Đang tổng hợp câu trả lời..."}
        draft = synthesize(question, memory, llm=llm)

        tokens = re.findall(r"\S+|\s+", draft.answer_text)
        chunk_size = 2
        for i in range(0, len(tokens), chunk_size):
            chunk = "".join(tokens[i : i + chunk_size])
            yield {"type": "token", "token": chunk}
            await asyncio.sleep(0.02)

        trace = [
            HopTraceEntry(
                hop_id="single_hop",
                question=question,
                bound_question=question,
                evidence_ids=[item.chunk_id for item in added],
                intermediate_answer=intermediate,
            )
        ]
        latency_ms = (time.perf_counter() - start_time) * 1000
        result = AnswerResult(
            request_id=req_id,
            question=question,
            query_plan=None,
            hop_trace=trace,
            final_answer=draft.answer_text,
            citations=_enrich_citations(draft.citations, memory),
            verification=None,
            latency_ms=latency_ms,
            config_version=settings.config_version,
            is_cached=False,
        )
        cache.store(question, domain, mode, result)
        yield {"type": "done", "result": result.model_dump()}
        return

    # Phân rã câu hỏi đa bước
    yield {"type": "step", "step": "decomposing", "message": "Đang phân rã câu hỏi thành chuỗi câu hỏi con có trật tự..."}
    plan = query_decomposer.decompose(
        question,
        domain,
        max_hops=settings.max_hops,
        reasoning_type=analysis.reasoning_type,
        llm=llm,
    )

    # Dòng 1: Hiển thị ngay câu hỏi con đang được phân rã (Hop 1... Hop 2...)
    hops_data = [
        {
            "id": h.id,
            "question": h.question,
            "depends_on": h.depends_on,
            "reasoning_type": getattr(h, "reasoning_type", ""),
        }
        for h in plan.subquestions
    ]
    yield {
        "type": "plan",
        "plan": plan.model_dump(),
        "hops": hops_data,
    }
    await asyncio.sleep(0.02)

    ordered = validate_and_toposort(plan)
    memory = EvidenceMemory()
    trace: list[HopTraceEntry] = []
    context_answers: dict[str, str] = {}

    for hop in ordered:
        bound_question = hop.question
        if mode != "decomp_independent":
            bound_question = bind_variables(hop.question, memory, getattr(hop, "bind", {}))

        yield {
            "type": "hop_start",
            "hop_id": hop.id,
            "question": hop.question,
            "bound_question": bound_question,
        }

        # Dòng 2: Hiển thị các văn bản luật / y tế đang được truy xuất cho Hop này
        candidates = retriever.search(bound_question, filters=RetrievalFilters(domain=domain), top_k=top_k)
        docs = []
        for c in candidates[:5]:
            info = describe_citation(c.doc_id, c.parent_path)
            docs.append({
                "chunk_id": c.chunk_id,
                "doc_id": c.doc_id,
                "law_name": info.get("law_name") or c.doc_id,
                "citation_label": info.get("citation_label") or c.doc_id,
                "article_title": info.get("article_title") or "",
                "score": round(float(getattr(c, "rerank_score", None) or getattr(c, "rrf_score", None) or 1.0), 3),
            })
        yield {"type": "hop_retrieval", "hop_id": hop.id, "docs": docs}
        await asyncio.sleep(0.01)

        intermediate = answer_hop(bound_question, candidates, llm=llm)
        added = memory.add(hop.id, candidates, intermediate)
        context_answers[hop.id] = intermediate

        trace.append(
            HopTraceEntry(
                hop_id=hop.id,
                question=hop.question,
                bound_question=bound_question,
                evidence_ids=[item.chunk_id for item in added],
                intermediate_answer=intermediate,
            )
        )
        yield {"type": "hop_done", "hop_id": hop.id, "intermediate_answer": intermediate}

    if extra_candidates:
        memory.add("supplemental", extra_candidates, "Tài liệu đính kèm & kết quả tìm kiếm web")
        extra_docs = []
        for c in extra_candidates[:6]:
            info = describe_citation(c.doc_id, c.parent_path)
            extra_docs.append({
                "chunk_id": c.chunk_id,
                "doc_id": c.doc_id,
                "law_name": info.get("law_name") or "Tài liệu đính kèm / Web",
                "citation_label": info.get("citation_label") or c.doc_id,
                "article_title": info.get("article_title") or "",
                "score": round(float(getattr(c, "rerank_score", None) or getattr(c, "rrf_score", None) or 1.0), 3),
            })
        yield {"type": "hop_retrieval", "hop_id": "supplemental", "docs": extra_docs}

    # Bước 3: Tổng hợp câu trả lời & Dòng 3 (Bắn từng token Typewriter)
    yield {"type": "step", "step": "synthesizing", "message": "Đang tổng hợp luận điểm và trích dẫn căn cứ xác thực..."}
    draft = synthesize(question, memory, llm=llm)

    # Dòng 3: Bắn từng token câu trả lời ra màn hình (Typewriter Effect)
    tokens = re.findall(r"\S+|\s+", draft.answer_text)
    chunk_size = 2
    for i in range(0, len(tokens), chunk_size):
        chunk = "".join(tokens[i : i + chunk_size])
        yield {"type": "token", "token": chunk}
        await asyncio.sleep(0.018)

    # Bước 4: Kiểm chứng NLI nếu là videcomp_full (Q3)
    verification: VerificationReport | None = None
    if mode == "videcomp_full":
        yield {"type": "step", "step": "verifying", "message": "Đang kiểm chứng tính chân thực luận điểm (Grounding Verifier)..."}
        draft, verification = verify_and_correct(
            draft,
            memory,
            retriever,
            safe_question,
            domain,
            max_corrective_rounds=(
                max_corrective_rounds if max_corrective_rounds is not None else settings.max_corrective_rounds
            ),
            llm=llm,
        )
        yield {
            "type": "verification",
            "verification": verification.model_dump() if verification else None,
        }

    latency_ms = (time.perf_counter() - start_time) * 1000
    result = AnswerResult(
        request_id=req_id,
        question=question,
        query_plan=plan.model_dump() if plan else None,
        hop_trace=trace,
        final_answer=draft.answer_text,
        citations=_enrich_citations(draft.citations, memory),
        verification=verification,
        latency_ms=latency_ms,
        config_version=settings.config_version,
        is_cached=False,
        has_pii=pii_res.has_pii,
        pii_entities=[e.model_dump() for e in pii_res.detected_entities] if pii_res.has_pii else [],
    )

    # Lưu vào bộ đệm ngữ nghĩa cho các lần hỏi tương đương tiếp theo
    cache.store(safe_question, domain, mode, result)

    yield {"type": "done", "result": result.model_dump()}
