"""python scripts/make_report.py --results_dir experiments/results
  --out experiments/reports/main_report.html (HuongDanThucHien Buoc 14).
Tao bang so sanh theo mode (khong chi mot con so trung binh)."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

METRIC_COLS = ["hop_recall", "em", "f1", "citation_precision", "citation_recall", "latency_ms_p50"]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--results_dir", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    rows = []
    for path in sorted(Path(args.results_dir).glob("*.json")):
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        if "mode" not in data:
            continue
        row = {"mode": data["mode"], "n_items": data.get("n_items", 0)}
        row.update(data.get("retrieval", {}))
        for col in METRIC_COLS:
            row[col] = data.get(col)
        rows.append(row)

    if not rows:
        html = "<html><body><p>Chua co ket qua experiments/results/*.json de bao cao.</p></body></html>"
    else:
        headers = list(rows[0].keys())
        thead = "".join(f"<th>{h}</th>" for h in headers)
        trs = ""
        for row in rows:
            tds = "".join(f"<td>{row.get(h, '')}</td>" for h in headers)
            trs += f"<tr>{tds}</tr>"
        html = f"""<html><head><meta charset="utf-8"><title>ViDecomp-RAG Report</title>
<style>table{{border-collapse:collapse}}td,th{{border:1px solid #ccc;padding:4px 8px}}</style>
</head><body><h1>ViDecomp-RAG — Bao cao thuc nghiem</h1>
<table><thead><tr>{thead}</tr></thead><tbody>{trs}</tbody></table></body></html>"""

    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(html, encoding="utf-8")
    print(f"Da ghi bao cao tai {args.out} ({len(rows)} mode)")


if __name__ == "__main__":
    main()
