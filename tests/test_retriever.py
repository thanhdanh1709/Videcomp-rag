"""Test hybrid_retriever bang HashingEmbedder/NoOpReranker (offline, khong tai
model that) de kiem tra co che RRF + filter, tach biet voi chat luong semantic
that su cua embedding model (duoc benchmark rieng qua scripts/evaluate_retrieval.py)."""
from backend.app.core.embedding_provider import HashingEmbedder
from backend.app.core.reranker_provider import NoOpReranker
from backend.app.schemas.documents import Chunk, ChunkMetadata
from backend.app.services.index_builder import build_bm25_index, build_vector_index
from backend.app.services.retriever import HybridRetriever, RetrievalFilters


def make_chunk(chunk_id: str, text: str, domain: str = "legal") -> Chunk:
    return Chunk(
        chunk_id=chunk_id,
        doc_id="D1",
        parent_path=["Điều 1"],
        text=text,
        token_count=len(text.split()),
        metadata=ChunkMetadata(domain=domain),
    )


def build_test_retriever(chunks):
    embedder = HashingEmbedder(dim=64)
    bm25 = build_bm25_index(chunks)
    vector = build_vector_index(chunks, embedder=embedder, backend="faiss")
    return HybridRetriever(bm25_index=bm25, vector_index=vector, embedder=embedder, reranker=NoOpReranker())


def test_hybrid_search_returns_relevant_chunk():
    chunks = [
        make_chunk("c1", "doanh nghiệp nhỏ và vừa được hỗ trợ chuyển đổi số"),
        make_chunk("c2", "quy định về thuế thu nhập doanh nghiệp"),
        make_chunk("c3", "hiệu lực thi hành từ ngày 01 tháng 04 năm 2026"),
    ]
    retriever = build_test_retriever(chunks)
    results = retriever.search("doanh nghiệp nhỏ và vừa chuyển đổi số", top_k=2)
    assert len(results) <= 2
    assert any(r.chunk_id == "c1" for r in results)


def test_domain_filter_excludes_other_domain():
    chunks = [
        make_chunk("c1", "văn bản pháp luật về doanh nghiệp", domain="legal"),
        make_chunk("c2", "hướng dẫn y tế công khai", domain="medical"),
    ]
    retriever = build_test_retriever(chunks)
    results = retriever.search("hướng dẫn", filters=RetrievalFilters(domain="legal"), top_k=5)
    assert all(r.chunk_id != "c2" for r in results)
