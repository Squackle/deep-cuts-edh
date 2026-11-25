# Security, QA and reliability handoff
Snapshot: 2026-11-24; verify live GitHub and Cloudflare before relying on a status. Owner work order: Control Room #14, security #38/#68 and data gate #95.

## Start here (do not reread the whole repository)
- Site shell and browser JS: root HTML/CSS/JS; shared public header contract in AGENTS.md. API routes are functions/api/*.js.
- Free profile identity, request parsing, origin and rate limits: src/community-core.js; device/recovery routes profile-device.js and profile-recovery.js; community read/write/social split across src/community-*.js. Check docs/COMMUNITY.md and docs/FIELD-NETWORK-PORTRAIT-AND-DEVICES.md.
- Membership and owner boundaries: src/member-auth.js, src/owner-access.js, functions/api/member*.js, owner-*.js, kofi-*.js. Independent Access + owner bearer authorization; no secrets in docs or CI. Invalid explicit member bearer cannot fall back to another cookie identity. Entitlement depends on server verification, not UI state.
- Ranked games: functions/api/{hive-profile,stackbreaker,graftbound}.js and src/{hive-server,stackbreaker-verify,graftbound-verify}/. Source-pinned server replays and historical score isolation are release blockers. Feature flags/schema presence are not proof a game is enabled. Do not probe real ranked attempts or player records.
- Daily puzzles / scheduled editorial: src/automated-games.js, workers/daily-puzzle-clock.js, workers/weekly-rescue-publisher.js and workers/weekly-rescue-schedule.json. Verify actual invocation, outcome and time zone.
- Storage: db/OPERATIONS.md, db/*.sql and docs/D1-RETENTION-AND-STAGING-AUDIT.md. No remote mutation without separate owner approval. See docs/TESTING.md for local workerd/D1/browser fixtures.

## Evidence at baseline
Website main 762b1afb6d928b6dafb3501ac737adb60128bf8e, canonical Pages deployment successful at identical SHA. Lab main 0867b8d1aa7591a169e8b56b5b711a278a863423 likewise. Active website ruleset requires release-coordination + site-quality; strict up-to-date check enabled, no bypass actors, no independent reviewer requirement. Daily security run 45302276801: 34/34 synthetic tests, 681 scanned files, 15 findings/review items, 8/8 safe live checks. Severity breakdown not read. Arcade nightly 45275912727 succeeded. Cloudflare currently lists four enabled notification policies (Security Insights, production Pages deployment failures, expiring and leaked service tokens), and protected owner/staging Access apps with one-hour sessions. Current website preview DB/HIVE_DB and KV binding IDs differ from production; this is a configuration readback, not successful staging login or restore. No database rows inspected.

## Automated gates (proposed in this branch)
Required release-coordination now calls complete-local-audit and fails unless all unit, workerd and browser matrix jobs succeed. The same audit remains manually callable. Site-quality and every existing test assertion remain; separate PR invocation is removed to avoid duplication. Daily scanner includes extensionless Pages configs and fails on public GET failures as well as Access failure, while heuristic findings remain triaged. Weekly locked npm audit also runs on lockfile changes and fails at high/critical advisory level or inability to audit. Dependabot monthly grouped minor/patch npm updates remain PR-only. Review npm major bumps separately.

## Failure triage (no AI needed for first pass)

The audit matrix runs against the candidate merge ref. The separate coordination job reads the policy script and its contract tests from the PR base SHA before giving the policy script the read-only API token. A proposed policy change still runs through the candidate unit suite. Review workflow changes themselves as part of release acceptance.

1. Read failed job/step, exact SHA, test name and first exception; classify network, dependency, fixture, assertion or runtime. Do not blindly retry or disable assertions.
2. For local: npm ci --ignore-scripts; npm run test:install-browser; npm run test:unit / test:workers / test:browser; npm run check. Capture TAP counts and skipped cases. Explicit npm run test:live is separate.
3. If scheduled security fails, inspect sanitized artifact; a public GET failure is availability, not proof of compromise. Potential findings are not confirmed exploits.
4. A deployment-failure notification is evidence of failure, not permission to change production. Verify actual Pages environment and SHA. Revert only the reviewed PR when explicitly authorized; preserve prior successful Pages deployment as rollback target.
5. Keep one tracking issue per root cause; link later runs instead of opening duplicate issues. Never upload raw credentials or private records.

## Recovery rehearsal (owner-gated)
Read Cloudflare D1 Time Travel docs and db/OPERATIONS.md. Record source DB identity, schema migration sequence, recovery point, approved RPO/RTO and intended destination privately. For initial rehearsal, create or use an explicitly approved **synthetic-only** isolated database. Populate fixtures, verify constraints/counts, capture recovery point, perform restore there, then compare schema/integrity and synthetic row counts. Never restore over production, export real player rows to GitHub, or use preview data of unverified provenance. Record elapsed time, recovery point and pass/fail; escalate if recovery fails. Production restore and retention/index migrations remain separately authorized under #95.

## Open acceptance / follow-up
- Verify GitHub Dependabot alerts, private vulnerability reporting and secret scanning settings with owner; API connector cannot attest to all toggles.
- Owner MFA positive acceptance, synthetic non-owner/IDOR/revocation/payment flows and D1 restore remain tracked, even where local fixtures already pass.
- Security source scanner is heuristic with size/count limits and not a history scanner. Dedicated secure review for new critical findings; no speculative feature shutdown.
- Review live Pages deployment, staging acceptance and GRAFTBOUND feature enablement independently. Do not infer authorization from the presence of code or schema.
- Before claiming improvement active: exact PR head all required checks success; owner authorizes merge/production; observe first scheduled execution.
