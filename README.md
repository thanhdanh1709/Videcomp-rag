# ViDecomp-RAG

Query Decomposition cho Multi-hop Question Answering trên dữ liệu tiếng Việt
chuyên ngành (pháp luật là miền chính, y tế là miền thực nghiệm mở rộng).

Dự án bám sát 3 tài liệu gốc trong thư mục này:

- `DeCuong_LuanVanThacSi_..._Vietnamese.docx` — mục tiêu, phạm vi, nội dung nghiên cứu, tiêu chí đánh giá.
- `HuongDanThucHien_..._Vietnamese.docx` — sổ tay triển khai theo từng bước (15 bước, ingestion → dashboard).
- `TaiLieuKyThuat_..._Vietnamese.docx` — đặc tả kiến trúc, schema, pseudo-code, API, Definition of Done cho từng module.

Mọi tên hàm/schema trong code bám sát đúng đặc tả kỹ thuật (Mục 5, 6, 7, 8)
để dễ đối chiếu khi viết luận văn.

## Trạng thái hiện tại

Đã triển khai và chạy được **end-to-end với dữ liệu và LLM thật** (không chỉ scaffold):

- **Lớp 1 — Ingestion & Chunking**: `document_ingestion`, `domain_chunker`
  (structure-aware theo Chương/Điều/Khoản cho pháp luật; heading/subheading
  cho y tế). Đã kiểm chứng trên văn bản pháp luật/y tế **thật** (xem mục
  Corpus bên dưới), không chỉ dữ liệu demo tự tạo.
- **Lớp 2 — Indexing & Retrieval**: BM25 (rank_bm25), dense vector (FAISS mặc
  định, Qdrant tùy chọn qua `VECTOR_BACKEND=qdrant`), Reciprocal Rank Fusion,
  cross-encoder reranker (fallback `NoOpReranker` khi offline).
- **Lớp 3 — Query Decomposition & Orchestration**: `query_analyzer`,
  `query_decomposer`, `dependency_planner` (topo-sort + phát hiện cycle),
  `hop_executor` (variable binding `{{h1.answer}}`), `evidence_memory`
  (dedupe theo chunk_id, citation_key ánh xạ ngược nguồn). Đã chạy với
  **Claude thật** (xem mục LLM Provider).
- **Lớp 4 — Answer & Verification**: `answer_synthesizer` (citation-required),
  `grounding_verifier` + corrective retrieval (giới hạn số vòng).
- **Lớp 5 — Service**: FastAPI với đủ 9 endpoint theo Mục 7 tài liệu kỹ thuật;
  **PostgreSQL/SQLAlchemy persistence** cho document metadata, qa_trace,
  experiment, benchmark annotation (xem mục Persistence); Docker Compose cho
  Qdrant/PostgreSQL/Redis.
- **Ablation B0→Q3**: `scripts/evaluate_all.py` chạy đủ 6 mode
  (`dense_rag`, `hybrid_rag`, `hybrid_rerank`, `decomp_independent`,
  `decomp_dependency`, `videcomp_full`) — xem `experiments/reports/main_report.html`
  cho lần chạy demo, và mục **Ablation ở quy mô corpus thật** bên dưới cho lần
  chạy trên 17001 chunk/38 văn bản.
- **36 pytest** bao phủ schema validation, chunker (kể cả regression test tren
  van ban y te that), dependency planner, evidence memory, retriever, DB
  persistence, evaluator, và pipeline tích hợp cho cả 6 mode.
- **Frontend/dashboard**: `frontend/` — React 18 + TypeScript + Vite, theo
  đúng design system `ThietKeGiaoDien/conversational_clarity/DESIGN.md`
  ("Conversational Clarity", dark theme). 3 màn hình: Hỏi đáp (composer chọn
  domain/mode, hiển thị lộ trình suy luận multi-hop, trích dẫn, kiểm chứng
  claim), Tra cứu trace (theo `request_id`), Đánh giá mô hình (chạy/tra
  experiment ablation B0→Q3). Gọi thẳng `/api/v1/*`, không đụng DB/LLM trực
  tiếp — xem `npm install && npm run dev` bên dưới.

## LLM Provider — đã tích hợp Claude thật

`backend/app/core/llm_provider.py` có 3 provider cùng chung interface
`LLMProvider.structured_output()`:

- `MockLLMProvider` — heuristic, không gọi mạng, dùng cho test/scaffold.
- `AnthropicProvider` — **Claude thật** qua SDK `anthropic` chính thức,
  dùng `client.messages.parse()` để ép JSON đúng theo từng Pydantic schema
  (`QueryAnalysis`, `QueryPlan`, `HopAnswer`, `AnswerDraft`, `ClaimVerification`,
  `BenchmarkCandidateDraft`). Kích hoạt bằng `LLM_PROVIDER=anthropic` +
  `ANTHROPIC_API_KEY` trong `.env`.
