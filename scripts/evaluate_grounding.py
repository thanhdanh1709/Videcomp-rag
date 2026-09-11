"""python scripts/evaluate_grounding.py --pred experiments/results/q3_test.json
  --gold data/benchmark/test.jsonl (HuongDanThucHien Buoc 12)."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.app.schemas.benchmark import BenchmarkItem  # noqa: E402
from backend.app.services import evaluator  # noqa: E402


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pred", required=True)
    parser.add_argument("--gold", required=True)
    args = parser.parse_args()

    with open(args.pred, encoding="utf-8") as f:
        pred = json.load(f)

    gold_by_id = {}
    with open(args.gold, encoding="utf-8") as f:
        for line in f:
            if line.strip():
                item = BenchmarkItem.model_validate_json(line)
                gold_by_id[item.id] = item

    cited = [c["chunk_id"] for c in pred.get("citations", [])]
    request_id = pred.get("request_id")
    item = gold_by_id.get(request_id)
    if item is None:
        print("Khong tim thay item gold tuong ung (dung id benchmark item lam request_id neu can doi chieu).")
        return

    gold_chunks = [e.chunk_id for e in item.supporting_evidence]
    precision, recall = evaluator.citation_precision_recall(cited, gold_chunks)
    verification = pred.get("verification") or {}
    print(
        json.dumps(
            {
                "citation_precision": precision,
                "citation_recall": recall,
                "supported_claim_rate": verification.get("supported_claim_rate"),
                "status": verification.get("status"),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
