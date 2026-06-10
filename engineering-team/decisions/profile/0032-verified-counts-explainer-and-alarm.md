# ADR 0032: Verification explainer popover + dynamic Verified-Reporters alarm

**Status:** Accepted
**Date:** 2026-06-08
**Story:** `engineering-team/stories/profile/36-verified-counts-explainer-and-alarm.md`
**Epic:** `profile`
**Supersedes (in part):** ADR 0001 (Verified Reporters negative-signal-when-`>0`) and the prior `/reporters` "About this data" popover (Story 3 + ADR 0031 review fix-up).

## Context
Three UI changes on the verified-counts surface (no concept/schema change):
1. A shared **"What does \"verification\" mean?"** popover (profile + `/reporters`) explaining verification = a rank above the cutoff (out of 100) from the **instance owner's** PoV, with the owner's name + avatar.
2. The ⓘ + popover added to the **profile** near the verified counts.
3. A **dynamic Verified-Reporters alarm** on the profile badge.

**Grounding (this branch):**
- `ui/src/pages/BrainstormProfile.jsx` — `.bsp-counts` badges; `userCounts` already carries `verifiedFollowerCount` + `verifiedReporterCount` (Story 35), so the alarm threshold computes **client-side**. The VR badge currently applies `bsp-count-value-negative` whenever `> 0` (ADR 0001) — this story supersedes that.
- `ui/src/pages/BrainstormReporters.jsx` — has a local `InfoPopover` (the `bsp-confirm-overlay`/`bsp-confirm-box` pattern) with the "About this data" copy; to be replaced by the shared component.
- `src/api/owner/ownerInfo.js` — `GET /api/owner-info` returns `{ success, ownerPubkey, ownerNpub, domainName }` (registered at `src/api/index.js:317`). Instance-level. **The natural home for the cutoff.**
- The cutoff lives in config (`VERIFIED_FOLLOWERS/REPORTERS_INFLUENCE_CUTOFF`, default `0.05`; `userdata.js:358-359`, `cypherQueries.js:10-12`) and is **not** exposed to the UI. VF and VR share `0.05` today but are config-separate.
- `/api/owner/pubkey` returns just the owner pubkey; the owner's name+avatar come from the owner's kind-0 via `/api/profiles`.

Constraints: JS-without-build; tokens only; no concept/firmware change.

## Options considered

### Cutoff + owner-identity sourcing
- **Option A — extend `/api/owner-info` + a shared hook *(chosen)*.** Add the verified cutoff(s) to `owner-info` (it already returns the owner identity). A shared hook fetches `owner-info` (pubkey + cutoff) then the owner's kind-0 via `/api/profiles` → `{ ownerName, ownerAvatar, cutoffOutOf100 }`. The popover's data is **instance-level**, so an instance-level endpoint is the right granularity, and one endpoint serves the whole popover.
- **Option B — extend per-user `get-user-counts`.** Wrong granularity: the cutoff/owner are instance-level, not per-viewed-user; would refetch instance data on every profile. Rejected.
- **Option C — a new config endpoint.** Unnecessary surface — `owner-info` exists and fits. Rejected.

### Shared popover
- **Option A — extract one `VerificationInfo` component *(chosen)*** used by both pages, replacing `BrainstormReporters`' local `InfoPopover` and added to `BrainstormProfile`. The whole point is one shared explainer.
- **Option B — duplicate the popover per page.** Re-creates the drift this epic fights. Rejected.

### Alarm
A pure helper + named constants; styling reuses the existing `--red` (`bsp-count-value-negative`) plus an attention icon; **conditional on the dynamic threshold, not on `> 0`**. (The formula is fixed by the story; the only sub-choice is helper location — a small named helper, inline or in a `ui/src/utils` module.)

## Decision
Extend `/api/owner-info` with the cutoff; add a shared `useVerificationInfo` hook + a shared `VerificationInfo` popover component (profile + `/reporters`); and gate the Verified Reporters alarm on `verifiedReporterCount >= 3 + floor(verifiedFollowerCount / 750)`, **explicitly superseding ADR 0001's red-when-`>0`** (below-threshold VR is neutral, still a link when `>0`).

