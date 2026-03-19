import { useState } from "react";
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
};

type DailyNote = {
  _id: Id<"dailyNotes">;
  text: string;
  targetTime?: string;
  completed: boolean;
  order: number;
};

// ── main component ─────────────────────────────────────────────────────────
export function DashboardView({ onGoToTodos, onGoToSchedule }: {
  onGoToTodos: () => void;
  onGoToSchedule: () => void;
}) {
  const todayStr = getTodayStr();
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateDisplay = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="px-6 pt-8 pb-6">
        <p className="text-sm font-medium text-slate-400 mb-0.5">{dateDisplay}</p>
        <h1 className="text-2xl font-bold text-slate-900">{greeting} 👋</h1>
      </div>

      {/* Dashboard grid */}
      <div className="px-6 pb-8 grid grid-cols-1 lg:grid-cols-3 gap-5">
        <SchedulePanel todayStr={todayStr} now={now} onGoToSchedule={onGoToSchedule} />
        <TasksPanel todayStr={todayStr} onGoToTodos={onGoToTodos} />
        <NotesPanel todayStr={todayStr} />
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
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      }
      badge={totalCount > 0 ? `${doneCount}/${totalCount}` : undefined}
      action={{ label: "Full view", onClick: onGoToSchedule }}
    >
      {events === undefined ? (
        <LoadingSpinner />
      ) : events.length === 0 ? (
        <EmptyState icon="📅" message="No classes today" sub="Check Settings to import your timetable" />
      ) : (
        <div className="space-y-1.5">
          {events.map((event) => {
            const status = event.occurrence?.status ?? "pending";
            const isDone = status === "done";
            const isPast = event.startTime < currentTime && !isDone;
            return (
              <button
                key={event._id}
                onClick={() => handleToggle(event)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all group ${isDone
                  ? "bg-slate-50 border-slate-100 opacity-60"
                  : isPast
                    ? "bg-orange-50 border-orange-100 hover:border-orange-200"
                    : "bg-white border-slate-100 hover:border-slate-200"
                  }`}
              >
                {/* Time bar */}
                <div className="flex-shrink-0 text-right w-10">
                  <span className="text-xs font-medium text-slate-400">{event.startTime}</span>
                </div>
                {/* Status dot */}
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isDone ? "bg-green-400" : isPast ? "bg-orange-400" : "bg-blue-400"
                  }`} />
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${isDone ? "line-through text-slate-400" : "text-slate-800"}`}>
                    {event.title}
                  </p>
                  {event.location && (
                    <p className="text-xs text-slate-400 truncate">{event.location}</p>
                  )}
                </div>
                {/* Done check */}
                <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isDone ? "bg-green-500 border-green-500" : "border-slate-200 group-hover:border-green-300"
                  }`}>
                  {isDone && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </button>
            );
          })}
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
      icon={
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      }
      badge={totalCount > 0 ? `${totalCount} open` : undefined}
      action={{ label: "All tasks", onClick: onGoToTodos }}
      headerAction={
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add
        </button>
      }
    >
      {todos === undefined ? (
        <LoadingSpinner />
      ) : relevantTodos.length === 0 ? (
        <EmptyState icon="✓" message="All caught up!" sub="No urgent tasks right now" />
      ) : (
        <div className="space-y-3">
          {dueToday.length > 0 && (
            <TodoGroup label="Due Today" labelColor="text-blue-600" todos={dueToday} onToggle={handleToggle} />
          )}

          {upcoming.length > 0 && (
            <TodoGroup label="Coming Up" labelColor="text-slate-500" todos={upcoming} onToggle={handleToggle} />
          )}
          {overdue.length > 0 && (
            <TodoGroup label="Overdue" labelColor="text-red-500" todos={overdue} onToggle={handleToggle} />
          )}

          {noDue.length > 0 && (
            <TodoGroup label="High Priority" labelColor="text-amber-600" todos={noDue} onToggle={handleToggle} />
          )}
        </div>
      )}
      {showModal && <TodoModal onClose={() => setShowModal(false)} />}
    </PanelCard>
  );
}

