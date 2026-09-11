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

    # Nâng cấp Xử lý Tài liệu Đa phương thái (OCR & Table Extraction)
    enable_pdf_table_extraction: bool = True
    enable_vision_ocr: bool = True
    vision_model: str = "claude-3-5-sonnet-20241022"
    vision_max_pages: int = 15  # Giới hạn số trang ảnh scan để tối ưu chi phí API


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

# Danh mục các mô hình Embedding chuyên dụng cho Tiếng Việt & Đa ngôn ngữ
AVAILABLE_EMBEDDING_MODELS: dict[str, dict[str, str | int]] = {
    "bge-m3": {
        "id": "bge-m3",
        "name": "BAAI/bge-m3",
        "label": "BGE-M3 (8192 tokens, 1024-dim, Tối tân)",
        "dim": 1024,
        "max_length": 8192,
        "badge": "Khuyên dùng Pháp luật / Bệnh án dài",
        "description": "Hỗ trợ ngữ cảnh siêu dài 8192 tokens, biểu diễn đa ngôn ngữ vượt trội, tối ưu hóa mạnh mẽ cho từ vựng cổ và thuật ngữ Hán - Việt.",
    },
    "vietnamese-bi-encoder": {
        "id": "vietnamese-bi-encoder",
        "name": "bkai-foundation-models/vietnamese-bi-encoder",
        "label": "BKAI Bi-Encoder (768-dim, Chuyên sâu Tiếng Việt)",
        "dim": 768,
        "max_length": 512,
        "badge": "BKAI Hà Nội",
        "description": "Mô hình được đào tạo chuyên sâu trên ngữ liệu tiếng Việt bởi Viện CNTT Bách Khoa Hà Nội, độ chính xác cao trên văn phong Việt Nam.",
    },
    "multilingual-minilm": {
        "id": "multilingual-minilm",
        "name": "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
        "label": "Multilingual MiniLM (384-dim, Siêu nhẹ & Nhanh)",
        "dim": 384,
        "max_length": 512,
        "badge": "Mặc định / Nhẹ",
        "description": "Mô hình cơ sở đa ngôn ngữ 384 chiều, tốc độ mã hóa cực nhanh, phù hợp cho môi trường kiểm thử và máy chủ ít RAM.",
    },
}

# Danh mục các mô hình Reranker (Cross-Encoder) chuyên dụng
AVAILABLE_RERANKER_MODELS: dict[str, dict[str, str]] = {
    "bge-reranker-v2-m3": {
        "id": "bge-reranker-v2-m3",
        "name": "BAAI/bge-reranker-v2-m3",
        "label": "BGE Reranker v2 M3 (Cross-Encoder Tiếng Việt & Đa ngữ Tối tân)",
        "badge": "Khuyên dùng Chính xác cao",
        "description": "Tái xếp hạng chéo giữa truy vấn và ngữ cảnh, phân biệt tinh tế các sắc thái phủ định, điều kiện loại trừ trong luật.",
    },
    "mmarco-minilm": {
        "id": "mmarco-minilm",
        "name": "cross-encoder/mmarco-mMiniLMv2-L12-H384-v1",
        "label": "mMARCO MiniLM (384-dim, Tốc độ cao)",
        "badge": "Mặc định / Tối ưu độ trễ",
        "description": "Mô hình cross-encoder gọn nhẹ, thời gian phản hồi nhanh cho các ứng dụng thời gian thực.",
    },
}


