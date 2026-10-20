# Rescue Report deck shop — editor runbook

This is a presentation feature, not a card store or fulfillment service.

All standard Rescue Reports load reports/guide.js and reports/guide.css; this
loads the same Budget / Standard / No Limit panel for existing and new cases.
New reports must keep the usual .report-side sidebar and #rescue-data JSON.

## Current state
- There is NO connected or approved affiliate checkout. Buy actions are disabled.
- Existing core packages are not represented as 100-card decks.
- There are no external affiliate scripts, user tracking, payments, D1 or Workers KV.
- The Commander Mustard $100 target is editorial and is NOT a live market price.

## Adding a tier
Edit reports/deck-shop-config.json. Under cases add a slug matching the report URL.
For each tier (budget, standard, no-limit), add:
- targetUsd: optional editorial target (do not call it a live price)
- cards: the full deck as an array of lines in '1 Card Name' format
- reviewed: true ONLY after independent editorial and Commander-legality review
- checkoutUrl: your manually validated approved deck-specific affiliate URL
- checkoutUrlReviewed: true ONLY after testing the complete retail cart

The cards array must total exactly 100, including all commanders. Basic lands
may be repeated. Structure is automatically validated, but color identity,
banned cards, Oracle correctness, availability, synergy, budget and gameplay
require independent human review. Each tier's list remains freely readable.

## Affiliate activation
1. Obtain approval for TCGplayer's affiliate program.
2. Confirm the approved bulk-deck handoff method and destination terms.
3. Verify each link really populates the selected 100-card deck and preserves
   your authorized commission attribution. A general card search is not enough.
4. Use per-tier HTTPS links on the approved affiliate host
   (partner.tcgplayer.com or tcgplayer.pxf.io).
5. Enable affiliate.active in the central JSON manifest through a reviewed PR.
6. Check mobile cart, printing substitutions, shipping and final price.
7. Confirm any Wizards fan-content and advertising requirements.

Until ALL requirements above are satisfied, Buy stays disabled regardless of
whether a list is marked complete. Do not switch on affiliate.active early.

## Testing
Run: node --test reports/deck-shop.test.mjs
Then require normal site quality and browser tests on the PR.
Rollback: revert the guide.js loader and guide.css style addition; new files
then remain inert.

## Free premade decklist library
- reports/premade-decks.json stores current four cases with three grouped 100-card editorial drafts each.
- These drafts have not been fully Oracle/color-identity or price verified; preview Ekthi also needs a release check. They must not be sold as verified lists.
- reports/premade-decks.mjs renders one initially collapsed SEE DEEPCUTS PREMADE DECKLISTS section after the starter core, with three independently expandable tiers, role categories and Copy actions.
- To add a case, add a matching slug to the deck manifest. Existing and future reports that load reports/guide.js inherit the panel; if no deck exists the tiers say Coming soon.
- The affiliate process must independently verify final card names, Commander legality, cost and a working tracked cart, then arrange per-tier checkout configuration; it must not treat a successful HTTP redirect as proof of commissions.
