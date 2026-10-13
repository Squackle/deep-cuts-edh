-- Ko-fi owner-verified membership claim link, October 2026.
-- No plaintext subscriber email, member secret, or customer identity is stored here.
-- Required before manually issuing tier keys, and separate from old Stripe columns.
CREATE TABLE IF NOT EXISTS member_kofi_links(
 member_id TEXT PRIMARY KEY REFERENCES member_accounts(id) ON DELETE CASCADE,
 email_hash TEXT NOT NULL UNIQUE,
 confirmed_by_owner_at INTEGER NOT NULL,
 revoked_at INTEGER,
 created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS member_kofi_links_active ON member_kofi_links(email_hash,revoked_at);
CREATE TABLE IF NOT EXISTS member_issuer_limits(
 day_key TEXT NOT NULL,
 ip_hash TEXT NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(day_key,ip_hash)
);
-- One independent 256-bit operator recovery credential, stored as a SHA-256 digest.
-- The downloadable plaintext operator key is never stored in D1 or GitHub.
CREATE TABLE IF NOT EXISTS member_issuer_credentials(id INTEGER PRIMARY KEY CHECK(id=1), key_hash TEXT NOT NULL, created_at INTEGER NOT NULL DEFAULT(unixepoch()));
