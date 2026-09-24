-- Proof of consent (GDPR Art. 7.1): when the subscription was confirmed and which version of the
-- privacy notice was in force. NULL for users confirmed before this migration.
ALTER TABLE users ADD COLUMN confirmed_at TEXT;
ALTER TABLE users ADD COLUMN privacy_version TEXT;
