# DeepCutsEDH owner/admin consolidation — prepared five-phase release

**Status:** PREPARATION ONLY. This branch is intentionally unmerged and must not change
the public website or the existing Cloudflare Pages staging project. Operator should
not change a single live D1/KV binding until the Phase 1–3 gates below are evidenced
and owner explicitly authorizes the live cutover.

## Source / destination

- Public website: `deep-cuts-edh.pages.dev`, GitHub `Squackle/deep-cuts-edh` on `main`; real member, payment, arcade and visitor records.
- Existing Cloudflare Pages project to convert: `deepcuts-edh-security-staging`, currently protected, with a synthetic-only D1 database and separate synthetic Hive D1.
- Dedicated synthetic testing source: `security/isolated-test-lane-20261020`. A branch-specific `private-admin/scripts/build-admin.mjs` was prepared there.
- Admin portal source: `coord/private-admin-all-phases-prep-20261020` (this branch). Its build script copies ONLY the allowlisted admin UI, six restricted administrative API endpoints and required server modules from the checked-out repository. No key or production D1 data is embedded.
- Public access URL of *converted project* remains `https://deepcuts-edh-security-staging.pages.dev/` until a separately verified custom hostname is provisioned. The Pages project slug is not implicitly renamed by changing branch/build settings.

Cloudflare Pages **root directory** is project-wide (production AND previews).
Both prepared branches deliberately use:
- Root directory: `private-admin`
- Build command: `node scripts/build-admin.mjs`
- Output directory: `public`

The private Admin build puts its server code into `private-admin/functions` and
`private-admin/src`, *outside* `private-admin/public`.
The test-lane build puts its synthetic security-runner and dependencies in that
same relative location. Neither build publishes the source-only server modules
as static files.

## Phase 1 — preserve the testing lane BEFORE altering project root

1. Confirm GitHub `security/isolated-test-lane-20261020` passes its security-lane
   CI on the latest SHA, including its build for the new common Pages project root.
2. Read back the existing Cloudflare project settings, synthetic D1 identifiers,
   both preview bindings, preview-only synthetic secrets, and Owner Access
   applications. If the API fails, stop here; do not guess.
3. Confirm Cloudflare Access covers **all** preview URLs, including the branch alias
   `security-isolated-test-lane-20261020.deepcuts-edh-security-staging.pages.dev`.
   Test an *actual anonymous HTTP GET* to root, runner page and API: all must
   redirect to Access. App policies must allow only the owner; no bypass.
4. Configure Pages preview branch control to CUSTOM / specific branches only:
   `security/isolated-test-lane-20261020` and (temporarily for Phase 3 only)
   `coord/private-admin-all-phases-prep-20261020`. Do NOT enable `*`.
   Retain the existing production branch and production synthetic D1 bindings.
5. The project root/build directory switch to `private-admin` is a shared setting
   and requires a successful preflight build for BOTH branches. Apply it only as a
   coordinated one-time change after verifying the current production backup
   deployment. The existing live staging environment may temporarily be disrupted
   while its old production branch lacks `private-admin`—do not perform this
   operation before the replacement test preview works and the owner accepts the
   short-lived staging downtime.
6. Confirm preview deployment at the exact test-branch SHA and that
   `DB` and `HIVE_DB` remain bound solely to the **synthetic** IDs, never the
   live production D1 UUIDs. Run anonymous Access denial smoke again.

**Gate 1:** Protected synthetic test preview works, all data remains isolated,
and Cloudflare project still does NOT access live D1 via production deployment.

## Phase 2 — private admin-only source build

Run `cd private-admin && npm run check` in this admin branch. A dedicated
GitHub Actions workflow must independently pass on the exact head commit.

Bundled interfaces:
- `/` private administration landing screen
- `/member-operations.html` Owner Command Center, member grants, live stats UI
- `/diagnostics.html` Ko-fi private webhook diagnostics

