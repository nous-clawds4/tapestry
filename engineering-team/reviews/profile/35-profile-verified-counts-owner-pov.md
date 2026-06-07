# Review: Story profile #35 — Verified Followers/Reporters counts from Neo4j (Owner PoV)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-08
**Diff:** `git diff staging...HEAD` — commit `3f52bfbc` (userdata.js, useUserCounts.js, BrainstormProfile.jsx, BrainstormReporters.jsx + 3 prior-suite test updates)
**Story:** `engineering-team/stories/profile/35-profile-verified-counts-owner-pov.md`
**ADR:** `engineering-team/decisions/profile/0031-profile-verified-counts-owner-pov.md`
**Test plan:** `engineering-team/stories/profile/35-profile-verified-counts-owner-pov.test-plan.md`

## Quality gates (run by reviewer, not trusted)
- [x] `npm test` — **Overall PASS.** New `profile-verified-counts-owner-pov` 11/11; the three repointed prior suites green (`profile-verified-followers-count` 6/6, `profile-verified-reporters-count` 11/11, `verified-reporters-list-page` 17/17).
- [x] `ui` build — compiles (confirmed at implementation).
- [x] _Lint/typecheck not configured — skipped._

## Spec adherence
- [x] **AC1** — `handleGetUserCounts` returns `verifiedFollowerCount`/`verifiedReporterCount` from the Owner-PoV Neo4j node property; profile badges read `userCounts?.verified*Count` ([BrainstormProfile.jsx:101-102, 248]). Not Meili.
- [x] **AC2** — the `?? trustScores?.followers` raw fallback is removed (0 occurrences); the live fallback is `try/catch → null` (→ "—"), never raw followers ([userdata.js] count-only branches).
- [x] **AC3** — fallback uses `[:FOLLOWS]`/`[:REPORTS]` with `VERIFIED_FOLLOWERS/REPORTERS_INFLUENCE_CUTOFF` (same as the tables); `count()` yields 0 for genuine-empty, `null` only on timeout/error.
- [x] **AC4** — Following unchanged: strfry kind-3 scan + 500-on-error preserved; badge still `userCounts.followingCount` → `/follows`.
- [ ] **AC5 — PARTIALLY met (blocking).** The prominent `/reporters` PoV line is correctly relabeled "House" → "Relative to the owner's web of trust." ([BrainstormReporters.jsx:181]). **But the "About this data" popover ([BrainstormReporters.jsx:69]) still says "Counts are personal to each viewer's web of trust… the House (default) view is shown,"** which (a) contradicts the new Owner PoV line on the same page, and (b) is exactly the "analogous House mislabel for this Owner-sourced data" AC5 directed us to correct. See Findings → Blocking #1.

## ADR adherence
- [x] Option A implemented: hybrid `get-user-counts` (strfry + Neo4j node-prop → count-only live fallback), badges via `useUserCounts`. Node-prop O(1); fallback deadline-bounded; session/driver closed in `finally`. Matches ADR 0031 §Implementation.
- [x] `useUserCounts` docstring-only (the passthrough already surfaces the fields) — correct, no code change.
- [x] Reputation grid untouched: `trustScores[metric.tag]` (1) + `meili/document` fetch (1) intact — only the badges left Meili.
- [x] **Supersession faithful.** The three repointed prior-suite assertions re-point to the new contract at **equal or greater** strength — not weakened: `#33 T2` and `#1 T2` now assert `userCounts?.verified*Count` (a specific source, like before); `#3 T7` now asserts the Owner line **and adds** a House-absent check (strengthened). `#33 T3` keeps its `??`-present / no-`||` asserts (prose refreshed). Each cites ADR 0031.
- *Note:* ADR 0031's §Implementation note for `BrainstormReporters.jsx` said only "change the PoV line" — it under-specified relative to the story's broader AC5. The popover gap traces to that ADR omission, but AC5 (the story contract) governs.

## Concept-graph integrity
- [x] N/A — runtime Neo4j node properties + `[:FOLLOWS]`/`[:REPORTS]` edges; no concept/schema change, no firmware.

## Things tests can't catch
- [x] Hybrid handler: the async `exec` callback awaits the Neo4j work before `res.json`; happy path, timeout (504-class → null/"—"), and query-error are handled; `count()` → 0 on empty so the badge correctly shows "0", `null` only on failure.
- [x] No secrets / debug logging beyond legitimate `console.error`; no commented-out code.
- [~] **The popover inconsistency (Blocking #1) is exactly the class source-regex tests over the *PoV line* couldn't catch** — the suites assert the line, not the popover.

## Findings

### Blocking
1. **`ui/src/pages/BrainstormReporters.jsx:69` — the "About this data" popover still describes a per-viewer/House model that contradicts the page's Owner PoV.** It reads *"Counts are personal to each viewer's web of trust. There is no single global number. When you have no calculated web of trust, the House (default) view is shown."* In v1 the data is **Owner** PoV (same for all viewers), and the PoV line now says so — so this paragraph is inaccurate and self-contradictory, violating AC5 ("any analogous House mislabel … corrected"). **Asked change:** reconcile the popover with the Owner-PoV v1 reality — e.g. keep the accurate first paragraph ("computed locally … not imported via NIP-85"), and either drop the second paragraph or restate it for Owner (the "no single global number" sentiment may stay; the "personal to each viewer" / "House (default) view is shown" claims must go or be corrected). Add a small test guard so the popover's House reference can't silently regress (the current suites only check the PoV line).

### Non-blocking
1. **`ui/src/pages/BrainstormReporters.jsx` popover vs the three-PoV future** — when the per-viewer model ships, this copy may become correct again; coordinate the final wording with the style guide under the three-PoV standard (`docs/POV_RESOLUTION_DESIGN_HANDOFF.md`). For now, v1 accuracy wins.
2. **`userdata.js` — `neo4j.driver()`/`driver.session()` are created *outside* the inner `try`.** If either threw synchronously, the async `exec` callback would reject unhandled and the request would hang (no `res.json`). Low likelihood (driver/session creation is lazy), and the original handler had no outer try either — but moving driver/session creation inside the `try` (or wrapping the callback body) would be more defensive. Optional.

## Verdict
**CHANGES REQUESTED** — one blocking issue: the `/reporters` "About this data" popover (`BrainstormReporters.jsx:69`) still claims a per-viewer/House model, contradicting the page's new Owner PoV line and leaving AC5 only partially met. Everything else is correct and green — the handler, the badge re-sourcing, the removed raw fallback, the untouched Reputation grid, and the faithful supersession test updates. Fix the popover copy (+ a guard test) and this is a PASS.
