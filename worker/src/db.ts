import type { Locale } from "./i18n";
import type { Preferences } from "./validate";

export interface UserRow {
  id: string;
  email: string;
  status: "pending" | "active";
  locale: Locale;
  token_version: number;
  roles: string;
  sectors: string;
  regions: string;
  institutions: string;
  include_unspecified: number;
  last_email_at: number | null;
}

export function toPreferences(row: UserRow): Preferences {
  return {
    locale: row.locale,
    roles: JSON.parse(row.roles),
    sectors: JSON.parse(row.sectors),
    regions: JSON.parse(row.regions),
    institutions: JSON.parse(row.institutions),
    include_unspecified: row.include_unspecified === 1,
  };
}

function prefParams(p: Preferences) {
  return [
    p.locale,
    JSON.stringify(p.roles),
    JSON.stringify(p.sectors),
    JSON.stringify(p.regions),
    JSON.stringify(p.institutions),
    p.include_unspecified ? 1 : 0,
  ];
}

export function getUserById(db: D1Database, id: string) {
  return db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<UserRow>();
}

export function getUserByEmail(db: D1Database, email: string) {
  return db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first<UserRow>();
}

export async function insertPendingUser(db: D1Database, id: string, email: string, p: Preferences) {
  await db
    .prepare(
      `INSERT INTO users (id, email, locale, roles, sectors, regions, institutions, include_unspecified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, email, ...prefParams(p))
    .run();
}

export async function updatePreferences(db: D1Database, id: string, p: Preferences) {
  await db
    .prepare(
      `UPDATE users SET locale = ?, roles = ?, sectors = ?, regions = ?, institutions = ?,
       include_unspecified = ?, updated_at = datetime('now') WHERE id = ?`,
    )
    .bind(...prefParams(p), id)
    .run();
}

export async function activateUser(db: D1Database, id: string) {
  await db
    .prepare("UPDATE users SET status = 'active', updated_at = datetime('now') WHERE id = ?")
    .bind(id)
    .run();
}

/**
 * Atomically reserve an email to the user: false if another one went out in the last `cooldown`
 * seconds, so that concurrent requests cannot send more than one.
 */
export async function claimEmailSlot(db: D1Database, id: string, now: number, cooldown: number) {
  const result = await db
    .prepare(
      `UPDATE users SET last_email_at = ?
       WHERE id = ? AND (last_email_at IS NULL OR last_email_at <= ?)`,
    )
    .bind(now, id, now - cooldown)
    .run();
  return result.meta.changes === 1;
}

/** Undo claimEmailSlot after a failed send, so that the user can retry right away. */
export async function releaseEmailSlot(db: D1Database, id: string) {
  await db.prepare("UPDATE users SET last_email_at = NULL WHERE id = ?").bind(id).run();
}

export async function deleteUser(db: D1Database, id: string) {
  await db.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
}
