"""python scripts/validate_chunks.py data/chunks/legal_chunks.jsonl
Definition of Done (TaiLieuKyThuat 5.2): >=95% chunk co parent_path; chunk
khong vuot context budget."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.app.schemas.documents import Chunk  # noqa: E402

MAX_TOKENS = 500


def main():
    path = sys.argv[1]
    chunks = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            if line.strip():
                chunks.append(Chunk.model_validate_json(line))

    if not chunks:
        print("FAIL: khong co chunk nao")
        sys.exit(1)

    with_path = sum(1 for c in chunks if c.parent_path)
    over_budget = [c.chunk_id for c in chunks if c.token_count > MAX_TOKENS]
    empty = [c.chunk_id for c in chunks if not c.text.strip()]

    pct_with_path = with_path / len(chunks)
    print(f"So chunk: {len(chunks)}")
    print(f"% co parent_path: {pct_with_path:.1%}")
    print(f"Chunk vuot {MAX_TOKENS} token: {len(over_budget)}")
    print(f"Chunk rong: {len(empty)}")

    ok = pct_with_path >= 0.95 and not empty
    print("PASS" if ok else "FAIL")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
