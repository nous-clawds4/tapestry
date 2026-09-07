# Review: Story 1 — Simple Lists pages must work on a large relay

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-07
**Diff:** `git diff a2ab95a4^..HEAD` (implementation commit `7b2b546d`)
**Story:** `engineering-team/stories/relay-scan-bounds/1-bound-simple-lists-relay-scans.md`
**ADR:** `engineering-team/decisions/relay-scan-bounds/0001-bounded-scan-contract-and-grouped-tally.md`
**Test plan:** `engineering-team/stories/relay-scan-bounds/1-bound-simple-lists-relay-scans.test-plan.md`

## Quality gates (run by reviewer, not trusted)

- [x] **`npm test` — crashes, pre-existing and unchanged.** The runner dies at suite #2
  (`profile-tags-publish`) with `TypeError: fetch failed` / `ECONNREFUSED` from
  `test/helpers/livePov.js:97` — Meilisearch is not exposed to this host. Verified
  **the same crash at the identical output line (39)** in the pre-change baseline
  captured at `ca59d338` and in the post-change run. Not caused by this diff, and it
  means the assembled gate cannot be run locally at all.
- [x] **Per-suite equivalent — run instead, all 181 suites individually.**
  `2,695 pass · 54 fail · 35 skipped`; 7 further suites crash environmentally (all
  `*-publish`, the same Meilisearch dependency).
- [x] **The story's own suite:** `23 passed, 0 failed, 0 skipped` (stack up);
  `16 passed, 0 failed, 7 skipped` (stack unreachable — the CI profile).
- [x] **The 54 failures are pre-existing.** Established, not assumed:
  - Their messages name unrelated causes — leftover fixture elements
    (`Element "harness capture round-trip goal" already exists`), a missing
    devDependency (`the open-ranking SDK is not installed`), Meilisearch 503s on the
    search proxy, and live-corpus drift (`no live goal stores a flag as false any more`).
  - **Five of them do call `/api/strfry/scan`** — `attach-the-world`,
    `break-a-goal-into-pieces`, `capture-a-goal-and-see-it`, `sessions-read-the-brain`,
    `the-brain-survives` — all with the narrow shape
    `{kinds:[39999],'#d':[dTag]}`. Exercised directly against the changed endpoint:
    `{count: 1, total: 1, truncated: false, limit: 20000}` with the event's seven fields
    intact. Unaffected.
  - `tag-detail`'s match on `truncated` is the word inside a test name
    (`…unmodified and untruncated (AC-6)`), not the response field.
  - No failing suite references `dlists/item-counts`, `queryRelayBounded`,
    `DListItemsList`, or `lists/Index`.
- [x] **UI reaches deployment from source.** `dist/` is gitignored (`.gitignore:97`) and
  `Dockerfile:98` runs the Vite build at image-build time, so the JSX changes ship
  without a committed bundle.
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build: no repo-level build step; the UI build was run and both pages verified._

## Spec adherence

- [x] Every acceptance criterion has a passing test (AC-1 → E1/E4/U1; AC-2 → T1/T2/T5/T6;
  AC-3 → T1/T7/E2/U2; AC-4 → B4/U3/U4; AC-5 → B1/B2/B3; AC-6 → B5/R1/R2/R3).
- [x] No criterion silently dropped.
- [x] No behavior added beyond the story. `DataTable pageSize={50}` is the ADR's own
  opt-in pagination, logged as a deviation.
- [ ] **AC-5 has an unhandled degraded path — see Blocking 1.**

Behavior confirmed in the browser, not merely asserted: List Headers renders
`270 list headers · 9368 items` (the union — the story predicted 9,368 against today's
9,497), and List Items renders
`500 items · showing the 500 most recent of 9,497 on the relay`.

## ADR adherence

- [x] Files match the implementation notes: `scan.js` streams via `spawn`; `src/api/dlists/`
  is new with `itemCounts.js` + `index.js`; the route registers beside the scan siblings
  (`src/api/index.js:268`); `queryRelayBounded` is additive in `ui/src/api/relay.js`.
- [x] Constants as specified — `SCAN_MAX_EVENTS = 20000`, `SCAN_MAX_BYTES = 10 * 1024 * 1024`.
- [x] Layering respected; `src/api/lists/` (the relay whitelist/blacklist domain) correctly
  not reused.
- [x] No new dependencies.
- [x] The stale ADR bullet describing the superseded `/api/strfry/scan/tally` sketch was
  corrected in this commit and logged as a deviation. Verified: no `scan/tally` or
  `groupBy` references remain.

**Byte bound demonstrated under real load.** A relay-wide filter matching **3,105,471**
events returned 3,862 events inside the 10 MB ceiling with `truncated: true` and the true
total — the exact condition that produced the reported bug.

## Concept-graph integrity

- [x] Handles stay in `kind:pubkey:slug` form; `headerRef()` (`itemCounts.js:71-77`)
  constructs `39998:<pubkey>:<d>` from the event, never from a literal.
- [x] No hardcoded TA pubkey anywhere in the diff — checked; the endpoint derives refs
  from the relay's own header events, so it is per-deployment correct by construction.
- [x] No concept definitions changed → **no firmware reinstall required**.

## Things tests can't catch

