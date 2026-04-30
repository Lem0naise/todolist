import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { matchModuleByTitle } from "./moduleMatcher";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db
      .query("modules")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    patterns: v.array(v.string()),
  },
  handler: async (ctx, { name, patterns }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await ctx.db.insert("modules", { userId, name, patterns });
  },
});

export const update = mutation({
  args: {
    id: v.id("modules"),
    name: v.optional(v.string()),
    patterns: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { id, ...updates }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const mod = await ctx.db.get(id);
    if (!mod || mod.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id("modules") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const mod = await ctx.db.get(id);
    if (!mod || mod.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(id);
  },
});

export const assignEvent = mutation({
  args: {
    eventId: v.id("timetableEvents"),
    moduleId: v.optional(v.id("modules")),
  },
  handler: async (ctx, { eventId, moduleId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const event = await ctx.db.get(eventId);
    if (!event || event.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(eventId, { moduleId });
  },
});

export const autoAssignAll = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    let assigned = 0;

    // Assign events
    const events = await ctx.db
      .query("timetableEvents")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const event of events) {
      const matchedId = await matchModuleByTitle(ctx, userId, event.title);
      if (matchedId && event.moduleId !== matchedId) {
        await ctx.db.patch(event._id, { moduleId: matchedId });
        assigned++;
      }
    }

    // Assign todos: inherit from linked event, or match title directly
    const todos = await ctx.db
      .query("todos")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const todo of todos) {
      // Already has a module, skip
      if (todo.moduleId) continue;
      // Inherit from linked event
      if (todo.linkedEventId) {
        const parentEvent = await ctx.db.get(todo.linkedEventId);
        if (parentEvent?.moduleId) {
          await ctx.db.patch(todo._id, { moduleId: parentEvent.moduleId });
          assigned++;
          continue;
        }
      }
      // Pattern-match todo title directly
      const matchedId = await matchModuleByTitle(ctx, userId, todo.title);
      if (matchedId) {
        await ctx.db.patch(todo._id, { moduleId: matchedId });
        assigned++;
      }
    }

    return { assigned };
  },
});

// Match event title against modules and return the first matching moduleId
export const matchEvent = internalMutation({
  args: {
    userId: v.id("users"),
    title: v.string(),
  },
  handler: async (ctx, { userId, title }) => {
    return await matchModuleByTitle(ctx, userId, title) ?? null;
  },
});
