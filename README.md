# Deep Cuts EDH — first deployable website prototype

An **independent, no-framework, static** prototype for an obscure Commander discovery website and a weekly editorial series called **The Rescue Report**.

## Retro styling and Deck Workshop

- `retro.css`: original tabletop-fantasy visual theme, inspired by old-era card aesthetics; not copied Wizards frame artwork.
- `library.html`, `library.js`: paginated, user-triggered Scryfall card search for the complete online catalog, including format legality, card type, color identity, rarity, mana value, price, and sorting.
- `shared.js`: library-to-deck storage in the browser (`localStorage`), not cloud accounts.
- `deck.html`, `deck.js`: import/export text lists, batch-lookup cards from Scryfall, legality and singleton checks, mana source diagnostics, bracket Game Changer checks, reviewable swaps, and Cut to 100 suggestions.
- Bracket results are advisory and cannot automatically validate combos, intent, game speed, mass land denial or every exception. See current https://magic.wizards.com/en/formats/commander .
- The deck assistant never automatically commits cuts to your deck without user confirmation. This is a functional rules-of-thumb prototype, not yet a semantic or AI-powered optimizer.

## Studio 3.0

The new deck generator, Spellbook API bridge, rules lookup, and cloud deck tools are documented in [`docs/STUDIO-3.md`](docs/STUDIO-3.md).

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

## October 12 · Navigation simplification
- `nominations.html` is the dedicated public nomination board. The homepage links to it instead of burying the ballot beneath the archive.
- Editor moderation is through the private Cloudflare D1 console; the public board never exposes private nomination messages or approval controls.
- `workspace-ui.js` progressively organizes the existing Deck Workshop tools into accessible tab views without removing features. `workspace-ui.css` provides responsive, low-clutter styles.
- `library-ui.js` collapses advanced card search controls by default while preserving format legality and name search.
### Viewing nominations
- Public: [nominations.html](https://deep-cuts-edh.pages.dev/nominations.html) shows approved candidates and their vote totals, plus an anonymous submission form.
- Owner review: Cloudflare dashboard → D1 → `deep-cuts-nominations` → Console. Use the documented SQL in `db/OPERATIONS.md` to inspect the `pending` queue and approve/reject. The public site never grants anonymous users moderation controls.

## Article visibility and Fill to 100 (October 2026)
- The homepage archive shows **only** `window.DEEP_CUTS` entries with `status: "published"`. Unpublished/queued/upcoming commanders are available as selectable nomination suggestions on `nominations.html` but not as pretend completed articles.
- The nominations page displays the total number of nominations, number of approved candidates with votes, pending count, and large per-commander totals. Suggestions prefill the anonymous nomination form but do **not** submit automatically.
- `fill-deck.js` powers the optional **Fill to 100** button in the My Deck panel. It checks existing cards and commanders against Scryfall, uses mana curve/role heuristics, searches Commander-legal cards in the proper identity, proposes basic lands plus role-based spells, explains each suggestion, and preserves existing choices on confirmation. If it cannot find all missing cards within a budget, it doesn't apply a partial list. A complete Scryfall lookup and browser testing remain necessary for production confidence; estimates omit unavailable printings and shipping.

## Rescue Reports 002–004 (2026-10-12)

- `reports/alena-and-gilanra.html`: Gruul burst-mana partner guide.
- `reports/commander-mustard.html`: Boros Soldier tribal guide.
- `reports/ekthi-contaminator-priest.html`: PRE-RELEASE preview, mono-white; Ekthi is expected 2026-11-09 and not yet Commander-legal.
- `reports/guide.css` and `reports/guide.js`: shared issue layout and starter-core import/copy. Pre-release card cores are copy-only.
- Article publication is recorded in `data.js` and `app.js`; D1 `nominations.status` should be set to `featured` to hide the finished commander from nomination voting.
- All article cores are incomplete, unpriced, editorial ideas. Budget target is $100, not a verified deck total.

## Sitewide card links and MTG keyword definitions

`card-lexicon.js` lists card names from existing rescue articles and editorial records. `glossary-terms.js` provides concise, rules-grounded definitions of common Magic mechanics and deckbuilding vocabulary. `site-glossary.js` scans visible non-decklist text and adds Scryfall exact-card links and accessible hover/focus/tap explanations, with `site-glossary.css` styling. It watches dynamically rendered tool results and exposes `window.DeepCutsGuide.registerCardNames(names)` for new results.

For **all future published articles**, add their core card names to the lexicon or register them from the page's `#rescue-data` JSON (automatically read at runtime). A linked text match goes to an exact-name Scryfall search unless the underlying card already has `scryfall_uri` (such as Library results), in which case the actual card detail URL is used.

Do not link card names in decklist editors, deck rows or starter-core tables, which remain plain and easy to select. Keyword descriptions are brief learning aids; consult the official rules for unusual interactions. Reference: https://magic.wizards.com/en/keyword-glossary .

## Workshop and sitewide feedback update — 2026-10-12

- Shared art: the Alena & Gilanra Rescue Report now shows **both partner commander cards** side by side. All new-style commander report art uses an understated animated glow that respects `prefers-reduced-motion`; the legacy Chainer report also receives a subtle glow.
- A sitewide **Feedback** launcher opens a native modal for bug reports and feature requests, protected by Cloudflare Turnstile and rate limited to five submissions per IP per day. Feedback goes into the private `site_feedback` D1 table, not GitHub issues. See `docs/FEEDBACK.md`.
- **Native personal deck accounts**: choose a username and password, sign in and manually save up to twenty account decks on the existing D1 database; retrieve them on other devices. PBKDF2 password hashing and scoped HttpOnly cookies. No password recovery or third-party OAuth; the existing recovery-key vault remains separate. Login attempts are rate-limited. The password itself is never stored by the site.
- Rules Q&A now supports a question and one or two card names. Returns card Oracle text and ranked Scryfall rulings. Optional `env.AI` integration can generate a sourced explanation when a Workers AI binding is independently configured; until then it is a source lookup, not a generative Magic Judge. The model is NOT configured via this repository.
- The Goldfish consistency simulator runs 1,000 approximate opening-hand scenarios to display by-turn mana threshold probabilities for commanders. It does not estimate wins, incorporate every card interaction, or claim to be trained on playtest data.
- The visible roadmap section has been removed. Honest capability limitations remain in documentation and in labels on the features themselves.
