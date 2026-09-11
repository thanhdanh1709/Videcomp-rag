"""Dịch vụ Lọc và Làm mờ Dữ liệu Nhạy cảm (PII Masking).

Tuân thủ Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân tại Việt Nam.
Tự động nhận diện và làm mờ các thông tin cá nhân:
1. Số CCCD (12 số) và CMND (9 số).
2. Số điện thoại di động Việt Nam (đầu số 03, 05, 07, 08, 09, +84).
3. Biển số xe cơ giới (ô tô, xe máy theo thông tư BCA).
4. Mã số thuế cá nhân / doanh nghiệp (MST 10 số hoặc 13 số).
5. Hồ sơ bệnh án cá nhân, mã bệnh nhân (BA-, HSBA-, BN-).
6. Địa chỉ email cá nhân.
"""
from __future__ import annotations

import re
from typing import Any
from pydantic import BaseModel, Field

from ..core.config import settings


class PIIEntity(BaseModel):
    pii_type: str  # "cccd" | "phone" | "license_plate" | "tax_id" | "medical_record" | "email"
    original_value: str
    masked_value: str
    start: int
    end: int
    label: str


class PIIMaskingResult(BaseModel):
    masked_text: str
    detected_entities: list[PIIEntity] = Field(default_factory=list)
    has_pii: bool = False
    entity_counts: dict[str, int] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Các mẫu Biểu thức Chính quy (Regex) đặc thù cho Việt Nam
# ---------------------------------------------------------------------------

# 1. Số CCCD (12 chữ số) và CMND cũ (9 chữ số)
# Thường đi kèm các từ khóa tiền tố hoặc đứng độc lập
RE_CCCD = re.compile(
    r"(?i)(?:(?:số\s+)?(?:cccd|cmnd|căn\s+cước(?:\s+công\s+dân)?|chứng\s+minh\s+nhân\s+dân|định\s+danh(?:\s+cá\s+nhân)?)\s*[:\s#\-]*)"
    r"(\d{12}|\d{9})\b"
    r"|\b(\d{12})\b"  # 12 số đứng độc lập
)

# 2. Số điện thoại Việt Nam (03x, 05x, 07x, 08x, 09x, hoặc +84)
# Cho phép dấu chấm, gạch ngang, khoảng trắng giữa các cụm số
RE_PHONE = re.compile(
    r"(?i)(?:(?:sđt|sdt|đt|dt|tel|phone|điện\s+thoại|hotline|liên\s+hệ)\s*[:\s#\-]*)"
    r"((?:\+84|84|0)(?:3|5|7|8|9)(?:[\s\.\-]?\d){8})\b"
    r"|\b((?:\+84|0)(?:3|5|7|8|9)(?:[\s\.\-]?\d){8})\b"
)

# 3. Biển số xe Việt Nam
# Ô tô: 29A-123.45, 30G-999.99, 51F-1234
# Xe máy: 29-A1 123.45, 43-B1-123.45, 59-X2 678.90
RE_LICENSE_PLATE = re.compile(
    r"(?i)(?:(?:biển\s+(?:số\s+)?(?:xe|kiểm\s+soát)|bsx|bks)\s*[:\s#\-]*)"
    r"(\b\d{2}[A-Z\d]{1,2}[-\s]?\d{3,5}(?:\.\d{2})?\b)"
    r"|\b(\d{2}[A-Z][-\s]?\d{3}\.\d{2})\b"  # 29A-123.45 hoặc 51F 123.45
    r"|\b(\d{2}-[A-Z]\d[-\s]?\d{3}\.\d{2})\b"  # 29-A1 123.45
    r"|\b(\d{2}[A-Z]\d[-\s]?\d{4,5})\b"  # 29B1-12345
)

# 4. Mã số thuế cá nhân / doanh nghiệp (10 số hoặc 10 số - 3 số chi nhánh)
RE_TAX_ID = re.compile(
    r"(?i)(?:(?:mã\s+số\s+thuế|mst|tax\s+code|mã\s+đơn\s+vị)(?:\s+(?:cá\s+nhân|doanh\s+nghiệp|cty|công\s+ty))?\s*[:\s#\-]*)"
    r"(\d{10}(?:-\d{3})?)\b"
    r"|\b(\d{10}-\d{3})\b"
)

