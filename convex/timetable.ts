import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Get all timetable events for the current user
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db
      .query("timetableEvents")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

// Get events that occur on a specific date (combines recurring + one-off)
export const getForDate = query({
  args: { date: v.string(), dayOfWeek: v.number() },
  handler: async (ctx, { date, dayOfWeek }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const allEvents = await ctx.db
      .query("timetableEvents")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const todayEvents = allEvents.filter((event) => {
      if (event.isRecurring) {
        return (
          event.dayOfWeek === dayOfWeek &&
          event.recurrenceStart !== undefined &&
          event.recurrenceStart <= date &&
          (!event.recurrenceEnd || event.recurrenceEnd >= date)
        );
      } else {
        return event.specificDate === date;
      }
    });

    // Sort by start time
    todayEvents.sort((a, b) => a.startTime.localeCompare(b.startTime));

    // Get occurrences for this date
    const occurrences = await ctx.db
      .query("occurrences")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", userId).eq("date", date)
      )
      .collect();

    return todayEvents.map((event) => ({
      ...event,
      occurrence: occurrences.find((o) => o.eventId === event._id) ?? null,
    }));
  },
});

// Get all upcoming preemptive todo'd events (future events marked as todo)
export const getPreemptiveTodos = query({
  args: { today: v.string() },
  handler: async (ctx, { today }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const occurrences = await ctx.db
      .query("occurrences")
      .withIndex("by_user_date", (q) => q.eq("userId", userId))
      .collect();

    const futureTodoOccurrences = occurrences.filter(
      (o) => o.status === "todo" && o.date > today
    );

    const results = [];
    for (const occ of futureTodoOccurrences) {
      const event = await ctx.db.get(occ.eventId);
      if (event) results.push({ ...occ, event });
    }
    return results.sort((a, b) => a.date.localeCompare(b.date));
  },
});

export const create = mutation({
  args: {
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
    color: v.optional(v.string()),
    source: v.union(v.literal("ical"), v.literal("manual")),
    icalFeedId: v.optional(v.id("icalFeeds")),
    icalUid: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await ctx.db.insert("timetableEvents", { ...args, userId });
  },
});

export const remove = mutation({
  args: { id: v.id("timetableEvents") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const event = await ctx.db.get(id);
    if (!event || event.userId !== userId) throw new Error("Not found");
    // Cascade-delete linked occurrences
    const occs = await ctx.db
      .query("occurrences")
      .withIndex("by_event", (q) => q.eq("eventId", id))
      .collect();
    for (const occ of occs) await ctx.db.delete(occ._id);
    await ctx.db.delete(id);
  },
});

export const removeByFeed = mutation({
  args: { feedId: v.id("icalFeeds") },
  handler: async (ctx, { feedId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const events = await ctx.db
      .query("timetableEvents")
      .withIndex("by_feed", (q) => q.eq("icalFeedId", feedId))
      .collect();
    for (const event of events) {
      // Cascade-delete linked occurrences before removing the event
      const occs = await ctx.db
        .query("occurrences")
        .withIndex("by_event", (q) => q.eq("eventId", event._id))
        .collect();
      for (const occ of occs) await ctx.db.delete(occ._id);
      await ctx.db.delete(event._id);
    }
  },
});

// List all ICS feeds
export const listFeeds = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db
      .query("icalFeeds")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const removeFeed = mutation({
  args: { id: v.id("icalFeeds") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const feed = await ctx.db.get(id);
    if (!feed || feed.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(id);
  },
});
