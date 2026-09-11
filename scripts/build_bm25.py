"""python scripts/build_bm25.py --chunks data/chunks/legal_chunks.jsonl --out data/indices/bm25_legal
(HuongDanThucHien Buoc 5)."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.app.services.index_builder import build_bm25_index, load_chunks  # noqa: E402


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--chunks", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    chunks = load_chunks(args.chunks)
    index = build_bm25_index(chunks)
    index.save(args.out)
    print(f"Da xay BM25 index cho {len(chunks)} chunk tai {args.out}")


if __name__ == "__main__":
    main()