# 5. Hồ sơ bệnh án cá nhân, Mã bệnh nhân
RE_MEDICAL_RECORD = re.compile(
    r"(?i)(?:(?:hồ\s+sơ\s+bệnh\s+án|số\s+bệnh\s+án|mã\s+bệnh\s+nhân|hsba|ba|bn)\s*[:\s#\-]*)"
    r"([A-Z0-9\-\/]{4,20})\b"
    r"|\b(BA-\d{4,10})\b"
    r"|\b(HSBA-\d{4,10})\b"
    r"|\b(BN-\d{4,10})\b"
)

# 6. Email cá nhân
RE_EMAIL = re.compile(
    r"\b([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)\b"
)


def _mask_cccd_val(val: str) -> str:
    cleaned = re.sub(r"\D", "", val)
    if len(cleaned) >= 4:
        return f"*******{cleaned[-4:]}"
    return "********"


def _mask_phone_val(val: str) -> str:
    cleaned = re.sub(r"\D", "", val)
    if len(cleaned) >= 3:
        return f"*******{cleaned[-3:]}"
    return "**********"


def _mask_license_val(val: str) -> str:
    val = val.strip()
    prefix = val[:3] if len(val) >= 3 else val
    return f"{prefix}-*****"


def _mask_tax_val(val: str) -> str:
    cleaned = val.strip()
    if len(cleaned) >= 4:
        return f"******{cleaned[-4:]}"
    return "**********"


def _mask_medical_val(val: str) -> str:
    val = val.strip()
    prefix = val.split("-")[0] if "-" in val else "BA"
    return f"{prefix}-*****"


def _mask_email_val(val: str) -> str:
    parts = val.split("@")
    if len(parts) == 2:
        name, domain = parts
        masked_name = name[0] + "***" if len(name) > 0 else "***"
        return f"{masked_name}@{domain}"
    return "***@email.com"


