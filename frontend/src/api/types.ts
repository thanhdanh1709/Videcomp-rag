// Mirrors backend/app/schemas/*.py — keep in sync with the FastAPI models.

export type Domain = "legal" | "medical";

export type Mode =
  | "dense_rag"
  | "hybrid_rag"
  | "hybrid_rerank"
  | "decomp_independent"
  | "decomp_dependency"
  | "videcomp_full";

export const MODE_LABEL: Record<Mode, string> = {
  dense_rag: "Tìm theo nghĩa (B0)",
  hybrid_rag: "Tìm từ khóa + theo nghĩa (B1)",
  hybrid_rerank: "Tìm kết hợp + xếp hạng lại (B2)",
  decomp_independent: "Phân rã câu hỏi — song song (Q1)",
  decomp_dependency: "Phân rã câu hỏi — tuần tự (Q2)",
  videcomp_full: "Phân rã + kiểm chứng đầy đủ (Q3)",
};

/** Mô tả 1 dòng cho từng mode — hiện dưới dropdown chọn mode để người dùng
 * biết đang chọn cái gì, không chỉ thấy mã B0/B1/.../Q3 khó hiểu. */
export const MODE_DESCRIPTION: Record<Mode, string> = {
  dense_rag: "Truy hồi bằng vector nghĩa (dense) — nhanh nhất nhưng kém chính xác nhất, không phân rã câu hỏi.",
  hybrid_rag: "Kết hợp tìm từ khóa (BM25) và tìm theo nghĩa (dense) qua Reciprocal Rank Fusion.",
  hybrid_rerank: "Như trên, có thêm bước xếp hạng lại (cross-encoder) để tăng độ chính xác truy hồi.",
  decomp_independent:
    "Tách câu hỏi phức tạp thành nhiều câu hỏi con, thực thi song song rồi tổng hợp — phù hợp câu hỏi đa bước.",
  decomp_dependency:
    "Tách câu hỏi thành các bước phụ thuộc nhau (bước sau dùng kết quả bước trước) — cho câu hỏi cần suy luận theo chuỗi.",
  videcomp_full:
    "Phân rã câu hỏi + kiểm chứng từng luận điểm có căn cứ, tự truy hồi bổ sung nếu thiếu — chính xác nhất, chậm nhất. Khuyến nghị dùng mặc định.",
};

export const MODE_GROUP: Record<Mode, "baseline" | "decomp"> = {
  dense_rag: "baseline",
  hybrid_rag: "baseline",
  hybrid_rerank: "baseline",
  decomp_independent: "decomp",
  decomp_dependency: "decomp",
  videcomp_full: "decomp",
};

export const DOMAIN_LABEL: Record<Domain, string> = {
  legal: "Pháp luật",
  medical: "Y tế",
};

export interface QARequest {
  question: string;
  domain: Domain;
  mode: Mode;
  top_k: number;
  rerank_top_k: number;
  max_corrective_rounds: number;
  session_id?: string;
  web_search?: boolean;
}

export interface UploadedFile {
  filename: string;
  size: number;
  chunk_count: number;
}

export interface UploadTaskProgress {
  taskId: string;
  progress: number;
  stage: string;
  status: "pending" | "processing" | "completed" | "failed";
  filename?: string;
  chunkCount?: number;
  error?: string;
}

export type ClaimSupport = "supported" | "unsupported" | "insufficient";

export interface Citation {
  key: string;
  chunk_id: string;
  source_url: string | null;
  // Lam giau o backend (core/law_titles.py) tu doc_id + parent_path — co the
  // null neu chunk_id khong khop evidence nao trong memory (hiem gap).
  law_name: string | null;
  citation_label: string | null; // vd "Khoản 1 Điều 260 Bộ luật Hình sự số 100/2015/QH13"
  article_title: string | null; // vd "Tội vi phạm quy định về tham gia giao thông đường bộ"
}

export interface HopTraceEntry {
  hop_id: string;
  question: string;
  bound_question: string;
  evidence_ids: string[];
  intermediate_answer: string;
}

