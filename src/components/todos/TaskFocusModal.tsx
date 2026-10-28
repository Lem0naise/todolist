import { useEffect, useRef, useState } from "react";
import { addDaysLocal } from "../../lib/date";
import {
  CATEGORY_META,
  SNOOZE_PRESETS,
  computeProgress,
  effectiveCategory,
  formatDue,
  formatShortDate,
  isFocusToday,
  isSnoozed,
  renderLinkedText,
  type Todo,
} from "./utils";
import { PlayIcon, SunIcon } from "../icons";

function CloseIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
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

const actionClass =
  "flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors";

export function TaskFocusModal({
  todo,
  today,
  onClose,
  onToggleDone,
  onEdit,
  onDelete,
  onToggleFocus,
  onSnooze,
  onSubTaskToggle,
  onProgressChange,
  onStartPomo,
}: {
  todo: Todo;
  today: string;
  onClose: () => void;
  onToggleDone: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFocus: () => void;
  onSnooze: (until?: string) => void;
  onSubTaskToggle: (subTaskId: string) => void;
  onProgressChange: (value: number) => void;
  onStartPomo?: () => void;
}) {
  const [showSnooze, setShowSnooze] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const category = effectiveCategory(todo);
  const meta = CATEGORY_META[category];
  const isProject = category === "project";
  const progress = computeProgress(todo) ?? 0;
  const focused = isFocusToday(todo, today);
  const snoozed = !todo.completed && isSnoozed(todo, today);
  const due = todo.dueDate ? formatDue(todo.dueDate) : null;

  // Mount-only: lock the page and move focus into the dialog. Escape is wired
  // separately so typing/range updates don't re-focus the panel.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div
        aria-hidden="true"
        className="focus-modal-backdrop absolute inset-0 touch-none bg-stone-900/40 backdrop-blur-sm"
        onClick={onClose}
        onWheel={(e) => e.stopPropagation()}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-focus-title"
        onWheel={(e) => e.stopPropagation()}
        className="focus-modal-in relative z-10 flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-cream-200 bg-cream shadow-2xl outline-none sm:h-auto sm:max-h-[85vh] sm:w-[min(56rem,92vw)] sm:rounded-3xl"
      >
        <div className="flex flex-shrink-0 items-start justify-between gap-3 px-5 pb-3 pt-5 sm:px-6">
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${meta.bg} ${meta.color}`}
              >
                {meta.label}
              </span>
              {todo.moduleName && (
                <span className="max-w-[12rem] truncate rounded bg-lavender-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-lavender-600">
                  {todo.moduleName}
                </span>
              )}
              {todo.linkedEventTitle && (
                <span className="max-w-[12rem] truncate rounded bg-cream-200 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-stone-600">
                  {todo.linkedEventTitle}
                </span>
              )}
              {todo.highPriority && !todo.completed && (
                <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-600">
                  priority
                </span>
              )}
              {focused && !todo.completed && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                  today
                </span>
              )}
            </div>
            <h2
              id="task-focus-title"
              className={`break-words font-hand text-3xl leading-tight ${
                todo.completed ? "text-stone-400 line-through" : "text-stone-800"
              }`}
            >
              {todo.title}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold">
              {due && (
                <span
                  className={
                    due.overdue
                      ? "text-rose-500"
                      : due.today
                        ? "text-amber-600"
                        : "text-stone-400"
                  }
                >
                  Due {due.text}
                </span>
              )}
              {snoozed && todo.snoozedUntil && (
                <span className="text-lavender-500">
                  Snoozed until {formatShortDate(todo.snoozedUntil)}
                </span>
              )}
              {todo.sourceOccurrenceDate && (
                <span className="text-stone-400">
                  Catch-up for {formatShortDate(todo.sourceOccurrenceDate)}
                </span>
              )}
              {todo.completed && <span className="text-mint-600">Completed</span>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close task"
            className="flex-shrink-0 rounded-xl p-2 text-stone-400 transition-colors hover:bg-cream-100 hover:text-stone-600"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-2 sm:px-6">
          <section>
            <h3 className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-400">
              Notes
            </h3>
            {todo.description ? (
              <div className="whitespace-pre-wrap break-words rounded-xl border border-cream-200 bg-white p-4 text-sm font-medium leading-relaxed text-stone-600">
                {renderLinkedText(todo.description)}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-cream-200 px-4 py-6 text-center text-xs font-medium text-stone-400">
                No notes yet. Use Edit to add details.
              </p>
            )}
          </section>

          {isProject && (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-rose-500">
                  Progress
                </h3>
                <span className="rounded bg-rose-100 px-1.5 py-0.5 text-xs font-bold text-rose-500">
                  {progress}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-rose-100">
                <div
                  className="h-full rounded-full bg-rose-400 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>

              {todo.subTasks && todo.subTasks.length > 0 ? (
                <div className="mt-3 space-y-1">
                  {todo.subTasks.map((subTask) => (
                    <button
                      key={subTask.id}
                      type="button"
                      onClick={() => onSubTaskToggle(subTask.id)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-white"
                    >
                      <span
                        className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                          subTask.done
                            ? "border-rose-400 bg-rose-400"
                            : "border-stone-300 bg-white"
                        }`}
                      >
                        {subTask.done && <CheckIcon />}
                      </span>
                      <span
                        className={`text-sm ${
                          subTask.done
                            ? "text-stone-400 line-through"
                            : "text-stone-700"
                        }`}
                      >
                        {subTask.title}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-3">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={todo.manualProgress ?? 0}
                    onChange={(e) => onProgressChange(Number(e.target.value))}
                    aria-label="Manual progress"
                    className="w-full accent-rose-400"
                  />
                  <p className="mt-1 text-[10px] font-medium text-stone-400">
                    Drag to set progress
                  </p>
                </div>
              )}
            </section>
          )}
        </div>

        <div className="flex-shrink-0 border-t border-cream-100 bg-cream px-4 py-3 sm:px-5">
          {showSnooze && (
            <div className="flex flex-wrap items-center gap-1.5 pb-3">
              <span className="mr-1 text-[9px] font-bold uppercase tracking-wider text-stone-400">
                Snooze until
              </span>
              {SNOOZE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    onSnooze(addDaysLocal(today, preset.days));
                    setShowSnooze(false);
                  }}
                  className="rounded-lg bg-lavender-50 px-2 py-1 text-[10px] font-bold text-lavender-600 transition-colors hover:bg-lavender-100"
                >
                  {preset.label}
                </button>
              ))}
              {snoozed && (
                <button
                  type="button"
                  onClick={() => {
                    onSnooze(undefined);
                    setShowSnooze(false);
                  }}
                  className="rounded-lg bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-500 transition-colors hover:bg-rose-100"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={onToggleDone}
              className={`${actionClass} ${
                todo.completed
                  ? "bg-stone-100 text-stone-600 hover:bg-stone-200"
                  : "bg-mint-500 text-white shadow-sm hover:bg-mint-600"
              }`}
            >
              {todo.completed ? <RotateIcon /> : <CheckIcon />}
              {todo.completed ? "Reopen" : "Mark done"}
            </button>

            {onStartPomo && !todo.completed && (
              <button
                type="button"
                onClick={onStartPomo}
                className={`${actionClass} bg-rose-50 text-rose-500 hover:bg-rose-100`}
              >
                <PlayIcon />
                Pomo
              </button>
            )}

            {!todo.completed && (
              <button
                type="button"
                onClick={onToggleFocus}
                className={`${actionClass} ${
                  focused
                    ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                    : "bg-cream-100 text-stone-500 hover:bg-cream-200"
                }`}
              >
                <SunIcon filled={focused} />
                My Day
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowSnooze((open) => !open)}
              aria-expanded={showSnooze}
              className={`${actionClass} bg-lavender-50 text-lavender-600 hover:bg-lavender-100`}
            >
              <ClockIcon />
              Snooze
            </button>

            <button
              type="button"
              onClick={onEdit}
              className={`${actionClass} bg-cream-100 text-stone-500 hover:bg-cream-200`}
            >
              <EditIcon />
              Edit
            </button>

            <button
              type="button"
              onClick={onDelete}
              className={`${actionClass} ml-auto bg-rose-50 text-rose-500 hover:bg-rose-100`}
            >
              <TrashIcon />
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RotateIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v6h6M20 20v-6h-6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 10a8 8 0 00-14.4-4.8M4 14a8 8 0 0014.4 4.8" />
    </svg>
  );
}
