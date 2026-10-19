# Stackbreaker Steps 9–10: website integration and release gate (staged, NOT launched)

**Owner instruction:** "can you deploy the last three steps at once" — October 19, 2026, authorizing investigation and implementation of Steps 8/9/10 in order. This draft PR is the *website-only* promotion lane; Game Lab Step 8 is independently tracked in issue #96. Owner authorization is not a reason to bypass release gates or mutate protected player records before proven replay/auth.

## Exact Game Lab source
Lab source SHA: `9533987e5ec28cdbbbf07175a6cda5813b580d16`.
Classic rules version: `sb-mtg-training-0.3.0`.
Advanced practice rules: `sb-mtg-training-0.4.0-preview` — **not** score-eligible.
The 250 Classic source is copied byte-for-byte into `src/stackbreaker-verify/src/` and immutable manifest/data into `src/stackbreaker-verify/data/`. No Game Lab origin is given write access to the production community DB.

## Server authority
- `src/stackbreaker-verify/server-replay.js`: own server builds Classic 250-case corpus, checks daily UTC pinned manifest entry, computes SHA-256 scenario digest, validates move-by-move under copied original Classic engine. No client-reported wins/badges or FNV hash count as proof.
- **Editorial gate:** existing manifest admits 60 generated scenes awaiting *human editorial approval*. This implementation **will not verify or award** on dates bound to `sg-*` until explicitly reviewed. Client may play those in Lab locally/unverified. Do not retroactively change already assigned UTC dates to fake completeness. Incomplete editorial coverage is a launch blocker for a full 365-day verified program.
- `functions/api/stackbreaker.js`: routes use website's existing `community-core.auth` trusted Community profile session, origin check and per-IP/member quota; D1 owner-scoped attempts keyed (profile_id, utc_date). One qualifying attempt start/day, each legal move committed by optimistic concurrency and replayed server-side; never trust a submitted completed state, screenshot, hint counter or localStorage claim.
- Three **server-issued daily milestones only**: `daily-first`, `seven-dates`, `monthly-rhythm`. These unlock only gold frame, prismatic VFX, daily-adept title in the staging contract. Other 21 local/proposed achievements are **not** represented as owned public badges.
- `profile-stackbreaker.js`: now mounted on `profile.html` to display verified equipment from authenticated GET and owner-scoped equip. It never grants local badges.
- `db/stackbreaker-verified-v1.sql`: proposed additive schema. Migration **not executed**. No existing community, verified Hive Run, daily-game, member, subscription or identity table altered.
- **Fail-closed feature flag**: `STACKBREAKER_VERIFIED_READY==='true'` and DB binding required. Default off. DO NOT set this flag until the migration is approved/applied, independently tested and the full qualifying move-by-move client is integrated.

## REQUIRED BEFORE WEBSITE PRODUCTION MERGE / SWITCH
- [ ] Independent website developer review of full auth, device cookie, CSRF, content versions, D1 SQL and operation rate limits.
- [x] Native `/games/stackbreaker` client added: same-origin per-move POST, server-authoritative return state, resume, unchanged Classic gameplay, unlimited unverified guest practice, separate verified start, no hints/undo in verified mode, accepted move sequence. Arcade game card added. Tested hosted preview mobile and desktop while verified backend intentionally disabled.
- [ ] Resolve human editorial review of 60 generated manifest candidates or publish an explicit, owner-approved gated-calendar experience without silently reassigning dates.
- [ ] Test migration on isolated preview database; backup/rollback, indexes, foreign keys, duplicate requests, multi-device races, stale day, cross-profile rejection, forged badge/equip, tampered step, missing DB binding, no TURNSTILE_SECRET, SSRF/origin failures, leaderboard separation.
- [x] Dedicated Node24 replay and SQLite/API integration checks, site-quality/release coordination/security checks, exact-SHA Cloudflare Pages **successful preview build**. Hosted 390px mobile and 1280px desktop verified **guest practice**; both no overflow, mobile land tap produced white mana; My Profile panel rendered 390px and did not claim false rewards.
- [ ] Authenticated browser end-to-end on deployed staging/production with synthetic test profile, real D1 move, full replay and verified prize, plus cross-account isolation; not yet verified.
- [ ] Reverify latest Lab merged exact SHA and website main SHA, request website-developer approval and only then merge production site PR. Record Cloudflare production deployment exact commit, regression/rollback.
- [ ] Set verified feature flag only AFTER migration and post-deploy secure smoke; never grant scores retroactively based on localStorage.

## Safe rollback
Keep `STACKBREAKER_VERIFIED_READY` off if checks fail. Revert site PR without deleting D1 tables containing user data; if a DB migration was applied, retain unused additive tables for audit unless a separate data-removal approval exists. Do not touch Hive Run verified history or the old retired leaderboard.

**Current classification: preview-tested, release-gated; Steps 9 and 10 remain UNCHECKED until production schema/feature flag, authenticated smoke and exact production SHA are verified.**
