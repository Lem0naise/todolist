import { query, mutation } from "./_generated/server";
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

export const list = query({
  args: { includeCompleted: v.optional(v.boolean()) },
  handler: async (ctx, { includeCompleted }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const todos = await ctx.db
      .query("todos")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const filtered = includeCompleted
      ? todos
      : todos.filter((t) => !t.completed);

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

    // Join: occurrence date + linked event title + module name
    return await Promise.all(
      sorted.map(async (todo) => {
        const sourceOccurrenceDate = todo.sourceOccurrenceId
          ? (await ctx.db.get(todo.sourceOccurrenceId))?.date as string | undefined
          : undefined;
        const linkedEventTitle = todo.linkedEventId
          ? (await ctx.db.get(todo.linkedEventId))?.title as string | undefined
          : undefined;
        const moduleName = todo.moduleId
          ? (await ctx.db.get(todo.moduleId))?.name as string | undefined
          : undefined;
        return { ...todo, sourceOccurrenceDate, linkedEventTitle, moduleName };
      })
    );
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
