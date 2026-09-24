-- Users and their preferences. Lists are JSON arrays of codes (see data/reference).
-- Unsubscribing deletes the row: no data is kept about people who leave.
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active')),
  locale TEXT NOT NULL DEFAULT 'it' CHECK (locale IN ('it', 'en')),
  token_version INTEGER NOT NULL DEFAULT 0,
  roles TEXT NOT NULL DEFAULT '[]',
  sectors TEXT NOT NULL DEFAULT '[]',
  regions TEXT NOT NULL DEFAULT '[]',
  institutions TEXT NOT NULL DEFAULT '[]',
  include_unspecified INTEGER NOT NULL DEFAULT 1,
  last_email_at INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX users_status ON users (status);

-- Calls already notified to each user: makes the daily job idempotent.
CREATE TABLE deliveries (
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  call_id TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  PRIMARY KEY (user_id, call_id)
);

CREATE INDEX deliveries_call ON deliveries (call_id);