Allowed Pages Function routes:
- `/api/owner-ops` read-only dashboard / audited owner actions
- `/api/owner-members` private member directory and grants
- `/api/kofi-diagnostics` separate diagnostics key
- `/api/kofi-member-issue` existing verified-payment/manual owner issuance
- `/api/ad-entitlement` OWNER POST only (no anonymous status GET)
- `/api/field-expansion` OWNER `feature_evidence` moderation only

**Not bundled:** `kofi-webhook`, `stripe-webhook`, profile recovery,
member login, public `site-presence` lease writes, arcane/score endpoints,
community content/public games, synthetic security-runner, or live public assets.

Private Pages middleware must return **503** unless
`PRIVATE_ADMIN_ENABLED=true` has been set explicitly for the proper environment.
It also checks canonical-vs-preview host/mode and requires an Access assertion
header. The header's presence is *not* a signature verification—actual Access
enforcement and owner-key authorization are non-negotiable external gates.

**Gate 2:** CI build and deny tests pass; no public routes are bundled.
Neither existing Pages production branch nor its live DB bindings has changed.

## Phase 3 — synthetic admin acceptance

Use the **admin branch preview only**, behind the already verified owner-only
Access policy and *synthetic* D1/KV resources:
- Preview runtime: `PRIVATE_ADMIN_ENABLED=true`,
  `PRIVATE_ADMIN_MODE=synthetic`, test-only rate-limiting secret;
  all preview D1 IDs must match the known synthetic databases.
- Insert a **random synthetic owner credential hash** into the synthetic D1
  `member_issuer_credentials` row (never the real owner key). Keep the
  synthetic plaintext key in a private test secret manager; do not commit, echo
  or return it in GitHub CI logs.
- Verify invalid/valid owner-key form, Unlock Dashboard/no reload,
  Lock & clear and idle timeout; verify member directory and the admin's six
  API allowlist routes, including synthetic writes/audits. Test both mobile
  and desktop. Confirm isolation and deny responses, with no live player data.
- Verify diagnostics only accepts its separate synthetic `dcdiag1_` key.
  Payment reconciliation requires test-only Ko-fi signing/matching secrets;
  never send a live webhook or email to a member as part of staging.
- Prove **public routes are absent on the admin preview** and anonymous
  access to landing, command center, diagnostics, and admin APIs is blocked.
  Verify synthetic cleanups and recorded D1 effects; no unredacted keys in reports.
- Confirm that the security-testing preview can still run its previous 13
  synthetic end-to-end handler checks and cleanup afterward.

**Gate 3:** A signed-off, owner-observed, fully private synthetic admin
acceptance report exists. If not, do not bind production D1 or KV.

## Phase 4 — controlled live-data cutover (separate owner approval required)

1. Schedule a short admin maintenance window. Snapshot/redact
   existing Pages production/preview config, Access policies,
   Git refs and database recovery bookmark. No member data export.
2. Confirm first source branch admin head SHA, CI passed; validate both Access
   hostnames (canonical + wildcard), owner MFA and owner-key verification.
   Test no forbidden anonymous path.
3. Promote the **admin branch** as Pages production branch while retaining
   the common root `private-admin`, build command and output. Before binding
   live data, leave `PRIVATE_ADMIN_ENABLED` **unset/false**, so any accidental
   request fails closed.
4. Read back successful exact-SHA admin build and deployed access policy.
5. Only now replace **admin PRODUCTION** bindings:
   - `DB` = public main site's live D1 nominations/community database.
   - `HIVE_DB` = public main site's live D1 verified Hive data database.
   - `SITE_PRESENCE` = public main site's live browser-presence KV namespace,
     **read-only by admin code**.
   - Keep admin PREVIEW bindings bound to synthetic D1. Never copy live D1/KV
     into preview. Re-read ALL bindings and fail if either preview D1 equals
     production D1.
   - Reconfigure only needed secrets via Cloudflare secret settings:
     `TURNSTILE_SECRET` (owner quota compatibility),
     `KOFI_EMAIL_HASH_SECRET` (must match existing payment HMAC),
     `KOFI_ADMIN_DIAGNOSTICS_HASH` (hash only),
     optional `CLOUDFLARE_ANALYTICS_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`
     for owner capacity graphs. Avoid replicating live webhook verification
     tokens, Google mailer, or Resend keys into admin.
