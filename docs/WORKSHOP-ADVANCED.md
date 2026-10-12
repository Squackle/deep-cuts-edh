# Current advanced Workshop capabilities (2026-10-12)

## Working without third-party authentication
- Scryfall-based card library, Commander legality analysis, imports, mana/curve analysis, cut/fill tools, Spellbook combo matching, and generated draft lists.
- Username/password accounts (PBKDF2 SHA-256 with per-user random salts and 180,000 iterations), 30-day HttpOnly session cookies, D1 storage for up to 20 account decks, and rate-limited sign-in.
- Separate local draft storage, browser saved brews and recovery-key vault remain available.
- Rules assistant returns cited Scryfall card text and official card-specific rulings from Scryfall with current source links.
- Monte Carlo goldfish simulator plots chances of reaching a commander's **total mana value** by a given turn without modeling spells or interaction.

## Not claimed
- A complete Google, Apple or email identity provider. Those require provider credentials and configured redirects. Username/password accounts cannot reset forgotten passwords without an email or verified recovery system.
- AI-generated Judge rulings in the currently deployed configuration: `/api/rules-assist` includes an optional `env.AI` integration, but no Workers AI binding is configured. Official rules require context and model explanations cannot be treated as judge rulings.
- A **trained machine-learning win-turn predictor**. Such predictions need labeled playtest data and calibration. The simulation only models basic land drops (with no mulligans, ramp, color source requirements, commander tax, or opponents).
- No claim that the simulator proves a bracket or win rate. Existing heuristic deck health indicators remain advisory.

## D1 tables added
`site_feedback`, `feedback_limits`, `deck_accounts`, `deck_sessions`, `account_decks`, `account_auth_limits`, `rules_assist_limits`.

The daily nomination moderation automation is scheduled separately in ChatGPT at 10 AM America/Chicago; there is no Cloudflare Cron Worker needed for that review.

See `docs/FEEDBACK.md` for the private feedback inbox.
