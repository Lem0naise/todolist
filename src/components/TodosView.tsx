import { useState, useEffect, type ReactNode } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useLocalCache } from "../hooks/useLocalCache";
import { TodoModal } from "./TodoModal";
import type { Id } from "../../convex/_generated/dataModel";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Category = "project" | "lecture_catchup" | "other";
type SubTask = { id: string; title: string; done: boolean };

type Todo = {
  _id: Id<"todos">;
  title: string;
  description?: string;
  dueDate?: string;
  highPriority: boolean;
  completed: boolean;
  completedAt?: number;
  createdAt: number;
  sourceOccurrenceId?: Id<"occurrences">;
  sourceOccurrenceDate?: string;
  category?: Category;
  subTasks?: SubTask[];
  manualProgress?: number;
  linkedEventId?: Id<"timetableEvents">;
  linkedEventTitle?: string;
  manualOrder?: number;
};

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function formatDue(dateStr: string): { text: string; overdue: boolean; today: boolean } {
  const today = new Date().toISOString().split("T")[0];
  const diff = Math.floor(
    (new Date(dateStr).getTime() - new Date(today).getTime()) / 86400000
  );
  const shortDate = formatShortDate(dateStr);

  if (dateStr === today) return { text: "Today", overdue: false, today: true };
  if (diff === 1) return { text: "Tomorrow", overdue: false, today: false };
  if (diff === -1) return { text: `Yesterday`, overdue: true, today: false };
  if (diff < 0) {
    return { text: `${Math.abs(diff)}d overdue`, overdue: true, today: false };
  }
  if (diff <= 7) return { text: `In ${diff}d`, overdue: false, today: false };
  return { text: shortDate, overdue: false, today: false };
}

function renderLinkedText(text: string): ReactNode[] {
  const urlRegex = /((?:https?:\/\/|www\.)\S+)/gi;
  const parts: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(urlRegex)) {
    const rawMatch = match[0];
    const matchIndex = match.index ?? 0;
    const trimmedMatch = rawMatch.replace(/[),.!?]+$/, "");
    const trailingText = rawMatch.slice(trimmedMatch.length);

    if (matchIndex > lastIndex) {
      parts.push(text.slice(lastIndex, matchIndex));
    }

    const href = trimmedMatch.startsWith("www.") ? `https://${trimmedMatch}` : trimmedMatch;
    parts.push(
      <a
        key={`${trimmedMatch}-${matchIndex}`}
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className="text-blue-600 underline underline-offset-2 hover:text-blue-700"
      >
        {trimmedMatch}
      </a>
    );

    if (trailingText) parts.push(trailingText);
    lastIndex = matchIndex + rawMatch.length;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length > 0 ? parts : [text];
}

function computeProgress(todo: Todo): number | null {
  if (todo.category !== "project") return null;
  if (todo.subTasks && todo.subTasks.length > 0) {
    const done = todo.subTasks.filter((s) => s.done).length;
    return Math.round((done / todo.subTasks.length) * 100);
  }
  if (typeof todo.manualProgress === "number") return todo.manualProgress;
  return null;
}

function effectiveCategory(todo: Todo): Category {
  return todo.category ?? "other";
}

const CATEGORY_META: Record<Category, { label: string; icon: string; color: string; border: string; bg: string }> = {
  project: { label: "Projects", icon: "📋", color: "text-purple-600 dark:text-purple-400", border: "border-purple-100 dark:border-purple-900/50", bg: "bg-purple-50 dark:bg-purple-900/30" },
  lecture_catchup: { label: "Lecture Catchup", icon: "📚", color: "text-blue-600 dark:text-blue-400", border: "border-blue-100 dark:border-blue-900/50", bg: "bg-blue-50 dark:bg-blue-900/30" },

  other: { label: "Other", icon: "✅", color: "text-slate-500 dark:text-slate-400", border: "border-slate-100 dark:border-slate-800", bg: "bg-slate-50 dark:bg-slate-800" },
};

