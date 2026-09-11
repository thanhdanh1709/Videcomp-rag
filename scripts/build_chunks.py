"""python scripts/build_chunks.py --input data/processed/documents.jsonl --domain legal
  --target_tokens 350 --overlap_tokens 50 --out data/chunks/legal_chunks.jsonl
(HuongDanThucHien Buoc 4)."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.app.schemas.documents import Document  # noqa: E402
from backend.app.services.chunker import build_chunks  # noqa: E402


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--domain", required=True)
    parser.add_argument("--target_tokens", type=int, default=350)
    parser.add_argument("--overlap_tokens", type=int, default=50)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    all_chunks = []
    with open(args.input, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            doc = Document.model_validate_json(line)
            if doc.domain != args.domain:
                continue
            all_chunks.extend(build_chunks(doc, args.target_tokens, args.overlap_tokens))

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        for chunk in all_chunks:
            f.write(chunk.model_dump_json() + "\n")
    print(f"Da ghi {len(all_chunks)} chunk vao {out_path}")


if __name__ == "__main__":
    main()
