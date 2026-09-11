import { useState } from "react";
import {
  ApiError,
  evaluateSingleRagas,
  fetchExperiment,
  runEvaluation,
} from "../api/client";
import type {
  Domain,
  ExperimentRecord,
  Mode,
  RAGTriadResult,
  SampleEvaluationItem,
  SingleRagasRequest,
} from "../api/types";
import { DOMAIN_LABEL, MODE_LABEL } from "../api/types";
import { ModePicker } from "../components/ModePicker";
import { DomainToggle } from "../components/DomainToggle";
import { JsonBlock } from "../components/JsonBlock";

const RETRIEVAL_METRICS_LABEL: Record<string, string> = {
  recall_at_k: "Recall@k",
  hit_at_k: "Hit@k",
  mrr_at_k: "MRR@k",
  ndcg_at_k: "nDCG@k",
  hop_recall: "Hop recall",
  citation_precision: "Citation P",
  citation_recall: "Citation R",
  em: "Exact Match (EM)",
  f1: "F1 Score",
};

// Preset demo queries for live interactive Ragas inspection
const PRESETS = [
  {
    label: "⚖️ Luật Lao động (Điều 46 - Đúng chuẩn)",
    question: "Người lao động làm việc đủ bao nhiêu tháng thì được trợ cấp thôi việc?",
    contexts: [
      "Theo Điều 46 Bộ luật Lao động, người lao động làm việc thường xuyên từ đủ 12 tháng trở lên được chi trả trợ cấp thôi việc.",
      "Mỗi năm làm việc được trợ cấp một nửa tháng tiền lương.",
    ],
    answer: "Người lao động làm việc thường xuyên từ đủ 12 tháng trở lên thì được người sử dụng lao động chi trả trợ cấp thôi việc theo Điều 46 Bộ luật Lao động.",
    gold_chunk_ids: ["ctx_1"],
  },
  {
    label: "🚨 Cảnh báo Ảo giác (Hallucination Test)",
    question: "Người lao động làm việc bao lâu thì được công ty tặng nhà chung cư?",
    contexts: [
      "Theo Điều 46 Bộ luật Lao động, người lao động làm việc thường xuyên từ đủ 12 tháng trở lên được chi trả trợ cấp thôi việc một nửa tháng lương cho mỗi năm làm việc.",
    ],
    answer: "Người lao động chỉ cần làm việc đủ 1 tháng là được công ty tặng ngay 1 căn nhà chung cư cao cấp.",
    gold_chunk_ids: [],
  },
  {
    label: "🏍️ Giao thông (Vượt đèn đỏ NĐ 100)",
    question: "Mức phạt vượt đèn đỏ xe máy là bao nhiêu tiền?",
    contexts: [
      "Điểm e Khoản 4 Điều 6 Nghị định 100/2019/NĐ-CP (sửa đổi bởi Nghị định 123/2021/NĐ-CP): Phạt tiền từ 800.000 đồng đến 1.000.000 đồng đối với người điều khiển xe mô tô, xe gắn máy không chấp hành hiệu lệnh của đèn tín hiệu giao thông.",
    ],
    answer: "Theo quy định tại Nghị định 100/2019/NĐ-CP (sửa đổi bởi NĐ 123/2021/NĐ-CP), mức phạt đối với người điều khiển xe máy vượt đèn đỏ là từ 800.000 đồng đến 1.000.000 đồng.",
    gold_chunk_ids: ["ctx_1"],
  },
];

function getScoreColorClass(score: number): "green" | "amber" | "rose" {
  if (score >= 0.75) return "green";
  if (score >= 0.45) return "amber";
  return "rose";
}

