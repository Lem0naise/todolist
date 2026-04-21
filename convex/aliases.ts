import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db
      .query("subjectAliases")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const add = mutation({
  args: { originalTitle: v.string(), alias: v.string() },
  handler: async (ctx, { originalTitle, alias }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    // Check if an alias for this title already exists
    const existing = await ctx.db
      .query("subjectAliases")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("originalTitle"), originalTitle))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { alias });
      return existing._id;
    }

    return await ctx.db.insert("subjectAliases", {
      userId,
      originalTitle,
      alias,
    });
  },
});

export const remove = mutation({
  args: { id: v.id("subjectAliases") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const alias = await ctx.db.get(id);
    if (!alias || alias.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(id);
  },
});
