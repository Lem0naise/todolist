import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useLocalCache } from "../hooks/useLocalCache";
import { TodoModal } from "./TodoModal";
import type { Id } from "../../convex/_generated/dataModel";

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

type TodayEvent = {
  _id: Id<"timetableEvents">;
  title: string;
  location?: string;
  startTime: string;
  endTime?: string;
  moduleName?: string;
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
  moduleName?: string;
  linkedEventTitle?: string;
};

export function CombinedView({ onGoToTodos, onGoToSchedule }: {
  onGoToTodos: () => void;
  onGoToSchedule: () => void;
}) {
  const todayStr = getTodayStr();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateDisplay = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      <div className="px-6 pt-8 pb-6">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-0.5">{dateDisplay}</p>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{greeting} 👋</h1>
      </div>

      <div className="px-6 pb-8 mx-auto xl:max-w-7xl max-w-5xl">
        <div className="flex flex-col lg:flex-row gap-5">
          <div className="lg:w-[55%]">
            <SchedulePanel todayStr={todayStr} now={now} onGoToSchedule={onGoToSchedule} />
          </div>
          <div className="flex-1">
            <TasksPanel todayStr={todayStr} onGoToTodos={onGoToTodos} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SchedulePanel({ todayStr, now, onGoToSchedule }: {
  todayStr: string;
  now: Date;
  onGoToSchedule: () => void;
}) {
  const dayOfWeek = new Date(todayStr + "T12:00:00").getDay();
  const liveEvents = useQuery(api.timetable.getForDate, { date: todayStr, dayOfWeek });
  const events = (useLocalCache<TodayEvent[]>(`combined:schedule:${todayStr}`, liveEvents) ?? undefined) as TodayEvent[] | undefined;
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
                  <div className="flex-shrink-0 text-right w-10">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{event.startTime}</span>
                  </div>
                  <div className="relative flex items-center justify-center">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 z-10 ${
                      isDone ? "bg-green-400 dark:bg-green-500" : 
                      isPast ? "bg-orange-400 dark:bg-orange-500" : 
                      isActive ? "bg-blue-500 animate-pulse" : 
                      "bg-blue-300 dark:bg-blue-600"
                    }`} />
                    {isActive && <div className="absolute w-4 h-4 bg-blue-400/30 dark:bg-blue-500/30 rounded-full animate-ping" />}
                  </div>
                  <div className="flex-1 min-w-0 py-0.5">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-semibold truncate ${
                        isDone ? "line-through text-slate-400 dark:text-slate-500" : 
                        isActive ? "text-blue-900 dark:text-blue-100" :
                        "text-slate-800 dark:text-slate-200"
                      }`}>
                        {event.title}
                      </p>
                      {event.moduleName && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-800/60 rounded font-bold uppercase tracking-wider truncate max-w-[120px]">
                          {event.moduleName}
                        </span>
                      )}
                    </div>
                    {event.location && (
                      <p className={`text-xs truncate mt-0.5 ${isActive ? "text-blue-600/80 dark:text-blue-300/80" : "text-slate-400 dark:text-slate-500"}`}>{event.location}</p>
                    )}
                  </div>
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

function TasksPanel({ todayStr, onGoToTodos }: { todayStr: string; onGoToTodos: () => void }) {
  const [showModal, setShowModal] = useState(false);
  const liveTodos = useQuery(api.todos.list, { includeCompleted: false });
  const todos = (useLocalCache<Todo[]>("combined:todos", liveTodos) ?? undefined) as Todo[] | undefined;
  const completeTodo = useMutation(api.todos.complete);

  const handleToggle = (id: Id<"todos">, completed: boolean) => {
    completeTodo({ id, completed: !completed });
  };

  const relevantTodos = todos?.filter((t) => {
    if (!t.dueDate) return t.highPriority;
    const diff = Math.floor(
      (new Date(t.dueDate + "T12:00:00").getTime() - new Date(todayStr + "T12:00:00").getTime()) / 86400000
    );
    return diff <= 3 || (diff < 0 && t.highPriority);
  }) ?? [];

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
                {todo.moduleName && (
                  <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 bg-indigo-100/80 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded font-bold uppercase tracking-wider max-w-[100px] truncate">
                    {todo.moduleName}
                  </span>
                )}
                {!todo.moduleName && isCatchup && (
                  <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 bg-blue-100/80 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded font-bold uppercase tracking-wider">Catchup</span>
                )}
                {!todo.moduleName && isProject && (
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
                    />
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
      {sub && <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-1 max-w-[200px] leading-relaxed">{sub}</p>}
    </div>
  );
}
