# The Card Library — Research Desk faceted search

## Release (2026-10-13)
The [Card Library](https://deep-cuts-edh.pages.dev/library.html) now has a dense, keyboard-accessible filter interface inspired by the *workflow* of modern deck browsers, but styled in Deep Cuts EDH forest green, aged parchment and brass rather than copying another site's branding.

### What changed
- Prominent Scryfall text/syntax search, with quick trails for Deepest Cuts (legendary creatures ranked by overall EDHREC card usage), budget commanders under $2, lands, Treasure cards and pre-2000 cards
- Fast sort buttons (Recommended, A–Z, Price Low–High, Price High–Low, Deep Cuts), alongside the full Scryfall sort selector for rarity, mana value, release date, set, power, toughness, artist, etc.
- Commander color-identity chips for white, blue, black, red, green, and colorless. Selecting multiple colors searches all cards whose color identities fit *inside* those colors (`id<=...`); the "Exact colors" toggle changes to `id=...`. Colorless is mutually exclusive with colored selections.
- Multi-select card types (OR within one group, e.g. `(t:creature or t:instant)`) and rarities, single-select mana-value chips 0–5 and 6+, plus arbitrary numeric Max Mana Value.
- Role & mechanic chips: Ramp, Draw, Removal, Board Wipes, Tokens, Treasure, Graveyard, Blink, +1/+1 Counters, Sacrifice, Tutors, Protection, Life Gain and Spellslinger. Powered by Scryfall Oracle text queries and `otag:ramp`; category matches are approximate, not hand-reviewed synergy ratings.
- Special traits (Can command, Game Changer, Reserved List, Reprint), using Scryfall classification operators.
- Format legality, print/price mode, editable min/max dollar price; original search and sort semantics retained.
- Live-ish facet and quick-sort updates (debounced to reduce Scryfall API traffic), active filter badges removable individually, clear all, collapse/expand on mobile, keyboard focus and accessible pressed state.
- Copyable share URLs encode selected filters and restore them on revisit. State is URL-based, not attached to a private user account. Existing one-click Add to Deck, details modal, Scryfall Tagger, price results, pagination and image handling all remain.
- Mobile filter panel starts collapsed, desktop starts expanded. The preference is kept in sessionStorage only; no new tracking or account requirements.

### Intentional distinctions
The screenshots used as a reference are from a **deck** filtering UI, not an individual card search. A deck's difficulty, bracket and playstyle are properties of complete builds and shouldn't be arbitrarily attached to individual card entries. The library instead provides card-appropriate mana, colors, types, roles, price and Scryfall Game Changer tags.

We do **not** show invented counts on every facet pill. Scryfall reports the actual total matches for the current query in the Results status; per-facet global counts would require many upstream queries and rate limiting.

`Recommended` uses Scryfall EDHREC card-usage ordering, **not** a subjective card rating or count of decks led by each commander. `Deep Cuts` sorts by lower overall EDHREC card use. USD price availability depends on printings; click All Printings to compare editions. Data is live Scryfall, never a bundled card database.

### Files
- `library.html` — replaces large dropdown form with compact toolbar and labeled facet rows
- `library-facets.js` — facet selection, Scryfall syntax, active chips, sharable/restorable URLs, quick presets
- `library-facets.css` — responsive forest/parchment/brass visual system
- `library.js` — integrates existing Scryfall search, sorting and card/Deck Workshop features
- Former `library-ui.js` is intentionally no longer loaded by the Card Library page.

### Acceptance checks
1. Load the Card Library on desktop/mobile; input fields are usable, panel toggles, keyboard focus visible and pills don't overflow.
2. Select U + B; query contains `id<=ub`. Turn Exact on: `id=ub`. Colorless overrides other colors.
3. Select Creature + Instant: `(t:creature or t:instant)`. Select two roles or rarities: OR within each group, AND across distinct groups.
4. Select 6+ MV then set Max MV: the exact chip should clear to avoid contradictory ranges.
5. Enter Max USD $3.50 and sort Price low to high; query contains `usd<=3.50` and API order `usd`.
6. Try Clear All, remove an active chip, and paste a copied share URL in a fresh browser; state must restore.
7. Use a quick preset, Search on Scryfall, Show More, Details and Add to Deck with a real card; preserve existing state.
8. Check no fake global facet counts, no account login requirement, and no unauthorized host fetches.
