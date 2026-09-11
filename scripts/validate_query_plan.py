"""python scripts/validate_query_plan.py /tmp/query_plan.json (HuongDanThucHien Buoc 8)."""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.app.schemas.query_plan import QueryPlan  # noqa: E402
from backend.app.services.query_decomposer import validate_plan  # noqa: E402


def main():
    path = sys.argv[1]
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    plan = QueryPlan.model_validate(data)
    errors = validate_plan(plan)
    if errors:
        print("FAIL:")
        for e in errors:
            print(" -", e)
        sys.exit(1)
    print(f"PASS: plan hop le, {plan.expected_hops} hop, reasoning_type={plan.reasoning_type}")


if __name__ == "__main__":
    main()
