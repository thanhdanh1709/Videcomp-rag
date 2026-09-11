"""module query_analyzer — Nhan dien multi-hop (TaiLieuKyThuat Muc 5.4) [BAT BUOC].

Phan loai cau hoi truoc khi ton chi phi decomposition. Co baseline rule-based
de fallback khi LLM timeout/loi.
"""
from __future__ import annotations

from ..core.llm_provider import LLMProvider, get_llm_provider
from ..schemas.query_plan import QueryAnalysis
from .heuristics import rule_based_query_analysis


def analyze(question: str, domain: str, llm: LLMProvider | None = None) -> QueryAnalysis:
    llm = llm or get_llm_provider()
    try:
        return llm.structured_output(
            prompt=question,
            schema=QueryAnalysis,
            context={"question": question, "domain": domain},
        )
    except Exception:
        return rule_based_query_analysis(question)


def should_decompose(analysis: QueryAnalysis, threshold: float) -> bool:
    """Muc 4.2: neu xac suat multi-hop < nguong tau, chay standard hybrid RAG."""
    return analysis.is_multi_hop and analysis.confidence >= threshold
