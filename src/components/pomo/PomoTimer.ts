import type { CycleBlock } from "./usePomoData";

export interface TimerPhase {
  type: "work" | "break";
  duration: number;
  label: string;
  taskTopic?: string;
  taskName?: string;
}

export class PomoTimer {
  startTime: Date | null = null;
  endTime: Date | null = null;
  duration = 0;
  phase: TimerPhase | null = null;
  topic = "";
  taskName = "";
  interval: ReturnType<typeof setInterval> | null = null;
  isRunning = false;
  isPaused = false;
  pausedTime: Date | null = null;
  cyclePhases: TimerPhase[] = [];
  currentPhaseIndex = 0;

  initCycleWithBlocks(blocks: CycleBlock[]) {
    this.reset();
    let workCount = 0;
    this.cyclePhases = blocks.map((block) => {
      if (block.type === "work") {
        workCount++;
        return {
          type: "work" as const,
          duration: block.duration,
          label: `Work ${workCount}`,
          taskTopic: block.taskTopic,
          taskName: block.taskName,
        };
      }
      return {
        type: "break" as const,
        duration: block.duration,
        label:
          block.type === "long-break" ? "Long Break" : "Short Break",
      };
    });
    this.startNextPhase();
  }

  initClassic(work: number, shortBreak: number, longBreak: number, topic: string, taskName = "") {
    this.reset();
    this.topic = topic;
    this.taskName = taskName;
    this.cyclePhases = [
      { type: "work", duration: work, label: "Work 1" },
      { type: "break", duration: shortBreak, label: "Short Break" },
      { type: "work", duration: work, label: "Work 2" },
      { type: "break", duration: longBreak, label: "Long Break" },
    ];
    this.startNextPhase();
  }

  private reset() {
    this.startTime = null;
    this.endTime = null;
    this.duration = 0;
    this.phase = null;
    this.topic = "";
    this.taskName = "";
    this.interval = null;
    this.isRunning = false;
    this.isPaused = false;
    this.pausedTime = null;
    this.cyclePhases = [];
    this.currentPhaseIndex = 0;
  }

  private startNextPhase(): boolean {
    if (this.currentPhaseIndex >= this.cyclePhases.length) return false;
    const phase = this.cyclePhases[this.currentPhaseIndex];
    this.phase = phase;
    this.duration = phase.duration;
    this.topic = phase.taskTopic || "";
    this.taskName = phase.taskName || "";
    this.startTime = new Date();
    this.endTime = new Date(
      this.startTime.getTime() + this.duration * 60 * 1000,
    );
    this.isRunning = true;
    this.isPaused = false;
    this.pausedTime = null;
    return true;
  }

  pause() {
    if (!this.isRunning || this.isPaused) return;
    this.isPaused = true;
    this.pausedTime = new Date();
  }

  resume() {
    if (!this.isPaused || !this.pausedTime) return;
    const pauseDuration = new Date().getTime() - this.pausedTime.getTime();
    if (this.endTime) {
      this.endTime = new Date(this.endTime.getTime() + pauseDuration);
    }
    if (this.startTime) {
      this.startTime = new Date(this.startTime.getTime() + pauseDuration);
    }
    this.isPaused = false;
  }

  stop(): number {
    this.isRunning = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (this.startTime) {
      const elapsed = (new Date().getTime() - this.startTime.getTime()) / 1000 / 60;
      return Math.max(1, Math.round(elapsed));
    }
    return 0;
  }

  /** Save elapsed work from current phase, then skip to next */
  skip(): number {
    const elapsed = this.stop();
    this.advancePhase();
    return elapsed;
  }

  getTimeLeft(): number {
    if (!this.isRunning || this.isPaused) {
      if (this.isPaused && this.pausedTime && this.endTime) {
        return Math.max(0, Math.floor((this.endTime.getTime() - this.pausedTime.getTime()) / 1000));
      }
      return 0;
    }
    if (!this.endTime) return 0;
    return Math.max(0, Math.floor((this.endTime.getTime() - new Date().getTime()) / 1000));
  }

  getProgress(): number {
    if (!this.isRunning) return 0;
    const total = this.duration * 60;
    const left = this.getTimeLeft();
    const done = total - left;
    return Math.min(100, Math.round((done / total) * 100 * 10) / 10);
  }

  isComplete(): boolean {
    return this.isRunning && !this.isPaused && this.getTimeLeft() === 0;
  }

  advancePhase(): boolean {
    this.currentPhaseIndex++;
    return this.startNextPhase();
  }

  isCycleComplete(): boolean {
    return this.currentPhaseIndex >= this.cyclePhases.length;
  }

  getCompletedWorkMinutes(): number {
    let total = 0;
    for (let i = 0; i < this.currentPhaseIndex; i++) {
      if (this.cyclePhases[i].type === "work") {
        total += this.cyclePhases[i].duration;
      }
    }
    if (this.phase?.type === "work" && this.isComplete()) {
      total += this.duration;
    }
    return total;
  }

  getScheduleInfo() {
    if (!this.endTime) return { nextPhaseTime: null, cycleEndTime: null, nextPhaseLabel: "" };
    let cycleEnd = new Date(this.endTime);
    for (let i = this.currentPhaseIndex + 1; i < this.cyclePhases.length; i++) {
      cycleEnd = new Date(cycleEnd.getTime() + this.cyclePhases[i].duration * 60 * 1000);
    }
    const nextPhaseLabel =
      this.currentPhaseIndex + 1 < this.cyclePhases.length
        ? this.cyclePhases[this.currentPhaseIndex + 1].label
        : "None";
    return {
      nextPhaseTime: new Date(this.endTime),
      cycleEndTime: cycleEnd,
      nextPhaseLabel,
    };
  }

  /** Update task info on a future phase by index */
  updatePhaseTask(idx: number, taskTopic: string, taskName: string): boolean {
    if (idx <= this.currentPhaseIndex || idx >= this.cyclePhases.length) return false;
    const phase = this.cyclePhases[idx];
    if (phase.type !== "work") return false;
    phase.taskTopic = taskTopic;
    phase.taskName = taskName;
    return true;
  }

  /** Swap two future phases by index */
  swapFuturePhases(a: number, b: number): boolean {
    const min = this.currentPhaseIndex + 1;
    if (a < min || b < min || a >= this.cyclePhases.length || b >= this.cyclePhases.length) return false;
    const temp = this.cyclePhases[a];
    this.cyclePhases[a] = this.cyclePhases[b];
    this.cyclePhases[b] = temp;
    return true;
  }

  /** Update duration of a future phase (clamped to 1 min minimum) */
  updatePhaseDuration(idx: number, newDuration: number): boolean {
    const min = this.currentPhaseIndex + 1;
    if (idx < min || idx >= this.cyclePhases.length) return false;
    this.cyclePhases[idx].duration = Math.max(1, Math.round(newDuration));
    return true;
  }

  /** Skip a future break (advance through it immediately) */
  skipFutureBreak(idx: number): boolean {
    if (idx !== this.currentPhaseIndex || idx >= this.cyclePhases.length) return false;
    if (this.cyclePhases[idx].type !== "break") return false;
    this.currentPhaseIndex++;
    return this.startNextPhase();
  }
}
