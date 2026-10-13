-- Independently generated daily puzzles; Cloudflare D1 freezes the answer
-- for every UTC-offset-aware Central calendar day. No ChatGPT scheduler required.
CREATE TABLE IF NOT EXISTS game_auto_catalog(
 id INTEGER PRIMARY KEY CHECK(id=1),
 payload TEXT NOT NULL DEFAULT '[]',
 updated_at INTEGER NOT NULL DEFAULT 0,
 refresh_attempt_at INTEGER NOT NULL DEFAULT 0,
 source TEXT NOT NULL DEFAULT 'scryfall-edhrec-card-rank'
);
INSERT OR IGNORE INTO game_auto_catalog(id) VALUES(1);
CREATE TABLE IF NOT EXISTS game_auto_puzzles(
 game TEXT NOT NULL CHECK(game IN ('cold','ladder')),
 day TEXT NOT NULL,
 payload TEXT NOT NULL,
 source TEXT NOT NULL,
 created_at INTEGER NOT NULL DEFAULT (unixepoch()),
 PRIMARY KEY(game,day)
);
CREATE INDEX IF NOT EXISTS game_auto_puzzles_created_at ON game_auto_puzzles(created_at);
