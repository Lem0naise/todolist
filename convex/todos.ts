import { query, mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { matchModuleByTitle } from "./moduleMatcher";

const CATEGORY_VALIDATOR = v.optional(v.union(
  v.literal("lecture_catchup"),
  v.literal("project"),
  v.literal("other"),
));

const SUBTASK_VALIDATOR = v.optional(v.array(v.object({
  id: v.string(),
  title: v.string(),
  done: v.boolean(),
})));

// Clearable variants for bulk edits: null explicitly removes the field.
const CLEARABLE_STRING = v.optional(v.union(v.string(), v.null()));
const CLEARABLE_CATEGORY = v.optional(
  v.union(
    v.literal("lecture_catchup"),
    v.literal("project"),
    v.literal("other"),
    v.null(),
  ),
);

/**
 * Keep a lecture's occurrence in step with its catch-up todo, so completing the
 * todo marks the lecture done on the timetable (and un-completing reverts it to
 * "todo" while the linked todo still exists).
 */
async function syncLinkedOccurrence(
  ctx: MutationCtx,
  sourceOccurrenceId: Id<"occurrences"> | undefined,
  userId: Id<"users">,
  completed: boolean,
) {
  if (!sourceOccurrenceId) return;
  const occ = await ctx.db.get(sourceOccurrenceId);
  if (!occ || occ.userId !== userId) return;
  await ctx.db.patch(sourceOccurrenceId, {
    status: completed ? "done" : "todo",
    completedAt: completed ? Date.now() : undefined,
  });
}

export const list = query({
  args: { includeCompleted: v.optional(v.boolean()) },
  handler: async (ctx, { includeCompleted }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const todos = includeCompleted
      ? await ctx.db
          .query("todos")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect()
      : await ctx.db
          .query("todos")
          .withIndex("by_user_completed", (q) =>
            q.eq("userId", userId).eq("completed", false),
          )
          .collect();

    const filtered = todos;

    // Sort: within each category, manualOrder first, then highPriority, then dueDate, then createdAt
    const sorted = filtered.sort((a, b) => {
      const catA = a.category ?? "other";
      const catB = b.category ?? "other";
      if (catA !== catB) {
        const ORDER = { lecture_catchup: 0, project: 1, other: 2 };
        return ORDER[catA] - ORDER[catB];
      }
      // Within same category: manual order wins
      if (a.manualOrder !== undefined && b.manualOrder !== undefined) {
        return a.manualOrder - b.manualOrder;
      }
      if (a.manualOrder !== undefined) return -1;
      if (b.manualOrder !== undefined) return 1;
      // Fallback: priority → dueDate → createdAt
      if (a.highPriority !== b.highPriority) return a.highPriority ? -1 : 1;
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate && !b.dueDate) return -1;
      if (!a.dueDate && b.dueDate) return 1;
      return a.createdAt - b.createdAt;
    });

    // Batch-fetch all related entities to avoid N+1 queries
    const occurrenceIds = [...new Set(sorted.map(t => t.sourceOccurrenceId).filter(Boolean))];
    const eventIds = [...new Set(sorted.map(t => t.linkedEventId).filter(Boolean))];
    const moduleIds = [...new Set(sorted.map(t => t.moduleId).filter(Boolean))];

    const [occurrences, events, modules] = await Promise.all([
      Promise.all(occurrenceIds.map(id => ctx.db.get(id!))),
      Promise.all(eventIds.map(id => ctx.db.get(id!))),
      Promise.all(moduleIds.map(id => ctx.db.get(id!))),
    ]);

    const occMap = new Map(occurrences.filter(Boolean).map(o => [o!._id, o]));
    const eventMap = new Map(events.filter(Boolean).map(e => [e!._id, e]));
    const modMap = new Map(modules.filter(Boolean).map(m => [m!._id, m]));

    return sorted.map((todo) => ({
      ...todo,
      sourceOccurrenceDate: todo.sourceOccurrenceId ? occMap.get(todo.sourceOccurrenceId)?.date as string | undefined : undefined,
      linkedEventTitle: todo.linkedEventId ? eventMap.get(todo.linkedEventId)?.title as string | undefined : undefined,
      moduleName: todo.moduleId ? modMap.get(todo.moduleId)?.name as string | undefined : undefined,
    }));
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    highPriority: v.boolean(),
    sourceOccurrenceId: v.optional(v.id("occurrences")),
    category: CATEGORY_VALIDATOR,
    subTasks: SUBTASK_VALIDATOR,
    manualProgress: v.optional(v.number()),
    linkedEventId: v.optional(v.id("timetableEvents")),
    moduleId: v.optional(v.id("modules")),
    focusDate: v.optional(v.string()),
    focusOrder: v.optional(v.number()),
    snoozedUntil: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    // Auto-match module if not explicitly provided
    const moduleId = args.moduleId ?? await matchModuleByTitle(ctx, userId, args.title);
    return await ctx.db.insert("todos", {
      ...args,
      moduleId,
      userId,
      completed: false,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("todos"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    highPriority: v.optional(v.boolean()),
    category: CATEGORY_VALIDATOR,
    subTasks: SUBTASK_VALIDATOR,
    manualProgress: v.optional(v.number()),
    linkedEventId: v.optional(v.id("timetableEvents")),
    moduleId: v.optional(v.id("modules")),
    focusDate: v.optional(v.string()),
    focusOrder: v.optional(v.number()),
    snoozedUntil: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...updates }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const todo = await ctx.db.get(id);
    if (!todo || todo.userId !== userId) throw new Error("Not found");
    // If title changed and no explicit moduleId, re-match
    if (updates.title && updates.moduleId === undefined) {
      const newModuleId = await matchModuleByTitle(ctx, userId, updates.title);
      updates.moduleId = newModuleId;
    }
    await ctx.db.patch(id, updates);
  },
});

export const complete = mutation({
  args: { id: v.id("todos"), completed: v.boolean() },
  handler: async (ctx, { id, completed }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const todo = await ctx.db.get(id);
    if (!todo || todo.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(id, {
      completed,
      completedAt: completed ? Date.now() : undefined,
    });
    await syncLinkedOccurrence(ctx, todo.sourceOccurrenceId, userId, completed);
  },
});

export const remove = mutation({
  args: { id: v.id("todos") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const todo = await ctx.db.get(id);
    if (!todo || todo.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(id);
  },
});

/** Toggle a single sub-task done/undone; auto-completes parent if all done */
export const updateSubTasks = mutation({
  args: {
    id: v.id("todos"),
    subTasks: v.array(v.object({ id: v.string(), title: v.string(), done: v.boolean() })),
  },
  handler: async (ctx, { id, subTasks }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const todo = await ctx.db.get(id);
    if (!todo || todo.userId !== userId) throw new Error("Not found");
    const allDone = subTasks.length > 0 && subTasks.every((s) => s.done);
    await ctx.db.patch(id, {
      subTasks,
      completed: allDone,
      completedAt: allDone ? Date.now() : undefined,
    });
    await syncLinkedOccurrence(ctx, todo.sourceOccurrenceId, userId, allDone);
  },
});

/** Update the manual progress value (0-100) on a project todo */
export const updateProgress = mutation({
  args: { id: v.id("todos"), manualProgress: v.number() },
  handler: async (ctx, { id, manualProgress }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const todo = await ctx.db.get(id);
    if (!todo || todo.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(id, { manualProgress });
  },
});

/** Link (or unlink) a todo to a specific timetable event */
export const linkToEvent = mutation({
  args: {
    id: v.id("todos"),
    linkedEventId: v.optional(v.id("timetableEvents")),
  },
  handler: async (ctx, { id, linkedEventId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const todo = await ctx.db.get(id);
    if (!todo || todo.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(id, { linkedEventId });
  },
});

/** Batch-update manualOrder for drag-to-reorder */
export const reorder = mutation({
  args: {
    updates: v.array(v.object({ id: v.id("todos"), manualOrder: v.number() })),
  },
  handler: async (ctx, { updates }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    for (const { id, manualOrder } of updates) {
      const todo = await ctx.db.get(id);
      if (!todo || todo.userId !== userId) continue;
      await ctx.db.patch(id, { manualOrder });
    }
  },
});

/** Add a todo to "My Day" for a date, or remove it (focusDate undefined). */
export const setFocus = mutation({
  args: { id: v.id("todos"), focusDate: v.optional(v.string()) },
  handler: async (ctx, { id, focusDate }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const todo = await ctx.db.get(id);
    if (!todo || todo.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(id, {
      focusDate,
      focusOrder: focusDate ? Date.now() : undefined,
    });
  },
});

/** Batch-update focusOrder for drag-to-reorder within "My Day". */
export const reorderFocus = mutation({
  args: {
    updates: v.array(v.object({ id: v.id("todos"), focusOrder: v.number() })),
  },
  handler: async (ctx, { updates }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    for (const { id, focusOrder } of updates) {
      const todo = await ctx.db.get(id);
      if (!todo || todo.userId !== userId) continue;
      await ctx.db.patch(id, { focusOrder });
    }
  },
});

/** Snooze a todo until a date, or clear the snooze (until undefined). */
export const snooze = mutation({
  args: { id: v.id("todos"), until: v.optional(v.string()) },
  handler: async (ctx, { id, until }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const todo = await ctx.db.get(id);
    if (!todo || todo.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(id, { snoozedUntil: until });
  },
});

/** Apply the same edits to many todos (bulk triage). null clears a field. */
export const bulkUpdate = mutation({
  args: {
    updates: v.array(
      v.object({
        id: v.id("todos"),
        dueDate: CLEARABLE_STRING,
        highPriority: v.optional(v.boolean()),
        category: CLEARABLE_CATEGORY,
        snoozedUntil: CLEARABLE_STRING,
        focusDate: CLEARABLE_STRING,
      }),
    ),
  },
  handler: async (ctx, { updates }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    for (const u of updates) {
      const todo = await ctx.db.get(u.id);
      if (!todo || todo.userId !== userId) continue;
      const patch: Record<string, unknown> = {};
      if (u.dueDate !== undefined) patch.dueDate = u.dueDate ?? undefined;
      if (u.highPriority !== undefined) patch.highPriority = u.highPriority;
      if (u.category !== undefined) patch.category = u.category ?? undefined;
      if (u.snoozedUntil !== undefined) patch.snoozedUntil = u.snoozedUntil ?? undefined;
      if (u.focusDate !== undefined) {
        patch.focusDate = u.focusDate ?? undefined;
        if (u.focusDate === null) patch.focusOrder = undefined;
      }
      if (Object.keys(patch).length > 0) await ctx.db.patch(u.id, patch);
    }
  },
});

/** Delete many todos at once. */
export const bulkRemove = mutation({
  args: { ids: v.array(v.id("todos")) },
  handler: async (ctx, { ids }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    for (const id of ids) {
      const todo = await ctx.db.get(id);
      if (!todo || todo.userId !== userId) continue;
      await ctx.db.delete(id);
    }
  },
});
