"""module hybrid_retriever — BM25 + Dense + RRF + Rerank (TaiLieuKyThuat Muc 5.3) [BAT BUOC].

Cung query/config phai cho ket qua xac dinh trong cung index version; ho tro
metadata filter (domain/version/effective_date).
"""
from __future__ import annotations

from dataclasses import dataclass, field

from ..core.config import settings
from ..core.embedding_provider import EmbeddingProvider, get_embedding_provider
from ..core.reranker_provider import RerankerProvider, get_reranker_provider
from ..schemas.documents import Chunk
from ..schemas.evidence import EvidenceCandidate
from .index_builder import BM25Index, FaissVectorIndex, QdrantVectorIndex


@dataclass
class RetrievalFilters:
    domain: str | None = None
    version: str | None = None
    effective_date: str | None = None


def _matches_filters(chunk: Chunk, filters: RetrievalFilters | None) -> bool:
    if filters is None:
        return True
    if filters.domain and chunk.metadata.domain != filters.domain:
        return False
    if filters.version and chunk.metadata.version and chunk.metadata.version != filters.version:
        return False
    if filters.effective_date and chunk.metadata.effective_date and chunk.metadata.effective_date != filters.effective_date:
        return False
    return True


def reciprocal_rank_fusion(
    sparse: list[tuple[Chunk, float]], dense: list[tuple[Chunk, float]], k: int = 60
) -> dict[str, dict]:
    """Tra ve map chunk_id -> {chunk, rrf_score, sparse_rank, dense_rank}."""
    fused: dict[str, dict] = {}
    for rank, (chunk, _score) in enumerate(sparse, start=1):
        entry = fused.setdefault(chunk.chunk_id, {"chunk": chunk, "rrf_score": 0.0, "sparse_rank": None, "dense_rank": None})
        entry["sparse_rank"] = rank
        entry["rrf_score"] += 1.0 / (k + rank)
    for rank, (chunk, _score) in enumerate(dense, start=1):
        entry = fused.setdefault(chunk.chunk_id, {"chunk": chunk, "rrf_score": 0.0, "sparse_rank": None, "dense_rank": None})
        entry["dense_rank"] = rank
        entry["rrf_score"] += 1.0 / (k + rank)
    return fused


@dataclass
class HybridRetriever:
    bm25_index: BM25Index
    vector_index: FaissVectorIndex | QdrantVectorIndex
    embedder: EmbeddingProvider = field(default_factory=get_embedding_provider)
    reranker: RerankerProvider = field(default_factory=get_reranker_provider)
    use_reranker: bool = True

    def search(
        self,
        query: str,
        filters: RetrievalFilters | None = None,
        top_k: int | None = None,
        dense_only: bool = False,
        use_reranker: bool | None = None,
    ) -> list[EvidenceCandidate]:
        """dense_only=True => B0 (dense-only vanilla RAG, khong BM25/RRF).
        use_reranker cho phep bat/tat reranker theo tung mode ablation
        (B1 khong rerank, B2 co rerank) ma khong can tao lai retriever."""
        k_candidate = max(settings.sparse_k, settings.dense_k)
        query_vector = self.embedder.embed([query])[0]
        dense = self.vector_index.search(query_vector, k=k_candidate)
        dense = [(c, s) for c, s in dense if _matches_filters(c, filters)]

        if dense_only:
            k = top_k or settings.top_k_context
            return [
                EvidenceCandidate(
                    chunk_id=chunk.chunk_id,
                    doc_id=chunk.doc_id,
                    text=chunk.text,
                    source_url=chunk.source_url,
                    parent_path=chunk.parent_path,
                    version=chunk.metadata.version,
                    effective_date=chunk.metadata.effective_date,
                    dense_rank=rank,
                )
                for rank, (chunk, _score) in enumerate(dense[:k], start=1)
            ]

        sparse = self.bm25_index.search(query, k=k_candidate)
        sparse = [(c, s) for c, s in sparse if _matches_filters(c, filters)]

        fused = reciprocal_rank_fusion(sparse, dense, k=settings.rrf_k)
        fused_sorted = sorted(fused.values(), key=lambda e: e["rrf_score"], reverse=True)
        pool = fused_sorted[: settings.rerank_pool]

        should_rerank = self.use_reranker if use_reranker is None else use_reranker
        rerank_scores = None
        if should_rerank and pool:
            rerank_scores = self.reranker.rank(query, [entry["chunk"].text for entry in pool])

        candidates = []
        for i, entry in enumerate(pool):
            chunk: Chunk = entry["chunk"]
            candidates.append(
                EvidenceCandidate(
                    chunk_id=chunk.chunk_id,
                    doc_id=chunk.doc_id,
                    text=chunk.text,
                    source_url=chunk.source_url,
                    parent_path=chunk.parent_path,
                    version=chunk.metadata.version,
                    effective_date=chunk.metadata.effective_date,
                    sparse_rank=entry["sparse_rank"],
                    dense_rank=entry["dense_rank"],
                    rrf_score=entry["rrf_score"],
                    rerank_score=float(rerank_scores[i]) if rerank_scores is not None else None,
                )
            )

        if rerank_scores is not None:
            candidates.sort(key=lambda c: c.rerank_score, reverse=True)

        k = top_k or settings.top_k_context
        return candidates[:k]
