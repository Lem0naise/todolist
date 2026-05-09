import {
  formatDue,
  computeProgress,
  effectiveCategory,
  renderLinkedText,
  type Todo,
} from "./utils";

function CaretIcon() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function GripIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16M4 16h16" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

export function TodoItem({
  todo,
  expanded,
  onToggleExpand,
  onToggleDone,
  onEdit,
  onDelete,
  onSubTaskToggle,
  onProgressChange,
  dragHandleProps,
  isCatchup,
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
  dragHandleProps?: Record<string, unknown>;
  isCatchup?: boolean;
}) {
  const due = todo.dueDate ? formatDue(todo.dueDate) : null;
  const hasDetails = !!todo.description;
  const progress = computeProgress(todo);
  const cat = effectiveCategory(todo);
  const isProject = cat === "project";

  const rowBg = todo.completed
    ? "bg-stone-50/60 border-stone-200/40"
    : todo.highPriority
      ? "bg-rose-50/40 border-rose-100"
      : isProject
        ? "bg-rose-50/20 border-rose-100/60"
        : cat === "lecture_catchup"
          ? "bg-lavender-50/30 border-lavender-100/60"
          : "bg-white border-stone-200/60 hover:border-stone-300/80";

  return (
    <div className={`rounded-lg border px-3 py-2 transition-all text-sm ${rowBg}`}>
      <div className="flex items-start gap-2">
        {!todo.completed && !isCatchup && (
          <div
            {...dragHandleProps}
            className="mt-0.5 cursor-grab active:cursor-grabbing text-stone-300 hover:text-stone-500 p-0.5 -ml-1"
          >
            <GripIcon />
          </div>
        )}

        <button
          onClick={onToggleDone}
          className={`mt-0.5 w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border transition-colors ${
            todo.completed
              ? "bg-mint-500 border-mint-500"
              : "border-stone-300 hover:border-mint-400 bg-white"
          }`}
        >
          {todo.completed && <CheckIcon />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`font-semibold ${
                todo.completed
                  ? "line-through text-stone-400"
                  : "text-stone-800"
              }`}
            >
              {todo.title}
            </span>
            {todo.highPriority && !todo.completed && (
              <span className="text-[10px] px-1.5 py-0.5 bg-rose-100 text-rose-600 rounded font-bold uppercase tracking-wider">
                !
              </span>
            )}
            {todo.moduleName && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider truncate max-w-[100px] bg-lavender-100 text-lavender-600"
                title={todo.moduleName}
              >
                {todo.moduleName}
              </span>
            )}
            {todo.linkedEventTitle && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider truncate max-w-[100px] bg-cream-200 text-stone-600"
                title={todo.linkedEventTitle}
              >
                {todo.linkedEventTitle}
              </span>
            )}
            {!todo.completed && due && !isProject && (
              <span
                className={`text-[10px] font-bold ${
                  due.overdue
                    ? "text-rose-500"
                    : due.today
                      ? "text-amber-600"
                      : "text-stone-400"
                }`}
              >
                {due.text}
              </span>
            )}
            {!todo.completed && due && isProject && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                  due.overdue
                    ? "bg-rose-100 text-rose-600"
                    : due.today
                      ? "bg-amber-100 text-amber-700"
                      : "bg-stone-100 text-stone-500"
                }`}
              >
                {due.text}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            {hasDetails && (
              <button
                onClick={onToggleExpand}
                className="text-[10px] font-bold uppercase tracking-wider text-stone-400 hover:text-stone-600 flex items-center gap-1"
              >
                <span className={`transition-transform ${expanded ? "rotate-90" : ""}`}>
                  <CaretIcon />
                </span>
                {expanded ? "Hide" : "Notes"}
              </button>
            )}
          </div>

          {isProject && !todo.completed && progress !== null && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-rose-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-400 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-[10px] text-rose-500 font-bold w-7 text-right">
                {progress}%
              </span>
            </div>
          )}

          {isProject && !todo.completed && todo.subTasks && todo.subTasks.length > 0 && (
            <div className="mt-2 space-y-1 pl-1 border-l-2 border-rose-100">
              {todo.subTasks.map((st) => (
                <button
                  key={st.id}
                  onClick={() => onSubTaskToggle(st.id)}
                  className="flex items-center gap-2 w-full text-left px-2 py-0.5 hover:bg-white/80 rounded transition-colors"
                >
                  <span
                    className={`flex-shrink-0 w-3.5 h-3.5 rounded border flex items-center justify-center ${
                      st.done
                        ? "bg-rose-400 border-rose-400"
                        : "border-stone-300 bg-white"
                    }`}
                  >
                    {st.done && <CheckIcon />}
                  </span>
                  <span
                    className={`text-xs ${
                      st.done
                        ? "line-through text-stone-400"
                        : "text-stone-700"
                    }`}
                  >
                    {st.title}
                  </span>
                </button>
              ))}
            </div>
          )}

          {isProject && !todo.completed && (!todo.subTasks || todo.subTasks.length === 0) && (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={todo.manualProgress ?? 0}
                onChange={(e) => onProgressChange(Number(e.target.value))}
                className="flex-1 accent-rose-400 h-1 cursor-ew-resize"
              />
            </div>
          )}

          {expanded && todo.description && (
            <div className="mt-2 text-xs text-stone-600 bg-cream-50 rounded-lg p-2.5 border border-cream-200 whitespace-pre-wrap break-words font-medium leading-relaxed">
              {renderLinkedText(todo.description)}
            </div>
          )}
        </div>

        {!todo.completed && (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button
              onClick={onEdit}
              className="p-1 text-stone-300 hover:text-rose-500 rounded hover:bg-rose-50 transition-colors"
            >
              <EditIcon />
            </button>
            <button
              onClick={onDelete}
              className="p-1 text-stone-300 hover:text-rose-500 rounded hover:bg-rose-50 transition-colors"
            >
              <TrashIcon />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
