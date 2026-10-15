## Release / coordination evidence

Workstream: Website
Owner authorization: [Link or quote explicit owner approval; "research-only" is not deploy permission]
Files/Scope: [Affected paths and expected behavior]
Concurrent work: [Related open PRs/issues, overlapping files, or "none checked"]
Test plan: [Actual tests and results; never claim tests not run]
Rollback: [Known-good main SHA and instructions to revert if needed]

### Hive Run promotion (only if touching protected production game paths)
Lab source SHA: [full 40-character tested Game Lab commit]
Rules version: [hive-x.y; client and server must match]
Score/replay validation: [links to deterministic, identity and legacy-score checks]

### Deployment
- [ ] From current main; no conflicting older open PR
- [ ] All relevant tests, mobile and production security checks passed
- [ ] Human owner authorized this production change
- [ ] Post-merge exact Cloudflare production commit, deployment ID, and smoke test to be recorded

### Game incubation isolation (if applicable)
- New game prototypes use `game/stackbreaker-*` or `game/mana-heist-*` branches and `Workstream: Stackbreaker Prototype` or `Workstream: Mana Heist Prototype` respectively.
- Prototype PRs **must not target production `main`**. Keep code only inside the designated `incubators/<game>/**` path and use GitHub issues to report progress. A new Website Dev integration PR is required for any production release.
