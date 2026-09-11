import { useState } from "react";
import type { CustomAgent } from "../types/agent";

interface ExpertCard {
  id: string;
  name: string;
  author: string;
  desc: string;
  rating: number;
  usageCount: string;
  icon: string;
  category: "all" | "legal" | "medical" | "code" | "productivity";
  prompt: string;
}

const DEFAULT_EXPERTS: ExpertCard[] = [
  {
    id: "exp-1",
    name: "Cố vấn Pháp luật Doanh nghiệp",
    author: "Bởi videcomp-rag.vn",
    desc: "Tra cứu Luật Doanh nghiệp 2020, thủ tục thành lập, sáp nhập, giải thể và soạn thảo điều lệ chuẩn.",
    rating: 4.9,
    usageCount: "120K+",
    icon: "gavel",
    category: "legal",
    prompt: "Tư vấn điều kiện chuyển nhượng cổ phần cho nhà đầu tư nước ngoài theo Luật Doanh nghiệp?",
  },
  {
    id: "exp-2",
    name: "Trợ lý Phác đồ Lâm sàng",
    author: "Bởi Hội đồng Y khoa",
    desc: "Tra cứu hướng dẫn chẩn đoán và điều trị của Bộ Y tế, tương tác thuốc và liều lượng dược lâm sàng.",
    rating: 4.95,
    usageCount: "95K+",
    icon: "medical_services",
    category: "medical",
    prompt: "Phác đồ xử trí ban đầu và liều Adrenaline tiêm bắp trong cấp cứu sốc phản vệ theo Bộ Y tế?",
  },
  {
    id: "exp-3",
    name: "Chuyên gia Hợp đồng & Lao động",
    author: "Bởi Ban Pháp chế",
    desc: "Soát xét rủi ro điều khoản HĐLĐ, bồi thường thiệt hại đơn phương chấm dứt và thỏa ước tập thể.",
    rating: 4.88,
    usageCount: "78K+",
    icon: "assignment",
    category: "legal",
    prompt: "Các căn cứ người sử dụng lao động được đơn phương chấm dứt HĐLĐ theo Bộ luật Lao động 2019?",
  },
  {
    id: "exp-4",
    name: "Tối ưu hóa Code & Kiến trúc RAG",
    author: "Bởi AI Lab",
    desc: "Phân tích thuật toán decomposition multi-hop, FAISS vector indexing và BGE cross-encoder.",
    rating: 4.92,
    usageCount: "150K+",
    icon: "terminal",
    category: "code",
    prompt: "So sánh hiệu năng giữa Dense Retrieval đơn thuần và Hybrid BM25 + Vector + Reranking?",
  },
  {
    id: "exp-5",
    name: "Trợ lý Nghiên cứu & Dịch thuật",
    author: "Bởi Đội ngũ Học thuật",
    desc: "Dịch thuật song ngữ Anh-Việt học thuật, trích xuất cấu trúc IMRAD và định dạng chuẩn APA 7th.",
    rating: 4.89,
    usageCount: "64K+",
    icon: "school",
    category: "productivity",
    prompt: "Tóm tắt bài báo khoa học và đối chiếu thuật ngữ chuyên ngành luật sang tiếng Anh?",
  },
  {
    id: "exp-6",
    name: "Tư vấn Luật Đất đai & Bất động sản",
    author: "Bởi Chuyên gia Địa chính",
    desc: "Quy định bồi thường, tái định cư, cấp sổ đỏ và giao dịch đất đai theo Luật Đất đai 2024 mới nhất.",
    rating: 4.94,
    usageCount: "82K+",
    icon: "apartment",
    category: "legal",
    prompt: "Các trường hợp được nhà nước bồi thường về đất khi thu hồi đất theo Luật Đất đai 2024?",
  },
];

