"""module index_builder — Sparse (BM25) + Dense (FAISS/Qdrant) index (HuongDanThucHien Buoc 5).

Luu index_version trong config de moi experiment co the tai lap
(TaiLieuKyThuat Muc 11: Reproducibility).
"""
from __future__ import annotations

import json
import pickle
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from rank_bm25 import BM25Okapi

from ..core.embedding_provider import EmbeddingProvider, get_embedding_provider
from ..core.text_utils import tokenize
from ..schemas.documents import Chunk


def load_chunks(path: str | Path) -> list[Chunk]:
    chunks = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                chunks.append(Chunk.model_validate_json(line))
    return chunks


def save_chunks(chunks: list[Chunk], path: str | Path) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        for chunk in chunks:
            f.write(chunk.model_dump_json() + "\n")


# ---------------------------------------------------------------------------
# BM25 (sparse) index
# ---------------------------------------------------------------------------


@dataclass
class BM25Index:
    chunks: list[Chunk]
    bm25: BM25Okapi

    def search(self, query: str, k: int = 30) -> list[tuple[Chunk, float]]:
        tokens = tokenize(query)
        scores = self.bm25.get_scores(tokens)
        top_idx = np.argsort(scores)[::-1][:k]
        return [(self.chunks[i], float(scores[i])) for i in top_idx if scores[i] > 0]

    def save(self, out_dir: str | Path) -> None:
        out_dir = Path(out_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        save_chunks(self.chunks, out_dir / "chunks.jsonl")
        with open(out_dir / "bm25.pkl", "wb") as f:
            pickle.dump(self.bm25, f)

    @classmethod
    def load(cls, out_dir: str | Path) -> "BM25Index":
        out_dir = Path(out_dir)
        chunks = load_chunks(out_dir / "chunks.jsonl")
        with open(out_dir / "bm25.pkl", "rb") as f:
            bm25 = pickle.load(f)
        return cls(chunks=chunks, bm25=bm25)


def build_bm25_index(chunks: list[Chunk]) -> BM25Index:
    tokenized_corpus = [tokenize(c.text) for c in chunks]
    bm25 = BM25Okapi(tokenized_corpus)
    return BM25Index(chunks=chunks, bm25=bm25)


# ---------------------------------------------------------------------------
# Dense vector index — FAISS (local prototype) or Qdrant (server)
# ---------------------------------------------------------------------------


class FaissVectorIndex:
    def __init__(self, chunks: list[Chunk], vectors: np.ndarray):
        import faiss

        self.chunks = chunks
        dim = vectors.shape[1]
        self.index = faiss.IndexFlatIP(dim)
        self.index.add(vectors.astype(np.float32))

    def search(self, query_vector: np.ndarray, k: int = 30) -> list[tuple[Chunk, float]]:
        import faiss  # noqa: F401

        scores, idx = self.index.search(query_vector.reshape(1, -1).astype(np.float32), k)
        results = []
        for score, i in zip(scores[0], idx[0]):
            if i == -1:
                continue
            results.append((self.chunks[i], float(score)))
        return results

    def save(self, out_dir: str | Path) -> None:
        import faiss

        out_dir = Path(out_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        save_chunks(self.chunks, out_dir / "chunks.jsonl")
        faiss.write_index(self.index, str(out_dir / "index.faiss"))

    @classmethod
    def load(cls, out_dir: str | Path) -> "FaissVectorIndex":
        import faiss

        out_dir = Path(out_dir)
        chunks = load_chunks(out_dir / "chunks.jsonl")
        obj = cls.__new__(cls)
        obj.chunks = chunks
        obj.index = faiss.read_index(str(out_dir / "index.faiss"))
        return obj


class QdrantVectorIndex:
    def __init__(self, collection: str, url: str, dim: int):
        from qdrant_client import QdrantClient
        from qdrant_client.http import models as qmodels

        self.collection = collection
        self.client = QdrantClient(url=url)
        if not self.client.collection_exists(collection):
            self.client.create_collection(
                collection_name=collection,
                vectors_config=qmodels.VectorParams(size=dim, distance=qmodels.Distance.COSINE),
            )

    def upsert(self, chunks: list[Chunk], vectors: np.ndarray) -> None:
        from qdrant_client.http import models as qmodels

        points = [
            qmodels.PointStruct(
                id=i,
                vector=vectors[i].tolist(),
                payload={"chunk": chunk.model_dump()},
            )
            for i, chunk in enumerate(chunks)
        ]
        self.client.upsert(collection_name=self.collection, points=points)

    def search(self, query_vector: np.ndarray, k: int = 30) -> list[tuple[Chunk, float]]:
        hits = self.client.search(
            collection_name=self.collection, query_vector=query_vector.tolist(), limit=k
        )
        return [(Chunk.model_validate(h.payload["chunk"]), float(h.score)) for h in hits]


def build_vector_index(
    chunks: list[Chunk],
    embedder: EmbeddingProvider | None = None,
    backend: str = "faiss",
    collection: str = "default",
    qdrant_url: str = "http://localhost:6333",
):
    embedder = embedder or get_embedding_provider()
    vectors = embedder.embed([c.text for c in chunks])
    if backend == "qdrant":
        index = QdrantVectorIndex(collection=collection, url=qdrant_url, dim=embedder.dim)
        index.upsert(chunks, vectors)
        return index
    return FaissVectorIndex(chunks, vectors)


def write_index_metadata(out_dir: str | Path, *, index_version: str, embedding_model: str, backend: str) -> None:
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    with open(out_dir / "index_meta.json", "w", encoding="utf-8") as f:
        json.dump(
            {"index_version": index_version, "embedding_model": embedding_model, "backend": backend},
            f,
            ensure_ascii=False,
            indent=2,
        )
