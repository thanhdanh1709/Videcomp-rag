# ViDecomp-RAG: Hệ Thống Hỏi Đáp Đa Bước Tiếng Việt Chuyên Ngành

> **Query Decomposition cho Multi-hop Question Answering trên dữ liệu tiếng Việt chuyên ngành (Pháp luật là miền chính, Y tế là miền thực nghiệm mở rộng).**

Dự án bám sát và hiện thực hóa trọn vẹn 3 tài liệu đặc tả kỹ thuật:
- `DeCuong_LuanVanThacSi_..._Vietnamese.docx` — Mục tiêu, phạm vi, nội dung nghiên cứu và tiêu chí đánh giá khoa học.
- `HuongDanThucHien_..._Vietnamese.docx` — Sổ tay triển khai 15 bước từ Ingestion đến Dashboard.
- `TaiLieuKyThuat_..._Vietnamese.docx` — Đặc tả chi tiết kiến trúc 5 lớp, schema Pydantic, pseudo-code, API endpoints và Definition of Done.

---

## 1. Trạng thái hiện tại của dự án

Hệ thống đã hoàn thiện **end-to-end** ở cấp độ ứng dụng thực tế với cả dữ liệu thật và mô hình ngôn ngữ lớn (LLM):

### 1.1. Lớp 1 — Ingestion & Structure-Aware Chunking
- **Pháp luật (`legal`)**: Phân rã văn bản thông minh bám theo cấu trúc pháp điển Việt Nam (Chương / Mục / Điều / Khoản / Điểm).
- **Y tế (`medical`)**: Phân đoạn theo tiêu đề mục (Heading / Subheading) của phác đồ điều trị Bộ Y tế (đã tinh chỉnh heuristic tránh over-segment câu thông thường).
- **Corpus thật quy mô lớn**: Đã thu thập và xử lý **38 văn bản pháp luật chính thức** (toàn bộ 6/6 Bộ luật Việt Nam, Luật Đất đai 2024, Luật Doanh nghiệp, Luật An ninh mạng, Thuế, Môi trường...) đạt **17,001 chunks**.

### 1.2. Lớp 2 — Indexing & Hybrid Retrieval
- **Sparse Retrieval**: BM25 (`rank_bm25`).
- **Dense Vector**: FAISS (mặc định) và Qdrant (tùy chọn qua Docker).
- **RRF (Reciprocal Rank Fusion)**: Hợp nhất kết quả đa nguồn.
- **Reranker**: Cross-Encoder (`NoOpReranker` tự động kích hoạt khi offline hoặc dùng model chuyên dụng).

### 1.3. Lớp 3 — Phân rã câu hỏi & Điều phối Đa bước (Query Decomposition & Orchestration)
- **`query_analyzer`**: Phân loại độ phức tạp câu hỏi (single-hop vs multi-hop).
- **`query_decomposer`**: Sinh đồ thị định hướng có hướng không chu trình (DAG) cho các câu hỏi phụ.
- **`dependency_planner`**: Sắp xếp thứ tự thực thi topo-sort, phát hiện chu trình, lập nhóm thực thi song song.
- **`hop_executor`**: Thực thi từng chặng truy hồi, cơ chế binding biến ngữ cảnh phụ thuộc (`{{h1.answer}}`).
- **`evidence_memory`**: Khử trùng lặp theo `chunk_id`, quản lý bộ nhớ bằng chứng và gắn nhãn citation key nguồn.

