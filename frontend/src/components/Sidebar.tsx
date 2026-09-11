import { useEffect, useRef, useState } from "react";
import type { HistoryEntry, SessionGroup } from "../hooks/useHistory";
import { groupSessions } from "../hooks/useHistory";
import {
  VidecompLogo,
  IconSidebarCollapse,
  IconEditSquare,
  IconSearch,
  IconTrash,
} from "./Icons";

export type ViewKey = "chat" | "explore" | "workspace" | "builder" | "trace" | "eval" | "admin" | "landing";

export function Sidebar({
  view,
  onViewChange,
  history,
  onSelectSession,
  activeSessionId,
  onNewQuestion,
  healthStatus,
  apiBaseUrl,
  isCollapsed,
  onToggleCollapse,
  onOpenSettings,
  onOpenPricing,
  onDeleteSession,
  isAdmin = false,
  isAuthenticated = false,
  currentUser = null,
  onOpenAdminLogin,
  onLogoutAdmin,
  onShowToast,
}: {
  view: ViewKey;
  onViewChange: (v: ViewKey) => void;
  history: HistoryEntry[];
  onSelectSession: (group: SessionGroup) => void;
  activeSessionId: string | null;
  onNewQuestion: () => void;
  healthStatus: "ok" | "down" | "checking";
  apiBaseUrl: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenSettings: () => void;
  onOpenPricing?: () => void;
  onDeleteSession?: (sessionId: string) => void;
  isAdmin?: boolean;
  isAuthenticated?: boolean;
  currentUser?: { username: string; name?: string; email: string; role: "admin" | "user" } | null;
  onOpenAdminLogin?: () => void;
  onLogoutAdmin?: () => void;
  onShowToast?: (msg: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Phím tắt Ctrl+K để focus vào ô tìm kiếm
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const allSessions = groupSessions(history);

  // Lọc theo từ khóa tìm kiếm nếu có
  const filteredSessions = searchQuery.trim()
    ? allSessions.filter((s) =>
        s.turns.some(
          (t) =>
            t.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.result.final_answer.toLowerCase().includes(searchQuery.toLowerCase())
        )
      )
    : allSessions;

  // Phân nhóm theo thời gian
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const SEVEN_DAYS = 7 * ONE_DAY;

  const todaySessions = filteredSessions.filter(
    (s) => now - new Date(s.lastCreatedAt).getTime() < ONE_DAY
  );
  const pastWeekSessions = filteredSessions.filter(
    (s) =>
      now - new Date(s.lastCreatedAt).getTime() >= ONE_DAY &&
      now - new Date(s.lastCreatedAt).getTime() < SEVEN_DAYS
  );
  const olderSessions = filteredSessions.filter(
    (s) => now - new Date(s.lastCreatedAt).getTime() >= SEVEN_DAYS
  );

  const renderSessionGroup = (title: string, sessions: SessionGroup[]) => {
    if (sessions.length === 0) return null;
    return (
      <nav key={title} className="space-y-1">
        <div className="px-2 py-1 text-[11px] font-semibold text-outline uppercase tracking-wider select-none">
          {title}
        </div>
        {sessions.map((group) => {
          const first = group.turns[0];
          const isActive = activeSessionId === group.sessionId && view === "chat";
          return (
            <div
              key={group.sessionId}
              className={`group flex items-center justify-between gap-2 px-3 py-2 rounded-DEFAULT cursor-pointer transition-colors text-sm truncate ${
                isActive
                  ? "bg-surface-container-highest text-on-surface font-medium"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              }`}
              onClick={() => {
                onSelectSession(group);
                onViewChange("chat");
              }}
            >
              <div className="flex items-center gap-2 truncate min-w-0 flex-1">
                <span className="material-symbols-outlined text-[17px] text-outline group-hover:text-on-surface transition-colors flex-shrink-0">
                  chat_bubble
                </span>
                <span className="truncate text-label-md" title={first.question}>
                  {first.question}
                </span>
              </div>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
                <button
                  className="p-1 rounded hover:bg-surface-container text-outline hover:text-error transition-colors"
                  title="Xóa đoạn chat này"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onDeleteSession) onDeleteSession(group.sessionId);
                  }}
                >
                  <IconTrash width={13} height={13} />
                </button>
              </div>
            </div>
          );
        })}
      </nav>
    );
  };

  return (
    <aside
      className={`fixed left-0 top-0 h-screen w-[260px] bg-surface-container-low z-50 flex flex-col justify-between p-unit-sm select-none border-r border-outline-variant/30 transition-transform duration-300 ${
        isCollapsed ? "-translate-x-full pointer-events-none" : "translate-x-0"
      }`}
    >
      <div className="flex flex-col gap-unit-xs min-h-0">
        {/* Header Thương hiệu Videcomp-rag & Nút hành động */}
        <div className="flex items-center justify-between px-unit-xs py-unit-2xs">
          <div
            className="flex items-center gap-2 cursor-pointer group"
            onClick={() => {
              onNewQuestion();
              onViewChange("chat");
            }}
            title="Về màn hình chính / Hội thoại mới"
          >
            <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center border border-primary/30 shadow-sm group-hover:border-primary transition-colors">
              <VidecompLogo size={20} />
            </div>
            <span className="font-headline-sm text-[16px] tracking-tight font-semibold text-on-surface whitespace-nowrap">
              Videcomp-rag
            </span>
          </div>

          <div className="flex items-center gap-unit-2xs">
            <button
              className="p-unit-xs rounded-full hover:bg-surface-container-high hover:text-on-surface text-on-surface-variant transition-colors"
              title="Đóng thanh bên"
              type="button"
              onClick={onToggleCollapse}
            >
              <span className="material-symbols-outlined text-[20px]">dock_to_left</span>
            </button>
            <button
              className="p-unit-xs rounded-full hover:bg-surface-container-high hover:text-on-surface text-on-surface-variant transition-colors"
              title="Đoạn chat mới"
              type="button"
              onClick={() => {
                onNewQuestion();
                onViewChange("chat");
              }}
            >
              <span className="material-symbols-outlined text-[20px]">edit_square</span>
            </button>
          </div>
        </div>

        {/* Khung tìm kiếm đoạn chat */}
        <div className="mt-unit-xs px-unit-2xs">
          <div className="w-full flex items-center justify-between px-unit-sm py-1.5 rounded-DEFAULT bg-surface-container text-on-surface-variant focus-within:bg-surface-container-high focus-within:text-on-surface transition-colors">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="material-symbols-outlined text-[17px] text-outline">search</span>
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm đoạn chat"
                className="w-full bg-transparent border-0 outline-none text-on-surface placeholder:text-outline font-label-md text-label-md"
              />
            </div>
            <span className="font-label-sm text-[11px] text-outline px-1.5 py-[1px] bg-surface-container-lowest rounded-full shrink-0">
              Ctrl K
            </span>
          </div>
        </div>

        {/* Điều hướng thứ cấp: Khám phá GPTs, Lịch sử & Dự án, Cài đặt */}
        <div className="px-unit-2xs pt-unit-xs">
          <nav className="flex flex-col gap-1">
            <button
              className={`flex items-center gap-2.5 px-unit-sm py-unit-xs rounded-DEFAULT text-left font-label-md text-label-md transition-colors ${
                view === "landing"
                  ? "bg-primary/20 text-primary font-semibold border border-primary/30"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              }`}
              onClick={() => onViewChange("landing")}
            >
              <span className="material-symbols-outlined text-[18px]">public</span>
              <span className="flex-1 truncate">Trang giới thiệu</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
                Mới
              </span>
            </button>

            <button
              className={`flex items-center gap-2.5 px-unit-sm py-unit-xs rounded-DEFAULT text-left font-label-md text-label-md transition-colors ${
                view === "chat"
                  ? "bg-surface-container-highest text-on-surface font-semibold"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              }`}
              onClick={() => onViewChange("chat")}
            >
              <span className="material-symbols-outlined text-[18px]">chat</span>
              <span>Hỏi đáp &amp; Phân tích</span>
            </button>

            <button
              className={`flex items-center gap-2.5 px-unit-sm py-unit-xs rounded-DEFAULT text-left font-label-md text-label-md transition-colors ${
                view === "explore"
                  ? "bg-surface-container-highest text-on-surface font-semibold"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              }`}
              onClick={() => onViewChange("explore")}
            >
              <span className="material-symbols-outlined text-[18px]">explore</span>
              <span>Khám phá chuyên gia</span>
            </button>

            <button
              className={`flex items-center gap-2.5 px-unit-sm py-unit-xs rounded-DEFAULT text-left font-label-md text-label-md transition-colors ${
                view === "workspace"
                  ? "bg-surface-container-highest text-on-surface font-semibold"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              }`}
              onClick={() => onViewChange("workspace")}
            >
              <span className="material-symbols-outlined text-[18px]">folder_open</span>
              <span>Lịch sử &amp; Dự án</span>
            </button>

            <button
              className={`flex items-center gap-2.5 px-unit-sm py-unit-xs rounded-DEFAULT text-left font-label-md text-label-md transition-colors ${
                view === "builder"
                  ? "bg-surface-container-highest text-on-surface font-semibold"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              }`}
              onClick={() => onViewChange("builder")}
            >
              <span className="material-symbols-outlined text-[18px]">auto_fix_high</span>
              <span>Trình tạo Agent</span>
            </button>

            <button
              className={`flex items-center gap-2.5 px-unit-sm py-unit-xs rounded-DEFAULT text-left font-label-md text-label-md transition-colors ${
                view === "eval"
                  ? "bg-surface-container-highest text-on-surface font-semibold"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              }`}
              onClick={() => onViewChange("eval")}
            >
              <span className="material-symbols-outlined text-[18px]">science</span>
              <span>Đánh giá Benchmark</span>
            </button>

            <button
              className={`flex items-center gap-2.5 px-unit-sm py-unit-xs rounded-DEFAULT text-left font-label-md text-label-md transition-colors ${
                view === "trace"
                  ? "bg-surface-container-highest text-on-surface font-semibold"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              }`}
              onClick={() => onViewChange("trace")}
            >
              <span className="material-symbols-outlined text-[18px]">schema</span>
              <span>Tra cứu vết Trace</span>
            </button>

            {/* Mục Quản trị Workspace (Chức năng 6) */}
            <button
              className={`flex items-center gap-2.5 px-unit-sm py-unit-xs rounded-DEFAULT text-left font-label-md text-label-md transition-all ${
                view === "admin"
                  ? "bg-primary/20 text-primary font-bold border border-primary/30 shadow-sm"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              }`}
              onClick={() => {
                if (isAdmin) {
                  onViewChange("admin");
                } else if (isAuthenticated) {
                  onShowToast?.("Tài khoản của bạn không có quyền truy cập trang quản trị. Chỉ Quản trị viên (Admin) mới có quyền này.");
                } else if (onOpenAdminLogin) {
                  onOpenAdminLogin();
                }
              }}
            >
              <span className="material-symbols-outlined text-[18px] text-primary">shield_person</span>
              <span className="flex-1 truncate">Quản trị Workspace</span>
              {isAdmin ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-bold">
                  Admin
                </span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-container text-outline">
                  Khóa
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Danh sách lịch sử phân nhóm theo thời gian */}
        <div className="overflow-y-auto mt-unit-xs flex-1 pr-unit-2xs space-y-unit-md scrollbar-none">
          {allSessions.length === 0 ? (
            <div className="px-3 py-4 text-xs text-outline text-center">
              Chưa có đoạn chat nào.
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="px-3 py-4 text-xs text-outline text-center">
              Không tìm thấy đoạn chat phù hợp.
            </div>
          ) : (
            <>
              {renderSessionGroup("Hôm nay", todaySessions)}
              {renderSessionGroup("7 ngày qua", pastWeekSessions)}
              {renderSessionGroup("30 ngày trước", olderSessions)}
            </>
          )}
        </div>
      </div>

      {/* Phần chân trang Sidebar: Nâng cấp gói & Người dùng / Admin */}
      <div className="flex flex-col gap-unit-xs pt-unit-xs border-t border-outline-variant/30">
        <button
          className="flex items-center gap-unit-xs px-unit-sm py-unit-xs rounded-DEFAULT bg-surface-container hover:bg-surface-container-high hover:text-on-surface text-on-surface transition-colors text-left group"
          type="button"
          onClick={onOpenPricing}
        >
          <div className="p-unit-2xs rounded-full bg-primary-container text-on-primary-container flex items-center justify-center group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-label-md text-label-md font-semibold truncate text-on-surface">
              Nâng cấp gói
            </span>
            <span className="font-label-sm text-[11px] text-outline truncate">
              Mở khóa các mô hình tân tiến
            </span>
          </div>
        </button>

        {isAdmin ? (
          <div className="w-full flex items-center justify-between p-unit-xs rounded-DEFAULT bg-surface-container-high border border-primary/20">
            <div
              className="flex items-center gap-unit-xs min-w-0 cursor-pointer"
              onClick={() => onViewChange("admin")}
              title="Vào Admin Console"
            >
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold text-[11px] flex-shrink-0">
                {currentUser?.username ? currentUser.username.slice(0, 2).toUpperCase() : "AD"}
              </div>
              <div className="flex flex-col text-left truncate">
                <span className="font-label-md text-label-md font-bold text-on-surface truncate max-w-[120px]">
                  {currentUser?.name || currentUser?.username || "Admin Workspace"}
                </span>
                <span className="font-label-sm text-[10px] text-primary truncate">
                  {currentUser?.email || "admin@enterprise.ai"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onOpenSettings}
                className="p-1 rounded text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
                title="Cài đặt"
              >
                <span className="material-symbols-outlined text-[17px]">settings</span>
              </button>
              {onLogoutAdmin && (
                <button
                  type="button"
                  onClick={onLogoutAdmin}
                  className="p-1 rounded text-outline hover:text-error hover:bg-surface-container transition-colors"
                  title="Đăng xuất"
                >
                  <span className="material-symbols-outlined text-[17px]">logout</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div
            className="w-full flex items-center justify-between px-unit-xs py-unit-xs rounded-DEFAULT hover:bg-surface-container-high hover:text-on-surface text-on-surface-variant transition-colors text-left"
          >
            <div
              className="flex items-center gap-unit-xs min-w-0 cursor-pointer flex-1"
              onClick={onOpenSettings}
            >
              <div className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center flex-shrink-0 text-primary font-bold text-[11px]">
                {currentUser?.username ? (
                  currentUser.username.slice(0, 2).toUpperCase()
                ) : (
                  <span className="material-symbols-outlined text-outline text-[18px]">person</span>
                )}
              </div>
              <div className="flex flex-col text-left truncate">
                <span className="font-label-md text-label-md font-semibold text-on-surface truncate max-w-[130px]">
                  {currentUser?.name || currentUser?.username || "Người dùng"}
                </span>
                <span className="font-label-sm text-[11px] text-outline truncate flex items-center gap-1">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      healthStatus === "ok" ? "bg-primary" : "bg-error"
                    }`}
                  />
                  {currentUser?.email || (healthStatus === "ok" ? "API trực tuyến" : "Mất kết nối")}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {!isAuthenticated ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenAdminLogin?.();
                  }}
                  className="p-1 rounded hover:bg-surface-container text-outline hover:text-primary transition-colors"
                  title="Đăng nhập / Đăng ký"
                >
                  <span className="material-symbols-outlined text-[18px]">login</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenAdminLogin?.();
                  }}
                  className="p-1 rounded hover:bg-surface-container text-outline hover:text-primary transition-colors"
                  title="Đổi tài khoản"
                >
                  <span className="material-symbols-outlined text-[18px]">switch_account</span>
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenSettings();
                }}
                className="p-1 rounded hover:bg-surface-container text-outline hover:text-on-surface transition-colors"
                title="Cài đặt"
              >
                <span className="material-symbols-outlined text-[18px]">settings</span>
              </button>
              {onLogoutAdmin && isAuthenticated && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onLogoutAdmin();
                  }}
                  className="p-1 rounded hover:bg-surface-container text-outline hover:text-error transition-colors"
                  title="Đăng xuất"
                >
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
