/** Data access for the email_quota table: emails sent by the Worker per UTC day. */

export function createQuotaRepository(db: D1Database) {
  return {
    /** True if `limit` emails went out on `day` (YYYY-MM-DD) already. */
    async exhausted(day: string, limit: number): Promise<boolean> {
      const sent = await db
        .prepare("SELECT sent FROM email_quota WHERE day = ?")
        .bind(day)
        .first<number>("sent");
      return (sent ?? 0) >= limit;
    },

    /** Atomically count one more email on `day`: false if `limit` was reached already. */
    async claim(day: string, limit: number): Promise<boolean> {
      const [, claimed] = await db.batch([
        db.prepare("DELETE FROM email_quota WHERE day < ?").bind(day),
        db
          .prepare(
            `INSERT INTO email_quota (day, sent) VALUES (?, 1)
             ON CONFLICT (day) DO UPDATE SET sent = sent + 1 WHERE sent < ?
             RETURNING sent`,
          )
          .bind(day, limit),
      ]);
      return (claimed?.results.length ?? 0) > 0;
    },

    /** Undo claim after a failed send. */
    async release(day: string): Promise<void> {
      await db
        .prepare("UPDATE email_quota SET sent = max(sent - 1, 0) WHERE day = ?")
        .bind(day)
        .run();
    },
  };
}

export type QuotaRepository = ReturnType<typeof createQuotaRepository>;
