# Bàn giao — đang debug videcomp_full sau khi sửa bug evidence_memory

## Việc đã xong (an toàn, không cần làm lại)

1. **Mở rộng corpus pháp luật lên 38 văn bản / 17001 chunk** (v4-v8, xem
   README mục "Corpus"). Index `data/indices/{bm25_legal_real_all,legal_real_all_v1}`
   đã build lại, `pytest -q` 36/36 pass.
2. **Cải tiến sinh benchmark**: `_group_chunks_by_topic` (BM25) trong
   `backend/app/services/benchmark_generator.py` + cờ `--group_strategy` trong
   `scripts/propose_benchmark_candidates.py`. Đã sinh 20 câu hỏi thật ở
   `data/benchmark/candidates_real_legal_v7v8_draft.jsonl` (20/20 hợp lệ, vẫn
   là **draft chưa người duyệt**).
3. **`scripts/evaluate_all.py`**: thêm `--bm25_dir`/`--vector_dir` để trỏ vào
   index thật thay vì index demo mặc định.
4. **Bug #1 đã sửa**: `backend/app/core/llm_provider.py` dòng ~228,
   `max_tokens` của `AnthropicProvider.structured_output` từ `4096` →
   `16000` (JSON bị cắt giữa chừng khi câu trả lời dài + adaptive thinking).
5. **Bug #2 đã sửa**: `backend/app/services/evidence_memory.py`,
   `evidence_for_citations()` — citation_key lưu trong memory có dạng
   `"[E1]"` (kèm ngoặc) nhưng Claude trả về `claim.citations`/
   `ClaimVerification.citations` KHÔNG kèm ngoặc (`"E1"`), nên so khớp
   nguyên văn luôn thất bại → verifier luôn coi MỌI claim là "insufficient"
   bất kể có bằng chứng hợp lệ hay không → luôn tốn 1 vòng corrective
   retrieval vô ích. Đã sửa bằng cách chuẩn hóa (bỏ `[]`, upper-case) trước
   khi so khớp. **Đã verify bằng tay**: cùng 1 câu hỏi, trước khi sửa
   `status: "fail"`, `supported_claim_rate: 0.0`; sau khi sửa `status: "pass"`,
   `supported_claim_rate: 1.0`, `corrective_rounds_used: 0`.
6. `pytest -q` vẫn 36/36 pass sau cả 2 bug fix.

## Kết quả ablation 20 câu × 6 mode (dùng Claude thật, Sonnet 5)

