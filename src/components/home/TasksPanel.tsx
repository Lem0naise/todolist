import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useLocalCache } from "../../hooks/useLocalCache";
import { useGuest } from "../../hooks/useGuestMode";
import { TodoModal } from "../todos/TodoModal";
import { PanelCard } from "./PanelCard";
import type { Id } from "../../../convex/_generated/dataModel";

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

function getTodayStr() {
  return new Date().toISOString().split("T")[0];
}

function formatDueLabel(dateStr: string): {
  text: string;
  overdue: boolean;
  today: boolean;
} {
  const today = getTodayStr();
  const diff = Math.floor(
    (new Date(dateStr + "T12:00:00").getTime() -
      new Date(today + "T12:00:00").getTime()) /
      86400000,
  );
  if (dateStr === today)
    return { text: "Today", overdue: false, today: true };
  if (diff === 1) return { text: "Tomorrow", overdue: false, today: false };
  if (diff === -1) return { text: "Yesterday", overdue: true, today: false };
  if (diff < 0)
    return { text: `${Math.abs(diff)}d ago`, overdue: true, today: false };
  if (diff <= 7) return { text: `In ${diff}d`, overdue: false, today: false };
  return {
    text: new Date(dateStr + "T12:00:00").toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    }),
    overdue: false,
    today: false,
  };
}

function ListIcon() {
  return (
    <svg className="w-4 h-4 text-lavender-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  );
}

export function TasksPanel({
  todayStr,
  onGoToTodos,
}: {
  todayStr: string;
  onGoToTodos: () => void;
}) {
  const { isGuest } = useGuest();
  const [showModal, setShowModal] = useState(false);
  const liveTodos = useQuery(api.todos.list, { includeCompleted: false });
  const todos = (useLocalCache<Todo[]>("combined:todos", liveTodos) ??
    undefined) as Todo[] | undefined;
  const completeTodo = useMutation(api.todos.complete);

  const handleToggle = (id: Id<"todos">, completed: boolean) => {
    completeTodo({ id, completed: !completed });
  };

  const relevantTodos =
    todos?.filter((t) => {
      if (!t.dueDate) return t.highPriority;
      const diff = Math.floor(
        (new Date(t.dueDate + "T12:00:00").getTime() -
          new Date(todayStr + "T12:00:00").getTime()) /
          86400000,
      );
      return diff <= 3 || t.highPriority;
    }) ?? [];

  const overdue = relevantTodos.filter((t) => t.dueDate && t.dueDate < todayStr);
  const dueToday = relevantTodos.filter((t) => t.dueDate === todayStr);
  const upcoming = relevantTodos.filter((t) => t.dueDate && t.dueDate > todayStr);
  const noDue = relevantTodos.filter((t) => !t.dueDate);

  const totalCount = todos?.length ?? 0;

  return (
    <PanelCard
      title="tasks"
      isFullHeight={true}
      icon={<ListIcon />}
      badge={totalCount > 0 ? `${totalCount} open` : undefined}
      action={{ label: "all tasks", onClick: onGoToTodos }}
      headerAction={
        isGuest ? null : (
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 bg-rose-50 text-rose-500 rounded-lg hover:bg-rose-100 transition-colors"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add
        </button>
        )
      }
    >
      {todos === undefined ? (
        <LoadingSpinner />
      ) : relevantTodos.length === 0 ? (
        <EmptyState message="All caught up!" sub="No urgent tasks right now" />
      ) : (
        <div className="space-y-3">
          {dueToday.length > 0 && (
            <TodoGroup
              label="Due Today"
              labelColor="text-rose-500"
              bgFade="bg-rose-50/20"
              todos={dueToday}
              onToggle={handleToggle}
            />
          )}
          {upcoming.length > 0 && (
            <TodoGroup
              label="Coming Up"
              labelColor="text-stone-400"
              bgFade=""
              todos={upcoming}
              onToggle={handleToggle}
            />
          )}
          {overdue.length > 0 && (
            <TodoGroup
              label="Overdue"
              labelColor="text-rose-400"
              bgFade="bg-rose-50/20"
              todos={overdue}
              onToggle={handleToggle}
            />
          )}
          {noDue.length > 0 && (
            <TodoGroup
              label="Priority"
              labelColor="text-amber-600"
              bgFade="bg-amber-50/20"
              todos={noDue}
              onToggle={handleToggle}
            />
          )}
        </div>
      )}
      {showModal && !isGuest && <TodoModal onClose={() => setShowModal(false)} />}
    </PanelCard>
  );
}

function TodoGroup({
  label,
  labelColor,
  bgFade,
  todos,
  onToggle,
}: {
  label: string;
  labelColor: string;
  bgFade: string;
  todos: Todo[];
  onToggle: (id: Id<"todos">, completed: boolean) => void;
}) {
  return (
    <div
      className={`p-2.5 rounded-xl border border-cream-200 ${bgFade || "bg-cream-50/30"}`}
    >
      <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${labelColor}`}>
        {label}
      </p>
      <div className="space-y-1">
        {todos.map((todo) => {
          const due = todo.dueDate ? formatDueLabel(todo.dueDate) : null;
          const isProject = (todo.category ?? "other") === "project";
          let progress: number | null = null;
          if (isProject) {
            if (todo.subTasks && todo.subTasks.length > 0) {
              progress = Math.round(
                (todo.subTasks.filter((s) => s.done).length /
                  todo.subTasks.length) *
                  100,
              );
            } else if (typeof todo.manualProgress === "number") {
              progress = todo.manualProgress;
            }
          }
          return (
            <div
              key={todo._id}
              className={`flex flex-col gap-1 px-2.5 py-1.5 rounded-lg border transition-all ${
                todo.highPriority
                  ? "bg-rose-50 border-rose-100"
                  : isProject
                    ? "bg-rose-50/30 border-rose-100/60"
                    : "bg-white border-cream-200"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => onToggle(todo._id, todo.completed)}
                  className="flex-shrink-0 w-4 h-4 rounded border border-stone-300 hover:border-mint-400 transition-colors flex items-center justify-center bg-white"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-stone-700 truncate">
                    {todo.title}
                  </p>
                </div>
                {todo.moduleName && (
                  <span className="flex-shrink-0 text-[9px] px-1 py-0.5 bg-lavender-100 text-lavender-600 rounded font-bold uppercase tracking-wider max-w-[80px] truncate">
                    {todo.moduleName}
                  </span>
                )}
                {due && (
                  <span
                    className={`text-[10px] font-bold flex-shrink-0 ${
                      due.overdue
                        ? "text-rose-500"
                        : due.today
                          ? "text-rose-400"
                          : "text-stone-400"
                    }`}
                  >
                    {due.text}
                  </span>
                )}
              </div>
              {isProject && progress !== null && (
                <div className="flex items-center gap-2 pl-6.5">
                  <div className="flex-1 h-1 bg-rose-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-rose-300 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-rose-400 font-bold w-7 text-right">
                    {progress}%
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center p-8 h-full">
      <div className="w-5 h-5 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function EmptyState({
  message,
  sub,
}: {
  message: string;
  sub?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center h-full">
      <p className="text-sm font-bold text-stone-500">{message}</p>
      {sub && (
        <p className="text-xs font-medium text-stone-400 mt-1 max-w-[200px] leading-relaxed">
          {sub}
        </p>
      )}
    </div>
  );
}
