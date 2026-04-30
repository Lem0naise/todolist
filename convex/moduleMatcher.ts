import type { Id } from "./_generated/dataModel";

export async function matchModuleByTitle(
  ctx: any,
  userId: Id<"users">,
  title: string
): Promise<Id<"modules"> | undefined> {
  const modules = await ctx.db
    .query("modules")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();
  for (const mod of modules) {
    for (const pattern of mod.patterns) {
      try {
        if (new RegExp(pattern, "i").test(title)) {
          return mod._id;
        }
      } catch {
        // Skip invalid regex
      }
    }
  }
  return undefined;
}
