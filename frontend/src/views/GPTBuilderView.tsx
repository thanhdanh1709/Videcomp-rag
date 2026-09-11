import { useState, useRef, useEffect } from "react";
import type { CustomAgent } from "../types/agent";
import type { Domain } from "../api/types";
import {
  askQuestion,
  uploadDocument,
  deleteSessionFile,
  fetchSessionFiles,
  loadIndex,
  ApiError,
  DEFAULT_INDEX_PATHS,
  INDEX_NOT_LOADED_DETAIL,
} from "../api/client";
import { ThinkingIndicator } from "../components/ThinkingIndicator";

const AVAILABLE_ICONS = [
  { id: "school", label: "Học thuật & Dịch thuật" },
  { id: "gavel", label: "Pháp luật & Tố tụng" },
  { id: "medical_services", label: "Y tế & Dược lâm sàng" },
  { id: "terminal", label: "Lập trình & Kỹ thuật" },
  { id: "psychology", label: "Tâm lý & Tư vấn" },
  { id: "apartment", label: "Bất động sản & Đất đai" },
  { id: "balance", label: "Pháp chế & Hợp đồng" },
  { id: "support_agent", label: "Chăm sóc & Hỗ trợ" },
  { id: "auto_stories", label: "Nghiên cứu & Sách" },
];

