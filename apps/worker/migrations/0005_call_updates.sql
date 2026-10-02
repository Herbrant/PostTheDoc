-- Changes to calls already sent (a deadline extended, a call withdrawn...) told to each user, one
-- row per change: changed_at is the run that found it, as in data/seen.json. Kept, pruned and
-- deleted with the user like deliveries.
CREATE TABLE call_updates (
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  call_id TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  PRIMARY KEY (user_id, call_id, changed_at)
);

CREATE INDEX call_updates_call ON call_updates (call_id);
CREATE INDEX call_updates_sent_at ON call_updates (sent_at);
