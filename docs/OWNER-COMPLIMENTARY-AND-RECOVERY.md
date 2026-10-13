# Deep Cuts EDH: complimentary keys, private directory and profile recovery
Last revised: October 13, 2026.

## 1. Private owner membership console

Open `https://deep-cuts-edh.pages.dev/member-operations.html`, enter the independently issued **owner membership-issuer key** (see the existing one-time private owner credential file), then press **Load private dashboard**. The page is noindexed and not linked from public navigation. More importantly, the private API `/api/owner-members` requires that bearer key on every request, verifies its SHA-256 hash server-side against `member_issuer_credentials`, and rate-limits access.

The owner directory shows:
- Free Field Network profiles (handle, creation date, public decks/comments/playtests, and whether a recovery email was verified). It **never** exposes a profile key or full email address.
- Paid and complimentary Field Office accounts (tier, source, expiry, active/inactive status, activated-device counts, and most recent device use). Ko-fi subscriber emails remain private/HMAC-hashed and are not visible.
- Complimentary-grant audit entries, including issuance, key rotation, extension, revocation, timestamps and member ID. Never includes the original key.

The owner key is held in page memory only and is neither stored in browser storage nor included in URL query parameters or analytics. Do not share the file, paste the key into public chats, or leave the console open on shared devices. This is a bearer-key admin model, not Cloudflare Zero Trust MFA; adding Access MFA is recommended before scaling.

## 2. Owner-created complimentary Field Office keys

From the private console choose a label, tier (Informant, Detective, Chief) and duration (1–365 days), then **Generate free key**.

The server generates a 256-bit random `dcmember1_<id>_<secret>` key; only its SHA-256 digest is stored. The one-time plaintext appears in the private owner console for secure delivery to the recipient; **it cannot be retrieved later**. Existing `member_accounts` and `member_devices` enforce up to two devices per member. A complimentary grant is separate from Ko-fi billing and does not require a payment.

The `member_complimentary_grants` table records grant tier, label, expiration and revocation. `member_grant_audit` records owner actions without private keys. `member_devices.last_seen_at` tracks activity (at most one timestamp write per hour per device). The owner can renew a grant, rotate a key (revokes old devices), or revoke access immediately.

**Important distinction:** this is free **Field Office tier access**, not the already free Field Network profile identity. Community profile registration continues to issue free `dcprofile1_...` credentials to the person creating the account. The two credential systems remain separate.

The original Ko-fi paid entitlement readiness flag `KOFI_MEMBER_ACCESS_READY` remains OFF: only verified, nonexpired complimentary grants are admitted while paid Ko-fi onboarding is incomplete. Paid access continues to fail closed until its payment verification and cancellation process are tested. The owner cannot convert a free grant into a real payment.

## 3. Profile-email verification and recovery

An existing signed-in community profile can link/change a recovery email, and new registrants can optionally supply one. The email association is not considered verified until the account owner completes a one-time **8-digit** code sent to that address. Addresses are AES-GCM encrypted in D1, and their lookup hashes are HMAC-SHA256; the secret material lives only in Cloudflare's encrypted production environment. The existing `KOFI_EMAIL_HASH_SECRET` is reused with purpose-separated derivation; rotating it requires a coordinated migration of *both* Ko-fi renewal hashes and encrypted community profile email data.

A user who loses their `dcprofile1_...` key can open Field Network → My Profile → **Lost your profile key?**, enter the *already verified* email address, complete Cloudflare Turnstile, and receive a 15-minute, one-use code. After verifying the code, the server atomically replaces the old key hash, invalidates pending recovery challenges, and displays a newly generated random key. The old key immediately stops working. The new key is **not sent by email** because keeping long-lived credentials in mailboxes is riskier; email delivers the recovery code rather than exposing the key.

Recovery start returns the same public message whether an account exists or not; uses per-IP/per-email daily limits and Turnstile. Code completion has at most five attempts per challenge. Only a verified, currently linked email can recover the profile. Email linking requires a valid existing profile key and an email challenge; knowing someone's handle/email alone cannot claim their account. The profile and email/challenges cascade on account deletion.

