# Deep Cuts EDH — Owner Command Center 2.0

This is a production admin workspace at `/member-operations.html`, not a public site feature.

## Navigation
Home shows a short welcome and six workspace buttons: Content, Community, Games, Business, Site, Security. Inside each are plainly named tools. A user can return to Home or a workspace without losing their auth session. Layout is responsive, with deep green, parchment, and gold accents.

The existing authenticated owner forms and API contracts remain intact: Ko-fi issue/replace/revoke, free-key issue/extend/rotate/revoke, member directory, evidence moderation, and ad-free reconciliation.

## New real functionality
- **Nominations / Moderation:** review pending nominations, read rationale/votes, approve/reject with confirmation, preserve existing vote rows; inspect pending comment reports and resolve/dismiss. Moderation does not silently delete a comment or merge duplicate votes. Review duplicates manually before approval. The weekly nomination-review automation continues separately.
- **Feedback:** review public bug/feature reports and mark reviewed/resolved, without deleting user feedback.
- **Publishing:** store internal research/draft/review/ready/published editorial *workflow status*. This does NOT create a published Rescue Report page or edit actual report articles. Publishing still requires the editorial checklist and an appropriate deployment.
- **Games / Integrity:** recorded daily puzzle runs, Hive Run verified score aggregates by mode/rules version, session-count comparison. DOES NOT measure anonymous game sessions, definitive fraud, detailed boss defeat events, or rejected-replay reasons unless those are recorded in a separate future system.
- **Site / Schedule:** production D1 counts, recent sanitized webhook event classifications and audit actions, latest cached puzzle generation dates. External service availability needs Cloudflare/GitHub.
- **Revenue / Activity:** Ko-fi webhook-derived event totals, verified renewal counts, ad-free manual records, community participation. NOT true bank reconciliation, AdSense earnings or unique visitor analytics.
- **Feature switches:** controlled pause/resume for public new nomination/voting POST and feedback POST; no change to existing public content. Both default ON. The switches are audited.
- **Search & indexing / Backups & recovery:** links to Google Search Console, AdSense, Cloudflare and D1 operations. No false indexing, backup-status, deployment, approval or restore claims. Do not try to run recovery actions through the browser.

## Security
- Cloudflare Access protects /member-operations.html, /member-operations, /api/owner-members, /api/kofi-member-issue, and /api/owner-ops on both production and hashed *.deep-cuts-edh.pages.dev aliases. Owner-only email policy with TOTP and one-hour session.
- Every privileged v2 API request additionally requires the existing owner bearer key via `ownerAuth`. The browser never stores or logs it.
- UI Lock & clear and inactivity lock (15 minutes) remove locally displayed new private operational data as well as existing membership forms and one-time keys.
- Server-side actions use an explicit allowlist and append internal audit records to `owner_action_audit`. No arbitrary SQL, generic account impersonation, external credential export, ad earning simulation, or public read of private data.
- This deployment does not expose a website-wide arbitrary feature flag framework or server-side remote deployment triggers.

## Required migration
On the existing production Cloudflare D1 database `deep-cuts-nominations` (bound as `DB`), apply **`db/owner-command-center-v2.sql`** before deploying this version. It only adds three tables and two default enabled rows; no existing records are modified. Take a D1 backup/bookmark first.

After application, check table creation and both default enabled flags before deploying. Rollback for the front-end/API is to deploy the preceding production commit; leaving the three inert tables is safer than deleting them.

## QA and acceptance
- Check browser and navigation at 320/390/768/1280 pixels, with no horizontal overflow and no duplicated or lost existing forms.
- Exercise owner-v2 API authorization denial and real, authorized GETs without exporting private user information.
- Run simulated action tests for all mutation controls. Do not create fake payments or modify live nominations/feedback merely for smoke testing.
- Verify live Cloudflare Access redirects anonymously and public home, nomination and feedback forms remain reachable, then confirm post-merge GitHub CI and production commit.
- A logged-in owner should still personally test MFA and verify a read-only dashboard load. Key issuance is intentionally not an automatic QA action.

## Future integrations (not advertised as live)
Remote Cloudflare/GitHub service health and deployment control, Google Search Console and AdSense metrics, real visitor analytics/funnels, deeper Hive Run boss/failure telemetry, scheduled task controls, and D1 backup inventory/one-click restore all require additional secured credentials, event tracking and separate tests. Do not make interactive controls that pretend these work until they do.
