import type {
  AnswerResult,
  Domain,
  ExperimentRecord,
  Mode,
  QARequest,
  SemanticCacheStats,
  StreamEvent,
  TraceRecord,
  UploadTaskProgress,
  ModelCatalogItem,
  ModelsConfigResponse,
  ModelsConfigUpdate,
  ModelsTestResponse,
  ShareConfig,
  SharedMember,
  SharedSessionDetail,
  SharedProjectDetail,
  RAGTriadResult,
  SampleEvaluationItem,
  SingleRagasRequest,
} from "./types";
import type { ProjectFolder } from "../types/project";
import type { CustomAgent } from "../types/agent";

const STORAGE_KEY = "videcomp.apiBaseUrl";

export function getApiBaseUrl(): string {
  return localStorage.getItem(STORAGE_KEY) || "http://localhost:8000";
}

export function setApiBaseUrl(url: string) {
  localStorage.setItem(STORAGE_KEY, url.replace(/\/$/, ""));
}

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Chuoi loi that backend tra ve khi domain chua co retriever trong AppState
 * (backend/app/api/routes.py::qa_answer) - dung de nhan biet va tu dong nap
 * index thay vi bat nguoi dung tu chay curl. */
export const INDEX_NOT_LOADED_DETAIL = "chua build index cho domain nay";

/** Đường dẫn index thật đã build sẵn cho từng domain (xem README mục Cài đặt
 * & chạy thử, bước 6b) — dùng để tự động nạp index lần đầu khi gặp lỗi
 * INDEX_NOT_LOADED_DETAIL, thay vì bắt người dùng tự gọi curl. */
