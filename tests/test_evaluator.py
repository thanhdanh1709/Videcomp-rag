from backend.app.services.evaluator import (
    citation_precision_recall,
    exact_match,
    f1_score,
    hop_recall,
    mrr_at_k,
    ndcg_at_k,
    recall_at_k,
)


def test_recall_and_hit_at_k():
    retrieved = ["c1", "c2", "c3"]
    gold = ["c2", "c5"]
    assert recall_at_k(retrieved, gold, k=3) == 0.5


def test_mrr_at_k_first_hit_rank():
    assert mrr_at_k(["c1", "c2"], ["c2"], k=5) == 0.5
    assert mrr_at_k(["c2", "c1"], ["c2"], k=5) == 1.0


def test_ndcg_perfect_ranking_is_one():
    assert ndcg_at_k(["c1", "c2"], ["c1", "c2"], k=2) == 1.0


def test_hop_recall_counts_hops_with_any_gold_hit():
    hop_evidence = {"h1": ["c1", "c9"], "h2": ["c8"]}
    gold = [{"hop_id": "h1", "chunk_id": "c1"}, {"hop_id": "h2", "chunk_id": "c2"}]
    assert hop_recall(hop_evidence, gold) == 0.5


def test_hop_recall_ignores_hop_id_naming_mismatch():
    """Regression: benchmark generator khong ep buoc quy uoc dat ten hop_id
    (schemas/benchmark.py: SupportingEvidence.hop_id la str tu do), nen
    thuc te co item gold dung "hop1"/"hop2" hoac "sq1"/"sq2" trong khi
    query_decomposer luon sinh "h1"/"h2" tai thoi diem eval. So khop hop_id
    nguyen van se cho hop_recall=0 du he thong retrieve dung het bang chung -
    ham phai bo qua ten hop_id, chi kiem tra bang chung co duoc tim thay o
    dau do trong ket qua khong."""
    hop_evidence = {"h1": ["c1"], "h2": ["c2"]}
    gold = [{"hop_id": "hop1", "chunk_id": "c1"}, {"hop_id": "sq2", "chunk_id": "c2"}]
    assert hop_recall(hop_evidence, gold) == 1.0


def test_exact_match_and_f1():
    assert exact_match("ngày 01 tháng 04 năm 2026", "ngày 01 tháng 04 năm 2026") == 1.0
    assert f1_score("ngày 01 tháng 04", "ngày 01 tháng 04 năm 2026") > 0.5


def test_citation_precision_recall():
    precision, recall = citation_precision_recall(["c1", "c2"], ["c1"])
    assert precision == 0.5
    assert recall == 1.0