def mask_pii(
    text: str,
    enabled_types: list[str] | None = None,
) -> PIIMaskingResult:
    """Nhận diện và làm mờ tất cả thông tin PII theo cấu hình và quy chuẩn Việt Nam."""
    if not text:
        return PIIMaskingResult(masked_text="", detected_entities=[], has_pii=False, entity_counts={})

    # Nếu cấu hình hệ thống tắt PII masking toàn cục
    if not settings.enable_pii_masking:
        return PIIMaskingResult(masked_text=text, detected_entities=[], has_pii=False, entity_counts={})

    types_to_check = set(enabled_types or ["cccd", "phone", "license_plate", "tax_id", "medical_record", "email"])

    # Danh sách các span phát hiện (start, end, pii_type, original, masked, label)
    spans: list[dict[str, Any]] = []

    # 1. CCCD / CMND
    if "cccd" in types_to_check and settings.pii_mask_cccd:
        for m in RE_CCCD.finditer(text):
            val = m.group(1) or m.group(2)
            if val:
                # Loại trừ các số năm (vd 20242025...) hoặc số điện thoại 10 số không phải 12/9
                start = m.start(1) if m.group(1) else m.start(2)
                end = m.end(1) if m.group(1) else m.end(2)
                spans.append({
                    "start": start,
                    "end": end,
                    "type": "cccd",
                    "original": val,
                    "masked": f"[CCCD: {_mask_cccd_val(val)}]",
                    "label": "Số CCCD / CMND",
                })

    # 2. Số điện thoại
    if "phone" in types_to_check and settings.pii_mask_phone:
        for m in RE_PHONE.finditer(text):
            val = m.group(1) or m.group(2)
            if val:
                start = m.start(1) if m.group(1) else m.start(2)
                end = m.end(1) if m.group(1) else m.end(2)
                spans.append({
                    "start": start,
                    "end": end,
                    "type": "phone",
                    "original": val,
                    "masked": f"[SĐT: {_mask_phone_val(val)}]",
                    "label": "Số điện thoại",
                })

    # 3. Biển số xe
    if "license_plate" in types_to_check and settings.pii_mask_license_plate:
        for m in RE_LICENSE_PLATE.finditer(text):
            val = m.group(1) or m.group(2) or m.group(3) or m.group(4)
            if val:
                start = m.start(1) if m.group(1) else (m.start(2) if m.group(2) else (m.start(3) if m.group(3) else m.start(4)))
                end = m.end(1) if m.group(1) else (m.end(2) if m.group(2) else (m.end(3) if m.group(3) else m.end(4)))
                spans.append({
                    "start": start,
                    "end": end,
                    "type": "license_plate",
                    "original": val,
                    "masked": f"[BIỂN SỐ XE: {_mask_license_val(val)}]",
                    "label": "Biển số xe cơ giới",
                })

    # 4. Mã số thuế
    if "tax_id" in types_to_check and settings.pii_mask_tax_id:
        for m in RE_TAX_ID.finditer(text):
            val = m.group(1) or m.group(2)
            if val:
                start = m.start(1) if m.group(1) else m.start(2)
                end = m.end(1) if m.group(1) else m.end(2)
                spans.append({
                    "start": start,
                    "end": end,
                    "type": "tax_id",
                    "original": val,
                    "masked": f"[MST: {_mask_tax_val(val)}]",
                    "label": "Mã số thuế",
                })

    # 5. Hồ sơ bệnh án
    if "medical_record" in types_to_check and settings.pii_mask_medical_record:
        for m in RE_MEDICAL_RECORD.finditer(text):
            val = m.group(1) or m.group(2) or m.group(3) or m.group(4)
            if val:
                start = m.start(1) if m.group(1) else (m.start(2) if m.group(2) else (m.start(3) if m.group(3) else m.start(4)))
                end = m.end(1) if m.group(1) else (m.end(2) if m.group(2) else (m.end(3) if m.group(3) else m.end(4)))
                spans.append({
                    "start": start,
                    "end": end,
                    "type": "medical_record",
                    "original": val,
                    "masked": f"[MÃ BỆNH ÁN: {_mask_medical_val(val)}]",
                    "label": "Hồ sơ bệnh án cá nhân",
                })

    # 6. Email
    if "email" in types_to_check and settings.pii_mask_email:
        for m in RE_EMAIL.finditer(text):
            val = m.group(1)
            if val:
                start = m.start(1)
                end = m.end(1)
                spans.append({
                    "start": start,
                    "end": end,
                    "type": "email",
                    "original": val,
                    "masked": f"[EMAIL: {_mask_email_val(val)}]",
                    "label": "Địa chỉ Email",
                })

    # Sắp xếp các span theo thứ tự vị trí bắt đầu
    spans.sort(key=lambda s: s["start"])

    # Khử trùng lặp (tránh các span lồng nhau đè lên nhau)
    non_overlapping_spans = []
    last_end = -1
    for s in spans:
        if s["start"] >= last_end:
            non_overlapping_spans.append(s)
            last_end = s["end"]

    # Tạo chuỗi masked text bằng cách ghép từ cuối lên đầu
    chars = list(text)
    detected_entities: list[PIIEntity] = []
    counts: dict[str, int] = {}

    for s in sorted(non_overlapping_spans, key=lambda x: x["start"], reverse=True):
        chars[s["start"] : s["end"]] = list(s["masked"])
        detected_entities.append(
            PIIEntity(
                pii_type=s["type"],
                original_value=s["original"],
                masked_value=s["masked"],
                start=s["start"],
                end=s["end"],
                label=s["label"],
            )
        )
        counts[s["type"]] = counts.get(s["type"], 0) + 1

    # Đảo lại thứ tự hiển thị theo chiều văn bản từ đầu đến cuối
    detected_entities.reverse()

    result_text = "".join(chars)
    return PIIMaskingResult(
        masked_text=result_text,
        detected_entities=detected_entities,
        has_pii=len(detected_entities) > 0,
        entity_counts=counts,
    )
