"""Trình phân tích và băm nhỏ tệp tải lên (PDF, Word DOCX, TXT, MD) cho Videcomp-rag.

Hỗ trợ nâng cấp:
- Trích xuất bảng biểu có cấu trúc cao qua `pdfplumber` (chuyển đổi ma trận hàng/cột thành bảng Markdown chuẩn).
- Cơ chế Hybrid Vision OCR: tự động nhận diện trang scan dạng ảnh, hồ sơ bệnh án chụp, con dấu,
  biểu đồ phác đồ điều trị và sử dụng Vision LLM (Claude 3.5 Sonnet / Multimodal) để trích xuất trọn vẹn.
- Tự động fallback sang `pypdf` khi PDF bị lỗi cú pháp để đảm bảo tiến trình ingest 100% không bị gián đoạn.
"""
from __future__ import annotations

import base64
import hashlib
import io
import logging
import re
from typing import BinaryIO, Callable

from ..core.config import settings
from ..schemas.evidence import EvidenceCandidate

logger = logging.getLogger(__name__)


def _clean_text(text: str) -> str:
    # Chuẩn hóa khoảng trắng và dòng trống
    text = re.sub(r"\r\n|\r", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _convert_table_to_markdown(table: list[list[str | None]]) -> str:
    """Chuyển đổi ma trận bảng biểu (2D list) trích xuất được thành bảng Markdown chuẩn."""
    if not table or not any(table):
        return ""

    cleaned_rows: list[list[str]] = []
    max_cols = 0
    for row in table:
        if not row:
            continue
        cleaned_row = []
        for cell in row:
            val = str(cell or "").strip().replace("\n", " ").replace("|", "\\|")
            cleaned_row.append(val)
        if any(cleaned_row):
            cleaned_rows.append(cleaned_row)
            if len(cleaned_row) > max_cols:
                max_cols = len(cleaned_row)

    if not cleaned_rows or max_cols == 0:
        return ""

    # Chuẩn hóa độ dài mỗi hàng cho đồng đều
    for row in cleaned_rows:
        while len(row) < max_cols:
            row.append("")

    header = cleaned_rows[0]
    separator = ["---"] * max_cols
    body_rows = cleaned_rows[1:]

    lines = [
        "| " + " | ".join(header) + " |",
        "| " + " | ".join(separator) + " |",
    ]
    for r in body_rows:
        lines.append("| " + " | ".join(r) + " |")

    return "\n".join(lines)


def _extract_page_with_vision_llm(page_image_bytes: bytes, page_idx: int = 1) -> str:
    """Sử dụng Vision LLM (Claude 3.5 Sonnet Vision / Multimodal) để đọc trọn vẹn trang scan dạng ảnh."""
    if not settings.enable_vision_ocr:
        return ""

    # 1. Thử gọi qua Anthropic Claude 3.5 Sonnet Vision nếu có API Key
    if settings.anthropic_api_key:
        try:
            import anthropic

            client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
            b64_image = base64.b64encode(page_image_bytes).decode("utf-8")

            prompt = (
                "Bạn là chuyên gia OCR và phân tích tài liệu y tế, văn bản pháp luật, bảng số liệu phức tạp.\n"
                "Hãy trích xuất toàn bộ nội dung của trang tài liệu scan này:\n"
                "1. Giữ nguyên vẹn chính tả tiếng Việt có dấu, các thuật ngữ Hán - Việt, điều khoản luật, tên thuốc, chỉ số xét nghiệm.\n"
                "2. Mọi bảng biểu số liệu hoặc bảng đối chiếu hãy chuyển thành bảng Markdown chuẩn (| Cột 1 | Cột 2 |).\n"
                "3. Nếu có biểu đồ, sơ đồ phác đồ điều trị, hãy diễn giải luồng quy trình và các bước bằng danh sách có thứ tự.\n"
                "Chỉ xuất ra nội dung văn bản tiếng Việt đã trích xuất, không thêm lời chào hay giải thích ngoài lề."
            )

            response = client.messages.create(
                model=settings.vision_model or "claude-3-5-sonnet-20241022",
                max_tokens=4096,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": "image/png",
                                    "data": b64_image,
                                },
                            },
                            {"type": "text", "text": prompt},
                        ],
                    }
                ],
            )
            extracted_text = ""
            for block in response.content:
                if block.type == "text":
                    extracted_text += block.text + "\n"
            if extracted_text.strip():
                logger.info("Vision OCR thành công cho trang %d (%d ký tự)", page_idx, len(extracted_text))
                return extracted_text.strip()
        except Exception as exc:
            logger.warning("Lỗi khi gọi Anthropic Vision OCR cho trang %d: %s", page_idx, exc)

    return ""


