"""module domain_chunker — Structure-aware Chunking (TaiLieuKyThuat Muc 5.2) [BAT BUOC].

Phap luat: uu tien Chuong -> Dieu -> Khoan -> Diem.
Y te: uu tien heading -> subsection -> recommendation/table caption.
Fallback: heading + sentence window khi van ban khong theo cau truc chuan.
"""
from __future__ import annotations

import re

from ..core.text_utils import approx_token_count, repair_split_syllables, simple_tokenize
from ..schemas.documents import Chunk, ChunkMetadata, Document

_CHUONG_RE = re.compile(r"^\s*(Chương\s+[IVXLCDM\d]+.*)$", re.IGNORECASE | re.MULTILINE)
_DIEU_RE = re.compile(r"^\s*(Điều\s+\d+[a-zA-Z]?\..*)$", re.IGNORECASE | re.MULTILINE)
_KHOAN_RE = re.compile(r"^\s*(\d+\.\s+.*)$", re.MULTILINE)

# Y te: heading that "^[A-Z...].{3,80}$" tung khop hau het moi cau tieng Viet
# (vi moi cau thuong bat dau bang chu hoa) - lam over-segment nghiem trong khi
# thu nghiem tren van ban Bo Y te that (QD 1440/QD-BYT). Thay bang heuristic
# chat hon: chi coi la heading khi la dong NGAN, PHAN LON chu hoa, va KHONG
# ket thuc bang dau cham/phay (dac trung cua tieu de, khac cau van thong thuong).
_MD_HEADING_LINE_RE = re.compile(
    r"^\s*(?:#{1,3}\s+.+|[IVXLCDM]{1,6}\.\s+.{2,80}|\d{1,2}\.\s+.{2,70}:)\s*$",
    re.MULTILINE,
)


def _is_heading_like(line: str) -> bool:
    """True neu dong trong giong tieu de/section header hon la mot cau noi
    dung: phan lon ky tu chu la chu hoa va khong ket thuc bang cham/phay/cham
    phay (headings tieng Viet trong van ban hanh chinh thuong la '#.' + toan
    chu hoa hoac ket thuc bang dau hai cham)."""
    stripped = line.strip()
    if stripped.endswith((".", ",", ";")):
        return False
    letters = [c for c in stripped if c.isalpha()]
    if not letters:
        return False
    upper_ratio = sum(1 for c in letters if c.isupper()) / len(letters)
    return upper_ratio >= 0.6 or stripped.endswith(":")


def _split_legal(text: str) -> list[tuple[list[str], str]]:
    """Tra ve list (parent_path, block_text) theo Chuong/Dieu."""
    chuong_spans = list(_CHUONG_RE.finditer(text))
    blocks: list[tuple[list[str], str]] = []

    def slice_by(spans, start, end):
        return text[start:end]

    if not chuong_spans:
        # khong co Chuong -> tach truc tiep theo Dieu
        return _split_by_dieu(text, chapter=None)

    for i, m in enumerate(chuong_spans):
        chapter_title = m.group(1).strip()
        seg_start = m.end()
        seg_end = chuong_spans[i + 1].start() if i + 1 < len(chuong_spans) else len(text)
        segment = text[seg_start:seg_end]
        blocks.extend(_split_by_dieu(segment, chapter=chapter_title))
    return blocks


def _split_by_dieu(segment: str, chapter: str | None) -> list[tuple[list[str], str]]:
    dieu_spans = list(_DIEU_RE.finditer(segment))
    blocks: list[tuple[list[str], str]] = []
    if not dieu_spans:
        path = [chapter] if chapter else []
        return _sentence_window_fallback(segment, path)

    for i, m in enumerate(dieu_spans):
        dieu_title = m.group(1).strip()
        seg_start = m.end()
        seg_end = dieu_spans[i + 1].start() if i + 1 < len(dieu_spans) else len(segment)
        body = segment[seg_start:seg_end]
        path = [p for p in [chapter, dieu_title] if p]
        blocks.extend(_split_by_khoan(body, path))
    return blocks


def _split_by_khoan(body: str, path: list[str]) -> list[tuple[list[str], str]]:
    khoan_spans = list(_KHOAN_RE.finditer(body))
    if not khoan_spans:
        return [(path, body.strip())] if body.strip() else []
    blocks: list[tuple[list[str], str]] = []
    # Doan dan truoc Khoan 1 (vd "Quyen dan su duoc xac lap tu cac can cu sau
    # day:") thuong mang nghia cho ca Dieu - truoc day bi cat bo hoan toan vi
    # block dau tien bat dau tu khoan_spans[0].start(). Gan lai vao Khoan 1
    # thay vi mat, vi no khong co "so hieu" rieng de tao path/chunk cua no.
    preamble = body[: khoan_spans[0].start()].strip()
    for i, m in enumerate(khoan_spans):
        khoan_text = m.group(1).strip()
        seg_start = m.start()
        seg_end = khoan_spans[i + 1].start() if i + 1 < len(khoan_spans) else len(body)
        block_text = body[seg_start:seg_end].strip()
        if i == 0 and preamble:
            block_text = f"{preamble}\n{block_text}"
        khoan_num = re.match(r"^(\d+)\.", khoan_text)
        khoan_label = f"Khoản {khoan_num.group(1)}" if khoan_num else khoan_text[:20]
        blocks.append((path + [khoan_label], block_text))
    return blocks


