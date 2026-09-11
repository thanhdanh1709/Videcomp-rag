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
  has_pii?: boolean;
  pii_entities?: any[];
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
  sample_evaluations?: SampleEvaluationItem[];
}

export interface ClaimItem {
  claim: string;
  status: "supported" | "unsupported" | "insufficient";
  evidence_snippet?: string;
  reasoning?: string;
}

export interface FaithfulnessResult {
  score: number;
  total_claims: number;
  supported_claims: number;
  unsupported_claims: number;
  insufficient_claims: number;
  claims: ClaimItem[];
  verdict: string;
}

export interface AnswerRelevanceResult {
  score: number;
  rubric_score: number;
  semantic_similarity: number;
  reasoning: string;
  verdict: string;
}

export interface ContextItem {
  rank: number;
  chunk_id: string;
  snippet: string;
  is_relevant: boolean;
  reason: string;
}

export interface ContextPrecisionResult {
  score: number;
  k: number;
  relevant_contexts_count: number;
  total_contexts_count: number;
  contexts: ContextItem[];
  verdict: string;
}

export interface RAGTriadResult {
  faithfulness: FaithfulnessResult;
  answer_relevance: AnswerRelevanceResult;
  context_precision: ContextPrecisionResult;
  rag_triad_index: number;
  grade: string;
}

export interface SampleEvaluationItem {
  id: string;
  question: string;
  gold_answer?: string;
  generated_answer: string;
  faithfulness: number;
  answer_relevance: number;
  context_precision: number;
  rag_triad_index: number;
  grade: string;
  claims: ClaimItem[];
  contexts: ContextItem[];
  relevance_reasoning?: string;
}

export interface SingleRagasRequest {
  question: string;
  answer: string;
  contexts?: any[];
  gold_chunk_ids?: string[];
  domain?: Domain;
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

// ==========================================
// COLLABORATION & SHARING TYPES
// ==========================================

export interface SharedMember {
  username: string;
  role: "viewer" | "editor";
  shared_at?: string;
}

export interface ShareConfig {
  sessionId?: string;
  projectId?: string;
  title: string;
  isPublic: boolean;
  shareToken?: string;
  sharedWith: SharedMember[];
  owner: string;
  isOwner?: boolean;
}

export interface SharedSessionDetail {
  sessionId: string;
  title: string;
  domain: Domain;
  mode: Mode;
  folderId?: string | null;
  turns: any[];
  lastCreatedAt: string;
  owner: string;
  isPublic: boolean;
  shareToken?: string;
  userRole: "owner" | "editor" | "viewer";
  canEdit: boolean;
}

export interface SharedProjectDetail {
  project: {
    id: string;
    title: string;
    desc: string;
    icon: string;
    color: string;
    createdAt: string;
    owner: string;
    isPublic: boolean;
    shareToken?: string;
    userRole: "owner" | "editor" | "viewer";
    canEdit: boolean;
  };
  sessions: {
    sessionId: string;
    title: string;
    domain: Domain;
    mode: Mode;
    folderId?: string;
    turnsCount: number;
    lastCreatedAt: string;
  }[];
}

export interface DossierExportOptions {
  format: "docx" | "pdf";
  title?: string;
  turnIndex?: number;
}

export interface AuditLogItem {
  id: number;
  username: string;
  ip_address: string;
  action: string;
  domain?: string;
  resource: string;
  details: Record<string, any>;
  tokens_prompt: number;
  tokens_completion: number;
  tokens_total: number;
  latency_ms: number;
  status: "success" | "error" | "masked";
  created_at: string;
}

export interface AuditLogsResponse {
  total: number;
  limit: number;
  offset: number;
  logs: AuditLogItem[];
}

export interface AuditStatsResponse {
  total_queries: number;
  total_logs: number;
  total_tokens: number;
  active_users: number;
  pii_masked_count: number;
  action_counts: Record<string, number>;
  tokens_by_user: { username: string; tokens: number }[];
}

export interface PIIConfigResponse {
  status: string;
  enable_pii_masking: boolean;
  pii_mask_cccd: boolean;
  pii_mask_phone: boolean;
  pii_mask_license_plate: boolean;
  pii_mask_tax_id: boolean;
  pii_mask_medical_record: boolean;
  pii_mask_email: boolean;
  compliance_standard: string;
}

export interface PIIConfigUpdate {
  enable_pii_masking?: boolean;
  pii_mask_cccd?: boolean;
  pii_mask_phone?: boolean;
  pii_mask_license_plate?: boolean;
  pii_mask_tax_id?: boolean;
  pii_mask_medical_record?: boolean;
  pii_mask_email?: boolean;
}

export interface PIITestResponse {
  masked_text: string;
  detected_entities: {
    pii_type: string;
    original_value: string;
    masked_value: string;
    start: number;
    end: number;
    label: string;
  }[];
  has_pii: boolean;
  entity_counts: Record<string, number>;
}



