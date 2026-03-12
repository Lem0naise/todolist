import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getForDate = query({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db
      .query("occurrences")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", date))
      .collect();
  },
});

export const setStatus = mutation({
  args: {
    eventId: v.id("timetableEvents"),
    date: v.string(),
    status: v.union(v.literal("pending"), v.literal("done"), v.literal("todo")),
  },
  handler: async (ctx, { eventId, date, status }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check if occurrence already exists
    const existing = await ctx.db
      .query("occurrences")
      .withIndex("by_user_event_date", (q) =>
        q.eq("userId", userId).eq("eventId", eventId).eq("date", date)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status,
        completedAt: status === "done" ? Date.now() : undefined,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("occurrences", {
        userId,
        eventId,
        date,
        status,
        completedAt: status === "done" ? Date.now() : undefined,
      });
    }
  },
});

// Convert a missed occurrence to a todo
export const convertToTodo = mutation({
  args: {
    eventId: v.id("timetableEvents"),
    date: v.string(),
    dueDate: v.optional(v.string()),
    highPriority: v.optional(v.boolean()),
  },
  handler: async (ctx, { eventId, date, dueDate, highPriority }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const event = await ctx.db.get(eventId);
    if (!event || event.userId !== userId) throw new Error("Not found");

    // Upsert the occurrence
    let occurrenceId;
    const existing = await ctx.db
      .query("occurrences")
      .withIndex("by_user_event_date", (q) =>
        q.eq("userId", userId).eq("eventId", eventId).eq("date", date)
      )
      .unique();

    if (existing) {
      occurrenceId = existing._id;
      // If a todo already exists for this occurrence, don't create a duplicate
      if (existing.todoId) {
        await ctx.db.patch(occurrenceId, { status: "todo" });
        return existing.todoId;
      }
    } else {
      occurrenceId = await ctx.db.insert("occurrences", {
        userId,
        eventId,
        date,
        status: "todo",
      });
    }

    // Create todo
    const todoId = await ctx.db.insert("todos", {
      userId,
      title: `${event.title}${event.location ? ` (${event.location})` : ""}`,
      description: event.description,
      dueDate: dueDate ?? date,
      highPriority: highPriority ?? false,
      completed: false,
      sourceOccurrenceId: occurrenceId,
      createdAt: Date.now(),
    });

    // Link back
    await ctx.db.patch(occurrenceId, { status: "todo", todoId });
    return todoId;
  },
});

// Auto-process missed events: find all past unresolved occurrences and create todos
export const processMissedEvents = mutation({
  args: { today: v.string() },
  handler: async (ctx, { today }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get all timetable events for this user
    const events = await ctx.db
      .query("timetableEvents")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // For each event, figure out which past dates it should have occurred on
    // We look back 14 days max to avoid too much processing
    const createdTodos = [];

    for (const event of events) {
      if (event.isRecurring && event.dayOfWeek !== undefined) {
        // Generate dates for the past 14 days where this event should have occurred
        for (let i = 1; i <= 14; i++) {
          // Use T12:00:00 to avoid UTC-midnight parsing shifting the date in local time
          const d = new Date(today + "T12:00:00");
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().split("T")[0];
          // Reparse with midday anchor to get correct local day-of-week
          const localDay = new Date(dateStr + "T12:00:00").getDay();

          if (
            localDay === event.dayOfWeek &&
            event.recurrenceStart !== undefined &&
            event.recurrenceStart <= dateStr &&
            (!event.recurrenceEnd || event.recurrenceEnd >= dateStr)
          ) {
            // Check if occurrence exists
            const existing = await ctx.db
              .query("occurrences")
              .withIndex("by_user_event_date", (q) =>
                q
                  .eq("userId", userId)
                  .eq("eventId", event._id)
                  .eq("date", dateStr)
              )
              .unique();

            if (!existing) {
              // Create todo for this missed event
              const occId = await ctx.db.insert("occurrences", {
                userId,
                eventId: event._id,
                date: dateStr,
                status: "todo",
              });
              const todoId = await ctx.db.insert("todos", {
                userId,
                title: `Missed: ${event.title}`,
                description: event.description,
                dueDate: today, // Due today (catch up)
                highPriority: false,
                completed: false,
                sourceOccurrenceId: occId,
                createdAt: Date.now(),
              });
              await ctx.db.patch(occId, { todoId });
              createdTodos.push(todoId);
            } else if (existing.status === "pending") {
              // Update to todo and create todo entry
              const todoId = await ctx.db.insert("todos", {
                userId,
                title: `Missed: ${event.title}`,
                description: event.description,
                dueDate: today,
                highPriority: false,
                completed: false,
                sourceOccurrenceId: existing._id,
                createdAt: Date.now(),
              });
              await ctx.db.patch(existing._id, { status: "todo", todoId });
              createdTodos.push(todoId);
            }
          }
        }
      }
    }

    return createdTodos.length;
  },
});
