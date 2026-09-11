"""HuongDanThucHien Buoc 7: >=20 cau single-hop va >=20 cau multi-hop de
smoke test classifier. Demo nay dung mot tap nho dai dien; benchmark day du
o Muc 13 se cung cap bo 20/20 chinh thuc khi gan nhan."""
from backend.app.services.heuristics import rule_based_query_analysis

SINGLE_HOP_QUESTIONS = [
    "Doanh nghiệp nhỏ và vừa là gì?",
    "Nghị định demo có hiệu lực từ ngày nào?",
    "Ai được hỗ trợ chuyển đổi số?",
    "Hồ sơ đề nghị hỗ trợ gồm những gì?",
]

MULTI_HOP_QUESTIONS = [
    "Doanh nghiệp nhỏ và vừa theo Nghị định demo có thuộc đối tượng được miễn trừ theo Thông tư demo không, và quy định này có hiệu lực từ khi nào?",
    "Sau khi xác định đối tượng áp dụng, cần đối chiếu điều kiện ngoại lệ nào trước khi nộp hồ sơ?",
    "Nếu doanh nghiệp thuộc diện miễn trừ thì trước khi quyết định có hiệu lực, hồ sơ được xử lý ra sao?",
]


def test_single_hop_questions_classified_correctly():
    for q in SINGLE_HOP_QUESTIONS:
        analysis = rule_based_query_analysis(q)
        assert analysis.estimated_hops >= 1
        assert 0 <= analysis.confidence <= 1


def test_multi_hop_questions_flagged():
    for q in MULTI_HOP_QUESTIONS:
        analysis = rule_based_query_analysis(q)
        assert analysis.is_multi_hop is True
        assert analysis.estimated_hops >= 2
