# Deep Cuts EDH — Site Quality + Navigation Consistency Release

Prepared October 14, 2026. **Base production commit**: `af0203b0746e716aee2663fbb2aa02e3cd459187`.

## Included in one production deployment
- Standard eight-label top navigation in this exact order on every main page:
  **RESCUE REPORT · COMMANDERS · CARD LIBRARY · DECK WORKSHOP · DAILY GAMES · NOMINATIONS · FIELD NETWORK · FIELD OFFICE**.
- Mobile header shortcut is also **DAILY GAMES**, never "GAMES & ARCADE".
- Canonical URLs, on-site links, sitemap and social metadata use Cloudflare Pages clean document URLs, without breaking legacy redirects.
- Homepage updates to all **four daily games** while retaining a prominent **Hive Run** link.
- Streamlined two-primary-action hero and three contextual links.
- Field Network adds three beginner-friendly buttons using the *existing* tab routing.
- Accessibility: 404 uses a correct H1, new controls have ≥46px targets, keyboard focus is visible, reduced-motion users get no unnecessary link motion.
- Static security headers through `_headers` and corrected robots crawler exclusions.
- Lazy offscreen static illustrations in article and utility pages where safe; no changes to required scripts, game engines, API, DB, billing, subscriptions, existing scores, or authentication.

## QA and safeguards
- Check `node scripts/site-release-check.mjs`; it validates every public page's canonical, standardized nav labels/order, sitemap, game links, security policy, SEO, profile onboarding, and existing-game assets.
- Check `node --experimental-default-type=module --test tests/arcane-daily.test.mjs`.
- JS syntax checks are required by `.github/workflows/site-quality.yml`.
- Compare browser layouts at 320px and 390px, plus tablet and desktop, particularly header, hero, four games, community onboarding.
- Smoke test four daily puzzle APIs, Hive Run, Field Network account access, member ad-free flow, and the exact clean URLs.
- Cloudflare production must show `success` for the squash-merged release commit.

## Deployment and rollback
Stage via this GitHub feature branch; merge **once** as a squash commit to `main` after checks pass. Do not publish a second release just for docs. If a regression occurs, revert the *single squash commit*, review, then deploy the revert.

## Important limitations
- The CSP intentionally only constrains framing, <base> origins and plugins. Existing AdSense, Scryfall and Turnstile script behavior is preserved; a full nonce/hash-based script CSP is a separate release.
- `_headers` applies to Cloudflare Pages static paths; endpoints served by Functions should be audited separately.
- Canonical fixes are not an automatic Google-indexing guarantee. URL Inspection and resubmission to GSC are follow-up administrative actions.
- Product-specific arcade names may still use "ARCADE" in **content headings**, not in the shared navigation.
