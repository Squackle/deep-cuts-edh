# Commander nominations: canonical names and vote safety

Public forms call `/api/nominations`; private moderation is `/api/owner-ops?view=nominations` and requires Cloudflare Access + independent owner key.

## Matching algorithm
- Match the existing **active** (`approved` or `pending`) nominee by exact normalized title, ignoring case, punctuation, diacritics and spacing.
- Match a **unique** shortened proper name before a comma, e.g. `Reveka` → `Reveka, Wizard Savant`.
- Match a very small spelling mistake (Levenshtein distance at most 1/2/3 according to length, <=18% error). More than one close candidate is **ambiguous** and never auto-merged.
- If no local candidate matches, Scryfall's named fuzzy endpoint is a **best-effort** external correction. Only accept a returned official name that is sufficiently close to the submitted text. If unavailable, preserve submitted text and require owner moderation for new nominees.
- No local matching against **retired, featured, or rejected** entries. Retired entries remain in D1 and are not displayed in the admin nominees review or its status totals. Existing retired slugs still block same-name submissions; restoring a retired commander is a separate owner decision.
- Community votes are keyed by `(nomination_id,visitor_hash)`, and `INSERT OR IGNORE` prevents a single visitor identifier from voting twice for the canonical nominee.
- Do not auto-merge distinct commander cards that share a name, plausible prefixes, or ambiguous nicknames.

## Historical Reveka merge (manual migration)
At deployment, migrate the one existing vote on pending `Reveka` (#17) into approved `Reveka, Wizard Savant` (#10) with `INSERT OR IGNORE INTO nomination_votes ... SELECT` to avoid double-counting. Mark #17 retired **only after** the vote has been safely copied. Preserve the source vote for audit and record the reconciliation in `owner_action_audit`. Create a D1 time-travel bookmark and verify pre/post counts. Do not delete records, old votes, or unrelated nominees.

## QA
Existing CI entry `tests/owner-nominations-api.test.mjs` also imports `tests/nomination-names.test.mjs`, exercising unique short names, misspellings, ambiguous pairs, the retired-name exclusion, and repeat-vote protections. All admin authorization, site-quality, browser, security-sweep/CodeQL and release-coordination gates remain mandatory.
