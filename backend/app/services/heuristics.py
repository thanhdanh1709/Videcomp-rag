"""Rule-based fallback dung chung cho query_analyzer va MockLLMProvider.

TaiLieuKyThuat 5.4: "co baseline rule-based de fallback khi LLM timeout".
Tach rieng module nay de query_analyzer khong phu thuoc vao MockLLMProvider,
va MockLLMProvider khong trung lap logic.
"""
from __future__ import annotations

import re

from ..schemas.query_plan import QueryAnalysis, QueryPlan, SubQuestion

_SPLIT_MARKERS = re.compile(
    r"\b(sau khi|sau đó|và|rồi|tiếp theo|nếu|khi đã|đồng thời)\b", re.IGNORECASE
)
_MULTI_HOP_HINTS = re.compile(
    r"(sau khi|sau đó|đối chiếu|so sánh|trước khi|đồng thời|căn cứ vào .* và|"
    r"nếu .* thì|tại thời điểm|có hiệu lực)",
    re.IGNORECASE,
)
_MARKER_WORDS = {"sau khi", "sau đó", "và", "rồi", "tiếp theo", "nếu", "khi đã", "đồng thời"}


def rule_based_query_analysis(question: str) -> QueryAnalysis:
    hops = 1 + len(_SPLIT_MARKERS.findall(question))
    is_multi = bool(_MULTI_HOP_HINTS.search(question)) or hops > 1
    q_lower = question.lower()
    if "ngoại lệ" in q_lower or "trừ trường hợp" in q_lower:
        reasoning_type = "rule_exception"
    elif "trước khi" in q_lower or "hiệu lực" in q_lower:
        reasoning_type = "temporal_version"
    elif "so sánh" in q_lower:
        reasoning_type = "comparison"
    elif is_multi:
        reasoning_type = "bridge"
    else:
        reasoning_type = "single"
    return QueryAnalysis(
        is_multi_hop=is_multi,
        confidence=0.6 if is_multi else 0.9,
        reasoning_type=reasoning_type,
        estimated_hops=max(1, min(hops, 4)),
        entities=[],
    )


def rule_based_decompose(question: str, reasoning_type: str = "bridge") -> QueryPlan:
    parts = [p.strip(" ,.") for p in _SPLIT_MARKERS.split(question) if p.strip()]
    parts = [p for p in parts if p.lower() not in _MARKER_WORDS]
    if len(parts) < 2:
        parts = [question]
    subquestions = []
    for i, part in enumerate(parts, start=1):
        hop_id = f"h{i}"
        depends_on = [f"h{i - 1}"] if i > 1 else []
        bind = {"prev": f"{{{{h{i - 1}.answer}}}}"} if i > 1 else {}
        subquestions.append(
            SubQuestion(
                id=hop_id,
                question=part,
                depends_on=depends_on,
                output_var=f"{hop_id}.answer",
                bind=bind,
            )
        )
    return QueryPlan(
        original_question=question,
        reasoning_type=reasoning_type,  # type: ignore[arg-type]
        subquestions=subquestions,
        expected_hops=len(subquestions),
    )
