import { useState } from "react";

export function SettingsModal({
  isOpen,
  onClose,
  apiBaseUrl,
  onApiBaseUrlChange,
  healthStatus,
  historyCount,
  onClearHistory,
}: {
  isOpen: boolean;
  onClose: () => void;
  apiBaseUrl: string;
  onApiBaseUrlChange: (url: string) => void;
  healthStatus: "ok" | "down" | "checking";
  historyCount: number;
  onClearHistory: () => void;
}) {
  const [activeTab, setActiveTab] = useState<
    "general" | "personalization" | "data" | "billing" | "beta" | "security"
  >("general");
  const [urlInput, setUrlInput] = useState(apiBaseUrl);
  const [theme, setTheme] = useState("dark");
  const [soundEffects, setSoundEffects] = useState(true);
  const [voice, setVoice] = useState("Breeze (Ấm áp, tự nhiên)");
  const [customInstructions, setCustomInstructions] = useState(
    "Ưu tiên trích dẫn chính xác số hiệu văn bản pháp luật và thông tư y tế của Việt Nam. Luôn trình bày luận điểm có căn cứ đối chiếu."
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-unit-md md:p-unit-xl">
      {/* Nền mờ Backdrop */}
      <div
        className="absolute inset-0 bg-surface-container-lowest/80 backdrop-blur-md"
        onClick={onClose}
      />
      <div className="absolute w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px] pointer-events-none -top-20 right-1/4" />

      {/* Khung Modal chính */}
      <div className="relative z-10 w-full max-w-5xl h-[680px] bg-surface-container-low rounded-xl shadow-2xl flex flex-col overflow-hidden text-on-surface border border-outline-variant/30 animate-in fade-in zoom-in-95 duration-200">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-unit-xl py-unit-md bg-surface-container-low border-b border-outline-variant/30">
          <div className="flex items-center gap-unit-sm">
            <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[20px]">tune</span>
            </div>
            <div>
              <h1 className="font-headline-sm text-headline-sm tracking-tight text-on-surface">
                Cài đặt
              </h1>
              <p className="font-label-sm text-[12px] text-on-surface-variant">
                Quản lý tùy chọn trải nghiệm, dữ liệu cá nhân và cấu hình mô hình Videcomp-rag
              </p>
            </div>
          </div>
          <button
            className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
            onClick={onClose}
            title="Đóng cài đặt"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Thân hộp thoại chia 2 cột */}
        <div className="flex flex-1 min-h-0 overflow-hidden bg-surface-container-low">
          {/* Cột trái: Danh sách Tab */}
          <nav className="w-64 flex flex-col py-unit-xs px-unit-sm bg-surface-container-lowest/50 select-none overflow-y-auto gap-1 border-r border-outline-variant/30">
            <button
              className={`w-full flex items-center gap-unit-sm px-unit-md py-unit-sm rounded-DEFAULT text-left font-label-md text-label-md transition-colors ${
                activeTab === "general"
                  ? "bg-surface-container-highest text-on-surface font-semibold"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              }`}
              onClick={() => setActiveTab("general")}
              type="button"
            >
              <span className="material-symbols-outlined text-[20px] text-primary">settings</span>
              <span className="truncate">Chung</span>
            </button>

            <button
              className={`w-full flex items-center gap-unit-sm px-unit-md py-unit-sm rounded-DEFAULT text-left font-label-md text-label-md transition-colors ${
                activeTab === "personalization"
                  ? "bg-surface-container-highest text-on-surface font-semibold"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              }`}
              onClick={() => setActiveTab("personalization")}
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">psychology</span>
              <span className="truncate">Cá nhân hoá</span>
            </button>

            <button
              className={`w-full flex items-center gap-unit-sm px-unit-md py-unit-sm rounded-DEFAULT text-left font-label-md text-label-md transition-colors ${
                activeTab === "data"
                  ? "bg-surface-container-highest text-on-surface font-semibold"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              }`}
              onClick={() => setActiveTab("data")}
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">database</span>
              <span className="truncate">Kiểm soát dữ liệu</span>
            </button>

            <button
              className={`w-full flex items-center justify-between px-unit-md py-unit-sm rounded-DEFAULT text-left font-label-md text-label-md transition-colors ${
                activeTab === "billing"
                  ? "bg-surface-container-highest text-on-surface font-semibold"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              }`}
              onClick={() => setActiveTab("billing")}
              type="button"
            >
              <div className="flex items-center gap-unit-sm min-w-0">
                <span className="material-symbols-outlined text-[20px]">credit_card</span>
                <span className="truncate">Tài khoản &amp; Gói</span>
              </div>
              <span className="font-label-sm text-[10px] px-1.5 py-[1px] bg-primary-container/20 text-primary rounded-full font-medium">
                Plus
              </span>
            </button>

            <button
              className={`w-full flex items-center gap-unit-sm px-unit-md py-unit-sm rounded-DEFAULT text-left font-label-md text-label-md transition-colors ${
                activeTab === "beta"
                  ? "bg-surface-container-highest text-on-surface font-semibold"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              }`}
              onClick={() => setActiveTab("beta")}
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">science</span>
              <span className="truncate">Tính năng thử nghiệm</span>
            </button>

            <button
              className={`w-full flex items-center gap-unit-sm px-unit-md py-unit-sm rounded-DEFAULT text-left font-label-md text-label-md transition-colors ${
                activeTab === "security"
                  ? "bg-surface-container-highest text-on-surface font-semibold"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              }`}
              onClick={() => setActiveTab("security")}
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">shield</span>
              <span className="truncate">Bảo mật</span>
            </button>

            {/* Thước đo bộ nhớ ngữ cảnh ở chân sidebar */}
            <div className="mt-auto p-unit-sm rounded-DEFAULT bg-surface-container/70 flex flex-col gap-unit-xs border border-outline-variant/30">
              <div className="flex justify-between items-center text-on-surface-variant font-label-sm text-[12px]">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  Bộ nhớ ngữ cảnh
                </span>
                <span className="text-on-surface font-semibold">
                  {Math.min(100, Math.round((historyCount / 20) * 100))}%
                </span>
              </div>
              <div className="w-full bg-surface-container-lowest h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(5, (historyCount / 20) * 100))}%` }}
                />
              </div>
              <span className="font-code-md text-[11px] text-outline">
                {historyCount} / 20 hội thoại đã ghi
              </span>
            </div>
          </nav>

          {/* Cột phải: Nội dung chi tiết các Tab */}
          <div className="flex-1 overflow-y-auto px-unit-xl py-unit-lg bg-surface min-w-0 space-y-unit-lg">
            {activeTab === "general" && (
              <div className="flex flex-col gap-unit-xl">
                {/* Giao diện & Hiển thị */}
                <div className="flex flex-col gap-unit-xs">
                  <span className="font-label-sm text-[12px] text-primary uppercase tracking-wider font-semibold">
                    Giao diện &amp; Hiển thị
                  </span>
                  <div className="flex items-center justify-between py-unit-sm border-b border-outline-variant/20">
                    <div className="flex flex-col min-w-0 pr-unit-md">
                      <span className="font-label-md text-label-md font-semibold text-on-surface">
                        Chủ đề giao diện
                      </span>
                      <span className="font-body-sm text-[13px] text-on-surface-variant">
                        Tùy chỉnh màu hiển thị của ứng dụng trên thiết bị
                      </span>
                    </div>
                    <select
                      value={theme}
                      onChange={(e) => setTheme(e.target.value)}
                      className="bg-surface-container-high text-on-surface font-label-md text-label-md px-unit-md py-1.5 rounded-full outline-none border border-outline-variant/30"
                    >
                      <option value="dark">Tối - OLED Midnight (Mặc định)</option>
                      <option value="system">Theo hệ điều hành</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between py-unit-sm border-b border-outline-variant/20">
                    <div className="flex flex-col min-w-0 pr-unit-md">
                      <span className="font-label-md text-label-md font-semibold text-on-surface">
                        Ngôn ngữ giao diện
                      </span>
                      <span className="font-body-sm text-[13px] text-on-surface-variant">
                        Ngôn ngữ hiển thị cho các nút bấm, mô tả và hệ thống
                      </span>
                    </div>
                    <select className="bg-surface-container-high text-on-surface font-label-md text-label-md px-unit-md py-1.5 rounded-full outline-none border border-outline-variant/30">
                      <option>Tiếng Việt (Vietnamese)</option>
                      <option>English</option>
                    </select>
                  </div>
                </div>

                {/* Cấu hình Backend & API */}
                <div className="flex flex-col gap-unit-xs">
                  <span className="font-label-sm text-[12px] text-primary uppercase tracking-wider font-semibold">
                    Máy chủ API &amp; Dịch vụ Backend
                  </span>
                  <div className="flex flex-col gap-2 py-unit-sm border-b border-outline-variant/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-label-md text-label-md font-semibold text-on-surface">
                          Địa chỉ API Backend
                        </span>
                        <p className="font-body-sm text-[13px] text-on-surface-variant">
                          Endpoint kết nối tới dịch vụ FastAPI ViDecomp-RAG
                        </p>
                      </div>
                      <span
                        className={`text-label-sm px-2.5 py-1 rounded-full font-medium ${
                          healthStatus === "ok"
                            ? "bg-primary-container/20 text-primary"
                            : "bg-error-container/20 text-error"
                        }`}
                      >
                        {healthStatus === "ok" ? "Đã kết nối" : "Mất kết nối"}
                      </span>
                    </div>
                    <div className="flex gap-2 mt-1">
                      <input
                        type="text"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="http://localhost:8000"
                        className="flex-1 bg-surface-container-high px-unit-md py-2 rounded-DEFAULT text-on-surface text-label-md font-mono outline-none border border-outline-variant/30 focus:border-primary"
                      />
                      <button
                        type="button"
                        onClick={() => onApiBaseUrlChange(urlInput)}
                        className="px-unit-lg py-2 rounded-DEFAULT bg-primary text-on-primary font-label-md font-semibold hover:opacity-90 transition-opacity"
                      >
                        Lưu địa chỉ
                      </button>
                    </div>
                  </div>
                </div>

                {/* Âm thanh & Giọng nói */}
                <div className="flex flex-col gap-unit-xs">
                  <span className="font-label-sm text-[12px] text-primary uppercase tracking-wider font-semibold">
                    Âm thanh &amp; Giọng nói
                  </span>
                  <div className="flex items-center justify-between py-unit-sm border-b border-outline-variant/20">
                    <div className="flex flex-col min-w-0 pr-unit-md">
                      <span className="font-label-md text-label-md font-semibold text-on-surface">
                        Giọng đọc mô hình (Voice)
                      </span>
                      <span className="font-body-sm text-[13px] text-on-surface-variant">
                        Giọng điệu khi trò chuyện trực tiếp qua chế độ thoại nâng cao
                      </span>
                    </div>
                    <select
                      value={voice}
                      onChange={(e) => setVoice(e.target.value)}
                      className="bg-surface-container-high text-on-surface font-label-md text-label-md px-unit-md py-1.5 rounded-full outline-none border border-outline-variant/30"
                    >
                      <option>Breeze (Ấm áp, tự nhiên)</option>
                      <option>Cove (Trầm tĩnh, chính xác)</option>
                      <option>Ember (Tự tin, sinh động)</option>
                      <option>Juniper (Nhẹ nhàng, cởi mở)</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between py-unit-sm">
                    <div className="flex flex-col min-w-0 pr-unit-md">
                      <span className="font-label-md text-label-md font-semibold text-on-surface">
                        Hiệu ứng âm thanh
                      </span>
                      <span className="font-body-sm text-[13px] text-on-surface-variant">
                        Phát tiếng ting nhẹ khi hoàn tất câu trả lời đa bước
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSoundEffects((v) => !v)}
                      className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
                        soundEffects ? "bg-primary" : "bg-surface-container-highest"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-surface-container-lowest transition-transform ${
                          soundEffects ? "translate-x-6" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "personalization" && (
              <div className="flex flex-col gap-unit-lg">
                <span className="font-label-sm text-[12px] text-primary uppercase tracking-wider font-semibold">
                  Cá nhân hóa trải nghiệm AI
                </span>
                <div className="flex flex-col gap-2">
                  <span className="font-label-md text-label-md font-semibold text-on-surface">
                    Hướng dẫn tùy chỉnh cho Videcomp-rag (Custom Instructions)
                  </span>
                  <p className="font-body-sm text-[13px] text-on-surface-variant">
                    Mô hình sẽ tự động áp dụng những chỉ dẫn này trong mỗi phiên hỏi đáp.
                  </p>
                  <textarea
                    rows={5}
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    className="w-full bg-surface-container-high p-unit-md rounded-DEFAULT text-on-surface font-body-md text-[14px] outline-none border border-outline-variant/30 focus:border-primary leading-relaxed"
                  />
                </div>
              </div>
            )}

            {activeTab === "data" && (
              <div className="flex flex-col gap-unit-lg">
                <span className="font-label-sm text-[12px] text-primary uppercase tracking-wider font-semibold">
                  Kiểm soát dữ liệu &amp; Lưu trữ
                </span>
                <div className="flex items-center justify-between py-unit-sm border-b border-outline-variant/20">
                  <div className="flex flex-col min-w-0 pr-unit-md">
                    <span className="font-label-md text-label-md font-semibold text-on-surface">
                      Xóa toàn bộ lịch sử trò chuyện
                    </span>
                    <span className="font-body-sm text-[13px] text-on-surface-variant">
                      Xóa tất cả các đoạn chat và dữ liệu ngữ cảnh lưu tạm trên trình duyệt
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={onClearHistory}
                    className="px-unit-md py-1.5 rounded-full bg-error-container/20 text-error hover:bg-error-container/30 border border-error/30 text-label-md font-medium transition-colors"
                  >
                    Xóa tất cả
                  </button>
                </div>
              </div>
            )}

            {activeTab === "billing" && (
              <div className="flex flex-col gap-unit-lg">
                <span className="font-label-sm text-[12px] text-primary uppercase tracking-wider font-semibold">
                  Tài khoản &amp; Gói dịch vụ
                </span>
                <div className="p-unit-lg rounded-xl bg-surface-container border border-primary/30 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-headline-sm text-headline-sm font-bold text-on-surface">
                        Gói Videcomp-rag Plus
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-primary-container/20 text-primary text-[11px] font-semibold">
                        Đang hoạt động
                      </span>
                    </div>
                    <p className="font-body-sm text-[13px] text-on-surface-variant mt-1">
                      Truy cập không giới hạn mô hình Q3 ViDecomp đầy đủ, độ trễ tối ưu &amp;
                      Voice mode.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "beta" && (
              <div className="flex flex-col gap-unit-lg">
                <span className="font-label-sm text-[12px] text-primary uppercase tracking-wider font-semibold">
                  Tính năng thử nghiệm (Lab)
                </span>
                <div className="p-unit-md rounded-DEFAULT bg-surface-container flex items-center justify-between">
                  <div>
                    <span className="font-label-md text-label-md font-semibold text-on-surface">
                      Tự động kiểm chứng song song (Dual Verification)
                    </span>
                    <p className="font-body-sm text-[13px] text-on-surface-variant">
                      Chạy NLI cross-check trên từng câu khẳng định của phản hồi
                    </p>
                  </div>
                  <span className="text-primary font-semibold text-label-md">Đã bật</span>
                </div>
              </div>
            )}

            {activeTab === "security" && (
              <div className="flex flex-col gap-unit-lg">
                <span className="font-label-sm text-[12px] text-primary uppercase tracking-wider font-semibold">
                  Bảo mật &amp; Quyền riêng tư
                </span>
                <div className="space-y-unit-sm">
                  <div className="flex items-center gap-3 p-unit-md rounded-DEFAULT bg-surface-container">
                    <span className="material-symbols-outlined text-primary text-[24px]">
                      lock
                    </span>
                    <div>
                      <div className="font-semibold text-on-surface text-label-md">
                        Mã hóa đầu cuối TLS 1.3
                      </div>
                      <div className="text-[12px] text-on-surface-variant">
                        Dữ liệu hội thoại được mã hóa trong quá trình truyền tải
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Chân trang Modal */}
        <div className="flex items-center justify-between px-unit-xl py-2.5 bg-surface-container-lowest text-outline text-[12px] border-t border-outline-variant/30">
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-primary">verified_user</span>
            Tài khoản bảo mật: client@videcomp-rag.vn
          </span>
          <span className="font-mono">Videcomp-rag v1.0 (Build 2026.09)</span>
        </div>
      </div>
    </div>
  );
}