def _split_medical(text: str) -> list[tuple[list[str], str]]:
    heading_spans = [m for m in _MD_HEADING_LINE_RE.finditer(text) if _is_heading_like(m.group(0))]
    if not heading_spans:
        return _sentence_window_fallback(text, [])
    blocks: list[tuple[list[str], str]] = []
    preamble = text[: heading_spans[0].start()].strip()
    if preamble:
        blocks.append(([], preamble))
    for i, m in enumerate(heading_spans):
        heading = m.group(0).strip("# ").strip()
        seg_start = m.end()
        seg_end = heading_spans[i + 1].start() if i + 1 < len(heading_spans) else len(text)
        body = text[seg_start:seg_end].strip()
        if body:
            blocks.append(([heading], body))
    return blocks


def _sentence_window_fallback(text: str, path: list[str], window_sentences: int = 5) -> list[tuple[list[str], str]]:
    sentences = re.split(r"(?<=[.!?…])\s+", text.strip())
    sentences = [s for s in sentences if s.strip()]
    if not sentences:
        return []
    blocks = []
    for i in range(0, len(sentences), window_sentences):
        window = " ".join(sentences[i : i + window_sentences])
        if window.strip():
            blocks.append((path, window.strip()))
    return blocks


def split_by_domain_boundary(document: Document) -> list[tuple[list[str], str]]:
    # Sua manh vo am tiet do PDF-extraction truoc khi tach block (README muc
    # Corpus, diem 3) - ap dung o day de moi caller (build_chunks lan test
    # goi truc tiep split_by_domain_boundary) deu nhan text da sach.
    text = repair_split_syllables(document.text)
    if document.domain == "legal":
        return _split_legal(text)
    return _split_medical(text)


def merge_small_blocks(
    blocks: list[tuple[list[str], str]], target_tokens: int = 350, overlap_tokens: int = 50
) -> list[tuple[list[str], str]]:
    """Gop cac block qua nho lai voi nhau (cung parent_path) de dat ~target_tokens,
    va cat bot block qua lon thanh nhieu phan co overlap. Khong tron noi dung
    tu hai Dieu khac nhau vao mot chunk neu co the tranh (TaiLieuKyThuat 5.2/4)."""
    merged: list[tuple[list[str], str]] = []
    buffer_path: list[str] | None = None
    buffer_text = ""

    def flush():
        nonlocal buffer_path, buffer_text
        if buffer_path is not None and buffer_text.strip():
            merged.append((buffer_path, buffer_text.strip()))
        buffer_path, buffer_text = None, ""

    for path, block_text in blocks:
        token_count = approx_token_count(block_text)
        if token_count > target_tokens:
            flush()
            merged.extend(_split_oversized(path, block_text, target_tokens, overlap_tokens))
            continue
        if buffer_path is None:
            buffer_path, buffer_text = path, block_text
            continue
        if buffer_path == path and approx_token_count(buffer_text) < target_tokens:
            buffer_text = f"{buffer_text}\n{block_text}"
        else:
            flush()
            buffer_path, buffer_text = path, block_text
    flush()
    return merged


def _split_oversized(path: list[str], text: str, target_tokens: int, overlap_tokens: int) -> list[tuple[list[str], str]]:
    tokens = simple_tokenize(text)
    words = text.split()
    if len(words) <= target_tokens:
        return [(path, text)]
    parts = []
    step = max(1, target_tokens - overlap_tokens)
    i = 0
    while i < len(words):
        chunk_words = words[i : i + target_tokens]
        parts.append((path, " ".join(chunk_words)))
        if i + target_tokens >= len(words):
            break
        i += step
    return parts


def build_chunks(document: Document, target_tokens: int = 350, overlap_tokens: int = 50) -> list[Chunk]:
    raw_blocks = split_by_domain_boundary(document)
    merged_blocks = merge_small_blocks(raw_blocks, target_tokens, overlap_tokens)
    chunks = []
    for idx, (path, text) in enumerate(merged_blocks):
        slug = "#" + "#".join(_slugify(p) for p in path) if path else f"#part_{idx}"
        chunk_id = f"{document.doc_id}{slug}" if path else f"{document.doc_id}#part_{idx}"
        # Prepend parent_path vao text duoc index/hien thi cho LLM: nhieu
        # chunk cap Khoan rat ngan (vd "1. Hop dong.") va vo nghia neu tach
        # roi khoi tieu de Dieu cua no - anh huong ca BM25/dense retrieval
        # lan chat luong hop-answer (README muc Corpus, diem 3).
        display_text = f"{' > '.join(path)}\n{text}" if path else text
        chunks.append(
            Chunk(
                chunk_id=chunk_id,
                doc_id=document.doc_id,
                parent_path=path,
                text=display_text,
                token_count=approx_token_count(display_text),
                source_url=document.source_url,
                metadata=ChunkMetadata(
                    domain=document.domain,
                    effective_date=document.metadata.effective_date,
                    version=document.metadata.version,
                ),
            )
        )
    return _dedupe_chunk_ids(chunks)


def _slugify(value: str) -> str:
    value = value.lower().strip()
    value = re.sub(r"\s+", "_", value)
    value = re.sub(r"[^\w]", "", value, flags=re.UNICODE)
    return value[:40] or "x"


def _dedupe_chunk_ids(chunks: list[Chunk]) -> list[Chunk]:
    seen: dict[str, int] = {}
    for chunk in chunks:
        if chunk.chunk_id in seen:
            seen[chunk.chunk_id] += 1
            chunk.chunk_id = f"{chunk.chunk_id}_{seen[chunk.chunk_id]}"
        else:
            seen[chunk.chunk_id] = 0
    return chunks
