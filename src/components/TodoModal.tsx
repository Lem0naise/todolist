import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

type Category = "lecture_catchup" | "project" | "other";
type SubTask = { id: string; title: string; done: boolean };

interface Props {
  onClose: () => void;
  editTodo?: {
    _id: Id<"todos">;
    title: string;
    description?: string;
    dueDate?: string;
    highPriority: boolean;
    category?: Category;
    subTasks?: SubTask[];
    manualProgress?: number;
    linkedEventId?: Id<"timetableEvents">;
  };
}

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

export function TodoModal({ onClose, editTodo }: Props) {
  const createTodo = useMutation(api.todos.create);
  const updateTodo = useMutation(api.todos.update);
  const timetableEvents = useQuery(api.timetable.list);

  const [title, setTitle] = useState(editTodo?.title ?? "");
  const [description, setDescription] = useState(editTodo?.description ?? "");
  const [dueDate, setDueDate] = useState(editTodo?.dueDate ?? "");
  const [highPriority, setHighPriority] = useState(editTodo?.highPriority ?? false);
  const [category, setCategory] = useState<Category>(editTodo?.category ?? "other");
  const [subTasks, setSubTasks] = useState<SubTask[]>(editTodo?.subTasks ?? []);
  const [newSubTask, setNewSubTask] = useState("");
  const [manualProgress, setManualProgress] = useState(editTodo?.manualProgress ?? 0);
  const [linkedEventId, setLinkedEventId] = useState<string>(editTodo?.linkedEventId ?? "");
  const [loading, setLoading] = useState(false);

  const addSubTask = () => {
    const trimmed = newSubTask.trim();
    if (!trimmed) return;
    setSubTasks((prev) => [...prev, { id: genId(), title: trimmed, done: false }]);
    setNewSubTask("");
  };

  const removeSubTask = (id: string) => {
    setSubTasks((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    try {
      const extras = category === "project"
        ? { subTasks: subTasks.length > 0 ? subTasks : undefined, manualProgress }
        : {};

      const eventId = linkedEventId ? (linkedEventId as Id<"timetableEvents">) : undefined;

      if (editTodo) {
        await updateTodo({
          id: editTodo._id,
          title: title.trim(),
          description: description.trim() || undefined,
          dueDate: dueDate || undefined,
          highPriority,
          category,
          linkedEventId: eventId,
          ...extras,
        });
      } else {
        await createTodo({
          title: title.trim(),
          description: description.trim() || undefined,
          dueDate: dueDate || undefined,
          highPriority,
          category,
          linkedEventId: eventId,
          ...extras,
        });
      }
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const CATEGORIES: { value: Category; label: string; icon: string }[] = [
    { value: "other", label: "Task", icon: "✅" },
    { value: "project", label: "Project", icon: "📋" },
    { value: "lecture_catchup", label: "Catchup", icon: "📚" },
  ];

  // Unique list of classes by title for the dropdown
  const uniqueClassTitles = Array.from(new Set((timetableEvents ?? []).map(e => e.title))).sort();
  // We'll just bind one of the event IDs that has this title
  const getClassId = (title: string) => timetableEvents?.find(e => e.title === title)?._id;
  const currentClassTitle = timetableEvents?.find(e => e._id === linkedEventId)?.title ?? "";

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-3xl p-6 shadow-2xl border border-slate-200/50 dark:border-slate-800 transition-all">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[15px] font-bold text-slate-800 dark:text-slate-100 tracking-tight">
            {editTodo ? "Edit task" : "New task"}
          </h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              autoFocus
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs doing?"
              required
              className="w-full px-4 py-3 text-sm font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 dark:focus:ring-blue-500/40 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Category</label>
            <div className="flex gap-2">
              {CATEGORIES.map(({ value, label, icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCategory(value)}
                  className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all border-2 ${category === value
                      ? value === "lecture_catchup"
                        ? "bg-blue-50 border-blue-400 text-blue-700 dark:bg-blue-900/30 dark:border-blue-500 dark:text-blue-300 shadow-sm"
                        : value === "project"
                          ? "bg-purple-50 border-purple-400 text-purple-700 dark:bg-purple-900/30 dark:border-purple-500 dark:text-purple-300 shadow-sm"
                          : "bg-slate-100 border-slate-400 text-slate-800 dark:bg-slate-800 dark:border-slate-500 dark:text-slate-200 shadow-sm"
                      : "bg-white border-slate-100 text-slate-400 hover:border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:hover:border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    }`}
                >
                  <span className="text-lg">{icon}</span>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes, links, details… (optional)"
              rows={2}
              className="w-full px-4 py-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 transition-all resize-none font-medium leading-relaxed"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Link to Class</label>
              <select
                value={currentClassTitle}
                onChange={(e) => {
                  const id = getClassId(e.target.value);
                  setLinkedEventId(id ?? "");
                }}
                className="w-full px-3 py-2.5 text-sm font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 dark:text-slate-200 appearance-none transition-all"
              >
                <option value="">None</option>
                {uniqueClassTitles.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Due date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 dark:text-slate-200 transition-all"
              />
            </div>
          </div>

          {category === "project" && (
            <div className="p-4 bg-purple-50/50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800/50 rounded-xl">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-2">Sub-tasks</label>
              <div className="space-y-1.5 mb-3">
                {subTasks.map((st) => (
                  <div key={st.id} className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800/80 rounded-lg border border-purple-100 dark:border-slate-700">
                    <span className={`flex-1 text-sm font-medium ${st.done ? "line-through text-slate-400 dark:text-slate-500" : "text-slate-700 dark:text-slate-200"}`}>
                      {st.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeSubTask(st.id)}
                      className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors p-1 bg-slate-50 hover:bg-red-50 dark:bg-slate-700 dark:hover:bg-red-900/30 rounded-md"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSubTask}
                  onChange={(e) => setNewSubTask(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSubTask(); } }}
                  placeholder="Add step..."
                  className="flex-1 px-3 py-2 text-sm font-medium border border-purple-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/50 bg-white dark:bg-slate-800 dark:text-slate-200 placeholder-purple-300 dark:placeholder-slate-500"
                />
                <button
                  type="button"
                  onClick={addSubTask}
                  disabled={!newSubTask.trim()}
                  className="px-3 py-2 bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/40 dark:hover:bg-purple-800/60 disabled:opacity-50 text-purple-700 dark:text-purple-300 font-bold rounded-lg text-xs tracking-wide uppercase transition-colors"
                >
                  Add
                </button>
              </div>

              <div className="mt-4 pt-3 border-t border-purple-100 dark:border-purple-800/40">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">Manual progress</label>
                  <span className="text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/50 px-1.5 py-0.5 rounded">{manualProgress}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={manualProgress}
                  onChange={(e) => setManualProgress(Number(e.target.value))}
                  className="w-full accent-purple-600 dark:accent-purple-500"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 gap-3">
            <button
              type="button"
              onClick={() => setHighPriority(!highPriority)}
              className={`px-3 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all border-2 ${highPriority
                  ? "bg-red-50 border-red-400 text-red-600 dark:bg-red-900/30 dark:border-red-500 dark:text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.2)]"
                  : "bg-white border-slate-100 text-slate-400 hover:border-slate-200 hover:text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:hover:border-slate-600"
                }`}
            >
              High Priority
            </button>

            <div className="flex gap-2.5 flex-1 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !title.trim()}
                className="px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-500 rounded-xl transition-all shadow-md shadow-blue-500/20"
              >
                {loading ? "..." : editTodo ? "Save Task" : "Add Task"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
