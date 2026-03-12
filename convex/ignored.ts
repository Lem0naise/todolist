import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db
      .query("ignoredEventTitles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const add = mutation({
  args: { title: v.string() },
  handler: async (ctx, { title }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const trimmed = title.trim();
    if (!trimmed) return;
    // Avoid case-insensitive duplicates
    const existing = await ctx.db
      .query("ignoredEventTitles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    if (existing.some((e) => e.title.toLowerCase() === trimmed.toLowerCase())) return;
    return await ctx.db.insert("ignoredEventTitles", { userId, title: trimmed });
  },
});

export const remove = mutation({
  args: { id: v.id("ignoredEventTitles") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const item = await ctx.db.get(id);
    if (!item || item.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(id);
  },
});
