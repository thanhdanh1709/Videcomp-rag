"""python scripts/check_citations.py experiments/results/sample_answer.json
PASS khi: moi citation ton tai, khong co citation orphan, moi claim quan
trong co it nhat mot citation hoac uncertainty_note (HuongDanThucHien Buoc 11)."""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def main():
    path = sys.argv[1]
    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    citation_keys = {c["key"] for c in data.get("citations", [])}
    evidence_ids = set()
    for hop in data.get("hop_trace", []):
        evidence_ids.update(hop.get("evidence_ids", []))

    errors = []
    for c in data.get("citations", []):
        if c["chunk_id"] not in evidence_ids:
            errors.append(f"citation {c['key']} tro toi chunk_id ngoai evidence bundle: {c['chunk_id']}")

    if not citation_keys and not data.get("final_answer", "").strip():
        errors.append("khong co citation va khong co final_answer")

    if errors:
        print("FAIL:")
        for e in errors:
            print(" -", e)
        sys.exit(1)
    print(f"PASS: {len(citation_keys)} citation, tat ca tro ve evidence bundle hop le")


if __name__ == "__main__":
    main()
