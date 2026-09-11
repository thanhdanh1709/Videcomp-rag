"""LLM adapter interface (TaiLieuKyThuat Muc 3.(5): 'model providers duoc boc qua adapter').

Design goal: mot interface duy nhat `LLMProvider.structured_output(prompt, schema)`
de query_analyzer / query_decomposer / synthesizer / verifier khong phu thuoc
truc tiep vao mot nha cung cap LLM cu the. Khi chua co API key that, dung
MockLLMProvider (heuristic, khong goi mang) de pipeline chay end-to-end va
schema duoc kiem chung; thay bang AnthropicProvider (Claude that, qua SDK
chinh thuc) hoac OpenAICompatibleProvider (Ollama/vLLM) khi co provider that.
"""
from __future__ import annotations

import json
import re
from abc import ABC, abstractmethod
from typing import TypeVar

import httpx
from pydantic import BaseModel
from tenacity import retry, stop_after_attempt, wait_exponential

from .config import settings

T = TypeVar("T", bound=BaseModel)


class LLMProvider(ABC):
    """Adapter interface. Moi implementation phai tra ve instance dung schema."""

    @abstractmethod
    def structured_output(self, prompt: str, schema: type[T], *, context: dict | None = None) -> T:
        raise NotImplementedError


class MockLLMProvider(LLMProvider):
    """Heuristic, khong goi mang. Dung de scaffold/test pipeline khi chua co
    LLM_API_KEY that (xem HuongDanThucHien Buoc 1.4 va TaiLieuKyThuat 5.9)."""

    def structured_output(self, prompt: str, schema: type[T], *, context: dict | None = None) -> T:
        context = context or {}
        name = schema.__name__
        handler = getattr(self, f"_handle_{_to_snake(name)}", None)
        if handler is None:
            raise NotImplementedError(f"MockLLMProvider chua ho tro schema {name}")
        return handler(prompt, context)

    # -- QueryAnalysis --------------------------------------------------
    def _handle_query_analysis(self, prompt: str, context: dict):
        from ..services.heuristics import rule_based_query_analysis

        return rule_based_query_analysis(context.get("question", prompt))

    # -- QueryPlan --------------------------------------------------------
    def _handle_query_plan(self, prompt: str, context: dict):
        from ..services.heuristics import rule_based_decompose

        question = context.get("question", prompt)
        return rule_based_decompose(question, context.get("reasoning_type", "bridge"))

    # -- HopAnswer (short, evidence-grounded intermediate answer) ----------
    def _handle_hop_answer(self, prompt: str, context: dict):
        from ..schemas.answer import HopAnswer

        evidence_texts = context.get("evidence_texts", [])
        if not evidence_texts:
            return HopAnswer(answer="Không tìm thấy bằng chứng phù hợp.")
        snippet = evidence_texts[0][:240].strip()
        return HopAnswer(answer=snippet)

    # -- AnswerDraft --------------------------------------------------------
    def _handle_answer_draft(self, prompt: str, context: dict):
        from ..schemas.answer import AnswerDraft, Citation, Claim

        evidence_items = context.get("evidence_items", [])
        if not evidence_items:
            return AnswerDraft(
                answer_text="Chưa đủ bằng chứng để trả lời.",
                uncertainty_note="Không có evidence nào được truy hồi.",
            )
        sentences = []
        claims = []
        citations = []
        for item in evidence_items:
            snippet = item["text"][:200].strip()
            sentences.append(f"{snippet} {item['citation_key']}")
            claims.append(Claim(text=snippet, citations=[item["citation_key"]]))
            citations.append(
                Citation(
                    key=item["citation_key"],
                    chunk_id=item["chunk_id"],
                    source_url=item.get("source_url"),
                )
            )
        return AnswerDraft(
            answer_text=" ".join(sentences),
            claims=claims,
            citations=citations,
            evidence_ids_used=[item["chunk_id"] for item in evidence_items],
        )

    # -- ClaimVerification (single claim) -----------------------------------
    def _handle_claim_verification(self, prompt: str, context: dict):
        from ..schemas.answer import ClaimVerification

        claim_text = context.get("claim_text", "")
        evidence_texts = context.get("evidence_texts", [])
        supported = any(
            _token_overlap(claim_text, ev) > 0.2 for ev in evidence_texts
        )
        status = "supported" if supported else ("insufficient" if evidence_texts else "insufficient")
        return ClaimVerification(
            claim=claim_text,
            status=status,
            citations=context.get("citations", []),
        )


