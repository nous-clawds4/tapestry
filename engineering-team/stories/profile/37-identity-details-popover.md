# Story 37: Profile identity details popover (move npub + pubkey behind a name-adjacent control)

**Status:** Approved
**Created:** 2026-06-16
**Type:** Feature
**Epic:** `profile`

## Background
On the main profile page (`/user/:pubkey`), the Identity section currently displays the account's **npub** and **hex pubkey** inline, each with a copy-to-clipboard control, stacked above Website and Lightning. For most visitors most of the time these two long cryptographic strings are noise — they clutter the page with information that only a minority needs, and only occasionally. But when someone *does* need them (to copy an npub, to verify a pubkey), they must be readily reachable and copyable.

This story tucks the two identifiers behind a small, recognizable control placed to the right of the profile display name — opening a popover that shows the npub and hex pubkey with copy-to-clipboard. This declutters the default view while keeping the identifiers one tap away. The control is intentionally framed as a general **"details drawer" that will grow**: future iterations may surface additional account details through the same control, so its affordance should read as "more details," not specifically "keys."

This is the approved, independent first half of the 2026-06-16 profile-page conversation. The broader information-architecture reorder discussed alongside it ("Story B") is **deferred pending further discussion** and captured separately in [`docs/PROFILE_IA_REVIEW_2026-06-16.md`](../../../docs/PROFILE_IA_REVIEW_2026-06-16.md); this story does not depend on it.

## User-facing description
As someone viewing a profile, I want the account's technical identifiers (npub and pubkey) tucked behind a small control next to the name — rather than shown inline by default — so the page stays uncluttered, while I can still open that control to view and copy them when I need to.

## Acceptance criteria
Testable from the outside.

- [ ] A control sits immediately to the right of the profile display name, floated/aligned to the right in the manner of the page's existing information popovers, and rendered with a **neutral "more details" glyph** (e.g. an ellipsis or chevron) — **not** a key or other identifier-specific icon.
- [ ] The control carries an assistive-technology label describing its purpose (e.g. it announces that it reveals the account's identifiers/details), consistent with how the page's existing information controls are labeled.
- [ ] Activating the control opens a popover, and dismissing it (activating the control again, choosing a close affordance, or dismissing outside the popover) closes it — the same open/close interaction as the page's existing "what does verification mean?" / "reputation" information popovers, and visually consistent with them.
- [ ] The popover displays the account's **npub** and its **hex pubkey**, each clearly labeled as to which is which.
- [ ] Each of the npub and the hex pubkey has a copy-to-clipboard control that copies that exact full value (not a truncated form) and gives the same on-copy confirmation feedback used elsewhere on the page.
- [ ] The npub and hex pubkey are **no longer rendered inline** in the Identity section of the profile body; they appear only via the popover.
- [ ] Website and Lightning remain displayed in the Identity section exactly as before — present, labeled, and functional (the website link still opens; the lightning address still shows) for profiles that have them.
- [ ] Given a profile that has **neither** a website **nor** a lightning address, the Identity section does not render as an empty or label-only shell (with the identifiers removed there is nothing left to show, so the section/heading is absent rather than blank).
- [ ] The change is purely presentational: the npub/pubkey values, the website, and the lightning address shown are the same values, derived the same way, as before this story.

## Concepts touched
Concept Graph API was unreachable at planning time (`http://localhost:8877`); the Architect should resolve/confirm handles when orienting.

- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:nostr-user` — the account being viewed; the npub and hex pubkey are two encodings of its public key (NIP-19 bech32 vs raw hex).
- Plain-language: **npub / pubkey identifier encodings** (NIP-19) — the values surfaced in the popover. (Resolve to a concept handle if one exists.)

## Out of scope
- The broader profile information-architecture reorder — promoting the Verification Score, lifting/collapsing the Reputation section, de-duplicating grid cards, removing the grid Reporters card. All deferred to "Story B" ([`docs/PROFILE_IA_REVIEW_2026-06-16.md`](../../../docs/PROFILE_IA_REVIEW_2026-06-16.md)).
- Renaming or relocating the Identity section heading (the "Identity" → "Links" relabel is part of Story B and is gated on this story shipping).
- Adding any further fields to the popover beyond npub + pubkey. The control is *designed* to grow, but this story ships exactly the two identifiers.
- Any change to how npub/pubkey/website/lightning are fetched, derived, or validated; any backend/API change; any change to other pages or to the user-menu surfaces.

## Open questions
For the Architect:
- **Pattern reuse (operator intent):** the operator asked that this be built for maximum consistency with the page's existing information popovers and copy affordance — i.e. reuse the established tap-to-open popover machinery and the existing copy-to-clipboard control rather than introduce a new widget. Confirm the cleanest way to do so within the house constraints below; the trigger glyph differs deliberately (neutral "details" glyph, not the `ⓘ` used by the explainer popovers, to avoid colliding with their "explain this concept" meaning).
- **Glyph choice:** ellipsis vs chevron (or another neutral "more"/"details" glyph) — pick one consistent with existing iconography. House rule: no new icon library; use an existing unicode glyph.
- **Empty-Identity-section handling:** confirm the section collapses cleanly when only website/lightning remain and both are absent (see the corresponding acceptance criterion).

## Deviations
- **Trigger pinned to the far-right edge** (operator preference, 2026-06-16) rather than immediately adjacent to the name (ADR 0033's chosen sub-option). Implemented by adding `flex: 1` to `.bsp-header-info` so `.bsp-name-row` spans the header width and the existing `.bsp-info-btn { margin-left: auto }` floats the `⋯` to the right edge — matching the two `ⓘ` icons. ADR 0033 explicitly listed far-right as the alternative, so this is a sanctioned switch, not a contradiction.

## Linked artifacts
- Design context: [`docs/PROFILE_IA_REVIEW_2026-06-16.md`](../../../docs/PROFILE_IA_REVIEW_2026-06-16.md) (the deferred "Story B" sibling).
- Related ADRs (pattern precedent): `engineering-team/decisions/profile/0032-verified-counts-explainer-and-alarm.md` (the shared information-popover pattern this should stay consistent with), `engineering-team/decisions/profile/0030-profile-website-link-scheme.md` (the website link behavior that must be preserved).
- ADR: `engineering-team/decisions/profile/0033-identity-details-popover.md` (Accepted)
- Test plan: `engineering-team/stories/profile/37-identity-details-popover.test-plan.md` (suite `test/profile-identity-details-popover.test.js`, wired into `test/test.js`)
- Review: (filled in after Review phase)

## House constraints (carried from intake)
- JS-without-build; **tokens-only** styling (`bsp-*` classes + existing CSS custom properties); **no new icon library**, lint, typecheck, or build tooling (would require its own ADR).
- Tested via the `test/test.js` Node runner with **source-regex sentinels** (the established profile-UI pattern), **not** Playwright (its harness is currently broken and irrelevant here).
