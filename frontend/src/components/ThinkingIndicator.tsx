import { useEffect, useState } from "react";
import type { Mode } from "../api/types";
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
}: {
  mode: Mode;
  startedAt: number;
  note?: string;
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
        <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
        <span className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
      </div>

      <div className="flex-1 max-w-2xl rounded-2xl bg-surface-container/90 border border-outline-variant/30 backdrop-blur-md p-4 shadow-xl flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-[12px] font-semibold text-primary uppercase tracking-wider">
              Videcomp-rag Đang suy luận
            </span>
          </div>
          <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-surface-container-high border border-outline-variant/40 text-on-surface-variant font-medium">
            {elapsedSec}s
          </span>
        </div>

        <div className="flex items-center gap-2.5 text-body-sm text-on-surface">
          <IconBrainReasoning width={16} height={16} className="text-primary flex-shrink-0 animate-pulse" />
          <span className="leading-snug">{label}</span>
        </div>

        {/* Thanh tiến trình suy luận mềm mại */}
        <div className="w-full bg-surface-container-highest/60 h-1 rounded-full overflow-hidden relative">
          <div
            className="h-full bg-gradient-to-r from-primary-container via-primary to-primary rounded-full transition-all duration-1000"
            style={{
              width: `${Math.min(95, 20 + (phaseIdx + 1) * 25)}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
