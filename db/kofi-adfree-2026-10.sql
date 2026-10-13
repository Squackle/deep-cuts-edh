-- Ko-fi subscriber ad-free benefit: verified recurring payment only.
-- Server-stored email identifiers are keyed HMACs, never plaintext.
CREATE TABLE IF NOT EXISTS kofi_adfree_payments(
 message_id TEXT PRIMARY KEY,
 email_hash TEXT NOT NULL,
 paid_at INTEGER NOT NULL,
 paid_until INTEGER NOT NULL,
 amount_cents INTEGER NOT NULL,
 currency TEXT NOT NULL,
 created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS kofi_adfree_payments_recipient ON kofi_adfree_payments(email_hash,paid_at DESC);
CREATE TABLE IF NOT EXISTS kofi_adfree_renewals(
 email_hash TEXT PRIMARY KEY,
 last_paid_at INTEGER NOT NULL,
 paid_until INTEGER NOT NULL,
 updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
-- Legacy supporters who joined before webhook fixes can be reconciled by an
-- owner who independently confirms the subscription in Ko-fi.
CREATE TABLE IF NOT EXISTS kofi_adfree_manual(
 email_hash TEXT PRIMARY KEY,
 paid_until INTEGER NOT NULL,
 verified_at INTEGER NOT NULL DEFAULT (unixepoch())
);
