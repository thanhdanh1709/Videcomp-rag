"""FastAPI routes (TaiLieuKyThuat Muc 7). UI khong duoc goi truc tiep vector DB
hoac LLM — moi truy cap di qua API layer nay.

Persistence: metadata/trace/experiment di qua backend/app/db (PostgreSQL o
production, SQLite o dev local - xem TaiLieuKyThuat Muc 11 Reproducibility/
Traceability). Cac object nang (FAISS/BM25 index, Document.text day du) van
giu trong AppState o tien trinh - khong hop ly de deserialize tu DB moi
request; index da duoc persist rieng ra file qua index_builder.py.
"""
from __future__ import annotations

import uuid
from pathlib import Path
from typing import Any

import numpy as np
from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from ..core.config import AVAILABLE_EMBEDDING_MODELS, AVAILABLE_RERANKER_MODELS, settings
from ..core.embedding_provider import get_embedding_provider, reload_embedding_provider
from ..core.llm_provider import fetch_ollama_models, fetch_vllm_models, get_llm_provider
from ..core.reranker_provider import get_reranker_provider, reload_reranker_provider
from ..core.task_queue import task_manager
from ..db import repository
from ..schemas.api import (
    IndexBuildRequest,
    IndexLoadRequest,
    IngestRequest,
    QARequest,
    QueryAnalyzeRequest,
    QueryDecomposeRequest,
)
from ..schemas.benchmark import BenchmarkItem
from ..core.semantic_cache import get_semantic_cache
from ..schemas.answer import AnswerResult
from ..services import evaluator, file_parser, ingestion, query_analyzer, query_decomposer, web_search
from ..services.chunker import build_chunks
from ..services.index_builder import BM25Index, FaissVectorIndex, build_bm25_index, build_vector_index
from ..services.pipeline import run_qa, run_qa_stream
from ..services.retriever import HybridRetriever
from .state import AppState

router = APIRouter(prefix="/api/v1")
state = AppState()


@router.get("/health")
def health():
    return {"status": "ok", "config_version": settings.config_version}


@router.post("/documents/ingest")
def documents_ingest(req: IngestRequest):
    if not Path(req.manifest_path).exists():
        raise HTTPException(status_code=404, detail="manifest_path khong ton tai")
    documents = ingestion.ingest_manifest(req.manifest_path)
    state.documents[req.domain] = documents
    repository.save_documents(documents)
    return {"count": len(documents), "doc_ids": [d.doc_id for d in documents]}


@router.post("/index/build")
def index_build(req: IndexBuildRequest):
    documents = state.documents.get(req.domain)
    if not documents:
        raise HTTPException(status_code=400, detail="chua ingest tai lieu cho domain nay")
    chunks = [c for doc in documents for c in build_chunks(doc)]
    bm25 = build_bm25_index(chunks)
    vector = build_vector_index(chunks, backend=settings.vector_backend, collection=req.collection)
    retriever = HybridRetriever(bm25_index=bm25, vector_index=vector)
    state.retrievers[req.domain] = retriever
    embedding_model = getattr(retriever.embedder, "model_name", "hashing")
    repository.save_index_version(
        domain=req.domain,
        collection=req.collection,
        embedding_model=embedding_model,
        backend=settings.vector_backend,
        chunk_count=len(chunks),
    )
    return {"chunk_count": len(chunks), "collection": req.collection}


@router.post("/index/load")
def index_load(req: IndexLoadRequest):
    """Nap index BM25 + vector (FAISS) da build san tren dia (vi du qua
    scripts/build_bm25.py / scripts/build_vector_index.py, hoac index that o
    data/indices/) vao AppState - khong embed lai, nen nhanh hon nhieu so
    voi /index/build khi da co san index cho domain nay."""
    if not Path(req.bm25_dir).exists():
        raise HTTPException(status_code=404, detail=f"bm25_dir khong ton tai: {req.bm25_dir}")
    if not Path(req.vector_dir).exists():
        raise HTTPException(status_code=404, detail=f"vector_dir khong ton tai: {req.vector_dir}")
    bm25 = BM25Index.load(req.bm25_dir)
    vector = FaissVectorIndex.load(req.vector_dir)
    retriever = HybridRetriever(bm25_index=bm25, vector_index=vector)
    state.retrievers[req.domain] = retriever
    return {"domain": req.domain, "chunk_count": len(bm25.chunks), "bm25_dir": req.bm25_dir, "vector_dir": req.vector_dir}


@router.post("/query/analyze")
def query_analyze(req: QueryAnalyzeRequest):
    llm = get_llm_provider()
    analysis = query_analyzer.analyze(req.question, req.domain, llm=llm)
    return analysis.model_dump()


@router.post("/query/decompose")
def query_decompose(req: QueryDecomposeRequest):
    llm = get_llm_provider()
    plan = query_decomposer.decompose(req.question, req.domain, max_hops=req.max_hops, llm=llm)
    return plan.model_dump()


@router.post("/documents/upload")
async def documents_upload(file: UploadFile = File(...), session_id: str = Form(...)):
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Tệp tải lên rỗng")
    try:
        candidates = file_parser.parse_file_to_candidates(file.filename, content)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Không thể xử lý tệp {file.filename}: {exc}")

    if session_id not in state.session_candidates:
        state.session_candidates[session_id] = []
        state.session_files[session_id] = []

    state.session_candidates[session_id].extend(candidates)
    file_info = {
        "filename": file.filename,
        "size": len(content),
        "chunk_count": len(candidates),
    }
    state.session_files[session_id] = [
        f for f in state.session_files[session_id] if f["filename"] != file.filename
    ] + [file_info]

    return {
        "status": "success",
        "filename": file.filename,
        "size": len(content),
        "chunk_count": len(candidates),
        "total_session_chunks": len(state.session_candidates[session_id]),
    }


@router.post("/documents/upload-async", status_code=202)
async def documents_upload_async(file: UploadFile = File(...), session_id: str = Form(...)):
    """Tải lên tài liệu lớn qua hàng đợi tác vụ nền với tiến trình 0% -> 100%."""
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Tệp tải lên rỗng")

    task = task_manager.create_task(name=f"Trích xuất & lập chỉ mục: {file.filename}")

    def _process_file(progress_callback):
        candidates = file_parser.parse_file_to_candidates(
            file.filename, content, progress_callback=progress_callback
        )
        if session_id not in state.session_candidates:
            state.session_candidates[session_id] = []
            state.session_files[session_id] = []

        # Xóa bớt candidate cũ của cùng tên file nếu upload đè
        state.session_candidates[session_id] = [
            c for c in state.session_candidates[session_id]
            if not c.source_url or file.filename not in c.source_url
        ]
        state.session_candidates[session_id].extend(candidates)

        file_info = {
            "filename": file.filename,
            "size": len(content),
            "chunk_count": len(candidates),
        }
        state.session_files[session_id] = [
            f for f in state.session_files[session_id] if f["filename"] != file.filename
        ] + [file_info]

        return {
            "status": "success",
            "filename": file.filename,
            "size": len(content),
            "chunk_count": len(candidates),
            "total_session_chunks": len(state.session_candidates[session_id]),
        }

    task_manager.run_in_background(task.task_id, _process_file)
    return {
        "task_id": task.task_id,
        "status": "pending",
        "filename": file.filename,
        "size": len(content),
    }


@router.get("/tasks/{task_id}")
def get_task_status(task_id: str):
    """Lấy trạng thái và tiến độ (0% -> 100%) của một tác vụ nền (Polling)."""
    task = task_manager.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Không tìm thấy task_id")
    return task.to_dict()


@router.get("/tasks/{task_id}/events")
async def get_task_events(task_id: str):
    """Server-Sent Events (SSE) đẩy dữ liệu tiến độ thời gian thực về frontend."""
    task = task_manager.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Không tìm thấy task_id")

    async def _event_stream():
        import json
        async for event in task_manager.subscribe(task_id):
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        _event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/documents/session/{session_id}")
def documents_get_session(session_id: str):
    return {
        "session_id": session_id,
        "files": state.session_files.get(session_id, []),
        "chunk_count": len(state.session_candidates.get(session_id, [])),
    }


@router.delete("/documents/session/{session_id}/{filename}")
def documents_delete_session_file(session_id: str, filename: str):
    if session_id in state.session_files:
        state.session_files[session_id] = [
            f for f in state.session_files[session_id] if f["filename"] != filename
        ]
    if session_id in state.session_candidates:
        state.session_candidates[session_id] = [
            c for c in state.session_candidates[session_id] if not c.source_url or filename not in c.source_url
        ]
    return {"status": "ok", "remaining_files": len(state.session_files.get(session_id, []))}


