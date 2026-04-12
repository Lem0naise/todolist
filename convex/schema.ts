import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  // ICS feeds imported by the user
  icalFeeds: defineTable({
    userId: v.id("users"),
    url: v.string(),
    name: v.string(),
    lastSynced: v.optional(v.number()),
  }).index("by_user", ["userId"]),

  // Individual timetable events (recurring or one-off)
  timetableEvents: defineTable({
    userId: v.id("users"),
    title: v.string(),
    description: v.optional(v.string()),
    location: v.optional(v.string()),
    startTime: v.string(), // "HH:MM"
    endTime: v.optional(v.string()), // "HH:MM"
    // Recurring events
    isRecurring: v.boolean(),
    dayOfWeek: v.optional(v.number()), // 0=Sun,1=Mon,...,6=Sat
    recurrenceStart: v.optional(v.string()), // ISO date YYYY-MM-DD
    recurrenceEnd: v.optional(v.string()), // ISO date YYYY-MM-DD
    // One-off events
    specificDate: v.optional(v.string()), // ISO date YYYY-MM-DD
    // Metadata
    color: v.optional(v.string()),
    source: v.union(v.literal("ical"), v.literal("manual")),
    icalFeedId: v.optional(v.id("icalFeeds")),
    icalUid: v.optional(v.string()), // for deduplication
  })
    .index("by_user", ["userId"])
    .index("by_feed", ["icalFeedId"]),

  // Per-day occurrence records (created on interaction)
  occurrences: defineTable({
    userId: v.id("users"),
    eventId: v.id("timetableEvents"),
    date: v.string(), // YYYY-MM-DD
    status: v.union(
      v.literal("pending"),
      v.literal("done"),
      v.literal("todo")
    ),
    completedAt: v.optional(v.number()),
    todoId: v.optional(v.id("todos")),
  })
    .index("by_user_date", ["userId", "date"])
    .index("by_event", ["eventId"])
    .index("by_user_event_date", ["userId", "eventId", "date"]),

  // Titles of events to hide and never generate todos for
  ignoredEventTitles: defineTable({
    userId: v.id("users"),
    title: v.string(),
  }).index("by_user", ["userId"]),

  // Todos (manually created or auto-generated from missed events)
  todos: defineTable({
    userId: v.id("users"),
    title: v.string(),
    description: v.optional(v.string()),
    dueDate: v.optional(v.string()), // YYYY-MM-DD
    highPriority: v.boolean(),
    completed: v.boolean(),
    completedAt: v.optional(v.number()),
    sourceOccurrenceId: v.optional(v.id("occurrences")),
    createdAt: v.number(),
    // Category: undefined / "other" treated the same in UI (backwards compat)
    category: v.optional(v.union(
      v.literal("lecture_catchup"),
      v.literal("project"),
      v.literal("other"),
    )),
    // Project sub-tasks
    subTasks: v.optional(v.array(v.object({
      id: v.string(),
      title: v.string(),
      done: v.boolean(),
    }))),
    // Manual progress override (0-100); used when no subTasks or alongside them
    manualProgress: v.optional(v.number()),
    // Link any todo to a specific timetable event (not just catchups)
    linkedEventId: v.optional(v.id("timetableEvents")),
    // Manual sort order within each category (set by drag-to-reorder)
    manualOrder: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_completed", ["userId", "completed"]),

  // Personal daily notes — lightweight scratch pad for "what I want to do today"
  dailyNotes: defineTable({
    userId: v.id("users"),
    date: v.string(),              // YYYY-MM-DD
    text: v.string(),
    targetTime: v.optional(v.string()), // "HH:MM"
    completed: v.boolean(),
    order: v.number(),             // insertion order
    createdAt: v.number(),
  })
    .index("by_user_date", ["userId", "date"]),
});
