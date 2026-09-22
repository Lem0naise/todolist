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
