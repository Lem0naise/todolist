import { useState, useEffect } from "react";
import type { PomoTimer } from "./PomoTimer";

export function FloatingPomo({
  timer,
  onNavigate,
}: {
  timer: PomoTimer;
  onNavigate: () => void;
}) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const secondsLeft = timer.getTimeLeft();
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const isBreak = timer.phase?.type === "break";
  const bg = isBreak ? "bg-mint-400" : "bg-rose-400";
  const pulse = timer.isPaused ? "" : "animate-pulse";

  return (
    <button
      onClick={onNavigate}
      className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-xl shadow-lg text-white text-sm font-bold transition-all hover:scale-105 ${bg} ${pulse}`}
    >
      <div className={`w-2.5 h-2.5 rounded-full ${timer.isPaused ? "bg-white/80" : "bg-white"}`} />
      <span className="font-pomo">
        {timer.isPaused
          ? "paused"
          : timer.duration >= 60
            ? `${String(Math.floor(secondsLeft / 3600)).padStart(2, "0")}:${String(Math.floor((secondsLeft % 3600) / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")}`
            : `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`}
      </span>
      <span className="text-xs opacity-80">
        {isBreak ? "break" : timer.topic.slice(0, 12)}
      </span>
    </button>
  );
}
