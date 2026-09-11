"""Chuan hoa Unicode va tokenization tieng Viet dung chung.

HuongDanThucHien Buoc 3: "Unicode NFC". Su dung underthesea.word_tokenize
khi co san; fallback ve regex tokenizer de khong phu thuoc cung vao mot thu
vien khi moi truong offline (TaiLieuKyThuat 2: 'regex, underthesea/pyvi tuy
thu nghiem').
"""
from __future__ import annotations

import re
import unicodedata

_WORD_RE = re.compile(r"[^\W\d_]+|\d+", re.UNICODE)

_VIETNAMESE_VOWELS = set(
    "aàáảãạăằắẳẵặâầấẩẫậeèéẻẽẹêềếểễệiìíỉĩịoòóỏõọôồốổỗộơờớởỡợuùúủũụưừứửữựyỳýỷỹỵ"
)


def normalize_unicode(text: str) -> str:
    return unicodedata.normalize("NFC", text)


def _is_broken_syllable(token: str) -> bool:
    """True neu token la mot manh vo am tiet do PDF chen khoang trang giua
    mot tu (vd "ngh ĩa" thay vi "nghĩa", "b ản" thay vi "bản") - xem README
    muc Corpus, diem 3. Moi am tiet tieng Viet BAT BUOC co nguyen am nen mot
    token thuan chu thuong, khong dau cau, dai <=3 va KHONG chua nguyen am
    nao la bat kha thi ve mat ngu am -> chac chan la manh vo, khong phai tu
    that (chu khong dung cho token viet hoa/so La Ma nhu "XV", "IV" hay viet
    tat nhu "TP." - nhung truong hop nay luon co chu hoa hoac dau cau kem
    theo nen bi loai boi dieu kien isalpha()/islower())."""
    if not token.isalpha() or not token.islower():
        return False
    if len(token) > 3:
        return False
    return not (set(token) & _VIETNAMESE_VOWELS)


def repair_split_syllables(text: str) -> str:
    """Noi lai cac am tiet bi PDF-extraction chen khoang trang giua tu (loi
    thuc te phat hien tren PDF Cong bao Chinh phu - xem README muc Corpus,
    diem 3: "ngh ĩa vụ" thay vi "nghĩa vụ"). Khong thay doi ranh gioi dong
    (giu nguyen \\n) vi Chuong/Dieu/Khoan duoc tach theo dong."""
    lines = text.split("\n")
    repaired_lines = []
    for line in lines:
        tokens = line.split(" ")
        result: list[str] = []
        pending = ""
        for tok in tokens:
            if _is_broken_syllable(tok):
                pending += tok
                continue
            if pending:
                result.append(pending + tok)
                pending = ""
            else:
                result.append(tok)
        if pending:
            result.append(pending)
        repaired_lines.append(" ".join(result))
    return "\n".join(repaired_lines)


def simple_tokenize(text: str) -> list[str]:
    return _WORD_RE.findall(text.lower())


def tokenize(text: str) -> list[str]:
    try:
        from underthesea import word_tokenize

        tokens = word_tokenize(text.lower())
        return [t for t in tokens if t.strip()]
    except Exception:
        return simple_tokenize(text)


def approx_token_count(text: str) -> int:
    """Uoc luong nhanh so 'token' de chunk theo target_tokens ma khong can
    goi tokenizer cua LLM provider cu the."""
    return max(1, len(simple_tokenize(text)))