export function ExploreView({
  customAgents = [],
  onSelectPrompt,
  onSelectAgent,
  onOpenBuilder,
  onEditAgent,
  onDeleteAgent,
}: {
  customAgents?: CustomAgent[];
  onSelectPrompt: (p: string) => void;
  onSelectAgent?: (agent: CustomAgent) => void;
  onOpenBuilder: () => void;
  onEditAgent?: (agent: CustomAgent) => void;
  onDeleteAgent?: (id: string) => void;
}) {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filteredDefaults = DEFAULT_EXPERTS.filter((e) => {
    const matchesCategory = activeCategory === "all" || e.category === activeCategory;
    const matchesSearch =
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.desc.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const filteredCustoms = customAgents.filter((a) => {
    const matchesCategory = activeCategory === "all" || a.category === activeCategory;
    const matchesSearch =
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.desc.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="flex-1 overflow-y-auto pt-16 pb-24 px-unit-lg lg:px-unit-2xl scrollbar-none bg-surface">
      {/* Glow aura */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[820px] h-[360px] bg-primary/10 rounded-full blur-[120px] -z-10" />

      <div className="w-full max-w-7xl mx-auto flex flex-col gap-unit-2xl">
        {/* Header Hero Area */}
        <section className="flex flex-col gap-unit-lg">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-unit-md">
            <div className="flex flex-col gap-unit-2xs">
              <div className="flex items-center gap-unit-xs">
                <span className="font-label-sm text-[11px] text-primary uppercase tracking-widest font-semibold px-unit-xs py-0.5 rounded-full bg-surface-container-high border border-outline-variant/30">
                  Videcomp Store
                </span>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary" />
                <span className="font-label-sm text-[12px] text-on-surface-variant">
                  Cập nhật mô hình hàng ngày
                </span>
              </div>
              <h1 className="font-display-lg text-display-lg text-on-surface font-bold tracking-tight">
                Khám phá Chuyên gia &amp; Mô hình
              </h1>
              <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
                Tìm kiếm và sử dụng các chuyên gia Videcomp-rag chuyên sâu kết hợp phác đồ y tế, điều
                luật hiện hành và kỹ năng lập trình tối ưu.
              </p>
            </div>

            <button
              type="button"
              onClick={onOpenBuilder}
              className="group flex items-center gap-unit-xs px-unit-lg py-2.5 rounded-full bg-primary hover:opacity-90 text-on-primary transition-all duration-200 hover:scale-[1.02] shadow-sm self-start md:self-auto shrink-0"
            >
              <span className="material-symbols-outlined text-[20px] transition-transform group-hover:rotate-90 duration-300">
                add
              </span>
              <span className="font-label-md text-label-md font-bold">Tạo Chuyên gia mới (GPT Builder)</span>
            </button>
          </div>

          {/* Search Pill */}
          <div className="relative w-full max-w-3xl mt-unit-xs">
            <div className="flex items-center w-full px-unit-lg py-2.5 rounded-full bg-surface-container-high border border-outline-variant/30 focus-within:border-primary/50 shadow-md transition-colors">
              <span className="material-symbols-outlined text-outline text-[22px] mr-unit-sm">
                search
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm kiếm chuyên gia pháp luật, y khoa, thuật toán hoặc tác giả..."
                className="w-full bg-transparent border-0 outline-none text-on-surface placeholder:text-outline font-body-md text-body-md"
              />
              <span className="hidden sm:inline-flex items-center font-label-sm text-[11px] text-outline px-unit-xs py-0.5 rounded-full bg-surface-container-lowest">
                ⌘K
              </span>
            </div>
          </div>
        </section>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
          {[
            { id: "all", label: "Tất cả chuyên gia" },
            { id: "legal", label: "⚖️ Pháp luật Việt Nam" },
            { id: "medical", label: "🩺 Y học & Lâm sàng" },
            { id: "code", label: "💻 Lập trình & RAG" },
            { id: "productivity", label: "⚡ Nghiên cứu & Hiệu suất" },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`px-unit-lg py-2 rounded-full font-label-md text-label-md shrink-0 transition-all border ${
                activeCategory === cat.id
                  ? "bg-surface-container-highest text-on-surface font-semibold border-primary/40 shadow-sm"
                  : "bg-surface-container text-on-surface-variant hover:text-on-surface border-outline-variant/20"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* MỤC 3: PHẦN CHUYÊN GIA TÙY CHỈNH CỦA NGƯỜI DÙNG */}
        {filteredCustoms.length > 0 && (
          <section className="flex flex-col gap-unit-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">auto_fix_high</span>
                <h2 className="font-headline-md text-headline-md text-on-surface font-semibold tracking-tight">
                  Chuyên gia của bạn ({filteredCustoms.length})
                </h2>
              </div>
              <span className="text-label-sm text-primary font-medium">Tùy biến bởi bạn</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-unit-md">
              {filteredCustoms.map((agent) => (
                <div
                  key={agent.id}
                  onClick={() => onSelectAgent?.(agent)}
                  className="group relative flex flex-col justify-between p-unit-lg rounded-xl bg-surface-container-low hover:bg-surface-container border border-primary/30 hover:border-primary transition-all duration-300 shadow-sm hover:shadow-xl hover:-translate-y-0.5 cursor-pointer overflow-hidden"
                >
                  <div className="flex flex-col gap-unit-md">
                    <div className="flex items-start justify-between">
                      <div className="w-12 h-12 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-primary shadow-inner">
                        <span className="material-symbols-outlined text-[24px]">{agent.icon}</span>
                      </div>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => onEditAgent?.(agent)}
                          className="p-1.5 rounded-full hover:bg-surface-container-highest text-outline hover:text-primary transition-colors"
                          title="Chỉnh sửa trong GPT Builder"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteAgent?.(agent.id)}
                          className="p-1.5 rounded-full hover:bg-surface-container-highest text-outline hover:text-error transition-colors"
                          title="Xóa chuyên gia này"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <h3 className="font-headline-sm text-[17px] text-on-surface font-bold group-hover:text-primary transition-colors truncate">
                        {agent.name}
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className="font-label-sm text-[11px] text-primary px-2 py-0.5 rounded-full bg-primary/10">
                          {agent.domain === "legal" ? "Pháp luật" : "Y tế"}
                        </span>
                        <span className="font-label-sm text-[12px] text-outline">{agent.author}</span>
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2 mt-1">
                        {agent.desc}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-unit-md mt-unit-md border-t border-outline-variant/20 text-outline font-label-sm text-[12px]">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px] text-primary">description</span>
                      {agent.knowledgeFiles?.length || 0} tệp kiến thức
                    </span>
                    <span className="flex items-center gap-1 text-primary font-semibold group-hover:translate-x-1 transition-transform">
                      <span>Trò chuyện</span>
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* DANH SÁCH CHUYÊN GIA MẶC ĐỊNH */}
        <section className="flex flex-col gap-unit-md">
          <div className="flex items-center justify-between">
            <h2 className="font-headline-md text-headline-md text-on-surface font-semibold tracking-tight">
              Nổi bật từ hệ thống
            </h2>
            <span className="text-label-sm text-outline">{filteredDefaults.length} chuyên gia sẵn sàng</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-unit-md">
            {filteredDefaults.map((exp) => (
              <div
                key={exp.id}
                onClick={() => onSelectPrompt(exp.prompt)}
                className="group relative flex flex-col justify-between p-unit-lg rounded-xl bg-surface-container-low hover:bg-surface-container border border-outline-variant/30 hover:border-primary/40 transition-all duration-300 shadow-sm hover:shadow-xl hover:-translate-y-0.5 cursor-pointer overflow-hidden"
              >
                <div className="flex flex-col gap-unit-md">
                  <div className="flex items-start justify-between">
                    <div className="w-12 h-12 rounded-full bg-surface-container-high border border-outline-variant/30 flex items-center justify-center text-primary shadow-inner">
                      <span className="material-symbols-outlined text-[24px]">{exp.icon}</span>
                    </div>
                    <span className="px-unit-xs py-0.5 rounded-full bg-primary-container/20 text-primary font-label-sm text-[12px] font-semibold flex items-center gap-1">
                      <span
                        className="material-symbols-outlined text-[14px]"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        star
                      </span>
                      {exp.rating}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1">
                    <h3 className="font-headline-sm text-[17px] text-on-surface font-bold group-hover:text-primary transition-colors">
                      {exp.name}
                    </h3>
                    <p className="font-label-sm text-[12px] text-outline">{exp.author}</p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2 mt-1">
                      {exp.desc}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-unit-md mt-unit-md border-t border-outline-variant/20 text-outline font-label-sm text-[12px]">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">trending_up</span>
                    {exp.usageCount} lượt dùng
                  </span>
                  <span className="material-symbols-outlined text-[18px] text-primary group-hover:translate-x-1 transition-transform">
                    arrow_forward
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
