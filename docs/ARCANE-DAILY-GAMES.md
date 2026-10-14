# Daily Games expansion — Arcane Cipher + Conspiracy Board

Release: 2026-10-14. Existing Cold Case, Obscurity Ladder and Hive Run remain unchanged, apart from adding new links and displaying additional verified achievements.

## Routes
- `/games/arcane-cipher.html` — six-guess Wordle-style five-letter Magic term game, physical and on-screen keyboard, duplicate-letter-aware green/gold/gray feedback.
- `/games/conspiracy-board.html` — sixteen unique Magic cards sorted into four pre-reviewed categories, four total mistakes, "one away" hints, explanations and separate Scryfall links.
- `/api/arcane-games` — Cloudflare Pages Functions; GET `action=state|board|badges`, POST `action=guess|group`; `game=cipher|board`.
- `/games.html` — both new games with daily/practice launch controls.

## Puzzle integrity
- Curated material in `src/arcane-game-data.js`: 52 five-letter Magic-related answers, explanations and reference cards, and 16 nonoverlapping four-card category sets.
- Daily date uses America/Chicago. The deterministic source is frozen on first request by `daily_arcane_puzzles(game,day)`, so new code cannot retroactively change an existing day's solution.
- Practice rounds use independent seeded permutations and never create daily rows, scores, badges or leaderboard entries. Shared daily boards contain one fixed answer for all visitors.
- Exact Scryfall search links are provided for selected card names or, after solving Cipher, its illustrated example.
- Server does not reveal the five-letter answer or undiscovered categories before completion. Anonymous browser history is local and not counted as verified; all authenticated daily moves are reconstructed and validated server-side.
- Word scores: 100/85/70/55/40/25 points by winning guess, zero for a failure. Card connections: 100, 85, 70 or 55 on complete boards after 0–3 mistakes; partial failure score reflects correctly grouped categories. Identical group repeats are rejected.
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
