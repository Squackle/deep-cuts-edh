-- Deep Cuts EDH Field Network: research, private collection, in-app dispatches.
CREATE TABLE IF NOT EXISTS field_evidence(
 id TEXT PRIMARY KEY,
 author_id TEXT NOT NULL REFERENCES community_profiles(id) ON DELETE CASCADE,
 case_slug TEXT NOT NULL CHECK(case_slug IN ('chainer-dementia-master','alena-and-gilanra','commander-mustard','ekthi-contaminator-priest')),
 category TEXT NOT NULL CHECK(category IN ('synergy','combo','budget','weakness','matchup')),
 title TEXT NOT NULL CHECK(length(title) BETWEEN 8 AND 100),
 body TEXT NOT NULL CHECK(length(body) BETWEEN 20 AND 1200),
 card_name TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','featured','hidden')),
 created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS field_evidence_case ON field_evidence(case_slug,status,created_at DESC);
CREATE INDEX IF NOT EXISTS field_evidence_author ON field_evidence(author_id,created_at DESC);
CREATE TABLE IF NOT EXISTS field_evidence_votes(
 evidence_id TEXT NOT NULL REFERENCES field_evidence(id) ON DELETE CASCADE,
 voter_id TEXT NOT NULL REFERENCES community_profiles(id) ON DELETE CASCADE,
 created_at INTEGER NOT NULL DEFAULT (unixepoch()),
 PRIMARY KEY(evidence_id,voter_id)
);
CREATE INDEX IF NOT EXISTS field_evidence_votes_voter ON field_evidence_votes(voter_id);
CREATE TABLE IF NOT EXISTS field_collection(
 profile_id TEXT NOT NULL REFERENCES community_profiles(id) ON DELETE CASCADE,
 name_key TEXT NOT NULL,
 name TEXT NOT NULL,
 quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 999),
 updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
 PRIMARY KEY(profile_id,name_key)
);
CREATE INDEX IF NOT EXISTS field_collection_owner ON field_collection(profile_id,updated_at DESC);
CREATE TABLE IF NOT EXISTS field_dispatches(
 id TEXT PRIMARY KEY,
 recipient_id TEXT NOT NULL REFERENCES community_profiles(id) ON DELETE CASCADE,
 actor_id TEXT REFERENCES community_profiles(id) ON DELETE SET NULL,
 kind TEXT NOT NULL CHECK(kind IN ('mention','deck_reply','case_update','follow','evidence_vote','challenge_vote','featured')),
 headline TEXT NOT NULL,
 target TEXT NOT NULL,
 source_id TEXT NOT NULL,
 created_at INTEGER NOT NULL DEFAULT (unixepoch()),
 read_at INTEGER,
 UNIQUE(recipient_id,kind,source_id)
);
CREATE INDEX IF NOT EXISTS field_dispatches_inbox ON field_dispatches(recipient_id,created_at DESC);
CREATE INDEX IF NOT EXISTS field_dispatches_unread ON field_dispatches(recipient_id,read_at);
