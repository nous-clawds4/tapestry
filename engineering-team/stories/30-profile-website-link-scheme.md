# Story 30: Profile "Website" link broken for scheme-less URLs

**Status:** Approved
**Created:** 2026-05-29
**Type:** Bug

## Background
A profile's "Website" link is built from the kind-0 `website` field. When that value has no URL scheme (e.g. `kate-cate.com`), the browser treats the link as **relative** and navigates inside the app (`/user/kate-cate.com`) instead of to the external site. Many nostr users enter a bare domain, so this hits a meaningful share of profiles, and it's live in production.

Confirmed this session on `https://brainstorm.world/user/a366c6a73754786fcb8007a78388f3e62e7c58579a6282a74ebd7c0b2f041044` (website stored as `kate-cate.com` → link points at `/user/kate-cate.com`). The same clickable-link pattern exists in two React views; the search views render the website as plain (non-clickable) text and are unaffected.

## User-facing description
As someone viewing a profile, I want the "Website" link to take me to the person's actual external site — even when they entered the address without `https://` — so that I can actually visit it.

## Acceptance criteria
Apply to **every profile view that renders the website as a clickable link**: the primary profile (`/user/<pubkey>`) and the makeshift page (`/tapestry/users/<pubkey>`).

- [ ] **Scheme-less → external.** Given a profile whose website is scheme-less (e.g. `kate-cate.com`), when I activate the Website link, then I'm taken to the **external** site (`https://kate-cate.com`) — not an in-app `/user/...` (or `/tapestry/...`) path.
- [ ] **Already-absolute unchanged.** Given a website that already includes an `http(s)://` scheme (e.g. `https://example.com/foo`), when I activate the link, then I'm taken to that exact URL.
- [ ] **New tab + safe rel.** The link opens in a new tab with `rel="noopener noreferrer"` (as today, both views).
- [ ] **Primary-profile display unchanged.** On `/user/<pubkey>`, the visible link text still shows the website without the scheme / trailing slash (as today).
- [ ] **No website → no link.** A profile without a website still shows no Website link (unchanged).

## Concepts touched
*(UI-only; no concept-graph definition changes, no firmware reinstall. Named in plain language.)*
- **Profile** — the kind-0 `website` field, rendered as a clickable link.

## Out of scope
- **Search-result cards** (`BrainstormSearch.jsx`, `users/Search.jsx`) — they show the website as a non-clickable `<span>`, so there's no broken link to fix.
- **Legacy `public/legacy/profile.html`** — no matching website-link pattern found; appears unaffected.
- **Non-http(s) values** (e.g. `mailto:`, `ftp:`) — we only guarantee a correct **http(s)** absolute link; other schemes aren't special-cased.
- Reconciling the makeshift page's display text (it currently shows the raw value rather than scheme-stripped) — cosmetic, not the reported bug; the link *target* is what this story fixes.

## Open questions
Resolved during planning:
- **Which views?** → **Both clickable-link views** (`BrainstormProfile.jsx`, `users/UserDetail.jsx`). Search cards are display-only and excluded.

None open.

## Notes for the next phase
- **Bug with an obvious cause → Architecture is skipped** (per CLAUDE.md). Next phase is Test Design.
- Confirmed root cause for the Implementer: both `ui/src/pages/BrainstormProfile.jsx:305` and `ui/src/pages/users/UserDetail.jsx:160` set `href={profile.website}` from the raw value; a scheme-less value resolves relative to the current path. The fix normalizes the href to an absolute `http(s)://` URL (prepend `https://` when no scheme is present).

## Linked artifacts
- ADR: *(skipped — obvious bug, no design decision)*
- Test plan: `engineering-team/stories/30-profile-website-link-scheme.test-plan.md`
- Review: `engineering-team/reviews/30-profile-website-link-scheme.md` — **PASS** (2026-05-29)
