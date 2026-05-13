import { useState, useRef, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { getTimerInstance, startTimer, stopTimer, lastCompletedInfo } from "./timerState";
import {
  loadSettings,
  saveSettings,
  usePomoData,
  getTodayTotal,
  getStatistics,
  getTotalsByDate,
  TOPIC_COLORS,
  type PomoSession,
  type PomoSettings,
  type CycleBlock,
} from "./usePomoData";
import type { Tab } from "../Nav";

type PomoView = "menu" | "begin" | "timer" | "complete" | "log" | "summary";

const RING_RADIUS = 130;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function formatTime(date: Date) {
  const h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const dh = h % 12 || 12;
  return `${dh}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatDuration(mins: number) {
  const rounded = Math.round(mins);
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  if (h > 0) {
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }
  return `${m} min`;
}

function genBlockId() {
  return Date.now() + Math.floor(Math.random() * 1000000);
}

export function PomoView({
  pomoTick,
}: {
  pomoTick: number;
  activeTab: Tab;
}) {
  const [view, setView] = useState<PomoView>(() => {
    const timer = getTimerInstance();
    return timer?.isRunning ? "timer" : "menu";
  });
  const [settings, setSettings] = useState<PomoSettings>(loadSettings);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const { sessions, addSession } = usePomoData();
  const todosQuery = useQuery(api.todos.list, { includeCompleted: false });
  const todos = (todosQuery ?? []) as { _id: string; title: string; moduleName?: string; category?: string }[];
  const modulesQuery = useQuery(api.modules.list);
  const modules = (modulesQuery ?? []) as { _id: string; name: string }[];

  const updateSettings = (s: PomoSettings) => {
    setSettings(s);
    saveSettings(s);
  };

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const timer = getTimerInstance();

  return (
    <div className="p-3 max-w-2xl mx-auto pb-24">
      <h2 className="text-2xl font-bold text-stone-700 font-hand text-4xl leading-tight mb-6">
        pomo
      </h2>

      {view === "menu" && (
        <MenuView
          settings={settings}
          onUpdateSettings={updateSettings}
          sessions={sessions}
          hasActiveTimer={!!timer?.isRunning}
          onResume={() => setView("timer")}
          onBegin={() => setView("begin")}
          onLog={() => setView("log")}
          onSummary={() => setView("summary")}
        />
      )}
      {view === "begin" && (
        <BeginView
          settings={settings}
          todos={todos}
          modules={modules}
          onStart={(blocks, topic, taskName) => {
            startTimer(blocks, topic, taskName);
            setView("timer");
          }}
          onCancel={() => setView("menu")}
        />
      )}
      {view === "timer" && (
        <TimerView
          pomoTick={pomoTick}
          addSession={addSession}
          onComplete={() => setView("complete")}
          onEnd={() => setView("menu")}
          showToast={showToast}
        />
      )}
      {view === "complete" && (
        <CompleteView
          onRestart={() => setView("begin")}
          onMenu={() => setView("menu")}
        />
      )}
      {view === "log" && (
        <LogView
          todos={todos}
          modules={modules}
          addSession={addSession}
          onDone={() => { setView("menu"); showToast("Session logged!", "success"); }}
          onCancel={() => setView("menu")}
        />
      )}
      {view === "summary" && (
        <SummaryView
          sessions={sessions}
          onBack={() => setView("menu")}
        />
      )}

      {toast && (
        <div className="fixed top-4 right-4 z-[100] pointer-events-none">
          <div
            className={`px-4 py-3 rounded-xl shadow-lg border text-sm font-bold pointer-events-auto ${
              toast.type === "success"
                ? "bg-mint-50 border-mint-200 text-mint-600"
                : "bg-rose-50 border-rose-200 text-rose-600"
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Menu View ── */
function MenuView({
  settings,
  onUpdateSettings,
  sessions,
  hasActiveTimer,
  onResume,
  onBegin,
  onLog,
  onSummary,
}: {
  settings: PomoSettings;
  onUpdateSettings: (s: PomoSettings) => void;
  sessions: PomoSession[];
  hasActiveTimer: boolean;
  onResume: () => void;
  onBegin: () => void;
  onLog: () => void;
  onSummary: () => void;
}) {
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(String(settings.dailyGoal));
  const todayTotal = getTodayTotal(sessions);
  const pct = Math.min((todayTotal / settings.dailyGoal) * 100, 100);

  return (
    <div className="space-y-5">
      {/* Daily Goal */}
      <div className="bg-white rounded-2xl border border-cream-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold font-hand text-2xl text-stone-600">today's goal</h3>
          {!editingGoal && (
            <button
              onClick={() => { setEditingGoal(true); setGoalInput(String(settings.dailyGoal)); }}
              className="text-xs font-bold text-rose-400 hover:text-rose-500"
            >
              Edit
            </button>
          )}
        </div>

        {editingGoal ? (
          <div className="flex gap-2">
            <input
              type="number"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              min="1"
              step="30"
              className="flex-1 px-3 py-2 text-sm border border-cream-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-300"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const v = parseInt(goalInput);
                  if (v > 0) { onUpdateSettings({ ...settings, dailyGoal: v }); setEditingGoal(false); }
                }
              }}
            />
            <button
              onClick={() => {
                const v = parseInt(goalInput);
                if (v > 0) { onUpdateSettings({ ...settings, dailyGoal: v }); setEditingGoal(false); }
              }}
              className="px-3 py-2 bg-rose-400 text-white text-sm font-bold rounded-lg hover:bg-rose-500"
            >
              Save
            </button>
            <button
              onClick={() => setEditingGoal(false)}
              className="px-3 py-2 bg-cream-100 text-stone-500 text-sm font-bold rounded-lg hover:bg-cream-200"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <div className="w-full h-8 bg-cream-200 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-rose-400 rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-sm font-bold text-stone-500 text-center">
              {todayTotal} / {settings.dailyGoal} minutes
            </p>
          </>
        )}
      </div>

      {/* Menu Grid */}
      <div className="grid grid-cols-2 gap-3">
        {hasActiveTimer ? (
          <button
            onClick={onResume}
            className="col-span-2 py-8 bg-rose-400 hover:bg-rose-500 text-white rounded-2xl shadow-sm transition-all hover:shadow-md flex items-center justify-center gap-4 animate-pulse"
          >
            <svg className="w-10 h-10 fill-white" viewBox="0 0 24 24">
              <polygon points="5,3 19,12 5,21" />
            </svg>
            <span className="text-xl font-bold font-hand text-3xl">Resume</span>
          </button>
        ) : (
          <button
            onClick={onBegin}
            className="col-span-2 py-8 bg-rose-400 hover:bg-rose-500 text-white rounded-2xl shadow-sm transition-all hover:shadow-md flex items-center justify-center gap-4"
          >
            <svg className="w-10 h-10 fill-white" viewBox="0 0 24 24">
              <polygon points="5,3 19,12 5,21" />
            </svg>
            <span className="text-xl font-bold font-hand text-3xl">Begin</span>
          </button>
        )}

        <button
          onClick={onLog}
          className="py-5 bg-white border border-cream-200 hover:border-rose-200 hover:bg-rose-50 rounded-2xl transition-all flex flex-col items-center gap-2"
        >
          <svg className="w-6 h-6 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
          </svg>
          <span className="text-sm font-bold font-hand text-xl text-stone-600">Log</span>
        </button>

        <button
          onClick={onSummary}
          className="py-5 bg-white border border-cream-200 hover:border-lavender-200 hover:bg-lavender-50 rounded-2xl transition-all flex flex-col items-center gap-2"
        >
          <svg className="w-6 h-6 text-lavender-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />
          </svg>
          <span className="text-sm font-bold font-hand text-xl text-stone-600">Summary</span>
        </button>
      </div>
    </div>
  );
}

