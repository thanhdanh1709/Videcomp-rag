import { useCallback, useEffect, useState } from "react";
import type { CustomAgent } from "../types/agent";
import { apiGetAgents, apiSaveAgent, apiDeleteAgent } from "../api/client";

const STORAGE_KEY = "videcomp.custom_agents";

const INITIAL_AGENTS: CustomAgent[] = [
  {
    id: "agent-academic-trans",
    name: "Trợ lý Nghiên cứu & Dịch thuật",
    desc: "Chuyên gia dịch thuật học thuật, tóm tắt tài liệu PDF và trích dẫn khoa học chuẩn APA/IEEE.",
    author: "Hệ thống",
    domain: "legal",
    category: "productivity",
    instructions: `Bạn là Trợ lý Nghiên cứu & Dịch thuật chuyên nghiệp của hệ thống Videcomp-rag. Nhiệm vụ trọng tâm:
1. Dịch thuật song ngữ Anh-Việt và Việt-Anh với tính chính xác học thuật cao nhất.
2. Phân rã câu hỏi đa bước và đối chiếu chuẩn xác với các tài liệu đính kèm.
3. Định dạng danh mục tham khảo theo chuẩn APA 7th.`,
    starters: [
      "Dịch tóm tắt đoạn văn này sang tiếng Anh học thuật...",
      "Kiểm tra lỗi ngữ pháp học thuật và văn phong...",
      "Trích dẫn tài liệu theo chuẩn APA 7th...",
      "Tóm tắt các phát hiện cốt lõi từ văn bản...",
    ],
    icon: "school",
    sessionId: "agent-session-academic-default",
    knowledgeFiles: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

function load(): CustomAgent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_AGENTS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_AGENTS;
  } catch {
    return INITIAL_AGENTS;
  }
}

function persist(agents: CustomAgent[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
  } catch {
    /* storage full or unavailable */
  }
}

export function useCustomAgents(userKey?: string | null) {
  const [agents, setAgents] = useState<CustomAgent[]>(() => load());

  // Tải danh sách chuyên gia từ PostgreSQL khi khởi chạy hoặc chuyển người dùng
  useEffect(() => {
    let cancelled = false;
    apiGetAgents()
      .then((serverAgents) => {
        if (!cancelled && Array.isArray(serverAgents) && serverAgents.length > 0) {
          setAgents(serverAgents);
          persist(serverAgents);
        }
      })
      .catch(() => {
        // Dự phòng ngoại tuyến nếu backend chưa kết nối
      });
    return () => {
      cancelled = true;
    };
  }, [userKey]);

  useEffect(() => {
    persist(agents);
  }, [agents]);

  const saveAgent = useCallback((agent: CustomAgent) => {
    const updatedAgent = { ...agent, updatedAt: new Date().toISOString() };
    setAgents((prev) => {
      const idx = prev.findIndex((a) => a.id === agent.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updatedAgent;
        return next;
      }
      return [updatedAgent, ...prev];
    });

    // Đồng bộ lên PostgreSQL
    apiSaveAgent(updatedAgent).catch((err) => {
      console.warn("Không thể lưu chuyên gia vào PostgreSQL:", err);
    });
  }, []);

  const deleteAgent = useCallback((id: string) => {
    setAgents((prev) => prev.filter((a) => a.id !== id));

    // Xóa khỏi PostgreSQL
    apiDeleteAgent(id).catch((err) => {
      console.warn("Không thể xóa chuyên gia khỏi PostgreSQL:", err);
    });
  }, []);

  const getAgent = useCallback(
    (id: string) => {
      return agents.find((a) => a.id === id);
    },
    [agents]
  );

  return { agents, saveAgent, deleteAgent, getAgent };
}

