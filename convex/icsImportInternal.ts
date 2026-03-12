// Internal mutation that lives in a plain Convex file (NOT "use node")
// so it can be called from the Node.js action in icsImport.ts.
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const storeIcsData = internalMutation({
  args: {
    userId: v.id("users"),
    feedUrl: v.string(),
    feedName: v.string(),
    events: v.array(
      v.object({
        uid: v.string(),
        title: v.string(),
        description: v.optional(v.string()),
        location: v.optional(v.string()),
        startTime: v.string(),
        endTime: v.optional(v.string()),
        isRecurring: v.boolean(),
        dayOfWeek: v.optional(v.number()),
        recurrenceStart: v.optional(v.string()),
        recurrenceEnd: v.optional(v.string()),
        specificDate: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, { userId, feedUrl, feedName, events }) => {
    // Create or update feed record
    const existingFeed = await ctx.db
      .query("icalFeeds")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("url"), feedUrl))
      .unique();

    // Upsert feed record; returns the feedId regardless of which branch ran
    const feedId = await (async () => {
      if (existingFeed) {
        await ctx.db.patch(existingFeed._id, { lastSynced: Date.now() });
        // Remove old events for this feed before re-importing
        const oldEvents = await ctx.db
          .query("timetableEvents")
          .withIndex("by_feed", (q) => q.eq("icalFeedId", existingFeed._id))
          .collect();
        for (const e of oldEvents) await ctx.db.delete(e._id);
        return existingFeed._id;
      } else {
        return await ctx.db.insert("icalFeeds", {
          userId,
          url: feedUrl,
          name: feedName,
          lastSynced: Date.now(),
        });
      }
    })();

    // Insert events
    for (const event of events) {
      await ctx.db.insert("timetableEvents", {
        userId,
        title: event.title,
        description: event.description,
        location: event.location,
        startTime: event.startTime,
        endTime: event.endTime,
        isRecurring: event.isRecurring,
        dayOfWeek: event.dayOfWeek,
        recurrenceStart: event.recurrenceStart,
        recurrenceEnd: event.recurrenceEnd,
        specificDate: event.specificDate,
        source: "ical",
        icalFeedId: feedId,
        icalUid: event.uid,
      });
    }

    return feedId;
  },
});
