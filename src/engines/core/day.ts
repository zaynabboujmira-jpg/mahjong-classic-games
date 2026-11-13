/** Day number in the player's local calendar, counted from 2026-01-01 (day 1). Used by every daily feature. */
export function dayNumber(date: Date): number {
  const start = Date.UTC(2026, 0, 1);
  const today = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((today - start) / 86_400_000) + 1;
}
