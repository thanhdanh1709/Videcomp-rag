"""Hệ thống Đo lường Chất lượng RAG Tự động (RAG Evaluation / Ragas / TruLens).

Triển khai đầy đủ 3 trụ cột chất lượng cốt lõi của RAG Triad:
1. Độ trung thực (Faithfulness): Câu trả lời có đúng với tài liệu không?
   - Đo tỷ lệ các luận điểm (factual claims) trong câu trả lời có bằng chứng chứng minh từ ngữ cảnh.
   - Công thức: Faithfulness = (|Luận điểm Hợp lệ|) / (|Tổng số luận điểm|).
2. Độ liên quan (Answer Relevance): Có trả lời đúng trọng tâm câu hỏi không?
   - Đánh giá mức độ trực diện, bao quát và bám sát câu hỏi người dùng, trừ điểm nếu câu trả lời
     né tránh, lan man hoặc thừa thãi.
   - Kết hợp LLM Rubric Evaluation + Semantic Similarity giữa câu hỏi và câu trả lời.
3. Mức độ trích dẫn (Context Precision): Bằng chứng tìm được có chuẩn xác không?
   - Đo lường tỷ lệ tín hiệu trên nhiễu (Signal-to-Noise Ratio) của các đoạn văn bản truy xuất.
   - Công thức: Context Precision@K theo thứ hạng (các đoạn văn bản hữu ích xếp càng cao thì điểm càng cao).
"""
from __future__ import annotations

import logging
import math
import re
from typing import Any

from pydantic import BaseModel, Field

from ..core.llm_provider import LLMProvider, get_llm_provider
from ..core.text_utils import simple_tokenize

logger = logging.getLogger(__name__)

# Stopwords tiếng Việt thường gặp để lọc nhiễu khi so khớp từ vựng
VIETNAMESE_STOPWORDS = {
    "là", "và", "của", "được", "có", "trong", "cho", "với", "các", "những",
    "một", "khi", "thì", "đã", "sẽ", "đang", "từ", "theo", "để", "về",
    "người", "như", "này", "đó", "ra", "vào", "lại", "thực", "hiện", "nếu",
    "chỉ", "cần", "ở", "tại", "qua", "do", "bởi", "lên", "xuống", "đến",
    "rằng", "vì", "vậy", "hay", "hoặc", "cũng", "rất", "nào", "gì", "sao",
    "ai", "đâu", "bao", "nhiêu", "thế", "nào", "đây", "kia", "mỗi", "mọi"
}


# ---------------------------------------------------------------------------
# Pydantic Schemas for RAG Triad Evaluation
# ---------------------------------------------------------------------------

class ClaimItem(BaseModel):
    claim: str
    status: str  # "supported" | "unsupported" | "insufficient"
    evidence_snippet: str = ""
    reasoning: str = ""


class FaithfulnessJudgement(BaseModel):
    claims: list[ClaimItem] = Field(default_factory=list)


class FaithfulnessResult(BaseModel):
    score: float = 1.0  # 0.0 -> 1.0
    total_claims: int = 0
    supported_claims: int = 0
    unsupported_claims: int = 0
    insufficient_claims: int = 0
    claims: list[ClaimItem] = Field(default_factory=list)
    verdict: str = "Hoàn toàn trung thực"


class AnswerRelevanceJudgement(BaseModel):
    score: float = Field(default=1.0, ge=0.0, le=1.0)
    reasoning: str = ""


class AnswerRelevanceResult(BaseModel):
    score: float = 1.0  # 0.0 -> 1.0
    rubric_score: float = 1.0
    semantic_similarity: float = 1.0
    reasoning: str = ""
    verdict: str = "Hoàn toàn đúng trọng tâm"


class ContextItem(BaseModel):
    rank: int
    chunk_id: str
    snippet: str
    is_relevant: bool
    reason: str = ""


