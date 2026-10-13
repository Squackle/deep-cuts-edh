# Current advanced Workshop capabilities (2026-10-12)

## Working without third-party authentication
- Scryfall-based card library, Commander legality analysis, imports, mana/curve analysis, cut/fill tools, Spellbook combo matching, and generated draft lists.
- **Key-only cloud deck vault**: 256-bit recovery keys; no usernames/passwords, email login, or social sign-in. The legacy `/api/account` endpoints return HTTP 410.
- Separate local draft storage, browser saved brews and recovery-key vault remain available.
- Rules assistant returns cited Scryfall card text and official card-specific rulings from Scryfall with current source links.
- Monte Carlo goldfish simulator plots chances of reaching a commander's **total mana value** by a given turn without modeling spells or interaction.

## Not claimed
- No Google, Apple, email, or username/password authentication. Keep your recovery key safe; there is no recovery process if it is lost.
- AI-generated Judge rulings in the currently deployed configuration: `/api/rules-assist` includes an optional `env.AI` integration, but no Workers AI binding is configured. Official rules require context and model explanations cannot be treated as judge rulings.
- A **trained machine-learning win-turn predictor**. Such predictions need labeled playtest data and calibration. The simulation only models basic land drops (with no mulligans, ramp, color source requirements, commander tax, or opponents).
- No claim that the simulator proves a bracket or win rate. Existing heuristic indicators remain advisory.

## D1 tables added
Active: `site_feedback`, `feedback_limits`, `rules_assist_limits`, `deck_vaults`, `deck_share_limits`. Legacy username/password tables are no longer used and can be dropped after confirming no records exist.

Nomination moderation is an editorial task managed separately from the site's Cloudflare infrastructure. Confirm that the desired review schedule is active before relying on it.

See `docs/FEEDBACK.md` for the private feedback inbox.

## Key-only policy (2026-10-12)
Username/password signup and login have been retired and the account endpoint returns 410 Gone. The public UI and client module reference are removed. The key vault stores a SHA-256 hash of each 256-bit recovery key and a server-readable card-list JSON; it is **not** end-to-end encrypted. Do not present keys as a guarantee of confidentiality. Existing username/password account records were checked before retirement and there were zero accounts and zero account decks at that time.