- `OpenAICompatibleProvider` — cho Ollama/vLLM tự host.

Đã test thật (không phải mock) toàn bộ pipeline `videcomp_full` (phân rã 3
hop → tổng hợp → verify) trên cả dữ liệu demo và dữ liệu pháp luật thật, chất
lượng decomposition/synthesis/verification đều tốt (xem lịch sử chạy trong
`experiments/results/`).

## Corpus — dữ liệu thật (không chỉ demo)

`data/raw/legal/` và `data/raw/medical/` hiện có **cả hai loại**, phân biệt rõ
qua manifest riêng:

| Manifest | Nội dung | Nguồn |
|---|---|---|
| `data/raw/manifest.csv` | 3 văn bản **demo tự tạo** (LAW_DEMO_00{1,2,3}) | Tự viết, không phải luật thật — chỉ để test nhanh |
| `data/raw/manifest_real_legal.csv` | **Luật 04/2017/QH14** (Hỗ trợ DNNVV) + **Nghị định 80/2021/NĐ-CP** + **Thông tư 06/2022/TT-BKHĐT** | vanban.vcci.com.vn (HTML), 285 chunk — 3 văn bản có quan hệ pháp lý thật (Luật → Nghị định → Thông tư) |
| `data/raw/manifest_real_legal_v2.csv` | **Bộ luật Dân sự 91/2015/QH13** (689 Điều) + **Bộ luật Hình sự 100/2015/QH13 hợp nhất** (426 Điều) + **Luật Hôn nhân và gia đình 52/2014/QH13** (133 Điều) + **Luật Giao thông đường bộ 23/2008/QH12** (89 Điều) | congbao.chinhphu.vn / datafiles.chinhphu.vn / caodangcsnd2.bocongan.gov.vn, 3575 chunk |
| `data/raw/manifest_real_legal_v3.csv` | **Bộ luật Lao động 45/2019/QH14** (220 Điều) + **Bộ luật Tố tụng dân sự 92/2015/QH13 hợp nhất** (517 Điều) + **Bộ luật Tố tụng hình sự 101/2015/QH13** (510 Điều, 3 phần) + **Bộ luật Hàng hải Việt Nam 95/2015/QH13** (341 Điều, 2 phần) | congbao.chinhphu.vn / xaydungchinhsach.chinhphu.vn, 4707 chunk |
| `data/raw/manifest_real_legal_v4.csv` | **Luật An ninh mạng 24/2018/QH14** + **Luật An toàn thông tin mạng 86/2015/QH13** | congbao.chinhphu.vn (PDF) / vanban.vcci.com.vn (HTML) |
| `data/raw/manifest_real_legal_v5.csv` | **Nghị định 53/2022/NĐ-CP** (hướng dẫn Luật An ninh mạng) + **Nghị định 13/2023/NĐ-CP** (bảo vệ dữ liệu cá nhân) + **Luật Giao dịch điện tử 20/2023/QH15** + **Luật Viễn thông 24/2023/QH15** + **Nghị định 85/2016/NĐ-CP** (an toàn hệ thống thông tin theo cấp độ) | xaydungchinhsach.chinhphu.vn (HTML) / congbao.chinhphu.vn → g7.cdnchinhphu.vn (PDF), 1372 chunk |
| `data/raw/manifest_real_legal_v6.csv` | **Luật Bảo vệ môi trường 72/2020/QH14** (2 phần) + **Luật Lâm nghiệp 16/2017/QH14** + **Luật Đa dạng sinh học 20/2008/QH12** (bản hợp nhất 73/VBHN-VPQH) | congbao.chinhphu.vn → congbaocdn.chinhphu.vn (PDF), 1492 chunk |
| `data/raw/manifest_real_legal_v7.csv` | **Luật Thủy sản 18/2017/QH14** (đánh bắt) + **Nghị định 06/2019/NĐ-CP** (động vật rừng nguy cấp, quý hiếm/CITES) + **Luật Đất đai 31/2024/QH15** + **Luật Quản lý thuế 38/2019/QH14** (2 phần) + **Luật Doanh nghiệp 59/2020/QH14** (2 phần) + **Nghị định 45/2022/NĐ-CP** (xử phạt hành chính bảo vệ môi trường, 3 phần) | congbao.chinhphu.vn (PDF) / xaydungchinhsach.chinhphu.vn (HTML), 4041 chunk |
| `data/raw/manifest_real_legal_v8.csv` | **Luật Khám bệnh, chữa bệnh 15/2023/QH15** + **Luật An toàn thực phẩm 55/2010/QH12** + **Luật Bảo hiểm y tế** (bản hợp nhất 40/VBHN-VPQH) + **Luật Phòng bệnh 114/2025/QH15** — văn bản luật về y tế nhưng có cấu trúc Điều/Khoản nên chunk theo domain "legal" (domain "medical" trong pipeline này dành cho văn bản hướng dẫn điều trị dạng văn xuôi như QĐ-BYT) | xaydungchinhsach.chinhphu.vn (HTML) / congbao.chinhphu.vn (PDF), 1145 chunk |
| `data/raw/manifest_real_medical.csv` | Quyết định 1440/QĐ-BYT — "Hướng dẫn chẩn đoán, điều trị và phòng lây nhiễm cúm lợn A (H1N1)" | datafiles.chinhphu.vn (văn bản công khai của Bộ Y tế, không phải hồ sơ bệnh nhân), 19 chunk |

