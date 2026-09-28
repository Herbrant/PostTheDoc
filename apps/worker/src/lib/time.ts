/** Current Unix time, in seconds. */
export const nowSeconds = (): number => Math.floor(Date.now() / 1000);

/** Current UTC day, as YYYY-MM-DD. */
export const today = (): string => new Date().toISOString().slice(0, 10);

/** Hour of the day (0-23) at the instant `ms` in `timeZone`. */
export const hourIn = (timeZone: string, ms: number): number =>
  Number(
    new Intl.DateTimeFormat("en-GB", { timeZone, hour: "numeric", hourCycle: "h23" }).format(ms),
  );
