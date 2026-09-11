import { useState } from "react";
import type { Domain, Mode } from "../api/types";
import type { HistoryEntry } from "../hooks/useHistory";
import { DOMAIN_LABEL, MODE_LABEL } from "../api/types";
import { HopTrace } from "./HopTrace";
import { CitationsTable } from "./CitationsTable";
import { VerificationPanel } from "./VerificationPanel";
import { JsonBlock } from "./JsonBlock";
import { UtilityBar } from "./UtilityBar";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { VidecompBadge } from "./Icons";
import { formatDuration } from "../lib/format";

export type ChatItem =
  | { kind: "pending"; id: string; question: string; domain: Domain; mode: Mode; startedAt: number; note?: string }
  | { kind: "error"; id: string; question: string; domain: Domain; mode: Mode; error: string }
  | { kind: "done"; entry: HistoryEntry };

function formatTime(isoOrTimestamp?: string | number): string {
  const date = isoOrTimestamp ? new Date(isoOrTimestamp) : new Date();
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function MessagePair({
  item,
  onRegenerate,
  onFeedback,
  onPickFollowup,
  onShowToast,
}: {
  item: ChatItem;
  onRegenerate: (question: string, domain: Domain, mode: Mode) => void;
  onFeedback: (requestId: string, v: "up" | "down") => void;
  onPickFollowup?: (text: string) => void;
  onShowToast?: (msg: string) => void;
}) {
  const [jsonOpen, setJsonOpen] = useState(false);
  const [copiedQuestion, setCopiedQuestion] = useState(false);

  const question = item.kind === "done" ? item.entry.question : item.question;
  const domain = item.kind === "done" ? item.entry.domain : item.domain;
  const mode = item.kind === "done" ? item.entry.mode : item.mode;
  const timestamp = item.kind === "done" ? item.entry.createdAt : undefined;

  const handleShareAnswer = () => {
    if (item.kind === "done") {
      navigator.clipboard.writeText(
        `[Hỏi] ${item.entry.question}\n\n[Trả lời từ Videcomp-rag (${DOMAIN_LABEL[domain]} · ${MODE_LABEL[mode]})]\n${item.entry.result.final_answer}`
      );
      onShowToast?.("Đã sao chép nội dung hội thoại để chia sẻ");
    }
  };

  const copyQuestion = () => {
    navigator.clipboard.writeText(question);
    setCopiedQuestion(true);
    setTimeout(() => setCopiedQuestion(false), 1800);
    onShowToast?.("Đã sao chép câu hỏi");
  };

  return (
    <div className="flex flex-col gap-unit-xl w-full">
      {/* Khối tin nhắn người dùng (Right-aligned User Message) */}
      <div className="flex flex-col items-end gap-unit-xs group self-end max-w-full">
        <div className="flex items-center gap-unit-xs px-unit-2xs">
          <span className="font-label-sm text-[12px] text-outline">
            Hôm nay, {formatTime(timestamp)}
          </span>
          <span className="font-label-sm text-[12px] font-semibold text-on-surface">Bạn</span>
        </div>

        <div className="max-w-[88%] sm:max-w-[80%] bg-surface-container px-unit-lg py-unit-md rounded-2xl rounded-tr-sm text-on-surface font-body-lg text-body-lg shadow-sm border border-outline-variant/30 leading-relaxed break-words">
          {question}
        </div>

        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-unit-2xs pr-1">
          <button
            type="button"
            className="p-1.5 rounded-full hover:bg-surface-container-high text-outline hover:text-on-surface transition-colors"
            title="Sao chép câu hỏi"
            onClick={copyQuestion}
          >
            <span className="material-symbols-outlined text-[16px]">
              {copiedQuestion ? "check" : "content_copy"}
            </span>
          </button>
        </div>
      </div>

      {/* Khối phản hồi từ trợ lý Videcomp-rag (Assistant Response Group) */}
      <div className="flex items-start gap-unit-md w-full min-w-0">
        <VidecompBadge size={32} />

        <div className="flex-1 min-w-0 flex flex-col gap-unit-sm">
          {/* Header phản hồi */}
          <div className="flex items-center gap-unit-xs flex-wrap">
            <span className="font-headline-sm text-[16px] font-semibold text-on-surface">
              Videcomp-rag
            </span>
            <span className="font-label-sm text-[11px] text-primary font-semibold px-unit-xs py-0.5 bg-primary-container/20 rounded-full">
              {mode === "videcomp_full" ? "Q3" : "4o"}
            </span>
            <span className="font-code-md text-[12px] text-outline">
              {DOMAIN_LABEL[domain]} · {MODE_LABEL[mode]}
            </span>
          </div>

          {/* Trạng thái: Đang suy luận / Pending */}
          {item.kind === "pending" && (
            <ThinkingIndicator mode={mode} startedAt={item.startedAt} note={item.note} />
          )}

          {/* Trạng thái: Lỗi / Error */}
          {item.kind === "error" && (
            <div className="p-unit-md rounded-DEFAULT bg-error-container/20 border border-error/30 text-error flex items-start gap-2 text-body-sm">
              <span className="material-symbols-outlined text-[20px] shrink-0">error</span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold mb-0.5">Không thể hoàn thành truy vấn</div>
                <div className="text-on-error-container/90">{item.error}</div>
              </div>
            </div>
          )}

          {/* Trạng thái: Hoàn thành / Done */}
          {item.kind === "done" && (
            <>
              {/* Lộ trình suy luận bắc cầu đa bước */}
              <HopTrace
                plan={item.entry.result.query_plan}
                hops={item.entry.result.hop_trace}
                citations={item.entry.result.citations}
                latencyMs={item.entry.result.latency_ms}
              />

              {/* Nội dung câu trả lời */}
              <div className="text-on-surface font-body-md text-body-md leading-relaxed whitespace-pre-wrap">
                {item.entry.result.final_answer}
              </div>

              {/* Bảng trích dẫn & Căn cứ văn bản */}
              <CitationsTable citations={item.entry.result.citations} />

              {/* Bảng kiểm chứng mâu thuẫn luận điểm */}
              <VerificationPanel report={item.entry.result.verification} />

              {/* Khối JSON chi tiết */}
              {jsonOpen && (
                <JsonBlock
                  label={`trace · request_id: ${item.entry.requestId}`}
                  data={item.entry.result}
                />
              )}

              {/* Thanh tiện ích phản hồi */}
              <UtilityBar
                feedback={item.entry.feedback}
                onFeedback={(v) => onFeedback(item.entry.requestId, v)}
                onCopyAnswer={() => {
                  navigator.clipboard.writeText(item.entry.result.final_answer).catch(() => {});
                  onShowToast?.("Đã sao chép câu trả lời vào bộ nhớ tạm");
                }}
                onRegenerate={() => onRegenerate(question, domain, mode)}
                onToggleJson={() => setJsonOpen((o) => !o)}
                jsonOpen={jsonOpen}
                regenerating={false}
                onShare={handleShareAnswer}
              />

              {/* Gợi ý câu hỏi đào sâu tiếp theo (Follow-up Suggestion Chips) */}
              <div className="flex items-center flex-wrap gap-unit-xs mt-unit-xs">
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-unit-sm py-1.5 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface text-label-md font-label-md transition-all shadow-sm border border-outline-variant/30"
                  onClick={() =>
                    onPickFollowup?.(
                      `Với trường hợp trên, hãy phân tích chi tiết hơn các hệ quả pháp lý hoặc y khoa liên quan?`
                    )
                  }
                >
                  <span className="material-symbols-outlined text-primary text-[18px]">
                    psychology
                  </span>
                  <span>Phân tích sâu hơn trường hợp này</span>
                </button>

                <button
                  type="button"
                  className="flex items-center gap-1.5 px-unit-sm py-1.5 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface text-label-md font-label-md transition-all shadow-sm border border-outline-variant/30"
                  onClick={() =>
                    onPickFollowup?.(
                      `Liệt kê chi tiết các điều khoản và văn bản pháp luật áp dụng trực tiếp trong câu trả lời trên?`
                    )
                  }
                >
                  <span className="material-symbols-outlined text-primary text-[18px]">
                    article
                  </span>
                  <span>Trích xuất điều khoản trực tiếp</span>
                </button>

                <button
                  type="button"
                  className="flex items-center gap-1.5 px-unit-sm py-1.5 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface text-label-md font-label-md transition-all shadow-sm border border-outline-variant/30"
                  onClick={() =>
                    onPickFollowup?.(
                      `Có trường hợp ngoại lệ hoặc quy định chuyển tiếp nào đối với quy định trên không?`
                    )
                  }
                >
                  <span className="material-symbols-outlined text-primary text-[18px]">
                    rule
                  </span>
                  <span>Kiểm tra trường hợp ngoại lệ</span>
                </button>
              </div>

              <div className="text-[11px] text-outline mt-1 font-mono">
                Xử lý trong {formatDuration(item.entry.result.latency_ms)} · request_id:{" "}
                {item.entry.requestId}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
