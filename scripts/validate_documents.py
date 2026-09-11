"""python scripts/validate_documents.py data/processed/documents.jsonl
Validation toi thieu (HuongDanThucHien Buoc 3): doc_id duy nhat, text khong rong,
Unicode NFC, source_url/provenance ton tai, domain hop le."""
from __future__ import annotations

import sys
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.app.schemas.documents import Document  # noqa: E402

VALID_DOMAINS = {"legal", "medical"}


def validate(path: str) -> list[str]:
    errors = []
    seen_ids = set()
    with open(path, encoding="utf-8") as f:
        for line_no, line in enumerate(f, start=1):
            line = line.strip()
            if not line:
                continue
            doc = Document.model_validate_json(line)
            if doc.doc_id in seen_ids:
                errors.append(f"dong {line_no}: doc_id trung lap {doc.doc_id}")
            seen_ids.add(doc.doc_id)
            if not doc.text.strip():
                errors.append(f"dong {line_no}: text rong ({doc.doc_id})")
            if unicodedata.normalize("NFC", doc.text) != doc.text:
                errors.append(f"dong {line_no}: text khong o dang Unicode NFC ({doc.doc_id})")
            if doc.domain not in VALID_DOMAINS:
                errors.append(f"dong {line_no}: domain khong hop le ({doc.domain})")
    return errors


def main():
    path = sys.argv[1]
    errors = validate(path)
    if errors:
        print(f"FAIL: {len(errors)} loi")
        for e in errors:
            print(" -", e)
        sys.exit(1)
    print("PASS: tat ca document hop le")


if __name__ == "__main__":
    main()