def extract_text_from_file(
    filename: str,
    content: bytes,
    progress_callback: Callable[[float, str], None] | None = None,
) -> list[tuple[str, str]]:
    """Trích xuất văn bản từ tệp dưới dạng danh sách [(tiêu_đề_phần, nội_dung)]."""
    ext = filename.lower().split(".")[-1]
    sections: list[tuple[str, str]] = []

    if progress_callback:
        progress_callback(5.0, f"Bắt đầu đọc tệp {filename}...")

    if ext == "pdf":
        used_pdfplumber = False
        try:
            import pdfplumber

            with pdfplumber.open(io.BytesIO(content)) as pdf:
                total_pages = len(pdf.pages)
                ocr_count = 0
                for page_idx, page in enumerate(pdf.pages, start=1):
                    pct = 5.0 + (page_idx / max(1, total_pages)) * 55.0
                    page_parts: list[str] = []

                    # 1. Trích xuất bảng biểu có cấu trúc
                    if settings.enable_pdf_table_extraction:
                        try:
                            tables = page.extract_tables() or []
                            for t_idx, table in enumerate(tables, start=1):
                                md_table = _convert_table_to_markdown(table)
                                if md_table:
                                    page_parts.append(f"\n[Bảng {t_idx}]:\n{md_table}\n")
                        except Exception as table_err:
                            logger.debug("Lỗi trích xuất bảng trang %d: %s", page_idx, table_err)

                    # 2. Trích xuất text máy tính thông thường
                    raw_text = page.extract_text() or ""
                    cleaned_page_text = _clean_text(raw_text)
                    if cleaned_page_text:
                        page_parts.append(cleaned_page_text)

                    # 3. Nhận diện trang scan dạng ảnh / sơ đồ phác đồ điều trị
                    if settings.enable_vision_ocr and ocr_count < settings.vision_max_pages:
                        has_images = bool(getattr(page, "images", None))
                        # Kích hoạt nếu trang không có text hoặc text < 40 ký tự và có ảnh/đối tượng scan
                        if len(cleaned_page_text) < 40 and (has_images or total_pages <= 5):
                            if progress_callback:
                                progress_callback(
                                    pct, f"Đang Vision OCR ảnh/sơ đồ trang {page_idx}/{total_pages}..."
                                )
                            try:
                                p_img = page.to_image(resolution=150).original
                                img_buf = io.BytesIO()
                                p_img.save(img_buf, format="PNG")
                                ocr_res = _extract_page_with_vision_llm(img_buf.getvalue(), page_idx=page_idx)
                                if ocr_res:
                                    page_parts.append(f"\n[OCR Đa phương thái - Trang {page_idx}]:\n{ocr_res}")
                                    ocr_count += 1
                            except Exception as ocr_err:
                                logger.debug("Không thể xuất ảnh trang %d để Vision OCR: %s", page_idx, ocr_err)

                    final_page_text = "\n\n".join(part for part in page_parts if part.strip()).strip()
                    if final_page_text:
                        sections.append((f"Trang {page_idx}", final_page_text))

                    if progress_callback and total_pages > 0:
                        progress_callback(pct, f"Đang trích xuất trang {page_idx}/{total_pages} ({int(pct)}%)...")

                used_pdfplumber = True
        except Exception as exc:
            logger.warning("pdfplumber gặp lỗi (%s), tự động fallback sang pypdf", exc)

        # Fallback an toàn về pypdf nếu pdfplumber lỗi hoặc không có section
        if not used_pdfplumber or not sections:
            try:
                import pypdf

                reader = pypdf.PdfReader(io.BytesIO(content))
                total_pages = len(reader.pages)
                sections = []
                for page_idx, page in enumerate(reader.pages, start=1):
                    text = page.extract_text() or ""
                    text = _clean_text(text)
                    if text:
                        sections.append((f"Trang {page_idx}", text))
                    if progress_callback and total_pages > 0:
                        pct = 5.0 + (page_idx / total_pages) * 55.0
                        progress_callback(pct, f"Đang trích xuất trang {page_idx}/{total_pages} ({int(pct)}%)...")
            except Exception as pypdf_err:
                logger.warning("pypdf cũng không thể đọc tệp PDF (%s)", pypdf_err)


    elif ext in ("docx", "doc"):
        if progress_callback:
            progress_callback(15.0, "Đang phân tích cấu trúc văn bản và bảng biểu Word...")
        import docx

        doc = docx.Document(io.BytesIO(content))
        paragraphs = []
        for p in doc.paragraphs:
            t = p.text.strip()
            if t:
                paragraphs.append(t)

        # Bóc tách bảng biểu Word thành bảng Markdown chuẩn
        for t_idx, table in enumerate(doc.tables, start=1):
            table_matrix = []
            for row in table.rows:
                table_matrix.append([c.text.strip() for c in row.cells])
            md_table = _convert_table_to_markdown(table_matrix)
            if md_table:
                paragraphs.append(f"\n[Bảng {t_idx}]:\n{md_table}\n")

        if progress_callback:
            progress_callback(45.0, "Đang tổng hợp nội dung văn bản Word...")
        full_doc_text = _clean_text("\n".join(paragraphs))
        if full_doc_text:
            sections.append(("Nội dung văn bản", full_doc_text))

    else:  # txt, md, csv, html, v.v.
        if progress_callback:
            progress_callback(20.0, "Đang giải mã và làm sạch văn bản...")
        try:
            raw_text = content.decode("utf-8")
        except UnicodeDecodeError:
            try:
                raw_text = content.decode("utf-16")
            except Exception:
                raw_text = content.decode("latin-1", errors="ignore")

        clean = _clean_text(raw_text)
        if clean:
            sections.append(("Toàn văn tài liệu", clean))

    if progress_callback:
        progress_callback(60.0, f"Đã trích xuất xong {len(sections)} phần nội dung.")

    return sections


