-- Ko-fi reconciliation records; deliberately no member keys or public access granted.
-- No payment name or email address is stored in plaintext.
CREATE TABLE IF NOT EXISTS kofi_payment_events (
 message_id TEXT PRIMARY KEY,
 email_hash TEXT NOT NULL,
 tier TEXT NOT NULL CHECK(tier IN ('informant','detective','chief')),
 paid_at INTEGER NOT NULL,
 paid_until INTEGER NOT NULL,
 amount_cents INTEGER NOT NULL,
 received_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS kofi_renewals (
 email_hash TEXT PRIMARY KEY,
 tier TEXT NOT NULL CHECK(tier IN ('informant','detective','chief')),
 last_paid_at INTEGER NOT NULL,
 paid_until INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS kofi_payment_events_email_idx ON kofi_payment_events(email_hash,paid_at DESC);

-- Only verified webhook event categories and timestamps; no payer information.
CREATE TABLE IF NOT EXISTS kofi_webhook_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 received_at INTEGER NOT NULL DEFAULT (unixepoch()),
 event_type TEXT NOT NULL,
 classification TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS kofi_webhook_audit_time_idx ON kofi_webhook_audit(received_at DESC);
