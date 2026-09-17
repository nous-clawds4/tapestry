# Review: Story 1 — Show a concept's sharing state on its own page

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-08-09
**Diff:** `git diff main...HEAD` (implementation commit `0d7b663e`; branch `feat/shared-concepts-legibility`)

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS on the story's terms**, after dispositioning two non-story failures. Two
      full runs were read line by line from complete captures (no `tail` piping):

  | Run | Result | Story suite |
  |---|---|---|
  | Implementer's second run (4123 lines, `scratchpad/fullsuite.log`) | `Overall: PASS`, every suite 0 failed, 53 skipped | 20/0/0 |
  | **Reviewer's independent run** (4140 lines, `scratchpad/review-gate.log`) | `Overall: FAIL` — two non-story suites, both dispositioned below | **20/0/0** |

  **The runs diverged, and the divergence is recorded rather than absorbed.** Neither failure is in
  this story's code, and `state-on-concept-page` was 20/0/0 in both.

  1. `relationship-primitives-probe` H4 — *"scan count went 6609070 -> 6609071"*. This is **OPEN.md
     row 75 / #150 verbatim**, down to the test's own quiesce-and-rerun guidance. Dispositioned by
     the row's established procedure (occurrences 5, 6, blinding-rebuild #2): an isolated re-run also
     failed (`6609080 -> 6609082`, +2 — counts climbing ~10 between runs, so the router was actively
     ingesting), then **9 passed / 0 failed with `strfry-router` quiesced**. Router restored to
     RUNNING immediately after. **Environmental — a confirmed occurrence of row 75.**
  2. `harness-lint` L1 — self-inflicted by the gate's own sequencing; see Harness friction 3.

  Incidental: the reviewer's run skipped 43 where the Implementer's skipped 53 — ten *more* tests
  executed, i.e. strictly wider coverage, so not pursued.
- [ ] `npm run test:playwright` — not applicable; this story adds no browser spec.
- [~] `harness-lint` — clean when run before this report existed; **1 violation while this report
      sits un-ratified** (L1: *"review … is PASS-final but story status is 'Approved'"*). Not a
      defect in the story — an artifact of the review gate's own sequencing. See Harness friction 3.
      It clears the moment the story flips to `Done`, which the gate defers until approval.
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [x] UI build — `npm run build` in `ui/` succeeds; page verified live at `:7778` in both states.

## Spec adherence

- [x] Every acceptance criterion has a passing test. All ten map through the plan's coverage table;
      spot-checked AC-4 (`U2`), AC-3 (`U4`/`U5` — both the no-copy and the copy-without-pointer
      branches), AC-7 (`U7`).
- [x] No criterion silently dropped.
- [x] No behavior added beyond the story. The three disposition endpoints, `fetchFromRelays`,
      `dispositionOf` and `bDisposition.js` are untouched, as the ADR required.

**Verified beyond the tests, against live data** (the tests discover fixtures at runtime, so this is
worth recording independently): `dog-breed` → `published: true` (it is genuinely on dcosl);
`cat`, `concept-header` → `false`, undeclared. In the browser, **dog breed** renders *🤝 Shared with
the community* with the button reading **Re-submit to the community**; **concept header** renders
*Not yet shared* with the first-time wording. The re-submit confirmation opens with the owner's two
required facts and cancels cleanly. No console errors.

## ADR adherence

- [x] Files match the implementation notes: `src/lib/sharingState.js`,
      `src/api/concept/sharingState.js`, `ui/src/hooks/useSharingState.js`, the `ConceptDetail.jsx`
      changes, and one registration line at `src/api/index.js:603`.
- [x] **The amended seam is honored.** `src/lib/sharingState.js` is strictly zero-require (pinned by
      `U8`); `bValueForms` is applied in the handler at `sharingState.js:110`/`:114`, matching the
      `trustedDictionary` precedent the amendment cited.
