import { useEffect, useState } from "react";

export type PomoDensity = "full" | "compact" | "tiny" | "micro";

// 360+ is a normal phone / desktop width, so it stays full. Below that the
// timer steps down through compact -> tiny -> micro.
const POMO_COMPACT_WIDTH = 360;
const POMO_TINY_WIDTH = 340;
const POMO_MICRO_WIDTH = 320;

function densityForWidth(width: number): PomoDensity {
  if (width < POMO_MICRO_WIDTH) return "micro";
  if (width < POMO_TINY_WIDTH) return "tiny";
  if (width < POMO_COMPACT_WIDTH) return "compact";
  return "full";
}

/**
 * The Pomo timer's compactness, derived from window width. This is local UI
 * state only; it never touches the timer instance or persisted data.
 */
export function usePomoDensity(): PomoDensity {
  const [density, setDensity] = useState<PomoDensity>(() =>
    typeof window === "undefined" ? "full" : densityForWidth(window.innerWidth),
  );

  useEffect(() => {
    const onChange = () => setDensity(densityForWidth(window.innerWidth));
    window.addEventListener("resize", onChange);
    return () => window.removeEventListener("resize", onChange);
  }, []);

  return density;
}
