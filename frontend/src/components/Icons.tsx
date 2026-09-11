import type { SVGProps } from "react";

const base = (props: SVGProps<SVGSVGElement>) => ({
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...props,
});

/** Logo Vector chính thức của Videcomp-rag - Kết hợp chữ 'V' và mạng đồ thị phân rã đa bước Multi-hop RAG */
export const VidecompLogo = ({ size = 28, className = "" }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ flexShrink: 0 }}
  >
    <defs>
      <linearGradient id="vdGradPrimary" x1="6" y1="6" x2="34" y2="34" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#7ff8cf" />
        <stop offset="50%" stopColor="#61dbb4" />
        <stop offset="100%" stopColor="#12a480" />
      </linearGradient>
      <linearGradient id="vdGradCore" x1="12" y1="12" x2="28" y2="28" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#61dbb4" />
        <stop offset="100%" stopColor="#00382a" />
      </linearGradient>
      <filter id="vdGlowFilter" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="1" stdDeviation="2.5" floodColor="#61dbb4" floodOpacity="0.4" />
      </filter>
    </defs>
    {/* Đồ thị mạng phân rã lục giác (Decomposition Mesh) */}
    <path
      d="M20 4L33.856 12V28L20 36L6.144 28V12L20 4Z"
      stroke="url(#vdGradPrimary)"
      strokeWidth="1.6"
      strokeOpacity="0.35"
      strokeLinejoin="round"
    />
    {/* Chữ V phong cách đa nhánh (Multi-hop Reasoning Path) */}
    <path
      d="M10 13L20 29L30 13"
      stroke="url(#vdGradPrimary)"
      strokeWidth="3.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      filter="url(#vdGlowFilter)"
    />
    {/* Nhánh cầu nối trung gian (Bridge Sub-query) */}
    <path
      d="M15 13L20 21L25 13"
      stroke="#7ff8cf"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Trục liên kết kiểm chứng (Verification Axis) */}
    <line x1="20" y1="21" x2="20" y2="29" stroke="#7ff8cf" strokeWidth="2.2" strokeLinecap="round" />
    {/* Các nút mạng tri thức (Knowledge Nodes) */}
    <circle cx="20" cy="4" r="2" fill="#7ff8cf" />
    <circle cx="10" cy="13" r="2.6" fill="#61dbb4" />
    <circle cx="30" cy="13" r="2.6" fill="#61dbb4" />
    <circle cx="20" cy="21" r="2.4" fill="#7ff8cf" />
    <circle cx="20" cy="29" r="3" fill="#12a480" stroke="#7ff8cf" strokeWidth="1" />
    <circle cx="20" cy="36" r="2" fill="#12a480" />
  </svg>
);

/** Huy hiệu Logo Videcomp-rag trong khung bo tròn với viền ngọc lục bảo */
export const VidecompBadge = ({ size = 28 }: { size?: number }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      background: "radial-gradient(circle at 35% 35%, #202020 0%, #131313 100%)",
      border: "1px solid rgba(97, 219, 180, 0.3)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      boxShadow: "0 0 16px rgba(97, 219, 180, 0.2)",
    }}
  >
    <VidecompLogo size={Math.round(size * 0.72)} />
  </div>
);

/** Biểu tượng lớn phát sáng (Emblem) ở trung tâm trang chủ */
export const VidecompEmblem = ({ size = 72 }: { size?: number }) => (
  <div className="relative flex items-center justify-center group">
    <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl scale-125 opacity-70 group-hover:scale-150 transition-transform duration-700 ease-out pointer-events-none" />
    <div
      style={{ width: size, height: size }}
      className="relative rounded-full bg-surface-container border border-primary/30 flex items-center justify-center shadow-2xl transition-transform duration-300 group-hover:scale-105"
    >
      <VidecompLogo size={Math.round(size * 0.68)} />
    </div>
  </div>
);

/** Tương thích ngược: Alias cho IconChatGPT và IconChatGPTBadge */
export const IconChatGPT = ({ size = 24, className = "" }: { size?: number; className?: string }) => (
  <VidecompLogo size={size} className={className} />
);

