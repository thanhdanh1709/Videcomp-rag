import { useEffect, useState } from "react";
import type { ShareConfig, SharedMember } from "../api/types";
import {
  apiGetSessionShare,
  apiUpdateSessionShare,
  apiGetProjectShare,
  apiUpdateProjectShare,
} from "../api/client";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: "session" | "project";
  targetId: string;
  targetTitle?: string;
  onShowToast?: (msg: string) => void;
}

export function ShareModal({
  isOpen,
  onClose,
  targetType,
  targetId,
  targetTitle = "",
  onShowToast,
}: ShareModalProps) {
  const [config, setConfig] = useState<ShareConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newRole, setNewRole] = useState<"viewer" | "editor">("viewer");

  useEffect(() => {
    if (!isOpen || !targetId) return;
    setIsLoading(true);
    const fetchConfig = async () => {
      try {
        const res =
          targetType === "session"
            ? await apiGetSessionShare(targetId)
            : await apiGetProjectShare(targetId);
        setConfig(res);
      } catch (err: any) {
        onShowToast?.(err.message || "Không thể tải thông tin chia sẻ.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchConfig();
  }, [isOpen, targetId, targetType]);

  if (!isOpen) return null;

  const shareParam = targetType === "session" ? "share" : "share_project";
  const shareUrl = config?.shareToken
    ? `${window.location.origin}${window.location.pathname}?${shareParam}=${encodeURIComponent(config.shareToken)}`
    : window.location.href;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    onShowToast?.("Đã sao chép liên kết chia sẻ vào bộ nhớ tạm!");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleTogglePublic = async () => {
    if (!config) return;
    const nextPublic = !config.isPublic;
    setIsSaving(true);
    try {
      const updatePayload = {
        is_public: nextPublic,
        shared_with: config.sharedWith,
      };
      const res =
        targetType === "session"
          ? await apiUpdateSessionShare(targetId, updatePayload)
          : await apiUpdateProjectShare(targetId, updatePayload);
      setConfig(res);
      onShowToast?.(nextPublic ? "Đã bật chế độ chia sẻ công khai qua liên kết" : "Đã chuyển sang chế độ riêng tư");
    } catch (err: any) {
      onShowToast?.(err.message || "Lỗi khi cập nhật quyền truy cập.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config || !newUsername.trim()) return;
    const usernameClean = newUsername.trim().toLowerCase();
    if (config.sharedWith.some((m) => m.username.toLowerCase() === usernameClean)) {
      onShowToast?.("Thành viên này đã có trong danh sách cộng tác.");
      return;
    }

    const updatedList: SharedMember[] = [
      ...config.sharedWith,
      { username: usernameClean, role: newRole },
    ];

    setIsSaving(true);
    try {
      const updatePayload = {
        is_public: config.isPublic,
        shared_with: updatedList,
      };
      const res =
        targetType === "session"
          ? await apiUpdateSessionShare(targetId, updatePayload)
          : await apiUpdateProjectShare(targetId, updatePayload);
      setConfig(res);
      setNewUsername("");
      onShowToast?.(`Đã cấp quyền ${newRole === "editor" ? "Cùng thảo luận" : "Chỉ xem"} cho ${usernameClean}`);
    } catch (err: any) {
      onShowToast?.(err.message || "Lỗi khi thêm thành viên.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveMember = async (usernameToRemove: string) => {
    if (!config) return;
    const updatedList = config.sharedWith.filter(
      (m) => m.username.toLowerCase() !== usernameToRemove.toLowerCase()
    );

    setIsSaving(true);
    try {
      const updatePayload = {
        is_public: config.isPublic,
        shared_with: updatedList,
      };
      const res =
        targetType === "session"
          ? await apiUpdateSessionShare(targetId, updatePayload)
          : await apiUpdateProjectShare(targetId, updatePayload);
      setConfig(res);
      onShowToast?.(`Đã gỡ quyền truy cập của ${usernameToRemove}`);
    } catch (err: any) {
      onShowToast?.(err.message || "Lỗi khi xóa thành viên.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangeMemberRole = async (username: string, newRoleVal: "viewer" | "editor") => {
    if (!config) return;
    const updatedList = config.sharedWith.map((m) =>
      m.username.toLowerCase() === username.toLowerCase() ? { ...m, role: newRoleVal } : m
    );

    setIsSaving(true);
    try {
      const updatePayload = {
        is_public: config.isPublic,
        shared_with: updatedList,
      };
      const res =
        targetType === "session"
          ? await apiUpdateSessionShare(targetId, updatePayload)
          : await apiUpdateProjectShare(targetId, updatePayload);
      setConfig(res);
      onShowToast?.(`Đã cập nhật quyền thành "${newRoleVal === "editor" ? "Cùng thảo luận" : "Chỉ xem"}"`);
    } catch (err: any) {
      onShowToast?.(err.message || "Lỗi khi cập nhật quyền.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegenerateToken = async () => {
    if (!config) return;
    if (!window.confirm("Tạo mới đường liên kết sẽ vô hiệu hóa tất cả các liên kết chia sẻ trước đó. Bạn có chắc chắn không?")) {
      return;
    }

    setIsSaving(true);
    try {
      const updatePayload = {
        regenerate_token: true,
      };
      const res =
        targetType === "session"
          ? await apiUpdateSessionShare(targetId, updatePayload)
          : await apiUpdateProjectShare(targetId, updatePayload);
      setConfig(res);
      onShowToast?.("Đã tạo mới đường liên kết chia sẻ bảo mật!");
    } catch (err: any) {
      onShowToast?.(err.message || "Lỗi khi đổi liên kết.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className="bg-surface-container-high border border-outline-variant/40 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-on-surface relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[24px]">group_add</span>
            </div>
            <div>
              <h3 className="text-[18px] font-bold text-on-surface">
                {targetType === "session" ? "Chia sẻ Phiên tra cứu" : "Cộng tác Thư mục Dự án"}
              </h3>
              <p className="text-[12px] text-on-surface-variant line-clamp-1">
                {targetTitle || config?.title || "Không gian làm việc nhóm"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-outline hover:text-on-surface hover:bg-surface-container-highest transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-outline">
            <span className="material-symbols-outlined text-[32px] animate-spin text-primary">
              progress_activity
            </span>
            <span className="text-[13px]">Đang tải cấu hình chia sẻ...</span>
          </div>
        ) : (
          <>
            {/* Hộp sao chép liên kết chia sẻ */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[12px]">
                <span className="font-semibold text-on-surface">Đường liên kết chia sẻ bảo mật</span>
                <button
                  type="button"
                  onClick={handleRegenerateToken}
                  disabled={isSaving}
                  className="text-primary hover:underline flex items-center gap-1 text-[11px]"
                  title="Tạo lại mã liên kết mới để hủy liên kết cũ"
                >
                  <span className="material-symbols-outlined text-[13px]">restart_alt</span>
                  <span>Đổi mã liên kết</span>
                </button>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-surface-container border border-outline-variant/40">
                <span className="material-symbols-outlined text-outline text-[18px] ml-1">link</span>
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="flex-1 bg-transparent border-none text-[12px] text-on-surface font-mono outline-none select-all"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all flex items-center gap-1.5 shadow-sm ${
                    copied
                      ? "bg-primary text-on-primary"
                      : "bg-surface-container-highest hover:bg-primary/20 text-primary border border-primary/30"
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {copied ? "check" : "content_copy"}
                  </span>
                  <span>{copied ? "Đã chép" : "Sao chép"}</span>
                </button>
              </div>
            </div>

            {/* Chế độ chia sẻ công khai vs riêng tư */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-surface-container/70 border border-outline-variant/30">
              <div className="flex items-center gap-2.5">
                <span className={`material-symbols-outlined text-[22px] ${config?.isPublic ? "text-emerald-500" : "text-amber-500"}`}>
                  {config?.isPublic ? "public" : "lock"}
                </span>
                <div>
                  <div className="text-[13px] font-bold text-on-surface">
                    {config?.isPublic ? "Ai có liên kết đều xem được" : "Chỉ người được mời mới xem được"}
                  </div>
                  <div className="text-[11px] text-on-surface-variant">
                    {config?.isPublic
                      ? "Bất kỳ ai có đường link trên đều có quyền Chỉ xem (Viewer)"
                      : "Yêu cầu đăng nhập và được thêm vào danh sách bên dưới"}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleTogglePublic}
                disabled={isSaving}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  config?.isPublic ? "bg-primary" : "bg-outline-variant/40"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    config?.isPublic ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Thêm thành viên cộng tác */}
            <form onSubmit={handleAddMember} className="space-y-1.5">
              <label className="text-[12px] font-semibold text-on-surface block">
                Mời đồng nghiệp trong phòng ban
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Nhập tên đăng nhập hoặc email..."
                  className="flex-1 px-3 py-2 rounded-xl bg-surface-container border border-outline-variant/40 focus:border-primary focus:outline-none text-[13px] text-on-surface"
                />
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as "viewer" | "editor")}
                  className="px-3 py-2 rounded-xl bg-surface-container border border-outline-variant/40 focus:border-primary focus:outline-none text-[12px] text-on-surface font-medium"
                >
                  <option value="viewer">Chỉ xem</option>
                  <option value="editor">Cùng thảo luận</option>
                </select>
                <button
                  type="submit"
                  disabled={isSaving || !newUsername.trim()}
                  className="px-3.5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-on-primary text-[12px] font-bold shadow-sm transition-all disabled:opacity-50"
                >
                  Thêm
                </button>
              </div>
            </form>

            {/* Danh sách người có quyền truy cập */}
            <div className="space-y-2">
              <span className="text-[12px] font-semibold text-on-surface block">
                Thành viên có quyền truy cập ({1 + (config?.sharedWith.length || 0)})
              </span>
              <div className="max-h-40 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                {/* Chủ sở hữu */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container/40 border border-outline-variant/20">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-[12px]">
                      {config?.owner?.[0]?.toUpperCase() || "O"}
                    </div>
                    <div>
                      <div className="text-[13px] font-bold text-on-surface">{config?.owner || "Bạn"}</div>
                      <div className="text-[11px] text-outline">Chủ sở hữu</div>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant">
                    Toàn quyền
                  </span>
                </div>

                {/* Danh sách thành viên được chia sẻ */}
                {config?.sharedWith.map((m) => (
                  <div
                    key={m.username}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container/40 border border-outline-variant/20 hover:bg-surface-container/70 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-secondary/20 text-secondary flex items-center justify-center font-bold text-[12px]">
                        {m.username[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div className="text-[13px] font-medium text-on-surface">{m.username}</div>
                        {m.shared_at && (
                          <div className="text-[10px] text-outline">Thêm ngày {m.shared_at}</div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={m.role}
                        onChange={(e) =>
                          handleChangeMemberRole(m.username, e.target.value as "viewer" | "editor")
                        }
                        disabled={isSaving}
                        className="px-2 py-1 rounded-lg bg-surface-container border border-outline-variant/30 text-[11px] text-on-surface font-semibold"
                      >
                        <option value="viewer">Chỉ xem</option>
                        <option value="editor">Cùng thảo luận</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(m.username)}
                        disabled={isSaving}
                        className="p-1 rounded-lg hover:bg-rose-500/10 text-outline hover:text-rose-500 transition-colors"
                        title="Gỡ quyền"
                      >
                        <span className="material-symbols-outlined text-[16px]">person_remove</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Nút đóng */}
            <div className="flex items-center justify-end pt-2 border-t border-outline-variant/20">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-surface-container-highest hover:bg-primary hover:text-on-primary text-on-surface text-[13px] font-bold transition-all"
              >
                Xong
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
