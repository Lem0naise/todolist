import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useLocalCache } from "../../hooks/useLocalCache";
import { useGuest } from "../../hooks/useGuestMode";
import { useGuestTodos } from "../../hooks/useGuestTodos";
import { PanelCard } from "./PanelCard";
import type { Id } from "../../../convex/_generated/dataModel";
import type { StartableTask } from "../pomo/startForTask";
import { ToastStack } from "../Toast";
import { useToast } from "../../hooks/useToast";
import {
  computeProgress,
  effectiveCategory,
  formatDue,
  isFocusToday,
  isSnoozed,
  pickNextAction,
  type Todo,
} from "../todos/utils";

const OVERLOAD_THRESHOLD = 12;
const GROUP_CAP = 5;

function ListIcon() {
  return (
    <svg className="w-4 h-4 text-lavender-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function SunIcon({ filled }: { filled?: boolean }) {
  return filled ? (
    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2a1 1 0 011 1v2a1 1 0 11-2 0V3a1 1 0 011-1zm0 15a5 5 0 110-10 5 5 0 010 10zM3 11a1 1 0 110 2H2a1 1 0 110-2h1zm19 0a1 1 0 110 2h-1a1 1 0 110-2h1zM5.6 4.2a1 1 0 011.4 0l.7.7A1 1 0 016.3 6.3l-.7-.7a1 1 0 010-1.4zm12 12a1 1 0 011.4 0l.7.7a1 1 0 01-1.4 1.4l-.7-.7a1 1 0 010-1.4z" />
    </svg>
  ) : (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="4" />
      <path strokeLinecap="round" d="M12 3v2m0 14v2M5 5l1.4 1.4M17.6 17.6L19 19M4 12h2m12 0h2M5 19l1.4-1.4M17.6 6.4L19 5" />
    </svg>
  );
}

export function TasksPanel({
  todayStr,
  onGoToTodos,
  onStartPomo,
}: {
  todayStr: string;
  onGoToTodos: () => void;
  onStartPomo: (task: StartableTask) => void;
}) {
  const { isGuest } = useGuest();
  const liveTodos = useQuery(api.todos.list, { includeCompleted: false });
  const cached = useLocalCache<Todo[]>("combined:todos", liveTodos) as
    | Todo[]
    | null
    | undefined;
  const guestTodoData = useGuestTodos(isGuest);
  const todos: Todo[] | undefined = isGuest
    ? (guestTodoData.todos as unknown as Todo[])
    : cached ?? undefined;

  const completeTodo = useMutation(api.todos.complete);
  const setFocus = useMutation(api.todos.setFocus);
  const { toasts, push } = useToast();

  const handleToggle = (id: string, completed: boolean) => {
    if (isGuest) {
      guestTodoData.complete(id, !completed);
    } else {
      completeTodo({ id: id as Id<"todos">, completed: !completed });
    }
    if (!completed) push("Task completed");
  };

  const handleToggleFocus = (todo: Todo) => {
    const focused = isFocusToday(todo, todayStr);
    const next = focused ? undefined : todayStr;
    if (isGuest) {
      guestTodoData.setFocus(todo._id, next);
    } else {
      setFocus({ id: todo._id as Id<"todos">, focusDate: next });
    }
  };

  const startPomo = (todo: Todo) =>
    onStartPomo({
      _id: todo._id,
      title: todo.title,
      moduleName: todo.moduleName,
    });

  const open = todos ?? [];
  const visible = open.filter((t) => !isSnoozed(t, todayStr));
  const myDay = visible
    .filter((t) => isFocusToday(t, todayStr))
    .sort((a, b) => (a.focusOrder ?? 0) - (b.focusOrder ?? 0));
  const nextAction =
    myDay.length > 0
      ? pickNextAction(myDay, todayStr)
      : pickNextAction(open, todayStr);

  const others = visible.filter((t) => !isFocusToday(t, todayStr));
  const relevant = others.filter((t) => {
    if (!t.dueDate) return t.highPriority;
    const diff = Math.floor(
      (new Date(t.dueDate + "T12:00:00").getTime() -
        new Date(todayStr + "T12:00:00").getTime()) /
        86400000,
    );
    return diff <= 3 || t.highPriority;
  });
  const overdue = relevant.filter((t) => t.dueDate && t.dueDate < todayStr);
  const dueToday = relevant.filter((t) => t.dueDate === todayStr);
  const upcoming = relevant.filter((t) => t.dueDate && t.dueDate > todayStr);
  const noDue = relevant.filter((t) => !t.dueDate);

  const totalCount = open.length;
  const showNudge = totalCount >= OVERLOAD_THRESHOLD && myDay.length === 0;

  const groups: {
    label: string;
    labelColor: string;
    bgFade: string;
    items: Todo[];
  }[] = [
    { label: "Due Today", labelColor: "text-rose-500", bgFade: "bg-rose-50/20", items: dueToday },
    { label: "Coming Up", labelColor: "text-stone-400", bgFade: "", items: upcoming },
    { label: "Overdue", labelColor: "text-rose-400", bgFade: "bg-rose-50/20", items: overdue },
    { label: "Priority", labelColor: "text-amber-600", bgFade: "bg-amber-50/20", items: noDue },
  ].filter((g) => g.items.length > 0);

  return (
    <>
    <PanelCard
      title="tasks"
      isFullHeight={true}
      icon={<ListIcon />}
      badge={totalCount > 0 ? `${totalCount} open` : undefined}
      action={{ label: "all tasks", onClick: onGoToTodos }}
      headerAction={
        <button
          onClick={onGoToTodos}
          className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 bg-rose-50 text-rose-500 rounded-lg hover:bg-rose-100 transition-colors"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add
        </button>
      }
    >
      {todos === undefined ? (
        <LoadingSpinner />
      ) : visible.length === 0 && !nextAction ? (
        <EmptyState message="All caught up!" sub="Nothing urgent right now" />
      ) : (
        <div className="space-y-3">
          {showNudge && (
            <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/50">
              <p className="text-xs font-bold text-amber-700">
                {totalCount} open tasks
              </p>
              <p className="text-[11px] text-amber-600/80 mt-0.5">
                Pick a few to focus on today and let the rest wait.
              </p>
              <button
                onClick={onGoToTodos}
                className="mt-2 text-[10px] font-bold uppercase tracking-wider px-2 py-1 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors"
              >
                Plan my day
              </button>
            </div>
          )}

          {nextAction && (
            <div className="p-3 rounded-xl border border-rose-200 bg-rose-50/50">
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-500 mb-1.5">
                Next up
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => startPomo(nextAction)}
                  className="flex-shrink-0 w-7 h-7 rounded-full bg-rose-400 text-white flex items-center justify-center hover:bg-rose-500 transition-colors shadow-sm"
                  title="Start a pomo"
                >
                  <PlayIcon />
                </button>
                <p className="flex-1 min-w-0 text-sm font-semibold text-stone-700 truncate">
                  {nextAction.title}
                </p>
                {nextAction.moduleName && (
                  <span className="flex-shrink-0 text-[9px] px-1 py-0.5 bg-lavender-100 text-lavender-600 rounded font-bold uppercase tracking-wider max-w-[80px] truncate">
                    {nextAction.moduleName}
                  </span>
                )}
                <button
                  onClick={() => handleToggleFocus(nextAction)}
                  title={
                    isFocusToday(nextAction, todayStr)
                      ? "Remove from My Day"
                      : "Add to My Day"
                  }
                  className={`flex-shrink-0 p-1 rounded transition-colors ${
                    isFocusToday(nextAction, todayStr)
                      ? "text-amber-500 hover:bg-amber-100"
                      : "text-stone-300 hover:text-amber-500 hover:bg-amber-100"
                  }`}
                >
                  <SunIcon filled={isFocusToday(nextAction, todayStr)} />
                </button>
              </div>
            </div>
          )}

          {myDay.length > 0 && (
            <TodoGroup
              label="My Day"
              labelColor="text-amber-600"
              bgFade="bg-amber-50/40"
              todos={myDay}
              todayStr={todayStr}
              onToggle={handleToggle}
              onStartPomo={startPomo}
              onToggleFocus={handleToggleFocus}
              forceAll
            />
          )}

          {groups.map((g) => (
            <TodoGroup
              key={g.label}
              label={g.label}
              labelColor={g.labelColor}
              bgFade={g.bgFade}
              todos={g.items}
              todayStr={todayStr}
              onToggle={handleToggle}
              onStartPomo={startPomo}
              onToggleFocus={handleToggleFocus}
              onMore={g.items.length > GROUP_CAP ? onGoToTodos : undefined}
            />
          ))}
        </div>
      )}
    </PanelCard>
    <ToastStack toasts={toasts} />
    </>
  );
}