export function EvaluationView() {
  const [activeTab, setActiveTab] = useState<"batch" | "live" | "history">("batch");

  // --- TAB 1: BATCH BENCHMARK STATE ---
  const [datasetPath, setDatasetPath] = useState("data/benchmark/test.jsonl");
  const [mode, setMode] = useState<Mode>("videcomp_full");
  const [domain, setDomain] = useState<Domain>("legal");
  const [includeRagas, setIncludeRagas] = useState(true);
  const [sampleLimit, setSampleLimit] = useState<number>(3); // Default 3 for fast testing
  const [runLoading, setRunLoading] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<{
    experiment_id: string;
    mode: Mode;
    metrics: Record<string, number>;
    n_items: number;
    sample_evaluations?: SampleEvaluationItem[];
  } | null>(null);
  const [expandedSampleId, setExpandedSampleId] = useState<string | null>(null);

  // --- TAB 2: LIVE RAGAS INSPECTOR STATE ---
  const [liveQuestion, setLiveQuestion] = useState(PRESETS[0].question);
  const [liveContextsStr, setLiveContextsStr] = useState(PRESETS[0].contexts.join("\n---\n"));
  const [liveAnswer, setLiveAnswer] = useState(PRESETS[0].answer);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [liveResult, setLiveResult] = useState<RAGTriadResult | null>(null);

  // --- TAB 3: EXPERIMENT HISTORY STATE ---
  const [experimentId, setExperimentId] = useState("");
  const [historyRecord, setHistoryRecord] = useState<ExperimentRecord | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Handler: Run Batch Benchmark
  const handleRunBatch = async () => {
    if (!datasetPath.trim()) return;
    setRunLoading(true);
    setRunError(null);
    try {
      const res = await runEvaluation(
        datasetPath.trim(),
        mode,
        domain,
        includeRagas,
        sampleLimit > 0 ? sampleLimit : undefined
      );
      setRunResult(res);
      if (res.sample_evaluations && res.sample_evaluations.length > 0) {
        setExpandedSampleId(res.sample_evaluations[0].id);
      }
    } catch (err) {
      setRunError(err instanceof ApiError ? err.message : "Không thể kết nối tới backend.");
    } finally {
      setRunLoading(false);
    }
  };

  // Handler: Run Live Single Ragas Inspection
  const handleRunLiveRagas = async () => {
    if (!liveQuestion.trim() || !liveAnswer.trim()) return;
    setLiveLoading(true);
    setLiveError(null);
    try {
      const rawContexts = liveContextsStr
        .split("\n---\n")
        .map((t) => t.trim())
        .filter(Boolean);
      const payload: SingleRagasRequest = {
        question: liveQuestion.trim(),
        answer: liveAnswer.trim(),
        contexts: rawContexts,
        domain,
      };
      const res = await evaluateSingleRagas(payload);
      setLiveResult(res);
    } catch (err) {
      setLiveError(err instanceof ApiError ? err.message : "Không thể kết nối tới backend.");
    } finally {
      setLiveLoading(false);
    }
  };

  // Handler: Lookup History Record
  const handleLookupHistory = async () => {
    const id = experimentId.trim();
    if (!id) return;
    setHistoryLoading(true);
    setHistoryError(null);
    setHistoryRecord(null);
    try {
      setHistoryRecord(await fetchExperiment(id));
    } catch (err) {
      setHistoryError(err instanceof ApiError ? err.message : "Không thể kết nối tới backend.");
    } finally {
      setHistoryLoading(false);
    }
  };

  // Helper: Export results to JSON
  const handleExportJson = (data: any, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="view-scroll">
      <div className="eval-dashboard-container">
        {/* Header Title & Intro */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div className="view-heading">Hệ thống Đo lường Chất lượng RAG Tự động (Ragas / RAG Triad)</div>
              <div className="view-desc">
                Đánh giá chuẩn mực toàn diện 3 trụ cột chất lượng: <strong>Độ trung thực (Faithfulness)</strong>,{" "}
                <strong>Độ liên quan (Answer Relevance)</strong>, và <strong>Mức độ trích dẫn (Context Precision)</strong>,
                kèm các chỉ số truy xuất truyền thống (Recall, MRR, nDCG, EM, F1).
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span className="rag-pill-badge green">✓ Ragas Framework</span>
              <span className="rag-pill-badge amber">⚡ On-Premise & Cloud</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="eval-nav-tabs">
          <button
            className={`eval-tab-btn ${activeTab === "batch" ? "active" : ""}`}
            onClick={() => setActiveTab("batch")}
          >
            📊 Đánh giá Benchmark Tự động
          </button>
          <button
            className={`eval-tab-btn ${activeTab === "live" ? "active" : ""}`}
            onClick={() => setActiveTab("live")}
          >
            🧪 Trình Thẩm định Ragas Trực tiếp (Live Inspector)
          </button>
          <button
            className={`eval-tab-btn ${activeTab === "history" ? "active" : ""}`}
            onClick={() => setActiveTab("history")}
          >
            📜 Tra cứu Lịch sử Experiment
          </button>
        </div>

        {/* ================================================================= */}
        {/* TAB 1: BATCH BENCHMARK EVALUATION */}
        {/* ================================================================= */}
        {activeTab === "batch" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Run Configuration Panel */}
            <div
              style={{
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "var(--radius-md)",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                Cấu hình Thử nghiệm Benchmark
              </div>

              <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
                <div>
                  <label className="field-label">Tập dữ liệu Benchmark (JSONL)</label>
                  <input
                    className="text-input"
                    style={{ width: "100%" }}
                    value={datasetPath}
                    onChange={(e) => setDatasetPath(e.target.value)}
                    placeholder="data/benchmark/test.jsonl"
                  />
                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    {[
                      "data/benchmark/test.jsonl",
                      "data/benchmark/dev.jsonl",
                      "data/benchmark/candidates_draft.jsonl",
                    ].map((p) => (
                      <button
                        key={p}
                        type="button"
                        className="chip"
                        style={{ fontSize: 11, padding: "2px 8px" }}
                        onClick={() => setDatasetPath(p)}
                      >
                        {p.split("/").pop()}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="field-label">Chuyên ngành (Domain)</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <DomainToggle value={domain} onChange={setDomain} />
                  </div>
                </div>

                <div>
                  <label className="field-label">Số lượng mẫu đánh giá</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[
                      { label: "3 câu (Test nhanh)", val: 3 },
                      { label: "5 câu", val: 5 },
                      { label: "10 câu", val: 10 },
                      { label: "Tất cả", val: 0 },
                    ].map((item) => (
                      <button
                        key={item.val}
                        type="button"
                        className={`chip ${sampleLimit === item.val ? "selected" : ""}`}
                        style={{ fontSize: 11.5 }}
                        onClick={() => setSampleLimit(item.val)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="field-label">Chiến lược thực thi (Pipeline Mode)</label>
                <ModePicker value={mode} onChange={setMode} showDescription={true} />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                <input
                  type="checkbox"
                  id="includeRagasCheckbox"
                  checked={includeRagas}
                  onChange={(e) => setIncludeRagas(e.target.checked)}
                  style={{ cursor: "pointer", width: 16, height: 16, accentColor: "var(--chat-brand-green)" }}
                />
                <label htmlFor="includeRagasCheckbox" style={{ fontSize: 13, color: "var(--text-primary)", cursor: "pointer" }}>
                  Kích hoạt hệ thống đo lường <strong>Ragas Triad</strong> (Độ trung thực, Độ liên quan, Context Precision)
                </label>
              </div>

              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <button
                  className="btn-primary"
                  onClick={handleRunBatch}
                  disabled={runLoading || !datasetPath.trim()}
                  style={{ padding: "0 24px" }}
                >
                  {runLoading ? "Đang chạy đánh giá Ragas… (Vui lòng đợi)" : "🚀 Bắt đầu Chạy Đánh giá Benchmark"}
                </button>
                {runLoading && (
                  <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
                    Đang thực thi mô hình & thẩm định luận điểm từng câu hỏi...
                  </span>
                )}
              </div>

              {runError && (
                <div className="msg-error" style={{ marginTop: 4 }}>
                  ⚠️ Lỗi thực thi: {runError}
                </div>
              )}
            </div>

            {/* Results Section */}
            {runResult && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {/* Result summary bar */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span className="badge" style={{ fontWeight: 600 }}>{MODE_LABEL[runResult.mode]}</span>
                    <span className="badge">{runResult.n_items} mẫu kiểm thử</span>
                    <span className="badge" style={{ fontFamily: "var(--font-mono)" }}>
                      ID: {runResult.experiment_id}
                    </span>
                  </div>
                  <button
                    className="btn-ghost"
                    style={{ fontSize: 12, padding: "4px 10px", border: "1px solid var(--chat-hairline)" }}
                    onClick={() => handleExportJson(runResult, `benchmark_${runResult.experiment_id}.json`)}
                  >
                    📥 Xuất kết quả JSON
                  </button>
                </div>

                {/* HERO RAG TRIAD SCORECARDS */}
                {includeRagas && runResult.metrics.rag_triad_index !== undefined && (
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Chỉ số Đánh giá Tự động RAG Triad (Chuẩn Ragas / TruLens)
                    </div>
                    <div className="rag-triad-grid">
                      {/* 1. Faithfulness Card */}
                      <div className="rag-score-card">
                        <div className="rag-score-header">
                          <div className="rag-score-title">🎯 Độ trung thực (Faithfulness)</div>
                          <span className={`rag-pill-badge ${getScoreColorClass(runResult.metrics.faithfulness ?? 1)}`}>
                            {(runResult.metrics.faithfulness ?? 1) >= 0.8
                              ? "Hoàn toàn trung thực"
                              : (runResult.metrics.faithfulness ?? 1) >= 0.5
                              ? "Đạt yêu cầu"
                              : "Ảo giác / Thiếu căn cứ"}
                          </span>
                        </div>
                        <div className="rag-score-main">
                          <div className="rag-score-number">
                            {((runResult.metrics.faithfulness ?? 1) * 100).toFixed(1)}%
                          </div>
                          <div className="rag-score-sub">({(runResult.metrics.faithfulness ?? 1).toFixed(3)}/1.000)</div>
                        </div>
                        <div className="rag-progress-track">
                          <div
                            className={`rag-progress-fill ${getScoreColorClass(runResult.metrics.faithfulness ?? 1)}`}
                            style={{ width: `${(runResult.metrics.faithfulness ?? 1) * 100}%` }}
                          />
                        </div>
                        <div className="rag-score-verdict">
                          <strong>Câu hỏi:</strong> Câu trả lời có đúng với tài liệu không?<br />
                          Tỷ lệ các luận điểm có bằng chứng trích dẫn chứng thực.
                        </div>
                      </div>

                      {/* 2. Answer Relevance Card */}
                      <div className="rag-score-card">
                        <div className="rag-score-header">
                          <div className="rag-score-title">💡 Độ liên quan (Answer Relevance)</div>
                          <span className={`rag-pill-badge ${getScoreColorClass(runResult.metrics.answer_relevance ?? 1)}`}>
                            {(runResult.metrics.answer_relevance ?? 1) >= 0.8
                              ? "Đúng trọng tâm"
                              : (runResult.metrics.answer_relevance ?? 1) >= 0.5
                              ? "Tương đối sát"
                              : "Né tránh / Lan man"}
                          </span>
                        </div>
                        <div className="rag-score-main">
                          <div className="rag-score-number">
                            {((runResult.metrics.answer_relevance ?? 1) * 100).toFixed(1)}%
                          </div>
                          <div className="rag-score-sub">({(runResult.metrics.answer_relevance ?? 1).toFixed(3)}/1.000)</div>
                        </div>
                        <div className="rag-progress-track">
                          <div
                            className={`rag-progress-fill ${getScoreColorClass(runResult.metrics.answer_relevance ?? 1)}`}
                            style={{ width: `${(runResult.metrics.answer_relevance ?? 1) * 100}%` }}
                          />
                        </div>
                        <div className="rag-score-verdict">
                          <strong>Câu hỏi:</strong> Có trả lời đúng trọng tâm câu hỏi không?<br />
                          Mức độ trực diện, bao quát và giải quyết câu hỏi người dùng.
                        </div>
                      </div>

                      {/* 3. Context Precision Card */}
                      <div className="rag-score-card">
                        <div className="rag-score-header">
                          <div className="rag-score-title">🔍 Mức độ trích dẫn (Context Precision)</div>
                          <span className={`rag-pill-badge ${getScoreColorClass(runResult.metrics.context_precision ?? 1)}`}>
                            {(runResult.metrics.context_precision ?? 1) >= 0.8
                              ? "Tín hiệu cực chuẩn"
                              : (runResult.metrics.context_precision ?? 1) >= 0.5
                              ? "Chứa ít nhiễu"
                              : "Tạp âm cao"}
                          </span>
                        </div>
                        <div className="rag-score-main">
                          <div className="rag-score-number">
                            {((runResult.metrics.context_precision ?? 1) * 100).toFixed(1)}%
                          </div>
                          <div className="rag-score-sub">({(runResult.metrics.context_precision ?? 1).toFixed(3)}/1.000)</div>
                        </div>
                        <div className="rag-progress-track">
                          <div
                            className={`rag-progress-fill ${getScoreColorClass(runResult.metrics.context_precision ?? 1)}`}
                            style={{ width: `${(runResult.metrics.context_precision ?? 1) * 100}%` }}
                          />
                        </div>
                        <div className="rag-score-verdict">
                          <strong>Câu hỏi:</strong> Bằng chứng tìm được có chuẩn xác không?<br />
                          Tỷ lệ văn bản hữu ích xếp hạng cao trong danh sách truy xuất.
                        </div>
                      </div>

                      {/* 4. Combined Index Card */}
                      <div className="rag-score-card" style={{ background: "rgba(16, 163, 127, 0.05)", borderColor: "rgba(16, 163, 127, 0.25)" }}>
                        <div className="rag-score-header">
                          <div className="rag-score-title" style={{ color: "var(--chat-brand-green-light)" }}>🏆 RAG Triad Index</div>
                          <span className="rag-pill-badge green" style={{ fontSize: 12 }}>
                            {(runResult.metrics.rag_triad_index ?? 1) >= 0.85
                              ? "Xuất sắc (A+)"
                              : (runResult.metrics.rag_triad_index ?? 1) >= 0.70
                              ? "Tốt (A)"
                              : "Khá (B)"}
                          </span>
                        </div>
                        <div className="rag-score-main">
                          <div className="rag-score-number" style={{ color: "var(--chat-brand-green-light)" }}>
                            {((runResult.metrics.rag_triad_index ?? 1) * 100).toFixed(1)}
                          </div>
                          <div className="rag-score-sub">/100 điểm</div>
                        </div>
                        <div className="rag-progress-track">
                          <div
                            className="rag-progress-fill green"
                            style={{ width: `${(runResult.metrics.rag_triad_index ?? 1) * 100}%` }}
                          />
                        </div>
                        <div className="rag-score-verdict">
                          Điểm số tổng hợp bộ ba chất lượng. Sẵn sàng triển khai phục vụ chuyên môn cao.
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Classic Retrieval Metrics Grid */}
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Chỉ số Truy xuất & Đối sánh Bằng chứng (Retrieval Metrics)
                  </div>
                  <div className="metrics-grid">
                    {Object.entries(runResult.metrics)
                      .filter(([k]) => !["faithfulness", "answer_relevance", "context_precision", "rag_triad_index"].includes(k))
                      .map(([k, v]) => (
                        <div className="metric-tile" key={k}>
                          <div className="k">{RETRIEVAL_METRICS_LABEL[k] ?? k}</div>
                          <div className="v">{typeof v === "number" ? v.toFixed(3) : String(v)}</div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* PER-SAMPLE DIAGNOSTICS ACCORDION */}
                {runResult.sample_evaluations && runResult.sample_evaluations.length > 0 && (
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Bảng Phân tích Chi tiết Từng Câu hỏi (Per-sample Ragas Diagnostics)
                    </div>
                    <div
                      style={{
                        background: "rgba(255, 255, 255, 0.02)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        borderRadius: "var(--radius-md)",
                        overflow: "hidden",
                      }}
                    >
                      <table className="rag-samples-table">
                        <thead>
                          <tr>
                            <th style={{ width: "35%" }}>Câu hỏi Benchmark</th>
                            <th style={{ width: "12%" }}>Độ trung thực</th>
                            <th style={{ width: "12%" }}>Độ liên quan</th>
                            <th style={{ width: "12%" }}>Context Prec.</th>
                            <th style={{ width: "12%" }}>RAG Index</th>
                            <th style={{ width: "17%", textAlign: "right" }}>Thao tác</th>
                          </tr>
                        </thead>
                        <tbody>
                          {runResult.sample_evaluations.map((sample, idx) => {
                            const isExpanded = expandedSampleId === sample.id;
                            return (
                              <tr key={sample.id}>
                                <td colSpan={6} style={{ padding: 0 }}>
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      padding: "12px 14px",
                                      cursor: "pointer",
                                      background: isExpanded ? "rgba(16, 163, 127, 0.06)" : "transparent",
                                    }}
                                    onClick={() => setExpandedSampleId(isExpanded ? null : sample.id)}
                                  >
                                    <div style={{ width: "35%", fontWeight: 500, color: "var(--text-primary)" }}>
                                      <span style={{ color: "var(--text-muted)", marginRight: 6 }}>#{idx + 1}</span>
                                      {sample.question}
                                    </div>
                                    <div style={{ width: "12%" }}>
                                      <span className={`rag-pill-badge ${getScoreColorClass(sample.faithfulness)}`}>
                                        {(sample.faithfulness * 100).toFixed(0)}%
                                      </span>
                                    </div>
                                    <div style={{ width: "12%" }}>
                                      <span className={`rag-pill-badge ${getScoreColorClass(sample.answer_relevance)}`}>
                                        {(sample.answer_relevance * 100).toFixed(0)}%
                                      </span>
                                    </div>
                                    <div style={{ width: "12%" }}>
                                      <span className={`rag-pill-badge ${getScoreColorClass(sample.context_precision)}`}>
                                        {(sample.context_precision * 100).toFixed(0)}%
                                      </span>
                                    </div>
                                    <div style={{ width: "12%" }}>
                                      <span className="rag-pill-badge green" style={{ fontWeight: 700 }}>
                                        {(sample.rag_triad_index * 100).toFixed(0)} ({sample.grade})
                                      </span>
                                    </div>
                                    <div style={{ width: "17%", textAlign: "right", color: "var(--text-secondary)", fontSize: 12 }}>
                                      {isExpanded ? "Thu gọn ▲" : "Xem chi tiết ▼"}
                                    </div>
                                  </div>

                                  {/* EXPANDED SAMPLE DIAGNOSTICS */}
                                  {isExpanded && (
                                    <div
                                      style={{
                                        padding: "16px 20px",
                                        background: "rgba(0, 0, 0, 0.25)",
                                        borderTop: "1px solid rgba(255, 255, 255, 0.06)",
                                        borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 14,
                                      }}
                                    >
                                      {/* Answers comparison */}
                                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                                        <div style={{ background: "rgba(255, 255, 255, 0.02)", padding: 12, borderRadius: 6, border: "1px solid rgba(255, 255, 255, 0.04)" }}>
                                          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, textTransform: "uppercase" }}>
                                            🎯 Câu trả lời sinh ra (Generated Answer)
                                          </div>
                                          <div style={{ fontSize: 13, lineHeight: 1.5, color: "var(--text-primary)" }}>
                                            {sample.generated_answer}
                                          </div>
                                        </div>
                                        <div style={{ background: "rgba(255, 255, 255, 0.02)", padding: 12, borderRadius: 6, border: "1px solid rgba(255, 255, 255, 0.04)" }}>
                                          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, textTransform: "uppercase" }}>
                                            📖 Câu trả lời chuẩn (Gold Standard Answer)
                                          </div>
                                          <div style={{ fontSize: 13, lineHeight: 1.5, color: "var(--text-primary)" }}>
                                            {sample.gold_answer || "Không có ground-truth"}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Claims verification breakdown */}
                                      <div>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
                                          Phân tích Luận điểm Độ trung thực (Faithfulness Claims):
                                        </div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                          {sample.claims && sample.claims.length > 0 ? (
                                            sample.claims.map((cl, cIdx) => (
                                              <div
                                                key={cIdx}
                                                style={{
                                                  padding: "8px 12px",
                                                  borderRadius: 6,
                                                  background: "rgba(255, 255, 255, 0.02)",
                                                  border: "1px solid rgba(255, 255, 255, 0.04)",
                                                  fontSize: 12.5,
                                                }}
                                              >
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                                                  <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                                                    {cl.claim}
                                                  </span>
                                                  <span
                                                    className={
                                                      cl.status === "supported"
                                                        ? "claim-badge-supported"
                                                        : cl.status === "unsupported"
                                                        ? "claim-badge-unsupported"
                                                        : "claim-badge-insufficient"
                                                    }
                                                  >
                                                    {cl.status === "supported" ? "✓ Hợp lệ" : cl.status === "unsupported" ? "✗ Mâu thuẫn" : "⚠ Thiếu căn cứ"}
                                                  </span>
                                                </div>
                                                {cl.reasoning && (
                                                  <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                                                    {cl.reasoning}
                                                  </div>
                                                )}
                                                {cl.evidence_snippet && (
                                                  <div style={{ fontSize: 11, color: "var(--text-secondary)", fontStyle: "italic", marginTop: 2 }}>
                                                    Bằng chứng: "{cl.evidence_snippet}"
                                                  </div>
                                                )}
                                              </div>
                                            ))
                                          ) : (
                                            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Không có luận điểm phân rã.</div>
                                          )}
                                        </div>
                                      </div>

                                      {/* Context Precision Breakdown */}
                                      <div>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
                                          Xếp hạng Bằng chứng Truy xuất (Context Precision Ranking):
                                        </div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                          {sample.contexts && sample.contexts.length > 0 ? (
                                            sample.contexts.map((cx, cxIdx) => (
                                              <div
                                                key={cxIdx}
                                                style={{
                                                  display: "flex",
                                                  alignItems: "center",
                                                  gap: 10,
                                                  padding: "6px 10px",
                                                  borderRadius: 4,
                                                  background: cx.is_relevant ? "rgba(16, 185, 129, 0.08)" : "rgba(255, 255, 255, 0.02)",
                                                  border: `1px solid ${cx.is_relevant ? "rgba(16, 185, 129, 0.2)" : "rgba(255, 255, 255, 0.03)"}`,
                                                  fontSize: 12,
                                                }}
                                              >
                                                <span style={{ fontWeight: 600, color: cx.is_relevant ? "#34d399" : "var(--text-muted)" }}>
                                                  #{cx.rank}
                                                </span>
                                                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>
                                                  {cx.chunk_id}
                                                </span>
                                                <span style={{ flex: 1, color: "var(--text-primary)" }}>
                                                  {cx.snippet}
                                                </span>
                                                <span className={`rag-pill-badge ${cx.is_relevant ? "green" : "rose"}`} style={{ fontSize: 10 }}>
                                                  {cx.is_relevant ? "Bằng chứng Chuẩn" : "Tạp âm (Noise)"}
                                                </span>
                                              </div>
                                            ))
                                          ) : (
                                            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Không có bằng chứng truy xuất.</div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: LIVE INTERACTIVE RAGAS INSPECTOR */}
        {/* ================================================================= */}
        {activeTab === "live" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Presets picker */}
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)" }}>Mẫu thử nghiệm nhanh:</span>
              {PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="chip"
                  style={{ fontSize: 12 }}
                  onClick={() => {
                    setLiveQuestion(p.question);
                    setLiveContextsStr(p.contexts.join("\n---\n"));
                    setLiveAnswer(p.answer);
                    setLiveResult(null);
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Inputs grid */}
            <div
              style={{
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "var(--radius-md)",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <div>
                <label className="field-label">1. Câu hỏi người dùng (Question)</label>
                <input
                  className="text-input"
                  style={{ width: "100%", fontFamily: "inherit" }}
                  value={liveQuestion}
                  onChange={(e) => setLiveQuestion(e.target.value)}
                  placeholder="Nhập câu hỏi cần thẩm định..."
                />
              </div>

              <div>
                <label className="field-label">
                  2. Tài liệu Ngữ cảnh Truy xuất (Contexts - Ngăn cách các đoạn bằng <code>---</code>)
                </label>
                <textarea
                  className="text-input"
                  style={{ width: "100%", height: 110, fontFamily: "inherit", resize: "vertical" }}
                  value={liveContextsStr}
                  onChange={(e) => setLiveContextsStr(e.target.value)}
                  placeholder="Dán các đoạn căn cứ pháp lý hoặc hồ sơ bệnh án..."
                />
              </div>

              <div>
                <label className="field-label">3. Câu trả lời cần thẩm định (Generated Answer to Judge)</label>
                <textarea
                  className="text-input"
                  style={{ width: "100%", height: 90, fontFamily: "inherit", resize: "vertical" }}
                  value={liveAnswer}
                  onChange={(e) => setLiveAnswer(e.target.value)}
                  placeholder="Nhập câu trả lời do LLM sinh ra..."
                />
              </div>

              <div>
                <button
                  className="btn-primary"
                  onClick={handleRunLiveRagas}
                  disabled={liveLoading || !liveQuestion.trim() || !liveAnswer.trim()}
                  style={{ padding: "0 24px" }}
                >
                  {liveLoading ? "Đang thẩm định Ragas… (Đang tính toán)" : "⚡ Thẩm định Ragas Trực tiếp Ngay"}
                </button>
              </div>

              {liveError && <div className="msg-error">⚠️ {liveError}</div>}
            </div>

            {/* Live Results Panel */}
            {liveResult && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                  Kết quả Thẩm định RAG Triad Trực tiếp
                </div>

                {/* Scorecards */}
                <div className="rag-triad-grid">
                  {/* Faithfulness */}
                  <div className="rag-score-card">
                    <div className="rag-score-header">
                      <div className="rag-score-title">🎯 Faithfulness</div>
                      <span className={`rag-pill-badge ${getScoreColorClass(liveResult.faithfulness.score)}`}>
                        {liveResult.faithfulness.verdict}
                      </span>
                    </div>
                    <div className="rag-score-main">
                      <div className="rag-score-number">{(liveResult.faithfulness.score * 100).toFixed(1)}%</div>
                      <div className="rag-score-sub">({liveResult.faithfulness.supported_claims}/{liveResult.faithfulness.total_claims} luận điểm)</div>
                    </div>
                    <div className="rag-progress-track">
                      <div
                        className={`rag-progress-fill ${getScoreColorClass(liveResult.faithfulness.score)}`}
                        style={{ width: `${liveResult.faithfulness.score * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Answer Relevance */}
                  <div className="rag-score-card">
                    <div className="rag-score-header">
                      <div className="rag-score-title">💡 Answer Relevance</div>
                      <span className={`rag-pill-badge ${getScoreColorClass(liveResult.answer_relevance.score)}`}>
                        {liveResult.answer_relevance.verdict}
                      </span>
                    </div>
                    <div className="rag-score-main">
                      <div className="rag-score-number">{(liveResult.answer_relevance.score * 100).toFixed(1)}%</div>
                      <div className="rag-score-sub">Rubric: {(liveResult.answer_relevance.rubric_score * 100).toFixed(0)}%</div>
                    </div>
                    <div className="rag-progress-track">
                      <div
                        className={`rag-progress-fill ${getScoreColorClass(liveResult.answer_relevance.score)}`}
                        style={{ width: `${liveResult.answer_relevance.score * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Context Precision */}
                  <div className="rag-score-card">
                    <div className="rag-score-header">
                      <div className="rag-score-title">🔍 Context Precision</div>
                      <span className={`rag-pill-badge ${getScoreColorClass(liveResult.context_precision.score)}`}>
                        {liveResult.context_precision.verdict}
                      </span>
                    </div>
                    <div className="rag-score-main">
                      <div className="rag-score-number">{(liveResult.context_precision.score * 100).toFixed(1)}%</div>
                      <div className="rag-score-sub">({liveResult.context_precision.relevant_contexts_count}/{liveResult.context_precision.total_contexts_count} liên quan)</div>
                    </div>
                    <div className="rag-progress-track">
                      <div
                        className={`rag-progress-fill ${getScoreColorClass(liveResult.context_precision.score)}`}
                        style={{ width: `${liveResult.context_precision.score * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Index */}
                  <div className="rag-score-card" style={{ background: "rgba(16, 163, 127, 0.05)", borderColor: "rgba(16, 163, 127, 0.25)" }}>
                    <div className="rag-score-header">
                      <div className="rag-score-title" style={{ color: "var(--chat-brand-green-light)" }}>🏆 RAG Triad Index</div>
                      <span className="rag-pill-badge green">{liveResult.grade}</span>
                    </div>
                    <div className="rag-score-main">
                      <div className="rag-score-number" style={{ color: "var(--chat-brand-green-light)" }}>
                        {(liveResult.rag_triad_index * 100).toFixed(1)}
                      </div>
                      <div className="rag-score-sub">/100</div>
                    </div>
                    <div className="rag-progress-track">
                      <div className="rag-progress-fill green" style={{ width: `${liveResult.rag_triad_index * 100}%` }} />
                    </div>
                  </div>
                </div>

                {/* Detailed Claims Breakdown */}
                <div
                  style={{
                    background: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "var(--radius-md)",
                    padding: "16px 20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase" }}>
                    Bảng Thẩm định Chi tiết Luận điểm (Factual Claims Breakdown)
                  </div>
                  {liveResult.faithfulness.claims.map((cl, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 6,
                        background: "rgba(255, 255, 255, 0.03)",
                        border: "1px solid rgba(255, 255, 255, 0.06)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--text-primary)" }}>
                          {idx + 1}. {cl.claim}
                        </div>
                        <span
                          className={
                            cl.status === "supported"
                              ? "claim-badge-supported"
                              : cl.status === "unsupported"
                              ? "claim-badge-unsupported"
                              : "claim-badge-insufficient"
                          }
                        >
                          {cl.status === "supported" ? "✓ Hợp lệ (Supported)" : cl.status === "unsupported" ? "✗ Mâu thuẫn (Contradiction)" : "⚠ Thiếu căn cứ (Hallucination)"}
                        </span>
                      </div>
                      {cl.reasoning && (
                        <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
                          <strong>Nhận định:</strong> {cl.reasoning}
                        </div>
                      )}
                      {cl.evidence_snippet && (
                        <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", background: "rgba(0,0,0,0.2)", padding: "4px 8px", borderRadius: 4 }}>
                          Trích đoạn chứng minh: "{cl.evidence_snippet}"
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: EXPERIMENT HISTORY LOOKUP */}
        {/* ================================================================= */}
        {activeTab === "history" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div className="citations-title">Tra cứu Experiment theo ID</div>
              <div className="lookup-row">
                <input
                  className="text-input"
                  placeholder="vd. videcomp_full-a1b2c3d4"
                  value={experimentId}
                  onChange={(e) => setExperimentId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLookupHistory()}
                />
                <button
                  className="btn-primary"
                  onClick={handleLookupHistory}
                  disabled={historyLoading || !experimentId.trim()}
                >
                  {historyLoading ? "Đang tra…" : "Tra cứu"}
                </button>
              </div>
              {historyError && <div className="msg-error" style={{ marginTop: 8 }}>Lỗi: {historyError}</div>}
            </div>

            {historyRecord && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span className="badge">{MODE_LABEL[historyRecord.mode]}</span>
                  <span className="badge">{historyRecord.n_items} câu</span>
                  <span className="badge">{historyRecord.dataset_path}</span>
                  <span className="badge">{new Date(historyRecord.created_at).toLocaleString("vi-VN")}</span>
                </div>

                {/* Scorecards if present */}
                {historyRecord.metrics.rag_triad_index !== undefined && (
                  <div className="rag-triad-grid">
                    <div className="rag-score-card">
                      <div className="rag-score-title">🎯 Faithfulness</div>
                      <div className="rag-score-number">
                        {((historyRecord.metrics.faithfulness ?? 1) * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div className="rag-score-card">
                      <div className="rag-score-title">💡 Answer Relevance</div>
                      <div className="rag-score-number">
                        {((historyRecord.metrics.answer_relevance ?? 1) * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div className="rag-score-card">
                      <div className="rag-score-title">🔍 Context Precision</div>
                      <div className="rag-score-number">
                        {((historyRecord.metrics.context_precision ?? 1) * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div className="rag-score-card" style={{ background: "rgba(16, 163, 127, 0.05)" }}>
                      <div className="rag-score-title" style={{ color: "var(--chat-brand-green-light)" }}>🏆 RAG Triad Index</div>
                      <div className="rag-score-number" style={{ color: "var(--chat-brand-green-light)" }}>
                        {((historyRecord.metrics.rag_triad_index ?? 1) * 100).toFixed(1)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Metrics Grid */}
                <div className="metrics-grid">
                  {Object.entries(historyRecord.metrics).map(([k, v]) => (
                    <div className="metric-tile" key={k}>
                      <div className="k">{RETRIEVAL_METRICS_LABEL[k] ?? k}</div>
                      <div className="v">{typeof v === "number" ? v.toFixed(3) : String(v)}</div>
                    </div>
                  ))}
                </div>

                {/* JSON Data Viewer */}
                <div>
                  <JsonBlock label={`experiment · ${historyRecord.experiment_id}`} data={historyRecord} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
