# Weekly Rescue Report automation — October 26, 2026

## Scope and truth in labeling

This is a **separate automated editorial publication**, distinct from the four hand-edited Rescue Reports 001–004. Owner authorized weekly automatic research, generation and release. AI-assisted articles are explicitly labeled and **do not claim** verified EDHREC commander deck counts, measured strategy adoption, a complete/verified 100-card deck, official rules certification or actual playtesting. Current originality selection uses Scryfall's EDHREC **card-use rank as a rough proxy**, not commander-as-leader deck popularity. Future work can integrate a licensed commander deck dataset to measure strategy adoption.

## Publishing cadence

Friday 10:00 AM America/Chicago, DST-aware. Cron triggers in UTC: `0 15 * * 5` and `0 16 * * 5`, and the Worker validates the *local Chicago hour = 10* before running either one. Scheduled requests neither affect existing game scores nor use member databases. The first eligible Friday after launch is October 30, 2026.

## Pipeline

1. Fetch three eligible Commander-legal English Scryfall card records from several **card-use popularity bands**. Select a blend of more- and less-common cards across weeks.
2. Run Workers AI to propose an unusual alternative strategy and exact evidence-card names.
3. Verify 6+ cards via Scryfall collection: English, actual paper card, Commander-legal, commander-compatible color identity. A model cannot invent a card, name its own commander, or evade the checks.
4. Ground the article using those same retrieved Oracle texts. Only verified named cards appear as linked evidence; avoid unsupported numeric adoption, alleged infinite combos and fake playtest claims. Articles are labeled strategic hypotheses.
5. Enforce section completeness and risky-claim guards. **If any check fails, publish nothing; keep existing articles intact** and report `held_for_review` in the Worker `/v1/health` status.
6. Store only public report JSON and a 104-article index in a **new dedicated `deep-cuts-edh-weekly-reports` KV**. No new D1 schema, existing member records, sessions, payments, analytics, or game data touched. Cron is idempotent for each Central date.
7. Render public index `/rescues` and stable article pages `/rescues/YYYY-MM-DD` on the existing site's Pages Functions. The homepage links to the archive and the sitemap includes its landing page. No external AI keys or cloud account secrets are stored in repo.

## Operations

Worker script: `deep-cuts-weekly-publisher`, source `workers/weekly-rescue-publisher.js`. Workers AI model binding `AI` (Llama 3.3 70B), KV `REPORTS`. Worker `https://deep-cuts-weekly-publisher.logan-ottfamily.workers.dev/v1/health` is read-only and publicly shows last run status without revealing drafts.

Cloudflare deployment is independent of site GitHub changes: upload the **same reviewed file** as Worker, add `AI` and `REPORTS` bindings, enable workers.dev route, add both Cron expressions, check `GET /v1/health` and `GET /v1/index`. Do not run Friday publication manually outside the release window; do not seed invented articles. The Pages Functions request the read-only worker API. On first live Friday, check status, articles, Scryfall evidence links, links from the homepage, and public HTML view before claiming that the system produced its first genuine automated article. A green deployment alone is not proof of an article.

## Failure and rollback

No publication happens when Scryfall, Workers AI, source verification, or writing to KV fails. If the model output is weak, the latest public report remains available. A failed Friday is a **missed release**, not silent synthetic content; investigate the status and adjust validation or data sources before attempting a reviewed retry. Disable both Cron triggers to pause. To revert site display, revert the scoped Pages PR. To disable the research engine, remove its scheduled triggers; do not delete the KV archive. The existing hand-edited `/reports/*` articles and `/feed.xml` legacy RSS are deliberately unchanged. The new archive provides server-rendered report links for indexing, but search engine indexing is never guaranteed.

## Quality caveat

Automated legality/color identity/name checking **cannot certify complex Commander card interactions** or prove a strategy original. Research includes a prominent limitation and Scryfall Oracle links. For materially higher-quality articles, add a card-interaction evaluator or independent review before publication rather than silently claiming AI prose is authoritative.
