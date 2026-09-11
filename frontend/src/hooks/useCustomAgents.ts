import { useCallback, useEffect, useState } from "react";
import type { CustomAgent } from "../types/agent";

const STORAGE_KEY = "videcomp.custom_agents";

const INITIAL_AGENTS: CustomAgent[] = [
  {
    id: "agent-academic-trans",
    name: "Trợ lý Nghiên cứu & Dịch thuật",
    desc: "Chuyên gia dịch thuật học thuật, tóm tắt tài liệu PDF và trích dẫn khoa học chuẩn APA/IEEE.",
    author: "Bởi bạn",
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

export function useCustomAgents() {
  const [agents, setAgents] = useState<CustomAgent[]>(() => load());

  useEffect(() => {
    persist(agents);
  }, [agents]);

  const saveAgent = useCallback((agent: CustomAgent) => {
    setAgents((prev) => {
      const idx = prev.findIndex((a) => a.id === agent.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...agent, updatedAt: new Date().toISOString() };
        return next;
      }
      return [{ ...agent, updatedAt: new Date().toISOString() }, ...prev];
    });
  }, []);

  const deleteAgent = useCallback((id: string) => {
    setAgents((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const getAgent = useCallback(
    (id: string) => {
      return agents.find((a) => a.id === id);
    },
    [agents]
  );

  return { agents, saveAgent, deleteAgent, getAgent };
}
