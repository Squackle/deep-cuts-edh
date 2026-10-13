# Daily MTG Games — Cold Case & Obscurity Ladder

Production launch: October 13, 2026.

> **Automation upgrade (October 13, 2026):** The details below describe the original launch content. Starting October 14, puzzles are generated and frozen automatically in Cloudflare D1, a weekly Scryfall Commander catalog refresh is triggered without ChatGPT, and the Obscurity Ladder's *new* numeric metric is the Scryfall EDHREC **card-usage rank**, **not** the number of decks led by each commander. Original October 13 puzzles and curated practice remain intact. See [Autonomous Site Systems](AUTONOMOUS-SITE-SYSTEMS.md) for scheduling, fallback, and source details.\n\n## Games & routes

- Hub: `/games.html`
- Cold Case: `/games/cold-case.html`
- Obscurity Ladder: `/games/obscurity-ladder.html`
- API: `/api/daily-games` (GET `action=state|board|badges`, POST `action=guess|submit`)

Each day starts at **midnight America/Chicago** (handles daylight-saving time); both challenges are free, use five-minute-scale rounds and allow unsigned visitors. Practice puzzles are unlimited and excluded from profile stats/trophies. All input is validated on the server, with same-origin checks, bounded daily IP/member quotas, and no external scripts except existing Scryfall art images. Loading a page does not reveal the answer.

## Cold Case

An original 30-commander puzzle pool with a nonrepeating 30-day rotation and twelve selectable suspects. Five editorially written, progressive clues reveal the suspect's color identity, debut year, deck style, core ability, then a distinctive final lead. Players get five guesses; a wrong guess unlocks the next clue. A completed case reveals the answer, Scryfall and EDHREC links. Signed-in results are saved in D1, one per day. Scores are 500, 400, 300, 200, or 100 for success on guesses 1–5; 0 for an unsolved case. Future editorial work should add new cases before the 30-day launch pool repeats.

## Obscurity Ladder

Five commander cards are selected across five ranges of a manually checked EDHREC popularity snapshot. Up/down controls provide full keyboard, touchscreen and pointer support without drag-and-drop. Players must sort from **fewest to most EDHREC-listed Commander decks**, then file one answer per day. Ten pairwise orderings are worth ten points each (0–100). The reveal shows dated commander counts and individual EDHREC source links. These numbers are **not live**, not Commander power ratings, and not an estimate of every privately built deck.

**Snapshot date:** 2026-10-13; `src/daily-games-data.js` records exactly 30 distinct commanders and their contemporaneous reported deck counts. The references can be checked at `https://edhrec.com/commanders/<commander-slug>`, including [Chainer](https://edhrec.com/commanders/chainer-dementia-master), [Commander Mustard](https://edhrec.com/commanders/commander-mustard), [Alena](https://edhrec.com/commanders/alena-kessig-trapper), [Gilanra](https://edhrec.com/commanders/gilanra-caller-of-wirewood), [Kangee](https://edhrec.com/commanders/kangee-aerie-keeper), [Ertai](https://edhrec.com/commanders/ertai-wizard-adept), [Doran](https://edhrec.com/commanders/doran-the-siege-tower), and [Arcades](https://edhrec.com/commanders/arcades-the-strategist). Keep this snapshot immutable within a daily edition. To refresh, publish a new dated dataset and announce the methodology. All card art is retrieved via Scryfall's named-card image endpoint.

## Profile achievements and leaderboard

Signed-in profiles use the existing HttpOnly/secure remembered-device cookie or temporary browser session key. Profile keys never appear in game URLs, stored results, share text, or public leaderboards. D1 tables added via `db/daily-games-2026-10.sql`:

- `daily_game_runs`: one per profile, game and Central calendar date, with validated attempts, score, and completion status; stored privately.
- `daily_game_achievements`: unique profile/badge key with timestamp. Public badge titles (never recovery keys or email) decorate the user's Field Network dossier, investigator ranks, and game screens.

Award criteria:

| ID | Badge | When awarded |
| --- | --- | --- |
| `case_closer` | 🕵️ Cold Case Closer | Solve a daily Cold Case |
| `first_clue` | 🔍 First Clue Sleuth | Solve in one guess |
| `three_day_streak` | 🔥 Three-Day Trail | Solve three consecutive daily Cold Cases |
| `case_archivist` | 📁 Case Archivist | Finish seven daily Cold Cases |
| `ladder_climber` | 🪜 Ladder Climber | Complete one daily Ladder |
| `perfect_ladder` | 🏆 Perfect Ladder | 10/10 pairwise comparisons |
| `ladder_veteran` | 🏺 Obscurity Scholar | Complete seven daily Ladders |
| `double_agent` | ⚡ Double Agent | Finish both daily games on the same Central date |

Badges and daily leaderboards are public by username; unsigned players' results stay in their own localStorage and are not eligible for awards. Scores are not added to research-contribution reputation or paid membership perks. Authenticated daily results cannot be submitted twice or edited after finishing. Practice never writes to D1, and anonymous records cannot grant awards. Peer gameplay is for fun; knowledgeable players can still inspect public card and EDHREC data to spoil themselves.

## Search visibility and discovery

- Sitewide GAMES nav link, linked homepage daily-game teaser, and searchable indexable descriptions on each separate URL
- Unique titles, meta descriptions, canonical URLs, social preview metadata, and `VideoGame` / `CollectionPage` JSON-LD
- Static content available without JavaScript: gameplay instructions, explanation, FAQ, ranking source
- Crawlable internal links and `sitemap.xml` (13 public URLs) declared in `robots.txt`, preserving exclusions for private pages and API responses
- No keyword stuffing, fabricated ratings, paid-indexing tricks, or claims that Google will necessarily index/rank the pages

**Operator follow-up:** Submit `https://deep-cuts-edh.pages.dev/sitemap.xml` in Google Search Console for the verified domain (if available), and request indexing of the hub and two games after deployment. Search result placement is entirely up to the search engine and may take time.

## Manual test checklist

1. Open the hub and both game URLs on desktop/mobile; verify sticky header and avatar button remain usable.
2. On Cold Case, confirm the first clue, select any suspect, submit a wrong guess, see the next clue, and finish after five attempts or a correct guess. Refresh; daily progress remains for anonymous browsers.
3. On Ladder, reorder with up/down buttons and keyboard focus, submit once, see the true dated order and pairwise score, refresh; result remains.
4. Copy spoiler-free result and verify it contains no solution/card name. Practice puzzles don't affect the daily leaderboard or award counters.
5. In a real signed-in browser, finish both games and verify D1 results, new trophies on the public dossier, and the daily scoreboards. Try a second submission: it must not award more points.
6. Verify the sign-out state; a temporary profile-key session should also be recognized, without copying credentials into localStorage.
7. Test older and narrow mobile browsers, missing Scryfall images, empty boards, slow networking, invalid requests, and clock transitions at midnight Central.
8. Ensure `/robots.txt` and `/sitemap.xml` are publicly accessible and each canonical game URL is crawlable.

**Verification status:** Syntax and deterministic puzzle tests and D1 integrity checks can be automated. A Cloudflare build success is not proof of live multi-account login, saved trophies, or Google indexing; report those manual tests as pending if not completed.
