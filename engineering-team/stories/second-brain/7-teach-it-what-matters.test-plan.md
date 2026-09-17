# Test Plan: Story 7 — Teach it what matters — priority signals

**Story:** `engineering-team/stories/second-brain/7-teach-it-what-matters.md`
**ADR:** `engineering-team/decisions/second-brain/0007-teach-it-what-matters.md`
**Date:** 2026-07-24

Test file: `test/teach-it-what-matters.test.js` (structural template: `test/the-proposal-loop.test.js`). Classes per the ADR's Test-class guidance + test-hermeticity-ci/0001: **U** (pure `signals.js` core, always executed), **S** (source assertions, stack-free), **H** (live local stack, per-test SKIP when unreachable), **R** (regression sentinels).

## Coverage map

| Criterion | Test(s) | Level |
|---|---|---|
| **AC1** — record a pairwise choice between two goals, optional one-line reason; unknown/ambiguous refused; self-choice refused; nothing written on refusal | `H1` (round-trip with reason); `H3` (`same-goal` + `goal-not-found` refused, spine snapshot unchanged); `S1` (route/gate/named refusals); `U2` (reason optional in the parse) | integration + source + unit |
| **AC2** — every signal carries judged-by, judged-on, and the framing tag | `H1` (the STORED element carries `judgedBy:'owner'`, a dated `judgedOn`, `framing:'solve-one-today'` — read raw from the store); `S6` (the core stamps all three); `S5` (the framing is a server-stamped constant, never read from the body); `U2` (all three extracted by the parse) | integration + source + unit |
| **AC3** — append-only; visible on BOTH goals' spines, side-worded | `U3` (the two-key fan-out: one record under BOTH slugs); `U4` (the d5 ratified wording verbatim, both sides, ± reason fold); `H1` (both spines carry the entry, verbatim summaries, same date both sides); `H2` (the reversal coexists; every prior spine line survives; the first element **byte-unchanged** in the store); `S4` (random/nonce d-tag; **no `regenerateJson`** on the signal path) | unit + integration + source |
| **AC4** — signals never launch/decide anything; proposals may cite them in words only; the story-6 proposer unchanged | `H4` (the proposals queue is IDENTICAL before/after recording; the repeat-pair also proves the corpus accumulates); `S10` (no launch/egress tokens in the signal core; `makeProposal`/`decideProposal` contain **no** signal tokens) | integration + source |
| **AC5** — a replaced framing leaves earlier signals interpretable (the tag is carried BY the signal) | `U2` (distinct framing tags coexist, each read from its own row); `H1` (the stored tag reads back); `S5` (no caller-supplied framing — the swap hatch is not built) | unit + integration + source |
| **AC6** — jargon/numeral-free wording; append-only runtime concept; TA runtime-resolved; no regression | `S11` (jargon + no-numeral + no-exclamation scan over the signals core — the templates' home); `U4` (the verbatim templates carry no numerals); `S7`+`H1` (self-bootstrap: concept + schema exist live after the first signal); `S14` (no 64-hex); `H7` (hygiene stays green); the six sibling suites re-run green under the widen-only import re-pin | source + unit + integration |
| **ADR d4 — NO standing requirement** (operator-ratified) | `H1` (the round-trip succeeds between two **captured/non-viable** fixture goals — the ruling made live); `S2` (no viability tokens in the signal core) | integration + source |
| **ADR d10 — read surface: the records[] merge; the NINTH require; NO new route** | `S8` (brain requires `lib/brain/signals`; goal-detail merges the signal projection; import surface pinned to NINE); `S9` + `H6` (no `/api/brain/signals` route — source + live 404); `H5` (the spine MERGES `worked` + `preferred` + `passed over`, newest-first); sibling re-pins in `capture`, `structures`, `break`, `attach`, `sessions-read`, `the-proposal-loop` (allowlist widened to nine — widen-only, all six stay green) | source + integration |
| **Zero UI diff (ADR d14)** | `S12` (GoalDetail/App/Layout/styles carry no signal reference — passes before AND after; the Reviewer's git-diff check is the byte pin) | source |

## Edge cases

- [x] Malformed / non-signal json → `parseSignalRow` returns `null`, never throws (`U2`).
- [x] A signal missing either slug, or preferring a goal over itself, is dropped at read as malformed (`U3`).
- [x] The other goal vanished (dangling slug) → the wording falls back to the slug, never a crash (`U4`).
- [x] A reason-less signal renders without the em-dash fold on both sides (`U4`, `H2`).
- [x] Distinct framing tags coexist, each kept per-row (`U2`) — AC5 without needing a swap mechanism.
- [x] The SAME pair recorded twice → both facts stand (the corpus accumulates; `H4`).
- [x] The reversal (B-over-A after A-over-B) coexists with the original — append-only, first element byte-unchanged (`H2`).
- [x] Refusals write nothing — spine snapshots identical before/after (`H3`).
- [x] Non-viable goals are comparable — the main round-trip runs on two captured goals (`H1`; ADR d4).
- [x] Caller classes: remote POST `record-priority-signal` → 401 (default-deny middleware); `/api/brain/signals` → 404 (no route) (`H6`).
- [x] Concept absent (fresh instance) — the write self-bootstraps; reads tolerate absence (`H1`, `S7`).
- [x] Untouchables (`relationships.js`, `probe.js`, `auth.js`/`PUBLIC_MUTATIONS`) free of this story (`R2`).

## Test infrastructure

- **Framework:** Node built-in runner (`node test/test.js`; the suite also runs standalone: `node test/teach-it-what-matters.test.js`). No new frameworks. **Playwright: not applicable** — zero UI diff (ADR d14); the spine rendering is the story-5/6-covered `RecordEntry`.
- **Concept Graph API:** loopback `http://127.0.0.1:7778` via `docker exec tapestry curl` (the `localTrusted` class) for reads/writes; host `http://localhost:7778` via `fetch` for the remote caller-class gate checks. TA pubkey resolved at runtime (`/api/assistant/pubkey`) — never hardcoded. The stored element's attribution (AC2) and the byte-unchanged proof (AC3) read the element's json tag via `/api/neo4j/query` (`{success, data:[…]}` shape).
- **Firmware state:** none required. The **Priority Signal concept is runtime-created / self-bootstrapped** on the first `record-priority-signal` (never firmware-seeded); no `POST /api/firmware/install` precondition.
- **Fixtures:** sentinel-named (`harness-signal-`) — **two CAPTURED (deliberately non-viable) goals** `harness-signal-alpha` / `harness-signal-beta` (the ADR d4 proof rides the main round-trip), append-only signal elements (with-reason, reversal-no-reason, repeat-pair), and one work record (the merge proof). Teardown: strfry delete by d-tag (goals via the real `dtag` core; signals'/work record's random d-tags captured from the responses' uuids) → Neo4j element+tag delete by uuid → value-scoped orphan sweep (json CONTAINS the sentinel) → strfry count-0 verify. Pre-clean runs the same routine; a teardown failure is a loud suite failure. The **concept persists** across runs (only fixture *elements* are torn down); the suite is idempotent. **Verified post-run: 3 legacy goals, zero `harness-signal-` leftovers, hygiene sound.**
- **Result-shape note (the story-6 precedent):** `record-priority-signal`'s response carries the minted element's **`uuid`** (`signal.uuid`) alongside the slug — required for durable teardown and the raw-store reads; asserted by `H1`. Consistent with `make-proposal`'s `proposal.uuid` and `create-work-record`'s `record.uuid`.
- **Registration:** the suite is wired into `test/test.js` — require, run-call, summary line, the **live `overallOk` chain** (the `createTapestryResult` terminator flipped `;`→` &&` with the new `teachItWhatMattersResult` term ending `;`; the OPEN.md #43 dead block untouched), and `totalSkipped`.

## How to run

```bash
node test/teach-it-what-matters.test.js
```

Full gate (≈24 min; background via the OPEN.md rows 74/83 bounded waiter — run the long command *as* the backgrounded call, no inner `nohup…&`):

```bash
npm test
```

## Verification

The new tests fail with the current code, for the right reason (feature absent — the `signals` core is missing, `record-priority-signal` 404s inside the container, the concept is absent, the goal-detail `records[]` carries no signal projection). The six sibling suites re-run green under the widen-only import re-pin. Confirmed 2026-07-24 (stack present) at commit `37c950c0`:

```
teach-it-what-matters: 10 passed, 17 failed, 0 skipped
  # 17 FAIL — the substantive spec (U1–U4, S1, S2, S4–S8, S11, H1–H5):
  #   "signals.js does not exist yet"; "record-priority-signal is not registered";
  #   "the framing must be a SINGLE named constant"; "ensureSignalConcept … does not
  #   exist yet"; "must require ../../lib/brain/signals"; H rows: "Cannot POST
  #   /api/normalize/record-priority-signal"; H5 got only ["worked"] on the spine.
  # 10 PASS pre-impl (documented sentinels, pass BEFORE and AFTER): S3 (mutex
  #   survives; per-handler check guarded), S9 (no /api/brain/signals route), S10
  #   (the proposer consumes no signals), S12 (zero UI diff), S13 (brain read-only),
  #   S14 (no 64-hex), H6 (middleware default-deny 401 + the 404), H7 (hygiene),
  #   R1/R2 (invariants).

capture-a-goal-and-see-it:      27 passed, 0 failed, 0 skipped   (re-pin → PASS)
structures-the-brain-can-trust: 24 passed, 0 failed, 0 skipped   (re-pin → PASS)
break-a-goal-into-pieces:       30 passed, 0 failed, 0 skipped   (re-pin → PASS)
attach-the-world:               29 passed, 0 failed, 0 skipped   (re-pin → PASS)
sessions-read-the-brain:        30 passed, 0 failed, 0 skipped   (re-pin → PASS)
the-proposal-loop:              33 passed, 0 failed, 0 skipped   (re-pin → PASS)
```

Post-run residue check: brain shows the 3 legacy goals only, 0 `harness-signal-` leftovers, hygiene sound.

## Notes for the Implementer

- **The verbatim wording is load-bearing.** `U4`/`H1`/`H2` assert the ADR d5 ratified templates by **strict equality** — `chose this over "{other}"` / `"{other}" chosen over this`, em-dash reason fold, type words `preferred` / `passed over`. Put the templates in the pure core (`signalEntry`), exactly as the ADR specifies; any drift is a test failure, not a style choice.
- **The response must carry `signal.uuid`** (see the result-shape note) — `H1` fails without it, and teardown depends on it.
- **The six sibling re-pins are already applied** (widen-only, in this test commit). The Implementer's source diff must **not** touch any test file (the impl-commit-touched-no-test guard); adding `require('../../lib/brain/signals')` keeps all six siblings green.
- **`groupSignalsByGoal` must return the SAME record object under both keys** (`U3` asserts identity via uuid, not a copy) — one fact, two views.
- **No `/api/brain/signals` route** — `S9`/`H6` fail if one appears; the goal detail is the only visibility surface.