function TodoGroup({
  label,
  labelColor,
  bgFade,
  todos,
  todayStr,
  onToggle,
  onStartPomo,
  onToggleFocus,
  onMore,
  forceAll,
}: {
  label: string;
  labelColor: string;
  bgFade: string;
  todos: Todo[];
  todayStr: string;
  onToggle: (id: string, completed: boolean) => void;
  onStartPomo: (todo: Todo) => void;
  onToggleFocus: (todo: Todo) => void;
  onMore?: () => void;
  forceAll?: boolean;
}) {
  const shown = forceAll ? todos : todos.slice(0, GROUP_CAP);
  const hidden = todos.length - shown.length;

  return (
    <div className={`p-2.5 rounded-xl border border-cream-200 ${bgFade || "bg-cream-50/30"}`}>
      <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${labelColor}`}>
        {label}
      </p>
      <div className="space-y-1">
        {shown.map((todo) => {
          const due = todo.dueDate ? formatDue(todo.dueDate) : null;
          const isProject = effectiveCategory(todo) === "project";
          const progress = isProject ? computeProgress(todo) : null;
          const focused = isFocusToday(todo, todayStr);
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
                <button
                  onClick={() => onStartPomo(todo)}
                  title="Start a pomo"
                  className="flex-shrink-0 p-1 text-stone-300 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors"
                >
                  <PlayIcon />
                </button>
                <button
                  onClick={() => onToggleFocus(todo)}
                  title={focused ? "Remove from My Day" : "Add to My Day"}
                  className={`flex-shrink-0 p-1 rounded transition-colors ${
                    focused
                      ? "text-amber-500 hover:bg-amber-100"
                      : "text-stone-300 hover:text-amber-500 hover:bg-amber-100"
                  }`}
                >
                  <SunIcon filled={focused} />
                </button>
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
      {onMore && hidden > 0 && (
        <button
          onClick={onMore}
          className="mt-1.5 text-[10px] font-bold text-stone-400 hover:text-stone-600 transition-colors"
        >
          +{hidden} more
        </button>
      )}
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
