# Test Plan: Story 5 — Sessions read the brain (bounded orientation + work records)

**Story:** `engineering-team/stories/second-brain/5-sessions-read-the-brain.md`
**ADR:** `engineering-team/decisions/second-brain/0005-work-records-and-bounded-orientation.md`
**Date:** 2026-07-23

Test file: `test/sessions-read-the-brain.test.js` (structural template: `test/attach-the-world.test.js`). Classes per the ADR's Test-class guidance + test-hermeticity-ci/0001: **U** (pure `work-records.js` core, always executed), **S** (source assertions, stack-free), **H** (live local stack, per-test SKIP when unreachable), **R** (regression sentinels).

## Coverage map

| Criterion | Test(s) | Level |
|---|---|---|
| **AC1** — bounded, corpus-independent orientation; served goal verbatim | `H7` (orient bounded: goalCount + roots capped at ORIENT_ROOT_CAP + served deliverable/boundary verbatim, corpus grown *past* the cap); `S6` (route/gate/ORIENT_ROOT_CAP applied); `U4` (recency sort) | integration + unit |
| **AC2** — the session names its goal; the record lives in the brain | `H8` (refusal matrix: goal-not-found + empty-field writes refused, read-back proves nothing written); `H1` (record attaches to its goal on the spine); `S1` (goal-not-found refusal) | integration |
| **AC3** — a work record on the spine: session, summary, produced pointers, ≤2 questions; `worked`, dated, no edit | `H1` (round-trip: type/session/summary/questions/date read back); `H2` (produced resource attached + resolved as a pointer card); `H4` + `S1` (≤2 questions enforced); `U2` (parse shape); `S9` (RecordEntry renders session/questions/produced, no edit affordance) | integration + unit + source |
| **AC4** — dated, attributed, append-only | `H3` (a second record adds one entry; every prior entry byte-unchanged); `S5` (append-only mint: random/nonce d-tag, never `regenerateJson`); `U2` (session + happenedOn parsed) | integration + source + unit |
| **AC5** — session-born idea captured + attributed, never launched | `H5` (note-goal-idea → a **root** goal, `captured`, session-attributed origin, + a `noted` record; launches nothing); `H6` (`name-collides` refused); `S2` (route/gate/`noted`/`name-collides` + no launch/egress tokens) | integration + source |
| **AC6** — writes gated + local-only; read module read-only | `H10` (host-side: orient 403, both writes 401); `S1`/`S2` (in-handler gate); `S4` (serializeGoalWrite); `S13` (brain module mutation/strfry-free) | integration + source |
| **AC7** — copy discipline; no-edit contract live; no regression; **findings dispositioned** | `S10` (jargon-clean); `S9` (no edit affordance); `S11` (86b: accessible `<button>` Retry, both surfaces); `S12` (87a dead fallback dropped; 87b headings ratified); `H9` (hygiene green); the four sibling suites re-run green under the widen-only import re-pin | source + integration |
| **New concept self-bootstraps** (ADR d8) | `H1` (concept + schema exist live after the first record); `S3` (`ensureWorkRecordConcept` via create-concept + save-schema) | integration + source |
| **Brain module 7th require, re-pinned across 4 suites** (ADR d10) | `S7` + `S8` (brain requires `work-records`; `records[]` no longer hardcoded); sibling re-pins in `capture` S2, `structures` S3, `break` S1, `attach` S11 (allowlist widened to seven — widen-only, all stay green) | source |

## Edge cases

