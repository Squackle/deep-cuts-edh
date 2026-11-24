# DeepCutsEDH maintenance handbook — Website

This is a buildless Cloudflare Pages website, not the standalone Lab. Start with AGENTS.md and docs/DEVELOPMENT-LANES.md; use current main and exact PR SHA, not an old chat archive. Owner approval is required before production promotion, data/schema changes, secrets, payment or access changes.

## Source navigation
| Symptom | First source to inspect | Focused test / check |
|---|---|---|
| Shared navigation, new public page | root HTML, styles.css, header-profile.js, games.css | npm run check; tests/public-site-template* |
| Member authorization, recovery, remembered devices | src/member-auth.js, src/community-core.js, src/community-social.js, functions/api/profile-device.js | npm run test:unit; npm run test:workers |
| Owner-only tools | owner-v2.js, owner-dashboard.js, src/owner-access.js, functions/api/owner-ops.js | node --test tests/owner-v2-browser.test.mjs |
| Cloudflare response headers / routing | _headers, _redirects, _routes.json, functions/ | node --test tests/security-sweep.test.mjs; npm run check |
| Games / replay | games/, src/hive-server/, functions/api/stackbreaker.js, functions/api/graftbound.js; game-specific promotion docs | npm run test:unit; npm run test:workers; npm run test:browser |
| Daily puzzles / publishing | workers/daily-puzzle-clock.js, workers/, corresponding daily/publishing API and tests | inspect failing workflow job before reading entire repo |
| D1 schema and recovery | db/, games/hive-run/db/leaderboard.sql, db/OPERATIONS.md | python3 scripts/recovery-rehearsal.py (synthetic subset only) |
| Release gates | .github/workflows/, scripts/release-coordination.mjs, scripts/security-sweep.mjs | node --test tests/release-coordination.test.mjs tests/security-sweep.test.mjs |

Node 24 is the CI reference. Start with npm ci --ignore-scripts, then npm run test:unit, npm run test:workers, npm run test:browser (install Chromium first with npx --no-install playwright-core install chromium), npm run check. Use targeted files first, full required CI before merge. Browser tests use local fixtures; don't replace async request assertions with sleeps, broad retries or removed checks.

## Maintenance without AI

| Cadence / trigger | Automated check | Human only on exception |
|---|---|---|
| Every PR | required release-coordination + site-quality; proposed #150 adds full unit/workerd/Chromium gate | open red job and exact SHA; investigate real failure, don't waive |
| Daily 13:25 UTC | security-daily.yml | investigate failed Access / public route; inspect sanitized findings, never paste credentials |
| Daily 10:17 UTC | arcade-nightly-synthetic.yml | distinguish fixture regression from deployed outage |
| Weekly Monday 14:41 UTC (after #150) | locked npm audit | fix high vulnerability with compatible lock regeneration; review Dependabot PRs |
| Monthly day 1 14:31 UTC (after this PR) | synthetic database backup/restore | review failure, verify schema and local integrity; does not prove D1 Time Travel |
| Deployment | Cloudflare existing deployment failure notification; verify canonical Pages exact commit | investigate build or deploy stage, rollback only with owner authorization |
| Puzzle schedule | Worker cron 05:15 and 06:15 UTC; weekly publisher Friday 15/16 UTC quarter hours | verify actual execution logs, not just configured triggers |

Check first scheduled runs after each merge: open Actions workflow history on main; verify event=schedule, exact SHA, expected job results, UTC run time, summary and failure-notification destination. For existing Worker crons inspect actual invocation success / errors and expected puzzle/publisher output, without manually triggering production mutations. A schedule or successful upload isn't proof of invocation. Missing scheduled run may be GitHub delay or disabled workflow, not automatically an outage. Never add a second notifier for the same failed workflow. Keep GitHub Actions notifications and Cloudflare native failure notifications; use manual review for a single distinct incident, no recurring AI status reports needed after the gates are proven. Existing owner-approved ChatGPT schedules are not automatically changed here.

## Release & rollback

1. Inspect both main SHAs and open PRs. Check file overlap against all earlier branches, route to correct owner, verify exact candidate head and merge ref. All required and relevant optional tests must pass; a deployment check failure is not ignored because it is optional.
2. For game promotion: require exact tested Lab SHA and rules/challenge/replay versions, separate website integration PR, migration compatibility and historical-score preservation. Verify shared header template, offline regression, replay and authorization. Owner explicitly authorizes production release; Lab success is not promotion approval.
3. Record previous successful canonical Pages SHA/deployment ID; new PR head, merge SHA, checks and approval. For D1 migrations record separately authorized backup/bookmark and compatible rollback before any mutation. Never mix data migration with routine QA changes.
4. After approved merge, compare canonical deployment trigger commit with expected main SHA, check deployment stages success, use low-volume anonymous GETs for affected public routes and Access-denial checks. Never submit real scores, authenticate using shared keys, or post production test data.
5. Failure: stop further promotion; separate code, build configuration, data, or provider failure. Revert scoped commit via review or restore previously verified deployment via owner-approved procedure. Code rollback cannot undo D1 writes. Don't restore production D1 blindly. Confirm rollback SHA and route checks, record evidence in Control Room.

Known Nov 24 external check: separate Workers Builds command `npx wrangler preview` fails because Wrangler configuration lacks previews block; both canonical Pages deployments are healthy, automatic Pages previews disabled. Do not add preview configuration or switch deployment platform to silence red status. Owner must review obsolete/parallel integration and either configure isolated preview deliberately or retire unintended build trigger after confirming impact. See issue #95 and #108; no changes to bindings or production access allowed by this document.

## Recovery rehearsal and real recovery boundaries

`python3 scripts/recovery-rehearsal.py` constructs temporary databases using the checked-in nomination, base community and Hive historical/versioned score DDL. It backs them up, simulates loss of synthetic records, restores to new databases, verifies logical SHA-256 digest, SQLite integrity/foreign keys, critical synthetic history, rejects overwriting an existing target and invalid snapshot. No arguments/remote access. It does NOT cover every later migration, cloud restore, actual database backups, payment or identity acceptance. Record only sanitized success/failure, never row contents.

Actual D1 Time Travel: owner confirms both DB/HIVE_DB backup/bookmark availability privately, isolates a new synthetic-only destination (not live), rehearses restore using synthetic fixtures and checks integrity and app behavior. No production row export to a shared repository, chat, or preview. Obtain separate approval before actual restore, retention deletes or index/schema migration. See docs/D1-RETENTION-AND-STAGING-AUDIT.md and db/OPERATIONS.md. Issue #95 stays open until owner-gated evidence exists.

## Escalation / remaining issues

- #38: owner MFA/Lock & clear, second synthetic account role matrix, GitHub security toggles; no real credentials in logs.
- #87: staged CSP and Trusted Types report-only, measured PageSpeed and provider compatibility. No blanket header enforcement or third-party changes without review.
- #95: actual D1 Time Travel, retention/index approval, cron invocation and alerts.
- #108: gated private admin cutover, separate production/preview binding and Access acceptance. Historical prepared branches are not current deployed authority.
- AI is most valuable for novel replay/auth/security bugs, cross-repo architecture, data migrations, investigation of unexplained persistent incidents. Ordinary check review, compatible dependency PRs, backup rehearsal and documented promotion steps do not require AI reasoning. Escalate to the correct owner, not all agents simultaneously.
