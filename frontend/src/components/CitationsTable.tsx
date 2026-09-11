import type { Citation } from "../api/types";
import { IconFileText } from "./Icons";

export function CitationsTable({ citations }: { citations: Citation[] }) {
  if (citations.length === 0) return null;

  return (
    <div className="mt-3 rounded-xl bg-surface-container/70 border border-outline-variant/30 overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 px-3.5 py-2.5 bg-surface-container-high/60 border-b border-outline-variant/30 text-label-sm font-semibold text-on-surface">
        <IconFileText width={16} height={16} className="text-primary flex-shrink-0" />
        <span>Căn cứ pháp lý &amp; Nguồn trích dẫn ({citations.length})</span>
      </div>

      <div className="divide-y divide-outline-variant/20">
        {citations.map((c) => {
          const isWeb = c.chunk_id.startsWith("web_") || (c.source_url && c.source_url.startsWith("http") && !c.source_url.includes(".pdf"));
          const isUpload = c.chunk_id.startsWith("up_") || (c.source_url && c.source_url.startsWith("attachment://"));

          return (
            <div className="flex items-start gap-3 p-3 hover:bg-surface-container-high/30 transition-colors" key={c.key}>
              <span className="flex-shrink-0 px-2 py-0.5 rounded-full bg-primary-container/30 text-primary text-[11px] font-bold border border-primary/30">
                {c.key}
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {isUpload && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#ffbd2e]/15 text-[#ffbd2e] text-[10px] font-semibold border border-[#ffbd2e]/30">
                      <span className="material-symbols-outlined text-[12px]">attach_file</span>
                      Tệp đính kèm
                    </span>
                  )}
                  {isWeb && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/15 text-primary text-[10px] font-semibold border border-primary/30">
                      <span className="material-symbols-outlined text-[12px]">public</span>
                      Tìm kiếm Web
                    </span>
                  )}
                  <span className="font-semibold text-on-surface text-[13px] leading-snug">
                    {c.citation_label ?? c.chunk_id}
                  </span>
                </div>

                {c.article_title && (
                  <div className="text-[12px] text-on-surface-variant mt-0.5 font-normal">
                    {c.article_title}
                  </div>
                )}

                <div className="flex items-center gap-2 text-[11px] text-outline mt-1.5 flex-wrap">
                  <span>Mã định danh: {c.chunk_id}</span>
                  {c.source_url && (
                    <>
                      <span>•</span>
                      {c.source_url.startsWith("http") ? (
                        <a
                          href={c.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-0.5"
                        >
                          <span>Xem nguồn trực tuyến</span>
                          <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                        </a>
                      ) : (
                        <span className="text-on-surface-variant font-mono">
                          {c.source_url.replace("attachment://", "")}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
