"""python scripts/ingest_documents.py --manifest data/raw/manifest.csv --out data/processed/documents.jsonl
(HuongDanThucHien Buoc 3)."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.app.services.ingestion import ingest_manifest  # noqa: E402


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    documents = ingest_manifest(args.manifest)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        for doc in documents:
            f.write(doc.model_dump_json() + "\n")
    print(f"Da ghi {len(documents)} document vao {out_path}")


if __name__ == "__main__":
    main()
