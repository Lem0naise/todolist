import { useDraggable } from "@dnd-kit/core";
import { SunIcon } from "../icons";
import type { MyDayTask } from "./myDay";

/** Presentational chip, also used inside the drag overlay. */
export function TaskDragChip({
  task,
  className = "",
}: {
  task: MyDayTask;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-amber-200 bg-white text-[11px] font-semibold text-stone-700 ${className}`}
    >
      <span className="truncate max-w-[160px]">{task.title}</span>
      {task.moduleName && (
        <span className="flex-shrink-0 text-[8px] px-1 py-0.5 bg-lavender-100 text-lavender-600 rounded font-bold uppercase tracking-wider max-w-[70px] truncate">
          {task.moduleName}
        </span>
      )}
    </div>
  );
}

function DraggableTaskChip({
  task,
  assigned,
  armed,
  onArm,
}: {
  task: MyDayTask;
  assigned: string[];
  armed: boolean;
  onArm: (id: string | null) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `myday:${task._id}`,
    data: { type: "myday-task", taskId: task._id },
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      onClick={() => onArm(armed ? null : task._id)}
      title={`${task.title}${assigned.length > 0 ? ` — assigned to ${assigned.join(", ")}` : ""}`}
      className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-left touch-none transition-colors ${
        armed
          ? "border-rose-300 bg-rose-50 ring-2 ring-rose-200"
          : "border-cream-200 bg-white hover:border-amber-300"
      } ${isDragging ? "opacity-40" : ""}`}
    >
      <span className="flex-1 min-w-0 text-[11px] font-semibold text-stone-700 truncate">
        {task.title}
      </span>
      {task.moduleName && (
        <span className="flex-shrink-0 text-[8px] px-1 py-0.5 bg-lavender-100 text-lavender-600 rounded font-bold uppercase tracking-wider max-w-[70px] truncate">
          {task.moduleName}
        </span>
      )}
      {assigned.length > 0 && (
        <span className="flex-shrink-0 text-[8px] px-1 py-0.5 bg-rose-100 text-rose-500 rounded font-bold uppercase tracking-wider">
          {assigned.join(" ")}
        </span>
      )}
    </button>
  );
}

export function MyDayPanel({
  tasks,
  assignedLabels,
  armedTaskId,
  onArmTask,
  onGoToTodos,
  loading = false,
  className = "",
}: {
  tasks: MyDayTask[];
  assignedLabels?: Record<string, string[]>;
  armedTaskId: string | null;
  onArmTask: (id: string | null) => void;
  onGoToTodos?: () => void;
  loading?: boolean;
  className?: string;
}) {
  return (
    <aside
      className={`rounded-2xl border border-amber-200 bg-amber-50/30 p-3 ${className}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <SunIcon filled className="w-4 h-4 text-amber-500" />
        <h3 className="font-hand text-2xl text-amber-700 leading-none">my day</h3>
        {tasks.length > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold font-sans bg-amber-100 text-amber-700">
            {tasks.length}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-5">
          <div className="w-4 h-4 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-amber-200 bg-white/60 p-3 text-center">
          <p className="text-[11px] font-semibold text-stone-500">
            Nothing in My Day yet.
          </p>
          <p className="text-[10px] text-stone-400 mt-0.5 leading-relaxed">
            Add tasks from the to-do tab to plan your focus.
          </p>
          {onGoToTodos && (
            <button
              onClick={onGoToTodos}
              className="mt-2 text-[10px] font-bold uppercase tracking-wider px-2 py-1 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors"
            >
              Plan my day
            </button>
          )}
        </div>
      ) : (
        <>
          <p className="text-[10px] text-stone-400 leading-relaxed mb-2">
            Drag onto a work block — or tap a task, then a block.
          </p>
          <div className="space-y-1">
            {tasks.map((task) => (
              <DraggableTaskChip
                key={task._id}
                task={task}
                assigned={assignedLabels?.[task._id] ?? []}
                armed={armedTaskId === task._id}
                onArm={onArmTask}
              />
            ))}
          </div>
          {onGoToTodos && (
            <button
              onClick={onGoToTodos}
              className="mt-2 w-full text-[10px] font-bold uppercase tracking-wider text-amber-600 hover:text-amber-700 hover:bg-amber-100 rounded-lg py-1 transition-colors"
            >
              edit my day →
            </button>
          )}
        </>
      )}
    </aside>
  );
}
