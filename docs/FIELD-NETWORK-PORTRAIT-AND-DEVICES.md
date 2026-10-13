# Field Network portrait and trusted-device update — October 13, 2026

## Changes

- Fixed the vertical portrait slider: previously `object-position` could not move a landscape Scryfall art crop vertically inside a square (the entire image height fitted the frame). Portraits now render inside clipped circles with a **real 2D translate + scale**, both constrained to prevent blank edges.
- Increased face-close-up magnification to a default **2.8×**. Users can fine-tune the image with left/right, up/down and **1.8×–4.2× zoom** sliders on profile registration and edit, aiming for roughly **70% of the avatar circle filled by the subject's face** where the artwork permits. All sliders update a live preview, and profiles/comments use the exact same crop.
- Added a `focus_zoom` column to `community_profiles` (default 2.8), preserved in register/update/profile/comment responses, without changing existing user handles, keys, bios, or decks.
- Added `community_device_sessions` to store **SHA-256 hashes**, not bearer values, of independent 256-bit browser tokens. The browser receives an `__Host-dc_device` **Secure, HttpOnly, SameSite=Strict** cookie, expiring after 90 days. The site supports up to ten remembered browsers per profile, and old / expired sessions can be revoked.
- Login offers **Keep me signed in on this device** (default checked). Uncheck on shared/public devices to use temporary `sessionStorage` only. Creating a profile or completing a verified email key recovery automatically remembers the current browser, if allowed by the browser.
- Existing long-term `localStorage` profile keys migrate automatically to a revocable cookie at next sign-in; on successful migration, the original sensitive key is removed from browser storage. If session enrollment fails, the existing login is preserved without claiming a successful migration.
- **Sign out on this device** revokes the browser's hashed server token, clears temporary and legacy key storage and clears any one-time-key display.
- **Lost-key recovery** deletes all existing remembered sessions when it rotates the profile key, and the newly recovered browser can enroll again.

## Migration

The D1 migration is `db/portrait-and-device-sessions.sql`. It adds one numeric column and one session table with indices. The production migration was applied **before** deploying these code changes to maintain compatibility. Do not rerun the `ALTER TABLE` statement on the same database.

## Security

The session cookie never contains a profile recovery key. Only SHA-256 hashes of device tokens are stored in D1. Each token is generated with the server crypto RNG. A recovery key (and not an existing browser cookie) is required to mint a new remembered-device session. Profile updates, comments, follows and recovery email settings accept either a valid key in a Bearer header or an unexpired first-party cookie, but an *invalid* explicit Bearer header never falls back to another cookie identity. POST device actions enforce a same-origin `Origin`; cookies have SameSite=Strict; global middleware rejects cross-site API posts. Key rotation deletes remembered sessions. Browser privacy restrictions and cookie clearing can force an earlier sign-in.

## Manual smoke checks

1. Load `/community.html#account` in a private browser. Sign in with a valid profile key while **Keep me signed in** is checked. Open browser developer tools and confirm the `__Host-dc_device` cookie is HttpOnly, Secure, SameSite=Strict; confirm there is **no `dc-profile-key` in localStorage**.
2. Close and reopen the browser, return to `/community.html#account`. The profile is still signed in, can access its own decklists and account recovery settings, and has a **This Device** confirmation.
3. Sign out. Confirm refresh does not authenticate. If logged in on another device, that session remains valid.
4. Sign in on a shared device with the checkbox unchecked. Confirm closing the tab/browser ends that login.
5. In **Edit Dossier**, move up/down and side-to-side sliders and observe a visual change. Adjust zoom to a face-focused crop; save, reload, inspect the public profile and a comment authored by the account. All display the same crop.
6. On a recovery-enabled test account, finish a legitimate emailed key reset. Old device cookies are revoked; the recovered browser is remembered under the new key. Never run this on an irreplaceable key without storing the newly displayed one.
7. Try a bad or expired cookie, an invalid bearer key plus valid cookie, and an attempted cross-origin device enrolment; all must be rejected or treated unauthenticated. Check disabled cookies show a temporary sign-in warning rather than claiming persistence.

The Field Network's free profile devices are independent of premium Field Office membership device activations; those are managed by a separate subsystem.
