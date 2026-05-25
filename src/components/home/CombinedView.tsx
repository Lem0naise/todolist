import { useState, useEffect } from "react";
import { SchedulePanel } from "./SchedulePanel";
import { TasksPanel } from "./TasksPanel";
import { useGuest } from "../../hooks/useGuestMode";

function getTodayStr() {
  return new Date().toISOString().split("T")[0];
}

export function CombinedView({
  onGoToTodos,
  onGoToSchedule,
}: {
  onGoToTodos: () => void;
  onGoToSchedule: () => void;
}) {
  const { isGuest } = useGuest();
  const todayStr = getTodayStr();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const hour = now.getHours();
  const greeting =
    hour < 12 ? "good morning" : hour < 17 ? "good afternoon" : "good evening";
  const dateDisplay = now.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="bg-cream">
      <div className="px-4 pt-6 pb-4">
        <p className="text-sm font-medium text-stone-400 mb-1">
          {dateDisplay}
        </p>
        <h1 className="text-3xl font-bold text-stone-700 font-hand text-5xl leading-tight">
          {greeting}
        </h1>
      </div>

      <div className="px-4 pb-6 mx-auto xl:max-w-7xl max-w-5xl">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="lg:w-[55%]">
            {isGuest ? (
              <div className="bg-white rounded-2xl border border-cream-200 p-6 text-center space-y-3">
                <p className="text-sm font-bold text-stone-500">Sign in to see your timetable</p>
                <p className="text-xs text-stone-400">Import your uni schedule to track classes alongside your tasks.</p>
              </div>
            ) : (
              <SchedulePanel
                todayStr={todayStr}
                now={now}
                onGoToSchedule={onGoToSchedule}
              />
            )}
          </div>
          <div className="flex-1">
            <TasksPanel todayStr={todayStr} onGoToTodos={onGoToTodos} />
          </div>
        </div>
      </div>
    </div>
  );
}
