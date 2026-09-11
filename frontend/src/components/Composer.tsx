import { useRef } from "react";
import type { KeyboardEvent, ChangeEvent } from "react";
import type { Domain, Mode, UploadedFile, UploadTaskProgress } from "../api/types";
import { DOMAIN_LABEL } from "../api/types";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function Composer({
  value,
  onChange,
  onSend,
  domain,
  onDomainChange,
  mode,
  onModeChange,
  busy,
  onShowToast,
  onOpenVoiceMode,
  uploadedFiles = [],
  onUploadFile,
  onRemoveFile,
  isUploading = false,
  uploadProgress = null,
  isWebSearchActive = false,
  onToggleWebSearch,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  domain: Domain;
  onDomainChange: (d: Domain) => void;
  mode: Mode;
  onModeChange: (m: Mode) => void;
  busy: boolean;
  onShowToast?: (msg: string) => void;
  onOpenVoiceMode?: () => void;
  uploadedFiles?: UploadedFile[];
  onUploadFile?: (file: File) => void;
  onRemoveFile?: (filename: string) => void;
  isUploading?: boolean;
  uploadProgress?: UploadTaskProgress | null;
  isWebSearchActive?: boolean;
  onToggleWebSearch?: () => void;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ready = value.trim().length > 0 && !busy && !isUploading;
  const isDeepReasoning = mode === "videcomp_full";

  const autoResize = () => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (ready) onSend();
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUploadFile) {
      onUploadFile(file);
    }
    if (e.target) e.target.value = "";
  };

  const toggleDeepReasoning = () => {
    if (isDeepReasoning) {
      onModeChange("hybrid_rag");
      onShowToast?.("Đã chuyển sang: Truy hồi kết hợp nhanh (B1)");
    } else {
      onModeChange("videcomp_full");
      onShowToast?.("Đã bật: Phân rã đa bước & kiểm chứng đầy đủ (Q3)");
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto pb-unit-md sticky bottom-0 z-30 px-unit-md pointer-events-none">
      <div className="pointer-events-auto">
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".pdf,.docx,.doc,.txt,.md"
          className="hidden"
        />

        {/* Hộp soạn thảo kính mờ dạng Pill Container */}
        <div className="relative bg-surface-container/95 backdrop-blur-xl p-unit-sm rounded-lg shadow-2xl border border-outline-variant/30 transition-all duration-200 focus-within:border-primary/40 focus-within:shadow-primary/5 focus-within:bg-surface-container-high">
          {/* Danh sách tệp đính kèm hiển thị trên textarea */}
          {(uploadedFiles.length > 0 || isUploading || uploadProgress) && (
            <div className="flex flex-col gap-2 pb-2 mb-2 border-b border-outline-variant/20 px-1">
              {uploadedFiles.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {uploadedFiles.map((f) => (
                    <div
                      key={f.filename}
                      className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-surface-container-high border border-primary/30 text-label-sm text-on-surface text-[12px] group"
                    >
                      <span className="material-symbols-outlined text-[16px] text-primary">
                        {f.filename.endsWith(".pdf") ? "picture_as_pdf" : "description"}
                      </span>
                      <span className="max-w-[160px] truncate font-medium">{f.filename}</span>
                      <span className="text-[10px] text-outline">({formatFileSize(f.size)})</span>
                      {onRemoveFile && (
                        <button
                          type="button"
                          onClick={() => onRemoveFile(f.filename)}
                          className="text-outline hover:text-error transition-colors ml-0.5"
                          title="Xóa tệp đính kèm này"
                        >
                          <span className="material-symbols-outlined text-[14px]">close</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Thanh tiến trình tác vụ nền 0% -> 100% */}
              {(isUploading || uploadProgress) && (
                <div className="w-full flex flex-col gap-1.5 p-2 rounded-lg bg-surface-container-high/90 border border-primary/30 animate-in fade-in duration-200 shadow-sm">
                  <div className="flex items-center justify-between text-[12px]">
                    <div className="flex items-center gap-2 min-w-0 font-medium text-on-surface">
                      <span className="material-symbols-outlined text-[16px] text-primary animate-spin">
                        progress_activity
                      </span>
                      <span className="truncate max-w-[200px] sm:max-w-[280px]">
                        {uploadProgress?.filename || "Đang tải lên tài liệu..."}
                      </span>
                      <span className="text-[11px] text-on-surface-variant font-normal hidden sm:inline">
                        • {uploadProgress?.stage || "Đang xử lý trong hàng đợi nền..."}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono text-[11px] font-bold">
                        {Math.round(uploadProgress?.progress ?? 5)}%
                      </span>
                    </div>
                  </div>
                  {/* Thanh dải màu chạy tiến độ */}
                  <div className="w-full bg-surface-container-lowest h-1.5 rounded-full overflow-hidden relative">
                    <div
                      className="bg-gradient-to-r from-primary via-emerald-400 to-primary bg-[length:200%_100%] h-full rounded-full transition-all duration-300 ease-out animate-pulse"
                      style={{ width: `${Math.min(100, Math.max(5, uploadProgress?.progress ?? 5))}%` }}
                    />
                  </div>
                  {uploadProgress?.stage && (
                    <span className="text-[11px] text-on-surface-variant sm:hidden truncate">
                      {uploadProgress.stage}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="w-full">
            <textarea
              ref={taRef}
              rows={1}
              value={value}
              onChange={(e) => {
                onChange(e.target.value);
                autoResize();
              }}
              onKeyDown={handleKeyDown}
              placeholder="Nhắn tin cho Videcomp-rag..."
              className="w-full bg-transparent text-on-surface placeholder:text-outline font-body-lg text-body-lg outline-none resize-none px-unit-xs py-unit-2xs max-h-48 leading-relaxed scrollbar-none"
            />
          </div>

          <div className="flex items-center justify-between pt-unit-xs mt-unit-2xs">
            {/* Các công cụ bên trái */}
            <div className="flex items-center gap-unit-xs">
              <button
                type="button"
                className="p-unit-xs rounded-full hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition-colors flex items-center justify-center relative"
                title="Đính kèm tệp PDF, DOCX, TXT hoặc MD"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                <span className="material-symbols-outlined text-[20px]">
                  {uploadedFiles.length > 0 ? "attach_file" : "add"}
                </span>
                {uploadedFiles.length > 0 && (
                  <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-primary" />
                )}
              </button>

              <button
                type="button"
                onClick={onToggleWebSearch}
                className={`flex items-center gap-unit-2xs px-unit-sm py-1 rounded-full font-label-md text-label-md transition-colors ${
                  isWebSearchActive
                    ? "bg-primary-container text-on-primary-container font-medium border border-primary/40"
                    : "bg-surface-container-low hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface"
                }`}
                title={
                  isWebSearchActive
                    ? "Đang bật tìm kiếm Web thời gian thực (nhấp để tắt)"
                    : "Bật tìm kiếm Web thời gian thực"
                }
              >
                <span className="material-symbols-outlined text-[18px]">public</span>
                <span>Tìm kiếm</span>
                {isWebSearchActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                )}
              </button>

              <button
                type="button"
                onClick={toggleDeepReasoning}
                className={`flex items-center gap-unit-2xs px-unit-sm py-1 rounded-full font-label-md text-label-md transition-colors ${
                  isDeepReasoning
                    ? "bg-primary-container/25 text-primary font-medium border border-primary/40"
                    : "hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface"
                }`}
                title="Suy luận phân rã đa bước (ViDecomp Q3)"
              >
                <span className="material-symbols-outlined text-[18px]">psychology</span>
                <span>Suy luận sâu</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const nextDomain = domain === "legal" ? "medical" : "legal";
                  onDomainChange(nextDomain);
                  onShowToast?.(`Đã chọn lĩnh vực: ${DOMAIN_LABEL[nextDomain]}`);
                }}
                className="hidden sm:flex items-center gap-unit-2xs px-unit-sm py-1 rounded-full bg-surface-container-low hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface font-label-md text-label-md transition-colors"
                title="Nhấp để đổi lĩnh vực nhanh"
              >
                <span>{domain === "legal" ? "⚖️ Pháp luật" : "🩺 Y tế"}</span>
              </button>
            </div>

            {/* Các công cụ bên phải */}
            <div className="flex items-center gap-unit-xs">
              {onOpenVoiceMode && (
                <button
                  type="button"
                  onClick={onOpenVoiceMode}
                  className="p-unit-xs rounded-full hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition-colors flex items-center justify-center"
                  title="Chế độ giọng nói nâng cao"
                >
                  <span className="material-symbols-outlined text-[20px]">mic</span>
                </button>
              )}

              <button
                type="button"
                disabled={!ready}
                onClick={onSend}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 ${
                  ready
                    ? "bg-on-surface text-surface hover:opacity-90 active:scale-95 cursor-pointer shadow-md"
                    : "bg-surface-container-highest text-outline opacity-40 cursor-not-allowed"
                }`}
                title="Gửi câu hỏi"
              >
                <span className="material-symbols-outlined text-[20px] font-bold">
                  arrow_upward
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Thông điệp cảnh báo ở chân trang */}
        <div className="text-center pt-unit-xs">
          <p className="font-label-sm text-[12px] text-outline select-none">
            Videcomp-rag có thể mắc lỗi. Hãy kiểm tra lại các thông tin quan trọng.
          </p>
        </div>
      </div>
    </div>
  );
}