- [x] Malformed / non-record json → `parseWorkRecordRow` returns `null`, never throws (`U2`).
- [x] A goal with no records buckets to nothing (`U3`); records sort newest-`happenedOn` first (`U4`).
- [x] More than two questions → `too-many-questions`, nothing written (`H4`, `S1`).
- [x] Append-only under a real second write — the first entry is byte-unchanged (`H3`).
- [x] A produced resource **already attached** is referenced, not double-attached (ensure-and-reference; exercised by `H2`'s round-trip).
- [x] Orientation past the cap — `ORIENT_ROOT_CAP + 1` fresh roots; `roots.length === cap < goalCount` (`H7`).
- [x] Unknown/empty inputs (goal-not-found, empty session/summary/name) each refused with read-back proving nothing written (`H8`).
- [x] Caller classes: remote GET orient → 403 (in-handler gate); remote POST writes → 401 (default-deny middleware) (`H10`).
- [x] Concept absent (fresh instance) — the read tolerates it (empty records); the write self-bootstraps (`H1`, `S3`).
- [x] Untouchables (`relationships.js`, `probe.js`, `auth.js`/`PUBLIC_MUTATIONS`) free of this story (`R2`).

## Test infrastructure

- **Framework:** Node built-in runner (`node test/test.js`; the suite also runs standalone: `node test/sessions-read-the-brain.test.js`). No new frameworks.
- **Concept Graph API:** loopback `http://127.0.0.1:7778` via `docker exec tapestry curl` (the `localTrusted` class) for reads/writes; host `http://localhost:7778` via `fetch` for the remote caller-class gate checks. TA pubkey resolved at runtime (`/api/assistant/pubkey`) — never hardcoded.
- **Firmware state:** none required. The **Work Record concept is runtime-created / self-bootstrapped** on the first `create-work-record` (never firmware-seeded); no `POST /api/firmware/install` precondition.
- **Fixtures:** sentinel-named (`harness-workrec-`) — a work-record host goal (with a verbatim deliverable/boundary), a produced resource, a `note-goal-idea` root goal + noted record, and `ORIENT_ROOT_CAP + 1` orient root goals. Teardown: strfry delete by d-tag (goals/resources via the real `dtag` core; work records' random d-tags captured from responses) → Neo4j element+tag delete by uuid → value-scoped orphan sweep (json CONTAINS the sentinel, plus tracked d-tags) → strfry count-0 verify. Pre-clean runs the same routine; a teardown failure is a loud suite failure. The **concept persists** across runs (only fixture *elements* are torn down); the suite is idempotent. **Verified post-run: 3 legacy goals, zero `harness-` leftovers, hygiene sound.**
- **Registration:** the suite is wired into `test/test.js` — require, run-call, summary line, the **live `overallOk` chain** (the OPEN.md #43 severed terminator flipped `;`→`&&` with the new term ending `;`; the dead block untouched), and `totalSkipped`.

## How to run

```bash
node test/sessions-read-the-brain.test.js
```

Full gate (≈24 min; background via the OPEN.md rows 74/83 bounded waiter):

```bash
npm test
```

## Verification

The new tests fail with the current code, for the right reason (feature absent — the `work-records` core is missing, the routes 404, the brain require is unwired, the record entry has no session/questions/produced rendering, the findings are unaddressed). The four sibling suites re-run green under the widen-only import re-pin. Confirmed 2026-07-23 (stack present) at commit `349688d5`:

```
sessions-read-the-brain: 8 passed, 22 failed, 0 skipped
  # 22 FAIL — the substantive spec (U1–U4, S1–S3, S6–S9, S11–S12, H1–H8, H10):
  #   "work-records.js does not exist yet"; "create-work-record is not registered";
  #   "must register GET /api/brain/orient"; "must require ../../lib/brain/work-records";
  #   "RecordEntry must render the session attribution"; "the href-less <a … onClick> must be gone";
  #   "the dead freshness fallback 'verified recently' must be dropped"; route 404s on the H rows.
  #  8 PASS pre-impl (documented): S13/S14/H9/R1/R2 (invariants), S10 (no jargon today),
  #   S4/S5 (conditional pins — vacuous until the handlers exist, bind post-impl).

capture-a-goal-and-see-it:      27 passed, 0 failed, 0 skipped   (re-pin S2 → PASS)
structures-the-brain-can-trust: 24 passed, 0 failed, 0 skipped   (re-pin S3 → PASS)
break-a-goal-into-pieces:       30 passed, 0 failed, 0 skipped   (re-pin S1 → PASS)
attach-the-world:               29 passed, 0 failed, 0 skipped   (re-pin S11 → PASS)
```
