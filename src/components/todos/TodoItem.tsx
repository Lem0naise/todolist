import { useEffect, useRef, useState } from "react";
import {
  formatDue,
  formatShortDate,
  computeProgress,
  effectiveCategory,
  isSnoozed,
  SNOOZE_PRESETS,
  type Todo,
} from "./utils";
import { addDaysLocal, getTodayLocal } from "../../lib/date";
import { PlayIcon, SunIcon } from "../icons";

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

function ClockIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
    </svg>
  );
}

export function TodoItem({
  todo,
  onOpen,
  onToggleDone,
  onEdit,
  onDelete,
  dragHandleProps,
  isCatchup,
  isFocus,
  onToggleFocus,
  onSnooze,
  onStartPomo,
  selectable,
  selected,
  onSelect,
}: {
  todo: Todo;
  onOpen: () => void;
  onToggleDone: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  dragHandleProps?: Record<string, unknown>;
  isCatchup?: boolean;
  isFocus?: boolean;
  onToggleFocus?: () => void;
  onSnooze?: (until?: string) => void;
  onStartPomo?: () => void;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const [showSnooze, setShowSnooze] = useState(false);
  const [completing, setCompleting] = useState(false);
  const completeTimer = useRef<number | null>(null);
  const today = getTodayLocal();
  const due = todo.dueDate ? formatDue(todo.dueDate) : null;
  const progress = computeProgress(todo);
  const cat = effectiveCategory(todo);
  const isProject = cat === "project";
  const snoozed = !todo.completed && isSnoozed(todo, today);

  const rowBg = todo.completed
    ? "bg-stone-50/60 border-stone-200/40"
    : todo.highPriority
      ? "bg-rose-50/40 border-rose-100"
      : isProject
        ? "bg-rose-50/20 border-rose-100/60"
        : cat === "lecture_catchup"
          ? "bg-lavender-50/30 border-lavender-100/60"
          : "bg-white border-stone-200/60 hover:border-stone-300/80";

  // Drop the pending completion if the row unmounts mid-animation
  useEffect(
    () => () => {
      if (completeTimer.current !== null) window.clearTimeout(completeTimer.current);
    },
    [],
  );

  // Safety net: never leave the box stuck "completing" if a mutation fails
  useEffect(() => {
    if (!completing) return;
    const t = window.setTimeout(() => setCompleting(false), 2500);
    return () => window.clearTimeout(t);
  }, [completing]);

  const handleDoneClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (todo.completed || completing) {
      if (todo.completed) onToggleDone();
      return;
    }
    // Let the tick animation play before the row leaves the list.
    setCompleting(true);
    completeTimer.current = window.setTimeout(() => {
      completeTimer.current = null;
      onToggleDone();
    }, 380);
  };

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, textarea, select, [data-no-open]")) return;
    if (selectable) {
      onSelect?.();
      return;
    }
    onOpen();
  };

  const handleCardKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    if (selectable) {
      onSelect?.();
      return;
    }
    onOpen();
  };

  return (
    <div
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      tabIndex={0}
      className={`rounded-lg border px-3 py-2 transition-all text-sm cursor-pointer ${rowBg} ${
        snoozed ? "opacity-60" : ""
      } ${selected ? "ring-2 ring-lavender-300" : ""} ${
        completing ? "task-complete-flash" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        {selectable ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect?.();
            }}
            aria-label={selected ? "Deselect task" : "Select task"}
            className={`mt-0.5 w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border transition-colors ${
              selected
                ? "bg-lavender-400 border-lavender-400"
                : "border-stone-300 bg-white hover:border-lavender-400"
            }`}
          >
            {selected && <CheckIcon />}
          </button>
        ) : (
          !todo.completed &&
          !isCatchup && (
            <div
              {...dragHandleProps}
              data-no-open
              className="mt-0.5 cursor-grab active:cursor-grabbing text-stone-300 hover:text-stone-500 p-0.5 -ml-1"
            >
              <GripIcon />
            </div>
          )
        )}

        {!selectable && (
          <button
            onClick={handleDoneClick}
            className={`mt-0.5 w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border transition-colors ${
              todo.completed || completing
                ? "bg-mint-500 border-mint-500"
                : "border-stone-300 hover:border-mint-400 bg-white"
            } ${completing ? "task-pop" : ""}`}
          >
            {(todo.completed || completing) && <CheckIcon />}
          </button>
        )}

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
            {isFocus && !todo.completed && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider bg-amber-100 text-amber-700">
                today
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
            {snoozed && todo.snoozedUntil && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-stone-100 text-stone-500">
                until {formatShortDate(todo.snoozedUntil)}
              </span>
            )}
            {!todo.completed && due && !isProject && !snoozed && (
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
            {!todo.completed && due && isProject && !snoozed && (
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
        </div>

        {!todo.completed && !selectable && (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {onStartPomo && (
              <button
                onClick={onStartPomo}
                title="Start a pomo for this task"
                className="p-1 text-stone-300 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors"
              >
                <PlayIcon />
              </button>
            )}
            {onToggleFocus && (
              <button
                onClick={onToggleFocus}
                title={isFocus ? "Remove from My Day" : "Add to My Day"}
                className={`p-1 rounded transition-colors ${
                  isFocus
                    ? "text-amber-500 hover:bg-amber-50"
                    : "text-stone-300 hover:text-amber-500 hover:bg-amber-50"
                }`}
              >
                <SunIcon filled={isFocus} />
              </button>
            )}
            {onSnooze && (
              <div className="relative" data-no-open>
                <button
                  onClick={() => setShowSnooze((s) => !s)}
                  title="Snooze"
                  className={`p-1 rounded transition-colors ${
                    snoozed
                      ? "text-lavender-500 hover:bg-lavender-50"
                      : "text-stone-300 hover:text-lavender-500 hover:bg-lavender-50"
                  }`}
                >
                  <ClockIcon />
                </button>
                {showSnooze && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowSnooze(false);
                      }}
                    />
                    <div className="absolute right-0 top-7 z-50 w-36 bg-white border border-cream-200 rounded-xl shadow-lg p-1">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-stone-400 px-2 py-1">
                        Snooze until
                      </p>
                      {SNOOZE_PRESETS.map((p) => (
                        <button
                          key={p.label}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSnooze(addDaysLocal(today, p.days));
                            setShowSnooze(false);
                          }}
                          className="w-full text-left px-2 py-1.5 text-xs font-semibold text-stone-600 hover:bg-cream-100 rounded-lg"
                        >
                          {p.label}
                        </button>
                      ))}
                      {snoozed && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSnooze(undefined);
                            setShowSnooze(false);
                          }}
                          className="w-full text-left px-2 py-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-50 rounded-lg"
                        >
                          Clear snooze
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
            {onEdit && (
              <button
                onClick={onEdit}
                title="Edit task"
                className="p-1 text-stone-300 hover:text-rose-500 rounded hover:bg-rose-50 transition-colors"
              >
                <EditIcon />
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                title="Delete task"
                className="p-1 text-stone-300 hover:text-rose-500 rounded hover:bg-rose-50 transition-colors"
              >
                <TrashIcon />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
