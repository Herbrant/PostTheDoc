/** Data access for the users and deliveries tables (schema in ../../migrations). */
import type { Preferences } from "@postthedoc/shared/api";
import { LOCALES } from "@postthedoc/shared/contract";
import { z } from "zod";

/** A JSON array of codes stored in a TEXT column. */
const codeList = z
  .string()
  .transform((text) => JSON.parse(text) as unknown)
  .pipe(z.array(z.string()));

const userRowSchema = z.object({
  id: z.string(),
  email: z.string(),
  status: z.enum(["pending", "active"]),
  locale: z.enum(LOCALES),
  token_version: z.number().int(),
  roles: codeList,
  sectors: codeList,
  regions: codeList,
  institutions: codeList,
  include_unspecified: z.number().transform((flag) => flag === 1),
  last_email_at: z.number().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  confirmed_at: z.string().nullable(),
  privacy_version: z.string().nullable(),
});

const deliveryRowSchema = z.object({ call_id: z.string(), sent_at: z.string() });

/** A user as stored, with the list columns decoded. */
export type UserRow = z.infer<typeof userRowSchema>;
export type DeliveryRow = z.infer<typeof deliveryRowSchema>;

export function toPreferences(user: UserRow): Preferences {
  const { locale, roles, sectors, regions, institutions, include_unspecified } = user;
  return { locale, roles, sectors, regions, institutions, include_unspecified };
}

function preferenceColumns(p: Preferences) {
  return [
    p.locale,
    JSON.stringify(p.roles),
    JSON.stringify(p.sectors),
    JSON.stringify(p.regions),
    JSON.stringify(p.institutions),
    p.include_unspecified ? 1 : 0,
  ] as const;
}

const parseUser = (row: unknown): UserRow | null => (row ? userRowSchema.parse(row) : null);

export function createUserRepository(db: D1Database) {
  return {
    async findById(id: string): Promise<UserRow | null> {
      return parseUser(await db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first());
    },

    async findByEmail(email: string): Promise<UserRow | null> {
      return parseUser(await db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first());
    },

    /** Insert a pending user; null if the address exists already (e.g. a concurrent request). */
    async insertPending(email: string, prefs: Preferences): Promise<UserRow | null> {
      const row = await db
        .prepare(
          `INSERT INTO users (id, email, locale, roles, sectors, regions, institutions,
             include_unspecified)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (email) DO NOTHING
           RETURNING *`,
        )
        .bind(crypto.randomUUID(), email, ...preferenceColumns(prefs))
        .first();
      return parseUser(row);
    },

    async updatePreferences(id: string, prefs: Preferences): Promise<void> {
      await db
        .prepare(
          `UPDATE users SET locale = ?, roles = ?, sectors = ?, regions = ?, institutions = ?,
             include_unspecified = ?, updated_at = datetime('now')
           WHERE id = ?`,
        )
        .bind(...preferenceColumns(prefs), id)
        .run();
    },

    /** Activate the user, recording when they consented and to which privacy notice. */
    async activate(id: string, privacyVersion: string): Promise<void> {
      await db
        .prepare(
          `UPDATE users SET status = 'active', confirmed_at = datetime('now'), privacy_version = ?,
             updated_at = datetime('now')
           WHERE id = ?`,
        )
        .bind(privacyVersion, id)
        .run();
    },

    async delete(id: string): Promise<void> {
      await db.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
    },

    async deliveries(userId: string): Promise<DeliveryRow[]> {
      const { results } = await db
        .prepare("SELECT call_id, sent_at FROM deliveries WHERE user_id = ? ORDER BY sent_at")
        .bind(userId)
        .all();
      return z.array(deliveryRowSchema).parse(results);
    },

    /**
     * Atomically reserve an email to the user: false if another one went out in the last
     * `cooldownSeconds`, so that concurrent requests cannot send more than one.
     */
    async claimEmailSlot(id: string, now: number, cooldownSeconds: number): Promise<boolean> {
      const result = await db
        .prepare(
          `UPDATE users SET last_email_at = ?
           WHERE id = ? AND (last_email_at IS NULL OR last_email_at <= ?)`,
        )
        .bind(now, id, now - cooldownSeconds)
        .run();
      return result.meta.changes === 1;
    },

    /** Undo claimEmailSlot after a failed send, so that the user can retry right away. */
    async releaseEmailSlot(id: string): Promise<void> {
      await db.prepare("UPDATE users SET last_email_at = NULL WHERE id = ?").bind(id).run();
    },
  };
}

export type UserRepository = ReturnType<typeof createUserRepository>;
