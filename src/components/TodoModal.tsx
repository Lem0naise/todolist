import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

interface Props {
  onClose: () => void;
  editTodo?: {
    _id: Id<"todos">;
    title: string;
    description?: string;
    dueDate?: string;
    highPriority: boolean;
  };
}

export function TodoModal({ onClose, editTodo }: Props) {
  const createTodo = useMutation(api.todos.create);
  const updateTodo = useMutation(api.todos.update);

  const [title, setTitle] = useState(editTodo?.title ?? "");
  const [description, setDescription] = useState(editTodo?.description ?? "");
  const [dueDate, setDueDate] = useState(editTodo?.dueDate ?? "");
  const [highPriority, setHighPriority] = useState(editTodo?.highPriority ?? false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    try {
      if (editTodo) {
        await updateTodo({
          id: editTodo._id,
          title: title.trim(),
          description: description.trim() || undefined,
          dueDate: dueDate || undefined,
          highPriority,
        });
      } else {
        await createTodo({
          title: title.trim(),
          description: description.trim() || undefined,
          dueDate: dueDate || undefined,
          highPriority,
        });
      }
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-6 shadow-xl">
        <h3 className="text-base font-semibold text-slate-900 mb-4">
          {editTodo ? "Edit todo" : "New todo"}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              autoFocus
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs doing?"
              required
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes, links, details... (optional)"
              rows={3}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">Due date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-col justify-end">
              <label className="block text-xs text-slate-500 mb-1">Priority</label>
              <button
                type="button"
                onClick={() => setHighPriority(!highPriority)}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  highPriority
                    ? "bg-red-50 border-red-200 text-red-600"
                    : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"
                }`}
              >
                {highPriority ? "High" : "Normal"}
              </button>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-lg transition-colors"
            >
              {loading ? "Saving..." : editTodo ? "Save" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