export const IconChatGPTBadge = ({ size = 28 }: { size?: number }) => (
  <VidecompBadge size={size} />
);

export const IconSend = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 19V5" />
    <path d="M5 12l7-7 7 7" />
  </svg>
);

export const IconPlus = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconEditSquare = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

export const IconSidebarCollapse = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <line x1="9" y1="3" x2="9" y2="21" />
    <path d="M15 15l-3-3 3-3" />
  </svg>
);

export const IconSidebarExpand = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <line x1="9" y1="3" x2="9" y2="21" />
    <path d="M13 9l3 3-3 3" />
  </svg>
);

export const IconSearch = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </svg>
);

export const IconHistory = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3 3v5h5" />
    <path d="M3.05 13a9 9 0 1 0 2-5.9L3 8" />
    <path d="M12 7v5l4 2" />
  </svg>
);

export const IconBeaker = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M9 3h6" />
    <path d="M10 3v6.5L4.5 19a1.6 1.6 0 0 0 1.4 2.4h12.2a1.6 1.6 0 0 0 1.4-2.4L14 9.5V3" />
    <path d="M7.5 15h9" />
  </svg>
);

export const IconCopy = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
  </svg>
);

export const IconRegenerate = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" />
    <path d="M3 21v-5h5" />
  </svg>
);

export const IconThumbUp = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M7 10v11" />
    <path d="M11 21h6.6a2 2 0 0 0 2-1.7l1.2-7A2 2 0 0 0 18.8 10H14l1-5.4A1.6 1.6 0 0 0 13.4 3L7 10v11h4z" />
  </svg>
);

export const IconThumbDown = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M17 14V3" />
    <path d="M13 3H6.4a2 2 0 0 0-2 1.7l-1.2 7A2 2 0 0 0 5.2 14H10l-1 5.4A1.6 1.6 0 0 0 10.6 21L17 14V3h-4z" />
  </svg>
);

export const IconChevronRight = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);

export const IconChevronDown = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export const IconChevronUp = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M18 15l-6-6-6 6" />
  </svg>
);

export const IconTrace = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="6" cy="6" r="2.4" />
    <circle cx="18" cy="18" r="2.4" />
    <circle cx="6" cy="18" r="2.4" />
    <path d="M8 7l8 9M8 17l4-4" />
  </svg>
);

export const IconSettings = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);

export const IconClose = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

export const IconShare = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);

export const IconCompass = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="10" />
    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
  </svg>
);

export const IconSparkles = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 2l2.4 5.6L20 10l-5.6 2.4L12 18l-2.4-5.6L4 10l5.6-2.4L12 2z" />
    <path d="M19 16l1.2 2.8L23 20l-2.8 1.2L19 24l-1.2-2.8L15 20l2.8-1.2L19 16z" />
  </svg>
);

export const IconUser = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

export const IconMicrophone = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="22" />
  </svg>
);

export const IconPaperclip = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
);

export const IconGlobeSearch = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

export const IconBrainReasoning = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M9.5 2A4.5 4.5 0 0 0 5 6.5c0 .64.13 1.25.37 1.8A4.5 4.5 0 0 0 2 12.5 4.5 4.5 0 0 0 6.5 17c.17 0 .34-.01.5-.03A4.5 4.5 0 0 0 11.5 21a4.5 4.5 0 0 0 4.5-4.5" />
    <path d="M14.5 2A4.5 4.5 0 0 1 19 6.5c0 .64-.13 1.25-.37 1.8A4.5 4.5 0 0 1 22 12.5 4.5 4.5 0 0 1 17.5 17c-.17 0-.34-.01-.5-.03A4.5 4.5 0 0 1 12.5 21" />
  </svg>
);

export const IconMoreHorizontal = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="19" cy="12" r="1.5" />
    <circle cx="5" cy="12" r="1.5" />
  </svg>
);

export const IconCheck = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export const IconTrash = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

export const IconEdit = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </svg>
);

export const IconMessageSquare = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

export const IconCode = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
);

export const IconLightbulb = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M9 18h6" />
    <path d="M10 22h4" />
    <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5.76.76 1.23 1.52 1.41 2.5" />
  </svg>
);

export const IconFileText = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);
