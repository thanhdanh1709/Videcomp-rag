import { useState } from "react";

export function PricingModal({
  isOpen,
  onClose,
  onShowToast,
}: {
  isOpen: boolean;
  onClose: () => void;
  onShowToast?: (msg: string) => void;
}) {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  if (!isOpen) return null;

  const faqs = [
    {
      q: "Những phương thức thanh toán nào được chấp nhận?",
      a: "Chúng tôi hỗ trợ thẻ quốc tế (Visa, Mastercard, JCB), chuyển khoản ngân hàng nội địa (VietQR) và cổng thanh toán doanh nghiệp.",
    },
    {
      q: "Tôi có thể hủy gói đăng ký bất cứ lúc nào không?",
      a: "Có, bạn có thể hủy gói bất kỳ lúc nào chỉ với 1 cú nhấp chuột trong mục Cài đặt tài khoản mà không phát sinh thêm chi phí.",
    },
    {
      q: "Có hỗ trợ xuất hóa đơn VAT điện tử cho doanh nghiệp không?",
      a: "Có, hệ thống tự động xuất hóa đơn VAT điện tử hợp lệ theo quy định của Bộ Tài chính gửi về email của tổ chức.",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-unit-md md:p-unit-xl overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-surface-container-lowest/80 backdrop-blur-md"
        onClick={onClose}
      />
      <div className="absolute w-[600px] h-[600px] rounded-full bg-primary/5 blur-[140px] pointer-events-none -top-20" />

      {/* Modal Dialog */}
      <div className="relative z-10 w-full max-w-5xl my-auto bg-surface-container-low rounded-2xl shadow-2xl flex flex-col overflow-hidden text-on-surface border border-outline-variant/30 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-unit-xl py-unit-md border-b border-outline-variant/30">
          <div className="inline-flex items-center gap-2 px-unit-sm py-1 rounded-full bg-primary-container/20 text-primary text-label-sm font-semibold">
            <span className="material-symbols-outlined text-[16px]">bolt</span>
            Mở khóa toàn bộ tiềm năng AI thế hệ mới
          </div>
          <button
            className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
            onClick={onClose}
            title="Đóng"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-unit-xl flex flex-col gap-unit-xl overflow-y-auto max-h-[80vh] scrollbar-none">
          {/* Title & Subtitle */}
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2 className="font-display-lg text-display-lg text-on-surface font-bold tracking-tight">
              Nâng cấp gói dịch vụ Videcomp-rag
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Trải nghiệm sức mạnh tối đa của trí tuệ nhân tạo với khả năng phân rã câu hỏi mở rộng,
              truy hồi tài liệu pháp luật, y tế và duyệt tri thức không giới hạn.
            </p>

            {/* Chu kỳ thanh toán */}
            <div className="inline-flex items-center p-1 rounded-full bg-surface-container border border-outline-variant/30 mt-unit-sm">
              <button
                type="button"
                onClick={() => setBillingCycle("monthly")}
                className={`px-unit-lg py-1.5 rounded-full font-label-md text-label-md transition-all ${
                  billingCycle === "monthly"
                    ? "bg-surface-container-highest text-on-surface font-semibold shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Thanh toán hàng tháng
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle("yearly")}
                className={`flex items-center gap-1.5 px-unit-lg py-1.5 rounded-full font-label-md text-label-md transition-all ${
                  billingCycle === "yearly"
                    ? "bg-surface-container-highest text-on-surface font-semibold shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <span>Hàng năm</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-on-primary">
                  -16%
                </span>
              </button>
            </div>
          </div>

          {/* Lưới 3 Gói Giá Dịch Vụ */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-unit-md items-stretch">
            {/* Gói Miễn phí */}
            <div className="flex flex-col justify-between p-unit-lg rounded-2xl bg-surface-container border border-outline-variant/30">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                    Miễn phí
                  </h3>
                  <span className="text-label-sm text-outline px-2 py-0.5 rounded-full bg-surface-container-high">
                    Hiện tại
                  </span>
                </div>
                <p className="text-body-sm text-on-surface-variant">
                  Dành cho nhu cầu tra cứu và trải nghiệm tác vụ cơ bản hàng ngày.
                </p>
                <div className="text-[32px] font-bold text-on-surface">
                  $0{" "}
                  <span className="text-body-sm text-outline font-normal">/ tháng</span>
                </div>

                <ul className="space-y-2.5 pt-2 text-body-sm text-on-surface-variant">
                  <li className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-primary">check</span>
                    Truy cập mô hình Dense RAG (B0)
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-primary">check</span>
                    Hỏi đáp văn bản pháp luật cơ bản
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-primary">check</span>
                    Tốc độ xử lý tiêu chuẩn
                  </li>
                </ul>
              </div>

              <button
                type="button"
                disabled
                className="w-full py-2.5 rounded-DEFAULT bg-surface-container-high text-outline text-label-md font-semibold mt-6 cursor-not-allowed"
              >
                Gói hiện tại
              </button>
            </div>

            {/* Gói Plus - Nổi bật */}
            <div className="relative flex flex-col justify-between p-unit-lg rounded-2xl bg-surface-container-high border-2 border-primary shadow-xl scale-[1.02]">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-unit-md py-0.5 rounded-full bg-primary text-on-primary font-label-sm text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-md">
                <span className="material-symbols-outlined text-[14px]">star</span>
                Được khuyến nghị
              </div>

              <div className="space-y-4 pt-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                    Plus
                  </h3>
                  <span className="text-label-sm text-primary font-semibold">Phổ biến nhất</span>
                </div>
                <p className="text-body-sm text-on-surface-variant">
                  Mở rộng năng lực phân tích đa bước, kiểm chứng mâu thuẫn &amp; Voice mode.
                </p>
                <div className="text-[32px] font-bold text-on-surface">
                  {billingCycle === "monthly" ? "$20" : "$16.8"}{" "}
                  <span className="text-body-sm text-outline font-normal">/ tháng</span>
                </div>

                <ul className="space-y-2.5 pt-2 text-body-sm text-on-surface">
                  <li className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-primary">check</span>
                    Không giới hạn phân rã Q3 ViDecomp đầy đủ
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-primary">check</span>
                    Trải nghiệm Chế độ giọng nói (Voice Mode)
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-primary">check</span>
                    Tạo và tùy chỉnh chuyên gia riêng (GPT Builder)
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-primary">check</span>
                    Tốc độ phản hồi ưu tiên cao gấp 3 lần
                  </li>
                </ul>
              </div>

              <button
                type="button"
                onClick={() => {
                  onShowToast?.("Đã kích hoạt quyền lợi gói Videcomp-rag Plus thành công!");
                  onClose();
                }}
                className="w-full py-2.5 rounded-DEFAULT bg-primary text-on-primary font-label-md font-bold hover:opacity-90 active:scale-98 transition-all mt-6 flex items-center justify-center gap-2 shadow-lg"
              >
                <span>Nâng cấp lên Plus</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            </div>

            {/* Gói Team / Pro */}
            <div className="flex flex-col justify-between p-unit-lg rounded-2xl bg-surface-container border border-outline-variant/30">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                    Team / Pro
                  </h3>
                  <span className="text-label-sm text-outline px-2 py-0.5 rounded-full bg-surface-container-high">
                    Doanh nghiệp
                  </span>
                </div>
                <p className="text-body-sm text-on-surface-variant">
                  Hợp tác an toàn cùng đội ngũ với hạn mức vận hành tối đa và API chuyên biệt.
                </p>
                <div className="text-[32px] font-bold text-on-surface">
                  $25 - $200{" "}
                  <span className="text-body-sm text-outline font-normal">/ người/tháng</span>
                </div>

                <ul className="space-y-2.5 pt-2 text-body-sm text-on-surface-variant">
                  <li className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-primary">check</span>
                    Tất cả quyền lợi của gói Plus
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-primary">check</span>
                    Không gian làm việc chung (Shared Workspace)
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-primary">check</span>
                    Bảo mật: Không dùng dữ liệu người dùng để huấn luyện
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-primary">check</span>
                    Hỗ trợ SLA 99.9% 24/7
                  </li>
                </ul>
              </div>

              <button
                type="button"
                onClick={() => {
                  onShowToast?.("Đã ghi nhận yêu cầu tư vấn gói Doanh nghiệp.");
                  onClose();
                }}
                className="w-full py-2.5 rounded-DEFAULT bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md font-semibold transition-colors mt-6"
              >
                Nâng cấp cho Nhóm
              </button>
            </div>
          </div>

          {/* Khối bảo mật */}
          <div className="p-unit-md rounded-xl bg-surface-container flex items-center justify-between flex-wrap gap-4 border border-outline-variant/20">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-[28px]">verified</span>
              <div>
                <div className="font-semibold text-label-md text-on-surface">
                  Tiêu chuẩn bảo mật và quyền riêng tư
                </div>
                <div className="text-body-sm text-on-surface-variant">
                  Tất cả dữ liệu hội thoại cá nhân được mã hóa chuẩn TLS 1.3 và lưu trữ an toàn theo
                  tiêu chuẩn SOC 2.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-unit-sm py-1 rounded bg-surface-container-highest text-outline text-label-sm font-mono font-semibold">
                SOC 2 Type II
              </span>
              <span className="px-unit-sm py-1 rounded bg-surface-container-highest text-outline text-label-sm font-mono font-semibold">
                CCPA &amp; GDPR
              </span>
            </div>
          </div>

          {/* Khối FAQ Accordion */}
          <div className="space-y-unit-sm">
            <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface text-center">
              Câu hỏi thường gặp
            </h3>
            <div className="space-y-2">
              {faqs.map((faq, idx) => {
                const isOpenFaq = openFaq === idx;
                return (
                  <div
                    key={idx}
                    className="rounded-DEFAULT bg-surface-container border border-outline-variant/20 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpenFaq ? null : idx)}
                      className="w-full p-unit-md flex items-center justify-between text-left text-on-surface font-semibold text-label-md hover:bg-surface-container-high transition-colors"
                    >
                      <span>{faq.q}</span>
                      <span className="material-symbols-outlined text-outline">
                        {isOpenFaq ? "expand_less" : "expand_more"}
                      </span>
                    </button>
                    {isOpenFaq && (
                      <div className="px-unit-md pb-unit-md text-body-sm text-on-surface-variant leading-relaxed">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
