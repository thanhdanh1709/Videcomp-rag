"""Embedding adapter interface (TaiLieuKyThuat Muc 3.(5), 2 - stack Embedding).

Cho phep thay embedding model qua config (settings.embedding_model) ma khong
sua pipeline retrieval (sparse/dense/RRF).
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from functools import lru_cache

import numpy as np

from .config import settings


class EmbeddingProvider(ABC):
    @abstractmethod
    def embed(self, texts: list[str]) -> np.ndarray:
        raise NotImplementedError

    @property
    @abstractmethod
    def dim(self) -> int:
        raise NotImplementedError


class SentenceTransformerEmbedder(EmbeddingProvider):
    def __init__(self, model_name: str | None = None):
        from sentence_transformers import SentenceTransformer

        self.model_name = model_name or settings.embedding_model
        self._model = SentenceTransformer(self.model_name)

    def embed(self, texts: list[str]) -> np.ndarray:
        return np.asarray(
            self._model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
        )

    @property
    def dim(self) -> int:
        return self._model.get_sentence_embedding_dimension()


class HashingEmbedder(EmbeddingProvider):
    """Offline fallback embedder (khong tai model), dung cho unit test / moi
    truong chua co internet. KHONG dung de bao cao ket qua thuc nghiem chinh
    thuc — chi de dam bao pipeline chay duoc end-to-end."""

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


@lru_cache(maxsize=1)
def get_embedding_provider() -> EmbeddingProvider:
    try:
        return SentenceTransformerEmbedder()
    except Exception:
        return HashingEmbedder()
