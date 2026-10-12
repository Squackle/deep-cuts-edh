# Community nomination operations

Nominations are native to the site and saved to a Cloudflare D1 database named `deep-cuts-nominations`. No GitHub sign-in is required for visitors.

## Production environment

Project: `deep-cuts-edh` (Cloudflare Pages, Git source `Squackle/deep-cuts-edh`).
D1 binding name: `DB`.
Secrets required for production Pages Functions:
- `TURNSTILE_SECRET`: Cloudflare Turnstile widget secret, stored as an encrypted secret environment variable.

Frontend's public Turnstile **site key** is in `index.html`. The private Turnstile secret must **never** be committed to GitHub.

Configured in Cloudflare Pages on October 12, 2026: production and preview environments have an encrypted `TURNSTILE_SECRET`, and the `DB` binding points to the initialized D1 database. Never commit the secret to this repository. If you change the Turnstile widget secret, update the Cloudflare environment secret and redeploy.
Turnstile widget is restricted to `deep-cuts-edh.pages.dev`. Add any custom domains in Turnstile settings before switching to them.

## Moderator workflow

The API automatically merges names using a normalized key. Initial known commanders are pre-approved, with 0 votes. A nomination for an approved commander increments its count. A new commander goes into `pending` until you approve it. Open Cloudflare D1 → `deep-cuts-nominations` → Console and run:

```sql
SELECT id,name,status,budget,rationale,strategy,cards FROM nominations WHERE status='pending' ORDER BY created_at DESC;
-- Approve a verified, appropriate Commander nomination:
UPDATE nominations SET status='approved' WHERE id=123 AND status='pending';
-- Or reject spam/invalid nominations:
UPDATE nominations SET status='rejected' WHERE id=123 AND status='pending';
```

The live leaderboard uses approved nominations only, sorted by count. This makes the highest-ranked **approved** nomination the suggestion for the next Rescue Report. Close voting for a selected report by marking it `featured`; it then drops off the open leaderboard:

```sql
SELECT n.id,n.name,COUNT(v.visitor_hash) AS votes
FROM nominations n LEFT JOIN nomination_votes v ON v.nomination_id=n.id
WHERE n.status='approved' GROUP BY n.id
ORDER BY votes DESC,n.id ASC;
UPDATE nominations SET status='featured' WHERE id=123 AND status='approved';
```

This **does not generate or publish articles** automatically. Research, legality and strategy verification, playtesting, and editorial review should happen before publishing. After publishing, use `retired` if desired.

## Anti-abuse and privacy

- Cloudflare Turnstile token is verified server-side for each submission.
- There is no user account requirement.
- The browser generates a local anonymous UUID; its salted SHA-256 hash is stored, not the original value.
- The server hashes the connecting IP address for a daily per-IP limit of 12 submissions, without storing the raw IP address.
- A given browser ID can nominate each commander once; switching browsers or devices may allow another vote. The count is not a verified number of unique humans.
- Free-text nomination details are stored for moderators but **never returned in public API**.
- A new commander is hidden until approved to limit public abuse.
- Turnstile needs to be configured for any additional public hostname.
