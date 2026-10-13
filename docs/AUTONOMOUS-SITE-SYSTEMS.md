# Deep Cuts EDH — Autonomous Site Systems and Daily Puzzle Rotation
Updated: 2026-10-13

## Operational overview

Daily puzzles, source refreshes, achievements, profiles, notifications, community voting, and incoming webhooks run through the website and its Cloudflare services. Some actions run on schedules, while others are triggered by visitors or third-party events.

## Daily puzzle automation

- **00:00 America/Chicago:** The active calendar day changes automatically, including daylight-saving time. The first GET request or the scheduled prewarmer creates that day's new puzzles.
- **00:15 America/Chicago:** A dedicated Cloudflare Worker Cron Trigger `deep-cuts-puzzle-clock` prewarms both games. Two cron expressions (`15 5 * * *`, `15 6 * * *`) cover Central Daylight and Central Standard Time; one run each day will fall before midnight or after 1 AM, but both are safe and idempotent.
- **No job dependency:** If Cloudflare delays the cron or it is disabled, the first game request generates the missing daily puzzles automatically. Once created, each daily puzzle is saved in D1 and never changes during the day.
- **Source refresh:** Approximately once per seven days, the site checks Scryfall's documented card-search API for a compact, Commander-legal paper-card pool. The refresh uses a short-lived D1 lease to avoid stampedes and six spaced requests total, caches the source in D1, and retries after a failure. The refresh does not require a separate release.
- **New Cold Case content:** On and after October 14, 2026, the game selects commanders from this automatically refreshed pool (at least 110 distinct qualified names). Clues are generated using card metadata, legal color identity, printed year, mechanical text, and type line. Recent selections are excluded for up to 90 days where enough candidates are available. The curated original 30-puzzle dataset is retained as a source-outage fallback and for practice rounds.
- **New Obscurity Ladder content:** Each day selects five legendary cards from five distinct bands of Scryfall EDHREC card-popularity rankings, and freezes the exact source ranks and correct solution in D1. **EDHREC card usage is not the number of decks led by a commander**. The game labels this distinction on its page, before submission, and in the results, and retains the original October 13 deck-count snapshot only for that date and curated practice.
- **Source disruptions:** If Scryfall is unavailable, an older cached pool is used; if no valid pool has ever been cached, the original curated puzzles are selected. A dated puzzle still exists and players never see half-updated scores. Retrying Scryfall does not alter any already published day.
- **Profiles and achievements:** Per-day D1 runs, anti-repeat checks and achievements execute in response to gameplay, without scheduling. Practice never awards trophies.
- **Operational status:** The read-only endpoint `/api/daily-games?action=automation_status` reports the source-refresh date and generated daily puzzles without exposing credentials or unrevealed answers.

## Other automatic site systems

| System | Operating mode |
| --- | --- |
| Card Library search and prices | Live Scryfall queries whenever visitors search |
| Deck Workshop analysis and saved decks | Browser tools and Cloudflare database actions |
| Community profiles and remembered devices | Authenticated requests; session expiry checked on use |
| Field Dispatch notifications | Created when qualifying community activity occurs |
| Evidence boards and endorsements | Submitted and moderated through the site |
| Investigator rankings and achievements | Calculated or awarded from qualifying activity |
| Email verification and key recovery | Requested on demand; codes expire automatically |
| Nomination voting | Votes counted by the site; nomination approval remains editorial |
| Ko-fi webhook processing | Triggered by signed provider events when configured |
| Legacy Stripe enrollment | Retired and should remain inactive |
| Premium membership key issuance | Intentionally gated pending verified payment setup |
| Official Commander Rescue Reports | Published after human research and editorial review |

"Automatic" doesn't mean every process is a scheduled job. Most systems are **event-driven**, which is the correct way to execute them: a user saves a deck, a payment webhook arrives, or a recovery code is requested. Those event-driven workflows run when the relevant request or event occurs.

## Cloudflare implementation

- Production D1 binding `DB`, repository `Squackle/deep-cuts-edh`.
- Migration `db/automated-daily-puzzles.sql` adds `game_auto_catalog` (cached validated pool and refresh lease) and `game_auto_puzzles` (immutable per-date results).
- Generator `src/automated-games.js`, integrated into `functions/api/daily-games.js`.
- Worker script `workers/daily-puzzle-clock.js`; deploy as Worker named `deep-cuts-puzzle-clock` with Cron Triggers `15 5 * * *` and `15 6 * * *`. No D1 credentials, API keys, or tokens are stored in the Worker; it invokes two public, no-cache puzzle endpoints.
- Dates reset at midnight **America/Chicago**, not midnight UTC. Cron expressions are UTC and deliberately cover both standard and daylight time.
- If the Worker scheduler is unavailable, lazy creation and caching remain operational as soon as someone opens either game.
- HTTPS Scryfall queries should use a descriptive User-Agent and Accept JSON, six spaced requests for a weekly refresh; never scrape undocumented EDHREC JSON endpoints for production automation.

## Checks to run after deployment

1. Verify GitHub `main` commit, Cloudflare Pages successful deployment, and separate Worker script/schedules (if scheduled Worker deployment was authorized).
2. GET `/api/daily-games?action=automation_status`; verify that `automatic: true` and the catalog timestamps reflect any source refresh.
3. Get both daily states twice; day/answers/ranks must match and new puzzle database rows must be immutable. Verify game state doesn't leak the answer before completion.
4. Request valid practice rounds. These must remain playable offline from Scryfall (artwork may fail) and grant no achievements.
5. Check mobile Cold Case choices, ranking order and count/rank labels, gameplay saves, scoreboards, and profile trophies.
6. D1 foreign-key checks empty; Squackle's existing profile/session/decks and member billing unchanged.
7. Simulate Scryfall failure: use prior cache or curated fallback, never a broken game. Check source refresh retry health after provider recovery.

This report is operational documentation, not evidence that a third-party search index has added any pages. Search Console indexing is a separate external process.
