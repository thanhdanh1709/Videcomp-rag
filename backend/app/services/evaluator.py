"""module evaluator — Danh gia end-to-end (TaiLieuKyThuat Muc 5.10, Muc 9).

Nhom metric: Retrieval (Recall@k/Hit@k/MRR@k/nDCG@k/evidence coverage),
Hop-level (Hop Recall), Decomposition (valid-plan rate), Answer (EM/F1),
Grounding (citation precision/recall), Efficiency (latency).
ROUGE-L/BERTScore duoc de xuat la "bo tro" trong dac ta nhung khong bat buoc
cho pipeline lom vi can them dependency nang; co the bo sung sau qua adapter
rieng neu can.
"""
from __future__ import annotations

import math
from collections import Counter

from ..core.text_utils import simple_tokenize
from ..schemas.benchmark import BenchmarkItem
from ..schemas.query_plan import QueryPlan
from .query_decomposer import validate_plan


# ---------------------------------------------------------------------------
# Retrieval metrics
# ---------------------------------------------------------------------------


def recall_at_k(retrieved: list[str], gold: list[str], k: int) -> float:
    if not gold:
        return 1.0
    top = set(retrieved[:k])
    hit = sum(1 for g in gold if g in top)
    return hit / len(gold)


def hit_at_k(retrieved: list[str], gold: list[str], k: int) -> float:
    if not gold:
        return 1.0
    top = set(retrieved[:k])
    return 1.0 if any(g in top for g in gold) else 0.0


def mrr_at_k(retrieved: list[str], gold: list[str], k: int) -> float:
    gold_set = set(gold)
    for rank, chunk_id in enumerate(retrieved[:k], start=1):
        if chunk_id in gold_set:
            return 1.0 / rank
    return 0.0


def ndcg_at_k(retrieved: list[str], gold: list[str], k: int) -> float:
    gold_set = set(gold)
    dcg = 0.0
    for rank, chunk_id in enumerate(retrieved[:k], start=1):
        if chunk_id in gold_set:
            dcg += 1.0 / math.log2(rank + 1)
    ideal_hits = min(len(gold_set), k)
    idcg = sum(1.0 / math.log2(rank + 1) for rank in range(1, ideal_hits + 1))
    return dcg / idcg if idcg > 0 else 0.0


# ---------------------------------------------------------------------------
# Hop-level / decomposition metrics
# ---------------------------------------------------------------------------


def hop_recall(hop_evidence_ids: dict[str, list[str]], gold_supporting_evidence: list[dict]) -> float:
    """Hop Recall = so hop (nhom theo hop_id trong GOLD) co it nhat mot gold
    evidence duoc he thong retrieve o BAT KY hop nao / tong so hop gold.

    KHONG doi khop hop_id gold voi hop_id du doan theo dung ten chuoi: gold
    hop_id (vd "h1", "hop1", "sq1"...) va hop_id du doan (sinh boi
    query_decomposer tai thoi diem eval) la hai khong gian dat ten DOC LAP -
    benchmark generator khong ep buoc mot quy uoc dat ten duy nhat (xem
    schemas/benchmark.py: SupportingEvidence.hop_id la str tu do), va hai lan
    decomposition cung khong bat buoc chia cau hoi thanh cung so hop. So
    khop nguyen van hop_id se cho hop_recall=0 cho MOI item ma benchmark
    dung quy uoc khac "hN" (thuc te: 8/20 cau trong
    candidates_real_legal_v7v8_draft.jsonl dung "hopN"/"sqN") bat ke he
    thong co retrieve dung bang chung hay khong - danh gia sai he thong chu
    khong phai loi retrieval. Thay vao do, chi kiem tra bang chung cua tung
    hop gold co duoc tim thay o dau do trong toan bo ket qua hay khong."""
    gold_by_hop: dict[str, list[str]] = {}
    for ev in gold_supporting_evidence:
        gold_by_hop.setdefault(ev["hop_id"], []).append(ev["chunk_id"])
    if not gold_by_hop:
        return 1.0
    all_retrieved = {chunk_id for ids in hop_evidence_ids.values() for chunk_id in ids}
    hit_hops = sum(
        1 for gold_chunks in gold_by_hop.values() if any(c in all_retrieved for c in gold_chunks)
    )
    return hit_hops / len(gold_by_hop)


def valid_plan_rate(plans: list[QueryPlan], max_hops: int = 4) -> float:
    if not plans:
        return 0.0
    valid = sum(1 for p in plans if not validate_plan(p, max_hops))
    return valid / len(plans)


def dependency_accuracy(pred_plan: QueryPlan, gold_subquestions: list[dict]) -> float:
    gold_edges = {
        (sq["id"], dep) for sq in gold_subquestions for dep in sq.get("depends_on", [])
    }
    pred_edges = {(sq.id, dep) for sq in pred_plan.subquestions for dep in sq.depends_on}
    if not gold_edges and not pred_edges:
        return 1.0
    if not gold_edges:
        return 0.0
    return len(gold_edges & pred_edges) / len(gold_edges)


# ---------------------------------------------------------------------------
# Answer metrics: Exact Match / F1 (SQuAD-style, token-level)
# ---------------------------------------------------------------------------


def exact_match(pred: str, gold: str) -> float:
    return 1.0 if simple_tokenize(pred) == simple_tokenize(gold) else 0.0


def f1_score(pred: str, gold: str) -> float:
    pred_tokens = simple_tokenize(pred)
    gold_tokens = simple_tokenize(gold)
    if not pred_tokens or not gold_tokens:
        return float(pred_tokens == gold_tokens)
    common = Counter(pred_tokens) & Counter(gold_tokens)
    num_same = sum(common.values())
    if num_same == 0:
        return 0.0
    precision = num_same / len(pred_tokens)
    recall = num_same / len(gold_tokens)
    return 2 * precision * recall / (precision + recall)


# ---------------------------------------------------------------------------
# Grounding metrics
# ---------------------------------------------------------------------------


def citation_precision_recall(cited_chunk_ids: list[str], gold_chunk_ids: list[str]) -> tuple[float, float]:
    cited = set(cited_chunk_ids)
    gold = set(gold_chunk_ids)
    if not cited and not gold:
        return 1.0, 1.0
    precision = len(cited & gold) / len(cited) if cited else 0.0
    recall = len(cited & gold) / len(gold) if gold else 1.0
    return precision, recall


def unsupported_claim_rate(claim_statuses: list[str]) -> float:
    if not claim_statuses:
        return 0.0
    return sum(1 for s in claim_statuses if s == "unsupported") / len(claim_statuses)


# ---------------------------------------------------------------------------
# Aggregate over a benchmark split
# ---------------------------------------------------------------------------


def aggregate_retrieval_metrics(
    items: list[BenchmarkItem], retrieved_by_item: dict[str, list[str]], k: int = 8
) -> dict[str, float]:
    recalls, hits, mrrs, ndcgs = [], [], [], []
    for item in items:
        gold = [e.chunk_id for e in item.supporting_evidence]
        retrieved = retrieved_by_item.get(item.id, [])
        recalls.append(recall_at_k(retrieved, gold, k))
        hits.append(hit_at_k(retrieved, gold, k))
        mrrs.append(mrr_at_k(retrieved, gold, k))
        ndcgs.append(ndcg_at_k(retrieved, gold, k))
    n = len(items) or 1
    return {
        f"recall@{k}": sum(recalls) / n,
        f"hit@{k}": sum(hits) / n,
        f"mrr@{k}": sum(mrrs) / n,
        f"ndcg@{k}": sum(ndcgs) / n,
    }