@router.post("/qa/answer")
def qa_answer(req: QARequest):
    retriever = state.retrievers.get(req.domain)
    if retriever is None:
        raise HTTPException(status_code=400, detail="chua build index cho domain nay")

    extra_candidates = []

    # 1. Bổ sung các đoạn văn bản từ tệp đính kèm trong phiên làm việc hiện tại
    if req.session_id and req.session_id in state.session_candidates:
        extra_candidates.extend(state.session_candidates[req.session_id])

    # 2. Bổ sung các đoạn trích từ Tìm kiếm Web thời gian thực nếu được bật
    if req.web_search:
        try:
            web_cands = web_search.web_search_to_candidates(req.question, max_results=4)
            extra_candidates.extend(web_cands)
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning("Lỗi web search trong qa_answer: %s", exc)

    result = run_qa(
        req.question,
        req.domain,
        mode=req.mode,
        retriever=retriever,
        top_k=req.rerank_top_k,
        max_corrective_rounds=req.max_corrective_rounds,
        extra_candidates=extra_candidates if extra_candidates else None,
    )
    repository.save_qa_trace(result, domain=req.domain, mode=req.mode)
    return result.model_dump()


@router.post("/qa/answer-stream")
async def qa_answer_stream(req: QARequest):
    """Phản hồi dòng thời gian thực chuẩn SSE (Server-Sent Events) kết hợp Semantic Cache."""
    retriever = state.retrievers.get(req.domain)
    if retriever is None:
        raise HTTPException(status_code=400, detail="chua build index cho domain nay")

    extra_candidates = []

    # 1. Bổ sung các đoạn văn bản từ tệp đính kèm trong phiên làm việc hiện tại
    if req.session_id and req.session_id in state.session_candidates:
        extra_candidates.extend(state.session_candidates[req.session_id])

    # 2. Bổ sung các đoạn trích từ Tìm kiếm Web thời gian thực nếu được bật
    if req.web_search:
        try:
            web_cands = web_search.web_search_to_candidates(req.question, max_results=4)
            extra_candidates.extend(web_cands)
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning("Lỗi web search trong qa_answer_stream: %s", exc)

    async def _event_generator():
        import json
        async for event in run_qa_stream(
            req.question,
            req.domain,
            mode=req.mode,
            retriever=retriever,
            top_k=req.rerank_top_k,
            max_corrective_rounds=req.max_corrective_rounds,
            extra_candidates=extra_candidates if extra_candidates else None,
        ):
            # Nếu là event done, lưu QA trace vào DB repository
            if event.get("type") == "done" and "result" in event:
                try:
                    res_dict = event["result"]
                    ans_res = AnswerResult(**res_dict)
                    repository.save_qa_trace(ans_res, domain=req.domain, mode=req.mode)
                except Exception as save_err:
                    import logging
                    logging.getLogger(__name__).warning("Lỗi lưu QA trace từ stream: %s", save_err)

            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        _event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/qa/{request_id}/trace")
def qa_trace(request_id: str):
    record = repository.get_qa_trace(request_id)
    if record is None:
        raise HTTPException(status_code=404, detail="request_id khong ton tai")
    return {
        "request_id": record.request_id,
        "question": record.question,
        "domain": record.domain,
        "mode": record.mode,
        "query_plan": record.query_plan,
        "hop_trace": record.hop_trace,
        "final_answer": record.final_answer,
        "citations": record.citations,
        "verification": record.verification,
        "latency_ms": record.latency_ms,
        "config_version": record.config_version,
        "created_at": record.created_at.isoformat(),
    }


@router.post("/evaluation/run")
def evaluation_run(
    dataset_path: str,
    mode: str,
    domain: str = "legal",
    include_ragas: bool = True,
    sample_limit: int | None = None,
):
    """Chạy đánh giá Benchmark kèm đo lường tự động chuẩn Ragas / TruLens (RAG Triad)."""
    if not Path(dataset_path).exists():
        raise HTTPException(status_code=404, detail="dataset_path khong ton tai")
    retriever = state.retrievers.get(domain)
    if retriever is None:
        raise HTTPException(status_code=400, detail="chua build index cho domain nay")

    from ..services.ragas_evaluator import evaluate_rag_triad

    items = []
    with open(dataset_path, encoding="utf-8") as f:
        for line in f:
            if line.strip():
                items.append(BenchmarkItem.model_validate_json(line))

    if sample_limit and sample_limit > 0:
        items = items[:sample_limit]

    chunk_map = {}
    if retriever and hasattr(retriever, "bm25_index") and retriever.bm25_index and hasattr(retriever.bm25_index, "chunks"):
        chunk_map = {ch.chunk_id: ch.text for ch in retriever.bm25_index.chunks}

    retrieved_by_item = {}
    sample_evaluations = []
    faithfulness_scores = []
    answer_relevance_scores = []
    context_precision_scores = []

    for item in items:
        result = run_qa(item.question, item.domain, mode=mode, retriever=retriever)
        retrieved_by_item[item.id] = [c.chunk_id for c in result.citations]

        if include_ragas:
            gold_chunk_ids = [e.chunk_id for e in item.supporting_evidence]
            contexts = []
            if result.citations:
                contexts = [
                    {
                        "chunk_id": c.chunk_id,
                        "text": chunk_map.get(c.chunk_id) or c.citation_label or c.article_title or c.law_name or "",
                        "clause": c.citation_label or "",
                    }
                    for c in result.citations
                ]
            else:
                # Fallback to retrieved chunks if citations empty
                for h in result.hop_trace:
                    for ev_id in h.evidence_ids:
                        contexts.append({
                            "chunk_id": ev_id,
                            "text": chunk_map.get(ev_id, ""),
                            "clause": ev_id,
                        })
            triad = evaluate_rag_triad(
                question=item.question,
                answer=result.final_answer,
                contexts=contexts,
                gold_chunk_ids=gold_chunk_ids,
            )
            faithfulness_scores.append(triad.faithfulness.score)
            answer_relevance_scores.append(triad.answer_relevance.score)
            context_precision_scores.append(triad.context_precision.score)

            sample_evaluations.append({
                "id": item.id,
                "question": item.question,
                "gold_answer": item.answer,
                "generated_answer": result.final_answer,
                "faithfulness": triad.faithfulness.score,
                "answer_relevance": triad.answer_relevance.score,
                "context_precision": triad.context_precision.score,
                "rag_triad_index": triad.rag_triad_index,
                "grade": triad.grade,
                "claims": [c.model_dump() for c in triad.faithfulness.claims],
                "contexts": [cx.model_dump() for cx in triad.context_precision.contexts],
                "relevance_reasoning": triad.answer_relevance.reasoning,
            })

    metrics = evaluator.aggregate_retrieval_metrics(items, retrieved_by_item)
    if include_ragas and items:
        n_items = len(items)
        metrics["faithfulness"] = round(sum(faithfulness_scores) / n_items, 3)
        metrics["answer_relevance"] = round(sum(answer_relevance_scores) / n_items, 3)
        metrics["context_precision"] = round(sum(context_precision_scores) / n_items, 3)
        metrics["rag_triad_index"] = round(
            (metrics["faithfulness"] + metrics["answer_relevance"] + metrics["context_precision"]) / 3.0, 3
        )

    experiment_id = f"{mode}-{uuid.uuid4().hex[:8]}"
    repository.save_experiment(
        experiment_id=experiment_id,
        mode=mode,
        dataset_path=dataset_path,
        n_items=len(items),
        metrics=metrics,
        config_version=settings.config_version,
    )
    state.experiment_samples[experiment_id] = sample_evaluations

    return {
        "experiment_id": experiment_id,
        "mode": mode,
        "metrics": metrics,
        "n_items": len(items),
        "sample_evaluations": sample_evaluations,
    }


@router.get("/evaluation/{experiment_id}")
def evaluation_get(experiment_id: str):
    record = repository.get_experiment(experiment_id)
    if record is None:
        raise HTTPException(status_code=404, detail="experiment_id khong ton tai")
    return {
        "experiment_id": record.experiment_id,
        "mode": record.mode,
        "dataset_path": record.dataset_path,
        "n_items": record.n_items,
        "metrics": record.metrics,
        "config_version": record.config_version,
        "created_at": record.created_at.isoformat(),
        "sample_evaluations": state.experiment_samples.get(experiment_id, []),
    }


@router.get("/evaluation/{experiment_id}/samples")
def evaluation_get_samples(experiment_id: str):
    """Lấy danh sách đánh giá chi tiết từng câu hỏi (per-sample RAG Triad diagnostics)."""
    return state.experiment_samples.get(experiment_id, [])


class SingleRagasEvalRequest(BaseModel):
    question: str
    answer: str
    contexts: list[Any] = Field(default_factory=list)
    gold_chunk_ids: list[str] = Field(default_factory=list)
    domain: str = "legal"