Với v3, corpus pháp luật thật giờ có **toàn bộ 6/6 văn bản chính thức được
gọi là "Bộ luật" trong hệ thống pháp luật Việt Nam** (Dân sự, Hình sự, Tố
tụng dân sự, Tố tụng hình sự, Lao động, Hàng hải) cộng thêm 3 luật/nghị định/
thông tư thuộc nhóm hỗ trợ DNNVV và Luật Hôn nhân gia đình, Luật Giao thông
đường bộ.

`data/chunks/legal_real_all_chunks.jsonl` (**17001 chunk**, từ 38 văn bản —
bao gồm nhóm luật/nghị định về an ninh mạng, an toàn thông tin, bảo vệ dữ
liệu cá nhân, giao dịch điện tử, viễn thông ở v4/v5; nhóm môi
trường/lâm nghiệp/đa dạng sinh học ở v6; nhóm thủy sản/động vật hoang dã/
đất đai/thuế/doanh nghiệp/xử phạt môi trường ở v7; và nhóm luật y tế
(khám chữa bệnh/ATTP/BHYT/phòng bệnh) ở v8) + index
`data/indices/{bm25,legal_real_all_v1}` gộp toàn bộ corpus pháp luật
thật thành một retrieval duy nhất — đã test truy hồi **xuyên miền** thành
công nhiều lần: câu hỏi về tai nạn giao thông kéo đúng bằng chứng từ cả Luật
Giao thông đường bộ lẫn Bộ luật Hình sự; câu hỏi về bồi thường khi đơn
phương chấm dứt hợp đồng lao động kéo đúng bằng chứng từ cả Bộ luật Lao động
lẫn Bộ luật Dân sự, trong cùng một lần retrieve.

**Quan trọng — cách lấy dữ liệu thật, và bài học rút ra khi mở rộng corpus**:

1. `WebFetch` xử lý nội dung qua một model tóm tắt nên KHÔNG cho văn bản
   nguyên văn (đã thử và xác nhận bị diễn giải lại) — không dùng được cho
   corpus pháp luật vì sai một chữ trong luật là sai nghĩa.
2. Nhiều trang tra cứu luật (thuvienphapluat.vn) chặn bot (Cloudflare
   challenge); một số trang portal tỉnh/thành load nội dung bằng JS nên
   `curl` không lấy được text. **Nguồn đáng tin cậy nhất đã dùng**:
   `vanban.vcci.com.vn` (HTML, cho văn bản vừa/nhỏ) và
   `congbao.chinhphu.vn` → link tải PDF trên `datafiles.chinhphu.vn`/
   `g7.cdnchinhphu.vn` (Công báo Chính phủ — PDF ở đây có lớp text số hoá
   thật, khác với PDF quét ảnh trên `vanban.chinhphu.vn` mà `pypdf` không
   đọc được chữ).
3. PDF trích xuất có 2 loại nhiễu đã xử lý trong `ingestion.py`: (a) dòng
   header/footer lặp lại `"<số trang> CÔNG BÁO/Số ..."` — đã thêm
   `_GAZETTE_HEADER_RE` để loại bỏ tự động; (b) khoảng trắng thừa chèn giữa
   một số cụm từ có dấu (ví dụ "ngh ĩa vụ" thay vì "nghĩa vụ") — không ảnh
   hưởng ranh giới Điều/Khoản (số hiệu vẫn sạch) nhưng làm giảm nhẹ chất
   lượng full-text search; chưa xử lý, ảnh hưởng nhỏ.
4. Luôn dùng `curl` trực tiếp lấy HTML/PDF thô rồi tự parse bằng
   `BeautifulSoup`/`pypdf` có sẵn trong `ingestion.py` — giữ nguyên 100% câu
   chữ gốc, không qua bất kỳ bước tóm tắt AI nào.

**Phát hiện & sửa 1 bug thật nhờ dữ liệu thật**: heading regex cho miền y tế
(`_split_medical`) ban đầu quá rộng — khớp gần như MỌI câu tiếng Việt (vì đa
số câu bắt đầu bằng chữ hoa), gây over-segment nghiêm trọng khi chạy trên văn
bản Bộ Y tế thật. Đã sửa bằng heuristic chặt hơn (heading phải NGẮN + phần
lớn chữ hoa HOẶC kết thúc bằng dấu hai chấm, không kết thúc bằng dấu
câu/phẩy) + thêm test hồi quy `test_medical_heading_detection_does_not_over_segment_every_sentence`
trong `tests/test_chunker.py`.

