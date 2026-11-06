export function formatDuration(mins: number): string {
  const rounded = Math.round(mins);
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  if (h > 0) {
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }
  return `${m} min`;
}
