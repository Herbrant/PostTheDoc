-- Utenti e preferenze. Le liste sono array JSON di codici (vedi data/reference).
-- La disiscrizione cancella la riga: non si conservano dati di chi se ne va.
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active')),
  token_version INTEGER NOT NULL DEFAULT 0,
  roles TEXT NOT NULL DEFAULT '[]',
  sectors TEXT NOT NULL DEFAULT '[]',
  regions TEXT NOT NULL DEFAULT '[]',
  universities TEXT NOT NULL DEFAULT '[]',
  include_unspecified INTEGER NOT NULL DEFAULT 1,
  last_email_at INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX users_status ON users (status);

-- Bandi già notificati a ciascun utente: rende idempotente il job giornaliero.
CREATE TABLE deliveries (
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  bando_id TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  PRIMARY KEY (user_id, bando_id)
);

CREATE INDEX deliveries_bando ON deliveries (bando_id);