**Hạn chế đã biết**:
- 1 nhiễu cosmetic: một số tiêu đề Điều trong Bộ luật Hình sự hợp nhất bị
  dính số footnote/trang vào cuối (vd "Điều 266. Tội đua xe trái phép**251**")
  do PDF gộp superscript vào text thường — không ảnh hưởng ranh giới chunk,
  chỉ ảnh hưởng thẩm mỹ hiển thị.
- Corpus thật hiện có **38 văn bản pháp luật** (đủ 6/6 Bộ luật + Luật hôn
  nhân gia đình + Luật giao thông + nhóm hỗ trợ DNNVV + nhóm an ninh
  mạng/an toàn thông tin/bảo vệ dữ liệu cá nhân/giao dịch điện tử/viễn thông
  + nhóm môi trường/lâm nghiệp/đa dạng sinh học/thủy sản/động vật hoang dã
  + nhóm đất đai/thuế/doanh nghiệp + nhóm luật y tế) + 1 văn bản y tế dạng
  hướng dẫn điều trị (domain "medical" riêng) — đủ
  đa dạng để kiểm chứng pipeline trên dữ liệu thật thuộc nhiều lĩnh vực khác
  nhau, nhưng còn xa quy mô cần cho benchmark 600 câu chính thức của luận
  văn (Hướng dẫn Bước 13). Mở rộng tiếp dùng đúng quy trình
  `curl` → `ingest_documents.py` → `validate_documents.py` như trên.
- Bộ luật Tố tụng hình sự (3 phần PDF) thiếu đúng 1 Điều (413/510) do ranh
  giới trang PDF cắt ngay giữa số hiệu Điều khiến regex không khớp — mất mát
  rất nhỏ (1/510), chưa xử lý.
- Công cụ đề xuất benchmark (`propose_benchmark_candidates.py`) khi nhóm
  chunk ngẫu nhiên xuyên NHIỀU bộ luật không liên quan chủ đề (vd Dân sự +
  Giao thông ngẫu nhiên) thường trả về `hop_count=1` (đúng như thiết kế —
  Claude từ chối bịa câu hỏi multi-hop khi 2 đoạn không thực sự liên quan) —
  muốn có nhiều candidate xuyên bộ luật hơn thì cần nhóm chunk theo độ liên
  quan chủ đề (vd BM25 similarity) thay vì lấy ngẫu nhiên thuần túy, việc này
  chưa làm.

## Benchmark — công cụ đề xuất bán tự động (LLM-assisted, KHÔNG tự động hoàn toàn)

