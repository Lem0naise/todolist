import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useLocalCache } from "../../hooks/useLocalCache";
import type { Id } from "../../../convex/_generated/dataModel";

type TodayEvent = {
  _id: Id<"timetableEvents">;
  title: string;
  location?: string;
  startTime: string;
  endTime?: string;
  moduleName?: string;
  occurrence: {
    _id: Id<"occurrences">;
    status: "pending" | "done" | "todo";
  } | null;
};

function getTimeOffset(timeStr: string) {
  const [h, m] = timeStr.split(":").map(Number);
  const pxPerHour = 56;
  const offsetHours = h - 8 + m / 60;
  return offsetHours * pxPerHour;
}

export function DayColumn({
  day,
  todayStr,
  currentTime,
  onSelectEvent,
}: {
  day: { date: string; dayOfWeek: number; label: string; dateNum: number };
  todayStr: string;
  currentTime: string;
  onSelectEvent: (event: TodayEvent) => void;
}) {
  const liveEvents = useQuery(api.timetable.getForDate, {
    date: day.date,
    dayOfWeek: day.dayOfWeek,
  });
  const events = useLocalCache(`week:${day.date}`, liveEvents) as
    | TodayEvent[]
    | null
    | undefined;
  const isToday = day.date === todayStr;

  return (
    <div
      className={`flex-1 border-r border-cream-100 relative min-w-[100px] ${
        isToday ? "bg-rose-50/10" : ""
      }`}
    >
      {Array.from({ length: 15 }, (_, i) => i + 8).map((h) => (
        <div
          key={h}
          className="h-[56px] border-b border-cream-50"
        />
      ))}

      {isToday && (
        <div
          className="absolute left-0 right-0 border-t-2 border-rose-400 z-20 flex items-center"
          style={{ top: getTimeOffset(currentTime) }}
        >
          <div className="w-2 h-2 rounded-full bg-rose-400 absolute -left-1 -translate-y-1/2" />
        </div>
      )}

      {events?.map((event) => {
        const top = getTimeOffset(event.startTime);
        const height = event.endTime
          ? getTimeOffset(event.endTime) - top
          : 56;
        const status = event.occurrence?.status ?? "pending";
        const isDone = status === "done";
        const isTodo = status === "todo";
        const isPast =
          day.date < todayStr ||
          (isToday && event.startTime < currentTime);
        const isUnresolvedPast = isPast && !isDone && !isTodo;

        return (
          <button
            key={event._id}
            onClick={() => onSelectEvent(event)}
            className={`absolute left-1 right-1 rounded-md p-1 overflow-hidden border text-left transition-all hover:ring-1 hover:z-30 block ${
              isDone
                ? "bg-stone-100 border-stone-200 opacity-60 text-stone-400"
                : isTodo
                  ? "bg-amber-100/80 border-amber-200 text-amber-800"
                  : isUnresolvedPast
                    ? "bg-rose-100 border-rose-300 text-rose-800"
                    : "bg-lavender-50/90 border-lavender-200 text-lavender-800"
            } ${isUnresolvedPast ? "animate-pulse shadow-sm" : ""}`}
            style={{ top, height: Math.max(height, 22) }}
          >
            <div className="text-[10px] font-bold truncate leading-tight">
              {event.title}
            </div>
            {event.moduleName && (
              <div className="text-[9px] truncate opacity-70 font-medium leading-none">
                {event.moduleName}
              </div>
            )}
            {height >= 36 && event.location && (
              <div className="text-[9px] truncate opacity-80 font-medium leading-none">
                {event.location}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
