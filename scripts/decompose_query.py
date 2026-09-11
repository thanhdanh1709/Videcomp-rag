"""python -m scripts.decompose_query --question "..." --max_hops 4 --out /tmp/query_plan.json
(HuongDanThucHien Buoc 8)."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.app.services.query_decomposer import decompose  # noqa: E402


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--question", required=True)
    parser.add_argument("--domain", default="legal")
    parser.add_argument("--max_hops", type=int, default=4)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    plan = decompose(args.question, args.domain, max_hops=args.max_hops)
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(plan.model_dump(), f, ensure_ascii=False, indent=2)
    print(f"Da ghi query_plan vao {args.out}")


if __name__ == "__main__":
    main()
