import { useState, useMemo } from "react";
import { VidecompLogo } from "../components/Icons";

export function AuthView({
  initialMode = "login",
  onBack,
  onLogin,
  onRegister,
  onShowToast,
}: {
  initialMode?: "login" | "register";
  onBack: () => void;
  onLogin: (
    username: string,
    pass: string
  ) => Promise<{ success: boolean; role?: "admin" | "user"; message?: string }>;
  onRegister: (data: {
    username: string;
    email: string;
    password: string;
    confirm_password: string;
    full_name?: string;
  }) => Promise<{ success: boolean; role?: "admin" | "user"; message?: string }>;
  onShowToast?: (msg: string) => void;
}) {
  const [mode, setMode] = useState<"login" | "register">(initialMode);

  // Login form state (Trống hoàn toàn theo yêu cầu, KHÔNG ĐIỀN SẴN ADMIN)
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register form state
  const [regUsername, setRegUsername] = useState("");
  const [regFullName, setRegFullName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Kiểm tra độ mạnh của mật khẩu theo chuẩn bảo mật
  const pwdChecks = useMemo(() => {
    return {
      length: regPassword.length >= 8,
      uppercase: /[A-Z]/.test(regPassword),
      lowercase: /[a-z]/.test(regPassword),
      number: /[0-9]/.test(regPassword),
      special: /[!@#$%^&*(),.?":{}|<>_\-+=\\~`\[\]/]/.test(regPassword),
      match: regPassword.length > 0 && regPassword === regConfirmPassword,
    };
  }, [regPassword, regConfirmPassword]);

  const isPasswordValid =
    pwdChecks.length &&
    pwdChecks.uppercase &&
    pwdChecks.lowercase &&
    pwdChecks.number &&
    pwdChecks.special;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedUser = loginUsername.trim();
    const trimmedPass = loginPassword.trim();

    if (!trimmedUser || !trimmedPass) {
      setErrorMsg("Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await onLogin(trimmedUser, trimmedPass);
      if (res.success) {
        if (res.role === "admin") {
          onShowToast?.("Đăng nhập quyền Quản trị viên (Admin) — Chuyển vào trang Quản trị!");
        } else {
          onShowToast?.("Đăng nhập thành công — Chào mừng bạn vào phòng Chat!");
        }
      } else {
        setErrorMsg(res.message || "Tên đăng nhập hoặc mật khẩu không chính xác.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Đã xảy ra lỗi kết nối với máy chủ.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedUser = regUsername.trim();
    const trimmedEmail = regEmail.trim();
    const trimmedPass = regPassword.trim();
    const trimmedConfirm = regConfirmPassword.trim();

    if (!trimmedUser || !trimmedEmail || !trimmedPass || !trimmedConfirm) {
      setErrorMsg("Vui lòng điền đầy đủ các trường thông tin bắt buộc.");
      return;
    }

    if (!isPasswordValid) {
      setErrorMsg("Mật khẩu chưa đáp ứng đầy đủ các tiêu chuẩn bảo mật (chữ hoa, thường, số, ký tự đặc biệt, >= 8 ký tự).");
      return;
    }

    if (trimmedPass !== trimmedConfirm) {
      setErrorMsg("Mật khẩu xác nhận không trùng khớp.");
      return;
    }

    if (!agreeTerms) {
      setErrorMsg("Vui lòng đồng ý với Điều khoản dịch vụ và Chính sách quyền riêng tư.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await onRegister({
        username: trimmedUser,
        email: trimmedEmail,
        password: trimmedPass,
        confirm_password: trimmedConfirm,
        full_name: regFullName.trim() || undefined,
      });

      if (res.success) {
        onShowToast?.("Đăng ký thành công! Đã tự động đăng nhập vào phòng Chat.");
      } else {
        setErrorMsg(res.message || "Đăng ký không thành công. Vui lòng thử lại.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Đã xảy ra lỗi khi tạo tài khoản.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSocialMock = (provider: string) => {
    onShowToast?.(`Tính năng đăng nhập với ${provider} (SSO) đã sẵn sàng trong cấu hình doanh nghiệp!`);
  };

  return (
    <div className="min-h-screen bg-[#080808] text-[#ececf1] font-sans flex flex-col justify-between selection:bg-[#10a37f]/30 selection:text-[#1cd6a8] relative overflow-x-hidden">
      {/* Hiệu ứng ánh sáng điện ảnh mờ nền */}
      <div className="fixed inset-0 pointer-events-none radial-gradient-glow z-0" />
      <div className="fixed inset-0 pointer-events-none ambient-cyan-glow z-0" />
      <div className="fixed inset-0 pointer-events-none bg-grid-pattern opacity-40 z-0" />

      {/* Top Navigation Bar */}
      <header className="relative z-10 w-full px-6 py-5 flex items-center justify-between border-b border-white/5 bg-[#080808]/70 backdrop-blur-md">
        <div
          onClick={onBack}
          className="flex items-center gap-3 cursor-pointer group"
          title="Quay về trang chủ"
        >
          <div className="w-9 h-9 rounded-full bg-[#10a37f] flex items-center justify-center text-black shadow-[0_0_25px_-5px_rgba(16,163,127,0.45)] transition-transform duration-300 group-hover:scale-105">
            <VidecompLogo size={22} />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-semibold tracking-tight text-white flex items-center gap-2">
              ChatGPT / Videcomp-rag
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-[#1cd6a8] border border-emerald-500/20 font-medium">
                NextGen
              </span>
            </span>
            <span className="text-[11px] text-gray-400">OpenAI Authentication Hub</span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <span className="text-gray-400 hidden sm:inline">
            Bạn cần trợ giúp đăng nhập doanh nghiệp?
          </span>
          <button
            type="button"
            onClick={() => onShowToast?.("Cổng kết nối SAML SSO 2.0 dành cho tổ chức doanh nghiệp lớn.")}
            className="text-xs font-medium text-[#1cd6a8] hover:text-white transition-colors flex items-center gap-1"
          >
            SAML SSO Enterprise
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
          <div className="h-4 w-[1px] bg-white/10 mx-1" />
          <button
            type="button"
            onClick={onBack}
            className="px-3 py-1.5 rounded-full border border-white/10 text-gray-300 hover:text-white hover:border-white/20 transition-all flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[15px]">arrow_back</span>
            <span>Quay lại trang chủ</span>
          </button>
        </div>
      </header>

      {/* Main Container: Split 2 Columns (Cinema Visual + Form Hub) */}
      <main className="relative z-10 flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 lg:py-12 flex items-center justify-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* CỘT TRÁI: Cinematic Showcase (GetLayers aesthetic) */}
          <div className="lg:col-span-6 flex flex-col justify-center space-y-8 pr-0 lg:pr-4">
            {/* Pill badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10 backdrop-blur-md w-fit">
              <span className="w-2 h-2 rounded-full bg-[#10a37f] animate-pulse" />
              <span className="text-xs font-mono text-emerald-300/90 tracking-wide uppercase">
                Cổng xác thực an toàn v4.8
              </span>
              <span className="text-[10px] text-gray-500">•</span>
              <span className="text-xs text-gray-400">SOC 2 Type II</span>
            </div>

            {/* Hero Headline */}
            <div className="space-y-4">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-[1.15]">
                Mở cánh cửa vào <br />
                <span className="bg-gradient-to-r from-white via-[#e2e8f0] to-[#10a37f] bg-clip-text text-transparent">
                  Trí tuệ nhân tạo điện ảnh.
                </span>
              </h1>
              <p className="text-gray-400 text-sm sm:text-base leading-relaxed max-w-lg">
                Đăng nhập để tiếp tục các phiên làm việc o1 Reasoning, sáng tạo tương tác qua Canvas Studio, và trải nghiệm giọng nói 3D độ trễ dưới 10ms.
              </p>
            </div>

            {/* Cinematic Preview Card */}
            <div className="relative rounded-2xl bg-[#0e0f11] p-5 glass-border shadow-2xl overflow-hidden group">
              {/* Top card bar */}
              <div className="flex items-center justify-between border-b border-white/5 pb-3.5 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
                  <span className="ml-2 font-mono text-[11px] text-gray-400">auth.session.encrypted</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  AES-256 Active
                </div>
              </div>

              {/* Card visual mock: interactive glowing sphere & audio waveform preview */}
              <div className="relative flex items-center justify-between p-4 rounded-xl bg-black/40 border border-white/5">
                <div className="flex items-center gap-4">
                  {/* Glowing Voice Orb Mini */}
                  <div className="relative w-14 h-14 rounded-full bg-gradient-to-tr from-[#10a37f] via-emerald-400 to-cyan-300 p-0.5 pulse-orb shadow-[0_0_35px_-5px_rgba(16,163,127,0.45)] flex items-center justify-center">
                    <div className="w-full h-full rounded-full bg-[#0d1210] flex items-center justify-center overflow-hidden">
                      <div className="w-6 h-6 rounded-full bg-emerald-400 blur-[2px] opacity-75" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                      GPT-4o Omnimodal Workspace
                      <span className="text-[10px] px-1.5 py-0.2 bg-white/10 rounded text-gray-300">Live</span>
                    </div>
                    <div className="text-[11px] text-gray-400 font-mono">
                      Đồng bộ lịch sử 128k context tức thì
                    </div>
                  </div>
                </div>

                {/* Mini audio visualizer bars */}
                <div className="hidden sm:flex items-center gap-1 h-6">
                  <span className="w-1 bg-[#10a37f] h-3 rounded-full animate-pulse" />
                  <span className="w-1 bg-[#10a37f] h-5 rounded-full animate-pulse delay-75" />
                  <span className="w-1 bg-[#10a37f] h-2 rounded-full animate-pulse delay-150" />
                  <span className="w-1 bg-[#10a37f] h-6 rounded-full animate-pulse delay-100" />
                  <span className="w-1 bg-cyan-400 h-4 rounded-full animate-pulse delay-200" />
                </div>
              </div>

              {/* Feature highlights pills */}
              <div className="mt-4 grid grid-cols-3 gap-2.5 pt-1">
                <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5 text-center">
                  <div className="text-xs font-bold text-white font-mono">200M+</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">Người dùng tích cực</div>
                </div>
                <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5 text-center">
                  <div className="text-xs font-bold text-white font-mono">0.0%</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">Không huấn luyện dữ liệu</div>
                </div>
                <div className="text-xs font-bold text-[#1cd6a8] font-mono">o1 / 4o</div>
                <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5 text-center">
                  <div className="text-[10px] text-gray-400 mt-0.5">Suy luận đa tầng</div>
                </div>
              </div>
            </div>

            {/* Social Proof Testimonial snippet */}
            <div className="flex items-center gap-3 pt-2 text-xs text-gray-400">
              <div className="flex -space-x-2">
                <div className="w-7 h-7 rounded-full bg-emerald-800 border-2 border-[#080808] flex items-center justify-center text-[10px] font-bold text-emerald-200">
                  NT
                </div>
                <div className="w-7 h-7 rounded-full bg-indigo-800 border-2 border-[#080808] flex items-center justify-center text-[10px] font-bold text-indigo-200">
                  LP
                </div>
                <div className="w-7 h-7 rounded-full bg-teal-800 border-2 border-[#080808] flex items-center justify-center text-[10px] font-bold text-teal-200">
                  TQ
                </div>
              </div>
              <span>
                Được tin tưởng bởi hơn 1,000+ nhà sáng lập và đội ngũ công nghệ tại Việt Nam & toàn cầu.
              </span>
            </div>
          </div>

          {/* CỘT PHẢI: Dual Mode Auth Container (Tabs: Đăng nhập / Đăng ký) */}
          <div className="lg:col-span-6 w-full max-w-md mx-auto">
            <div className="relative rounded-3xl bg-[#111214] p-6 sm:p-8 glass-border shadow-2xl overflow-hidden">
              {/* Subtle corner accent glow */}
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#10a37f]/20 rounded-full blur-3xl pointer-events-none" />

              {/* Header & Segmented Tab Controls */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">
                      {mode === "login" ? "Chào mừng trở lại" : "Khởi tạo tài khoản"}
                    </h2>
                    <p className="text-xs text-gray-400 mt-1">
                      {mode === "login"
                        ? "Chọn tài khoản hoặc nhập thông tin để truy cập"
                        : "Tham gia cùng 200M+ người dùng trải nghiệm mô hình AI tân tiến"}
                    </p>
                  </div>
                  <span className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400 border border-white/10">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                  </span>
                </div>

                {/* Tab Buttons: Login vs Register */}
                <div className="grid grid-cols-2 gap-1 p-1 bg-black/50 rounded-xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("login");
                      setErrorMsg(null);
                    }}
                    className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                      mode === "login"
                        ? "text-white bg-white/10 shadow-sm border border-white/10"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Đăng nhập
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("register");
                      setErrorMsg(null);
                    }}
                    className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                      mode === "register"
                        ? "text-white bg-white/10 shadow-sm border border-white/10"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Tạo tài khoản mới
                  </button>
                </div>
              </div>

              {/* Thông báo lỗi nếu có */}
              {errorMsg && (
                <div className="mb-4 p-3 rounded-xl bg-error-container/30 border border-error/40 text-on-error-container text-xs flex items-start gap-2 animate-in fade-in duration-200">
                  <span className="material-symbols-outlined text-[16px] text-error flex-shrink-0 mt-0.5">
                    error
                  </span>
                  <span className="flex-1">{errorMsg}</span>
                </div>
              )}

              {/* Social Login Options (SSO / OAuth) */}
              <div className="space-y-2.5 mb-5">
                {/* Google Button */}
                <button
                  type="button"
                  onClick={() => handleSocialMock("Google")}
                  className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-medium text-white transition-all duration-200 group"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z" />
                    <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5.1 3.7-8.8z" />
                    <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.8s.2-2.1.4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z" />
                    <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.4C3.7 20.4 7.5 23 12 23z" />
                  </svg>
                  <span>Tiếp tục với Google</span>
                </button>

                {/* Microsoft Button */}
                <button
                  type="button"
                  onClick={() => handleSocialMock("Microsoft")}
                  className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-medium text-white transition-all duration-200"
                >
                  <svg className="w-4 h-4" viewBox="0 0 21 21">
                    <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                    <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                    <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                    <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                  </svg>
                  <span>Tiếp tục với Microsoft Account</span>
                </button>

                {/* Apple Button */}
                <button
                  type="button"
                  onClick={() => handleSocialMock("Apple")}
                  className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-medium text-white transition-all duration-200"
                >
                  <svg className="w-4 h-4 fill-current text-white" viewBox="0 0 170 170">
                    <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.7-7.85-12-14.42-6.53-9.98-11.66-21.36-15.4-34.13-3.74-12.77-5.61-24.87-5.61-36.31 0-14.3 3.58-26.31 10.73-36.03 7.15-9.72 16.32-14.65 27.5-14.79 4.35 0 9.38 1.15 15.09 3.44 5.71 2.3 9.4 3.51 11.07 3.65 1.56-.14 5.48-1.35 11.76-3.65 6.28-2.29 11.56-3.32 15.83-3.08 17.51 1.03 30.56 8.36 39.14 22-15.28 9.3-22.7 21.84-22.25 37.62.45 12.37 5.17 22.84 14.15 31.4 4.07 3.88 8.78 6.94 14.13 9.18-3.08 8.94-6.84 17.47-11.28 25.59zM119.22 33.5c0-7.39 2.62-14.34 7.86-20.85 5.23-6.52 11.75-10.87 19.55-13.06.33 1.11.49 2.22.49 3.33 0 7.39-2.67 14.47-8.01 21.24-5.34 6.78-11.8 11.13-19.39 13.06-.17-1.22-.5-2.46-.5-3.72z" />
                  </svg>
                  <span>Tiếp tục với Apple</span>
                </button>
              </div>

              {/* Divider */}
              <div className="relative flex items-center justify-center my-5">
                <div className="border-t border-white/10 w-full" />
                <span className="bg-[#111214] px-3 text-[11px] font-mono uppercase text-gray-500 relative">
                  hoặc tiếp tục với tài khoản
                </span>
              </div>

              {/* FORM ĐĂNG NHẬP */}
              {mode === "login" && (
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  {/* Username Field */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-gray-300">
                      Tên đăng nhập hoặc Email
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={loginUsername}
                        onChange={(e) => setLoginUsername(e.target.value)}
                        placeholder="Nhập username hoặc email của bạn..."
                        autoFocus
                        disabled={isSubmitting}
                        className="w-full bg-[#18191b] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#10a37f] focus:ring-1 focus:ring-[#10a37f] transition-all font-mono"
                      />
                      <span className="absolute right-3.5 top-2.5 text-gray-500">
                        <span className="material-symbols-outlined text-[17px]">account_circle</span>
                      </span>
                    </div>
                  </div>

                  {/* Password Field */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-medium text-gray-300">Mật khẩu</label>
                      <button
                        type="button"
                        onClick={() =>
                          onShowToast?.("Vui lòng liên hệ Quản trị viên hệ thống để khôi phục mật khẩu.")
                        }
                        className="text-[11px] text-[#1cd6a8] hover:underline"
                      >
                        Quên mật khẩu?
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showLoginPassword ? "text" : "password"}
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="Nhập mật khẩu..."
                        disabled={isSubmitting}
                        className="w-full bg-[#18191b] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#10a37f] focus:ring-1 focus:ring-[#10a37f] transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword((v) => !v)}
                        className="absolute right-3.5 top-2.5 text-gray-500 hover:text-gray-300"
                        title={showLoginPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                      >
                        <span className="material-symbols-outlined text-[17px]">
                          {showLoginPassword ? "visibility_off" : "visibility"}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Submit Action Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full mt-2 py-3 px-4 rounded-xl bg-[#10a37f] hover:bg-[#0e8e6e] text-black font-semibold text-xs tracking-wide transition-all shadow-[0_0_35px_-5px_rgba(16,163,127,0.35)] hover:shadow-lg flex items-center justify-center gap-2 group disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        <span>Đang xác thực bảo mật...</span>
                      </>
                    ) : (
                      <>
                        <span>Đăng nhập vào tài khoản</span>
                        <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* FORM ĐĂNG KÝ */}
              {mode === "register" && (
                <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                  {/* Username Field */}
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-gray-300">
                      Tên người dùng (Username) <span className="text-error">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                        placeholder="Ví dụ: nguyenvana (viết liền, không dấu)"
                        autoFocus
                        disabled={isSubmitting}
                        className="w-full bg-[#18191b] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#10a37f] focus:ring-1 focus:ring-[#10a37f] transition-all font-mono"
                      />
                      <span className="absolute right-3 top-2 text-gray-500">
                        <span className="material-symbols-outlined text-[16px]">alternate_email</span>
                      </span>
                    </div>
                  </div>

                  {/* Full Name Field */}
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-gray-300">Họ và tên hiển thị</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={regFullName}
                        onChange={(e) => setRegFullName(e.target.value)}
                        placeholder="Ví dụ: Nguyễn Văn A"
                        disabled={isSubmitting}
                        className="w-full bg-[#18191b] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#10a37f] focus:ring-1 focus:ring-[#10a37f] transition-all"
                      />
                      <span className="absolute right-3 top-2 text-gray-500">
                        <span className="material-symbols-outlined text-[16px]">badge</span>
                      </span>
                    </div>
                  </div>

                  {/* Email Field */}
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-gray-300">
                      Địa chỉ Email <span className="text-error">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="name@example.com"
                        disabled={isSubmitting}
                        className="w-full bg-[#18191b] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#10a37f] focus:ring-1 focus:ring-[#10a37f] transition-all font-mono"
                      />
                      <span className="absolute right-3 top-2 text-gray-500">
                        <span className="material-symbols-outlined text-[16px]">mail</span>
                      </span>
                    </div>
                  </div>

                  {/* Password Field */}
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-gray-300">
                      Mật khẩu bảo mật <span className="text-error">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showRegPassword ? "text" : "password"}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Mật khẩu ít nhất 8 ký tự..."
                        disabled={isSubmitting}
                        className="w-full bg-[#18191b] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#10a37f] focus:ring-1 focus:ring-[#10a37f] transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword((v) => !v)}
                        className="absolute right-3 top-2 text-gray-500 hover:text-gray-300"
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {showRegPassword ? "visibility_off" : "visibility"}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password Field */}
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-gray-300">
                      Xác nhận lại mật khẩu <span className="text-error">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showRegPassword ? "text" : "password"}
                        value={regConfirmPassword}
                        onChange={(e) => setRegConfirmPassword(e.target.value)}
                        placeholder="Nhập lại mật khẩu vừa đặt..."
                        disabled={isSubmitting}
                        className="w-full bg-[#18191b] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#10a37f] focus:ring-1 focus:ring-[#10a37f] transition-all"
                      />
                      <span className="absolute right-3 top-2 text-gray-500">
                        <span className="material-symbols-outlined text-[16px]">key</span>
                      </span>
                    </div>
                  </div>

                  {/* Checklist kiểm tra quy tắc mật khẩu thời gian thực */}
                  <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-1 text-[11px]">
                    <div className="text-gray-400 font-medium mb-1 flex items-center justify-between">
                      <span>Tiêu chuẩn mật khẩu an toàn:</span>
                      {isPasswordValid && pwdChecks.match ? (
                        <span className="text-[#10a37f] font-semibold flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">check_circle</span>
                          Đạt chuẩn
                        </span>
                      ) : (
                        <span className="text-outline text-[10px]">Chưa hoàn tất</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-gray-400">
                      <span className={pwdChecks.length ? "text-[#10a37f] flex items-center gap-1" : "flex items-center gap-1"}>
                        <span className="material-symbols-outlined text-[13px]">
                          {pwdChecks.length ? "check" : "radio_button_unchecked"}
                        </span>
                        Từ 8 ký tự trở lên
                      </span>
                      <span className={pwdChecks.uppercase ? "text-[#10a37f] flex items-center gap-1" : "flex items-center gap-1"}>
                        <span className="material-symbols-outlined text-[13px]">
                          {pwdChecks.uppercase ? "check" : "radio_button_unchecked"}
                        </span>
                        Có chữ in hoa (A-Z)
                      </span>
                      <span className={pwdChecks.lowercase ? "text-[#10a37f] flex items-center gap-1" : "flex items-center gap-1"}>
                        <span className="material-symbols-outlined text-[13px]">
                          {pwdChecks.lowercase ? "check" : "radio_button_unchecked"}
                        </span>
                        Có chữ in thường (a-z)
                      </span>
                      <span className={pwdChecks.number ? "text-[#10a37f] flex items-center gap-1" : "flex items-center gap-1"}>
                        <span className="material-symbols-outlined text-[13px]">
                          {pwdChecks.number ? "check" : "radio_button_unchecked"}
                        </span>
                        Có chữ số (0-9)
                      </span>
                      <span className={pwdChecks.special ? "text-[#10a37f] flex items-center gap-1" : "flex items-center gap-1"}>
                        <span className="material-symbols-outlined text-[13px]">
                          {pwdChecks.special ? "check" : "radio_button_unchecked"}
                        </span>
                        Ký tự đặc biệt (!@#...)
                      </span>
                      <span className={pwdChecks.match ? "text-[#10a37f] flex items-center gap-1" : "flex items-center gap-1"}>
                        <span className="material-symbols-outlined text-[13px]">
                          {pwdChecks.match ? "check" : "radio_button_unchecked"}
                        </span>
                        Mật khẩu trùng khớp
                      </span>
                    </div>
                  </div>

                  {/* Terms checkbox */}
                  <div className="pt-0.5">
                    <label className="flex items-start gap-2.5 cursor-pointer text-xs text-gray-400">
                      <input
                        type="checkbox"
                        checked={agreeTerms}
                        onChange={(e) => setAgreeTerms(e.target.checked)}
                        className="mt-0.5 rounded bg-[#18191b] border-white/10 text-[#10a37f] focus:ring-0"
                      />
                      <span>
                        Tôi đồng ý với{" "}
                        <button type="button" onClick={() => onShowToast?.("Điều khoản dịch vụ tiêu chuẩn.")} className="text-white hover:underline">
                          Điều khoản dịch vụ
                        </button>{" "}
                        và xác nhận đã đọc{" "}
                        <button type="button" onClick={() => onShowToast?.("Chính sách bảo mật quyền riêng tư.")} className="text-white hover:underline">
                          Chính sách quyền riêng tư
                        </button>{" "}
                        của hệ thống.
                      </span>
                    </label>
                  </div>

                  {/* Submit Action Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full mt-2 py-3 px-4 rounded-xl bg-[#10a37f] hover:bg-[#0e8e6e] text-black font-semibold text-xs tracking-wide transition-all shadow-[0_0_35px_-5px_rgba(16,163,127,0.35)] hover:shadow-lg flex items-center justify-center gap-2 group disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        <span>Đang khởi tạo tài khoản...</span>
                      </>
                    ) : (
                      <>
                        <span>Tạo tài khoản miễn phí</span>
                        <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Security Footnote */}
              <div className="mt-6 pt-5 border-t border-white/5 flex items-center justify-between text-[11px] text-gray-500 font-mono">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Bảo vệ bởi Cloudflare Zero Trust</span>
                </div>
                <span>v4.2025.04</span>
              </div>
            </div>

            {/* Secondary Links below card */}
            <div className="mt-5 text-center text-xs text-gray-400 space-y-2">
              <p>
                Bạn đang đại diện doanh nghiệp?{" "}
                <button
                  type="button"
                  onClick={() => onShowToast?.("Liên hệ phòng kinh doanh: enterprise@videcomp.ai")}
                  className="text-[#1cd6a8] hover:text-white font-medium underline-offset-4 hover:underline"
                >
                  Đăng ký bản dùng thử Videcomp-rag Enterprise
                </button>
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Minimal Footer */}
      <footer className="relative z-10 w-full px-6 py-4 border-t border-white/5 bg-[#080808]/80 text-[11px] text-gray-500 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div>
          © 2025 OpenAI, Inc. &amp; Videcomp-rag Ecosystem. Bản quyền đã được bảo lưu.
        </div>
        <div className="flex items-center gap-5">
          <button type="button" onClick={() => onShowToast?.("Điều khoản sử dụng hệ thống")} className="hover:text-gray-300 transition-colors">
            Điều khoản
          </button>
          <button type="button" onClick={() => onShowToast?.("Chính sách bảo mật dữ liệu tuân thủ ISO 27001")} className="hover:text-gray-300 transition-colors">
            Chính sách bảo mật
          </button>
          <button type="button" onClick={() => onShowToast?.("Tùy chọn Cookie & Dữ liệu phiên")} className="hover:text-gray-300 transition-colors">
            Tùy chọn Cookie
          </button>
          <button type="button" onClick={() => onShowToast?.("Trạng thái hệ thống: Hoạt động bình thường 99.9% uptime")} className="hover:text-gray-300 transition-colors">
            Trạng thái hệ thống (99.9%)
          </button>
        </div>
      </footer>
    </div>
  );
}
