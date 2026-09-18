# Review: Story 3 — Per-pin membership method

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-18
**Diff:** `git show 048f5b76` (implementation) + `git show 991f75b0 -- test/` (Phase-3 re-aims)
**Lane:** Light profile **with an Accepted ADR** (`decisions/search-index-selection/0002-per-pin-membership-method.md`)
**Story:** `stories/search-index-selection/3-per-pin-membership-method.md`
**Test plan:** `test-plans/search-index-selection/3-per-pin-membership-method.md`

Reviewed at commit `048f5b76` as instructed; the working tree was clean of story-4 edits at review
time (`git status --porcelain` showed only pre-existing untracked docs), and no UI build was run.

## Quality gates (run by reviewer, not trusted)

Scoped gate (hermetic suites, `BRAINSTORM_BASE_URL=http://localhost:8778`, `direnv exec .`, 180 s cap each):

| Suite | Result |
|---|---|
| `per-pin-membership-method` | **31 passed, 0 failed, 0 skipped** (EXIT=0) |
| `pin-stack-composition` | **20 passed, 0 failed, 0 skipped** (EXIT=0) |
| `only-me-curation` | **35 passed, 0 failed, 0 skipped** (EXIT=0) |
| `item-trusted-list` | **51 passed, 0 failed** (EXIT=0) |
| `note-trusted-list` | **15 passed, 0 failed** (EXIT=0) |
| `context-scoped-pins` | **32 passed, 0 failed** (EXIT=0) |
| `generalized-tag-pinning` | **12 passed, 0 failed** (EXIT=0) |

Live-stack suites the story defers to Gate B (local stack up at `:8778`, 240 s cap each) — **all
three hit the cap (EXIT=124) in their live phase, and all three failed a *source-contract*
assertion before the hang:**

| Suite | Result |
|---|---|
| `tl-weighted-sum-method` | **TIMEOUT at 240 s.** Before the hang: U1–U3 ✓, **S1 ✗** ("TrustDetermination.jsx must define the input method entry"), S2 ✓, L0 ✓, LA ↷SKIP ("stack already has a POV filter"). The three re-aimed `membership-method` assertions (LA/LB/LC) were **not reached** — they sit behind the live phase. |
| `tl-certainty-method` | **TIMEOUT at 240 s.** Before the hang: U1–U2 ✓, **S1 ✗** ("certainty entry must exist"), S2 ✓, L0 ✓, **LP ✗** (`spawnSync /bin/sh ENOBUFS` in the fixture prune — environmental, pre-existing, not caused by this diff). The re-aimed `:288` assertion was **not reached**. |
| `tl-membership-method-selector` | **TIMEOUT at 240 s.** Before the hang: U1–U7 ✓, **S1 ✗** ("TrustDetermination.jsx must reference membership-method id \"input\""), S2 ✓, L0 ✓. The re-aimed `:370-374` assertion was **not reached**. |

No `npm run gate:status` line is quoted: the full gate was explicitly not run (scoped, capped run
per the review brief). The three S1 failures above are the blocking finding — see Findings.

- **Lint** — ESLint is not a house gate, but I diffed it as instructed. Copies of the four changed
  JSX/JS files plus the new module at `048f5b76` vs `048f5b76^`, linted inside `ui/` with the
  project config: **identical output — 4 errors + 1 warning on both sides**, all pre-existing
  (`CurationMethodDialog.jsx` unused `e`, two `no-constant-binary-expression`;
  `useTLDetail.js` `set-state-in-effect`; `TrustDetermination.jsx` `exhaustive-deps`). **No new
  findings**, and the new `ui/src/config/tlMembershipMethods.js` is clean. Temp copies removed.
- _Typecheck not configured — skipped._
- _Build not configured — skipped (UI build deliberately not run; story-4 work is concurrent)._

### Live verification

- **Firmware reinstall confirmed in the graph, not just the file.** `GET /api/concept-graph/node/
  39999:<TA>:tag-pinning-schema` returns the new clause verbatim:
  `membershipMethod ('count' | 'input' | 'certainty'; absent = the instance-wide default)`.
  Handle discovered via `/summaries` → `/neighbors` (`IS_THE_JSON_SCHEMA_FOR`), TA pubkey resolved
  at runtime, not typed.
- **Wire shape confirmed on the local relay.** `docker exec tapestry strfry scan '{"kinds":[30392],
  "limit":20}'` — the six most recent lists (all refreshed under this build) each carry
  `["cutoff",…]`, `["min-rank",…]`, `["membership-method","count"]` in that order, with no
  `author-constraint` present on those pins. Position matches ADR §2 and the hermetic H8 assertion
  (after `min-rank`/`author-constraint`, immediately before `rigor`).

## Spec adherence

