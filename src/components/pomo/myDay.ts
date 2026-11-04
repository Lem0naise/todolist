import { closestCenter, pointerWithin } from "@dnd-kit/core";
import type { CollisionDetection } from "@dnd-kit/core";
import { isSnoozed, type Todo } from "../todos/utils";

export interface MyDayTask {
  _id: string;
  title: string;
  moduleName?: string;
}

/** The tasks committed to today, mirroring the My Day group in TasksPanel. */
export function selectMyDayTasks(
  todos: Todo[] | null | undefined,
  today: string,
): Todo[] {
  return (todos ?? [])
    .filter((t) => !t.completed && t.focusDate === today && !isSnoozed(t, today))
    .sort((a, b) => (a.focusOrder ?? 0) - (b.focusOrder ?? 0));
}

/** Map a taskId to the work-slot labels ("W1", "W2") it is assigned to. */
export function assignedSlotLabels(
  slots: readonly { type: string; taskId?: string }[],
): Record<string, string[]> {
  const labels: Record<string, string[]> = {};
  let workCount = 0;
  for (const slot of slots) {
    if (slot.type !== "work") continue;
    workCount++;
    if (!slot.taskId) continue;
    (labels[slot.taskId] ??= []).push(`W${workCount}`);
  }
  return labels;
}

/**
 * Drop precisely on the slot under the pointer; keyboard dragging has no
 * pointer coordinates, so fall back to nearest-centre there. Avoids assigning
 * to a slot when a task is dropped on empty space.
 */
export const taskDndCollision: CollisionDetection = (args) =>
  args.pointerCoordinates ? pointerWithin(args) : closestCenter(args);