export interface ClaimVerification {
  claim: string;
  status: ClaimSupport;
  citations: string[];
}

export interface VerificationReport {
  claim_results: ClaimVerification[];
  supported_claim_rate: number;
  status: "pass" | "fail";
  corrective_rounds_used: number;
}

export interface SubQuestion {
  id: string;
  question: string;
  depends_on: string[];
  output_var: string | null;
  bind: Record<string, string>;
}

export interface QueryPlan {
  original_question: string;
  reasoning_type: string;
  subquestions: SubQuestion[];
  expected_hops: number;
}

export interface AnswerResult {
  request_id: string;
  question: string;
  query_plan: QueryPlan | null;
  hop_trace: HopTraceEntry[];
  final_answer: string;
  citations: Citation[];
  verification: VerificationReport | null;
  latency_ms: number;
  config_version: string;
  is_cached?: boolean;
  cache_similarity?: number;
  cached_question?: string;
}

export interface TraceRecord {
  request_id: string;
  question: string;
  domain: Domain;
  mode: Mode;
  query_plan: QueryPlan | null;
  hop_trace: HopTraceEntry[];
  final_answer: string;
  citations: Citation[];
  verification: VerificationReport | null;
  latency_ms: number;
  config_version: string;
  created_at: string;
  is_cached?: boolean;
  cache_similarity?: number;
}

export interface HopDoc {
  chunk_id: string;
  doc_id: string;
  law_name: string;
  citation_label: string;
  article_title: string;
  score: number;
}

export interface PlanHop {
  id: string;
  question: string;
  depends_on?: string[];
  reasoning_type?: string;
}

export interface LiveHopState {
  id: string;
  question: string;
  bound_question?: string;
  status: "pending" | "running" | "done";
  docs: HopDoc[];
  intermediate_answer?: string;
}

export type StreamEventType =
  | "step"
  | "plan"
  | "hop_start"
  | "hop_retrieval"
  | "hop_done"
  | "token"
  | "verification"
  | "done"
  | "cache_hit"
  | "error";

export interface StreamEvent {
  type: StreamEventType;
  step?: string;
  message?: string;
  hops?: PlanHop[];
  plan?: any;
  hop_id?: string;
  question?: string;
  bound_question?: string;
  docs?: HopDoc[];
  intermediate_answer?: string;
  token?: string;
  verification?: VerificationReport;
  result?: AnswerResult;
  similarity?: number;
  cached_question?: string;
  latency_ms?: number;
}

export interface SemanticCacheStats {
  enabled: boolean;
  threshold: number;
  total_entries: number;
  total_hits: number;
  hit_rate_pct: number;
  saved_cost_usd: number;
  db_path: string;
}

export interface ExperimentRecord {
  experiment_id: string;
  mode: Mode;
  dataset_path: string;
  n_items: number;
  metrics: Record<string, number>;
  config_version: string;
  created_at: string;
}

export interface ModelCatalogItem {
  id: string;
  name: string;
  label: string;
  dim?: number;
  max_length?: number;
  badge?: string;
  description: string;
}

export interface ModelsConfigResponse {
  status: string;
  active_embedding_model: string;
  active_embedding_dim: number;
  active_reranker_model: string;
  enable_pdf_table_extraction: boolean;
  enable_vision_ocr: boolean;
  vision_model: string;
  available_embedding_models: ModelCatalogItem[];
  available_reranker_models: ModelCatalogItem[];
}

export interface ModelsConfigUpdate {
  embedding_model?: string;
  reranker_model?: string;
  enable_pdf_table_extraction?: boolean;
  enable_vision_ocr?: boolean;
  vision_model?: string;
}

export interface ModelsTestResponse {
  status: string;
  sample_text: string;
  embedding: {
    model: string;
    dim: number;
    norm: number;
    preview: number[];
    latency_ms: number;
  };
  reranker: {
    model: string;
    latency_ms: number;
    ranked_candidates: {
      rank: number;
      score: number;
      text: string;
    }[];
  };
}

