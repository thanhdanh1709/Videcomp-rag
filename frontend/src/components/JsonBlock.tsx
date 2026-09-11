import { useState } from "react";
import { IconCopy, IconCheck } from "./Icons";

export function JsonBlock({ label, data }: { label: string; data: unknown }) {
  const [copied, setCopied] = useState(false);
  const text = JSON.stringify(data, null, 2);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="macos-code-container">
      <div className="macos-code-header">
        <div className="macos-window-dots">
          <span className="macos-dot red" />
          <span className="macos-dot yellow" />
          <span className="macos-dot green" />
          <span className="macos-file-label" style={{ marginLeft: 8 }}>
            {label}
          </span>
        </div>
        <button className="macos-copy-btn" onClick={copy}>
          {copied ? (
            <>
              <IconCheck width={13} height={13} style={{ color: "var(--chat-brand-green)" }} />
              <span>Đã sao chép</span>
            </>
          ) : (
            <>
              <IconCopy width={13} height={13} />
              <span>Sao chép JSON</span>
            </>
          )}
        </button>
      </div>
      <pre className="macos-code-body">{text}</pre>
    </div>
  );
}
