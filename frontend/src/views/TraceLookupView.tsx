import { useState } from "react";
import { ApiError, fetchTrace } from "../api/client";
import type { TraceRecord } from "../api/types";
import { DOMAIN_LABEL, MODE_LABEL } from "../api/types";
import { HopTrace } from "../components/HopTrace";
import { CitationsTable } from "../components/CitationsTable";
import { VerificationPanel } from "../components/VerificationPanel";
import { JsonBlock } from "../components/JsonBlock";
import { formatDuration } from "../lib/format";

export function TraceLookupView() {
  const [requestId, setRequestId] = useState("");
  const [record, setRecord] = useState<TraceRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    const id = requestId.trim();
    if (!id) return;
    setLoading(true);
    setError(null);
    setRecord(null);
    try {
      const rec = await fetchTrace(id);
      setRecord(rec);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể kết nối tới backend.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="view-scroll">
      <div className="view-inner">
        <div>
          <div className="view-heading">Tra cứu trace</div>
          <div className="view-desc">
            Dán <code>request_id</code> đã lưu (bảng <code>qa_trace</code> trong PostgreSQL/SQLite) để xem lại toàn
            bộ lộ trình suy luận, bằng chứng và kết quả kiểm chứng của một lần hỏi đáp đã chạy trước đó — kể cả sau
            khi server khởi động lại.
          </div>
        </div>

        <div className="lookup-row">
          <input
            className="text-input"
            placeholder="vd. 8f3a1c2e-...."
            value={requestId}
            onChange={(e) => setRequestId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
          />
          <button className="btn-primary" onClick={run} disabled={loading || !requestId.trim()}>
            {loading ? "Đang tra…" : "Tra cứu"}
          </button>
        </div>

        {error && <div className="msg-error">Lỗi: {error}</div>}

        {record && (
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              <span className="badge">{DOMAIN_LABEL[record.domain]}</span>
              <span className="badge">{MODE_LABEL[record.mode]}</span>
              <span className="badge">xử lý trong {formatDuration(record.latency_ms)}</span>
              <span className="badge">{new Date(record.created_at).toLocaleString("vi-VN")}</span>
              <span className="badge">config {record.config_version}</span>
            </div>
            <div style={{ fontSize: 15, color: "var(--on-surface)", marginBottom: 12 }}>{record.question}</div>
            <HopTrace plan={record.query_plan} hops={record.hop_trace} citations={record.citations} />
            <div className="msg-assistant-body">{record.final_answer}</div>
            <CitationsTable citations={record.citations} />
            <VerificationPanel report={record.verification} />
            <JsonBlock label={`trace · ${record.request_id}`} data={record} />
          </div>
        )}
      </div>
    </div>
  );
}