def parse_file_to_candidates(
    filename: str,
    content: bytes,
    chunk_size: int = 400,
    chunk_overlap: int = 50,
    progress_callback: Callable[[float, str], None] | None = None,
) -> list[EvidenceCandidate]:
    """Phân rã tệp tải lên thành các đoạn EvidenceCandidate có cấu trúc chuẩn."""
    sections = extract_text_from_file(filename, content, progress_callback=progress_callback)
    candidates: list[EvidenceCandidate] = []

    clean_doc_name = re.sub(r"[^\w\s.-]", "", filename).strip()
    file_hash = hashlib.md5(filename.encode("utf-8", errors="ignore")).hexdigest()[:6]
    doc_id = f"FILE_{file_hash}_{clean_doc_name[:25]}"

    if progress_callback:
        progress_callback(65.0, "Bắt đầu băm nhỏ văn bản (chunking) theo cửa sổ trượt...")

    chunk_seq = 1
    total_sections = max(1, len(sections))
    for sec_idx, (sec_title, sec_text) in enumerate(sections, start=1):
        words = sec_text.split()
        if not words:
            continue

        start = 0
        while start < len(words):
            end = min(start + chunk_size, len(words))
            chunk_words = words[start:end]
            chunk_str = " ".join(chunk_words)

            chunk_id = f"up_{file_hash}_{chunk_seq}"
            candidates.append(
                EvidenceCandidate(
                    chunk_id=chunk_id,
                    doc_id=doc_id,
                    text=f"【{filename} - {sec_title}】: {chunk_str}",
                    source_url=f"attachment://{filename}",
                    parent_path=[filename, sec_title, f"Đoạn {chunk_seq}"],
                    sparse_rank=chunk_seq,
                    dense_rank=chunk_seq,
                    rrf_score=0.95 - (chunk_seq * 0.01),
                )
            )
            chunk_seq += 1
            if end >= len(words):
                break
            start += chunk_size - chunk_overlap

        if progress_callback:
            pct = 65.0 + (sec_idx / total_sections) * 30.0
            progress_callback(pct, f"Đang chia đoạn {sec_title} (đoạn {chunk_seq - 1}, {int(pct)}%)...")

    if progress_callback:
        progress_callback(96.0, f"Đã tạo {len(candidates)} đoạn trích xuất. Đang lưu trữ...")

    return candidates
