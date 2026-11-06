export function formatDuration(mins: number): string {
  const rounded = Math.round(mins);
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  if (h > 0) {
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }
  return `${m} min`;
}

/** Convert minutes to an approximate number of pomos at the current work length. */
export function minutesToPomos(minutes: number, workMinutes: number): number {
  if (!workMinutes || workMinutes <= 0) return 0;
  return Math.round((minutes / workMinutes) * 10) / 10;
}

export function formatPomos(count: number): string {
  return `${count} ${count === 1 ? "pomo" : "pomos"}`;
}