def _extract_and_validate_json(raw_text: str, schema: type[T]) -> T:
    """Lọc và làm sạch JSON từ đầu ra của các mô hình On-Premise / Local LLM.

    Tự động xử lý:
    - Thẻ suy nghĩ <think>...</think> (từ Qwen 2.5 / DeepSeek R1).
    - Khối markdown ```json ... ``` hoặc ``` ... ```.
    - Tìm kiếm cặp ngoặc {...} ngoài cùng nếu mô hình có kèm lời dẫn.
    """
    text = raw_text.strip()
    # 1. Loại bỏ khối thẻ suy nghĩ <think>...</think>
    text = re.sub(r"<think>[\s\S]*?</think>", "", text).strip()

    # 2. Bóc tách markdown code fence nếu có
    fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if fence_match:
        text = fence_match.group(1).strip()

    # 3. Tìm cặp ngoặc nhọn JSON ngoài cùng
    first_brace = text.find("{")
    last_brace = text.rfind("}")
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        text = text[first_brace : last_brace + 1]

    # 4. Xác thực qua Pydantic schema
    try:
        return schema.model_validate_json(text)
    except Exception:
        # Fallback: phân tích qua json.loads() rồi model_validate
        data = json.loads(text)
        return schema.model_validate(data)


class OpenAICompatibleProvider(LLMProvider):
    """Provider that ai gan real LLM (OpenAI-compatible /chat/completions, vd Ollama/vLLM).
    Yeu cau model tra ve JSON hop le theo schema; se validate bang Pydantic."""

    def __init__(self, base_url: str | None = None, api_key: str | None = None, model: str | None = None):
        self.base_url = (base_url or settings.llm_base_url).rstrip("/")
        self.api_key = api_key or settings.llm_api_key
        self.model = model or settings.llm_model

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=8))
    def structured_output(self, prompt: str, schema: type[T], *, context: dict | None = None) -> T:
        schema_json = schema.model_json_schema()
        system = (
            "Ban la mot API tra ve DUY NHAT mot JSON object hop le theo JSON schema sau, "
            "khong giai thich, khong markdown fence:\n" + json.dumps(schema_json, ensure_ascii=False)
        )
        with httpx.Client(base_url=self.base_url, timeout=90) as client:
            resp = client.post(
                "/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0,
                },
            )
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
        return _extract_and_validate_json(content, schema)


