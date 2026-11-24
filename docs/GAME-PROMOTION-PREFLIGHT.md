# Game Lab → public Arcade: integration preflight (read-only)

This runbook and `scripts/game-promotion-preflight.mjs` are **developer tooling**, not release authorization. They make file synchronization repeatable, but cannot certify gameplay, rights, identity, score integrity or approval. The Release Manager alone merges/deploys. No tool here modifies either repository, Cloudflare or D1.

## Current lanes — November 24, 2026

| Game | Existing website status | Promotion disposition |
|---|---|---|
| Hive Run | Dominion 2.0, ranked `hive-1.5.4`; historical scores retained | **First priority.** Lab PR #336 freezes candidate `222dd87661820749e5895e007e3c9d58f53ef7bf` with 321/321 dedicated tests, unchanged rules; preview and physical/mobile acceptance still required |
| GRAFTBOUND | Stage B is noindex / ranked disabled; website verifier pins Lab `367c15af26231b0ea707bd5d3e4ca75d78f32bfa`, `graftbound-rules-1.8.3-beta`, 133-card pool v7, challenge revision 30 and digest `6ddba82f23c4af1790910ce7ef8647f746e4b9eb0a33145297328095d4ccc51e` | **Second priority.** Lab #339 (stabilization), #349 (r31 life gain), #350 (r32 approved 145-card pilot) are stacked and need ordered source freeze, security, browser and versioned server replay tests. #351 experimental boosters excluded |
| Stackbreaker | First-party Classic/Daily integrations have separate promotion workflows | Lab #337's unranked strategy changes do not authorize new ranked promotions |
| Mana Heist | First-party practice integration and legacy `mh-landfall-0.2.0` | Lab #338/#345/#347 are rehearsal/physical previews; P01 rights, physical mana conservation, Safari compatibility and activation approval block promotion |
| ARCHEMANCY | Game Lab playtest, not an approved public game release | Exact engine, rights, replay/profile contract and owner-approved website route are prerequisites |

The table is a **dated snapshot**. Recheck exact main SHAs, open PRs and Control Room #14 before each use.

## Repeatable promotion procedure

1. Obtain the **developer-confirmed full 40-character Game Lab SHA**, exact rules/scoring/challenge revisions and completed test evidence. Ask Release Manager for sequencing and file ownership. Never use a moving branch as a release candidate.
2. Check both current AGENTS.md contracts, website and Lab `main`, every open touching PR, and consolidated CodeQL tracker #164. Explicitly include any fixed website mirror defects (including website #166) so a promotion cannot reintroduce them.
3. Declare a reviewed SHA-256 file map for **every game-owned file and binary asset intended to be byte-identical**. Manifest fields: `schemaVersion:1`; `game`; exact `labRepository` / `websiteRepository`; `labSourceSha`; `websiteBaseSha`; `rulesVersion`; `status`; `files:[{source,target,bytes,sha256}]`. The tool supports all five game lanes but does not guess which files to copy. Exclude director tools, lab APIs, D1, standalone authentication and site-owned entry/bridge files. Any intentional site-only adaptation is a separate reviewed diff, not a false parity assertion.
4. Prepare clean local checkouts. Detach the **Lab** checkout at the exact commit with `git checkout --detach <40-character-SHA>`, confirm no tracked changes. The website checkout can be a feature branch staging the proposed promotion. Its Git HEAD must contain the manifest's declared `websiteBaseSha` in its ancestry; the offline check fails closed if the checkout is unrelated or behind that baseline. Independently check that the baseline still reflects the current remote main.
5. From the **website root**, generate a read-only copy inventory:
   `node scripts/game-promotion-preflight.mjs --manifest docs/game-promotions/<candidate>.json --lab ../deep-cuts-game-lab- --site . --source-only`
   This verifies source SHA and exact source file hashes and prints a deterministic source→target plan. `mode:source-inventory-only` is **not site parity**. Inspect and copy only approved mappings onto the isolated website integration branch; never overwrite site-only bridge, adapted `main.js`, profile or verifier API.
