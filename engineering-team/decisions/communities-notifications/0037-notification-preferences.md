# ADR 0037: Notification preferences — device-local, off by default

**Status:** Proposed
**Date:** 2026-06-06
**Story:** `engineering-team/stories/communities-notifications/7-notification-preferences.md`

## Context
Story 7 builds the sovereignty control: independent occasion toggles, **off by default**, no master switch, immediate save with a quiet confirmation, revert-on-failure, and state by position + text label (not color). It must exist before the inbox (Story 8) consumes it. Q6 is resolved: in-app only, so the occasions are in-app surfaces. The open question is **where the preference is stored**: device-local vs portable with the identity.

Facts: the app already uses `localStorage` (App.jsx, `auth/viewer.js`) and NIP-07 signing (posts/assertions). The signed-in account menu (Header.jsx) is the natural home for a settings link; there is no settings route yet.

## Options considered

### Option A — Device-local (localStorage), behind a small persistence module
Preferences live in `localStorage`, keyed per viewer pubkey, read/written through `lib/notificationPrefs.js`. A pure default/merge core; a thin I/O wrapper.
- **Pros:** simplest; no signing friction for a settings toggle; instant save; off-by-default is trivial (no stored value → all off); **avoids publishing your notification preferences to a public relay** (a real privacy question portability would raise). The persistence is isolated, so a future portable backend is a clean swap.
- **Cons:** not portable — the choice doesn't follow the person across devices/clients. Mitigated: defaults-off means a new device is safely silent until set; notifications are in-app/ephemeral anyway.

### Option B — Portable via a signed (encrypted) app-data event
Store preferences as a NIP-78 kind-30078 app-data event (NIP-44 self-encrypted for privacy), so the choice follows the identity.
- **Pros:** portable and on-thesis for portable identity.
- **Cons:** requires signing to change a setting (friction); a relay round-trip per toggle (the "saves immediately" feel suffers); encryption adds surface; and it commits to a wire format prematurely. Heavier than a settings toggle warrants for v1.

## Decision
We chose **Option A** for v1. A settings toggle should be instant and frictionless, and publishing/encrypting preference events is disproportionate to the value at launch — especially since defaults-off makes a fresh device safely silent. The persistence is isolated behind `lib/notificationPrefs.js`, so making preferences **portable later is a contained swap** (replace the I/O adapter; the pure default/merge core and the UI stay). Portability becomes a future ADR if/when it's wanted, with the privacy (publish-your-prefs) question decided there.

## Consequences
- **Enables:** instant, frictionless toggles; off-by-default by construction; a pure, testable core; no relay/signing dependency for settings.
- **Constrains:** preferences are per-device for v1 (documented; not portable yet).
- **New debt:** none material — the persistence boundary contains the future swap. A `localStorage.setItem` can throw (quota/private mode), which is exactly the failure the revert-on-failure criterion covers.
- **Firmware reinstall required?** No.

## Implementation notes
- **`ui-communities/src/lib/notificationPrefs.js`** (new):
  - `OCCASIONS = [{ id:'vouched', label:'Someone vouches for you' }, { id:'new-posts', label:'New posts in your circles' }, { id:'replies', label:'Replies to you' }]`.
  - **Pure** `defaultPreferences()` → `{ vouched:false, 'new-posts':false, replies:false }` (all off).
  - **Pure** `mergePreferences(stored)` → `{ ...defaultPreferences(), ...(only known boolean keys from stored) }` (missing/unknown → default off). This is the off-by-default guarantee and the testable core.
  - `storageKey(pubkey)` → `communities:notif-prefs:<pubkey>` (per-identity, so identities on one device don't collide).
  - `loadPreferences(pubkey)` → parse `localStorage` via `mergePreferences`, `try/catch` → defaults on any error.
  - `savePreference(pubkey, occasion, enabled)` → load, set the one key, write JSON; return `{ ok: true }` or `{ ok: false }` on a thrown write (quota/private mode). Pure-core + thin I/O kept separate.
- **`ui-communities/src/pages/NotificationSettings.jsx`** (new): renders a toggle per `OCCASIONS` entry from `loadPreferences(viewer)`; each toggle shows the switch position **and** an "On"/"Off" text label; on change, optimistic flip + `savePreference`, show a quiet "Saved" on ok, on `!ok` revert to last saved + an inline "Couldn't save. Retry?". **No master switch.** Signed-out → a sign-in prompt (reuse the existing pattern; this is per-person). No notifications are generated or shown here (Story 8).
- **`ui-communities/src/App.jsx`** — add a route `{ path: 'settings', element: <NotificationSettings /> }` under the AppShell children; pass `viewer/signedIn/onSignIn` via the existing outlet context.
- **`ui-communities/src/components/Header.jsx`** — add a "Notification settings" item to the signed-in account menu (after "Start a Circle") → `onNavigate('/settings')`. Not a top-level nav item.
- **CSS** — a `NotificationSettings.module.css` (token-based) for the toggle rows; the switch state conveyed by position + the text label, accessible as a real control (`role="switch"`/`aria-checked` + 44px target + visible focus ring).

## Out of scope
- Generating/showing notifications (Story 8). Channels beyond in-app. Per-circle granularity. Portable/encrypted storage (future ADR).
