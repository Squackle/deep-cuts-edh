-- Field Network portrait closeups and securely remembered devices.
-- Run once in production before deploying the updated community code.
ALTER TABLE community_profiles ADD COLUMN focus_zoom REAL NOT NULL DEFAULT 2.8;
CREATE TABLE IF NOT EXISTS community_device_sessions (
 token_hash TEXT PRIMARY KEY,
 profile_id TEXT NOT NULL REFERENCES community_profiles(id) ON DELETE CASCADE,
 created_at INTEGER NOT NULL DEFAULT (unixepoch()),
 expires_at INTEGER NOT NULL,
 last_seen_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS community_device_sessions_owner ON community_device_sessions(profile_id,expires_at);
CREATE INDEX IF NOT EXISTS community_device_sessions_expiration ON community_device_sessions(expires_at);
