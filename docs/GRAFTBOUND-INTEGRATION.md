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
   - **Done for 1.8.3-beta:** pinned to Game Lab `367c15af26231b0ea707bd5d3e4ca75d78f32bfa` (rules `graftbound-rules-1.8.3-beta`, pool `real-pool-133-v7`, scoring `gb-score-2`, challenge `gb-expedition-01` revision 30, digest `6ddba82f…c51e`). The 47 files come from that commit's `graftbound/tools/integration-manifest.mjs`, saved as `src/graftbound-verify/lab-source-manifest.json`; the PIN test checks every file hash and the digest against it.
   - **Re-pin after any Game Lab rules, card-pool or challenge change** (for example the 12-card pilot, Game Lab #204): run `node tools/integration-manifest.mjs --source-sha=<merged main SHA>` in the Game Lab, copy exactly the listed `src/**` files into `src/graftbound-verify/` (dropping the `src/` prefix, deleting files no longer listed), replace `lab-source-manifest.json`, regenerate `rules-files.mjs`, update `LAB_SOURCE_SHA` and `BUILD_ID`, run `node scripts/graftbound-pin.mjs --write`, re-copy `tests/ranked-bot.mjs` and `src/engine/legal.js` into `tests/helpers/`, and rerun the tests. Records verified under an older revision stay on that revision's leaderboard.
2. **Ranked page: built.** `/games/graftbound` (`games/graftbound.html`, `graftbound.js`, `graftbound.css`) uses the shared site header and Arcade template. It embeds the on-site game at `/games/graftbound-play/?siteRanked=1`: an exact copy of the pinned Game Lab client (`src/**`, `assets/**`, `styles.css`), plus `index.html` (site canonical, noindex, bridge script) and the site-only bridge `site-ranked.js`. The bridge loads the server checkpoint into the game, forwards each engine-accepted decision to the parent, keeps verified runs out of the practice save, and hides the Lab's local "Ranked preview". The parent batches decisions into `segment` calls, resyncs from the server on any rejection, and shows only server-verified totals. `start` on an open attempt now also returns its accepted `decisions` so the game can rebuild its replay log. The page is **noindex and not linked from the Arcade** until launch; at launch, remove the robots meta, add it to `games.html`, the homepage tiles and the sitemap. When re-pinning, re-copy the client too (the client parity test checks the rules files against the manifest).
3. **Run the security review.** That includes a staging deployment with a **real signed-in browser**, Workers CPU timing on full replays, and rate-limit tuning.
4. **Back up D1, then migrate.**
   - Export D1, then `wrangler d1 execute <db> --file db/graftbound-ranked-v1.sql`.
   - Verify `SELECT enabled FROM graftbound_launch_v1` returns `0`.
5. **Enable.** `UPDATE graftbound_launch_v1 SET enabled=1 WHERE feature='ranked';`

**Rollback**
- Fast: set the launch flag to 0. No data is lost.
- Full: run `db/graftbound-ranked-v1.rollback.sql` after exporting the `graftbound_*` tables.
