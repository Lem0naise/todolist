import { PomoTimer } from "./PomoTimer";
import type { CycleBlock } from "./usePomoData";

let instance: PomoTimer | null = null;

export function getTimerInstance(): PomoTimer | null {
  return instance;
}

export function startTimer(blocks: CycleBlock[], topic: string, taskName: string): PomoTimer {
  instance = new PomoTimer();
  instance.initCycleWithBlocks(blocks, topic, taskName);
  return instance;
}

export function stopTimer(): void {
  if (instance) {
    instance.stop();
  }
  instance = null;
}

export function clearTimer(): void {
  instance = null;
}
