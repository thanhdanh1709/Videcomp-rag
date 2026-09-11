import { useState, useEffect } from "react";
import {
  getAdminConfig,
  updateAdminConfig,
  testApiKey,
  fetchLocalModels,
  getCacheStats,
  clearSemanticCache,
  updateCacheConfig,
  apiGetModelsConfig,
  apiUpdateModelsConfig,
  apiTestModels,
  type AdminConfig,
} from "../api/client";
import type { ModelsConfigResponse, ModelsTestResponse, SemanticCacheStats } from "../api/types";


interface Member {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "member";
  models: string;
  lastActive: string;
  tokens: string;
  avatarText: string;
}

const INITIAL_MEMBERS: Member[] = [
  {
    id: "m-1",
    name: "Nguyễn Hoàng Nam",
    email: "nam.nguyen@techcorp.vn",
    role: "owner",
    models: "Claude 3.5 Sonnet, Qwen 2.5 14B",
    lastActive: "Vừa xong",
    tokens: "2.4M tokens",
    avatarText: "HN",
  },
  {
    id: "m-2",
    name: "Trần Minh Anh",
    email: "anh.tran@techcorp.vn",
    role: "admin",
    models: "Qwen 2.5 32B, Vistral 7B",
    lastActive: "15 phút trước",
    tokens: "890K tokens",
    avatarText: "MA",
  },
  {
    id: "m-3",
    name: "Lê Quốc Bảo",
    email: "bao.le@techcorp.vn",
    role: "member",
    models: "PhoGPT, Qwen 2.5 14B",
    lastActive: "2 giờ trước",
    tokens: "512K tokens",
    avatarText: "QB",
  },
  {
    id: "m-4",
    name: "Đặng Phương Linh",
    email: "linh.dang@techcorp.vn",
    role: "member",
    models: "Claude 3.5 Sonnet, Canvas",
    lastActive: "Hôm qua",
    tokens: "1.4M tokens",
    avatarText: "PL",
  },
  {
    id: "m-5",
    name: "Vũ Gia Huy",
    email: "huy.vu@techcorp.vn",
    role: "member",
    models: "Vistral 7B, Browsing",
    lastActive: "3 ngày trước",
    tokens: "320K tokens",
    avatarText: "GH",
  },
];

