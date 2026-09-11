import { useState } from "react";
import type { Domain } from "../api/types";
import { apiDownloadSessionDossier, apiDownloadStandaloneDossier } from "../api/client";

interface ExportDossierModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  turns?: any[];
  currentTurnIndex?: number;
  domain?: Domain;
  title?: string;
  sessionData?: any;
  onShowToast?: (msg: string) => void;
}

export function ExportDossierModal({
  isOpen,
  onClose,
  sessionId,
  turns = [],
  currentTurnIndex = -1,
  domain = "legal",
  title = "",
  sessionData,
  onShowToast,
}: ExportDossierModalProps) {
  const [format, setFormat] = useState<"docx" | "pdf">("docx");
  const [selectedTurn, setSelectedTurn] = useState<number>(
    currentTurnIndex >= 0 ? currentTurnIndex : turns.length > 0 ? turns.length - 1 : -1
  );
  const [customTitle, setCustomTitle] = useState<string>(() => {
    if (title) return title;
    return domain === "legal"
      ? "HỒ SƠ BÁO CÁO THẨM ĐỊNH PHÁP LÝ"
      : "HỒ SƠ BÁO CÁO TƯ VẤN Y KHOA";
  });
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const handleExport = async () => {
    setIsExporting(true);
    try {
      if (sessionData) {
        // Xuất trực tiếp từ sessionData hiện tại
        await apiDownloadStandaloneDossier({
          format,
          session_data: sessionData,
          turn_index: selectedTurn,
          custom_title: customTitle.trim() || undefined,
        });
      } else {
        // Xuất theo sessionId
        await apiDownloadSessionDossier(
          sessionId,
          format,
          selectedTurn,
          customTitle.trim() || undefined
        );
      }
      onShowToast?.(`Đã tải xuống hồ sơ báo cáo dạng .${format.toUpperCase()} thành công!`);
      onClose();
    } catch (err: any) {
      onShowToast?.(err.message || "Xuất báo cáo thất bại, vui lòng thử lại.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className="bg-surface-container-high border border-outline-variant/40 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 text-on-surface relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[24px]">description</span>
            </div>
            <div>
              <h3 className="text-[18px] font-bold text-on-surface">Xuất Báo cáo Chuyên nghiệp</h3>
              <p className="text-[12px] text-on-surface-variant">
                Định dạng chuẩn mực cho Khách hàng, Giám đốc &amp; Hội đồng Thẩm định
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-outline hover:text-on-surface hover:bg-surface-container-highest transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Định dạng tệp xuất */}
        <div className="space-y-2">
          <label className="text-[13px] font-semibold text-on-surface flex items-center gap-1.5">
            <span>Chọn định dạng xuất</span>
            <span className="text-primary">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            {/* DOCX Option */}
            <div
              onClick={() => setFormat("docx")}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col gap-2 ${
                format === "docx"
                  ? "border-primary bg-primary/10 ring-1 ring-primary/40 shadow-sm"
                  : "border-outline-variant/30 hover:border-outline-variant bg-surface-container hover:bg-surface-container-highest"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-500 text-[22px]">
                    article
                  </span>
                  <span className="font-bold text-[14px]">Microsoft Word</span>
                </div>
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500">
                  .DOCX
                </span>
              </div>
              <p className="text-[12px] text-on-surface-variant line-clamp-2">
                Bố cục viền trang hành chính, bảng biểu đầy đủ, thuận tiện chỉnh sửa và chèn thêm ghi chú.
              </p>
            </div>

            {/* PDF Option */}
            <div
              onClick={() => setFormat("pdf")}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col gap-2 ${
                format === "pdf"
                  ? "border-primary bg-primary/10 ring-1 ring-primary/40 shadow-sm"
                  : "border-outline-variant/30 hover:border-outline-variant bg-surface-container hover:bg-surface-container-highest"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-rose-500 text-[22px]">
                    picture_as_pdf
                  </span>
                  <span className="font-bold text-[14px]">Adobe PDF</span>
                </div>
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500">
                  .PDF
                </span>
              </div>
              <p className="text-[12px] text-on-surface-variant line-clamp-2">
                Font tiếng Việt chuẩn hóa, bố cục khóa cố định, thích hợp gửi ngay hoặc lưu trữ hồ sơ.
              </p>
            </div>
          </div>
        </div>

        {/* Tiêu đề báo cáo */}
        <div className="space-y-1.5">
          <label className="text-[13px] font-semibold text-on-surface flex items-center justify-between">
            <span>Tiêu đề hồ sơ thẩm định</span>
            <span className="text-[11px] text-outline">Tùy biến được</span>
          </label>
          <input
            type="text"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            placeholder="Nhập tiêu đề hồ sơ..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container border border-outline-variant/40 focus:border-primary focus:outline-none text-[13px] text-on-surface"
          />
        </div>

        {/* Lựa chọn lượt hỏi nếu có nhiều câu */}
        {turns.length > 1 && (
          <div className="space-y-1.5">
            <label className="text-[13px] font-semibold text-on-surface flex items-center justify-between">
              <span>Lựa chọn câu hỏi xuất báo cáo</span>
              <span className="text-[11px] text-outline">{turns.length} câu hỏi trong phiên</span>
            </label>
            <select
              value={selectedTurn}
              onChange={(e) => setSelectedTurn(Number(e.target.value))}
              className="w-full px-3.5 py-2 rounded-xl bg-surface-container border border-outline-variant/40 focus:border-primary focus:outline-none text-[13px] text-on-surface"
            >
              {turns.map((t, idx) => (
                <option key={idx} value={idx}>
                  Câu #{idx + 1}: {t.question?.slice(0, 60)}
                  {t.question?.length > 60 ? "..." : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Các mục nội dung sẽ được xuất */}
        <div className="p-3.5 rounded-xl bg-surface-container/60 border border-outline-variant/30 space-y-2">
          <span className="text-[12px] font-bold text-on-surface-variant uppercase tracking-wider block">
            Cấu trúc hồ sơ chuẩn hóa tự động bao gồm:
          </span>
          <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-[12px] text-on-surface">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-[16px]">check_circle</span>
              <span>Tiêu đề &amp; Thông tin vụ việc</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-[16px]">check_circle</span>
              <span>Tóm tắt kết luận cốt lõi</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-[16px]">check_circle</span>
              <span>Cây suy luận từng bước (DAG)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-[16px]">check_circle</span>
              <span>Bảng trích dẫn điều luật / phác đồ</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-[16px]">check_circle</span>
              <span>Đối chiếu mâu thuẫn &amp; Kiểm chứng</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-[16px]">check_circle</span>
              <span>Khung chữ ký &amp; Phê duyệt lãnh đạo</span>
            </div>
          </div>
        </div>

        {/* Nút hành động */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 rounded-xl hover:bg-surface-container-highest text-on-surface-variant text-[13px] font-medium transition-colors"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-on-primary text-[13px] font-bold shadow-md transition-all disabled:opacity-50"
          >
            {isExporting ? (
              <>
                <span className="material-symbols-outlined text-[18px] animate-spin">
                  progress_activity
                </span>
                <span>Đang biên soạn hồ sơ...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">download</span>
                <span>Tải xuống Báo cáo .{format.toUpperCase()}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
