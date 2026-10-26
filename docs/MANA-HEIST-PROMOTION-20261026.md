# Mana Heist main-site promotion — October 26, 2026

Owner authorization: “ensure these changes are going into main site, deploy all next steps”. This authorizes the completed Mana Heist batch's main-site integration and deployment. It does not turn unfinished human calibration, Stackbreaker work or public 1.0 acceptance into completed work.

## Source and release boundary

- Lab source: **32484ba31b391a3ffc83442fb4fa72d68acf2fd0**, combining reviewed/green Lab PRs #128 (phone layout), #132 (five unscored decision vaults), and #133 (campaign diagnostics and board-fingerprint fix).
- Verified Lab deployment: **57b39a4d-b926-432a-a7cd-1b517bfd2cae**, https://57b39a4d.deep-cuts-game-lab.pages.dev . Cloudflare reports successful deployment of the exact source SHA above.
- Main-site base and rollback target: **65aabee3ccef88fb08b31063bd8260b6a6bc6384**. New first-party route: `/games/mana-heist/`, discoverable from `/games` and the sitemap.
- Rules: **mh-landfall-0.2.0**, unchanged. All **53 runtime source modules** are byte-identical to the tested Lab source; the SHA-256 manifest is `MANA-HEIST-PROMOTION-20261026.json`.

The website previously had no Mana Heist route. This adds the existing 500-vault game, 28 lessons, bonus trials, five Decision Lab samples, compatible guest backups and the completed audit tooling. It preserves the tested game design, card controls, difficulty estimates and board IDs. It does not embed a mutable Lab iframe or connect Lab identities to production.

All records are browser-local guest progress. No authoritative profile scores, rewards, membership changes, database schemas or migrations are introduced. Existing Hive Run and Stackbreaker identity/replay systems are unchanged. A prior Lab save can be transferred manually using the existing backup export/import; cross-origin browser storage is not silently copied or reset.

## Production adaptations

The game shell uses the main site's favicon, canonical/OG metadata, one H1, Arcade return links and the shared privacy-aware analytics loader. The existing query-stripping, private-route exclusion and Global Privacy Control behavior is preserved. Browser smoke contexts enable Global Privacy Control and block third-party requests. It states unranked beta, device-only saving and simplified turn-based mana clearing. Developer HTML pages are noindex, and their paths are excluded from discovery. The new Arcade entry does not change the four daily games or their achievements.

All functional Lab test files are retained. Three Lab-host-only tests for the Lab badge, return route and beaker favicon are replaced by production integration/provenance checks. Two display-copy assertions are adapted for the production beta label and five-sample inventory; gameplay assertions are retained. The production game package has 251 tests, plus five production contract tests at the website root.

The browser test accepts `MANA_HEIST_GAME_URL` for GET-only public smoke tests in fresh contexts. Other origins and every non-GET request are blocked. Host proxy settings are honored only for explicitly selected live tests; `MANA_HEIST_TEST_IGNORE_TLS=1` is an opt-in test-host proxy workaround, never a product TLS setting. Normal local/CI testing leaves it off. The offline audit CLI now derives its actual repository-relative source paths.

## Verification

- Combined Lab suite: **251/251**.
- Exact deployed Lab source: **20/20 GET-only live browser playthroughs**, using fresh contexts and the documented test-host proxy workaround.
- Promoted functional game suite before security follow-up: **248/248**. Three additional offline-catalog tests verify exact HTTPS download origins, traversal/extension rejection, JSON encoding and overwrite/symlink refusal; updated CI reruns the resulting 251-test suite.
- Main-site provenance, SEO, Arcade journey, account isolation/payment replay and Stackbreaker replay tests: **51/51**.
- Additional protected-route authorization/security regressions: **34/34**.
- Main-site quality/navigation contract: **240 checks passed**.
- Local Mana Heist real-browser progression: **20/20** sample playthroughs across 320×568, 375×667, 390×844 and 1280×900, including Ward Plan, Undo, Restart, manual Cast, next/return, saves and existing lesson/bonus/campaign access.
- Existing Arcade practice, journey, homepage mobile and Library browser regression suite: **20/20** (local mocked APIs).
- Shared analytics coverage/privacy regressions: **6/6**. CI caught the initially missing shared loader before merge; the production shell now uses the existing loader without changing its behavior.
- Source syntax and diff checks passed. Static security sweep has no confirmed high/critical finding. New DOM-sink review items use static game definitions, fixed mana symbols or validated numeric guest progress; no new server-supplied user content or account credentials are rendered by the game.

