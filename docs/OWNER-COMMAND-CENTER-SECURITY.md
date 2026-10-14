# Owner Command Center: staged UI and Cloudflare Access rollout

Prepared October 14, 2026. **Status: feature branch / PR only. Do not activate a new production login barrier before owner testing.**

## Current implementation

- `/member-operations.html` now loads `owner-dashboard.css` and `owner-dashboard.js`.
- Operations are grouped into Overview, Memberships, Directory, Free Access, Evidence, Ad-free, and Tools; one section is visible at a time.
- The operator key stays in a compact global field, is not persisted, and is still required for each protected backend action.
- **Lock & clear** empties the in-memory key, one-time issued credential, loaded private records, and local form contents.
- A 15-minute inactivity timer clears local privileged content, including when returning after the tab was idle.
- The dedicated static admin route gets `Cache-Control: no-store, private`, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex,nofollow,noarchive`, and `Cross-Origin-Opener-Policy: same-origin` in `_headers`.
- None of these client-side additions is a substitute for server authorization or full SSO. Users can still fetch the unprotected static HTML until Cloudflare Access is configured.

## Cloudflare state checked October 14

- Zero Trust organization is configured.
- The configured identity provider type is `cloudflare`.
- No Access applications were configured at inspection time.
- Owner-only API routes currently verify the independent `dcissuer1_` bearer credential against a server-side hash. Mixed-purpose endpoints are **not** universally safe to put behind an Access application.

## Recommended identity security: Cloudflare Access

**Phase A: existing Cloudflare identity provider (simplest initial route)**

1. Confirm the Cloudflare owner account is secured with a passkey or security key and MFA.
2. In Cloudflare Dashboard -> Zero Trust -> Access -> Applications, create a **Self-hosted** application for the admin URL path `deep-cuts-edh.pages.dev/member-operations.html`.
3. Create an Allow policy for **only the intended owner** using the Cloudflare Account Member selector **plus** a narrowly scoped identity/email selector if appropriate. Do not allow all email domains, all Google users, or the whole Internet.
4. Use the already-configured Cloudflare identity provider; set a short Access session duration (e.g., 1 hour or less for sensitive operator tasks).
5. Include paths that directly expose private owner-only APIs (at minimum `/api/owner-members` and `/api/kofi-member-issue`) as separate protected application paths where this does not block public features. Keep the operator key checks.
6. **Do not** apply blanket Access gating to shared/public routes such as `/api/ad-entitlement` (public GET) or `/api/field-expansion` unless the public and owner paths are split first. Their privileged POST actions are still protected by the operator bearer key; a later server-side Access JWT verification layer can specifically enforce verified SSO for owner-only mutations.
7. Cover every reachable production hostname, custom domain, preview and `pages.dev` bypass route. A hostname-only Access rule is not enough if an unprotected alias or preview can reach the same admin entry point.
8. Test with the real owner's browser in a **new private window**: expected login prompts and allow policy, authorized admin read, forbidden anonymous read, denied wrong identity, logout, 401/403 behavior, and no regression in public site pages.
9. Only after access and rollback are verified should the application be enabled for the production admin page. Keep a known Cloudflare dashboard rollback path.

**Phase B: optional 'Continue with Google'**

If the owner specifically wants Google account login rather than Cloudflare-account sign-in, add Google's OIDC as an identity provider through Cloudflare Access's **Generic OIDC** integration. Personal Gmail does **not** by itself imply a Google Workspace tenant. This requires creating a Google Cloud OAuth client and completing an OAuth consent configuration, then privately entering Client ID/Secret in Cloudflare; don't commit these to GitHub.

- Cloudflare callback URI follows the provider's `https://<team>.cloudflareaccess.com/cdn-cgi/access/callback` format; copy exact URL from dashboard.
- Restrict Access Allow policy to the *specific verified owner identity* and maintain MFA/passkey on Google account.
- Test identity claims, auth flow, session expiration and authorized/denied states before switching login methods.
- Google OAuth authenticates the person; Cloudflare Access authorizes admission; the app's owner bearer-key remains a second check for sensitive actions.
- Never use a Google ID token sent by frontend JavaScript as sole proof of admin authorization.

## Security acceptance

- [ ] All existing privileged endpoints continue rejecting requests lacking a valid owner credential.
- [ ] Overview never claims the user is authenticated merely because a key is typed.
- [ ] Browser key and one-time credential are cleared by explicit Lock and on idle.
- [ ] No private data or plaintext keys are stored in localStorage, sessionStorage, URL, analytics or logs.
- [ ] Successful owner-only requests require allowed Access session **and** app-level owner permission, once Access protection is activated and fully scoped.
- [ ] Owner-allowed, owner-denied and logged-out scenarios are tested across all URLs.
- [ ] Public homepage, Field Network, card library, and public ad-entitlement GET remain reachable.
- [ ] Mobile navigation works, no horizontal overflow; tab change preserves entered forms until locked.
- [ ] Automated regression checks and manual browser checks pass before production.
- [ ] Paid Ko-fi feature readiness flags stay unchanged.

## Official technical references

- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/
- https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/cloudflare/
- https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/generic-oidc/
- https://developers.cloudflare.com/cloudflare-one/access-controls/policies/
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
