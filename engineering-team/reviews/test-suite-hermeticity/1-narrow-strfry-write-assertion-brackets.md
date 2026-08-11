# Review: Story 1 — The "writes nothing to strfry" assertions must measure only what this instance could have written

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-08-10
**Diff:** `git diff origin/staging...HEAD` (commit `aa1bd410`)

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS (Overall: PASS)**. Run by the reviewer with `strfry-router` **RUNNING** and
      **no quiescing** — the first time this gate has been evaluable that way, which is the story's
      point. Every suite green; 53 skipped (browser-only B-class and unmet preconditions, all
      pre-existing). The three suites at issue:

      ```
      relationship-primitives suite:                   PASS (23 passed, 0 failed)
      relationship-primitives-probe suite:             PASS (9 passed, 0 failed)
      strfry-write-assertion-bracket suite:            PASS (6 passed, 0 failed)
      ```

      Wall clock ~35 min, almost entirely container-side work (1.5s of node CPU) — context for how
      expensive the withdrawn "stop the router, re-run the gate, restart it" remedy actually was.
- [x] `npm run test:playwright` — **not applicable.** No UI, no route, no rendered surface; the diff is
      confined to `test/` and `OPEN.md`.
- [x] _Lint not configured — skipped._ (`scripts/harness-lint.sh` run separately: **clean, 0 violations**.)
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped._

### Verification protocol V1 (the story's AC-1 evidence), re-read from the implementation record

Router **RUNNING** throughout, no quiescing, no standalone re-runs:

| Suite | Result |
|---|---|
| `relationship-primitives` H8 | **10/10 green** — 23 passed / 0 failed every run |
| `relationship-primitives-probe` H4 | **10/10 green** — 9 passed / 0 failed every run |
| Whole-corpus growth during the protocol | **+962 events** |

Pre-fix baseline on the same machine: **5 red / 1 green**. The +962 figure is what makes this
persuasive rather than merely green — roughly a thousand router ingests landed inside the window in
which the previously-flaky assertions all passed.

## Spec adherence

- [x] **AC-1 (flake gone)** — `S1` (no whole-corpus filter) + protocol V1 (20/20 with ~962 concurrent
      ingests). Independently confirmed: `grep` finds no `encodeURIComponent('{}')` anywhere in
      `test/`, and the only `scan/count` call sites in the two suites are
      `relationship-primitives.test.js:289` and `relationship-primitives-probe.test.js:195`, both
      author-scoped. No second whole-corpus path (e.g. a `docker exec strfry scan`) was left behind.
- [x] **AC-2 (teeth kept)** — `S2` + `H1` + `H2`. `H1` was re-verified by the reviewer end to end:
      publish a TA-signed event → author-scoped count moves → delete by id → count returns.
- [x] **AC-3 (portable)** — `S3`: no 64-hex literal in either suite, both resolve
      `GET /api/assistant/pubkey`. **Structural only — see Finding NB-3.**
- [x] **AC-4 (standing tax retired)** — `S4` (no `quiesce` text in either suite) + OPEN.md row 150
      flipped to `DONE` with the guidance explicitly withdrawn. Table integrity checked: the edited
      row has 7 pipe-delimited fields, matching the 7-column header.
- [x] No criterion silently dropped.
- [x] No behavior added beyond the story. Diff is 3 files for the implementation
      (`test/relationship-primitives.test.js`, `test/relationship-primitives-probe.test.js`,
      `OPEN.md`) plus the Phase-3 guard suite and its runner registration.

## ADR adherence

- [x] **Files match** ADR 0001's implementation notes exactly — both `strfryEventCount()` helpers,
      both assertion messages, both file-header comments, both in-test bracket comments, OPEN.md.
- [x] **Option A implemented as decided.** Filter is `{"authors":[<runtime TA>]}` — no `since:`
      bound, which is what Option C was rejected for. Confirmed absent from the diff.
- [x] **Loud-failure requirement honored.** `resolveTaPubkey()` throws unless the answer matches
      `/^[0-9a-f]{64}$/` — no fallback to `{}`, no `SKIP`
      (`relationship-primitives.test.js:263-277`, `-probe.test.js:169-183`).
