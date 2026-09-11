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
│       ├── api/               # FastAPI routes (/qa, /index, /auth, /experiments, /trace)
│       ├── core/              # Config, JWT settings, LLM providers (Anthropic, OpenAI, Mock), Law titles
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

## 7. Giấy phép & Bản quyền
Dự án được nghiên cứu và phát triển phục vụ đề tài Luận văn Thạc sĩ Khoa học Máy tính / Công nghệ Thông tin về xử lý ngôn ngữ tự nhiên tiếng Việt chuyên ngành. Mọi quyền sở hữu trí tuệ và bản quyền mã nguồn được bảo lưu.