function TodoGroup({
  label, labelColor, todos, onToggle,
}: {
  label: string;
  labelColor: string;
  todos: Todo[];
  onToggle: (id: Id<"todos">, completed: boolean) => void;
}) {
  return (
    <div>
      <p className={`text-xs font-semibold uppercase tracking-wide mb-1.5 ${labelColor}`}>{label}</p>
      <div className="space-y-1">
        {todos.map((todo) => {
          const due = todo.dueDate ? formatDueLabel(todo.dueDate) : null;
          return (
            <div
              key={todo._id}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all ${todo.highPriority
                ? "bg-red-50 border-red-100"
                : "bg-white border-slate-100"
                }`}
            >
              <button
                onClick={() => onToggle(todo._id, todo.completed)}
                className="flex-shrink-0 w-4.5 h-4.5 rounded-full border-2 border-slate-300 hover:border-green-400 transition-colors flex items-center justify-center"
                style={{ width: 18, height: 18 }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-800 truncate">{todo.title}</p>
              </div>
              {due && (
                <span className={`text-xs font-medium flex-shrink-0 ${due.overdue ? "text-red-500" : due.today ? "text-blue-500" : "text-slate-400"
                  }`}>
                  {due.text}
                </span>
              )}
              {todo.highPriority && (
                <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-red-400" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Notes Panel ─────────────────────────────────────────────────────────────
function NotesPanel({ todayStr }: { todayStr: string }) {
  const [newText, setNewText] = useState("");
  const [newTime, setNewTime] = useState("");
  const [adding, setAdding] = useState(false);

  const liveNotes = useQuery(api.dailyNotes.list, { date: todayStr });
  const notes = (useLocalCache<DailyNote[]>(`dash:notes:${todayStr}`, liveNotes) ?? undefined) as DailyNote[] | undefined;

  const addNote = useMutation(api.dailyNotes.add);
  const toggleNote = useMutation(api.dailyNotes.toggle);
  const removeNote = useMutation(api.dailyNotes.remove);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim()) return;
    setAdding(true);
    try {
      await addNote({ date: todayStr, text: newText.trim(), targetTime: newTime || undefined });
      setNewText("");
      setNewTime("");
    } finally {
      setAdding(false);
    }
  };

  const doneCount = notes?.filter((n) => n.completed).length ?? 0;
  const totalCount = notes?.length ?? 0;

  return (
    <PanelCard
      title="Today's Notes"
      icon={
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      }
      badge={totalCount > 0 ? `${doneCount}/${totalCount}` : undefined}
    >
      {/* Add form */}
      <form onSubmit={handleAdd} className="flex gap-2 mb-4">
        <input
          type="text"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="Add a note for today…"
          className="flex-1 min-w-0 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-400 transition-all"
        />
        <input
          type="time"
          value={newTime}
          onChange={(e) => setNewTime(e.target.value)}
          title="Target time (optional)"
          className="w-24 px-2 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-600 transition-all"
        />
        <button
          type="submit"
          disabled={adding || !newText.trim()}
          className="flex-shrink-0 w-9 h-9 flex items-center justify-center bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </form>

      {/* Notes list */}
      {notes === undefined ? (
        <LoadingSpinner />
      ) : notes.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">No notes yet — add something above</p>
      ) : (
        <div className="space-y-1.5">
          {notes.map((note) => (
            <div
              key={note._id}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border group transition-all ${note.completed
                ? "bg-slate-50 border-slate-100 opacity-60"
                : "bg-white border-slate-100 hover:border-slate-200"
                }`}
            >
              {/* Checkbox */}
              <button
                onClick={() => toggleNote({ id: note._id })}
                className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${note.completed
                  ? "bg-green-500 border-green-500"
                  : "border-slate-300 hover:border-green-400"
                  }`}
              >
                {note.completed && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>

              {/* Text */}
              <span className={`flex-1 text-sm min-w-0 truncate ${note.completed ? "line-through text-slate-400" : "text-slate-800"}`}>
                {note.text}
              </span>

              {/* Target time */}
              {note.targetTime && (
                <span className="flex-shrink-0 text-xs text-slate-400 font-medium">{note.targetTime}</span>
              )}

              {/* Delete */}
              <button
                onClick={() => removeNote({ id: note._id })}
                className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-0.5 text-slate-300 hover:text-red-400 transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </PanelCard>
  );
}

// ── Shared sub-components ────────────────────────────────────────────────────
function PanelCard({
  title, icon, badge, action, headerAction, children,
}: {
  title: string;
  icon: React.ReactNode;
  badge?: string;
  action?: { label: string; onClick: () => void };
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden hover:shadow-md transition-shadow duration-200">
      {/* Panel header */}
      <div className="flex items-center gap-2 px-4 py-3.5 border-b border-slate-100">
        <span className="text-slate-400">{icon}</span>
        <h2 className="text-sm font-semibold text-slate-700 flex-1">{title}</h2>
        {badge && (
          <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full font-medium">
            {badge}
          </span>
        )}
        {headerAction}
        {action && (
          <button
            onClick={action.onClick}
            className="text-xs text-blue-500 hover:text-blue-600 font-medium transition-colors ml-1"
          >
            {action.label} →
          </button>
        )}
      </div>
      {/* Panel body */}
      <div className="flex-1 p-4 overflow-y-auto max-h-[420px]">
        {children}
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-20">
      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function EmptyState({ icon, message, sub }: { icon: string; message: string; sub?: string }) {
  return (
    <div className="text-center py-8 text-slate-400">
      <div className="text-3xl mb-2">{icon}</div>
      <p className="text-sm font-medium">{message}</p>
      {sub && <p className="text-xs mt-1">{sub}</p>}
    </div>
  );
}
