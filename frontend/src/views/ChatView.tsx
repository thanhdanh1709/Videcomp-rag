import { useEffect, useRef, useState } from "react";
import type { Domain, Mode, UploadedFile } from "../api/types";
import {
  askQuestion,
  ApiError,
  DEFAULT_INDEX_PATHS,
  INDEX_NOT_LOADED_DETAIL,
  loadIndex,
  uploadDocument,
  deleteSessionFile,
} from "../api/client";
import { DOMAIN_LABEL } from "../api/types";
import type { HistoryEntry } from "../hooks/useHistory";
import type { CustomAgent } from "../types/agent";
import { Composer } from "../components/Composer";
import { EmptyState } from "../components/EmptyState";
import { MessagePair } from "../components/MessagePair";
import type { ChatItem } from "../components/MessagePair";

const PREV_ANSWER_MAX_CHARS = 700;

function buildContextualQuestion(rawQuestion: string, previous: ChatItem | undefined): string {
  if (!previous || previous.kind !== "done") return rawQuestion;
  const prevQuestion = previous.entry.question;
  const prevAnswer = previous.entry.result.final_answer;
  const truncatedAnswer =
    prevAnswer.length > PREV_ANSWER_MAX_CHARS ? `${prevAnswer.slice(0, PREV_ANSWER_MAX_CHARS)}…` : prevAnswer;
  return [
    "Bối cảnh — câu hỏi và câu trả lời ngay trước đó trong cùng phiên hỏi đáp (chỉ để hiểu ngữ cảnh, KHÔNG phải bằng chứng pháp lý, không trích dẫn lại):",
    `Câu hỏi trước: "${prevQuestion}"`,
    `Trả lời trước: "${truncatedAnswer}"`,
    "",
    `Câu hỏi hiện tại (có thể tham chiếu nội dung ở trên, ví dụ "trường hợp trên", "vậy còn", "so với đó"...): ${rawQuestion}`,
  ].join("\n");
}

