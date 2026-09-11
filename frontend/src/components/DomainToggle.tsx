import type { Domain } from "../api/types";
import { DOMAIN_LABEL } from "../api/types";

const DOMAINS: Domain[] = ["legal", "medical"];

export function DomainToggle({ value, onChange }: { value: Domain; onChange: (d: Domain) => void }) {
  return (
    <>
      {DOMAINS.map((d) => (
        <button key={d} className={`chip ${value === d ? "selected" : ""}`} onClick={() => onChange(d)}>
          {DOMAIN_LABEL[d]}
        </button>
      ))}
    </>
  );
}
