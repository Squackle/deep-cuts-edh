# Deep Cuts EDH — developer agent contract

Read this before editing this repository. This is **production**: https://deep-cuts-edh.pages.dev/.

## Three workstreams
- **Website developer**: production site, Cloudflare Pages/Functions, Card Library, Commander tools, profiles, accounts, ads, SEO, and releases. Coordinates main-site integration.
- **Hive Run developer**: builds gameplay, AI, art, balance, simulations and tests in **`Squackle/deep-cuts-game-lab-`** first. Only a reviewed promotion PR may copy compatible game changes into this repository.
- **Project assistant**: researches, maintains GitHub issue #14 and work orders, verifies status, and audits/reviews. Does not edit production runtime code without an explicit owner request and coordinated PR.

## Before editing
1. Read the live `main` SHA, open PRs and issues in *both* repositories. Do not trust old chat summaries.
2. Log a scoped work order in GitHub or reference the user's explicit request. Identify paths and workstream.
3. Create a fresh `site/...`, `game/...`, or `coord/...` branch from latest `main`. One task per branch; never share a working branch between assistants.
4. Avoid files already touched by open PRs; if overlap is unavoidable, coordinate it in the PR and wait for the earlier work to land first.
5. Fill out the PR template. All automated checks must pass before merge. Do not merge a stale head SHA.
6. Only the website developer promotes a tested change to the main website after owner authorization; confirm the exact production Cloudflare Pages commit and test relevant routes.
7. No changes to remote player scores, identity records, subscription/access data, or D1 schema without a separate explicit approval and safe rollback.

## Ownership boundaries
See [docs/DEVELOPMENT-LANES.md](docs/DEVELOPMENT-LANES.md) for paths, promotion evidence, locks and emergency protocol.

**Critical:** The standalone Game Lab must not write public leaderboard scores or claim authority over production identities. Preserve old versioned verified scores. Do not re-enable retired Daily Ritual competition or lab score submission.

GitHub CODEOWNERS currently points to the owner account only. It is not proof of independent developer identities or an enforced review. Repo admins must configure branch protection; automation cannot substitute for it.

## Independent game prototype agents
Stackbreaker and Mana Heist each have their **own unmerged branch** and **exclusive prototype directory**. Their detailed lane agreements and start instructions are in [docs/INDEPENDENT-GAME-INCUBATORS.md](docs/INDEPENDENT-GAME-INCUBATORS.md). Prototype branches do not merge directly into `main`; Website Dev handles any later separately authorized production integration. Existing Website, Hive Run and Project Assistant responsibilities stay unchanged.

## MTG rules verification — all agents

Before making or changing a rules-dependent statement, puzzle, deck analysis, or game interaction, check Wizards' **current Comprehensive Rules** and **official Oracle text / rulings in Gatherer**, plus official release notes or format restrictions when relevant. Cite specific rule numbers and card text. For difficult or disputed interactions, **also cross-check [Card-Forge/forge](https://github.com/Card-Forge/forge) when practical**; label whether Forge was inspected, actually run, or unavailable. Forge is unofficial: when it disagrees, official Wizards rules take precedence. Never import Forge's GPL-3.0 engine/source as a dependency without separate review and approval. Preserve regression tests and server/client replay parity for gameplay rules changes.

Canonical workflow and evidence checklist: [docs/MTG-RULES-VERIFICATION.md](docs/MTG-RULES-VERIFICATION.md).

## Mandatory main-site page template (owner requirement, October 26, 2026)

**Every public page or game added to the main Deep Cuts EDH website must use the SAME shared top bar as the existing main site and other Arcade games.** This is a release-blocking design requirement, not an optional enhancement.

- Copy the shared `<header class="site-header"><div class="wrap header-inner">…</div></header>` structure (wordmark/logo, complete `<nav class="primary-nav">` fallback links); load `/styles.css`, `/retro.css`, `/theme-v2.css`, `/header-profile.css`, `/header-profile.js`. The shared script supplies supporter ticker, avatar, responsive menu, and support link. Never replace it with a bespoke game/lab toolbar or brand imitation.
- Public Arcade pages also use `/games.css`, `games-main`, `games-breadcrumbs`, `games-masthead`, and the standard `site-footer`. Their internal play area may use custom styling, but does not replace the parent site template.
- Keep the shared header accessible on mobile and during game sessions, including immersive modes. Preserve keyboard access, stable layout, and existing gameplay/score authority.
- A new public page that bypasses these elements must fail the shared-template CI check. Exempt only genuine technical/verification, private/admin, or deliberately embedded/noindex subdocuments, not public features. Document any exception by file path and reason.
- For new public pages, test the actual rendered desktop and mobile header, including profile and supporter strip, before calling a release complete. Follow the Cold Case/Stackbreaker page layout, not standalone Game Lab navigation.

