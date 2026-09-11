from backend.app.schemas.evidence import EvidenceCandidate
from backend.app.services.evidence_memory import EvidenceMemory


def make_candidate(chunk_id: str) -> EvidenceCandidate:
    return EvidenceCandidate(chunk_id=chunk_id, doc_id="D1", text=f"text of {chunk_id}")


def test_add_deduplicates_by_chunk_id():
    memory = EvidenceMemory()
    memory.add("h1", [make_candidate("c1"), make_candidate("c2")], "ans1")
    memory.add("h2", [make_candidate("c2"), make_candidate("c3")], "ans2")

    assert len(memory.items) == 3
    assert memory.has_chunk("c1")
    assert memory.has_chunk("c3")


def test_citation_keys_map_back_to_source():
    memory = EvidenceMemory()
    added = memory.add("h1", [make_candidate("c1")], "ans1")
    key = added[0].citation_key
    found = memory.evidence_for_citations([key])
    assert found[0].chunk_id == "c1"


def test_evidence_for_hop():
    memory = EvidenceMemory()
    memory.add("h1", [make_candidate("c1")], "ans1")
    memory.add("h2", [make_candidate("c2")], "ans2")
    assert [e.chunk_id for e in memory.evidence_for_hop("h1")] == ["c1"]
