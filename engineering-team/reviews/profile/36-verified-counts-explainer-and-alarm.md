# Review: Story profile #36 — Verification explainer popover + dynamic Verified-Reporters alarm

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-08
**Diff:** `git diff staging...HEAD` — commit `94f153f2` (ownerInfo.js, useVerificationInfo.js [new], VerificationInfo.jsx [new], BrainstormReporters.jsx, BrainstormProfile.jsx, styles.css)
**Story:** `engineering-team/stories/profile/36-verified-counts-explainer-and-alarm.md`
**ADR:** `engineering-team/decisions/profile/0032-verified-counts-explainer-and-alarm.md`
**Test plan:** `engineering-team/stories/profile/36-verified-counts-explainer-and-alarm.test-plan.md`

## Quality gates (run by reviewer, not trusted)
- [x] `npm test` — **Overall PASS, no FAIL suites.** New `profile-verified-counts-explainer-and-alarm` 15/15; `verified-reporters-list-page` 16/16 (T8 retired); all prior suites green.
- [x] `ui` build — compiles (confirmed at implementation).
- [x] _Lint/typecheck not configured — skipped._

## Spec adherence
- [x] **AC1** — `VerificationInfo` popover titled `What does "verification" mean?` explains a rank above `{cutoffOutOf100}` out of 100 from the owner's point of view, rendering the owner's avatar + name; `useVerificationInfo` supplies `cutoffOutOf100 = Math.round(cutoff*100)` + owner identity.
- [x] **AC2** — the cutoff is the configured value: `owner-info` returns `verifiedFollowersCutoff`/`verifiedReportersCutoff` from `VERIFIED_*_INFLUENCE_CUTOFF` (not hardcoded); the hook ×100.
- [x] **AC3** — the shared `<VerificationInfo>` is used on **both** the profile and `/reporters`; the old "About this data" popover copy + the local `InfoPopover` function are **fully removed** from `BrainstormReporters.jsx` (verified: 0 occurrences of each).
- [x] **AC4** — `reporterAlarm = vr != null && vf != null && vr >= REPORTER_ALARM_BASE(3) + Math.floor(vf / REPORTER_ALARM_FREEBIE_PER(750))`; `bsp-count-value-negative` **and** the 🚩 icon render **only** when `reporterAlarm` (no unconditional negative class remains). Boundary correct: VF 1500 → threshold 5; `>=` makes exactly-3 alarm (matches "3 or higher").
- [x] **AC5** — null VF or VR → `reporterAlarm` false → no alarm (explicit `!= null` guards; NaN math would also yield false).
- [x] **AC6** — VR still `<Link>`s to `/reporters` when `> 0` (alarm or not); Following + Verified Followers unchanged.

## ADR adherence
- [x] Cutoff + owner identity sourced from `/api/owner-info` (instance-level) via the shared `useVerificationInfo` hook — Option A as decided; not per-user `get-user-counts`.
- [x] One shared `VerificationInfo` component (not duplicated per page).
- [x] **ADR 0001 supersession correct:** the VR negative styling is now threshold-conditional, not `>0`-conditional. A count of 1–2 on a normal account is neutral. The `bsp-count-value-negative` class still exists (gated), so Story-1's structural assertion still holds.
- [x] **Popover supersession clean:** the prior "About this data" popover is replaced; the obsolete `verified-reporters-list-page` T8 was **retired** in test design (not repointed-to-red), and its concern moved to this suite's T4/T5 — a legitimate move, not a dodge (the new popover is genuinely asserted). No prior suite left red.
- [x] No new dependencies; no concept/schema change; no firmware.

## Concept-graph integrity
- [x] N/A — UI + a config value surfaced through an existing endpoint.

## Things tests can't catch
- [x] **Alarm boundaries:** verified by reading — `>=` inclusive at threshold; one-below neutral; `0` → else (neutral non-link); null/NaN → no alarm.
- [x] **Graceful popover fallback:** `useVerificationInfo` tolerates a missing owner kind-0 (short-npub fallback); the component shows "the cutoff"/"the owner" when data is absent. No crash on incomplete data.
- [x] **Self-contained popover state** (owns open/close) — clean for a shared two-page component.
- [x] No secrets / debug logging; no commented-out code; copy uses straight quotes.

## House rules check
- [x] No new lint/build tooling; tokens/rem/opacity CSS conventions; copy reasonable (final verification wording to be ratified with the style guide — noted in the ADR).

## Findings

### Blocking
None.

### Non-blocking
1. **`useVerificationInfo` uses a `cancelled` flag rather than `AbortController`** (unlike `useUserCounts`/`useGrapevine*`). It guards `setState`-after-unmount but does not abort the in-flight fetches. Harmless here — the effect has an empty dep array (fires once per mount of an always-present popover), so there's no rapid re-fire to abort. Optional consistency tidy.
2. **`owner-info` is refetched on every `VerificationInfo` mount** (once per profile / `/reporters` view). It's a tiny instance-level payload; a cache/shared-context is a possible later optimization, not needed now.
3. **Single cutoff displayed** (`verifiedFollowersCutoff ?? verifiedReportersCutoff`, both 0.05). Correct today; if VF/VR cutoffs ever diverge the copy must distinguish them — already flagged in ADR 0032's follow-ups.

## Verdict
**PASS** — all six ACs met, ADR 0032 conformant (owner-info cutoff, shared hook + popover on both pages, the dynamic alarm correctly superseding ADR 0001's red-when-`>0`), the popover supersession left no prior suite red (T8 retirement legitimate), and the gate is fully green (15/15 new suite; no FAIL suites). Only minor, optional non-blocking notes.
