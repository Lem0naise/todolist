import { useState, useEffect, useRef } from "react";
import { getTimerInstance } from "./timerState";

let splashSoundEnabled = true;
try {
  splashSoundEnabled = localStorage.getItem("unitrack:pomo:splashSound") !== "false";
} catch {
  /* ignore */
}

// eslint-disable-next-line react-refresh/only-export-components
export function toggleSplashSound() {
  splashSoundEnabled = !splashSoundEnabled;
  try {
    localStorage.setItem("unitrack:pomo:splashSound", String(splashSoundEnabled));
  } catch {
    /* ignore */
  }
  return splashSoundEnabled;
}

// eslint-disable-next-line react-refresh/only-export-components
export function getSplashSoundEnabled() {
  return splashSoundEnabled;
}

function playChime(descending = false) {
  if (!splashSoundEnabled) return;
  try {
    const ctx = new (window.AudioContext || (window as unknown as { AudioContext: typeof AudioContext }).AudioContext)();
    const baseNotes = [523.25, 659.25, 783.99]; // C5, E5, G5 — ascending
    const notes = descending ? [...baseNotes].reverse() : baseNotes;
    const chimeDuration = notes.length * 0.15 + 0.35;
    const gap = 0.5;
    const repeats = 5;

    for (let r = 0; r < repeats; r++) {
      const offset = r * (chimeDuration + gap);
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        const t = ctx.currentTime + offset + i * 0.15;
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.35);
      });
    }
  } catch {
    // Audio not available
  }
}

export function SplashScreen({ onSkip }: { onSkip: () => void }) {
  const timer = getTimerInstance();
  const [countdown, setCountdown] = useState(10);
  const soundPlayed = useRef(false);
  const onSkipRef = useRef(onSkip);
  onSkipRef.current = onSkip;

  useEffect(() => {
    if (!soundPlayed.current) {
      soundPlayed.current = true;
      const isBreak = timer?.splashLabel === "BREAK TIME";
      playChime(!isBreak); // ascending for break, descending for work
    }
    const timeout = setTimeout(() => {
      onSkipRef.current();
    }, 10000);

    const id = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(id);
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => {
      clearInterval(id);
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!timer?.isInSplash()) return null;

  const isBreak = timer.splashLabel === "BREAK TIME";
  const bgFrom = isBreak ? "#98d9c2" : "#f4a7b9";
  const bgTo = isBreak ? "#50b894" : "#e7768f";
  const textColor = isBreak ? "text-mint-600" : "text-rose-600";

  return (
    <div
      onClick={onSkip}
      className="fixed inset-0 z-[200] flex items-center justify-center cursor-pointer overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${bgFrom} 0%, ${bgTo} 100%)` }}
    >
      {/* Paint splash blobs */}
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div
          className="absolute rounded-full animate-ping"
          style={{
            width: 300, height: 300,
            background: `radial-gradient(circle, rgba(255,255,255,0.6) 0%, transparent 70%)`,
            top: "10%", left: "5%",
            animationDuration: "3s",
          }}
        />
        <div
          className="absolute rounded-full animate-pulse"
          style={{
            width: 200, height: 200,
            background: `radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 70%)`,
            top: "50%", right: "10%",
            animationDuration: "2s",
          }}
        />
        <div
          className="absolute rounded-full animate-bounce"
          style={{
            width: 250, height: 250,
            background: `radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)`,
            bottom: "5%", left: "30%",
            animationDuration: "4s",
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: 150, height: 150,
            background: `radial-gradient(circle, rgba(255,255,255,0.5) 0%, transparent 70%)`,
            top: "20%", right: "25%",
            animation: "splashPulse 2s ease-in-out infinite",
          }}
        />
      </div>

      {/* Splatter dots */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: 8 + (i * 3) % 20,
              height: 8 + (i * 3) % 20,
              top: `${Math.abs(Math.sin(i * 1.7)) * 90}%`,
              left: `${Math.abs(Math.cos(i * 2.3)) * 90}%`,
              animationDelay: `${i * 0.15}s`,
              animation: "splashDot 1.5s ease-out infinite",
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 text-center select-none">
        <p className="text-[10px] font-bold text-white/80 uppercase tracking-[0.3em] mb-3">
          {isBreak ? "Work done!" : "Break done!"}
        </p>
        <h1 className={`text-7xl font-bold font-hand ${textColor} drop-shadow-lg`}
          style={{ textShadow: "0 4px 20px rgba(0,0,0,0.15)" }}
        >
          {timer.splashLabel === "BREAK TIME" ? "Take a Break!" : "Get to Work!"}
        </h1>
        <div className="mt-8 text-5xl font-bold font-pomo text-white drop-shadow-lg">
          {countdown}
        </div>
        <p className="mt-6 text-xs font-bold text-white/60 uppercase tracking-wider">
          tap to skip
        </p>
      </div>

      <style>{`
        @keyframes splashPulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.4); opacity: 0.2; }
        }
        @keyframes splashDot {
          0% { transform: scale(0); opacity: 1; }
          100% { transform: scale(3); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
