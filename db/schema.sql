-- Deep Cuts EDH · Community nomination voting database
-- This schema has been applied to the Cloudflare D1 database deep-cuts-nominations.
CREATE TABLE IF NOT EXISTS nominations (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 slug TEXT NOT NULL UNIQUE,
 name TEXT NOT NULL,
 rationale TEXT NOT NULL DEFAULT '',
 strategy TEXT NOT NULL DEFAULT '',
 cards TEXT NOT NULL DEFAULT '',
 budget TEXT NOT NULL DEFAULT '$100',
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','featured','retired')),
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS nomination_votes (
 nomination_id INTEGER NOT NULL REFERENCES nominations(id) ON DELETE CASCADE,
 visitor_hash TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 PRIMARY KEY (nomination_id, visitor_hash)
);
CREATE TABLE IF NOT EXISTS nomination_limits (
 ip_hash TEXT NOT NULL,
 date_key TEXT NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY (ip_hash, date_key)
);
CREATE INDEX IF NOT EXISTS nomination_status_idx ON nominations(status, created_at);
CREATE INDEX IF NOT EXISTS nomination_votes_id_idx ON nomination_votes(nomination_id);
