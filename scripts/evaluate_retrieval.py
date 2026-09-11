"""python scripts/evaluate_retrieval.py --dataset data/benchmark/dev.jsonl
  --mode hybrid_rag --out experiments/results/b1_dev.json
(HuongDanThucHien Buoc 6). Danh gia thuan retrieval (khong chay decomposition),
dung cho cac mode baseline B0/B1/B2."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.app.schemas.benchmark import BenchmarkItem  # noqa: E402
from backend.app.services import evaluator  # noqa: E402
from backend.app.services.retriever import RetrievalFilters  # noqa: E402
from scripts.run_qa import load_retriever  # noqa: E402

MODE_KWARGS = {
    "dense_rag": {"dense_only": True},
    "hybrid_rag": {"use_reranker": False},
    "hybrid_rerank": {"use_reranker": True},
}


def load_items(path: str) -> list[BenchmarkItem]:
    items = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            if line.strip():
                items.append(BenchmarkItem.model_validate_json(line))
    return items


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", required=True)
    parser.add_argument("--mode", default="hybrid_rag", choices=list(MODE_KWARGS))
    parser.add_argument("--k", type=int, default=8)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    items = load_items(args.dataset)
    retrievers = {}
    retrieved_by_item = {}
    for item in items:
        retriever = retrievers.setdefault(item.domain, load_retriever(item.domain))
        candidates = retriever.search(
            item.question, filters=RetrievalFilters(domain=item.domain), top_k=args.k, **MODE_KWARGS[args.mode]
        )
        retrieved_by_item[item.id] = [c.chunk_id for c in candidates]

    metrics = evaluator.aggregate_retrieval_metrics(items, retrieved_by_item, k=args.k)
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump({"mode": args.mode, "n_items": len(items), "metrics": metrics}, f, ensure_ascii=False, indent=2)
    print(json.dumps(metrics, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
