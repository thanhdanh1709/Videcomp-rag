import { useState } from "react";
import { VidecompEmblem } from "./Icons";

interface SuggestionCard {
  id: string;
  category: "all" | "legal" | "medical" | "code" | "research";
  title: string;
  desc: string;
  iconName: string;
  prompt: string;
}

const SAMPLE_CARDS: SuggestionCard[] = [
  {
    id: "c1",
    category: "legal",
    title: "Tai nạn giao thông & Hình sự",
    desc: "Gây tai nạn giao thông làm chết người thì bị xử lý theo Bộ luật Hình sự ra sao?",
    iconName: "gavel",
    prompt: "Gây tai nạn giao thông làm chết người thì bị xử lý theo Bộ luật Hình sự như thế nào?",
  },
  {
    id: "c2",
    category: "legal",
    title: "Chấm dứt hợp đồng lao động",
    desc: "Đơn phương chấm dứt HĐLĐ trái pháp luật phải bồi thường theo nguyên tắc nào?",
    iconName: "article",
    prompt:
      "Người lao động đơn phương chấm dứt hợp đồng lao động trái pháp luật phải bồi thường theo nguyên tắc nào của Bộ luật Dân sự?",
  },
  {
    id: "c3",
    category: "medical",
    title: "Cấp cứu sốc phản vệ",
    desc: "Triệu chứng cảnh báo sốc phản vệ và phác đồ xử trí theo Thông tư 51/2017/TT-BYT",
    iconName: "medical_services",
    prompt:
      "Triệu chứng cảnh báo sốc phản vệ và phác đồ xử trí cấp cứu ban đầu theo Thông tư 51/2017/TT-BYT?",
  },
  {
    id: "c4",
    category: "research",
    title: "Xử phạt ô nhiễm môi trường",
    desc: "Xả thải vượt quy chuẩn bị xử phạt hành chính theo Nghị định 45/2022 như thế nào?",
    iconName: "biotech",
    prompt:
      "Xả thải gây ô nhiễm môi trường vượt quy chuẩn thì bị xử phạt hành chính ở mức nào theo Nghị định 45/2022?",
  },
  {
    id: "c5",
    category: "code",
    title: "Tối ưu hóa thuật toán & RAG",
    desc: "Giải thích cơ chế phân rã câu hỏi multi-hop và tích hợp vector embedding tối ưu",
    iconName: "code",
    prompt:
      "Giải thích cơ chế phân rã câu hỏi multi-hop trong kiến trúc ViDecomp-RAG và cách tính toán độ tương đồng cosine?",
  },
  {
    id: "c6",
    category: "legal",
    title: "Điều kiện chuyển nhượng đất",
    desc: "Doanh nghiệp chuyển nhượng quyền sử dụng đất theo Luật Đất đai 2024",
    iconName: "account_balance",
    prompt:
      "Doanh nghiệp muốn chuyển nhượng quyền sử dụng đất cần đáp ứng điều kiện gì theo Luật Đất đai 2024?",
  },
];

export function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const displayedCards =
    activeCategory === "all"
      ? SAMPLE_CARDS.slice(0, 4)
      : SAMPLE_CARDS.filter((c) => c.category === activeCategory).slice(0, 4);

  return (
    <div className="relative w-full flex-1 flex flex-col items-center justify-start">
      {/* Vùng phát sáng Ambient Glow nền */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] bg-primary/10 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="absolute top-2/3 right-1/4 w-[320px] h-[320px] bg-primary-container/10 rounded-full blur-[120px] pointer-events-none -z-10" />

      <div className="max-w-4xl w-full mx-auto px-unit-md flex flex-col items-center my-auto pt-2 pb-6">
        {/* Logo trung tâm phát sáng - Kích thước chuẩn tinh gọn không bị che */}
        <div className="mb-2 shrink-0">
          <VidecompEmblem size={58} />
        </div>

        {/* Tiêu đề & Nhãn mô hình */}
        <div className="text-center max-w-2xl mx-auto space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-surface-container-high/80 backdrop-blur-md mb-1 shadow-sm border border-outline-variant/30">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="font-label-sm text-[12px] text-on-surface-variant font-medium tracking-wide">
              Hệ thống hỏi đáp đa bước &amp; kiểm chứng tri thức Videcomp-rag
            </span>
          </div>

          <h1 className="text-[26px] sm:text-[32px] sm:leading-[38px] tracking-tight font-bold text-on-surface">
            Hôm nay tôi có thể giúp gì cho bạn?
          </h1>

          <p className="font-body-sm text-[13px] text-outline max-w-lg mx-auto line-clamp-2">
            Hỏi đáp thông minh, phân tích tài liệu pháp luật và y tế tiếng Việt, tự động phân rã câu
            hỏi phức tạp và trích dẫn chuẩn xác từ văn bản gốc.
          </p>
        </div>

        {/* Hàng nút phân loại chủ đề (Pill Filters) */}
        <div className="w-full max-w-3xl mt-3">
          <div className="flex items-center justify-center flex-wrap gap-1.5 mb-3 select-none">
            {[
              { id: "all", label: "Tất cả", icon: "apps" },
              { id: "legal", label: "Pháp luật", icon: "gavel" },
              { id: "medical", label: "Y tế", icon: "medical_services" },
              { id: "research", label: "Đa bước (Multi-hop)", icon: "account_tree" },
              { id: "code", label: "Thuật toán & RAG", icon: "terminal" },
            ].map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-label-sm text-[12px] font-medium transition-all shadow-sm ${
                    isActive
                      ? "bg-surface-container-highest text-on-surface border border-primary/40 font-semibold"
                      : "bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface border border-outline-variant/20"
                  }`}
                >
                  <span
                    className={`material-symbols-outlined text-[15px] ${
                      isActive ? "text-primary" : ""
                    }`}
                  >
                    {cat.icon}
                  </span>
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Lưới 4 Thẻ Gợi Ý Câu Hỏi Nhanh (Prompt Cards) - Kích thước tối ưu gọn gàng */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {displayedCards.map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={() => onPick(card.prompt)}
                className="group text-left p-3 rounded-xl bg-surface-container-low hover:bg-surface-container border border-outline-variant/30 hover:border-primary/40 transition-all duration-200 flex flex-col justify-between min-h-[72px] sm:min-h-[76px] shadow-sm relative overflow-hidden"
              >
                <div className="flex items-start justify-between gap-2 w-full">
                  <span className="font-headline-sm text-[14px] text-on-surface group-hover:text-primary transition-colors font-semibold truncate flex-1">
                    {card.title}
                  </span>
                  <div className="w-6 h-6 rounded-full bg-surface-container-highest group-hover:bg-primary/20 flex items-center justify-center transition-colors flex-shrink-0">
                    <span className="material-symbols-outlined text-[15px] text-primary">
                      {card.iconName}
                    </span>
                  </div>
                </div>
                <p className="font-body-sm text-[12px] text-on-surface-variant line-clamp-1 mt-1">
                  {card.desc}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
