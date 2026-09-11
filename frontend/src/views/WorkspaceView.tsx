import { useState, useMemo } from "react";
import type { HistoryEntry, SessionGroup } from "../hooks/useHistory";
import { groupSessions } from "../hooks/useHistory";
import type { ProjectFolder } from "../types/project";

const AVAILABLE_FOLDER_ICONS = [
  { id: "folder", label: "Chung" },
  { id: "gavel", label: "Pháp luật" },
  { id: "apartment", label: "Đất đai" },
  { id: "medical_services", label: "Y tế" },
  { id: "science", label: "Nghiên cứu" },
  { id: "balance", label: "Tố tụng" },
  { id: "menu_book", label: "Học thuật" },
  { id: "description", label: "Tài liệu" },
  { id: "policy", label: "Chính sách" },
  { id: "hub", label: "Hệ thống" },
];

export function WorkspaceView({
  history,
  projects,
  onCreateProject,
  onDeleteProject,
  onAssignSessionFolder,
  onAssignSessionsFolder,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onShowToast,
}: {
  history: HistoryEntry[];
  projects: ProjectFolder[];
  onCreateProject: (folder: Omit<ProjectFolder, "id" | "createdAt">) => void;
  onDeleteProject: (id: string) => void;
  onAssignSessionFolder: (sessionId: string, folderId: string | null) => void;
  onAssignSessionsFolder: (sessionIds: string[], folderId: string | null) => void;
  onSelectSession: (group: SessionGroup) => void;
  onNewChat: () => void;
  onDeleteSession: (sessionId: string) => void;
  onShowToast?: (msg: string) => void;
}) {
  const [activeTimeFilter, setActiveTimeFilter] = useState<"all" | "7d" | "30d">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modal tạo thư mục mới
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newIcon, setNewIcon] = useState("folder");

  // Dropdown gán thư mục cho từng session
  const [activeDropdownSessionId, setActiveDropdownSessionId] = useState<string | null>(null);

  const sessionGroups = useMemo(() => groupSessions(history), [history]);

  // Thống kê động cho từng thư mục
  const folderStats = useMemo(() => {
    const stats: Record<
      string,
      { chats: number; lastTime: string; activity: number; files: number }
    > = {};

    for (const p of projects) {
      const inFolder = sessionGroups.filter((g) => g.folderId === p.id);
      const chats = inFolder.length;
      let lastTime = "Mới tạo";
      if (chats > 0) {
        const newest = inFolder[0].lastCreatedAt;
        const diffHours = Math.floor(
          (Date.now() - new Date(newest).getTime()) / (1000 * 3600)
        );
        if (diffHours < 1) lastTime = "Vừa xong";
        else if (diffHours < 24) lastTime = `${diffHours} giờ trước`;
        else lastTime = `${Math.floor(diffHours / 24)} ngày trước`;
      }
      const activity = chats > 0 ? Math.min(98, 25 + chats * 15) : 0;
      stats[p.id] = { chats, lastTime, activity, files: chats * 2 };
    }
    return stats;
  }, [projects, sessionGroups]);

  // Lọc danh sách hội thoại
  const filteredSessions = useMemo(() => {
    return sessionGroups.filter((g) => {
      // Lọc theo thư mục đã chọn
      if (selectedFolderId && g.folderId !== selectedFolderId) {
        return false;
      }

      // Lọc theo thời gian
      if (activeTimeFilter !== "all") {
        const days = activeTimeFilter === "7d" ? 7 : 30;
        const cutoff = Date.now() - days * 24 * 3600 * 1000;
        if (new Date(g.lastCreatedAt).getTime() < cutoff) return false;
      }

      // Lọc theo từ khóa tìm kiếm
      const firstQ = g.turns[0]?.question || "";
      return firstQ.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [sessionGroups, selectedFolderId, activeTimeFilter, searchTerm]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === filteredSessions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredSessions.map((g) => g.sessionId));
    }
  };

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      onShowToast?.("Vui lòng nhập tên thư mục!");
      return;
    }

    onCreateProject({
      title: newTitle.trim(),
      desc: newDesc.trim() || "Thư mục chuyên đề nghiên cứu.",
      icon: newIcon,
    });

    onShowToast?.(`Đã tạo thư mục "${newTitle.trim()}" thành công!`);
    setNewTitle("");
    setNewDesc("");
    setNewIcon("folder");
    setIsCreateModalOpen(false);
  };

  const handleBulkAssign = (targetFolderId: string | null) => {
    if (selectedIds.length === 0) return;
    onAssignSessionsFolder(selectedIds, targetFolderId);
    const folderName = projects.find((p) => p.id === targetFolderId)?.title || "Chưa phân loại";
    onShowToast?.(`Đã chuyển ${selectedIds.length} đoạn chat vào "${folderName}"`);
    setSelectedIds([]);
  };

  return (
    <div
      className="flex-1 overflow-y-auto pt-16 pb-24 px-unit-lg lg:px-unit-2xl scrollbar-none bg-surface"
      onClick={() => setActiveDropdownSessionId(null)}
    >
      <div className="w-full max-w-7xl mx-auto flex flex-col gap-unit-xl">
        {/* Workspace Header */}
        <section className="flex flex-col md:flex-row md:items-center md:justify-between gap-unit-md">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-unit-xs py-0.5 rounded-full bg-surface-container text-primary text-[11px] font-semibold border border-outline-variant/30">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              WORKSPACE 01 • Đồng bộ hoá tự động
            </div>
            <h1 className="font-display-lg text-display-lg font-bold text-on-surface tracking-tight">
              Lịch sử trò chuyện &amp; Dự án
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
              Tổ chức các cuộc trò chuyện phân loại theo thư mục dự án, quản lý tài nguyên nghiên
              cứu pháp luật/y tế của Videcomp-rag.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 px-unit-lg py-2.5 rounded-full bg-surface-container-high hover:bg-surface-container-highest text-on-surface border border-outline-variant/30 font-label-md font-semibold transition-all"
            >
              <span className="material-symbols-outlined text-primary text-[20px]">create_new_folder</span>
              <span>Tạo Thư mục mới</span>
            </button>
            <button
              type="button"
              onClick={onNewChat}
              className="flex items-center gap-2 px-unit-lg py-2.5 rounded-full bg-primary text-on-primary font-label-md font-bold hover:opacity-90 shadow-md transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
              <span>Đoạn chat mới</span>
            </button>
          </div>
        </section>

        {/* Filter & Search Bar */}
        <section className="flex flex-col md:flex-row items-center justify-between gap-unit-sm bg-surface-container p-unit-sm rounded-xl border border-outline-variant/30">
          <div className="flex items-center gap-2 w-full md:max-w-md px-unit-md py-1.5 rounded-DEFAULT bg-surface-container-high border border-outline-variant/30 focus-within:border-primary/50">
            <span className="material-symbols-outlined text-outline text-[20px]">search</span>
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tiêu đề câu hỏi hoặc từ khóa..."
              className="w-full bg-transparent border-0 outline-none text-on-surface text-label-md placeholder:text-outline"
            />
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto">
            <div className="inline-flex items-center p-0.5 rounded-full bg-surface-container-high border border-outline-variant/30">
              <button
                type="button"
                onClick={() => setActiveTimeFilter("all")}
                className={`px-unit-md py-1 rounded-full text-label-sm transition-all ${
                  activeTimeFilter === "all"
                    ? "bg-surface-container-highest text-on-surface font-semibold shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Tất cả
              </button>
              <button
                type="button"
                onClick={() => setActiveTimeFilter("7d")}
                className={`px-unit-md py-1 rounded-full text-label-sm transition-all ${
                  activeTimeFilter === "7d"
                    ? "bg-surface-container-highest text-on-surface font-semibold shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                7 ngày qua
              </button>
              <button
                type="button"
                onClick={() => setActiveTimeFilter("30d")}
                className={`px-unit-md py-1 rounded-full text-label-sm transition-all ${
                  activeTimeFilter === "30d"
                    ? "bg-surface-container-highest text-on-surface font-semibold shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                30 ngày qua
              </button>
            </div>
          </div>
        </section>

        {/* MỤC 4: THƯ MỤC DỰ ÁN ĐANG HOẠT ĐỘNG */}
        <section className="space-y-unit-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">folder_open</span>
              <h2 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                Thư mục chuyên đề đang hoạt động
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {selectedFolderId && (
                <button
                  type="button"
                  onClick={() => setSelectedFolderId(null)}
                  className="text-[12px] text-primary hover:underline flex items-center gap-1 font-semibold"
                >
                  <span className="material-symbols-outlined text-[14px]">clear</span>
                  <span>Hiện tất cả thư mục</span>
                </button>
              )}
              <span className="text-label-sm text-outline">{projects.length} Thư mục</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-unit-md">
            {projects.map((p) => {
              const stat = folderStats[p.id] || { chats: 0, lastTime: "Mới tạo", activity: 0, files: 0 };
              const isSelected = selectedFolderId === p.id;

              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedFolderId(isSelected ? null : p.id)}
                  className={`p-unit-md rounded-xl transition-all flex flex-col justify-between gap-unit-sm shadow-sm group cursor-pointer relative ${
                    isSelected
                      ? "bg-surface-container-high border-2 border-primary shadow-lg ring-1 ring-primary/30"
                      : "bg-surface-container-low hover:bg-surface-container border border-outline-variant/30 hover:border-primary/40"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-outline text-[12px]">
                      <span className="material-symbols-outlined text-primary text-[22px]">
                        {p.icon}
                      </span>
                      <div className="flex items-center gap-1">
                        {isSelected && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary text-on-primary">
                            Đang lọc
                          </span>
                        )}
                        <span>{stat.lastTime}</span>
                      </div>
                    </div>

                    <h3 className="font-headline-sm text-[16px] font-bold text-on-surface group-hover:text-primary transition-colors">
                      {p.title}
                    </h3>
                    <p className="text-body-sm text-[13px] text-on-surface-variant line-clamp-2">
                      {p.desc}
                    </p>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-outline-variant/20">
                    <div className="flex justify-between items-center text-[12px] text-outline">
                      <span>Mức độ hoạt động</span>
                      <span className="text-on-surface font-semibold">{stat.activity}%</span>
                    </div>
                    <div className="w-full bg-surface-container-lowest h-1.5 rounded-full overflow-hidden">
                      <div className="bg-primary h-full rounded-full transition-all duration-500" style={{ width: `${stat.activity}%` }} />
                    </div>
                    <div className="flex justify-between items-center text-[12px] text-outline pt-1">
                      <span className="text-primary font-medium">{stat.chats} đoạn chat</span>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Xóa thư mục "${p.title}"? Các đoạn chat sẽ được chuyển về Chưa phân loại.`)) {
                              onDeleteProject(p.id);
                              if (selectedFolderId === p.id) setSelectedFolderId(null);
                              onShowToast?.(`Đã xóa thư mục "${p.title}"`);
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 hover:text-error transition-opacity"
                          title="Xóa thư mục"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Bảng dữ liệu: Danh sách cuộc hội thoại */}
        <section className="space-y-unit-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                {selectedFolderId
                  ? `Cuộc hội thoại trong thư mục "${projects.find((p) => p.id === selectedFolderId)?.title}"`
                  : "Tất cả cuộc hội thoại"}{" "}
                ({filteredSessions.length} bản ghi)
              </h2>
              {selectedFolderId && (
                <button
                  type="button"
                  onClick={() => setSelectedFolderId(null)}
                  className="px-2 py-0.5 rounded-full bg-surface-container-high text-[11px] text-outline hover:text-on-surface border border-outline-variant/30 flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[13px]">close</span>
                  <span>Bỏ lọc thư mục</span>
                </button>
              )}
            </div>

            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2 animate-in fade-in duration-150">
                <span className="text-label-sm text-primary font-semibold">Đã chọn {selectedIds.length} mục</span>

                {/* Dropdown chuyển thư mục hàng loạt */}
                <select
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val) handleBulkAssign(val === "none" ? null : val);
                  }}
                  defaultValue=""
                  className="px-2.5 py-1 rounded-DEFAULT bg-surface-container-high text-on-surface text-label-sm border border-outline-variant/40 outline-none focus:border-primary"
                >
                  <option value="" disabled>Chuyển thư mục...</option>
                  <option value="none">-- Bỏ phân loại --</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    selectedIds.forEach((id) => onDeleteSession(id));
                    setSelectedIds([]);
                    onShowToast?.("Đã xóa các mục đã chọn");
                  }}
                  className="px-unit-sm py-1 rounded bg-error-container/20 text-error text-label-sm font-semibold hover:bg-error-container/30 transition-colors"
                >
                  Xóa các mục
                </button>
              </div>
            )}
          </div>

          <div className="w-full overflow-x-auto rounded-xl bg-surface-container border border-outline-variant/30 shadow-sm">
            <table className="w-full text-left font-body-sm text-body-sm border-collapse">
              <thead>
                <tr className="bg-surface-container-high text-on-surface font-label-md text-label-md border-b border-outline-variant/30">
                  <th className="p-unit-sm pl-unit-md w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === filteredSessions.length && filteredSessions.length > 0}
                      onChange={selectAll}
                      className="rounded accent-primary cursor-pointer"
                    />
                  </th>
                  <th className="p-unit-sm">Tên cuộc trò chuyện</th>
                  <th className="p-unit-sm">Thư mục Dự án</th>
                  <th className="p-unit-sm">Mô hình</th>
                  <th className="p-unit-sm">Lĩnh vực</th>
                  <th className="p-unit-sm">Ngày tạo</th>
                  <th className="p-unit-sm text-right pr-unit-md">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20 text-on-surface-variant">
                {filteredSessions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-outline">
                      {selectedFolderId
                        ? "Thư mục này chưa có cuộc trò chuyện nào. Hãy gán hội thoại hoặc tạo mới!"
                        : "Chưa có dữ liệu hội thoại nào trong không gian này."}
                    </td>
                  </tr>
                ) : (
                  filteredSessions.map((group) => {
                    const first = group.turns[0];
                    const isChecked = selectedIds.includes(group.sessionId);
                    const currentFolder = projects.find((p) => p.id === group.folderId);
                    const isDropdownOpen = activeDropdownSessionId === group.sessionId;

                    return (
                      <tr
                        key={group.sessionId}
                        className="hover:bg-surface-container-high/60 transition-colors cursor-pointer"
                        onClick={() => onSelectSession(group)}
                      >
                        <td
                          className="p-unit-sm pl-unit-md"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelect(group.sessionId);
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="rounded accent-primary cursor-pointer"
                          />
                        </td>
                        <td className="p-unit-sm font-medium text-on-surface max-w-xs sm:max-w-md truncate">
                          {first?.question}
                        </td>

                        {/* Cột Thư mục Dự án có thể gán nhanh */}
                        <td
                          className="p-unit-sm relative"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setActiveDropdownSessionId(isDropdownOpen ? null : group.sessionId)
                            }
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium border transition-all ${
                              currentFolder
                                ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
                                : "bg-surface-container border-outline-variant/30 text-outline hover:text-on-surface"
                            }`}
                          >
                            <span className="material-symbols-outlined text-[15px]">
                              {currentFolder?.icon || "folder"}
                            </span>
                            <span className="truncate max-w-[130px]">
                              {currentFolder?.title || "Gán thư mục"}
                            </span>
                            <span className="material-symbols-outlined text-[14px]">arrow_drop_down</span>
                          </button>

                          {/* Dropdown danh sách thư mục */}
                          {isDropdownOpen && (
                            <div className="absolute top-full left-0 mt-1 w-52 bg-surface-container-highest border border-outline-variant/40 rounded-xl shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 duration-150">
                              <div className="px-3 py-1.5 text-[11px] font-semibold text-outline uppercase tracking-wider border-b border-outline-variant/20">
                                Chọn thư mục dự án
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  onAssignSessionFolder(group.sessionId, null);
                                  setActiveDropdownSessionId(null);
                                  onShowToast?.("Đã bỏ phân loại đoạn chat");
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-outline hover:bg-surface-container-high hover:text-on-surface text-left"
                              >
                                <span className="material-symbols-outlined text-[16px]">folder_off</span>
                                <span>Chưa phân loại</span>
                              </button>
                              {projects.map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => {
                                    onAssignSessionFolder(group.sessionId, p.id);
                                    setActiveDropdownSessionId(null);
                                    onShowToast?.(`Đã gán vào "${p.title}"`);
                                  }}
                                  className={`w-full flex items-center gap-2 px-3 py-2 text-[12px] text-left hover:bg-surface-container-high ${
                                    group.folderId === p.id ? "text-primary font-bold" : "text-on-surface"
                                  }`}
                                >
                                  <span className="material-symbols-outlined text-[16px] text-primary">
                                    {p.icon}
                                  </span>
                                  <span className="truncate">{p.title}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </td>

                        <td className="p-unit-sm">
                          <span className="px-2 py-0.5 rounded-full bg-primary-container/20 text-primary text-[11px] font-semibold">
                            Videcomp-rag 4o
                          </span>
                        </td>
                        <td className="p-unit-sm">
                          <span className="capitalize">
                            {first?.domain === "legal" ? "Pháp luật" : "Y tế"}
                          </span>
                        </td>
                        <td className="p-unit-sm text-outline text-[12px]">
                          {new Date(group.lastCreatedAt).toLocaleDateString("vi-VN")}
                        </td>
                        <td
                          className="p-unit-sm text-right pr-unit-md"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                onSelectSession(group);
                              }}
                              className="p-1.5 rounded hover:bg-surface-container-highest text-outline hover:text-on-surface transition-colors"
                              title="Mở đoạn chat"
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                open_in_new
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteSession(group.sessionId)}
                              className="p-1.5 rounded hover:bg-surface-container-highest text-outline hover:text-error transition-colors"
                              title="Xóa đoạn chat"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Modal Tạo Thư mục Dự án mới */}
      {isCreateModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-unit-md animate-in fade-in duration-200"
          onClick={() => setIsCreateModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-surface-container rounded-2xl border border-outline-variant/40 p-unit-lg shadow-2xl space-y-unit-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-outline-variant/30 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[24px]">create_new_folder</span>
                <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                  Tạo Thư mục Dự án mới
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-full text-outline hover:text-on-surface hover:bg-surface-container-high"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateFolder} className="space-y-4">
              <div>
                <label className="block text-[12px] font-semibold text-outline uppercase tracking-wider mb-1">
                  Tên thư mục dự án *
                </label>
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ví dụ: Luật Thuế Doanh nghiệp 2024..."
                  className="w-full bg-surface-container-high px-unit-md py-2.5 rounded-DEFAULT text-on-surface text-label-md outline-none border border-outline-variant/30 focus:border-primary"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-outline uppercase tracking-wider mb-1">
                  Mô tả ngắn
                </label>
                <textarea
                  rows={2}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Mục đích hoặc các tài liệu chính thuộc dự án này..."
                  className="w-full bg-surface-container-high px-unit-md py-2 rounded-DEFAULT text-on-surface text-label-sm outline-none border border-outline-variant/30 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-outline uppercase tracking-wider mb-2">
                  Chọn biểu tượng
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {AVAILABLE_FOLDER_ICONS.map((ic) => (
                    <button
                      key={ic.id}
                      type="button"
                      onClick={() => setNewIcon(ic.id)}
                      className={`p-2 rounded-lg border flex flex-col items-center gap-1 transition-all ${
                        newIcon === ic.id
                          ? "bg-primary/20 border-primary text-primary"
                          : "bg-surface-container-high border-outline-variant/30 text-outline hover:text-on-surface"
                      }`}
                      title={ic.label}
                    >
                      <span className="material-symbols-outlined text-[22px]">{ic.id}</span>
                      <span className="text-[10px] truncate max-w-full">{ic.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/20">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-unit-lg py-2 rounded-full text-label-md text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={!newTitle.trim()}
                  className="px-unit-lg py-2 rounded-full bg-primary text-on-primary text-label-md font-bold hover:opacity-90 transition-all disabled:opacity-40"
                >
                  Tạo thư mục
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
