import { useEffect, useState } from "react";
import type { LiveHopState, Mode, PlanHop } from "../api/types";
import { MODE_GROUP } from "../api/types";
import { IconBrainReasoning } from "./Icons";

const BASELINE_PHASES = [
  "Đang truy hồi bằng chứng liên quan từ kho dữ liệu…",
  "Đang đối chiếu văn bản và tổng hợp câu trả lời…",
];

const DECOMP_PHASES = [
  "Đang phân tích và phân rã câu hỏi đa bước…",
  "Đang truy xuất các điều luật và quy định liên quan…",
  "Đang tổng hợp luận cứ và lập luận bắc cầu…",
];

const VERIFY_PHASE = "Đang kiểm chứng từng luận điểm có căn cứ pháp lý/y khoa…";

const PHASE_INTERVAL_SEC = 8;

function phasesFor(mode: Mode): string[] {
  if (MODE_GROUP[mode] === "baseline") return BASELINE_PHASES;
  if (mode === "videcomp_full") return [...DECOMP_PHASES, VERIFY_PHASE];
  return DECOMP_PHASES;
}

export function ThinkingIndicator({
  mode,
  startedAt,
  note,
  livePlan,
  liveHops,
  isCached,
  cacheSimilarity,
  cacheLatencyMs,
}: {
  mode: Mode;
  startedAt: number;
  note?: string;
  livePlan?: PlanHop[];
  liveHops?: LiveHopState[];
  isCached?: boolean;
  cacheSimilarity?: number;
  cacheLatencyMs?: number;
}) {
  const [elapsedSec, setElapsedSec] = useState(() =>
    Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSec(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  const phases = phasesFor(mode);
  const phaseIdx = Math.min(Math.floor(elapsedSec / PHASE_INTERVAL_SEC), phases.length - 1);
  const label = note ?? phases[phaseIdx];

  return (
    <div className="flex items-start gap-3 w-full animate-in fade-in duration-300">
      <div className="w-8 h-8 rounded-full bg-surface-container-high border border-primary/40 flex items-center justify-center text-primary flex-shrink-0 relative shadow-sm">
        {isCached ? (
          <span className="material-symbols-outlined text-[18px] text-emerald-400">bolt</span>
        ) : (
          <>
            <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
            <span className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
          </>
        )}
      </div>

      <div className="flex-1 max-w-2xl rounded-2xl bg-surface-container/95 border border-outline-variant/30 backdrop-blur-md p-4 shadow-xl flex flex-col gap-3">
        {/* Header bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                isCached ? "bg-emerald-400" : "bg-primary animate-pulse"
              }`}
            />
            <span
              className={`text-[12px] font-semibold uppercase tracking-wider ${
                isCached ? "text-emerald-400" : "text-primary"
              }`}
            >
              {isCached ? "Phản hồi tức thì từ Bộ đệm Ngữ nghĩa" : "Videcomp-rag Đang suy luận"}
            </span>
          </div>
          <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-surface-container-high border border-outline-variant/40 text-on-surface-variant font-medium">
            {isCached ? `${cacheLatencyMs || 15}ms` : `${elapsedSec}s`}
          </span>
        </div>

        {/* Thông báo Cache Hit */}
        {isCached && (
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-body-sm animate-in fade-in">
            <span className="material-symbols-outlined text-[18px] text-emerald-400">offline_bolt</span>
            <span>
              Khớp câu hỏi tương đồng (Cosine: <strong>{((cacheSimilarity ?? 0.95) * 100).toFixed(1)}%</strong>) — Tiết kiệm 100% token API!
            </span>
          </div>
        )}

        {/* Label trạng thái chung */}
        {!isCached && (
          <div className="flex items-center gap-2.5 text-body-sm text-on-surface">
            <IconBrainReasoning width={16} height={16} className="text-primary flex-shrink-0 animate-pulse" />
            <span className="leading-snug font-medium">{label}</span>
          </div>
        )}

        {/* DÒNG 1 & DÒNG 2: Hiển thị ngay kế hoạch phân rã và văn bản luật/y tế đang truy xuất */}
        {!isCached && livePlan && livePlan.length > 0 && (
          <div className="flex flex-col gap-2 pt-2 border-t border-outline-variant/20">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px]">account_tree</span>
                Phân rã đa bước (Dòng 1 & 2)
              </span>
              <span className="text-[11px] text-outline">{livePlan.length} câu hỏi con</span>
            </div>

            <div className="flex flex-col gap-2">
              {livePlan.map((hop, idx) => {
                const liveHop = liveHops?.find((h) => h.id === hop.id);
                const isDone = liveHop?.status === "done";
                const isRunning = liveHop?.status === "running";

                return (
                  <div
                    key={hop.id}
                    className={`p-2.5 rounded-xl border text-body-sm transition-all duration-300 ${
                      isRunning
                        ? "bg-primary/10 border-primary/40 shadow-sm"
                        : isDone
                        ? "bg-surface-container-high/60 border-outline-variant/30 text-on-surface"
                        : "bg-surface-container-low/30 border-outline-variant/10 text-on-surface-variant opacity-75"
                    }`}
                  >
                    {/* DÒNG 1: Câu hỏi con */}
                    <div className="flex items-start gap-2">
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0 ${
                          isRunning
                            ? "bg-primary text-on-primary"
                            : isDone
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-surface-container-highest text-on-surface-variant"
                        }`}
                      >
                        Hop {idx + 1}
                      </span>
                      <span className="flex-1 font-medium leading-relaxed">
                        {liveHop?.bound_question || hop.question}
                      </span>
                      {isRunning && (
                        <span className="material-symbols-outlined text-[16px] text-primary animate-spin flex-shrink-0">
                          progress_activity
                        </span>
                      )}
                      {isDone && (
                        <span className="material-symbols-outlined text-[16px] text-emerald-400 flex-shrink-0">
                          check_circle
                        </span>
                      )}
                    </div>

                    {/* DÒNG 2: Văn bản luật / y tế đang được truy xuất */}
                    {liveHop?.docs && liveHop.docs.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-outline-variant/15 flex flex-col gap-1.5">
                        <span className="text-[10px] font-semibold text-outline uppercase tracking-wider flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">library_books</span>
                          Văn bản đang truy xuất ({liveHop.docs.length}):
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {liveHop.docs.map((doc, docIdx) => (
                            <span
                              key={doc.chunk_id || docIdx}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-surface-container-highest/80 border border-outline-variant/30 text-on-surface hover:border-primary/50 transition-colors"
                              title={doc.article_title ? `${doc.citation_label}: ${doc.article_title}` : doc.law_name}
                            >
                              <span className="material-symbols-outlined text-[12px] text-primary">gavel</span>
                              <span className="font-semibold text-primary/90">{doc.citation_label || doc.doc_id}</span>
                              {doc.article_title && (
                                <span className="text-on-surface-variant truncate max-w-[180px]">
                                  · {doc.article_title}
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Thanh tiến trình suy luận */}
        {!isCached && (
          <div className="w-full bg-surface-container-highest/60 h-1 rounded-full overflow-hidden relative">
            <div
              className="h-full bg-gradient-to-r from-primary-container via-primary to-primary rounded-full transition-all duration-1000"
              style={{
                width: `${Math.min(95, 20 + (phaseIdx + 1) * 25)}%`,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
