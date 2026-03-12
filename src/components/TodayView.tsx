import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useLocalCache } from "../hooks/useLocalCache";
import { TodoModal } from "./TodoModal";
import type { Id } from "../../convex/_generated/dataModel";

export const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getTodayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function getDateInfo(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return {
    dateStr,
    dayOfWeek: d.getDay(),
    display: `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`,
  };
}

/** Returns the Mon–Sun week days containing dateStr */
function getWeekDays(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  const dow = d.getDay();
  // Monday = index 0; Sunday = index 6
  const daysFromMonday = dow === 0 ? 6 : dow - 1;
  const monday = new Date(d);
  monday.setDate(d.getDate() - daysFromMonday);

  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const ds = day.toISOString().split("T")[0];
    return { date: ds, dayOfWeek: day.getDay(), label: SHORT_DAYS[day.getDay()], dateNum: day.getDate() };
  });
}

function offsetDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

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
  occurrence: {
    _id: Id<"occurrences">;
    status: "pending" | "done" | "todo";
    todoId?: Id<"todos">;
    linkedTodo?: LinkedTodo;
  } | null;
};

export function TodayView({
  onGoToTodos,
  initialDate,
}: {
  onGoToTodos: () => void;
  initialDate?: string;
}) {
  const todayStr = getTodayStr();
  const [selectedDate, setSelectedDate] = useState(initialDate ?? todayStr);
  const [editingTodo, setEditingTodo] = useState<LinkedTodo | null>(null);

  // Navigate to initialDate when it changes (triggered by badge click in TodosView)
  useEffect(() => {
    if (initialDate) setSelectedDate(initialDate);
  }, [initialDate]);

  // Auto-reset to today when the calendar day rolls over
  const prevTodayRef = useRef(todayStr);
  useEffect(() => {
    if (prevTodayRef.current !== todayStr) {
      prevTodayRef.current = todayStr;
      setSelectedDate(todayStr);
    }
  });

  const dateInfo = getDateInfo(selectedDate);
  const weekDays = getWeekDays(selectedDate);
  const isToday = selectedDate === todayStr;
  const isFuture = selectedDate > todayStr;

  const liveEvents = useQuery(api.timetable.getForDate, {
    date: selectedDate,
    dayOfWeek: dateInfo.dayOfWeek,
  });
  const events = useLocalCache<TodayEvent[]>(`today:${selectedDate}`, liveEvents) as TodayEvent[] | null | undefined;

  const setStatus = useMutation(api.occurrences.setStatus);
  const convertToTodo = useMutation(api.occurrences.convertToTodo);
  const processMissed = useMutation(api.occurrences.processMissedEvents);

  // Process missed events once per day (runs on mount; localStorage guards against repeats)
  useEffect(() => {
    const processedKey = `unitrack:processed:${todayStr}`;
    if (localStorage.getItem(processedKey)) return;
    processMissed({ today: todayStr })
      .then(() => localStorage.setItem(processedKey, "1"))
      .catch(() => {});
  }, [todayStr, processMissed]);

  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const handleToggleDone = async (event: TodayEvent) => {
    const currentStatus = event.occurrence?.status ?? "pending";
    const newStatus = currentStatus === "done" ? "pending" : "done";
    await setStatus({ eventId: event._id, date: selectedDate, status: newStatus });
  };

  const handleMarkTodo = async (event: TodayEvent) => {
    const currentStatus = event.occurrence?.status ?? "pending";
    if (currentStatus === "todo") {
      if (event.occurrence?.linkedTodo) {
        // Open the linked todo for editing
        setEditingTodo(event.occurrence.linkedTodo);
      } else {
        await setStatus({ eventId: event._id, date: selectedDate, status: "pending" });
      }
    } else {
      await convertToTodo({ eventId: event._id, date: selectedDate, dueDate: selectedDate });
      // Only auto-navigate to todos when acting on today or a past day
      if (!isFuture) onGoToTodos();
    }
  };

  const goToPrevWeek = () => setSelectedDate(offsetDate(selectedDate, -7));
  const goToNextWeek = () => setSelectedDate(offsetDate(selectedDate, 7));

  if (events === undefined) {
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <WeekNav
          weekDays={weekDays}
          selectedDate={selectedDate}
          todayStr={todayStr}
          onSelectDay={setSelectedDate}
          onPrevWeek={goToPrevWeek}
          onNextWeek={goToNextWeek}
        />
        <div className="flex items-center justify-center h-48">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const noEvents = !events || events.length === 0;

  return (
    <div className="p-4 max-w-2xl mx-auto">
      {/* Week navigation strip */}
      <WeekNav
        weekDays={weekDays}
        selectedDate={selectedDate}
        todayStr={todayStr}
        onSelectDay={setSelectedDate}
        onPrevWeek={goToPrevWeek}
        onNextWeek={goToNextWeek}
      />

      {/* Day header */}
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold text-slate-900">{dateInfo.display}</h2>
          {isToday && (
            <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded font-medium">Today</span>
          )}
        </div>
        <p className="text-sm text-slate-500 mt-0.5">
          {isToday ? "Today's schedule" : isFuture ? "Upcoming schedule" : "Past schedule"}
        </p>
      </div>

      {noEvents ? (
        <div className="text-center py-16 text-slate-400">
          <div className="text-4xl mb-3">📅</div>
          <p className="text-sm">No classes {isToday ? "today" : "on this day"}</p>
          {isToday && <p className="text-xs mt-1">Import your timetable in Settings</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((event) => {
            const status = event.occurrence?.status ?? "pending";
            const isDone = status === "done";
            const isTodo = status === "todo";
            // "past" only makes sense when viewing today
            const isPast = isToday && event.startTime < currentTime;

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

                  {/* Todo flag / edit button */}
                  {!isDone && (
                    <button
                      onClick={() => handleMarkTodo(event)}
                      title={
                        isTodo
                          ? event.occurrence?.linkedTodo
                            ? "Edit linked todo"
                            : "Remove from todos"
                          : "Add to todos"
                      }
                      className={`flex-shrink-0 p-1 rounded-lg transition-colors ${
                        isTodo
                          ? "text-amber-500 bg-amber-100"
                          : "text-slate-300 hover:text-amber-400 hover:bg-amber-50"
                      }`}
                    >
                      {isTodo && event.occurrence?.linkedTodo ? (
                        // Pencil icon when there's a linked todo to edit
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      ) : (
                        // Bookmark icon for add/remove todo
                        <svg className="w-4 h-4" fill={isTodo ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                        </svg>
                      )}
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
            {events.filter((e) => e.occurrence?.status === "done").length} done
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-slate-300 inline-block" />
            {events.filter((e) => !e.occurrence || e.occurrence.status === "pending").length} remaining
          </span>
          {events.some((e) => e.occurrence?.status === "todo") && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              {events.filter((e) => e.occurrence?.status === "todo").length} in todos
            </span>
          )}
        </div>
      )}

      {/* Edit linked todo modal */}
      {editingTodo && (
        <TodoModal
          onClose={() => setEditingTodo(null)}
          editTodo={editingTodo}
        />
      )}
    </div>
  );
}

function WeekNav({
  weekDays,
  selectedDate,
  todayStr,
  onSelectDay,
  onPrevWeek,
  onNextWeek,
}: {
  weekDays: { date: string; dayOfWeek: number; label: string; dateNum: number }[];
  selectedDate: string;
  todayStr: string;
  onSelectDay: (date: string) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
}) {
  return (
    <div className="flex items-center gap-1 mb-5">
      <button
        onClick={onPrevWeek}
        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors flex-shrink-0"
        aria-label="Previous week"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div className="flex flex-1 gap-0.5">
        {weekDays.map((day) => {
          const isSelected = day.date === selectedDate;
          const isToday = day.date === todayStr;
          return (
            <button
              key={day.date}
              onClick={() => onSelectDay(day.date)}
              className={`flex-1 flex flex-col items-center py-1.5 rounded-lg text-xs transition-colors ${
                isSelected
                  ? "bg-blue-600 text-white font-semibold"
                  : isToday
                  ? "bg-blue-100 text-blue-700 font-medium"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              <span>{day.label}</span>
              <span className={isSelected ? "font-bold" : ""}>{day.dateNum}</span>
            </button>
          );
        })}
      </div>

      <button
        onClick={onNextWeek}
        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors flex-shrink-0"
        aria-label="Next week"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
