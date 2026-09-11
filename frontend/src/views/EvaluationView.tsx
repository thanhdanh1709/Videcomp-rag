import { useState } from "react";
import { ApiError, fetchExperiment, runEvaluation } from "../api/client";
import type { Domain, ExperimentRecord, Mode } from "../api/types";
import { DOMAIN_LABEL, MODE_LABEL } from "../api/types";
import { ModePicker } from "../components/ModePicker";
import { DomainToggle } from "../components/DomainToggle";
import { JsonBlock } from "../components/JsonBlock";

const METRIC_LABEL: Record<string, string> = {
  recall_at_k: "Recall@k",
  hit_at_k: "Hit@k",
  mrr_at_k: "MRR@k",
  ndcg_at_k: "nDCG@k",
  hop_recall: "Hop recall",
  citation_precision: "Citation P",
  citation_recall: "Citation R",
  em: "EM",
  f1: "F1",
};

function MetricsGrid({ metrics }: { metrics: Record<string, number> }) {
  const entries = Object.entries(metrics);
  if (entries.length === 0) return <div style={{ color: "var(--outline)", fontSize: 13 }}>Không có chỉ số.</div>;
  return (
    <div className="metrics-grid">
      {entries.map(([k, v]) => (
        <div className="metric-tile" key={k}>
          <div className="k">{METRIC_LABEL[k] ?? k}</div>
          <div className="v">{typeof v === "number" ? v.toFixed(3) : String(v)}</div>
        </div>
      ))}
    </div>
  );
}

export function EvaluationView() {
  const [experimentId, setExperimentId] = useState("");
  const [record, setRecord] = useState<ExperimentRecord | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  const [datasetPath, setDatasetPath] = useState("data/benchmark/test.jsonl");
  const [mode, setMode] = useState<Mode>("videcomp_full");
  const [domain, setDomain] = useState<Domain>("legal");
  const [runLoading, setRunLoading] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<{
    experiment_id: string;
    mode: Mode;
    metrics: Record<string, number>;
    n_items: number;
  } | null>(null);

  const lookup = async () => {
    const id = experimentId.trim();
    if (!id) return;
    setLookupLoading(true);
    setLookupError(null);
    setRecord(null);
    try {
      setRecord(await fetchExperiment(id));
    } catch (err) {
      setLookupError(err instanceof ApiError ? err.message : "Không thể kết nối tới backend.");
    } finally {
      setLookupLoading(false);
    }
  };

  const run = async () => {
    if (!datasetPath.trim()) return;
    setRunLoading(true);
    setRunError(null);
    setRunResult(null);
    try {
      setRunResult(await runEvaluation(datasetPath.trim(), mode, domain));
    } catch (err) {
      setRunError(err instanceof ApiError ? err.message : "Không thể kết nối tới backend.");
    } finally {
      setRunLoading(false);
    }
  };

  return (
    <div className="view-scroll">
      <div className="view-inner">
        <div>
          <div className="view-heading">Đánh giá mô hình (ablation B0→Q3)</div>
          <div className="view-desc">
            Tra lại một experiment đã chạy, hoặc chạy đánh giá mới trên một bộ benchmark (
            <code>data/benchmark/*.jsonl</code>) và một trong 6 mode retrieval/decomposition — index cho domain
            tương ứng cần được build trước qua <code>/api/v1/index/build</code>.
          </div>
        </div>

        <div>
          <div className="citations-title">Tra experiment theo ID</div>
          <div className="lookup-row">
            <input
              className="text-input"
              placeholder="vd. videcomp_full-a1b2c3d4"
              value={experimentId}
              onChange={(e) => setExperimentId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && lookup()}
            />
            <button className="btn-primary" onClick={lookup} disabled={lookupLoading || !experimentId.trim()}>
              {lookupLoading ? "Đang tra…" : "Tra cứu"}
            </button>
          </div>
          {lookupError && <div className="msg-error" style={{ marginTop: 8 }}>Lỗi: {lookupError}</div>}
          {record && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                <span className="badge">{MODE_LABEL[record.mode]}</span>
                <span className="badge">{record.n_items} câu</span>
                <span className="badge">{record.dataset_path}</span>
                <span className="badge">{new Date(record.created_at).toLocaleString("vi-VN")}</span>
              </div>
              <MetricsGrid metrics={record.metrics} />
              <div style={{ marginTop: 12 }}>
                <JsonBlock label={`experiment · ${record.experiment_id}`} data={record} />
              </div>
            </div>
          )}
        </div>

        <div style={{ borderTop: "1px solid var(--chat-hairline)", paddingTop: 16 }}>
          <div className="citations-title">Chạy đánh giá mới</div>
          <div className="form-grid" style={{ marginBottom: 12 }}>
            <div>
              <label className="field-label">Dataset path</label>
              <input className="text-input" style={{ width: "100%" }} value={datasetPath} onChange={(e) => setDatasetPath(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Domain</label>
              <div style={{ display: "flex", gap: 6 }}>
                <DomainToggle value={domain} onChange={setDomain} />
              </div>
            </div>
            <div>
              <label className="field-label">Mode</label>
              <ModePicker value={mode} onChange={setMode} showDescription={false} />
            </div>
          </div>
          <button className="btn-primary" onClick={run} disabled={runLoading || !datasetPath.trim()}>
            {runLoading ? "Đang chạy đánh giá… (có thể mất vài phút)" : "Chạy đánh giá"}
          </button>
          {runError && <div className="msg-error" style={{ marginTop: 8 }}>Lỗi: {runError}</div>}
          {runResult && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                <span className="badge">experiment_id: {runResult.experiment_id}</span>
                <span className="badge">{runResult.n_items} câu</span>
              </div>
              <MetricsGrid metrics={runResult.metrics} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
