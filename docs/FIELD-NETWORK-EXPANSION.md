# Deep Cuts EDH — Field Network Expansion

Production feature bundle — October 13, 2026.

## 1. Community Commander Evidence Boards

**UI**: `community.html#evidence` and a shortcut from **Case Discussions**.

Select one of the four existing commander case files, sort by community endorsements or recency, and file a finding with category (synergy, combo, budget replacement, weakness or matchup), 8–100-character title, 20–1,200-character explanation, and optional linked Scryfall card. Findings are attributed to the public investigator profile. Signed-in investigators can endorse other users' findings once, withdraw their endorsement, and withdraw their own finding. You cannot endorse your own finding. New findings are limited to 4/day per account and IP via the existing rate-limit system.

Editorial promotion: the owner can copy the 32-character finding ID from its URL, visit the **private member-operations dashboard**, and feature, unfeature or hide it using the pre-existing independently issued owner credential. A featured board finding is shown at the top and notifies its author. This **does not rewrite the site's static published editorial reports**; it is an explicitly labeled editor-featured community finding. The public record remains self-reported and not externally verified.

## 2. Private Card Collection & Budget Completion

**UI**: `community.html#collection`, linked from the Deck Workshop and Card Library.

A profile-key/device-cookie authenticated user can add individual card names, adjust copies (0 to delete), search their collection, and import a collection via pasted list or local CSV file. Supported formats include `4 Lightning Bolt`, `Quantity,Name`, `Count,Card Name`, quoted CSV card names containing commas, and name-first count columns. CSV parsing happens in the browser and only sanitized card names/quantities are submitted; the original file is never uploaded. Duplicate names are merged by normalized key; named batches are max 100 cards/request with a total allowance of 2,500 distinct names per account. Imports merge/update matches and keep unrelated cards; clearing all inventory requires typing `ERASE COLLECTION`.

A user can choose a local Deck Workshop list or a published community deck. The tool compares required copies (including commanders) against owned copies, displays missing names and quantities, and requests optional price snapshots from Scryfall in batches of up to 75 identifiers/request (max 150 names/call, 650ms separation). **Reference-printing US dollar amounts are estimates**, not cheapest-printing prices, and exclude shipping, taxes and unknown/unpriced cards. If the Scryfall API is unavailable, the missing-card inventory remains visible rather than disappearing.

Inventory is account private: the public `collection` API refuses unauthenticated requests, and D1 queries use the authenticated profile ID. No collection data is published automatically.

## 3. Investigator Ranks, Achievements & Reputation

**UI**: `community.html#reputation`. Public profile dossiers and the owner's dossier also show their rank.

Reputation is recalculated from actual visible case comments, published decks, documented playtests, case findings, endorsements by other profiles, and Rescue Challenge participation; no points can be purchased and unrelated session data does not contribute. Each category has a points cap to discourage posting-volume farming. Ranks: Rookie Investigator, Field Agent, Hidden Gem Hunter, Deck Surgeon, Master Archivist. Achievements include Case Researcher, Hidden Gem Hunter, Deck Brewer, Deck Doctor, Field Tester, Challenge Contender, Senior Investigator. The public leaderboard displays top 20 of the 500 most recent profiles evaluated; this ceiling should be reconsidered at larger scale. Rankings reflect community activity, not independently validated deck expertise.

## 4. Deck Comparisons

**UI**: `community.html#compare`, linked from the Deck Workshop.

Compare a browser's local Workshop deck to a published deck or two different published community decks. Output includes overlap by card copies, shared names, A-only/B-only slots and quantity differences, plus direct Scryfall card links. When signed in, Scryfall analysis adds estimates for total price, land count, average spell mana value, and possible ramp/removal slots (keyword matching of card type/oracle text; not a rules-certified judgment). If Scryfall is down, decklist differences still display.

Only a user-selected browser-local Workshop deck is read from `deepcuts-deck-v1`; **nothing is published or transmitted as a new deck** by using Compare.

## 5. Private Field Dispatches

**UI**: `community.html#dispatches`, with a sidebar unread badge.

Notifications are generated for:
- `@mentions` in community case/deck comments and evidence findings
- Comments/Deck Doctor feedback on a published deck
- New case research/comments for followed commander case files
- New followers of a public investigator profile
- Endorsements of the author's case findings
- Changed votes on a user's Rescue Challenge deck
- Owner/editor featuring the author's finding

Authenticated users see their own messages and unread count; they can mark one or all read. Recipient lists are bounded, events deduplicated per source, and safe navigation targets are restricted to first-party Field Network URLs. Other users cannot read someone else's inbox. The existing user deletion cascades to recipient messages (and nulls actor references).

**No email digests are enabled.** The free Gmail Apps Script exists for account verification/recovery and has restrictive templates and sending quotas; it is not extended here for unsolicited community notifications.

## Schema & deployment

Migration: `db/field-expansion-2026-10.sql`. It introduces `field_evidence`, `field_evidence_votes`, `field_collection`, `field_dispatches` and relevant foreign-key indexes. This migration was applied to production D1 before deploying the code. It is additive, using `CREATE TABLE/INDEX IF NOT EXISTS`; existing profiles, published decks, member sessions, Ko-fi settings and recovery secrets are untouched.

API: `/api/field-expansion`; all mutating calls enforce same-origin `Origin`, require signed-in profile authentication or the independent owner key for editorial moderation, validate inputs, limit requests, and return JSON with `Cache-Control: no-store`. Public GET is limited to findings and reputation. Collection and inbox reads require authentication.

Additional scripts: `field-client.js`, `field-expansion.js`, `field-evidence-ui.js`, `field-collection-ui.js`, `field-compare-ui.js`, `field-reputation-ui.js`, `field-dispatch-ui.js`, `field-expansion.css`, `owner-evidence.js`; server `src/field-dispatches.js` and `src/field-reputation.js`.

## Verification checklist

- Confirm all JS modules compile as Cloudflare Pages Functions and have resolving exports.
- Check the production D1 schema and `PRAGMA foreign_key_check` (empty); confirm original Squackle profile/deck/challenge remain.
- Sign in using a real device cookie. Post a test finding, endorse it from *another* profile, and check cross-profile privacy; delete test data when finished.
- Add/import/remove card records and check those records are not returned to an unauthenticated or different profile.
- Compare a local saved Workshop deck and public build. Check missing-card quantities, unpriced cards, and Scryfall downtime fallback. Scryfall upstream limits 75 identifiers per request.
- Check rank changes after real qualifying contributions, and that private account/profile keys never leak to public views.
- Verify notifications and owner-featured behavior; make sure unrelated users cannot mark messages as read.
- Test mobile layout, tab navigation, deep linking to `?case=...&evidence=...` and browser-reload persistence.

**Known launch qualification:** A successful build and D1 query check alone do not prove actual Scryfall pricing, cross-browser sign-in, and real multi-user notification delivery. Report those as not yet live-tested until smoke testing is completed.
