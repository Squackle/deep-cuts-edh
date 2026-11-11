-- REVIEW REQUIRED: additive GRAFTBOUND Ranked Expedition schema (v1). Run ONLY in the website D1 after preview auth,
-- replay and leaderboard tests pass AND explicit owner approval. Never run against the Game Lab DB. Rollback:
-- db/graftbound-ranked-v1.rollback.sql. Existing tables and data are untouched.
CREATE TABLE IF NOT EXISTS graftbound_challenges_v1 (
 id TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision >= 1), rules_version TEXT NOT NULL, card_pool_version TEXT NOT NULL,
 scoring_version TEXT NOT NULL, build_id TEXT NOT NULL, rules_digest TEXT NOT NULL CHECK(length(rules_digest)=64),
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','retired')), created_at INTEGER NOT NULL DEFAULT (unixepoch()),
 PRIMARY KEY(id, revision)
);
CREATE TABLE IF NOT EXISTS graftbound_attempts_v1 (
 id TEXT PRIMARY KEY CHECK(length(id)=32),
 profile_id TEXT NOT NULL REFERENCES community_profiles(id) ON DELETE CASCADE,
 challenge_id TEXT NOT NULL, challenge_revision INTEGER NOT NULL,
 rules_version TEXT NOT NULL, build_id TEXT NOT NULL, rules_digest TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'started' CHECK(status IN ('started','won','lost','abandoned')),
 accepted_decisions INTEGER NOT NULL DEFAULT 0 CHECK(accepted_decisions BETWEEN 0 AND 4000),
 checkpoint TEXT NOT NULL,                 -- authoritative server-replayed run state (never client-written)
 score INTEGER NOT NULL DEFAULT 0, actions INTEGER NOT NULL DEFAULT 0, damage INTEGER NOT NULL DEFAULT 0, turns INTEGER NOT NULL DEFAULT 0,
 acts_completed INTEGER NOT NULL DEFAULT 0, grafts INTEGER NOT NULL DEFAULT 0, best_stage TEXT NOT NULL DEFAULT 'blank',
 started_at INTEGER NOT NULL DEFAULT (unixepoch()), updated_at INTEGER NOT NULL DEFAULT (unixepoch()), finished_at INTEGER,
 FOREIGN KEY(challenge_id, challenge_revision) REFERENCES graftbound_challenges_v1(id, revision)
);
-- At most ONE open attempt per profile per challenge revision (resume, never parallel rollback branches).
CREATE UNIQUE INDEX IF NOT EXISTS graftbound_attempts_one_open_v1 ON graftbound_attempts_v1(profile_id, challenge_id, challenge_revision) WHERE status='started';
CREATE INDEX IF NOT EXISTS graftbound_attempts_profile_v1 ON graftbound_attempts_v1(profile_id, finished_at DESC);
CREATE TABLE IF NOT EXISTS graftbound_segments_v1 (   -- bounded replay segments (audit trail; seq_start is unique per attempt)
 attempt_id TEXT NOT NULL REFERENCES graftbound_attempts_v1(id) ON DELETE CASCADE,
 seq_start INTEGER NOT NULL, seq_end INTEGER NOT NULL CHECK(seq_end > seq_start AND seq_end - seq_start <= 400),
 decisions TEXT NOT NULL, created_at INTEGER NOT NULL DEFAULT (unixepoch()), PRIMARY KEY(attempt_id, seq_start)
);
CREATE TABLE IF NOT EXISTS graftbound_encounters_v1 (
 attempt_id TEXT NOT NULL REFERENCES graftbound_attempts_v1(id) ON DELETE CASCADE,
 profile_id TEXT NOT NULL REFERENCES community_profiles(id) ON DELETE CASCADE,
 challenge_id TEXT NOT NULL, challenge_revision INTEGER NOT NULL, encounter_key TEXT NOT NULL, act INTEGER NOT NULL, node_type TEXT NOT NULL, name TEXT NOT NULL,
 score INTEGER NOT NULL, actions INTEGER NOT NULL, damage INTEGER NOT NULL, turns INTEGER NOT NULL, par_actions INTEGER NOT NULL, damage_budget INTEGER NOT NULL,
 created_at INTEGER NOT NULL DEFAULT (unixepoch()), PRIMARY KEY(attempt_id, encounter_key)
);
CREATE INDEX IF NOT EXISTS graftbound_encounters_board_v1 ON graftbound_encounters_v1(challenge_id, challenge_revision, encounter_key, score DESC);
CREATE TABLE IF NOT EXISTS graftbound_best_v1 (     -- one public row per profile per challenge revision
 profile_id TEXT NOT NULL REFERENCES community_profiles(id) ON DELETE CASCADE,
 challenge_id TEXT NOT NULL, challenge_revision INTEGER NOT NULL, attempt_id TEXT NOT NULL REFERENCES graftbound_attempts_v1(id) ON DELETE CASCADE,
 score INTEGER NOT NULL, actions INTEGER NOT NULL, damage INTEGER NOT NULL, turns INTEGER NOT NULL, acts_completed INTEGER NOT NULL, completed INTEGER NOT NULL CHECK(completed IN (0,1)),
 verified_at INTEGER NOT NULL,             -- epoch milliseconds (tie-break: earliest verified first)
 PRIMARY KEY(profile_id, challenge_id, challenge_revision)
);
CREATE INDEX IF NOT EXISTS graftbound_best_board_v1 ON graftbound_best_v1(challenge_id, challenge_revision, score DESC, actions ASC, damage ASC, turns ASC, verified_at ASC);
CREATE TABLE IF NOT EXISTS graftbound_awards_v1 (
 profile_id TEXT NOT NULL REFERENCES community_profiles(id) ON DELETE CASCADE,
 achievement_id TEXT NOT NULL CHECK(achievement_id IN ('first-graft','untouched-victory','efficient-hunter','hollow-conqueror','ashen-conqueror','unwritten-end','perfect-expedition','graftbound')),
 attempt_id TEXT NOT NULL, awarded_at INTEGER NOT NULL DEFAULT (unixepoch()), PRIMARY KEY(profile_id, achievement_id)
);
-- Default-OFF launch flag (same pattern as Stackbreaker): no env/secret edits needed for a staged launch.
CREATE TABLE IF NOT EXISTS graftbound_launch_v1 (feature TEXT PRIMARY KEY CHECK(feature='ranked'), enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)), updated_at INTEGER NOT NULL DEFAULT (unixepoch()));
INSERT OR IGNORE INTO graftbound_launch_v1(feature, enabled) VALUES('ranked', 0);
