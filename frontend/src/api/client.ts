import type { AnswerResult, Domain, ExperimentRecord, Mode, QARequest, TraceRecord } from "./types";

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

export function runEvaluation(datasetPath: string, mode: Mode, domain: Domain): Promise<{
  experiment_id: string;
  mode: Mode;
  metrics: Record<string, number>;
  n_items: number;
}> {
  const params = new URLSearchParams({ dataset_path: datasetPath, mode, domain });
  return request(`/api/v1/evaluation/run?${params.toString()}`, { method: "POST" });
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
}): Promise<{ status: string; message: string; llm_provider: string; anthropic_api_key_masked: string }> {
  return request("/api/v1/admin/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function testApiKey(
  provider: string,
  apiKey: string
): Promise<{ status: string; message: string }> {
  return request("/api/v1/admin/test-api-key", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, api_key: apiKey }),
  });
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

export { ApiError };

