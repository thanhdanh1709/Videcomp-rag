import type { Mode } from "../api/types";
import { MODE_DESCRIPTION, MODE_GROUP, MODE_LABEL } from "../api/types";

const MODES: Mode[] = [
  "dense_rag",
  "hybrid_rag",
  "hybrid_rerank",
  "decomp_independent",
  "decomp_dependency",
  "videcomp_full",
];

const BASELINE_MODES = MODES.filter((m) => MODE_GROUP[m] === "baseline");
const DECOMP_MODES = MODES.filter((m) => MODE_GROUP[m] === "decomp");

export function ModePicker({
  value,
  onChange,
  showDescription = true,
}: {
  value: Mode;
  onChange: (m: Mode) => void;
  showDescription?: boolean;
}) {
  return (
    <div>
      <select
        className="select-input mode-select"
        value={value}
        onChange={(e) => onChange(e.target.value as Mode)}
      >
        <optgroup label="Baseline — không phân rã câu hỏi">
          {BASELINE_MODES.map((m) => (
            <option key={m} value={m}>
              {MODE_LABEL[m]}
            </option>
          ))}
        </optgroup>
        <optgroup label="ViDecomp — có phân rã câu hỏi">
          {DECOMP_MODES.map((m) => (
            <option key={m} value={m}>
              {MODE_LABEL[m]}
            </option>
          ))}
        </optgroup>
      </select>
      {showDescription && <div className="mode-description">{MODE_DESCRIPTION[value]}</div>}
    </div>
  );
}
