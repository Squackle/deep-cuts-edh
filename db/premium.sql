-- Premium memberships, versioning, and editorial intake.
-- Applied to the Cloudflare D1 DB before the single site deployment.
CREATE TABLE IF NOT EXISTS member_accounts(
 id TEXT PRIMARY KEY,
 stripe_customer TEXT NOT NULL,
 stripe_subscription TEXT NOT NULL UNIQUE,
 checkout_session TEXT NOT NULL UNIQUE,
 tier TEXT NOT NULL CHECK(tier IN ('informant','detective','chief')),
 key_hash TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'active',
 checked_at INTEGER NOT NULL DEFAULT 0,
 last_replacement INTEGER NOT NULL DEFAULT 0,
 last_scan INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS member_devices(
 id TEXT PRIMARY KEY,
 member_id TEXT NOT NULL REFERENCES member_accounts(id),
 token_hash TEXT UNIQUE NOT NULL,
 label TEXT NOT NULL DEFAULT 'My device',
 created_at INTEGER NOT NULL DEFAULT (unixepoch()),
 revoked_at INTEGER
);
CREATE INDEX IF NOT EXISTS member_devices_active ON member_devices(member_id,revoked_at);
CREATE TABLE IF NOT EXISTS member_versions(
 id TEXT PRIMARY KEY,
 member_id TEXT NOT NULL REFERENCES member_accounts(id),
 title TEXT NOT NULL,
 content TEXT NOT NULL,
 created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS member_versions_member ON member_versions(member_id,created_at DESC);
CREATE TABLE IF NOT EXISTS member_requests(
 id TEXT PRIMARY KEY,
 member_id TEXT NOT NULL REFERENCES member_accounts(id),
 category TEXT NOT NULL CHECK(category IN ('showcase','question','consultation','editorial','credit')),
 content TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending',
 staff_reply TEXT NOT NULL DEFAULT '',
 created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS member_requests_member ON member_requests(member_id,created_at DESC);
CREATE TABLE IF NOT EXISTS member_watches(
 member_id TEXT NOT NULL REFERENCES member_accounts(id),
 name TEXT NOT NULL,
 last_seen TEXT NOT NULL DEFAULT '',
 created_at INTEGER NOT NULL DEFAULT (unixepoch()),
 PRIMARY KEY(member_id,name)
);

-- Database-enforced protection against concurrent device activations.
CREATE TRIGGER IF NOT EXISTS member_device_max_two
 BEFORE INSERT ON member_devices
 WHEN (SELECT COUNT(*) FROM member_devices WHERE member_id=NEW.member_id AND revoked_at IS NULL)>=2
 BEGIN SELECT RAISE(ABORT,'two active device limit'); END;
