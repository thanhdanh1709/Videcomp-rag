"""QueryAnalysis / QueryPlan schemas (TaiLieuKyThuat Muc 5.4, 5.5)."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

ReasoningType = Literal[
    "single",
    "bridge",
    "intersection",
    "comparison",
    "temporal_version",
    "rule_exception",
    "other",
]


class QueryAnalysis(BaseModel):
    is_multi_hop: bool
    confidence: float = Field(ge=0, le=1)
    reasoning_type: ReasoningType
    estimated_hops: int = Field(ge=1, le=4)
    entities: list[str] = Field(default_factory=list)


class SubQuestion(BaseModel):
    id: str  # h1, h2, ...
    question: str
    depends_on: list[str] = Field(default_factory=list)
    output_var: str | None = None
    bind: dict[str, str] = Field(default_factory=dict)  # {"entity": "{{h1.answer}}"}

    @field_validator("question")
    @classmethod
    def question_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("sub-question rong")
        return v


class QueryPlan(BaseModel):
    original_question: str
    reasoning_type: ReasoningType
    subquestions: list[SubQuestion]
    expected_hops: int

    def as_id_map(self) -> dict[str, SubQuestion]:
        return {sq.id: sq for sq in self.subquestions}

    def is_acyclic(self) -> bool:
        ids = {sq.id for sq in self.subquestions}
        visiting: set[str] = set()
        visited: set[str] = set()
        graph = {sq.id: sq.depends_on for sq in self.subquestions}

        def dfs(node: str) -> bool:
            if node in visiting:
                return False
            if node in visited:
                return True
            visiting.add(node)
            for dep in graph.get(node, []):
                if dep not in ids:
                    return False
                if not dfs(dep):
                    return False
            visiting.discard(node)
            visited.add(node)
            return True

        return all(dfs(sq.id) for sq in self.subquestions)

    def all_depends_on_valid(self) -> bool:
        ids = {sq.id for sq in self.subquestions}
        return all(dep in ids for sq in self.subquestions for dep in sq.depends_on)
