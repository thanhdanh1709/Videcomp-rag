import pytest
from pydantic import ValidationError

from backend.app.schemas.benchmark import BenchmarkItem
from backend.app.schemas.query_plan import QueryAnalysis, SubQuestion


def test_query_analysis_estimated_hops_bounds():
    with pytest.raises(ValidationError):
        QueryAnalysis(is_multi_hop=True, confidence=0.9, reasoning_type="bridge", estimated_hops=5)


def test_sub_question_rejects_empty_question():
    with pytest.raises(ValidationError):
        SubQuestion(id="h1", question="   ")


def test_benchmark_item_round_trip():
    raw = {
        "id": "MH-0001",
        "domain": "legal",
        "question": "q",
        "answer": "a",
        "hop_count": 2,
        "reasoning_type": "bridge",
        "subquestions": [
            {"id": "h1", "question": "sub1", "depends_on": []},
            {"id": "h2", "question": "sub2", "depends_on": ["h1"]},
        ],
        "supporting_evidence": [
            {"hop_id": "h1", "doc_id": "D1", "chunk_id": "D1#c1"},
            {"hop_id": "h2", "doc_id": "D2", "chunk_id": "D2#c1"},
        ],
        "split": "test",
    }
    item = BenchmarkItem.model_validate(raw)
    assert item.annotation_status == "draft"
    assert item.model_dump()["hop_count"] == 2