class ContextPrecisionResult(BaseModel):
    score: float = 1.0  # 0.0 -> 1.0
    k: int = 0
    relevant_contexts_count: int = 0
    total_contexts_count: int = 0
    contexts: list[ContextItem] = Field(default_factory=list)
    verdict: str = "Trích dẫn cực kỳ chuẩn xác"


class RAGTriadResult(BaseModel):
    faithfulness: FaithfulnessResult
    answer_relevance: AnswerRelevanceResult
    context_precision: ContextPrecisionResult
    rag_triad_index: float  # (Faithfulness + AnswerRelevance + ContextPrecision) / 3
    grade: str  # "Xuất sắc (A+)" | "Tốt (A)" | "Khá (B)" | "Cần cải thiện (C)"


# ---------------------------------------------------------------------------
# Helper Tokenization & Lexical Functions
# ---------------------------------------------------------------------------

def _extract_content_tokens(text: str) -> set[str]:
    """Lấy tập từ vựng ý nghĩa (loại bỏ stopwords và ký tự đơn)."""
    tokens = simple_tokenize(text.lower())
    return {w for w in tokens if w not in VIETNAMESE_STOPWORDS and len(w) > 1}


def _split_into_claims_heuristic(text: str) -> list[str]:
    """Tách câu trả lời thành các mệnh đề khẳng định đơn lẻ."""
    text = re.sub(r"(\d+)\.\s+", r"\1_dot_ ", text)
    sentences = re.split(r"[\n\.\;\?\!]+", text)
    claims = []
    for s in sentences:
        s_clean = s.replace("_dot_", ".").strip()
        if len(s_clean) >= 15 and not s_clean.lower().startswith(("xin chào", "cảm ơn", "dưới đây là", "sau đây là")):
            claims.append(s_clean)
    return claims


def _heuristic_faithfulness_judgement(question: str, answer: str, contexts: list[str]) -> FaithfulnessJudgement:
    """Đánh giá trung thực bằng luật từ vựng ngữ nghĩa khi không gọi được LLM."""
    claims = _split_into_claims_heuristic(answer)
    if not claims and answer.strip():
        claims = [answer.strip()]

    all_ctx_text = " ".join(contexts).lower()
    ctx_content_tokens = _extract_content_tokens(all_ctx_text)

    # Tìm các số trong ngữ cảnh (vd: 12 tháng, 800.000)
    ctx_numbers = set(re.findall(r"\b\d+(?:[\.,]\d+)*\b", all_ctx_text))

    judged_claims: list[ClaimItem] = []
    for cl in claims:
        cl_tokens = _extract_content_tokens(cl)
        cl_numbers = set(re.findall(r"\b\d+(?:[\.,]\d+)*\b", cl))

        if not cl_tokens:
            judged_claims.append(
                ClaimItem(claim=cl, status="supported", evidence_snippet="", reasoning="Câu thông thường không chứa khẳng định thực thể.")
            )
            continue

        overlap = len(cl_tokens & ctx_content_tokens) / max(len(cl_tokens), 1)

        # Kiểm tra xung đột số liệu trực tiếp (vd ngữ cảnh có '12' nhưng câu trả lời lại khẳng định '1')
        number_conflict = False
        if cl_numbers and ctx_numbers:
            # Nếu câu trả lời có số hoàn toàn không xuất hiện trong ngữ cảnh
            unmatched_numbers = cl_numbers - ctx_numbers
            if unmatched_numbers:
                number_conflict = True

        if number_conflict and overlap < 0.6:
            status = "unsupported"
            reason = f"Xung đột số liệu ({', '.join(unmatched_numbers)}) không khớp với tài liệu."
        elif overlap >= 0.5:
            status = "supported"
            reason = f"Độ khớp thực thể và từ khóa đạt {overlap:.1%}."
        elif overlap >= 0.3:
            status = "insufficient"
            reason = f"Thông tin thiếu bằng chứng rõ ràng trong tài liệu (độ phủ {overlap:.1%})."
        else:
            status = "unsupported"
            reason = f"Không tìm thấy căn cứ đối chiếu trong ngữ cảnh (độ phủ {overlap:.1%})."

        # Trích dẫn snippet nếu có
        evidence_snippet = ""
        for c in contexts:
            c_toks = _extract_content_tokens(c)
            if len(cl_tokens & c_toks) >= 2:
                evidence_snippet = c[:180].strip() + "..."
                break

        judged_claims.append(
            ClaimItem(
                claim=cl,
                status=status,
                evidence_snippet=evidence_snippet,
                reasoning=reason,
            )
        )

    return FaithfulnessJudgement(claims=judged_claims)


