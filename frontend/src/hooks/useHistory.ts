import { useCallback, useEffect, useState } from "react";
import type { AnswerResult, Domain, Mode } from "../api/types";
import {
  apiGetSessions,
  apiSaveSession,
  apiDeleteSession,
  apiAssignSessionFolder,
  apiSetSessionFeedback,
} from "../api/client";

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
const MAX_ENTRIES = 100;

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

export function useHistory(userKey?: string | null) {
  const [entries, setEntries] = useState<HistoryEntry[]>(() => load());

  // Tải danh sách phiên chat từ PostgreSQL khi khởi chạy hoặc chuyển người dùng
  useEffect(() => {
    let cancelled = false;
    apiGetSessions()
      .then((serverSessions) => {
        if (cancelled) return;
        if (Array.isArray(serverSessions) && serverSessions.length > 0) {
          const flattened: HistoryEntry[] = [];
          for (const s of serverSessions) {
            if (Array.isArray(s.turns)) {
              for (const t of s.turns) {
                flattened.push({
                  ...t,
                  sessionId: s.sessionId,
                  folderId: t.folderId || s.folderId || undefined,
                });
              }
            }
          }
          if (flattened.length > 0) {
            // Sắp xếp mới nhất lên đầu
            flattened.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
            setEntries(flattened);
            persist(flattened);
          }
        } else {
          // Nếu server trống nhưng local có dữ liệu trước đó, tự động đồng bộ lên PostgreSQL
          const localEntries = load();
          if (localEntries.length > 0 && localStorage.getItem("videcomp.token")) {
            const localGroups = groupSessions(localEntries);
            for (const g of localGroups) {
              apiSaveSession({
                session_id: g.sessionId,
                title: g.turns[0]?.question ? g.turns[0].question.slice(0, 120) : "Phiên hỏi đáp",
                domain: g.turns[0]?.domain || "legal",
                mode: g.turns[0]?.mode || "hybrid",
                folder_id: g.folderId || null,
                turns: g.turns,
              }).catch(() => {});
            }
          }
        }
      })
      .catch(() => {
        // Dự phòng ngoại tuyến
      });
    return () => {
      cancelled = true;
    };
  }, [userKey]);

  useEffect(() => {
    persist(entries);
  }, [entries]);

  const addEntry = useCallback((entry: HistoryEntry) => {
    setEntries((prev) => {
      const updated = [entry, ...prev.filter((e) => e.requestId !== entry.requestId)];
      
      // Đồng bộ phiên chat này vào PostgreSQL
      const sessionTurns = updated
        .filter((e) => e.sessionId === entry.sessionId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

      apiSaveSession({
        session_id: entry.sessionId,
        title: sessionTurns[0]?.question ? sessionTurns[0].question.slice(0, 120) : "Phiên hỏi đáp",
        domain: entry.domain,
        mode: entry.mode,
        folder_id: entry.folderId || null,
        turns: sessionTurns,
      }).catch((err) => {
        console.warn("Không thể lưu phiên chat vào PostgreSQL:", err);
      });

      return updated;
    });
  }, []);

  const removeSession = useCallback((sessionId: string) => {
    setEntries((prev) => prev.filter((e) => e.sessionId !== sessionId));
    apiDeleteSession(sessionId).catch((err) => {
      console.warn("Không thể xóa phiên chat trên PostgreSQL:", err);
    });
  }, []);

  const assignSessionFolder = useCallback((sessionId: string, folderId: string | null) => {
    apiAssignSessionFolder(sessionId, folderId).catch((err) => {
      console.warn("Không thể cập nhật thư mục dự án trên PostgreSQL:", err);
    });
    setEntries((prev) =>
      prev.map((e) =>
        e.sessionId === sessionId
          ? { ...e, folderId: folderId || undefined }
          : e
      )
    );
  }, []);

  const assignSessionsFolder = useCallback((sessionIds: string[], folderId: string | null) => {
    for (const sid of sessionIds) {
      apiAssignSessionFolder(sid, folderId).catch(() => {});
    }
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
    setEntries((prev) => {
      const target = prev.find((e) => e.requestId === requestId);
      if (target) {
        apiSetSessionFeedback(target.sessionId, requestId, feedback).catch((err) => {
          console.warn("Không thể lưu đánh giá phản hồi trên PostgreSQL:", err);
        });
      }
      return prev.map((e) =>
        e.requestId === requestId ? { ...e, feedback: e.feedback === feedback ? undefined : feedback } : e
      );
    });
  }, []);

  const clear = useCallback(() => setEntries([]), []);

  return { entries, addEntry, removeSession, assignSessionFolder, assignSessionsFolder, setFeedback, clear };
}

