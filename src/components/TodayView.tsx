import { useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useLocalCache } from "../hooks/useLocalCache";
import type { Id } from "../../convex/_generated/dataModel";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function getToday() {
  const d = new Date();
  return {
    dateStr: d.toISOString().split("T")[0],
    dayOfWeek: d.getDay(),
    display: `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`,
  };
}

type TodayEvent = {
  _id: Id<"timetableEvents">;
  title: string;
  description?: string;
  location?: string;
  startTime: string;
  endTime?: string;
  occurrence: {
    _id: Id<"occurrences">;
    status: "pending" | "done" | "todo";
  } | null;
};

export function TodayView({ onGoToTodos }: { onGoToTodos: () => void }) {
  const today = getToday();
  const liveEvents = useQuery(api.timetable.getForDate, {
    date: today.dateStr,
    dayOfWeek: today.dayOfWeek,
  });
  const events = useLocalCache<TodayEvent[]>(`today:${today.dateStr}`, liveEvents) as TodayEvent[] | null | undefined;

  const setStatus = useMutation(api.occurrences.setStatus);
  const convertToTodo = useMutation(api.occurrences.convertToTodo);
  const processMissed = useMutation(api.occurrences.processMissedEvents);

  // Process missed events once per day (must be in useEffect, not render body)
  useEffect(() => {
    const processedKey = `unitrack:processed:${today.dateStr}`;
    if (!localStorage.getItem(processedKey) && liveEvents !== undefined) {
      processMissed({ today: today.dateStr })
        .then(() => localStorage.setItem(processedKey, "1"))
        .catch(() => {});
    }
  }, [today.dateStr, liveEvents, processMissed]);

  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const handleToggleDone = async (event: TodayEvent) => {
    const currentStatus = event.occurrence?.status ?? "pending";
    const newStatus = currentStatus === "done" ? "pending" : "done";
    await setStatus({ eventId: event._id, date: today.dateStr, status: newStatus });
  };

  const handleMarkTodo = async (event: TodayEvent) => {
    const currentStatus = event.occurrence?.status ?? "pending";
    if (currentStatus === "todo") {
      await setStatus({ eventId: event._id, date: today.dateStr, status: "pending" });
    } else {
      await convertToTodo({ eventId: event._id, date: today.dateStr });
      onGoToTodos();
    }
  };

  if (events === undefined) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const noEvents = !events || events.length === 0;

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900">{today.display}</h2>
        <p className="text-sm text-slate-500 mt-0.5">Today's schedule</p>
      </div>

      {noEvents ? (
        <div className="text-center py-16 text-slate-400">
          <div className="text-4xl mb-3">📅</div>
          <p className="text-sm">No classes today</p>
          <p className="text-xs mt-1">Import your timetable in Settings</p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((event) => {
            const status = event.occurrence?.status ?? "pending";
            const isDone = status === "done";
            const isTodo = status === "todo";
            const isPast = event.startTime < currentTime;

            return (
              <div
                key={event._id}
                className={`rounded-xl border p-4 transition-all ${
                  isDone
                    ? "bg-slate-50 border-slate-100 opacity-60"
                    : isTodo
                    ? "bg-amber-50 border-amber-200"
                    : isPast
                    ? "bg-orange-50 border-orange-200"
                    : "bg-white border-slate-200"
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Done checkbox */}
                  <button
                    onClick={() => handleToggleDone(event)}
                    className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                      isDone
                        ? "bg-green-500 border-green-500"
                        : "border-slate-300 hover:border-green-400"
                    }`}
                  >
                    {isDone && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className={`font-medium text-sm ${isDone ? "line-through text-slate-400" : "text-slate-900"}`}>
                        {event.title}
                      </span>
                      <span className="text-xs text-slate-400">
                        {event.startTime}{event.endTime ? `–${event.endTime}` : ""}
                      </span>
                    </div>
                    {event.location && (
                      <p className="text-xs text-slate-400 mt-0.5">{event.location}</p>
                    )}
                    {event.description && !isDone && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{event.description}</p>
                    )}
                  </div>

                  {/* Todo flag button */}
                  {!isDone && (
                    <button
                      onClick={() => handleMarkTodo(event)}
                      title={isTodo ? "Remove from todos" : "Add to todos"}
                      className={`flex-shrink-0 p-1 rounded-lg transition-colors ${
                        isTodo
                          ? "text-amber-500 bg-amber-100"
                          : "text-slate-300 hover:text-amber-400 hover:bg-amber-50"
                      }`}
                    >
                      <svg className="w-4 h-4" fill={isTodo ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary */}
      {events && events.length > 0 && (
        <div className="mt-4 flex gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
            {events.filter(e => e.occurrence?.status === "done").length} done
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-slate-300 inline-block" />
            {events.filter(e => !e.occurrence || e.occurrence.status === "pending").length} remaining
          </span>
          {events.some(e => e.occurrence?.status === "todo") && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              {events.filter(e => e.occurrence?.status === "todo").length} in todos
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export { SHORT_DAYS };
