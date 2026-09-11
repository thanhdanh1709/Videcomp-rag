"""python scripts/build_vector_index.py --chunks data/chunks/legal_chunks.jsonl
  --model "$EMBEDDING_MODEL" --collection legal_v1 [--out data/indices/vector_legal]
(HuongDanThucHien Buoc 5). Backend FAISS mac dinh (prototype local); dung
--backend qdrant de day sang Qdrant server (can settings.qdrant_url)."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.app.core.config import settings  # noqa: E402
from backend.app.core.embedding_provider import get_embedding_provider  # noqa: E402
from backend.app.services.index_builder import (  # noqa: E402
    build_vector_index,
    load_chunks,
    write_index_metadata,
)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--chunks", required=True)
    parser.add_argument("--model", default=None)
    parser.add_argument("--collection", required=True)
    parser.add_argument("--backend", default=settings.vector_backend, choices=["faiss", "qdrant"])
    parser.add_argument("--out", default=None, help="Bat buoc khi backend=faiss")
    args = parser.parse_args()

    if args.model:
        settings.embedding_model = args.model
    chunks = load_chunks(args.chunks)
    embedder = get_embedding_provider()
    index = build_vector_index(
        chunks, embedder=embedder, backend=args.backend, collection=args.collection, qdrant_url=settings.qdrant_url
    )

    if args.backend == "faiss":
        out = args.out or f"data/indices/{args.collection}"
        index.save(out)
        write_index_metadata(out, index_version=args.collection, embedding_model=embedder.model_name if hasattr(embedder, "model_name") else "hashing", backend="faiss")
        print(f"Da xay FAISS index cho {len(chunks)} chunk tai {out}")
    else:
        print(f"Da day {len(chunks)} chunk vao Qdrant collection {args.collection}")


if __name__ == "__main__":
    main()
