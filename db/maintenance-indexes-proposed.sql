-- Deep Cuts EDH optional indexing proposal, 2026-10-20
-- REVIEW ONLY. Not imported or run automatically. Requires separate owner
-- authorization for any production schema change and verified D1 backup.
-- Four unindexed lookup patterns observed via read-only EXPLAIN QUERY PLAN.
-- Evaluate query speed and INSERT/UPDATE/DELETE cost on synthetic staging first.
CREATE INDEX IF NOT EXISTS community_votes_deck_lookup
 ON community_votes(deck_id, challenge_id);
CREATE INDEX IF NOT EXISTS community_follows_target_lookup
 ON community_follows(target_type, target);
CREATE INDEX IF NOT EXISTS community_playtests_author_lookup
 ON community_playtests(author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS community_decks_commander_lookup
 ON community_decks(commander);
-- Rollback plan (DO NOT RUN blindly):
-- DROP INDEX IF EXISTS community_votes_deck_lookup;
-- DROP INDEX IF EXISTS community_follows_target_lookup;
-- DROP INDEX IF EXISTS community_playtests_author_lookup;
-- DROP INDEX IF EXISTS community_decks_commander_lookup;