def _heuristic_answer_relevance_judgement(question: str, answer: str) -> AnswerRelevanceJudgement:
    """Đo lường mức độ bám sát trọng tâm bằng độ phủ từ khóa thực thể."""
    q_tokens = _extract_content_tokens(question)
    a_tokens = _extract_content_tokens(answer)

    if not q_tokens:
        return AnswerRelevanceJudgement(score=1.0, reasoning="Câu hỏi không chứa từ khóa đặc thù.")

    overlap = len(q_tokens & a_tokens) / max(len(q_tokens), 1)

    # Nếu câu hỏi và câu trả lời hoàn toàn không chia sẻ từ khóa trọng tâm
    if overlap < 0.15:
        score = round(min(0.25, overlap * 1.5), 3)
        reason = f"Câu trả lời không nhắc đến trọng tâm câu hỏi (độ trùng khớp {overlap:.1%})."
    elif overlap < 0.4:
        score = round(0.4 + overlap * 0.6, 3)
        reason = f"Câu trả lời giải quyết một phần câu hỏi (độ trùng khớp {overlap:.1%})."
    else:
        score = round(min(1.0, 0.65 + overlap * 0.45), 3)
        reason = f"Câu trả lời bám sát trực diện trọng tâm câu hỏi (độ trùng khớp {overlap:.1%})."

    return AnswerRelevanceJudgement(score=score, reasoning=reason)


# ---------------------------------------------------------------------------
# 1. FAITHFULNESS EVALUATOR (Độ trung thực)
# ---------------------------------------------------------------------------

