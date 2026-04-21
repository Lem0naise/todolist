import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useLocalCache } from "../hooks/useLocalCache";
import { TodoModal } from "./TodoModal";
import type { Id } from "../../convex/_generated/dataModel";

// ── helpers ────────────────────────────────────────────────────────────────
function getTodayStr() {
  return new Date().toISOString().split("T")[0];
}

function formatDueLabel(dateStr: string): { text: string; overdue: boolean; today: boolean } {
  const today = getTodayStr();
  const diff = Math.floor(
    (new Date(dateStr + "T12:00:00").getTime() - new Date(today + "T12:00:00").getTime()) / 86400000
  );
  if (dateStr === today) return { text: "Today", overdue: false, today: true };
  if (diff === 1) return { text: "Tomorrow", overdue: false, today: false };
  if (diff === -1) return { text: "Yesterday", overdue: true, today: false };
  if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, overdue: true, today: false };
  if (diff <= 7) return { text: `In ${diff}d`, overdue: false, today: false };
  return { text: new Date(dateStr + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }), overdue: false, today: false };
}

// ── types ──────────────────────────────────────────────────────────────────
type TodayEvent = {
  _id: Id<"timetableEvents">;
  title: string;
  location?: string;
  startTime: string;
  endTime?: string;
  occurrence: { _id: Id<"occurrences">; status: "pending" | "done" | "todo" } | null;
};

type Todo = {
  _id: Id<"todos">;
  title: string;
  dueDate?: string;
  highPriority: boolean;
  completed: boolean;
  createdAt: number;
  category?: "lecture_catchup" | "project" | "other";
  subTasks?: { id: string; title: string; done: boolean }[];
  manualProgress?: number;
};

type DailyNote = {
  _id: Id<"dailyNotes">;
  text: string;
  targetTime?: string;
  completed: boolean;
  order: number;
  createdAt: number;
};