export function ChatView({
  stream,
  setStream,
  sessionId,
  addHistoryEntry,
  onFeedback,
  domain,
  setDomain,
  mode,
  setMode,
  onShowToast,
  onOpenVoiceMode,
  initialQuestion,
  onClearInitialQuestion,
  activeAgent,
  onClearActiveAgent,
}: {
  stream: ChatItem[];
  setStream: (updater: (prev: ChatItem[]) => ChatItem[]) => void;
  sessionId: string;
  addHistoryEntry: (entry: HistoryEntry) => void;
  onFeedback: (requestId: string, v: "up" | "down") => void;
  domain: Domain;
  setDomain: (d: Domain) => void;
  mode: Mode;
  setMode: (m: Mode) => void;
  onShowToast: (msg: string) => void;
  onOpenVoiceMode?: () => void;
  initialQuestion?: string;
  onClearInitialQuestion?: () => void;
  activeAgent?: CustomAgent | null;
  onClearActiveAgent?: () => void;
}) {
  const [question, setQuestion] = useState(initialQuestion || "");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isWebSearchActive, setIsWebSearchActive] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const busy = stream.some((s) => s.kind === "pending");

  useEffect(() => {
    if (initialQuestion) {
      setQuestion(initialQuestion);
      onClearInitialQuestion?.();
    }
  }, [initialQuestion]);

  // Xóa danh sách file upload khi đổi session mới
  useEffect(() => {
    setUploadedFiles([]);
  }, [sessionId]);

  // Tự động cuộn trang mượt mà
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [stream]);

  const setNote = (tempId: string, note: string | undefined) => {
    setStream((prev) => prev.map((it) => (it.kind === "pending" && it.id === tempId ? { ...it, note } : it)));
  };

  const handleUploadFile = async (file: File) => {
    setIsUploading(true);
    try {
      const res = await uploadDocument(file, sessionId);
      setUploadedFiles((prev) => [
        ...prev.filter((f) => f.filename !== file.name),
        { filename: file.name, size: file.size, chunk_count: res.chunk_count },
      ]);
      onShowToast?.(`Đã tải lên và trích xuất ${res.chunk_count} đoạn từ ${file.name}`);
    } catch (err: any) {
      onShowToast?.("Không thể tải tệp: " + (err.message || "Lỗi tải lên"));
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveFile = async (filename: string) => {
    try {
      await deleteSessionFile(sessionId, filename);
      setUploadedFiles((prev) => prev.filter((f) => f.filename !== filename));
      onShowToast?.(`Đã xóa tệp: ${filename}`);
    } catch {
      setUploadedFiles((prev) => prev.filter((f) => f.filename !== filename));
    }
  };

  const send = async (q: string, d: Domain, m: Mode) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    const previousItem = stream.length > 0 ? stream[stream.length - 1] : undefined;
    let contextualQuestion = buildContextualQuestion(trimmed, previousItem);
    if (activeAgent?.instructions && !previousItem) {
      contextualQuestion = `[Chỉ dẫn hệ thống: ${activeAgent.instructions}]\n\n${contextualQuestion}`;
    }
    const usedContext = contextualQuestion !== trimmed;

    const tempId = crypto.randomUUID();
    setStream((prev) => [
      ...prev,
      { kind: "pending", id: tempId, question: trimmed, domain: d, mode: m, startedAt: Date.now() },
    ]);
    if (q === question) setQuestion("");

    const askOnce = () =>
      askQuestion({
        question: contextualQuestion,
        domain: d,
        mode: m,
        top_k: 8,
        rerank_top_k: 5,
        max_corrective_rounds: 1,
        session_id: sessionId,
        web_search: isWebSearchActive,
      });

    try {
      let result;
      try {
        result = await askOnce();
      } catch (err) {
        const isIndexNotLoaded = err instanceof ApiError && err.message === INDEX_NOT_LOADED_DETAIL;
        const defaultPaths = DEFAULT_INDEX_PATHS[d];
        if (!isIndexNotLoaded || !defaultPaths) throw err;

        setNote(tempId, `Chưa có dữ liệu cho lĩnh vực "${DOMAIN_LABEL[d]}" trong bộ nhớ server — đang tự nạp index lần đầu (vài giây)…`);
        await loadIndex(d, defaultPaths.bm25Dir, defaultPaths.vectorDir);
        setNote(tempId, undefined);
        result = await askOnce();
      }

      const entry: HistoryEntry = {
        requestId: result.request_id,
        sessionId,
        question: trimmed,
        domain: d,
        mode: m,
        createdAt: new Date().toISOString(),
        result,
        usedContext,
      };
      addHistoryEntry(entry);
      setStream((prev) => prev.map((it) => (it.kind === "pending" && it.id === tempId ? { kind: "done", entry } : it)));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Không thể kết nối tới backend.";
      setStream((prev) =>
        prev.map((it) => (it.kind === "pending" && it.id === tempId ? { kind: "error", id: tempId, question: trimmed, domain: d, mode: m, error: message } : it))
      );
    }
  };

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      {activeAgent && (
        <div className="bg-surface-container-low/90 border-b border-primary/30 px-unit-lg py-2 flex items-center justify-between z-10 shrink-0 mt-14 shadow-sm">
          <div className="flex items-center gap-2 text-label-sm">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[16px]">{activeAgent.icon}</span>
            </div>
            <span className="text-on-surface font-bold">{activeAgent.name}</span>
            <span className="text-outline text-[12px] hidden sm:inline">• {activeAgent.desc}</span>
          </div>
          <button
            type="button"
            onClick={onClearActiveAgent}
            className="text-[11px] text-outline hover:text-on-surface px-2.5 py-1 rounded-full bg-surface-container hover:bg-surface-container-high transition-colors flex items-center gap-1 border border-outline-variant/30"
            title="Trở về chế độ trò chuyện thông thường"
          >
            <span>Đổi sang Trợ lý mặc định</span>
            <span className="material-symbols-outlined text-[14px]">close</span>
          </button>
        </div>
      )}

      {stream.length === 0 ? (
        <div className={`flex-1 overflow-y-auto scrollbar-none flex flex-col ${activeAgent ? "pt-4" : "pt-20"}`}>
          <EmptyState onPick={(q) => send(q, domain, mode)} />
        </div>
      ) : (
        <div className={`flex-1 overflow-y-auto pb-4 scrollbar-none ${activeAgent ? "pt-4" : "pt-16"}`} ref={scrollRef}>
          <div className="max-w-4xl mx-auto w-full px-unit-md flex flex-col gap-unit-xl pb-6">
            {stream.map((item) => {
              const key = item.kind === "done" ? item.entry.requestId : item.id;
              return (
                <MessagePair
                  key={key}
                  item={item}
                  onRegenerate={send}
                  onFeedback={onFeedback}
                  onPickFollowup={(followupQ) => send(followupQ, domain, mode)}
                  onShowToast={onShowToast}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Floating Composer */}
      <Composer
        value={question}
        onChange={setQuestion}
        onSend={() => send(question, domain, mode)}
        domain={domain}
        onDomainChange={setDomain}
        mode={mode}
        onModeChange={setMode}
        busy={busy}
        onShowToast={onShowToast}
        onOpenVoiceMode={onOpenVoiceMode}
        uploadedFiles={uploadedFiles}
        onUploadFile={handleUploadFile}
        onRemoveFile={handleRemoveFile}
        isUploading={isUploading}
        isWebSearchActive={isWebSearchActive}
        onToggleWebSearch={() => {
          const next = !isWebSearchActive;
          setIsWebSearchActive(next);
          onShowToast?.(next ? "Đã kích hoạt Tìm kiếm Web thời gian thực" : "Đã tắt Tìm kiếm Web");
        }}
      />
    </div>
  );
}

export type { ChatItem };
