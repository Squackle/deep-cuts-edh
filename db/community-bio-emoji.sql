-- Free Field Network: an optional one-emoji accent preceding a profile bio.
-- Existing profiles default to no accent, without touching their saved bio.
ALTER TABLE community_profiles ADD COLUMN bio_emoji TEXT NOT NULL DEFAULT '';
