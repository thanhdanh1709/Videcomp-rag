from backend.app.core.llm_provider import MockLLMProvider
from backend.app.schemas.query_plan import QueryPlan, SubQuestion
from backend.app.services.query_decomposer import decompose, validate_plan


def test_decompose_returns_valid_plan():
    plan = decompose(
        "Đối tượng áp dụng là gì và sau đó có bị loại trừ theo Thông tư demo không?",
        domain="legal",
        llm=MockLLMProvider(),
    )
    assert isinstance(plan, QueryPlan)
    assert not validate_plan(plan)
    assert len(plan.subquestions) >= 2


def test_validate_plan_detects_cycle():
    plan = QueryPlan(
        original_question="q",
        reasoning_type="bridge",
        subquestions=[
            SubQuestion(id="h1", question="a", depends_on=["h2"]),
            SubQuestion(id="h2", question="b", depends_on=["h1"]),
        ],
        expected_hops=2,
    )
    errors = validate_plan(plan)
    assert any("cycle" in e for e in errors)


def test_validate_plan_detects_invalid_depends_on():
    plan = QueryPlan(
        original_question="q",
        reasoning_type="bridge",
        subquestions=[SubQuestion(id="h1", question="a", depends_on=["h99"])],
        expected_hops=1,
    )
    errors = validate_plan(plan, max_hops=4)
    assert any("khong ton tai" in e for e in errors)
