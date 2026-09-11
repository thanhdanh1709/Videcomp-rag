"""module evidence_memory — Quan ly bang chung (TaiLieuKyThuat Muc 5.7) [BAT BUOC].

Moi evidence luu chunk_id, doc_id, text, source_url, parent_path,
version/effective_date, retrieval scores, hop_id va citation_key. Ho tro
deduplicate va truy van theo hop/claim. Final answer khong duoc trich dan
chunk khong ton tai trong Evidence Memory; moi citation_key anh xa nguoc
duoc ve nguon.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from ..schemas.evidence import EvidenceBundle, EvidenceCandidate, EvidenceItem


def _normalize_citation_key(key: str) -> str:
    return key.strip().strip("[]").upper()


@dataclass
class EvidenceMemory:
    items: list[EvidenceItem] = field(default_factory=list)
    hop_answers: dict[str, str] = field(default_factory=dict)
    _seen_chunk_ids: set[str] = field(default_factory=set)
    _next_key: int = 1

    def add(self, hop_id: str, candidates: list[EvidenceCandidate], intermediate_answer: str) -> list[EvidenceItem]:
        added = []
        for cand in candidates:
            if cand.chunk_id in self._seen_chunk_ids:
                continue
            citation_key = f"[E{self._next_key}]"
            self._next_key += 1
            item = EvidenceItem(**cand.model_dump(), hop_id=hop_id, citation_key=citation_key)
            self.items.append(item)
            self._seen_chunk_ids.add(cand.chunk_id)
            added.append(item)
        self.hop_answers[hop_id] = intermediate_answer
        return added

    def extend(self, hop_id: str, candidates: list[EvidenceCandidate]) -> list[EvidenceItem]:
        """Corrective retrieval: bo sung evidence cho mot hop da ton tai
        (TaiLieuKyThuat 5.9), khong tao lai toan bo memory."""
        return self.add(hop_id, candidates, self.hop_answers.get(hop_id, ""))

    def evidence_for_hop(self, hop_id: str) -> list[EvidenceItem]:
        return [item for item in self.items if item.hop_id == hop_id]

    def evidence_for_citations(self, citation_keys: list[str]) -> list[EvidenceItem]:
        """So khop citation_key sau khi chuan hoa (bo dau [] va khoang trang) -
        LLM thuong tra ve citation trong Claim.citations/ClaimVerification.citations
        khong kem dau ngoac vuong (vd "E1") du citation_key luu trong memory la
        "[E1]", nen so khop nguyen van se luon that bai va verifier se luon
        danh gia moi claim la "insufficient" bat ke bang chung co hop le hay khong."""
        keys = {_normalize_citation_key(k) for k in citation_keys}
        return [item for item in self.items if _normalize_citation_key(item.citation_key) in keys]

    def has_chunk(self, chunk_id: str) -> bool:
        return chunk_id in self._seen_chunk_ids

    def to_bundle(self) -> EvidenceBundle:
        return EvidenceBundle(items=list(self.items))

    def to_context(self) -> str:
        return self.to_bundle().to_context()
