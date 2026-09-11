"""Integration test: end-to-end cho ca 6 mode ablation (B0/B1/B2/Q1/Q2/Q3),
dung HashingEmbedder + MockLLMProvider de chay offline, nhanh, khong phu
thuoc mang (TaiLieuKyThuat Muc 9 bang ablation)."""
import pytest

from backend.app.core.embedding_provider import HashingEmbedder
from backend.app.core.llm_provider import MockLLMProvider
from backend.app.core.reranker_provider import NoOpReranker
from backend.app.schemas.documents import Chunk, ChunkMetadata
from backend.app.services.index_builder import build_bm25_index, build_vector_index
from backend.app.services.pipeline import run_qa
from backend.app.services.retriever import HybridRetriever

CHUNKS = [
    Chunk(
        chunk_id="c1",
        doc_id="D1",
        parent_path=["Điều 5", "Khoản 1"],
        text="Đối tượng áp dụng là doanh nghiệp nhỏ và vừa có tối đa 200 lao động.",
        token_count=12,
        metadata=ChunkMetadata(domain="legal"),
    ),
    Chunk(
        chunk_id="c2",
        doc_id="D2",
        parent_path=["Điều 3", "Khoản 1"],
        text="Doanh nghiệp nhà nước không thuộc đối tượng được miễn trừ nghĩa vụ.",
        token_count=11,
        metadata=ChunkMetadata(domain="legal"),
    ),
    Chunk(
        chunk_id="c3",
        doc_id="D3",
        parent_path=["Điều 1", "Khoản 1"],
        text="Quy định này có hiệu lực thi hành từ ngày 01 tháng 04 năm 2026.",
        token_count=12,
        metadata=ChunkMetadata(domain="legal"),
    ),
]


@pytest.fixture
def retriever():
    embedder = HashingEmbedder(dim=64)
    bm25 = build_bm25_index(CHUNKS)
    vector = build_vector_index(CHUNKS, embedder=embedder, backend="faiss")
    return HybridRetriever(bm25_index=bm25, vector_index=vector, embedder=embedder, reranker=NoOpReranker())


@pytest.mark.parametrize(
    "mode",
    ["dense_rag", "hybrid_rag", "hybrid_rerank", "decomp_independent", "decomp_dependency", "videcomp_full"],
)
def test_run_qa_all_modes_produce_cited_answer(retriever, mode):
    result = run_qa(
        "Doanh nghiệp nhỏ và vừa có bị loại trừ không và quy định có hiệu lực từ khi nào?",
        domain="legal",
        mode=mode,
        retriever=retriever,
        llm=MockLLMProvider(),
    )
    assert result.final_answer.strip()
    assert result.latency_ms >= 0

    all_evidence_ids = {chunk_id for hop in result.hop_trace for chunk_id in hop.evidence_ids}
    for citation in result.citations:
        assert citation.chunk_id in all_evidence_ids, "citation integrity: khong duoc tro toi chunk ngoai evidence bundle"
