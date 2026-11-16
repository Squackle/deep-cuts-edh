# Deep Cuts EDH — official brand and link directory

**Status:** Public-link inventory checked on 2026-10-20. This document is not a social profile, endorsement claim, or automated promotional posting.

## Official first-party identity

- **Brand:** Deep Cuts EDH
- **One-sentence description:** Discover underplayed Magic: The Gathering Commander ideas, original Rescue Reports, deckbuilding tools and daily MTG-inspired games.
- **Official live website:** https://deep-cuts-edh.pages.dev/
- **Official public source repository:** https://github.com/Squackle/deep-cuts-edh
- **Published Rescue Reports:** https://deep-cuts-edh.pages.dev/#latest
- **Commander Matchmaker:** https://deep-cuts-edh.pages.dev/matchmaker
- **Deep Cut Finder:** https://deep-cuts-edh.pages.dev/deep-cut-finder
- **Card Library:** https://deep-cuts-edh.pages.dev/library
- **Deck Workshop / Tools & Resources:** https://deep-cuts-edh.pages.dev/deck
- **Daily Arcade:** https://deep-cuts-edh.pages.dev/games
- **Supporter information:** https://deep-cuts-edh.pages.dev/supporters
- **Privacy and Advertising:** https://deep-cuts-edh.pages.dev/privacy

URLs above are grounded in the current repository's real HTML assets, canonical links and local routing/sitemap. **Do not claim that every endpoint is independently indexed by Google.**

There is no public `/about` route. The live homepage hero, footer and privacy/support pages explain the project's identity; avoid linking to an invented About page. A distinct public About page may be evaluated later, after the owner decides what team/editorial information should be disclosed.

## Accuracy notes for descriptions

- "Budget-friendly commander ideas" describes Matchmaker's **commander-card price filter**. It is not a complete, price-verified 100-card deck builder and must not be described as such.
- Four Rescue Reports are published. Do not pretend planned articles or the future `/underplayed-commanders` and `/budget-commanders` hubs already exist.
- Deep Cuts EDH is an **unofficial Magic: The Gathering fan project** and is neither approved by Wizards of the Coast nor affiliated with EDHREC/Scryfall.
- Do not claim a Google ranking, EDHREC popularity figure, social following, newsletter subscriber number or deck price without dated evidence.

## GitHub repository About settings — owner action pending

On 2026-10-20, the GitHub repository API returned **no homepage URL, no description, and no topics**. The connected GitHub integration does not expose the repository settings edit action. Do not fabricate a settings update.

Suggested exact fields in GitHub → [repository](https://github.com/Squackle/deep-cuts-edh) → **About** (gear icon):

- **Description:** `Underplayed MTG Commander ideas, original Rescue Reports, deckbuilding tools and daily Magic games.`
- **Website:** `https://deep-cuts-edh.pages.dev/`
- **Suggested topics (optional):** `magic-the-gathering`, `commander`, `edh`, `deckbuilding`, `mtg`

These are proposed values, **not yet changed repository metadata**. The repository homepage is more useful for the branded Google search than a code-only search result without a conspicuous link.

## README introduction — pending older PR #96

Older open [PR #96](https://github.com/Squackle/deep-cuts-edh/pull/96) currently edits the root `README.md` and is protected by release-coordination overlap checks. Do not overwrite or leapfrog that PR. After it merges or closes, add the following at the **top** of the README in a new scoped PR:

> # Deep Cuts EDH — Underplayed Commander Ideas & Rescue Reports
>
> **[Visit the official Deep Cuts EDH website](https://deep-cuts-edh.pages.dev/)**
>
> Explore overlooked Magic: The Gathering commanders, original Rescue Reports, a searchable card library, deckbuilding tools and free daily MTG-inspired games. [Find a Commander idea](https://deep-cuts-edh.pages.dev/matchmaker) or [read the latest Rescue Reports](https://deep-cuts-edh.pages.dev/#latest).
>
> *The sections below document project history and earlier prototypes. See the live website and current repository code for the latest implementation.*

The old README contains historical prototype claims (including "100% static" and zero D1/backend integration) that conflict with the current Cloudflare Pages/Functions/D1 system. Rather than rewriting another developer's overlapping README, this task records the exact safe update to apply after #96 resolves.

## Unpublished external-profile copy — owner review only

Proposed short external description (never auto-post):

> Deep Cuts EDH explores the forgotten side of Magic: The Gathering Commander: unusual legends, original Rescue Reports, practical deckbuilding tools and daily MTG puzzles. Explore the site at https://deep-cuts-edh.pages.dev/.

Use only in communities that allow sharing fan-created tools or original deck research. Respect rules on self-promotion. **No Reddit, Discord, social, directory listing, newsletter or other external post was made.** Do not invent "official" accounts or social links without verified ownership.

## Link hygiene

Use the canonical HTTPS production root `https://deep-cuts-edh.pages.dev/` for outward brand references. Only link real, public, relevant pages; never link owner/private routes or preview deployments as the official site. Keep the exact brand spelling `Deep Cuts EDH`. Reciprocal link: the homepage footer points to the official public GitHub source; GitHub's README/metadata remain the priority for a prominent link back to production once PR #96 is resolved.