5/6 mode **đã chạy xong và KẾT QUẢ VẪN HỢP LỆ** (không dùng
`verify_and_correct` nên không bị ảnh hưởng bởi bug #2):

- `experiments/results/dense_rag_v7v8.json` ✅
- `experiments/results/hybrid_rag_v7v8.json` ✅ (chạy sau bug fix #1)
- `experiments/results/hybrid_rerank_v7v8.json` ✅
- `experiments/results/decomp_independent_v7v8.json` ✅
- `experiments/results/decomp_dependency_v7v8.json` ✅

Số liệu các mode này đã đưa vào README mục "Ablation ở quy mô corpus thật"
— **giữ nguyên, không cần chạy lại**.

## ⚠️ Việc CHƯA xong — cần làm tiếp

**`experiments/results/videcomp_full_v7v8.json` hiện tại là KẾT QUẢ CŨ, SAI**
(chạy TRƯỚC khi sửa bug #2 — mọi câu đều bị tốn corrective retrieval oan nên
recall/citation của mode này trong README **không đáng tin**, cần chạy lại).

Đã thử chạy lại `videcomp_full` sau khi sửa bug #2:

```bash
python scripts/evaluate_all.py --mode videcomp_full \
  --dataset data/benchmark/candidates_real_legal_v7v8_draft.jsonl \
  --bm25_dir data/indices/bm25_legal_real_all --vector_dir data/indices/legal_real_all_v1 \
  --out experiments/results/videcomp_full_v7v8.json
```

→ **Crash sau ~9 phút** với lỗi:
```
anthropic.BadRequestError: Error code: 400 - {'type': 'error', 'error':
{'type': 'invalid_request_error', 'message': 'Invalid request data'},
'request_id': 'req_011CeqiNaiUCqCv6eZT3zwC9'}
```
Traceback dẫn tới `hop_executor.py:56 answer_hop()` →
`llm_provider.py:226 structured_output()`. Thông báo lỗi từ API chung chung
("Invalid request data"), chưa rõ nguyên nhân cụ thể — cần điều tra tiếp,
KHÔNG PHẢI bug #1/#2 ở trên (2 bug đó đã fix và verify riêng).

**Đã bắt đầu debug bằng cách chạy từng câu một** (script tạm, không lưu trong
repo) để tìm đúng câu gây lỗi:

```python
import sys
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutTimeout
sys.path.insert(0, '.')
from backend.app.schemas.benchmark import BenchmarkItem
from backend.app.services.pipeline import run_qa
from scripts.run_qa import load_retriever

items = []
with open('data/benchmark/candidates_real_legal_v7v8_draft.jsonl', encoding='utf-8') as f:
    for line in f:
        if line.strip():
            items.append(BenchmarkItem.model_validate_json(line))

retriever = load_retriever('legal', bm25_dir='data/indices/bm25_legal_real_all', vector_dir='data/indices/legal_real_all_v1')

ex = ThreadPoolExecutor(max_workers=1)
for item in items:
    fut = ex.submit(run_qa, item.question, item.domain, mode='videcomp_full', retriever=retriever)
    try:
        result = fut.result(timeout=200)
        print(item.id, 'OK', flush=True)
    except FutTimeout:
        print(item.id, 'TIMEOUT', flush=True)
    except Exception as e:
        print(item.id, 'FAIL:', type(e).__name__, str(e)[:300], flush=True)
```

Chạy bằng `python -u <script>.py` (bắt buộc `-u` hoặc `flush=True` — quên
flush đã khiến 1 lần chạy trước tưởng "treo" suốt 29 phút nhưng thực ra chỉ
là stdout bị buffer khi ghi ra file).

**Tiến độ dừng lại ở**: `MH-CAND-0000 OK` (câu 1/20 chạy được, chưa kịp biết
câu nào crash). Cần chạy tiếp từ `MH-CAND-0001` trở đi.

### Gợi ý điều tra tiếp khi quay lại

1. Chạy lại script debug ở trên (từ đầu hoặc chỉ với `items[1:]`) để xác định
   đúng `id` gây lỗi 400.
2. Khi bắt được exception, in thêm `e.body` / `getattr(e, "response", None)`
   để lấy chi tiết đầy đủ hơn "Invalid request data" (SDK thường có thêm
   field trong body nhưng traceback gốc chỉ in `e.message`).
3. Nghi vấn đáng kiểm tra trước:
   - Số hop lớn (3-4 hop) làm evidence bundle tích lũy rất dài qua nhiều lần
     gọi `structured_output` trong cùng 1 câu — có thể vượt giới hạn nào đó
     của request (context quá dài, hoặc field nào đó vượt max length).
   - `max_tokens=16000` (vừa tăng ở bug #1) — kiểm tra xem có câu nào request
     tổng input+output vượt giới hạn model cho phép ở chế độ non-streaming
     (Sonnet 5 hỗ trợ tới 128K nhưng SDK khuyến nghị streaming khi
     `max_tokens` lớn để tránh timeout — thử hạ `max_tokens` xuống 8000 xem
     lỗi còn không, để phân biệt "do giá trị max_tokens" hay "do nội dung
     request").
   - Ký tự đặc biệt/encoding lạ trong 1 chunk cụ thể nào đó của corpus mới
     (v6/v7/v8) làm hỏng JSON request.
4. Sau khi sửa xong, chạy lại **toàn bộ** `evaluate_all.py --mode videcomp_full`
   (lệnh ở trên) để ghi đè `experiments/results/videcomp_full_v7v8.json`
   bằng kết quả đúng.
5. Cập nhật lại dòng Q3 (`videcomp_full`) trong bảng ablation ở README (mục
   "Ablation ở quy mô corpus thật") bằng số liệu mới — **số liệu Q3 hiện tại
   trong README là số liệu CŨ/SAI, cần thay**.

## File liên quan

- `data/benchmark/candidates_real_legal_v7v8_draft.jsonl` — 20 câu benchmark
  dùng để chạy ablation (vẫn `annotation_status="draft"`, chưa người duyệt).
- `experiments/results/*_v7v8.json` — kết quả từng mode (5/6 hợp lệ, 1
  (`videcomp_full`) cần chạy lại như trên).
- `backend/app/services/evidence_memory.py`, `backend/app/core/llm_provider.py`
  — 2 file đã sửa bug, không cần đụng thêm trừ khi bug #400 liên quan tới đây.