@router.post("/evaluation/ragas/single")
def evaluate_single_ragas_item(req: SingleRagasEvalRequest):
    """Đo lường trực tiếp bộ ba chất lượng Ragas (Faithfulness, Answer Relevance, Context Precision) cho 1 mẫu."""
    from ..services.ragas_evaluator import evaluate_rag_triad

    triad = evaluate_rag_triad(
        question=req.question,
        answer=req.answer,
        contexts=req.contexts,
        gold_chunk_ids=req.gold_chunk_ids,
    )
    return triad.model_dump()


def _update_env_file(key: str, value: str):
    env_path = Path(".env")
    if not env_path.exists():
        env_path.write_text(f"{key}={value}\n", encoding="utf-8")
        return
    lines = env_path.read_text(encoding="utf-8").splitlines()
    found = False
    new_lines = []
    for line in lines:
        if line.startswith(f"{key}=") or line.startswith(f"{key.lower()}="):
            new_lines.append(f"{key}={value}")
            found = True
        else:
            new_lines.append(line)
    if not found:
        new_lines.append(f"{key}={value}")
    env_path.write_text("\n".join(new_lines) + "\n", encoding="utf-8")


from pydantic import BaseModel
from typing import Optional


class AdminConfigRequest(BaseModel):
    anthropic_api_key: Optional[str] = None
    llm_provider: Optional[str] = None
    llm_base_url: Optional[str] = None
    llm_api_key: Optional[str] = None
    llm_model: Optional[str] = None
    ollama_base_url: Optional[str] = None
    ollama_model: Optional[str] = None
    vllm_base_url: Optional[str] = None
    vllm_model: Optional[str] = None
    vllm_api_key: Optional[str] = None


class TestApiKeyRequest(BaseModel):
    provider: str
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    model: Optional[str] = None


@router.get("/admin/config")
def admin_get_config():
    key = settings.anthropic_api_key or ""
    masked_key = (key[:8] + "..." + key[-4:]) if len(key) > 12 else ("****" if key else "")
    vllm_key = settings.vllm_api_key or ""
    masked_vllm_key = (vllm_key[:4] + "..." + vllm_key[-4:]) if len(vllm_key) > 8 else ("****" if vllm_key else "")

    return {
        "llm_provider": settings.llm_provider,
        "anthropic_api_key_masked": masked_key,
        "has_anthropic_key": bool(settings.anthropic_api_key),
        "llm_base_url": settings.llm_base_url,
        "llm_model": settings.llm_model,
        "ollama_base_url": settings.ollama_base_url,
        "ollama_model": settings.ollama_model,
        "vllm_base_url": settings.vllm_base_url,
        "vllm_model": settings.vllm_model,
        "vllm_api_key_masked": masked_vllm_key,
        "has_vllm_key": bool(settings.vllm_api_key),
        "config_version": settings.config_version,
    }


@router.post("/admin/config")
def admin_update_config(req: AdminConfigRequest):
    if req.anthropic_api_key is not None:
        new_key = req.anthropic_api_key.strip()
        settings.anthropic_api_key = new_key
        _update_env_file("ANTHROPIC_API_KEY", new_key)
    if req.llm_provider is not None:
        settings.llm_provider = req.llm_provider
        _update_env_file("LLM_PROVIDER", req.llm_provider)
    if req.llm_base_url is not None:
        settings.llm_base_url = req.llm_base_url
        _update_env_file("LLM_BASE_URL", req.llm_base_url)
    if req.llm_api_key is not None:
        settings.llm_api_key = req.llm_api_key
        _update_env_file("LLM_API_KEY", req.llm_api_key)
    if req.llm_model is not None:
        settings.llm_model = req.llm_model
        _update_env_file("LLM_MODEL", req.llm_model)

    # Cập nhật Ollama On-Premise
    if req.ollama_base_url is not None:
        settings.ollama_base_url = req.ollama_base_url
        _update_env_file("OLLAMA_BASE_URL", req.ollama_base_url)
    if req.ollama_model is not None:
        settings.ollama_model = req.ollama_model
        _update_env_file("OLLAMA_MODEL", req.ollama_model)

    # Cập nhật vLLM Cluster
    if req.vllm_base_url is not None:
        settings.vllm_base_url = req.vllm_base_url
        _update_env_file("VLLM_BASE_URL", req.vllm_base_url)
    if req.vllm_model is not None:
        settings.vllm_model = req.vllm_model
        _update_env_file("VLLM_MODEL", req.vllm_model)
    if req.vllm_api_key is not None:
        settings.vllm_api_key = req.vllm_api_key
        _update_env_file("VLLM_API_KEY", req.vllm_api_key)

    key = settings.anthropic_api_key or ""
    masked_key = (key[:8] + "..." + key[-4:]) if len(key) > 12 else ("****" if key else "")
    vllm_key = settings.vllm_api_key or ""
    masked_vllm_key = (vllm_key[:4] + "..." + vllm_key[-4:]) if len(vllm_key) > 8 else ("****" if vllm_key else "")

    return {
        "status": "success",
        "message": "Đã cập nhật cấu hình API Key và mô hình thành công",
        "llm_provider": settings.llm_provider,
        "anthropic_api_key_masked": masked_key,
        "has_anthropic_key": bool(settings.anthropic_api_key),
        "ollama_base_url": settings.ollama_base_url,
        "ollama_model": settings.ollama_model,
        "vllm_base_url": settings.vllm_base_url,
        "vllm_model": settings.vllm_model,
        "vllm_api_key_masked": masked_vllm_key,
    }


@router.post("/admin/test-api-key")
def admin_test_api_key(req: TestApiKeyRequest):
    provider = req.provider.lower()

    if provider == "mock":
        return {
            "status": "ok",
            "message": "Chế độ Mock (heuristic thực nghiệm) luôn sẵn sàng, không yêu cầu kết nối mạng!",
        }

    if provider == "anthropic":
        key_to_test = (req.api_key or "").strip()
        if not key_to_test or key_to_test in ("test", "existing", "existing-key"):
            key_to_test = settings.anthropic_api_key or ""
        if not key_to_test:
            raise HTTPException(status_code=400, detail="Vui lòng nhập Anthropic API Key để kiểm tra")
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=key_to_test)
            res = client.messages.create(
                model="claude-3-5-haiku-20241022",
                max_tokens=10,
                messages=[{"role": "user", "content": "ping"}],
            )
            return {"status": "ok", "message": "Kết nối thành công tới Anthropic Claude API!"}
        except Exception as exc:
            return {"status": "error", "message": f"Kiểm tra thất bại: {exc}"}

    if provider == "ollama":
        base_url = req.base_url or settings.ollama_base_url
        models = fetch_ollama_models(base_url)
        if models:
            target_model = req.model or settings.ollama_model
            has_target = any(target_model in m for m in models)
            model_note = f" (Mô hình '{target_model}' đã sẵn sàng)" if has_target else f" (Chưa tải '{target_model}', có sẵn: {', '.join(models[:3])})"
            return {
                "status": "ok",
                "message": f"Kết nối máy chủ On-Premise Ollama thành công! Phát hiện {len(models)} mô hình{model_note}.",
                "models": models,
            }
        else:
            return {
                "status": "error",
                "message": f"Không thể kết nối tới Ollama tại '{base_url}'. Hãy kiểm tra lệnh 'ollama serve' hoặc địa chỉ IP mạng nội bộ.",
            }

    if provider == "vllm":
        base_url = req.base_url or settings.vllm_base_url
        models = fetch_vllm_models(base_url, api_key=req.api_key)
        if models:
            return {
                "status": "ok",
                "message": f"Kết nối máy chủ GPU vLLM Cluster thành công! Đang phục vụ các mô hình: {', '.join(models)}.",
                "models": models,
            }
        else:
            return {
                "status": "error",
                "message": f"Không thể kết nối tới cụm vLLM tại '{base_url}'. Hãy kiểm tra dịch vụ vLLM hoặc cấu hình mạng nội bộ.",
            }

    return {"status": "ok", "message": f"Đã lưu cấu hình cho nhà cung cấp {provider}."}


@router.get("/admin/local-models")
def admin_get_local_models(provider: str = "ollama", base_url: Optional[str] = None):
    """Lấy danh sách các mô hình đang được cài đặt trên máy chủ On-Premise (Ollama/vLLM)."""
    if provider == "ollama":
        models = fetch_ollama_models(base_url)
        return {"provider": "ollama", "models": models}
    elif provider == "vllm":
        models = fetch_vllm_models(base_url)
        return {"provider": "vllm", "models": models}
    return {"provider": provider, "models": []}


class CacheConfigUpdate(BaseModel):
    threshold: float | None = None
    enabled: bool | None = None


@router.get("/admin/cache-stats")
def admin_get_cache_stats():
    """Lấy số liệu thống kê thời gian thực của Bộ đệm Ngữ nghĩa (Semantic Cache)."""
    cache = get_semantic_cache()
    return cache.get_stats()


