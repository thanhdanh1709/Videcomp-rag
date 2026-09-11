"""module document_ingestion (TaiLieuKyThuat Muc 5.1) [BAT BUOC].

Doc tai lieu chuyen nganh tu PDF/HTML/DOCX/TXT, chuan hoa Unicode va luu
provenance. Output: document.jsonl theo schema Muc 6.1.
"""
from __future__ import annotations

import csv
import hashlib
import re
from dataclasses import dataclass
from pathlib import Path

from bs4 import BeautifulSoup

from ..core.text_utils import normalize_unicode
from ..schemas.documents import Document, DocumentMetadata

_GAZETTE_HEADER_RE = re.compile(r"^\s*\d{0,4}\s*CÔNG BÁO/Số[^\n]*$", re.MULTILINE)

_DOC_NUMBER_RE = re.compile(r"(?:Số|So)\s*[:：]?\s*([0-9A-Za-z/\-\.]+)", re.IGNORECASE)
_ISSUED_DATE_RE = re.compile(r"(?:ngày ban hành|ban hành ngày)\s*[:：]?\s*([0-9/\-]+)", re.IGNORECASE)
_EFFECTIVE_DATE_RE = re.compile(r"(?:hiệu lực|có hiệu lực)(?: từ| kể từ)? ngày\s*[:：]?\s*([0-9/\-]+)", re.IGNORECASE)
_VERSION_RE = re.compile(r"(?:phiên bản|version)\s*[:：]?\s*([0-9A-Za-z\.]+)", re.IGNORECASE)


@dataclass
class ManifestRow:
    source_id: str
    domain: str
    source_url: str
    local_path: str
    retrieved_at: str
    license_note: str


def read_manifest(manifest_path: str | Path) -> list[ManifestRow]:
    rows: list[ManifestRow] = []
    with open(manifest_path, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(
                ManifestRow(
                    source_id=row["source_id"],
                    domain=row["domain"],
                    source_url=row.get("source_url", ""),
                    local_path=row["local_path"],
                    retrieved_at=row.get("retrieved_at", ""),
                    license_note=row.get("license_note", ""),
                )
            )
    return rows


def make_id(path: str, source_url: str | None) -> str:
    basis = source_url or path
    digest = hashlib.sha1(basis.encode("utf-8")).hexdigest()[:10]
    stem = Path(path).stem.upper().replace(" ", "_")
    return f"{stem}_{digest}"


def parse_document(path: str | Path) -> tuple[str, str]:
    """Tra ve (title, raw_text) da doc tu file. Ho tro .txt/.html/.htm/.docx.
    PDF duoc ho tro qua pypdf khi co file that; xem HuongDanThucHien Buoc 1.2.
    """
    p = Path(path)
    suffix = p.suffix.lower()
    if suffix in {".txt", ".md"}:
        raw = p.read_text(encoding="utf-8")
        title = raw.strip().splitlines()[0] if raw.strip() else p.stem
        return title, raw
    if suffix in {".html", ".htm"}:
        raw_html = p.read_text(encoding="utf-8")
        soup = BeautifulSoup(raw_html, "lxml")
        title = soup.title.get_text(strip=True) if soup.title else p.stem
        text = soup.get_text("\n")
        return title, text
    if suffix == ".docx":
        import docx

        d = docx.Document(str(p))
        paras = [para.text for para in d.paragraphs]
        title = paras[0] if paras else p.stem
        return title, "\n".join(paras)
    if suffix == ".pdf":
        from pypdf import PdfReader

        reader = PdfReader(str(p))
        pages = [page.extract_text() or "" for page in reader.pages]
        text = "\n".join(pages)
        text = _GAZETTE_HEADER_RE.sub("", text)  # bo header/footer lap lai cua Cong bao Chinh phu
        title = text.strip().splitlines()[0] if text.strip() else p.stem
        return title, text
    raise ValueError(f"Dinh dang khong ho tro: {suffix}")


def extract_metadata(text: str) -> DocumentMetadata:
    def _find(pattern: re.Pattern) -> str | None:
        m = pattern.search(text)
        return m.group(1) if m else None

    return DocumentMetadata(
        doc_number=_find(_DOC_NUMBER_RE),
        issued_date=_find(_ISSUED_DATE_RE),
        effective_date=_find(_EFFECTIVE_DATE_RE),
        version=_find(_VERSION_RE),
    )


def ingest(path: str | Path, domain: str, source_url: str | None = None) -> Document:
    title, raw_text = parse_document(path)
    text = normalize_unicode(raw_text)
    metadata = extract_metadata(text)
    return Document(
        doc_id=make_id(str(path), source_url),
        domain=domain,  # type: ignore[arg-type]
        title=normalize_unicode(title),
        text=text,
        source_url=source_url,
        metadata=metadata,
    )


def ingest_manifest(manifest_path: str | Path) -> list[Document]:
    documents = []
    for row in read_manifest(manifest_path):
        doc = ingest(row.local_path, row.domain, row.source_url or None)
        documents.append(doc)
    return documents
