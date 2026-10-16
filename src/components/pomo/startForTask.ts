import { startTimer } from "./timerState";
import { loadSettings, type CycleBlock } from "./usePomoData";

export interface StartableTask {
  _id: string;
  title: string;
  moduleName?: string;
}

/**
 * Kick off a single work pomo pre-assigned to a task. PomoView picks the
 * running timer up on mount, so the caller only needs to switch tabs.
 */
export function startPomoForTask(task: StartableTask): void {
  const settings = loadSettings();
  const block: CycleBlock = {
    type: "work",
    duration: settings.work,
    id: Date.now() + Math.floor(Math.random() * 1000000),
    taskId: task._id,
    taskTopic: task.moduleName || task.title,
    taskName: task.title,
  };
  startTimer([block]);
}
