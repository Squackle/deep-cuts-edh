# Daily Stackbreaker: first-party integration

Workstream: Website / production gameplay integration.

User authorization: Task 4, make Daily Stackbreaker fully first-party.

Game UI source: `Squackle/deep-cuts-game-lab-` main commit `2125388d2f69170e15cbd22281b0375ef0a15ddd`, generated `stackbreaker/index.html` at blob `47cf59239e11c674e12afd3de17da00e3cec1095`.

Main-site playable snapshot: `games/stackbreaker-play/index.html` (standalone HTML with bundled engine, scenarios, styles and visuals). Changes from Lab snapshot: remove Lab-only presence assets, use site favicon/noindex, enforce exact same-origin event messaging, adjust document title. No gameplay-engine or daily-manifest logic changes.

Main-site shell continues at `/games/stackbreaker`; its same-origin iframe references `/games/stackbreaker-play/?daily=1&siteRanked=1`. Embedded subdocument is noindex and receives *only* same-origin framing permission. The universal anti-framing response headers remain for other routes. The classic unrestricted campaign remains at Game Lab; linking to it is not a runtime dependency for Daily.

**Ranking authority is unchanged:** `functions/api/stackbreaker.js`, D1, `src/stackbreaker-verify/**` and `db/**` were not modified. The server remains pinned to older verified source SHA `9533987e5ec28cdbbbf07175a6cda5813b580d16`; the parent only relays moves and server-owned replay states. This new UI snapshot must **not** alter those pinned rules, accept client-declared wins, grant local scores, or migrate existing attempts.

**Verification/release:** Run the full main repository suite, `tests/stackbreaker-*.test.mjs`, browser smoke tests for desktop/mobile practice, UTC reset, login/guest and completed ranked replay, plus deploy HTTP header inspection. Specifically check `X-Frame-Options: SAMEORIGIN` and `Content-Security-Policy: frame-ancestors 'self'` at the embedded asset, while other public pages remain DENY / none. Confirm Cloudflare production SHA after merging. No D1 migration, score reset or API changes.

**Coordination:** Open PR #96 currently changes two Stackbreaker tests that must be updated to reflect the new first-party source. Do not merge this integration ahead of #96 if release-coordination reports overlap; reconcile/rebase and retest after the older PR is resolved. Rollback by reverting this isolated source/markup/header/test patch; no database rollback required.
