-- New standalone game tables. Existing Cold Case and Obscurity Ladder records remain untouched.
CREATE TABLE IF NOT EXISTS daily_arcane_puzzles (
 game TEXT NOT NULL CHECK (game IN ('cipher','board')),
 day TEXT NOT NULL CHECK (length(day)=10),
 payload TEXT NOT NULL,
 created_at INTEGER NOT NULL DEFAULT (unixepoch()),
 PRIMARY KEY(game,day)
);
CREATE TABLE IF NOT EXISTS daily_arcane_runs (
 profile_id TEXT NOT NULL REFERENCES community_profiles(id) ON DELETE CASCADE,
 game TEXT NOT NULL CHECK (game IN ('cipher','board')),
 day TEXT NOT NULL CHECK (length(day)=10),
 progress TEXT NOT NULL DEFAULT '[]',
 score INTEGER NOT NULL DEFAULT 0 CHECK(score BETWEEN 0 AND 100),
 won INTEGER NOT NULL DEFAULT 0 CHECK(won IN (0,1)),
 finished_at INTEGER,
 updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
 PRIMARY KEY(profile_id,game,day)
);
CREATE INDEX IF NOT EXISTS daily_arcane_board ON daily_arcane_runs(game,day,score DESC,finished_at ASC);
CREATE TABLE IF NOT EXISTS daily_arcane_badges (
 profile_id TEXT NOT NULL REFERENCES community_profiles(id) ON DELETE CASCADE,
 badge TEXT NOT NULL CHECK (badge IN ('cipher_solved','cipher_perfect','board_solved','board_perfect','arcane_duo')),
 awarded_at INTEGER NOT NULL DEFAULT (unixepoch()),
 PRIMARY KEY(profile_id,badge)
);
CREATE INDEX IF NOT EXISTS daily_arcane_badges_profile ON daily_arcane_badges(profile_id,awarded_at DESC);
