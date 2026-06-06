# Story 45: Trust signal + applicant/member display (Block 3)

**Status:** UI built (detail People tab) + independently reviewed (2026-06-05); **largely DONE**. Two honest follow-ups remain: (a) the trust signal on the **discovery grid** (component is reusable; needs per-card roster data — a batching/perf consideration), (b) the **applicant role** (needs the `selfApplied` flag on `profiles-tagged` — a Vinney ask). Lights up with real data once the ops items land (`VITE_PROFILE_API_BASE`/CORS/`minRank`).
**Type:** Feature · **Epic:** `communities-membership` · **ADR:** 0030 + 0031. **This is Block 3 (trust signal), folded here because it reads the same engine.**

## Data layer (2026-06-05)
- `ui-communities/src/lib/roster.js` — `getRoster(circle, {wotPov:'house', threshold})` → `{members, viewerAssertions}`: resolves each claimed tag-element coord → current event id → `${VITE_PROFILE_API_BASE}/api/profile-tags/profiles-tagged` → unions across claimed tags → two-part gate (`isMember`, shared with `deriveRoster`). Network seams injected for tests; real defaults use the relay + cross-origin fetch with graceful-empty on CORS/network failure (ADR 0031, Option A). Tests `test/roster-client.test.js` (9/9). Independent review: PASS, no blocking.
- **v1 = members only.** The count endpoint collapses self-application, so "applicant" isn't derivable — needs a per-row `selfApplied` flag on `profiles-tagged` (a Vinney ask). AC for applicant role is therefore parked until that lands.
- The UI (ACs below) is the remaining work and the natural review-with-a-human point (copy + visual hard rules apply).

## Background
The trust signal and per-member legibility the PRD/design specified, now backed by the real roster: "N people you trust are inside" (signed-in) / "N established members" (house, signed-out); each member shown with their trusted/untrusted standing from the viewer's PoV; impersonators weightless. Plus the applicant→member role on the People tab.

## User-facing description
As a **Newcomer**, I want to see how many people I trust are inside and tell real members from impersonators, so I can judge a circle before joining.

## Acceptance criteria
- [~] Detail shows the PoV trust signal, works with **no account** (`TrustSignal` on the People tab). v1 = house PoV (`personalPov` flag flips to personal when WoT-provisioned). **Discovery-grid trust signal deferred** (follow-up a).
- [~] The People tab renders the derived roster — **member** role done; **applicant** role deferred (needs `selfApplied`, follow-up b).
- [x] Each member shows trusted/untrusted standing (text + `--success` dot, never color alone); the untrusted "no one you trust vouches for them" branch is data-driven (renders when 0-app rows surface with the applicant work).
- [x] If the trust network is unreachable, degrade with a retry (no blank/blocked page) — `degraded` state.

## UI build (2026-06-05)
- `components/TrustSignal.jsx` (+CSS) — the avatar-cluster + line; both PoV copy variants per the design guide.
- `CommunityDetail.jsx` — declaration circles load `getRoster` (house PoV), render TrustSignal + RosterRow list + empty/loading/degraded states; **"I'm in"** (self-tag +1) and per-row **Vouch** (+1) publish via `buildMembershipAssertion` → `publishEvent(MEMBERSHIP_WRITE_RELAYS)`. Bespoke circles keep the prior `getCommunityMembers` path.
- `Found.jsx` publishes the circle's tag-element on founding so the default claim resolves; `publish.js` adds the env-driven `MEMBERSHIP_WRITE_RELAYS` (A1 dual-publish).
- Tests: `roster-client` (11/11), `ui-people-roster` (4/4), `founding-publishes-tag-element` (4/4); `npm run build` clean. Independent review: **PASS, no blocking.**

## Out of scope
The roster math (Story 44). Posting gate (Story 47).

## Linked artifacts
ADR 0030; design guide (Trust Signal component); BLOCKED on Story 44.
