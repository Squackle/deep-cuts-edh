# Deep Cuts EDH: Studio 3.0

Implemented in one coordinated release on October 12, 2026.

## Features
- Guided, 100-card Commander draft builder using Scryfall live queries with color-identity, legality, role, budget, bracket and theme constraints. Always review the result; it is a draft, not a playtested optimized list. Unavailable pools can cause extra basics, flagged visibly. The price cap is an estimate and not verified if prices are missing.
- Public URL imports for Moxfield, Archidekt, Deckstats and TappedOut via the documented Commander Spellbook `card-list-from-url` endpoint. Other providers require plaintext export.
- Real combo and one-card-away checks through Commander Spellbook `find-my-combos`, and category/feature flags through `estimate-bracket`. The result is not an ML Bracket 1–5 estimate.
- Card rulings fetched from Scryfall, with links to Wizards' Comprehensive Rules. No generative Judge conversation.
- Cut to 100 with reviewable modes: balance, synergy, curve, budget, bracket, redundancy. Mana repair, opening hand math, card roles, curve, local collection, and local saved brews remain available.
- Cloud share: read-only deck link with unguessable ID. Anyone holding the link can access the deck.
- Cloud vault: 256-bit recovery key allows read/write to a deck from multiple devices without Google/Apple logins. Keys are unrecoverable, access is secret-key based, deck contents are stored in plaintext in the database.
- Outbound Scryfall, Moxfield, MTGGoldfish, EDHREC, Commander Spellbook, and TCGplayer links. No affiliate tracking yet.

## Server and database
Cloudflare Pages project `deep-cuts-edh` deploys from `Squackle/deep-cuts-edh`, main branch.
The existing D1 `DB` binding and `TURNSTILE_SECRET` secret are required. Created new tables: `shared_decks`, `deck_share_limits`, `deck_vaults`. Existing `nomination_limits` also rate-limits Spellbook API calls to 20 requests/IP/day. Cloud deck creates are rate limited.

## Limitations
- No Google or Apple OAuth accounts. Recovery-key vault is an alternative, not account auth.
- Full ML win-turn prediction, comprehensive BracketJudge model, and generative Judge Q&A need external model resources and calibrations not provisioned here.
- Hosted deck providers can change their import layouts; use text export when unavailable.
- External API usage may be rate limited; no full 40K combo database is replicated, and no scraping of undocumented Moxfield APIs.
- User data is not end-to-end encrypted on Cloudflare D1; keep vault keys secret.
- Static official 53-card Game Changer snapshot is valid as of October 12, 2026; review future updates against Scryfall `is:gamechanger`.

API documentation: https://spacecowmedia.github.io/commander-spellbook-backend/api.html