export function GPTBuilderView({
  initialAgent,
  onBack,
  onSaveAgent,
  onShowToast,
}: {
  initialAgent?: CustomAgent | null;
  onBack: () => void;
  onSaveAgent: (agent: CustomAgent) => void;
  onShowToast?: (msg: string) => void;
}) {
  const [tab, setTab] = useState<"create" | "configure">("configure");

  // State thông tin chuyên gia
  const [agentId] = useState(() => initialAgent?.id || "agent-" + crypto.randomUUID().slice(0, 8));
  const [name, setName] = useState(() => initialAgent?.name || "Trợ lý Nghiên cứu & Dịch thuật");
  const [desc, setDesc] = useState(
    () =>
      initialAgent?.desc ||
      "Chuyên gia dịch thuật học thuật, tóm tắt tài liệu PDF và trích dẫn khoa học chuẩn APA/IEEE."
  );
  const [domain, setDomain] = useState<Domain>(() => initialAgent?.domain || "legal");
  const [category, setCategory] = useState<"legal" | "medical" | "code" | "productivity">(
    () => initialAgent?.category || "productivity"
  );
  const [icon, setIcon] = useState(() => initialAgent?.icon || "school");
  const [instructions, setInstructions] = useState(
    () =>
      initialAgent?.instructions ||
      `Bạn là Trợ lý Nghiên cứu & Dịch thuật chuyên nghiệp của hệ thống Videcomp-rag. Nhiệm vụ trọng tâm:\n1. Dịch thuật song ngữ Anh-Việt và Việt-Anh với tính chính xác học thuật cao nhất.\n2. Phân rã câu hỏi đa bước và đối chiếu chuẩn xác với các tài liệu đính kèm.\n3. Định dạng danh mục tham khảo theo chuẩn APA 7th.`
  );
  const [starters, setStarters] = useState<string[]>(() =>
    initialAgent?.starters && initialAgent.starters.length > 0
      ? initialAgent.starters
      : [
          "Dịch tóm tắt đoạn văn này sang tiếng Anh học thuật...",
          "Kiểm tra lỗi ngữ pháp học thuật và văn phong...",
          "Trích dẫn tài liệu theo chuẩn APA 7th...",
          "Tóm tắt các phát hiện cốt lõi từ tài liệu...",
        ]
  );
  const [newStarter, setNewStarter] = useState("");

  // Kiến thức đính kèm
  const [knowledgeSessionId] = useState(
    () => initialAgent?.sessionId || `agent-session-${crypto.randomUUID().slice(0, 8)}`
  );
  const [knowledgeFiles, setKnowledgeFiles] = useState<
    { filename: string; size: number; chunk_count: number }[]
  >(() => initialAgent?.knowledgeFiles || []);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Playground state
  const [testInput, setTestInput] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [chatMessages, setChatMessages] = useState<{
    role: "user" | "assistant";
    text: string;
    citations?: any[];
  }[]>([
    {
      role: "assistant",
      text: `Xin chào! Tôi là **${name}**. Bạn có thể đặt câu hỏi hoặc gửi thử thách để thử nghiệm năng lực phản hồi của tôi trong sân chơi này!`,
    },
  ]);

  // Tab "Tạo" Prompt Generator state
  const [createPrompt, setCreatePrompt] = useState("");
  const [isGeneratingConfig, setIsGeneratingConfig] = useState(false);

  // Đồng bộ tệp kiến thức từ backend nếu đã có sessionId
  useEffect(() => {
    if (knowledgeFiles.length === 0 && knowledgeSessionId) {
      fetchSessionFiles(knowledgeSessionId)
        .then((res) => {
          if (res.files && res.files.length > 0) {
            setKnowledgeFiles(
              res.files.map((f: any) => ({
                filename: f.filename,
                size: f.size || 0,
                chunk_count: f.chunk_count || 0,
              }))
            );
          }
        })
        .catch(() => {});
    }
  }, [knowledgeSessionId]);

  // Tự động sinh cấu hình từ prompt người dùng trong tab Tạo
  const handleAutoGenerateConfig = () => {
    if (!createPrompt.trim()) return;
    setIsGeneratingConfig(true);

    setTimeout(() => {
      const p = createPrompt.toLowerCase();
      let genName = "Trợ lý Tùy chỉnh";
      let genDesc = "Chuyên gia hỗ trợ giải đáp và tra cứu dữ liệu chuyên sâu.";
      let genDomain: Domain = "legal";
      let genCat: "legal" | "medical" | "code" | "productivity" = "productivity";
      let genIcon = "school";
      let genStarters = [
        "Giải thích điều khoản quan trọng nhất...",
        "Tóm tắt các điểm cần lưu ý...",
        "Quy trình từng bước để thực hiện là gì?",
      ];

      if (p.includes("lao động") || p.includes("hợp đồng") || p.includes("pháp") || p.includes("luật")) {
        genDomain = "legal";
        genCat = "legal";
        genIcon = "gavel";
        genName = "Cố vấn Pháp lý & Hợp đồng";
        genDesc = "Tra cứu và phân tích các quy định pháp luật Việt Nam, rà soát điều khoản và chế tài bồi thường.";
        genStarters = [
          "Các căn cứ đơn phương chấm dứt hợp đồng hợp pháp?",
          "Quy định về thời hiệu xử lý kỷ luật lao động?",
          "Thủ tục bồi thường thiệt hại theo quy định mới?",
        ];
      } else if (p.includes("y tế") || p.includes("thuốc") || p.includes("bệnh") || p.includes("phản vệ") || p.includes("lâm sàng")) {
        genDomain = "medical";
        genCat = "medical";
        genIcon = "medical_services";
        genName = "Trợ lý Phác đồ & Dược lâm sàng";
        genDesc = "Tra cứu hướng dẫn điều trị Bộ Y tế, tương tác thuốc và liều dùng cấp cứu lâm sàng.";
        genStarters = [
          "Phác đồ xử trí cấp cứu sốc phản vệ độ 2 trở lên?",
          "Liều dùng và đường dùng Adrenaline ban đầu?",
          "Chống chỉ định phối hợp các nhóm kháng sinh thường gặp?",
        ];
      } else if (p.includes("đất") || p.includes("nhà đất") || p.includes("bất động sản")) {
        genDomain = "legal";
        genCat = "legal";
        genIcon = "apartment";
        genName = "Chuyên gia Luật Đất đai 2024";
        genDesc = "Tư vấn quy định bồi thường giải tỏa, cấp giấy chứng nhận và thủ tục chuyển nhượng quyền sử dụng đất.";
        genStarters = [
          "Các trường hợp thu hồi đất được bồi thường theo Luật 2024?",
          "Điều kiện để được cấp Giấy chứng nhận quyền sử dụng đất?",
          "Thời hạn và biểu mức bồi thường cây trồng trên đất thu hồi?",
        ];
      } else if (p.includes("code") || p.includes("rag") || p.includes("thuật toán")) {
        genDomain = "legal";
        genCat = "code";
        genIcon = "terminal";
        genName = "Kỹ sư Tối ưu RAG & Vector Index";
        genDesc = "Phân tích kiến trúc phân rã câu hỏi multi-hop, BM25 + FAISS và bộ lọc Cross-Encoder rerank.";
        genStarters = [
          "So sánh Dense Retrieval đơn thuần và Hybrid Search?",
          "Cách thiết lập Corrective RAG khi độ tin cậy thấp?",
          "Tối ưu chunking strategy cho tài liệu văn bản luật?",
        ];
      } else {
        genName = `Chuyên gia ${createPrompt.slice(0, 30)}...`;
      }

      const genInstructions = `Bạn là ${genName} trên nền tảng Videcomp-rag. Nhiệm vụ chính:
1. Trả lời chính xác, trích dẫn rõ ràng các căn cứ pháp lý / y văn hoặc dữ liệu tài liệu đính kèm.
2. Khi câu hỏi phức tạp, hãy phân rã thành các khía cạnh rõ ràng, trả lời mạch lạc theo từng bước.
3. Luôn giữ văn phong chuyên nghiệp, khách quan và đáng tin cậy.`;

      setName(genName);
      setDesc(genDesc);
      setDomain(genDomain);
      setCategory(genCat);
      setIcon(genIcon);
      setInstructions(genInstructions);
      setStarters(genStarters);

      setIsGeneratingConfig(false);
      setTab("configure");
      onShowToast?.("Đã tự động khởi tạo cấu hình từ ý tưởng của bạn!");
    }, 600);
  };

  // Tải lên tệp kiến thức thật vào Backend RAG
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const res = await uploadDocument(file, knowledgeSessionId);
      setKnowledgeFiles((prev) => [
        ...prev.filter((f) => f.filename !== file.name),
        { filename: file.name, size: file.size, chunk_count: res.chunk_count },
      ]);
      onShowToast?.(`Đã tải lên tệp kiến thức: ${file.name} (${res.chunk_count} đoạn trích)`);
    } catch (err: any) {
      onShowToast?.("Lỗi tải tệp: " + (err.message || "Không thể tải"));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Xóa tệp kiến thức
  const handleRemoveFile = async (filename: string) => {
    try {
      await deleteSessionFile(knowledgeSessionId, filename);
      setKnowledgeFiles((prev) => prev.filter((f) => f.filename !== filename));
      onShowToast?.(`Đã xóa tệp: ${filename}`);
    } catch {
      setKnowledgeFiles((prev) => prev.filter((f) => f.filename !== filename));
    }
  };

  // Gửi câu hỏi thử nghiệm trong Playground với RAG backend thật!
  const handleSendTest = async (overridePrompt?: string) => {
    const q = (overridePrompt || testInput).trim();
    if (!q || isTesting) return;

    setTestInput("");
    setChatMessages((prev) => [...prev, { role: "user", text: q }]);
    setIsTesting(true);

    try {
      // Gọi RAG backend kèm theo session_id của Agent (chứa các file kiến thức vừa upload)
      const askOnce = () =>
        askQuestion({
          question: q,
          domain: domain,
          mode: "videcomp_full",
          top_k: 8,
          rerank_top_k: 5,
          max_corrective_rounds: 1,
          session_id: knowledgeSessionId,
        });

      let res;
      try {
        res = await askOnce();
      } catch (err) {
        const isIndexNotLoaded = err instanceof ApiError && err.message === INDEX_NOT_LOADED_DETAIL;
        const defaultPaths = DEFAULT_INDEX_PATHS[domain];
        if (isIndexNotLoaded && defaultPaths) {
          await loadIndex(domain, defaultPaths.bm25Dir, defaultPaths.vectorDir);
          res = await askOnce();
        } else {
          throw err;
        }
      }

      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: res.final_answer,
          citations: res.citations || [],
        },
      ]);
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `[Lỗi phản hồi]: Không thể hoàn thành truy vấn (${err.message || "Lỗi kết nối RAG server"}).`,
        },
      ]);
    } finally {
      setIsTesting(false);
    }
  };

  const handleAddStarter = () => {
    if (!newStarter.trim()) return;
    setStarters((prev) => [...prev, newStarter.trim()]);
    setNewStarter("");
  };

  const handleSaveAndPublish = () => {
    if (!name.trim()) {
      onShowToast?.("Vui lòng nhập tên cho chuyên gia!");
      return;
    }

    const agent: CustomAgent = {
      id: agentId,
      name: name.trim(),
      desc: desc.trim(),
      author: "Bởi bạn",
      domain,
      category,
      instructions,
      starters,
      icon,
      sessionId: knowledgeSessionId,
      knowledgeFiles,
      createdAt: initialAgent?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSaveAgent(agent);
    onShowToast?.(`Đã xuất bản Chuyên gia "${name}" vào Videcomp Store!`);
    onBack();
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-surface pt-14">
      {/* Top Action Bar */}
      <div className="h-12 bg-surface-container-low border-b border-outline-variant/30 px-unit-lg flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-unit-sm">
          <button
            type="button"
            onClick={onBack}
            className="p-1 rounded-full hover:bg-surface-container text-outline hover:text-on-surface transition-colors"
            title="Quay lại Store"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-on-surface text-label-md truncate max-w-xs">{name}</span>
            <span className="text-[11px] text-primary px-2 py-0.5 rounded-full bg-primary-container/20 font-semibold border border-primary/30">
              {initialAgent ? "Đang chỉnh sửa" : "Bản tạo mới"}
            </span>
            <span className="text-[11px] text-outline hidden sm:inline">• Lưu tự động vào hệ thống</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="px-unit-md py-1 rounded-full text-label-sm text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSaveAndPublish}
            className="flex items-center gap-1.5 px-unit-lg py-1.5 rounded-full bg-primary text-on-primary text-label-sm font-bold hover:opacity-90 transition-all shadow-sm active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">publish</span>
            <span>Lưu &amp; Xuất bản</span>
          </button>
        </div>
      </div>

      {/* Split Panel Architecture */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 overflow-hidden">
        {/* Cột trái: Cấu hình Chuyên gia */}
        <div className="overflow-y-auto p-unit-lg md:p-unit-xl border-r border-outline-variant/30 space-y-unit-lg scrollbar-none bg-surface-container-low/40">
          {/* Tabs Tạo / Định cấu hình */}
          <div className="inline-flex p-1 rounded-full bg-surface-container border border-outline-variant/30">
            <button
              type="button"
              onClick={() => setTab("create")}
              className={`px-unit-lg py-1.5 rounded-full text-label-md font-semibold transition-all ${
                tab === "create"
                  ? "bg-surface-container-highest text-on-surface shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Tạo bằng AI (Create)
            </button>
            <button
              type="button"
              onClick={() => setTab("configure")}
              className={`px-unit-lg py-1.5 rounded-full text-label-md font-semibold transition-all ${
                tab === "configure"
                  ? "bg-surface-container-highest text-on-surface shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Định cấu hình
            </button>
          </div>

          {/* Tab Tạo (Conversational AI generator) */}
          {tab === "create" && (
            <div className="p-unit-lg rounded-xl bg-surface-container border border-outline-variant/30 space-y-unit-md animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[24px]">auto_awesome</span>
                <h3 className="font-headline-sm text-[16px] font-bold text-on-surface">
                  Khởi tạo nhanh Chuyên gia từ mô tả tự nhiên
                </h3>
              </div>
              <p className="text-body-sm text-[13px] text-on-surface-variant">
                Nhập vai trò bạn mong muốn, hệ thống sẽ tự động đề xuất tên gọi, lĩnh vực, chỉ dẫn hệ thống và các gợi ý mở đầu hội thoại phù hợp nhất.
              </p>

              <textarea
                rows={3}
                value={createPrompt}
                onChange={(e) => setCreatePrompt(e.target.value)}
                placeholder="Ví dụ: Tôi muốn tạo một chuyên gia chuyên tư vấn về giải quyết tranh chấp đất đai và bồi thường tái định cư..."
                className="w-full bg-surface-container-high px-unit-md py-2.5 rounded-DEFAULT text-on-surface text-label-md outline-none border border-outline-variant/30 focus:border-primary placeholder:text-outline"
              />

              <button
                type="button"
                onClick={handleAutoGenerateConfig}
                disabled={!createPrompt.trim() || isGeneratingConfig}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-full bg-primary text-on-primary font-label-md font-bold hover:opacity-90 transition-all disabled:opacity-40"
              >
                {isGeneratingConfig ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                    <span>Đang khởi tạo cấu hình chuyên gia...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">magic_button</span>
                    <span>Sinh cấu hình tự động &amp; Chuyển sang chỉnh sửa</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Avatar Icon & Header */}
          <div className="flex items-center gap-unit-md">
            <div className="w-16 h-16 rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center text-primary shadow-md shrink-0">
              <span className="material-symbols-outlined text-[32px]">{icon}</span>
            </div>
            <div>
              <div className="text-[11px] text-primary uppercase tracking-widest font-semibold">
                {domain === "legal" ? "Pháp luật Việt Nam" : "Y tế & Lâm sàng"}
              </div>
              <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                {name || "Chuyên gia mới"}
              </h3>
              <p className="text-body-sm text-[13px] text-on-surface-variant line-clamp-1">
                {desc || "Chưa có mô tả ngắn"}
              </p>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            {/* Chọn Biểu tượng Icon */}
            <div>
              <label className="block text-[12px] font-semibold text-outline uppercase tracking-wider mb-2">
                Biểu tượng đại diện
              </label>
              <div className="grid grid-cols-5 gap-2">
                {AVAILABLE_ICONS.map((ic) => (
                  <button
                    key={ic.id}
                    type="button"
                    onClick={() => setIcon(ic.id)}
                    className={`flex flex-col items-center p-2 rounded-lg border transition-all ${
                      icon === ic.id
                        ? "bg-primary/20 border-primary text-primary shadow-sm"
                        : "bg-surface-container border-outline-variant/30 text-outline hover:text-on-surface"
                    }`}
                    title={ic.label}
                  >
                    <span className="material-symbols-outlined text-[24px]">{ic.id}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Lĩnh vực tri thức chính */}
            <div>
              <label className="block text-[12px] font-semibold text-outline uppercase tracking-wider mb-1">
                Lĩnh vực cơ sở tri thức *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDomain("legal");
                    setCategory("legal");
                  }}
                  className={`flex items-center gap-2 p-2.5 rounded-DEFAULT border text-label-md font-semibold transition-all ${
                    domain === "legal"
                      ? "bg-primary/20 border-primary text-primary"
                      : "bg-surface-container border-outline-variant/30 text-outline hover:text-on-surface"
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">gavel</span>
                  <span>Pháp luật Việt Nam</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDomain("medical");
                    setCategory("medical");
                  }}
                  className={`flex items-center gap-2 p-2.5 rounded-DEFAULT border text-label-md font-semibold transition-all ${
                    domain === "medical"
                      ? "bg-primary/20 border-primary text-primary"
                      : "bg-surface-container border-outline-variant/30 text-outline hover:text-on-surface"
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">medical_services</span>
                  <span>Y tế &amp; Lâm sàng</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-outline uppercase tracking-wider mb-1">
                Tên chuyên gia *
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ví dụ: Cố vấn Hợp đồng Doanh nghiệp..."
                className="w-full bg-surface-container px-unit-md py-2.5 rounded-DEFAULT text-on-surface text-label-md outline-none border border-outline-variant/30 focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-outline uppercase tracking-wider mb-1">
                Mô tả ngắn
              </label>
              <input
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Tóm tắt ngắn gọn năng lực của chuyên gia..."
                className="w-full bg-surface-container px-unit-md py-2.5 rounded-DEFAULT text-on-surface text-label-md outline-none border border-outline-variant/30 focus:border-primary"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-[12px] font-semibold text-outline uppercase tracking-wider">
                  Hướng dẫn chi tiết (Instructions)
                </label>
                <span className="text-[11px] text-outline font-mono">{instructions.length} ký tự</span>
              </div>
              <textarea
                rows={5}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Quy định văn phong, cấu trúc câu trả lời và trọng tâm kiến thức..."
                className="w-full bg-surface-container p-unit-md rounded-DEFAULT text-on-surface text-[14px] outline-none border border-outline-variant/30 focus:border-primary leading-relaxed font-mono"
              />
            </div>

            {/* Conversation Starters */}
            <div>
              <label className="block text-[12px] font-semibold text-outline uppercase tracking-wider mb-2">
                Gợi ý mở đầu trò chuyện (Starters)
              </label>
              <div className="space-y-2">
                {starters.map((s, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-unit-md py-2 rounded-DEFAULT bg-surface-container border border-outline-variant/20 text-body-sm text-on-surface"
                  >
                    <span className="truncate">{s}</span>
                    <button
                      type="button"
                      onClick={() => setStarters((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-outline hover:text-error ml-2"
                      title="Xóa gợi ý"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </div>
                ))}

                <div className="flex gap-2">
                  <input
                    value={newStarter}
                    onChange={(e) => setNewStarter(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddStarter();
                      }
                    }}
                    placeholder="Thêm câu mở đầu mới..."
                    className="flex-1 bg-surface-container px-unit-md py-2 rounded-DEFAULT text-on-surface text-label-sm outline-none border border-outline-variant/30 focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={handleAddStarter}
                    className="px-unit-md py-2 rounded-DEFAULT bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-label-sm font-semibold transition-colors"
                  >
                    Thêm
                  </button>
                </div>
              </div>
            </div>

            {/* Knowledge Files */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-[12px] font-semibold text-outline uppercase tracking-wider">
                  Tệp tri thức đính kèm (Knowledge)
                </label>
                <span className="text-[11px] text-outline">
                  {knowledgeFiles.length} tệp đã nạp vào bộ nhớ RAG
                </span>
              </div>

              {/* Danh sách tệp đã tải */}
              <div className="space-y-2 mb-2">
                {knowledgeFiles.map((f, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-unit-sm px-unit-md rounded-DEFAULT bg-surface-container border border-outline-variant/30"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="material-symbols-outlined text-primary text-[20px] shrink-0">
                        description
                      </span>
                      <div className="truncate">
                        <div className="font-semibold text-on-surface text-label-sm truncate">
                          {f.filename}
                        </div>
                        <div className="text-[11px] text-outline">
                          {(f.size / 1024).toFixed(1)} KB • {f.chunk_count} đoạn trích ngữ nghĩa
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(f.filename)}
                      className="text-outline hover:text-error p-1 rounded transition-colors"
                      title="Xóa tệp kiến thức"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                ))}
              </div>

              {/* Nút Upload tệp mới */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-DEFAULT bg-surface-container border border-dashed border-outline-variant/50 hover:border-primary/60 text-outline hover:text-on-surface text-label-sm transition-all"
              >
                {isUploading ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                    <span>Đang nạp và phân rã văn bản...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px] text-primary">upload_file</span>
                    <span>Tải lên tệp kiến thức (.pdf, .docx, .txt, .md)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Cột phải: Sân chơi thử nghiệm Preview Playground */}
        <div className="flex flex-col h-full bg-surface relative overflow-hidden">
          {/* Playground Header */}
          <div className="flex items-center justify-between px-unit-lg py-2.5 border-b border-outline-variant/30 bg-surface-container-low/60 shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-label-sm font-semibold text-on-surface">
                Sân chơi thử nghiệm (Preview Playground)
              </span>
              <span className="text-[11px] text-outline px-2 py-0.5 rounded-full bg-surface-container">
                Kết nối trực tiếp RAG Backend
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                setChatMessages([
                  {
                    role: "assistant",
                    text: `Đã làm mới phiên thử nghiệm! Hãy gửi câu hỏi bất kỳ để kiểm tra ${name}.`,
                  },
                ])
              }
              className="flex items-center gap-1 text-[12px] text-outline hover:text-on-surface transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">refresh</span>
              <span>Làm mới</span>
            </button>
          </div>

          {/* Playground Chat Stream */}
          <div className="flex-1 overflow-y-auto p-unit-lg space-y-unit-lg scrollbar-none">
            <div className="flex flex-col items-center justify-center text-center pt-unit-md pb-unit-sm">
              <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-primary mb-2 shadow-sm">
                <span className="material-symbols-outlined text-[28px]">{icon}</span>
              </div>
              <h2 className="font-headline-sm font-bold text-on-surface text-[18px]">{name}</h2>
              <p className="text-body-sm text-outline max-w-sm mt-1">{desc}</p>

              {/* Starters chips */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-unit-md w-full max-w-md">
                {starters.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendTest(s)}
                    className="p-unit-sm rounded-DEFAULT bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 text-left text-body-sm text-on-surface transition-all text-[13px] truncate"
                    title={s}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {chatMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${
                  msg.role === "user" ? "items-end" : "items-start"
                } gap-1`}
              >
                <div
                  className={`max-w-[85%] p-unit-md rounded-2xl text-[14px] leading-relaxed ${
                    msg.role === "user"
                      ? "bg-surface-container text-on-surface rounded-tr-sm border border-outline-variant/30"
                      : "bg-surface-container-high text-on-surface rounded-tl-sm border border-primary/20 whitespace-pre-wrap"
                  }`}
                >
                  {msg.text}

                  {/* Trích dẫn Citations nếu có */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-outline-variant/30 flex flex-wrap gap-1.5">
                      <span className="text-[11px] text-outline font-semibold w-full">Trích dẫn căn cứ:</span>
                      {msg.citations.slice(0, 4).map((c: any, cidx: number) => (
                        <span
                          key={cidx}
                          className="px-2 py-0.5 rounded text-[11px] font-mono bg-surface-container text-primary border border-primary/20"
                        >
                          [{c.citation_label || `E${cidx + 1}`}] {c.title || c.chunk_id || "Văn bản"}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isTesting && (
              <div className="flex justify-start">
                <ThinkingIndicator
                  mode="videcomp_full"
                  note="Đang trích xuất dữ liệu và suy luận với RAG..."
                  startedAt={Date.now()}
                />
              </div>
            )}
          </div>

          {/* Playground Input Composer */}
          <div className="p-unit-md bg-surface-container-low border-t border-outline-variant/30 shrink-0">
            <div className="flex items-center gap-2 bg-surface-container px-unit-md py-2 rounded-full border border-outline-variant/30 focus-within:border-primary">
              <input
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendTest();
                  }
                }}
                placeholder="Nhập tin nhắn để thử nghiệm năng lực chuyên gia..."
                className="flex-1 bg-transparent border-0 outline-none text-on-surface text-label-md placeholder:text-outline"
              />
              <button
                type="button"
                onClick={() => handleSendTest()}
                disabled={!testInput.trim() || isTesting}
                className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
