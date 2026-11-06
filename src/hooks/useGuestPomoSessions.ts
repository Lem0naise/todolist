import { useState, useCallback, useEffect } from "react";
import type { SessionTaskRef } from "../components/pomo/usePomoData";

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

const EMPTY_SESSIONS: PomoSession[] = [];

function loadSessions(): PomoSession[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Every hook instance in this window shares one source of truth. Without this,
// a session saved by the App-level timer would leave mounted views (todo list,
// summary) showing stale totals until they remount.
const listeners = new Set<() => void>();

function saveSessions(sessions: PomoSession[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(sessions));
  } catch {
    // localStorage might be full
  }
  for (const listener of listeners) listener();
}

export function useGuestPomoSessions(active: boolean) {
  const [sessions, setSessions] = useState<PomoSession[]>(() => loadSessions());

  useEffect(() => {
    const refresh = () => setSessions(loadSessions());
    listeners.add(refresh);
    const onStorage = (event: StorageEvent) => {
      if (event.key === KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const addSession = useCallback(
    async (
      date: string,
      time: string,
      minutes: number,
      topic: string,
      task?: SessionTaskRef,
    ) => {
      if (!active) return;
      const s: PomoSession = {
        _id: Date.now().toString(),
        date,
        time,
        minutes: Math.round(minutes),
        topic: topic || "Work",
        taskId: task?.taskId,
        taskName: task?.taskName,
      };
      saveSessions([s, ...loadSessions()]);
    },
    [active],
  );

  const removeSession = useCallback(
    (id: string) => {
      if (!active) return;
      saveSessions(loadSessions().filter((s) => s._id !== id));
    },
    [active],
  );

  const clearAll = useCallback(() => {
    if (!active) return;
    saveSessions([]);
  }, [active]);

  return {
    sessions: active ? sessions : EMPTY_SESSIONS,
    addSession,
    removeSession,
    clearAll,
  };
}
