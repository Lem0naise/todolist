import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useLocalCache } from "../../hooks/useLocalCache";
import { useGuest } from "../../hooks/useGuestMode";
import { TodoModal } from "../todos/TodoModal";
import { WeekNav } from "./WeekNav";
import { EventCard } from "./EventCard";
import { DayColumn } from "./DayColumn";
import type { Id } from "../../../convex/_generated/dataModel";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

function getWeekDays(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  const dow = d.getDay();
  const daysFromMonday = dow === 0 ? 6 : dow - 1;
  const monday = new Date(d);
  monday.setDate(d.getDate() - daysFromMonday);

  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const ds = day.toISOString().split("T")[0];
    return {
      date: ds,
      dayOfWeek: day.getDay(),
      label: SHORT_DAYS[day.getDay()],
      dateNum: day.getDate(),
    };
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
  moduleName?: string;
  occurrence: {
    _id: Id<"occurrences">;
    status: "pending" | "done" | "todo";
    todoId?: Id<"todos">;
    linkedTodo?: LinkedTodo;
  } | null;
};

export function TodayView({
  initialDate,
}: {
  onGoToTodos: () => void;
  initialDate?: string;
}) {
  const { isGuest } = useGuest();
  const todayStr = getTodayStr();
  const [selectedDate, setSelectedDate] = useState(initialDate ?? todayStr);
  const [editingTodo, setEditingTodo] = useState<LinkedTodo | null>(null);
  const [viewMode, setViewMode] = useState<"day" | "week">("week");
  const [selectedWeekEvent, setSelectedWeekEvent] = useState<{
    event: TodayEvent;
    date: string;
  } | null>(null);

  const dateInfo = getDateInfo(selectedDate);
  const weekDays = getWeekDays(selectedDate);
  const isToday = selectedDate === todayStr;
  const isFuture = selectedDate > todayStr;

  const liveEvents = useQuery(api.timetable.getForDate, {
    date: selectedDate,
    dayOfWeek: dateInfo.dayOfWeek,
  });
  const events = useLocalCache<TodayEvent[]>(
    `today:${selectedDate}`,
    liveEvents,
  ) as TodayEvent[] | null | undefined;

  const setStatus = useMutation(api.occurrences.setStatus);
  const convertToTodo = useMutation(api.occurrences.convertToTodo);
  const completeTodo = useMutation(api.todos.complete);

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const handleToggleDone = async (
    event: TodayEvent,
    dateOverride?: string,
  ) => {
    const currentStatus = event.occurrence?.status ?? "pending";
    const newStatus = currentStatus === "done" ? "pending" : "done";
    await setStatus({
      eventId: event._id,
      date: dateOverride ?? selectedDate,
      status: newStatus,
    });
    // If we're marking a "todo" occurrence as done, also complete the linked catchup todo
    if (currentStatus === "todo" && event.occurrence?.linkedTodo?._id) {
      await completeTodo({
        id: event.occurrence.linkedTodo._id,
        completed: true,
      });
    }
    // If toggling back to pending and there's a linked todo, un-complete it
    if (newStatus === "pending" && event.occurrence?.todoId) {
      await completeTodo({
        id: event.occurrence.todoId,
        completed: false,
      });
    }
    if (selectedWeekEvent && selectedWeekEvent.event._id === event._id) {
      setSelectedWeekEvent(null);
    }
  };

  const handleMarkTodo = async (
    event: TodayEvent,
    dateOverride?: string,
  ) => {
    const currentStatus = event.occurrence?.status ?? "pending";
    const targetDate = dateOverride ?? selectedDate;
    if (currentStatus === "todo") {
      if (event.occurrence?.linkedTodo) {
        setEditingTodo(event.occurrence.linkedTodo);
      } else {
        await setStatus({
          eventId: event._id,
          date: targetDate,
          status: "pending",
        });
      }
    } else {
      await convertToTodo({
        eventId: event._id,
        date: targetDate,
        dueDate: targetDate,
      });
    }
    if (selectedWeekEvent && selectedWeekEvent.event._id === event._id) {
      setSelectedWeekEvent(null);
    }
  };

  const goToPrevWeek = () => setSelectedDate(offsetDate(selectedDate, -7));
  const goToNextWeek = () => setSelectedDate(offsetDate(selectedDate, 7));

  const noEvents = !events || events.length === 0;

  if (isGuest) {
    return (
      <div className="p-3 max-w-4xl mx-auto min-h-screen">
        <div className="flex items-center justify-center h-48">
          <div className="text-center">
            <p className="text-sm font-bold text-stone-500">Sign in to see your schedule</p>
            <p className="text-xs text-stone-400 mt-1">Import your timetable to track classes alongside tasks.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 max-w-4xl mx-auto">
      <WeekNav
        weekDays={weekDays}
        selectedDate={selectedDate}
        todayStr={todayStr}
        onSelectDay={setSelectedDate}
        onPrevWeek={goToPrevWeek}
        onNextWeek={goToNextWeek}
      />

      <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-stone-700 font-hand text-4xl leading-tight">
              {dateInfo.display}
            </h2>
            {isToday && (
              <span className="text-xs px-1.5 py-0.5 bg-rose-100 text-rose-500 rounded font-bold">
                Today
              </span>
            )}
          </div>
          <p className="text-xs text-stone-400 mt-0.5">
            {isToday
              ? "today's schedule"
              : isFuture
                ? "upcoming"
                : "past"}
          </p>
        </div>

        <div className="flex bg-cream-100 p-1 rounded-lg self-start">
          <button
            onClick={() => setViewMode("day")}
            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
              viewMode === "day"
                ? "bg-white shadow-sm text-stone-700"
                : "text-stone-400 hover:text-stone-600"
            }`}
          >
            List
          </button>
          <button
            onClick={() => setViewMode("week")}
            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
              viewMode === "week"
                ? "bg-white shadow-sm text-stone-700"
                : "text-stone-400 hover:text-stone-600"
            }`}
          >
            Week
          </button>
        </div>
      </div>

      {viewMode === "week" ? (
        <div className="overflow-x-auto pb-4">
          <div className="min-w-[700px] border border-cream-200 rounded-xl bg-white flex relative">
            <div className="w-12 border-r border-cream-100 flex-shrink-0">
              {Array.from({ length: 15 }, (_, i) => i + 8).map((h) => (
                <div
                  key={h}
                  className="h-[56px] relative border-b border-cream-50"
                >
                  <span className="absolute -top-2 left-0 right-0 text-center text-[9px] text-stone-400 font-bold bg-white mx-1">
                    {String(h).padStart(2, "0")}:00
                  </span>
                </div>
              ))}
            </div>
            {weekDays.map((day) => (
              <DayColumn
                key={day.date}
                day={day}
                todayStr={todayStr}
                currentTime={currentTime}
                onSelectEvent={(e: TodayEvent) =>
                  setSelectedWeekEvent({ event: e, date: day.date })
                }
              />
            ))}
          </div>
        </div>
      ) : (
        <>
          {noEvents ? (
            <div className="text-center py-16 text-stone-400">
              <p className="text-sm font-medium">
                No classes {isToday ? "today" : "on this day"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {events.map((event) => {
                const status = event.occurrence?.status ?? "pending";
                const isDone = status === "done";
                const isTodo = status === "todo";
                const isPast =
                  selectedDate < todayStr ||
                  (isToday && event.startTime < currentTime);
                const isUnresolvedPast =
                  isPast && !isDone && !isTodo;

                return (
                  <EventCard
                    key={event._id}
                    event={event}
                    isDone={isDone}
                    isTodo={isTodo}
                    isUnresolvedPast={isUnresolvedPast}
                    onToggleDone={() => handleToggleDone(event)}
                    onMarkTodo={() => handleMarkTodo(event)}
                  />
                );
              })}
            </div>
          )}

          {events && events.length > 0 && (
            <div className="mt-4 flex gap-3 text-xs font-bold text-stone-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-mint-400" />
                {events.filter((e) => e.occurrence?.status === "done").length}{" "}
                done
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-stone-300" />
                {
                  events.filter(
                    (e) =>
                      !e.occurrence || e.occurrence.status === "pending",
                  ).length
                }{" "}
                remaining
              </span>
              {events.some((e) => e.occurrence?.status === "todo") && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  {
                    events.filter(
                      (e) => e.occurrence?.status === "todo",
                    ).length
                  }{" "}
                  in todos
                </span>
              )}
            </div>
          )}
        </>
      )}

      {selectedWeekEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/30 backdrop-blur-sm"
          onClick={() => setSelectedWeekEvent(null)}
        >
          <div
            className="w-full max-w-lg bg-transparent"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const event = selectedWeekEvent.event;
              const status = event.occurrence?.status ?? "pending";
              const isDone = status === "done";
              const isTodo = status === "todo";
              const isPast =
                selectedWeekEvent.date < todayStr ||
                (selectedWeekEvent.date === todayStr &&
                  event.startTime < currentTime);
              const isUnresolvedPast = isPast && !isDone && !isTodo;
              return (
                <div className="bg-cream rounded-2xl shadow-xl overflow-hidden">
                  <div className="px-3 py-2 border-b border-cream-200 flex justify-between items-center bg-cream-50">
                    <span className="text-xs font-bold text-stone-500">
                      {new Date(
                        selectedWeekEvent.date,
                      ).toLocaleDateString("en-GB", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <button
                      onClick={() => setSelectedWeekEvent(null)}
                      className="text-stone-400 hover:text-stone-600"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                  <div className="p-3">
                    <EventCard
                      event={event}
                      isDone={isDone}
                      isTodo={isTodo}
                      isUnresolvedPast={isUnresolvedPast}
                      onToggleDone={() =>
                        handleToggleDone(event, selectedWeekEvent.date)
                      }
                      onMarkTodo={() =>
                        handleMarkTodo(event, selectedWeekEvent.date)
                      }
                    />
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {editingTodo && (
        <TodoModal
          onClose={() => setEditingTodo(null)}
          editTodo={editingTodo}
        />
      )}
    </div>
  );
}