@router.post("/admin/cache-clear")
def admin_clear_cache():
    """Xóa toàn bộ bản ghi bộ đệm ngữ nghĩa đã lưu."""
    cache = get_semantic_cache()
    cache.clear()
    return {"status": "ok", "message": "Đã xóa toàn bộ bộ nhớ đệm ngữ nghĩa"}


@router.post("/admin/cache-config")
def admin_update_cache_config(req: CacheConfigUpdate):
    """Cập nhật ngưỡng tương đồng Cosine hoặc bật/tắt bộ đệm ngữ nghĩa."""
    cache = get_semantic_cache()
    if req.threshold is not None:
        cache.set_threshold(req.threshold)
    if req.enabled is not None:
        settings.semantic_cache_enabled = req.enabled
    return {
        "status": "ok",
        "message": "Đã cập nhật cấu hình Bộ đệm Ngữ nghĩa",
        "stats": cache.get_stats(),
    }


# ==============================================================================
# QUẢN TRỊ MÔ HÌNH EMBEDDING & RERANKER TIẾNG VIỆT & OCR ĐA PHƯƠNG THÁI
# ==============================================================================

class ModelsConfigUpdate(BaseModel):
    embedding_model: str | None = None
    reranker_model: str | None = None
    enable_pdf_table_extraction: bool | None = None
    enable_vision_ocr: bool | None = None
    vision_model: str | None = None


class ModelsTestRequest(BaseModel):
    sample_text: str | None = None
    candidate_texts: list[str] | None = None


@router.get("/admin/models-config")
def admin_get_models_config():
    """Lấy danh mục và cấu hình hiện tại của mô hình Embedding, Reranker tiếng Việt và OCR đa phương thái."""
    embedder = get_embedding_provider()
    reranker = get_reranker_provider()
    return {
        "status": "ok",
        "active_embedding_model": settings.embedding_model,
        "active_embedding_dim": embedder.dim,
        "active_reranker_model": settings.reranker_model,
        "enable_pdf_table_extraction": settings.enable_pdf_table_extraction,
        "enable_vision_ocr": settings.enable_vision_ocr,
        "vision_model": settings.vision_model,
        "available_embedding_models": list(AVAILABLE_EMBEDDING_MODELS.values()),
        "available_reranker_models": list(AVAILABLE_RERANKER_MODELS.values()),
    }


@router.post("/admin/models-config")
def admin_update_models_config(req: ModelsConfigUpdate):
    """Cập nhật nóng mô hình Embedding / Reranker tiếng Việt và tùy chọn OCR đa phương thái."""
    messages = []
    if req.embedding_model is not None and req.embedding_model.strip():
        try:
            new_emb = reload_embedding_provider(req.embedding_model)
            _update_env_file("EMBEDDING_MODEL", settings.embedding_model)
            get_semantic_cache().reload_cache()
            messages.append(f"Mô hình embedding: {settings.embedding_model} ({new_emb.dim}-dim)")
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Không thể nạp mô hình embedding '{req.embedding_model}': {exc}")

    if req.reranker_model is not None and req.reranker_model.strip():
        try:
            reload_reranker_provider(req.reranker_model)
            _update_env_file("RERANKER_MODEL", settings.reranker_model)
            messages.append(f"Mô hình reranker: {settings.reranker_model}")
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Không thể nạp mô hình reranker '{req.reranker_model}': {exc}")

    if req.enable_pdf_table_extraction is not None:
        settings.enable_pdf_table_extraction = req.enable_pdf_table_extraction
    if req.enable_vision_ocr is not None:
        settings.enable_vision_ocr = req.enable_vision_ocr
    if req.vision_model is not None:
        settings.vision_model = req.vision_model

    return {
        "status": "ok",
        "message": "Cập nhật thành công: " + (", ".join(messages) if messages else "Đã lưu cấu hình đa phương thái"),
        "active_embedding_model": settings.embedding_model,
        "active_embedding_dim": get_embedding_provider().dim,
        "active_reranker_model": settings.reranker_model,
        "enable_pdf_table_extraction": settings.enable_pdf_table_extraction,
        "enable_vision_ocr": settings.enable_vision_ocr,
        "vision_model": settings.vision_model,
    }


@router.post("/admin/models-test")
def admin_test_models(req: ModelsTestRequest):
    """Kiểm tra khả năng mã hóa vector tiếng Việt (Hán - Việt) và tái xếp hạng Reranker."""
    import time

    sample_text = (req.sample_text or "").strip() or (
        "Trách nhiệm liên đới bồi thường thiệt hại ngoài hợp đồng theo nguyên tắc suy đoán lỗi "
        "quy định tại Bộ luật Dân sự đối với hành vi xâm phạm quyền tác giả."
    )
    candidates = req.candidate_texts or [
        "Điều 584 Bộ luật Dân sự: Người nào có hành vi xâm phạm tính mạng, sức khỏe, danh dự, nhân phẩm, tài sản, quyền, lợi ích hợp pháp khác của người khác mà gây thiệt hại thì phải bồi thường.",
        "Quy định về thời hiệu khởi kiện yêu cầu bồi thường thiệt hại là 03 năm kể từ ngày người có quyền yêu cầu biết hoặc phải biết quyền, lợi ích hợp pháp của mình bị xâm phạm.",
        "Thủ tục đăng ký thành lập doanh nghiệp tư nhân và hồ sơ nộp tại Phòng Đăng ký kinh doanh thuộc Sở Kế hoạch và Đầu tư.",
    ]

    # 1. Test Embedding
    t0 = time.perf_counter()
    embedder = get_embedding_provider()
    vectors = embedder.embed([sample_text])
    emb_latency_ms = round((time.perf_counter() - t0) * 1000, 2)
    vec = vectors[0]
    norm = float(np.linalg.norm(vec))

    # 2. Test Reranker
    t1 = time.perf_counter()
    reranker = get_reranker_provider()
    scores = reranker.rank(sample_text, candidates)
    rerank_latency_ms = round((time.perf_counter() - t1) * 1000, 2)

    ranked_results = []
    for idx, (cand, score) in enumerate(sorted(zip(candidates, scores), key=lambda x: x[1], reverse=True), start=1):
        ranked_results.append({
            "rank": idx,
            "score": round(score, 4),
            "text": cand,
        })

    return {
        "status": "ok",
        "sample_text": sample_text,
        "embedding": {
            "model": getattr(embedder, "model_name", settings.embedding_model),
            "dim": embedder.dim,
            "norm": round(norm, 4),
            "preview": [round(float(v), 4) for v in vec[:6].tolist()],
            "latency_ms": emb_latency_ms,
        },
        "reranker": {
            "model": getattr(reranker, "model_name", settings.reranker_model),
            "latency_ms": rerank_latency_ms,
            "ranked_candidates": ranked_results,
        },
    }



# ==============================================================================
# XÁC THỰC JWT & PHÂN QUYỀN (AUTH ROUTES)
# ==============================================================================

class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str
    confirm_password: str
    full_name: str | None = None


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/auth/register")
def auth_register(req: RegisterRequest):
    import re
    from ..db.session import get_session
    from ..services import auth_service

    username = req.username.strip().lower()
    email = req.email.strip().lower()
    password = req.password
    confirm_password = req.confirm_password

    if not username or len(username) < 3:
        raise HTTPException(status_code=400, detail="Tên đăng nhập phải có ít nhất 3 ký tự.")

    if not re.match(r"^[a-zA-Z0-9_.-]+$", username):
        raise HTTPException(
            status_code=400,
            detail="Tên đăng nhập chỉ được chứa chữ cái, số, gạch dưới, gạch ngang và dấu chấm.",
        )

    if not email or "@" not in email or "." not in email:
        raise HTTPException(status_code=400, detail="Địa chỉ email không hợp lệ.")

    if password != confirm_password:
        raise HTTPException(status_code=400, detail="Mật khẩu xác nhận không khớp với mật khẩu.")

    valid, err_msg = auth_service.validate_password_strength(password)
    if not valid:
        raise HTTPException(status_code=400, detail=err_msg)

    with get_session() as db:
        auth_service.seed_default_admin(db)
        if auth_service.get_user_by_username(db, username):
            raise HTTPException(status_code=400, detail="Tên đăng nhập đã tồn tại trong hệ thống.")
        if auth_service.get_user_by_email(db, email):
            raise HTTPException(status_code=400, detail="Email này đã được sử dụng bởi tài khoản khác.")

        user = auth_service.create_user(
            db,
            username=username,
            email=email,
            password=password,
            full_name=req.full_name or username,
            role="user",
        )

        token = auth_service.create_access_token(
            data={"sub": user.username, "role": user.role, "email": user.email, "name": user.full_name}
        )

        return {
            "status": "success",
            "message": "Đăng ký tài khoản thành công!",
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "username": user.username,
                "email": user.email,
                "name": user.full_name,
                "role": user.role,
            },
        }


