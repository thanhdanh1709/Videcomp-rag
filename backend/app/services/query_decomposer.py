"""module query_decomposer — Sinh ke hoach cau hoi con (TaiLieuKyThuat Muc 5.5) [BAT BUOC].

Sinh sub-question co the truy hoi doc lap nhung van bieu dien duoc quan he
phu thuoc va bien trung gian. Khong yeu cau/luu chain-of-thought dai.
Validation: 2 <= expected_hops <= MAX_HOPS; depends_on phai ton tai;
graph phai acyclic; sub-question khong duoc chi chua dai tu mo ho neu chua
co bind.
"""
from __future__ import annotations

import re

from ..core.config import settings
from ..core.llm_provider import LLMProvider, get_llm_provider
from ..schemas.query_plan import QueryPlan
from .heuristics import rule_based_decompose

_AMBIGUOUS_PRONOUNS = re.compile(r"^\s*(nó|đó|này|họ|ông ấy|bà ấy)\b", re.IGNORECASE)


class InvalidQueryPlan(Exception):
    pass


def validate_plan(plan: QueryPlan, max_hops: int | None = None) -> list[str]:
    max_hops = max_hops or settings.max_hops
    errors: list[str] = []
    if not (2 <= plan.expected_hops <= max_hops) and len(plan.subquestions) > 1:
        errors.append(f"expected_hops={plan.expected_hops} ngoai khoang [2,{max_hops}]")
    if not plan.all_depends_on_valid():
        errors.append("depends_on tham chieu id khong ton tai")
    if not plan.is_acyclic():
        errors.append("query plan co cycle")
    for sq in plan.subquestions:
        if _AMBIGUOUS_PRONOUNS.match(sq.question) and not sq.bind:
            errors.append(f"sub-question {sq.id} mo ho (dai tu) nhung chua co bind")
    return errors


def decompose(
    question: str,
    domain: str,
    max_hops: int = 4,
    reasoning_type: str = "bridge",
    llm: LLMProvider | None = None,
) -> QueryPlan:
    """Sinh QueryPlan; neu JSON khong hop le, repair toi da mot lan roi fallback
    (HuongDanThucHien Buoc 8)."""
    llm = llm or get_llm_provider()
    context = {"question": question, "domain": domain, "reasoning_type": reasoning_type}

    for attempt in range(2):
        try:
            plan = llm.structured_output(prompt=question, schema=QueryPlan, context=context)
        except Exception:
            break
        errors = validate_plan(plan, max_hops)
        if not errors:
            return plan
        context["repair_hint"] = "; ".join(errors)

    return rule_based_decompose(question, reasoning_type)
