/** Current Unix time, in seconds. */
export const nowSeconds = (): number => Math.floor(Date.now() / 1000);

/** Current UTC day, as YYYY-MM-DD. */
export const today = (): string => new Date().toISOString().slice(0, 10);
