"""Reranker adapter (cross-encoder). TaiLieuKyThuat Muc 5.3 hybrid_retriever.

Hỗ trợ các mô hình Reranker tối tân:
- BAAI/bge-reranker-v2-m3: Tối ưu tái xếp hạng chéo cho tiếng Việt và đa ngôn ngữ.
- cross-encoder/mmarco-mMiniLMv2-L12-H384-v1: Reranker đa ngữ gọn nhẹ.
"""
from __future__ import annotations

import logging
import threading
from abc import ABC, abstractmethod

from .config import AVAILABLE_RERANKER_MODELS, settings

logger = logging.getLogger(__name__)


def resolve_reranker_model_name(name_or_alias: str) -> str:
    """Phân giải alias viết tắt sang tên mô hình Reranker đầy đủ."""
    alias = name_or_alias.strip().lower()
    if alias in AVAILABLE_RERANKER_MODELS:
        return str(AVAILABLE_RERANKER_MODELS[alias]["name"])
    for m in AVAILABLE_RERANKER_MODELS.values():
        if alias == str(m["name"]).lower():
            return str(m["name"])
    return name_or_alias.strip()


class RerankerProvider(ABC):
    @abstractmethod
    def rank(self, query: str, candidates: list[str]) -> list[float]:
        """Trả về rerank_score cho từng candidate, cùng thứ tự với candidates."""
        raise NotImplementedError

    @property
    def model_name(self) -> str:
        return "unknown"


class CrossEncoderReranker(RerankerProvider):
    def __init__(self, model_name: str | None = None):
        from sentence_transformers import CrossEncoder

        raw_name = model_name or settings.reranker_model
        self._resolved_model_name = resolve_reranker_model_name(raw_name)
        logger.info("Đang nạp mô hình Reranker: %s", self._resolved_model_name)
        self._model = CrossEncoder(self._resolved_model_name)

    def rank(self, query: str, candidates: list[str]) -> list[float]:
        if not candidates:
            return []
        pairs = [(query, c) for c in candidates]
        scores = self._model.predict(pairs)
        return [float(s) for s in scores]

    @property
    def model_name(self) -> str:
        return self._resolved_model_name


class NoOpReranker(RerankerProvider):
    """Fallback: giữ nguyên thứ tự RRF khi chưa tải được cross-encoder model (offline)."""

    def rank(self, query: str, candidates: list[str]) -> list[float]:
        n = len(candidates)
        return [float(n - i) for i in range(n)]

    @property
    def model_name(self) -> str:
        return "noop-reranker"


_global_reranker: RerankerProvider | None = None
_reranker_lock = threading.Lock()


def get_reranker_provider() -> RerankerProvider:
    """Lấy thể hiện RerankerProvider hiện hành."""
    global _global_reranker
    with _reranker_lock:
        if _global_reranker is None:
            try:
                _global_reranker = CrossEncoderReranker()
            except Exception as exc:
                logger.warning("Không thể nạp CrossEncoderReranker (%s), fallback sang NoOpReranker.", exc)
                _global_reranker = NoOpReranker()
        return _global_reranker


def reload_reranker_provider(model_name: str | None = None) -> RerankerProvider:
    """Tải lại hoặc chuyển đổi mô hình Reranker ngay trong runtime."""
    global _global_reranker
    with _reranker_lock:
        target_name = model_name or settings.reranker_model
        resolved = resolve_reranker_model_name(target_name)
        try:
            new_reranker = CrossEncoderReranker(resolved)
            settings.reranker_model = resolved
            _global_reranker = new_reranker
            logger.info("Chuyển đổi thành công sang mô hình reranker: %s", resolved)
            return _global_reranker
        except Exception as exc:
            logger.error("Thất bại khi chuyển đổi sang mô hình reranker %s: %s", resolved, exc)
            raise
