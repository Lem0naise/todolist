import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type Category = "lecture_catchup" | "project" | "other";
type SubTask = { id: string; title: string; done: boolean };

interface Props {
  onClose: () => void;
  editTodo?: {
    _id: string;
    title: string;
    description?: string;
    dueDate?: string;
    highPriority: boolean;
    category?: Category;
    subTasks?: SubTask[];
    manualProgress?: number;
    linkedEventId?: string;
    moduleId?: string;
  };
  isGuest?: boolean;
  onGuestCreate?: (data: Record<string, unknown>) => void;
  onGuestUpdate?: (id: string, data: Record<string, unknown>) => void;
}

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

function CloseIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "other", label: "Task" },
  { value: "project", label: "Project" },
  { value: "lecture_catchup", label: "Catchup" },
];

export function TodoModal({ onClose, editTodo, isGuest, onGuestCreate, onGuestUpdate }: Props) {
  const createTodo = useMutation(api.todos.create);
  const updateTodo = useMutation(api.todos.update);
  const timetableEvents = useQuery(api.timetable.list);
  const modules = useQuery(api.modules.list);

  const [title, setTitle] = useState(editTodo?.title ?? "");
  const [description, setDescription] = useState(editTodo?.description ?? "");
  const [dueDate, setDueDate] = useState(editTodo?.dueDate ?? "");
  const [highPriority, setHighPriority] = useState(editTodo?.highPriority ?? false);
  const [category, setCategory] = useState<Category>(editTodo?.category ?? "other");
  const [subTasks, setSubTasks] = useState<SubTask[]>(editTodo?.subTasks ?? []);
  const [newSubTask, setNewSubTask] = useState("");
  const [manualProgress, setManualProgress] = useState(editTodo?.manualProgress ?? 0);
  const [linkedEventId, setLinkedEventId] = useState<string>(editTodo?.linkedEventId ?? "");
  const [moduleId, setModuleId] = useState<string>(editTodo?.moduleId ?? "");
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
      const extras =
        category === "project"
          ? { subTasks: subTasks.length > 0 ? subTasks : undefined, manualProgress }
          : {};

      if (isGuest && onGuestCreate && onGuestUpdate) {
        const data = {
          title: title.trim(),
          description: description.trim() || undefined,
          dueDate: dueDate || undefined,
          highPriority,
          category,
          ...extras,
        };
        if (editTodo) {
          onGuestUpdate(editTodo._id, data);
        } else {
          onGuestCreate(data);
        }
        onClose();
        return;
      }

      const eventId = linkedEventId ? (linkedEventId as Id<"timetableEvents">) : undefined;
      const modId = moduleId ? (moduleId as Id<"modules">) : undefined;

      if (editTodo) {
        await updateTodo({
          id: editTodo._id as Id<"todos">,
          title: title.trim(),
          description: description.trim() || undefined,
          dueDate: dueDate || undefined,
          highPriority,
          category,
          linkedEventId: eventId,
          moduleId: modId,
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
          moduleId: modId,
          ...extras,
        });
      }
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const uniqueClassTitles = (timetableEvents ?? []).map((e) => ({
    _id: e._id,
    display: `${e.title}${e.moduleName ? ` (${e.moduleName})` : ""}`,
  }));

  const currentClassId = timetableEvents?.find((e) => e._id === linkedEventId)?._id ?? "";

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-stone-900/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full sm:max-w-md bg-cream rounded-t-2xl sm:rounded-3xl p-5 shadow-xl border border-cream-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-stone-700 font-hand text-2xl">
            {editTodo ? "edit task" : "new task"}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-cream-100 transition-colors"
          >
            <CloseIcon />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <input
              autoFocus
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs doing?"
              required
              className="w-full px-3.5 py-2.5 text-sm font-semibold bg-white border border-cream-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-300 text-stone-700 placeholder-stone-300 transition-all"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1.5">
              Type
            </label>
            <div className="flex gap-2">
              {CATEGORIES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCategory(value)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border ${
                    category === value
                      ? value === "lecture_catchup"
                        ? "bg-lavender-50 border-lavender-300 text-lavender-600"
                        : value === "project"
                          ? "bg-rose-50 border-rose-300 text-rose-600"
                          : "bg-cream-100 border-stone-300 text-stone-700"
                      : "bg-white border-cream-200 text-stone-400 hover:border-stone-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes, links, details..."
              rows={2}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-cream-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-300 text-stone-600 placeholder-stone-300 transition-all resize-none font-medium leading-relaxed"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">
                Module
              </label>
              <select
                value={moduleId}
                onChange={(e) => setModuleId(e.target.value)}
                className="w-full px-3 py-2 text-sm font-semibold bg-white border border-cream-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-300 text-stone-700 appearance-none transition-all"
              >
                <option value="">Auto / None</option>
                {(modules ?? []).map(
                  (mod: { _id: Id<"modules">; name: string }) => (
                    <option key={mod._id} value={mod._id}>
                      {mod.name}
                    </option>
                  ),
                )}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">
                Link Class
              </label>
              <select
                value={currentClassId}
                onChange={(e) => {
                  setLinkedEventId(e.target.value);
                }}
                className="w-full px-3 py-2 text-sm font-semibold bg-white border border-cream-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-300 text-stone-700 appearance-none transition-all"
              >
                <option value="">None</option>
                {uniqueClassTitles.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.display}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">
              Due date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 text-sm font-semibold bg-white border border-cream-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-300 text-stone-700 transition-all"
            />
          </div>

          {category === "project" && (
            <div className="p-3.5 bg-rose-50/40 border border-rose-100 rounded-xl">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-rose-500 mb-2">
                Steps
              </label>
              <div className="space-y-1.5 mb-3">
                {subTasks.map((st) => (
                  <div
                    key={st.id}
                    className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-rose-100"
                  >
                    <span
                      className={`flex-1 text-sm font-medium ${
                        st.done
                          ? "line-through text-stone-400"
                          : "text-stone-700"
                      }`}
                    >
                      {st.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeSubTask(st.id)}
                      className="text-stone-300 hover:text-rose-500 transition-colors p-1 rounded"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSubTask}
                  onChange={(e) => setNewSubTask(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSubTask();
                    }
                  }}
                  placeholder="Add step..."
                  className="flex-1 px-3 py-2 text-sm font-medium border border-rose-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-300 bg-white text-stone-700 placeholder-rose-300"
                />
                <button
                  type="button"
                  onClick={addSubTask}
                  disabled={!newSubTask.trim()}
                  className="px-3 py-2 bg-rose-100 hover:bg-rose-200 disabled:opacity-50 text-rose-600 font-bold rounded-lg text-xs tracking-wide uppercase transition-colors"
                >
                  Add
                </button>
              </div>

              <div className="mt-4 pt-3 border-t border-rose-100">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-rose-500">
                    Progress
                  </label>
                  <span className="text-xs font-bold text-rose-500 bg-rose-100 px-1.5 py-0.5 rounded">
                    {manualProgress}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={manualProgress}
                  onChange={(e) => setManualProgress(Number(e.target.value))}
                  className="w-full accent-rose-400"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-3 gap-3">
            <button
              type="button"
              onClick={() => setHighPriority(!highPriority)}
              className={`px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border ${
                highPriority
                  ? "bg-rose-50 border-rose-300 text-rose-600"
                  : "bg-white border-cream-200 text-stone-400 hover:border-stone-300"
              }`}
            >
              Priority
            </button>

            <div className="flex gap-2 flex-1 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-stone-500 bg-cream-100 hover:bg-cream-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !title.trim()}
                className="px-6 py-2 text-xs font-bold uppercase tracking-wider text-white bg-rose-400 hover:bg-rose-500 disabled:bg-stone-200 disabled:text-stone-400 rounded-xl transition-all shadow-sm"
              >
                {loading ? "..." : editTodo ? "Save" : "Add"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