export const DEFAULT_INDEX_PATHS: Record<Domain, { bm25Dir: string; vectorDir: string }> = {
  legal: { bm25Dir: "data/indices/bm25_legal_real_all", vectorDir: "data/indices/legal_real_all_v1" },
  medical: { bm25Dir: "data/indices/bm25_medical_real", vectorDir: "data/indices/medical_real_v1" },
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiBaseUrl();
  const token = localStorage.getItem("videcomp.token");
  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {
      /* ignore parse failure, keep statusText */
    }
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

export async function checkHealth(): Promise<{ status: string; config_version: string } | null> {
  try {
    return await request("/api/v1/health");
  } catch {
    return null;
  }
}

export function askQuestion(payload: QARequest): Promise<AnswerResult> {
  return request<AnswerResult>("/api/v1/qa/answer", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function askQuestionStream(
  payload: QARequest,
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal
): Promise<AnswerResult> {
  const base = getApiBaseUrl();
  const token = localStorage.getItem("videcomp.token");
  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const res = await fetch(`${base}/api/v1/qa/answer-stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, detail);
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error("Trình duyệt không hỗ trợ đọc Stream response body.");
  }

  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let finalResult: AnswerResult | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data:")) continue;
      const jsonStr = trimmed.slice(5).trim();
      if (!jsonStr) continue;

      try {
        const ev: StreamEvent = JSON.parse(jsonStr);
        onEvent(ev);
        if (ev.type === "done" && ev.result) {
          finalResult = ev.result;
        }
      } catch (err) {
        console.warn("Lỗi parse SSE event:", trimmed, err);
      }
    }
  }

  if (buffer.trim().startsWith("data:")) {
    try {
      const ev: StreamEvent = JSON.parse(buffer.trim().slice(5).trim());
      onEvent(ev);
      if (ev.type === "done" && ev.result) {
        finalResult = ev.result;
      }
    } catch {
      /* ignore */
    }
  }

  if (!finalResult) {
    throw new Error("Luồng kết nối kết thúc mà không nhận được kết quả hoàn chỉnh.");
  }

  return finalResult;
}

export function getCacheStats(): Promise<SemanticCacheStats> {
  return request<SemanticCacheStats>("/api/v1/admin/cache-stats");
}

export function clearSemanticCache(): Promise<{ status: string; message: string }> {
  return request<{ status: string; message: string }>("/api/v1/admin/cache-clear", {
    method: "POST",
  });
}

export function updateCacheConfig(config: {
  threshold?: number;
  enabled?: boolean;
}): Promise<{ status: string; message: string; stats: SemanticCacheStats }> {
  return request("/api/v1/admin/cache-config", {
    method: "POST",
    body: JSON.stringify(config),
  });
}

export function loadIndex(domain: Domain, bm25Dir: string, vectorDir: string): Promise<{ chunk_count: number }> {
  return request("/api/v1/index/load", {
    method: "POST",
    body: JSON.stringify({ domain, bm25_dir: bm25Dir, vector_dir: vectorDir }),
  });
}

export function fetchTrace(requestId: string): Promise<TraceRecord> {
  return request<TraceRecord>(`/api/v1/qa/${encodeURIComponent(requestId)}/trace`);
}

export function fetchExperiment(experimentId: string): Promise<ExperimentRecord> {
  return request<ExperimentRecord>(`/api/v1/evaluation/${encodeURIComponent(experimentId)}`);
}

export function fetchExperimentSamples(experimentId: string): Promise<SampleEvaluationItem[]> {
  return request<SampleEvaluationItem[]>(`/api/v1/evaluation/${encodeURIComponent(experimentId)}/samples`);
}

export function runEvaluation(
  datasetPath: string,
  mode: Mode,
  domain: Domain,
  includeRagas: boolean = true,
  sampleLimit?: number
): Promise<{
  experiment_id: string;
  mode: Mode;
  metrics: Record<string, number>;
  n_items: number;
  sample_evaluations?: SampleEvaluationItem[];
}> {
  const params = new URLSearchParams({
    dataset_path: datasetPath,
    mode,
    domain,
    include_ragas: String(includeRagas),
  });
  if (sampleLimit && sampleLimit > 0) {
    params.set("sample_limit", String(sampleLimit));
  }
  return request(`/api/v1/evaluation/run?${params.toString()}`, { method: "POST" });
}

export function evaluateSingleRagas(req: SingleRagasRequest): Promise<RAGTriadResult> {
  return request<RAGTriadResult>("/api/v1/evaluation/ragas/single", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
}

export async function uploadDocument(
  file: File,
  sessionId: string
): Promise<{ status: string; filename: string; size: number; chunk_count: number }> {
  const base = getApiBaseUrl();
  const formData = new FormData();
  formData.append("file", file);
  formData.append("session_id", sessionId);

  const res = await fetch(`${base}/api/v1/documents/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {}
    throw new ApiError(res.status, detail);
  }
  return res.json();
}

/**
 * Tải lên tài liệu lớn qua hàng đợi bất đồng bộ (Background Task Queue)
 * với thanh tiến trình phần trăm (0% -> 100%) và thông tin bước xử lý chi tiết.
 */
export async function uploadDocumentAsync(
  file: File,
  sessionId: string,
  onProgress?: (p: UploadTaskProgress) => void
): Promise<{ status: string; filename: string; size: number; chunk_count: number }> {
  const base = getApiBaseUrl();
  const formData = new FormData();
  formData.append("file", file);
  formData.append("session_id", sessionId);

  // 1. Gửi file tới endpoint bất đồng bộ
  const res = await fetch(`${base}/api/v1/documents/upload-async`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {}
    throw new ApiError(res.status, detail);
  }

  const initData = await res.json();
  const taskId = initData.task_id;

  onProgress?.({
    taskId,
    progress: 2,
    stage: "Đã đưa vào hàng đợi xử lý...",
    status: "pending",
    filename: file.name,
  });

  return new Promise((resolve, reject) => {
    let eventSource: EventSource | null = null;
    let pollInterval: number | null = null;
    let isDone = false;

    const cleanup = () => {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      if (pollInterval !== null) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };

    const handleUpdate = (task: any) => {
      if (isDone) return;
      onProgress?.({
        taskId: task.task_id,
        progress: task.progress ?? 0,
        stage: task.stage || "Đang xử lý...",
        status: task.status,
        filename: file.name,
        chunkCount: task.result?.chunk_count,
      });

      if (task.status === "completed") {
        isDone = true;
        cleanup();
        resolve(task.result || { status: "success", filename: file.name, size: file.size, chunk_count: 0 });
      } else if (task.status === "failed") {
        isDone = true;
        cleanup();
        reject(new Error(task.error || "Tác vụ xử lý tệp thất bại"));
      }
    };

    // 2. Kết nối Server-Sent Events (SSE) để nhận tiến trình liên tục
    try {
      eventSource = new EventSource(`${base}/api/v1/tasks/${encodeURIComponent(taskId)}/events`);
      eventSource.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          handleUpdate(data);
        } catch {}
      };
      eventSource.onerror = () => {
        // Fallback sang Polling định kỳ nếu SSE bị ngắt kết nối
        if (!isDone && !pollInterval) {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          pollInterval = window.setInterval(async () => {
            try {
              const t = await request<any>(`/api/v1/tasks/${encodeURIComponent(taskId)}`);
              handleUpdate(t);
            } catch (err) {
              cleanup();
              reject(err);
            }
          }, 600);
        }
      };
    } catch {
      // Fallback Polling
      pollInterval = window.setInterval(async () => {
        try {
          const t = await request<any>(`/api/v1/tasks/${encodeURIComponent(taskId)}`);
          handleUpdate(t);
        } catch (err) {
          cleanup();
          reject(err);
        }
      }, 600);
    }
  });
}

export async function fetchSessionFiles(
  sessionId: string
): Promise<{ session_id: string; files: any[]; chunk_count: number }> {
  return request(`/api/v1/documents/session/${encodeURIComponent(sessionId)}`);
}

export async function deleteSessionFile(sessionId: string, filename: string): Promise<void> {
  await request(`/api/v1/documents/session/${encodeURIComponent(sessionId)}/${encodeURIComponent(filename)}`, {
    method: "DELETE",
  });
}

export interface AdminConfig {
  llm_provider: string;
  anthropic_api_key_masked: string;
  has_anthropic_key: boolean;
  llm_base_url: string;
  llm_model: string;
  ollama_base_url?: string;
  ollama_model?: string;
  vllm_base_url?: string;
  vllm_model?: string;
  vllm_api_key_masked?: string;
  has_vllm_key?: boolean;
  config_version: string;
}

export async function getAdminConfig(): Promise<AdminConfig> {
  return request("/api/v1/admin/config");
}

export async function updateAdminConfig(payload: {
  anthropic_api_key?: string;
  llm_provider?: string;
  llm_base_url?: string;
  llm_api_key?: string;
  llm_model?: string;
  ollama_base_url?: string;
  ollama_model?: string;
  vllm_base_url?: string;
  vllm_model?: string;
  vllm_api_key?: string;
}): Promise<{
  status: string;
  message: string;
  llm_provider: string;
  anthropic_api_key_masked?: string;
  ollama_base_url?: string;
  ollama_model?: string;
  vllm_base_url?: string;
  vllm_model?: string;
}> {
  return request("/api/v1/admin/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function testApiKey(
  provider: string,
  apiKey?: string,
  baseUrl?: string,
  model?: string
): Promise<{ status: string; message: string; models?: string[] }> {
  return request("/api/v1/admin/test-api-key", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, api_key: apiKey, base_url: baseUrl, model }),
  });
}

