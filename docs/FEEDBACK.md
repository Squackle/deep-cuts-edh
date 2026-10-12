# Private feedback inbox

Visitors can use the **Feedback** button on any Deep Cuts EDH page to report a bug or request a feature. The form requires human verification and saves messages privately to Cloudflare D1.

Go to Cloudflare → Storage & Databases → D1 → `deep-cuts-nominations` → Console and run:

```sql
SELECT id,category,page,message,status,created_at
FROM site_feedback
ORDER BY created_at DESC LIMIT 100;
```

Mark reports when you handle them:

```sql
UPDATE site_feedback SET status='triaged' WHERE id=123 AND status='new';
UPDATE site_feedback SET status='resolved' WHERE id=123;
```

Do not display user-written feedback in public HTML without escaping it, and do not assume reports are verified bug reproductions. The API requires Turnstile, accepts 15–2,000 characters, records the user's current page path, and caps five messages per IP per day. Visitor IP hashes are stored in a separate rate-limiting table, not in report records.

If you later add an admin interface, require an authenticated owner role; do not expose public endpoints listing private feedback.