| AC | Verdict | Evidence |
|---|---|---|
| AC-1 pin's method wins | ✓ | `refreshPinnedTags.js:318-323`; H1/H2/H12/U1 pass. The dial seam stays the `else` branch, so precedence is not stubbable away (ADR Option A's whole point). |
| AC-2 absent ⇒ today | ✓ | `curation.membershipMethod` read-only at `:282`; fallback is the untouched zero-arg `resolveMembershipMethod()`; H3/H4/H12/R3/S8 pass. The one deliberate byte-identity exception is AC-4, as ruled. |
| AC-3 fail-safe per pin | ✓ | `isImplementedMembershipMethod` gate + fail-open to the dial; `membershipMethods.js:39-41` fail-safe to `'count'` untouched; U2/H5/H6/H7 pass. |
| AC-4 disclosure, post-downgrade | ✓ | `refreshPinnedTags.js:399-405` emits `['membership-method', membershipMethod]` — the **post-downgrade** variable at `:324-325`, unconditionally; H2/H3/H5/H7/H8/H10/S9 pass; verified live on the relay. |
| AC-5 dialog sets it | ✓ | `CurationMethodDialog.jsx:83-88`, `:151-153`, `:167`, `:310-334`; S1/S2/S3 pass. Absent stays absent (conditional spread); untouched control re-emits the raw initial value; "Instance default" is a real `value=""` option. |
| AC-6 dial copy true | ✓ | `TrustDetermination.jsx:79-85` now says "default for pins that don't choose" and the `membership-method` claim is true as of AC-4; S4 passes. |
| E1 note/item untouched | ✓ | No diff in `runOneNotePin`/`runOneItemPin`; H9/R4 pass; `note-trusted-list` and `item-trusted-list` green. |
| E2 weighted × no WoT | ✓ | Downgrade at `:324-325` unchanged and now governs the per-pin value; H7 passes. |
| E3 × `authorConstraint` | ✓ | H11 passes; `only-me-curation` 35/0. |
| E4 flip the dial | ✓ | H12/H10 pass. |

**Tester's correction to the ADR re-aim table — ratified.** The ADR mapped
`tl-weighted-sum-method:324` to `'input'`; the plan re-aims it to `'count'`. The plan is right: that
body runs with no POV filter, so `membershipMethod = (requested !== 'count' && !wotFiltering) ? 'count'
: requested` downgrades, and the test's own next assertion (plain, score-less `p` tags) independently
proves the count fold ran. AC-4 requires the post-downgrade fold. The ADR's table is the errant line,
not the plan.

No behavior found in the diff that the story does not ask for. No scope creep into stories 4/5: no
second pin, no chip, no `d`-tag change.

## ADR adherence

- Files changed match ADR "Implementation notes" **except** the comment-only edit to
  `ui/src/utils/publishTagPin.js`, which was omitted (benign; recorded as a deviation — S8 still
  passes because `defaultCurationMethod` correctly carries no `membershipMethod`).
- ADR §1's hoisted `const resolveDial = …` alias was **inlined** instead
  (`refreshPinnedTags.js:318-323`). Forced, not sloppy: the untouched guard
  `test/pin-stack-composition.test.js:473-475` requires the literal `resolveMembershipMethod(` inside
  `runOnePin`'s body, which a `resolveMembershipMethod;` alias would not satisfy. Semantics are
  identical (deps-first, zero-arg). Recorded as a deviation.
- §1 predicate is pure and pin-blind, exported from the registry; `METHOD_IDS`,
  `IMPLEMENTED_METHOD_IDS` and `resolveMembershipMethod`'s signature/body unchanged (R3 asserts).
- §1 warn: module-level `Set`, keyed by value, silent on `undefined`/`null` — and also on `''`, a
  harmless superset that matches the dialog's empty sentinel (H6 asserts the absence case).
- §2 disclosure unconditional, correct position; 30393/30394 gain nothing (H9); `retractStaleTLs`
  `carryOver` untouched (R1).
- §3 vocabulary: exactly **one** definition of `TL_MEMBERSHIP_METHODS`
  (`ui/src/config/tlMembershipMethods.js`); the page's local const is deleted and imported; the
  dialog and `PinnedListPanel` import the same module. Mirror count is 1, as ruled.
- §5 read surfaces: `useTLDetail.js:72` parses the tag; `PinnedListPanel.jsx:482-492` renders one
  conditional row after "Only me" and before "Min rank", falling back to the raw id for a
  future-rung value. `enrichRowsWithTLStatus` untouched (R2).
- §7 firmware: schema clause added **and** reinstalled (verified in the graph above).
- No new dependencies; no new lint/typecheck/build tooling.

## Concept-graph integrity

- Handles remain `kind:pubkey:slug`; no new concept, no re-parenting.
- Firmware reinstall performed and verified through the Concept Graph API (not by reading
  `firmware/*.json` as the authority).
- Orientation for this review was done via `/summaries` → `/neighbors` → `/node/:handle`, per
  AGENTS.md §3.

## Things tests can't catch

- No secrets; no TA-pubkey literal introduced in any touched file (S10 asserts; I re-grepped the
  diff independently). The ADR-0015 `LEGACY_*` constants are untouched.
