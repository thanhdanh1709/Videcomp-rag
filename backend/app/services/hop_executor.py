"""module hop_executor (TaiLieuKyThuat Muc 5.6) [BAT BUOC].

for hop in plan:
    q = bind_variables(hop.question, memory, hop.bind)
    candidates = retriever.search(q, filters=hop.filters)
    evidence = select_evidence(candidates)
    intermediate = answer_hop(q, evidence)
    memory.add(hop.id, q, evidence, intermediate)

Placeholder nhu {{h1.answer}} hoac {{entity_A}} duoc bind truoc retrieval
(TaiLieuKyThuat Muc 4.2).
"""
from __future__ import annotations

import re

from ..core.llm_provider import LLMProvider, get_llm_provider
from ..schemas.answer import HopAnswer, HopTraceEntry
from ..schemas.query_plan import SubQuestion
from .dependency_planner import validate_and_toposort
from .evidence_memory import EvidenceMemory
from .retriever import HybridRetriever, RetrievalFilters

_PLACEHOLDER_RE = re.compile(r"\{\{([\w\.]+)\}\}")


def bind_variables(question: str, memory: EvidenceMemory, bind: dict[str, str]) -> str:
    """Thay the placeholder {{hX.answer}} bang gia tri thuc trong memory.
    Cac bind entry cung co the tham chieu placeholder tuong tu; duoc resolve
    truoc, sau do ap dung vao question neu question co placeholder trung ten
    bien trong bind hoac truc tiep dang {{hX.answer}}."""

    def resolve(match: re.Match) -> str:
        ref = match.group(1)
        hop_id, _, field_name = ref.partition(".")
        if field_name == "answer" and hop_id in memory.hop_answers:
            return memory.hop_answers[hop_id]
        if ref in bind:
            return bind[ref]
        return match.group(0)

    bound = _PLACEHOLDER_RE.sub(resolve, question)
    for _var_name, template in bind.items():
        bound_value = _PLACEHOLDER_RE.sub(resolve, template)
        if bound == template:
            bound = bound_value
    return bound


def select_evidence(candidates, top_k: int | None = None):
    return candidates if top_k is None else candidates[:top_k]


def answer_hop(question: str, evidence, llm: LLMProvider | None = None) -> str:
    llm = llm or get_llm_provider()
    result: HopAnswer = llm.structured_output(
        prompt=question,
        schema=HopAnswer,
        context={"question": question, "evidence_texts": [e.text for e in evidence]},
    )
    return result.answer


def run_hops(
    query_plan,
    retriever: HybridRetriever,
    domain: str,
    llm: LLMProvider | None = None,
    top_k: int | None = None,
) -> tuple[EvidenceMemory, list[HopTraceEntry]]:
    ordered = validate_and_toposort(query_plan)
    memory = EvidenceMemory()
    trace: list[HopTraceEntry] = []

    for hop in ordered:
        bound_question = bind_variables(hop.question, memory, hop.bind)
        candidates = retriever.search(bound_question, filters=RetrievalFilters(domain=domain), top_k=top_k)
        evidence = select_evidence(candidates)
        intermediate = answer_hop(bound_question, evidence, llm=llm)
        added_items = memory.add(hop.id, evidence, intermediate)
        trace.append(
            HopTraceEntry(
                hop_id=hop.id,
                question=hop.question,
                bound_question=bound_question,
                evidence_ids=[item.chunk_id for item in added_items],
                intermediate_answer=intermediate,
            )
        )
    return memory, trace
