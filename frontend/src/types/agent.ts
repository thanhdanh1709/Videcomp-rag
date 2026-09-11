import type { Domain } from "../api/types";

export interface CustomAgent {
  id: string;
  name: string;
  desc: string;
  author: string;
  domain: Domain;
  category: "legal" | "medical" | "code" | "productivity";
  instructions: string;
  starters: string[];
  icon: string;
  sessionId: string; // Session ID lưu trữ các tệp kiến thức trên backend RAG
  knowledgeFiles: { filename: string; size: number; chunk_count: number }[];
  createdAt: string;
  updatedAt: string;
}
