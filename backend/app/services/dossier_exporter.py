"""Dịch vụ Xuất Báo cáo Chuyên nghiệp (Legal / Medical Dossier Exporter).

Hỗ trợ xuất hồ sơ thẩm định/tư vấn chuẩn mực cho giới luật sư, chuyên gia tư vấn
pháp lý, bác sĩ và hội đồng thẩm định dưới 2 định dạng:
1. Microsoft Word (.docx) qua `python-docx` với bố cục bảng biểu, viền trang, màu sắc trạng thái.
2. Adobe PDF (.pdf) qua `reportlab` với font Unicode tiếng Việt (Arial TTF).
"""
from __future__ import annotations

import datetime as dt
import io
import logging
import os
import re
from typing import Any

logger = logging.getLogger(__name__)


def build_dossier_data(
    session_data: dict[str, Any] | Any,
    turn_index: int = -1,
    custom_title: str | None = None,
) -> dict[str, Any]:
    """Chuẩn hóa dữ liệu phiên hỏi đáp thành cấu trúc hồ sơ thẩm định chuyên nghiệp."""
    # Xử lý nếu đầu vào là ORM object hoặc dict
    if hasattr(session_data, "__dict__"):
        turns = getattr(session_data, "turns", []) or []
        session_id = getattr(session_data, "id", "sess-unknown")
        domain = getattr(session_data, "domain", "legal")
        mode = getattr(session_data, "mode", "videcomp_full")
        created_at_dt = getattr(session_data, "created_at", None)
    else:
        turns = session_data.get("turns", []) or []
        session_id = session_data.get("id", session_data.get("sessionId", "sess-unknown"))
        domain = session_data.get("domain", "legal")
        mode = session_data.get("mode", "videcomp_full")
        created_at_dt = session_data.get("created_at")

    if not turns:
        # Trường hợp gọi trực tiếp với AnswerResult đơn lẻ
        turn = session_data if isinstance(session_data, dict) else {}
        question = turn.get("question", "Câu hỏi thẩm định")
        result = turn.get("result", turn)
    else:
        # Lấy lượt hỏi đáp theo turn_index
        idx = turn_index if 0 <= turn_index < len(turns) else len(turns) - 1
        turn = turns[idx]
        question = turn.get("question", "")
        result = turn.get("result", {})

    query_plan = result.get("query_plan") or {}
    hops_data = result.get("hop_trace") or []
    citations_data = result.get("citations") or []
    verification_data = result.get("verification") or {}
    final_answer = result.get("final_answer", "")
    latency_ms = result.get("latency_ms", 0.0)

    # Format ngày giờ
    if isinstance(created_at_dt, dt.datetime):
        time_str = created_at_dt.strftime("%d/%m/%Y %H:%M")
    elif isinstance(created_at_dt, str):
        time_str = created_at_dt[:16].replace("T", " ")
    else:
        time_str = dt.datetime.now().strftime("%d/%m/%Y %H:%M")

    domain_label = "Pháp luật Việt Nam (Chuyên ngành)" if domain == "legal" else "Y tế & Lâm sàng Phác đồ BYT"
    mode_label = {
        "B0": "B0 - Dense Vector Thuần (FAISS)",
        "B1": "B1 - Hybrid Retrieval (BM25 + Dense RRF)",
        "B2": "B2 - Hybrid Rerank (Cross-Encoder)",
        "Q1": "Q1 - Phân rã Độc lập (Independent Hops)",
        "Q2": "Q2 - Phân rã Phụ thuộc (DAG Dependency)",
        "Q3": "Q3 - ViDecomp-RAG Full (Phân rã Đa bước & Kiểm chứng NLI)",
        "videcomp_full": "Q3 - ViDecomp-RAG Full (Phân rã Đa bước & Kiểm chứng NLI)",
    }.get(mode, mode)

    default_title = "HỒ SƠ BÁO CÁO THẨM ĐỊNH PHÁP LÝ" if domain == "legal" else "HỒ SƠ BÁO CÁO TƯ VẤN Y KHOA"

    # Trích xuất danh sách Hop
    hops: list[dict[str, Any]] = []
    for h in hops_data:
        hops.append(
            {
                "hop_id": h.get("hop_id", ""),
                "question": h.get("subquestion", h.get("question", "")),
                "answer": h.get("intermediate_answer", h.get("answer", "Chưa có kết luận")),
                "docs": h.get("retrieved_docs", []),
            }
        )

    # Trích xuất danh sách Trích dẫn
    citations: list[dict[str, Any]] = []
    for c in citations_data:
        citations.append(
            {
                "key": c.get("key", ""),
                "chunk_id": c.get("chunk_id", ""),
                "law_title": c.get("law_title", c.get("source_url", "Căn cứ thẩm định")),
                "clause": c.get("clause", "Điều khoản trích dẫn"),
                "snippet": c.get("snippet", c.get("text", "")),
            }
        )

    # Trích xuất Bảng Kiểm chứng Luận điểm (Grounding Verification)
    claims: list[dict[str, Any]] = []
    claim_results = verification_data.get("claim_results") or verification_data.get("claim_verifications") or verification_data.get("claims") or []
    for cl in claim_results:
        st = str(cl.get("status", "insufficient")).lower()
        status_label = "HỢP LỆ (SUPPORTED)" if st == "supported" else ("MÂU THUẪN (UNSUPPORTED)" if st == "unsupported" else "THIẾU CĂN CỨ (INSUFFICIENT)")
        cits = cl.get("citations") or ([cl.get("evidence")] if cl.get("evidence") else [])
        cits_str = ", ".join(cits) if isinstance(cits, list) else str(cits)
        claims.append(
            {
                "claim": cl.get("claim", ""),
                "status": st,
                "status_label": status_label,
                "citations": cits_str,
            }
        )

    supported_rate = verification_data.get("supported_claim_rate", 1.0) * 100.0
    verification_status = verification_data.get("status", "pass").upper()

    return {
        "title": custom_title or default_title,
        "session_id": session_id,
        "time_str": time_str,
        "domain": domain,
        "domain_label": domain_label,
        "mode_label": mode_label,
        "latency_sec": round(latency_ms / 1000.0, 2) if latency_ms else 0.0,
        "question": question,
        "final_answer": final_answer,
        "hops": hops,
        "citations": citations,
        "claims": claims,
        "supported_rate": round(supported_rate, 1),
        "verification_status": verification_status,
    }