`scripts/propose_benchmark_candidates.py` + `backend/app/services/benchmark_generator.py`
dùng Claude thật để đề xuất câu hỏi multi-hop từ nhóm chunk lấy từ nhiều văn
bản khác nhau (đúng tinh thần Hướng dẫn Bước 13: *"có thể dùng LLM để đề xuất
câu hỏi/decomposition nhằm giảm công sức, nhưng gold label cuối cùng phải
được người gán nhãn xác nhận"*).

- Mọi candidate được validate tự động: `supporting_evidence.chunk_id` phải là
  chunk_id **có thật** trong nhóm được cung cấp (không cho LLM bịa chunk_id),
  `depends_on` phải trỏ tới id tồn tại, `hop_count` phải khớp số subquestion.
- Output luôn có `annotation_status="draft"` và `split="test"` (placeholder)
  — **không bao giờ tự động ghi là "reviewed"**.
- Đã test trên corpus demo (5/5 hợp lệ), corpus SME thật
  (8/8 hợp lệ, `candidates_real_legal_draft.jsonl`), và corpus mở rộng đa lĩnh
  vực (5/10 hợp lệ, `candidates_real_legal_v2_draft.jsonl` — 5 candidate còn
  lại bị từ chối đúng thiết kế vì nhóm chunk ngẫu nhiên không đủ liên quan để
  tạo câu hỏi multi-hop thật).
- **Cải tiến nhóm chunk theo chủ đề (BM25)**: `_group_chunks_by_topic` trong
  `benchmark_generator.py` (mặc định `--group_strategy topic`, có thể đổi lại
  `random` để dùng cách cũ) chọn 1 chunk "hạt giống" rồi lấy các chunk
  BM25-gần-nhất nhưng thuộc **doc_id khác nhau** — vừa liên quan chủ đề vừa
  xuyên văn bản, thay vì chọn hoàn toàn ngẫu nhiên như trước. Chạy thử trên
  corpus 38 văn bản/17001 chunk hiện tại: **20/20 candidate hợp lệ**
  (`candidates_real_legal_v7v8_draft.jsonl`), tăng hẳn so với 5/10 của cách cũ.
  Câu hỏi sinh ra đọc qua thấy chất lượng tốt và thực sự xuyên nhiều bộ luật
  không liên quan bề mặt (vd Luật Bảo vệ môi trường + Nghị định xử phạt hành
  chính môi trường; Bộ luật Tố tụng dân sự + Luật Đất đai + Luật Doanh nghiệp
  cho câu hỏi so sánh thẩm quyền định giá/thẩm định giá).
- Dù tỷ lệ hợp lệ cao hơn nhiều,
  **BẠN (người gán nhãn) vẫn phải đọc lại từng câu đối chiếu văn bản gốc**
  trước khi promote vào `data/benchmark/{dev,test}.jsonl` chính thức — đây là
  bước không thể tự động hóa hoàn toàn theo đúng yêu cầu của đề cương.
- Trạng thái gán nhãn được theo dõi qua bảng `benchmark_annotations` trong DB
  (`backend/app/db/repository.py`: `upsert_benchmark_annotation`,
  `list_benchmark_annotations`).

## Ablation ở quy mô corpus thật (17001 chunk/38 văn bản)

Chạy `evaluate_all.py` (đã thêm `--bm25_dir`/`--vector_dir` để trỏ vào index
thật thay vì index demo mặc định) cho cả 6 mode trên 20 câu hỏi multi-hop từ
`candidates_real_legal_v7v8_draft.jsonl` (câu hỏi thật, xuyên nhiều văn bản
không liên quan bề mặt — xem mục Benchmark) — dùng Claude thật (Sonnet 5), mỗi
mode ~10-40 phút:

| Mode | recall@8 | hit@8 | mrr@8 | ndcg@8 | hop_recall | citation P/R | latency p50 |
|---|---|---|---|---|---|---|---|
| B0 `dense_rag` | 0.283 | 0.50 | 0.283 | 0.231 | 0.00 | 0.214/0.283 | 29s |
| B1 `hybrid_rag` | 0.467 | 0.80 | 0.514 | 0.411 | 0.00 | 0.310/0.467 | 33s |
| B2 `hybrid_rerank` | 0.542 | 0.85 | 0.602 | 0.479 | 0.00 | 0.387/0.542 | 32s |
| Q1 `decomp_independent` | 0.792 | 0.95 | 0.760 | 0.661 | 0.275 | 0.479/0.875 | 62s |
| Q2 `decomp_dependency` | 0.683 | 0.95 | 0.775 | 0.609 | 0.250 | 0.443/0.808 | 73s |
| Q3 `videcomp_full` | 0.758 | 0.95 | 0.775 | 0.650 | 0.275 | **0.535**/0.850 | 125s |

Nhận xét:

- **B0→B2 tăng đơn điệu** đúng kỳ vọng: hybrid retrieval (BM25+dense qua RRF)
  và rerank đều cải thiện recall/hit rõ rệt so với dense thuần — dense thuần
  chỉ đạt hit@8 50% ở quy mô 17001 chunk, cho thấy retrieval khó hơn hẳn khi
  corpus lớn (so với lúc corpus chỉ ~300 chunk).
- **Q1-Q3 (có phân rã câu hỏi) vượt xa B0-B2** ở mọi chỉ số retrieval/citation
  — xác nhận đúng luận điểm cốt lõi của đề tài: phân rã multi-hop giúp nhiều
  hơn, không phải ít hơn, khi corpus tăng quy mô và câu hỏi cần bằng chứng từ
  nhiều văn bản không liên quan bề mặt.
- **Q2 (dependency) thấp hơn Q1 (independent)** ở recall@8 (0.683 so với
  0.792) dù cùng hit@8 — có thể vì thực thi hop tuần tự/phụ thuộc khiến lỗi ở
  hop đầu lan sang hop sau; hop độc lập song song không có rủi ro này. Cần
  thêm dữ liệu để kết luận chắc chắn (mới 20 câu).
- **Q3 (full pipeline, có verification + corrective retrieval) đạt citation
  precision cao nhất** (0.535) dù recall thấp hơn Q1 một chút — verification
  có vẻ lọc bớt trích dẫn sai, đánh đổi bằng latency cao nhất (125s/câu, gấp
  ~4.3 lần B0).
- **EM (exact match) = 0 ở mọi mode** — câu trả lời là văn xuôi pháp lý tự do
  bằng tiếng Việt, không phải đáp án trích xuất ngắn, nên EM (khớp token
  tuyệt đối) không phải thước đo phù hợp cho miền này; F1 (0.30-0.34, khá ổn
  định qua các mode) phản ánh chất lượng câu trả lời sát hơn.
- **Bug phát hiện nhờ chạy ở quy mô lớn**: `hybrid_rag` crash lần đầu vì
  `AnthropicProvider.structured_output` (`backend/app/core/llm_provider.py`)
  cố định `max_tokens=4096` cho mọi lệnh gọi structured-output — không đủ chỗ
  cho cả adaptive thinking (Sonnet 5 bật mặc định) lẫn câu trả lời JSON dài
  hơn khi có nhiều bằng chứng hơn để trích dẫn, khiến JSON bị cắt giữa chừng
  (`EOF while parsing a string`). Đã sửa lên `max_tokens=16000` — bug này khó
  lộ ra ở corpus/benchmark nhỏ vì câu trả lời/ngữ cảnh không đủ dài để chạm
  giới hạn.

Kết quả chi tiết từng câu ở `experiments/results/{mode}_v7v8.json` (field
`per_item`).

## Persistence — PostgreSQL/SQLAlchemy (không còn thuần in-memory)

`backend/app/db/` — cùng một ORM code chạy được với **SQLite** (mặc định,
không cần Docker, dùng để dev/test — máy này không có Docker) và
**PostgreSQL** (production, qua `docker-compose.yml`), chỉ khác
`DB_DSN` trong `.env`:

- `models.py`: `DocumentRecord`, `IndexVersionRecord`, `QATraceRecord`,
  `ExperimentRecord`, `BenchmarkAnnotationRecord`.
- `repository.py`: hàm save/get/list cho từng bảng — `routes.py` gọi qua đây,
  không viết SQL rải rác.
- Đã test: ingest → build index → hỏi đáp → **đọc lại trace từ một tiến trình
  Python khác** (mô phỏng restart server) → dữ liệu vẫn còn (4 test trong
  `tests/test_db.py` + 1 lần chạy tay xác nhận qua FastAPI TestClient).
- Khi có Docker: đổi `DB_DSN=postgresql+psycopg://videcomp:videcomp@postgres:5432/videcomp`
  (đã cấu hình sẵn trong `docker-compose.yml`).

### Còn lại (ngoài phạm vi yêu cầu lần này)

- **Dashboard**: đã làm ở `frontend/` (React + TypeScript + Vite, xem mục
  Trạng thái hiện tại) — dùng viz custom nhẹ cho lộ trình suy luận (stepper có
  hướng phụ thuộc) thay vì Cytoscape.js để tránh thêm dependency nặng; có thể
  đổi sang Cytoscape.js sau nếu cần đồ thị DAG tương tác phức tạp hơn.
- **Mở rộng corpus lên quy mô đầy đủ** (~400-500 văn bản pháp luật): cần tiếp
  tục lặp lại quy trình `curl` → `ingest` → `validate` đã thiết lập.
- **Benchmark 600 câu đã gán nhãn người**: công cụ đề xuất đã sẵn sàng
  (`propose_benchmark_candidates.py`), nhưng việc đọc/sửa/xác nhận từng câu là
  công việc con người, chưa thể/không nên tự động hóa.
- **ROUGE-L/BERTScore** (answer quality bổ trợ): chưa thêm, cần dependency
  nặng hơn (bert-score); EM/F1 token-level đã có trong `evaluator.py`.
- **Alembic migrations**: hiện dùng `Base.metadata.create_all()` (đủ cho giai
  đoạn này); cần Alembic khi bắt đầu thay đổi schema trên dữ liệu đã có.

## Cài đặt & chạy thử (đã kiểm chứng trên máy này)

```bash
python -m venv .venv
.venv/Scripts/activate       # Windows
pip install -r requirements.txt
cp .env.example .env         # dien ANTHROPIC_API_KEY neu muon dung Claude that

# 1) Ingest + chunk toan bo du lieu PHAP LUAT THAT da co (38 van ban:
#    Luat/Nghi dinh/Thong tu SME + ca 6 Bo luat + Luat Hon nhan/Giao thong +
#    nhom an ninh mang/an toan thong tin/du lieu ca nhan/GDDT/vien thong +
#    nhom moi truong/lam nghiep/da dang sinh hoc/thuy san/dong vat hoang da +
#    nhom dat dai/thue/doanh nghiep + nhom luat y te)
for V in "" _v2 _v3 _v4 _v5 _v6 _v7 _v8; do
  python scripts/ingest_documents.py --manifest data/raw/manifest_real_legal${V}.csv --out data/processed/documents_real_legal${V}.jsonl
  python scripts/build_chunks.py --input data/processed/documents_real_legal${V}.jsonl --domain legal --out data/chunks/legal_real${V}_chunks.jsonl
done
cat data/chunks/legal_real_chunks.jsonl data/chunks/legal_real_v2_chunks.jsonl data/chunks/legal_real_v3_chunks.jsonl data/chunks/legal_real_v4_chunks.jsonl data/chunks/legal_real_v5_chunks.jsonl data/chunks/legal_real_v6_chunks.jsonl data/chunks/legal_real_v7_chunks.jsonl data/chunks/legal_real_v8_chunks.jsonl > data/chunks/legal_real_all_chunks.jsonl
python scripts/validate_chunks.py data/chunks/legal_real_all_chunks.jsonl

# 2) Xay index gop tren toan bo corpus that (17001 chunk)
python scripts/build_bm25.py --chunks data/chunks/legal_real_all_chunks.jsonl --out data/indices/bm25_legal_real_all
python scripts/build_vector_index.py --chunks data/chunks/legal_real_all_chunks.jsonl --collection legal_real_all_v1 --out data/indices/legal_real_all_v1

# 3) Hoi mot cau hoi multi-hop tren du lieu THAT, dung Claude that
python -m scripts.run_qa --mode videcomp_full \
  --question "Người lao động đơn phương chấm dứt hợp đồng lao động trái pháp luật thì phải bồi thường thiệt hại theo nguyên tắc nào của Bộ luật Dân sự?" \
  --domain legal --bm25_dir data/indices/bm25_legal_real_all --vector_dir data/indices/legal_real_all_v1 --save_trace

# 4) De xuat benchmark candidate (draft) tu corpus that bang LLM - CAN NGUOI REVIEW LAI
python scripts/propose_benchmark_candidates.py --chunks data/chunks/legal_real_all_chunks.jsonl \
  --domain legal --n_candidates 10 --out data/benchmark/candidates_real_legal_v2_draft.jsonl

# 5) Chay ablation B0..Q3 tren benchmark demo va xuat bao cao HTML
for MODE in dense_rag hybrid_rag hybrid_rerank decomp_independent decomp_dependency videcomp_full; do
  python scripts/evaluate_all.py --mode $MODE --dataset data/benchmark/test.jsonl --out experiments/results/${MODE}.json
done
python scripts/make_report.py --results_dir experiments/results --out experiments/reports/main_report.html

# 6) Chay API server (tu dong init_db() luc startup)
uvicorn backend.app.main:app --reload --port 8000
curl http://localhost:8000/api/v1/health

# 6b) Nap index THAT da build san vao AppState (bat buoc sau MOI lan restart
#     server - AppState chi o bo nho, khong persist; /qa/answer se tra 400
#     "chua build index cho domain nay" neu bo qua buoc nay)
curl -X POST http://localhost:8000/api/v1/index/load -H "Content-Type: application/json" \
  -d '{"domain":"legal","bm25_dir":"data/indices/bm25_legal_real_all","vector_dir":"data/indices/legal_real_all_v1"}'
curl -X POST http://localhost:8000/api/v1/index/load -H "Content-Type: application/json" \
  -d '{"domain":"medical","bm25_dir":"data/indices/bm25_medical_real","vector_dir":"data/indices/medical_real_v1"}'

# 7) Chay test
pytest -q

# 8) Chay frontend dashboard (can API server dang chay o buoc 6 + da nap index o buoc 6b)
cd frontend
npm install
npm run dev              # http://localhost:5173, mac dinh tro toi backend http://localhost:8000
                          # doi API base URL trong bieu tuong Cai dat o cuoi sidebar neu backend chay port khac
```

> Lưu ý Windows: set `PYTHONIOENCODING=utf-8` trước khi in tiếng Việt ra
> console nếu gặp `UnicodeEncodeError` (mặc định `cp1252`).

## Cấu trúc thư mục

Theo đúng Mục 8 Tài liệu kỹ thuật:

```
backend/app/
├── api/          # FastAPI routes + AppState (cache in-memory cho index/retriever nang)
├── db/           # SQLAlchemy models/session/repository (PostgreSQL/SQLite)
├── schemas/      # Pydantic: documents, query_plan, evidence, answer, benchmark, api (Mục 6)
├── core/         # config, adapter LLM (Mock/Anthropic/OpenAI-compatible)/embedding/reranker, text_utils
├── services/     # 12 module nghiệp vụ (thêm benchmark_generator.py), mỗi module ~ 1 module trong Mục 5
data/
├── raw/{legal,medical}/    # van ban goc: *_DEMO_* (tu tao) + van ban that (Luat/Nghi dinh/Thong tu/QD-BYT)
├── processed/ chunks/ benchmark/ indices/
experiments/{configs,results,reports}/
scripts/          # CLI khớp với lệnh trong Hướng dẫn thực hiện
tests/            # 36 test, pytest -q
frontend/         # React + TypeScript + Vite dashboard, theo ThietKeGiaoDien/conversational_clarity/DESIGN.md
├── src/api/       # client fetch + types khớp backend/app/schemas/*.py
├── src/components/ hooks/ styles/ views/
```

## Mapping module → Tài liệu kỹ thuật

| Module (`backend/app/services/`) | Mục TaiLieuKyThuat | Trạng thái |
|---|---|---|
| `ingestion.py` | 5.1 document_ingestion | Chạy được, đã test trên văn bản pháp luật/y tế thật |
| `chunker.py` | 5.2 domain_chunker | Đã sửa bug heading y tế nhờ test trên dữ liệu thật |
| `retriever.py` + `index_builder.py` | 5.3 hybrid_retriever | Chạy được, RRF + rerank + metadata filter |
| `query_analyzer.py` | 5.4 query_analyzer | Rule-based + Claude thật qua adapter |
| `query_decomposer.py` | 5.5 query_decomposer | Validation DAG/acyclic/depends_on đầy đủ, test với Claude thật |
| `dependency_planner.py` + `hop_executor.py` | 5.6 | Topo-sort, variable binding, parallel groups |
| `evidence_memory.py` | 5.7 | Dedupe + citation_key ánh xạ ngược |
| `synthesizer.py` | 5.8 answer_synthesizer | Citation-required prompt, test với Claude thật |
| `core/law_titles.py` | (bổ trợ 5.8/6.3) | Làm giàu `Citation` sau khi LLM sinh (chỉ biết chunk_id) bằng `law_name`/`citation_label`/`article_title` — ánh xạ doc_id → tên đầy đủ chính thức + parse "Điều/Khoản" từ `parent_path`, cho dashboard hiển thị "Khoản X Điều Y <Tên luật đầy đủ>" thay vì chunk_id kỹ thuật |
| `verifier.py` | 5.9 grounding_verifier | Corrective retrieval giới hạn vòng lặp |
| `evaluator.py` | 5.10 + Mục 9 | Recall/Hit/MRR/nDCG/HopRecall/EM/F1/citation P-R |
| `pipeline.py` | Mục 3.(2) Orchestrator, Mục 4.2, Mục 9 ablation | B0-B2, Q1-Q3, fallback theo ngưỡng τ |
| `benchmark_generator.py` | Hướng dẫn Bước 13 | LLM đề xuất draft, validate chunk_id, cần người review |
| `db/*` | Mục 3.(4) Storage | PostgreSQL/SQLite qua SQLAlchemy |

## Bước tiếp theo đề xuất

1. Đọc lại các file `data/benchmark/candidates_*_draft.jsonl` (18 câu cũ +
   20 câu mới `candidates_real_legal_v7v8_draft.jsonl` = 38 câu), sửa/xác nhận
   từng câu, rồi promote vào `data/benchmark/{dev,test}.jsonl` với `split`
   phù hợp và `annotation_status="reviewed"`.
2. ~~Cải tiến nhóm chunk theo chủ đề~~ — **đã làm**: `_group_chunks_by_topic`
   (BM25) trong `benchmark_generator.py`, mặc định dùng khi chạy
   `propose_benchmark_candidates.py`. Có thể chạy thêm nhiều batch nữa
   (`--seed` khác, `--n_candidates` cao hơn) để có đủ số câu cho benchmark
   600 câu chính thức.
3. ~~Chạy lại `evaluate_all.py` ở quy mô lớn~~ — **đã làm**, xem mục "Ablation
   ở quy mô corpus thật" (20 câu × 6 mode, phát hiện và sửa 1 bug thật:
   `max_tokens` quá thấp trong `AnthropicProvider.structured_output`). Có thể
   chạy lại với nhiều câu hơn (`--n_candidates` cao hơn ở bước 2) để số liệu
   đáng tin cậy hơn về mặt thống kê.
4. Tiếp tục lặp chu trình `curl` → `ingest` → `chunk` → `propose_benchmark_candidates`
   nếu muốn mở rộng corpus pháp luật lên quy mô lớn hơn nữa (mục tiêu ~400-500
   văn bản; hiện có 38). Ưu tiên nguồn `congbao.chinhphu.vn` (PDF có lớp text
   thật) hoặc `xaydungchinhsach.chinhphu.vn`/`vanban.vcci.com.vn` (HTML) —
   tránh `vanban.chinhphu.vn` (PDF quét ảnh, không đọc được chữ) và
   thuvienphapluat.vn (chặn bot).
5. Khi có Docker, đổi `DB_DSN` sang PostgreSQL và chạy `docker compose up -d`
   để có Qdrant/Postgres/Redis thật thay vì FAISS+SQLite cục bộ.
6. ~~Khi bạn thiết kế xong giao diện, gửi để tích hợp~~ — **đã làm**: dashboard
   ở `frontend/` bám theo design system trong `ThietKeGiaoDien/`. Việc còn lại:
   thử end-to-end với Claude thật qua UI (câu hỏi multi-hop thật, cả 6 mode)
   và tinh chỉnh nếu có khác biệt UX so với kỳ vọng ban đầu.
