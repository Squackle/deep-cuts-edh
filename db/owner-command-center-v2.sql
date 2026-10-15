-- Owner Command Center 2.0: internal editorial workflow, effective feature switches, and owner action audit.
-- Apply to production DB before activating new admin API. No existing rows are changed.
CREATE TABLE IF NOT EXISTS owner_editorial_queue (
  id TEXT PRIMARY KEY,
  commander TEXT NOT NULL CHECK(length(commander) BETWEEN 2 AND 100),
  title TEXT NOT NULL CHECK(length(title) BETWEEN 2 AND 160),
  stage TEXT NOT NULL DEFAULT 'research' CHECK(stage IN ('research','draft','review','ready','published')),
  notes TEXT NOT NULL DEFAULT '' CHECK(length(notes) <= 1200),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS owner_editorial_stage ON owner_editorial_queue(stage,updated_at DESC);

CREATE TABLE IF NOT EXISTS owner_feature_flags (
  flag TEXT PRIMARY KEY CHECK(flag IN ('public_nominations','public_feedback')),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT OR IGNORE INTO owner_feature_flags(flag,enabled) VALUES ('public_nominations',1),('public_feedback',1);

CREATE TABLE IF NOT EXISTS owner_action_audit (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  occurred_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS owner_action_audit_time ON owner_action_audit(occurred_at DESC);