## Consequences
- **Self-explanatory counts** via one shared popover; instance-level data from one `owner-info` fetch (cacheable).
- **Alarm is meaningful, not alarmist:** popular accounts get a freebie per 750 verified followers; a missing VF/VR shows no alarm.
- **ADR 0001 partially superseded:** the VR negative styling is now threshold-conditional. `bsp-count-value-negative` is still used (in the alarm branch), so ADR 0001's structural test assertions still hold; only the *trigger* changed.
- **Prior popover replaced:** the new copy drops the "computed locally / not NIP-85" and "no single global number" lines → the `verified-reporters-list-page` popover assertions (T8) must be updated to the new verification popover (Tester). `profile-verified-counts-owner-pov` T8 ("no `House (default)`") still holds (the new copy has none).
- **Distinct from the deferred counts-row PoV indicator:** this ⓘ explains *what verification means*; it is not the deferred "which PoV is active" indicator (still Phase 4).
- **Firmware reinstall?** No.
- **Follow-ups:** if VF/VR cutoffs ever diverge, the popover copy must distinguish them; `3`/`750` could become config.

## Implementation notes
- **`src/api/owner/ownerInfo.js`** — add to the response: `verifiedFollowersCutoff` + `verifiedReportersCutoff` (`parseFloat(getConfigFromFile('VERIFIED_FOLLOWERS/REPORTERS_INFLUENCE_CUTOFF', 0.05))`). (Both, for honesty; they're equal today.)
- **`ui/src/hooks/useVerificationInfo.js` (new)** — fetch `/api/owner-info` → `{ ownerPubkey, verified*Cutoff }`; then `/api/profiles?pubkeys=<ownerPubkey>` → owner `display_name`/`name` + `picture`. Return `{ ownerName, ownerAvatar, cutoffOutOf100 }` where `cutoffOutOf100 = Math.round(cutoff * 100)` (use the shared value; both equal today). Tolerate missing owner profile (fall back to a short npub).
- **`ui/src/components/VerificationInfo.jsx` (new)** — the ⓘ button + popover (reuse `bsp-confirm-overlay`/`bsp-confirm-box`/`bsp-info-btn`). Title: `What does "verification" mean?`. Body: explains a rank score above `{cutoffOutOf100}` out of 100, calculated from the point of view of this Tapestry instance's owner; render the owner's avatar + name. Consumes `useVerificationInfo`.
- **`ui/src/pages/BrainstormReporters.jsx`** — replace the local `InfoPopover` + its trigger with `<VerificationInfo>`; delete the now-dead `InfoPopover` component and its old "About this data" copy.
- **`ui/src/pages/BrainstormProfile.jsx`** — render `<VerificationInfo>` (ⓘ) near the `.bsp-counts` row. For the VR badge, compute the alarm:
  ```js
  const REPORTER_ALARM_BASE = 3;
  const REPORTER_ALARM_FREEBIE_PER = 750;
  const reporterAlarm =
    verifiedReporterCount != null && verifiedFollowerCount != null &&
    verifiedReporterCount >= REPORTER_ALARM_BASE + Math.floor(verifiedFollowerCount / REPORTER_ALARM_FREEBIE_PER);
  ```
  Apply `bsp-count-value-negative` **and** an attention icon (e.g. 🚩, the reporter motif as a red flag — final glyph/style per the style guide) only when `reporterAlarm`; otherwise neutral value, no icon. The VR count still `<Link>`s to `/user/:pubkey/reporters` when `> 0` (alarm or not); a genuine `0`/`—` is unchanged.
- **`ui/src/styles.css`** — an alarm-icon style if needed; reuse `--red`/`bsp-count-value-negative` for the value color (no new tokens).

## Out of scope
- Per-viewer PoV (House/Personalized) selection — the three-PoV standard.
- Changing the cutoff **values**; the alarm on the `/reporters` list page (badge-only); report-type breakdown; pile-on.
- Editing `product-team/` (style-guide ratification is product-side).
