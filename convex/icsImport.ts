"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

// Simple ICS parser - handles VEVENT blocks with SUMMARY, DTSTART, DTEND,
// DESCRIPTION, LOCATION, RRULE, UID
function parseIcs(text: string): Array<{
  uid: string;
  title: string;
  description?: string;
  location?: string;
  startTime: string; // HH:MM
  endTime?: string;
  isRecurring: boolean;
  dayOfWeek?: number;
  recurrenceStart?: string; // YYYY-MM-DD
  recurrenceEnd?: string;
  specificDate?: string;
}> {
  const events: ReturnType<typeof parseIcs> = [];

  // Unfold lines (RFC 5545 line folding)
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);

  let inEvent = false;
  let current: Record<string, string> = {};

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      current = {};
      continue;
    }
    if (line === "END:VEVENT") {
      inEvent = false;
      if (current.SUMMARY) {
        const event = parseEvent(current);
        if (event) events.push(event);
      }
      continue;
    }
    if (!inEvent) continue;

    // Handle property;param:value format
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const rawKey = line.substring(0, colonIdx).toUpperCase();
    const value = line.substring(colonIdx + 1).trim();

    // Extract base key (before any ;params)
    const baseKey = rawKey.split(";")[0];
    current[baseKey] = value;
    // Also store full key for DTSTART/DTEND with TZID params
    current[rawKey] = value;
  }

  return events;
}

function parseEvent(props: Record<string, string>) {
  const title = decodeIcsText(props["SUMMARY"] || "Untitled");
  const uid = props["UID"] || Math.random().toString(36);
  const description = props["DESCRIPTION"]
    ? decodeIcsText(props["DESCRIPTION"])
    : undefined;
  const location = props["LOCATION"]
    ? decodeIcsText(props["LOCATION"])
    : undefined;

  // Parse DTSTART - could be date-only (YYYYMMDD) or datetime (YYYYMMDDTHHmmssZ)
  const dtstart = props["DTSTART"] || "";
  const dtend = props["DTEND"] || "";
  const rrule = props["RRULE"] || "";

  const startParsed = parseDt(dtstart);
  const endParsed = dtend ? parseDt(dtend) : null;

  if (!startParsed) return null;

  const startTime = startParsed.time ?? "09:00";
  const endTime = endParsed?.time;
  const startDate = startParsed.date;

  if (rrule) {
    // Parse RRULE for weekly recurrence
    const rruleProps: Record<string, string> = {};
    rrule.split(";").forEach((part) => {
      const [k, v] = part.split("=");
      rruleProps[k] = v;
    });

    const freq = rruleProps["FREQ"];
    if (freq === "WEEKLY") {
      // Use T12:00:00 to avoid UTC-midnight parsing shifting day-of-week in local time
      const d = new Date(startDate + "T12:00:00");
      const dayOfWeek = d.getDay();
      let recurrenceEnd: string | undefined;

      if (rruleProps["UNTIL"]) {
        recurrenceEnd = parseDt(rruleProps["UNTIL"])?.date;
      } else if (rruleProps["COUNT"]) {
        // Approximate end: COUNT * 7 days
        const count = parseInt(rruleProps["COUNT"]);
        const endD = new Date(d);
        endD.setDate(endD.getDate() + count * 7);
        recurrenceEnd = endD.toISOString().split("T")[0];
      }

      return {
        uid,
        title,
        description,
        location,
        startTime,
        endTime,
        isRecurring: true,
        dayOfWeek,
        recurrenceStart: startDate,
        recurrenceEnd,
      };
    }
    // For other frequencies, treat as one-off
  }

  return {
    uid,
    title,
    description,
    location,
    startTime,
    endTime,
    isRecurring: false,
    specificDate: startDate,
  };
}

function parseDt(dt: string): { date: string; time?: string } | null {
  if (!dt) return null;
  // Remove VALUE=DATE: prefix if present
  const val = dt.replace(/^VALUE=DATE:/i, "").trim();

  if (val.length === 8) {
    // YYYYMMDD - date only
    const date = `${val.slice(0, 4)}-${val.slice(4, 6)}-${val.slice(6, 8)}`;
    return { date };
  }
  if (val.length >= 15) {
    // YYYYMMDDTHHmmss[Z]
    const dateStr = val.slice(0, 8);
    const date = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
    const h = val.slice(9, 11);
    const m = val.slice(11, 13);
    return { date, time: `${h}:${m}` };
  }
  return null;
}

function decodeIcsText(text: string): string {
  return text
    .replace(/\\n/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

export const importIcsUrl = action({
  args: { url: v.string(), name: v.string() },
  handler: async (ctx, { url, name }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Fetch the ICS file server-side (avoids CORS)
    let text: string;
    try {
      const res = await fetch(url, {
        headers: { Accept: "text/calendar, text/plain, */*" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      text = await res.text();
    } catch (e) {
      throw new Error(`Failed to fetch calendar: ${e}`);
    }

    const parsed = parseIcs(text);
    if (parsed.length === 0) {
      throw new Error("No events found in the calendar file");
    }

    // Store feed and events (mutation lives in icsImportInternal.ts — plain Convex file)
    await ctx.runMutation(internal.icsImportInternal.storeIcsData, {
      userId,
      feedUrl: url,
      feedName: name,
      events: parsed,
    });

    return { count: parsed.length };
  },
});