def evaluate_faithfulness(
    question: str,
    answer: str,
    contexts: list[str | dict[str, Any]],
    llm: LLMProvider | None = None,
) -> FaithfulnessResult:
    """Đo lường Độ trung thực (Faithfulness): Mọi khẳng định trong câu trả lời có căn cứ tài liệu hay không."""
    if not answer or not answer.strip():
        return FaithfulnessResult(
            score=0.0,
            total_claims=0,
            supported_claims=0,
            unsupported_claims=0,
            insufficient_claims=0,
            claims=[],
            verdict="Không có câu trả lời",
        )

    # Chuẩn hóa context texts
    context_texts: list[str] = []
    for c in contexts:
        if isinstance(c, dict):
            context_texts.append(str(c.get("text", c.get("snippet", ""))))
        else:
            context_texts.append(str(c))
    all_context_str = "\n---\n".join(t for t in context_texts if t.strip())

    if not all_context_str.strip():
        # Không có tài liệu nào được cung cấp
        claims_raw = _split_into_claims_heuristic(answer)
        claim_items = [
            ClaimItem(
                claim=cl,
                status="insufficient",
                reasoning="Không có bất kỳ tài liệu ngữ cảnh nào để đối chiếu.",
            )
            for cl in claims_raw
        ]
        return FaithfulnessResult(
            score=0.0,
            total_claims=len(claim_items),
            supported_claims=0,
            unsupported_claims=0,
            insufficient_claims=len(claim_items),
            claims=claim_items,
            verdict="Thiếu căn cứ (0 context)",
        )

    llm = llm or get_llm_provider()
    claims_list: list[ClaimItem] = []

    prompt = (
        "Bạn là Chuyên gia Thẩm định Chất lượng RAG (Ragas Faithfulness Judge).\n"
        "Nhiệm vụ: Phân tích xem các khẳng định trong CÂU TRẢ LỜI có được chứng thực bởi TÀI LIỆU NGỮ CẢNH hay không.\n\n"
        f"CÂU HỎI:\n{question}\n\n"
        f"TÀI LIỆU NGỮ CẢNH:\n{all_context_str[:6000]}\n\n"
        f"CÂU TRẢ LỜI CẦN THẨM ĐỊNH:\n{answer}\n\n"
        "YÊU CẦU ĐÁNH GIÁ:\n"
        "1. Tách câu trả lời thành 2 đến 5 mệnh đề/luận điểm khẳng định chính (claims).\n"
        "2. Với từng mệnh đề, xác định trạng thái:\n"
        "   - 'supported': Nếu thông tin được khẳng định rõ ràng hoặc suy luận hợp lý từ ngữ cảnh.\n"
        "   - 'unsupported': Nếu thông tin trái ngược hoặc mâu thuẫn trực tiếp với ngữ cảnh.\n"
        "   - 'insufficient': Nếu thông tin không có tài liệu nào trong ngữ cảnh đề cập đến (bịa đặt/hallucination bên ngoài).\n"
    )

    try:
        judgement = llm.structured_output(
            prompt,
            FaithfulnessJudgement,
            context={"question": question, "answer": answer, "contexts": context_texts},
        )
        if judgement and judgement.claims:
            claims_list = judgement.claims
    except Exception as ex:
        logger.warning(f"[evaluate_faithfulness] LLM judge failed ({ex}), using rule-based fallback.")

    # Fallback nếu LLM judge rỗng hoặc lỗi
    if not claims_list:
        fallback_res = _heuristic_faithfulness_judgement(question, answer, context_texts)
        claims_list = fallback_res.claims

    total = len(claims_list)
    supp = sum(1 for c in claims_list if c.status == "supported")
    unsupp = sum(1 for c in claims_list if c.status == "unsupported")
    insuff = sum(1 for c in claims_list if c.status == "insufficient")

    # Điểm Faithfulness chuẩn Ragas: tỷ lệ claims được chứng minh, phạt nặng mâu thuẫn
    if total == 0:
        score = 1.0
    else:
        score = max(0.0, (supp - 1.5 * unsupp) / total)
    score = round(min(1.0, max(0.0, score)), 3)

    if score >= 0.85:
        verdict = "Hoàn toàn trung thực (High Faithfulness)"
    elif score >= 0.65:
        verdict = "Đạt yêu cầu (Good Faithfulness)"
    elif score >= 0.4:
        verdict = "Cần kiểm chứng lại (Moderate Faithfulness)"
    else:
        verdict = "Nhiều điểm sai lệch / Ảo giác (Low Faithfulness)"

    return FaithfulnessResult(
        score=score,
        total_claims=total,
        supported_claims=supp,
        unsupported_claims=unsupp,
        insufficient_claims=insuff,
        claims=claims_list,
        verdict=verdict,
    )


# ---------------------------------------------------------------------------
# 2. ANSWER RELEVANCE EVALUATOR (Độ liên quan)
# ---------------------------------------------------------------------------