6. Run `node scripts/game-promotion-preflight.mjs --manifest docs/game-promotions/<candidate>.json --lab ../deep-cuts-game-lab- --site .`. A zero result means only the listed raw bytes match. Failures report missing or differing mirrors; symlinks, unclean source checkouts, traversal and unsafe game-crossing paths are rejected.
7. Invoke the additional `--gate` only after a **separately recorded owner-approved release**. Supply under `evidence`: `developerCandidateUrl`, `ownerApprovalUrl`, `releaseManagerReviewUrl`, `securityDispositionUrl`, `replayTestUrl`, `historyTestUrl`, `browserTestUrl`, `rightsReviewUrl`, `fileOwnershipUrl` and `rollbackPlan`. This validates **presence/HTTPS shape only**, not truth or successful checks. The Release Manager must follow and verify every item.
8. For all ranked changes, run exact-source **client/server replay parity** including malicious/repeated/truncated inputs, rejected unauthenticated submissions, authorized success, one-use sessions, saved profile ownership and historical score/achievement survival. Test preserved older verifier revisions; never rewrite previously verified data. Confirm mobile, desktop, keyboard, swipe, accessibility, content, art and security. Use synthetic isolated/staging accounts and DB fixtures only. Lab is solo-only; unranked Lair/practice must never submit public scores.
9. Only after the game developer confirms the frozen candidate and separate owner promotion approval, open the website's **Game Lab Promotion** PR with full source SHA, rules version, scoring/replay evidence, target file list, intentional adaptations, current-base checks and a scoped rollback. The Release Manager performs merge and production deployment, verifies exact Cloudflare SHA and live read-only/authenticated smoke without corrupting public accounts or D1.

### Example manifest — illustration only (not an approval)

`{
  "schemaVersion":1,
  "game":"hive-run",
  "labRepository":"Squackle/deep-cuts-game-lab-",
  "websiteRepository":"Squackle/deep-cuts-edh",
  "labSourceSha":"0000000000000000000000000000000000000000",
  "websiteBaseSha":"0000000000000000000000000000000000000000",
  "rulesVersion":"hive-1.5.4",
  "status":"hold",
  "evidence":{},
  "files":[{"source":"src/engine.js","target":"games/hive-run/src/engine.js","bytes":0,"sha256":"0000000000000000000000000000000000000000000000000000000000000000"}]
}`

All zeros are placeholders, not source evidence. `docs/game-promotions/graftbound-r30-pinned-baseline.json` records the currently pinned 47 verifier modules from the existing website manifest. Its `status:hold` is deliberate. It excludes the site bridge and client art; it is not a current-r32 approval.

## Independent rollback rules

- **Hive Run:** revert only the approved promotion files to the previously verified matching build, keeping historic verified score rows, rules-specific verifiers, old achievements and retired Daily Ritual archives intact.
- **GRAFTBOUND:** keep ranked launch disabled until explicit approval. On a post-release regression, disable the flag before reverting the **client + verifier pin together**; preserve older revision replay validation. Export D1 before any separately authorized schema rollback; do not drop live tables as a quick fix.
- **Stackbreaker:** revert only the affected Classic/campaign/ranked manifest bundle; retain old daily puzzle IDs, historical records and local save keys with a matching old verifier.
- **Mana Heist:** separate an opt-in future engine/rules activation rollback from practice UI. Retain all 500 stable stage IDs, legacy physical mana behavior, earlier certificates and guest progress key `dc-mana-heist-landfall-v2`.
- **ARCHEMANCY:** without an approved public identity/score service, rollback is isolated removal/reversion of its proposed public route and assets; no production DB or Lab engine modifications.

Avoid force-pushing main, a whole-site revert or production database restoration to undo a game-only release. A separate reviewed Release Manager action is required for each rollback.

## Tests and limits

Run `node --test tests/game-promotion-preflight.test.mjs`. The synthetic tests cover exact Git source SHA, dirty checkout rejection, source/mirror byte hashes, missing files, symlinks, path traversal, director/API exclusion, protected website bridges, duplicate targets, approval-gate holds, and Hive/GRAFTBOUND mappings. They are **not** actual cross-repository parity proof until checked against the frozen Game Lab checkout, nor browser/physical QA, CI/CodeQL confirmation, third-party IP clearance or production smoke tests.