/* ── Begin View ── */
function BeginView({
  settings,
  todos,
  modules,
  onStart,
  onCancel,
}: {
  settings: PomoSettings;
  todos: { _id: string; title: string; moduleName?: string; category?: string }[];
  modules: { _id: string; name: string }[];
  onStart: (blocks: CycleBlock[], topic: string, taskName: string) => void;
  onCancel: () => void;
}) {
  const [cycleBlocks, setCycleBlocks] = useState<CycleBlock[]>([
    { type: "work", duration: settings.work, id: genBlockId() },
    { type: "short-break", duration: settings.shortBreak, id: genBlockId() },
    { type: "work", duration: settings.work, id: genBlockId() },
    { type: "long-break", duration: settings.longBreak, id: genBlockId() },
  ]);
  const [selectedTask, setSelectedTask] = useState("custom");
  const [customSubject, setCustomSubject] = useState("");
  const [customTask, setCustomTask] = useState("");

  const addBlock = (type: CycleBlock["type"]) => {
    const dur = type === "work" ? settings.work : type === "short-break" ? settings.shortBreak : settings.longBreak;
    setCycleBlocks((prev) => [...prev, { type, duration: dur, id: genBlockId() }]);
  };

  const removeBlock = (id: number) => {
    setCycleBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const updateBlockDuration = (id: number, dur: number) => {
    setCycleBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, duration: dur } : b)));
  };

  const moveBlock = (id: number, dir: -1 | 1) => {
    setCycleBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx === -1) return prev;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr;
    });
  };

  const handleStart = () => {
    let topic = "";
    let taskName = "";
    if (selectedTask === "custom") {
      if (!customSubject.trim()) return;
      topic = customSubject.trim();
      taskName = customTask.trim();
    } else {
      const t = todos.find((td) => td._id === selectedTask);
      if (t) {
        topic = t.moduleName || t.title;
        taskName = t.title;
      }
    }
    if (cycleBlocks.length === 0) return;
    onStart(cycleBlocks, topic, taskName);
  };

  const getBlockLabel = (b: CycleBlock) =>
    b.type === "work" ? "Work" : b.type === "short-break" ? "Short Break" : "Long Break";

  const blockClass = (b: CycleBlock) =>
    b.type === "work" ? "border-rose-200 bg-rose-50/40" : "border-mint-200 bg-mint-50/40";

  const activeTodos = todos;

  // Unique subjects from modules + todos
  const subjectOptions = [...new Set([
    ...modules.map(m => m.name),
    ...todos.map(t => t.moduleName).filter(Boolean) as string[],
  ])].sort();

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold font-hand text-3xl text-stone-600">Build Cycle</h3>

      {/* Task selector */}
      <div className="bg-white rounded-xl border border-cream-200 p-4 space-y-3">
        <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Task</p>
        {activeTodos.length > 0 ? (
          <div className="space-y-1.5">
            {activeTodos.slice(0, 8).map((t) => (
              <label
                key={t._id}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                  selectedTask === t._id
                    ? "border-rose-300 bg-rose-50"
                    : "border-cream-200 hover:border-rose-200"
                }`}
              >
                <input
                  type="radio"
                  name="pomo-task"
                  value={t._id}
                  checked={selectedTask === t._id}
                  onChange={() => setSelectedTask(t._id)}
                  className="accent-rose-400"
                />
                <span className="text-sm text-stone-700 font-medium truncate">
                  {t.moduleName && (
                    <span className="text-rose-400 font-bold">{t.moduleName}</span>
                  )}
                  {t.moduleName && " — "}
                  {t.title}
                </span>
              </label>
            ))}
          </div>
        ) : (
          <p className="text-xs text-stone-400 italic">No active tasks. Use custom below.</p>
        )}

        <label
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
            selectedTask === "custom" ? "border-rose-300 bg-rose-50" : "border-cream-200 hover:border-rose-200"
          }`}
        >
          <input
            type="radio"
            name="pomo-task"
            value="custom"
            checked={selectedTask === "custom"}
            onChange={() => setSelectedTask("custom")}
            className="accent-rose-400"
          />
          <span className="text-sm font-bold text-stone-500">Custom</span>
        </label>

        {selectedTask === "custom" && (
          <div className="flex gap-2 pl-7">
            <select
              value={customSubject}
              onChange={(e) => { setCustomSubject(e.target.value); setSelectedTask("custom"); }}
              className="flex-1 px-3 py-2 text-sm border border-cream-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-300 bg-white text-stone-600"
            >
              <option value="">Subject...</option>
              {subjectOptions.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <input
              type="text"
              value={customTask}
              onChange={(e) => { setCustomTask(e.target.value); setSelectedTask("custom"); }}
              placeholder="Task name"
              className="flex-1 px-3 py-2 text-sm border border-cream-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-300"
              onKeyDown={(e) => { if (e.key === "Enter") handleStart(); }}
            />
          </div>
        )}
      </div>

      {/* Cycle builder */}
      <div className="bg-white rounded-xl border border-cream-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Cycle</p>
          <button
            onClick={() =>
              setCycleBlocks([
                { type: "work", duration: settings.work, id: genBlockId() },
                { type: "short-break", duration: settings.shortBreak, id: genBlockId() },
                { type: "work", duration: settings.work, id: genBlockId() },
                { type: "long-break", duration: settings.longBreak, id: genBlockId() },
              ])
            }
            className="text-[10px] font-bold text-rose-400 hover:text-rose-500 uppercase"
          >
            Reset
          </button>
        </div>

        {cycleBlocks.length === 0 ? (
          <p className="text-sm text-stone-400 text-center py-6">Add blocks to build your cycle</p>
        ) : (
          <div className="space-y-2">
            {cycleBlocks.map((b, i) => (
              <div
                key={b.id}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${blockClass(b)}`}
              >
                <span className={`text-sm font-bold min-w-[90px] ${b.type === "work" ? "text-rose-500" : "text-mint-500"}`}>
                  {getBlockLabel(b)}
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={b.duration}
                    onChange={(e) => updateBlockDuration(b.id, parseFloat(e.target.value) || 1)}
                    className="w-14 px-2 py-1 text-sm text-center border border-cream-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-rose-300"
                  />
                  <span className="text-xs text-stone-400">min</span>
                </div>
                <div className="ml-auto flex gap-1">
                  <button
                    onClick={() => moveBlock(b.id, -1)}
                    disabled={i === 0}
                    className="px-2 py-1 text-xs text-stone-400 hover:text-stone-600 disabled:opacity-30 rounded hover:bg-cream-100"
                  >
                    &#8593;
                  </button>
                  <button
                    onClick={() => moveBlock(b.id, 1)}
                    disabled={i === cycleBlocks.length - 1}
                    className="px-2 py-1 text-xs text-stone-400 hover:text-stone-600 disabled:opacity-30 rounded hover:bg-cream-100"
                  >
                    &#8595;
                  </button>
                  <button
                    onClick={() => removeBlock(b.id)}
                    className="px-2 py-1 text-xs text-rose-400 hover:text-rose-500 hover:bg-rose-50 rounded font-bold"
                  >
                    X
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          <button onClick={() => addBlock("work")} className="px-3 py-1.5 text-xs font-bold border-2 border-dashed border-rose-300 text-rose-400 rounded-lg hover:bg-rose-50 transition-colors">
            + Work
          </button>
          <button onClick={() => addBlock("short-break")} className="px-3 py-1.5 text-xs font-bold border-2 border-dashed border-mint-300 text-mint-500 rounded-lg hover:bg-mint-50 transition-colors">
            + Short Break
          </button>
          <button onClick={() => addBlock("long-break")} className="px-3 py-1.5 text-xs font-bold border-2 border-dashed border-mint-300 text-mint-500 rounded-lg hover:bg-mint-50 transition-colors">
            + Long Break
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={onCancel} className="flex-1 py-2.5 bg-cream-100 hover:bg-cream-200 text-stone-500 font-bold rounded-xl text-sm transition-colors">
          Cancel
        </button>
        <button onClick={handleStart} className="flex-1 py-2.5 bg-rose-400 hover:bg-rose-500 text-white font-bold rounded-xl text-sm transition-colors shadow-sm">
          Start Cycle
        </button>
      </div>
    </div>
  );
}

/* ── Timer View ── */
function TimerView({
  pomoTick,
  addSession,
  onComplete,
  onEnd,
  showToast,
}: {
  pomoTick: number;
  addSession: (date: string, time: string, minutes: number, topic: string) => Promise<unknown>;
  onComplete: () => void;
  onEnd: () => void;
  showToast: (msg: string, type: "success" | "error") => void;
}) {
  const timer = getTimerInstance();
  const prevPhaseRef = useRef<number | null>(null);

  useEffect(() => {
    if (!timer?.isRunning) return;
    const currentIdx = timer.currentPhaseIndex;
    if (prevPhaseRef.current !== null && prevPhaseRef.current !== currentIdx) {
      if (timer.isCycleComplete()) {
        stopTimer();
        onComplete();
      } else {
        showToast(`${timer.phase?.label} started!`, "success");
      }
    }
    prevPhaseRef.current = currentIdx;
  }, [pomoTick, timer, onComplete, showToast]);

  if (!timer || !timer.phase) {
    return (
      <div className="text-center py-16">
        <p className="text-stone-400">No active timer</p>
        <button onClick={onEnd} className="mt-4 text-sm text-rose-400 font-bold hover:underline">Back to menu</button>
      </div>
    );
  }

  const handleEndCycle = () => {
    if (timer.isRunning && timer.phase?.type === "work") {
      const elapsed = timer.stop();
      if (elapsed > 0) {
        const d = new Date();
        addSession(d.toISOString().split("T")[0], d.toTimeString().split(" ")[0], elapsed, timer.topic);
      }
    } else {
      timer.stop();
    }
    stopTimer();
    onEnd();
  };

  const handleSkip = () => {
    if (timer.phase?.type === "work") {
      const d = new Date();
      const elapsed = timer.stop();
      addSession(d.toISOString().split("T")[0], d.toTimeString().split(" ")[0], elapsed, timer.topic);
    } else {
      timer.stop();
    }
    const hasMore = timer.advancePhase();
    if (!hasMore || timer.isCycleComplete()) {
      stopTimer();
      onComplete();
    } else {
      showToast(`Skipped to ${timer.phase?.label}`, "success");
    }
  };

  const togglePause = () => {
    if (timer.isPaused) {
      timer.resume();
    } else {
      timer.pause();
    }
  };

  const secondsLeft = timer.getTimeLeft();
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const progress = timer.getProgress();
  const offset = CIRCUMFERENCE - (progress / 100) * CIRCUMFERENCE;
  const isBreak = timer.phase.type === "break";

  const displayText = timer.isPaused
    ? "Paused"
    : timer.duration >= 60
      ? `${String(Math.floor(secondsLeft / 3600)).padStart(2, "0")}:${String(Math.floor((secondsLeft % 3600) / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")}`
      : `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  const ringColor = isBreak ? "#98d9c2" : "#f4a7b9";
  const textColor = isBreak ? "text-mint-500" : "text-rose-500";

  return (
    <div className="text-center space-y-6">
      {/* Topic */}
      <div className="text-lg font-bold text-stone-600 font-hand text-2xl">
        {isBreak ? (
          timer.phase.label.includes("Long") ? "Take a Long Break!" : "Take a Short Break!"
        ) : (
          <>{timer.taskName ? `${timer.topic} — ${timer.taskName}` : timer.topic}</>
        )}
      </div>

      {/* Timer ring */}
      <div className="relative w-80 h-80 mx-auto flex items-center justify-center">
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 280 280">
          <circle
            cx="140" cy="140" r={RING_RADIUS}
            fill="none"
            stroke="#e8e2d9"
            strokeWidth="10"
          />
          <circle
            cx="140" cy="140" r={RING_RADIUS}
            fill="none"
            stroke={ringColor}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            className="transition-all duration-300"
          />
        </svg>
        <span className={`text-6xl font-bold font-pomo relative z-10 ${textColor}`}>
          {displayText}
        </span>
      </div>

      {/* Phase label */}
      <p className={`text-sm font-bold uppercase tracking-wider ${isBreak ? "text-mint-500" : "text-rose-500"}`}>
        {timer.phase.label} — {isBreak ? "Break" : "Work"}
      </p>

      {/* Actions */}
      <div className="flex gap-2 justify-center">
        <button
          onClick={togglePause}
          className="px-5 py-2.5 bg-rose-400 hover:bg-rose-500 text-white font-bold rounded-xl text-sm transition-colors shadow-sm"
        >
          {timer.isPaused ? "Resume" : "Pause"}
        </button>
        <button
          onClick={handleSkip}
          className="px-5 py-2.5 bg-amber-100 hover:bg-amber-200 text-amber-700 font-bold rounded-xl text-sm transition-colors border border-amber-200"
        >
          Skip
        </button>
        <button
          onClick={handleEndCycle}
          className="px-5 py-2.5 bg-stone-200 hover:bg-stone-300 text-stone-600 font-bold rounded-xl text-sm transition-colors"
        >
          End
        </button>
      </div>

      {/* Future phases timeline */}
      <PhaseTimeline timer={timer} />
    </div>
  );
}

function PhaseTimeline({ timer }: { timer: ReturnType<typeof getTimerInstance> }) {
  if (!timer || !timer.cyclePhases.length) return null;

  const base = timer.isPaused && timer.pausedTime
    ? new Date(timer.pausedTime)
    : !timer.isPaused && timer.endTime
      ? new Date(timer.endTime)
      : new Date();

  const remaining = timer.cyclePhases.slice(timer.currentPhaseIndex);

  // Pre-compute start times for each remaining phase
  const phases: { phase: typeof remaining[0]; start: Date; isCurrent: boolean }[] = [];
  let cursor = new Date(base);
  for (let i = 0; i < remaining.length; i++) {
    phases.push({ phase: remaining[i], start: new Date(cursor), isCurrent: i === 0 });
    cursor = new Date(cursor.getTime() + remaining[i].duration * 60 * 1000);
  }

  return (
    <div className="pt-2">
      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2 text-center">
        Upcoming
      </p>
      <div className="flex items-start gap-0 justify-center flex-wrap">
        {phases.map(({ phase, start, isCurrent }, i) => {
          const isWork = phase.type === "work";
          const text = isWork ? "text-rose-500" : "text-mint-500";

          return (
            <div key={i} className="flex items-center">
              <div className={`flex flex-col items-center px-2 py-1.5 rounded-lg ${isCurrent ? "bg-cream-100" : ""}`}>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${text}`}>
                  {phase.label}
                </span>
                <span className="text-[11px] font-bold text-stone-500">
                  {phase.duration}m
                </span>
                <span className="text-[9px] text-stone-400 mt-0.5">
                  {formatTime(start)}
                </span>
              </div>
              {i < phases.length - 1 && (
                <div className="w-4 h-0.5 bg-cream-200 mt-3 flex-shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Complete View ── */
function CompleteView({
  onRestart,
  onMenu,
}: {
  onRestart: () => void;
  onMenu: () => void;
}) {
  const { mins, topic } = lastCompletedInfo;

  return (
    <div className="text-center space-y-6 py-12">
      <div className="text-6xl mb-2">
        <svg className="w-20 h-20 mx-auto text-mint-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h3 className="text-2xl font-bold font-hand text-4xl text-stone-600">
        cycle complete!
      </h3>
      <p className="text-stone-500">
        {mins} minutes of work{topic ? ` on ${topic}` : ""}
      </p>
      <div className="flex gap-3 justify-center pt-4">
        <button
          onClick={onRestart}
          className="px-6 py-2.5 bg-rose-400 hover:bg-rose-500 text-white font-bold rounded-xl text-sm transition-colors shadow-sm"
        >
          Start Another
        </button>
        <button
          onClick={onMenu}
          className="px-6 py-2.5 bg-cream-100 hover:bg-cream-200 text-stone-500 font-bold rounded-xl text-sm transition-colors"
        >
          Menu
        </button>
      </div>
    </div>
  );
}

/* ── Log View ── */
function LogView({
  todos,
  modules,
  addSession,
  onDone,
  onCancel,
}: {
  todos: { _id: string; title: string; moduleName?: string; category?: string }[];
  modules: { _id: string; name: string }[];
  addSession: (date: string, time: string, minutes: number, topic: string) => Promise<unknown>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [minutes, setMinutes] = useState("25");
  const [topic, setTopic] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("");

  const subjectOptions = [...new Set([
    ...modules.map(m => m.name),
    ...todos.map(t => t.moduleName).filter(Boolean) as string[],
  ]  )].sort();

  const handleTaskSelect = (id: string) => {
    setSelectedTaskId(id);
    if (id) {
      const t = todos.find(td => td._id === id);
      if (t) {
        setTopic(t.moduleName || "");
      }
    }
  };

  const handleSave = async () => {
    const mins = parseFloat(minutes);
    if (!date || !mins || mins <= 0) return;
    await addSession(date, "00:00:00", mins, topic.trim());
    onDone();
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold font-hand text-3xl text-stone-600">Log Session</h3>

      <div className="bg-white rounded-xl border border-cream-200 p-4 space-y-3.5">
        <div>
          <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-cream-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-300"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Minutes</label>
          <input
            type="number"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            min="1"
            step="1"
            className="w-full px-3 py-2 text-sm border border-cream-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-300"
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Task</label>
          <select
            value={selectedTaskId}
            onChange={(e) => handleTaskSelect(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-cream-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-300 bg-white text-stone-600"
          >
            <option value="">— None —</option>
            {todos.map(t => (
              <option key={t._id} value={t._id}>
                {t.moduleName ? `${t.moduleName} — ` : ""}{t.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">
            Subject
          </label>
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-cream-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-300 bg-white text-stone-600"
          >
            <option value="">— None —</option>
            {subjectOptions.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onCancel} className="flex-1 py-2.5 bg-cream-100 hover:bg-cream-200 text-stone-500 font-bold rounded-xl text-sm transition-colors">
          Cancel
        </button>
        <button onClick={handleSave} className="flex-1 py-2.5 bg-rose-400 hover:bg-rose-500 text-white font-bold rounded-xl text-sm transition-colors shadow-sm">
          Save
        </button>
      </div>
    </div>
  );
}

/* ── Summary View ── */
function SummaryView({
  sessions,
  onBack,
}: {
  sessions: PomoSession[];
  onBack: () => void;
}) {
  const stats = getStatistics(sessions);
  const totals = getTotalsByDate(sessions);
  const topicMap = useRef(new Map<string, string>());

  let colorIdx = 0;
  const allTopics = new Set<string>();
  totals.forEach((d) => Object.keys(d.topics).forEach((t) => allTopics.add(t)));
  allTopics.forEach((t) => {
    if (!topicMap.current.has(t)) {
      topicMap.current.set(t, TOPIC_COLORS[colorIdx % TOPIC_COLORS.length]);
      colorIdx++;
    }
  });

  return (
    <div className="space-y-5">
      <h3 className="text-lg font-bold font-hand text-3xl text-stone-600">Summary</h3>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <StatCard label="Total" value={formatDuration(stats.total)} />
        <StatCard label="This Week" value={formatDuration(stats.thisWeek)} />
        <StatCard label="This Month" value={formatDuration(stats.thisMonth)} />
        <StatCard label="Streak" value={`${stats.currentStreak}d`} />
        <StatCard
          label="Best Day"
          value={stats.bestDay ? formatDuration(stats.bestDay.minutes) : "—"}
        />
        <StatCard label="Top Topic" value={stats.topTopic?.name ?? "—"} />
      </div>

      {/* Day-by-day */}
      <h4 className="text-sm font-bold text-stone-500 uppercase tracking-wider">Breakdown</h4>

      {totals.length === 0 ? (
        <p className="text-sm text-stone-400 text-center py-8">No sessions yet. Start your first cycle!</p>
      ) : (
        <div className="bg-white rounded-xl border border-cream-200 overflow-hidden">
          {/* Legend */}
          <div className="flex flex-wrap gap-3 px-4 py-2 bg-cream-50 border-b border-cream-100">
            {[...allTopics].map((t) => (
              <div key={t} className="flex items-center gap-1.5 text-xs font-medium text-stone-500">
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: topicMap.current.get(t) }}
                />
                {t}
              </div>
            ))}
          </div>

          <div className="max-h-72 overflow-y-auto">
            {[...totals].reverse().map((day) => {
              const dayTotal = Math.round(Object.values(day.topics as Record<string, number>).reduce((a, b) => a + b, 0));
              const h = Math.floor(dayTotal / 60);
              const m = dayTotal % 60;
              const maxMins = Math.max(...totals.map((d) => Math.round(Object.values(d.topics as Record<string, number>).reduce((a, b) => a + b, 0))));
              const todayStr = new Date().toISOString().split("T")[0];
              const isToday = day.date === todayStr;
              return (
                <div
                  key={day.date}
                  className={`flex items-center gap-3 px-4 py-2 border-b border-cream-50 text-sm ${isToday ? "bg-rose-50/30" : ""}`}
                >
                  <span className={`w-24 text-xs font-bold flex-shrink-0 ${isToday ? "text-rose-500" : "text-stone-500"}`}>
                    {new Date(day.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    {isToday && " · today"}
                  </span>
                  <span className="w-16 text-xs font-bold text-stone-400 text-right flex-shrink-0">
                    {h > 0 ? `${h}h${String(m).padStart(2, "0")}m` : `${m}m`}
                  </span>
                  <div className="flex-1 flex gap-0.5 items-center">
                    <div className="flex-1 h-4 bg-cream-100 rounded-full overflow-hidden flex">
                      {Object.entries(day.topics as Record<string, number>).map(([topic, mins]) => {
                        const w = maxMins > 0 ? (mins / maxMins) * 100 : 0;
                        return (
                          <div
                            key={topic}
                            className="h-full"
                            style={{ width: `${w}%`, backgroundColor: topicMap.current.get(topic) }}
                            title={`${topic}: ${mins.toFixed(0)}m`}
                          />
                        );
                      })}
                    </div>
                    <span className="text-[10px] font-bold text-stone-400 w-8 text-right flex-shrink-0">
                      {dayTotal.toFixed(0)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <button onClick={onBack} className="w-full py-2.5 bg-cream-100 hover:bg-cream-200 text-stone-500 font-bold rounded-xl text-sm transition-colors">
        Back
      </button>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-cream-200 p-3 text-center hover:border-lavender-200 transition-colors">
      <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className="text-lg font-bold text-lavender-500 font-pomo">
        {value}
      </div>
    </div>
  );
}
