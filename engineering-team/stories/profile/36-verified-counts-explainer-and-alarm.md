# Story 36: Verification explainer popover + dynamic Verified-Reporters alarm

**Status:** Approved
**Created:** 2026-06-08
**Type:** Feature
**Epic:** `profile`

## Background
Two gaps in the verified-counts UX:
1. **Nobody is told what "verified" means.** The profile and the `/reporters` page show "Verified Followers"/"Verified Reporters" with no explanation that "verified" = a trust rank above a cutoff, computed from *this instance owner's* point of view. The current `/reporters` "About this data" popover talks about data provenance (local / NIP-85), not the concept.
2. **A genuinely-worrying reporter count looks the same as a benign one.** Today the Verified Reporters badge is styled as a negative signal whenever it is `> 0` (ADR 0001) — which both over-warns (one reporter on a normal account) and gives no way to distinguish "a few, normal for a big account" from "enough to actually worry." Popular accounts naturally accrue some verified reporters, so a flat threshold would red-flag everyone.

This story makes the counts self-explanatory and makes the reporter alarm meaningful: a single shared "what does verification mean?" popover (on the profile and the `/reporters` page), and a Verified Reporters visual alarm that only fires past a popularity-adjusted threshold.

## User-facing description
As someone reading a profile, I want to understand what "verified" means and to be visually alerted only when an account has been reported by *enough* trusted people to actually warrant concern — so the signal is informative, not alarmist.

## Acceptance criteria
Testable from the outside.

- [ ] An information control opens a popover titled `What does "verification" mean?` whose body explains that verification means a rank score above the cutoff (out of 100) calculated from the point of view of this Tapestry instance's owner, and shows the owner's name and avatar.
- [ ] The cutoff shown in the popover is the **actual configured** verified cutoff expressed out of 100 (e.g. a 0.05 influence cutoff shows as "5"), sourced from configuration — not a hardcoded value.
- [ ] The information control + popover appear on the **main profile** near the Verified Followers / Verified Reporters counts, **and** on the `/reporters` page (replacing its current "About this data" popover) — the same popover in both places.
- [ ] On the profile, the Verified Reporters count shows a visual alarm (distinct alarm color **and** an attention icon) when it reaches the threshold **3 + floor(verifiedFollowers / 750)**; below that threshold it shows **no** alarm (visually indistinguishable from a benign count).
- [ ] When Verified Followers or Verified Reporters is unavailable ("—"), **no** alarm is shown (no crying wolf on incomplete data).
- [ ] The Verified Reporters count still links to the reporters list when `> 0` (whether or not it is in alarm); the Following and Verified Followers counts are unchanged.

## Concepts touched
- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:graperank` — graperank (the rank/influence + the verified cutoff the popover explains).
- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:nostr-user` — the instance owner (name/avatar in the popover) and the observed account (its counts).
- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:web-of-trust` — the owner's web of trust the verification is relative to.

## Out of scope
- Per-viewer PoV (House / Personalized) selection — the three-PoV standard (`docs/POV_RESOLUTION_DESIGN_HANDOFF.md`).
- Changing the cutoff **values** (only displaying them).
- The alarm on the `/reporters` list page itself — the alarm is scoped to the **profile count badge** (the list page is the investigation surface). The popover goes on both.
- Report-type breakdown (Phase 2); pile-on discounting (Phase 3); changing Following / Verified Followers.

## Open questions
For the Architect:
- **Cutoff sourcing:** how to surface the configured cutoff (×100) to the UI (e.g. extend `get-user-counts`, or an owner/config-info endpoint). Note VF and VR share `0.05` today but are config-separate — decide how the popover expresses one vs. potentially-divergent cutoffs.
- **Owner identity:** how to fetch the instance owner's name + avatar (e.g. `/api/owner/pubkey` → the owner's kind-0 profile) and whether to cache it.
- **Supersession:** this **reverses ADR 0001's "negative-signal when `> 0`"** — red/icon now fires only at/above the dynamic threshold (below = neutral). The new ADR must explicitly supersede that part of ADR 0001.
- **Popover supersedes the prior one:** the new copy replaces the "About this data" popover (Story 3 + the #35 review fix-up) and **drops** the "computed locally / not NIP-85" and "no single global number" lines (confirmed intended). This will require updating the popover assertions in the `verified-reporters-list-page` and `profile-verified-counts-owner-pov` suites — flag for the Tester.
- **Alarm styling + icon** and the exact popover wording (incl. the cutoff phrasing) — coordinate with the style guide; the `3`/`750` thresholds should be named constants (config-tunable a possible later note).

## Linked artifacts
- ADRs (context / partial supersession): `engineering-team/decisions/verified-reporters/0001-verified-reporters-count.md` (negative-signal rule), `engineering-team/decisions/profile/0031-profile-verified-counts-owner-pov.md` (Owner-PoV counts via `userCounts`, which supply VF + VR client-side).
- Design handoff: `docs/POV_RESOLUTION_DESIGN_HANDOFF.md` (Owner PoV; the broader three-PoV future).
- ADR: `engineering-team/decisions/profile/0032-verified-counts-explainer-and-alarm.md` (Accepted; partially supersedes ADR 0001 + the prior popover)
- Test plan: `engineering-team/stories/profile/36-verified-counts-explainer-and-alarm.test-plan.md` (suite `test/profile-verified-counts-explainer-and-alarm.test.js`; retired the obsolete `verified-reporters-list-page` T8)
- Review: (filled in after Review phase)
