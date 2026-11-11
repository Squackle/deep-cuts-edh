# GRAFTBOUND ranked integration (Stage B) — review package, NOT launched

## Scope (additive)

**New files**
- `functions/api/graftbound.js`
- `src/graftbound-verify/**`: a pinned, rules-only copy of the Game Lab engine plus `server-replay.js` and `pinned.js`
- `db/graftbound-ranked-v1.sql` and its `.rollback.sql`
- `profile-graftbound.js`
- `scripts/graftbound-pin.mjs`
- `tests/graftbound-api.test.mjs` and `tests/helpers/d1-sqlite.mjs`

**Changed file**
- `profile.html`: one new section and one script tag. Existing sections are untouched.

## Identity

The API uses `community-core.auth` only:
- the Bearer recovery key from an in-tab session, or
- the HttpOnly `__Host-dc_device` cookie

It never reads a profile id from the request. No new account system, password flow or credential storage is added. The Game Lab is not given credentials and never calls this API.

## API (`/api/graftbound`)

**GET**
- `view=me` (signed in): personal bests, stats, achievements and history
- `view=leaderboard`: top 50 plus your rank
- `view=encounter&key=A:N`: the leaderboard for one encounter
- `view=profile&handle=H`: public records for a profile

**POST** (same-origin only)
- `action=start`: create or resume an attempt; `restart:true` abandons the open one and starts fresh
- `action=segment {attemptId, fromSeq, decisions[≤400]}`
- `action=abandon`

Every POST must also send `rulesVersion` and `buildId`.

**Ranking order:** score desc → actions asc → damage asc → turns asc → earliest verified → attempt id.

**Public fields:** handle, rank, score, actions, damage, turns, acts and challenge. No profile ids, keys, emails or checkpoints are ever returned.

## Launch checklist (each item needs explicit owner approval)

1. **Pin the source.**
   - Set `LAB_SOURCE_SHA` in `src/graftbound-verify/pinned.js` to the tested v0.6 Game Lab commit.
   - Re-copy the rules files from it and run `node scripts/graftbound-pin.mjs --write`. The launch-gate test blocks a placeholder.
2. **Build the ranked page.** It must live on **this** origin, using the mandatory site header and Arcade template. **NOT BUILT YET.** It needs the Game Lab client to send decision segments to this API instead of recording locally.
3. **Run the security review.** That includes a staging deployment with a **real signed-in browser**, Workers CPU timing on full replays, and rate-limit tuning.
4. **Back up D1, then migrate.**
   - Export D1, then `wrangler d1 execute <db> --file db/graftbound-ranked-v1.sql`.
   - Verify `SELECT enabled FROM graftbound_launch_v1` returns `0`.
5. **Enable.** `UPDATE graftbound_launch_v1 SET enabled=1 WHERE feature='ranked';`

**Rollback**
- Fast: set the launch flag to 0. No data is lost.
- Full: run `db/graftbound-ranked-v1.rollback.sql` after exporting the `graftbound_*` tables.