class OllamaProvider(LLMProvider):
    """Provider chuyên dụng kết nối trực tiếp với Ollama On-Premise.
    
    Phục vụ cho các cơ quan nhà nước, ngân hàng và bệnh viện triển khai 100% Private Cloud,
    hỗ trợ các mô hình: Qwen 2.5 (14B/32B), Vistral, PhoGPT, Llama 3.1.
    """

    def __init__(self, base_url: str | None = None, model: str | None = None):
        url = (base_url or settings.ollama_base_url).strip().rstrip("/")
        # Nếu người dùng nhập kèm /v1, ta lấy root base cho native API
        self.base_url = url[:-3] if url.endswith("/v1") else url
        self.model = model or settings.ollama_model

    @retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=1, min=1, max=4))
    def structured_output(self, prompt: str, schema: type[T], *, context: dict | None = None) -> T:
        schema_json = schema.model_json_schema()
        system = (
            "Ban la mot API he thong. Nhiem vu: tra ve DUY NHAT mot JSON object hop le theo schema JSON sau, "
            "tuyet doi khong dung markdown code block, khong kem loi giai thich ngoai JSON:\n"
            + json.dumps(schema_json, ensure_ascii=False)
        )

        # 1. Thử gọi qua API native của Ollama (/api/chat) với format: "json"
        try:
            with httpx.Client(base_url=self.base_url, timeout=120) as client:
                resp = client.post(
                    "/api/chat",
                    json={
                        "model": self.model,
                        "messages": [
                            {"role": "system", "content": system},
                            {"role": "user", "content": prompt},
                        ],
                        "format": "json",
                        "stream": False,
                        "options": {"temperature": 0},
                    },
                )
                if resp.status_code == 200:
                    raw_content = resp.json()["message"]["content"]
                    return _extract_and_validate_json(raw_content, schema)
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning("Ollama /api/chat loi (%s), thu fallback sang /v1/chat/completions", exc)

        # 2. Thử gọi qua endpoint tương thích OpenAI của Ollama (/v1/chat/completions)
        with httpx.Client(base_url=f"{self.base_url}/v1", timeout=120) as client:
            resp = client.post(
                "/chat/completions",
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0,
                    "response_format": {"type": "json_object"},
                },
            )
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            return _extract_and_validate_json(content, schema)


class VLLMProvider(LLMProvider):
    """Provider kết nối cụm máy chủ vLLM Private Cluster hiệu năng cao.
    
    Tối ưu cho On-Premise GPU servers (A100/H100/L40S) phục vụ số lượng lớn request đồng thời.
    """

    def __init__(self, base_url: str | None = None, model: str | None = None, api_key: str | None = None):
        url = (base_url or settings.vllm_base_url).strip().rstrip("/")
        self.base_url = url if url.endswith("/v1") else f"{url}/v1"
        self.model = model or settings.vllm_model
        self.api_key = api_key or settings.vllm_api_key or "local-vllm"

    @retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=1, min=1, max=4))
    def structured_output(self, prompt: str, schema: type[T], *, context: dict | None = None) -> T:
        schema_json = schema.model_json_schema()
        system = (
            "Ban la mot he thong AI tra ve DUY NHAT mot JSON object hop le theo schema JSON sau, "
            "khong them markdown code fence:\n" + json.dumps(schema_json, ensure_ascii=False)
        )
        headers = {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}
        with httpx.Client(base_url=self.base_url, timeout=120) as client:
            resp = client.post(
                "/chat/completions",
                headers=headers,
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0,
                    "response_format": {"type": "json_object"},
                },
            )
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            return _extract_and_validate_json(content, schema)


def fetch_ollama_models(base_url: str | None = None) -> list[str]:
    """Truy vấn danh sách mô hình đã tải về trên máy chủ Ollama cục bộ."""
    url = (base_url or settings.ollama_base_url).strip().rstrip("/")
    root_url = url[:-3] if url.endswith("/v1") else url
    try:
        with httpx.Client(timeout=5) as client:
            resp = client.get(f"{root_url}/api/tags")
            if resp.status_code == 200:
                data = resp.json()
                return [m.get("name") for m in data.get("models", []) if m.get("name")]
    except Exception:
        pass
    return []


