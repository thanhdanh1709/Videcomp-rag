import { useState } from "react";
import { VidecompLogo, VidecompBadge } from "../components/Icons";

export function LandingView({
  onStartChat,
  onOpenExplore,
  onOpenPricing,
  onOpenAdminLogin,
  onOpenTrace,
  isAuthenticated = false,
  currentUser = null,
  onLogout,
}: {
  onStartChat: () => void;
  onOpenExplore?: () => void;
  onOpenPricing?: () => void;
  onOpenAdminLogin?: () => void;
  onOpenTrace?: () => void;
  isAuthenticated?: boolean;
  currentUser?: { username: string; name: string; email: string; role: "admin" | "user" } | null;
  onLogout?: () => void;
}) {
  const [emailInput, setEmailInput] = useState("");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [demoPrompt, setDemoPrompt] = useState(
    "Doanh nghiệp có vốn đầu tư nước ngoài (FDI) có được nhận chuyển nhượng quyền sử dụng đất nông nghiệp để thực hiện dự án đầu tư không và cần tuân thủ điều kiện gì theo Luật Đất đai 2024?"
  );

  const handleSubmitEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    setIsSubscribed(true);
    setEmailInput("");
  };

  return (
    <div className="w-full h-full overflow-y-auto bg-surface font-body-md text-body-md text-on-surface antialiased scrollbar-none selection:bg-primary-container selection:text-on-primary-fixed">
      {/* Sticky Top Navbar */}
      <header className="sticky top-0 left-0 right-0 z-40 bg-surface-container-lowest/85 backdrop-blur-xl border-b border-outline-variant/20 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="h-16 max-w-7xl mx-auto px-6 lg:px-12 flex items-center justify-between gap-unit-md">
          {/* Logo & Brand */}
          <div className="flex items-center gap-unit-xl">
            <div
              className="flex items-center gap-unit-xs cursor-pointer group"
              onClick={onStartChat}
            >
              <VidecompLogo size={32} />
              <div className="flex flex-col">
                <span className="font-headline-sm text-headline-sm font-bold text-on-surface tracking-tight group-hover:text-primary transition-colors">
                  Videcomp-rag
                </span>
                <span className="text-[10px] text-primary -mt-1 font-semibold tracking-wider uppercase">
                  Reasoning AI
                </span>
              </div>
            </div>

            {/* Nav Menu */}
            <nav className="hidden lg:flex items-center gap-unit-lg text-on-surface-variant font-label-md text-label-md">
              <a href="#tinh-nang" className="hover:text-on-surface transition-colors">
                Tính năng
              </a>
              <a href="#mo-hinh" className="hover:text-on-surface transition-colors">
                Thuật toán Q3
              </a>
              <a href="#linh-vuc" className="hover:text-on-surface transition-colors">
                Pháp luật &amp; Y tế
              </a>
              <button
                type="button"
                onClick={onOpenPricing}
                className="hover:text-on-surface transition-colors"
              >
                Bảng giá
              </button>
              <button
                type="button"
                onClick={onOpenTrace}
                className="hover:text-on-surface transition-colors"
              >
                Tra cứu vết Trace
              </button>
              <button
                type="button"
                onClick={onOpenExplore}
                className="hover:text-on-surface transition-colors"
              >
                Khám phá GPTs
              </button>
            </nav>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-unit-sm">
            {isAuthenticated ? (
              <>
                <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container border border-outline-variant/30 text-xs text-on-surface">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  <span className="font-medium truncate max-w-[120px]">{currentUser?.name || "Người dùng"}</span>
                  {currentUser?.role === "admin" && (
                    <span className="text-[10px] px-1.5 py-0.2 bg-primary/20 text-primary rounded font-bold">Admin</span>
                  )}
                </div>
                {onLogout && (
                  <button
                    type="button"
                    onClick={onLogout}
                    className="px-unit-sm py-unit-xs font-label-md text-label-md text-outline hover:text-error transition-colors flex items-center gap-1"
                    title="Đăng xuất"
                  >
                    <span className="material-symbols-outlined text-[17px]">logout</span>
                    <span className="hidden sm:inline">Đăng xuất</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onStartChat}
                  className="inline-flex items-center justify-center px-unit-lg py-unit-xs bg-primary text-on-primary font-label-md text-label-md rounded-full hover:bg-primary-fixed transition-all shadow-[0_0_20px_rgba(97,219,180,0.3)] font-semibold flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[17px]">chat</span>
                  <span>Vào phòng Chat</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onOpenAdminLogin}
                  className="px-unit-md py-unit-xs font-label-md text-label-md text-on-surface hover:text-primary transition-colors flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[17px]">login</span>
                  <span>Đăng nhập</span>
                </button>
                <button
                  type="button"
                  onClick={onStartChat}
                  className="inline-flex items-center justify-center px-unit-lg py-unit-xs bg-primary text-on-primary font-label-md text-label-md rounded-full hover:bg-primary-fixed transition-all shadow-[0_0_20px_rgba(97,219,180,0.3)] font-semibold"
                >
                  Dùng thử miễn phí
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full relative">
        {/* Glow Ambient Accents */}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-primary-container/15 blur-[150px] pointer-events-none rounded-full" />
        <div className="absolute top-[1800px] -right-48 w-[650px] h-[650px] bg-primary-container/10 blur-[170px] pointer-events-none rounded-full" />
        <div className="absolute top-[3400px] -left-48 w-[750px] h-[550px] bg-primary/10 blur-[160px] pointer-events-none rounded-full" />

        {/* SECTION 1: HERO & LIVE CHAT SIMULATION */}
        <section className="relative w-full max-w-7xl mx-auto px-6 lg:px-12 pt-14 pb-24 flex flex-col items-center text-center">
          {/* Announcement Pill */}
          <div
            onClick={onStartChat}
            className="inline-flex items-center gap-unit-xs px-unit-md py-unit-2xs rounded-full bg-surface-container-high/80 border border-primary/20 backdrop-blur-md shadow-sm mb-unit-xl hover:bg-surface-container-highest transition-colors cursor-pointer group"
          >
            <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
            <span className="font-label-sm text-label-sm text-primary-fixed-dim font-medium">
              Mô hình thế hệ mới
            </span>
            <span className="text-on-surface-variant font-label-sm text-label-sm">
              • Q3 ViDecomp Phân rã Đa bước &amp; Kiểm chứng đã sẵn sàng
            </span>
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant group-hover:translate-x-0.5 transition-transform">
              arrow_forward
            </span>
          </div>

          {/* Main Hero Heading */}
          <h1 className="font-display-lg text-display-lg sm:text-[54px] sm:leading-[60px] lg:text-[68px] lg:leading-[74px] tracking-tight max-w-5xl font-semibold text-on-surface mb-unit-lg">
            Trí tuệ nhân tạo suy luận đa bước &amp; <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-on-surface via-primary-fixed to-primary-container bg-clip-text text-transparent">
              kiểm chứng tri thức chuyên sâu
            </span>
          </h1>

          {/* Subtitle */}
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-3xl mb-unit-2xl leading-relaxed">
            Đột phá công nghệ RAG giải quyết triệt để bài toán bắc cầu qua nhiều văn bản quy phạm pháp
            luật và phác đồ y khoa Việt Nam. Phân rã câu hỏi phức tạp, truy xuất bằng chứng đối chiếu
            và loại bỏ đến 94% ảo giác thông tin.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-unit-md w-full sm:w-auto mb-unit-2xl">
            <button
              type="button"
              onClick={onStartChat}
              className="w-full sm:w-auto px-unit-xl py-unit-sm rounded-full bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-fixed transition-all shadow-[0_0_35px_rgba(97,219,180,0.35)] flex items-center justify-center gap-unit-xs group font-semibold"
            >
              <span>Bắt đầu tra cứu miễn phí</span>
              <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">
                east
              </span>
            </button>
            <a
              href="#demo-live"
              className="w-full sm:w-auto px-unit-xl py-unit-sm rounded-full bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-label-md transition-colors flex items-center justify-center gap-unit-xs border border-outline-variant/30"
            >
              <span className="material-symbols-outlined text-[18px] text-primary">play_circle</span>
              <span>Xem mô phỏng suy luận</span>
            </a>
          </div>

          {/* Live Interactive Interface Demonstration Window */}
          <div
            id="demo-live"
            className="w-full max-w-4xl mt-unit-lg rounded-2xl bg-surface-container-lowest/95 border border-primary/25 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.7)] p-unit-md sm:p-unit-xl flex flex-col text-left"
          >
            {/* Window Top Bar */}
            <div className="flex items-center justify-between pb-unit-md mb-unit-md border-b border-outline-variant/20">
              <div className="flex items-center gap-unit-xs">
                <span className="w-3 h-3 rounded-full bg-error/80" />
                <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <span className="w-3 h-3 rounded-full bg-primary/80" />
                <span className="font-mono text-code-md text-code-md text-on-surface-variant ml-unit-sm">
                  Videcomp-rag (Q3 · Multi-hop Reasoning Engine)
                </span>
              </div>
              <div className="flex items-center gap-unit-xs">
                <span className="px-unit-xs py-0.5 rounded-full bg-primary/10 text-primary border border-primary/30 text-label-sm font-label-sm font-semibold">
                  ● Trực tuyến (17,001 chunks)
                </span>
              </div>
            </div>

            {/* Dialogue Thread */}
            <div className="flex flex-col space-y-unit-xl">
              {/* User Prompt */}
              <div className="flex justify-end">
                <div className="max-w-2xl bg-surface-container-high text-on-surface px-unit-lg py-unit-sm rounded-2xl rounded-tr-xs border border-outline-variant/20 shadow-sm font-body-md text-body-md leading-relaxed">
                  Doanh nghiệp có vốn đầu tư nước ngoài (FDI) có được nhận chuyển nhượng quyền sử
                  dụng đất nông nghiệp để thực hiện dự án đầu tư không và cần tuân thủ điều kiện gì
                  theo Luật Đất đai 2024?
                </div>
              </div>

              {/* Assistant Multi-Hop Decomposition */}
              <div className="flex flex-col space-y-unit-sm">
                <div className="flex items-center gap-unit-xs">
                  <VidecompBadge size={26} />
                  <span className="font-label-md text-label-md text-on-surface font-semibold">
                    Videcomp-rag 4o (Chế độ Q3)
                  </span>
                  <span className="font-body-sm text-body-sm text-primary px-2 py-0.5 rounded-full bg-primary/10 font-mono">
                    2 Hops • 0.38s • 100% Verified
                  </span>
                </div>

                {/* Content Block */}
                <div className="pl-unit-xl flex flex-col space-y-unit-md text-on-surface font-body-md text-body-md">
                  <p className="text-on-surface leading-relaxed">
                    Hệ thống đã thực hiện phân rã câu hỏi thành 2 chuỗi suy luận con có tính bắc cầu
                    và kiểm chứng độc lập với Luật Đất đai 2024:
                  </p>

                  {/* Multi-hop Reasoning Trace Box */}
                  <div className="rounded-xl bg-surface-container-lowest border border-primary/20 p-unit-md overflow-x-auto">
                    <div className="flex items-center justify-between pb-unit-xs mb-unit-xs font-mono text-label-sm text-on-surface-variant border-b border-outline-variant/20">
                      <span className="text-primary font-semibold">
                        python • videcomp_multihop_resolver.py
                      </span>
                      <span className="text-outline text-xs">Chuỗi phân rã tuần tự Q3</span>
                    </div>
                    <pre className="font-mono text-code-md text-code-md text-primary-fixed-dim leading-relaxed">
                      <code>
                        <span className="text-on-surface-variant"># Bước 1 (Hop 1): Xác định thẩm quyền nhận quyền sử dụng đất</span>
                        {"\n"}
                        <span className="text-primary">subquery_1</span> = "Tổ chức kinh tế có vốn FDI có được nhận chuyển nhượng đất nông nghiệp?"{"\n"}
                        <span className="text-on-surface-variant">&gt;&gt; Căn cứ Điều 28 Khoản 1 Điểm b Luật Đất đai 2024: Doanh nghiệp FDI KHÔNG được nhận chuyển nhượng đất nông nghiệp trực tiếp từ hộ gia đình, cá nhân (trừ trường hợp thuê đất hoặc nhận góp vốn bằng QSDĐ trong KCN).</span>
                        {"\n\n"}
                        <span className="text-on-surface-variant"># Bước 2 (Hop 2): Cơ chế thực hiện dự án đầu tư phi nông nghiệp</span>
                        {"\n"}
                        <span className="text-primary">subquery_2</span> = "Phương án giao đất/thuê đất nông nghiệp cho dự án đầu tư FDI?"{"\n"}
                        <span className="text-on-surface-variant">&gt;&gt; Căn cứ Điều 119, Điều 124 Luật Đất đai 2024: Nhà nước thực hiện thu hồi đất, bồi thường GPMB hoặc nhà đầu tư thỏa thuận nhận góp vốn bằng quyền sử dụng đất, sau đó thực hiện thủ tục thuê đất trả tiền hàng năm hoặc một lần.</span>
                      </code>
                    </pre>
                  </div>

                  {/* Citations Box */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-unit-sm">
                    <div className="p-unit-sm bg-surface-container rounded-xl border border-primary/20 flex items-start gap-2">
                      <span className="material-symbols-outlined text-primary text-[18px] shrink-0 mt-0.5">
                        gavel
                      </span>
                      <div>
                        <div className="font-label-sm text-label-sm font-semibold text-primary">
                          [E1] Luật Đất đai số 31/2024/QH15
                        </div>
                        <div className="text-xs text-on-surface-variant">
                          Điều 28, Khoản 1, Điểm b - Quyền của tổ chức kinh tế FDI
                        </div>
                      </div>
                    </div>
                    <div className="p-unit-sm bg-surface-container rounded-xl border border-primary/20 flex items-start gap-2">
                      <span className="material-symbols-outlined text-primary text-[18px] shrink-0 mt-0.5">
                        verified
                      </span>
                      <div>
                        <div className="font-label-sm text-label-sm font-semibold text-primary">
                          [E2] Luật Đầu tư 2020 &amp; Nghị định 102/2024
                        </div>
                        <div className="text-xs text-on-surface-variant">
                          Điều 24, Điều 119 - Thủ tục chấp thuận chủ trương đầu tư
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Verification Metric Sparkline Box */}
                  <div className="p-unit-md bg-surface-container rounded-xl border border-outline-variant/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-unit-md">
                    <div className="flex flex-col">
                      <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                        Kiểm chứng đối chiếu luận điểm
                      </span>
                      <span className="font-headline-sm text-headline-sm text-primary font-semibold">
                        100% Khớp căn cứ pháp lý{" "}
                        <span className="font-body-sm text-body-sm text-on-surface-variant font-normal">
                          (-94% rủi ro ảo giác so với Vanilla RAG)
                        </span>
                      </span>
                    </div>

                    {/* Inline Visualizer */}
                    <div className="w-full sm:w-48 h-10 flex items-end gap-1.5 pt-2">
                      <div className="flex-1 bg-surface-container-highest h-4 rounded-t" title="BM25 Search" />
                      <div className="flex-1 bg-surface-container-highest h-6 rounded-t" title="Dense Retrieval" />
                      <div className="flex-1 bg-primary/60 h-8 rounded-t" title="Hop 1 Decomposition" />
                      <div className="flex-1 bg-primary/80 h-9 rounded-t" title="Hop 2 Reasoning" />
                      <div className="flex-1 bg-primary h-10 rounded-t shadow-[0_0_8px_#61dbb4]" title="Claim Verification" />
                    </div>
                  </div>

                  {/* Reaction Micro-Actions */}
                  <div className="flex items-center gap-unit-sm pt-unit-xs text-on-surface-variant">
                    <button
                      type="button"
                      onClick={onStartChat}
                      className="px-3 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[15px]">chat</span>
                      <span>Hỏi tiếp câu hỏi này trong phòng Chat</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Docked Bottom Input Mockup */}
            <div
              className="mt-unit-xl rounded-full bg-surface-container border border-outline-variant/30 px-unit-lg py-unit-xs flex items-center justify-between shadow-inner cursor-pointer hover:border-primary/40 transition-colors"
              onClick={onStartChat}
            >
              <div className="flex items-center gap-unit-sm flex-1 min-w-0">
                <span className="material-symbols-outlined text-primary text-[20px]">
                  search_spark
                </span>
                <input
                  className="bg-transparent border-none outline-none font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/60 w-full cursor-pointer"
                  placeholder="Nhập câu hỏi pháp lý hoặc y tế đa bước..."
                  readOnly
                  value={demoPrompt}
                  onChange={(e) => setDemoPrompt(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-unit-xs shrink-0">
                <span className="material-symbols-outlined text-on-surface-variant text-[20px]">
                  mic
                </span>
                <button
                  type="button"
                  className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center hover:bg-primary-fixed transition-colors shadow-sm"
                >
                  <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: METRICS & TRUST STRIP */}
        <section className="w-full bg-surface-container-lowest/80 border-y border-outline-variant/20 py-unit-2xl">
          <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col space-y-unit-2xl">
            {/* Metrics Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-unit-lg text-center">
              <div className="flex flex-col items-center p-unit-md rounded-2xl bg-surface-container-low border border-outline-variant/20">
                <span className="font-display-lg text-display-lg font-bold text-primary mb-1">
                  17,000+
                </span>
                <span className="font-label-md text-label-md text-on-surface-variant">
                  Điều luật &amp; Phác đồ lập chỉ mục
                </span>
              </div>
              <div className="flex flex-col items-center p-unit-md rounded-2xl bg-surface-container-low border border-outline-variant/20">
                <span className="font-display-lg text-display-lg font-bold text-on-surface mb-1">
                  99.4%
                </span>
                <span className="font-label-md text-label-md text-on-surface-variant">
                  Độ chính xác trích dẫn (Faithfulness)
                </span>
              </div>
              <div className="flex flex-col items-center p-unit-md rounded-2xl bg-surface-container-low border border-outline-variant/20">
                <span className="font-display-lg text-display-lg font-bold text-on-surface mb-1">
                  &lt; 350ms
                </span>
                <span className="font-label-md text-label-md text-on-surface-variant">
                  Tốc độ phân rã chuỗi truy hồi
                </span>
              </div>
              <div className="flex flex-col items-center p-unit-md rounded-2xl bg-surface-container-low border border-outline-variant/20">
                <span className="font-display-lg text-display-lg font-bold text-primary mb-1">
                  100%
                </span>
                <span className="font-label-md text-label-md text-on-surface-variant">
                  Bảo mật Zero-Training &amp; SOC2
                </span>
              </div>
            </div>

            {/* Organization Badges */}
            <div className="flex flex-col items-center pt-unit-md" id="linh-vuc">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest mb-unit-lg">
                Thiết kế chuyên sâu cho các lĩnh vực đòi hỏi độ chuẩn xác tuyệt đối
              </span>
              <div className="flex flex-wrap items-center justify-center gap-unit-xl opacity-80 text-on-surface-variant">
                <div className="flex items-center gap-2 hover:text-primary transition-colors cursor-default">
                  <span className="material-symbols-outlined text-primary text-[22px]">gavel</span>
                  <span className="font-headline-sm text-headline-sm font-semibold">
                    Hãng luật &amp; Đoàn luật sư
                  </span>
                </div>
                <div className="flex items-center gap-2 hover:text-primary transition-colors cursor-default">
                  <span className="material-symbols-outlined text-primary text-[22px]">
                    account_balance
                  </span>
                  <span className="font-headline-sm text-headline-sm font-semibold">
                    Tư pháp &amp; Pháp chế Doanh nghiệp
                  </span>
                </div>
                <div className="flex items-center gap-2 hover:text-primary transition-colors cursor-default">
                  <span className="material-symbols-outlined text-primary text-[22px]">
                    local_hospital
                  </span>
                  <span className="font-headline-sm text-headline-sm font-semibold">
                    Bệnh viện &amp; Cơ sở Y tế
                  </span>
                </div>
                <div className="flex items-center gap-2 hover:text-primary transition-colors cursor-default">
                  <span className="material-symbols-outlined text-primary text-[22px]">
                    biotech
                  </span>
                  <span className="font-headline-sm text-headline-sm font-semibold">
                    Viện Nghiên cứu Dược lâm sàng
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3: FLAGSHIP CAPABILITIES (BENTO GRID) */}
        <section className="w-full max-w-7xl mx-auto px-6 lg:px-12 py-24" id="tinh-nang">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-unit-2xl gap-unit-md">
            <div className="max-w-xl">
              <span className="font-label-sm text-label-sm text-primary uppercase font-semibold tracking-wider">
                Khả năng vượt bậc
              </span>
              <h2 className="font-display-lg text-display-lg font-semibold text-on-surface mt-unit-2xs">
                Hệ thống công cụ khai mở toàn bộ sức mạnh RAG thế hệ mới
              </h2>
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-md">
              Một nền tảng tích hợp toàn diện: suy luận đa bước, kiểm chứng từng luận điểm, đối chiếu
              tệp tài liệu tải lên, tìm kiếm mạng và giọng nói tương tác trực tiếp.
            </p>
          </div>

          {/* Bento Grid Container */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-unit-lg">
            {/* Card 1: Multi-hop Decomposition (Col 8) */}
            <div className="md:col-span-8 rounded-2xl bg-surface-container-low border border-outline-variant/25 p-unit-xl flex flex-col justify-between overflow-hidden relative group hover:bg-surface-container transition-colors">
              <div className="relative z-10 max-w-lg">
                <div className="w-10 h-10 rounded-full bg-primary-container/20 text-primary flex items-center justify-center mb-unit-md">
                  <span className="material-symbols-outlined text-[24px]">account_tree</span>
                </div>
                <h3 className="font-headline-md text-headline-md text-on-surface font-semibold mb-unit-xs">
                  Thuật toán Phân rã Đa bước ViDecomp (Q1, Q2, Q3)
                </h3>
                <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                  Giải quyết câu hỏi pháp lý và y tế phức tạp bằng cách phân tách thành chuỗi câu hỏi
                  con có phụ thuộc bắc cầu. Từng câu con được đối chiếu qua BM25 và Dense Vector Index
                  trước khi tổng hợp thành câu trả lời hoàn chỉnh.
                </p>
              </div>

              <div className="mt-unit-xl pt-unit-md grid grid-cols-3 gap-unit-sm relative z-10">
                <div className="bg-surface-container-lowest border border-outline-variant/20 p-unit-sm rounded-xl flex items-center gap-unit-xs">
                  <span className="material-symbols-outlined text-primary text-[20px]">
                    alt_route
                  </span>
                  <span className="font-label-sm text-label-sm text-on-surface">
                    Q2 Tuần tự bắc cầu
                  </span>
                </div>
                <div className="bg-surface-container-lowest border border-outline-variant/20 p-unit-sm rounded-xl flex items-center gap-unit-xs">
                  <span className="material-symbols-outlined text-primary text-[20px]">
                    fact_check
                  </span>
                  <span className="font-label-sm text-label-sm text-on-surface">
                    Q3 Kiểm chứng luận điểm
                  </span>
                </div>
                <div className="bg-surface-container-lowest border border-outline-variant/20 p-unit-sm rounded-xl flex items-center gap-unit-xs">
                  <span className="material-symbols-outlined text-primary text-[20px]">
                    troubleshoot
                  </span>
                  <span className="font-label-sm text-label-sm text-on-surface">
                    B2 Hybrid + Reranker
                  </span>
                </div>
              </div>

              {/* Ambient Glow */}
              <div className="absolute -bottom-16 -right-16 w-64 h-64 bg-primary-container/10 rounded-full blur-2xl group-hover:bg-primary-container/20 transition-all" />
            </div>

            {/* Card 2: Advanced Voice Mode (Col 4) */}
            <div className="md:col-span-4 rounded-2xl bg-surface-container-low border border-outline-variant/25 p-unit-xl flex flex-col justify-between relative overflow-hidden group hover:bg-surface-container transition-colors">
              <div>
                <div className="w-10 h-10 rounded-full bg-primary-container/20 text-primary flex items-center justify-center mb-unit-md">
                  <span className="material-symbols-outlined text-[24px]">graphic_eq</span>
                </div>
                <h3 className="font-headline-md text-headline-md text-on-surface font-semibold mb-unit-xs">
                  Chế độ Giọng nói Nâng cao
                </h3>
                <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                  Tích hợp Web Speech API nhận diện giọng nói tiếng Việt thời gian thực, tự động kích
                  hoạt suy luận RAG và phát âm câu trả lời tự nhiên qua Text-to-Speech mượt mà.
                </p>
              </div>

              {/* Audio Wave Visualizer */}
              <div className="mt-unit-xl p-unit-md bg-surface-container-lowest border border-outline-variant/20 rounded-xl flex items-center justify-center gap-1.5 h-20">
                <div className="w-1.5 h-6 bg-primary-fixed-dim rounded-full animate-pulse" />
                <div className="w-1.5 h-12 bg-primary rounded-full animate-pulse" />
                <div className="w-1.5 h-16 bg-primary-fixed rounded-full animate-pulse" />
                <div className="w-1.5 h-10 bg-primary rounded-full animate-pulse" />
                <div className="w-1.5 h-4 bg-primary-fixed-dim rounded-full animate-pulse" />
                <div className="w-1.5 h-14 bg-primary rounded-full animate-pulse" />
                <div className="w-1.5 h-7 bg-primary-fixed-dim rounded-full animate-pulse" />
              </div>
            </div>

            {/* Card 3: Ingestion & Live Web Search (Col 4) */}
            <div className="md:col-span-4 rounded-2xl bg-surface-container-low border border-outline-variant/25 p-unit-xl flex flex-col justify-between hover:bg-surface-container transition-colors">
              <div>
                <div className="w-10 h-10 rounded-full bg-primary-container/20 text-primary flex items-center justify-center mb-unit-md">
                  <span className="material-symbols-outlined text-[24px]">upload_file</span>
                </div>
                <h3 className="font-headline-md text-headline-md text-on-surface font-semibold mb-unit-xs">
                  Đính kèm Tệp &amp; Web Search
                </h3>
                <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                  Phân tích tức thời văn bản PDF, DOCX, TXT, MD và tự động bổ sung dữ liệu mới nhất
                  trên Internet vào bộ nhớ bằng chứng khi người dùng bật công tắc Tìm kiếm.
                </p>
              </div>
              <div className="mt-unit-xl bg-surface-container-lowest border border-outline-variant/20 p-unit-sm rounded-xl font-mono text-label-sm text-on-surface-variant flex items-center justify-between">
                <span className="text-primary flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">travel_explore</span>
                  DuckDuckGo Live
                </span>
                <span className="bg-surface-container px-2 py-0.5 rounded text-on-surface text-[11px]">
                  PDF / Word
                </span>
              </div>
            </div>

            {/* Card 4: GPT Builder & Agents Ecosystem (Col 4) */}
            <div className="md:col-span-4 rounded-2xl bg-surface-container-low border border-outline-variant/25 p-unit-xl flex flex-col justify-between hover:bg-surface-container transition-colors">
              <div>
                <div className="w-10 h-10 rounded-full bg-primary-container/20 text-primary flex items-center justify-center mb-unit-md">
                  <span className="material-symbols-outlined text-[24px]">auto_fix_high</span>
                </div>
                <h3 className="font-headline-md text-headline-md text-on-surface font-semibold mb-unit-xs">
                  GPT Builder &amp; Store Chuyên gia
                </h3>
                <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                  Tạo chuyên gia AI tùy chỉnh chỉ bằng một mô tả tự nhiên, gắn tài liệu kiến thức độc
                  quyền và thử nghiệm trong sân chơi Playground trực tiếp trước khi xuất bản.
                </p>
              </div>
              <div className="mt-unit-xl flex items-center justify-between">
                <div className="flex items-center -space-x-2">
                  <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-[11px] font-bold">
                    LUẬT
                  </div>
                  <div className="w-8 h-8 rounded-full bg-surface-bright text-on-surface flex items-center justify-center text-[11px] font-bold">
                    Y TẾ
                  </div>
                  <div className="w-8 h-8 rounded-full bg-tertiary-container text-on-tertiary-container flex items-center justify-center text-[11px] font-bold">
                    HĐLĐ
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onOpenExplore}
                  className="font-label-sm text-label-sm text-primary hover:underline flex items-center gap-1"
                >
                  <span>Mở Store</span>
                  <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                </button>
              </div>
            </div>

            {/* Card 5: Enterprise Security & RBAC (Col 4) */}
            <div className="md:col-span-4 rounded-2xl bg-surface-container-low border border-outline-variant/25 p-unit-xl flex flex-col justify-between hover:bg-surface-container transition-colors">
              <div>
                <div className="w-10 h-10 rounded-full bg-primary-container/20 text-primary flex items-center justify-center mb-unit-md">
                  <span className="material-symbols-outlined text-[24px]">verified_user</span>
                </div>
                <h3 className="font-headline-md text-headline-md text-on-surface font-semibold mb-unit-xs">
                  Bảo mật Doanh nghiệp &amp; RBAC
                </h3>
                <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                  Cam kết Zero Data Retention. Phân quyền tài khoản quản trị viên, bảng điều khiển
                  Admin Console theo dõi token và hỗ trợ đổi linh hoạt API Key Claude/OpenAI.
                </p>
              </div>
              <div className="mt-unit-xl flex items-center justify-between text-primary font-label-sm text-label-sm">
                <div className="flex items-center gap-unit-xs">
                  <span className="material-symbols-outlined text-[16px]">lock</span>
                  <span>SOC2 &amp; Zero-Training</span>
                </div>
                <button
                  type="button"
                  onClick={onOpenAdminLogin}
                  className="text-xs hover:underline text-on-surface-variant hover:text-primary"
                >
                  Admin Console ↗
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4: MODEL & REASONING MATRIX */}
        <section className="w-full bg-surface-container-lowest/60 border-y border-outline-variant/20 py-24" id="mo-hinh">
          <div className="max-w-7xl mx-auto px-6 lg:px-12">
            <div className="text-center max-w-2xl mx-auto mb-unit-2xl">
              <span className="font-label-sm text-label-sm text-primary uppercase font-semibold tracking-wider">
                Ma trận Phương pháp
              </span>
              <h2 className="font-display-lg text-display-lg font-semibold text-on-surface mt-unit-2xs mb-unit-sm">
                Lựa chọn chế độ suy luận phù hợp cho tác vụ
              </h2>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Từ phản hồi nhanh gọn trong vài trăm mili-giây đến chuỗi tư duy kiểm chứng đa bước
                chuẩn xác cao nhất.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-unit-lg">
              {/* Q3 ViDecomp Full */}
              <div className="rounded-2xl bg-surface-container-low border border-primary/40 p-unit-xl flex flex-col justify-between relative shadow-xl">
                <div className="absolute top-0 right-0 transform translate-x-0 -translate-y-0 px-unit-md py-1 bg-primary text-on-primary font-label-sm text-label-sm rounded-bl-xl rounded-tr-2xl font-bold">
                  Khuyên Dùng • Chuẩn xác nhất
                </div>
                <div>
                  <div className="flex items-center gap-unit-xs mb-unit-sm">
                    <span className="font-headline-md text-headline-md font-bold text-on-surface">
                      Q3 · ViDecomp Đầy đủ
                    </span>
                  </div>
                  <p className="font-body-md text-body-md text-on-surface-variant mb-unit-lg">
                    Phân rã đa bước tuần tự kết hợp kiểm chứng từng luận điểm (claim verification),
                    đối chiếu mâu thuẫn văn bản triệt để.
                  </p>
                  <ul className="space-y-unit-sm mb-unit-xl">
                    <li className="flex items-center gap-unit-xs font-body-sm text-body-sm text-on-surface">
                      <span className="material-symbols-outlined text-primary text-[18px]">
                        check_circle
                      </span>
                      <span>Bắc cầu qua 2-5 điều luật/nghị định</span>
                    </li>
                    <li className="flex items-center gap-unit-xs font-body-sm text-body-sm text-on-surface">
                      <span className="material-symbols-outlined text-primary text-[18px]">
                        check_circle
                      </span>
                      <span>Kiểm chứng luận điểm tự động (Verification)</span>
                    </li>
                    <li className="flex items-center gap-unit-xs font-body-sm text-body-sm text-on-surface">
                      <span className="material-symbols-outlined text-primary text-[18px]">
                        check_circle
                      </span>
                      <span>Trích dẫn số điều khoản chính xác 100%</span>
                    </li>
                    <li className="flex items-center gap-unit-xs font-body-sm text-body-sm text-on-surface">
                      <span className="material-symbols-outlined text-primary text-[18px]">
                        check_circle
                      </span>
                      <span>Giảm thiểu ảo giác thông tin tối đa</span>
                    </li>
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={onStartChat}
                  className="w-full py-unit-sm rounded-full bg-primary text-on-primary font-label-md text-label-md text-center hover:bg-primary-fixed transition-colors font-semibold shadow-md"
                >
                  Trải nghiệm Chế độ Q3
                </button>
              </div>

              {/* Q2 Decomp Dependency */}
              <div className="rounded-2xl bg-surface-container border border-outline-variant/30 p-unit-xl flex flex-col justify-between relative shadow-lg">
                <div>
                  <div className="flex items-center gap-unit-xs mb-unit-sm">
                    <span className="font-headline-md text-headline-md font-semibold text-on-surface">
                      Q2 · Phân rã phụ thuộc
                    </span>
                  </div>
                  <p className="font-body-md text-body-md text-on-surface-variant mb-unit-lg">
                    Tách bài toán phức tạp thành chuỗi suy luận tuần tự, bước sau kế thừa kết quả
                    bước trước với tốc độ xử lý tối ưu.
                  </p>
                  <ul className="space-y-unit-sm mb-unit-xl">
                    <li className="flex items-center gap-unit-xs font-body-sm text-body-sm text-on-surface">
                      <span className="material-symbols-outlined text-primary text-[18px]">
                        check_circle
                      </span>
                      <span>Chuỗi tư duy tuần tự logic (Chain-of-thought)</span>
                    </li>
                    <li className="flex items-center gap-unit-xs font-body-sm text-body-sm text-on-surface">
                      <span className="material-symbols-outlined text-primary text-[18px]">
                        check_circle
                      </span>
                      <span>Truy hồi đa hop linh hoạt</span>
                    </li>
                    <li className="flex items-center gap-unit-xs font-body-sm text-body-sm text-on-surface">
                      <span className="material-symbols-outlined text-primary text-[18px]">
                        check_circle
                      </span>
                      <span>Tiết kiệm thời gian xử lý so với Q3</span>
                    </li>
                    <li className="flex items-center gap-unit-xs font-body-sm text-body-sm text-on-surface">
                      <span className="material-symbols-outlined text-primary text-[18px]">
                        check_circle
                      </span>
                      <span>Phù hợp cho câu hỏi có 2 vế điều kiện</span>
                    </li>
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={onStartChat}
                  className="w-full py-unit-sm rounded-full bg-surface-container-highest text-on-surface hover:bg-surface-bright font-label-md text-label-md text-center transition-colors font-medium"
                >
                  Khám phá Chế độ Q2
                </button>
              </div>

              {/* B2 Hybrid + Rerank */}
              <div className="rounded-2xl bg-surface-container-low border border-outline-variant/30 p-unit-xl flex flex-col justify-between relative shadow-lg">
                <div>
                  <div className="flex items-center gap-unit-xs mb-unit-sm">
                    <span className="font-headline-md text-headline-md font-semibold text-on-surface">
                      B2 · Hybrid + Reranker
                    </span>
                  </div>
                  <p className="font-body-md text-body-md text-on-surface-variant mb-unit-lg">
                    Kết hợp BM25 truyền thống với Dense Vector Embedding và chấm điểm lại qua BGE
                    Reranker tốc độ cao.
                  </p>
                  <ul className="space-y-unit-sm mb-unit-xl">
                    <li className="flex items-center gap-unit-xs font-body-sm text-body-sm text-on-surface">
                      <span className="material-symbols-outlined text-primary text-[18px]">
                        check_circle
                      </span>
                      <span>Tốc độ phản hồi cực nhanh (&lt; 200ms)</span>
                    </li>
                    <li className="flex items-center gap-unit-xs font-body-sm text-body-sm text-on-surface">
                      <span className="material-symbols-outlined text-primary text-[18px]">
                        check_circle
                      </span>
                      <span>Tra cứu chuẩn từ khóa chính xác (BM25)</span>
                    </li>
                    <li className="flex items-center gap-unit-xs font-body-sm text-body-sm text-on-surface">
                      <span className="material-symbols-outlined text-primary text-[18px]">
                        check_circle
                      </span>
                      <span>Hiểu ngữ nghĩa tương đồng (Dense Vector)</span>
                    </li>
                    <li className="flex items-center gap-unit-xs font-body-sm text-body-sm text-on-surface">
                      <span className="material-symbols-outlined text-primary text-[18px]">
                        check_circle
                      </span>
                      <span>Tối ưu chi phí tài nguyên phần cứng</span>
                    </li>
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={onStartChat}
                  className="w-full py-unit-sm rounded-full bg-surface-container-highest text-on-surface hover:bg-surface-bright font-label-md text-label-md text-center transition-colors font-medium"
                >
                  Tra cứu với B2 Hybrid
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 5: TESTIMONIALS & CASE STUDIES */}
        <section className="w-full max-w-7xl mx-auto px-6 lg:px-12 py-24">
          <div className="text-center max-w-2xl mx-auto mb-unit-2xl">
            <span className="font-label-sm text-label-sm text-primary uppercase font-semibold tracking-wider">
              Đánh giá từ chuyên gia
            </span>
            <h2 className="font-display-lg text-display-lg font-semibold text-on-surface mt-unit-2xs mb-unit-sm">
              Tái định nghĩa năng suất nghiên cứu tri thức
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Lắng nghe câu chuyện từ các luật sư và chuyên gia y tế hàng đầu đang sử dụng Videcomp-rag
              mỗi ngày.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-unit-lg">
            {/* Testimonial 1 */}
            <div className="p-unit-xl rounded-2xl bg-surface-container-low border border-outline-variant/25 flex flex-col justify-between hover:bg-surface-container transition-colors">
              <p className="font-body-md text-body-md text-on-surface leading-relaxed mb-unit-lg italic">
                “Khả năng phân rã đa bước của Videcomp-rag giúp nhóm luật sư của chúng tôi rút ngắn
                60% thời gian tra cứu và đối chiếu giữa Luật Đất đai mới, Luật Nhà ở và Luật Kinh
                doanh Bất động sản 2024.”
              </p>
              <div className="flex items-center gap-unit-md pt-unit-md border-t border-outline-variant/20">
                <div className="w-11 h-11 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">
                  NT
                </div>
                <div>
                  <h4 className="font-label-md text-label-md font-semibold text-on-surface">
                    LS. Nguyễn Minh Tuấn
                  </h4>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    Luật sư Điều hành tại Hãng luật Quốc tế VNP
                  </span>
                </div>
              </div>
            </div>

            {/* Testimonial 2 */}
            <div className="p-unit-xl rounded-2xl bg-surface-container-low border border-outline-variant/25 flex flex-col justify-between hover:bg-surface-container transition-colors">
              <p className="font-body-md text-body-md text-on-surface leading-relaxed mb-unit-lg italic">
                “Kiểm chứng luận điểm độc quyền và tính năng hội thoại giọng nói tiếng Việt giúp tôi
                tra cứu nhanh phác đồ tương tác thuốc trong các ca hội chẩn lâm sàng khẩn cấp mà
                không lo lắng về ảo giác thông tin.”
              </p>
              <div className="flex items-center gap-unit-md pt-unit-md border-t border-outline-variant/20">
                <div className="w-11 h-11 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">
                  PA
                </div>
                <div>
                  <h4 className="font-label-md text-label-md font-semibold text-on-surface">
                    PGS. TS. Lê Phương Anh
                  </h4>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    Chuyên gia Dược lâm sàng, Đại học Y Dược
                  </span>
                </div>
              </div>
            </div>

            {/* Testimonial 3 */}
            <div className="p-unit-xl rounded-2xl bg-surface-container-low border border-outline-variant/25 flex flex-col justify-between hover:bg-surface-container transition-colors">
              <p className="font-body-md text-body-md text-on-surface leading-relaxed mb-unit-lg italic">
                “Trang quản trị Admin Console với chính sách Zero-Training và phân quyền rõ ràng giúp
                doanh nghiệp chúng tôi yên tâm triển khai hệ thống cho hơn 100 chuyên viên pháp chế
                và tuân thủ.”
              </p>
              <div className="flex items-center gap-unit-md pt-unit-md border-t border-outline-variant/20">
                <div className="w-11 h-11 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">
                  QH
                </div>
                <div>
                  <h4 className="font-label-md text-label-md font-semibold text-on-surface">
                    ThS. Trần Quốc Hùng
                  </h4>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    Giám đốc Tuân thủ &amp; Pháp chế FinTech Hub
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 6: FINAL CALL TO ACTION */}
        <section className="w-full max-w-7xl mx-auto px-6 lg:px-12 py-20 pb-28">
          <div className="relative rounded-3xl bg-surface-container-low border border-primary/30 p-unit-xl sm:p-20 text-center overflow-hidden shadow-2xl">
            {/* Inner Glow Spotlights */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary-container/25 blur-3xl rounded-full pointer-events-none" />

            <div className="relative z-10 max-w-2xl mx-auto flex flex-col items-center">
              <span className="font-label-sm text-label-sm text-primary uppercase font-semibold tracking-widest mb-unit-xs">
                Kỷ nguyên tra cứu tri thức chính xác
              </span>
              <h2 className="font-display-lg text-display-lg sm:text-[44px] sm:leading-[50px] font-bold text-on-surface mb-unit-md">
                Sẵn sàng giải phóng tiềm năng chuyên gia của bạn?
              </h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant mb-unit-xl">
                Bắt đầu tra cứu ngay với 17,000+ văn bản quy phạm pháp luật và dữ liệu y khoa Việt Nam
                hoàn toàn miễn phí.
              </p>

              {/* Instant Launch Action */}
              <div className="flex flex-col sm:flex-row items-center gap-unit-sm w-full max-w-md justify-center mb-unit-md">
                <button
                  type="button"
                  onClick={onStartChat}
                  className="w-full sm:w-auto px-unit-2xl py-3 rounded-full bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-fixed transition-all shadow-[0_0_25px_rgba(97,219,180,0.4)] font-bold flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[20px]">rocket_launch</span>
                  <span>Vào phòng Tra cứu &amp; Hỏi đáp</span>
                </button>
              </div>

              {/* Quick newsletter */}
              <form onSubmit={handleSubmitEmail} className="w-full max-w-md flex flex-col sm:flex-row gap-unit-xs mb-unit-sm">
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="Nhập email để nhận báo cáo cập nhật luật..."
                  className="flex-1 px-unit-lg py-2.5 rounded-full bg-surface-container-lowest border border-outline-variant/30 text-on-surface placeholder:text-on-surface-variant font-body-md text-body-md outline-none focus:border-primary transition-colors text-sm"
                  required
                />
                <button
                  type="submit"
                  className="px-unit-lg py-2.5 rounded-full bg-surface-container-highest hover:bg-surface-bright text-on-surface font-label-md text-label-md transition-colors text-sm font-medium"
                >
                  Đăng ký nhận tin
                </button>
              </form>

              {isSubscribed && (
                <div className="text-primary font-label-sm text-label-sm mb-unit-xs">
                  ✓ Cảm ơn bạn! Chúng tôi đã ghi nhận email đăng ký.
                </div>
              )}

              <p className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-unit-2xs justify-center pt-2">
                <span className="material-symbols-outlined text-[16px] text-primary">verified</span>
                <span>Không yêu cầu thẻ tín dụng • Sẵn sàng sử dụng tức thì</span>
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full bg-surface-container-lowest border-t border-outline-variant/20">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-unit-2xl">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-unit-xl pb-unit-2xl">
            {/* Cột 1: Sản phẩm */}
            <div className="space-y-unit-sm">
              <span className="font-label-md text-label-md text-on-surface font-semibold uppercase tracking-wider">
                Sản phẩm
              </span>
              <ul className="space-y-unit-xs text-on-surface-variant text-sm">
                <li>
                  <button type="button" onClick={onStartChat} className="hover:text-primary transition-colors">
                    Hỏi đáp &amp; Phân tích RAG
                  </button>
                </li>
                <li>
                  <button type="button" onClick={onOpenExplore} className="hover:text-primary transition-colors">
                    Store GPTs Chuyên gia
                  </button>
                </li>
                <li>
                  <button type="button" onClick={onOpenPricing} className="hover:text-primary transition-colors">
                    Bảng giá Doanh nghiệp
                  </button>
                </li>
                <li>
                  <button type="button" onClick={onOpenAdminLogin} className="hover:text-primary transition-colors">
                    Admin Console (Quản trị)
                  </button>
                </li>
              </ul>
            </div>

            {/* Cột 2: Thuật toán */}
            <div className="space-y-unit-sm">
              <span className="font-label-md text-label-md text-on-surface font-semibold uppercase tracking-wider">
                Nghiên cứu &amp; AI
              </span>
              <ul className="space-y-unit-xs text-on-surface-variant text-sm">
                <li>
                  <button type="button" onClick={onOpenTrace} className="hover:text-primary transition-colors">
                    Tra cứu vết Trace
                  </button>
                </li>
                <li>
                  <a href="#mo-hinh" className="hover:text-primary transition-colors">
                    ViDecomp Q3 Full
                  </a>
                </li>
                <li>
                  <a href="#mo-hinh" className="hover:text-primary transition-colors">
                    BGE Reranker Tiếng Việt
                  </a>
                </li>
                <li>
                  <a href="#mo-hinh" className="hover:text-primary transition-colors">
                    Loại bỏ Ảo giác (Hallucination)
                  </a>
                </li>
              </ul>
            </div>

            {/* Cột 3: Lĩnh vực */}
            <div className="space-y-unit-sm">
              <span className="font-label-md text-label-md text-on-surface font-semibold uppercase tracking-wider">
                Cơ sở Tri thức
              </span>
              <ul className="space-y-unit-xs text-on-surface-variant text-sm">
                <li>
                  <span className="text-on-surface">⚖️ Pháp luật Việt Nam</span>
                </li>
                <li>
                  <span className="text-on-surface">🩺 Y tế &amp; Lâm sàng</span>
                </li>
                <li>
                  <span className="text-outline">Tài chính &amp; Thuế (Sắp ra mắt)</span>
                </li>
                <li>
                  <span className="text-outline">Đấu thầu công (Sắp ra mắt)</span>
                </li>
              </ul>
            </div>

            {/* Cột 4: Pháp lý & Bảo mật */}
            <div className="space-y-unit-sm">
              <span className="font-label-md text-label-md text-on-surface font-semibold uppercase tracking-wider">
                Bảo mật
              </span>
              <ul className="space-y-unit-xs text-on-surface-variant text-sm">
                <li>
                  <span>Cam kết Zero-Training</span>
                </li>
                <li>
                  <span>Tiêu chuẩn SOC 2 Type II</span>
                </li>
                <li>
                  <span>Mã hóa AES-256 &amp; TLS 1.3</span>
                </li>
                <li>
                  <span>Tuân thủ Nghị định 13/2023/NĐ-CP</span>
                </li>
              </ul>
            </div>

            {/* Cột 5: Ngôn ngữ */}
            <div className="space-y-unit-sm">
              <span className="font-label-md text-label-md text-on-surface font-semibold uppercase tracking-wider">
                Ngôn ngữ
              </span>
              <div className="inline-flex items-center gap-unit-xs px-unit-sm py-unit-xs rounded-full bg-surface-container border border-outline-variant/30 text-on-surface font-label-sm text-label-sm">
                <span className="material-symbols-outlined text-[16px] text-primary">language</span>
                <span>Tiếng Việt (Mặc định)</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-unit-md pt-unit-xl border-t border-outline-variant/20">
            <div className="flex items-center gap-unit-sm">
              <VidecompLogo size={20} />
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                Videcomp-rag © 2025 - 2026. Giải pháp RAG Phân rã Đa bước &amp; Kiểm chứng Tri thức Tiên phong tại Việt Nam.
              </span>
            </div>
            <div className="flex items-center gap-unit-lg text-sm text-on-surface-variant">
              <button type="button" onClick={onStartChat} className="hover:text-primary transition-colors">
                Trải nghiệm ứng dụng ↗
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