- No leftover debug logging. The one `console.warn` is the specified, deduplicated, absence-silent
  notice.
- No commented-out code; comments added are load-bearing rationale.
- **Concurrency:** `warnedPinMembershipMethods` is a module-level `Set` in a single-threaded
  runner — no race. Its unbounded growth is bounded in practice by the number of *distinct* bad
  values, which is attacker-influenceable in principle (anyone may publish a pin with an arbitrary
  `membershipMethod` string). In the worst case that is a slow memory creep in a long-lived process,
  one entry per distinct garbage string. Non-blocking (see Non-blocking 1) — it is the same shape as
  the existing `warnUnknownAuthorConstraint`, so it is pre-existing house pattern, not new risk
  introduced here.
- **Invariants:** read-time only. Nothing gates publication (invariant 2); the fold is applied at
  read/refresh time over already-trust-filtered assertions per the pin's observer (invariants 1 and
  3); POV cascade untouched. Invariant 4 not implicated (no storage/rebuild/wipe path touched).

## House rules check

- Concept Graph API authority respected.
- No new lint/typecheck/build tooling.
- Firmware reinstall performed, not merely promised.

## Findings

### Blocking

1. **`test/tl-weighted-sum-method.test.js:261-270` (S1), `test/tl-certainty-method.test.js:174-181`
   (S1), `test/tl-membership-method-selector.test.js:224-235` (S1)** — three previously-green
   source-contract assertions are **red as a direct result of this diff**. All three read
   `ui/src/pages/grapevine/TrustDetermination.jsx` and match on the method-entry literals
   (`/\{ id: 'input'[\s\S]*?\}/`, `/\{ id: 'certainty'[\s\S]*?\}/`, `/['"`]input['"`]/`), which ADR
   §3's vocabulary move relocated to `ui/src/config/tlMembershipMethods.js`. Verified empirically:
   `git show 048f5b76^:ui/src/pages/grapevine/TrustDetermination.jsx | grep -c "id: 'input'"` → `1`;
   the same command at `048f5b76` → `0`. All three failures were observed in the live runs recorded
   above, and all three are deterministic source scans — they do **not** depend on the stack.

   The ADR's re-aim table (Implementation notes) enumerated only the `membership-method`-**absence**
   assertions and missed the three S1 source contracts; the Phase-3 pass therefore did not re-aim
   them, and the judge gate could not see them because these suites are outside it. Net effect: the
   story's own named Gate-B suites now fail on this story's change, and the repo carries assertions
   that contradict the new suite's S3 ("the vocabulary lives in ONE UI module").

   **Asked change (Phase-3 lane, not the Implementer's):** re-aim the three S1 bodies to read
   `ui/src/config/tlMembershipMethods.js` for the ladder entries — keeping their
   `available: true` / label / `0–100` / disabled-rendering assertions intact — while leaving the
   `membershipMethod` settings-key and `disabled` assertions that genuinely belong to the page
   pointed at the page. Correct the ADR's re-aim table in the same round so the record matches
   what actually moved. Re-run all three suites afterwards and report how far each gets.

### Non-blocking

1. **`src/api/trustedList/refreshPinnedTags.js:60-68`** — `warnedPinMembershipMethods` grows one
   entry per distinct unknown value, and the values come off third-party pins. Optional improvement:
   cap the `Set` (e.g. stop recording past ~64 distinct values, or key on a truncated hash). Same
   pattern already exists for `authorConstraint`, so fixing it here alone would be half a fix —
   worth an `OPEN.md` row rather than this story.
2. **`ui/src/components/CurationMethodDialog.jsx:83-85`** — the seed uses
   `TL_MEMBERSHIP_METHODS.some(...)`, i.e. the *UI mirror*, to decide whether an initial value is
   renderable, whereas the server gates on `IMPLEMENTED_METHOD_IDS`. They agree today. If the mirror
   ever drifts (the known debt this story deliberately deferred to OPEN 310), a valid pin value could
   render as "Instance default" while still being re-emitted correctly by the raw-value path. Behavior
   is safe either way; noting it as the concrete cost of the deferred single-source fix.
3. **`test/tl-certainty-method.test.js` LP** — `spawnSync /bin/sh ENOBUFS` in the fixture prune,
   and all three live suites exceed a 240 s cap. Pre-existing environmental friction, unrelated to
   this diff, but it means the three re-aimed `membership-method` assertions were never actually
   executed by anyone yet. Worth reaching in the re-run round above.

### Harness friction

1. The ADR's Phase-3 re-aim table was treated by both the Tester and the Implementer as the complete
   blast radius for tests, but it only enumerated assertions about the *wire tag*, not assertions
   about the *source location of the moved constant*. A design that moves a file should trigger a
   `grep` for the old path across `test/` as a matter of course. Candidate `OPEN.md` row, type
   `meta`: "ADR re-aim tables must list source-path/source-literal assertions, not just
   behavioral ones, when the decision moves a file."

## Verdict
**CHANGES_REQUESTED**
