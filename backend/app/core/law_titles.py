"""Anh xa doc_id (bo hash + phan _P{n}) -> ten day du chinh thuc cua van ban
phap luat, dung de hien thi trich dan dang "Khoan X Dieu Y <Ten van ban>"
thay vi chunk_id ky thuat kho hieu (vd "BLHS_100_2015_HOPNHAT_a6a952bcbc#...").

Khong dung Document.title (backend/app/services/ingestion.py) vi truong do
trich tu dong dau file PDF/HTML nguon, thuong chi la header rac ("QUOC HOI",
"CONG HOA XA HOI CHU NGHIA VIET NAM"...) chu khong phai ten van ban that -
xac nhan bang cach doc truc tiep data/processed/documents_real_legal*.jsonl.
Bang duoi day xay tu README (muc Corpus) - noi liet ke chinh xac ten day du
tung van ban that da duoc ingest.
"""
from __future__ import annotations

import re

_HASH_SUFFIX_RE = re.compile(r"_[0-9a-f]{8,12}$")
_PART_SUFFIX_RE = re.compile(r"_P\d+$")
_DIEU_RE = re.compile(r"^(Điều\s+\d+[a-zA-Z]?)\.?\s*(.*)$")

_LAW_TITLES: dict[str, str] = {
    "BLDS_91_2015": "Bộ luật Dân sự số 91/2015/QH13",
    "BLHH_95_2015": "Bộ luật Hàng hải Việt Nam số 95/2015/QH13",
    "BLHS_100_2015_HOPNHAT": "Bộ luật Hình sự số 100/2015/QH13 (văn bản hợp nhất)",
    "BLLD_45_2019": "Bộ luật Lao động số 45/2019/QH14",
    "BLTTDS_92_2015_HOPNHAT": "Bộ luật Tố tụng dân sự số 92/2015/QH13 (văn bản hợp nhất)",
    "BLTTHS_101_2015": "Bộ luật Tố tụng hình sự số 101/2015/QH13",
    "LUAT_04_2017_QH14": "Luật Hỗ trợ doanh nghiệp nhỏ và vừa số 04/2017/QH14",
    "LUAT_114_2025_PHONGBENH": "Luật Phòng bệnh số 114/2025/QH15",
    "LUAT_15_2023_KBCB": "Luật Khám bệnh, chữa bệnh số 15/2023/QH15",
    "LUAT_16_2017_LAMNGHIEP": "Luật Lâm nghiệp số 16/2017/QH14",
    "LUAT_18_2017_THUYSAN": "Luật Thủy sản số 18/2017/QH14",
    "LUAT_20_2008_DDSH_HOPNHAT": "Luật Đa dạng sinh học số 20/2008/QH12 (bản hợp nhất 73/VBHN-VPQH)",
    "LUAT_20_2023_GDDT": "Luật Giao dịch điện tử số 20/2023/QH15",
    "LUAT_23_2008_GTDB": "Luật Giao thông đường bộ số 23/2008/QH12",
    "LUAT_24_2018_ANINHMANG": "Luật An ninh mạng số 24/2018/QH14",
    "LUAT_24_2023_VIENTHONG": "Luật Viễn thông số 24/2023/QH15",
    "LUAT_31_2024_DATDAI": "Luật Đất đai số 31/2024/QH15",
    "LUAT_38_2019_QLTHUE": "Luật Quản lý thuế số 38/2019/QH14",
    "LUAT_52_2014_HNGD": "Luật Hôn nhân và gia đình số 52/2014/QH13",
    "LUAT_55_2010_ATTP": "Luật An toàn thực phẩm số 55/2010/QH12",
    "LUAT_59_2020_DOANHNGHIEP": "Luật Doanh nghiệp số 59/2020/QH14",
    "LUAT_72_2020_BVMT": "Luật Bảo vệ môi trường số 72/2020/QH14",
    "LUAT_86_2015_ATTTM": "Luật An toàn thông tin mạng số 86/2015/QH13",
    "LUAT_BHYT_HOPNHAT_40VBHN": "Luật Bảo hiểm y tế (văn bản hợp nhất số 40/VBHN-VPQH)",
    "ND_06_2019_DVTVRUNG": "Nghị định số 06/2019/NĐ-CP (danh mục thực vật rừng, động vật rừng nguy cấp, quý, hiếm)",
    "ND_13_2023_BVDLCN": "Nghị định số 13/2023/NĐ-CP (bảo vệ dữ liệu cá nhân)",
    "ND_45_2022_XPVPHC_MOITRUONG": "Nghị định số 45/2022/NĐ-CP (xử phạt vi phạm hành chính lĩnh vực bảo vệ môi trường)",
    "ND_53_2022_ANM": "Nghị định số 53/2022/NĐ-CP (hướng dẫn Luật An ninh mạng)",
    "ND_80_2021_NDCP": "Nghị định số 80/2021/NĐ-CP (hướng dẫn Luật Hỗ trợ doanh nghiệp nhỏ và vừa)",
    "ND_85_2016_ATTHTTT": "Nghị định số 85/2016/NĐ-CP (an toàn hệ thống thông tin theo cấp độ)",
    "TT_06_2022_TTBKHDT": "Thông tư số 06/2022/TT-BKHĐT",
    "QD_1440_2009_H1N1_EXTRACTED": "Quyết định số 1440/QĐ-BYT (hướng dẫn chẩn đoán, điều trị và phòng lây nhiễm cúm A/H1N1)",
    # corpus demo tu tao (LAW_DEMO_*) - khong phai luat that, chi de test nhanh
    "LAW_DEMO_001": "Văn bản demo 001 (dữ liệu tự tạo, không phải luật thật)",
    "LAW_DEMO_002": "Văn bản demo 002 (dữ liệu tự tạo, không phải luật thật)",
    "LAW_DEMO_003": "Văn bản demo 003 (dữ liệu tự tạo, không phải luật thật)",
}


def _group_key(doc_id: str) -> str:
    key = _HASH_SUFFIX_RE.sub("", doc_id)
    key = _PART_SUFFIX_RE.sub("", key)
    return key


def resolve_law_title(doc_id: str) -> str:
    """Ten day du chinh thuc cua van ban chua doc_id nay. Fallback ve dang
    "human hoa" doc_id (thay _ bang khoang trang) neu chua co trong bang anh
    xa, de khong crash khi corpus duoc mo rong them van ban moi chua kip cap
    nhat _LAW_TITLES."""
    key = _group_key(doc_id)
    return _LAW_TITLES.get(key, key.replace("_", " ").strip())


def describe_citation(doc_id: str, parent_path: list[str]) -> dict[str, str | None]:
    """Tra ve {law_name, citation_label, article_title} tu doc_id + parent_path
    (da co san dang "Dieu N. Ten dieu" / "Khoan M" tu domain_chunker.py) -
    dung de hien thi trich dan dang "Khoan M Dieu N <Ten van ban>" thay vi
    chunk_id ky thuat."""
    law_name = resolve_law_title(doc_id)
    khoan = next((p for p in parent_path if p.startswith("Khoản")), None)
    dieu_entry = next((p for p in parent_path if p.startswith("Điều")), None)

    dieu: str | None = None
    article_title: str | None = None
    if dieu_entry:
        m = _DIEU_RE.match(dieu_entry)
        if m:
            dieu = m.group(1)
            article_title = m.group(2) or None
        else:
            dieu = dieu_entry

    locator_parts = [p for p in (khoan, dieu) if p]
    citation_label = f"{' '.join(locator_parts)} {law_name}" if locator_parts else law_name

    return {"law_name": law_name, "citation_label": citation_label, "article_title": article_title}
