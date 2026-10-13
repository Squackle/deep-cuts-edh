# Global Investigator Profile Button — October 2026

## Behavior

A new circular avatar button is placed at the far-right end of the Deep Cuts EDH header, after navigation and any header action. It appears on every page with the standard site header, including the homepage, Card Library, Deck Workshop, nominations, Field Network, supporters, Field Office, all four Rescue Reports, and private diagnostics.

**Authenticated:** the header calls the existing same-origin `GET /api/community?action=me` endpoint and uses the public profile fields `avatar`, `focus_x`, `focus_y`, `focus_zoom`, and `handle`. The portrait image uses the same Scryfall art crop and 2D focal-point transform as the existing Field Network dossier; a green marker indicates a signed-in account. Clicking the circle opens `/community.html#account`. Its accessible label and hover tooltip name the current investigator (e.g., `@Squackle`).

**Signed out:** the button displays a generic person-outline icon and the tooltip `Sign in or create a Field Network profile`, linked to the same sign-in/account page. If the Scryfall artwork is unavailable, the generic icon remains visible but the account stays signed in.

**Authentication & privacy:** no credentials are embedded in HTML or new persistent storage. The header uses the existing Secure/HttpOnly/SameSite=Strict remembered-device cookie, or the existing per-browser temporary/legacy profile key when one is already present. An invalid old key is retried without the Authorization header so it cannot mask a legitimate remembered-device cookie. All requests use `credentials: 'same-origin'` and `cache: 'no-store'`. No email or key is displayed in the header. The photo is publicly available commander art. A separate public `CustomEvent('deepcuts:profile-change')`, which carries only the public profile object or null, keeps the header in sync with login, logout, key recovery and avatar changes on the Field Network page.

**Layout:** a new `header-profile.css` stylesheet adjusts desktop headers to reserve a dedicated 50px right column for the circular avatar, compresses navigation spacing to reduce unwanted wrapping, and hides the duplicate large header CTA on narrower desktops. On screens at or below 950px, the avatar remains on the top row at the far right while the main links wrap into the row below. Keyboard focus and screen-reader labels are provided.

## Files

- `header-profile.js` — shared component, active account lookup, event updates, art fallback
- `header-profile.css` — compact desktop/mobile nav, portrait frame, presence dot, keyboard focus
- `community.js` — dispatch public-only profile change event from `updateIdentity()`
- 12 HTML pages — load the two shared assets from absolute paths so nested Rescue Report routes work

## Verification

1. Logged out: avatar button displays person icon and links to `/community.html#account`.
2. Logged in via a 90-day remembered cookie: Commander portrait and handle tooltip appear on all 12 page headers; same image crop as profile.
3. Logged in via a temporary recovery key on the same browser tab: button recognizes the profile; no new persistent browser key created.
4. Modify portrait focus and zoom; header updates immediately on saving; navigate to another page and verify persisted matching framing.
5. Sign out on the Field Network page; icon resets; navigate elsewhere and confirm unauthenticated state.
6. Use keyboard Tab/Enter, narrow viewport and desktop: avatar stays at right of header; nav remains usable; no overflow.
7. Simulate a failed Scryfall image or an offline session: fallback person icon remains visible, and account link still opens.

Automated predeployment checks include JS parsing, a simulated signed-in profile response with focus transform, simulated signout events, and presence of the shared assets in all standard-header pages. Live-browser visual verification remains desirable after the Cloudflare build completes.
