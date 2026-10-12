# Deep Cuts EDH — first deployable website prototype

An **independent, no-framework, static** prototype for an obscure Commander discovery website and a weekly editorial series called **The Rescue Report**.

## Retro styling and Deck Workshop

- `retro.css`: original tabletop-fantasy visual theme, inspired by old-era card aesthetics; not copied Wizards frame artwork.
- `library.html`, `library.js`: paginated, user-triggered Scryfall card search for the complete online catalog, including format legality, card type, color identity, rarity, mana value, price, and sorting.
- `shared.js`: library-to-deck storage in the browser (`localStorage`), not cloud accounts.
- `deck.html`, `deck.js`: import/export text lists, batch-lookup cards from Scryfall, legality and singleton checks, mana source diagnostics, bracket Game Changer checks, reviewable swaps, and Cut to 100 suggestions.
- Bracket results are advisory and cannot automatically validate combos, intent, game speed, mass land denial or every exception. See current https://magic.wizards.com/en/formats/commander .
- The deck assistant never automatically commits cuts to your deck without user confirmation. This is a functional rules-of-thumb prototype, not yet a semantic or AI-powered optimizer.

## What's working

- Responsive dark-fantasy editorial homepage.
- 16 editorial commander case files, sourced from the planning list.
- Live search across card names, concepts, mechanics and notes.
- Filter by color identity and article/release status.
- "Surprise me" randomized commander discovery (excludes upcoming cards).
- Clickable case-file detail dialogs with sample tech recommendations.
- Real Rescue Report #001 page for Chainer, Dementia Master, including a curated starter core.
- A "copy starter core" button that exports an intentionally **incomplete** plain-text list.
- Direct Scryfall card/search links, full-card imagery on the two Chainer hero displays.
- No hosting dependencies, no server, no database. Nominations require GitHub sign-in to publish.

## Community nominations — LIVE BACKEND

Cloudflare Pages Functions (`functions/api/nominations.js`) and D1 store community nominations and counts. Visitors nominate through a form directly on the site, with server-side Turnstile verification and anonymous rate-limiting. The public leaderboard displays approved candidates and the live frontrunner. New commander names enter a moderation queue; see `db/OPERATIONS.md` for how to approve nominations or close a voting round. This feature does not auto-write or auto-publish an article.

## Important limitations

- This is a functioning **front-end prototype**, not a complete 100-card deckbuilding application.
- No 100-card validated decklists, live pricing, playtesting results, or real EDHREC deck counts have been produced yet.
- Report #001 is a researched starter case file, but it requires final rules/budget verification and playtesting before representing it as a tested build.
- The $100 figure is a target, not a verified decklist cost.
- Nephilim Epochal and Ekthi, Contaminator Priest are preview cards from Mystery Booster Commander Edition, with official new-to-Magic Commander legality starting **2026-11-13**; do not mark them as currently legal before that date.
- The full Chainer card art is loaded from Scryfall's `cards/named` image endpoint and requires internet access. If blocked/offline, the site shows a fallback text display.

## Free hosting option 1 — Cloudflare Pages Direct Upload (fastest)

1. Open https://dash.cloudflare.com/ and create a free Cloudflare account.
2. Go to **Workers & Pages** → **Create application** → **Pages** → **Drag and drop your files** (wording varies by dashboard version).
3. Upload `deep-cuts-edh.zip`, or a folder containing `index.html` at its root.
4. Choose a project name such as `deep-cuts-edh`, then deploy.
5. You receive a `*.pages.dev` address. No custom domain required.

**Note:** A Pages project created via **Direct Upload** cannot subsequently be converted to Git integration. To enable auto-deploy from GitHub later, create a *new* Pages project with Git integration and connect the repo.

## Free hosting option 2 — GitHub + Cloudflare Pages (recommended long-term)

1. Create an empty GitHub repository, e.g. `deep-cuts-edh`. It may be private.
2. Unzip `deep-cuts-edh.zip`, then upload the **contents** to the repository root. `index.html` must be at root, not within another folder.
3. In Cloudflare dashboard go to **Workers & Pages** → **Create application** → **Pages** → **Connect to Git** (labels vary).
4. Link your GitHub account and select the repository.
5. Framework preset: **None**; build command: `exit 0` or none; output directory: `.` (repository root).
6. Deploy. Each later push to the production branch causes Cloudflare Pages to publish a new version.

This is 100% static. There are no environment variables, API keys, or install commands.

## Editing the site

- `index.html` — homepage markup and text.
- `styles.css` — layout/colors/responsive design for both pages.
- `data.js` — the full editorial case-list and Chainer sample cards.
- `app.js` — filtering, search, randomizer, case dialogs.
- `reports/chainer-dementia-master.html` — first full editorial report.
- `reports/report.js` — sample card table and copy function.
- `assets/favicon.svg` — original site icon (not a Wizards logo).

To add a new commander case, insert an object into the `window.DEEP_CUTS` array in `data.js`. Match its fields with neighboring entries.

To add future reports, create a new standalone file under `reports/`, link it from the corresponding case in `app.js`, then update homepage lead content in `index.html`. For production growth we should refactor to a templating system (Astro/Eleventy) so articles do not require manual HTML duplication.

## Card imagery and legal

This is an unofficial Magic fan site intended to be free for all visitors. It follows the Wizards Fan Content Policy disclaimer required by Wizards. Full card imagery is sourced from Scryfall, with the entire card visible and uncropped to retain attribution and copyright statements. Other case files use original abstract CSS design, not third-party artwork.

No fan-content access paywalls or implied Wizards/EDHREC endorsement. Check the current Policies of Wizards and Scryfall before monetization, and check affiliate terms separately.

References:
- https://developers.cloudflare.com/pages/get-started/direct-upload/
- https://developers.cloudflare.com/pages/get-started/git-integration/
- https://company.wizards.com/en/legal/fancontentpolicy
- https://scryfall.com/docs/api
- https://magic.wizards.com/en/news/feature/whats-inside-mystery-booster-commander-edition
## October 2026 — Theme / expanded workshop

- A responsive original logo lives in `assets/deep-cuts-mark.svg` and never overflows its own frame.
- `theme-v2.css` overrides the previous muddy retro palette with deep pine, cream parchment and muted brass.
- `workshop-plus.js` adds probability and mana-curve charts, role classification, simple health estimates, collection/missing-card tools, and outbound research/shop links.
- The TCGplayer links are ordinary non-affiliate shopping links until a separate affiliate account is approved and connected; there are no tracking identifiers in the repository.
- Beyond current scope: full CommanderBracket feature parity (combos, server-side deck import from every provider, rules Judge, automatic validated 100-card construction, ML deck ratings, and cloud account sync).
