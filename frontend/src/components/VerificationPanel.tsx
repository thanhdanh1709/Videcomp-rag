import type { VerificationReport } from "../api/types";

const STATUS_LABEL: Record<string, string> = {
  supported: "Có căn cứ",
  unsupported: "Không có căn cứ",
  insufficient: "Chưa đủ căn cứ",
};

export function VerificationPanel({ report }: { report: VerificationReport | null }) {
  if (!report) return null;
  const pct = Math.round(report.supported_claim_rate * 100);
  return (
    <div className="verify-block">
      <div className="verify-head">
        <span className="verify-title">
          Kiểm chứng nội dung ·{" "}
          <span style={{ color: report.status === "pass" ? "var(--status-supported)" : "var(--status-unsupported)" }}>
            {report.status === "pass" ? "Đạt" : "Chưa đạt"}
          </span>
        </span>
        <span className="verify-rate">
          {pct}% claim có căn cứ
          {report.corrective_rounds_used > 0 ? ` · ${report.corrective_rounds_used} vòng truy hồi bổ sung` : ""}
        </span>
      </div>
      <div className="verify-bar-track">
        <div className="verify-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      {report.claim_results.map((c, i) => (
        <div className="claim-row" key={i}>
          <span className={`claim-status-dot ${c.status}`} title={STATUS_LABEL[c.status]} />
          <div>
            <div className="claim-text">{c.claim}</div>
            {c.citations.length > 0 && <div className="claim-cites">{c.citations.join(", ")}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
