# Set Watch — upcoming sets and revealed cards

The new public **/set-watch.html** page automatically displays upcoming paper MTG sets and preview cards sourced from Scryfall. Discovery links are included on the homepage and the Card Library.

## Data and update system
- Cloudflare Pages Function **/api/set-previews** reads `https://api.scryfall.com/sets` and, for selected sets, `https://api.scryfall.com/cards/search?q=set:CODE`.
- Edge responses and Scryfall upstream data are cached for **four hours**. The next page visit after cache expiry fetches an updated Scryfall catalog. No manual post or site redeployment is needed when Scryfall adds a set or indexes a newly previewed card.
- This is an **on-demand auto-refresh**, not a background cron, subscription or notification service. If nobody visits, no refresh runs. Scryfall might index previews hours or days after external announcements.
- Include upcoming expansions, core, masters, Commander supplements, draft-innovation and starter releases, plus recently released sets (75 days). Exclude tokens, promo sub-products and digital-only sets to avoid misleading duplicates.
- Page supports set deep links (`?set=trk`), recent-release browse, all revealed cards, legendary-only filter and loading additional Scryfall catalog pages.
- Missing sets and new releases with zero indexed cards are displayed without invented previews. `cards_indexed` in the set metadata is **not** a confirmed total checklist size.
- Release dates and images belong to Scryfall and their licensors; some preview fields (including source links) are unavailable. Unreleased cards are explicitly **not asserted Commander-legal**.
- No automated Commander Rescue Report is published from preview data. Editorial case files still require manual preparation and review.

## Tests
Run `node --experimental-default-type=module --test tests/set-watch.test.mjs`.
CI runs automatically when Set Watch code changes. Audit the live page's desktop and mobile rendering and check that an upcoming product can load actual Scryfall cards.
