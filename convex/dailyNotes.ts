import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const notes = await ctx.db
      .query("dailyNotes")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", date))
      .collect();
    return notes.sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
  },
});

export const add = mutation({
  args: {
    date: v.string(),
    text: v.string(),
    targetTime: v.optional(v.string()),
  },
  handler: async (ctx, { date, text, targetTime }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Determine next order (one more than the max existing)
    const existing = await ctx.db
      .query("dailyNotes")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", date))
      .collect();
    const maxOrder = existing.reduce((m, n) => Math.max(m, n.order), -1);

    return await ctx.db.insert("dailyNotes", {
      userId,
      date,
      text,
      targetTime,
      completed: false,
      order: maxOrder + 1,
      createdAt: Date.now(),
    });
  },
});

export const toggle = mutation({
  args: { id: v.id("dailyNotes") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const note = await ctx.db.get(id);
    if (!note || note.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(id, { completed: !note.completed });
  },
});

export const remove = mutation({
  args: { id: v.id("dailyNotes") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const note = await ctx.db.get(id);
    if (!note || note.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(id);
  },
});

export const updateText = mutation({
  args: {
    id: v.id("dailyNotes"),
    text: v.string(),
    targetTime: v.optional(v.string()),
  },
  handler: async (ctx, { id, text, targetTime }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const note = await ctx.db.get(id);
    if (!note || note.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(id, { text, targetTime });
  },
});
