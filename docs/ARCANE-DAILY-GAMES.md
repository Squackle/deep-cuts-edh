# Daily Games expansion — Arcane Cipher + Conspiracy Board

Release: 2026-10-14. Existing Cold Case, Obscurity Ladder and Hive Run remain unchanged, apart from adding new links and displaying additional verified achievements.

## Routes
- `/games/arcane-cipher.html` — six-guess Wordle-style five-letter Magic creature-type game, physical and on-screen keyboard, duplicate-letter-aware green/gold/gray feedback.
- `/games/conspiracy-board.html` — sixteen unique Magic cards sorted into four pre-reviewed categories, four total mistakes, "one away" hints, explanations and separate Scryfall links.
- `/api/arcane-games` — Cloudflare Pages Functions; GET `action=state|board|badges`, POST `action=guess|group`; `game=cipher|board`.
- `/games.html` — both new games with daily/practice launch controls.

## Puzzle integrity
- Curated material in `src/arcane-game-data.js`: 68 verified official five-letter creature types and explanations (Comprehensive Rules 205.3m, June 2026), and 16 nonoverlapping four-card category sets.
- Daily date uses America/Chicago. The deterministic source is frozen on first request by `daily_arcane_puzzles(game,day)`, so new code cannot retroactively change an existing day's solution.
- Practice rounds use independent seeded permutations and never create daily rows, scores, badges or leaderboard entries. Shared daily boards contain one fixed answer for all visitors.
- Scryfall searches for cards of the solved creature type are provided after each newly generated Cipher game. Historical frozen puzzles retain their existing Scryfall reference links.
- Server does not reveal the five-letter answer or undiscovered categories before completion. Anonymous browser history is local and not counted as verified; all authenticated daily moves are reconstructed and validated server-side.
- Cipher answers are always official five-letter creature types; players may enter any five-letter A–Z guess to keep the game approachable. Word scores: 100/85/70/55/40/25 points by winning guess, zero for a failure. Card connections: 100, 85, 70 or 55 on complete boards after 0–3 mistakes; partial failure score reflects correctly grouped categories. Identical group repeats are rejected.
- A single signed-in profile can never file a completed daily run twice. A failed concurrent update returns 409 instead of overwriting saved attempts.

## Storage and profile integration
Apply `db/arcane-daily-games-2026-10.sql` to the same production `DB` D1 database before deployment. Tables:
- `daily_arcane_puzzles` — frozen dated puzzle payloads;
- `daily_arcane_runs` — authenticated attempts, daily score, finished state, FK cascade on profile deletion;
- `daily_arcane_badges` — server-verified achievements.

Five badges are available: Cipher Breaker, First-Try Cipher, Conspiracy Cracker, Flawless Connections and Double Dossier. These appear in the Field Network's existing public trophy display through the unified `/api/daily-games?action=badges` response. No purchased subscription or premium access is involved.

## Quality checklist
1. Open both games on narrow iPhone-sized and wide desktop layouts. Check header menus, board/card grid, focus outlines, button sizes and no horizontal overflow.
2. Cipher: guess using physical keyboard and touch keyboard, test repeats, reveal six rows, score 100/0 edge cases and Scryfall link after finishing.
3. Board: select/deselect four, correct group, incorrect group, "one away", final fourth mistake, shuffled layout, solved groups not selectable.
4. Daily: refresh anonymous progress, resume secure-cookie signed-in progress, confirm only one completed record per game/date, check public leaderboard.
5. Practice: new randomized seed and no database writes or trophies.
6. Verify tab changes after midnight Central, site-wide navigation and sitemap, public investigator badges, and spoiler-free copy/share.
7. Check that the existing games' API, puzzle generation and scores still operate independently.

This is an independent fan project, not an official Wizards of the Coast daily game. Curated categories intentionally contain unique names to avoid overlapping or subjective solutions.

## Cipher creature-type restriction — October 14, 2026

Starting with newly generated daily and practice puzzles, Cipher solutions come only from a curated list of 68 official five-letter Magic creature subtypes, checked against [Comprehensive Rules 205.3m](https://media.wizards.com/2026/downloads/MagicCompRules%2020260619.pdf). This changes *answers only*, not what five-letter guesses a visitor may try. The answer and explanation reveal remain hidden until completion. The server freezes each daily puzzle on first request in D1, so today's already-played SCOUT edition was retained without modifying past attempts, scores, leaderboards or badges. Conspiracy Board remains unchanged.

## Conspiracy Board P1 variety fix — October 27, 2026

- Daily Conspiracy Board rotates on the server by `America/Chicago` calendar day. Its first-access D1 snapshot and existing dated scores/runs remain immutable. Existing Oct 22 v2 category rotation and historical puzzles are unchanged. The client checks the new day at Central midnight (including 23-/25-hour DST days), on visibility return, and as a periodic fallback; an old-day score submission still returns 409.
- When a board is first opened, the client independently shuffles all 16 tile positions using available browser cryptographic randomness. It stores this **display-only** order under a new `sessionStorage` key scoped to that day's board or the practice seed. Refresh retains the current positions; the Shuffle button also updates that layout. Invalid saved permutations are discarded. No attempt histories or scores are edited by a shuffle.
- **New Practice Round** on Conspiracy Board requests a read-only `action=new-practice` seed. The server compares the previous 16 visible cards against candidate practice groups and chooses a puzzle with **zero overlapping categories/cards**, using the existing deterministic practice generator so old practice seed URLs remain valid. The endpoint never writes score, badge, frozen daily-puzzle, or attempt rows. Arcane Cipher's practice mechanism is unchanged.
- Tests cover first-day/daily rollover around Central daylight saving transitions, adjacent dates changing categories, fresh practice sets not repeating prior categories, frozen daily generation, invalid practice inputs, and isolation of saved-score handling. Follow the established first-party QA process; do not claim wall-clock rollover browser smoke merely from date unit tests.
