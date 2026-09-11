"""Reranker adapter (cross-encoder). TaiLieuKyThuat Muc 5.3 hybrid_retriever."""
from __future__ import annotations

from abc import ABC, abstractmethod
from functools import lru_cache

from .config import settings


class RerankerProvider(ABC):
    @abstractmethod
    def rank(self, query: str, candidates: list[str]) -> list[float]:
        """Tra ve rerank_score cho tung candidate, cung thu tu voi candidates."""
        raise NotImplementedError


class CrossEncoderReranker(RerankerProvider):
    def __init__(self, model_name: str | None = None):
        from sentence_transformers import CrossEncoder

        self.model_name = model_name or settings.reranker_model
        self._model = CrossEncoder(self.model_name)

    def rank(self, query: str, candidates: list[str]) -> list[float]:
        pairs = [(query, c) for c in candidates]
        return list(self._model.predict(pairs))


class NoOpReranker(RerankerProvider):
    """Fallback: giu nguyen thu tu RRF (score giam dan) khi chua tai duoc
    cross-encoder model (vd offline)."""

    def rank(self, query: str, candidates: list[str]) -> list[float]:
        n = len(candidates)
        return [float(n - i) for i in range(n)]


@lru_cache(maxsize=1)
def get_reranker_provider() -> RerankerProvider:
    try:
        return CrossEncoderReranker()
    except Exception:
        return NoOpReranker()
