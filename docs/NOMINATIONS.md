# Viewing and moderating community nominations

Public page: https://deep-cuts-edh.pages.dev/nominations.html

This page shows the live leaderboard of *approved* commander names only. Anyone can nominate directly without GitHub. Each nomination records a vote from a browser identifier. The database also enforces per-IP limits and Turnstile verification. A person can vote from a different device/browser, so these are anonymous nominations, not verified unique people.

Private moderation is in the connected Cloudflare account:

1. Open https://dash.cloudflare.com/ and choose **D1** under Storage & Databases.
2. Select **deep-cuts-nominations** → **Console**.
3. Query pending names and details:

```sql
SELECT id, name, rationale, strategy, cards, budget, created_at
FROM nominations WHERE status='pending' ORDER BY created_at DESC;
```

4. Approve or reject by the exact id. First check for duplicate names and alternative spellings:

```sql
UPDATE nominations SET status='approved' WHERE id=123 AND status='pending';
UPDATE nominations SET status='rejected' WHERE id=123 AND status='pending';
```

5. View the live vote counts for approved candidates:

```sql
SELECT n.id,n.name,n.status,COUNT(v.nomination_id) AS votes
FROM nominations n
LEFT JOIN nomination_votes v ON v.nomination_id=n.id
WHERE n.status='approved'
GROUP BY n.id
ORDER BY votes DESC,n.created_at ASC;
```

6. When you've chosen an article, mark the commander as featured to remove it from active voting:

```sql
UPDATE nominations SET status='featured' WHERE id=123 AND status='approved';
```

If a pending variant is the same actual commander as an approved candidate (e.g. "Reveka" versus "Reveka, Wizard Savant"), do **not** approve both separately. To preserve votes, merge distinct browser votes, then remove the duplicate pending name:

```sql
-- Replace both ids with actual SELECT results first.
INSERT OR IGNORE INTO nomination_votes(nomination_id,visitor_hash)
SELECT 456,visitor_hash FROM nomination_votes WHERE nomination_id=123;
DELETE FROM nomination_votes WHERE nomination_id=123;
DELETE FROM nominations WHERE id=123 AND status='pending';
```

Here, 123 is the pending duplicate and 456 is the existing approved commander.

*The tool does not automatically write or publish a full Rescue Report. It only determines the next editorial frontrunner.*
