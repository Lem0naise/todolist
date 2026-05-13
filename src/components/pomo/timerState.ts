import { PomoTimer } from "./PomoTimer";
import type { CycleBlock } from "./usePomoData";

let instance: PomoTimer | null = null;

export let lastCompletedInfo: { mins: number; topic: string } = { mins: 0, topic: "" };

export function getTimerInstance(): PomoTimer | null {
  return instance;
}

export function startTimer(blocks: CycleBlock[], topic: string, taskName: string): PomoTimer {
  instance = new PomoTimer();
  instance.initCycleWithBlocks(blocks, topic, taskName);
  return instance;
}

export function stopTimer(): void {
  lastCompletedInfo = {
    mins: instance?.getCompletedWorkMinutes() ?? 0,
    topic: instance?.topic ?? "",
  };
  if (instance) {
    instance.stop();
  }
  instance = null;
}

export function clearTimer(): void {
  instance = null;
}
