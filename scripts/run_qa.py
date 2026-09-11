"""python -m scripts.run_qa --mode hybrid_rag --question "..." --domain legal
  --top_k 8 --rerank_top_k 5 [--save_trace]
(HuongDanThucHien Buoc 6, 9, 12).

Output khi --save_trace: experiments/results/<request_id>_{query_plan,hop_trace,
evidence_bundle,answer_result}.json"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.app.core.config import settings  # noqa: E402
from backend.app.services.index_builder import BM25Index, FaissVectorIndex  # noqa: E402
from backend.app.services.pipeline import run_qa  # noqa: E402
from backend.app.services.retriever import HybridRetriever  # noqa: E402


def load_retriever(domain: str, bm25_dir: str | None = None, vector_dir: str | None = None) -> HybridRetriever:
    bm25_dir = bm25_dir or f"data/indices/bm25_{domain}"
    vector_dir = vector_dir or f"data/indices/{domain}_v1"
    bm25 = BM25Index.load(bm25_dir)
    vector = FaissVectorIndex.load(vector_dir)
    return HybridRetriever(bm25_index=bm25, vector_index=vector)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", default="videcomp_full")
    parser.add_argument("--question", required=True)
    parser.add_argument("--domain", required=True)
    parser.add_argument("--top_k", type=int, default=8)
    parser.add_argument("--rerank_top_k", type=int, default=5)
    parser.add_argument("--max_corrective_rounds", type=int, default=1)
    parser.add_argument("--save_trace", action="store_true")
    parser.add_argument("--bm25_dir", default=None)
    parser.add_argument("--vector_dir", default=None)
    args = parser.parse_args()

    settings.top_k_context = args.rerank_top_k
    settings.max_corrective_rounds = args.max_corrective_rounds

    retriever = load_retriever(args.domain, args.bm25_dir, args.vector_dir)
    result = run_qa(args.question, args.domain, mode=args.mode, retriever=retriever)

    print(json.dumps(result.model_dump(), ensure_ascii=False, indent=2))

    if args.save_trace:
        out_dir = Path("experiments/results")
        out_dir.mkdir(parents=True, exist_ok=True)
        base = out_dir / result.request_id
        with open(f"{base}_query_plan.json", "w", encoding="utf-8") as f:
            json.dump(result.query_plan, f, ensure_ascii=False, indent=2)
        with open(f"{base}_hop_trace.jsonl", "w", encoding="utf-8") as f:
            for hop in result.hop_trace:
                f.write(hop.model_dump_json() + "\n")
        with open(f"{base}_answer_result.json", "w", encoding="utf-8") as f:
            json.dump(result.model_dump(), f, ensure_ascii=False, indent=2)
        print(f"Da luu trace tai {base}_*.json")


if __name__ == "__main__":
    main()
