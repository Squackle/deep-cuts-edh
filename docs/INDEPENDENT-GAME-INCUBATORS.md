# Independent arcade incubators — Stackbreaker and Mana Heist

Created 2026-10-15 under the owner's authorization to **prepare independent new game development**, not authorize integration or deployment.

## GitHub locations and designated workspaces

| Agent | Branch | Exclusive directory | Source of truth |
| --- | --- | --- | --- |
| Stackbreaker developer | `game/stackbreaker-incubator-20261015` | `incubators/stackbreaker/**` | [Stackbreaker agent starter](https://github.com/Squackle/deep-cuts-edh/blob/game/stackbreaker-incubator-20261015/incubators/stackbreaker/AGENT_STARTER.md) |
| Mana Heist developer | `game/mana-heist-incubator-20261015` | `incubators/mana-heist/**` | [Mana Heist agent starter](https://github.com/Squackle/deep-cuts-edh/blob/game/mana-heist-incubator-20261015/incubators/mana-heist/AGENT_STARTER.md) |

Both branches forked from `03ab387dd30b0ea4cfb5cd9744c0adf3c8f0795b`. They are **unmerged experimental branches**. Their starter files do not appear on production `main`.

## Separation guarantee and limits

- Each agent checks out **its own named Git branch**, and changes only its own directory; all code, tests, data, assets, configuration and docs must stay there.
- **Never work on a common local checkout or branch.** Use separate Git worktrees, clones or distinct hosted agent branches. GitHub identities may be shared by assistants; the branch/path assignment is the true lane identifier, not the account username.
- Existing Website Dev continues to own `games.html`, `games.css`, global JavaScript/CSS, UI, services, production release; Hive Run Dev continues in `Squackle/deep-cuts-game-lab-`; Project Assistant owns coordination/research.
- The shared `release-coordination` required check now rejects PRs from either game branch if they modify outside their declared lane. It also **intentionally rejects direct PR merges from prototype branches into `main`**. A malicious or privileged writer can still edit an unprotected prototype branch, so this is an enforced merge check, *not an independent write-permission sandbox*.
- Each agent should log milestones, commits and blockers in its assigned GitHub issue. Do not create blocking PRs to `main` for prototype checkpoints. A read-only research agent should only comment on issues/docs; production remains unchanged.
- Cloudflare Pages production and D1 are never development targets for these prototypes. Test via a local static server/test runner within the workspace. Automatic repository branch previews, if configured, must not be mistaken for public production releases.

## Promotion when explicitly authorized later

1. Finish the agent's own engine and puzzle validation tests inside the incubator; record full tested SHA and version.
2. Owner explicitly requests a **separate** live Arcade integration.
3. Website Developer starts a **fresh `site/...` branch from latest `main`**, copies/reviews only the relevant completed game into `games/<slug>/` and handles shared Arcade navigation, accessibility, privacy, performance, security and server features.
4. New Website integration PR (`Workstream: Website`) must have owner approval, normal `site-quality` and `release-coordination` checks, and real mobile/browser regression tests.
5. Website Developer merges and verifies exact Cloudflare Pages production SHA only after every blocker is resolved. This isolates development from live games and gives an explicit quality gate.

## New agent quick prompts

**Stackbreaker:** "You are the Stackbreaker game developer. Only develop in GitHub `Squackle/deep-cuts-edh` branch `game/stackbreaker-incubator-20261015`, directory `incubators/stackbreaker/**`. Read `AGENT_STARTER.md` in that directory before writing code. Create tests for pure stack/priority transitions and two tutorial scenarios first. Never touch `main`, the Mana Heist incubator, Hive Run, shared site files, Cloudflare or user data; report tested commits and blockers in your issue. No production deployment."

**Mana Heist:** "You are the Mana Heist game developer. Only develop in GitHub `Squackle/deep-cuts-edh` branch `game/mana-heist-incubator-20261015`, directory `incubators/mana-heist/**`. Read `AGENT_STARTER.md` in that directory before writing code. Build a pure rules engine and bounded BFS puzzle solver, verify two solvable tutorial vaults first. Never touch `main`, Stackbreaker, Hive Run, shared site files, Cloudflare or user data; report tested commits and blockers in your issue. No production deployment."

## Need genuinely separate GitHub repositories?

The current connected GitHub integration cannot create new repositories directly. These are two branches of the existing website repository, which provides **Git history and merge isolation**, but not completely independent repository access controls. If stricter organizational separation is later desired, create two standalone private repos in GitHub and migrate the completed incubator directory into each. Do not reuse the existing dedicated Hive Run Lab as a general-purpose sandbox.
