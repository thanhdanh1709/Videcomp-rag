"""Sinh de xuat benchmark multi-hop ban dau bang LLM (HuongDanThucHien Buoc 13).

QUAN TRONG: day chi la BUOC DE XUAT. annotation_status luon la 'draft' - gold
label (cau tra loi, decomposition, evidence chain) PHAI duoc nguoi gan nhan
kiem tra lai dua tren van ban nguon truoc khi dua vao data/benchmark/{dev,
test}.jsonl chinh thuc. Khong tu dong danh dau la 'reviewed'/'adjudicated'.
"""
from __future__ import annotations

import random

from ..core.llm_provider import LLMProvider
from ..schemas.benchmark import BenchmarkCandidateDraft, BenchmarkItem
from ..schemas.documents import Chunk
from .index_builder import build_bm25_index


class InvalidCandidate(Exception):
    pass


def _group_chunks_across_docs(chunks: list[Chunk], group_size: int, n_groups: int, seed: int = 0) -> list[list[Chunk]]:
    """Uu tien nhom cac chunk tu NHIEU doc_id khac nhau trong mot nhom, vi
    cau hoi multi-hop that su can bang chung nam o nhieu van ban/hop khac
    nhau (DeCuong Muc 2: vi du xuyen 3 van ban).

    Nhom hoan toan ngau nhien (khong xet do lien quan chu de) - voi corpus
    nhieu linh vuc khac nhau, phan lon nhom se khong lien quan va bi LLM tu
    choi (hop_count=1, dung thiet ke). Dung `_group_chunks_by_topic` de tang
    ty le nhom co lien quan chu de that su."""
    rng = random.Random(seed)
    by_doc: dict[str, list[Chunk]] = {}
    for c in chunks:
        by_doc.setdefault(c.doc_id, []).append(c)
    doc_ids = list(by_doc.keys())

    groups = []
    for _ in range(n_groups):
        if len(doc_ids) >= group_size:
            picked_docs = rng.sample(doc_ids, group_size)
        else:
            picked_docs = [rng.choice(doc_ids) for _ in range(group_size)]
        group = [rng.choice(by_doc[d]) for d in picked_docs]
        groups.append(group)
    return groups


def _group_chunks_by_topic(chunks: list[Chunk], group_size: int, n_groups: int, seed: int = 0) -> list[list[Chunk]]:
    """Nhom chunk theo do lien quan chu de (BM25): chon 1 chunk "hat giong"
    ngau nhien, roi lay cac chunk BM25-gan-nhat nhung tu doc_id KHAC nhau de
    dam bao nhom vua lien quan chu de vua xuyen van ban. Giam ty le LLM tu
    choi vi nhom ngau nhien khong lien quan (xem Han che da biet trong README)."""
    rng = random.Random(seed)
    index = build_bm25_index(chunks)

    groups: list[list[Chunk]] = []
    tried_seeds: set[str] = set()
    max_attempts = n_groups * 25
    attempts = 0

    while len(groups) < n_groups and attempts < max_attempts and len(tried_seeds) < len(chunks):
        attempts += 1
        seed_chunk = rng.choice(chunks)
        if seed_chunk.chunk_id in tried_seeds:
            continue
        tried_seeds.add(seed_chunk.chunk_id)

        hits = index.search(seed_chunk.text, k=max(50, group_size * 15))
        group = [seed_chunk]
        used_docs = {seed_chunk.doc_id}
        for hit_chunk, _score in hits:
            if len(group) >= group_size:
                break
            if hit_chunk.doc_id in used_docs:
                continue
            group.append(hit_chunk)
            used_docs.add(hit_chunk.doc_id)

        if len(group) == group_size and len(used_docs) >= 2:
            groups.append(group)

    return groups


def validate_candidate(candidate: BenchmarkCandidateDraft, allowed_chunk_ids: set[str]) -> list[str]:
    errors = []
    evidence_chunk_ids = {e.chunk_id for e in candidate.supporting_evidence}
    unknown = evidence_chunk_ids - allowed_chunk_ids
    if unknown:
        errors.append(f"supporting_evidence tham chieu chunk_id ngoai nhom duoc cung cap: {unknown}")

    sub_ids = {sq.id for sq in candidate.subquestions}
    for sq in candidate.subquestions:
        for dep in sq.depends_on:
            if dep not in sub_ids:
                errors.append(f"subquestion {sq.id} depends_on id khong ton tai: {dep}")

    evidence_hop_ids = {e.hop_id for e in candidate.supporting_evidence}
    missing_evidence_hops = sub_ids - evidence_hop_ids
    if missing_evidence_hops:
        errors.append(f"cac hop khong co supporting_evidence: {missing_evidence_hops}")

    if candidate.hop_count != len(candidate.subquestions):
        errors.append(f"hop_count={candidate.hop_count} khong khop so subquestions={len(candidate.subquestions)}")

    return errors


def propose_candidates(
    chunks: list[Chunk],
    domain: str,
    llm: LLMProvider,
    n_candidates: int = 10,
    group_size: int = 3,
    id_prefix: str = "MH-CAND",
    seed: int = 0,
    group_strategy: str = "topic",
) -> tuple[list[BenchmarkItem], list[str]]:
    """Tra ve (candidates_hop_le, log_loi). Chi cac candidate PASS validate_candidate
    moi duoc tra ve, luon voi annotation_status='draft'.

    group_strategy: "topic" (mac dinh, dung BM25 de nhom chunk lien quan chu
    de xuyen van ban - xem _group_chunks_by_topic) hoac "random" (nhom hoan
    toan ngau nhien - xem _group_chunks_across_docs, ty le bi LLM tu choi cao
    hon voi corpus da linh vuc)."""
    if group_strategy == "topic":
        groups = _group_chunks_by_topic(chunks, group_size, n_candidates, seed=seed)
    else:
        groups = _group_chunks_across_docs(chunks, group_size, n_candidates, seed=seed)
    accepted: list[BenchmarkItem] = []
    logs: list[str] = []

    for i, group in enumerate(groups):
        allowed_ids = {c.chunk_id for c in group}
        context = {
            "domain": domain,
            "chunks": [{"chunk_id": c.chunk_id, "text": c.text, "parent_path": c.parent_path} for c in group],
        }
        try:
            draft = llm.structured_output(
                prompt="De xuat mot cau hoi multi-hop tu nhom chunk duoi day.",
                schema=BenchmarkCandidateDraft,
                context=context,
            )
        except Exception as e:  # noqa: BLE001 - log va bo qua candidate loi, khong lam sap toan bo batch
            logs.append(f"group {i}: LLM call that bai: {e}")
            continue

        errors = validate_candidate(draft, allowed_ids)
        if draft.hop_count < 2:
            errors.append("hop_count < 2, khong phai cau hoi multi-hop")
        if errors:
            logs.append(f"group {i}: {'; '.join(errors)}")
            continue

        item = BenchmarkItem(
            id=f"{id_prefix}-{i:04d}",
            domain=domain,
            question=draft.question,
            answer=draft.answer,
            hop_count=draft.hop_count,
            reasoning_type=draft.reasoning_type,
            subquestions=draft.subquestions,
            supporting_evidence=draft.supporting_evidence,
            split="test",  # placeholder - nguoi gan nhan chon lai split khi promote
            annotation_status="draft",
        )
        accepted.append(item)

    return accepted, logs
