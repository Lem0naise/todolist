import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useLocalCache } from "../hooks/useLocalCache";
import { TodoModal } from "./TodoModal";
import type { Id } from "../../convex/_generated/dataModel";

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
};

function formatDue(dateStr: string): { text: string; overdue: boolean; today: boolean } {
  const today = new Date().toISOString().split("T")[0];
  const diff = Math.floor(
    (new Date(dateStr).getTime() - new Date(today).getTime()) / 86400000
  );
  if (dateStr === today) return { text: "Today", overdue: false, today: true };
  if (diff === 1) return { text: "Tomorrow", overdue: false, today: false };
  if (diff === -1) return { text: "Yesterday", overdue: true, today: false };
  if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, overdue: true, today: false };
  if (diff <= 7) return { text: `In ${diff}d`, overdue: false, today: false };
  const d = new Date(dateStr);
  return {
    text: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    overdue: false,
    today: false,
  };
}

export function TodosView() {
  const [showModal, setShowModal] = useState(false);
  const [editTodo, setEditTodo] = useState<Todo | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Always fetch all todos (including completed) so we can show the completed count
  // even before the user has expanded the section.
  const liveTodos = useQuery(api.todos.list, { includeCompleted: true });
  const todos = useLocalCache<Todo[]>(`todos:all`, liveTodos) as Todo[] | null | undefined;

  const completeTodo = useMutation(api.todos.complete);
  const removeTodo = useMutation(api.todos.remove);

  const handleToggle = (id: Id<"todos">, completed: boolean) => {
    completeTodo({ id, completed: !completed });
  };

  const handleDelete = (id: Id<"todos">) => {
    if (confirm("Delete this todo?")) {
      removeTodo({ id });
    }
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const pending = todos?.filter((t) => !t.completed) ?? [];
  const done = todos?.filter((t) => t.completed) ?? [];

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">To-Do</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {pending.length} item{pending.length !== 1 ? "s" : ""} remaining
          </p>
        </div>
        <button
          onClick={() => { setEditTodo(null); setShowModal(true); }}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add
        </button>
      </div>

      {todos === undefined ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : pending.length === 0 && !showCompleted ? (
        <div className="text-center py-16 text-slate-400">
          <div className="text-4xl mb-3">✓</div>
          <p className="text-sm">All caught up!</p>
          <p className="text-xs mt-1">Add a todo or mark timetable events</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pending.map((todo) => (
            <TodoItem
              key={todo._id}
              todo={todo}
              expanded={expanded.has(todo._id)}
              onToggleExpand={() => toggleExpand(todo._id)}
              onToggleDone={() => handleToggle(todo._id, todo.completed)}
              onEdit={() => { setEditTodo(todo); setShowModal(true); }}
              onDelete={() => handleDelete(todo._id)}
            />
          ))}

          {/* Completed section */}
          {done.length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
              >
                <svg className={`w-3 h-3 transition-transform ${showCompleted ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                {done.length} completed
              </button>
              {showCompleted && (
                <div className="space-y-2 mt-2">
                  {done.map((todo) => (
                    <TodoItem
                      key={todo._id}
                      todo={todo}
                      expanded={expanded.has(todo._id)}
                      onToggleExpand={() => toggleExpand(todo._id)}
                      onToggleDone={() => handleToggle(todo._id, todo.completed)}
                      onEdit={() => { setEditTodo(todo); setShowModal(true); }}
                      onDelete={() => handleDelete(todo._id)}
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

function TodoItem({
  todo,
  expanded,
  onToggleExpand,
  onToggleDone,
  onEdit,
  onDelete,
}: {
  todo: Todo;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleDone: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const due = todo.dueDate ? formatDue(todo.dueDate) : null;
  const hasDetails = !!(todo.description);

  return (
    <div
      className={`rounded-xl border p-4 transition-all ${
        todo.completed
          ? "bg-slate-50 border-slate-100 opacity-60"
          : todo.highPriority
          ? "bg-red-50 border-red-200"
          : "bg-white border-slate-200"
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={onToggleDone}
          className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
            todo.completed
              ? "bg-green-500 border-green-500"
              : "border-slate-300 hover:border-green-400"
          }`}
        >
          {todo.completed && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            <span className={`text-sm font-medium ${todo.completed ? "line-through text-slate-400" : "text-slate-900"}`}>
              {todo.title}
            </span>
            {todo.highPriority && !todo.completed && (
              <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-600 rounded font-medium">High</span>
            )}
            {todo.sourceOccurrenceId && (
              <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-500 rounded">class</span>
            )}
          </div>

          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {due && (
              <span className={`text-xs font-medium ${
                due.overdue ? "text-red-500" : due.today ? "text-blue-500" : "text-slate-400"
              }`}>
                {due.text}
              </span>
            )}
            {hasDetails && (
              <button
                onClick={onToggleExpand}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                {expanded ? "hide notes" : "show notes"}
              </button>
            )}
          </div>

          {expanded && todo.description && (
            <div className="mt-2 text-xs text-slate-600 bg-white rounded-lg p-2 border border-slate-100 whitespace-pre-wrap break-words">
              {todo.description}
            </div>
          )}
        </div>

        {!todo.completed && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={onEdit}
              className="p-1.5 text-slate-300 hover:text-slate-500 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 text-slate-300 hover:text-red-400 rounded-lg hover:bg-red-50 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
