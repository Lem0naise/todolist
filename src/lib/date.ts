// Local-timezone date helpers.
//
// `toISOString().split("T")[0]` yields a UTC date, which is a day behind local
// time for positive UTC offsets (e.g. BST) around midnight. Timetable data is
// stored as local wall-clock dates, so "today" and week maths must use local
// calendar dates too.

export function formatLocalYmd(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

export function getTodayLocal(): string {
  return formatLocalYmd(new Date());
}

export function addDaysLocal(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return formatLocalYmd(d);
}

// Monday-based start of the local week containing dateStr, as YYYY-MM-DD.
export function startOfWeekLocal(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const dow = d.getDay();
  const daysFromMonday = dow === 0 ? 6 : dow - 1;
  d.setDate(d.getDate() - daysFromMonday);
  return formatLocalYmd(d);
}