**Preexisting profiles:** They have no verified recovery email because the site historically stored no addresses. They MUST sign in with their original key once and verify an email while they still have access. A lost key with no previously verified email cannot be automatically recovered. Do not impersonate a user or silently issue a new key from a public profile page.

## 4. Email provider setup REQUIRED

Email delivery is **not active** on the current project; no verified sender domain or provider key is configured. Cloudflare has no managed zones registered in the connected account, and the existing Pages production configuration has no transactional-email credentials.

The site currently supports **Resend's transactional API**. To make profile email recovery operational:
1. Set up a sender domain with Resend and verify its DNS records according to its setup steps (SPF/DKIM etc.). Choose a sender such as `Deep Cuts EDH <accounts@YOUR-VERIFIED-DOMAIN>`.
2. In Cloudflare → Workers & Pages → `deep-cuts-edh` → Settings → Variables and Secrets → Production, add encrypted `RESEND_API_KEY` and a `PROFILE_EMAIL_FROM` variable matching the verified sender.
3. Redeploy production so Functions can see the new bindings, confirm the sending account/domain limits and run an end-to-end controlled test: email link, code confirmation, key reset, and rejection of the old key.
4. Do not set an unauthenticated email sender or embed API keys in public JavaScript/GitHub.

When missing, registration and key-only sign-in still work, but email association and recovery endpoints reject requests safely with a clear setup message. There are no fallback emails, no plaintext codes in logs, and no way to recover an old key by reading its stored hash.

## 5. Operational checklist

- Check `PRAGMA foreign_key_check` after migration `db/member-and-email-recovery.sql`.
- Verify owner API calls without a key or with a malformed key return unauthorized.
- Issue a short-term controlled complimentary test key, activate on one device, confirm entitlement by tier and expiry, then revoke; confirm the device becomes unusable and audit records retain no plaintext key.
- Test listing separate free profiles, complimentary grants, Ko-fi records and paging. Confirm there is no subscriber plaintext email and no profile key exposed.
- Confirm recovery links from existing profiles require the profile key; recovered keys render once and invalidate previously saved keys in browsers.
- Test recovery enumeration resistance, Turnstile, code expiry, wrong-code lockout, rate limits, reuse prevention, sender failure rollback and email changes.
- Keep owner credential secure. The existing Ko-fi subscriber verification and privacy guardrails still apply.

Files: `functions/api/owner-members.js`, `src/owner-access.js`, `member-operations.html`, `owner-console.js`, `functions/api/profile-recovery.js`, `src/profile-email.js`, `community-recovery.js`, `src/member-auth.js` and `db/member-and-email-recovery.sql`.

## October 13, 2026: encrypted, pending address for a legacy profile

For a legacy profile that predates verified emails, the owner may record a **pending recovery contact** after independently confirming mailbox access through an authenticated, connected Gmail identity. A pending contact must *never* itself authorize a key reset. Its purpose is to preserve the owner's request and display a clear pending indicator until the site can email a confirmation code.

- Table: `community_pending_recovery_contacts` (migration `db/community-email-pending.sql`). The full email is **AES-256-GCM encrypted with a key derived from the private random owner credential**, with a random 96-bit nonce and the profile ID as authenticated associated data. The address lookup is additionally HMAC-SHA256 keyed by the same owner credential. Only a masked address is displayed to the profile owner; the owner's raw credential and the plaintext address are never stored in D1 or committed to GitHub.
- The site does not treat this table as verified. `GET /api/profile-recovery` reports `pending=true` but `verified=false`. `start_recovery` and `finish_recovery` continue to consult **only** `community_profile_emails` with a completed verification. No current or old profile key is rotated by adding a pending contact.
- Once a transactional-email sender has been configured, the signed-in profile owner re-enters the full address and completes the standard 8-digit email challenge. Successful verification writes the email into the normal secret-encrypted verified table and deletes the pending record in the same D1 batch. Old staged ciphertext is then no longer needed.
- No verification email is sent when pending contacts are created. Neither the owner directory nor any public profile page exposes the full address; the private owner directory can distinguish pending from verified.
