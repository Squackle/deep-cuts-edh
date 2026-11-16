# Repeatable local verification

The production site remains buildless HTML/CSS/browser JavaScript with Cloudflare Pages Functions. The root package contains **development tools only**; it does not introduce a framework, production build, database binding or deployment command.

Use Node 24 (CI), or Node >=22.13 for the in-memory SQLite helper:

```sh
npm ci --ignore-scripts
npm run test:install-browser
npm test
npm run check
```

On a Linux host missing browser libraries, use `npx --no-install playwright-core install --with-deps chromium`. An existing system Chrome is supported; set `CHROME_BIN` to choose one explicitly. A missing browser fails the test instead of silently skipping it.

| Command | Scope |
| --- | --- |
| `npm test` | All local suites, including Workers and browsers; exits nonzero if any suite fails |
| `npm run test:unit` | Node logic, negative authorization, SQL persistence, replay, source contracts |
| `npm run test:workers` | Bundled real Pages handlers in workerd with temporary local D1 |
| `npm run test:browser` | Real Chromium on local HTTP fixtures, desktop/mobile, external services mocked |
| `npm run check` | Existing static SEO/navigation/accessibility contract checks |
| `npm run test:live` | Explicit opt-in **existing** anonymous production/alias GET smoke checks; excluded from default tests |
| `npm audit` | Dependency advisory check; does not establish application security |

The automatic runner discovers `*.test.mjs` in `tests/` and `games/hive-run/tests/`. Files imported by another suite run once, preserving their assertions without duplicate subprocess execution. Worker tests use the `-workers.test.mjs` suffix; browser suites import the shared browser helper. Other suites are unit tests. Legacy workflows retain their individual commands.

## Isolation

- No production credentials are needed or read by the local suites.
- Normal Node suites preload a guard rejecting unmocked external `fetch` requests; localhost is allowed for HTTP fixtures.
- Browser tests abort or mock external requests, including Scryfall, ads, Turnstile and API responses. No real form submission, payment, mail or profile creation occurs.
- Workerd tests construct Miniflare directly, with a fresh ephemeral D1 binding named `DB`, synthetic credentials and blocked outbound fetches. They never load Cloudflare remote bindings or a Wrangler production configuration.
- `tests/helpers/sqlite-d1.mjs` executes actual SQL with foreign keys and transactional batches in memory. It is a SQL adapter, **not** a substitute for workerd integration coverage.
- Existing production smoke commands are deliberately separate. Even a GET can have side effects in some application routes. Do not expand them to puzzle generation or authenticated API requests without evaluating those effects.
- Do not use Cloudflare previews for mutation tests until the production/preview isolation concern in issue #74 is resolved and independently verified.

## New integration coverage

- Deck publication, owner-scoped version updates, concurrent writers and failure rollback.
- Challenge submission transaction rollback and existing eligibility fixtures.
- Invalid membership bearer rejection, cookie-only access, supported tiers and revoked grants.
- Invalid JSON envelopes, including the previously crashing `null` deck-share body.
- Real D1 device enrollment, cookie attributes, session reads and cross-origin denial.
- Recovery wrong-code rejection, successful key rotation, single-use replay rejection and invalidation of old keys/devices. Email challenges are inserted as synthetic fixtures; no mail provider is contacted.
- Frozen daily Cipher puzzle, authoritative scoring and repeat submission without duplicate awards.
- Fifteen public routes at 390px and 1280px during synthetic API outages: page headings, navigation, first-party resources, script exceptions and horizontal overflow.
- Existing browser interactions for artists, games, mobile menus, Rescue Board and owner tools are retained.

## Known baseline failure

At the audited main SHA `3f53fd6be78d7fb996f3ac65fefcbc1719239dac`, `games/hive-run/tests/shared-avatar.test.mjs` still asserts a request to `action=me`. The shared header intentionally uses `action=session` after the guest-session update. Its mock throws, leaving the avatar in the guest state. This test remains enabled and failing; `npm test` must therefore remain red until it is corrected.

The repository's `AGENTS.md`, development lanes and `scripts/release-coordination.mjs` place **all** `games/hive-run/**` paths under the separate game promotion gate, including tests. This Website audit leaves that protected file unchanged. A coordinated test-only correction should update the mock to `action=session` and retain all signed-in avatar assertions. No gameplay or authentication rollback is warranted. Do not merge this audit while its full-suite check is red.

## Dependencies and CI

`.github/workflows/audit-tests.yml` adds independent unit, workerd and browser jobs for every PR to main. It grants read-only repository permissions and contains no deployment or remote database step. A failure in one job does not hide the other results.

All development dependencies and transitive resolutions are locked. Miniflare's published dependency set contained advisories in `undici` and `sharp` during this audit; scoped overrides pin `undici@7.29.1` and `sharp@0.35.5`. The workerd suite was rerun with these overrides, and `npm audit` reported zero known vulnerabilities. Revisit overrides when upstream Miniflare incorporates patched versions. No production page imports these packages.

Cloudflare Pages excludes `node_modules` from static uploads ([official migration documentation](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/#ignoring-assets)). Existing hosting output paths and deployment settings are unchanged. Verify a future approved build's installation/runtime version before release; this audit does not deploy to prove that build.
