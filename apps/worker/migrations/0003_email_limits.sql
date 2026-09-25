-- Confirmation emails sent to a pending address: capped, so that nobody can keep mailing someone
-- else's address. Unconfirmed rows are purged by the daily job a few days after created_at.
ALTER TABLE users ADD COLUMN confirmations_sent INTEGER NOT NULL DEFAULT 0;

-- Emails sent by the Worker per UTC day: its share of the provider's daily quota, which the daily
-- digests need too.
CREATE TABLE email_quota (
  day TEXT PRIMARY KEY,
  sent INTEGER NOT NULL
);
