"""De xuat cau hoi multi-hop ban dau (draft) tu corpus da chunk, dung LLM that
(HuongDanThucHien Buoc 13). KHONG tao gold benchmark tu dong - moi item sinh
ra co annotation_status='draft' va PHAI duoc nguoi gan nhan xem lai, sua cau
tra loi/decomposition/evidence cho khop van ban nguon, roi moi chuyen sang
data/benchmark/{dev,test}.jsonl chinh thuc (doi split va annotation_status
khi promote).

Vi du:
python scripts/propose_benchmark_candidates.py --chunks data/chunks/legal_chunks.jsonl \
  --domain legal --n_candidates 10 --group_size 3 \
  --out data/benchmark/candidates_draft.jsonl
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.app.core.llm_provider import get_llm_provider, settings  # noqa: E402
from backend.app.db import repository  # noqa: E402
from backend.app.db.session import init_db  # noqa: E402
from backend.app.services.benchmark_generator import propose_candidates  # noqa: E402
from backend.app.services.index_builder import load_chunks  # noqa: E402


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--chunks", required=True)
    parser.add_argument("--domain", required=True)
    parser.add_argument("--n_candidates", type=int, default=10)
    parser.add_argument("--group_size", type=int, default=3)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--group_strategy", choices=["topic", "random"], default="topic")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    if settings.llm_provider == "mock":
        print(
            "CANH BAO: LLM_PROVIDER=mock khong the sinh cau hoi multi-hop that. "
            "Hay dat LLM_PROVIDER=anthropic (hoac openai_compatible) trong .env truoc khi chay script nay.",
            file=sys.stderr,
        )
        sys.exit(1)

    chunks = load_chunks(args.chunks)
    llm = get_llm_provider()
    items, logs = propose_candidates(
        chunks,
        args.domain,
        llm,
        n_candidates=args.n_candidates,
        group_size=args.group_size,
        seed=args.seed,
        group_strategy=args.group_strategy,
    )

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "a", encoding="utf-8") as f:
        for item in items:
            f.write(item.model_dump_json() + "\n")

    init_db()
    for item in items:
        repository.upsert_benchmark_annotation(item_id=item.id, split=item.split, annotation_status="draft")

    print(f"Sinh duoc {len(items)}/{args.n_candidates} candidate hop le, ghi vao {out_path} (annotation_status=draft).")
    if logs:
        print(f"{len(logs)} candidate bi loai/loi:")
        for log in logs:
            print(" -", log)
    print("NHAC: day chi la de xuat tu LLM - can nguoi gan nhan xac nhan lai truoc khi dua vao dev/test.jsonl chinh thuc.")


if __name__ == "__main__":
    main()
