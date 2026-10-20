# D1 retention, staging hygiene and index audit — 2026-10-20

**Status: planning and read-only verification only. NO production D1 cleanup, migration, schema rebuild, staging deletion, data export or secret changes authorized by this document.**

## Confirmed configuration

- The `deep-cuts-puzzle-clock` Worker is a separate Cloudflare deployment from Pages. It has exactly two scheduled events (05:15 and 06:15 UTC) and **no D1 binding** in its current Worker settings. `workers/daily-puzzle-clock.js` can improve prewarming but cannot prune the Pages D1 with its current privileges. Do not retrofit a production database binding solely to perform deletion.
- Four D1 resources exist: production community, production Hive leaderboard, and two `deepcuts-security-staging-*` databases. Staging table names/schemas closely match corresponding production databases. **No user rows were inspected**; matching schemas/sizes are not proof of copied emails or Stripe/Ko-fi/payment IDs. Never put row samples or decrypted addresses in issues, logs or ChatGPT.
- Existing application limits: `src/community-social.js` caps comments at **1200** and bios at **240** characters; `functions/api/feedback.js` caps messages at **2000**; `src/community-core.js` enforces at most **250 deck cards/entries** and 42,000-character community POST bodies. These are application validation/truncation checks, not database `CHECK` constraints.
- Profile recovery keys are generated from long random tokens and stored under SHA-256 hashes (see `src/community-core.js` and `src/community-social.js`). A password-strength slow hash is appropriate for user-chosen passwords, not necessary for random 256-bit recovery keys. Never log a raw key or key hash.

## Phase A: owner-approved retention policy BEFORE any deletes

Proposed **candidates** (not automatically committed retention rules):
- Daily limit counters: `community_limits.date_key`, `nomination_limits.date_key`, `feedback_limits.day`, `deck_share_limits.day`, `rules_assist_limits.day`, `member_issuer_limits.day_key`; recommend consider **45 days** to retain some abuse trend visibility, after operator/legal review.
- `community_device_sessions.expires_at` and `community_email_challenges.expires_at`: consider purge only a conservative period **after** expiry, e.g. 30 days for sessions and 14 days for challenges, after recovery flow and incident-response review.
- Hive rate buckets, score sessions, owner/member audit trails, payment events, leaderboards, daily snapshots, verified game history and member device records require **individual retention and incident/compliance evaluation**; never apply blanket 45-day deletions to them.
- Avoid deleting expired sessions that are still relevant for fraud/revocation reviews or incident investigations. Any retention action must be deterministic, repeat-safe and chunked to control D1 write amplification and Worker run limits.

**Runbook before any production change:** (1) confirm Pages Preview and Production D1/HIVE_DB bindings and Staging isolation; (2) acquire versioned restorable backup/time-travel bookmark for each relevant D1 and verify restore procedure; (3) run read-only aggregate `SELECT COUNT(*)` for each cutoff, record only redacted counts; (4) rehearse SQL on a **verified synthetic, isolated** test D1; (5) obtain owner sign-off for exact table list/cutoffs; (6) execute small bounded chunks from a separately authorized maintenance Worker or console; (7) verify row counts and functionality without exposing personal rows. Never add these deletes to the puzzle cron until its bindings and privileges are deliberately reviewed.

A dry-run query template for one counter:
```sql
SELECT COUNT(*) AS eligible_count FROM community_limits
WHERE date_key < date('now','-45 days');
-- PROPOSAL ONLY (DO NOT EXECUTE WITHOUT OWNER DATA RETENTION APPROVAL):
-- DELETE FROM community_limits WHERE date_key < date('now','-45 days');
```

## Phase B: staged database integrity and security verification

Check staging creation method (snapshot restore vs synthetic DDL) from an **audit trail**, not by copying real row values. If provenance is uncertain, quarantine staging access and stop testing against it. Use generated synthetic profiles/tokens/payment references in isolated test databases. Do not delete either staging DB until confirming no active CI, Pages Preview or security testing binds to its UUID, and after an owner-approved disposal/backup decision.

Keep sensitive records encrypted, purpose-limited and permission-checked. Migrating `member_*`, `community_profile_emails`, `kofi_*`, legacy Stripe references and `community_device_sessions` into a dedicated D1 is a **multi-service data migration** with cross-DB transactional limitations. Establish a detailed phased read/write migration, rollback, recovery/paid access verification and no-downtime design before work starts. Do not make this an incidental cron change.

## Phase C: indexes (schema proposal, NOT applied)

Read-only production `EXPLAIN QUERY PLAN` on 2026-10-20:
- `community_votes` queried by `deck_id`: **SCAN community_votes**
- `community_follows` queried by `target_type,target`: **SCAN covering sqlite_autoindex_community_follows_1**
- `community_playtests` queried by `author_id`: **SCAN community_playtests**
- `community_decks` queried by `commander`: **SCAN community_decks**

These are opportunities, not proof of meaningful latency at current table sizes. See `db/maintenance-indexes-proposed.sql` for four optional named indexes. BEFORE applying: obtain permission for a D1 schema change, compare with actual application WHERE/ORDER BY clauses, capture aggregate data volume (not private rows), rehearse on synthetic staging with `EXPLAIN QUERY PLAN`, confirm cost of extra write amplification, back up DB and verify rollout/rollback. This SQL file is **never imported automatically by Pages or cron**.

## Phase D: schema length constraints

SQLite cannot casually add `CHECK(length(existing_column) <= X)` to a populated existing column. Rebuilding tables without carefully preserving foreign keys, triggers, indexes, history and accepted persisted text can destroy user data. Use a separate approved migration with a preflight `SELECT COUNT(*)` by threshold (no rows), explicit legacy-data behavior, and regression tests. Reject too-long new input consistently; don't silently truncate content without telling players. Existing API limits are useful defense in depth until then.

## Other Cloudflare controls

Validate Cloudflare Access for Owner Command Center, native WAF/Turnstile policies for public forms and the existing `_headers` separately. Do not expose allowlists or administrative tokens in source documents. Current `_headers` include framing, base URI, object and HSTS protections, but full script-src/Trusted Types rollout requires report-only migration (see Issue #87).

**Release boundary:** This maintenance review does not itself authorize any production database mutation, remote Worker migration or deletion of staging resources.