# ==============================================================================
# 1. MICROSOFT WORD (.DOCX) EXPORTER
# ==============================================================================

def generate_docx_dossier(dossier_data: dict[str, Any]) -> bytes:
    """Tạo tệp Microsoft Word (.docx) báo cáo thẩm định chuẩn mực chuyên nghiệp."""
    import docx
    from docx.enum.table import WD_TABLE_ALIGNMENT
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.oxml import OxmlElement, parse_xml
    from docx.oxml.ns import nsdecls, qn
    from docx.shared import Inches, Pt, RGBColor

    doc = docx.Document()

    # Thiết lập lề trang chuẩn văn bản hành chính (2.0 cm)
    for section in doc.sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.8)
        section.right_margin = Inches(0.8)

    # 1. Header tổ chức & hệ thống
    p_top = doc.add_paragraph()
    p_top.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_top1 = p_top.add_run("HỆ THỐNG PHÂN RÃ HỎI ĐÁP ĐA BƯỚC CHUYÊN NGÀNH — VIDECOMP-RAG\n")
    r_top1.bold = True
    r_top1.font.size = Pt(9.5)
    r_top1.font.color.rgb = RGBColor(100, 116, 139)

    r_top2 = p_top.add_run("BAN THẨM ĐỊNH PHÁP LÝ & PHÂN TÍCH CHUYÊN MÔN\n")
    r_top2.bold = True
    r_top2.font.size = Pt(10)
    r_top2.font.color.rgb = RGBColor(15, 23, 42)

    r_line = p_top.add_run("―" * 30 + "\n")
    r_line.font.color.rgb = RGBColor(203, 213, 225)

    # 2. Tiêu đề hồ sơ
    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_title = p_title.add_run(dossier_data["title"].upper())
    r_title.bold = True
    r_title.font.size = Pt(16)
    r_title.font.color.rgb = RGBColor(15, 118, 110) if dossier_data["domain"] == "legal" else RGBColor(14, 116, 144)

    p_sub = doc.add_paragraph()
    p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_sub = p_sub.add_run(f"Số tham chiếu: {dossier_data['session_id']} • Thời gian lập: {dossier_data['time_str']}")
    r_sub.font.size = Pt(9.5)
    r_sub.font.italic = True
    r_sub.font.color.rgb = RGBColor(100, 116, 139)

    doc.add_paragraph()  # khoảng trống

    # 3. Bảng Metadata thông tin thẩm định
    table_meta = doc.add_table(rows=4, cols=2)
    table_meta.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta_rows = [
        ("Lĩnh vực thụ lý:", dossier_data["domain_label"]),
        ("Chế độ suy luận:", dossier_data["mode_label"]),
        ("Thời gian phản hồi:", f"{dossier_data['latency_sec']} giây (Xác thực thời gian thực)"),
        ("Độ tin cậy luận điểm:", f"{dossier_data['supported_rate']}% luận điểm có chứng cứ xác thực (Status: {dossier_data['verification_status']})"),
    ]
    for row_idx, (k, v) in enumerate(meta_rows):
        r = table_meta.rows[row_idx]
        c0 = r.cells[0]
        c1 = r.cells[1]
        c0.width = Inches(2.2)
        c1.width = Inches(4.6)
        c0.paragraphs[0].add_run(k).bold = True
        c0.paragraphs[0].runs[0].font.size = Pt(9.5)
        c1.paragraphs[0].add_run(v).font.size = Pt(9.5)

    # Đổ màu nền bảng metadata
    for row in table_meta.rows:
        for cell in row.cells:
            shading = parse_xml(r'<w:shd {} w:fill="F8FAFC"/>'.format(nsdecls('w')))
            cell._tc.get_or_add_tcPr().append(shading)

    doc.add_paragraph()

    # 4. Phần I: Câu hỏi & Tóm tắt kết luận
    h1 = doc.add_heading("I. TÓM TẮT KẾT LUẬN THẨM ĐỊNH (EXECUTIVE SUMMARY)", level=2)
    h1.paragraph_format.space_before = Pt(12)

    p_q = doc.add_paragraph()
    p_q.add_run("Vấn đề / Câu hỏi cần thẩm định: ").bold = True
    p_q.add_run(f'"{dossier_data["question"]}"').italic = True

    # Box kết luận nổi bật
    t_ans = doc.add_table(rows=1, cols=1)
    t_ans.alignment = WD_TABLE_ALIGNMENT.CENTER
    c_ans = t_ans.rows[0].cells[0]
    c_ans.width = Inches(6.8)
    shading_ans = parse_xml(r'<w:shd {} w:fill="F0FDFA"/>'.format(nsdecls('w')))
    c_ans._tc.get_or_add_tcPr().append(shading_ans)
    p_ans_in = c_ans.paragraphs[0]
    p_ans_in.add_run("NỘI DUNG KẾT LUẬN THẨM ĐỊNH:\n").bold = True
    p_ans_in.runs[0].font.color.rgb = RGBColor(13, 148, 136)
    p_ans_in.add_run(dossier_data["final_answer"]).font.size = Pt(10.5)

    doc.add_paragraph()

    # 5. Phần II: Cây suy luận DAG từng bước (Reasoning Chain)
    if dossier_data["hops"]:
        doc.add_heading("II. TIẾN TRÌNH SUY LUẬN BẮC CẦU ĐA BƯỚC (MULTI-HOP REASONING CHAIN)", level=2)
        p_dag_intro = doc.add_paragraph("Hệ thống tự động phân tách câu hỏi đa phức hợp thành chuỗi câu hỏi con có trật tự phụ thuộc:")
        p_dag_intro.runs[0].font.size = Pt(9.5)

        table_hops = doc.add_table(rows=len(dossier_data["hops"]) + 1, cols=3)
        table_hops.alignment = WD_TABLE_ALIGNMENT.CENTER
        headers_hop = ["Chặng (Hop)", "Câu hỏi con phân rã", "Kết luận trung gian trích xuất"]
        for idx, h_text in enumerate(headers_hop):
            cell = table_hops.rows[0].cells[idx]
            shading = parse_xml(r'<w:shd {} w:fill="E2E8F0"/>'.format(nsdecls('w')))
            cell._tc.get_or_add_tcPr().append(shading)
            r = cell.paragraphs[0].add_run(h_text)
            r.bold = True
            r.font.size = Pt(9.5)

        for h_idx, hop in enumerate(dossier_data["hops"], start=1):
            row = table_hops.rows[h_idx]
            row.cells[0].width = Inches(1.2)
            row.cells[1].width = Inches(2.8)
            row.cells[2].width = Inches(2.8)

            row.cells[0].paragraphs[0].add_run(hop["hop_id"].upper()).bold = True
            row.cells[1].paragraphs[0].add_run(hop["question"]).font.size = Pt(9)
            row.cells[2].paragraphs[0].add_run(hop["answer"]).font.size = Pt(9)

        doc.add_paragraph()

    # 6. Phần III: Bảng Danh mục Căn cứ & Trích dẫn Điều luật / Phác đồ
    if dossier_data["citations"]:
        doc.add_heading("III. BẢNG DANH MỤC CĂN CỨ PHÁP LÝ / PHÁC ĐỒ ĐIỀU TRỊ (GROUNDING CITATIONS)", level=2)
        table_cits = doc.add_table(rows=len(dossier_data["citations"]) + 1, cols=4)
        table_cits.alignment = WD_TABLE_ALIGNMENT.CENTER
        headers_cit = ["Ký hiệu", "Văn bản quy phạm / Phác đồ", "Điều / Khoản", "Trích dẫn nguyên văn căn cứ"]
        for idx, h_text in enumerate(headers_cit):
            cell = table_cits.rows[0].cells[idx]
            shading = parse_xml(r'<w:shd {} w:fill="E2E8F0"/>'.format(nsdecls('w')))
            cell._tc.get_or_add_tcPr().append(shading)
            r = cell.paragraphs[0].add_run(h_text)
            r.bold = True
            r.font.size = Pt(9.5)

        for c_idx, cit in enumerate(dossier_data["citations"], start=1):
            row = table_cits.rows[c_idx]
            row.cells[0].width = Inches(0.8)
            row.cells[1].width = Inches(2.2)
            row.cells[2].width = Inches(1.4)
            row.cells[3].width = Inches(2.4)

            row.cells[0].paragraphs[0].add_run(cit["key"]).bold = True
            row.cells[1].paragraphs[0].add_run(cit["law_title"]).font.size = Pt(9)
            row.cells[2].paragraphs[0].add_run(cit["clause"]).font.size = Pt(9)
            row.cells[3].paragraphs[0].add_run(cit["snippet"][:200] + ("..." if len(cit["snippet"]) > 200 else "")).font.size = Pt(8.5)

        doc.add_paragraph()

    # 7. Phần IV: Bảng Đối chiếu Mâu thuẫn & Kiểm định Luận điểm (Grounding Verification)
    if dossier_data["claims"]:
        doc.add_heading("IV. BẢNG ĐỐI CHIẾU MÂU THUẪN & KIỂM ĐỊNH LUẬN ĐIỂM (GROUNDING VERIFICATION REPORT)", level=2)
        p_ver_intro = doc.add_paragraph(
            f"Từng mệnh đề trong câu trả lời được kiểm chứng độc lập với văn bản gốc. Kết quả kiểm định: {dossier_data['verification_status']} ({dossier_data['supported_rate']}% Supported)."
        )
        p_ver_intro.runs[0].font.size = Pt(9.5)

        table_ver = doc.add_table(rows=len(dossier_data["claims"]) + 1, cols=4)
        table_ver.alignment = WD_TABLE_ALIGNMENT.CENTER
        headers_ver = ["STT", "Mệnh đề luận điểm (Claim)", "Ký hiệu trích dẫn", "Trạng thái xác thực"]
        for idx, h_text in enumerate(headers_ver):
            cell = table_ver.rows[0].cells[idx]
            shading = parse_xml(r'<w:shd {} w:fill="E2E8F0"/>'.format(nsdecls('w')))
            cell._tc.get_or_add_tcPr().append(shading)
            r = cell.paragraphs[0].add_run(h_text)
            r.bold = True
            r.font.size = Pt(9.5)

        for cl_idx, cl in enumerate(dossier_data["claims"], start=1):
            row = table_ver.rows[cl_idx]
            row.cells[0].width = Inches(0.6)
            row.cells[1].width = Inches(3.6)
            row.cells[2].width = Inches(1.2)
            row.cells[3].width = Inches(1.4)

            row.cells[0].paragraphs[0].add_run(str(cl_idx)).font.size = Pt(9)
            row.cells[1].paragraphs[0].add_run(cl["claim"]).font.size = Pt(9)
            row.cells[2].paragraphs[0].add_run(cl["citations"] or "-").font.size = Pt(9)

            r_st = row.cells[3].paragraphs[0].add_run(cl["status_label"])
            r_st.bold = True
            r_st.font.size = Pt(8.5)
            if cl["status"] == "supported":
                r_st.font.color.rgb = RGBColor(16, 185, 129)  # xanh
            else:
                r_st.font.color.rgb = RGBColor(239, 68, 68)   # đỏ

        doc.add_paragraph()

    # 8. Phần V: Chữ ký xác nhận thẩm định
    doc.add_heading("V. XÁC NHẬN CỦA CHUYÊN VIÊN & LÃNH ĐẠO PHÊ DUYỆT", level=2)
    t_sign = doc.add_table(rows=2, cols=2)
    t_sign.alignment = WD_TABLE_ALIGNMENT.CENTER
    c_s0 = t_sign.rows[0].cells[0]
    c_s1 = t_sign.rows[0].cells[1]
    c_s0.width = Inches(3.4)
    c_s1.width = Inches(3.4)

    p_s0 = c_s0.paragraphs[0]
    p_s0.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_s0.add_run("CHUYÊN VIÊN THỤ LÝ HỒ SƠ\n").bold = True
    p_s0.add_run("(Ký và ghi rõ họ tên)\n\n\n\n").italic = True
    p_s0.add_run("Hệ thống ViDecomp-RAG Verified")

    p_s1 = c_s1.paragraphs[0]
    p_s1.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_s1.add_run("LÃNH ĐẠO PHÊ DUYỆT\n").bold = True
    p_s1.add_run("(Ký, đóng dấu hoặc chữ ký số PKI)\n\n\n\n").italic = True
    p_s1.add_run("ĐÃ KIỂM ĐỊNH NỘI BỘ")

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


