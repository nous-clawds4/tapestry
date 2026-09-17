# Test Plan: Story 1 — Store the four when a goal is captured or updated

**Story:** `engineering-team/stories/goal-intent-fields/1-store-the-four-when-a-goal-is-captured-or-updated.md`
**ADR:** `engineering-team/decisions/goal-intent-fields/0001-shared-intent-field-picker-and-provisioned-schema.md`
**Book:** `engineering-team/audits/store-and-show-the-prompt-and-the-estimate/book.md` (operational Direction — the frame is the constitution)
**Date:** 2026-07-26

**Test file:** `test/store-the-four-when-a-goal-is-captured-or-updated.test.js` (40 tests: 12 U, 14 S, 11 H, 3 R)
**Registered in:** `test/test.js` (gates the exit code; summary line + an explicit H-class execution line)
**Also touched:** `test/the-brain-survives.test.js` S7 — one byte-window pin re-aimed; see *Sibling pins* below.

---

## Coverage map

Every acceptance criterion maps to at least one **failing** test. Class key: **U** = pure unit
(stack-free, always executed), **S** = source assertion (stack-free, structure-bounded), **H** =
live local stack (skips when unreachable), **R** = regression sentinel.

| Criterion | Test | File | Level |
|---|---|---|---|
| **AC1** — accepted at capture, by every capture path; unsupplied fields **absent**; a capture with none of them still succeeds | `U3` each of the four supplied on its own is carried, and only it | `test/store-the-four-when-a-goal-is-captured-or-updated.test.js` | unit |
| AC1 | `U4` all four supplied are all four carried | same | unit |
| AC1 | `U5` none supplied yields an empty result | same | unit |
| AC1 | `U7` falsy-but-supplied values survive (0, false, `''`) | same | unit |
| AC1 | `U10` nothing outside the four is ever copied | same | unit |
| AC1 (capture path: noting a new root goal) | `S2` the root-capture path applies the picker at the handler; no raw body reaches the core | same | source |
| AC1 (capture path: child goal) | `S3` the child-capture path applies the picker at the handler | same | source |
| AC1 (capture path: noting a new root goal) | `H1` a root goal captured with a prompt and an estimate stores exactly those two — the two flags stay ABSENT | same | integration (live) |
| AC1 (capture path: child goal) | `H2` a child goal stores the two flags it was given, including the one set FALSE — prompt/estimate ABSENT | same | integration (live) |
| AC1 (edge: empty subset) | `H3` a capture with none of the four still succeeds and stores none of them | same | integration (live) |
| AC1 (capture path: direct record — "no work; must not regress") | `H9` the path that stores a supplied record as given still carries all four, plus its out-of-contract rider | same | integration (live) |
| **AC2** — accepted at update; the other three and everything else unchanged | `S5` the update path computes the four BEFORE its "at least one field" refusal, names all seven accepted fields, merges them onto the section | same | source |
| AC2 | `H5` updating one of the four leaves the other three, and name/statement/origin/capture date/deliverable/boundary/parent/`promptVersion`, exactly as they were | same | integration (live) |
| AC2 (safety) | `H11` no record outside the harness fixtures was written, moved or touched | same | integration (live) |
| **AC3** — stored in the shape the concept declares (prompt byte-identical, estimate a number, flags booleans) | `U8` a multi-line markdown prompt is copied byte-identical | same | unit |
| AC3 | `H4` the same prompt is byte-identical after a full round-trip through signing, storage and export; the estimate is a number; each flag is a boolean | same | integration (live) |
| AC3 (the trim trap) | `S4` the four never enter `update-goal-intent`'s empty-value refusal or its `.trim()` calls | same | source |
| **AC4** — a fresh instance declares all four; `required` unchanged | `S6` `GOAL_SCHEMA` declares all twelve properties, the four typed as the concept declares them, `required` still exactly `['name','slug','description']`, `x-tapestry.unique` untouched, wrapper intact | same | source (structure-bounded + evaluated) |
| AC4 | `H10` the schema a fresh instance would provision declares the same four properties, with the same types, as the live concept does | same | integration (live) |
| AC4 (the chain's third link) | `S12` `ensureGoalConcept` is what provisions a fresh instance, and `GOAL_SCHEMA` is what it hands to save-schema | same | source |
| **AC5** — nothing acts on them at write time | `U9` nothing is coerced — a numeric string stays a string | same | unit |
| AC5 | `U6` `undefined` is the only omission test; a supplied `null` is stored | same | unit |
| AC5 | `S8` no clamp, coercion or range rule anywhere on the goal write path | same | source |
| AC5 (refusal trap) | `H6` a prompt supplied as `''` is a value — the write proceeds, `empty-value` never fires | same | integration (live) |
| AC5 (falsy trap) | `H7` an estimate of `0` is a value — the write proceeds and stores the number 0 | same | integration (live) |
| AC5 ("no rule decides which prompts may run") | `H8` an adversarial-looking prompt is stored unexamined, at capture **and** at update | same | integration (live) |

### Supporting tests (contract, scope, and must-not-break)

| Test | What it holds |
|---|---|
| `U1` / `U2` | the goals core exports `INTENT_FIELDS` + `pickIntentFields`, and `INTENT_FIELDS` is exactly the four declared names in order (ADR d1) |
| `U11` / `U12` | the picker is non-mutating and its key order is deterministic (ADR d2) |
| `S1` | the goals core stays dependency-free CommonJS — zero `require()` |
| `S7` | none of the **seven** record-replicating paths gains an intent-field whitelist (ADR d6 — adding one would *narrow* a path that currently carries everything) |
| `S9` / `S10` / `S11` | no new goal-write endpoint (Option D was rejected); the three owner gates; the local-only publish posture |
| `S13` | firmware carries no goal concept — so the ADR's "firmware reinstall required? No" holds |
| `S14` | the untouchables (`relationships.js`, `probe.js`, `middleware/auth.js`) stay free of the four |
| `R1` | the read side stays story 2's lane — `parseGoalRow` still projects exactly its ten fields |
| `R2` | the Direction core keeps its own local `chanceOfSuccess` read (operational-direction ADR 0001 d6) — this story makes it retirable, story 2 decides |
| `R3` | the write module gains no new brain-core import |

---

## Edge cases (explicit tests, not just the happy path)

- [x] **Absent vs. false.** A flag supplied `false` is stored as `false`; a flag not supplied is **absent from the record** — `hasOwnProperty`, never a truthiness check (`U7`, `H2`, `assertAbsent`).
- [x] **Falsy-but-supplied.** `chanceOfSuccess: 0`, `needsHumanInput: false`, `prompt: ''` all survive (`U7`, `H6`, `H7`). This is the single likeliest implementation bug: `if (input[f])` drops all three.
- [x] **`undefined` vs `null`.** `undefined` is omitted; a supplied `null` is stored (`U6`) — a `!= null` test would be a content-driven transform AC5 forbids.
- [x] **Empty subset.** A capture supplying none of the four still succeeds (`U5`, `H3`).
- [x] **The `empty-value` trap.** `{goal, prompt: ''}` must not be refused, and must satisfy the "at least one field" requirement (`H6`, `S4`, `S5`).
- [x] **Whitespace-significant prompt.** A multi-line markdown prompt with a blank first line, an indented fenced block with trailing spaces, a line of only spaces, and a closing newline (`U8`, `H4`).
- [x] **Adversarial content.** A prompt containing `DROP TABLE`, `rm -rf /` and `$(whoami)` is stored verbatim and refused by nothing (`H8`).
- [x] **Out-of-contract riders.** `promptVersion` on a fixture survives an intent update untouched (`H5`, `H9`).
- [x] **Keys outside the four.** `name`, `deliverable`, `team` supplied to the picker are never copied (`U10`).
- [x] **Nothing else moved.** A whole-brain before/after digest proves no real record was written, mutated, or swept away by teardown (`H11`).
- [ ] *Not tested — deliberately:* what happens to a **malformed** value end-to-end (an estimate above 100, a non-boolean flag). The story declares that undefined. See *Two boundaries* below.

---

## Test infrastructure

- **Framework:** Node's built-in runner via `npm test` (entry `test/test.js`). No new framework, no new dependency.
- **Concept Graph / control panel API:** `localhost:$TAPESTRY_PORT` (port per AGENTS.md §1; this machine: `7778`). H tests require **both** a host-side probe and a container-loopback probe to succeed. Writes go through **loopback** (`docker exec tapestry curl 127.0.0.1:…`) because the goal-write endpoints and `GET /api/brain/export` are owner-gated host-side and `localTrusted` on loopback.
- **TA pubkey:** resolved at runtime from `GET /api/assistant/pubkey`. Never hardcoded (house rule); used only to derive fixture d-tags for teardown.
- **Firmware state:** **no `POST /api/firmware/install` prerequisite.** The goal concept is runtime-created and has never been firmware-seeded (`S13` asserts this from the tree).
- **Graph-state prerequisites:**
  - The **goal concept must already exist** on the instance under test (it does here) — `H1`/`H2` capture through `note-goal-idea` / `create-child-goal`, which resolve the concept and do not provision it.
  - The **live goal schema node must declare the four** — `H10` asserts this first and fails loudly with "stop and re-check the graph" if the story's premise has moved.
  - No other prerequisite: the suite creates every record it reads.
- **Fixtures (H-class):** seven sentinel-named goals (`harness intent …` / `harness-intent-…`) plus the `noted` work records that `note-goal-idea` mints. Three are supplied as whole records through `create-element`; four are produced by the capture paths under test. **No real goal is written or mutated.**
- **Teardown:** pre-clean (best-effort) then teardown in `run()`'s `finally` — strfry delete by d-tag (deterministic names **plus** any element discovered by a value-scoped sentinel sweep, which catches the random-d-tag work records), then Neo4j element+tags, then an orphan-tag sweep scoped by d-tag / name / the `harness-intent-` json substring, then a strfry count-0 verification. Never scoped by `z` value — that is the goal header uuid, shared with every real goal. A teardown failure is a loud suite failure. Verified clean across two consecutive runs (`H11` passed on the second run, which proves the first run's teardown was complete).

