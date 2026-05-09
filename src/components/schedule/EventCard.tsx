import type { Id } from "../../../convex/_generated/dataModel";

type LinkedTodo = {
  _id: Id<"todos">;
  title: string;
  description?: string;
  dueDate?: string;
  highPriority: boolean;
  completed: boolean;
};

type TodayEvent = {
  _id: Id<"timetableEvents">;
  title: string;
  description?: string;
  location?: string;
  startTime: string;
  endTime?: string;
  moduleName?: string;
  occurrence: {
    _id: Id<"occurrences">;
    status: "pending" | "done" | "todo";
    todoId?: Id<"todos">;
    linkedTodo?: LinkedTodo;
  } | null;
};

export function EventCard({
  event,
  isDone,
  isTodo,
  isUnresolvedPast,
  onToggleDone,
  onMarkTodo,
}: {
  event: TodayEvent;
  isDone: boolean;
  isTodo: boolean;
  isUnresolvedPast: boolean;
  onToggleDone: () => void;
  onMarkTodo: () => void;
}) {
  return (
    <div
      className={`rounded-xl border p-3 transition-all text-sm ${
        isDone
          ? "bg-stone-50 border-stone-100 opacity-60"
          : isTodo
            ? "bg-amber-50 border-amber-200"
            : isUnresolvedPast
              ? "bg-rose-50 border-rose-200 ring-1 ring-rose-100 shadow-sm"
              : "bg-white border-cream-200 hover:border-cream-300 shadow-sm"
      }`}
    >
      <div className="flex items-start gap-2.5 w-full">
        <button
          onClick={onToggleDone}
          className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
            isDone
              ? "bg-mint-400 border-mint-400"
              : "border-stone-300 hover:border-mint-400 bg-white"
          }`}
        >
          {isDone && (
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span
              className={`font-bold text-sm ${
                isDone
                  ? "line-through text-stone-400"
                  : "text-stone-700"
              }`}
            >
              {event.title}
            </span>
            {event.moduleName && (
              <span className="text-[10px] px-1.5 py-0.5 bg-lavender-100 text-lavender-600 rounded font-bold uppercase tracking-wider truncate max-w-[100px]">
                {event.moduleName}
              </span>
            )}
            {isUnresolvedPast && (
              <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-500">
                Catch up?
              </span>
            )}
            <span className="text-xs font-semibold text-stone-400">
              {event.startTime}
              {event.endTime ? `-${event.endTime}` : ""}
            </span>
          </div>
          {event.location && (
            <p className="text-xs font-medium text-stone-400">
              {event.location}
            </p>
          )}
          {event.description && !isDone && (
            <p className="text-xs text-stone-500 mt-1.5 line-clamp-2 leading-snug">
              {event.description}
            </p>
          )}
        </div>

        {!isDone && (
          <div className="flex flex-col gap-1.5">
            <button
              onClick={onMarkTodo}
              title={
                isTodo
                  ? event.occurrence?.linkedTodo
                    ? "Edit linked todo"
                    : "Remove from todos"
                  : "Add to todos"
              }
              className={`flex-shrink-0 flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                isTodo
                  ? "text-amber-600 bg-amber-100 ring-1 ring-amber-200"
                  : isUnresolvedPast
                    ? "text-white bg-rose-400 hover:bg-rose-500 shadow-sm"
                    : "text-stone-400 bg-cream-100 hover:text-amber-600 hover:bg-amber-50"
              }`}
            >
              {isTodo && event.occurrence?.linkedTodo ? (
                <>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </>
              ) : isTodo ? (
                <>
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  Added
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  Todo
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
