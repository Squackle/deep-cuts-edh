-- Public credit is explicit opt-in from verified Ko-fi-paying profile owner.
-- No payment/email data or tier stored here; the live tier is derived from renewal.
CREATE TABLE IF NOT EXISTS supporter_ticker_optins (
 profile_id TEXT PRIMARY KEY REFERENCES community_profiles(id) ON DELETE CASCADE,
 display_name TEXT NOT NULL CHECK(length(display_name) BETWEEN 2 AND 36),
 visible INTEGER NOT NULL DEFAULT 0 CHECK(visible IN (0,1)),
 updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_supporter_ticker_visible ON supporter_ticker_optins(visible,updated_at DESC);
