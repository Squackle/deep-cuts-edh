# Phase 1: preserve an isolated security-testing lane

**Scope:** GitHub branch `security/isolated-test-lane-20261020`, copied from the previously successful staging-security branch at `aca318901d371f5d7c88de1463ff9500d74fa2e5`.

**Current owner request:** Prepare this isolated test branch for an eventual conversion of the Cloudflare Pages project `deepcuts-edh-security-staging` into the private admin portal. Do not change any production DB bindings, live owner authorization, member records, keys, or main website configuration in Phase 1.

## Cloudflare Pages target
- Project: `deepcuts-edh-security-staging`; retain current production branch `coord/isolate-security-staging-20261019` until admin portal code is tested and approved.
- Set Git integration `preview_deployment_setting: custom`, `preview_branch_includes: [security/isolated-test-lane-20261020]`, and `preview_branch_excludes: []`; **no `*` includes**.
- Confirm preview `DB` points to the synthetic D1 `deepcuts-security-staging-db` (`e1ca9158-1767-49c6-b4db-4ef8626b6b75`); preview `HIVE_DB` points to synthetic D1 `deepcuts-security-staging-hive` (`fda85a95-0613-43a7-898c-baa2ff20b643`). Never bind production D1 UUIDs in preview.
- Retain only synthetic secrets in preview. Keep `SECURITY_STAGING=true` and the other dummy security-fixture values; never copy live Ko-fi/email/provider tokens to preview.
- Branch preview alias: `security-isolated-test-lane-20261020.deepcuts-edh-security-staging.pages.dev`. Verify actual Cloudflare-generated hostname before treating it as ready.
- Cloudflare Access: require an owner-only allow policy covering the canonical staging project hostname **and all preview deployment hostnames** (wildcard), with no anonymous allow or bypass policies. Assert anonymous GET `/`, `/security-staging-acceptance.html` and `/api/security-staging-harness` all redirect through Access **before** giving anyone a link or performing authenticated tests.
- The security harness only accepts the exact canonical staging and dedicated test preview hostname, requires the staging env marker and an Access assertion, uses fake credentials and synthetic records, and cleans up fixture rows after testing.

## Acceptance / gate
1. Readback project source confirms precisely the one allowed preview branch (not all branches).
2. Readback both preview D1 bindings confirm the two synthetic IDs above, not live DB/HIVE_DB.
3. GitHub Actions validates staging harness syntax, the exact branch guard, and anonymous Access redirects for the canonical and dedicated preview routes.
4. Preview deployment status = `success`; deployed SHA equals test branch head. Positive owner authenticated synthetic test suite 13/13 PASS after protection confirmed.
5. Keep main website and Game Lab unchanged. Admin portal migration in later phases is a separate controlled deployment.

## Rollback
Set `preview_deployment_setting: none` on the staging Pages project, leaving its production branch/production DB bindings intact. The test branch and its source may remain archived; revoke preview-specific Access policies only once no preview is served.

## Evidence
Tracked under https://github.com/Squackle/deep-cuts-edh/issues/74.
