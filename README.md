# Deep Cuts EDH — first deployable website prototype

An **independent, no-framework, static** prototype for an obscure Commander discovery website and a weekly editorial series called **The Rescue Report**.

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

## Commander nomination system

The homepage has a **Nominate a Commander** section. Visitors can enter a commander name, the reason it needs rescuing, an optional strategy, synergy cards, and a budget. JavaScript prepares an encoded GitHub Issue URL for `Squackle/deep-cuts-edh`, then sends the visitor to GitHub to review and submit the issue.

- GitHub Issues must remain enabled in repository settings (currently enabled).
- Visitors **need a free GitHub account** and must submit their issue on GitHub; entering details on the site alone does not send anything.
- New suggestions are public GitHub issues and are **not** automatically added to the editorial archive.
- View nominations: https://github.com/Squackle/deep-cuts-edh/issues?q=is%3Aissue+%22%5BNomination%5D%22+in%3Atitle
- GitHub also provides a structured native issue form at `.github/ISSUE_TEMPLATE/01-commander-nomination.yml`.
- This no-backend approach costs $0 and avoids storing visitor data on Cloudflare. For future no-login submissions, add a moderated form backend and spam protection.

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