// ── main component ─────────────────────────────────────────────────────────
export function DashboardView({ onGoToTodos, onGoToSchedule }: {
  onGoToTodos: () => void;
  onGoToSchedule: () => void;
}) {
  const todayStr = getTodayStr();
  const [now, setNow] = useState(new Date());

  // Update clock every minute
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateDisplay = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      {/* Header */}
      <div className="px-6 pt-8 pb-6">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-0.5">{dateDisplay}</p>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{greeting} 👋</h1>
      </div>

      {/* Dashboard container - Bento layout on large screens */}
      <div className="px-6 pb-8 mx-auto xl:max-w-7xl max-w-5xl">
        <div className="flex flex-col lg:flex-row gap-5">
          {/* Left Column (Schedule + Notes) - 55% width */}
          <div className="flex flex-col gap-5 lg:w-[55%]">
            <div className="flex-none">
              <SchedulePanel todayStr={todayStr} now={now} onGoToSchedule={onGoToSchedule} />
            </div>
            <div className="flex-1 min-h-[300px]">
              <NotesPanel />
            </div>
          </div>
          
          {/* Right Column (Tasks) - 45% width */}
          <div className="flex-1 h-full lg:max-h-[calc(100vh-140px)]">
            <TasksPanel todayStr={todayStr} onGoToTodos={onGoToTodos} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Schedule Panel ──────────────────────────────────────────────────────────
function SchedulePanel({ todayStr, now, onGoToSchedule }: {
  todayStr: string;
  now: Date;
  onGoToSchedule: () => void;
}) {
  const dayOfWeek = new Date(todayStr + "T12:00:00").getDay();
  const liveEvents = useQuery(api.timetable.getForDate, { date: todayStr, dayOfWeek });
  const events = (useLocalCache<TodayEvent[]>(`dash:schedule:${todayStr}`, liveEvents) ?? undefined) as TodayEvent[] | undefined;
  const setStatus = useMutation(api.occurrences.setStatus);

  const aliasesQuery = useQuery(api.aliases.list);
  const aliases = useLocalCache("aliases", aliasesQuery) || [];
  const aliasesMap = new Map<string, string>();
  for (const a of aliases) {
    aliasesMap.set(a.originalTitle.toLowerCase(), a.alias);
  }
  function applyAlias(title: string): string {
    const cleanTitle = title.replace(/^Missed:\s*/i, "");
    return aliasesMap.get(cleanTitle.toLowerCase()) ?? cleanTitle;
  }

  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const handleToggle = async (event: TodayEvent) => {
    const current = event.occurrence?.status ?? "pending";
    await setStatus({ eventId: event._id, date: todayStr, status: current === "done" ? "pending" : "done" });
  };

  const doneCount = events?.filter((e) => e.occurrence?.status === "done").length ?? 0;
  const totalCount = events?.length ?? 0;

  return (
    <PanelCard
      title="Today's Schedule"
      icon={
        <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      }
      badge={totalCount > 0 ? `${doneCount}/${totalCount}` : undefined}
      action={{ label: "Full view", onClick: onGoToSchedule }}
      headerAction={<span className="text-xs font-bold px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg ml-auto">{currentTime}</span>}
    >
      {events === undefined ? (
        <LoadingSpinner />
      ) : events.length === 0 ? (
        <EmptyState icon="📅" message="No classes today" sub="Check Settings to import your timetable" />
      ) : (
        <div className="space-y-1.5 pt-1 relative">
          {(() => {
            const elements = [];
            let nowBarInserted = false;

            const insertNowBar = () => {
              elements.push(
                <div key="now-bar" className="flex items-center gap-3 my-2 opacity-90 relative z-10 transition-all duration-300">
                  <div className="flex-shrink-0 text-right w-10">
                    <span className="text-[10px] font-bold text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-400/10 px-1 py-0.5 rounded animate-pulse">Now</span>
                  </div>
                  <div className="flex-1 h-[2px] bg-red-400 dark:bg-red-500/80 rounded-full relative">
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]" />
                  </div>
                  <div className="flex-shrink-0 w-5" />
                </div>
              );
              nowBarInserted = true;
            };

            for (let i = 0; i < events.length; i++) {
              const event = events[i];
              if (!nowBarInserted && event.startTime > currentTime) {
                insertNowBar();
              }
              const status = event.occurrence?.status ?? "pending";
              const isDone = status === "done";
              const isPast = event.startTime < currentTime && !isDone;
              
              // If it's the exact currently active class, give it a subtle highlight
              const isActive = (event.startTime <= currentTime) && (!event.endTime || event.endTime > currentTime) && !isDone;

              elements.push(
                <button
                  key={event._id}
                  onClick={() => handleToggle(event)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all duration-200 group ${
                    isDone
                      ? "bg-slate-50 border-slate-100 opacity-60 dark:bg-slate-900/50 dark:border-slate-800"
                      : isPast
                        ? "bg-orange-50 border-orange-100 hover:border-orange-200 dark:bg-orange-900/10 dark:border-orange-800/50 dark:hover:border-orange-700/80"
                        : isActive
                          ? "bg-blue-50/50 border-blue-200 shadow-sm ring-1 ring-blue-100 dark:bg-blue-900/10 dark:border-blue-800/60 dark:ring-blue-900/30"
                          : "bg-white border-slate-100 hover:border-slate-200 dark:bg-slate-800/80 dark:border-slate-700 dark:hover:border-slate-600"
                    }`}
                >
                  {/* Time bar */}
                  <div className="flex-shrink-0 text-right w-10">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{event.startTime}</span>
                  </div>
                  {/* Status dot */}
                  <div className="relative flex items-center justify-center">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 z-10 ${
                      isDone ? "bg-green-400 dark:bg-green-500" : 
                      isPast ? "bg-orange-400 dark:bg-orange-500" : 
                      isActive ? "bg-blue-500 animate-pulse" : 
                      "bg-blue-300 dark:bg-blue-600"
                    }`} />
                    {isActive && <div className="absolute w-4 h-4 bg-blue-400/30 dark:bg-blue-500/30 rounded-full animate-ping" />}
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0 py-0.5">
                    <p className={`text-sm font-semibold truncate ${
                      isDone ? "line-through text-slate-400 dark:text-slate-500" : 
                      isActive ? "text-blue-900 dark:text-blue-100" :
                      "text-slate-800 dark:text-slate-200"
                    }`}>
                      {applyAlias(event.title)}
                    </p>
                    {event.location && (
                      <p className={`text-xs truncate mt-0.5 ${isActive ? "text-blue-600/80 dark:text-blue-300/80" : "text-slate-400 dark:text-slate-500"}`}>{event.location}</p>
                    )}
                  </div>
                  {/* Done check */}
                  <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                    isDone ? "bg-green-500 border-green-500 dark:bg-green-600 dark:border-green-600" : 
                    "border-slate-200 dark:border-slate-600 group-hover:border-green-300 dark:group-hover:border-green-500"
                  }`}>
                    {isDone && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </button>
              );
            }
            if (!nowBarInserted) {
              insertNowBar();
            }
            return elements;
          })()}
        </div>
      )}
    </PanelCard>
  );
}

// ── Tasks Panel ─────────────────────────────────────────────────────────────
function TasksPanel({ todayStr, onGoToTodos }: { todayStr: string; onGoToTodos: () => void }) {
  const [showModal, setShowModal] = useState(false);
  const liveTodos = useQuery(api.todos.list, { includeCompleted: false });
  const todos = (useLocalCache<Todo[]>("dash:todos", liveTodos) ?? undefined) as Todo[] | undefined;
  const completeTodo = useMutation(api.todos.complete);

  const handleToggle = (id: Id<"todos">, completed: boolean) => {
    completeTodo({ id, completed: !completed });
  };

  // Filter: due today + due in next 3 days + overdue high-priority
  const relevantTodos = todos?.filter((t) => {
    if (!t.dueDate) return t.highPriority; // show high-priority with no date
    const diff = Math.floor(
      (new Date(t.dueDate + "T12:00:00").getTime() - new Date(todayStr + "T12:00:00").getTime()) / 86400000
    );
    return diff <= 3 || (diff < 0 && t.highPriority); // due within 3 days, or overdue+high priority
  }) ?? [];

  // Group
  const overdue = relevantTodos.filter((t) => t.dueDate && t.dueDate < todayStr);
  const dueToday = relevantTodos.filter((t) => t.dueDate === todayStr);
  const upcoming = relevantTodos.filter((t) => t.dueDate && t.dueDate > todayStr);
  const noDue = relevantTodos.filter((t) => !t.dueDate);

  const totalCount = todos?.length ?? 0;

  return (
    <PanelCard
      title="Tasks"
      isFullHeight={true}
      icon={
        <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      }
      badge={totalCount > 0 ? `${totalCount} open` : undefined}
      action={{ label: "All tasks", onClick: onGoToTodos }}
      headerAction={
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg ml-auto hover:bg-blue-100 dark:hover:bg-blue-800/40 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Task
        </button>
      }
    >
      {todos === undefined ? (
        <LoadingSpinner />
      ) : relevantTodos.length === 0 ? (
        <EmptyState icon="✓" message="All caught up!" sub="No urgent tasks right now" />
      ) : (
        <div className="space-y-4">
          {dueToday.length > 0 && (
            <TodoGroup label="Due Today" labelColor="text-blue-600 dark:text-blue-400" bgFade="bg-blue-50/30 dark:bg-blue-900/10" todos={dueToday} onToggle={handleToggle} />
          )}

          {upcoming.length > 0 && (
            <TodoGroup label="Coming Up" labelColor="text-slate-500 dark:text-slate-400" bgFade="" todos={upcoming} onToggle={handleToggle} />
          )}
          
          {overdue.length > 0 && (
            <TodoGroup label="Overdue" labelColor="text-red-500 dark:text-red-400" bgFade="bg-red-50/30 dark:bg-red-900/10" todos={overdue} onToggle={handleToggle} />
          )}

          {noDue.length > 0 && (
            <TodoGroup label="High Priority" labelColor="text-amber-600 dark:text-amber-500" bgFade="bg-amber-50/30 dark:bg-amber-900/10" todos={noDue} onToggle={handleToggle} />
          )}
        </div>
      )}
      {showModal && <TodoModal onClose={() => setShowModal(false)} />}
    </PanelCard>
  );
}

function TodoGroup({
  label, labelColor, bgFade, todos, onToggle,
}: {
  label: string;
  labelColor: string;
  bgFade: string;
  todos: Todo[];
  onToggle: (id: Id<"todos">, completed: boolean) => void;
}) {
  return (
    <div className={`p-3 rounded-xl border border-slate-100 dark:border-slate-800 ${bgFade || 'bg-slate-50/30 dark:bg-slate-800/30'}`}>
      <p className={`text-[11px] font-bold uppercase tracking-wider mb-2.5 ${labelColor}`}>{label}</p>
      <div className="space-y-1.5">
        {todos.map((todo) => {
          const due = todo.dueDate ? formatDueLabel(todo.dueDate) : null;
          const isProject = (todo.category ?? "other") === "project";
          const isCatchup = todo.category === "lecture_catchup";
          // Compute progress for project todos
          let progress: number | null = null;
          if (isProject) {
            if (todo.subTasks && todo.subTasks.length > 0) {
              progress = Math.round(todo.subTasks.filter((s) => s.done).length / todo.subTasks.length * 100);
            } else if (typeof todo.manualProgress === "number") {
              progress = todo.manualProgress;
            }
          }
          return (
            <div
              key={todo._id}
              className={`flex flex-col gap-1.5 px-3 py-2.5 rounded-xl border transition-all shadow-sm shadow-slate-200/20 dark:shadow-none hover:shadow-md ${
                todo.highPriority ? "bg-red-50 border-red-100 dark:bg-red-900/10 dark:border-red-800/50" :
                isProject ? "bg-purple-50 border-purple-100 dark:bg-purple-900/10 dark:border-purple-800/50" :
                isCatchup ? "bg-blue-50 border-blue-100 dark:bg-blue-900/10 dark:border-blue-800/50" :
                "bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700"
              }`}
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onToggle(todo._id, todo.completed)}
                  className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-500 hover:border-green-400 dark:hover:border-green-400 transition-colors flex items-center justify-center bg-white dark:bg-slate-900"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{todo.title}</p>
                </div>
                {isCatchup && (
                  <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 bg-blue-100/80 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded font-bold uppercase tracking-wider">Catchup</span>
                )}
                {isProject && (
                  <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 bg-purple-100/80 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 rounded font-bold uppercase tracking-wider">Project</span>
                )}
                {due && (
                  <span className={`text-[11px] font-bold flex-shrink-0 ${
                    due.overdue ? "text-red-600 dark:text-red-400" : due.today ? "text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-400"
                  }`}>
                    {due.text}
                  </span>
                )}
                {todo.highPriority && (
                  <span className="flex-shrink-0 w-2 h-2 rounded-full bg-red-400 dark:bg-red-500 shadow-[0_0_8px_rgba(248,113,113,0.6)]" />
                )}
              </div>
              {isProject && progress !== null && (
                <div className="flex items-center gap-2 pl-8 pt-0.5 pb-0.5 opacity-90">
                  <div className="flex-1 h-1.5 bg-purple-200 dark:bg-purple-900/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 dark:bg-purple-400 rounded-full transition-all duration-300 relative overflow-hidden"
                      style={{ width: `${progress}%` }}
                    >
                      <div className="absolute inset-0 bg-white/20 dark:bg-white/10" style={{ transform: 'translateX(-100%)', animation: 'progress-shine 2s infinite' }} />
                    </div>
                  </div>
                  <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold w-8 text-right">{progress}%</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Notes Panel (Persistent Sticky Notes) ──────────────────────────────────
function NotesPanel() {
  const [newText, setNewText] = useState("");
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Use listAll instead of getting notes for a specific date
  const liveNotes = useQuery(api.dailyNotes.listAll);
  const notes = (useLocalCache<DailyNote[]>(`dash:notes:all`, liveNotes) ?? undefined) as DailyNote[] | undefined;

  const addNote = useMutation(api.dailyNotes.add);
  const toggleNote = useMutation(api.dailyNotes.toggle);
  const removeNote = useMutation(api.dailyNotes.remove);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim()) return;
    setAdding(true);
    try {
      await addNote({ date: getTodayStr(), text: newText.trim() });
      setNewText("");
    } finally {
      setAdding(false);
    }
  };

  const incompleteCount = notes?.filter((n) => !n.completed).length ?? 0;

  return (
    <PanelCard
      title="Sticky Notes"
      isFullHeight={true}
      icon={
        <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      }
      badge={incompleteCount > 0 ? `${incompleteCount} notes` : undefined}
    >
      {/* Add form */}
      <form onSubmit={handleAdd} className="flex gap-2 mb-4 relative">
        <input
          ref={inputRef}
          type="text"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="Jot something down..."
          className="flex-1 min-w-0 px-3.5 py-2.5 text-sm font-medium bg-amber-50/50 dark:bg-slate-800/50 border border-amber-200/50 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 dark:focus:ring-blue-500 placeholder-amber-400/70 dark:placeholder-slate-500 text-amber-900 dark:text-slate-100 transition-all shadow-inner"
        />
        <div className="absolute right-14 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:block">
           <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 dark:text-slate-500 px-1.5 py-0.5 bg-amber-100/50 dark:bg-slate-700 rounded">N</span>
        </div>
        <button
          type="submit"
          disabled={adding || !newText.trim()}
          className="flex-shrink-0 w-10.5 h-10.5 flex items-center justify-center bg-amber-400 hover:bg-amber-500 dark:bg-blue-600 dark:hover:bg-blue-700 disabled:bg-slate-200 dark:disabled:bg-slate-700 text-amber-950 dark:text-white rounded-xl transition-all font-bold disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </form>

      {/* Notes list */}
      {notes === undefined ? (
        <LoadingSpinner />
      ) : notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 opacity-60">
          <svg className="w-10 h-10 text-amber-300 dark:text-slate-600 mb-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
          </svg>
          <p className="text-sm font-medium text-amber-800 dark:text-slate-400">Empty board</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
          {notes.map((note) => {
            const addedDate = new Date(note.createdAt).toLocaleDateString("en-GB", { day: 'numeric', month: 'short' });
            return (
              <div
                key={note._id}
                className={`flex flex-col gap-2 px-3.5 py-3 rounded-xl border group transition-all relative overflow-hidden ${
                  note.completed
                    ? "bg-slate-50 border-slate-100 opacity-50 dark:bg-slate-900/40 dark:border-slate-800 text-slate-500"
                    : "bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200/60 dark:from-slate-800 dark:to-slate-800 dark:border-slate-700 shadow-sm text-slate-800 dark:text-slate-200"
                  }`}
              >
                {!note.completed && <div className="absolute top-0 right-0 w-8 h-8 bg-gradient-to-bl from-amber-200/40 to-transparent dark:from-slate-600/40 opacity-70" style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }} />}
                
                <div className="flex items-start gap-2.5 relative z-10">
                  <button
                    onClick={() => toggleNote({ id: note._id })}
                    className={`flex-shrink-0 mt-0.5 w-4.5 h-4.5 mb-1 rounded-sm border-2 flex items-center justify-center transition-colors bg-white/50 dark:bg-slate-900/50 ${
                      note.completed
                        ? "bg-slate-300 dark:bg-slate-600 border-slate-300 dark:border-slate-600"
                        : "border-amber-400/80 dark:border-slate-500 hover:bg-amber-100 dark:hover:bg-slate-700 hover:border-amber-500 dark:hover:border-slate-400"
                      }`}
                    style={{ width: 18, height: 18 }}
                  >
                    {note.completed && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
  
                  <p className={`flex-1 text-[13px] font-medium leading-relaxed min-w-0 break-words ${note.completed ? "line-through" : ""}`}>
                    {note.text}
                  </p>
  
                  <button
                    onClick={() => removeNote({ id: note._id })}
                    className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1 text-amber-500 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 transition-all bg-amber-100/50 hover:bg-red-100 dark:bg-slate-700/50 dark:hover:bg-red-900/40 rounded-md -mr-1 -mt-1"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="flex items-center justify-between pl-7 pr-1 opacity-70">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600/70 dark:text-slate-500">{addedDate}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PanelCard>
  );
}

// ── Shared sub-components ────────────────────────────────────────────────────
function PanelCard({
  title, icon, badge, action, headerAction, isFullHeight = false, children,
}: {
  title: string;
  icon: React.ReactNode;
  badge?: string;
  action?: { label: string; onClick: () => void };
  headerAction?: React.ReactNode;
  isFullHeight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden transition-all duration-200 ${isFullHeight ? "h-full" : ""}`}>
      {/* Panel header */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900 w-full h-[60px] flex-none">
        <span className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg">{icon}</span>
        <h2 className="text-[15px] font-bold text-slate-800 dark:text-slate-100 tracking-tight">{title}</h2>
        {badge && (
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded font-bold ml-1">
            {badge}
          </span>
        )}
        <div className="flex-1" />
        {headerAction}
        {action && (
          <button
            onClick={action.onClick}
            className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 transition-colors ml-2 px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {action.label} ↗
          </button>
        )}
      </div>
      {/* Panel body */}
      <div className={`flex-1 p-5 overflow-y-auto ${!isFullHeight ? "max-h-[460px]" : "min-h-0"}`}>
        {children}
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center p-10 h-full">
      <div className="w-5 h-5 border-[3px] border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function EmptyState({ icon, message, sub }: { icon: string; message: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center h-full">
      <div className="text-4xl mb-3 opacity-80 filter drop-shadow-sm grayscale-[30%]">{icon}</div>
      <p className="text-[15px] font-bold text-slate-600 dark:text-slate-300">{message}</p>
      {sub && <p className="textxs font-medium text-slate-400 dark:text-slate-500 mt-1 max-w-[200px] leading-relaxed">{sub}</p>}
    </div>
  );
}
