# Deep Cuts EDH — Autonomous Site Systems and Daily Puzzle Rotation
Updated: 2026-10-13

## Answer to "Does it need GPT?"

**No.** Playing, daily changes, card source refreshes, achievements, profiles, notifications, community voting, and event-driven webhooks run as normal web code and Cloudflare services. ChatGPT is a development assistant, not part of the production request or scheduled task path. The games do not use, call, or require OpenAI APIs or ChatGPT.

## Daily puzzle automation

- **00:00 America/Chicago:** The active calendar day changes automatically, including daylight-saving time. The first GET request or the scheduled prewarmer creates that day's new puzzles.
- **00:15 America/Chicago:** A dedicated Cloudflare Worker Cron Trigger `deep-cuts-puzzle-clock` prewarms both games. Two cron expressions (`15 5 * * *`, `15 6 * * *`) cover Central Daylight and Central Standard Time; one run each day will fall before midnight or after 1 AM, but both are safe and idempotent.
- **No job dependency:** If Cloudflare delays the cron or it is disabled, the first game request generates the missing daily puzzles automatically. Once created, each daily puzzle is saved in D1 and never changes during the day.
- **Source refresh:** Approximately once per seven days, the site checks Scryfall's documented card-search API for a compact, Commander-legal paper-card pool. The refresh uses a short-lived D1 lease to avoid stampedes and six spaced requests total, caches the source in D1, and retries after a failure. No background AI, GitHub commit or manual edit is necessary.
- **New Cold Case content:** On and after October 14, 2026, the game selects commanders from this automatically refreshed pool (at least 110 distinct qualified names). Clues are generated using card metadata, legal color identity, printed year, mechanical text, and type line. Recent selections are excluded for up to 90 days where enough candidates are available. The curated original 30-puzzle dataset is retained as a source-outage fallback and for practice rounds.
- **New Obscurity Ladder content:** Each day selects five legendary cards from five distinct bands of Scryfall EDHREC card-popularity rankings, and freezes the exact source ranks and correct solution in D1. **EDHREC card usage is not the number of decks led by a commander**. The game labels this distinction on its page, before submission, and in the results, and retains the original October 13 deck-count snapshot only for that date and curated practice.
- **Source disruptions:** If Scryfall is unavailable, an older cached pool is used; if no valid pool has ever been cached, the original curated puzzles are selected. A dated puzzle still exists and players never see half-updated scores. Retrying Scryfall does not alter any already published day.
- **Profiles and achievements:** Per-day D1 runs, anti-repeat checks and achievements execute in response to gameplay, without scheduling. Practice never awards trophies.
- **Operational status:** Public, read-only endpoint `/api/daily-games?action=automation_status` reports source-refresh date, generated daily puzzles, and whether a model is needed. It never returns credentials or unrevealed answers.

## Other automatic site systems

| System | How it runs | GPT required? |
| --- | --- | --- |
| Card Library search & prices | Scryfall API on user query, responses rendered by site JavaScript | No |
| Deck Workshop analysis & saved decks | Browser logic and Cloudflare/D1 on user actions | No |
| Community profiles & trusted devices | Cloudflare API, HttpOnly cookie, TTL checked on each request | No |
| Field Dispatch notifications | Database event writes when the relevant member action occurs | No |
| Evidence boards & endorsements | Browser submissions and Cloudflare API/database | No |
| User rankings and game achievements | Derived on demand or awarded with validated activity | No |
| Email verification / lost-key recovery | Google Apps Script sender and API when a code is requested; codes expire by timestamp | No |
| Nomination vote counts | Saved and queried automatically; new nominees need moderator approval | No for counting; human editorial review for publication |
| Ko-fi webhook processing | Signed incoming provider webhooks, when configured | No |
| Stripe legacy enrollment | Retired; **do not restart automatically** | N/A |
| Premium Ko-fi subscription key issuance | Intentionally gated pending verified payment/recovery and secure operational readiness | **Remain disabled**; owner approval and configuration required |
| Publishing official Commander Rescue Reports | Original research, card legality checking, editorial review and release | **Human review required**; deliberately NOT auto-published |

"Automatic" doesn't mean every process is a scheduled job. Most systems are **event-driven**, which is the correct way to execute them: a user saves a deck, a payment webhook arrives, or a recovery code is requested. Those event-driven workflows operate independently without someone prompting ChatGPT.

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
2. GET `/api/daily-games?action=automation_status`; verify that `automatic: true`, `modelRequired: false`, and catalog timestamps reflect any source refresh.
3. Get both daily states twice; day/answers/ranks must match and new puzzle database rows must be immutable. Verify game state doesn't leak the answer before completion.
4. Request valid practice rounds. These must remain playable offline from Scryfall (artwork may fail) and grant no achievements.
5. Check mobile Cold Case choices, ranking order and count/rank labels, gameplay saves, scoreboards, and profile trophies.
6. D1 foreign-key checks empty; Squackle's existing profile/session/decks and member billing unchanged.
7. Simulate Scryfall failure: use prior cache or curated fallback, never a broken game. Check source refresh retry health after provider recovery.

This report is operational documentation, not evidence that a third-party search index has added any pages. Search Console indexing is a separate external process.
