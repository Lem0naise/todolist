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

  const isStopwatch = timer.mode === "stopwatch";
  const elapsed = timer.getElapsedSeconds();
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const bg = isStopwatch ? "bg-amber-400" : timer.phase?.type === "break" ? "bg-mint-400" : "bg-rose-400";
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
          : `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`}
      </span>
      <span className="text-xs opacity-80">
        {isStopwatch ? (timer.topic || "work").slice(0, 12) : timer.phase?.type === "break" ? "break" : timer.topic.slice(0, 12)}
      </span>
    </button>
  );
}