- [x] The tri-state survives end to end — `sharingState.js:66` returns `null` on `relayOk === false`,
      and the handler preserves `relay.ok` from its own `SimplePool` call rather than routing through
      the lossy `fetchFromRelays`.
- [x] The two-part published rule is implemented as specified: the relay copy must exist **and**
      carry the self-pointer (`sharingState.js:66`).
- [x] Public read, no `requireOwner` on the route (`src/api/index.js:603`); the write path's gate is
      untouched (pinned by `S7`).
- [x] No new dependencies. `SimplePool`/`ws` are required by the same absolute-path idiom
      `src/api/relay/fetchEvents.js` already uses.

## Concept-graph integrity

- [x] Handles are `kind:pubkey:slug`; `HANDLE_RE` at `sharingState.js:44` is the same expression as
      `selfDeclare.js:32`.
- [x] **No hardcoded TA pubkey anywhere in the new code** — grepped all four files for 64-hex
      literals, none present. The handler deliberately filters on *the handle's own* pubkey
      (`:98`), which is both the ADR's instruction and the reason the per-deployment rule is
      satisfied structurally rather than by convention.
- [x] Firmware reinstall correctly **not** required — no concept definitions changed.
- [x] Orientation was done via `/api/concept-graph/summaries` during Architecture (62 summaries).

## Things tests can't catch

- [x] No secrets committed.
- [x] No debug logging. The single `console.error` at `:130` matches `selfDeclare.js:111`.
- [x] No commented-out code.
- [x] Shell-injection: `strfryScan` (`:48`) reuses the `selfDeclare.js:34` escaping —
      `JSON.stringify(...).replace(/'/g, "'\\''")` — the standard single-quote-safe form. The only
      caller-controlled component (`dTag`) passes through it.
- [x] The relay pool is closed in a `finally` (`:79`), and the timeout races the query rather than
      leaking it.
- [x] Concurrency: the two store reads run under one `Promise.all` (`:100`); the hook guards against
      out-of-order resolution with a `cancelled` flag.
- [~] **Error-path asymmetry** — see Non-blocking 1.

## House rules check

- [x] Concept Graph API authority respected.
- [x] No new lint/typecheck/build tooling.
- [x] The hardwired relay constant is authorized by both the story ("Out of scope") and the ADR,
      which recorded it as the fifth call site for the eventual concept-graph-sourced sweep.

## Findings

### Blocking

None.

### Non-blocking

1. **`src/api/concept/sharingState.js:101`** — the local read swallows failure where the relay read
   tri-states it: `strfryScan(filter).then(newest).catch(() => null)`. A failed strfry scan is
   therefore indistinguishable from "this header carries no b-tags", so `local.selfDeclared`,
   `deferred` and `wiredTo` would all report *absence* on the strength of a check that did not run —
   the same class of defect AC-4 exists to prevent, in the other store. The ADR's own framing ("one
   predicate, two stores") invites symmetry here that the error handling does not deliver.

   *Why it is not blocking:* the acceptance criteria scope the tri-state to the relay specifically,
   and the practical blast radius is small — strfry is in-container, and when it is down the app is
   broadly broken. Note also that `published` is computed independently, so the headline answer
   stays correct even then; only the local sub-states degrade. *Optional improvement:* give the
   local read a `localOk` and surface an unknown local state the same way.

2. **`ui/src/pages/concepts/ConceptDetail.jsx:90`** — `alreadyShared = sharing?.published === true`
   correctly treats `null` as *not confirmed shared*, which means an unreachable relay yields the
   first-time button wording ("Submit as a Shared Concept") and no confirmation. The badge says
   *unconfirmed* directly above it, so the page does not contradict itself, and AC-8's precondition
   ("a concept that has already been shared") is genuinely unestablished — so this is within spec.
   But the button still asserts a first-time submission when the truth is unknown, and a stronger
   signal is already in hand: `local.selfDeclared` tells us a submission happened here even when the
   relay cannot be reached. *Optional improvement:* under `published === null`, let
   `local.selfDeclared` drive the wording.

