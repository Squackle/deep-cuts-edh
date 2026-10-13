-- Deep Cuts: complimentary memberships + recovery email, October 2026.
-- Idempotent statements, except for PRAGMA and ALTER TABLE; apply only once.
CREATE TABLE IF NOT EXISTS member_complimentary_grants(
 member_id TEXT PRIMARY KEY REFERENCES member_accounts(id) ON DELETE CASCADE,
 tier TEXT NOT NULL CHECK(tier IN ('informant','detective','chief')),
 label TEXT NOT NULL CHECK(length(label) BETWEEN 1 AND 72),
 expires_at INTEGER NOT NULL,
 revoked_at INTEGER,
 created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE INDEX IF NOT EXISTS member_complimentary_expires ON member_complimentary_grants(expires_at,revoked_at);
CREATE TABLE IF NOT EXISTS member_grant_audit(
 id TEXT PRIMARY KEY,
 member_id TEXT NOT NULL,
 action TEXT NOT NULL CHECK(action IN ('issued','rotated','extended','revoked')),
 tier TEXT NOT NULL,
 event_time INTEGER NOT NULL DEFAULT(unixepoch()),
 detail TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS member_grant_audit_recent ON member_grant_audit(event_time DESC);
ALTER TABLE member_devices ADD COLUMN last_seen_at INTEGER NOT NULL DEFAULT 0;

-- Never store a plaintext address. Emails are AES-GCM encrypted under a server-only
-- secret-derived key, and SHA-256 HMAC indexed under a separate purpose.
CREATE TABLE IF NOT EXISTS community_profile_emails(
 profile_id TEXT PRIMARY KEY REFERENCES community_profiles(id) ON DELETE CASCADE,
 email_hash TEXT NOT NULL UNIQUE,
 email_cipher TEXT NOT NULL,
 verified_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS community_email_challenges(
 id TEXT PRIMARY KEY,
 profile_id TEXT NOT NULL REFERENCES community_profiles(id) ON DELETE CASCADE,
 purpose TEXT NOT NULL CHECK(purpose IN ('verify','recover')),
 email_hash TEXT NOT NULL,
 email_cipher TEXT,
 code_hash TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 used_at INTEGER,
 attempts INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE INDEX IF NOT EXISTS community_email_pending ON community_email_challenges(profile_id,purpose,expires_at);
CREATE INDEX IF NOT EXISTS community_email_expiry ON community_email_challenges(expires_at);
