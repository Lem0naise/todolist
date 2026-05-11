import { useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useLocalCache } from "../../hooks/useLocalCache";
import type { Id } from "../../../convex/_generated/dataModel";

const SETTINGS_KEY = "unitrack:pomo:settings";

export interface PomoSession {
  _id: string;
  date: string;
  time: string;
  minutes: number;
  topic: string;
  taskId?: string;
  taskName?: string;
}

export interface PomoSettings {
  work: number;
  shortBreak: number;
  longBreak: number;
  dailyGoal: number;
}

export interface CycleBlock {
  type: "work" | "short-break" | "long-break";
  duration: number;
  id: number;
}

const DEFAULT_SETTINGS: PomoSettings = {
  work: 25,
  shortBreak: 5,
  longBreak: 20,
  dailyGoal: 120,
};

export function loadSettings(): PomoSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    /* ignore parse errors */
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(s: PomoSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function usePomoData() {
  const raw = useQuery(api.pomo.list);
  const sessions = (useLocalCache<PomoSession[]>("pomo:sessions", raw) ??
    []) as PomoSession[];

  const addMutation = useMutation(api.pomo.add);
  const removeMutation = useMutation(api.pomo.remove);
  const clearAllMutation = useMutation(api.pomo.clearAll);

  const addSession = useCallback(
    (date: string, time: string, minutes: number, topic: string, taskId?: string, taskName?: string) => {
      return addMutation({ date, time, minutes: Math.round(minutes * 100) / 100, topic, taskId: taskId as Id<"todos"> | undefined, taskName });
    },
    [addMutation],
  );

  const removeSession = useCallback(
    (id: string) => {
      return removeMutation({ id: id as Id<"pomoSessions"> });
    },
    [removeMutation],
  );

  const clearAll = useCallback(() => {
    return clearAllMutation({});
  }, [clearAllMutation]);

  return { sessions, addSession, removeSession, clearAll };
}

export function getTodayTotal(sessions: PomoSession[]): number {
  const today = new Date().toISOString().split("T")[0];
  return sessions
    .filter((s) => s.date === today)
    .reduce((sum, s) => sum + s.minutes, 0);
}

export function getStatistics(sessions: PomoSession[]) {
  if (sessions.length === 0) {
    return {
      total: 0,
      thisWeek: 0,
      thisMonth: 0,
      currentStreak: 0,
      bestDay: null as { date: string; minutes: number } | null,
      topTopic: null as { name: string; minutes: number } | null,
    };
  }

  const total = sessions.reduce((sum, s) => sum + s.minutes, 0);

  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().split("T")[0];
  const thisWeek = sessions
    .filter((s) => s.date >= weekAgoStr)
    .reduce((sum, s) => sum + s.minutes, 0);

  const monthAgo = new Date(now);
  monthAgo.setMonth(monthAgo.getMonth() - 1);
  const monthAgoStr = monthAgo.toISOString().split("T")[0];
  const thisMonth = sessions
    .filter((s) => s.date >= monthAgoStr)
    .reduce((sum, s) => sum + s.minutes, 0);

  const dates = [...new Set(sessions.map((s) => s.date))].sort().reverse();
  let currentStreak = 0;
  const today = new Date().toISOString().split("T")[0];
  for (let i = 0; i < dates.length; i++) {
    const expectedDate = new Date(today);
    expectedDate.setDate(expectedDate.getDate() - i);
    if (dates[i] === expectedDate.toISOString().split("T")[0]) {
      currentStreak++;
    } else {
      break;
    }
  }

  const dayTotals: Record<string, number> = {};
  sessions.forEach((s) => {
    dayTotals[s.date] = (dayTotals[s.date] || 0) + s.minutes;
  });
  const bestDayEntry = Object.entries(dayTotals).sort((a, b) => b[1] - a[1])[0];
  const bestDay = bestDayEntry
    ? { date: bestDayEntry[0], minutes: bestDayEntry[1] }
    : null;

  const topicTotals: Record<string, number> = {};
  sessions.forEach((s) => {
    const topic = s.topic || "Untitled";
    topicTotals[topic] = (topicTotals[topic] || 0) + s.minutes;
  });
  const topTopicEntry = Object.entries(topicTotals).sort((a, b) => b[1] - a[1])[0];
  const topTopic = topTopicEntry
    ? { name: topTopicEntry[0], minutes: topTopicEntry[1] }
    : null;

  return { total, thisWeek, thisMonth, currentStreak, bestDay, topTopic };
}

export function getTotalsByDate(sessions: PomoSession[]) {
  const totals: Record<string, Record<string, number>> = {};
  for (const session of sessions) {
    if (!totals[session.date]) totals[session.date] = {};
    const topic = session.topic || "Untitled";
    totals[session.date][topic] = (totals[session.date][topic] || 0) + session.minutes;
  }
  const dates = Object.keys(totals).sort();
  if (dates.length === 0) return [];
  const result = [];
  const start = new Date(dates[0]);
  const end = new Date(dates[dates.length - 1]);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split("T")[0];
    result.push({ date: dateStr, topics: totals[dateStr] || {} });
  }
  return result;
}

export const TOPIC_COLORS = [
  "#f4a7b9",
  "#c4b5e3",
  "#98d9c2",
  "#f9ca76",
  "#7ec8e3",
  "#e8a87c",
  "#a7c5eb",
  "#f7cac9",
  "#8b5a83",
  "#6b8e9e",
];