def fetch_vllm_models(base_url: str | None = None, api_key: str | None = None) -> list[str]:
    """Truy vấn danh sách mô hình đang được phục vụ trên vLLM cluster."""
    url = (base_url or settings.vllm_base_url).strip().rstrip("/")
    v1_url = url if url.endswith("/v1") else f"{url}/v1"
    headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
    try:
        with httpx.Client(timeout=5) as client:
            resp = client.get(f"{v1_url}/models", headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                return [m.get("id") for m in data.get("data", []) if m.get("id")]
    except Exception:
        pass
    return []


_ANTHROPIC_SYSTEM_PROMPTS: dict[str, str] = {
    "QueryAnalysis": (
        "Ban la Query Analyzer trong he thong RAG multi-hop tieng Viet chuyen nganh "
        "(phap luat/y te). Phan loai cau hoi truoc khi quyet dinh co can decomposition "
        "hay khong. estimated_hops phai nam trong [1,4]."
    ),
    "QueryPlan": (
        "Ban la Query Decomposer trong he thong RAG multi-hop tieng Viet chuyen nganh "
        "(phap luat/y te). Phan ra cau hoi phuc hop thanh cac sub-question retrieval-oriented, "
        "ngan gon, ro rang, co the truy hoi doc lap. Neu sub-question sau phu thuoc ket qua "
        "cua sub-question truoc (id vd 'h1'), dat depends_on=['h1'] va dung placeholder dang "
        "{{h1.answer}} trong noi dung cau hoi hoac trong truong bind. Khong duoc tao cycle. "
        "Khong xuat chain-of-thought dai, chi xuat cac truong theo dung schema."
    ),
    "HopAnswer": (
        "Ban tra loi ngan gon (1-2 cau), CHI dua tren evidence duoc cung cap trong boi canh "
        "(evidence-grounded), khong dung kien thuc ngoai. Neu evidence khong du de tra loi, "
        "noi ro 'khong du bang chung' thay vi doan."
    ),
    "AnswerDraft": (
        "Ban la Answer Synthesizer trong he thong RAG multi-hop. Chi duoc dung bang chung "
        "trong evidence bundle duoc cung cap trong boi canh, khong duoc dung kien thuc ngoai. "
        "Moi menh de quan trong (claim) phai co it nhat mot citation_key dang [E1], [E2]... "
        "trung voi citation_key trong evidence_items. Neu thieu du lieu de tra loi day du, "
        "ghi ro trong uncertainty_note thay vi bia dat.\n\n"
        "Van phong cua answer_text: viet nhu mot chuyen gia tu van dang giai thich truc tiep "
        "cho nguoi hoi, khong phai nhu mot bao cao may moc. Cu the:\n"
        "- Vao thang van de, tra loi cau hoi truoc, roi moi giai thich/dan chieu can cu.\n"
        "- Dung cau van tu nhien, mach lac, noi lien nhau nhu van noi chuyen chuyen nghiep; "
        "tranh liet ke gach dau dong may moc hoac lap cum tu rap khuon (vd luon mo dau bang "
        "'Theo quy dinh...') khi khong can thiet.\n"
        "- Neu cau tra loi co nhieu y, dung cau chuyen y tu nhien ('Ben canh do', 'Tuy nhien', "
        "'Can luu y la'...) thay vi danh so kho khan, tru khi noi dung thuc su la mot danh sach "
        "cac buoc/dieu kien roi rac thi co the dung danh sach cho de doc.\n"
        "- Giu giong dieu lich su, ro rang, tu tin nhung khong xa cach; co the them mot cau "
        "luu y/goi mo ngan o cuoi neu phu hop (vd nhac nguoi hoi kiem tra them mot yeu to lien "
        "quan), nhung khong duoc bia them thong tin ngoai evidence.\n"
        "- Citation [Ex] van phai dat dung vi tri sau menh de ma no chung minh, nhung khong de "
        "citation lam gay cau van - dat gon o cuoi cau hoac cuoi menh de.\n"
        "- Do dai vua phai: du de tra loi ro rang, khong dai dong khong can thiet."
    ),
    "ClaimVerification": (
        "Ban la Grounding Verifier trong he thong RAG. Chi danh gia claim dua tren evidence "
        "duoc cung cap trong boi canh, khong duoc bia bang chung moi. Tra ve status: "
        "'supported' neu evidence ung ho ro rang claim, 'unsupported' neu evidence mau thuan "
        "claim, 'insufficient' neu khong du evidence de ket luan."
    ),
    "BenchmarkCandidateDraft": (
        "Ban la annotator ho tro xay dung benchmark multi-hop QA tieng Viet chuyen nganh "
        "(HuongDanThucHien Buoc 13). Ban duoc cung cap mot nhom doan van (chunk), moi doan "
        "co chunk_id va text. Nhiem vu: neu CO THE, de xuat MOT cau hoi tu nhien can ket hop "
        "thong tin tu it nhat hai chunk khac nhau trong nhom de tra loi day du (multi-hop). "
        "QUY TAC BAT BUOC: (1) supporting_evidence.chunk_id va subquestions[].id... phai su "
        "dung DUNG chunk_id da cho, khong duoc bia chunk_id moi; (2) moi hop trong subquestions "
        "phai anh xa duoc toi it nhat mot chunk_id trong supporting_evidence cung hop_id; "
        "(3) hop_count phai khop so luong subquestions va nam trong [2,4] (chi tra ve hop_count=1 "
        "neu that su khong the tao cau hoi multi-hop tu nhom nay); (4) answer phai la cau tra loi "
        "ngan, chinh xac, suy ra duoc tu chinh cac chunk da cho, khong dung kien thuc ngoai; "
        "(5) reasoning_type la mot trong: bridge, intersection, comparison, temporal_version, "
        "rule_exception, other."
    ),
}


class AnthropicProvider(LLMProvider):
    """Provider goi Claude that qua Anthropic SDK chinh thuc (khong dung shim
    kieu OpenAI-compatible). Dung client.messages.parse() de ep JSON dung theo
    Pydantic schema (QueryAnalysis/QueryPlan/HopAnswer/AnswerDraft/
    ClaimVerification) - xem python/claude-api/tool-use.md muc Structured
    Outputs trong skill claude-api."""

    def __init__(self, api_key: str | None = None, model: str | None = None):
        import anthropic

        key = api_key or settings.anthropic_api_key
        if not key:
            raise RuntimeError("ANTHROPIC_API_KEY chua duoc cau hinh trong .env")
        self._client = anthropic.Anthropic(api_key=key)
        self.model = model or settings.llm_model

    def structured_output(self, prompt: str, schema: type[T], *, context: dict | None = None) -> T:
        context = context or {}
        system = _ANTHROPIC_SYSTEM_PROMPTS.get(
            schema.__name__, "Tra ve du lieu hop le theo dung schema duoc yeu cau."
        )
        user_content = prompt
        extra_context = {k: v for k, v in context.items() if k != "question"}
        if extra_context:
            user_content += "\n\nBối cảnh bổ sung (JSON):\n" + json.dumps(extra_context, ensure_ascii=False)

        try:
            response = self._client.messages.parse(
                model=self.model,
                max_tokens=16000,
                system=system,
                messages=[{"role": "user", "content": user_content}],
                output_format=schema,
            )
            if response.stop_reason == "refusal":
                raise RuntimeError(f"Claude tu choi tra loi cho schema {schema.__name__}")
            return response.parsed_output
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning(
                "Anthropic API gap loi (%s), tu dong fallback sang MockLLMProvider tren du lieu truy hoi that.",
                exc,
            )
            return MockLLMProvider().structured_output(prompt, schema, context=context)


def get_llm_provider() -> LLMProvider:
    provider = (settings.llm_provider or "mock").lower()
    if provider == "mock":
        return MockLLMProvider()
    if provider == "anthropic":
        return AnthropicProvider()
    if provider == "ollama":
        return OllamaProvider()
    if provider == "vllm":
        return VLLMProvider()
    return OpenAICompatibleProvider()


def _to_snake(name: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", "_", name).lower()


def _token_overlap(a: str, b: str) -> float:
    ta = set(re.findall(r"\w+", a.lower()))
    tb = set(re.findall(r"\w+", b.lower()))
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta)
