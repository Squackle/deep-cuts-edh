# DeepCutsEDH — Repeatable Security Sweep and Remediation Runbook

Owner Command Center > **Security > Security sweep** links directly to
[Security sweep (on demand)](https://github.com/Squackle/deep-cuts-edh/actions/workflows/security-sweep.yml).

## How to run (any time)

1. Sign in to GitHub as a repository maintainer. From **Actions**, open **Security sweep (on demand)**.
2. Select **Run workflow**, branch **main**, with **safe live checks** on (or off if testing offline).
3. Wait until the workflow completes. Open its run and download the **deepcuts-security-report** artifact. It contains `report.md` and `report.json`.
4. Read findings by status: **confirmed**, **potential**, **manual-review**, **not-tested**. An automated pattern match is not evidence of exploitable access.
5. Create a *private* security tracking issue/PR where necessary. Never publish active secrets, exploit payloads, recovery codes, or customer records.
6. Fix confirmed issues on a dedicated branch. Link targeted regression tests, CI results, and the exact successful Cloudflare production deployment before marking a finding **closed**.

## What the automated job actually does

- Walks versioned JS/API, web assets and GitHub workflow sources; identifies risky code execution/backdoor-shaped constructs, hardcoded secret shapes (without printing secrets), HTML injection sinks for manual review, owner-key browser persistence, and dangerous CI privileges.
- Checks server owner-authorization guards, nomination and feedback verification controls, owner no-store rule, and coordination workflow markers.
- Inventories API files and flags POST routes with no obvious authorization indicator for inspection.
- Runs **non-mutating anonymous GETs** to the public homepage, nominations page and protected admin pages/APIs, plus a representative hashed deployment alias. Only HTTP status and path are reported. No auth attempts, input fuzzing or private response bodies.
- Validates the scanner's own negative/positive/redaction tests. Stores a sanitized Markdown/JSON report as a short-retention GitHub Actions artifact.
- Fails security CI for missing server owner-auth guards or a currently exposed privileged Access route. Other potential findings are surfaced, not automatically declared exploits.

The scanner is **not** a replacement for manual code review, CodeQL/taint analysis, authorized staging penetration tests, platform configuration checks or third-party audits. It cannot guarantee there are no backdoors. A pass means only that the recorded controls were checked at that moment.

## Deep manual audit checklist (owner/developer-led)

**1. Architecture & authorization**
- Capture current main commit and exact live Cloudflare production deployment; diff all server Functions routes, Worker cron jobs, GitHub workflows and Cloudflare Access applications.
- Test access matrix: anonymous, free profile A, free profile B, expired paid member, valid paid member, authenticated owner without bearer key, authenticated owner with bearer key.
- Use synthetic fixtures to verify BOLA/IDOR protections for private collections, decks, recovery emails, dispatches, activity, membership, grants and moderation. Do not probe real users.

**2. Owner / Cloudflare Access**
- Inspect exact-email allow policy and independent TOTP; enumerate primary and hashed Pages URLs including new preview variants.
- Verify anonymous and non-owner denial; owner MFA success must be tested by owner, not simulated as passed.
- Confirm `/member-operations.html`, `/member-operations`, `/api/owner-members`, `/api/kofi-member-issue`, and `/api/owner-ops` plus sensitive operations on public mixed-purpose APIs.
- Confirm 15-minute lock clears DOM, in-flight API responses and plaintext keys; no browser storage, source log or query-string leaks.

**3. User sessions & account recovery**
- Staging account ownership, expiry, revoked device login, lost-key recovery, single-use challenges, replay, mail verification and rate limits. Use at least two separate accounts.
- Browser cookie attributes, cache/control and CSRF/origin enforcement. No credential guessing.

**4. Payment and memberships**
- Ko-fi webhook token verification, replay/idempotency, cancellation, expiry, tier mapping, ownership checks, paid-versus-complimentary differentiation and ad-free reconciliation.
- Replace/rotate/revoke sessions, check that old keys stop working. Synthetic fixture only; no live billing.

**5. Injection/data integrity**
- Review input-to-output handling for comments, feedback, nominations, avatar/bio, Evidence Board, deck lists and editorial notes. Test stored/reflected/DOM XSS in isolated fixtures.
- Verify all DB queries parameterized, unique constraints and authorization in same transaction where necessary. Review SSRF outbound fetch allowlists.
- Verify owners cannot accidentally approve duplicate nominees or lose legitimate votes.

**6. Games and leaderboards**
- Verify authoritative Hive Run main-site replay, score/rules versions, one-time sessions, ranking segregation from Game Lab and archived scores.
- Test signed-in daily attempts, achievement forging, cross-account submission, duplicate rank submissions; never mutate real scores.

**7. Infrastructure and supply chain**
- Review Cloudflare D1 Time Travel and restore runbook without initiating a restore; env bindings/prod vs Lab; logs and secret redaction.
- GitHub actions effective permissions, PR protection/rulesets, third-party action pinning, supply-chain dependencies, exposed repository history.
- Search Console/AdSense configuration only via connected read-only dashboard checks; do not confuse configuration with approval.

## Finding classifications

- **Confirmed:** reproduced safely; record expected/actual behavior and evidence.
- **Potential:** static or configuration risk requiring reproduction; do not advertise as exploitable.
- **Manual-review:** high-value audit target not decisively testable with current automation.
- **Not-tested:** requires authorized staging data, owner MFA, third-party privilege or time.

For each verified finding, record finding ID, severity, impact, affected component, safe reproduction, correction commit, regression test and deploy SHA, status (open/closed), and date verified. A PR merge alone does not close a vulnerability until production behavior is checked.

## Targeted incident response — avoid website-wide outages

If a credible critical exploit is active, **notify the owner** with the affected route, risk and containment options first. Only disable the specific compromised workflow (for example new nominations, feedback, a member issuance endpoint or an affected game submission route) if the owner approves or the affected service has an existing safe feature switch and a time-sensitive exploit requires immediate containment. Leave unrelated game, public and profile services running. Preserve evidence, avoid deleting D1 records. Never disable Cloudflare Access / MFA to troubleshoot. Document resumption and rollback conditions.

- `public_nominations` and `public_feedback` toggles are already available in **Site > Feature switches**; use them only when that feature is implicated.
- No general kill-switch exists for arbitrary APIs; implement a scoped server-side switch with tests **before** using it for containment.
- Restore old Cloudflare Pages deployment if a released code change causes a regression; do not roll back the D1 database without approval and a verified bookmark.

## Known gaps

An automated GitHub workflow cannot authenticate as the owner without violating key/MFA hygiene. Cloudflare account policies are not versioned with the repository and therefore require periodic read-only API checks. Scan results do not prove exhaustive detection of hidden backdoors, all downstream libraries, user-data isolation or fraudulent payments. Do not claim those areas 'passed' from static source checks.

**Baseline:** The first recorded sweep is the security workflow associated with the PR introducing this file. Subsequent owner-triggered runs should target the current `main` branch.