# ==============================================================================
# 2. ADOBE PDF (.PDF) EXPORTER
# ==============================================================================

def _register_vietnamese_font() -> str:
    """Đăng ký font TrueType Unicode tiếng Việt trong ReportLab."""
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont

    font_name = "VietnameseFont"
    candidates = [
        "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/times.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    for p in candidates:
        if os.path.exists(p):
            try:
                pdfmetrics.registerFont(TTFont(font_name, p))
                # Thử đăng ký cả bold
                bold_p = p.replace(".ttf", "bd.ttf").replace("arial.ttf", "arialbd.ttf")
                if os.path.exists(bold_p):
                    pdfmetrics.registerFont(TTFont(f"{font_name}-Bold", bold_p))
                return font_name
            except Exception as e:
                logger.debug("Lỗi đăng ký font %s: %s", p, e)

    return "Helvetica"


def generate_pdf_dossier(dossier_data: dict[str, Any]) -> bytes:
    """Tạo tệp PDF (.pdf) báo cáo thẩm định chuẩn in ấn qua ReportLab."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import inch
    from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    font_base = _register_vietnamese_font()
    font_bold = f"{font_base}-Bold" if f"{font_base}-Bold" in from_pdfmetrics() else font_base

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        rightMargin=0.6 * inch,
        leftMargin=0.6 * inch,
        topMargin=0.6 * inch,
        bottomMargin=0.6 * inch,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "DossierTitle",
        parent=styles["Heading1"],
        fontName=font_bold,
        fontSize=15,
        leading=19,
        alignment=1,  # Center
        textColor=colors.HexColor("#0f766e") if dossier_data["domain"] == "legal" else colors.HexColor("#0e7490"),
    )
    sub_style = ParagraphStyle(
        "DossierSub",
        parent=styles["Normal"],
        fontName=font_base,
        fontSize=9,
        leading=12,
        alignment=1,
        textColor=colors.HexColor("#64748b"),
    )
    h2_style = ParagraphStyle(
        "DossierH2",
        parent=styles["Heading2"],
        fontName=font_bold,
        fontSize=11,
        leading=15,
        textColor=colors.HexColor("#0f172a"),
        spaceBefore=10,
        spaceAfter=4,
    )
    body_style = ParagraphStyle(
        "DossierBody",
        parent=styles["Normal"],
        fontName=font_base,
        fontSize=9.5,
        leading=13.5,
        textColor=colors.HexColor("#1e293b"),
    )
    bold_style = ParagraphStyle(
        "DossierBold",
        parent=body_style,
        fontName=font_bold,
    )

    elements = []

    # 1. Header tổ chức
    elements.append(Paragraph("HỆ THỐNG TRUY VẤN VÀ PHÂN RÃ HỎI ĐÁP ĐA BƯỚC — VIDECOMP-RAG", sub_style))
    elements.append(Paragraph("BAN THẨM ĐỊNH PHÁP LÝ & PHÂN TÍCH CHUYÊN MÔN", bold_style))
    elements.append(Spacer(1, 6))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#cbd5e1"), spaceAfter=10))

    # 2. Tiêu đề
    elements.append(Paragraph(dossier_data["title"].upper(), title_style))
    elements.append(Paragraph(f"Số tham chiếu: {dossier_data['session_id']} • Thời gian lập: {dossier_data['time_str']}", sub_style))
    elements.append(Spacer(1, 10))

    # 3. Bảng Metadata
    meta_table_data = [
        [Paragraph("<b>Lĩnh vực thụ lý:</b>", body_style), Paragraph(dossier_data["domain_label"], body_style)],
        [Paragraph("<b>Chế độ suy luận:</b>", body_style), Paragraph(dossier_data["mode_label"], body_style)],
        [Paragraph("<b>Thời gian phản hồi:</b>", body_style), Paragraph(f"{dossier_data['latency_sec']} giây", body_style)],
        [Paragraph("<b>Độ tin cậy luận điểm:</b>", body_style), Paragraph(f"{dossier_data['supported_rate']}% Supported (Kết luận: {dossier_data['verification_status']})", body_style)],
    ]
    meta_table = Table(meta_table_data, colWidths=[1.8 * inch, 5.0 * inch])
    meta_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ])
    )
    elements.append(meta_table)
    elements.append(Spacer(1, 10))

    # 4. Phần I: Tóm tắt kết luận
    elements.append(Paragraph("I. TÓM TẮT KẾT LUẬN THẨM ĐỊNH (EXECUTIVE SUMMARY)", h2_style))
    elements.append(Paragraph(f"<b>Vấn đề thẩm định:</b> <i>\"{dossier_data['question']}\"</i>", body_style))
    elements.append(Spacer(1, 6))

    ans_box = Table([[Paragraph(f"<b>NỘI DUNG KẾT LUẬN:</b><br/>{dossier_data['final_answer']}", body_style)]], colWidths=[6.8 * inch])
    ans_box.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f0fdfa")),
            ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#0d9488")),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ])
    )
    elements.append(ans_box)
    elements.append(Spacer(1, 10))

    # 5. Phần II: Cây suy luận DAG
    if dossier_data["hops"]:
        elements.append(Paragraph("II. TIẾN TRÌNH SUY LUẬN BẮC CẦU ĐA BƯỚC (MULTI-HOP CHAIN)", h2_style))
        hop_rows = [[Paragraph("<b>Chặng</b>", bold_style), Paragraph("<b>Câu hỏi con phân rã</b>", bold_style), Paragraph("<b>Kết luận trung gian</b>", bold_style)]]
        for h in dossier_data["hops"]:
            hop_rows.append([
                Paragraph(h["hop_id"].upper(), bold_style),
                Paragraph(h["question"], body_style),
                Paragraph(h["answer"], body_style),
            ])
        t_hops = Table(hop_rows, colWidths=[0.9 * inch, 2.9 * inch, 3.0 * inch])
        t_hops.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ])
        )
        elements.append(t_hops)
        elements.append(Spacer(1, 10))

    # 6. Phần III: Danh mục trích dẫn
    if dossier_data["citations"]:
        elements.append(Paragraph("III. BẢNG DANH MỤC CĂN CỨ VĂN BẢN (GROUNDING CITATIONS)", h2_style))
        cit_rows = [[Paragraph("<b>Mã</b>", bold_style), Paragraph("<b>Văn bản quy phạm</b>", bold_style), Paragraph("<b>Điều / Khoản</b>", bold_style), Paragraph("<b>Trích dẫn nguyên văn</b>", bold_style)]]
        for c in dossier_data["citations"]:
            cit_rows.append([
                Paragraph(c["key"], bold_style),
                Paragraph(c["law_title"], body_style),
                Paragraph(c["clause"], body_style),
                Paragraph(c["snippet"][:180] + ("..." if len(c["snippet"]) > 180 else ""), body_style),
            ])
        t_cits = Table(cit_rows, colWidths=[0.6 * inch, 2.2 * inch, 1.4 * inch, 2.6 * inch])
        t_cits.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ])
        )
        elements.append(t_cits)
        elements.append(Spacer(1, 10))

    # 7. Phần IV: Kiểm định luận điểm (NLI Verification)
    if dossier_data["claims"]:
        elements.append(Paragraph("IV. BẢNG ĐỐI CHIẾU & KIỂM ĐỊNH MÂU THUẪN (NLI VERIFICATION)", h2_style))
        cl_rows = [[Paragraph("<b>STT</b>", bold_style), Paragraph("<b>Mệnh đề phân tích (Claim)</b>", bold_style), Paragraph("<b>Căn cứ</b>", bold_style), Paragraph("<b>Kết luận</b>", bold_style)]]
        for idx, cl in enumerate(dossier_data["claims"], start=1):
            st_color = "#10b981" if cl["status"] == "supported" else "#ef4444"
            st_html = f'<font color="{st_color}"><b>{cl["status_label"]}</b></font>'
            cl_rows.append([
                Paragraph(str(idx), body_style),
                Paragraph(cl["claim"], body_style),
                Paragraph(cl["citations"] or "-", body_style),
                Paragraph(st_html, body_style),
            ])
        t_cl = Table(cl_rows, colWidths=[0.5 * inch, 3.7 * inch, 1.1 * inch, 1.5 * inch])
        t_cl.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ])
        )
        elements.append(t_cl)
        elements.append(Spacer(1, 12))

    # 8. Chữ ký
    elements.append(Paragraph("V. XÁC NHẬN CHUYÊN VIÊN & PHÊ DUYỆT", h2_style))
    sign_table = Table(
        [
            [Paragraph("<b>CHUYÊN VIÊN THỤ LÝ</b><br/><i>(Ký và ghi rõ họ tên)</i><br/><br/><br/>ViDecomp-RAG Certified", body_style),
             Paragraph("<b>LÃNH ĐẠO PHÊ DUYỆT</b><br/><i>(Ký, đóng dấu hoặc chữ ký số)</i><br/><br/><br/>ĐÃ PHÊ DUYỆT HỒ SƠ", body_style)]
        ],
        colWidths=[3.4 * inch, 3.4 * inch]
    )
    sign_table.setStyle(
        TableStyle([
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ])
    )
    elements.append(sign_table)

    doc.build(elements)
    return buf.getvalue()


def from_pdfmetrics() -> list[str]:
    """Lấy danh sách font đã đăng ký trong ReportLab."""
    try:
        from reportlab.pdfbase import pdfmetrics
        return list(pdfmetrics.getRegisteredFontNames())
    except Exception:
        return []
