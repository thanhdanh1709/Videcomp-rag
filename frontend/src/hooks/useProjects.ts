import { useCallback, useEffect, useState } from "react";
import type { ProjectFolder } from "../types/project";

const STORAGE_KEY = "videcomp.project_folders";

const INITIAL_PROJECTS: ProjectFolder[] = [
  {
    id: "proj-labor",
    title: "Bộ luật Lao động & HĐLĐ",
    desc: "Rà soát điều khoản bồi thường, đơn phương chấm dứt và thỏa ước tập thể.",
    icon: "gavel",
    createdAt: new Date(Date.now() - 3600 * 24 * 1000 * 5).toISOString(),
  },
  {
    id: "proj-land",
    title: "Nghiên cứu Luật Đất đai 2024",
    desc: "Quy định bồi thường giải tỏa, quyền sử dụng đất doanh nghiệp mới nhất.",
    icon: "apartment",
    createdAt: new Date(Date.now() - 3600 * 24 * 1000 * 3).toISOString(),
  },
  {
    id: "proj-anaphylaxis",
    title: "Phác đồ Cấp cứu Sốc phản vệ",
    desc: "Thông tư 51/2017/TT-BYT, phân độ phản vệ và hướng dẫn hồi sức lâm sàng.",
    icon: "medical_services",
    createdAt: new Date(Date.now() - 3600 * 24 * 1000 * 2).toISOString(),
  },
  {
    id: "proj-benchmark",
    title: "Thực nghiệm Benchmark RAG",
    desc: "Đo lường Hit@k, MRR, Faithfulness và Answer Relevance trên tập dữ liệu Q3.",
    icon: "science",
    createdAt: new Date(Date.now() - 3600 * 24 * 1000 * 1).toISOString(),
  },
];

function load(): ProjectFolder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_PROJECTS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_PROJECTS;
  } catch {
    return INITIAL_PROJECTS;
  }
}

function persist(projects: ProjectFolder[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch {
    /* storage full or unavailable */
  }
}

export function useProjects() {
  const [projects, setProjects] = useState<ProjectFolder[]>(() => load());

  useEffect(() => {
    persist(projects);
  }, [projects]);

  const createProject = useCallback(
    (folder: Omit<ProjectFolder, "id" | "createdAt">): ProjectFolder => {
      const newFolder: ProjectFolder = {
        ...folder,
        id: "proj-" + crypto.randomUUID().slice(0, 8),
        createdAt: new Date().toISOString(),
      };
      setProjects((prev) => [newFolder, ...prev]);
      return newFolder;
    },
    []
  );

  const updateProject = useCallback(
    (id: string, updates: Partial<ProjectFolder>) => {
      setProjects((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
      );
    },
    []
  );

  const deleteProject = useCallback((id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return { projects, createProject, updateProject, deleteProject };
}
