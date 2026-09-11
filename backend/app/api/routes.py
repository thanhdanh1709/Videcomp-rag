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

from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile
from pydantic import BaseModel

from ..core.config import settings
from ..core.llm_provider import get_llm_provider
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
from ..services import evaluator, file_parser, ingestion, query_analyzer, query_decomposer, web_search
from ..services.chunker import build_chunks
from ..services.index_builder import BM25Index, FaissVectorIndex, build_bm25_index, build_vector_index
from ..services.pipeline import run_qa
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
def evaluation_run(dataset_path: str, mode: str, domain: str = "legal"):
    if not Path(dataset_path).exists():
        raise HTTPException(status_code=404, detail="dataset_path khong ton tai")
    retriever = state.retrievers.get(domain)
    if retriever is None:
        raise HTTPException(status_code=400, detail="chua build index cho domain nay")

    items = []
    with open(dataset_path, encoding="utf-8") as f:
        for line in f:
            if line.strip():
                items.append(BenchmarkItem.model_validate_json(line))

    retrieved_by_item = {}
    for item in items:
        result = run_qa(item.question, item.domain, mode=mode, retriever=retriever)
        retrieved_by_item[item.id] = [c.chunk_id for c in result.citations]

    metrics = evaluator.aggregate_retrieval_metrics(items, retrieved_by_item)
    experiment_id = f"{mode}-{uuid.uuid4().hex[:8]}"
    repository.save_experiment(
        experiment_id=experiment_id,
        mode=mode,
        dataset_path=dataset_path,
        n_items=len(items),
        metrics=metrics,
        config_version=settings.config_version,
    )
    return {"experiment_id": experiment_id, "mode": mode, "metrics": metrics, "n_items": len(items)}


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
    }


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


class TestApiKeyRequest(BaseModel):
    provider: str
    api_key: str


@router.get("/admin/config")
def admin_get_config():
    key = settings.anthropic_api_key or ""
    masked_key = (key[:8] + "..." + key[-4:]) if len(key) > 12 else ("****" if key else "")
    return {
        "llm_provider": settings.llm_provider,
        "anthropic_api_key_masked": masked_key,
        "has_anthropic_key": bool(settings.anthropic_api_key),
        "llm_base_url": settings.llm_base_url,
        "llm_model": settings.llm_model,
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

    key = settings.anthropic_api_key or ""
    masked_key = (key[:8] + "..." + key[-4:]) if len(key) > 12 else ("****" if key else "")
    return {
        "status": "success",
        "message": "Đã cập nhật cấu hình API Key và mô hình thành công",
        "llm_provider": settings.llm_provider,
        "anthropic_api_key_masked": masked_key,
        "has_anthropic_key": bool(settings.anthropic_api_key),
    }


@router.post("/admin/test-api-key")
def admin_test_api_key(req: TestApiKeyRequest):
    key_to_test = req.api_key.strip()
    if not key_to_test or key_to_test in ("test", "existing", "existing-key"):
        key_to_test = settings.anthropic_api_key or ""
    if not key_to_test:
        raise HTTPException(status_code=400, detail="Vui lòng nhập API Key để kiểm tra")
    if req.provider == "anthropic":
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
    return {"status": "ok", "message": "Định dạng API Key hợp lệ"}


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



