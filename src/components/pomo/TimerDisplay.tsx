import { PauseIcon, PlayIcon, StopIcon } from "../icons";
import type { PomoDensity } from "./usePomoDensity";

const RING_RADIUS = 130;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function TimerDial({
  progress,
  ringColor,
  textColor,
  text,
  sizeClass,
  textClass,
}: {
  progress: number;
  ringColor: string;
  textColor: string;
  text: string;
  sizeClass: string;
  textClass: string;
}) {
  const offset = CIRCUMFERENCE - (progress / 100) * CIRCUMFERENCE;

  return (
    <div className={`relative ${sizeClass} flex-shrink-0 mx-auto flex items-center justify-center`}>
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 280 280">
        <circle
          cx="140" cy="140" r={RING_RADIUS}
          fill="none"
          stroke="#e8e2d9"
          strokeWidth="10"
        />
        <circle
          cx="140" cy="140" r={RING_RADIUS}
          fill="none"
          stroke={ringColor}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          className="transition-all duration-300"
        />
      </svg>
      <span className={`${textClass} font-bold font-pomo relative z-10 ${textColor}`}>
        {text}
      </span>
    </div>
  );
}

export function DenseTimerView({
  density,
  isBreak,
  isPaused,
  taskLabel,
  finishLabel,
  displayText,
  progress,
  ringColor,
  textColor,
  onTogglePause,
  onTakeBreak,
  onFinish,
}: {
  density: Exclude<PomoDensity, "full">;
  isBreak: boolean;
  isPaused: boolean;
  taskLabel: string;
  finishLabel: string | null;
  displayText: string;
  progress: number;
  ringColor: string;
  textColor: string;
  onTogglePause: () => void;
  onTakeBreak: () => void;
  onFinish: () => void;
}) {
  const dial =
    density === "compact"
      ? { size: "w-[min(14rem,78vw)] h-[min(14rem,78vw)]", text: "text-5xl" }
      : density === "tiny"
        ? { size: "w-[min(11rem,72vw)] h-[min(11rem,72vw)]", text: "text-4xl" }
        : { size: "w-[min(8rem,68vw)] h-[min(8rem,68vw)]", text: "text-3xl" };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
      {density !== "micro" && (
        <p
          className="max-w-full truncate px-1 text-lg font-bold text-stone-600 font-hand"
          title={taskLabel}
        >
          {taskLabel}
        </p>
      )}

      <TimerDial
        progress={progress}
        ringColor={ringColor}
        textColor={textColor}
        text={displayText}
        sizeClass={dial.size}
        textClass={dial.text}
      />

      {density !== "micro" && finishLabel && (
        <p className="text-[11px] font-bold text-stone-400">
          ends at {finishLabel}
        </p>
      )}

      {density === "compact" ? (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <button
            onClick={onTogglePause}
            className="px-3 py-1.5 bg-rose-400 hover:bg-rose-500 text-white text-[11px] font-bold rounded-lg transition-colors"
          >
            {isPaused ? "Resume" : "Pause"}
          </button>
          <button
            onClick={onTakeBreak}
            className="px-3 py-1.5 bg-mint-100 hover:bg-mint-200 text-mint-600 text-[11px] font-bold rounded-lg border border-mint-200 transition-colors"
          >
            {isBreak ? "Skip Break" : "Break"}
          </button>
          <button
            onClick={onFinish}
            className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-500 text-[11px] font-bold rounded-lg transition-colors"
          >
            Finish
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={onTogglePause}
            aria-label={isPaused ? "Resume timer" : "Pause timer"}
            title={isPaused ? "Resume timer" : "Pause timer"}
            className="w-11 h-11 rounded-full bg-rose-400 hover:bg-rose-500 text-white flex items-center justify-center shadow-sm transition-colors"
          >
            {isPaused ? <PlayIcon className="w-4 h-4" /> : <PauseIcon className="w-4 h-4" />}
          </button>
          <button
            onClick={onFinish}
            aria-label="Finish session"
            title="Finish session"
            className="w-11 h-11 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 border border-cream-200 flex items-center justify-center transition-colors"
          >
            <StopIcon className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
