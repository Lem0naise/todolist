import type { ReactNode } from "react";
import { getTodayLocal } from "../../lib/date";
import type { Id } from "../../../convex/_generated/dataModel";

export type Category = "project" | "lecture_catchup" | "other";
export type SubTask = { id: string; title: string; done: boolean };

export type Todo = {
  _id: Id<"todos">;
  title: string;
  description?: string;
  dueDate?: string;
  highPriority: boolean;
  completed: boolean;
  completedAt?: number;
  createdAt: number;
  sourceOccurrenceId?: Id<"occurrences">;
  sourceOccurrenceDate?: string;
  category?: Category;
  subTasks?: SubTask[];
  manualProgress?: number;
  linkedEventId?: Id<"timetableEvents">;
  linkedEventTitle?: string;
  manualOrder?: number;
  moduleId?: Id<"modules">;
  moduleName?: string;
  focusDate?: string;
  focusOrder?: number;
  snoozedUntil?: string;
};

export type Module = {
  _id: Id<"modules">;
  name: string;
  patterns: string[];
  color?: string;
};

export const CATEGORY_ORDER: Category[] = ["project", "other", "lecture_catchup"];

export const CATEGORY_META: Record<Category, {
  label: string;
  color: string;
  border: string;
  bg: string;
  accent: string;
}> = {
  project: {
    label: "Projects",
    color: "text-rose-500",
    border: "border-rose-100",
    bg: "bg-rose-50/40",
    accent: "bg-rose-400",
  },
  lecture_catchup: {
    label: "Catchup",
    color: "text-lavender-500",
    border: "border-lavender-100",
    bg: "bg-lavender-50/40",
    accent: "bg-lavender-400",
  },
  other: {
    label: "Tasks",
    color: "text-stone-500",
    border: "border-stone-100",
    bg: "bg-stone-50/40",
    accent: "bg-stone-400",
  },
};

export function formatShortDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export function formatDue(dateStr: string): {
  text: string;
  overdue: boolean;
  today: boolean;
} {
  const today = getTodayLocal();
  const diff = Math.floor(
    (new Date(dateStr + "T12:00:00").getTime() -
      new Date(today + "T12:00:00").getTime()) /
      86400000,
  );
  const shortDate = formatShortDate(dateStr);

  if (dateStr === today) return { text: "Today", overdue: false, today: true };
  if (diff === 1) return { text: "Tomorrow", overdue: false, today: false };
  if (diff === -1) return { text: "Yesterday", overdue: true, today: false };
  if (diff < 0) {
    return { text: `${Math.abs(diff)}d ago`, overdue: true, today: false };
  }
  if (diff <= 7) return { text: `${diff}d`, overdue: false, today: false };
  return { text: shortDate, overdue: false, today: false };
}

export function renderLinkedText(text: string): ReactNode[] {
  const urlRegex = /((?:https?:\/\/|www\.)\S+)/gi;
  const parts: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(urlRegex)) {
    const rawMatch = match[0];
    const matchIndex = match.index ?? 0;
    const trimmedMatch = rawMatch.replace(/[),.!?]+$/, "");
    const trailingText = rawMatch.slice(trimmedMatch.length);

    if (matchIndex > lastIndex) {
      parts.push(text.slice(lastIndex, matchIndex));
    }

    const href = trimmedMatch.startsWith("www.")
      ? `https://${trimmedMatch}`
      : trimmedMatch;
    parts.push(
      <a
        key={`${trimmedMatch}-${matchIndex}`}
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className="text-rose-500 underline underline-offset-2 hover:text-rose-600"
      >
        {trimmedMatch}
      </a>,
    );

    if (trailingText) parts.push(trailingText);
    lastIndex = matchIndex + rawMatch.length;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length > 0 ? parts : [text];
}

export function computeProgress(todo: Todo): number | null {
  if (todo.category !== "project") return null;
  if (todo.subTasks && todo.subTasks.length > 0) {
    const done = todo.subTasks.filter((s) => s.done).length;
    return Math.round((done / todo.subTasks.length) * 100);
  }
  if (typeof todo.manualProgress === "number") return todo.manualProgress;
  return null;
}

export function effectiveCategory(todo: Todo): Category {
  return todo.category ?? "other";
}

export function isSnoozed(todo: Todo, today: string): boolean {
  return !!todo.snoozedUntil && todo.snoozedUntil > today;
}

export function isFocusToday(todo: Todo, today: string): boolean {
  return todo.focusDate === today;
}

export const SNOOZE_PRESETS: { label: string; days: number }[] = [
  { label: "Tomorrow", days: 1 },
  { label: "In 3 days", days: 3 },
  { label: "Next week", days: 7 },
];

/**
 * Choose the single task most worth doing now: overdue beats due-today beats
 * soon, with priority, catch-up and stalled-project nudges. Snoozed tasks are
 * ignored.
 */
export function pickNextAction(todos: Todo[], today: string): Todo | null {
  const candidates = todos.filter((t) => !t.completed && !isSnoozed(t, today));
  if (candidates.length === 0) return null;

  const score = (t: Todo): number => {
    let s = 0;
    if (t.dueDate) {
      if (t.dueDate < today) s += 100;
      else if (t.dueDate === today) s += 70;
      else {
        const days = Math.round(
          (new Date(t.dueDate + "T12:00:00").getTime() -
            new Date(today + "T12:00:00").getTime()) /
            86400000,
        );
        s += Math.max(0, 40 - days * 4);
      }
    }
    if (t.highPriority) s += 30;
    if (t.category === "lecture_catchup") s += 10;
    const progress = computeProgress(t);
    if (progress !== null && progress > 0 && progress < 100) s += 15;
    return s;
  };

  return [...candidates].sort((a, b) => score(b) - score(a))[0] ?? null;
}

export const DEFAULT_COLORS = [
  "#f4a7b9",
  "#c4b5e3",
  "#98d9c2",
  "#f9ca76",
  "#7ec8e3",
  "#e8a87c",
  "#a7c5eb",
  "#f7cac9",
];

export type SortMode = "manual" | "dueDateAsc" | "dueDateDesc";
export type GroupBy = "category" | "module" | "date" | "none";

export interface FilterState {
  sort: SortMode;
  groupBy: GroupBy;
  moduleFilter: string;
  showCompleted: boolean;
  onlyHighPriority: boolean;
  onlyToday: boolean;
}

export const DEFAULT_FILTER: FilterState = {
  sort: "dueDateDesc",
  groupBy: "category",
  moduleFilter: "all",
  showCompleted: false,
  onlyHighPriority: false,
  onlyToday: false,
};
