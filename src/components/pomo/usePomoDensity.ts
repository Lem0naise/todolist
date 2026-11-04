import { useEffect, useState } from "react";

export type PomoDensity = "full" | "compact" | "tiny" | "micro";

/** Width thresholds (CSS px) at which the Pomo timer sheds UI. */
// 360+ is a normal phone / desktop width, so it stays full. A 320px phone is
// the narrowest common viewport, so only windows below that become "micro".
export const POMO_COMPACT_WIDTH = 360;
export const POMO_TINY_WIDTH = 340;
export const POMO_MICRO_WIDTH = 320;

export function densityForWidth(width: number): PomoDensity {
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
