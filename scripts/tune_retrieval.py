"""python scripts/tune_retrieval.py --config experiments/configs/exp.yaml --split dev
(HuongDanThucHien Buoc 10). Khong tune truc tiep tren test set. Ghi ca hop
recall ben canh Recall@k tong."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.app.core.config import settings  # noqa: E402
from backend.app.schemas.benchmark import BenchmarkItem  # noqa: E402
from backend.app.services import evaluator  # noqa: E402
from backend.app.services.retriever import RetrievalFilters  # noqa: E402
from scripts.run_qa import load_retriever  # noqa: E402


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    parser.add_argument("--split", default="dev", choices=["dev"], help="Khong duoc tune tren test")
    args = parser.parse_args()

    with open(args.config, encoding="utf-8") as f:
        cfg = yaml.safe_load(f)
    retrieval_cfg = cfg.get("retrieval", {})
    for key, value in retrieval_cfg.items():
        setattr(settings, key, value)

    dataset_path = f"data/benchmark/{args.split}.jsonl"
    items = []
    with open(dataset_path, encoding="utf-8") as f:
        for line in f:
            if line.strip():
                items.append(BenchmarkItem.model_validate_json(line))

    retrievers = {}
    retrieved_by_item = {}
    hop_evidence_by_item = {}
    for item in items:
        retriever = retrievers.setdefault(item.domain, load_retriever(item.domain))
        candidates = retriever.search(item.question, filters=RetrievalFilters(domain=item.domain))
        retrieved_by_item[item.id] = [c.chunk_id for c in candidates]
        hop_evidence_by_item[item.id] = {"single_hop": [c.chunk_id for c in candidates]}

    metrics = evaluator.aggregate_retrieval_metrics(items, retrieved_by_item, k=settings.top_k_context)
    hop_recalls = [
        evaluator.hop_recall({"single_hop": retrieved_by_item[item.id]}, [
            {"hop_id": "single_hop", "chunk_id": e.chunk_id} for e in item.supporting_evidence
        ])
        for item in items
    ]
    metrics["hop_recall_avg"] = sum(hop_recalls) / len(hop_recalls) if hop_recalls else 0.0

    print(json.dumps({"config": retrieval_cfg, "metrics": metrics}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