### Running the live class on purpose

```bash
# the whole suite, on its own (~60s with the stack up)
node test/store-the-four-when-a-goal-is-captured-or-updated.test.js

# refuse to be green if the live class silently skipped (OPEN.md #104/#106)
TAPESTRY_REQUIRE_LIVE=1 node test/store-the-four-when-a-goal-is-captured-or-updated.test.js
```

---

## How to run

```
npm test
```

`npm test` takes roughly 24 minutes, so it must be backgrounded — and per **OPEN.md #103/#105** the
completion notification's exit code is not evidence. Tee it and read the log:

```bash
npm test > /tmp/npm-test.log 2>&1; EXIT=$?; echo "EXIT=$EXIT"
grep -E '^Overall:|^store-the-four' /tmp/npm-test.log
```

No Playwright tests in this story: the story builds no screen (`goal-intent-fields` #3 does).

---

## Designed around the recorded harness defects

| Defect | What this suite does about it |
|---|---|
| **#104 / #106** — a fully-skipped H-class still reports suite PASS; the probe is flaky | The probe **retries three times** at a 5s budget, so a skip means "no stack", not "busy container". `run()` prints `store-the-four: H-class <n> executed / <m> skipped` and shouts `!! LIVE COVERAGE DID NOT RUN` when the whole class skipped; the same counts are printed in `test.js`'s roll-up (`store-the-four H-class:`) and returned from `run()`. `TAPESTRY_REQUIRE_LIVE=1` turns an all-skipped H-class into a **suite failure**, so a gate can demand live execution without changing CI's stack-free job. |
| **#108** — vacuous iteration over a collection the feature does not yet produce | Every loop asserts **arity first**. U-class loops iterate `EXPECTED_FIELDS` — the *spec's* list — never the constant the implementation exports, so an absent/empty `INTENT_FIELDS` cannot make a loop pass by running zero bodies. `goalSection()` asserts *exactly one* matching export entry before reading it; `S7`'s inventory asserts it lists exactly seven paths. |
| **#109** — byte-offset source assertions fail on correct code and pass on broken code | **No fixed-width `src.slice` anywhere in this suite.** Function bodies are bounded by the next top-level declaration (`functionBody`, with whole-line comments blanked — a banner comment for the *next* section had already produced one false hit on `S11` during authoring); the `GOAL_SCHEMA` literal is brace-matched **and then evaluated**, so a mis-slice throws a parse error instead of matching nothing. |
| **#103 / #105** — background exit codes lie | The verification below is read from the **teed log's `Overall:` line and an explicitly echoed `EXIT=$?`**, never from a completion notification. |
| **#107** — ADR test-impact predictions are unreliable | The ADR's claim that every sibling source pin stays inside its window was **measured, not trusted** — see *Sibling pins*. |

---

## Two boundaries this plan holds, and why

**1. AC5 vs. "malformed values are undefined."** AC5 forbids rejecting or transforming a write
because of what the four *contain*; the story's Out of scope leaves a malformed value's fate
(estimate above 100, non-boolean flag) **undefined**. Both are honored by testing AC5 **only with
in-shape values** — `0`, `100`, `''`, a multi-line prompt, `true`/`false`, and prompt *content* that
merely looks dangerous. No test asserts what the endpoint does with an out-of-shape value.

The one place a wrong-typed value appears is `U9`, at the **picker** level, where it pins the ADR's
d2 decision ("no `Number()`/`Boolean()` coercion, no type check") — a design decision the Implementer
is bound to, not a story-level guarantee about endpoint behavior. The story's "undefined" therefore
stays undefined at the contract surface.

**2. `required` and OPEN.md row 102.** `S6` pins `required` in the constant a fresh instance
provisions. `H10` compares only the four *property declarations* against the live schema node and
**deliberately does not compare the live node's `required`** — row 102 concerns the already-signed
live schema, which this story neither fixes nor evidences.

---

## AC4 — how it is proved, and what is left over

Criterion 4 is the expensive one: it needs an instance where the goal concept does **not** yet
exist. `ensureGoalConcept` is a no-op wherever the concept exists, and the only path that reaches it
is restore-onto-a-fresh-target, so the end-to-end scenario is the scratch-instance drill
(`scripts/brain-drill.sh`, second-brain #8's precedent) — ~10 minutes and a second container per run,
which cannot live inside a suite that already takes 24 minutes.

The criterion is decomposed into three links, each checked:

1. **`S12`** — `ensureGoalConcept` is the provisioning path, and `GOAL_SCHEMA` is what it hands to
   `save-schema`. *(passes today; guards the chain)*
2. **`S6`** — that constant declares all four, additively, with `required` unmoved and the
   single-concept-object wrapper intact. *(fails today: it declares 8)*
3. **`H10`** — that constant declares the same four, with the same types, as the live concept does —
   so what a fresh instance provisions is not drifting from what this instance means by the four.
   *(fails today)*

**Residual gap, stated rather than hidden:** nothing in `npm test` executes `ensureGoalConcept`
against an instance that lacks the concept. Closing it end-to-end is one manual run, worth doing once
at Implementation or Review:

```bash
bash scripts/brain-drill.sh          # boots a scratch container, installs firmware, restores an export
# during the drill (before the scratch is torn down), from inside the scratch:
#   GET /api/concept-graph/node/39999:<scratch TA>:tapestry-owner-goal-schema
# expect: the inner properties declare prompt / chanceOfSuccess / needsHumanInput / needsBreakdown,
#         and the inner required is still exactly ["name","slug","description"].
```

The wrapper-shape assertion in `S6` is load-bearing for AC1 as well, and is worth reading twice: if
`GOAL_SCHEMA` were ever flattened, `handleCreateElement`'s no-json branch would start auto-populating
**type defaults** (`prompt: ''`, `chanceOfSuccess: 0`, both flags `false`) — present rather than
absent, which AC1 forbids. That is the Gate-1 aside the ADR checked and disproved; `S6` keeps it
disproved.

---

## Pass-by-design sentinels — 16 of 40

These pass **before** the Implementer touches anything and must **still** pass afterward. They are
listed here and in the suite's header so a green line is never mistaken for evidence the feature
landed: `S1`, `S4`, `S7`, `S8`, `S9`, `S10`, `S11`, `S12`, `S13`, `S14`, `H3`, `H9`, `H11`, `R1`,
`R2`, `R3`.

Two deserve a note:

- **`S4`** is the trap-guard for the ADR's "the one place the obvious implementation is wrong."
  Appending the four to `provided` is a one-line change that silently creates a validation rule the
  frame forbids. `S4` passes now and fails the moment that happens; the *discriminating* tests for
  the update path are `S5`, `H5`, `H6`, `H7`.
- **`H11`** is a safety property, not a feature check: it proves the suite's own writes and its
  teardown sweep never reach a real record.

The other **24 fail** until the feature lands.

---

## Sibling pins — measured, not trusted

The ADR states that every existing source pin stays inside its window after the additive growth.
That prediction was executed (OPEN.md #107). Measured headroom from each pin's anchor to its
furthest required token:

| Pin | Window | Furthest required token | Headroom |
|---|---|---|---|
| `break-a-goal-into-pieces.test.js` S3 (`handleCreateChildGoal`) | 8000 | +4133 | 3867 |
| `break-a-goal-into-pieces.test.js` S4 (`handleUpdateGoalIntent`) | 8000 | +4209 | 3791 |
| `sessions-read-the-brain.test.js` S2 (`handleNoteGoalIdea`) | **12000** | +2151 | 9849 |
| `the-brain-survives.test.js` S7 (`ensureGoalConcept`) | 4000 | +2369 | **1631** |

Three are comfortable. The fourth was not: the first literal `ensureGoalConcept` in the module is a
**comment four lines above the `GOAL_SCHEMA` constant**, so that 4000-char window *spans the constant
this story grows* — with ~1631 characters of headroom against roughly 700 characters of new property
declarations. That is precisely the row-109 failure mode (a pin that fails on correct code), so it
was re-aimed to the suite's own existing structure-bounded helper:

```js
// test/the-brain-survives.test.js:665
const ensure = fnBody(src, 'ensureGoalConcept');   // was: src.slice(indexOf(...), +4000)
```

Verified: the extracted body is 1047 characters and contains both required tokens, and it is now
immune to `GOAL_SCHEMA`'s size. This is a Phase-3 change by the ADR's own assignment ("including any
re-aim of the source pins named below"). *(Note for the record: the ADR describes those pins as
slicing 8000 characters; `sessions-read-the-brain.test.js` actually slices 12000. The ADR's figure is
the stricter one, so following it errs safe.)*

---

## Verification

The new tests fail with the current code. Confirmed 2026-07-26 at commit `e8e6cf4b`
(`story: link ADR 0001 from goal-intent-fields #1`), stack up, H-class **executed** (not skipped).

### `npm test` — the suite's block, verbatim

```
=== store-the-four-when-a-goal-is-captured-or-updated (goal-intent-fields #1) ===
  FAIL  U1 (ADR d1/d2): the goals core exports INTENT_FIELDS and pickIntentFields alongside everything it already exported
        src/lib/brain/goals.js does not export INTENT_FIELDS yet (ADR 0001 d1) — the four have no single home, so story 2 would have to re-declare them on the read side.
  FAIL  U2 (ADR d1): INTENT_FIELDS names exactly the four properties the concept declares, in the concept's own words
        INTENT_FIELDS must be an array of exactly 4 field names; got undefined.
  FAIL  U3 (AC1): each of the four supplied on its own is carried, and only it
        src/lib/brain/goals.js does not export pickIntentFields() yet — the shared intent picker (ADR 0001 d2) is not implemented, so nothing carries the four onto a goal section.
  FAIL  U4 (AC1): all four supplied are all four carried
        src/lib/brain/goals.js does not export pickIntentFields() yet — the shared intent picker (ADR 0001 d2) is not implemented, so nothing carries the four onto a goal section.
  FAIL  U5 (AC1 edge): none of the four supplied yields an empty result — a capture with none of them still has something to store
        src/lib/brain/goals.js does not export pickIntentFields() yet — the shared intent picker (ADR 0001 d2) is not implemented, so nothing carries the four onto a goal section.
  FAIL  U6 (ADR d2): `undefined` is the ONLY omission test — a supplied null is a supplied value and is kept
        src/lib/brain/goals.js does not export pickIntentFields() yet — the shared intent picker (ADR 0001 d2) is not implemented, so nothing carries the four onto a goal section.
  FAIL  U7 (AC1/AC5): falsy-but-supplied values survive — 0, false and the empty string are values, not absences
        src/lib/brain/goals.js does not export pickIntentFields() yet — the shared intent picker (ADR 0001 d2) is not implemented, so nothing carries the four onto a goal section.
  FAIL  U8 (AC3): a multi-line markdown prompt is copied byte-identical — nothing trims, re-wraps or normalizes it
        src/lib/brain/goals.js does not export pickIntentFields() yet — the shared intent picker (ADR 0001 d2) is not implemented, so nothing carries the four onto a goal section.
  FAIL  U9 (AC5): nothing is coerced — a numeric string stays a string, a number stays a number
        src/lib/brain/goals.js does not export pickIntentFields() yet — the shared intent picker (ADR 0001 d2) is not implemented, so nothing carries the four onto a goal section.
  FAIL  U10 (AC1): nothing outside the four is ever copied
        src/lib/brain/goals.js does not export pickIntentFields() yet — the shared intent picker (ADR 0001 d2) is not implemented, so nothing carries the four onto a goal section.
  FAIL  U11 (ADR d2): the picker does not mutate its input, and its result is a separate object
        src/lib/brain/goals.js does not export pickIntentFields() yet — the shared intent picker (ADR 0001 d2) is not implemented, so nothing carries the four onto a goal section.
  FAIL  U12 (ADR d2): the result's key order is deterministic — INTENT_FIELDS order, whatever order the caller supplied
        src/lib/brain/goals.js does not export pickIntentFields() yet — the shared intent picker (ADR 0001 d2) is not implemented, so nothing carries the four onto a goal section.
  PASS  S1 (sentinel — ADR constraint): the goals core stays dependency-free CommonJS — zero require() calls
  FAIL  S2 (ADR d3 / AC1): the root-capture path applies the picker at the handler — the trust boundary — and hands a whitelisted object to its core
        handleNoteGoalIdea must apply pickIntentFields to the request body (ADR d3) — today it builds its goal section from a fixed set of fields and drops all four silently.
  FAIL  S3 (ADR d3 / AC1): the child-capture path applies the picker at the handler too
        handleCreateChildGoal must apply pickIntentFields to the request body (ADR d3) — today its fixed-field section build drops all four.
  PASS  S4 (sentinel — ADR d4 / AC5): the four never enter update-goal-intent's empty-value refusal or its trim calls
  FAIL  S5 (ADR d4 / AC2): the update path computes the intent fields BEFORE its "at least one field" refusal, names all seven accepted fields, and merges them onto the section
        handleUpdateGoalIntent must apply pickIntentFields (ADR d4) — today `provided` is the only accepted set, so none of the four can be set on an existing goal.
  FAIL  S6 (ADR d5 / AC4): the schema a fresh instance provisions declares all four — additively, with `required` unmoved and the single-concept-object wrapper intact
        the provisioned concept must declare 12 properties — the 8 it already declares PLUS the four (ADR d5). It declares 8: ["name","slug","description","origin","capturedOn","deliverable","boundary","parent"].
  PASS  S7 (sentinel — ADR d6): none of the seven record-replicating paths gains an intent-field whitelist
  PASS  S8 (sentinel — AC5): no rule inspects what the four contain — no clamp, no coercion, no range check on the goal write path
  PASS  S9 (sentinel): the three goal-write routes are unchanged and no new goal-write endpoint appears
  PASS  S10 (sentinel): all three goal-write handlers keep their explicit owner gate
  PASS  S11 (sentinel): the goal writes stay local — publishToStrfry + importEventDirect only, never an outbound publish
  PASS  S12 (sentinel — ADR d5): ensureGoalConcept is what provisions a fresh instance, and GOAL_SCHEMA is what it hands to save-schema
  PASS  S13 (sentinel): the goal concept is runtime-created, never firmware-seeded — so no firmware reinstall is required
  PASS  S14 (sentinel): the untouchables stay untouched by the four
  FAIL  H1 (AC1): a root goal captured from a session with a prompt and an estimate stores exactly those two — and the two flags stay ABSENT
        'prompt' is missing from the stored record — the write path dropped it (supplied at capture through note-goal-idea). Section keys: ["name","slug","description","origin","capturedOn"].
  FAIL  H2 (AC1): a child goal captured while breaking a bigger one down stores the two flags it was given — including the one set FALSE — and the prompt and estimate stay ABSENT
        'needsHumanInput' is missing from the stored record — the write path dropped it (supplied at capture through create-child-goal). Section keys: ["name","slug","description","parent"].
  PASS  H3 (sentinel, AC1 edge): a capture with none of the four still succeeds, and stores none of them
  FAIL  H4 (AC3): the stored record has the shape the concept declares — a multi-line markdown prompt byte-identical, the estimate a number, each flag a boolean
        the prompt must be byte-identical after a full round-trip through signing, storage and export (AC3).
        want "\n# Session prompt\n\nRead the goal, then:\n\n1. orient with `GET /api/concept-graph/summaries`\n2. publish nothing outward\n\n```\n  indented   and   spaced  \n```\n   \n"
        got  undefined
  FAIL  H5 (AC2): updating one of the four leaves the other three, and everything else on the goal, exactly as it was
        update-goal-intent must accept a prompt-only update (got {"success":false,"error":"At least one of deliverable, boundary, parent is required"}).
  FAIL  H6 (AC5, the refusal trap): a prompt supplied as an empty string is a value — the write proceeds and stores it, and the empty-value refusal never fires
        supplying only one of the four must satisfy the "at least one field" requirement (ADR d4); got {"success":false,"error":"At least one of deliverable, boundary, parent is required"}.
  FAIL  H7 (AC5, the falsy trap): an estimate of 0 is a value — the write proceeds and stores the number 0
        an update supplying only chanceOfSuccess: 0 must succeed — 0 is the concept's own documented default, not an absence (got {"success":false,"error":"At least one of deliverable, boundary, parent is required"}).
  FAIL  H8 (AC5): nothing decides which prompts may run — an adversarial-looking prompt is stored unexamined, at capture and at update
        'prompt' is missing from the stored record — the write path dropped it (supplied at capture — stored, never inspected). Section keys: ["name","slug","description","parent"].
  PASS  H9 (sentinel, AC1): the path that stores a supplied record as given still carries all four — it must not regress
  FAIL  H10 (AC4): the schema a fresh instance would provision declares the same four properties, with the same types, as the live concept does
        GOAL_SCHEMA omits 'prompt', which the live concept declares — an instance that self-provisions would silently drop it, so the frame's "I can set" fails on a fresh or restored instance (AC4).
  PASS  H11 (AC2 safety): no record outside the harness fixtures was written, moved or touched by this suite
  PASS  R1 (scope): the read side is untouched — parseGoalRow still projects exactly its ten fields, and returning the four is story 2
  PASS  R2 (scope): the Direction core keeps its own local chanceOfSuccess read — retiring it is story 2's call, not this story's
  PASS  R3 (scope): the goal write module gains no new require of the brain cores beyond the goals core it already imports
store-the-four: H-class 11 executed / 0 skipped
store-the-four-when-a-goal-is-captured-or-updated: 16 passed, 24 failed, 0 skipped
```

*(strfry teardown chatter on stderr, interleaved by the tee, elided — the fixture deletes.)*

### The run-level verdict, read from the log and not from the notification

The background completion notification for this run reported **"exit code 0"**. It was wrong again
(OPEN.md #103/#105). The authoritative lines from the teed log:

```
relationship-primitives suite:                   FAIL (22 passed, 1 failed)
store-the-four suite:                            FAIL (16 passed, 24 failed)
store-the-four H-class:                          11 executed / 0 skipped
Total skipped:                                   51
Overall:                                         FAIL
EXIT=1
```

`Overall: FAIL` is expected and correct at this phase: **this suite is supposed to be red.** The only
other failing suite is `relationship-primitives` H8 — a pre-existing live flake, not caused by this
change: it ran at log line 2318, a thousand lines *before* this suite's first write, and it failed
because a global strfry scan count moved by exactly 1 during its own bracket ("If a concurrent
publisher (scheduled task / sync) is suspected, quiesce it and re-run" — its own message). The two
suites OPEN.md row 102 reports as failing live, `structures-the-brain-can-trust` and
`break-a-goal-into-pieces`, both **PASS** in this run (24/0 and 30/0).


### Why each failure is the right failure

| Failing tests | Reason |
|---|---|
| `U1`–`U12` (12) | `src/lib/brain/goals.js` exports neither `INTENT_FIELDS` nor `pickIntentFields` — the picker does not exist. Not an import error: the module loads, and `S1`/`R1` exercise it successfully in the same run. |
| `S2`, `S3`, `S5` | no goal-constructing write path applies a whitelist — the three handlers build their sections from a fixed set of fields. |
| `S6` | `GOAL_SCHEMA` declares **8** properties; a fresh instance would silently drop all four. |
| `H1`, `H2`, `H8` | the capture paths drop the four on the way in: the stored sections come back with `["name","slug","description","origin","capturedOn"]` / `["name","slug","description","parent"]`. |
| `H4` | the stored prompt is `undefined` — there is nothing to be byte-identical to. |
| `H5`, `H6`, `H7` | `update-goal-intent` answers `{"success":false,"error":"At least one of deliverable, boundary, parent is required"}` — the four are not in its accepted set at all. |
| `H10` | `GOAL_SCHEMA` omits `prompt` (and the other three), which the live concept declares. |

Reproduced identically on two consecutive standalone runs (16 passed / 24 failed / 0 skipped,
H-class 11 executed / 0 skipped both times), so the split is not probe flake.
