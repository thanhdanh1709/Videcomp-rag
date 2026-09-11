from backend.app.schemas.documents import Document, DocumentMetadata
from backend.app.services.chunker import build_chunks, split_by_domain_boundary

MEDICAL_TEXT = """HƯỚNG DẪN CHẨN ĐOÁN, ĐIỀU TRỊ VÀ PHÒNG LÂY NHIỄM CÚM LỢN A (H1N1) Ở NGƯỜI
Vi rút cúm đã gây nhiều vụ dịch lớn trên thế giới với tỉ lệ tử vong cao. Có 3 týp vi rút cúm là A, B và C.
I. CHẨN ĐOÁN
Dựa trên các yếu tố và triệu chứng sau:
1. Yếu tố dịch tễ:
- Sống hoặc đến từ vùng có dịch cúm lợn A (H1N1).
- Tiếp xúc gần với người bệnh, nguồn bệnh nghi ngờ.
2. Lâm sàng:
Bệnh diễn biến cấp tính và có một số biểu hiện sau đây, sốt thường trên 38 độ C.
II. ĐIỀU TRỊ
Nguyên tắc điều trị chung được áp dụng cho mọi trường hợp nghi ngờ mắc bệnh.
"""

LEGAL_TEXT = """Chương I
QUY ĐỊNH CHUNG

Điều 1. Phạm vi điều chỉnh
1. Nội dung khoản một của điều một.
2. Nội dung khoản hai của điều một.

Điều 2. Đối tượng áp dụng
1. Nội dung khoản một của điều hai.
"""


def make_doc(text: str, domain: str = "legal") -> Document:
    return Document(doc_id="DOC1", domain=domain, title="t", text=text, metadata=DocumentMetadata())


def test_legal_chunks_have_parent_path():
    chunks = build_chunks(make_doc(LEGAL_TEXT))
    assert len(chunks) == 3
    assert all(c.parent_path for c in chunks)
    assert chunks[0].parent_path[:2] == ["Chương I", "Điều 1. Phạm vi điều chỉnh"]


def test_chunk_ids_are_unique():
    chunks = build_chunks(make_doc(LEGAL_TEXT))
    ids = [c.chunk_id for c in chunks]
    assert len(ids) == len(set(ids))


def test_fallback_sentence_window_when_no_structure():
    text = "Câu một. Câu hai. Câu ba. Câu bốn. Câu năm. Câu sáu."
    chunks = build_chunks(make_doc(text), target_tokens=350, overlap_tokens=50)
    assert len(chunks) >= 1
    assert all(c.text.strip() for c in chunks)


def test_medical_heading_detection_does_not_over_segment_every_sentence():
    """Regression: heading regex qua rong tung khien MOI cau tieng Viet (vi
    bat dau bang chu hoa) bi coi la mot heading rieng khi test tren van ban
    that cua Bo Y te (QD 1440/QD-BYT). Heading hop le chi la dong ngan,
    phan lon chu hoa hoac ket thuc bang dau hai cham (I. CHAN DOAN, 1. Yeu
    to dich te:) - khong phai cau van thong thuong."""
    doc = make_doc(MEDICAL_TEXT, domain="medical")
    blocks = split_by_domain_boundary(doc)
    paths = [path for path, _ in blocks]

    # Cac cau noi dung binh thuong (bat dau bang chu hoa, ket thuc bang dau
    # cham) KHONG duoc tro thanh heading rieng.
    assert not any(p and p[0].startswith("Vi rút cúm") for p in paths)
    assert not any(p and p[0].startswith("Bệnh diễn biến") for p in paths)

    # Cac heading that su (roman numeral, numbered-with-colon) PHAI duoc nhan dien.
    heading_texts = [p[0] for p in paths if p]
    assert any("CHẨN ĐOÁN" in h and h.startswith("I.") for h in heading_texts)
    assert any("ĐIỀU TRỊ" in h and h.startswith("II.") for h in heading_texts)
    assert any(h.startswith("1. Yếu tố dịch tễ") for h in heading_texts)

    chunks = build_chunks(doc)
    assert all(c.text.strip() for c in chunks)
    # So chunk phai it hon nhieu so voi so cau trong van ban (khong over-segment)
    assert len(chunks) < 8
