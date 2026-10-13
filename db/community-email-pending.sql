-- Staged, encrypted recovery-contact suggestion, NOT sufficient to reset a profile.
-- Normal verified email flow must still be completed before profile recovery works.
CREATE TABLE IF NOT EXISTS community_pending_recovery_contacts (
 profile_id TEXT PRIMARY KEY REFERENCES community_profiles(id) ON DELETE CASCADE,
 email_hash TEXT NOT NULL UNIQUE,
 email_cipher TEXT NOT NULL,
 email_mask TEXT NOT NULL,
 source TEXT NOT NULL CHECK(source IN ('connected_gmail_oauth')),
 added_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS community_pending_recovery_added ON community_pending_recovery_contacts(added_at);