3. **`test/state-on-concept-page.test.js:190`** — the assertion
   `/sharingState/.test(src.replace(/^.*sharingState\.js.*$/m, '')) || /resolveSharingState/.test(src)`
   is effectively just the right-hand clause; the left-hand `replace` strips only the first matching
   line and the `||` makes it unreachable as a constraint. It passes for the right reason today but
   is not doing the work its message claims. *Optional improvement:* reduce it to the
   `resolveSharingState` check it actually performs.

### Harness friction

1. **Truncated gate capture cost a diagnosis.** The Implementer's first full-suite run reported
   `Overall: FAIL`, but the command was piped through `tail -35`, so the failing suite's line was
   discarded and the run's exit code reflected `tail`, not the runner. The failure could not be
   attributed; a clean re-run followed. This is a **third sighting** of a pattern the
   `shared-concepts-adoption` audit already recorded — *"Narrow-tail log windows hid failing terms
   twice (tail -49 vs a grown suite roster)"* — and **declined** as a harness rule on the grounds
   that it was one-session capture practice. Three sightings across two books and two sessions
   undercuts that reasoning. Proposal for triage: a one-line tester/implementer-role note that
   full-gate runs redirect to a file rather than piping through `tail`/`head`, plus the reminder that
   piping masks the runner's exit code. Candidate OPEN.md `meta` row.

2. **OPEN.md row 75 / #150 — one confirmed occurrence, one lost.** The reviewer's own run caught the
   flake with its full message (`relationship-primitives-probe` H4, `6609070 -> 6609071`), so this
   is a **countable occurrence**, dispositioned environmental by the row's own procedure (quiesced
   re-run 9/0). New detail worth adding to the row: the *isolated* re-run failed too (+2), so
   "isolated re-run" is no longer sufficient on this machine — only quiescing `strfry-router`
   cleared it, and the drift was ~10 events between consecutive runs. The earlier `Overall: FAIL`
   was probably the same flake but **is not counted**, because finding 1 destroyed its evidence;
   an occurrence count is the argument for fixing a flake, and a lost sighting understates it.

3. **The review gate makes `harness-lint` red while it waits for a human.** L1 requires a PASS-final
   review to be accompanied by a story at `Done`. But the workflow has the Reviewer write the verdict,
   *then* ask for approval, *then* flip the story "in the same review commit" — so between writing
   the report and receiving approval, the repo is lint-red by construction. Any full-suite gate run
   in that window fails, which is exactly what a Reviewer does. Reproduced here: `harness-lint` was
   clean before this file existed and failed in the reviewer's run afterward. Proposal for triage:
   either exempt an uncommitted/unratified review from L1, or have the rule key on the review being
   *committed* rather than merely present. Candidate OPEN.md `meta` row.

## Verdict

**PASS**

Every acceptance criterion is covered by a passing test, and the criterion that carries the story's
real weight — AC-4, that an unaskable relay must not render as "not shared" — is enforced in three
places: the pure resolver (`sharingState.js:66`), the handler's refusal to use the lossy client
helper, and `U2`, which asserts both `=== null` *and* `!== false`.

Two judgement calls deserve explicit endorsement rather than silent acceptance. **Reading local
state from strfry rather than Neo4j** looks like a violation of "neo4j is the definitive me" until
you see why the ADR chose it: `self-declare` decides idempotency from strfry, so a badge sourced
from the graph could contradict the very button it labels. The ADR argued this correctly and the
code implements it. **`refresh()` in the `finally` branch** (`ConceptDetail.jsx:128`) exceeds AC-10,
which asks only for a refresh on success — deliberately, because a failed broadcast may still have
written locally, and the badge should report what happened rather than what was intended. Both are
right, and both would read as errors to a reviewer who only checked them against the letter of the
criteria.

The three non-blocking findings are recorded for the story's successors rather than for a kick-back:
none affects an acceptance criterion, and finding 1's fix belongs with a symmetry pass over both
stores rather than bolted onto a display story.

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection performed; result reported in chat, not recorded here.