Run from the website root:

```sh
node --test tests/mana-heist-promotion.test.mjs
node --test games/mana-heist/tests/*.test.mjs
npm ci --prefix games/mana-heist --ignore-scripts
PLAYWRIGHT_EXECUTABLE_PATH=/path/to/chromium npm --prefix games/mana-heist run test:browser
node scripts/site-release-check.mjs
```

The dedicated first-party Mana Heist workflow runs provenance, all promoted tests and real-browser playthroughs on future changes. Existing site-quality, release-coordination, security and Stackbreaker workflows remain intact.

### Pre-existing Hive test drift

The full Hive suite gives **172 passing / 2 failing** both on untouched main `65aabee...` and this promotion. The failing tests are `game top-right avatar reuses the actual site-wide account component` and `main-site game route and all first-party assets are present`; they still expect `/api/community?action=me`, whereas current production uses the session endpoint. The relevant test files are already owned by older open website PR #96. They were not altered or disabled here, and the failures are not represented as passing. No Hive runtime/profile path is changed by this promotion.

### Separate Workers preview configuration

The separate `Workers Builds: deep-cuts-edh` branch check runs `npx wrangler preview` and fails because the repository has no Workers `previews` configuration. This is distinct from the canonical Cloudflare Pages deployment. Production main's Workers and Pages checks were successful before this release. This promotion does not introduce a second hosting configuration or change deployment settings to mask that preview failure; Pages production must still be verified at the exact merged SHA.

### CodeQL follow-up

Three high-severity missing-URL-anchor findings were in source-text test assertions, not production host authorization. Replaced them with actual URL origin/path assertions against the exported image builders. The medium `js/http-to-file-access` finding was the manual offline Scryfall catalog exporter persisting downloaded card JSON. Hardened it to permit only a new JSON basename inside the game data directory, validate the exact HTTPS bulk origin, reject redirects and exclusively create files so existing files/symlinks cannot be overwritten. The live game never invokes this tool. Added three local-only regressions; no Scryfall bulk download was performed. CodeQL is rerun rather than suppressed.

New command: `node games/mana-heist/tools/build-mana-catalog.mjs research-20261026.json`; output is `games/mana-heist/data/research-20261026.json`. An existing snapshot requires a new filename. Historical Lab tool instructions describe the old CLI and are retained as archived evidence.

## Unfinished work remains unfinished

The campaign evidence profiles 500 legal reference routes and completes 26 of 41 selected graphs; 15 remain inconclusive. Difficulty estimates have not been replaced by a human-calibrated equation. The six-vault calibration CSV is blank. Physical iOS/Android, full supported-Oracle certification and the existing qualified rights/brand review remain open. Current owner deployment authorization is recorded explicitly; no license, legal sign-off, beta-participant result or public 1.0 certification is invented. Historical Lab documents retain their dated scope.

Official rules hub was rechecked October 26 and still links Comprehensive Rules effective September 25, 2026. Current card-specific Gatherer retrieval remained unsuccessful; no new card/engine legality change or official-rules accuracy claim is part of this release. The simplified mana-expiration model is disclosed in the game. Forge was not run.

## Deployment and rollback

Merge the independent production PR only after its required checks pass. Then confirm the exact main merge SHA and successful Cloudflare `deep-cuts-edh` canonical deployment, request the first-party route/assets and Arcade link, and run isolated GET-only playthroughs. Automatic preview success alone is not production verification.

Rollback is a normal revert of the production promotion PR. It removes the new discovery route/code without deleting browser storage or changing any account, score, membership or D1 data. The prior main SHA above and prior deployment **fcfca49e-aeee-4a6d-b93d-2fb0a3d519e9** are the known-good baseline. Do not reset user records as a rollback step.