- [x] **No new dependencies.** No new tooling. `JSON.stringify` + the existing `fetch`.
- [x] **Phase-split deviation** (Implementer edits `test/`) was surfaced at the Phase-3 gate and
      ratified there. Verified honored in both directions: the Phase-4 commit `aa1bd410` touches the
      two suites and OPEN.md and **does not** touch `test/strfry-write-assertion-bracket.test.js`.

## Concept-graph integrity

- [x] No concept handles introduced or changed; the story touches no domain concept.
- [x] **No firmware reinstall required** — no concept definition changed. ADR says the same.
- [x] Per-deployment TA rule (CLAUDE.md) respected — runtime resolution, no literal.

## Things tests can't catch

- [x] No secrets committed. The TA pubkey is fetched at runtime, never written to a file.
- [x] No leftover debug logging, no commented-out code.
- [x] **Fixture leaves no residue** — reviewer-verified after multiple H1 runs:
      `strfry scan --count '{"kinds":[7357]}'` → **0**, and Neo4j
      `MATCH (n:NostrEvent) WHERE n.kind = 7357 RETURN count(n)` → **0**.
- [x] **Cleanup is durable.** `/api/strfry/publish` imports to **local strfry only**
      (`publishEvent.js:71-84`, `exec('strfry import')`) with no external broadcast, so H1's probe
      event cannot be re-synced back from a remote relay after deletion.
- [x] **Brain-write hook cannot fire on the fixture.** `isOwnedTapestryEvent`
      (`tapestryBrainWrite.js:36-44`) requires `kind === 39999` *and* a `z` tag of
      `39998:<TA>:tapestry`; H1's event is kind 7357 with only a `d` tag, so the hook returns `null`
      and writes nothing to the graph. The kind choice is load-bearing, not incidental —
      see NB-2.
- [x] **Concurrency considered.** The guard suite publishes a TA-signed event, which *would* break a
      concurrently-running H4/H8 bracket. In `test/test.js` all three suites are sequential `await`s
      (lines 534-537), so no interleaving occurs. The fixture kind (7357) also cannot collide with
      the eight other suites that bracket on `{kinds:[39999], '#d':[dTag]}`. See NB-1.
- [x] Security: no new input crosses a boundary; the suites are read-only against a local stack
      except for H1's own fixture, which it owns and reverts.

## House rules check

- [x] Concept Graph API authority respected (not applicable — no concepts).
- [x] No new lint/typecheck/build tooling.
- [x] Existing repo patterns followed: runtime TA resolution matches the pattern used by 31 other
      suites; the U/S/H test-class split and the skip-aware runner registration match the two suites
      under repair.

## Findings

### Blocking

_None._

### Non-blocking

1. **`test/strfry-write-assertion-bracket.test.js:180-215`** — the guard suite publishes a TA-signed
   event, so it must never run *concurrently* with `relationship-primitives` or
   `-probe`; it would land inside their bracket and fail them for real. The runner is sequential, so
   this is safe today, and nothing in the repo runs suites in parallel. *Optional improvement:* a
   one-line note in the suite header warning against parallelizing it, so a future CI story that
   introduces suite-level parallelism doesn't rediscover this the hard way.

2. **`test/strfry-write-assertion-bracket.test.js:57`** — `TEETH_KIND = 7357` is doing more work than
   its comment claims. The comment explains non-replaceable and non-ephemeral, but the *other*
   reason it is safe is that it is not kind 39999, which is what keeps
   `maybeBrainWriteTapestry` from writing the fixture into Neo4j. *Optional improvement:* say so in
   the comment; a future edit to "a more realistic kind" would silently start polluting the graph.

3. **AC-3 is verified structurally, never empirically.** `S3` proves no pubkey is hardcoded and that
   the runtime endpoint is called; no second deployment was exercised, because none was reachable
   from this session. This is an honest ceiling, not an oversight — and it is worth stating plainly
   because the flake was always machine-local, so "it works here" was never the question. The
   Implementer flagged this at the Phase-4 gate rather than letting it pass silently.

