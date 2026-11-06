import type { PomoSession } from "./usePomoData";
import type { Todo } from "../todos/utils";

export interface TaskSpent {
  minutes: number;
  sessions: PomoSession[];
}

/**
 * Aggregate saved work sessions per task. Only sessions explicitly linked to a
 * task count; legacy sessions carry a subject string but no task id, so they
 * are deliberately not attributed.
 */
export function aggregateTaskSpent(
  todos: Todo[] | null | undefined,
  sessions: PomoSession[],
): Map<string, TaskSpent> {
  const todoIds = new Set<string>((todos ?? []).map((todo) => todo._id));
  const spent = new Map<string, TaskSpent>();

  for (const session of sessions) {
    const taskId = session.taskId;
    if (!taskId || !todoIds.has(taskId)) continue;
    if (session.topic === "Break") continue;

    let entry = spent.get(taskId);
    if (!entry) {
      entry = { minutes: 0, sessions: [] };
      spent.set(taskId, entry);
    }
    entry.minutes += session.minutes;
    entry.sessions.push(session);
  }

  for (const entry of spent.values()) {
    entry.sessions.sort((a, b) =>
      `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`),
    );
  }

  return spent;
}
