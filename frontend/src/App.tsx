import { useEffect, useState } from "react";
import {
  checkHealth,
  getApiBaseUrl,
  setApiBaseUrl as persistApiBaseUrl,
  askQuestion,
  loadIndex,
  ApiError,
  DEFAULT_INDEX_PATHS,
  INDEX_NOT_LOADED_DETAIL,
} from "./api/client";
import type { Domain, Mode } from "./api/types";
import { Sidebar } from "./components/Sidebar";
import type { ViewKey } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { ChatView } from "./views/ChatView";
import type { ChatItem } from "./components/MessagePair";
import { TraceLookupView } from "./views/TraceLookupView";
import { EvaluationView } from "./views/EvaluationView";
import { ExploreView } from "./views/ExploreView";
import { WorkspaceView } from "./views/WorkspaceView";
import { GPTBuilderView } from "./views/GPTBuilderView";
import { AdminConsoleView } from "./views/AdminConsoleView";
import { LandingView } from "./views/LandingView";
import { SettingsModal } from "./components/SettingsModal";
import { PricingModal } from "./components/PricingModal";
import { AdminLoginModal } from "./components/AdminLoginModal";
import { VoiceModeOverlay } from "./components/VoiceModeOverlay";
import { ExportDossierModal } from "./components/ExportDossierModal";
import { ShareModal } from "./components/ShareModal";
import { apiGetSharedSession } from "./api/client";
import { useHistory } from "./hooks/useHistory";
import type { HistoryEntry } from "./hooks/useHistory";
import { useCustomAgents } from "./hooks/useCustomAgents";
import type { CustomAgent } from "./types/agent";
import { useProjects } from "./hooks/useProjects";
import { useAuth } from "./hooks/useAuth";
import { IconCheck } from "./components/Icons";

