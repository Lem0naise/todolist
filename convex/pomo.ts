import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db
      .query("pomoSessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const add = mutation({
  args: {
    date: v.string(),
    time: v.string(),
    minutes: v.number(),
    topic: v.string(),
    taskId: v.optional(v.id("todos")),
    taskName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await ctx.db.insert("pomoSessions", {
      userId,
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: {
    id: v.id("pomoSessions"),
  },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const session = await ctx.db.get(id);
    if (!session || session.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(id);
  },
});

export const clearAll = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const sessions = await ctx.db
      .query("pomoSessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const s of sessions) {
      await ctx.db.delete(s._id);
    }
    return sessions.length;
  },
});

export const fixRounding = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const sessions = await ctx.db
      .query("pomoSessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    let fixed = 0;
    for (const s of sessions) {
      const rounded = Math.round(s.minutes);
      if (s.minutes !== rounded) {
        await ctx.db.patch(s._id, { minutes: rounded });
        fixed++;
      }
    }
    return fixed;
  },
});
