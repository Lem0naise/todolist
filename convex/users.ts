import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/** Profile details for the signed-in user's account page. */
export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;

    const accounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
      .collect();

    return {
      name: user.name ?? null,
      email: user.email ?? null,
      createdAt: user._creationTime,
      providers: accounts.map((account) => account.provider),
    };
  },
});