export function TodosView({ onNavigateToDate }: { onNavigateToDate?: (date: string) => void }) {
  const [showModal, setShowModal] = useState(false);
  const [editTodo, setEditTodo] = useState<Todo | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<Category>>(new Set());

  const liveTodos = useQuery(api.todos.list, { includeCompleted: true });
  const todos = useLocalCache<Todo[]>(`todos:all`, liveTodos) as Todo[] | null | undefined;

  const completeTodo = useMutation(api.todos.complete);
  const removeTodo = useMutation(api.todos.remove);
  const updateSubTasks = useMutation(api.todos.updateSubTasks);
  const updateProgress = useMutation(api.todos.updateProgress);
  const reorderTodos = useMutation(api.todos.reorder);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.key === "t" || e.key === "T") && !showModal) {
        e.preventDefault();
        setEditTodo(null);
        setShowModal(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showModal]);

  const handleDragEnd = (event: DragEndEvent, cat: Category) => {
    const { active, over } = event;
    if (over && active.id !== over.id && todos) {
      const items = todos.filter(t => !t.completed && effectiveCategory(t) === cat);
      const oldIndex = items.findIndex((t) => t._id === active.id);
      const newIndex = items.findIndex((t) => t._id === over.id);

      const newOrder = arrayMove(items, oldIndex, newIndex);
      reorderTodos({
        updates: newOrder.map((t, idx) => ({ id: t._id, manualOrder: idx })),
      });
    }
  };

  const CATEGORY_ORDER: Category[] = ["project", "other", "lecture_catchup"];

  const pending = todos?.filter((t) => !t.completed) ?? [];
  const done = todos?.filter((t) => t.completed) ?? [];

  const groupedPending: Record<Category, Todo[]> = {
    project: [],
    other: [],
    lecture_catchup: [],
  };
  for (const t of pending) {
    groupedPending[effectiveCategory(t)].push(t);
  }

  return (
    <div className="p-4 max-w-2xl mx-auto pb-24">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">To-Do</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {pending.length} item{pending.length !== 1 ? "s" : ""} remaining
          </p>
        </div>
        <button
          onClick={() => { setEditTodo(null); setShowModal(true); }}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors group relative"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add
          <span className="hidden sm:inline-block ml-1 opacity-50 text-[10px] uppercase font-bold tracking-wider">T</span>
        </button>
      </div>

      {todos === undefined ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : pending.length === 0 && !showCompleted ? (
        <div className="text-center py-16 text-slate-400 dark:text-slate-500">
          <div className="text-4xl mb-3">✓</div>
          <p className="text-sm">All caught up!</p>
          <p className="text-xs mt-1">Press <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono text-[10px]">T</kbd> to add a task</p>
        </div>
      ) : (
        <div className="space-y-6">
          {CATEGORY_ORDER.map((cat) => {
            const items = groupedPending[cat];
            if (items.length === 0) return null;
            const meta = CATEGORY_META[cat];
            const isCollapsed = collapsed.has(cat);
            return (
              <div key={cat}>
                <button
                  onClick={() => {
                    setCollapsed((prev) => {
                      const next = new Set(prev);
                      if (next.has(cat)) next.delete(cat); else next.add(cat);
                      return next;
                    });
                  }}
                  className="flex items-center gap-2 w-full mb-2.5 group"
                >
                  <span className="text-base">{meta.icon}</span>
                  <span className={`text-xs font-bold uppercase tracking-wider ${meta.color}`}>
                    {meta.label}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${meta.color} ${meta.bg}`}>
                    {items.length}
                  </span>
                  <svg
                    className={`w-3 h-3 ml-auto text-slate-400 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {!isCollapsed && (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={(e) => handleDragEnd(e, cat)}
                  >
                    <SortableContext
                      items={items.map(t => t._id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {items.map((todo) => (
                          <SortableTodoItem
                            key={todo._id}
                            todo={todo}
                            expanded={expanded.has(todo._id)}
                            onToggleExpand={() => {
                              setExpanded(prev => {
                                const next = new Set(prev);
                                if (next.has(todo._id)) next.delete(todo._id); else next.add(todo._id);
                                return next;
                              })
                            }}
                            onToggleDone={() => completeTodo({ id: todo._id, completed: !todo.completed })}
                            onEdit={() => { setEditTodo(todo); setShowModal(true); }}
                            onDelete={() => { if (confirm("Delete this?")) removeTodo({ id: todo._id }) }}
                            onNavigateToDate={onNavigateToDate}
                            onSubTaskToggle={(stId) => {
                              if (!todo.subTasks) return;
                              const updated = todo.subTasks.map(s => s.id === stId ? { ...s, done: !s.done } : s);
                              updateSubTasks({ id: todo._id, subTasks: updated });
                            }}
                            onProgressChange={(val) => updateProgress({ id: todo._id, manualProgress: val })}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            );
          })}

          {/* Completed section */}
          {done.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-200/50 dark:border-slate-800/50">
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="text-xs font-bold tracking-wider uppercase text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-1.5 transition-colors"
              >
                <svg className={`w-3 h-3 transition-transform ${showCompleted ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                {done.length} completed
              </button>
              {showCompleted && (
                <div className="space-y-2 mt-3">
                  {done.map((todo) => (
                    <SortableTodoItem
                      key={todo._id}
                      todo={todo}
                      expanded={expanded.has(todo._id)}
                      onToggleExpand={() => {
                        setExpanded(prev => {
                          const next = new Set(prev);
                          if (next.has(todo._id)) next.delete(todo._id); else next.add(todo._id);
                          return next;
                        })
                      }}
                      onToggleDone={() => completeTodo({ id: todo._id, completed: !todo.completed })}
                      onEdit={() => { setEditTodo(todo); setShowModal(true); }}
                      onDelete={() => { if (confirm("Delete this?")) removeTodo({ id: todo._id }) }}
                      onNavigateToDate={onNavigateToDate}
                      onSubTaskToggle={(stId) => {
                        if (!todo.subTasks) return;
                        const updated = todo.subTasks.map(s => s.id === stId ? { ...s, done: !s.done } : s);
                        updateSubTasks({ id: todo._id, subTasks: updated });
                      }}
                      onProgressChange={(val) => updateProgress({ id: todo._id, manualProgress: val })}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showModal && (
        <TodoModal
          onClose={() => { setShowModal(false); setEditTodo(null); }}
          editTodo={editTodo ?? undefined}
        />
      )}
    </div>
  );
}

function SortableTodoItem(props: {
  todo: Todo;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleDone: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onNavigateToDate?: (date: string) => void;
  onSubTaskToggle: (subTaskId: string) => void;
  onProgressChange: (val: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.todo._id, disabled: props.todo.completed });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : "auto",
    opacity: isDragging ? 0.7 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <TodoItem {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

function TodoItem({
  todo,
  expanded,
  onToggleExpand,
  onToggleDone,
  onEdit,
  onDelete,
  onNavigateToDate,
  onSubTaskToggle,
  onProgressChange,
  dragHandleProps,
}: {
  todo: Todo;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleDone: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onNavigateToDate?: (date: string) => void;
  onSubTaskToggle: (subTaskId: string) => void;
  onProgressChange: (val: number) => void;
  dragHandleProps?: any;
}) {
  const due = todo.dueDate ? formatDue(todo.dueDate) : null;
  const hasDetails = !!(todo.description);
  const progress = computeProgress(todo);
  const cat = effectiveCategory(todo);
  const isProject = cat === "project";

  const borderClass = todo.completed
    ? "bg-slate-50 border-slate-200/60 opacity-50 dark:bg-slate-900/40 dark:border-slate-800"
    : todo.highPriority
      ? "bg-red-50/50 border-red-200 dark:bg-red-900/10 dark:border-red-900/40"
      : isProject
        ? "bg-purple-50/30 border-purple-200 dark:bg-purple-900/10 dark:border-purple-900/40"
        : cat === "lecture_catchup"
          ? "bg-blue-50/30 border-blue-200 dark:bg-blue-900/10 dark:border-blue-900/40"
          : "bg-white border-slate-200 dark:bg-slate-800/80 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 shadow-sm";

  return (
    <div className={`rounded-xl border p-4 transition-all ${borderClass}`}>
      <div className="flex items-start gap-3">
        {/* Drag Handle */}
        {!todo.completed && (
          <div {...dragHandleProps} className="mt-1 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400 p-0.5 -ml-1.5 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16M4 16h16" />
            </svg>
          </div>
        )}

        <button
          onClick={onToggleDone}
          className={`mt-0.5 w-5 h-5 rounded-[5px] border-2 flex-shrink-0 flex items-center justify-center transition-all ${todo.completed
            ? "bg-green-500 border-green-500 dark:bg-green-600 dark:border-green-600"
            : "border-slate-300 dark:border-slate-600 hover:border-green-400 dark:hover:border-green-500 bg-white/50 dark:bg-slate-900"
            }`}
        >
          {todo.completed && (
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`text-sm font-bold tracking-tight ${todo.completed ? "line-through text-slate-400 dark:text-slate-500" : "text-slate-900 dark:text-slate-100"}`}>
              {todo.title}
            </span>
            {todo.highPriority && !todo.completed && (
              <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-800/50 rounded font-bold uppercase tracking-wider">High</span>
            )}

            {/* Linked class chip */}
            {todo.linkedEventTitle && (
              <span className="text-[10px] px-1.5 py-0.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-800/60 rounded font-bold uppercase tracking-wider truncate max-w-[120px]" title={todo.linkedEventTitle}>
                {todo.linkedEventTitle}
              </span>
            )}

            {/* Legacy catchup logic fallback */}
            {!todo.linkedEventTitle && todo.sourceOccurrenceId && (
              todo.sourceOccurrenceDate && onNavigateToDate ? (
                <button
                  onClick={() => onNavigateToDate(todo.sourceOccurrenceDate!)}
                  className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 ring-1 ring-blue-200 dark:ring-blue-800/60 rounded font-bold uppercase tracking-wider hover:bg-blue-200 dark:hover:bg-blue-800/60 transition-colors"
                  title={`Go to ${todo.sourceOccurrenceDate}`}
                >
                  class
                </button>
              ) : (
                <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 ring-1 ring-blue-200 dark:ring-blue-800/60 rounded font-bold uppercase tracking-wider">class</span>
              )
            )}

            {/* Due Date Chips for projects */}
            {!todo.completed && due && isProject && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold tracking-wider ${due.overdue ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-800/50" :
                due.today ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-800/50" :
                  "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 ring-1 ring-slate-200 dark:ring-slate-700"
                }`}>
                {due.text}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {!isProject && due && !todo.completed && (
              <span className={`text-[11px] font-bold tracking-wide ${due.overdue ? "text-red-500 dark:text-red-400" : due.today ? "text-amber-500 dark:text-amber-400" : "text-slate-400 dark:text-slate-500"
                }`}>
                {due.text}
              </span>
            )}
            {hasDetails && (
              <button onClick={onToggleExpand} className="text-[11px] font-bold tracking-wide uppercase text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
                {expanded ? "Hide Notes" : "Show Notes"}
              </button>
            )}
          </div>

          {/* Progress bar for project todos */}
          {isProject && !todo.completed && progress !== null && (
            <div className="mt-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-purple-100 dark:bg-purple-900/30 rounded-full overflow-hidden border border-purple-200/50 dark:border-purple-800/50">
                  <div
                    className="h-full bg-purple-500 dark:bg-purple-400 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-[10px] text-purple-600 dark:text-purple-400 font-black w-8 text-right bg-purple-50 dark:bg-purple-900/20 px-1 py-0.5 rounded">{progress}%</span>
              </div>
            </div>
          )}

          {/* Sub-tasks (inline toggle) */}
          {isProject && !todo.completed && todo.subTasks && todo.subTasks.length > 0 && (
            <div className="mt-3 space-y-1.5 pl-1 border-l-2 border-purple-100 dark:border-purple-900/30">
              {todo.subTasks.map((st) => (
                <button
                  key={st.id}
                  onClick={() => onSubTaskToggle(st.id)}
                  className="flex items-center gap-2.5 w-full text-left group px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors"
                >
                  <span className={`flex-shrink-0 w-4 h-4 rounded-[4px] border-2 flex items-center justify-center transition-colors ${st.done ? "bg-purple-500 border-purple-500 dark:bg-purple-600" : "border-slate-300 dark:border-slate-600 group-hover:border-purple-400 dark:group-hover:border-purple-500 bg-white/50 dark:bg-slate-900"
                    }`}>
                    {st.done && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <span className={`text-xs font-medium ${st.done ? "line-through text-slate-400 dark:text-slate-500" : "text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-colors"}`}>
                    {st.title}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Manual progress slider — shown for project todos without subtasks */}
          {isProject && !todo.completed && (!todo.subTasks || todo.subTasks.length === 0) && (
            <div className="mt-3 flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={todo.manualProgress ?? 0}
                onChange={(e) => onProgressChange(Number(e.target.value))}
                className="flex-1 accent-purple-600 dark:accent-purple-500 cursor-ew-resize"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}

          {expanded && todo.description && (
            <div className="mt-3 text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 border border-slate-200/60 dark:border-slate-800/60 whitespace-pre-wrap break-words font-medium leading-relaxed shadow-sm">
              {renderLinkedText(todo.description)}
            </div>
          )}
        </div>

        {!todo.completed && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={onEdit}
              className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
