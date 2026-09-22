"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

type IcsProperty = {
  name: string;
  params: Record<string, string>;
  value: string;
};

type ParsedEvent = {
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
};

// ---------------------------------------------------------------------------
// Timezone helpers (no external dependencies)
//
// ICS datetimes come in three flavours:
//   - UTC:      DTSTART:20260922T090000Z
//   - Zoned:    DTSTART;TZID=Europe/London:20260922T100000
//   - Floating: DTSTART:20260922T100000  (wall-clock, no zone)
//   - Date-only: DTSTART;VALUE=DATE:20260922
//
// We resolve each to an absolute instant and then render it in the user's
// local timezone, so the stored "HH:MM" is the wall-clock time the user
// actually experiences. Floating/date-only values are kept as-is.
// ---------------------------------------------------------------------------

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function partsToYmd(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${pad2(month)}-${pad2(day)}`;
}

function getTimeZoneOffsetMs(timeZone: string, instantMs: number): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map: Record<string, number> = {};
  for (const part of fmt.formatToParts(new Date(instantMs))) {
    if (part.type !== "literal") map[part.type] = parseInt(part.value, 10);
  }
  const asUtc = Date.UTC(
    map.year,
    map.month - 1,
    map.day,
    map.hour,
    map.minute,
    map.second,
  );
  return asUtc - instantMs;
}

// Convert a wall-clock time in an IANA timezone to a UTC epoch (ms)
function zonedWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): number {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const offset1 = getTimeZoneOffsetMs(timeZone, guess);
  const candidate = guess - offset1;
  const offset2 = getTimeZoneOffsetMs(timeZone, candidate);
  return offset2 === offset1 ? candidate : guess - offset2;
}

// Format a UTC epoch (ms) as wall-clock date/time in the target IANA timezone
function formatInTimeZone(
  instantMs: number,
  timeZone: string,
): { date: string; time: string } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const part of fmt.formatToParts(new Date(instantMs))) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    time: `${map.hour}:${map.minute}`,
  };
}

type DtValue = {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  utc: boolean;
  dateOnly: boolean;
};

function parseDtValue(raw: string): DtValue | null {
  const val = raw.replace(/^VALUE=DATE:/i, "").trim();

  if (/^\d{8}$/.test(val)) {
    return {
      year: parseInt(val.slice(0, 4), 10),
      month: parseInt(val.slice(4, 6), 10),
      day: parseInt(val.slice(6, 8), 10),
      utc: false,
      dateOnly: true,
    };
  }

  const match = val.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if (!match) return null;

  return {
    year: parseInt(match[1], 10),
    month: parseInt(match[2], 10),
    day: parseInt(match[3], 10),
    hour: parseInt(match[4], 10),
    minute: parseInt(match[5], 10),
    utc: !!match[7],
    dateOnly: false,
  };
}

function resolveToZone(
  value: DtValue,
  tzid: string | undefined,
  targetTz: string,
): { date: string; time?: string } {
  if (value.dateOnly) {
    return { date: partsToYmd(value.year, value.month, value.day) };
  }

  let instant: number | null = null;
  if (value.utc) {
    instant = Date.UTC(
      value.year,
      value.month - 1,
      value.day,
      value.hour!,
      value.minute!,
    );
  } else if (tzid) {
    try {
      instant = zonedWallTimeToUtc(
        value.year,
        value.month,
        value.day,
        value.hour!,
        value.minute!,
        tzid,
      );
    } catch {
      instant = null;
    }
  }

  if (instant === null) {
    // Floating time — no timezone info, keep the literal wall-clock time
    return {
      date: partsToYmd(value.year, value.month, value.day),
      time: `${pad2(value.hour!)}:${pad2(value.minute!)}`,
    };
  }

  try {
    return formatInTimeZone(instant, targetTz);
  } catch {
    return formatInTimeZone(instant, "UTC");
  }
}

// ---------------------------------------------------------------------------
// ICS parsing
// ---------------------------------------------------------------------------

function parseIcs(text: string, targetTz: string): ParsedEvent[] {
  const events: ParsedEvent[] = [];

  // Unfold lines (RFC 5545 line folding)
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);

  let inEvent = false;
  let current: IcsProperty[] = [];

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      current = [];
      continue;
    }
    if (line === "END:VEVENT") {
      inEvent = false;
      if (current.length > 0) {
        const event = parseEvent(current, targetTz);
        if (event) events.push(event);
      }
      continue;
    }
    if (!inEvent) continue;

    // Handle property;param=value:value format
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const left = line.substring(0, colonIdx);
    const value = line.substring(colonIdx + 1).trim();

    const segments = left.split(";");
    const name = segments[0].toUpperCase();
    const params: Record<string, string> = {};
    for (const segment of segments.slice(1)) {
      const eq = segment.indexOf("=");
      if (eq !== -1) params[segment.slice(0, eq).toUpperCase()] = segment.slice(eq + 1);
    }

    current.push({ name, params, value });
  }

  return events;
}

function parseEvent(props: IcsProperty[], targetTz: string): ParsedEvent | null {
  const find = (name: string) => props.find((p) => p.name === name);

  const summary = find("SUMMARY");
  if (!summary) return null;

  const title = decodeIcsText(summary.value || "Untitled");
  const uid = find("UID")?.value || Math.random().toString(36);
  const descriptionProp = find("DESCRIPTION");
  const locationProp = find("LOCATION");
  const description = descriptionProp
    ? decodeIcsText(descriptionProp.value)
    : undefined;
  const location = locationProp ? decodeIcsText(locationProp.value) : undefined;

  const dtstartProp = find("DTSTART");
  const dtendProp = find("DTEND");
  const rruleProp = find("RRULE");
  if (!dtstartProp) return null;

  const startValue = parseDtValue(dtstartProp.value);
  if (!startValue) return null;

  const start = resolveToZone(startValue, dtstartProp.params.TZID, targetTz);

  let end: { date: string; time?: string } | null = null;
  if (dtendProp) {
    const endValue = parseDtValue(dtendProp.value);
    if (endValue) {
      end = resolveToZone(endValue, dtendProp.params.TZID, targetTz);
    }
  }

  const startTime = start.time ?? "09:00";
  const endTime = end?.time;
  const startDate = start.date;

  if (rruleProp) {
    // Parse RRULE for weekly recurrence
    const rruleProps: Record<string, string> = {};
    rruleProp.value.split(";").forEach((part) => {
      const [k, v] = part.split("=");
      rruleProps[k] = v;
    });

    const freq = rruleProps["FREQ"];
    if (freq === "WEEKLY") {
      // Midday anchor avoids DST/day boundary shifts when deriving the weekday
      const d = new Date(startDate + "T12:00:00");
      const dayOfWeek = d.getDay();
      let recurrenceEnd: string | undefined;

      if (rruleProps["UNTIL"]) {
        const untilValue = parseDtValue(rruleProps["UNTIL"]);
        if (untilValue) {
          recurrenceEnd = resolveToZone(untilValue, undefined, targetTz).date;
        }
      } else if (rruleProps["COUNT"]) {
        // Approximate end: COUNT * 7 days
        const count = parseInt(rruleProps["COUNT"], 10);
        const endD = new Date(d);
        endD.setDate(endD.getDate() + count * 7);
        recurrenceEnd = partsToYmd(
          endD.getFullYear(),
          endD.getMonth() + 1,
          endD.getDate(),
        );
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

function decodeIcsText(text: string): string {
  return text
    .replace(/\\n/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

export const importIcsUrl = action({
  args: {
    url: v.string(),
    name: v.string(),
    // IANA timezone of the user, e.g. "Europe/London". Used to convert UTC /
    // TZID datetimes into the wall-clock times the user actually sees.
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, { url, name, timezone }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const targetTz = timezone && timezone.trim() ? timezone : "UTC";

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

    const parsed = parseIcs(text, targetTz);
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
