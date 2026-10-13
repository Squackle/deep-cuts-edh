-- Owner-authorized, email-confirmed recovery when a legacy profile key is lost.
-- Grants cannot themselves sign in, reset a key, or mark an email verified.
-- They only permit a single emailed recovery challenge for an exact mailbox.
CREATE TABLE IF NOT EXISTS community_email_recovery_grants (
  profile_id TEXT PRIMARY KEY REFERENCES community_profiles(id) ON DELETE CASCADE,
  email_fingerprint TEXT NOT NULL UNIQUE,
  approved_reason TEXT NOT NULL DEFAULT 'authenticated_site_owner_and_mailbox',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER
);
CREATE INDEX IF NOT EXISTS community_email_recovery_grants_expiry ON community_email_recovery_grants(expires_at);
