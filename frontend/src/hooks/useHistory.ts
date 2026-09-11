import { useCallback, useEffect, useState } from "react";
import type { AnswerResult, Domain, Mode } from "../api/types";

export interface HistoryEntry {
  requestId: string;
  sessionId: string; // gom nhieu luot hoi-dap lien tiep thanh 1 "phien" trong sidebar
  question: string;
  domain: Domain;
  mode: Mode;
  createdAt: string;
  result: AnswerResult;
  feedback?: "up" | "down";
  usedContext?: boolean; // true neu cau hoi nay duoc gui kem ngu canh luot truoc (xem ChatView.tsx)
  folderId?: string; // ID thư mục dự án liên kết
}

export interface SessionGroup {
  sessionId: string;
  turns: HistoryEntry[]; // sap xep tang dan theo createdAt (luot hoi truoc -> sau)
  lastCreatedAt: string;
  folderId?: string;
}

const STORAGE_KEY = "videcomp.history";
const MAX_ENTRIES = 50;

function load(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryEntry[];
    return parsed.map((e) => ({ ...e, sessionId: e.sessionId ?? e.requestId }));
  } catch {
    return [];
  }
}

function persist(entries: HistoryEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    /* storage full or unavailable */
  }
}

export function groupSessions(entries: HistoryEntry[]): SessionGroup[] {
  const bySession = new Map<string, HistoryEntry[]>();
  for (const e of entries) {
    const list = bySession.get(e.sessionId) ?? [];
    list.push(e);
    bySession.set(e.sessionId, list);
  }
  const sessions: SessionGroup[] = Array.from(bySession.entries()).map(([sessionId, list]) => {
    const turns = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const folderId = turns.find((t) => t.folderId)?.folderId;
    return { sessionId, turns, lastCreatedAt: turns[turns.length - 1].createdAt, folderId };
  });
  sessions.sort((a, b) => b.lastCreatedAt.localeCompare(a.lastCreatedAt));
  return sessions;
}

export function useHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>(() => load());

  useEffect(() => {
    persist(entries);
  }, [entries]);

  const addEntry = useCallback((entry: HistoryEntry) => {
    setEntries((prev) => [entry, ...prev.filter((e) => e.requestId !== entry.requestId)]);
  }, []);

  const removeSession = useCallback((sessionId: string) => {
    setEntries((prev) => prev.filter((e) => e.sessionId !== sessionId));
  }, []);

  const assignSessionFolder = useCallback((sessionId: string, folderId: string | null) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.sessionId === sessionId
          ? { ...e, folderId: folderId || undefined }
          : e
      )
    );
  }, []);

  const assignSessionsFolder = useCallback((sessionIds: string[], folderId: string | null) => {
    const idSet = new Set(sessionIds);
    setEntries((prev) =>
      prev.map((e) =>
        idSet.has(e.sessionId)
          ? { ...e, folderId: folderId || undefined }
          : e
      )
    );
  }, []);

  const setFeedback = useCallback((requestId: string, feedback: "up" | "down") => {
    setEntries((prev) =>
      prev.map((e) =>
        e.requestId === requestId ? { ...e, feedback: e.feedback === feedback ? undefined : feedback } : e
      )
    );
  }, []);

  const clear = useCallback(() => setEntries([]), []);

  return { entries, addEntry, removeSession, assignSessionFolder, assignSessionsFolder, setFeedback, clear };
}
