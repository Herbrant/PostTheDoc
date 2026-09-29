// Deadlines counted on the Italian calendar, where the calls are published.
const day = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Rome",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const DAY_MS = 86_400_000;

/** Calendar days from `now` to `deadline` in Italy: 0 on the last day, negative once past. */
export function daysLeft(deadline: Date, now: Date): number {
  const date = (d: Date) => Date.parse(`${day.format(d)}T00:00:00Z`);
  return Math.round((date(deadline) - date(now)) / DAY_MS);
}
