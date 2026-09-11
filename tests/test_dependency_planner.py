import pytest

from backend.app.schemas.query_plan import QueryPlan, SubQuestion
from backend.app.services.dependency_planner import (
    CyclicQueryPlanError,
    independent_groups,
    validate_and_toposort,
)


def test_toposort_respects_dependencies():
    plan = QueryPlan(
        original_question="q",
        reasoning_type="bridge",
        subquestions=[
            SubQuestion(id="h3", question="c", depends_on=["h1", "h2"]),
            SubQuestion(id="h1", question="a", depends_on=[]),
            SubQuestion(id="h2", question="b", depends_on=["h1"]),
        ],
        expected_hops=3,
    )
    ordered = validate_and_toposort(plan)
    order_ids = [sq.id for sq in ordered]
    assert order_ids.index("h1") < order_ids.index("h2")
    assert order_ids.index("h2") < order_ids.index("h3")


def test_toposort_raises_on_cycle():
    plan = QueryPlan(
        original_question="q",
        reasoning_type="bridge",
        subquestions=[
            SubQuestion(id="h1", question="a", depends_on=["h2"]),
            SubQuestion(id="h2", question="b", depends_on=["h1"]),
        ],
        expected_hops=2,
    )
    with pytest.raises(CyclicQueryPlanError):
        validate_and_toposort(plan)


def test_independent_groups_parallelizable_hops():
    plan = QueryPlan(
        original_question="q",
        reasoning_type="intersection",
        subquestions=[
            SubQuestion(id="h1", question="a", depends_on=[]),
            SubQuestion(id="h2", question="b", depends_on=[]),
            SubQuestion(id="h3", question="c", depends_on=["h1", "h2"]),
        ],
        expected_hops=3,
    )
    ordered = validate_and_toposort(plan)
    groups = independent_groups(ordered)
    assert {sq.id for sq in groups[0]} == {"h1", "h2"}
    assert [sq.id for sq in groups[1]] == ["h3"]