@router.post("/auth/login")
def auth_login(req: LoginRequest):
    from ..db.session import get_session
    from ..services import auth_service

    username = req.username.strip().lower()
    password = req.password

    if not username or not password:
        raise HTTPException(status_code=400, detail="Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.")

    with get_session() as db:
        auth_service.seed_default_admin(db)
        user = auth_service.get_user_by_username(db, username)
        if not user:
            user = auth_service.get_user_by_email(db, username)

        if not user or not auth_service.verify_password(password, user.hashed_password):
            raise HTTPException(status_code=401, detail="Tên đăng nhập hoặc mật khẩu không chính xác.")

        token = auth_service.create_access_token(
            data={"sub": user.username, "role": user.role, "email": user.email, "name": user.full_name}
        )

        return {
            "status": "success",
            "message": "Đăng nhập thành công!",
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "username": user.username,
                "email": user.email,
                "name": user.full_name,
                "role": user.role,
            },
        }


@router.get("/auth/me")
def auth_me(authorization: str | None = Header(None)):
    from ..db.session import get_session
    from ..services import auth_service

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Thiếu mã xác thực (Bearer Token).")
    token = authorization.split(" ", 1)[1]
    payload = auth_service.decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=401, detail="Token không hợp lệ hoặc đã hết hạn.")

    with get_session() as db:
        user = auth_service.get_user_by_username(db, payload["sub"])
        if not user:
            raise HTTPException(status_code=404, detail="Người dùng không tồn tại.")
        return {
            "username": user.username,
            "email": user.email,
            "name": user.full_name,
            "role": user.role,
        }


# ==============================================================================
# HỆ THỐNG LƯU TRỮ BỀN VỮNG POSTGRESQL: SESSIONS, PROJECTS & CUSTOM GPTS
# ==============================================================================

def _get_current_username(authorization: str | None = Header(None)) -> str:
    """Xác định username từ Bearer JWT Token. Nếu không đăng nhập trả về 'guest'."""
    from ..services import auth_service

    if not authorization or not authorization.startswith("Bearer "):
        return "guest"
    token = authorization.split(" ", 1)[1]
    payload = auth_service.decode_access_token(token)
    if not payload or "sub" not in payload:
        return "guest"
    return payload["sub"]


# --- 1. CHAT SESSIONS (Lịch sử đoạn chat đa bước) ---

class SaveSessionRequest(BaseModel):
    session_id: str
    title: str = ""
    domain: str = "legal"
    mode: str = "videcomp_full"
    folder_id: str | None = None
    turns: list[dict] = Field(default_factory=list)


class AssignFolderRequest(BaseModel):
    folder_id: str | None = None


class SessionFeedbackRequest(BaseModel):
    request_id: str
    feedback: str  # "up" | "down"


@router.get("/sessions")
def list_user_sessions(authorization: str | None = Header(None)):
    """Lấy danh sách tất cả các phiên chat của người dùng (bao gồm phiên sở hữu và phiên được chia sẻ)."""
    from ..db.session import get_session
    from ..db.models import ChatSessionRecord
    from sqlalchemy import select

    username = _get_current_username(authorization)
    with get_session() as db:
        stmt = (
            select(ChatSessionRecord)
            .order_by(ChatSessionRecord.updated_at.desc())
        )
        all_records = db.execute(stmt).scalars().all()
        user_records = []
        for r in all_records:
            if r.username == username or r.username == "guest":
                user_records.append(r)
            else:
                shared = r.shared_with or []
                if any(m.get("username") == username for m in shared):
                    user_records.append(r)

        return [
            {
                "sessionId": r.id,
                "title": r.title,
                "domain": r.domain,
                "mode": r.mode,
                "folderId": r.folder_id,
                "turns": r.turns,
                "lastCreatedAt": (r.updated_at or r.created_at).isoformat(),
                "isShared": r.username != username,
                "isPublic": bool(r.is_public),
                "shareToken": r.share_token,
                "sharedWith": r.shared_with or [],
                "owner": r.username,
            }
            for r in user_records
        ]


@router.post("/sessions")
def save_user_session(req: SaveSessionRequest, authorization: str | None = Header(None)):
    """Lưu hoặc cập nhật một phiên chat cùng các lượt hỏi đáp vào PostgreSQL."""
    from ..db.session import get_session
    from ..db.models import ChatSessionRecord
    import datetime as dt

    username = _get_current_username(authorization)
    title = req.title
    if not title and req.turns:
        first_q = req.turns[0].get("question", "")
        title = first_q[:120] if first_q else "Phiên hỏi đáp mới"

    with get_session() as db:
        record = db.get(ChatSessionRecord, req.session_id)
        if record:
            # Kiểm tra quyền sở hữu hoặc quyền Editor
            is_owner = (record.username == username or record.username == "guest")
            is_editor = any(m.get("username") == username and m.get("role") == "editor" for m in (record.shared_with or []))
            if not is_owner and not is_editor:
                raise HTTPException(status_code=403, detail="Không có quyền chỉnh sửa phiên chat này (chỉ xem hoặc chưa được cấp quyền).")
            record.turns = req.turns
            if title:
                record.title = title
            if req.domain:
                record.domain = req.domain
            if req.mode:
                record.mode = req.mode
            if req.folder_id is not None:
                record.folder_id = req.folder_id
            record.updated_at = dt.datetime.now(dt.timezone.utc)
        else:
            record = ChatSessionRecord(
                id=req.session_id,
                username=username,
                title=title or "Phiên hỏi đáp",
                domain=req.domain,
                mode=req.mode,
                folder_id=req.folder_id,
                turns=req.turns,
            )
            db.add(record)
        db.commit()
        db.refresh(record)
        return {
            "status": "success",
            "sessionId": record.id,
            "title": record.title,
            "turnsCount": len(record.turns),
        }


@router.delete("/sessions/{session_id}")
def delete_user_session(session_id: str, authorization: str | None = Header(None)):
    """Xóa một phiên chat khỏi PostgreSQL."""
    from ..db.session import get_session
    from ..db.models import ChatSessionRecord

    username = _get_current_username(authorization)
    with get_session() as db:
        record = db.get(ChatSessionRecord, session_id)
        if not record:
            return {"status": "success", "message": "Phiên chat không tồn tại hoặc đã xóa."}
        if record.username != username and record.username != "guest":
            raise HTTPException(status_code=403, detail="Không có quyền xóa phiên chat này.")
        db.delete(record)
        db.commit()
        return {"status": "success", "message": "Đã xóa phiên chat thành công."}


@router.put("/sessions/{session_id}/folder")
def assign_session_folder(session_id: str, req: AssignFolderRequest, authorization: str | None = Header(None)):
    """Gán hoặc gỡ phiên chat vào thư mục dự án."""
    from ..db.session import get_session
    from ..db.models import ChatSessionRecord
    import datetime as dt

    username = _get_current_username(authorization)
    with get_session() as db:
        record = db.get(ChatSessionRecord, session_id)
        if not record:
            raise HTTPException(status_code=404, detail="Phiên chat không tồn tại.")
        if record.username != username and record.username != "guest":
            raise HTTPException(status_code=403, detail="Không có quyền chỉnh sửa phiên chat này.")
        record.folder_id = req.folder_id
        # Cập nhật cả trong các turns
        updated_turns = []
        for t in record.turns:
            t_copy = dict(t)
            t_copy["folderId"] = req.folder_id or None
            updated_turns.append(t_copy)
        record.turns = updated_turns
        record.updated_at = dt.datetime.now(dt.timezone.utc)
        db.commit()
        return {"status": "success", "folderId": record.folder_id}


@router.post("/sessions/{session_id}/feedback")
def set_session_feedback(session_id: str, req: SessionFeedbackRequest, authorization: str | None = Header(None)):
    """Cập nhật đánh giá hữu ích (up/down) cho một lượt hỏi đáp trong phiên."""
    from ..db.session import get_session
    from ..db.models import ChatSessionRecord
    import datetime as dt

    username = _get_current_username(authorization)
    with get_session() as db:
        record = db.get(ChatSessionRecord, session_id)
        if not record:
            raise HTTPException(status_code=404, detail="Phiên chat không tồn tại.")
        if record.username != username and record.username != "guest":
            raise HTTPException(status_code=403, detail="Không có quyền cập nhật phiên chat này.")

        updated = False
        new_turns = []
        for t in record.turns:
            t_copy = dict(t)
            if t_copy.get("requestId") == req.request_id:
                # Đổi trạng thái hoặc toggle
                t_copy["feedback"] = req.feedback if t_copy.get("feedback") != req.feedback else None
                updated = True
            new_turns.append(t_copy)

        if updated:
            record.turns = new_turns
            record.updated_at = dt.datetime.now(dt.timezone.utc)
            db.commit()
        return {"status": "success", "updated": updated}