export function AdminConsoleView({
  onShowToast,
  onLogout,
}: {
  onShowToast?: (msg: string) => void;
  onLogout?: () => void;
}) {
  // Quản lý API Key state & On-Premise Providers
  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [newAnthropicKey, setNewAnthropicKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState("anthropic");
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ status: string; message: string } | null>(null);

  // Cấu hình Ollama On-Premise
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState("http://localhost:11434");
  const [ollamaModel, setOllamaModel] = useState("qwen2.5:14b");
  const [installedOllamaModels, setInstalledOllamaModels] = useState<string[]>([]);
  const [isScanningModels, setIsScanningModels] = useState(false);

  // Cấu hình vLLM Cluster
  const [vllmBaseUrl, setVllmBaseUrl] = useState("http://localhost:8000/v1");
  const [vllmModel, setVllmModel] = useState("Qwen/Qwen2.5-14B-Instruct");
  const [vllmApiKey, setVllmApiKey] = useState("");

  // Time filter analytics
  const [timeFilter, setTimeFilter] = useState<"30d" | "7d" | "24h">("30d");

  // Toggles chính sách bảo mật
  const [retentionDays, setRetentionDays] = useState(90);
  const [isRetentionActive, setIsRetentionActive] = useState(true);
  const [isSamlActive, setIsSamlActive] = useState(true);

  // Danh sách thành viên
  const [members, setMembers] = useState<Member[]>(INITIAL_MEMBERS);
  const [memberFilter, setMemberFilter] = useState<"all" | "admin" | "member" | "pending">("all");
  const [searchMember, setSearchMember] = useState("");

  // Modal mời thành viên mới
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");

  // Cấu hình Bộ đệm Ngữ nghĩa (Semantic Cache)
  const [cacheStats, setCacheStats] = useState<SemanticCacheStats | null>(null);
  const [cacheThreshold, setCacheThreshold] = useState(0.93);
  const [isCacheEnabled, setIsCacheEnabled] = useState(true);
  const [isSavingCacheConfig, setIsSavingCacheConfig] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);

  // Cấu hình Mô hình Embedding & Reranker Tiếng Việt & OCR Đa phương thái
  const [modelsConfig, setModelsConfig] = useState<ModelsConfigResponse | null>(null);
  const [selectedEmbeddingModel, setSelectedEmbeddingModel] = useState("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2");
  const [selectedRerankerModel, setSelectedRerankerModel] = useState("cross-encoder/mmarco-mMiniLMv2-L12-H384-v1");
  const [enablePdfTableExtraction, setEnablePdfTableExtraction] = useState(true);
  const [enableVisionOcr, setEnableVisionOcr] = useState(true);
  const [visionModel, setVisionModel] = useState("claude-3-5-sonnet-20241022");
  const [isSavingModelsConfig, setIsSavingModelsConfig] = useState(false);
  const [isTestingModels, setIsTestingModels] = useState(false);
  const [modelsTestResult, setModelsTestResult] = useState<ModelsTestResponse | null>(null);
  const [customSampleText, setCustomSampleText] = useState("");

  // Đọc cấu hình API Key, Local LLM, Semantic Cache và Models từ backend khi nạp view
  useEffect(() => {
    getAdminConfig()
      .then((res) => {
        setConfig(res);
        setSelectedProvider(res.llm_provider || "anthropic");
        if (res.ollama_base_url) setOllamaBaseUrl(res.ollama_base_url);
        if (res.ollama_model) setOllamaModel(res.ollama_model);
        if (res.vllm_base_url) setVllmBaseUrl(res.vllm_base_url);
        if (res.vllm_model) setVllmModel(res.vllm_model);
      })
      .catch(() => {});

    getCacheStats()
      .then((s) => {
        setCacheStats(s);
        setCacheThreshold(s.threshold);
        setIsCacheEnabled(s.enabled);
      })
      .catch(() => {});

    apiGetModelsConfig()
      .then((m) => {
        setModelsConfig(m);
        setSelectedEmbeddingModel(m.active_embedding_model);
        setSelectedRerankerModel(m.active_reranker_model);
        setEnablePdfTableExtraction(m.enable_pdf_table_extraction);
        setEnableVisionOcr(m.enable_vision_ocr);
        setVisionModel(m.vision_model || "claude-3-5-sonnet-20241022");
      })
      .catch(() => {});
  }, []);

  const handleSaveModelsConfig = async () => {
    setIsSavingModelsConfig(true);
    try {
      const res = await apiUpdateModelsConfig({
        embedding_model: selectedEmbeddingModel,
        reranker_model: selectedRerankerModel,
        enable_pdf_table_extraction: enablePdfTableExtraction,
        enable_vision_ocr: enableVisionOcr,
        vision_model: visionModel,
      });
      setModelsConfig(res);
      onShowToast?.("Cập nhật Mô hình Tiếng Việt & OCR thành công!");
    } catch (err: any) {
      onShowToast?.("Lỗi cập nhật mô hình: " + (err.message || ""));
    } finally {
      setIsSavingModelsConfig(false);
    }
  };

  const handleTestModels = async () => {
    setIsTestingModels(true);
    setModelsTestResult(null);
    try {
      const res = await apiTestModels(customSampleText.trim() || undefined);
      setModelsTestResult(res);
      onShowToast?.("Kiểm tra mô hình tiếng Việt thành công!");
    } catch (err: any) {
      onShowToast?.("Lỗi kiểm thử mô hình: " + (err.message || ""));
    } finally {
      setIsTestingModels(false);
    }
  };


  const handleSaveCacheConfig = async () => {
    setIsSavingCacheConfig(true);
    try {
      const res = await updateCacheConfig({
        threshold: cacheThreshold,
        enabled: isCacheEnabled,
      });
      setCacheStats(res.stats);
      onShowToast?.("Đã lưu cấu hình Bộ đệm Ngữ nghĩa thành công!");
    } catch (err: any) {
      onShowToast?.("Lỗi cập nhật cấu hình cache: " + (err.message || ""));
    } finally {
      setIsSavingCacheConfig(false);
    }
  };

  const handleClearCache = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa toàn bộ bản ghi bộ đệm ngữ nghĩa?")) return;
    setIsClearingCache(true);
    try {
      await clearSemanticCache();
      const updatedStats = await getCacheStats();
      setCacheStats(updatedStats);
      onShowToast?.("Đã xóa sạch toàn bộ bản ghi trong Bộ đệm Ngữ nghĩa!");
    } catch (err: any) {
      onShowToast?.("Lỗi xóa cache: " + (err.message || ""));
    } finally {
      setIsClearingCache(false);
    }
  };

  const handleScanOllamaModels = async () => {
    setIsScanningModels(true);
    try {
      const models = await fetchLocalModels("ollama", ollamaBaseUrl);
      setInstalledOllamaModels(models);
      if (models.length > 0) {
        onShowToast?.(`Đã tìm thấy ${models.length} mô hình trên Ollama On-Premise!`);
        if (!models.includes(ollamaModel)) {
          setOllamaModel(models[0]);
        }
      } else {
        onShowToast?.("Chưa phát hiện mô hình nào hoặc Ollama chưa được bật.");
      }
    } catch {
      onShowToast?.("Không thể kết nối tới Ollama tại " + ollamaBaseUrl);
    } finally {
      setIsScanningModels(false);
    }
  };

  const handleSaveConfig = async () => {
    setIsSavingKey(true);
    try {
      const res = await updateAdminConfig({
        anthropic_api_key: newAnthropicKey.trim() || undefined,
        llm_provider: selectedProvider,
        ollama_base_url: ollamaBaseUrl.trim() || undefined,
        ollama_model: ollamaModel.trim() || undefined,
        vllm_base_url: vllmBaseUrl.trim() || undefined,
        vllm_model: vllmModel.trim() || undefined,
        vllm_api_key: vllmApiKey.trim() || undefined,
      });
      setConfig((prev) => (prev ? { ...prev, ...res } : null));
      setNewAnthropicKey("");
      setVllmApiKey("");
      onShowToast?.("Đã cập nhật cấu hình mô hình và nhà cung cấp LLM thành công!");
    } catch (err: any) {
      onShowToast?.("Lỗi cập nhật cấu hình: " + (err.message || "Lỗi server"));
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTestingKey(true);
    setTestResult(null);
    try {
      let res;
      if (selectedProvider === "anthropic") {
        const key = newAnthropicKey.trim() || (config?.has_anthropic_key ? "existing-key" : "");
        if (!key) {
          onShowToast?.("Vui lòng nhập Anthropic API Key để kiểm tra kết nối!");
          setIsTestingKey(false);
          return;
        }
        res = await testApiKey("anthropic", key);
      } else if (selectedProvider === "ollama") {
        res = await testApiKey("ollama", undefined, ollamaBaseUrl, ollamaModel);
      } else if (selectedProvider === "vllm") {
        res = await testApiKey("vllm", vllmApiKey.trim() || undefined, vllmBaseUrl, vllmModel);
      } else {
        res = await testApiKey("mock");
      }
      setTestResult(res);
      if (res.status === "ok") {
        onShowToast?.(res.message || "Kết nối thành công!");
      } else {
        onShowToast?.(res.message || "Kiểm tra kết nối thất bại");
      }
    } catch (err: any) {
      setTestResult({ status: "error", message: err.message || "Không thể kết nối tới máy chủ" });
    } finally {
      setIsTestingKey(false);
    }
  };

  const handleInviteMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    const newM: Member = {
      id: "m-" + Date.now(),
      name: inviteName.trim() || inviteEmail.split("@")[0],
      email: inviteEmail.trim(),
      role: inviteRole,
      models: "GPT-4o, DALL·E 3, Canvas",
      lastActive: "Vừa xong",
      tokens: "0 tokens",
      avatarText: (inviteName.trim() || inviteEmail).slice(0, 2).toUpperCase(),
    };

    setMembers((prev) => [newM, ...prev]);
    onShowToast?.(`Đã gửi thư mời gia nhập tới ${inviteEmail.trim()}`);
    setInviteEmail("");
    setInviteName("");
    setIsInviteModalOpen(false);
  };

  const filteredMembers = members.filter((m) => {
    const matchRole =
      memberFilter === "all" ||
      (memberFilter === "admin" && (m.role === "admin" || m.role === "owner")) ||
      (memberFilter === "member" && m.role === "member");
    const matchSearch =
      m.name.toLowerCase().includes(searchMember.toLowerCase()) ||
      m.email.toLowerCase().includes(searchMember.toLowerCase());
    return matchRole && matchSearch;
  });

  return (
    <div className="flex-1 overflow-y-auto pt-14 scrollbar-none bg-background min-h-screen text-on-surface">
      {/* Top Command & Action Bar */}
      <div className="relative w-full px-unit-lg md:px-unit-xl py-unit-lg bg-surface border-b border-outline-variant/30 flex flex-col md:flex-row md:items-center justify-between gap-unit-md">
        <div className="flex flex-col gap-unit-2xs">
          <div className="flex items-center flex-wrap gap-unit-xs">
            <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
              Quản trị Không gian làm việc
            </span>
            <span className="font-label-sm text-label-sm text-outline">•</span>
            <span className="font-label-sm text-label-sm text-primary font-medium">
              Videcomp-rag Enterprise Console
            </span>
            <span className="px-unit-xs py-0.5 rounded-full bg-primary/10 text-primary font-label-sm text-label-sm border border-primary/20 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Enterprise Active
            </span>
          </div>
          <h1 className="font-headline-md text-headline-md text-on-surface tracking-tight flex items-center gap-unit-xs">
            Bảng điều khiển Quản trị viên
            <span className="font-body-sm text-body-sm text-on-surface-variant font-normal hidden sm:inline">
              TechCorp Holdings Corp.
            </span>
          </h1>
        </div>

        <div className="flex items-center flex-wrap gap-unit-xs">
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById("api-key-section");
              el?.scrollIntoView({ behavior: "smooth" });
            }}
            className="flex items-center gap-unit-xs px-unit-md py-unit-xs rounded-full bg-primary/10 hover:bg-primary/20 text-primary text-label-md font-label-md font-semibold transition-colors border border-primary/30"
          >
            <span className="material-symbols-outlined text-[18px]">key</span>
            <span>Đổi API Key &amp; LLM</span>
          </button>
          <button
            type="button"
            onClick={() => setIsInviteModalOpen(true)}
            className="flex items-center gap-unit-xs px-unit-lg py-unit-xs rounded-full bg-primary hover:opacity-90 text-on-primary text-label-md font-label-md font-bold transition-all shadow-sm active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            <span>+ Mời thành viên mới</span>
          </button>
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-surface-container-high hover:bg-error-container/20 text-outline hover:text-error text-label-sm transition-colors border border-outline-variant/30"
              title="Đăng xuất quyền Admin"
            >
              <span className="material-symbols-outlined text-[16px]">logout</span>
              <span className="hidden sm:inline">Đăng xuất</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Scrollable Canvas Container */}
      <div className="px-unit-lg md:px-unit-xl py-unit-xl flex flex-col gap-unit-xl max-w-7xl w-full mx-auto">
        {/* KPI Metrics Grid (4 Tonal Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-unit-md">
          {/* Card 1: Thành viên hoạt động */}
          <div className="flex flex-col justify-between p-unit-lg rounded-DEFAULT bg-surface-container-low border border-outline-variant/20 hover:border-primary/40 transition-all shadow-sm group">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
                Thành viên kích hoạt
              </span>
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[18px]">groups</span>
              </div>
            </div>
            <div className="mt-unit-md">
              <div className="flex items-baseline gap-unit-xs">
                <span className="font-display-lg text-display-lg text-on-surface font-semibold">
                  {members.length}
                </span>
                <span className="font-label-md text-label-md text-outline font-normal">
                  / 50 chỗ
                </span>
              </div>
              <div className="flex items-center gap-unit-2xs mt-unit-2xs text-primary font-label-sm text-label-sm">
                <span className="material-symbols-outlined text-[16px]">trending_up</span>
                <span>+12% tháng này</span>
                <span className="text-outline mx-1">•</span>
                <span className="text-on-surface-variant">2 thư mời chờ</span>
              </div>
            </div>
            <div className="w-full bg-surface-container-highest h-1.5 rounded-full mt-unit-md overflow-hidden">
              <div
                className="bg-primary h-full rounded-full transition-all duration-500"
                style={{ width: `${(members.length / 50) * 100}%` }}
              />
            </div>
          </div>

          {/* Card 2: Token đã tiêu thụ */}
          <div className="flex flex-col justify-between p-unit-lg rounded-DEFAULT bg-surface-container-low border border-outline-variant/20 hover:border-primary/40 transition-all shadow-sm group">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
                Hạn mức Token tháng
              </span>
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[18px]">memory</span>
              </div>
            </div>
            <div className="mt-unit-md">
              <div className="flex items-baseline gap-unit-xs">
                <span className="font-display-lg text-display-lg text-on-surface font-semibold">
                  42.8M
                </span>
                <span className="font-label-md text-label-md text-outline font-normal">
                  / 100M quota
                </span>
              </div>
              <div className="flex items-center gap-unit-2xs mt-unit-2xs text-on-surface-variant font-label-sm text-label-sm">
                <span className="inline-block w-2 h-2 rounded-full bg-primary" />
                <span>42.8% định mức tiêu thụ</span>
                <span className="text-primary font-medium ml-auto">Tối ưu</span>
              </div>
            </div>
            <div className="w-full bg-surface-container-highest h-1.5 rounded-full mt-unit-md overflow-hidden">
              <div className="bg-primary h-full rounded-full transition-all duration-500" style={{ width: "42.8%" }} />
            </div>
          </div>

          {/* Card 3: GPTs nội bộ đã triển khai */}
          <div className="flex flex-col justify-between p-unit-lg rounded-DEFAULT bg-surface-container-low border border-outline-variant/20 hover:border-primary/40 transition-all shadow-sm group">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
                GPTs Workspace
              </span>
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[18px]">smart_toy</span>
              </div>
            </div>
            <div className="mt-unit-md">
              <div className="flex items-baseline gap-unit-xs">
                <span className="font-display-lg text-display-lg text-on-surface font-semibold">16</span>
                <span className="font-label-md text-label-md text-outline font-normal">Custom Agents</span>
              </div>
              <div className="flex items-center gap-unit-2xs mt-unit-2xs text-on-surface-variant font-label-sm text-label-sm">
                <span className="text-on-surface font-medium">8 trợ lý active</span>
                <span className="text-outline">•</span>
                <span className="text-primary">2.4K queries/tuần</span>
              </div>
            </div>
            <div className="flex items-center -space-x-1.5 mt-unit-md">
              <div className="w-5 h-5 rounded-full bg-surface-container-highest border border-surface text-[10px] flex items-center justify-center font-bold text-on-surface">C</div>
              <div className="w-5 h-5 rounded-full bg-primary/30 border border-surface text-[10px] flex items-center justify-center font-bold text-primary">RAG</div>
              <div className="w-5 h-5 rounded-full bg-surface-container-high border border-surface text-[10px] flex items-center justify-center font-bold text-on-surface">LAW</div>
              <span className="font-label-sm text-label-sm text-outline ml-2">+13 trợ lý khác</span>
            </div>
          </div>

          {/* Card 4: Tuân thủ & An toàn */}
          <div className="flex flex-col justify-between p-unit-lg rounded-DEFAULT bg-surface-container-low border border-outline-variant/20 hover:border-primary/40 transition-all shadow-sm group">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
                Bảo mật &amp; Tuân thủ
              </span>
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[18px]">lock</span>
              </div>
            </div>
            <div className="mt-unit-md">
              <div className="flex items-baseline gap-unit-xs">
                <span className="font-display-lg text-display-lg text-primary font-semibold">100%</span>
                <span className="font-label-md text-label-md text-outline font-normal">SSO &amp; MFA</span>
              </div>
              <div className="flex items-center gap-unit-2xs mt-unit-2xs text-primary font-label-sm text-label-sm">
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                <span>0 rủi ro phát hiện</span>
                <span className="text-outline mx-1">•</span>
                <span className="text-on-surface-variant">SOC2 Type II</span>
              </div>
            </div>
            <div className="flex items-center gap-unit-xs mt-unit-md">
              <span className="px-unit-xs py-0.5 rounded bg-surface-container-high text-outline text-[11px] font-mono font-medium">SAML 2.0 Active</span>
              <span className="px-unit-xs py-0.5 rounded bg-surface-container-high text-outline text-[11px] font-mono font-medium">Zero-Training</span>
            </div>
          </div>
        </div>

        {/* PHÂN HỆ CẤU HÌNH NHÀ CUNG CẤP LLM & MÔ HÌNH CỤC BỘ (ON-PREMISE OLLAMA / VLLM) */}
        <section
          id="api-key-section"
          className="p-unit-lg md:p-unit-xl rounded-DEFAULT bg-surface-container-low border-2 border-primary/40 shadow-xl space-y-unit-md relative overflow-hidden"
        >
          <div className="pointer-events-none absolute -top-24 -right-24 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />

          <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-outline-variant/20 gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[24px]">vpn_key</span>
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  Quản lý Mô hình &amp; Nhà cung cấp LLM
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[11px] font-bold">
                  On-Premise &amp; Cloud
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                Thiết lập kết nối trực tiếp với các mô hình cục bộ On-Premise (Ollama, vLLM) hoặc đám mây (Anthropic Claude). Hỗ trợ Private Cloud 100% bảo mật tuyệt đối cho cơ quan nhà nước, ngân hàng và bệnh viện.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[12px] text-outline">Chế độ hiện tại:</span>
              <span className="px-2.5 py-1 rounded-full text-[12px] font-semibold flex items-center gap-1 bg-primary-container/20 text-primary border border-primary/30">
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                {selectedProvider === "ollama"
                  ? `Ollama On-Premise (${ollamaModel})`
                  : selectedProvider === "vllm"
                  ? `vLLM Cluster (${vllmModel})`
                  : selectedProvider === "anthropic"
                  ? `Anthropic Claude (${config?.anthropic_api_key_masked || "Chưa có key"})`
                  : "Mock (Thực nghiệm)"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-unit-md">
            {/* Cột 1: Chọn Provider & Cấu hình chi tiết */}
            <div className="space-y-4">
              <div>
                <label className="block text-[12px] font-semibold text-outline uppercase tracking-wider mb-1.5">
                  Nhà cung cấp Mô hình (Provider)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: "ollama", label: "Ollama (On-Premise)", icon: "home_storage", tag: "Private" },
                    { id: "vllm", label: "vLLM Cluster", icon: "dns", tag: "GPU Server" },
                    { id: "anthropic", label: "Anthropic Claude", icon: "neurology", tag: "Cloud API" },
                    { id: "mock", label: "Mock (Thử nghiệm)", icon: "terminal", tag: "Heuristic" },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedProvider(p.id)}
                      className={`p-2.5 rounded-DEFAULT border flex flex-col items-center gap-1 transition-all text-center relative ${
                        selectedProvider === p.id
                          ? "bg-primary/20 border-primary text-primary font-bold shadow-sm"
                          : "bg-surface-container border-outline-variant/30 text-outline hover:text-on-surface"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[22px]">{p.icon}</span>
                      <span className="text-[11px] font-semibold">{p.label}</span>
                      <span className="text-[9px] px-1 py-0.2 rounded bg-surface-container-high text-on-surface-variant">
                        {p.tag}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Form theo từng Provider */}
              {selectedProvider === "ollama" && (
                <div className="space-y-3 p-3 rounded-DEFAULT bg-surface-container/60 border border-primary/20">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-bold text-primary flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">verified_user</span>
                      Cấu hình Ollama On-Premise (Private Cloud 100%)
                    </span>
                    <button
                      type="button"
                      onClick={handleScanOllamaModels}
                      disabled={isScanningModels}
                      className="px-2 py-0.5 rounded text-[11px] bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 flex items-center gap-1 transition-colors"
                      title="Quét danh sách mô hình đã tải trên máy chủ"
                    >
                      <span className={`material-symbols-outlined text-[14px] ${isScanningModels ? "animate-spin" : ""}`}>
                        sync
                      </span>
                      <span>{isScanningModels ? "Đang quét..." : "Quét mô hình"}</span>
                    </button>
                  </div>

                  <div>
                    <label className="block text-[11px] text-outline mb-1 font-semibold">
                      Địa chỉ máy chủ Ollama (Base URL)
                    </label>
                    <input
                      type="text"
                      value={ollamaBaseUrl}
                      onChange={(e) => setOllamaBaseUrl(e.target.value)}
                      placeholder="http://localhost:11434"
                      className="w-full bg-surface-container-high px-3 py-2 rounded text-on-surface text-label-md font-mono outline-none border border-outline-variant/40 focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-outline mb-1 font-semibold">
                      Mô hình suy luận (Model)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={ollamaModel}
                        onChange={(e) => setOllamaModel(e.target.value)}
                        placeholder="qwen2.5:14b"
                        className="flex-1 bg-surface-container-high px-3 py-2 rounded text-on-surface text-label-md font-mono outline-none border border-outline-variant/40 focus:border-primary"
                      />
                    </div>
                  </div>

                  {/* Preset buttons */}
                  <div>
                    <span className="block text-[10px] text-outline mb-1 uppercase tracking-wider">
                      Mô hình On-Premise đề xuất:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { id: "qwen2.5:14b", label: "Qwen 2.5 14B (Khuyên dùng)" },
                        { id: "qwen2.5:32b", label: "Qwen 2.5 32B (Độ chính xác cao)" },
                        { id: "vistral:7b", label: "Vistral 7B (Tiếng Việt)" },
                        { id: "phogpt:latest", label: "PhoGPT (Việt Nam)" },
                      ].map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setOllamaModel(m.id)}
                          className={`px-2 py-1 rounded text-[11px] border transition-colors ${
                            ollamaModel === m.id
                              ? "bg-primary text-on-primary font-bold border-primary"
                              : "bg-surface-container-high text-on-surface-variant hover:text-on-surface border-outline-variant/30"
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {installedOllamaModels.length > 0 && (
                    <div className="pt-1">
                      <span className="block text-[10px] text-outline mb-1">
                        Mô hình phát hiện trên máy ({installedOllamaModels.length}):
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {installedOllamaModels.map((im) => (
                          <button
                            key={im}
                            type="button"
                            onClick={() => setOllamaModel(im)}
                            className="px-2 py-0.5 rounded bg-surface-container-highest text-primary text-[10px] font-mono hover:bg-primary/20 transition-colors"
                          >
                            {im}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Privacy Badge */}
                  <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">lock</span>
                    <span>100% Private Cloud: Toàn bộ dữ liệu câu hỏi và tài liệu lưu trú trong mạng nội bộ.</span>
                  </div>
                </div>
              )}

              {selectedProvider === "vllm" && (
                <div className="space-y-3 p-3 rounded-DEFAULT bg-surface-container/60 border border-primary/20">
                  <span className="text-[12px] font-bold text-primary flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">dns</span>
                    Cấu hình Cụm máy chủ vLLM GPU Cluster
                  </span>

                  <div>
                    <label className="block text-[11px] text-outline mb-1 font-semibold">
                      Endpoint vLLM (OpenAI-Compatible Base URL)
                    </label>
                    <input
                      type="text"
                      value={vllmBaseUrl}
                      onChange={(e) => setVllmBaseUrl(e.target.value)}
                      placeholder="http://localhost:8000/v1"
                      className="w-full bg-surface-container-high px-3 py-2 rounded text-on-surface text-label-md font-mono outline-none border border-outline-variant/40 focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-outline mb-1 font-semibold">
                      Tên mô hình vLLM (Model ID)
                    </label>
                    <input
                      type="text"
                      value={vllmModel}
                      onChange={(e) => setVllmModel(e.target.value)}
                      placeholder="Qwen/Qwen2.5-14B-Instruct"
                      className="w-full bg-surface-container-high px-3 py-2 rounded text-on-surface text-label-md font-mono outline-none border border-outline-variant/40 focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-outline mb-1 font-semibold">
                      API Key xác thực cụm vLLM (Tùy chọn)
                    </label>
                    <input
                      type="password"
                      value={vllmApiKey}
                      onChange={(e) => setVllmApiKey(e.target.value)}
                      placeholder="token-xác-thực-nội-bộ (nếu có)"
                      className="w-full bg-surface-container-high px-3 py-2 rounded text-on-surface text-label-md font-mono outline-none border border-outline-variant/40 focus:border-primary"
                    />
                  </div>
                </div>
              )}

              {selectedProvider === "anthropic" && (
                <div className="space-y-3 p-3 rounded-DEFAULT bg-surface-container/60 border border-primary/20">
                  <label className="block text-[12px] font-semibold text-outline uppercase tracking-wider mb-1.5">
                    Anthropic API Key mới (bắt đầu bằng sk-ant-...)
                  </label>
                  <div className="relative flex items-center">
                    <span className="material-symbols-outlined absolute left-3 text-outline text-[18px]">
                      lock
                    </span>
                    <input
                      type={showKey ? "text" : "password"}
                      value={newAnthropicKey}
                      onChange={(e) => setNewAnthropicKey(e.target.value)}
                      placeholder={
                        config?.has_anthropic_key
                          ? `Nhập key mới để thay thế (${config.anthropic_api_key_masked})`
                          : "Dán khóa sk-ant-... vào đây"
                      }
                      className="w-full bg-surface-container-high pl-10 pr-10 py-2.5 rounded-DEFAULT text-on-surface text-label-md font-mono outline-none border border-outline-variant/40 focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey((v) => !v)}
                      className="absolute right-3 text-outline hover:text-on-surface"
                      title={showKey ? "Ẩn khóa" : "Hiện khóa"}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {showKey ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {selectedProvider === "mock" && (
                <div className="p-3 rounded-DEFAULT bg-surface-container/60 border border-primary/20 space-y-1 text-[12px] text-on-surface-variant">
                  <span className="font-semibold text-primary">Chế độ Thực nghiệm Heuristic (Mock):</span>
                  <p>
                    Pipeline chạy bằng các luật phân rã và trích xuất heuristic cục bộ, không gọi bất kỳ mô hình bên ngoài nào. Thích hợp để kiểm thử luồng RAG khi chưa có GPU.
                  </p>
                </div>
              )}
            </div>

            {/* Cột 2: Kiểm tra kết nối & Thao tác Lưu */}
            <div className="space-y-3 flex flex-col justify-between">
              <div className="p-unit-md rounded-DEFAULT bg-surface-container border border-outline-variant/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-label-sm font-semibold text-on-surface">
                    Kiểm tra kết nối mô hình
                  </span>
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTestingKey}
                    className="px-unit-md py-1.5 rounded-full bg-surface-container-high hover:bg-surface-container-highest text-primary text-label-sm font-semibold border border-primary/30 transition-all flex items-center gap-1.5 disabled:opacity-40"
                  >
                    {isTestingKey ? (
                      <>
                        <span className="material-symbols-outlined text-[16px] animate-spin">
                          progress_activity
                        </span>
                        <span>Đang kiểm tra...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[16px]">network_check</span>
                        <span>Kiểm tra kết nối</span>
                      </>
                    )}
                  </button>
                </div>

                {testResult ? (
                  <div
                    className={`p-2.5 rounded text-[12px] flex items-start gap-1.5 ${
                      testResult.status === "ok"
                        ? "bg-primary/10 text-primary border border-primary/30"
                        : "bg-error-container/20 text-error border border-error/30"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">
                      {testResult.status === "ok" ? "check_circle" : "warning"}
                    </span>
                    <span className="break-all">{testResult.message}</span>
                  </div>
                ) : (
                  <p className="text-[12px] text-outline">
                    Nhấp vào nút Kiểm tra kết nối để xác thực trực tiếp endpoint và phản hồi từ mô hình đã cấu hình trước khi lưu.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleSaveConfig}
                  disabled={isSavingKey}
                  className="flex items-center gap-2 px-unit-xl py-2.5 rounded-full bg-primary text-on-primary font-label-md font-bold hover:opacity-90 shadow-md transition-all active:scale-95 disabled:opacity-40"
                >
                  {isSavingKey ? (
                    <>
                      <span className="material-symbols-outlined text-[18px] animate-spin">
                        progress_activity
                      </span>
                      <span>Đang lưu cấu hình...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">save</span>
                      <span>Lưu cấu hình Mô hình &amp; LLM</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* PHÂN HỆ QUẢN TRỊ BỘ ĐỆM NGỮ NGHĨA (SEMANTIC CACHE HUB) */}
        <section
          id="semantic-cache-section"
          className="p-unit-lg md:p-unit-xl rounded-DEFAULT bg-surface-container-low border-2 border-emerald-500/40 shadow-xl space-y-unit-md relative overflow-hidden"
        >
          <div className="pointer-events-none absolute -top-24 -right-24 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl" />

          <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-outline-variant/20 gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400 text-[24px]">offline_bolt</span>
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  Bộ đệm Ngữ nghĩa &amp; Tối ưu Chi phí API (Semantic Caching)
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-bold">
                  Tăng tốc &lt; 150ms · Tiết kiệm 40–70% Token
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                Tự động lưu trữ câu hỏi và câu trả lời đã được kiểm chứng (grounded NLI). Khi có câu hỏi mới tương đồng nghĩa (Cosine similarity &ge; {cacheThreshold}), hệ thống trả về kết quả ngay lập tức mà không cần gọi lại LLM.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleClearCache}
                disabled={isClearingCache}
                className="px-3.5 py-1.5 rounded-full bg-error-container/20 hover:bg-error-container/30 text-error border border-error/30 text-label-sm font-semibold transition-all flex items-center gap-1.5 disabled:opacity-40"
              >
                {isClearingCache ? (
                  <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
                )}
                <span>Xóa bộ nhớ đệm (Clear Cache)</span>
              </button>
            </div>
          </div>

          {/* 4 Thẻ KPI Semantic Cache */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-unit-md">
            <div className="p-unit-md rounded-DEFAULT bg-surface-container border border-outline-variant/25 flex flex-col justify-between">
              <span className="font-label-sm text-outline uppercase tracking-wider">Tổng câu hỏi đã đệm</span>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="font-display-md text-on-surface font-bold">
                  {cacheStats?.total_entries ?? 0}
                </span>
                <span className="text-outline text-label-sm">bản ghi</span>
              </div>
              <span className="text-[11px] text-outline mt-1 font-mono">SQLite + Vector Index FlatIP</span>
            </div>

            <div className="p-unit-md rounded-DEFAULT bg-surface-container border border-outline-variant/25 flex flex-col justify-between">
              <span className="font-label-sm text-outline uppercase tracking-wider">Số lượt trúng Cache (Hits)</span>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="font-display-md text-emerald-400 font-bold">
                  {cacheStats?.total_hits ?? 0}
                </span>
                <span className="text-outline text-label-sm">lượt</span>
              </div>
              <span className="text-[11px] text-emerald-400/90 mt-1">Độ trễ trung bình: &lt; 20ms</span>
            </div>

            <div className="p-unit-md rounded-DEFAULT bg-surface-container border border-outline-variant/25 flex flex-col justify-between">
              <span className="font-label-sm text-outline uppercase tracking-wider">Tỷ lệ trúng (Hit Rate)</span>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="font-display-md text-primary font-bold">
                  {cacheStats?.hit_rate_pct ?? 0}%
                </span>
              </div>
              <span className="text-[11px] text-on-surface-variant mt-1">Tỷ lệ câu hỏi không cần gọi LLM</span>
            </div>

            <div className="p-unit-md rounded-DEFAULT bg-surface-container border border-outline-variant/25 flex flex-col justify-between">
              <span className="font-label-sm text-outline uppercase tracking-wider">Chi phí API ước tính đã tiết kiệm</span>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="font-display-md text-emerald-400 font-bold">
                  ${cacheStats?.saved_cost_usd?.toFixed(3) ?? "0.000"}
                </span>
                <span className="text-outline text-label-sm">USD</span>
              </div>
              <span className="text-[11px] text-emerald-400/90 mt-1">Tiết kiệm ~40% – 70% ngân sách token</span>
            </div>
          </div>

          {/* Thiết lập Ngưỡng tương đồng Cosine & Trạng thái hoạt động */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-unit-md pt-2">
            <div className="p-unit-md rounded-DEFAULT bg-surface-container border border-outline-variant/30 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-label-md text-on-surface font-semibold block">
                    Ngưỡng tương đồng Cosine (Similarity Threshold)
                  </span>
                  <span className="text-[12px] text-on-surface-variant">
                    Khoảng: 0.80 đến 0.98. Khuyến nghị: <strong>0.93</strong> cho phân tích pháp lý &amp; y tế.
                  </span>
                </div>
                <span className="font-mono text-emerald-400 font-bold text-[18px] px-2.5 py-1 rounded bg-surface-container-high border border-emerald-500/30">
                  {cacheThreshold.toFixed(2)}
                </span>
              </div>

              <input
                type="range"
                min="0.80"
                max="0.98"
                step="0.01"
                value={cacheThreshold}
                onChange={(e) => setCacheThreshold(parseFloat(e.target.value))}
                className="w-full accent-emerald-400 cursor-pointer h-2 bg-surface-container-highest rounded-lg"
              />

              <div className="flex justify-between text-[11px] text-outline font-mono">
                <span>0.80 (Rộng hơn)</span>
                <span className="text-emerald-400 font-semibold">0.93 (Chuẩn xác thực)</span>
                <span>0.98 (Gần như tuyệt đối)</span>
              </div>
            </div>

            <div className="p-unit-md rounded-DEFAULT bg-surface-container border border-outline-variant/30 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-label-md text-on-surface font-semibold block">
                    Trạng thái Bộ đệm Ngữ nghĩa
                  </span>
                  <span className="text-[12px] text-on-surface-variant">
                    Bật hoặc tắt chức năng tra cứu vector cache trước khi phân rã đa bước.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCacheEnabled(!isCacheEnabled)}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${
                    isCacheEnabled ? "bg-emerald-500 justify-end" : "bg-surface-container-highest justify-start"
                  }`}
                >
                  <div className="bg-white w-4 h-4 rounded-full shadow-md transform transition-transform" />
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleSaveCacheConfig}
                  disabled={isSavingCacheConfig}
                  className="flex items-center gap-2 px-unit-lg py-2 rounded-full bg-emerald-500 text-black font-label-md font-bold hover:opacity-90 transition-all shadow-md active:scale-95 disabled:opacity-40"
                >
                  {isSavingCacheConfig ? (
                    <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined text-[18px]">check</span>
                  )}
                  <span>Lưu cấu hình Cache</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* PHÂN HỆ MÔ HÌNH EMBEDDING & RERANKER TIẾNG VIỆT & OCR ĐA PHƯƠNG THÁI */}
        <section
          id="vietnamese-models-section"
          className="p-unit-lg md:p-unit-xl rounded-DEFAULT bg-surface-container-low border-2 border-primary/40 shadow-xl space-y-unit-md relative overflow-hidden"
        >
          <div className="pointer-events-none absolute -top-24 -left-24 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />

          <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-outline-variant/20 gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[26px]">psychology</span>
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  Mô hình Embedding &amp; Reranker Tiếng Việt Chuyên sâu &amp; OCR Đa phương thái
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-primary/20 text-primary text-[11px] font-bold">
                  bge-m3: 8192 tokens · BKAI Bi-Encoder · pdfplumber
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                Tối ưu hóa khả năng truy hồi ngữ nghĩa (Recall) cho các từ vựng cổ, thuật ngữ Hán - Việt trong văn bản pháp luật và hồ sơ bệnh án; đồng thời bóc tách bảng biểu cấu trúc cao qua <code>pdfplumber</code> và nhận diện tài liệu scan qua Vision LLM.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleSaveModelsConfig}
                disabled={isSavingModelsConfig}
                className="flex items-center gap-2 px-unit-lg py-2 rounded-full bg-primary text-on-primary font-label-md font-bold hover:opacity-90 transition-all shadow-md active:scale-95 disabled:opacity-40"
              >
                {isSavingModelsConfig ? (
                  <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-[18px]">save</span>
                )}
                <span>Lưu cấu hình Mô hình &amp; OCR</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-unit-md">
            {/* Cột 1: Mô hình Dense Embedding */}
            <div className="p-unit-md rounded-DEFAULT bg-surface-container border border-outline-variant/30 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[12px] font-bold text-primary flex items-center gap-1.5 uppercase tracking-wider">
                    <span className="material-symbols-outlined text-[18px]">hub</span>
                    Mô hình Embedding Tiếng Việt
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-surface-container-high text-on-surface border border-outline-variant/30">
                    {modelsConfig?.active_embedding_dim ?? 384}-dim
                  </span>
                </div>
                <p className="text-[12px] text-on-surface-variant mb-3">
                  Chọn mô hình mã hóa vector dense. Khuyên dùng <strong>BGE-M3</strong> cho văn bản pháp lý dài hoặc <strong>BKAI</strong> cho ngữ pháp tiếng Việt.
                </p>

                <div className="space-y-2">
                  {[
                    {
                      id: "bge-m3",
                      name: "BAAI/bge-m3",
                      label: "BAAI/bge-m3",
                      badge: "8192 tokens · 1024-dim · SOTA Hán - Việt",
                      desc: "Hỗ trợ ngữ cảnh siêu dài, tối ưu thuật ngữ luật và trích dẫn điều khoản nhiều cấp.",
                    },
                    {
                      id: "vietnamese-bi-encoder",
                      name: "bkai-foundation-models/vietnamese-bi-encoder",
                      label: "BKAI Vietnamese Bi-Encoder",
                      badge: "768-dim · Viện CNTT Bách Khoa HN",
                      desc: "Mô hình chuyên sâu cho tiếng Việt, biểu diễn ngữ nghĩa tự nhiên tiếng Việt chuẩn xác.",
                    },
                    {
                      id: "multilingual-minilm",
                      name: "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
                      label: "Multilingual MiniLM L12",
                      badge: "384-dim · Siêu nhẹ & Nhanh",
                      desc: "Tốc độ mã hóa nhanh, tiêu tốn ít RAM máy chủ.",
                    },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedEmbeddingModel(m.name)}
                      className={`w-full p-2.5 rounded-DEFAULT border text-left transition-all relative ${
                        selectedEmbeddingModel === m.name
                          ? "bg-primary/20 border-primary shadow-sm"
                          : "bg-surface-container-high border-outline-variant/20 hover:border-outline-variant/60"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-label-md text-on-surface font-semibold">{m.label}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-container text-primary font-bold">
                          {m.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant mt-1">{m.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <label className="block text-[11px] text-outline font-semibold mb-1">
                  Hoặc nhập HuggingFace Model ID tùy chỉnh:
                </label>
                <input
                  type="text"
                  value={selectedEmbeddingModel}
                  onChange={(e) => setSelectedEmbeddingModel(e.target.value)}
                  placeholder="BAAI/bge-m3 hoặc tên mô hình"
                  className="w-full bg-surface-container-high px-3 py-1.5 rounded text-on-surface text-label-sm font-mono outline-none border border-outline-variant/40 focus:border-primary"
                />
              </div>
            </div>

            {/* Cột 2: Mô hình Reranker */}
            <div className="p-unit-md rounded-DEFAULT bg-surface-container border border-outline-variant/30 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[12px] font-bold text-primary flex items-center gap-1.5 uppercase tracking-wider">
                    <span className="material-symbols-outlined text-[18px]">swap_vert</span>
                    Mô hình Reranker (Cross-Encoder)
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-surface-container-high text-emerald-400 border border-outline-variant/30">
                    Cross-Attention
                  </span>
                </div>
                <p className="text-[12px] text-on-surface-variant mb-3">
                  Tái xếp hạng chéo giữa truy vấn và bằng chứng. Phân biệt chính xác các trường hợp loại trừ và điều kiện phủ định.
                </p>

                <div className="space-y-2">
                  {[
                    {
                      id: "bge-reranker-v2-m3",
                      name: "BAAI/bge-reranker-v2-m3",
                      label: "BAAI/bge-reranker-v2-m3",
                      badge: "Khuyên dùng Chính xác cao",
                      desc: "Tái xếp hạng đa ngôn ngữ và tiếng Việt tối tân, phân biệt sắc thái pháp lý tinh tế.",
                    },
                    {
                      id: "mmarco-minilm",
                      name: "cross-encoder/mmarco-mMiniLMv2-L12-H384-v1",
                      label: "mMARCO MiniLM Cross-Encoder",
                      badge: "384-dim · Tối ưu độ trễ",
                      desc: "Cross-encoder gọn nhẹ, phản hồi cực nhanh cho ứng dụng thời gian thực.",
                    },
                  ].map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedRerankerModel(r.name)}
                      className={`w-full p-2.5 rounded-DEFAULT border text-left transition-all relative ${
                        selectedRerankerModel === r.name
                          ? "bg-primary/20 border-primary shadow-sm"
                          : "bg-surface-container-high border-outline-variant/20 hover:border-outline-variant/60"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-label-md text-on-surface font-semibold">{r.label}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-container text-primary font-bold">
                          {r.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant mt-1">{r.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <label className="block text-[11px] text-outline font-semibold mb-1">
                  Hoặc nhập HuggingFace Reranker ID tùy chỉnh:
                </label>
                <input
                  type="text"
                  value={selectedRerankerModel}
                  onChange={(e) => setSelectedRerankerModel(e.target.value)}
                  placeholder="BAAI/bge-reranker-v2-m3"
                  className="w-full bg-surface-container-high px-3 py-1.5 rounded text-on-surface text-label-sm font-mono outline-none border border-outline-variant/40 focus:border-primary"
                />
              </div>
            </div>

            {/* Cột 3: Xử lý Đa phương thái (OCR & Table Extraction) */}
            <div className="p-unit-md rounded-DEFAULT bg-surface-container border border-outline-variant/30 flex flex-col justify-between space-y-3">
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[12px] font-bold text-primary flex items-center gap-1.5 uppercase tracking-wider">
                    <span className="material-symbols-outlined text-[18px]">document_scanner</span>
                    Xử lý Đa phương thái (OCR &amp; Table)
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                    pdfplumber + Vision
                  </span>
                </div>
                <p className="text-[12px] text-on-surface-variant">
                  Giải quyết triệt để hạn chế của pypdf: bóc tách trọn vẹn bảng biểu, sơ đồ phác đồ điều trị và tài liệu scan dạng ảnh.
                </p>

                {/* Switch 1: Table Extraction */}
                <div className="p-3 rounded-DEFAULT bg-surface-container-high border border-outline-variant/25 flex items-start justify-between gap-3">
                  <div>
                    <span className="font-label-md text-on-surface font-semibold block">
                      Trích xuất Bảng biểu có cấu trúc (pdfplumber)
                    </span>
                    <span className="text-[11px] text-on-surface-variant">
                      Chuyển đổi ma trận hàng/cột thành bảng Markdown chuẩn (<code>| 行 | 列 |</code>) giúp LLM trích dẫn chính xác số liệu và mức phạt.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEnablePdfTableExtraction(!enablePdfTableExtraction)}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors shrink-0 ${
                      enablePdfTableExtraction ? "bg-primary justify-end" : "bg-surface-container-highest justify-start"
                    }`}
                  >
                    <div className="bg-white w-4 h-4 rounded-full shadow-md transform transition-transform" />
                  </button>
                </div>

                {/* Switch 2: Vision OCR */}
                <div className="p-3 rounded-DEFAULT bg-surface-container-high border border-outline-variant/25 flex items-start justify-between gap-3">
                  <div>
                    <span className="font-label-md text-on-surface font-semibold block">
                      Hybrid Vision OCR cho Trang Scan / Sơ đồ
                    </span>
                    <span className="text-[11px] text-on-surface-variant">
                      Tự động phát hiện trang không có text layer (scan dạng ảnh, chữ ký, con dấu, biểu đồ) và dùng Vision LLM đọc trọn vẹn.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEnableVisionOcr(!enableVisionOcr)}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors shrink-0 ${
                      enableVisionOcr ? "bg-primary justify-end" : "bg-surface-container-highest justify-start"
                    }`}
                  >
                    <div className="bg-white w-4 h-4 rounded-full shadow-md transform transition-transform" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-outline font-semibold mb-1">
                  Mô hình Vision OCR:
                </label>
                <input
                  type="text"
                  value={visionModel}
                  onChange={(e) => setVisionModel(e.target.value)}
                  placeholder="claude-3-5-sonnet-20241022"
                  className="w-full bg-surface-container-high px-3 py-1.5 rounded text-on-surface text-label-sm font-mono outline-none border border-outline-variant/40 focus:border-primary"
                />
              </div>
            </div>
          </div>

          {/* Phân hệ Thử nghiệm Live: Kiểm tra Recall và Phân tích Vector Hán - Việt */}
          <div className="mt-unit-md p-unit-md rounded-DEFAULT bg-surface-container border border-outline-variant/30 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">biotech</span>
                <span className="font-label-md text-on-surface font-bold">
                  Bảng Điều khiển Kiểm thử Thực nghiệm Mô hình &amp; Recall Tiếng Việt
                </span>
              </div>
              <button
                type="button"
                onClick={handleTestModels}
                disabled={isTestingModels}
                className="px-4 py-1.5 rounded-full bg-primary/20 hover:bg-primary/30 text-primary border border-primary/40 font-label-sm font-semibold flex items-center gap-1.5 transition-all disabled:opacity-40"
              >
                {isTestingModels ? (
                  <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                )}
                <span>{isTestingModels ? "Đang chạy đánh giá..." : "Chạy kiểm thử Recall &amp; Rerank"}</span>
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={customSampleText}
                onChange={(e) => setCustomSampleText(e.target.value)}
                placeholder="Nhập câu hỏi tiếng Việt mẫu (mặc định: Trách nhiệm liên đới bồi thường thiệt hại ngoài hợp đồng theo nguyên tắc suy đoán lỗi...)"
                className="flex-1 bg-surface-container-high px-3 py-2 rounded text-on-surface text-label-sm outline-none border border-outline-variant/40 focus:border-primary"
              />
            </div>

            {/* Hiển thị kết quả kiểm thử */}
            {modelsTestResult && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-unit-md pt-2">
                {/* Kết quả Embedding */}
                <div className="p-3 rounded-DEFAULT bg-surface-container-high border border-primary/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-bold text-primary flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">check_circle</span>
                      Mã hóa Dense Vector ({modelsTestResult.embedding.dim}-dim)
                    </span>
                    <span className="text-[11px] font-mono text-outline">
                      {modelsTestResult.embedding.latency_ms} ms
                    </span>
                  </div>
                  <div className="text-[11px] text-on-surface-variant font-mono space-y-1">
                    <div>Mô hình: <span className="text-on-surface">{modelsTestResult.embedding.model}</span></div>
                    <div>Chuẩn L2 Norm: <span className="text-emerald-400 font-bold">{modelsTestResult.embedding.norm}</span></div>
                    <div>Vector Preview (6 chiều đầu):</div>
                    <div className="p-1.5 rounded bg-surface-container-highest text-[10px] text-primary break-all">
                      [{modelsTestResult.embedding.preview.join(", ")}...]
                    </div>
                  </div>
                </div>

                {/* Kết quả Reranker */}
                <div className="p-3 rounded-DEFAULT bg-surface-container-high border border-emerald-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-bold text-emerald-400 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">analytics</span>
                      Tái xếp hạng Reranker ({modelsTestResult.reranker.latency_ms} ms)
                    </span>
                    <span className="text-[11px] text-outline font-mono">
                      {modelsTestResult.reranker.ranked_candidates.length} ứng viên
                    </span>
                  </div>
                  <div className="space-y-1.5 text-[11px]">
                    {modelsTestResult.reranker.ranked_candidates.map((cand) => (
                      <div
                        key={cand.rank}
                        className={`p-2 rounded border flex items-start justify-between gap-2 ${
                          cand.rank === 1
                            ? "bg-emerald-500/10 border-emerald-500/30 text-on-surface font-medium"
                            : "bg-surface-container border-outline-variant/20 text-on-surface-variant"
                        }`}
                      >
                        <div className="flex items-start gap-1.5">
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                            cand.rank === 1 ? "bg-emerald-500 text-black" : "bg-surface-container-highest text-outline"
                          }`}>
                            #{cand.rank}
                          </span>
                          <span className="line-clamp-2">{cand.text}</span>
                        </div>
                        <span className="font-mono text-[11px] text-emerald-400 font-bold shrink-0">
                          {cand.score > 0 ? `+${cand.score}` : cand.score}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Analytics & Consumption Insights Bento Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-unit-md">
          {/* Model Usage Breakdown (Chart & Metrics) */}
          <div className="lg:col-span-2 p-unit-xl rounded-DEFAULT bg-surface-container-low border border-outline-variant/20 flex flex-col justify-between">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-unit-xs mb-unit-lg">
              <div>
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  Tỉ trọng sử dụng Mô hình Trí tuệ Nhân tạo
                </h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Phân bổ token tiêu thụ trong {timeFilter === "30d" ? "30 ngày" : timeFilter === "7d" ? "7 ngày" : "24 giờ"} vừa qua
                </p>
              </div>
              <div className="flex items-center gap-unit-2xs bg-surface-container p-1 rounded-full border border-outline-variant/30">
                <button
                  type="button"
                  onClick={() => setTimeFilter("30d")}
                  className={`px-unit-sm py-0.5 rounded-full font-label-sm text-label-sm transition-all ${
                    timeFilter === "30d"
                      ? "bg-surface-container-high text-on-surface font-semibold shadow-sm"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  30 ngày
                </button>
                <button
                  type="button"
                  onClick={() => setTimeFilter("7d")}
                  className={`px-unit-sm py-0.5 rounded-full font-label-sm text-label-sm transition-all ${
                    timeFilter === "7d"
                      ? "bg-surface-container-high text-on-surface font-semibold shadow-sm"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  7 ngày
                </button>
                <button
                  type="button"
                  onClick={() => setTimeFilter("24h")}
                  className={`px-unit-sm py-0.5 rounded-full font-label-sm text-label-sm transition-all ${
                    timeFilter === "24h"
                      ? "bg-surface-container-high text-on-surface font-semibold shadow-sm"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  24h
                </button>
              </div>
            </div>

            {/* Inline SVG Visualization (Token Usage Distribution Wave / Area) */}
            <div className="w-full h-44 my-unit-xs flex items-end">
              <svg className="w-full h-full text-primary" fill="none" preserveAspectRatio="none" viewBox="0 0 600 160">
                <defs>
                  <linearGradient id="areaGradient" x1="0%" x2="0%" y1="0%" y2="100%">
                    <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="currentColor" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="lineGrad" x1="0%" x2="100%" y1="0%" y2="0%">
                    <stop offset="0%" stopColor="#61dbb4" />
                    <stop offset="60%" stopColor="#7ff8cf" />
                    <stop offset="100%" stopColor="#61dbb4" />
                  </linearGradient>
                </defs>
                <path d="M0,130 Q50,90 100,105 T200,70 T300,85 T400,35 T500,45 T600,20 L600,160 L0,160 Z" fill="url(#areaGradient)" />
                <path d="M0,130 Q50,90 100,105 T200,70 T300,85 T400,35 T500,45 T600,20" fill="none" stroke="url(#lineGrad)" strokeLinecap="round" strokeWidth="2.5" />
                <circle className="fill-primary" cx="200" cy="70" r="3.5" />
                <circle className="fill-primary animate-ping" cx="400" cy="35" opacity="0.4" r="4.5" />
                <circle className="fill-on-surface" cx="400" cy="35" r="3.5" />
                <circle className="fill-primary" cx="600" cy="20" r="3.5" />
              </svg>
            </div>

            {/* Model Legend & Quota Bar */}
            <div className="mt-unit-md pt-unit-md border-t border-outline-variant/20 flex flex-col gap-unit-sm">
              <div className="w-full flex h-2 rounded-full overflow-hidden bg-surface-container-highest">
                <div className="bg-primary h-full" style={{ width: "62%" }} title="Q3 ViDecomp đầy đủ (62%)" />
                <div className="bg-primary-fixed-dim/70 h-full" style={{ width: "24%" }} title="Q2 Phân rã phụ thuộc (24%)" />
                <div className="bg-surface-tint/30 h-full" style={{ width: "14%" }} title="B1 Hybrid RAG (14%)" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-unit-md pt-unit-xs">
                <div className="flex items-center gap-unit-xs">
                  <span className="w-3 h-3 rounded-full bg-primary flex-shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="font-label-md text-label-md text-on-surface font-medium truncate">
                      Q3 ViDecomp đầy đủ
                    </span>
                    <span className="font-label-sm text-label-sm text-outline">62% • 26.5M tokens</span>
                  </div>
                </div>
                <div className="flex items-center gap-unit-xs">
                  <span className="w-3 h-3 rounded-full bg-primary-fixed-dim/70 flex-shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="font-label-md text-label-md text-on-surface font-medium truncate">
                      Q2 Phân rã phụ thuộc
                    </span>
                    <span className="font-label-sm text-label-sm text-outline">24% • 10.3M tokens</span>
                  </div>
                </div>
                <div className="flex items-center gap-unit-xs">
                  <span className="w-3 h-3 rounded-full bg-surface-tint/30 flex-shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="font-label-md text-label-md text-on-surface font-medium truncate">
                      B1 Hybrid RAG
                    </span>
                    <span className="font-label-sm text-label-sm text-outline">14% • 6.0M tokens</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Department Distribution & Security Badges */}
          <div className="p-unit-xl rounded-DEFAULT bg-surface-container-low border border-outline-variant/20 flex flex-col justify-between gap-unit-md">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  Tiêu thụ theo Khối ban
                </h2>
                <span className="material-symbols-outlined text-outline text-[20px]">donut_large</span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                Dữ liệu phân bổ ngân sách AI nội bộ
              </p>
            </div>

            <div className="flex flex-col gap-unit-md">
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-label-sm text-label-sm">
                  <span className="text-on-surface font-medium flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-primary">terminal</span>
                    Engineering &amp; DevOps
                  </span>
                  <span className="text-on-surface-variant font-mono">45% (19.2M)</span>
                </div>
                <div className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden">
                  <div className="bg-primary h-full rounded-full" style={{ width: "45%" }} />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-label-sm text-label-sm">
                  <span className="text-on-surface font-medium flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-primary">draw</span>
                    Product &amp; UX/UI
                  </span>
                  <span className="text-on-surface-variant font-mono">28% (12.0M)</span>
                </div>
                <div className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden">
                  <div className="bg-primary/80 h-full rounded-full" style={{ width: "28%" }} />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-label-sm text-label-sm">
                  <span className="text-on-surface font-medium flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-primary">campaign</span>
                    Marketing &amp; Growth
                  </span>
                  <span className="text-on-surface-variant font-mono">18% (7.7M)</span>
                </div>
                <div className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden">
                  <div className="bg-primary/60 h-full rounded-full" style={{ width: "18%" }} />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-label-sm text-label-sm">
                  <span className="text-on-surface font-medium flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-primary">corporate_fare</span>
                    HR &amp; Legal Tuân thủ
                  </span>
                  <span className="text-on-surface-variant font-mono">9% (3.9M)</span>
                </div>
                <div className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden">
                  <div className="bg-primary/40 h-full rounded-full" style={{ width: "9%" }} />
                </div>
              </div>
            </div>

            <div className="p-unit-sm rounded-DEFAULT bg-surface-container-high border border-outline-variant/30 flex items-center justify-between">
              <div className="flex items-center gap-unit-xs">
                <span className="material-symbols-outlined text-primary text-[18px]">verified</span>
                <span className="font-label-sm text-label-sm text-on-surface">
                  Đạt tiêu chuẩn bảo mật dữ liệu cấp doanh nghiệp
                </span>
              </div>
              <span className="material-symbols-outlined text-outline text-[16px]">chevron_right</span>
            </div>
          </div>
        </div>

        {/* Security & Enterprise Governance Toggle Card */}
        <div className="p-unit-xl rounded-DEFAULT bg-surface-container-low border border-outline-variant/20 flex flex-col gap-unit-lg">
          <div className="flex flex-col md:flex-row md:items-center justify-between pb-unit-sm border-b border-outline-variant/20 gap-unit-xs">
            <div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-unit-xs font-bold">
                <span className="material-symbols-outlined text-primary text-[20px]">policy</span>
                Chính sách Bảo mật &amp; Dữ liệu Doanh nghiệp
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Các cài đặt bắt buộc trên toàn tổ chức đối với phiên làm việc và API
              </p>
            </div>
            <span className="font-label-sm text-label-sm text-primary bg-primary/10 px-unit-sm py-1 rounded-full font-medium">
              Bảo vệ Cấp độ Cao
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-unit-lg">
            {/* Toggle 1: Huấn luyện mô hình */}
            <div className="flex items-start justify-between p-unit-md rounded-DEFAULT bg-surface-container-high border border-outline-variant/30">
              <div className="flex flex-col gap-1 pr-unit-xs">
                <span className="font-label-md text-label-md text-on-surface font-medium">
                  Huấn luyện Mô hình
                </span>
                <span className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                  Không cho phép các nhà cung cấp AI dùng dữ liệu hội thoại và file đính kèm để training.
                </span>
                <span className="font-label-sm text-label-sm text-primary font-mono mt-1">
                  ĐÃ KHÓA CỨNG (ZERO-TRAINING)
                </span>
              </div>
              <div className="w-11 h-6 bg-primary rounded-full p-1 cursor-not-allowed relative opacity-90 flex-shrink-0">
                <div className="w-4 h-4 rounded-full bg-surface shadow-md transform translate-x-5 transition-transform" />
              </div>
            </div>

            {/* Toggle 2: Thời gian lưu trữ log */}
            <div className="flex items-start justify-between p-unit-md rounded-DEFAULT bg-surface-container-high border border-outline-variant/30">
              <div className="flex flex-col gap-1 pr-unit-xs">
                <span className="font-label-md text-label-md text-on-surface font-medium">
                  Nhật ký Lưu giữ (Retention)
                </span>
                <span className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                  Lưu trữ lịch sử prompt &amp; file tối đa {retentionDays} ngày phục vụ điều tra bảo mật.
                </span>
                <span className="font-label-sm text-label-sm text-outline font-mono mt-1">
                  {retentionDays} NGÀY TỰ ĐỘNG XOÁ
                </span>
              </div>
              <div
                onClick={() => {
                  const next = !isRetentionActive;
                  setIsRetentionActive(next);
                  onShowToast?.(next ? "Đã bật tự động dọn log 90 ngày" : "Đã tắt lưu giữ nhật ký");
                }}
                className={`w-11 h-6 rounded-full p-1 cursor-pointer relative flex-shrink-0 transition-colors ${
                  isRetentionActive ? "bg-primary" : "bg-surface-container-highest"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-surface shadow-md transform transition-transform ${
                    isRetentionActive ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </div>
            </div>

            {/* Toggle 3: SAML / Single Sign On */}
            <div className="flex items-start justify-between p-unit-md rounded-DEFAULT bg-surface-container-high border border-outline-variant/30">
              <div className="flex flex-col gap-1 pr-unit-xs">
                <span className="font-label-md text-label-md text-on-surface font-medium">
                  Bắt buộc Đăng nhập SAML SSO
                </span>
                <span className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                  Đồng bộ tự động Okta, Azure AD SAML 2.0 &amp; xác thực 2 lớp bắt buộc mọi tài khoản.
                </span>
                <span className="font-label-sm text-label-sm text-primary font-mono mt-1">
                  OKTA IDP KẾT NỐI 100%
                </span>
              </div>
              <div
                onClick={() => {
                  const next = !isSamlActive;
                  setIsSamlActive(next);
                  onShowToast?.(next ? "Đã bật bắt buộc SSO" : "Đã tắt xác thực SSO");
                }}
                className={`w-11 h-6 rounded-full p-1 cursor-pointer relative flex-shrink-0 transition-colors ${
                  isSamlActive ? "bg-primary" : "bg-surface-container-highest"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-surface shadow-md transform transition-transform ${
                    isSamlActive ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Member Management & Access Control Table Section */}
        <div className="flex flex-col gap-unit-md">
          {/* Table Header Bar: Filter Pills & Search Box */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-unit-md">
            <div className="flex items-center gap-unit-xs overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              <button
                type="button"
                onClick={() => setMemberFilter("all")}
                className={`px-unit-md py-unit-xs rounded-full font-label-md text-label-md whitespace-nowrap transition-all shadow-sm ${
                  memberFilter === "all"
                    ? "bg-primary text-on-primary font-bold"
                    : "bg-surface-container-high hover:bg-surface-container-highest text-on-surface border border-outline-variant/30"
                }`}
              >
                Tất cả ({members.length})
              </button>
              <button
                type="button"
                onClick={() => setMemberFilter("admin")}
                className={`px-unit-md py-unit-xs rounded-full font-label-md text-label-md whitespace-nowrap transition-all border ${
                  memberFilter === "admin"
                    ? "bg-primary text-on-primary font-bold border-primary"
                    : "bg-surface-container-high hover:bg-surface-container-highest text-on-surface border-outline-variant/30"
                }`}
              >
                Quản trị viên ({members.filter((m) => m.role === "admin" || m.role === "owner").length})
              </button>
              <button
                type="button"
                onClick={() => setMemberFilter("member")}
                className={`px-unit-md py-unit-xs rounded-full font-label-md text-label-md whitespace-nowrap transition-all border ${
                  memberFilter === "member"
                    ? "bg-primary text-on-primary font-bold border-primary"
                    : "bg-surface-container-high hover:bg-surface-container-highest text-on-surface border-outline-variant/30"
                }`}
              >
                Thành viên ({members.filter((m) => m.role === "member").length})
              </button>
            </div>

            {/* Search Bar */}
            <div className="relative flex items-center min-w-[280px]">
              <span className="material-symbols-outlined absolute left-unit-sm text-on-surface-variant text-[18px]">
                search
              </span>
              <input
                value={searchMember}
                onChange={(e) => setSearchMember(e.target.value)}
                className="w-full pl-9 pr-unit-md py-unit-xs rounded-full bg-surface-container-low text-on-surface placeholder:text-outline text-label-sm font-label-sm border border-outline-variant/30 focus:border-primary focus:outline-none transition-colors"
                placeholder="Tìm theo tên hoặc email..."
              />
            </div>
          </div>

          {/* High Density Clean Table */}
          <div className="w-full overflow-x-auto rounded-DEFAULT bg-surface-container-low border border-outline-variant/20 shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-outline-variant/20 bg-surface-container">
                  <th className="py-unit-sm px-unit-lg font-label-sm text-label-sm text-outline uppercase tracking-wider">
                    Người dùng &amp; Tài khoản
                  </th>
                  <th className="py-unit-sm px-unit-md font-label-sm text-label-sm text-outline uppercase tracking-wider">
                    Vai trò
                  </th>
                  <th className="py-unit-sm px-unit-md font-label-sm text-label-sm text-outline uppercase tracking-wider">
                    Quyền truy cập Mô hình
                  </th>
                  <th className="py-unit-sm px-unit-md font-label-sm text-label-sm text-outline uppercase tracking-wider">
                    Hoạt động cuối
                  </th>
                  <th className="py-unit-sm px-unit-md font-label-sm text-label-sm text-outline uppercase tracking-wider text-right">
                    30 ngày qua
                  </th>
                  <th className="py-unit-sm px-unit-lg font-label-sm text-label-sm text-outline uppercase tracking-wider text-right">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10 font-body-sm text-body-sm text-on-surface">
                {filteredMembers.map((m) => (
                  <tr key={m.id} className="hover:bg-surface-container-high/40 transition-colors group">
                    <td className="py-unit-md px-unit-lg">
                      <div className="flex items-center gap-unit-sm">
                        <div className="w-9 h-9 rounded-full bg-primary/20 text-primary flex items-center justify-center font-semibold text-sm border border-primary/30 flex-shrink-0">
                          {m.avatarText}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-label-md text-label-md text-on-surface font-medium truncate">
                            {m.name}
                          </span>
                          <span className="font-label-sm text-label-sm text-outline truncate">
                            {m.email}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-unit-md px-unit-md">
                      <span
                        className={`inline-flex items-center gap-1 px-unit-xs py-0.5 rounded-full font-label-sm text-label-sm font-medium ${
                          m.role === "owner"
                            ? "bg-primary/10 text-primary border border-primary/20"
                            : m.role === "admin"
                            ? "bg-surface-container-high text-on-surface border border-outline-variant/30"
                            : "bg-surface-container text-on-surface-variant border border-outline-variant/20"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          {m.role === "owner"
                            ? "shield_person"
                            : m.role === "admin"
                            ? "admin_panel_settings"
                            : "person"}
                        </span>
                        <span>
                          {m.role === "owner"
                            ? "Chủ sở hữu"
                            : m.role === "admin"
                            ? "Quản trị viên"
                            : "Thành viên"}
                        </span>
                      </span>
                    </td>
                    <td className="py-unit-md px-unit-md">
                      <span className="px-unit-xs py-0.5 rounded bg-surface-container font-label-sm text-label-sm text-on-surface border border-outline-variant/30">
                        {m.models}
                      </span>
                    </td>
                    <td className="py-unit-md px-unit-md">
                      <span className="flex items-center gap-1.5 text-on-surface-variant font-label-sm text-label-sm">
                        {m.lastActive === "Vừa xong" && (
                          <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                        )}
                        <span>{m.lastActive}</span>
                      </span>
                    </td>
                    <td className="py-unit-md px-unit-md text-right font-mono text-on-surface">
                      {m.tokens}
                    </td>
                    <td className="py-unit-md px-unit-lg text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => onShowToast?.(`Đang quản lý quyền hạn của ${m.name}`)}
                          className="p-1 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
                          title="Chỉnh sửa quyền"
                        >
                          <span className="material-symbols-outlined text-[18px]">tune</span>
                        </button>
                        {m.role !== "owner" && (
                          <button
                            type="button"
                            onClick={() => {
                              setMembers((prev) => prev.filter((it) => it.id !== m.id));
                              onShowToast?.(`Đã gỡ quyền thành viên ${m.name}`);
                            }}
                            className="p-1 rounded-full text-on-surface-variant hover:text-error hover:bg-surface-container transition-colors"
                            title="Xóa thành viên"
                          >
                            <span className="material-symbols-outlined text-[18px]">person_remove</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Table Pagination Footer */}
            <div className="p-unit-md bg-surface-container/50 border-t border-outline-variant/20 flex flex-col sm:flex-row items-center justify-between gap-unit-sm">
              <span className="font-label-sm text-label-sm text-outline">
                Hiển thị 1 - {filteredMembers.length} trong tổng số {members.length} thành viên được cấp phép
              </span>
              <div className="flex items-center gap-unit-xs">
                <button
                  type="button"
                  className="px-unit-sm py-1 rounded bg-surface-container text-outline hover:text-on-surface font-label-sm text-label-sm disabled:opacity-40"
                  disabled
                >
                  Trước
                </button>
                <span className="px-unit-sm py-1 rounded bg-primary text-on-primary font-label-sm text-label-sm font-bold">
                  1
                </span>
                <button
                  type="button"
                  className="px-unit-sm py-1 rounded bg-surface-container text-on-surface-variant hover:text-on-surface font-label-sm text-label-sm"
                >
                  2
                </button>
                <button
                  type="button"
                  className="px-unit-sm py-1 rounded bg-surface-container text-on-surface-variant hover:text-on-surface font-label-sm text-label-sm"
                >
                  Tiếp
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Action Banner / Support & API Link */}
        <div className="p-unit-lg rounded-DEFAULT bg-gradient-to-r from-surface-container-high via-surface-container to-surface-container-high border border-outline-variant/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-unit-md mb-8">
          <div className="flex items-center gap-unit-md">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
              <span className="material-symbols-outlined text-[24px]">support_agent</span>
            </div>
            <div className="flex flex-col">
              <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
                Chuyên viên Hỗ trợ Doanh nghiệp Riêng biệt (CSM)
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                Thỏa thuận cấp độ dịch vụ (SLA) cam kết 99.9% uptime và phản hồi hỗ trợ trong 30 phút.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-unit-xs flex-shrink-0">
            <button
              type="button"
              onClick={() => onShowToast?.("Đang tải tài liệu API & SDK...")}
              className="px-unit-md py-unit-xs rounded-full bg-surface-container-highest hover:bg-surface-bright text-on-surface font-label-md text-label-md transition-colors border border-outline-variant/30"
            >
              Tài liệu API &amp; SDK
            </button>
            <button
              type="button"
              onClick={() => onShowToast?.("Đã gửi yêu cầu kết nối tới chuyên viên hỗ trợ 24/7")}
              className="px-unit-md py-unit-xs rounded-full bg-primary text-on-primary hover:opacity-90 font-label-md text-label-md transition-colors font-bold"
            >
              Liên hệ Hỗ trợ 24/7
            </button>
          </div>
        </div>
      </div>

      {/* Modal Mời Thành viên Mới */}
      {isInviteModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-unit-md animate-in fade-in duration-200"
          onClick={() => setIsInviteModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-surface-container rounded-2xl border border-primary/30 p-unit-lg shadow-2xl space-y-unit-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-outline-variant/30 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">person_add</span>
                <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                  Mời thành viên mới
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="p-1 rounded-full text-outline hover:text-on-surface hover:bg-surface-container-high"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleInviteMember} className="space-y-4">
              <div>
                <label className="block text-[12px] font-semibold text-outline uppercase tracking-wider mb-1">
                  Địa chỉ Email doanh nghiệp *
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="nhanvien@techcorp.vn"
                  className="w-full bg-surface-container-high px-unit-md py-2.5 rounded-DEFAULT text-on-surface text-label-md outline-none border border-outline-variant/30 focus:border-primary"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-outline uppercase tracking-wider mb-1">
                  Họ và tên
                </label>
                <input
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                  className="w-full bg-surface-container-high px-unit-md py-2.5 rounded-DEFAULT text-on-surface text-label-md outline-none border border-outline-variant/30 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-outline uppercase tracking-wider mb-1">
                  Vai trò phân quyền
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setInviteRole("member")}
                    className={`p-2.5 rounded-DEFAULT border text-label-sm font-semibold transition-all ${
                      inviteRole === "member"
                        ? "bg-primary/20 border-primary text-primary"
                        : "bg-surface-container-high border-outline-variant/30 text-outline hover:text-on-surface"
                    }`}
                  >
                    Thành viên (Member)
                  </button>
                  <button
                    type="button"
                    onClick={() => setInviteRole("admin")}
                    className={`p-2.5 rounded-DEFAULT border text-label-sm font-semibold transition-all ${
                      inviteRole === "admin"
                        ? "bg-primary/20 border-primary text-primary"
                        : "bg-surface-container-high border-outline-variant/30 text-outline hover:text-on-surface"
                    }`}
                  >
                    Quản trị viên (Admin)
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/20">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="px-unit-lg py-2 rounded-full text-label-md text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={!inviteEmail.trim()}
                  className="px-unit-lg py-2 rounded-full bg-primary text-on-primary text-label-md font-bold hover:opacity-90 transition-all disabled:opacity-40"
                >
                  Gửi thư mời
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
