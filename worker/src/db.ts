import type { Preferences } from "./validate";

export interface UserRow {
  id: string;
  email: string;
  status: "pending" | "active";
  token_version: number;
  roles: string;
  sectors: string;
  regions: string;
  universities: string;
  include_unspecified: number;
  last_email_at: number | null;
}

export function toPreferences(row: UserRow): Preferences {
  return {
    roles: JSON.parse(row.roles),
    sectors: JSON.parse(row.sectors),
    regions: JSON.parse(row.regions),
    universities: JSON.parse(row.universities),
    include_unspecified: row.include_unspecified === 1,
  };
}

function prefParams(p: Preferences) {
  return [
    JSON.stringify(p.roles),
    JSON.stringify(p.sectors),
    JSON.stringify(p.regions),
    JSON.stringify(p.universities),
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
      `INSERT INTO users (id, email, roles, sectors, regions, universities, include_unspecified)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, email, ...prefParams(p))
    .run();
}

export async function updatePreferences(db: D1Database, id: string, p: Preferences) {
  await db
    .prepare(
      `UPDATE users SET roles = ?, sectors = ?, regions = ?, universities = ?,
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

export async function touchLastEmail(db: D1Database, id: string, now: number) {
  await db.prepare("UPDATE users SET last_email_at = ? WHERE id = ?").bind(now, id).run();
}

export async function deleteUser(db: D1Database, id: string) {
  await db.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
}
