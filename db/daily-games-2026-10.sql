-- Daily games: private authenticated results, verified one-time daily attempts,
-- profile achievements, and public community-facing scores. Anon local progress
-- is kept in the browser only; practice rounds never grant achievements.
CREATE TABLE IF NOT EXISTS daily_game_runs (
 profile_id TEXT NOT NULL REFERENCES community_profiles(id) ON DELETE CASCADE,
 game TEXT NOT NULL CHECK(game IN ('cold','ladder')),
 day TEXT NOT NULL CHECK(length(day)=10),
 guesses TEXT NOT NULL DEFAULT '[]',
 score INTEGER NOT NULL DEFAULT 0 CHECK(score BETWEEN 0 AND 600),
 won INTEGER NOT NULL DEFAULT 0 CHECK(won IN (0,1)),
 finished_at INTEGER,
 created_at INTEGER NOT NULL DEFAULT (unixepoch()),
 PRIMARY KEY(profile_id,game,day)
);
CREATE INDEX IF NOT EXISTS daily_game_runs_board ON daily_game_runs(game,day,score DESC,finished_at ASC);
CREATE INDEX IF NOT EXISTS daily_game_runs_profile ON daily_game_runs(profile_id,day DESC);
CREATE TABLE IF NOT EXISTS daily_game_achievements(
 profile_id TEXT NOT NULL REFERENCES community_profiles(id) ON DELETE CASCADE,
 badge TEXT NOT NULL CHECK(badge IN ('case_closer','first_clue','three_day_streak','case_archivist','ladder_climber','perfect_ladder','ladder_veteran','double_agent')),
 awarded_at INTEGER NOT NULL DEFAULT (unixepoch()),
 PRIMARY KEY(profile_id,badge)
);
CREATE INDEX IF NOT EXISTS daily_game_achievements_profile ON daily_game_achievements(profile_id,awarded_at DESC);