# --- SHARING & EXPORT MODELS ---
class ShareMemberItem(BaseModel):
    username: str
    role: str = "viewer"  # "viewer" | "editor"
    shared_at: str | None = None


class UpdateShareRequest(BaseModel):
    is_public: bool | None = None
    shared_with: list[ShareMemberItem] | None = None
    regenerate_token: bool = False


class ExportStandaloneRequest(BaseModel):
    format: str = "docx"  # "docx" | "pdf"
    custom_title: str | None = None
    turn_index: int = -1
    session_data: dict[str, Any]


@router.get("/sessions/{session_id}/share")
def get_session_share_config(session_id: str, authorization: str | None = Header(None)):
    """Lấy thông tin chia sẻ và danh sách thành viên cộng tác của phiên chat."""
    from ..db.session import get_session
    from ..db.models import ChatSessionRecord
    import secrets

    username = _get_current_username(authorization)
    with get_session() as db:
        record = db.get(ChatSessionRecord, session_id)
        if not record:
            raise HTTPException(status_code=404, detail="Phiên chat không tồn tại.")
        is_owner = (record.username == username or record.username == "guest")
        is_member = any(m.get("username") == username for m in (record.shared_with or []))
        if not is_owner and not is_member and not record.is_public:
            raise HTTPException(status_code=403, detail="Bạn không có quyền xem thông tin chia sẻ của phiên này.")

        # Tự động tạo share_token nếu chưa có
        if not record.share_token:
            record.share_token = secrets.token_urlsafe(16)
            db.commit()
            db.refresh(record)

        return {
            "sessionId": record.id,
            "title": record.title,
            "isPublic": bool(record.is_public),
            "shareToken": record.share_token,
            "sharedWith": record.shared_with or [],
            "owner": record.username,
            "isOwner": is_owner,
        }


@router.post("/sessions/{session_id}/share")
def update_session_share_config(session_id: str, req: UpdateShareRequest, authorization: str | None = Header(None)):
    """Cập nhật chế độ công khai và danh sách thành viên cộng tác của phiên chat."""
    from ..db.session import get_session
    from ..db.models import ChatSessionRecord
    import datetime as dt
    import secrets

    username = _get_current_username(authorization)
    with get_session() as db:
        record = db.get(ChatSessionRecord, session_id)
        if not record:
            raise HTTPException(status_code=404, detail="Phiên chat không tồn tại.")
        if record.username != username and record.username != "guest":
            raise HTTPException(status_code=403, detail="Chỉ chủ sở hữu phiên chat mới có quyền thay đổi chia sẻ.")

        if req.is_public is not None:
            record.is_public = req.is_public

        if req.shared_with is not None:
            now_str = dt.datetime.now(dt.timezone.utc).strftime("%d/%m/%Y %H:%M")
            members = []
            for m in req.shared_with:
                members.append({
                    "username": m.username.strip(),
                    "role": m.role if m.role in ("viewer", "editor") else "viewer",
                    "shared_at": m.shared_at or now_str,
                })
            record.shared_with = members

        if req.regenerate_token or not record.share_token:
            record.share_token = secrets.token_urlsafe(16)

        record.updated_at = dt.datetime.now(dt.timezone.utc)
        db.commit()
        db.refresh(record)

        return {
            "status": "success",
            "sessionId": record.id,
            "isPublic": record.is_public,
            "shareToken": record.share_token,
            "sharedWith": record.shared_with or [],
            "owner": record.username,
        }


@router.get("/share/session/{share_token}")
def get_shared_session_by_token(share_token: str, authorization: str | None = Header(None)):
    """Truy cập phiên chat chia sẻ qua đường link bảo mật bằng share_token."""
    from ..db.session import get_session
    from ..db.models import ChatSessionRecord
    from sqlalchemy import select

    username = _get_current_username(authorization)
    with get_session() as db:
        stmt = select(ChatSessionRecord).where(ChatSessionRecord.share_token == share_token)
        record = db.execute(stmt).scalars().first()
        if not record:
            raise HTTPException(status_code=404, detail="Đường dẫn chia sẻ không tồn tại hoặc đã bị thu hồi.")

        is_owner = (record.username == username or record.username == "guest")
        member_match = next((m for m in (record.shared_with or []) if m.get("username") == username), None)
        user_role = "owner" if is_owner else (member_match.get("role", "viewer") if member_match else ("viewer" if record.is_public else None))

        if not record.is_public and not is_owner and not member_match:
            raise HTTPException(status_code=403, detail="Phiên này đang ở chế độ riêng tư và bạn chưa được cấp quyền truy cập.")

        return {
            "sessionId": record.id,
            "title": record.title,
            "domain": record.domain,
            "mode": record.mode,
            "folderId": record.folder_id,
            "turns": record.turns,
            "lastCreatedAt": (record.updated_at or record.created_at).isoformat(),
            "owner": record.username,
            "isPublic": bool(record.is_public),
            "shareToken": record.share_token,
            "userRole": user_role or "viewer",
            "canEdit": user_role in ("owner", "editor"),
        }