### 1.4. Lớp 4 — Tổng hợp & Kiểm chứng Trực tiếp (Synthesis & Verification)
- **`answer_synthesizer`**: Bắt buộc trích dẫn tường minh theo chuẩn Điều/Khoản và tên đạo luật chính thức ([law_titles.py](file:///d:/videcomp-rag/backend/app/core/law_titles.py)).
- **`grounding_verifier`**: Tách câu trả lời thành từng claim đơn lẻ, đối soát trực tiếp với chứng cứ gốc, kích hoạt truy hồi khắc phục (corrective retrieval) khi phát hiện hallucination hoặc thiếu căn cứ.

### 1.5. Lớp 5 — Dịch vụ Backend, Xác thực JWT & Phân quyền RBAC
- **FastAPI Core**: Cung cấp đầy đủ các API nghiệp vụ tra cứu câu hỏi, nạp chỉ mục, vết trace, đánh giá benchmark.
- **Xác thực JWT (JSON Web Token)**:
  - Mã hóa mật khẩu chuẩn doanh nghiệp PBKDF2 HMAC-SHA256.
  - Token Bearer chuẩn HS256, kiểm tra thời hạn và tính hợp lệ trên từng request.
  - Endpoint xác thực: `/api/v1/auth/login`, `/api/v1/auth/register`, `/api/v1/auth/me`.
  - Tự động nạp tài khoản Quản trị viên mặc định: `admin` / `admin123`.
- **Phân quyền vai trò (Role-Based Access Control - RBAC)**:
  - Tài khoản **Admin**: Quyền quản trị toàn diện, truy cập Admin Console, đổi khóa API, LLM Provider, System Prompt.
  - Tài khoản **User thường**: Sử dụng phòng Chat, tra cứu kiến thức, bị chặn tuyệt đối khỏi trang Quản trị.
- **Persistence & Đồng bộ Cơ sở dữ liệu Bền vững (PostgreSQL / SQLite)**:
  - Hệ thống hỗ trợ song song SQLite (`data/videcomp.db`) cho môi trường cá nhân cục bộ và **PostgreSQL** cho môi trường triển khai doanh nghiệp đa thiết bị.
  - **Lưu trữ tập trung trên PostgreSQL**:
    - `chat_sessions`: Toàn bộ lịch sử các phiên chat, lượt hỏi đáp, câu trả lời, trích dẫn pháp lý và đánh giá feedback hữu ích (up/down).
    - `projects`: Cây thư mục dự án / vụ việc pháp lý.
    - `custom_agents`: Các chuyên gia tùy chỉnh do người dùng tạo từ GPT Builder.
    - `users`: Tài khoản và phân quyền người dùng (PBKDF2 HMAC-SHA256).
    - `qa_traces`, `experiments`, `benchmark_annotations`: Dữ liệu phân tích và thực nghiệm.
  - **Đồng bộ đa thiết bị & Cách ly dữ liệu (Data Isolation)**:
    - Mọi dữ liệu phiên làm việc, dự án và chuyên gia đều được phân quyền và cách ly nghiêm ngặt theo người dùng thông qua Token chuẩn JWT (`_get_current_username`).
    - Hỗ trợ lưu đệm ngoại tuyến (Offline cache) tại trình duyệt và tự động đồng bộ 2 chiều lên PostgreSQL khi đăng nhập.
  - Kèm theo script chuyển dịch tự động toàn bộ dữ liệu từ SQLite sang PostgreSQL: `python -m scripts.migrate_sqlite_to_postgres`.

### 1.6. Giao diện Người dùng Cao cấp (Frontend Platform)
Được phát triển bằng **React 18 + TypeScript + Vite**, tích hợp thiết kế điện ảnh hiện đại (Conversational Clarity, Dark Obsidian, Emerald Glow, Glassmorphism):
1. **Landing Page (`LandingView.tsx`)**: Giới thiệu công nghệ thuật toán Q3, bảng so sánh benchmark trực quan, showcase tương tác.
2. **Giao diện Xác thực 2 cột Điện ảnh (`AdminLoginModal.tsx` & `AuthView.tsx`)**:
   - Form Đăng nhập & Đăng ký độc lập, không điền sẵn dữ liệu.
   - Bảng kiểm tra mật khẩu thời gian thực (tối thiểu 8 ký tự, chữ hoa, thường, số, ký tự đặc biệt, trùng khớp).
   - Tích hợp các nút đăng nhập SSO Google, Microsoft, Apple.
3. **Phòng Chat AI Thông minh (`ChatView.tsx`)**:
   - Tùy biến Domain (Pháp luật / Y tế) và 6 chế độ suy luận RAG (B0→Q3).
   - Hiển thị lộ trình suy luận đa bước (Multi-Hop Progress Stepper, Thinking Indicator).
   - Thẻ trích dẫn pháp lý nguyên văn và bảng phân tích kiểm chứng claim chi tiết.
   - Tích hợp tìm kiếm web mở rộng (Web Search toggle).
4. **Trang Quản trị Hệ thống (`AdminConsoleView.tsx`)**:
   - Dành riêng cho Quản trị viên điều chỉnh cấu hình nóng LLM Provider, API Key, Model ID, System Prompt.
5. **Khám phá Chuyên gia & Trình tạo Agent (`ExploreView.tsx`, `GPTBuilderView.tsx`)**:
   - Danh mục chuyên gia AI theo lĩnh vực (Luật Doanh nghiệp, Đất đai, Y tế dự phòng...).
   - Công cụ tùy biến và tạo Agent AI riêng với tài liệu đính kèm và prompts khởi đầu.
6. **Lịch sử & Quản lý Dự án (`WorkspaceView.tsx`)**:
   - Gom nhóm và phân loại các phiên làm việc theo từng dự án / vụ việc pháp lý.
7. **Tra cứu Vết Trace (`TraceLookupView.tsx`) & Đánh giá Benchmark (`EvaluationView.tsx`)**:
   - Tra cứu chi tiết DAG decomposition theo `request_id`.
   - Xem biểu đồ và bảng kết quả ablation study.
8. **Chế độ Giọng nói Nâng cao (`VoiceModeOverlay.tsx`)**:
   - Trò chuyện thoại với quả cầu sóng âm chuyển động 3D.

### 1.7. Phản hồi Dòng thời gian thực (Streaming Token & Step-by-Step SSE)
- **Chuẩn Server-Sent Events (SSE)**: Thay thế hoàn toàn độ trễ chờ đợi bằng luồng truyền dữ liệu thời gian thực qua endpoint `POST /api/v1/qa/answer-stream`.
- **Dòng 1 (Kế hoạch phân rã ngay lập tức)**: Hiển thị ngay các câu hỏi con (`Hop 1`, `Hop 2`...) và cấu trúc đồ thị suy luận DAG ngay khi LLM phân tích xong (trong ~0.8s).
- **Dòng 2 (Văn bản Luật / Y tế đang truy xuất)**: Hiển thị trực tiếp các căn cứ pháp luật / y khoa đang được truy hồi cho từng Hop kèm nhãn số hiệu Điều/Khoản và điểm số liên quan.
- **Dòng 3 (Token Typewriter Effect)**: Bắn từng token câu trả lời ra màn hình với con trỏ nhấp nháy `|` (hiệu ứng máy đánh chữ như DeepSeek R1 / ChatGPT), mang lại cảm giác độ trễ phản hồi gần như bằng 0.
- **Kiểm chứng NLI Trực tiếp**: Phát sự kiện kết quả đối soát luận điểm (Grounding Verifier) và tự động làm giàu trích dẫn pháp điển nguyên văn.

### 1.8. Bộ đệm Ngữ nghĩa (Semantic Caching)
- **Kiến trúc Vector Caching**: Tích hợp SQLite lưu trữ bền vững (`data/videcomp_semantic_cache.db`) kết hợp bộ chỉ mục in-memory vector Inner Product chuẩn hóa L2 ($\vec{a} \cdot \vec{b} = \cos \theta$).
- **Tốc độ tra cứu siêu tốc**: Tìm kiếm vector tương đồng hoàn tất trong **< 20ms** (vượt xa chỉ tiêu kỹ thuật < 150ms).
- **Tự động trúng Cache (Cosine Similarity $\ge 0.93$)**: Khi người dùng hỏi câu hỏi mới mang ý nghĩa tương đương câu hỏi cũ đã được kiểm chứng (ví dụ: *"Mức xử phạt khi điều khiển xe máy không đội mũ bảo hiểm?"* vs *"Mức xử phạt khi đi xe máy không đội mũ bảo hiểm?"* đạt độ tương đồng `0.9746`):
  - Hệ thống phát hiện và trả về kết quả ngay lập tức mà không cần gọi lại LLM.
  - Hiển thị huy hiệu `⚡ Phản hồi từ Bộ đệm Ngữ nghĩa` và phát Typewriter siêu tốc.
  - **Tiết kiệm 40% – 70%** chi phí API token và hạ tải cho hệ thống máy chủ.
- **Phân hệ Quản trị Semantic Cache (Admin Console Hub)**:
  - Hiển thị 4 thẻ KPI trực quan: *Tổng câu hỏi đã đệm*, *Số lượt trúng Cache (Hits)*, *Tỷ lệ trúng (Hit Rate %)*, *Chi phí API ước tính đã tiết kiệm ($)*.
  - Thanh trượt điều chỉnh ngưỡng tương đồng Cosine linh hoạt từ `0.80` đến `0.98` (mặc định `0.93`).
  - Nút bật/tắt Bộ đệm và nút Xóa sạch bộ nhớ đệm (Clear Cache) tức thì.

### 1.9. Hàng đợi Xử lý Nền (Background Task Queue)
- **Xử lý tài liệu lớn không nghẽn luồng**: Khi tải lên các văn bản pháp luật hoặc hồ sơ y tế dung lượng lớn (hàng trăm trang PDF), quá trình cắt đoạn (chunking) và sinh vector embedding được chuyển vào hàng đợi bất đồng bộ (`backend/app/core/task_queue.py`).
- **Thanh tiến trình phần trăm thời gian thực**: Trình theo dõi tiến độ từ `0%` đến `100%` phát qua luồng sự kiện SSE `/api/v1/tasks/{task_id}/events`, cập nhật trực tiếp trên thanh Composer và các phân hệ tải tệp.

### 1.10. Hỗ trợ Mô hình Cục bộ Hoàn toàn (Local LLM On-Premise via Ollama / vLLM)
- **Bảo mật 100% On-Premise / Private Cloud**: Hỗ trợ kết nối trực tiếp với các mô hình mã nguồn mở On-Premise qua **Ollama** (Qwen 2.5 14B/32B, Vistral, PhoGPT) hoặc **vLLM Cluster** phục vụ cho các cơ quan nhà nước, ngân hàng và bệnh viện có yêu cầu bảo mật dữ liệu tuyệt đối.
### 1.11. Nâng cấp Xử lý Tài liệu Đa phương thái (OCR & Table Extraction)
- **Bóc tách Bảng biểu có cấu trúc (`pdfplumber`)**:
  - Khắc phục triệt để hạn chế của `pypdf` (vốn làm mất cấu trúc cột/hàng của các bảng mức phạt, khung hình phạt, bảng chỉ số xét nghiệm và kết quả lâm sàng).
  - Tự động nhận diện lưới ma trận 2D và chuyển đổi thành bảng **Markdown chuẩn** (`| Cột 1 | Cột 2 |`) cho cả tệp PDF và văn bản Word DOCX.
  - Cho phép Answer Synthesizer viện dẫn chính xác từng hàng dữ liệu, đối chiếu số liệu và khung phạt trong câu trả lời.
- **Cơ chế Hybrid Vision OCR (Claude 3.5 Sonnet Vision / Multimodal)**:
  - Tự động nhận diện trang scan dạng ảnh (ảnh chụp hồ sơ bệnh án, con dấu công chứng, chữ ký, văn bản scan không có text layer hoặc text < 40 ký tự).
  - Xuất ảnh trang PDF với độ phân giải cao và truyền trực tiếp sang Vision LLM để OCR trọn vẹn văn bản tiếng Việt có dấu, thuật ngữ y học, các sơ đồ phác đồ điều trị và biểu đồ nhánh.
  - Tự động fallback an toàn về `pypdf` nếu gặp tệp PDF bị lỗi định dạng, đảm bảo 100% không bao giờ làm gián đoạn tiến trình ingest.

### 1.12. Tối ưu Embedding & Reranker Chuyên dụng cho Tiếng Việt
- **Tích hợp các Mô hình Embedding SOTA**:
  - **`BAAI/bge-m3`**: Mô hình đa ngôn ngữ hàng đầu với cửa sổ ngữ cảnh lên tới **8192 tokens**, biểu diễn vector dense 1024 chiều. Tối ưu hóa vượt bậc khả năng truy hồi ngữ nghĩa (Recall) cho các từ vựng cổ, thuật ngữ Hán - Việt (*"suy đoán lỗi"*, *"liên đới bồi thường"*, *"trách nhiệm ngoài hợp đồng"*, *"thời hiệu khởi kiện"*...) và viện dẫn luật dài xuyên nhiều điều khoản.
  - **`bkai-foundation-models/vietnamese-bi-encoder`**: Mô hình 768 chiều được huấn luyện chuyên sâu cho tiếng Việt bởi Viện CNTT Bách Khoa Hà Nội (BKAI), tăng cường độ chuẩn xác cho văn phong và ngữ pháp Việt Nam.
  - **`sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`**: Mô hình 384 chiều siêu nhẹ, tối ưu hóa tốc độ cho máy chủ có tài nguyên hạn chế.
- **Reranker Cross-Encoder Tiếng Việt Tối tân**:
  - Tích hợp **`BAAI/bge-reranker-v2-m3`** tái xếp hạng chéo giữa truy vấn và chứng cứ, phân biệt sắc thái pháp lý tinh tế (điều kiện loại trừ, ngoại lệ, phủ định kép).
- **Phân hệ Quản trị Mô hình & Đánh giá Live trên Admin Console**:
  - Cho phép chuyển đổi nóng mô hình Embedding và Reranker trong thời gian chạy mà không cần khởi động lại dịch vụ.
  - Tích hợp Bảng điều khiển thử nghiệm trực tiếp: Nhập câu hỏi tiếng Việt mẫu, đo lường độ trễ (latency ms), hiển thị trực quan các chiều vector và điểm xếp hạng Rerank.

### 1.13. Xuất Báo cáo Chuyên nghiệp (Legal / Medical Dossier Exporter) & Cộng tác Nhóm
- **Tạo Hồ sơ Pháp lý & Bệnh án Chuẩn mực**: Cho phép xuất toàn bộ phiên hỏi đáp hoặc một lượt tra cứu cụ thể thành tệp **PDF** hoặc **Word (.docx)** được định dạng chuyên nghiệp:
  - Tiêu đề văn bản trang trọng, ngày giờ và thông tin người lập.
  - Tóm tắt kết luận tư vấn trực diện.
  - Cây suy luận phân rã đa bước (Multi-Hop DAG Execution Trace) kèm câu hỏi con và câu trả lời từng chặng.
  - Bảng trích dẫn điều luật / y khoa đối chiếu chi tiết (tên đạo luật, số hiệu Điều/Khoản, trích đoạn căn cứ).
  - Bảng đối soát kiểm chứng luận điểm (Grounding Verification & Contradiction Detection).
- **Cộng tác Nhóm & Chia sẻ Phiên làm việc (Shared Workspace & Multi-user Sharing)**:
  - Cho phép người dùng chia sẻ đường liên kết phiên tra cứu hoặc toàn bộ thư mục dự án cho các thành viên trong phòng ban.
  - Phân quyền cộng tác rõ ràng: **Chỉ xem (Viewer)** hoặc **Cùng thảo luận (Editor)**.
  - Tự động đồng bộ quyền hạn theo JWT Token và cơ sở dữ liệu PostgreSQL / SQLite.

### 1.14. Hệ thống Đo lường Chất lượng RAG Tự động (RAG Evaluation / Ragas / TruLens)
- **Chuẩn mực Đánh giá Bộ ba RAG Triad**:
  1. **🎯 Độ trung thực (Faithfulness)**: *Câu trả lời có đúng với tài liệu không?*
     - Phân rã câu trả lời thành từng mệnh đề thực thể (claims) độc lập.
     - Đo tỷ lệ các luận điểm có bằng chứng trích dẫn chứng thực từ ngữ cảnh, phạt nặng các luận điểm mâu thuẫn hoặc bịa đặt ngoài tài liệu.
     - Công thức: $\text{Faithfulness} = \frac{|\text{Luận điểm Hợp lệ}| - 1.5 \times |\text{Mâu thuẫn}|}{|\text{Tổng số luận điểm}|}$.
  2. **💡 Độ liên quan (Answer Relevance)**: *Có trả lời đúng trọng tâm câu hỏi không?*
     - Đánh giá mức độ trực diện, bao quát và bám sát câu hỏi người dùng; trừ điểm nếu câu trả lời né tránh, lan man hoặc chứa thông tin lạc đề.
     - Kết hợp LLM Rubric Evaluation thang điểm chuẩn và Lexical/Semantic Similarity giữa câu hỏi và câu trả lời.
  3. **🔍 Mức độ trích dẫn (Context Precision)**: *Bằng chứng tìm được có chuẩn xác không?*
     - Đo lường tỷ lệ tín hiệu trên nhiễu (Signal-to-Noise Ratio) của các đoạn văn bản truy xuất.
     - Công thức chuẩn Ragas theo thứ hạng: $\text{Context Precision@K} = \frac{\sum_{r=1}^K (\text{Precision@r} \times v_r)}{\text{Tổng số đoạn hữu ích trong top K}}$.
  4. **🏆 Chỉ số RAG Triad Tổng hợp (Combined Triad Index)**:
     - Tính trung bình bộ ba chất lượng kèm xếp hạng học lực: *Xuất sắc (A+)*, *Tốt (A)*, *Khá (B)*, *Cần cải thiện (C)*.
- **Trình Thẩm định Ragas Trực tiếp (Live Interactive Inspector)**:
  - Phân hệ thử nghiệm nhanh dành cho chuyên gia pháp lý / y tế, kiểm thử ngay độ tin cậy của bất kỳ câu hỏi, câu trả lời và văn bản ngữ cảnh nào với phản hồi theo thời gian thực.
- **Bảng Phân tích Chi tiết Từng Mẫu (Per-Sample Diagnostics)**:
  - Hiển thị danh sách kiểm thử với khả năng mở rộng xem chi tiết: đối chiếu Generated Answer vs Gold Answer, danh sách từng Claim (Supported / Contradiction / Hallucination), và bảng xếp hạng bằng chứng truy xuất (Signal vs Noise).
- **Hệ thống API RESTful**:
  - `POST /api/v1/evaluation/run`: Chạy đánh giá batch benchmark kèm tham số `include_ragas` và `sample_limit`.
  - `GET /api/v1/evaluation/{experiment_id}/samples`: Truy vấn dữ liệu chẩn đoán chi tiết từng câu hỏi.
  - `POST /api/v1/evaluation/ragas/single`: Đánh giá nhanh Ragas cho 1 cặp hỏi-đáp tùy ý.

### 1.15. Lọc và Ẩn Dữ liệu Nhạy cảm (PII Masking — Nghị định 13/2023/NĐ-CP)
- **Bảo vệ Dữ liệu Cá nhân Chuẩn Quốc gia**: Tự động nhận diện và làm mờ (anonymize/mask) các định danh nhạy cảm của công dân Việt Nam trước khi gửi câu hỏi tới các mô hình ngôn ngữ lớn (Anthropic Claude, Ollama, vLLM), đáp ứng nghiêm ngặt **Nghị định 13/2023/NĐ-CP**:
  1. **Số CCCD / CMND**: Nhận diện số Căn cước công dân (12 chữ số) và Chứng minh nhân dân (9 chữ số) $\to$ `[CCCD: *******1234]`.
  2. **Số điện thoại Việt Nam**: Nhận diện các đầu số di động phổ biến (03x, 05x, 07x, 08x, 09x, +84) $\to$ `[SĐT: *******890]`.
  3. **Biển số xe cơ giới**: Nhận diện biển số ô tô và xe máy theo chuẩn pháp quy giao thông đường bộ Việt Nam (29A-123.45, 51F-1234, 43-B1...) $\to$ `[BIỂN SỐ XE: 29A-*****]`.
  4. **Mã số thuế (MST)**: Nhận diện mã số thuế doanh nghiệp và cá nhân (10 số hoặc 10-3 số) $\to$ `[MST: ******0405]`.
  5. **Mã hồ sơ bệnh án / Bệnh nhân**: Nhận diện định danh hồ sơ y tế theo chuẩn Bộ Y tế (BA-xxxxx, HSBA-xxxxx, BN-xxxxx) $\to$ `[MÃ BỆNH ÁN: BA-*****]`.
  6. **Địa chỉ Email cá nhân**: Nhận diện và che mờ địa chỉ email liên hệ $\to$ `[EMAIL: a***@domain.com]`.
- **Bảo mật Đa tầng**:
  - Tự động làm mờ tại Gateway trước khi phân rã DAG, trước khi gọi LLM và trước khi lưu vào Semantic Cache.
  - Phân hệ Admin Console cho phép bật/tắt linh hoạt từng loại thực thể nhạy cảm và kiểm thử trực quan với **Live Interactive Playground**.
- **API Endpoints**:
  - `GET /api/v1/admin/pii-config`: Đọc cấu hình bảo vệ PII hiện hành.
  - `POST /api/v1/admin/pii-config`: Cập nhật bật/tắt toàn hệ thống hoặc từng loại thực thể.
  - `POST /api/v1/admin/pii-test`: Kiểm thử nhận diện và làm mờ văn bản trực tiếp.

### 1.16. Nhật ký Kiểm toán (Audit Logs) & Báo cáo Tuân thủ Doanh nghiệp
- **Lưu vết Toàn diện (Comprehensive Audit Trail)**:
  - Bảng cơ sở dữ liệu `audit_logs` (hỗ trợ cả PostgreSQL và SQLite) ghi nhận chi tiết:
    - **Thời điểm**: Ngày giờ chính xác theo múi giờ địa phương `vi-VN`.
    - **Người dùng & Địa chỉ IP**: Tên tài khoản định danh qua JWT Token và IP máy trạm thực hiện truy vấn.
    - **Hành vi (Action)**: Tra cứu QA chuẩn (`qa_answer`), Stream thời gian thực SSE (`qa_answer_stream`), Tải tài liệu (`document_upload`), Xuất hồ sơ nghiệp vụ (`export_dossier`).
    - **Tài nguyên & Ngữ cảnh**: Nội dung câu hỏi truy vấn, miền nghiệp vụ (`legal` / `medical`), chi tiết thông tin file.
    - **Tokens & Tài nguyên**: Thống kê số lượng Prompt tokens, Completion tokens, Tổng tokens tiêu thụ và độ trễ phản hồi (latency ms).
    - **Trạng thái Tuân thủ**: Ghi nhận `success`, `error` và huy hiệu `🛡️ PII Masked` khi câu hỏi có chứa dữ liệu nhạy cảm đã được làm mờ.
- **Trực quan hóa tại Admin Console**:
  - 4 Thẻ KPI: *Tổng lượt truy vấn*, *Tổng Token tiêu thụ*, *Số người dùng hoạt động*, *Số lần Lọc PII An toàn*.
  - Bộ lọc thông minh theo hành vi, ô tìm kiếm toàn văn và phân trang dữ liệu.
  - Nút **Xuất CSV (Excel)** tương thích định dạng UTF-8 BOM hiển thị chuẩn xác tiếng Việt có dấu phục vụ thanh tra và báo cáo lãnh đạo.
- **API Endpoints**:
  - `GET /api/v1/admin/audit-logs`: Truy vấn danh sách nhật ký kiểm toán (phân trang, lọc action, tìm kiếm).
  - `GET /api/v1/admin/audit-logs/stats`: Thống kê tổng quan KPI kiểm toán.
  - `GET /api/v1/admin/audit-logs/export`: Tải xuống tệp CSV báo cáo tuân thủ hoàn chỉnh.

---

## 2. Kết quả Thực nghiệm Ablation (B0 → Q3)

Chạy thực nghiệm đánh giá trên **20 câu hỏi multi-hop phức tạp xuyên văn bản** lấy từ corpus thật 38 văn bản / 17,001 chunks (`candidates_real_legal_v7v8_draft.jsonl`):

| Chế độ (Mode) | Thuật toán cốt lõi | recall@8 | hit@8 | mrr@8 | ndcg@8 | hop_recall | citation P/R | Độ trễ p50 |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **B0** | `dense_rag` (Dense vector thuần) | 0.283 | 0.50 | 0.283 | 0.231 | 0.00 | 0.214 / 0.283 | 29s |
| **B1** | `hybrid_rag` (BM25 + Dense RRF) | 0.467 | 0.80 | 0.514 | 0.411 | 0.00 | 0.310 / 0.467 | 33s |
| **B2** | `hybrid_rerank` (Hybrid + Cross-Encoder) | 0.542 | 0.85 | 0.602 | 0.479 | 0.00 | 0.387 / 0.542 | 32s |
| **Q1** | `decomp_independent` (Phân rã độc lập) | **0.792** | **0.95** | 0.760 | **0.661** | 0.275 | 0.479 / **0.875** | 62s |
| **Q2** | `decomp_dependency` (Phân rã phụ thuộc DAG) | 0.683 | **0.95** | **0.775** | 0.609 | 0.250 | 0.443 / 0.808 | 73s |
| **Q3** | `videcomp_full` (Đầy đủ + Grounding Verifier) | 0.758 | **0.95** | **0.775** | 0.650 | **0.275** | **0.535** / 0.850 | 125s |

### Đánh giá khoa học:
1. **Hybrid Retrieval (B1, B2) vượt trội Dense thuần (B0)**: Hit rate tăng từ 50% lên 85% trên quy mô corpus lớn.
2. **Phân rã câu hỏi (Q1, Q2, Q3) cải thiện nhảy vọt so với RAG truyền thống**: Tỷ lệ tìm đúng tài liệu (hit@8) đạt tới **95%**, recall tăng gần gấp 3 lần so với B0.
3. **Q3 (ViDecomp-RAG Full Pipeline) đạt độ chính xác trích dẫn cao nhất (Precision = 53.5%)**: Bộ lọc kiểm chứng Grounding Verifier loại bỏ các trích dẫn sai lệch và ảo giác, đảm bảo tính căn cứ pháp lý cao nhất cho câu trả lời.

---

## 3. Kiến trúc Thư mục

```text
d:\videcomp-rag/
├── backend/
│   └── app/
│       ├── api/               # FastAPI routes (/qa/answer-stream, /index, /auth, /admin, /trace)
│       ├── core/              # Config, Semantic Cache (FAISS/SQLite), Task Queue, LLM providers (Anthropic, Ollama, vLLM), Law titles
│       ├── db/                # SQLAlchemy ORM models, session, repository (User, Trace, Annotation)
│       ├── schemas/           # Pydantic schemas chuẩn hóa dữ liệu I/O
│       └── services/          # Chunker, Retriever, Decomposer, Planner, Synthesizer, Verifier, Auth
├── frontend/
│   ├── src/
│   │   ├── api/               # API client tự động đính kèm JWT Bearer Token
│   │   ├── components/        # Sidebar, TopBar, AdminLoginModal, Composer, VoiceMode, Icons
│   │   ├── hooks/             # useAuth (quản lý phiên & RBAC), useHistory, useCustomAgents, useProjects
│   │   ├── styles/            # Hệ thống CSS Design Tokens & Cinematic Grid/Glow Utilities
│   │   └── views/             # LandingView, ChatView, AdminConsoleView, ExploreView, Builder, Workspace, Trace, Eval
│   └── package.json
├── data/
│   ├── raw/                   # Văn bản pháp luật & y tế gốc (.pdf, .html, .txt) + Manifest CSVs
│   ├── processed/             # Văn bản chuẩn hóa định dạng JSONL
│   ├── chunks/                # Chunks cấu trúc theo Điều/Khoản (17,001 chunks)
│   ├── indices/               # Chỉ mục BM25 và Vector FAISS
│   └── benchmark/             # Bộ câu hỏi đánh giá dev/test & candidate drafts
├── docx/                      # 3 tài liệu đặc tả đề cương và sổ tay kỹ thuật gốc
├── experiments/               # Kết quả thực nghiệm và báo cáo HTML tự động
├── scripts/                   # CLI scripts: ingest, chunk, build index, QA runner, evaluator, benchmark
├── tests/                     # Test suites tự động (pytest)
├── .env.example               # Mẫu biến môi trường
├── .gitignore                 # Cấu hình bỏ qua file nhạy cảm và build artifacts
├── docker-compose.yml         # Triển khai production (PostgreSQL, Qdrant, Redis)
├── requirements.txt           # Dependencies Python
└── README.md
```

---

## 4. Hướng dẫn Cài đặt & Khởi chạy

### 4.1. Khởi tạo Môi trường Python (Backend)

1. **Tạo virtual environment và cài đặt dependencies:**
   ```bash
   python -m venv .venv
   # Kích hoạt môi trường (Windows PowerShell):
   .venv\Scripts\Activate.ps1
   # Cài đặt thư viện:
   pip install -r requirements.txt
   ```

2. **Thiết lập biến môi trường:**
   Tạo file `.env` từ `.env.example`:
   ```env
   LLM_PROVIDER=anthropic             # hoặc openai, mock, openai_compatible
   ANTHROPIC_API_KEY=sk-ant-api03-... # Khóa API Claude (nếu dùng)
   OPENAI_API_KEY=sk-...              # Khóa API OpenAI (nếu dùng)
   JWT_SECRET=your_super_secret_jwt_key_here
   DB_DSN=sqlite:///data/videcomp.db
   ```

3. **Chạy Backend Server:**
   ```bash
   .venv\Scripts\python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
   ```
   Kiểm tra trạng thái server:
   ```bash
   curl http://127.0.0.1:8000/api/v1/health
   # Kết quả: {"status":"ok","config_version":"exp-dev-0"}
   ```

### 4.2. Khởi chạy Giao diện Frontend

1. **Mở terminal mới và chuyển vào thư mục frontend:**
   ```bash
   cd frontend
   npm install
   ```

2. **Khởi chạy máy chủ phát triển:**
   ```bash
   npm run dev
   ```
   Trình duyệt mở tại: `http://127.0.0.1:5173/`.

---

## 5. Tài khoản & Trải nghiệm Phân quyền (RBAC)

Hệ thống đã cấu hình sẵn cơ chế xác thực JWT và phân quyền:

| Tài khoản | Tên đăng nhập | Mật khẩu | Quyền hạn & Điều hướng |
| :--- | :--- | :--- | :--- |
| **Quản trị viên** | `admin` | `admin123` | Vào thẳng **Trang Quản trị (Admin Console)**, được phép đổi API Key, LLM Provider, xem cấu hình hệ thống. |
| **Người dùng mới** | *Tự đăng ký trên UI* | *Tuân thủ quy tắc 8+ ký tự* | Vào thẳng **Phòng Chat AI**, bị khóa khỏi Trang Quản trị. |

> **Tiêu chuẩn mật khẩu khi đăng ký:** Tối thiểu 8 ký tự, có ít nhất 1 chữ in hoa (`A-Z`), 1 chữ in thường (`a-z`), 1 chữ số (`0-9`) và 1 ký tự đặc biệt (`!@#$%^&*...`).

---

## 6. Lệnh Vận hành Dữ liệu & Đánh giá (CLI Tools)

### Xây dựng lại toàn bộ chỉ mục trên dữ liệu thật (17,001 chunks):
```bash
# 1. Ingest và tạo chunks
for V in "" _v2 _v3 _v4 _v5 _v6 _v7 _v8; do
  python scripts/ingest_documents.py --manifest data/raw/manifest_real_legal${V}.csv --out data/processed/documents_real_legal${V}.jsonl
  python scripts/build_chunks.py --input data/processed/documents_real_legal${V}.jsonl --domain legal --out data/chunks/legal_real${V}_chunks.jsonl
done

# 2. Gộp chunks
cat data/chunks/legal_real*_chunks.jsonl > data/chunks/legal_real_all_chunks.jsonl

# 3. Lập chỉ mục Hybrid
python scripts/build_bm25.py --chunks data/chunks/legal_real_all_chunks.jsonl --out data/indices/bm25_legal_real_all
python scripts/build_vector_index.py --chunks data/chunks/legal_real_all_chunks.jsonl --collection legal_real_all_v1 --out data/indices/legal_real_all_v1
```

### Chạy một câu hỏi Multi-hop trực tiếp bằng CLI:
```bash
python -m scripts.run_qa --mode videcomp_full \
  --question "Người lao động đơn phương chấm dứt hợp đồng lao động trái pháp luật thì phải bồi thường thiệt hại theo nguyên tắc nào của Bộ luật Dân sự?" \
  --domain legal \
  --bm25_dir data/indices/bm25_legal_real_all \
  --vector_dir data/indices/legal_real_all_v1 \
  --save_trace
```

### Chạy kiểm thử tự động (Unit & Integration Tests):
```bash
pytest -q
```

---

## 7. Xuất Báo cáo Chuyên nghiệp & Cộng tác Nhóm (Dossier & Collaboration)

### 7.1. Xuất Hồ sơ Thẩm định Chuyên nghiệp (Export Legal/Medical Dossier)
Hệ thống cung cấp tính năng **Xuất báo cáo** trực tiếp trên thanh công cụ phản hồi và thanh điều hướng:
- **Định dạng Microsoft Word (.docx)**: Tạo lập qua `python-docx` với viền trang hành chính (lề 2.0 cm), tiêu đề tổ chức, bảng ma trận căn cứ pháp lý, bảng kiểm chứng luận điểm đổi màu trạng thái (Xanh lá / Đỏ) và khung chữ ký xác nhận của chuyên viên và lãnh đạo.
- **Định dạng Adobe PDF (.pdf)**: Tạo lập qua `reportlab` nhúng font Unicode tiếng Việt (Arial TTF), bố cục bảo mật khóa cố định, tỷ lệ màu sắc chuẩn mực dùng gửi ngay cho khách hàng hoặc cơ quan quản lý.
- **Cấu trúc 6 phần chuẩn mực**:
  1. *Header & Thông tin vụ việc*: Mã phiên, ngày giờ thẩm định, chuyên ngành pháp luật / y khoa, chế độ phân rã.
  2. *Tóm tắt kết luận cốt lõi (Executive Summary)*: Định dạng khung viền nổi bật.
  3. *Cây suy luận từng bước (Multi-hop DAG)*: Câu hỏi con, kết luận trung gian, văn bản luật truy xuất.
  4. *Bảng trích dẫn căn cứ điều luật & phác đồ*: Mã điều, tên văn bản luật, trích đoạn nội dung.
  5. *Bảng đối chiếu mâu thuẫn & kiểm chứng luận điểm*: Trạng thái Hợp lệ (Supported) / Mâu thuẫn (Unsupported) / Thiếu căn cứ (Insufficient), tỷ lệ bảo đảm căn cứ (Faithfulness Rate).
  6. *Khung chữ ký xác nhận thẩm định*: Dành cho Chuyên viên thụ lý hồ sơ và Lãnh đạo phê duyệt có đóng dấu hoặc ký số PKI.

### 7.2. Cộng tác Nhóm & Phân quyền Chia sẻ (Multi-user Sharing & Shared Workspace)
- **Chia sẻ qua đường liên kết bảo mật (`share_token`)**: Bất kỳ phiên hỏi đáp hoặc thư mục dự án nào cũng có thể tạo liên kết truy cập nhanh. Người nhận chỉ cần mở link `/?share=TOKEN` để tự động nạp phiên làm việc.
- **Chế độ chia sẻ linh hoạt**:
  - *Công khai*: Bất kỳ ai có liên kết đều có thể truy cập với quyền **Chỉ xem (Viewer)**.
  - *Riêng tư & Mời thành viên*: Giới hạn truy cập cho danh sách đồng nghiệp được phân quyền qua username / email.
- **Phân quyền 2 cấp độ**:
  - **Chỉ xem (Viewer)**: Đọc nội dung trao đổi, xem chi tiết cây suy luận, bảng trích dẫn và tải báo cáo Word/PDF.
  - **Cùng thảo luận (Editor)**: Gửi thêm câu hỏi đào sâu, tiếp nối mạch suy luận, cập nhật ghi chú và lưu trữ phiên.
- **Quản lý liên kết**: Chủ sở hữu có thể thu hồi liên kết cũ bằng tính năng **Đổi mã liên kết (Regenerate Token)** bất kỳ lúc nào.

---

## 8. Giấy phép & Bản quyền
Dự án được nghiên cứu và phát triển phục vụ đề tài Luận văn Thạc sĩ Khoa học Máy tính / Công nghệ Thông tin về xử lý ngôn ngữ tự nhiên tiếng Việt chuyên ngành. Mọi quyền sở hữu trí tuệ và bản quyền mã nguồn được bảo lưu.