6. Set production `PRIVATE_ADMIN_MODE=live` and
   `PRIVATE_ADMIN_ENABLED=true` ONLY when bindings and Access are verified.
7. Owner signs in to admin site and tests READ-ONLY `overview`,
   `presence`, members, diagnostics, and audit with their existing private
   keys. Verify live counts against public production D1 and KV.
   Authorize and test reversible owner writes separately, checking audit trail.
   Do not generate real member keys or revoke accounts as smoke tests.
8. Keep old public admin endpoints active for short rollback window.

**Gate 4:** Production admin responds behind Access and independent owner
credential, shows live data correctly, and writes require explicit
owner confirmation and audit. Both preview D1 resources remain synthetic.
Exact-SHA Cloudflare deployment must be successful.

## Phase 5 — retire public admin surfaces, not public services

Prepare a SEPARATE protected GitHub PR against `main` after Gate 4.
Remove/retire these PUBLIC owner-only static pages and their dedicated APIs:
- `member-operations.html`, `member-operations.js`, owner-specific scripts
  and styles (only if no public page uses them)
- `diagnostics.html`, `diagnostics.js`, `diagnostics.css`
- `functions/api/owner-ops.js`, `functions/api/owner-members.js`,
  `functions/api/kofi-diagnostics.js`, `functions/api/kofi-member-issue.js`
- Owner-only POST actions in **shared** `ad-entitlement` and
  `field-expansion` routes must be carefully removed without deleting
  their public GET/member functions.
- Eliminate sitewide navigation, sitemap, documentation and search links
  pointing visitors to old admin paths; use `404` or `410` for legacy URLs,
  NOT open redirects that could carry owner credentials.

**Must remain public and functional:**
`kofi-webhook` payment intake, ordinary membership functions,
`site-presence` lease recording, community profile/recovery,
ad-free public GET, evidence/collection member APIs, Hive/Arcane games,
Cloudflare security sweeps and scheduled jobs.

Verify protected GitHub `site-quality` + `release-coordination` plus
security sweep. Confirm actual public Pages production commit matches
merged SHA, public member/Ko-fi flows still work and public old admin API
returns 404/410 without leaking data. Confirm private admin still works.

**Gate 5:** Public site no longer hosts privileged owner endpoint code;
live admin retains access, isolated synthetic preview still passes.

## Rollback / safe defaults

- **At any failed Gate 1–3:** do NOT bind live data. Disable preview branches,
  or restore previous Pages root/build settings and existing staging branch.
- **At a failed Gate 4:** set `PRIVATE_ADMIN_ENABLED=false` immediately;
  revert admin Pages production bindings to prior synthetic mapping and
  restore old production branch/build settings; public admin routes are still
  present. Never dump, truncate, or restore production user data.
- **At a failed Gate 5:** revert the public retirement PR via normal protected
  GitHub workflow; do not roll back D1 data.
- Do not delete the testing branch, production webhook code, Cloudflare Access
  policies, or any D1 database during the migration.

## Current verification / blockers

The synthetic test branch and admin branch have been prepared in GitHub.
The existing Cloudflare project has **not been reconfigured** as part of this
preparation. Cloudflare management connectivity had previously failed;
if it fails again, stop before any project binding or branch change.

This package is intentionally not merged to public `main`: when the public
Pages output uses repository root, an admin source directory should not
be inadvertently published as static files. Promote only within the
separate protected Pages project using its dedicated project root.

Issue tracker: https://github.com/Squackle/deep-cuts-edh/issues/74