@router.get("/sessions/{session_id}/export")
def export_session_dossier(
    session_id: str,
    format: str = "docx",
    turn_index: int = -1,
    title: str | None = None,
    authorization: str | None = Header(None),
):
    """Xuất báo cáo thẩm định chuyên nghiệp (.docx hoặc .pdf) cho phiên chat."""
    import re
    import urllib.parse
    from ..db.session import get_session
    from ..db.models import ChatSessionRecord
    from ..services.dossier_exporter import build_dossier_data, generate_docx_dossier, generate_pdf_dossier

    username = _get_current_username(authorization)
    with get_session() as db:
        record = db.get(ChatSessionRecord, session_id)
        if not record:
            raise HTTPException(status_code=404, detail="Phiên chat không tồn tại.")
        is_owner = (record.username == username or record.username == "guest")
        is_member = any(m.get("username") == username for m in (record.shared_with or []))
        if not is_owner and not is_member and not record.is_public:
            raise HTTPException(status_code=403, detail="Bạn không có quyền truy cập phiên chat này để xuất báo cáo.")

        dossier_data = build_dossier_data(record, turn_index=turn_index, custom_title=title)

    safe_title = re.sub(r'[^a-zA-Z0-9_\-]', '_', dossier_data.get("session_id", "dossier")[:20])
    if format.lower() == "pdf":
        buf = generate_pdf_dossier(dossier_data)
        media_type = "application/pdf"
        filename = f"Bao_cao_Tham_dinh_{safe_title}.pdf"
    else:
        buf = generate_docx_dossier(dossier_data)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        filename = f"Bao_cao_Tham_dinh_{safe_title}.docx"

    import io
    encoded_filename = urllib.parse.quote(filename)
    return StreamingResponse(
        io.BytesIO(buf),
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"; filename*=UTF-8\'\'{encoded_filename}',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@router.post("/export/dossier")
def export_standalone_dossier(req: ExportStandaloneRequest):
    """Xuất báo cáo trực tiếp từ dữ liệu truyền lên (không yêu cầu lưu trước vào DB)."""
    import io
    import re
    import urllib.parse
    from ..services.dossier_exporter import build_dossier_data, generate_docx_dossier, generate_pdf_dossier

    dossier_data = build_dossier_data(req.session_data, turn_index=req.turn_index, custom_title=req.custom_title)
    safe_title = re.sub(r'[^a-zA-Z0-9_\-]', '_', dossier_data.get("session_id", "dossier")[:20])

    if req.format.lower() == "pdf":
        buf = generate_pdf_dossier(dossier_data)
        media_type = "application/pdf"
        filename = f"Bao_cao_Tham_dinh_{safe_title}.pdf"
    else:
        buf = generate_docx_dossier(dossier_data)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        filename = f"Bao_cao_Tham_dinh_{safe_title}.docx"

    encoded_filename = urllib.parse.quote(filename)
    return StreamingResponse(
        io.BytesIO(buf),
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"; filename*=UTF-8\'\'{encoded_filename}',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


# --- 2. PROJECTS (Thư mục dự án / Vụ việc pháp lý) ---

class CreateProjectRequest(BaseModel):
    id: str | None = None
    title: str
    desc: str = ""
    icon: str = "folder"
    color: str = "emerald"


class UpdateProjectRequest(BaseModel):
    title: str | None = None
    desc: str | None = None
    icon: str | None = None
    color: str | None = None


DEFAULT_PROJECTS = [
    {
        "id": "proj-labor",
        "title": "Bộ luật Lao động & HĐLĐ",
        "desc": "Rà soát điều khoản bồi thường, đơn phương chấm dứt và thỏa ước tập thể.",
        "icon": "gavel",
        "color": "emerald",
    },
    {
        "id": "proj-land",
        "title": "Nghiên cứu Luật Đất đai 2024",
        "desc": "Quy định bồi thường giải tỏa, quyền sử dụng đất doanh nghiệp mới nhất.",
        "icon": "apartment",
        "color": "cyan",
    },
    {
        "id": "proj-anaphylaxis",
        "title": "Phác đồ Cấp cứu Sốc phản vệ",
        "desc": "Thông tư 51/2017/TT-BYT, phân độ phản vệ và hướng dẫn hồi sức lâm sàng.",
        "icon": "medical_services",
        "color": "rose",
    },
    {
        "id": "proj-benchmark",
        "title": "Thực nghiệm Benchmark RAG",
        "desc": "Đo lường Hit@k, MRR, Faithfulness và Answer Relevance trên tập dữ liệu Q3.",
        "icon": "science",
        "color": "amber",
    },
]


@router.get("/projects")
def list_user_projects(authorization: str | None = Header(None)):
    """Lấy danh sách thư mục dự án của người dùng (bao gồm dự án sở hữu và dự án được chia sẻ)."""
    from ..db.session import get_session
    from ..db.models import ProjectFolderRecord
    from sqlalchemy import select
    import datetime as dt
    import uuid

    username = _get_current_username(authorization)
    with get_session() as db:
        stmt = select(ProjectFolderRecord).order_by(ProjectFolderRecord.created_at.asc())
        all_records = db.execute(stmt).scalars().all()

        user_records = []
        for r in all_records:
            if r.username == username or r.username == "guest":
                user_records.append(r)
            else:
                shared = r.shared_with or []
                if any(m.get("username") == username for m in shared):
                    user_records.append(r)

        # Nếu chưa có thư mục nào, nạp 4 thư mục mẫu
        if not user_records and username != "guest":
            new_records = []
            for item in DEFAULT_PROJECTS:
                rec = ProjectFolderRecord(
                    id=f"{item['id']}-{uuid.uuid4().hex[:4]}",
                    username=username,
                    title=item["title"],
                    desc=item["desc"],
                    icon=item["icon"],
                    color=item["color"],
                )
                db.add(rec)
                new_records.append(rec)
            db.commit()
            user_records = new_records

        now_iso = dt.datetime.now(dt.timezone.utc).isoformat()
        return [
            {
                "id": r.id,
                "title": r.title,
                "desc": r.desc,
                "icon": r.icon,
                "color": r.color,
                "createdAt": r.created_at.isoformat() if getattr(r, "created_at", None) else now_iso,
                "isShared": r.username != username,
                "isPublic": bool(r.is_public),
                "shareToken": r.share_token,
                "sharedWith": r.shared_with or [],
                "owner": r.username,
            }
            for r in (user_records or [ProjectFolderRecord(username="guest", **p) for p in DEFAULT_PROJECTS])
        ]


@router.post("/projects")
def create_user_project(req: CreateProjectRequest, authorization: str | None = Header(None)):
    """Tạo mới thư mục dự án trong PostgreSQL."""
    from ..db.session import get_session
    from ..db.models import ProjectFolderRecord
    import uuid

    username = _get_current_username(authorization)
    proj_id = req.id or f"proj-{uuid.uuid4().hex[:8]}"

    with get_session() as db:
        rec = ProjectFolderRecord(
            id=proj_id,
            username=username,
            title=req.title.strip(),
            desc=req.desc.strip(),
            icon=req.icon or "folder",
            color=req.color or "emerald",
        )
        db.add(rec)
        db.commit()
        db.refresh(rec)
        return {
            "id": rec.id,
            "title": rec.title,
            "desc": rec.desc,
            "icon": rec.icon,
            "color": rec.color,
            "createdAt": rec.created_at.isoformat(),
        }


@router.put("/projects/{project_id}")
def update_user_project(project_id: str, req: UpdateProjectRequest, authorization: str | None = Header(None)):
    """Cập nhật thông tin thư mục dự án."""
    from ..db.session import get_session
    from ..db.models import ProjectFolderRecord
    import datetime as dt

    username = _get_current_username(authorization)
    with get_session() as db:
        rec = db.get(ProjectFolderRecord, project_id)
        if not rec:
            raise HTTPException(status_code=404, detail="Dự án không tồn tại.")
        is_owner = (rec.username == username or rec.username == "guest")
        is_editor = any(m.get("username") == username and m.get("role") == "editor" for m in (rec.shared_with or []))
        if not is_owner and not is_editor:
            raise HTTPException(status_code=403, detail="Không có quyền sửa dự án này.")

        if req.title is not None:
            rec.title = req.title.strip()
        if req.desc is not None:
            rec.desc = req.desc.strip()
        if req.icon is not None:
            rec.icon = req.icon
        if req.color is not None:
            rec.color = req.color
        rec.updated_at = dt.datetime.now(dt.timezone.utc)
        db.commit()
        db.refresh(rec)
        return {
            "id": rec.id,
            "title": rec.title,
            "desc": rec.desc,
            "icon": rec.icon,
            "color": rec.color,
            "createdAt": rec.created_at.isoformat(),
        }


@router.delete("/projects/{project_id}")
def delete_user_project(project_id: str, authorization: str | None = Header(None)):
    """Xóa thư mục dự án và tự động gỡ liên kết khỏi các phiên chat."""
    from ..db.session import get_session
    from ..db.models import ProjectFolderRecord, ChatSessionRecord
    from sqlalchemy import select

    username = _get_current_username(authorization)
    with get_session() as db:
        rec = db.get(ProjectFolderRecord, project_id)
        if not rec:
            return {"status": "success", "message": "Dự án đã xóa hoặc không tồn tại."}
        if rec.username != username and rec.username != "guest":
            raise HTTPException(status_code=403, detail="Không có quyền xóa dự án này.")

        # Gỡ folder_id khỏi các sessions liên kết
        sessions = db.execute(
            select(ChatSessionRecord).where(
                ChatSessionRecord.folder_id == project_id,
            )
        ).scalars().all()
        for s in sessions:
            s.folder_id = None

        db.delete(rec)
        db.commit()
        return {"status": "success", "message": "Đã xóa thư mục dự án thành công."}


@router.get("/projects/{project_id}/share")
def get_project_share_config(project_id: str, authorization: str | None = Header(None)):
    """Lấy thông tin chia sẻ và danh sách thành viên của thư mục dự án."""
    from ..db.session import get_session
    from ..db.models import ProjectFolderRecord
    import secrets

    username = _get_current_username(authorization)
    with get_session() as db:
        record = db.get(ProjectFolderRecord, project_id)
        if not record:
            raise HTTPException(status_code=404, detail="Dự án không tồn tại.")
        is_owner = (record.username == username or record.username == "guest")
        is_member = any(m.get("username") == username for m in (record.shared_with or []))
        if not is_owner and not is_member and not record.is_public:
            raise HTTPException(status_code=403, detail="Bạn không có quyền xem thông tin chia sẻ của dự án này.")

        if not record.share_token:
            record.share_token = secrets.token_urlsafe(16)
            db.commit()
            db.refresh(record)

        return {
            "projectId": record.id,
            "title": record.title,
            "isPublic": bool(record.is_public),
            "shareToken": record.share_token,
            "sharedWith": record.shared_with or [],
            "owner": record.username,
            "isOwner": is_owner,
        }


@router.post("/projects/{project_id}/share")
def update_project_share_config(project_id: str, req: UpdateShareRequest, authorization: str | None = Header(None)):
    """Cập nhật quyền chia sẻ và thành viên của thư mục dự án."""
    from ..db.session import get_session
    from ..db.models import ProjectFolderRecord
    import datetime as dt
    import secrets

    username = _get_current_username(authorization)
    with get_session() as db:
        record = db.get(ProjectFolderRecord, project_id)
        if not record:
            raise HTTPException(status_code=404, detail="Dự án không tồn tại.")
        if record.username != username and record.username != "guest":
            raise HTTPException(status_code=403, detail="Chỉ chủ sở hữu dự án mới có quyền thay đổi chia sẻ.")

        if req.is_public is not None:
            record.is_public = req.is_public

        if req.shared_with is not None:
            now_str = dt.datetime.now(dt.timezone.utc).strftime("%d/%m/%Y %H:%M")
            members = []
            for m in req.shared_with:
                members.append({
                    "username": m.username.strip(),
                    "role": m.role if m.role in ("viewer", "editor") else "viewer",
                    "shared_at": m.shared_at or now_str,
                })
            record.shared_with = members

        if req.regenerate_token or not record.share_token:
            record.share_token = secrets.token_urlsafe(16)

        record.updated_at = dt.datetime.now(dt.timezone.utc)
        db.commit()
        db.refresh(record)

        return {
            "status": "success",
            "projectId": record.id,
            "isPublic": record.is_public,
            "shareToken": record.share_token,
            "sharedWith": record.shared_with or [],
            "owner": record.username,
        }


@router.get("/share/project/{share_token}")
def get_shared_project_by_token(share_token: str, authorization: str | None = Header(None)):
    """Xem danh mục tài liệu & phiên chat trong dự án được chia sẻ qua liên kết."""
    from ..db.session import get_session
    from ..db.models import ProjectFolderRecord, ChatSessionRecord
    from sqlalchemy import select

    username = _get_current_username(authorization)
    with get_session() as db:
        stmt = select(ProjectFolderRecord).where(ProjectFolderRecord.share_token == share_token)
        proj = db.execute(stmt).scalars().first()
        if not proj:
            raise HTTPException(status_code=404, detail="Liên kết dự án không tồn tại hoặc đã bị thu hồi.")

        is_owner = (proj.username == username or proj.username == "guest")
        member_match = next((m for m in (proj.shared_with or []) if m.get("username") == username), None)
        user_role = "owner" if is_owner else (member_match.get("role", "viewer") if member_match else ("viewer" if proj.is_public else None))

        if not proj.is_public and not is_owner and not member_match:
            raise HTTPException(status_code=403, detail="Dự án này ở chế độ riêng tư và bạn chưa được cấp quyền truy cập.")

        # Lấy các sessions thuộc dự án này
        s_stmt = select(ChatSessionRecord).where(ChatSessionRecord.folder_id == proj.id).order_by(ChatSessionRecord.updated_at.desc())
        sessions = db.execute(s_stmt).scalars().all()

        return {
            "project": {
                "id": proj.id,
                "title": proj.title,
                "desc": proj.desc,
                "icon": proj.icon,
                "color": proj.color,
                "createdAt": proj.created_at.isoformat(),
                "owner": proj.username,
                "isPublic": bool(proj.is_public),
                "shareToken": proj.share_token,
                "userRole": user_role or "viewer",
                "canEdit": user_role in ("owner", "editor"),
            },
            "sessions": [
                {
                    "sessionId": s.id,
                    "title": s.title,
                    "domain": s.domain,
                    "mode": s.mode,
                    "folderId": s.folder_id,
                    "turnsCount": len(s.turns or []),
                    "lastCreatedAt": (s.updated_at or s.created_at).isoformat(),
                }
                for s in sessions
            ],
        }


# --- 3. CUSTOM AGENTS (Chuyên gia tùy chỉnh / Custom GPTs) ---

class SaveAgentRequest(BaseModel):
    id: str
    name: str
    desc: str = ""
    author: str = "Bởi bạn"
    domain: str = "legal"
    category: str = "productivity"
    instructions: str = ""
    starters: list[str] = Field(default_factory=list)
    icon: str = "school"
    session_id: str | None = None
    knowledge_files: list[dict] = Field(default_factory=list)


DEFAULT_AGENTS = [
    {
        "id": "agent-academic-trans",
        "name": "Trợ lý Nghiên cứu & Dịch thuật",
        "desc": "Chuyên gia dịch thuật học thuật, tóm tắt tài liệu PDF và trích dẫn khoa học chuẩn APA/IEEE.",
        "author": "Hệ thống",
        "domain": "legal",
        "category": "productivity",
        "instructions": (
            "Bạn là Trợ lý Nghiên cứu & Dịch thuật chuyên nghiệp của hệ thống Videcomp-rag. Nhiệm vụ trọng tâm:\n"
            "1. Dịch thuật song ngữ Anh-Việt và Việt-Anh với tính chính xác học thuật cao nhất.\n"
            "2. Phân rã câu hỏi đa bước và đối chiếu chuẩn xác với các tài liệu đính kèm.\n"
            "3. Định dạng danh mục tham khảo theo chuẩn APA 7th."
        ),
        "starters": [
            "Dịch tóm tắt đoạn văn này sang tiếng Anh học thuật...",
            "Kiểm tra lỗi ngữ pháp học thuật và văn phong...",
            "Trích dẫn tài liệu theo chuẩn APA 7th...",
            "Tóm tắt các phát hiện cốt lõi từ văn bản...",
        ],
        "icon": "school",
        "session_id": "agent-session-academic-default",
        "knowledge_files": [],
    }
]


@router.get("/agents")
def list_user_agents(authorization: str | None = Header(None)):
    """Lấy danh sách chuyên gia tùy chỉnh của người dùng từ PostgreSQL."""
    from ..db.session import get_session
    from ..db.models import CustomAgentRecord
    from sqlalchemy import select, or_

    username = _get_current_username(authorization)
    with get_session() as db:
        stmt = (
            select(CustomAgentRecord)
            .where(or_(CustomAgentRecord.username == username, CustomAgentRecord.username == "system"))
            .order_by(CustomAgentRecord.updated_at.desc())
        )
        records = db.execute(stmt).scalars().all()

        if not records:
            # Tự động nạp mẫu ban đầu cho agent hệ thống
            for a in DEFAULT_AGENTS:
                existing = db.get(CustomAgentRecord, a["id"])
                if not existing:
                    rec = CustomAgentRecord(
                        id=a["id"],
                        username="system",  # Đặt là "system" để tất cả người dùng đều truy cập được
                        name=a["name"],
                        desc=a["desc"],
                        author=a["author"],
                        domain=a["domain"],
                        category=a["category"],
                        instructions=a["instructions"],
                        starters=a["starters"],
                        icon=a["icon"],
                        session_id=a["session_id"],
                        knowledge_files=a["knowledge_files"],
                    )
                    db.add(rec)
                elif existing.username != "system" and existing.author == "Hệ thống":
                    # Chuyển quyền sở hữu agent mặc định sang "system" dùng chung
                    existing.username = "system"
            try:
                db.commit()
            except Exception:
                db.rollback()

            stmt = select(CustomAgentRecord).where(
                or_(CustomAgentRecord.username == username, CustomAgentRecord.username == "system")
            ).order_by(CustomAgentRecord.updated_at.desc())
            records = db.execute(stmt).scalars().all()


        return [
            {
                "id": r.id,
                "name": r.name,
                "desc": r.desc,
                "author": r.author,
                "domain": r.domain,
                "category": r.category,
                "instructions": r.instructions,
                "starters": r.starters,
                "icon": r.icon,
                "sessionId": r.session_id,
                "knowledgeFiles": r.knowledge_files,
                "createdAt": r.created_at.isoformat(),
                "updatedAt": (r.updated_at or r.created_at).isoformat(),
            }
            for r in records
        ]


@router.post("/agents")
def save_user_agent(req: SaveAgentRequest, authorization: str | None = Header(None)):
    """Lưu hoặc cập nhật Agent tùy chỉnh từ GPT Builder vào PostgreSQL."""
    from ..db.session import get_session
    from ..db.models import CustomAgentRecord
    import datetime as dt

    username = _get_current_username(authorization)
    with get_session() as db:
        rec = db.get(CustomAgentRecord, req.id)
        if rec:
            if rec.username != username and rec.username != "guest" and rec.username != "system":
                raise HTTPException(status_code=403, detail="Không có quyền chỉnh sửa Agent này.")
            rec.name = req.name.strip()
            rec.desc = req.desc.strip()
            rec.author = req.author or "Bởi bạn"
            rec.domain = req.domain
            rec.category = req.category
            rec.instructions = req.instructions
            rec.starters = req.starters
            rec.icon = req.icon or "school"
            rec.session_id = req.session_id
            rec.knowledge_files = req.knowledge_files
            rec.updated_at = dt.datetime.now(dt.timezone.utc)
        else:
            rec = CustomAgentRecord(
                id=req.id,
                username=username,
                name=req.name.strip(),
                desc=req.desc.strip(),
                author=req.author or "Bởi bạn",
                domain=req.domain,
                category=req.category,
                instructions=req.instructions,
                starters=req.starters,
                icon=req.icon or "school",
                session_id=req.session_id,
                knowledge_files=req.knowledge_files,
            )
            db.add(rec)
        db.commit()
        db.refresh(rec)
        return {
            "status": "success",
            "id": rec.id,
            "name": rec.name,
            "updatedAt": rec.updated_at.isoformat(),
        }


@router.delete("/agents/{agent_id}")
def delete_user_agent(agent_id: str, authorization: str | None = Header(None)):
    """Xóa Agent tùy chỉnh khỏi PostgreSQL."""
    from ..db.session import get_session
    from ..db.models import CustomAgentRecord

    username = _get_current_username(authorization)
    with get_session() as db:
        rec = db.get(CustomAgentRecord, agent_id)
        if not rec:
            return {"status": "success", "message": "Agent không tồn tại."}
        if rec.username != username and rec.username != "guest":
            raise HTTPException(status_code=403, detail="Không có quyền xóa Agent này.")
        db.delete(rec)
        db.commit()
        return {"status": "success", "message": "Đã xóa Agent thành công."}




