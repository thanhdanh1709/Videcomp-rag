"""App settings, loaded from environment / .env (HuongDanThucHien Buoc 1.4)."""
from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    llm_provider: str = "mock"  # mock | anthropic | ollama | vllm | openai_compatible
    llm_base_url: str = "http://localhost:11434/v1"
    llm_api_key: str = "local-or-secret"
    llm_model: str = "mock-model"

    anthropic_api_key: str = ""

    # Cấu hình Mô hình Cục bộ Hoàn toàn On-Premise (Ollama)
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen2.5:14b"

    # Cấu hình Cụm máy chủ GPU nội bộ vLLM Private Cluster
    vllm_base_url: str = "http://localhost:8000/v1"
    vllm_model: str = "Qwen/Qwen2.5-14B-Instruct"
    vllm_api_key: str = ""

    embedding_model: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    reranker_model: str = "cross-encoder/mmarco-mMiniLMv2-L12-H384-v1"

    vector_backend: str = "faiss"  # faiss | qdrant
    qdrant_url: str = "http://localhost:6333"
    postgres_dsn: str = "postgresql://videcomp:videcomp@localhost:5432/videcomp"

    # SQLAlchemy connection string thuc su duoc dung boi backend/app/db.
    # Mac dinh SQLite local (khong can Docker) de dev nhanh; trien khai that
    # tro sang postgres_dsn (vi du: DB_DSN=postgresql+psycopg://... trong .env)
    # - cung mot ORM code, chi doi connection string (TaiLieuKyThuat Muc 11:
    # Reproducibility/Maintainability).
    db_dsn: str = "sqlite:///./data/videcomp.db"

    max_hops: int = 4
    sparse_k: int = 30
    dense_k: int = 30
    rrf_k: int = 60
    rerank_pool: int = 20
    top_k_context: int = 5

    multi_hop_threshold: float = 0.5  # tau: nguong xac suat multi-hop (Muc 4.2)
    max_corrective_rounds: int = 1

    config_version: str = "exp-dev-0"

    jwt_secret: str = "videcomp-rag-secret-jwt-key-2026-super-safe"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # 7 days

    # Semantic Caching (Bộ đệm Ngữ nghĩa)
    semantic_cache_enabled: bool = True
    semantic_cache_threshold: float = 0.93
    semantic_cache_db: str = "./data/videcomp_semantic_cache.db"


settings = Settings()

