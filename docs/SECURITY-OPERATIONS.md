# DeepCutsEDH Security Operations

**Work order:** [Issue #68](https://github.com/Squackle/deep-cuts-edh/issues/68); related [security baseline #35](https://github.com/Squackle/deep-cuts-edh/issues/35) and [outstanding acceptance #38](https://github.com/Squackle/deep-cuts-edh/issues/38).

## Scope and operating boundaries

Protect the public site, free profiles, payments, Owner Command Center, Cloudflare/D1, and verifiable ranked games. AI is the security analyst and coordinator, not the 24/7 firewall or an automatic incident responder. GitHub, Cloudflare Access, application authorization and D1 enforce controls.

- Never expose private keys, recovery tokens, MFA, member records, private SQL output or raw security logs in GitHub, artifacts or chat.
- No intrusive production testing, real-player score/account edits, remote D1 migrations or disabling unrelated features for speculative findings.
- Use staging/synthetic identities and test data for auth bypass, replay, payment and account-isolation negative tests.
- Owner's authorization for security operations does not grant standing authority to deploy untested runtime code. Use reviewed PRs and normal release gates.

## Evidence and scheduling

October 19, 2026 GitHub readback: active Protect Production Main ruleset requires release-coordination and site-quality checks. Existing on-demand security-sweep workflow provides CodeQL and selected-path coverage. Newly proposed **security-daily.yml** executes the established safe scanner with a UTC cron, limited read-only GitHub permissions, mock authorization tests and 30-day sanitized artifacts, avoiding open overlapping Dependabot PRs #43-#45.

The cron corresponds to about 8:25 AM Central in daylight saving time and 7:25 AM Central in standard time. GitHub may delay or skip scheduled jobs. Do not claim the schedule works until an actual post-merge run completes and the scan report can be inspected.

October 19 Cloudflare readback: production Owner Command Center and preview alias Access applications present. New **DeepCutsEDH - New Security Insights** account-wide email alert enabled by Cloudflare API and verified on readback. Owner TOTP login and actual receipt of alert emails have not been verified. Further Pages failure alerts need documented filter values before enablement.

A ChatGPT task is configured for daily high-severity-change checks with a Monday weekly review, subject to connector access and user notification preferences. It cannot guarantee instant detection.

## Security triage

1. Capture timestamp (Central), affected surface, SHA/workflow/report link and facts, redacting private data.
2. Classify severity from *verified* exploitability: critical = confirmed active compromise; high = material reproducible authorization, payment or private-data breach; medium = limited or significant defensive gap; lower = observation or minor improvement. Scanner heuristics are not confirmed exploits.
3. If compromise is confirmed, propose scoped containment for the affected feature, with rollback, blast-radius and owner review. Avoid a blanket website shutdown based on suspicion.
4. Create a focused issue and branch from current main; check open PR overlap, add realistic regression tests, run necessary checks.
5. Validate a security change in staging, then production deployment SHA and safe smoke test when authorized.
6. Record what passed, what was not tested, and any remaining owner action in GitHub.

## Routine duties

**Daily:** scan results, new failed security checks, access changes, important Cloudflare notifications and releases. **Weekly:** summary of new findings, resolved issues, dependencies, alert status, privacy/payment/game risks and top three priorities. **Before sensitive deployment:** verify negative-auth tests and read-only smoke tests for account recovery, privileged routes, Ko-fi membership, leaderboard integrity and D1 bindings.

## Outstanding manual and staging acceptance

- Owner to test genuine Cloudflare + Microsoft Authenticator sign-in, owner-key read and Lock & clear without sharing credentials.
- GitHub Settings > Advanced Security: enable/verify Dependabot alerts and Private vulnerability reporting. Dependabot version-update PRs alone do not prove these are enabled.
- Two distinct synthetic user identities in a staging environment: private deck/collection IDOR, remembered-device revocation, CSRF/recovery replay, profile data boundaries, payments and forged game scores.
- Restore a sanitized D1 backup in an isolated database, without changing production.
- Evaluate adding security scanning to mandatory branch protection only after CI stability and false-positive review.
- Do not close issues #35/#38/#68 until supported evidence or explicit risk acceptance exists.

References: [OWASP ASVS](https://github.com/OWASP/ASVS), [Cloudflare Notifications](https://developers.cloudflare.com/notifications/), [Cloudflare Workers tests](https://developers.cloudflare.com/workers/testing/).
