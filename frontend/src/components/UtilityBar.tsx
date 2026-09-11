import { useState } from "react";

export function UtilityBar({
  onCopyAnswer,
  onRegenerate,
  onToggleJson,
  jsonOpen,
  feedback,
  onFeedback,
  regenerating,
  onShare,
}: {
  onCopyAnswer: () => void;
  onRegenerate: () => void;
  onToggleJson: () => void;
  jsonOpen: boolean;
  feedback?: "up" | "down";
  onFeedback: (v: "up" | "down") => void;
  regenerating: boolean;
  onShare?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex items-center justify-between pt-unit-xs mt-unit-2xs select-none">
      <div className="flex items-center gap-unit-2xs">
        <button
          className="p-2 rounded-full hover:bg-surface-container-high text-outline hover:text-on-surface transition-colors flex items-center justify-center"
          title="Sao chép toàn bộ câu trả lời"
          type="button"
          onClick={() => {
            onCopyAnswer();
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          <span className="material-symbols-outlined text-[18px]">
            {copied ? "check" : "content_copy"}
          </span>
        </button>

        <button
          className={`p-2 rounded-full hover:bg-surface-container-high transition-colors flex items-center justify-center ${
            feedback === "up"
              ? "text-primary bg-primary-container/20"
              : "text-outline hover:text-on-surface"
          }`}
          title="Phản hồi tốt"
          type="button"
          onClick={() => onFeedback("up")}
        >
          <span
            className="material-symbols-outlined text-[18px]"
            style={feedback === "up" ? { fontVariationSettings: "'FILL' 1" } : undefined}
          >
            thumb_up
          </span>
        </button>

        <button
          className={`p-2 rounded-full hover:bg-surface-container-high transition-colors flex items-center justify-center ${
            feedback === "down"
              ? "text-error bg-error-container/20"
              : "text-outline hover:text-on-surface"
          }`}
          title="Phản hồi chưa chính xác"
          type="button"
          onClick={() => onFeedback("down")}
        >
          <span
            className="material-symbols-outlined text-[18px]"
            style={feedback === "down" ? { fontVariationSettings: "'FILL' 1" } : undefined}
          >
            thumb_down
          </span>
        </button>

        <button
          className="p-2 rounded-full hover:bg-surface-container-high text-outline hover:text-on-surface transition-colors flex items-center justify-center"
          title="Tạo lại câu trả lời"
          type="button"
          disabled={regenerating}
          onClick={onRegenerate}
        >
          <span
            className={`material-symbols-outlined text-[18px] ${
              regenerating ? "animate-spin text-primary" : ""
            }`}
          >
            refresh
          </span>
        </button>

        {onShare && (
          <button
            className="p-2 rounded-full hover:bg-surface-container-high text-outline hover:text-on-surface transition-colors flex items-center justify-center"
            title="Chia sẻ phản hồi"
            type="button"
            onClick={onShare}
          >
            <span className="material-symbols-outlined text-[18px]">share</span>
          </button>
        )}

        <button
          className={`p-2 rounded-full hover:bg-surface-container-high transition-colors flex items-center justify-center ${
            jsonOpen
              ? "text-primary bg-primary-container/20"
              : "text-outline hover:text-on-surface"
          }`}
          title="Xem chi tiết vết truy hồi (JSON Trace)"
          type="button"
          onClick={onToggleJson}
        >
          <span className="material-symbols-outlined text-[18px]">data_object</span>
        </button>

        {copied && (
          <span className="text-label-sm text-primary font-medium ml-1">Đã sao chép!</span>
        )}
      </div>

      <span className="font-label-sm text-[12px] text-outline hidden sm:inline">
        Videcomp-rag 4o · Đa bước &amp; Kiểm chứng
      </span>
    </div>
  );
}
