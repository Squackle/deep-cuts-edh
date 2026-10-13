-- Once-only additive avatar focal-point coordinates, October 13 2026.
-- Existing profiles are initialized to the center/head region.
ALTER TABLE community_profiles ADD COLUMN focus_x INTEGER NOT NULL DEFAULT 50 CHECK(focus_x BETWEEN 0 AND 100);
ALTER TABLE community_profiles ADD COLUMN focus_y INTEGER NOT NULL DEFAULT 30 CHECK(focus_y BETWEEN 0 AND 100);
