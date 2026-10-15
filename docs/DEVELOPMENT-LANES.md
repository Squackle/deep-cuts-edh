# Development lanes and release safety

Effective October 15, 2026. Applies to the **production** [Deep Cuts EDH repository](https://github.com/Squackle/deep-cuts-edh) and the separate [Hive Run Lab](https://github.com/Squackle/deep-cuts-game-lab-).

## Ownership and scope

| Workstream | Primary code | Allowed actions |
| --- | --- | --- |
| Website developer | Production `*.html`, `*.css`, `*.js`, `functions/**`, `src/**`, `db/**`, production workflows | Owns main-site integration, static site UX, backend/data security and deploy verification |
| Hive Run developer | Lab `src/**`, `functions/**`, `tests/**`, game art and game docs | Builds and tests **only** in Game Lab until a promotion PR is approved |
| Game Lab promotion (Website developer + Hive Run developer) | Main `games/hive-run/**`, `src/hive-server/**`, `functions/games/hive-run/**`, `functions/api/hive-profile.js`, `hive-profile.js` | Audited translation of a tested lab commit; main owns score security and player identity |
| Project assistant | GitHub issue #14, design/roadmap/QA issue tracking, `docs/**`, release summaries | Research/coordination by default. Must get explicit owner approval before touching runtime code |
| Shared integration | `.github/**`, `scripts/**`, `tests/**`, global navigation, APIs, D1 bindings | Declare affected team and coordinate in PR; test dependent product areas |

**No implicit file locks:** concurrent assistants do not automatically know one another's unsaved edits or private chat. Open GitHub PRs and work-order issues are the shared ledger. A lock only describes intent; Git/PR conflicts and CI checks still matter.

## Branch → PR → main → deployment

1. Start from the **current** `main` commit; never fork a weeks-old branch for new work.
2. Work on `site/<topic>`, `game/<topic>` (for production integration only), or `coord/<topic>`. On Game Lab use `game/<topic>` or `coord/<topic>`.
3. Fill PR body: `Workstream:`, `Owner authorization:`, `Files/Scope:`, `Concurrent work:`, `Test plan:`, `Rollback:`. Be truthful: links, tested SHA, and actual outcomes.
4. The `release-coordination` check validates the PR template, workstream/file boundary, and **exact file overlap with older open PRs**. Newer conflicting PR waits for older PR to merge/close, then updates and retests.
5. Run **Site quality and navigation** plus relevant Card Library, Set Watch, and Hive integration suites. A passing status on an old commit does not validate an updated branch.
6. Merge by PR using the **expected head SHA**, never force-push `main`. Record production deployment ID, SHA, and rollback commit.
7. The website auto-deploys from main in Cloudflare Pages. Before merging, verify that production was explicitly authorized. Test anonymous access and protected endpoints after deploying. Never assume preview or a green PR equals a live release.

## Hive Run promotion protocol

1. Hive developer prepares a lab PR/commit with deterministic engine tests and a published gameplay version. Lab prototype is solo-only. Do not restore its retired public leaderboards.
2. Website developer opens a **main repository** `Workstream: Game Lab Promotion` PR with: `Lab source SHA:` (full 40 characters), `Rules version:`, and `Score/replay validation:`.
3. Compare server/client gameplay and the shared versioned replay rules; reject new scoring versions unless complete deterministic server tests match the client. Keep old verified scores labeled correctly.
4. Validate the main repo game integration, score API auth/replay, profile ownership, touch/keyboard, mobile and desktop, Lair unranked eligibility, legacy scores, and Cloudflare bindings.
5. Deploy only after a reviewed PR and explicit owner authorization, even if the Lab version has already shipped. Never point the Lab at the production D1 score binding.

## GitHub protection settings (owner must apply separately)

**Important:** A GitHub Actions workflow checks PRs but does not stop a privileged direct push or force-push unless protected branch settings are enabled.

Both **public** repositories currently require manual main-branch protection:
1. GitHub repository → **Settings → Rules → Rulesets → New branch ruleset** (or **Settings → Branches → Add branch protection rule**, depending on UI).
2. Target the `main` branch only; enable require pull request before merging, require status checks to pass, require branch to be up to date before merging (if feasible), block force pushes, block branch deletion.
3. On **main site**, require `release-coordination`, `site-quality`; game-specific suites are path-triggered and should be checked per relevant PR. On **Game Lab**, require `release-coordination` and `verify` (the game tests workflow must be configured to run reliably for PRs).
4. Avoid requiring an independent approving reviewer until there is a *different* GitHub account that can review; a solo owner usually cannot approve their own PR. Enable CODEOWNER review when a valid independent reviewer is added.
5. Test on a disposable branch/PR first. Verify a direct push is rejected and a failing PR cannot be merged. Preserve an emergency owner rollback procedure and never bypass failed tests merely to rush a release.

CODEOWNERS currently maps paths to `@Squackle` as the accountable repository owner. This is an *ownership signal*, **not** separation of identities because all three ChatGPT agents may share the same GitHub connection.

## Incident/overlap handling

- Before making each write, check open PRs and the SHA of the exact file being replaced. GitHub rejects stale blob-SHA updates; do not blindly overwrite.
- If two agents modify the same path, **newer PR pauses**; coordinate and rebase/cherry-pick changes after earlier PR merges. Never delete an agent's branch to 'fix' a conflict.
- If CI fails, inspect real logs and repair the issue; never disable an assertion to create an artificial green check.
- If urgent hotfix collides, tell the owner, have the owner explicitly designate which PR goes first, and document the superseding path; do not silently bypass.
- Ensure production and Lab Cloudflare deployments always match the intended repository and commit.
- Record workstream status in [Development Control Room #14](https://github.com/Squackle/deep-cuts-edh/issues/14): planned/building/PR ready/tested/released/blocked with evidence and next steps.

## Sensitive changes

Migration, auth/session, Ko-fi, API privilege, D1 binding and leaderboard changes require explicit security review, negative-case tests and a rollback plan. Public display changes never authorize changes to player data.
