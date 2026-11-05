/** Data access for the digests the pipeline recorded (deliveries and call_updates tables). */

export function createDeliveryRepository(db: D1Database) {
  return {
    /** True if a digest was recorded on `day` (YYYY-MM-DD, UTC) or later: sent_at is ISO 8601. */
    async sentSince(day: string): Promise<boolean> {
      const sent = await db
        .prepare(
          `SELECT EXISTS (SELECT 1 FROM deliveries WHERE sent_at >= ?1)
               OR EXISTS (SELECT 1 FROM call_updates WHERE sent_at >= ?1) AS sent`,
        )
        .bind(day)
        .first<number>("sent");
      return sent === 1;
    },
  };
}
