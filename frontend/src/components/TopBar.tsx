import { useState } from "react";
import type { Domain, Mode } from "../api/types";
import { DOMAIN_LABEL } from "../api/types";
import { IconCheck } from "./Icons";

export function TopBar({
  isSidebarCollapsed,
  onToggleSidebar,
  domain,
  onDomainChange,
  mode,
  onModeChange,
  sessionId,
  onShowToast,
  onOpenSettings,
  onOpenVoiceMode,
  onOpenLanding,
  isAdmin = false,
  onOpenExport,
  onOpenShare,
}: {
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  domain: Domain;
  onDomainChange: (d: Domain) => void;
  mode: Mode;
  onModeChange: (m: Mode) => void;
  sessionId: string;
  onShowToast: (msg: string) => void;
  onOpenSettings: () => void;
  onOpenVoiceMode?: () => void;
  onOpenLanding?: () => void;
  isAdmin?: boolean;
  onOpenExport?: () => void;
  onOpenShare?: () => void;
}) {
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

  const MODES_LIST: { key: Mode; name: string; desc: string; tag: string }[] = [
    {
      key: "videcomp_full",
      name: "Q3 · ViDecomp đầy đủ",
      desc: "Phân rã đa bước + kiểm chứng từng luận điểm — thông minh & chính xác nhất",
      tag: "Khuyên dùng",
    },
    {
      key: "decomp_dependency",
      name: "Q2 · Phân rã phụ thuộc",
      desc: "Phân rã tuần tự có bắc cầu, bước sau dùng kết quả bước trước",
      tag: "Đa bước",
    },
    {
      key: "decomp_independent",
      name: "Q1 · Phân rã song song",
      desc: "Tách câu hỏi thành các câu con độc lập thực thi song song",
      tag: "Đa bước",
    },
    {
      key: "hybrid_rerank",
      name: "B2 · Hybrid + Rerank",
      desc: "BM25 + Dense vector + BGE Reranker tối ưu độ chuẩn xác",
      tag: "Tiêu chuẩn",
    },
    {
      key: "hybrid_rag",
      name: "B1 · Hybrid RAG",
      desc: "Kết hợp từ khóa BM25 và ngữ nghĩa vector đa chiều",
      tag: "Nhanh",
    },
    {
      key: "dense_rag",
      name: "B0 · Dense RAG",
      desc: "Tìm kiếm vector ngữ nghĩa đơn thuần",
      tag: "Cơ bản",
    },
  ];

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    onShowToast("Đã sao chép liên kết phiên làm việc vào bộ nhớ tạm");
  };

  return (
    <header
      className={`fixed top-0 right-0 h-14 bg-surface/90 backdrop-blur-xl z-40 flex items-center justify-between px-unit-lg border-b border-outline-variant/30 transition-all duration-300 ${
        isSidebarCollapsed ? "left-0" : "left-0 lg:left-[260px]"
      }`}
    >
      {/* Bên trái: Nút mở/đóng thanh bên & Bộ chọn mô hình Videcomp-rag */}
      <div className="flex items-center gap-unit-sm">
        <button
          className="p-unit-xs rounded-full hover:bg-surface-container-high hover:text-on-surface text-on-surface-variant transition-colors"
          title={isSidebarCollapsed ? "Mở thanh bên" : "Thu gọn thanh bên"}
          type="button"
          onClick={onToggleSidebar}
        >
          <span className="material-symbols-outlined text-[22px]">
            {isSidebarCollapsed ? "menu" : "menu_open"}
          </span>
        </button>

        <div className="relative">
          <button
            className="flex items-center gap-unit-2xs px-unit-sm py-1 rounded-DEFAULT hover:bg-surface-container-high hover:text-on-surface text-on-surface transition-colors select-none"
            type="button"
            onClick={() => setModelDropdownOpen((o) => !o)}
          >
            <span className="font-headline-sm text-headline-sm font-semibold tracking-tight">
              Videcomp-rag
            </span>
            <span className="font-label-sm text-[11px] text-primary px-2 py-[2px] bg-primary-container/20 rounded-full font-semibold">
              {mode === "videcomp_full" ? "Q3" : "4o"}
            </span>
            <span className="font-label-sm text-[12px] text-outline font-normal hidden sm:inline">
              ({DOMAIN_LABEL[domain]})
            </span>
            <span className="material-symbols-outlined text-outline text-[18px]">
              expand_more
            </span>
          </button>

          {modelDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setModelDropdownOpen(false)}
              />
              <div className="absolute left-0 mt-2 w-80 sm:w-96 rounded-xl bg-surface-container-high/95 backdrop-blur-xl border border-outline-variant/40 p-3 shadow-2xl z-50 flex flex-col gap-2">
                <div className="px-1 text-[11px] font-semibold text-outline uppercase tracking-wider">
                  Lĩnh vực tri thức
                </div>
                <div className="grid grid-cols-2 gap-2 mb-1">
                  <button
                    className={`flex items-center gap-2 p-2 rounded-DEFAULT text-left transition-all border ${
                      domain === "legal"
                        ? "bg-primary-container/20 border-primary/40 text-on-surface font-medium"
                        : "bg-surface-container border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-highest"
                    }`}
                    onClick={() => {
                      onDomainChange("legal");
                      onShowToast("Đã chọn lĩnh vực: Pháp luật");
                    }}
                  >
                    <span className="text-xl">⚖️</span>
                    <div className="min-w-0">
                      <div className="text-label-md font-semibold text-on-surface">Pháp luật</div>
                      <div className="text-[11px] text-outline truncate">Bộ luật, Nghị định</div>
                    </div>
                  </button>

                  <button
                    className={`flex items-center gap-2 p-2 rounded-DEFAULT text-left transition-all border ${
                      domain === "medical"
                        ? "bg-primary-container/20 border-primary/40 text-on-surface font-medium"
                        : "bg-surface-container border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-highest"
                    }`}
                    onClick={() => {
                      onDomainChange("medical");
                      onShowToast("Đã chọn lĩnh vực: Y tế");
                    }}
                  >
                    <span className="text-xl">🩺</span>
                    <div className="min-w-0">
                      <div className="text-label-md font-semibold text-on-surface">Y tế</div>
                      <div className="text-[11px] text-outline truncate">Phác đồ, Dược thư</div>
                    </div>
                  </button>
                </div>

                <div className="px-1 text-[11px] font-semibold text-outline uppercase tracking-wider mt-1">
                  Chiến lược truy hồi (Mode)
                </div>
                <div className="flex flex-col gap-1 max-h-60 overflow-y-auto pr-1">
                  {MODES_LIST.map((m) => {
                    const isSelected = mode === m.key;
                    return (
                      <button
                        key={m.key}
                        className={`flex items-start justify-between p-2 rounded-DEFAULT text-left transition-colors ${
                          isSelected
                            ? "bg-surface-container-highest text-on-surface font-medium"
                            : "hover:bg-surface-container text-on-surface-variant hover:text-on-surface"
                        }`}
                        onClick={() => {
                          onModeChange(m.key);
                          setModelDropdownOpen(false);
                          onShowToast(`Đã đổi chế độ: ${m.name}`);
                        }}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="text-label-md font-semibold flex items-center gap-2">
                            <span>{m.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-container-lowest text-primary">
                              {m.tag}
                            </span>
                          </div>
                          <div className="text-[11px] text-outline line-clamp-1">{m.desc}</div>
                        </div>
                        {isSelected && (
                          <span className="material-symbols-outlined text-primary text-[18px]">
                            check
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Thẻ định danh phiên bảo mật & Admin badge */}
        <div className="hidden md:flex items-center gap-1.5 px-unit-sm py-1 rounded-full bg-surface-container text-outline text-[12px] font-mono">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span>Phiên #{sessionId.slice(0, 8)}</span>
        </div>

        {isAdmin && (
          <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-[11px] font-bold">
            <span className="material-symbols-outlined text-[15px]">shield_person</span>
            <span>Admin Console</span>
          </div>
        )}
      </div>

      {/* Bên phải: Nút Landing, Chia sẻ, Voice Mode, Cài đặt và Avatar */}
      <div className="flex items-center gap-unit-xs">
        {onOpenLanding && (
          <button
            className="flex items-center gap-unit-xs px-unit-sm py-unit-xs rounded-full hover:bg-surface-container-high hover:text-primary text-on-surface-variant transition-colors"
            type="button"
            onClick={onOpenLanding}
            title="Trang giới thiệu (Landing Page)"
          >
            <span className="material-symbols-outlined text-[18px]">public</span>
            <span className="font-label-md text-label-md hidden md:inline">Giới thiệu</span>
          </button>
        )}

        {onOpenExport && (
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 transition-colors shadow-sm"
            type="button"
            onClick={onOpenExport}
            title="Xuất Báo cáo Thẩm định Chuyên nghiệp (.docx / .pdf)"
          >
            <span className="material-symbols-outlined text-[17px]">description</span>
            <span className="font-label-md text-[13px] font-bold hidden sm:inline">Xuất báo cáo</span>
          </button>
        )}

        <button
          className="flex items-center gap-unit-xs px-unit-sm py-unit-xs rounded-full hover:bg-surface-container-high hover:text-on-surface text-on-surface-variant transition-colors"
          type="button"
          onClick={onOpenShare || handleShare}
          title="Chia sẻ liên kết & Phân quyền cộng tác"
        >
          <span className="material-symbols-outlined text-[18px]">group_add</span>
          <span className="font-label-md text-label-md hidden sm:inline">Chia sẻ</span>
        </button>

        {onOpenVoiceMode && (
          <button
            className="p-unit-xs rounded-full hover:bg-surface-container-high hover:text-primary text-on-surface-variant transition-colors"
            title="Chế độ giọng nói nâng cao (Voice Mode)"
            type="button"
            onClick={onOpenVoiceMode}
          >
            <span className="material-symbols-outlined text-[20px]">mic</span>
          </button>
        )}

        <button
          className="p-unit-xs rounded-full hover:bg-surface-container-high hover:text-on-surface text-on-surface-variant transition-colors"
          title="Cài đặt hệ thống"
          type="button"
          onClick={onOpenSettings}
        >
          <span className="material-symbols-outlined text-[20px]">tune</span>
        </button>

        <div
          className="w-8 h-8 rounded-full bg-primary flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity"
          onClick={onOpenSettings}
          title="Tài khoản &amp; Cài đặt"
        >
          <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
        </div>
      </div>
    </header>
  );
}
