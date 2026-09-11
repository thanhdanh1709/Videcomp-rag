"""Embedding adapter interface (TaiLieuKyThuat Muc 3.(5), 2 - stack Embedding).

Hỗ trợ các mô hình Embedding tối tân chuyên dụng cho Tiếng Việt & Đa ngữ:
- BAAI/bge-m3: Ngữ cảnh dài 8192 tokens, 1024-dim, tối ưu từ vựng Hán - Việt.
- bkai-foundation-models/vietnamese-bi-encoder: 768-dim, huấn luyện chuyên sâu cho tiếng Việt bởi BKAI.
- sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2: 384-dim, nhanh và nhẹ.
"""
from __future__ import annotations

import logging
import threading
from abc import ABC, abstractmethod

import numpy as np

from .config import AVAILABLE_EMBEDDING_MODELS, settings

logger = logging.getLogger(__name__)


def resolve_embedding_model_name(name_or_alias: str) -> str:
    """Phân giải alias viết tắt sang tên mô hình HuggingFace đầy đủ."""
    alias = name_or_alias.strip().lower()
    if alias in AVAILABLE_EMBEDDING_MODELS:
        return str(AVAILABLE_EMBEDDING_MODELS[alias]["name"])
    for m in AVAILABLE_EMBEDDING_MODELS.values():
        if alias == str(m["name"]).lower():
            return str(m["name"])
    return name_or_alias.strip()


class EmbeddingProvider(ABC):
    @abstractmethod
    def embed(self, texts: list[str]) -> np.ndarray:
        raise NotImplementedError

    @property
    @abstractmethod
    def dim(self) -> int:
        raise NotImplementedError

    @property
    def model_name(self) -> str:
        return "unknown"


class SentenceTransformerEmbedder(EmbeddingProvider):
    def __init__(self, model_name: str | None = None):
        from sentence_transformers import SentenceTransformer

        raw_name = model_name or settings.embedding_model
        self._resolved_model_name = resolve_embedding_model_name(raw_name)
        logger.info("Đang khởi tạo mô hình embedding: %s", self._resolved_model_name)
        self._model = SentenceTransformer(self._resolved_model_name)

    def embed(self, texts: list[str]) -> np.ndarray:
        return np.asarray(
            self._model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
        )

    @property
    def dim(self) -> int:
        if hasattr(self._model, "get_embedding_dimension"):
            return self._model.get_embedding_dimension()
        return self._model.get_sentence_embedding_dimension()


    @property
    def model_name(self) -> str:
        return self._resolved_model_name


class HashingEmbedder(EmbeddingProvider):
    """Offline fallback embedder (không tải model), dùng cho unit test / môi
    trường chưa có internet. Đảm bảo pipeline chạy được end-to-end mà không crash."""

    def __init__(self, dim: int = 256):
        self._dim = dim

    def embed(self, texts: list[str]) -> np.ndarray:
        vectors = np.zeros((len(texts), self._dim), dtype=np.float32)
        for i, text in enumerate(texts):
            for tok in text.lower().split():
                h = hash(tok) % self._dim
                vectors[i, h] += 1.0
            norm = np.linalg.norm(vectors[i])
            if norm > 0:
                vectors[i] /= norm
        return vectors

    @property
    def dim(self) -> int:
        return self._dim

    @property
    def model_name(self) -> str:
        return "hashing-embedder"


_global_embedder: EmbeddingProvider | None = None
_embedder_lock = threading.Lock()


def get_embedding_provider() -> EmbeddingProvider:
    """Lấy thể hiện EmbeddingProvider hiện hành."""
    global _global_embedder
    with _embedder_lock:
        if _global_embedder is None:
            try:
                _global_embedder = SentenceTransformerEmbedder()
            except Exception as exc:
                logger.warning(
                    "Không thể nạp SentenceTransformerEmbedder (%s), chuyển sang HashingEmbedder.",
                    exc,
                )
                _global_embedder = HashingEmbedder()
        return _global_embedder


def reload_embedding_provider(model_name: str | None = None) -> EmbeddingProvider:
    """Tải lại hoặc chuyển đổi mô hình Embedding ngay trong thời gian chạy (runtime)."""
    global _global_embedder
    with _embedder_lock:
        target_name = model_name or settings.embedding_model
        resolved = resolve_embedding_model_name(target_name)
        try:
            new_embedder = SentenceTransformerEmbedder(resolved)
            settings.embedding_model = resolved
            _global_embedder = new_embedder
            logger.info("Chuyển đổi thành công sang mô hình embedding: %s (dim=%d)", resolved, new_embedder.dim)
            return _global_embedder
        except Exception as exc:
            logger.error("Thất bại khi chuyển đổi sang mô hình embedding %s: %s", resolved, exc)
            raise
