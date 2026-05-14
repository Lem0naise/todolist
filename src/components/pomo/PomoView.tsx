import { useState, useRef, useEffect, useMemo } from "react";
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
          onStart={(blocks) => {
            startTimer(blocks);
            setView("timer");
          }}
          onCancel={() => setView("menu")}
        />
      )}
      {view === "timer" && (
        <TimerView
          pomoTick={pomoTick}
          addSession={addSession}
          todos={todos}
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
  onStart: (blocks: CycleBlock[]) => void;
  onCancel: () => void;
}) {
  const [cycleBlocks, setCycleBlocks] = useState<CycleBlock[]>([
    { type: "work", duration: settings.work, id: genBlockId() },
    { type: "short-break", duration: settings.shortBreak, id: genBlockId() },
    { type: "work", duration: settings.work, id: genBlockId() },
    { type: "long-break", duration: settings.longBreak, id: genBlockId() },
  ]);
  const [expandedTask, setExpandedTask] = useState<number | null>(null);

  const addBlock = (type: CycleBlock["type"]) => {
    const dur = type === "work" ? settings.work : type === "short-break" ? settings.shortBreak : settings.longBreak;
    setCycleBlocks((prev) => [...prev, { type, duration: dur, id: genBlockId() }]);
  };

  const removeBlock = (id: number) => {
    setCycleBlocks((prev) => prev.filter((b) => b.id !== id));
    if (expandedTask === id) setExpandedTask(null);
  };

  const updateBlockDuration = (id: number, dur: number) => {
    setCycleBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, duration: dur } : b)));
  };

  const updateBlockTask = (id: number, taskId: string, taskTopic: string, taskName: string) => {
    setCycleBlocks((prev) => prev.map((b) =>
      b.id === id ? { ...b, taskId: taskId || undefined, taskTopic: taskTopic || undefined, taskName: taskName || undefined } : b
    ));
    if (!taskId && !taskTopic && !taskName) setExpandedTask(null);
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
    if (cycleBlocks.filter(b => b.type === "work").length === 0) return;
    onStart(cycleBlocks);
  };

  const getBlockLabel = (b: CycleBlock) =>
    b.type === "work" ? "Work" : b.type === "short-break" ? "Break" : "Long Break";

  const blockClass = (b: CycleBlock) =>
    b.type === "work" ? "border-rose-200 bg-rose-50/40" : "border-mint-200 bg-mint-50/40";

  // Subject options for task selectors
  const subjectOptions = [...new Set([
    ...modules.map(m => m.name),
    ...todos.map(t => t.moduleName).filter(Boolean) as string[],
  ])].sort();

  // Compute schedule preview timestamps
  const { scheduleTimes, totalMinutes } = useMemo(() => {
    const times: { block: CycleBlock; start: Date; end: Date }[] = [];
    let t = new Date().getTime();
    for (const b of cycleBlocks) {
      const start = t;
      t += b.duration * 60 * 1000;
      times.push({ block: b, start: new Date(start), end: new Date(t) });
    }
    return { scheduleTimes: times, totalMinutes: cycleBlocks.reduce((s, b) => s + b.duration, 0) };
  }, [cycleBlocks]);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold font-hand text-3xl text-stone-600">Build Cycle</h3>

      {/* Block rows */}
      <div className="bg-white rounded-xl border border-cream-200 p-3 space-y-1.5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Blocks</p>
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
          <p className="text-sm text-stone-400 text-center py-6">Add blocks to plan your day</p>
        ) : (
          <div className="space-y-1">
            {cycleBlocks.map((b, i) => {
              const isWork = b.type === "work";
              const selectedTask = isWork && b.taskId ? todos.find(t => t._id === b.taskId) : null;
              const hasCustomTask = isWork && !b.taskId && (b.taskTopic || b.taskName);
              const showTaskPicker = expandedTask === b.id;

              return (
                <div key={b.id}>
                  <div className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border ${blockClass(b)}`}>
                    <button
                      onClick={() => moveBlock(b.id, -1)}
                      disabled={i === 0}
                      className="text-stone-300 hover:text-stone-500 disabled:opacity-20 text-xs leading-none"
                    >
                      &#8593;
                    </button>
                    <button
                      onClick={() => moveBlock(b.id, 1)}
                      disabled={i === cycleBlocks.length - 1}
                      className="text-stone-300 hover:text-stone-500 disabled:opacity-20 text-xs leading-none"
                    >
                      &#8595;
                    </button>

                    <span className={`text-xs font-bold min-w-[60px] ${isWork ? "text-rose-500" : "text-mint-500"}`}>
                      {getBlockLabel(b)}
                    </span>

                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={b.duration}
                      onChange={(e) => updateBlockDuration(b.id, parseFloat(e.target.value) || 1)}
                      className="w-12 px-1.5 py-1 text-xs text-center border border-cream-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-rose-300"
                    />
                    <span className="text-[10px] text-stone-400">m</span>

                    {/* Task selector for work blocks */}
                    {isWork && (
                      <button
                        onClick={() => setExpandedTask(showTaskPicker ? null : b.id)}
                        className={`flex-1 text-left px-2 py-1 rounded text-xs border truncate transition-colors ${
                          selectedTask || hasCustomTask
                            ? "border-rose-200 bg-rose-50/60 text-rose-600 font-medium"
                            : "border-dashed border-cream-200 text-stone-300 italic hover:border-cream-300"
                        }`}
                      >
                        {selectedTask
                          ? `${selectedTask.moduleName || ""} ${selectedTask.moduleName ? "—" : ""} ${selectedTask.title}`
                          : hasCustomTask
                            ? `${b.taskTopic || ""} ${b.taskName ? "— " + b.taskName : ""}`
                            : "Tap to assign task..."}
                      </button>
                    )}

                    {!isWork && <div className="flex-1" />}

                    <button
                      onClick={() => removeBlock(b.id)}
                      className="text-stone-300 hover:text-rose-400 text-xs font-bold px-1"
                    >
                      ×
                    </button>
                  </div>

                  {/* Inline task picker */}
                  {showTaskPicker && isWork && (
                    <div className="ml-12 mr-4 mt-1 mb-1 p-2 bg-cream-50 rounded-lg border border-cream-100 space-y-1.5">
                      <div className="flex gap-1.5 flex-wrap">
                        {todos.slice(0, 6).map((t) => (
                          <button
                            key={t._id}
                            onClick={() => {
                              updateBlockTask(b.id, t._id, t.moduleName || t.title, t.title);
                              setExpandedTask(null);
                            }}
                            className={`text-[10px] px-2 py-1 rounded font-medium truncate max-w-[200px] border transition-colors ${
                              b.taskId === t._id
                                ? "border-rose-300 bg-rose-100 text-rose-600"
                                : "border-cream-200 bg-white text-stone-500 hover:border-rose-200"
                            }`}
                          >
                            {t.moduleName && <span className="font-bold">{t.moduleName} — </span>}
                            {t.title}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-1.5">
                        <select
                          value={b.taskTopic || ""}
                          onChange={(e) => updateBlockTask(b.id, b.taskId || "", e.target.value, b.taskName || "")}
                          className="flex-1 px-2 py-1 text-[10px] border border-cream-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-rose-300"
                        >
                          <option value="">Subject...</option>
                          {subjectOptions.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={b.taskName || ""}
                          onChange={(e) => updateBlockTask(b.id, b.taskId || "", b.taskTopic || "", e.target.value)}
                          placeholder="Task name"
                          className="flex-1 px-2 py-1 text-[10px] border border-cream-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-rose-300"
                        />
                      </div>
                      <button
                        onClick={() => setExpandedTask(null)}
                        className="text-[10px] font-bold text-stone-400 hover:text-stone-600"
                      >
                        Done
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex gap-2 flex-wrap pt-2">
          <button onClick={() => addBlock("work")} className="px-3 py-1.5 text-xs font-bold border-2 border-dashed border-rose-300 text-rose-400 rounded-lg hover:bg-rose-50 transition-colors">
            + Work
          </button>
          <button onClick={() => addBlock("short-break")} className="px-3 py-1.5 text-xs font-bold border-2 border-dashed border-mint-300 text-mint-500 rounded-lg hover:bg-mint-50 transition-colors">
            + Break
          </button>
          <button onClick={() => addBlock("long-break")} className="px-3 py-1.5 text-xs font-bold border-2 border-dashed border-mint-300 text-mint-500 rounded-lg hover:bg-mint-50 transition-colors">
            + Long Break
          </button>
        </div>
      </div>

      {/* Schedule preview */}
      {cycleBlocks.length > 0 && (
        <div className="bg-white rounded-xl border border-cream-200 p-3 space-y-2">
          <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">
            Schedule ({totalMinutes}m total)
          </p>
          <div className="space-y-1">
            {scheduleTimes.map(({ block, start, end }, i) => {
              const isWork = block.type === "work";
              const color = isWork ? "bg-rose-400" : "bg-mint-400";
              const textColor = isWork ? "text-rose-500" : "text-mint-500";
              const hasTask = block.taskTopic || block.taskName || block.taskId;
              return (
                <div key={i} className="flex items-center gap-2.5 text-xs">
                  <span className="w-10 text-right font-bold text-stone-400 flex-shrink-0">
                    {formatTime(start)}
                  </span>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${color}`} />
                  <span className={`font-bold min-w-[60px] ${textColor}`}>
                    {getBlockLabel(block)}
                  </span>
                  <span className="text-stone-400">{block.duration}m</span>
                  <span className="flex-1 text-stone-500 truncate">
                    {hasTask
                      ? block.taskName || block.taskTopic || "Task"
                      : isWork
                        ? <span className="text-stone-300 italic">no task</span>
                        : null}
                  </span>
                  <span className="w-10 text-right text-stone-400 flex-shrink-0">
                    {formatTime(end)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
  todos,
  onComplete,
  onEnd,
  showToast,
}: {
  pomoTick: number;
  addSession: (date: string, time: string, minutes: number, topic: string) => Promise<unknown>;
  todos: { _id: string; title: string; moduleName?: string; category?: string }[];
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
      <PhaseTimeline timer={timer} todos={todos} />
    </div>
  );
}

function PhaseTimeline({
  timer,
  todos,
}: {
  timer: ReturnType<typeof getTimerInstance>;
  todos: { _id: string; title: string; moduleName?: string; category?: string }[];
}) {
  const [, forceRender] = useState(0);
  const dragRef = useRef<{
    type: "resize-right" | "resize-left" | "reorder";
    phaseIdx: number;
    startX: number;
    startDuration: number;
    startOrderIdx: number;
  } | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragOverIdxRef = useRef<number | null>(null);

  if (!timer || !timer.cyclePhases.length) return null;
  const t = timer;
  const future = t.cyclePhases.slice(t.currentPhaseIndex + 1);
  if (future.length === 0) return null;

  const totalDuration = future.reduce((s, p) => s + p.duration, 0);
  const PX_PER_MIN = 8;
  const totalPx = totalDuration * PX_PER_MIN;

  const phases = future.map((phase, relativeIdx) => {
    const prevDurations = future.slice(0, relativeIdx).reduce((s, p) => s + p.duration, 0);
    const startPx = prevDurations * PX_PER_MIN;
    const widthPx = phase.duration * PX_PER_MIN;
    const idx = t.currentPhaseIndex + 1 + relativeIdx;
    // compute end time for each block
    const blockEndMs = new Date().getTime() + (prevDurations + phase.duration) * 60 * 1000;
    return { phase, idx, relativeIdx, startPx, widthPx, endTime: new Date(blockEndMs) };
  });

  // --- drag handlers ---
  function handleMouseMove(e: MouseEvent) {
    const drag = dragRef.current;
    if (!drag) return;

    if (drag.type === "resize-right" || drag.type === "resize-left") {
      const deltaPx = e.clientX - drag.startX;
      const deltaMin = Math.round(deltaPx / PX_PER_MIN);
      const sign = drag.type === "resize-left" ? -1 : 1;
      const newDuration = Math.max(1, drag.startDuration + deltaMin * sign);
      t.updatePhaseDuration(drag.phaseIdx, newDuration);
      forceRender((n) => n + 1);
    } else if (drag.type === "reorder") {
      const deltaPx = e.clientX - drag.startX;
      const movedSlots = Math.round(deltaPx / 80);
      const newIdx = Math.max(0, Math.min(future.length - 1, drag.startOrderIdx + movedSlots));
      if (newIdx !== drag.startOrderIdx) {
        dragOverIdxRef.current = newIdx;
        setDragOverIdx(newIdx);
      } else {
        dragOverIdxRef.current = null;
        setDragOverIdx(null);
      }
    }
  }

  function handleMouseUp() {
    const drag = dragRef.current;
    const overIdx = dragOverIdxRef.current;
    if (drag?.type === "reorder" && overIdx !== null && overIdx !== drag.startOrderIdx) {
      const fromIdx = t.currentPhaseIndex + 1 + drag.startOrderIdx;
      const toIdx = t.currentPhaseIndex + 1 + overIdx;
      t.swapFuturePhases(fromIdx, toIdx);
      forceRender((n) => n + 1);
    }
    dragRef.current = null;
    dragOverIdxRef.current = null;
    setDragOverIdx(null);
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
  }

  const handleMouseDown = (
    e: React.MouseEvent,
    type: "resize-right" | "resize-left" | "reorder",
    phaseIdx: number,
    relativeIdx: number,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const phase = future[relativeIdx];
    dragRef.current = {
      type,
      phaseIdx,
      startX: e.clientX,
      startDuration: phase.duration,
      startOrderIdx: relativeIdx,
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div className="pt-3">
      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2 text-center">
        Upcoming
      </p>

      {/* Bars */}
      <div
        className="relative h-14 mx-auto bg-cream-100 rounded-xl overflow-hidden border border-cream-200"
        style={{ width: Math.max(totalPx, 200) }}
      >
        {phases.map(({ phase, idx, relativeIdx, startPx, widthPx }) => {
          const isWork = phase.type === "work";
          const bg = isWork
            ? "bg-rose-300/50 hover:bg-rose-300/60"
            : "bg-mint-300/50 hover:bg-mint-300/60";
          const isDragging = dragOverIdx === relativeIdx;

          return (
            <div
              key={idx}
              className={`absolute top-1.5 h-11 rounded-lg border text-center flex flex-col items-center justify-center cursor-grab active:cursor-grabbing transition-[width,left] select-none ${
                isDragging ? "ring-2 ring-lavender-400 z-10" : ""
              } ${bg} ${isWork ? "border-rose-200" : "border-mint-200"}`}
              style={{ left: startPx + 2, width: Math.max(widthPx - 4, 20) }}
              onMouseDown={(e) => handleMouseDown(e, "reorder", idx, relativeIdx)}
            >
              <div
                className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-black/10 rounded-l-lg"
                onMouseDown={(e) => handleMouseDown(e, "resize-left", idx, relativeIdx)}
              />
              <span className="text-[9px] font-bold leading-tight truncate max-w-full px-1">
                {isWork ? `W${relativeIdx + 1}` : phase.label}
              </span>
              {phase.taskName && isWork && (
                <span className="text-[8px] text-rose-500 truncate max-w-full px-1 leading-tight">
                  {phase.taskName}
                </span>
              )}
              {!phase.taskName && isWork && (
                <span className="text-[8px] text-stone-300 italic truncate max-w-full px-1 leading-tight">
                  no task
                </span>
              )}
              <span className="text-[8px] text-stone-400">{phase.duration}m</span>
              <div
                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-black/10 rounded-r-lg"
                onMouseDown={(e) => handleMouseDown(e, "resize-right", idx, relativeIdx)}
              />
            </div>
          );
        })}
      </div>

      {/* Time marker under each block */}
      <div
        className="flex mx-auto mt-1"
        style={{ width: Math.max(totalPx, 200) }}
      >
        {phases.map((p, i) => (
          <div
            key={i}
            className="text-center text-[8px] text-stone-400"
            style={{ width: p.widthPx, flexShrink: 0 }}
          >
            <span>{formatTime(p.endTime)}</span>
          </div>
        ))}
      </div>

      {/* Task assignment for work blocks */}
      <div className="flex gap-2 flex-wrap justify-center mt-2">
        {phases.filter(p => p.phase.type === "work").map(({ phase, idx, relativeIdx }) => (
          <div key={idx} className="flex items-center gap-1">
            <span className="text-[9px] font-bold text-rose-400">W{relativeIdx + 1}</span>
            <select
              value={phase.taskTopic || ""}
              onChange={(e) => {
                const tid = e.target.value;
                if (tid) {
                  const td = todos.find(t => t._id === tid);
                  t.updatePhaseTask(idx, td?.moduleName || td?.title || "", td?.title || "");
                } else {
                  t.updatePhaseTask(idx, "", "");
                }
                forceRender((n) => n + 1);
              }}
              className="text-[9px] px-1.5 py-0.5 border border-cream-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-rose-300 max-w-[140px] text-stone-600 truncate"
            >
              <option value="">— task —</option>
              {todos.slice(0, 15).map(td => (
                <option key={td._id} value={td._id}>
                  {td.moduleName ? `${td.moduleName} — ` : ""}{td.title}
                </option>
              ))}
            </select>
          </div>
        ))}
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
