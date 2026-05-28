import { PomoTimer } from "./PomoTimer";
import type { CycleBlock } from "./usePomoData";

let instance: PomoTimer | null = null;

export let lastCompletedInfo: { mins: number; topic: string } = { mins: 0, topic: "" };

const PERSIST_KEY = "unitrack:pomo:timer";

interface PersistedTimer {
  mode: "timer" | "stopwatch";
  subMode: "work" | "break";
  topic: string;
  taskName: string;
  startTime: number;
  isPaused: boolean;
  pausedTime: number | null;
  totalWorkMinutes: number;
  blocks?: CycleBlock[];
  currentPhaseIndex?: number;
  phaseEndTime?: number;
  phaseDuration?: number;
}

export function persist() {
  if (!instance || !instance.isRunning) {
    localStorage.removeItem(PERSIST_KEY);
    return;
  }
  const data: PersistedTimer = {
    mode: instance.mode,
    subMode: instance.subMode,
    topic: instance.topic,
    taskName: instance.taskName,
    startTime: instance.startTime?.getTime() ?? Date.now(),
    isPaused: instance.isPaused,
    pausedTime: instance.pausedTime?.getTime() ?? null,
    totalWorkMinutes: instance.totalWorkMinutes,
  };
  if (instance.mode === "timer") {
    data.blocks = (instance.cyclePhases as { type: string; duration: number; label: string; taskTopic?: string; taskName?: string }[]).map((p, i) => ({
      type: p.type === "break" ? (p.label === "Long Break" ? "long-break" : "short-break") : "work",
      duration: p.duration,
      id: i,
      taskTopic: p.taskTopic,
      taskName: p.taskName,
    }));
    data.currentPhaseIndex = instance.currentPhaseIndex;
    data.phaseEndTime = instance.endTime?.getTime() ?? undefined;
    data.phaseDuration = instance.duration;
  }
  localStorage.setItem(PERSIST_KEY, JSON.stringify(data));
}

export function restoreTimer(): PomoTimer | null {
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) return null;
    const data: PersistedTimer = JSON.parse(raw);
    if (!data.mode) return null;

    const timer = new PomoTimer();
    timer.totalWorkMinutes = data.totalWorkMinutes;

    if (data.mode === "timer" && data.blocks) {
      timer.initCycleWithBlocks(data.blocks as CycleBlock[]);
      // Fast-forward to current phase
      timer.currentPhaseIndex = data.currentPhaseIndex ?? 0;
      if (data.currentPhaseIndex !== undefined && data.currentPhaseIndex < timer.cyclePhases.length) {
        timer.phase = timer.cyclePhases[timer.currentPhaseIndex];
        timer.duration = data.phaseDuration ?? timer.phase.duration;
        timer.startTime = new Date(data.startTime);
        timer.endTime = data.phaseEndTime ? new Date(data.phaseEndTime) : null;
        timer.topic = timer.phase.taskTopic || "";
        timer.taskName = timer.phase.taskName || "";
      }
    } else {
      timer.initStopwatch(data.topic, data.taskName);
      timer.subMode = data.subMode;
      timer.startTime = new Date(data.startTime);
    }

    timer.isRunning = true;
    timer.isPaused = data.isPaused;
    if (data.isPaused && data.pausedTime) {
      timer.pausedTime = new Date(data.pausedTime);
    }

    instance = timer;
    return timer;
  } catch {
    localStorage.removeItem(PERSIST_KEY);
    return null;
  }
}

export function getTimerInstance(): PomoTimer | null {
  return instance;
}

export function startTimer(blocks: CycleBlock[]): PomoTimer {
  instance = new PomoTimer();
  instance.initCycleWithBlocks(blocks);
  persist();
  return instance;
}

export function startStopwatch(topic: string, taskName: string): PomoTimer {
  instance = new PomoTimer();
  instance.initStopwatch(topic, taskName);
  persist();
  return instance;
}

export function stopTimer(): void {
  lastCompletedInfo = {
    mins: instance?.getCompletedWorkMinutes() ?? 0,
    topic: instance?.topic ?? "",
  };
  if (instance && instance.isRunning) {
    instance.stop();
  }
  cycleJustCompleted = true;
  instance = null;
  localStorage.removeItem(PERSIST_KEY);
}

let cycleJustCompleted = false;
export function consumeCycleCompleted(): boolean {
  if (cycleJustCompleted) {
    cycleJustCompleted = false;
    return true;
  }
  return false;
}

export function clearTimer(): void {
  instance = null;
  localStorage.removeItem(PERSIST_KEY);
}

// Session-save toast notification
export let lastSavedSession: { mins: number; topic: string } | null = null;
export function notifySessionSaved(mins: number, topic: string) {
  lastSavedSession = { mins, topic };
}
export function consumeSavedSession(): { mins: number; topic: string } | null {
  const s = lastSavedSession;
  lastSavedSession = null;
  return s;
}