export async function fetchLocalModels(
  provider: "ollama" | "vllm" = "ollama",
  baseUrl?: string
): Promise<string[]> {
  const params = new URLSearchParams({ provider });
  if (baseUrl) params.set("base_url", baseUrl);
  const res = await request<{ provider: string; models: string[] }>(
    `/api/v1/admin/local-models?${params.toString()}`
  );
  return res.models || [];
}

export interface AuthResponse {
  status: string;
  message: string;
  access_token: string;
  token_type: string;
  user: {
    username: string;
    email: string;
    name: string;
    role: "admin" | "user";
  };
}

export async function apiLogin(username: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function apiRegister(data: {
  username: string;
  email: string;
  password: string;
  confirm_password: string;
  full_name?: string;
}): Promise<AuthResponse> {
  return request<AuthResponse>("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function apiGetMe(): Promise<{ username: string; email: string; name: string; role: "admin" | "user" }> {
  return request("/api/v1/auth/me");
}

// ==========================================
// 1. SESSIONS API (Lưu trữ lịch sử chat PostgreSQL)
// ==========================================

export interface BackendSession {
  sessionId: string;
  title: string;
  domain: Domain;
  mode: Mode;
  folderId?: string | null;
  turns: any[];
  lastCreatedAt: string;
  isShared?: boolean;
  isPublic?: boolean;
  shareToken?: string;
  sharedWith?: SharedMember[];
  owner?: string;
}

export async function apiGetSessions(): Promise<BackendSession[]> {
  return request<BackendSession[]>("/api/v1/sessions");
}

export async function apiSaveSession(payload: {
  session_id: string;
  title?: string;
  domain?: Domain;
  mode?: Mode;
  folder_id?: string | null;
  turns: any[];
}): Promise<{ status: string; sessionId: string; title: string; turnsCount: number }> {
  return request("/api/v1/sessions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function apiDeleteSession(sessionId: string): Promise<{ status: string; message: string }> {
  return request(`/api/v1/sessions/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
  });
}

export async function apiAssignSessionFolder(
  sessionId: string,
  folderId: string | null
): Promise<{ status: string; folderId: string | null }> {
  return request(`/api/v1/sessions/${encodeURIComponent(sessionId)}/folder`, {
    method: "PUT",
    body: JSON.stringify({ folder_id: folderId }),
  });
}

export async function apiSetSessionFeedback(
  sessionId: string,
  requestId: string,
  feedback: "up" | "down"
): Promise<{ status: string; updated: boolean }> {
  return request(`/api/v1/sessions/${encodeURIComponent(sessionId)}/feedback`, {
    method: "POST",
    body: JSON.stringify({ request_id: requestId, feedback }),
  });
}

export async function apiGetSessionShare(sessionId: string): Promise<ShareConfig> {
  return request<ShareConfig>(`/api/v1/sessions/${encodeURIComponent(sessionId)}/share`);
}

export async function apiUpdateSessionShare(
  sessionId: string,
  payload: { is_public?: boolean; shared_with?: SharedMember[]; regenerate_token?: boolean }
): Promise<ShareConfig> {
  return request<ShareConfig>(`/api/v1/sessions/${encodeURIComponent(sessionId)}/share`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function apiGetSharedSession(shareToken: string): Promise<SharedSessionDetail> {
  return request<SharedSessionDetail>(`/api/v1/share/session/${encodeURIComponent(shareToken)}`);
}

export async function apiDownloadSessionDossier(
  sessionId: string,
  format: "docx" | "pdf",
  turnIndex: number = -1,
  customTitle?: string
): Promise<void> {
  const base = getApiBaseUrl();
  const token = localStorage.getItem("videcomp.token");
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const query = new URLSearchParams({
    format,
    turn_index: String(turnIndex),
  });
  if (customTitle) query.set("title", customTitle);

  const res = await fetch(`${base}/api/v1/sessions/${encodeURIComponent(sessionId)}/export?${query.toString()}`, {
    headers,
  });
  if (!res.ok) throw new Error("Không thể xuất báo cáo thẩm định.");
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") || "";
  let filename = `Bao_cao_Tham_dinh_${sessionId.slice(0, 8)}.${format}`;
  const match = disposition.match(/filename="?([^";]+)"?/);
  if (match) filename = decodeURIComponent(match[1]);

  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(blobUrl);
}

export async function apiDownloadStandaloneDossier(payload: {
  format: "docx" | "pdf";
  session_data: any;
  turn_index?: number;
  custom_title?: string;
}): Promise<void> {
  const base = getApiBaseUrl();
  const token = localStorage.getItem("videcomp.token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${base}/api/v1/export/dossier`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Không thể xuất báo cáo thẩm định.");
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") || "";
  let filename = `Bao_cao_Tham_dinh.${payload.format}`;
  const match = disposition.match(/filename="?([^";]+)"?/);
  if (match) filename = decodeURIComponent(match[1]);

  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(blobUrl);
}

// ==========================================
// 2. PROJECTS API (Thư mục dự án PostgreSQL)
// ==========================================

export async function apiGetProjects(): Promise<ProjectFolder[]> {
  return request<ProjectFolder[]>("/api/v1/projects");
}

export async function apiCreateProject(payload: {
  id?: string;
  title: string;
  desc?: string;
  icon?: string;
  color?: string;
}): Promise<ProjectFolder> {
  return request<ProjectFolder>("/api/v1/projects", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function apiUpdateProject(
  projectId: string,
  updates: Partial<Omit<ProjectFolder, "id" | "createdAt">>
): Promise<ProjectFolder> {
  return request<ProjectFolder>(`/api/v1/projects/${encodeURIComponent(projectId)}`, {
    method: "PUT",
    body: JSON.stringify(updates),
  });
}

export async function apiDeleteProject(projectId: string): Promise<{ status: string; message: string }> {
  return request(`/api/v1/projects/${encodeURIComponent(projectId)}`, {
    method: "DELETE",
  });
}

export async function apiGetProjectShare(projectId: string): Promise<ShareConfig> {
  return request<ShareConfig>(`/api/v1/projects/${encodeURIComponent(projectId)}/share`);
}

export async function apiUpdateProjectShare(
  projectId: string,
  payload: { is_public?: boolean; shared_with?: SharedMember[]; regenerate_token?: boolean }
): Promise<ShareConfig> {
  return request<ShareConfig>(`/api/v1/projects/${encodeURIComponent(projectId)}/share`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function apiGetSharedProject(shareToken: string): Promise<SharedProjectDetail> {
  return request<SharedProjectDetail>(`/api/v1/share/project/${encodeURIComponent(shareToken)}`);
}

// ==========================================
// 3. CUSTOM AGENTS API (Chuyên gia tùy chỉnh PostgreSQL)
// ==========================================

export async function apiGetAgents(): Promise<CustomAgent[]> {
  return request<CustomAgent[]>("/api/v1/agents");
}

export async function apiSaveAgent(
  agent: CustomAgent
): Promise<{ status: string; id: string; name: string; updatedAt: string }> {
  return request("/api/v1/agents", {
    method: "POST",
    body: JSON.stringify({
      id: agent.id,
      name: agent.name,
      desc: agent.desc,
      author: agent.author,
      domain: agent.domain,
      category: agent.category,
      instructions: agent.instructions,
      starters: agent.starters,
      icon: agent.icon,
      session_id: agent.sessionId,
      knowledge_files: agent.knowledgeFiles,
    }),
  });
}

export async function apiDeleteAgent(agentId: string): Promise<{ status: string; message: string }> {
  return request(`/api/v1/agents/${encodeURIComponent(agentId)}`, {
    method: "DELETE",
  });
}

// ==========================================
// 4. VIETNAMESE EMBEDDING, RERANKER & OCR API
// ==========================================

export async function apiGetModelsConfig(): Promise<ModelsConfigResponse> {
  return request<ModelsConfigResponse>("/api/v1/admin/models-config");
}

export async function apiUpdateModelsConfig(payload: ModelsConfigUpdate): Promise<ModelsConfigResponse> {
  return request<ModelsConfigResponse>("/api/v1/admin/models-config", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function apiTestModels(sampleText?: string, candidateTexts?: string[]): Promise<ModelsTestResponse> {
  return request<ModelsTestResponse>("/api/v1/admin/models-test", {
    method: "POST",
    body: JSON.stringify({ sample_text: sampleText, candidate_texts: candidateTexts }),
  });
}

export { ApiError };


