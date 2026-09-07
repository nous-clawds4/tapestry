# Review: Story 2 — Sync the Treasure Map with one relay

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-07
**Diff:** `git diff c57ae708..85cf8502` — implementation `8d5d20ca` plus post-verification fix `85cf8502`.

**Process note.** This review ran **out of order**: story 2 was implemented, live-verified, fixed,
and then overtaken by story 3 before Phase 5 was performed. The gap was caught during story 3's
completion detection and is recorded as harness friction below. Nothing was shipped in the
interval — the branch has never left this machine — so the only cost was audit latency. The diff
reviewed here is the *current* state of story 2's code, including two fixes no reviewer had seen.

## Quality gates (run by reviewer, not trusted)

- [x] **Story suite** — `treasure-map-relay-sync`: **22 passed, 0 failed**, re-run after story 3
      landed on top of it.
- [x] **Neighbours** — `treasure-map-relay-presence` 35/35, `treasure-map-panel-summary` 18/18,
      `tl-treasure-map-panel` 18/18, `tl-treasure-map-optin-publish` 23/23.
- [x] **Full gate** — `npm test` completed: `Overall: FAIL` on exactly the three `trusted-lists`
      suites of OPEN.md row 191 (server publish posture, proven pre-existing at story 1's review),
      **zero** other failures. Every treasure-map suite PASS.
- [x] **Build** — `npm --prefix ui run build` succeeds.
- [x] **Live** — a real sync performed against `wss://tags.brainstorm.world/relay` at operator
      request; the Map is present there now, confirmed server-side and on a fresh page load.
- [x] _Lint / typecheck / Playwright — not configured or not applicable._

## Spec adherence

| AC | Tests | Verdict |
|---|---|---|
| 1 action only where meaningful, labeled by direction | `N1`–`N7`, `S1`, `S5` | met; confirmed live (4 buttons on exactly the relays lacking the Map) |
| 2 sending converges the relay | `S1`, `S4` | met — **but the failure branch is untested**; see non-blocking 1 |
| 3 pulling converges local, page re-reads | `F1`, `S1`, `S3` | met |
| 4 nothing is ever deleted | `D1` | met |
| 5 publish policy honored | `S2` | met; confirmed live (policy stubbed local-only ⇒ 0 send buttons) |

- [x] No criterion silently dropped.
- [x] **No signer prompt** — `publishToRelays(event, [url])` republishes the already-signed event
      (`:181`). Sync is transport, not authorship, exactly as the story framed it.
- [x] **Push can only fire when local actually holds the Map.** `planRelaySync` is called with
      `inLocal ? event : null`, so with no local copy every present relay plans a *pull* and every
      absent relay plans nothing — there is no path where the panel publishes an event local does
      not have. The ADR's sub-decision holds in practice, not just on paper.

## ADR adherence

- [x] Option A implemented as designed: existing primitives composed, one opt-in `full` parameter,
      direction from a pure helper, per-row action state.
- [x] `full=1` is **additive** — `presence.js:59` branches on it and leaves the default projection
      intact. Story 1's `A6` and this story's `F2` both still pass, which was the point.
- [x] Pull consumes the event the server already signature-verified; `F5` pins the single probe
      call, so no unverified re-fetch slipped in.
- [x] No server-side outbound publish introduced (the reason B and C were rejected). No new
      dependency. No firmware change.
- [ ] **One deviation, justified and disclosed** — see below.

### Deviation from ADR 0002: the push result is deliberately ignored

`:184-188` documents that `result.successes` is not trusted, and `:203-207` derives success from
what the relay serves afterwards instead. The ADR did not describe this, because the reason for it
was discovered *after* the ADR was accepted: `SimplePool.publish()` returns an array of promises,
and `publishToRelays` races that non-thenable array against its timeout, so every publish reports
success unconditionally (OPEN.md row 200, verified in-container).

Reviewer's assessment: **the deviation is required, not optional.** AC-2's "given the publish
fails, then the row says so" is unsatisfiable through `successes`, so an implementation that
followed the ADR literally would have shipped a criterion that could never fire. Deriving the
outcome from the relay's own answer is the only honest signal available without changing shared
code used by five other publish paths. Correctly scoped, correctly documented, correctly filed.

## Concept-graph integrity

- [x] No handles touched; no firmware change; no reinstall claimed or needed.
- [x] No 64-hex or relay-URL literal introduced (`R2` of the story-3 suite still guards this).

## Things tests can't catch

- [x] No secrets, no debug logging, no commented-out code.
- [x] **Per-row failure isolation** — every `setSyncing` is keyed by `url` and the catch is scoped
      to the row (`:210-212`), so one relay's failure cannot disturb another. AC-2's second clause.
- [x] **Security of the pull path** — the imported event is the verified one; `strfry import`
      verifies again by default as a backstop (checked in-container at ADR time). Two independent
      gates, neither relied on alone.
- [x] **No deletion on any path** — re-read, not just trusted to `D1`.
- [ ] Two transient-state observations and one coverage gap; all non-blocking, below.

## Findings

### Blocking

None.

### Non-blocking

1. **AC-2's failure branch has no test, and it is the subtlest behavior in the story.**
   The test plan mapped AC-2 to `S1`/`S4`, which check routing and re-checking — neither exercises
   "the publish did not take, so say so". The logic that makes it work (`confirmSync` +
   the throw at `:203-207`) landed in Phase 4, where test edits are correctly barred, so nothing
   covers it. It *is* verified empirically — the operator's manual sync to `dcosl.brainstorm.world`
   failed visibly, and the reviewer confirmed dcosl holds no copy — but empirical is not a guard.
   *Tester-lane follow-up:* a test driving an injected `publishToRelays` that reports success while
   the probe reports `absent`, asserting the row surfaces a failure. Same class as story 1's
   finding 3.

2. **`:199` calls `onMapReplaced()` before `:202` re-checks the row.** `onMapReplaced` is the
   page's `search()`, which replaces `event`; that changes `event?.id`, which is a dependency of
   the panel's main effect, so every row resets to `pending` and re-probes. Meanwhile `runSync`
   writes its own `confirmSync` result into one row. The two can interleave, leaving a single row
   briefly showing a pre-reset value while its neighbours re-probe. Self-correcting within one
   probe cycle and invisible in practice, but the ordering is incidental rather than chosen —
   worth making explicit if this path is touched again.

3. **With no local copy, a relay that lacks the Map offers nothing** — `planRelaySync(null, null)`
   is `nothing-to-sync`. Correct per the story ("every sync has local strfry on one side"), but a
   user whose Map was found only on an external relay must first use *Import to local strfry* and
   then push, in two steps, with nothing on screen saying so. Product call, not a defect.

4. **`confirmSync` costs a fixed extra ~1.5s on every genuine failure** (`:170-176`) because the
   retry fires whenever the relay is not `present`. Acceptable for a diagnostic action; noted
   because it makes a failed sync feel slower than a successful one.

### Harness friction

1. **A story reached implementation, live verification, a bug-fix cycle and a successor story
   without Phase 5 ever running.** The `/implement-feature` gate asked "Ready to enter Review?",
   the operator answered with an approval *and a new request in the same message* ("go to review,
   and try the sync on tags.brainstorm.world"), and the session executed the concrete instruction —
   then followed the operator's next question into story 3, never returning. Nothing detected the
   omission until story 3's completion detection enumerated story statuses and found `Approved`
   where `Done` was expected. Two candidate mitigations for triage: have `/plan-feature` refuse (or
   warn) when the previous story in the same epic is not `Done`, and/or have the phase-gate prompt
   restate the outstanding phase when the operator's reply contains an instruction beyond the
   approval. Recorded as **OPEN.md row 197**.

## Verdict

**PASS**

The story does what it promised and the parts that matter most are right: nothing is signed,
nothing is deleted, the publish policy is honored before the click rather than after, and the pull
path imports only an event the server verified. The one ADR deviation is not drift — it is the
correct response to a defect in shared code that the ADR could not have anticipated, and it was
found because the operator asked for a real sync against a real relay rather than settling for
unit tests.

The four non-blocking findings are genuine. Finding 1 is the one to take: the behavior it covers
was discovered late, is the subtlest in the story, and currently rests on a single manual
observation.

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection performed; result reported in chat, not recorded here.