4. **The loud-failure path specified by ADR 0001 has no test.** "Stack present but
   `/api/assistant/pubkey` unresolvable → fail, never `SKIP`, never fall back to `{}`"
   (`relationship-primitives.test.js:263-277`) is verified by reading only. The reviewer confirmed the
   adjacent case — stack unreachable → clean `SKIP` (4 skipped, 0 failed) — but could not induce
   "reachable stack, broken identity endpoint" without mocking the stack. Six defensive lines, and
   the branch is plainly correct; recorded because the requirement was singled out at two gates and
   still ended up unexercised.

5. **ADR 0001 contains two wrong counts** (context paragraphs only — no bearing on the decision or
   the code):
   - "*Seven* other suites bracket strfry counts with `{kinds:[39999], '#d':[dTag]}`" — the actual
     figure is **8** (`attach-the-world`, `break-a-goal-into-pieces`, `capture-a-goal-and-see-it`,
     `sessions-read-the-brain`, `store-the-four-when-a-goal-is-captured-or-updated`,
     `teach-it-what-matters`, `the-brain-survives`, `the-proposal-loop`).
   - "*Nine* suites already resolve it at runtime via `GET /api/assistant/pubkey`" — the actual
     figure is **34** files, i.e. **31** besides the two under repair and the new guard suite. The
     ADR understates its own strongest precedent by more than 3×.

   Not blocking: an ADR's merge-worthiness rests on its decision, and both errors sit in supporting
   prose that argues *for* the option chosen. Recorded because ADRs are read as fact by later
   sessions, and a number that is wrong by 3× is the kind of detail that quietly erodes trust in the
   rest of the document.

### Harness friction

1. **The harness has no phase split for a story whose deliverable *is* a test change.** ADR 0001's
   implementation note repeats the standing rule ("the Implementer's `test/` diff is expected to be
   empty"), which is unsatisfiable here: there is no source file to change. Followed literally, the
   Tester performs the narrowing and Phase 4 has nothing to drive it; ignored silently, the
   Implementer edits tests with no stated guard. The working resolution — Tester writes a *new*
   guard suite that fails, Implementer edits the suites under repair and is barred from the guard
   suite — was invented in-session and ratified at the Phase-3 gate. It should be written down
   rather than re-derived. **→ OPEN.md row 167.**

2. **`CLAUDE.md:177` cites a stale TA pubkey as "this machine".** Found incidentally while resolving
   the TA at runtime for this story. The passage teaching "never hardcode, it goes stale" contains a
   hardcode that has: it names `82b75e47…973833`, while this machine now answers `11f23fe4…f93767`.
   Nothing was misled in practice — the story resolves at runtime, which is the rule the passage
   correctly teaches. Not covered by `docs/TA_KEY_EXPOSURE_AUDIT_2026-08-10.md`, which scopes
   hardcoded pubkeys out. **→ OPEN.md row 168.**

## Base-drift note

`origin/staging` advanced **11 commits** mid-session (the parallel dev machine: the whats-open intake
fix, a CHANGELOG row, and `docs/TA_KEY_EXPOSURE_AUDIT_2026-08-10.md`). The branch was rebased onto
`7fe8d97a` before this review was committed — clean, no conflicts. Only `OPEN.md` overlapped, and only
in regions neither side touched; row 150's flip survived intact. The `npm test` gate above was run
pre-rebase, but **none of the 11 commits touch any file this story changes**, and the two live suites
were re-run post-rebase as confirmation (`strfry-write-assertion-bracket` 6/0,
`relationship-primitives-probe` 9/0). Row numbers were allocated from **167** against
`origin/staging`'s tip of 166 rather than this branch's 165, per row 151's convention.

## Verdict

**PASS**

The diff is mergeable as-is. Every acceptance criterion has a passing test or — for the two the
story deliberately left manual (AC-1's repeat-run protocol, AC-4's ledger flip) — recorded evidence
that the story itself specified in advance. The reviewer-run gate is green with the router **running
and unquiesced**, which is the exact condition the story existed to make survivable, and the +962
concurrent ingests during protocol V1 make that a demonstration rather than an assertion.

Five non-blocking findings are recorded above. None affects correctness of the shipped code: two are
comment improvements, two are honest limits of verification that were surfaced by the Implementer
rather than discovered here, and one is a pair of wrong counts in the ADR's supporting prose. The
last is the only one I would want acted on reasonably soon, since ADRs are read as fact later.
