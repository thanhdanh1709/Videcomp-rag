"""for MODE in dense_rag hybrid_rag hybrid_rerank decomp_independent decomp_dependency videcomp_full; do
     python scripts/evaluate_all.py --mode $MODE --dataset data/benchmark/test.jsonl \
       --out experiments/results/${MODE}.json
   done
(HuongDanThucHien Buoc 14). Chay toan bo pipeline (run_qa) cho tung item va
tinh metric retrieval + hop recall + answer EM/F1 + citation precision/recall."""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.app.schemas.benchmark import BenchmarkItem  # noqa: E402
from backend.app.services import evaluator  # noqa: E402
from backend.app.services.pipeline import run_qa  # noqa: E402
from scripts.run_qa import load_retriever  # noqa: E402


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", required=True)
    parser.add_argument("--dataset", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--k", type=int, default=8)
    parser.add_argument("--bm25_dir", default=None)
    parser.add_argument("--vector_dir", default=None)
    args = parser.parse_args()

    items = []
    with open(args.dataset, encoding="utf-8") as f:
        for line in f:
            if line.strip():
                items.append(BenchmarkItem.model_validate_json(line))

    retrievers = {}
    retrieved_by_item: dict[str, list[str]] = {}
    per_item_rows = []
    latencies = []

    for item in items:
        retriever = retrievers.setdefault(
            item.domain, load_retriever(item.domain, bm25_dir=args.bm25_dir, vector_dir=args.vector_dir)
        )
        t0 = time.perf_counter()
        result = run_qa(item.question, item.domain, mode=args.mode, retriever=retriever)
        latencies.append(time.perf_counter() - t0)

        all_evidence_ids = [chunk_id for hop in result.hop_trace for chunk_id in hop.evidence_ids]
        retrieved_by_item[item.id] = all_evidence_ids

        hop_evidence_ids = {hop.hop_id: hop.evidence_ids for hop in result.hop_trace}
        gold_evidence = [e.model_dump() for e in item.supporting_evidence]
        hop_r = evaluator.hop_recall(hop_evidence_ids, gold_evidence)

        em = evaluator.exact_match(result.final_answer, item.answer)
        f1 = evaluator.f1_score(result.final_answer, item.answer)

        cited_chunk_ids = [c.chunk_id for c in result.citations]
        gold_chunk_ids = [e.chunk_id for e in item.supporting_evidence]
        precision, recall = evaluator.citation_precision_recall(cited_chunk_ids, gold_chunk_ids)

        per_item_rows.append(
            {
                "id": item.id,
                "hop_count": item.hop_count,
                "reasoning_type": item.reasoning_type,
                "hop_recall": hop_r,
                "em": em,
                "f1": f1,
                "citation_precision": precision,
                "citation_recall": recall,
                "latency_ms": result.latency_ms,
            }
        )

    retrieval_metrics = evaluator.aggregate_retrieval_metrics(items, retrieved_by_item, k=args.k)
    n = len(items) or 1
    summary = {
        "mode": args.mode,
        "n_items": len(items),
        "retrieval": retrieval_metrics,
        "hop_recall": sum(r["hop_recall"] for r in per_item_rows) / n,
        "em": sum(r["em"] for r in per_item_rows) / n,
        "f1": sum(r["f1"] for r in per_item_rows) / n,
        "citation_precision": sum(r["citation_precision"] for r in per_item_rows) / n,
        "citation_recall": sum(r["citation_recall"] for r in per_item_rows) / n,
        "latency_ms_p50": sorted(latencies)[len(latencies) // 2] * 1000 if latencies else 0,
        "per_item": per_item_rows,
    }

    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
    print(json.dumps({k: v for k, v in summary.items() if k != "per_item"}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
