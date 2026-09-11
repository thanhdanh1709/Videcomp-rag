import { useState } from "react";
import type { Citation, HopTraceEntry, QueryPlan } from "../api/types";
import { IconChevronRight, IconBrainReasoning } from "./Icons";
import { formatDuration } from "../lib/format";

const REASONING_LABEL: Record<string, string> = {
  single: "Một bước",
  bridge: "Bắc cầu (bridge)",
  intersection: "Giao (intersection)",
  comparison: "So sánh đối chiếu",
  temporal_version: "Theo thời gian / phiên bản",
  rule_exception: "Quy tắc – ngoại lệ",
  other: "Tổng hợp",
};

export function HopTrace({
  plan,
  hops,
  citations,
  latencyMs,
}: {
  plan: QueryPlan | null;
  hops: HopTraceEntry[];
  citations: Citation[];
  latencyMs?: number;
}) {
  const [open, setOpen] = useState(false);
  if (hops.length === 0 && !plan) return null;

  const depsFor = (hopId: string) =>
    plan?.subquestions.find((s) => s.id === hopId)?.depends_on ?? [];
  const citationByChunk = new Map(citations.map((c) => [c.chunk_id, c]));

  return (
    <div className="reasoning-trace-accordion">
      <div className="reasoning-header" onClick={() => setOpen((o) => !o)}>
        <div className="reasoning-title-group">
          <IconBrainReasoning width={15} height={15} style={{ color: "var(--chat-brand-green)" }} />
          <span>
            Lộ trình suy luận
            {plan ? ` · ${REASONING_LABEL[plan.reasoning_type] ?? plan.reasoning_type}` : ""}
            {hops.length > 0 ? ` · ${hops.length} bước` : ""}
            {typeof latencyMs === "number" ? ` · Đã xử lý trong ${formatDuration(latencyMs)}` : ""}
          </span>
        </div>
        <IconChevronRight
          width={14}
          height={14}
          className={`reasoning-chevron ${open ? "open" : ""}`}
        />
      </div>

      {open && (
        <div className="reasoning-content">
          <div className="reasoning-timeline">
            {hops.map((hop, idx) => {
              const deps = depsFor(hop.hop_id);
              return (
                <div className="reasoning-node" key={hop.hop_id}>
                  <div className="node-step-badge">
                    BƯỚC {idx + 1} ({hop.hop_id.toUpperCase()})
                  </div>
                  <div className="node-question">{hop.question}</div>
                  {hop.bound_question !== hop.question && (
                    <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 4 }}>
                      → Thực thi liên kết: “{hop.bound_question}”
                    </div>
                  )}
                  {deps.length > 0 && (
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
                      Căn cứ từ: {deps.join(", ")}
                    </div>
                  )}
                  <div className="node-answer">{hop.intermediate_answer}</div>
                  {hop.evidence_ids.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                      {hop.evidence_ids.map((id) => {
                        const citation = citationByChunk.get(id);
                        return (
                          <span
                            key={id}
                            className="citation-badge"
                            title={citation?.citation_label ?? id}
                          >
                            {citation ? citation.key : id}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