- [x] No secrets; no debug logging; no commented-out code; no TODOs added.
- [x] **Security improved beyond what the ADR required.** The old `exec` built a shell
  string with hand-rolled `'` escaping; `spawn` with an argv array removes the shell
  entirely, so the injection surface is gone rather than mitigated.
- [x] No dead state left behind — the `items` state and `itemCountMap` are fully removed
  from `lists/Index.jsx`, and `queryRelay` is no longer imported in `DListItemsList.jsx`.
- [x] Response back-compatible: `events` and `count` keep their meaning; `total`,
  `truncated`, `limit` are additive. `queryRelay` still returns `data.events`.
- [ ] **Error path on the bounded read is wrong — see Blocking 1.**
- [ ] Concurrency: the counts cache has no single-flight — see Non-blocking 1.

## House rules check

- [x] Concept Graph API authority respected.
- [x] No new lint/typecheck/build tooling.
- [x] Phase-4 `test/` diff scrutinized (three lines, `U3`). It is **strictly stronger**,
  not weakened: it keeps the original requirement for an explicit `limit`, additionally
  permits the named constant the ADR mandates, and **adds** a new assertion requiring
  `ITEMS_LIMIT = <number>`. Logged as a deviation by the Implementer. Acceptable.

## Findings

### Blocking

1. **`src/api/strfry/queries/scan.js:118-121`** — a bounded read reports itself as complete
   when the total cannot be obtained.

   ```js
   let total = events.length;
   if (bounded) {
     const counted = await countMatching(filter);
     if (counted !== null) total = counted;
   }
   ...
   truncated: total > events.length,
   ```

   `countMatching()` returns `null` on spawn failure or unparseable output. When it does,
   `total` stays at `events.length`, so `truncated` computes to **false** — and the
   response declares a knowingly-truncated result complete. The function holds
   `bounded === true` at that point, which is definitive knowledge that it stopped early,
   and discards it.

   This is the precise thing AC-5 forbids: *"never a result that is quietly partial or
   quietly empty."* Shipping a new silent-partial path inside the fix for a silent-failure
   bug is what this gate exists to catch. It is uncommon — it needs `strfry scan --count`
   to fail where `strfry scan` succeeded — but the original bug was uncommon too, until
   staging grew.

   **Asked change:** when `bounded` is true and the count is unavailable, do not report
   `truncated: false`. Preserve the exact-fit case (caller asks for 5, exactly 5 exist →
   `bounded` true, count returns 5, correctly *not* truncated). One shape that satisfies
   both: `truncated: bounded && (counted === null || counted > events.length)`. The
   implementation choice is the Implementer's.

2. **Test gap on the same path** — the plan has no coverage of the degraded branch, which
   is why the defect survived a green suite. AC-5's "never quietly partial" is tested only
   on the happy path (`B3`, `B4`).

   **Asked change:** a test that exercises the bounded read with the count unavailable and
   asserts the response does not claim completeness. This is a Tester-lane change; route it
   accordingly rather than editing the suite from Phase 4.

### Non-blocking

1. **`src/api/dlists/itemCounts.js:158-171`** — no single-flight on the cache. Two
   concurrent cold requests each run the full pass (7-15 s apiece on staging by the ADR's
   own estimate). The ADR did not require de-duplication and the correctness is unaffected.
   Optional: an in-flight promise held alongside `cache`.
2. **`src/api/strfry/queries/scan.js:82`** — `proc.stdout` has no `'error'` listener, and
   this endpoint now SIGTERMs the child on every bounded read, a far more common path than
   the `scanStream.js:23` precedent it follows. Killing the child yields EOF rather than
   EPIPE on the read end, so the risk is low, but an unhandled stream `'error'` would take
   down the control panel. Optional: a listener that resolves the same way `proc.on('error')`
   does.
3. **`ui/src/api/relay.js`** — `queryRelayBounded` duplicates `queryRelay`'s fetch body
   rather than sharing it. Deliberate (the ADR asked that `queryRelay` be left untouched)
   and only a few lines. Noting, not asking.
4. **ADR prose undercounts its own validator** — it says "two cheap calls" while specifying
   a third (the header count), which `readValidator` correctly performs. The code is right;
   the sentence is off by one. Not worth an amendment on its own.

### Harness friction

1. **The assembled `npm test` gate cannot be run locally.** The runner crashes at suite #2
   because Meilisearch is not exposed to the host, so no local reviewer can obtain a gate
   result without hand-rolling a per-suite loop (as this review did). Seven `*-publish`
   suites share the dependency. Adjacent to OPEN.md #27 but a different shape — that row
   describes `Overall: FAIL`, whereas the runner now dies outright and reports nothing.
   Worth a `meta` row so the next reviewer does not rediscover it.
2. **The local graph carries leftover test fixtures** that make ~6 suites fail on
   `Element "…" already exists`. Suites are not self-cleaning and there is no documented
   reset. Also worth a `meta` row.

## Verdict

**CHANGES_REQUESTED**

The design is sound and the story is substantially delivered: both pages work, the counting
rule is correct and well covered, the byte bound is demonstrated against a 3.1M-event
query, the security posture improves, and nothing else in the tree regresses. Two related
asks stand in the way, and they are the story's own thesis — a bounded read must never
report itself complete, and that path must be tested. Blocking 1 is a one-line change.