def evaluate_answer_relevance(
    question: str,
    answer: str,
    llm: LLMProvider | None = None,
) -> AnswerRelevanceResult:
    """Đo lường Độ liên quan (Answer Relevance): Câu trả lời có đúng trọng tâm câu hỏi hay không."""
    if not answer or not answer.strip():
        return AnswerRelevanceResult(
            score=0.0,
            rubric_score=0.0,
            semantic_similarity=0.0,
            reasoning="Câu trả lời trống rỗng.",
            verdict="Không liên quan",
        )

    # Tính toán Lexical Semantic Similarity giữa Question và Answer
    q_tokens = _extract_content_tokens(question)
    a_tokens = _extract_content_tokens(answer)
    token_overlap = len(q_tokens & a_tokens) / max(len(q_tokens), 1)

    llm = llm or get_llm_provider()
    prompt = (
        "Bạn là Chuyên gia Đánh giá Trọng tâm Câu hỏi (Ragas Answer Relevance Judge).\n"
        "Nhiệm vụ: Chấm điểm mức độ bám sát trọng tâm và giải quyết câu hỏi của CÂU TRẢ LỜI.\n\n"
        f"CÂU HỎI:\n{question}\n\n"
        f"CÂU TRẢ LỜI:\n{answer}\n\n"
        "TIÊU CHÍ CHẤM ĐIỂM (Thang 0.0 đến 1.0):\n"
        "- 1.0: Giải đáp trực diện, đầy đủ, hoàn toàn trúng đích, không thừa thãi.\n"
        "- 0.8: Trả lời đúng trọng tâm câu hỏi, có thể diễn giải hơi dài một chút.\n"
        "- 0.5: Trả lời chung chung, né tránh một phần câu hỏi hoặc chứa thông tin lạc đề.\n"
        "- 0.0 - 0.2: Hoàn toàn lạc đề, không trả lời những gì người dùng hỏi.\n"
    )

    rubric_score = 0.8
    reasoning = "Câu trả lời bám sát câu hỏi người dùng."

    try:
        judgement = llm.structured_output(
            prompt,
            AnswerRelevanceJudgement,
            context={"question": question, "answer": answer},
        )
        if judgement:
            rubric_score = float(judgement.score)
            reasoning = judgement.reasoning or reasoning
    except Exception as ex:
        logger.warning(f"[evaluate_answer_relevance] LLM judge failed ({ex}), using lexical estimation.")
        heur = _heuristic_answer_relevance_judgement(question, answer)
        rubric_score = heur.score
        reasoning = heur.reasoning

    # Kết hợp điểm rubric và độ phủ từ khóa
    final_score = round(0.75 * rubric_score + 0.25 * min(1.0, token_overlap * 1.4), 3)

    if final_score >= 0.85:
        verdict = "Hoàn toàn đúng trọng tâm (High Relevancy)"
    elif final_score >= 0.65:
        verdict = "Đúng trọng tâm (Good Relevancy)"
    elif final_score >= 0.4:
        verdict = "Chưa trực diện / Có ý phụ (Moderate Relevancy)"
    else:
        verdict = "Lạc đề / Né tránh (Low Relevancy)"

    return AnswerRelevanceResult(
        score=final_score,
        rubric_score=round(rubric_score, 3),
        semantic_similarity=round(min(1.0, token_overlap * 1.4), 3),
        reasoning=reasoning,
        verdict=verdict,
    )


# ---------------------------------------------------------------------------
# 3. CONTEXT PRECISION EVALUATOR (Mức độ trích dẫn / Độ chuẩn xác ngữ cảnh)
# ---------------------------------------------------------------------------