export default function App() {
  // Phân quyền Quản trị viên & Xác thực
  const {
    currentUser,
    isAuthenticated,
    isAdmin,
    login,
    register,
    logout,
    isLoginModalOpen,
    openLoginModal,
    closeLoginModal,
  } = useAuth();

  // Mặc định khi vào thì xuất hiện Landing Page trước (toàn màn hình, không có Sidebar)
  const [view, setView] = useState<ViewKey>("landing");
  const [stream, setStream] = useState<ChatItem[]>([]);
  const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID());
  const [healthStatus, setHealthStatus] = useState<"ok" | "down" | "checking">("checking");
  const [apiBaseUrl, setApiBaseUrlState] = useState(getApiBaseUrl());

  // Trạng thái thu gọn/mở rộng thanh bên Sidebar
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Cấu hình mô hình dùng chung
  const [domain, setDomain] = useState<Domain>("legal");
  const [mode, setMode] = useState<Mode>("videcomp_full");

  // Modals & Chuyên gia tùy chỉnh
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [isVoiceModeOpen, setIsVoiceModeOpen] = useState(false);
  const [authInitialTab, setAuthInitialTab] = useState<"login" | "register">("login");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<string>("");

  // Modals Xuất báo cáo & Chia sẻ cộng tác
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportTarget, setExportTarget] = useState<{
    sessionId: string;
    turns?: any[];
    currentTurnIndex?: number;
    domain?: Domain;
    title?: string;
    sessionData?: any;
  } | null>(null);

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<{
    type: "session" | "project";
    id: string;
    title?: string;
  } | null>(null);

  // Quản lý Chuyên gia (Item 3) và Thư mục dự án (Item 4)
  const { agents, saveAgent, deleteAgent } = useCustomAgents(currentUser?.username);
  const { projects, createProject, deleteProject } = useProjects(currentUser?.username);
  const [activeAgent, setActiveAgent] = useState<CustomAgent | null>(null);
  const [editingAgent, setEditingAgent] = useState<CustomAgent | null>(null);

  const {
    entries,
    addEntry,
    removeSession,
    assignSessionFolder,
    assignSessionsFolder,
    setFeedback,
    clear,
  } = useHistory(currentUser?.username);

  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  const handleLogout = () => {
    logout();
    setView("landing");
    showToast("Đã đăng xuất khỏi hệ thống");
  };

  const handleLogin = async (u: string, p: string) => {
    const res = await login(u, p);
    if (res.success) {
      if (res.role === "admin") {
        setView("admin");
      } else {
        setView("chat");
      }
    }
    return res;
  };

  const handleRegister = async (data: {
    username: string;
    email: string;
    password: string;
    confirm_password: string;
    full_name?: string;
  }) => {
    const res = await register(data);
    if (res.success) {
      // Đăng ký tài khoản thành viên thành công -> vào trang Chat
      setView("chat");
    }
    return res;
  };

  // Bảo vệ phân quyền RBAC: Nếu không phải Admin thì không được ở trang Quản trị Admin
  useEffect(() => {
    if (view === "admin" && !isAdmin) {
      setView("chat");
      showToast("Bạn không có quyền truy cập trang quản trị. Chỉ Quản trị viên (Admin) mới có quyền này.");
    }
  }, [view, isAdmin]);

  // Xử lý nạp liên kết chia sẻ từ URL parameters (?share=TOKEN hoặc ?share_project=TOKEN)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sToken = params.get("share");
    if (sToken) {
      apiGetSharedSession(sToken)
        .then((shared) => {
          setSessionId(shared.sessionId);
          if (shared.domain) setDomain(shared.domain);
          if (shared.mode) setMode(shared.mode);
          if (shared.turns && shared.turns.length > 0) {
            setStream(shared.turns.map((entry) => ({ kind: "done", entry })));
          }
          setView("chat");
          showToast(`Đã mở phiên chia sẻ từ ${shared.owner}: "${shared.title}"`);
        })
        .catch((err) => {
          showToast(`Không thể nạp phiên chia sẻ: ${err.message}`);
        });
    }
  }, []);

  const handleOpenExport = (target?: {
    sessionId?: string;
    turns?: any[];
    currentTurnIndex?: number;
    domain?: Domain;
    title?: string;
    sessionData?: any;
  }) => {
    if (target?.sessionId) {
      setExportTarget({
        sessionId: target.sessionId,
        turns: target.turns || [],
        currentTurnIndex: target.currentTurnIndex ?? -1,
        domain: target.domain || domain,
        title: target.title || "",
        sessionData: target.sessionData,
      });
    } else {
      const currentTurns = stream.filter((s) => s.kind === "done").map((s) => (s as any).entry);
      setExportTarget({
        sessionId,
        turns: currentTurns,
        currentTurnIndex: currentTurns.length > 0 ? currentTurns.length - 1 : -1,
        domain,
        title: currentTurns[0]?.question ? `Thẩm định: ${currentTurns[0].question.slice(0, 60)}` : "",
      });
    }
    setIsExportModalOpen(true);
  };

  const handleOpenShare = (type: "session" | "project", id?: string, title?: string) => {
    const targetId = id || sessionId;
    setShareTarget({
      type,
      id: targetId,
      title: title || (type === "session" ? `Phiên #${targetId.slice(0, 8)}` : "Thư mục dự án"),
    });
    setIsShareModalOpen(true);
  };

  // Hỗ trợ liên kết trực tiếp #login hoặc #register khi mở ứng dụng
  useEffect(() => {
    if (window.location.hash === "#auth" || window.location.hash === "#login") {
      setAuthInitialTab("login");
      openLoginModal();
    } else if (window.location.hash === "#register") {
      setAuthInitialTab("register");
      openLoginModal();
    }
  }, [openLoginModal]);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 2400);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const res = await checkHealth();
      if (!cancelled) setHealthStatus(res ? "ok" : "down");
    };
    poll();
    const timer = setInterval(poll, 20000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [apiBaseUrl]);

  const handleFeedback = (requestId: string, v: "up" | "down") => {
    setFeedback(requestId, v);
    setStream((prev) =>
      prev.map((item) =>
        item.kind === "done" && item.entry.requestId === requestId
          ? { ...item, entry: { ...item.entry, feedback: item.entry.feedback === v ? undefined : v } }
          : item
      )
    );
    showToast(v === "up" ? "Cảm ơn bạn đã đánh giá hữu ích!" : "Đã ghi nhận phản hồi chưa tốt.");
  };

  const handleNewQuestion = () => {
    setStream([]);
    setPendingQuestion("");
    setActiveAgent(null);
    setSessionId(crypto.randomUUID());
    setView("chat");
  };

  const handlePickExplorePrompt = (promptText: string) => {
    setView("chat");
    setStream([]);
    setActiveAgent(null);
    setPendingQuestion(promptText);
    setSessionId(crypto.randomUUID());
    showToast("Đã tải câu hỏi của chuyên gia — bấm Gửi để tra cứu");
  };

  const handleSelectCustomAgent = (agent: CustomAgent) => {
    setActiveAgent(agent);
    setDomain(agent.domain);
    setStream([]);
    setPendingQuestion(agent.starters[0] || "");
    setSessionId(crypto.randomUUID());
    setView("chat");
    showToast(`Đang trò chuyện cùng: ${agent.name}`);
  };

  const handleVoiceAsk = async (question: string): Promise<string> => {
    const askOnce = () =>
      askQuestion({
        question,
        domain,
        mode,
        top_k: 8,
        rerank_top_k: 5,
        max_corrective_rounds: 1,
      });

    let result;
    try {
      result = await askOnce();
    } catch (err) {
      const isIndexNotLoaded = err instanceof ApiError && err.message === INDEX_NOT_LOADED_DETAIL;
      const defaultPaths = DEFAULT_INDEX_PATHS[domain];
      if (isIndexNotLoaded && defaultPaths) {
        showToast("Đang tự nạp dữ liệu tri thức lần đầu...");
        await loadIndex(domain, defaultPaths.bm25Dir, defaultPaths.vectorDir);
        result = await askOnce();
      } else {
        throw err;
      }
    }

    const entry: HistoryEntry = {
      requestId: result.request_id,
      sessionId,
      question,
      domain,
      mode,
      createdAt: new Date().toISOString(),
      result,
      usedContext: false,
    };
    addEntry(entry);
    setStream((prev) => [...prev, { kind: "done", entry }]);
    return result.final_answer;
  };

  // KHI Ở TRANG LANDING PAGE: Hiển thị ĐỘC LẬP TOÀN MÀN HÌNH, KHÔNG CÓ THANH BÊN SIDEBAR VÀ TOPBAR
  if (view === "landing") {
    return (
      <div className="w-screen h-screen overflow-hidden bg-surface text-on-surface select-none">
        <LandingView
          isAuthenticated={isAuthenticated}
          currentUser={currentUser}
          onStartChat={() => {
            if (isAuthenticated) {
              setView("chat");
            } else {
              setAuthInitialTab("register");
              openLoginModal();
            }
          }}
          onOpenExplore={() => {
            if (isAuthenticated) {
              setView("explore");
            } else {
              setAuthInitialTab("login");
              openLoginModal();
            }
          }}
          onOpenPricing={() => setIsPricingOpen(true)}
          onOpenAdminLogin={() => {
            setAuthInitialTab("login");
            openLoginModal();
          }}
          onLogout={handleLogout}
          onOpenTrace={() => {
            if (isAuthenticated) {
              setView("trace");
            } else {
              setAuthInitialTab("login");
              openLoginModal();
            }
          }}
        />

        {/* Modal Đăng nhập & Đăng ký Fullscreen Cinematic */}
        <AdminLoginModal
          isOpen={isLoginModalOpen}
          onClose={closeLoginModal}
          onLogin={handleLogin}
          onRegister={handleRegister}
          onShowToast={showToast}
          initialTab={authInitialTab}
        />

        {/* Modal Bảng giá Nâng cấp gói */}
        <PricingModal
          isOpen={isPricingOpen}
          onClose={() => setIsPricingOpen(false)}
          onShowToast={showToast}
        />

        {/* Thông báo nổi (Toast Notification) */}
        {toastMessage && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-unit-lg py-2.5 rounded-full bg-surface-container-highest/95 border border-primary/40 text-on-surface shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-3 duration-200">
            <IconCheck width={15} height={15} style={{ color: "var(--primary)" }} />
            <span className="font-label-md text-label-md font-medium">{toastMessage}</span>
          </div>
        )}
      </div>
    );
  }

  // KHI ĐÃ ĐĂNG NHẬP HOẶC VÀO ỨNG DỤNG: Hiển thị App Shell đầy đủ với Sidebar bên trái
  return (
    <div className="app-shell flex h-screen w-screen overflow-hidden bg-surface text-on-surface select-none">
      {/* Sidebar Điều hướng Trái */}
      <Sidebar
        view={view}
        onViewChange={setView}
        history={entries}
        onSelectSession={(group) => {
          setStream(group.turns.map((entry) => ({ kind: "done", entry })));
          setSessionId(group.sessionId);
          if (group.turns[0]) {
            setDomain(group.turns[0].domain);
            setMode(group.turns[0].mode);
          }
          setView("chat");
        }}
        activeSessionId={stream.length > 0 ? sessionId : null}
        onNewQuestion={handleNewQuestion}
        healthStatus={healthStatus}
        apiBaseUrl={apiBaseUrl}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((v) => !v)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenPricing={() => setIsPricingOpen(true)}
        isAdmin={isAdmin}
        isAuthenticated={isAuthenticated}
        currentUser={currentUser}
        onOpenAdminLogin={() => {
          setAuthInitialTab("login");
          openLoginModal();
        }}
        onLogoutAdmin={handleLogout}
        onShowToast={showToast}
        onDeleteSession={(sid) => {
          removeSession(sid);
          if (sessionId === sid) {
            handleNewQuestion();
          }
          showToast("Đã xóa đoạn chat thành công");
        }}
      />

      {/* Main App Container */}
      <div
        className={`flex-1 flex flex-col h-full overflow-hidden transition-all duration-300 relative ${
          isSidebarCollapsed ? "pl-0" : "pl-0 lg:pl-[260px]"
        }`}
      >
        {/* TopBar cố định trên đỉnh */}
        <TopBar
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed((v) => !v)}
          domain={domain}
          onDomainChange={(d) => {
            setDomain(d);
            showToast(`Đã chọn lĩnh vực: ${d === "legal" ? "Pháp luật" : "Y tế"}`);
          }}
          mode={mode}
          onModeChange={(m) => {
            setMode(m);
            showToast(`Đã đổi chế độ: ${m}`);
          }}
          sessionId={sessionId}
          onShowToast={showToast}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenVoiceMode={() => setIsVoiceModeOpen(true)}
          onOpenLanding={() => setView("landing")}
          isAdmin={isAdmin}
          onOpenExport={() => handleOpenExport()}
          onOpenShare={() => handleOpenShare("session", sessionId)}
        />

        {/* Khu vực nội dung View chính */}
        <main className="flex-1 flex flex-col h-full overflow-hidden relative">
          {view === "chat" && (
            <ChatView
              stream={stream}
              setStream={setStream}
              sessionId={sessionId}
              addHistoryEntry={addEntry}
              onFeedback={handleFeedback}
              domain={domain}
              setDomain={setDomain}
              mode={mode}
              setMode={setMode}
              onShowToast={showToast}
              onOpenVoiceMode={() => setIsVoiceModeOpen(true)}
              initialQuestion={pendingQuestion}
              onClearInitialQuestion={() => setPendingQuestion("")}
              activeAgent={activeAgent}
              onClearActiveAgent={() => {
                setActiveAgent(null);
                showToast("Đã chuyển về Trợ lý mặc định");
              }}
              onExportTurn={(item) => {
                if (item.kind === "done") {
                  handleOpenExport({
                    sessionId,
                    turns: [item.entry],
                    currentTurnIndex: 0,
                    domain: item.entry.domain,
                    title: `Thẩm định: ${item.entry.question.slice(0, 60)}`,
                  });
                }
              }}
              onShareTurn={() => {
                handleOpenShare("session", sessionId);
              }}
            />
          )}

          {view === "explore" && (
            <ExploreView
              customAgents={agents}
              onSelectPrompt={handlePickExplorePrompt}
              onSelectAgent={handleSelectCustomAgent}
              onOpenBuilder={() => {
                setEditingAgent(null);
                setView("builder");
              }}
              onEditAgent={(agent) => {
                setEditingAgent(agent);
                setView("builder");
              }}
              onDeleteAgent={(id) => {
                deleteAgent(id);
                if (activeAgent?.id === id) setActiveAgent(null);
                showToast("Đã xóa chuyên gia khỏi Videcomp Store");
              }}
            />
          )}

          {view === "workspace" && (
            <WorkspaceView
              history={entries}
              projects={projects}
              onCreateProject={createProject}
              onDeleteProject={deleteProject}
              onAssignSessionFolder={assignSessionFolder}
              onAssignSessionsFolder={assignSessionsFolder}
              onSelectSession={(group) => {
                setStream(group.turns.map((entry) => ({ kind: "done", entry })));
                setSessionId(group.sessionId);
                if (group.turns[0]) {
                  setDomain(group.turns[0].domain);
                  setMode(group.turns[0].mode);
                }
                setView("chat");
              }}
              onNewChat={handleNewQuestion}
              onDeleteSession={(sid) => {
                removeSession(sid);
                showToast("Đã xóa cuộc hội thoại");
              }}
              onShowToast={showToast}
              onShareProject={(proj) => {
                handleOpenShare("project", proj.id, proj.title);
              }}
              onShareSession={(group) => {
                handleOpenShare("session", group.sessionId, group.turns[0]?.question || "Phiên tra cứu");
              }}
              onExportSession={(group) => {
                handleOpenExport({
                  sessionId: group.sessionId,
                  turns: group.turns,
                  currentTurnIndex: -1,
                  domain: group.turns[0]?.domain || domain,
                  title: group.turns[0]?.question ? `Thẩm định: ${group.turns[0].question.slice(0, 60)}` : "",
                });
              }}
            />
          )}

          {view === "builder" && (
            <GPTBuilderView
              initialAgent={editingAgent}
              onBack={() => {
                setEditingAgent(null);
                setView("explore");
              }}
              onSaveAgent={(agent) => {
                saveAgent(agent);
                setEditingAgent(null);
              }}
              onShowToast={showToast}
            />
          )}

          {view === "admin" && (
            <AdminConsoleView
              onShowToast={showToast}
              onLogout={handleLogout}
            />
          )}

          {view === "trace" && (
            <div className="flex-1 overflow-y-auto pt-16 scrollbar-none">
              <TraceLookupView />
            </div>
          )}

          {view === "eval" && (
            <div className="flex-1 overflow-y-auto pt-16 scrollbar-none">
              <EvaluationView />
            </div>
          )}
        </main>
      </div>

      {/* Cửa sổ Cài đặt (SettingsModal) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        apiBaseUrl={apiBaseUrl}
        onApiBaseUrlChange={(url) => {
          persistApiBaseUrl(url);
          setApiBaseUrlState(getApiBaseUrl());
          setHealthStatus("checking");
          showToast("Đã cập nhật cấu hình API");
        }}
        healthStatus={healthStatus}
        historyCount={entries.length}
        onClearHistory={() => {
          clear();
          setStream([]);
          showToast("Đã xóa toàn bộ lịch sử trò chuyện");
        }}
      />

      {/* Cửa sổ Bảng giá Nâng cấp gói (PricingModal) */}
      <PricingModal
        isOpen={isPricingOpen}
        onClose={() => setIsPricingOpen(false)}
        onShowToast={showToast}
      />

      {/* Modal Đăng nhập / Đăng ký Quản trị viên & Người dùng Fullscreen Cinematic */}
      <AdminLoginModal
        isOpen={isLoginModalOpen}
        onClose={closeLoginModal}
        onLogin={handleLogin}
        onRegister={handleRegister}
        onShowToast={showToast}
        initialTab={authInitialTab}
      />

      {/* Lớp phủ Chế độ giọng nói nâng cao (VoiceModeOverlay) */}
      <VoiceModeOverlay
        isOpen={isVoiceModeOpen}
        onClose={() => setIsVoiceModeOpen(false)}
        domain={domain}
        mode={mode}
        onAskQuestion={handleVoiceAsk}
        onShowToast={showToast}
      />

      {/* Thông báo nổi (Toast Notification) */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-unit-lg py-2.5 rounded-full bg-surface-container-highest/95 border border-primary/40 text-on-surface shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-3 duration-200">
          <IconCheck width={15} height={15} style={{ color: "var(--primary)" }} />
          <span className="font-label-md text-label-md font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Modal Xuất Báo cáo Chuyên nghiệp (.docx / .pdf) */}
      <ExportDossierModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        sessionId={exportTarget?.sessionId || sessionId}
        turns={exportTarget?.turns}
        currentTurnIndex={exportTarget?.currentTurnIndex}
        domain={exportTarget?.domain || domain}
        title={exportTarget?.title}
        sessionData={exportTarget?.sessionData}
        onShowToast={showToast}
      />

      {/* Modal Chia sẻ & Phân quyền Cộng tác */}
      {shareTarget && (
        <ShareModal
          isOpen={isShareModalOpen}
          onClose={() => {
            setIsShareModalOpen(false);
            setShareTarget(null);
          }}
          targetType={shareTarget.type}
          targetId={shareTarget.id}
          targetTitle={shareTarget.title}
          onShowToast={showToast}
        />
      )}
    </div>
  );
}

