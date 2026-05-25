import { useState, useCallback } from "react";

const KEY = "unitrack:guest:pomo:sessions";

interface PomoSession {
  _id: string;
  date: string;
  time: string;
  minutes: number;
  topic: string;
  taskId?: string;
  taskName?: string;
}

function loadSessions(): PomoSession[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: PomoSession[]) {
  localStorage.setItem(KEY, JSON.stringify(sessions));
}

export function useGuestPomoSessions(active: boolean) {
  const [sessions, setSessions] = useState<PomoSession[]>(() => loadSessions());

  const addSession = useCallback(
    async (date: string, time: string, minutes: number, topic: string) => {
      if (!active) return;
      const s: PomoSession = {
        _id: Date.now().toString(),
        date,
        time,
        minutes: Math.round(minutes),
        topic: topic || "Work",
      };
      setSessions((prev) => {
        const next = [s, ...prev];
        saveSessions(next);
        return next;
      });
    },
    [active],
  );

  const removeSession = useCallback((id: string) => {
    if (!active) return;
    setSessions((prev) => {
      const next = prev.filter((s) => s._id !== id);
      saveSessions(next);
      return next;
    });
  }, [active]);

  const clearAll = useCallback(() => {
    if (!active) return;
    setSessions([]);
    saveSessions([]);
  }, [active]);

  return {
    sessions: active ? sessions : [],
    addSession,
    removeSession,
    clearAll,
  };
}
