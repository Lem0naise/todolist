import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useLocalCache } from "../../hooks/useLocalCache";
import { PanelCard } from "./PanelCard";
import type { Id } from "../../../convex/_generated/dataModel";
import type { ReactNode } from "react";

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

function CalendarIcon() {
  return (
    <svg className="w-4 h-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function EmptyState({ icon, message, sub }: { icon: ReactNode; message: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center h-full">
      <div className="mb-2 opacity-60">{icon}</div>
      <p className="text-sm font-bold text-stone-500">{message}</p>
      {sub && (
        <p className="text-xs font-medium text-stone-400 mt-1 max-w-[200px] leading-relaxed">
          {sub}
        </p>
      )}
    </div>
  );
}

export function SchedulePanel({
  todayStr,
  now,
  onGoToSchedule,
}: {
  todayStr: string;
  now: Date;
  onGoToSchedule: () => void;
}) {
  const dayOfWeek = new Date(todayStr + "T12:00:00").getDay();
  const liveEvents = useQuery(api.timetable.getForDate, {
    date: todayStr,
    dayOfWeek,
  });
  const events = (useLocalCache<TodayEvent[]>(
    `combined:schedule:${todayStr}`,
    liveEvents,
  ) ?? undefined) as TodayEvent[] | undefined;
  const setStatus = useMutation(api.occurrences.setStatus);

  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const handleToggle = async (event: TodayEvent) => {
    const current = event.occurrence?.status ?? "pending";
    await setStatus({
      eventId: event._id,
      date: todayStr,
      status: current === "done" ? "pending" : "done",
    });
  };

  const doneCount = events?.filter((e) => e.occurrence?.status === "done").length ?? 0;
  const totalCount = events?.length ?? 0;

  return (
    <PanelCard
      title="schedule"
      icon={<CalendarIcon />}
      badge={totalCount > 0 ? `${doneCount}/${totalCount}` : undefined}
      action={{ label: "full view", onClick: onGoToSchedule }}
      headerAction={
        <span className="text-[10px] font-bold px-2 py-1 bg-cream-100 text-stone-500 rounded-lg">
          {currentTime}
        </span>
      }
    >
      {events === undefined ? (
        <LoadingSpinner />
      ) : events.length === 0 ? (
        <EmptyState
          icon={<CalendarIcon />}
          message="No classes today"
          sub="Check Settings to import your timetable"
        />
      ) : (
        <div className="space-y-1">
          {events.map((event) => {
            const status = event.occurrence?.status ?? "pending";
            const isDone = status === "done";
            const isPast = event.startTime < currentTime && !isDone;
            const isActive =
              event.startTime <= currentTime &&
              (!event.endTime || event.endTime > currentTime) &&
              !isDone;

            return (
              <button
                key={event._id}
                onClick={() => handleToggle(event)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg border text-left transition-all text-sm group ${
                  isDone
                    ? "bg-stone-50 border-stone-100"
                    : isPast
                      ? "bg-amber-50 border-amber-100"
                      : isActive
                        ? "bg-lavender-50 border-lavender-200 shadow-sm"
                        : "bg-white border-cream-200 hover:border-cream-300"
                }`}
              >
                <div className="flex-shrink-0 text-right w-10">
                  <span className="text-xs font-bold text-stone-500">
                    {event.startTime}
                  </span>
                </div>
                <div
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    isDone
                      ? "bg-mint-400"
                      : isPast
                        ? "bg-amber-400"
                        : isActive
                          ? "bg-lavender-400 animate-pulse"
                          : "bg-rose-300"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p
                      className={`text-sm font-semibold truncate ${
                        isDone
                          ? "line-through text-stone-400"
                          : isActive
                            ? "text-lavender-800"
                            : "text-stone-700"
                      }`}
                    >
                      {event.title}
                    </p>
                    {event.moduleName && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-lavender-100 text-lavender-600 rounded font-bold uppercase tracking-wider truncate max-w-[100px]">
                        {event.moduleName}
                      </span>
                    )}
                  </div>
                  {event.location && (
                    <p className="text-xs truncate text-stone-400">
                      {event.location}
                    </p>
                  )}
                </div>
                <div
                  className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-all ${
                    isDone
                      ? "bg-mint-400 border-mint-400"
                      : "border-stone-200 group-hover:border-mint-300"
                  }`}
                >
                  {isDone && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </PanelCard>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center p-8 h-full">
      <div className="w-5 h-5 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
