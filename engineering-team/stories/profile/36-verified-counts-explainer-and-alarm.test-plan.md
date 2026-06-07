# Test Plan: Story profile #36 — Verification explainer popover + dynamic Verified-Reporters alarm

**Story:** `engineering-team/stories/profile/36-verified-counts-explainer-and-alarm.md`
**ADR:** `engineering-team/decisions/profile/0032-verified-counts-explainer-and-alarm.md`
**Date:** 2026-06-08

## Approach
Deterministic **source-regex node suite** — `test/profile-verified-counts-explainer-and-alarm.test.js`, run by `npm test`, wired into `test/test.js`. **T1–T11** are the failing tests (the popover/hook/owner-info-cutoff/alarm don't exist yet); **R1–R4** are regression sentinels (VR link, the other counts, the Reputation grid, owner-info's existing field) — pass before and after.

**Supersession test maintenance (done in this phase):** the `/reporters` popover is being *replaced* by the shared `VerificationInfo`, so the obsolete `verified-reporters-list-page` **T8** (which pinned the old "About this data" / local-NIP-85 / "no single global number" copy) is **retired** — the new popover is covered by this suite's T4 (component) + T5 (used on `/reporters`). Retiring (not repointing) keeps the list-page suite green pre- and post-impl (it's now 16/16), so the supersession leaves **no prior suite red**. `profile-verified-counts-owner-pov` T8 ("no `House (default)`") still passes (the new copy has none) — unchanged.

**False-positive control:** `verifiedFollowerCount`/`verifiedReporterCount` already appear in `BrainstormProfile` (Story-35 consts, adjacent) and `bsp-count-value-negative` already appears (Story-1 VR branch). So the alarm sentinels anchor on the NEW threshold (`verifiedReporterCount >= … verifiedFollowerCount`, a `>=` not the existing `> 0`), the NEW constants, and the NEW `reporterAlarm` flag — none present pre-implementation.

## Coverage map
| Criterion | Test(s) | Level |
|---|---|---|
| AC1 — popover explains verification (cutoff×100, owner PoV, owner name+avatar) | T4 (component), T3 (hook returns cutoffOutOf100 + owner identity) | source-regex |
| AC2 — cutoff is the actual configured value | T1 (owner-info exposes the cutoffs from config), T3 (×100) | source-regex |
| AC3 — popover on profile + /reporters (shared, replaces old) | T7 (profile), T5 (reporters uses it + old copy gone), T6 (local InfoPopover removed) | source-regex |
| AC4 — dynamic alarm (red + icon at threshold) | T8 (constants + floor), T9 (`>=` VR-vs-VF freebie formula), T11 (negative color + icon gated on `reporterAlarm`, not `>0`) | source-regex |
| AC5 — no alarm when VF/VR unavailable | T10 (null-guards both counts) | source-regex |
| AC6 — VR still links when >0; siblings unchanged | R1 (VR→/reporters), R2 (Following + Verified Followers) | source-regex |
| Regression — Reputation grid on Meili | R3 | source-regex |
| Regression — owner-info keeps ownerPubkey | R4 | source-regex |

## Edge cases
- [x] Popularity freebie: threshold ties VR to VF (`>=` + `Math.floor(.../750)`) — T8/T9. (Examples: 0–749 VF→thr 3; 1500 VF→thr 5.)
- [x] No crying wolf: null VF or VR → no alarm — T10.
- [x] Benign count is neutral, not red: the negative styling is gated on `reporterAlarm`, not `>0` (supersedes ADR 0001) — T11.
- [x] Cutoff is config-driven, not hardcoded — T1.
- [x] Shared component, no duplication; old local popover removed — T5/T6.
- Live rendering (the avatar image, the popover open/close, the actual red+icon on a real over-threshold account) — browser/staging smoke once the Owner batch finishes; not a deterministic gate here.

## Test infrastructure
- Node built-in runner (`node test/test.js`); wired in `test/test.js`. No live stack / Concept Graph needed (source-regex).

## How to run
```
npm test
```

## Verification
New suite fails with current code (T1–T11 fail; R1–R4 pass); the retired-T8 `verified-reporters-list-page` suite stays green (16/16); no other suite is red. Confirmed via `npm test` on 2026-06-08:

```
profile-verified-counts-explainer-and-alarm suite:
  ✗ T1 … ✗ T11   (one per AC/contract — owner-info cutoff, hook, component, /reporters swap,
                   InfoPopover removal, profile popover, alarm constants/formula/null-guard/styling)
  ✓ R1: VR still links to /user/:pubkey/reporters when >0
  ✓ R2: Following + Verified Followers intact
  ✓ R3: Reputation grid still on Meili trustScores
  ✓ R4: owner-info still returns ownerPubkey

profile-verified-counts-explainer-and-alarm suite: FAIL (4 passed, 11 failed)
verified-reporters-list-page suite:              PASS (16 passed, 0 failed)   ← T8 retired, no red
Overall: FAIL  ← only the new (intentionally-failing) suite
```

Each `✗` fails because the feature is unimplemented (new files/strings absent; removal-asserts see the still-present old copy), not from a typo/import error. The supersession left no prior suite red.
