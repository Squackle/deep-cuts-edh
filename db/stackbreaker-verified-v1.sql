-- REVIEW REQUIRED: additive Stackbreaker daily attempts / cosmetic ownership.
-- Run only in the website's D1 after preview auth and replay tests pass.
-- Do not run on Game Lab DB or touch legacy scores.
CREATE TABLE IF NOT EXISTS stackbreaker_daily_attempts_v1(
 profile_id TEXT NOT NULL REFERENCES community_profiles(id) ON DELETE CASCADE,
 utc_date TEXT NOT NULL CHECK(length(utc_date)=10),
 puzzle_id TEXT NOT NULL,
 puzzle_revision INTEGER NOT NULL CHECK(puzzle_revision=1),
 rules_version TEXT NOT NULL,
 scenario_digest TEXT NOT NULL CHECK(length(scenario_digest)=64),
 source_sha TEXT NOT NULL CHECK(length(source_sha)=40),
 moves_json TEXT NOT NULL DEFAULT '[]',
 accepted_moves INTEGER NOT NULL DEFAULT 0 CHECK(accepted_moves BETWEEN 0 AND 140),
 result TEXT NOT NULL DEFAULT 'started' CHECK(result IN('started','won','lost')),
 started_at INTEGER NOT NULL DEFAULT(unixepoch()),
 finished_at INTEGER,
 PRIMARY KEY(profile_id,utc_date)
);
CREATE INDEX IF NOT EXISTS stackbreaker_attempts_completed_v1 ON stackbreaker_daily_attempts_v1(profile_id,result,utc_date);
CREATE TABLE IF NOT EXISTS stackbreaker_verified_awards_v1(
 profile_id TEXT NOT NULL REFERENCES community_profiles(id) ON DELETE CASCADE,
 achievement_id TEXT NOT NULL CHECK(achievement_id IN ('daily-first','seven-dates','monthly-rhythm')),
 awarded_at INTEGER NOT NULL DEFAULT(unixepoch()),
 PRIMARY KEY(profile_id,achievement_id)
);
CREATE TABLE IF NOT EXISTS stackbreaker_equipped_v1(
 profile_id TEXT NOT NULL REFERENCES community_profiles(id) ON DELETE CASCADE,
 slot TEXT NOT NULL CHECK(slot IN ('title','frame','vfx')),
 reward_id TEXT NOT NULL,
 equipped_at INTEGER NOT NULL DEFAULT(unixepoch()),
 PRIMARY KEY(profile_id,slot)
);

-- Default-off database rollout flag. This avoids editing or overwriting existing
-- Cloudflare Pages secrets/environment bindings during a staged launch.
CREATE TABLE IF NOT EXISTS stackbreaker_launch_v1 (
 feature TEXT PRIMARY KEY CHECK(feature='verified-daily'),
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
 updated_at INTEGER NOT NULL DEFAULT(unixepoch())
);
INSERT OR IGNORE INTO stackbreaker_launch_v1(feature,enabled) VALUES('verified-daily',0);