def evaluate_context_precision(
    question: str,
    contexts: list[dict[str, Any] | str],
    gold_chunk_ids: list[str] | None = None,
    answer: str | None = None,
    llm: LLMProvider | None = None,
) -> ContextPrecisionResult:
    """Đo lường Mức độ trích dẫn (Context Precision@K):

    Tỷ lệ tín hiệu trên nhiễu của các đoạn ngữ cảnh truy xuất.
    Các đoạn văn bản hữu ích xếp hạng càng cao thì điểm số càng cao.
    """
    if not contexts:
        return ContextPrecisionResult(
            score=0.0,
            k=0,
            relevant_contexts_count=0,
            total_contexts_count=0,
            contexts=[],
            verdict="Không có ngữ cảnh (0 context)",
        )

    gold_set = set(gold_chunk_ids or [])
    context_items: list[ContextItem] = []

    # Xác định tính liên quan (is_relevant) cho từng context
    for rank, item in enumerate(contexts, start=1):
        if isinstance(item, dict):
            cid = str(item.get("chunk_id", item.get("doc_id", f"ctx_{rank}")))
            snip = str(item.get("text", item.get("snippet", item.get("clause", ""))))
        else:
            cid = f"ctx_{rank}"
            snip = str(item)

        # 1. Nếu có gold_chunk_ids trong benchmark
        if gold_set:
            is_rel = (cid in gold_set)
            reason = "Khớp căn cứ chuẩn trong Benchmark" if is_rel else "Không nằm trong tập căn cứ chuẩn"
        else:
            # 2. Nếu đánh giá live query không có ground-truth: kiểm tra độ tương thích từ vựng & câu hỏi
            q_toks = _extract_content_tokens(question)
            s_toks = _extract_content_tokens(snip)
            overlap = len(q_toks & s_toks) / max(len(q_toks), 1)
            is_rel = overlap >= 0.25
            reason = f"Độ liên quan từ khóa {overlap:.1%}" if is_rel else "Không chứa thông tin trả lời"

        context_items.append(
            ContextItem(
                rank=rank,
                chunk_id=cid,
                snippet=snip[:150] + ("..." if len(snip) > 150 else ""),
                is_relevant=is_rel,
                reason=reason,
            )
        )

    # Tính Context Precision@K theo công thức chuẩn Ragas
    # CP@K = sum_{r=1}^K (Precision@r * v_r) / (Total relevant contexts in top K)
    total_rel = sum(1 for c in context_items if c.is_relevant)
    if total_rel == 0:
        score = 0.0
    else:
        cum_rel = 0
        precision_sum = 0.0
        for r, c in enumerate(context_items, start=1):
            if c.is_relevant:
                cum_rel += 1
                precision_at_r = cum_rel / r
                precision_sum += precision_at_r
        score = precision_sum / total_rel

    score = round(min(1.0, max(0.0, score)), 3)

    if score >= 0.85:
        verdict = "Trích dẫn cực kỳ chuẩn xác (High Signal, Low Noise)"
    elif score >= 0.65:
        verdict = "Đạt yêu cầu (Good Context Precision)"
    elif score >= 0.4:
        verdict = "Chứa nhiều tạp âm (Moderate Noise)"
    else:
        verdict = "Truy xuất lệch căn cứ (High Noise)"

    return ContextPrecisionResult(
        score=score,
        k=len(context_items),
        relevant_contexts_count=total_rel,
        total_contexts_count=len(context_items),
        contexts=context_items,
        verdict=verdict,
    )


# ---------------------------------------------------------------------------
# 4. COMBINED RAG TRIAD EVALUATION
# ---------------------------------------------------------------------------

def evaluate_rag_triad(
    question: str,
    answer: str,
    contexts: list[dict[str, Any] | str],
    gold_chunk_ids: list[str] | None = None,
    llm: LLMProvider | None = None,
) -> RAGTriadResult:
    """Đánh giá toàn diện bộ ba chất lượng RAG Triad cho 1 lượt hỏi đáp."""
    f_res = evaluate_faithfulness(question, answer, contexts, llm=llm)
    a_res = evaluate_answer_relevance(question, answer, llm=llm)
    c_res = evaluate_context_precision(question, contexts, gold_chunk_ids=gold_chunk_ids, answer=answer, llm=llm)

    rag_triad_index = round((f_res.score + a_res.score + c_res.score) / 3.0, 3)

    if rag_triad_index >= 0.85:
        grade = "Xuất sắc (A+)"
    elif rag_triad_index >= 0.70:
        grade = "Tốt (A)"
    elif rag_triad_index >= 0.50:
        grade = "Khá (B)"
    else:
        grade = "Cần cải thiện (C)"

    return RAGTriadResult(
        faithfulness=f_res,
        answer_relevance=a_res,
        context_precision=c_res,
        rag_triad_index=rag_triad_index,
        grade=grade,
    )
