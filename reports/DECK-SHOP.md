# DeepCutsEDH Rescue Report premade decks

## Shared design
The normal Rescue Report template automatically loads a collapsed section:
SEE DEEPCUTS PREMADE DECKLISTS. Budget, Standard, No Limit each open
to a free, role-grouped 100-card list. Only opened tiers build their card UI.
The sidebar has one small anchor link to the section.

Four case files are seeded with editorial WORKING BUILDS. The Ekthi
case is a preview and must receive release/legal review first. New cases
inherit the same controls; tiers without data say 'In preparation'.

## Accuracy and current limits
- Automated checks verify exactly 100 cards, singleton nonbasic cards,
  all specified commanders, category coverage and land-count bounds.
- These drafts are NOT independently verified for current Oracle wording,
  every color identity, mana curve, strategic quality, gameplay, or actual
  TCGplayer prices and stock. Reviewed remains false for all twelve.
- Budget, Standard and No Limit refer to intent, NOT guaranteed totals.
- The exported decklist contains only quantity and card names, without
  function-group headers, for deckbuilders and TCGplayer Mass Entry.
- No customer data, live prices, D1, KV, session, payment or tracking change.

## How new reports inherit it
Every report using reports/guide.js, reports/guide.css,
.report-content, .report-side, and a rescue-data JSON element inherits
the shared section. An editor adds grouped cards to the manifest:
reports/deck-shop-config.json -> cases -> report-slug -> budget,
standard, noLimit -> groups (object of role titles to card-line arrays).
Each card line is e.g. '1 Sol Ring' or '14 Plains'. No code editing is
required for normal report content or new price-tier additions.

## Before a list can be approved and shoppable
1. Verify Wizards' current Comprehensive Rules and Commander banned list;
   inspect Gatherer Oracle text, color identities, commander eligibility,
   correct card names and the release date (especially preview Ekthi).
2. Playtest the decks for consistent mana, relevant interaction and wins.
3. Price the actual 100 cards including printing, condition and shipping;
   adjust Budget and Standard to defensible dollar targets.
4. Set tier.reviewed=true only after human legality/editorial approval.
5. Wait for actual TCGplayer affiliate approval; then obtain an accepted,
   tested deck-specific referral URL (not a generic product search).
6. Verify the complete cart, affiliate attribution and disclosure;
   set checkoutUrl and checkoutUrlReviewed=true only after validation.
7. The owner must separately approve switching affiliate.active=true.
   The daily readiness check may prepare a GitHub DRAFT PR, not auto-merge.
8. Preserve free access to all complete lists even when links activate.

## Tests
node --test reports/deck-shop.test.mjs
node --check reports/deck-shop.mjs
node --check reports/guide.js
CI: .github/workflows/rescue-deck-shop.yml

Rollback: revert the deck-shop module, config and appended guide.css
changes. No production database data is modified.
