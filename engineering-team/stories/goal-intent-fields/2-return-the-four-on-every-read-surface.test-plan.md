# Test Plan: Story 2 — Return the four on every read surface that shows a goal

**Story:** `engineering-team/stories/goal-intent-fields/2-return-the-four-on-every-read-surface.md`
**ADR:** `engineering-team/decisions/goal-intent-fields/0002-read-side-intent-projection-absence-as-null.md`
**Book:** `engineering-team/audits/store-and-show-the-prompt-and-the-estimate/book.md`
**Date:** 2026-07-26

**Test file (new):** `test/return-the-four-on-every-read-surface.test.js` — 54 tests.
**Test file (re-aimed pin):** `test/store-the-four-when-a-goal-is-captured-or-updated.test.js` — **R1 only**.
**Runner wiring:** `test/test.js` — require, `run()`, roll-up line, H-class line, `overallOk`, skip census.

---

## The one thing this suite exists to pin

A property that was never set comes back as **`null`** — *reported*, never *manufactured*. Not `0`,
not `false`, not an empty prompt. The suite tests the **discrimination** directly and repeatedly: a
goal storing `needsHumanInput: false` **explicitly** and a goal that never set it must come back
distinguishable, on the cores (U3), on a single list response (D3), on the Direction transcription
(U15), and over the live wire (H2).

Three separate things depend on it, and each has its own test:

| What depends on it | Pinned by |
|---|---|
| `operational-direction` **U25** — an absent estimate is `null` + `estimateSource: 'absent'`, *"never invented"* (a **closed book, live in production**) | **R1** in the new suite restates the contract so this suite cannot go green while U25 is broken; **U14**, **D12** and **H5** exercise it through the read path |
| Story 1's shipped write path — "unset" is **key-absence**, the only representation that survives export and restore | **R3** (the write-side picker is untouched), **D15**/**H6** (the export still omits the key) |
| Restore is **destructive** if defaults are materialized — `mintRestoredGoal` stores the artifact's section verbatim, so an invented `chanceOfSuccess: 0` is written back permanently on the next backup cycle | **D15** and **H6**, whose failure messages state exactly this |

### The live corpus, read live (not quoted from the ADR)

`GET /api/brain/export` from inside the container, **2026-07-26**, 31 goals:

| | live count |
|---|---|
| carry `prompt` | **1** — and it is multi-line markdown (6 155 chars) |
| carry `chanceOfSuccess` | **7** (values 15, 25, 50, 65, 75×2, 80) |
| carry `needsHumanInput` | **8** — **5 store `false` explicitly**, 3 store `true` |
| carry `needsBreakdown` | **7** — **all 7 store `false` explicitly** |
| store at least one explicit `false` | **7 goals** |
| carry **none** of the four | **23 of 31** |
| carry a **partial subset** of the four | **7** |
| carry **all four** | **1** |
| **owner-ratified** (an `approved` proposal fact names them) | **1** — `store-and-show-the-prompt-and-the-estimate` |

**Delta against the ADR, recorded rather than smoothed over:** ADR 0002 says *"needsHumanInput — 8,
and **6** of them store `false` explicitly."* The live read gives **5** (8 carry it; 5 `false`, 3
`true`) — matching the independent live read at Gate 2. The ADR's figure is stale by one. **Nothing
load-bearing moves:** the ADR's two conclusions ("never-set is the majority case", "a stored `false`
already exists alongside never-set") hold with more margin than it claimed, because `needsBreakdown`
adds **7** more explicit `false`s the ADR's argument never counted. The suite hard-codes none of
these numbers — **H1** re-derives the census at run time, prints it, and fails loudly if the corpus
ever stops supporting the discrimination.

The one ratified goal is the strongest live specimen there is: on the **same record** it stores
`needsHumanInput: false` and `needsBreakdown: false` explicitly and has **never set** `prompt`. So
the Direction transcription for it must answer `false`, `false`, `null` — a fabricated default
collides with a real stored value in both directions. **H5** asserts exactly that.

---

## Test classes

| Class | Runs | What it is |
|---|---|---|
| **U** (17) | always, stack-free | The pure cores over synthetic input: `parseGoalRow`, `projectIntentFields`, `deriveTerms`. |
| **D** (18) | always, stack-free | **The five projecting surfaces driven for real, dependency-injected.** The genuine handlers from `src/api/brain/index.js` are loaded with `runCypher` / `getOwnerAssistantPubkey` / `isOwner` stubbed and answered from a synthetic goal corpus. The export (a verbatim surface) is driven too. |
| **S** (8) | always, stack-free | Structure-bounded source assertions for what a response cannot show: core purity, the require allow-list, the blinding contract, the verbatim class, and AC4's "nothing acts on them". |
| **H** (8) | live stack, per-test SKIP | The real wire over the **real corpus**. **Read-only and fixture-free.** |
| **R** (3) | always, stack-free | Regression sentinels that pass before *and* after. |

**Why a D-class.** The recorded harness defects say a fully-skipped H-class still reports suite PASS
(OPEN.md #104/#106) and that byte-offset source assertions both fail on correct code and pass on
broken code (#109). Between them, "the surface returns the four" would otherwise rest on a live class
that may not run and a grep that may lie. The D-class removes both failure modes: it reads the actual
response object from the actual handler, and it runs in CI with no stack.

**Why the H-class writes nothing.** Story 1's H-class wrote sentinel-named fixture goals with
pre-clean and raw teardown. This story needs no writes: the D-class already supplies deterministic
all-four / none-set coverage, so writing into the definitive local-first graph (CLAUDE.md principle
4, BIBLE §30) would be risk with no coverage to show for it. The H-class reads 31 real goals instead
of 2 fixtures — strictly more discriminating and strictly safer. **No goal is created, mutated or
deleted by this suite.**

---

## Coverage map

Every acceptance criterion maps to at least one **executed** test in a class that runs without a
stack, plus live confirmation.

### AC1 — All four, on each surface

| Where | Test | File | Level |
|---|---|---|---|
| the parsed record carries them | `U1` a parsed goal record carries all four properties it stores | new suite | unit |
| verbatim copying | `U4` a stored value is copied verbatim — 0, false, an empty string, a non-numeric estimate and an out-of-range estimate all come back as themselves | new suite | unit |
| the record shape | `U6` the goal record projects exactly fourteen fields — the ten it had, plus the four appended after the parent | new suite | unit |
| the projector's shape/order | `U7` the intent projection returns all four keys, in the concept's own order, for a goal that has them | new suite | unit |
| **the goals list** | `D1` the goals list returns all four for a goal that stores them | new suite | surface (DI) |
| **a single goal's detail** | `D4` a single goal's detail returns all four | new suite | surface (DI) |
| **the session orientation read** | `D6` the session orientation read returns all four on the goal it serves | new suite | surface (DI) |
| **the proposal queue** | `D8` the proposal queue returns the nominated goal's four | new suite | surface (DI) |
| **the Direction transcription** | `D11` the Direction transcription returns the prompt and the two flags, with the estimate under this surface's own word | new suite | surface (DI) |
| **verbatim surface (export)** | `D14` the export still carries all four exactly as stored | new suite | surface (DI) |
| live, whole corpus | `H2` every live goal reads back on the goals list exactly as the export stores it | new suite | integration (live) |
| live, detail + orient | `H4` a live goal reads back with its four on the goal detail and on the orientation read | new suite | integration (live) |
| live, Direction | `H5` the live Direction transcription carries the three by name and keeps the estimate under its own word | new suite | integration (live) |
| the goal shape sentinel | `R1` parseGoalRow projects exactly its fourteen fields | **story 1's suite (re-aimed)** | unit |

### AC2 — The prompt comes back whole

| Where | Test | File | Level |
|---|---|---|---|
| the core | `U5` a multi-line markdown prompt comes back byte-identical — not trimmed, reflowed or re-escaped | new suite | unit |
| **the list-type surfaces** | `D5` the full multi-line prompt travels on the LIST surface, byte-identical — not truncated and not replaced by a presence indicator (also asserts detail + orient) | new suite | surface (DI) |
| the Direction surface | `D11` (prompt byte-identical in `terms`) | new suite | surface (DI) |
| live | `H3` every prompt stored in the live corpus comes back byte-identical on the goals list | new suite | integration (live) |

The fixture prompt is built to break anything that normalizes it: a blank first line, an indented
fenced block with trailing spaces *inside* it, a trailing line of spaces, and a closing newline.

### AC3 — Nothing is invented for a property that was never set

| Where | Test | File | Level |
|---|---|---|---|
| never-set ⇒ not-set, and none of the three forbidden substitutes | `U2` a property that was never set is reported as not-set — never as 0, false or an empty prompt | new suite | unit |
| **the discrimination** | `U3` a goal storing a flag as false and a goal that never set it come back different | new suite | unit |
| stable response shape | `U8` the intent projection still returns all four keys, each not-set, for a goal that set none | new suite | unit |
| falsy-but-stored survive | `U9` the intent projection copies a stored 0, false and empty string through as themselves | new suite | unit |
| tolerance | `U11` the intent projection tolerates a missing or empty record without throwing | new suite | unit |
| Direction's shipped contract | `U14` the Direction transcription reports never-set terms as not-set, and still records an absent estimate as absent | new suite | unit |
| the discrimination, on Direction | `U15` a stored false and a never-set flag transcribe differently | new suite | unit |
| the goal is **returned, not omitted** | `D2` the goals list returns a goal that never set any of the four — present, error-free, and reported as not set | new suite | surface (DI) |
| **the discrimination, one response** | `D3` on one list read, a stored false and a never-set flag are distinguishable | new suite | surface (DI) |
| **"preserved exactly" #1 — Direction** | `D12` the Direction transcription still records an absent or unusable estimate as absent, while the list returns the stored value verbatim | new suite | surface (DI) |
| **"preserved exactly" #2 — the export omits the key** | `D15` the export OMITS the key entirely for a property that was never set | new suite | surface (DI) |
| the majority case end to end | `D18` a corpus in which no goal ever set any of the four answers on every surface without error | new suite | surface (DI) |
| live | `H2`, `H4`, `H5`, `H6` the live export still omits the key for every never-set property | new suite | integration (live) |
| the closed book's pin | `R1` an absent estimate is still recorded as absent, never invented | new suite | unit |
| the write side's convention | `R3` the write side is untouched — the write-side picker still expresses absence as key-absence | new suite | unit |

### AC4 — Nothing acts on them

| Where | Test | File | Level |
|---|---|---|---|
| **the differential** — strip the four, nothing moves | `D16` which goals each surface returns, and in what order, does not depend on the four (list set+order, orient goalCount+roots, proposal order) | new suite | surface (DI) |
| no ranking by estimate | `D17` a goal with a high estimate does not outrank one with a low estimate | new suite | surface (DI) |
| no rule reads them | `S6` no sort, filter, cap, gate, tie-break or refusal reads any of the four (11 bounded regions across `goals.js`, `proposals.js`, `direction.js`) | new suite | source |
| nothing filtered, live | `H7` the live goals list still returns every goal the export holds | new suite | integration (live) |
| the shapes that must **not** gain them (ADR d6) | `D7` roots + ancestry, `D9` passed-over runners-up, `D13` the chain and the blinded boundary steps, `S5` `blindSteps`/`identify` closed to goal content | new suite | surface (DI) / source |
| the Direction workaround is not retired here | `S8`, and story 1's `R2` | new suite / story 1 | source |
| the verbatim class is not narrowed | `S7` the export core still emits the stored section as stored | new suite | source |
| purity that forces the literal naming | `S1` goals core dependency-free, `S3` Direction core dependency-free | new suite | source |
| no new module in the read path | `S4` the brain read module gains no new import | new suite | source |
| the projector is exported | `S2` the goals core exports the read-side projector alongside the write-side picker | new suite | unit |
| roots stays bounded | `R2` the orientation read's roots slice is still the bounded `{slug, name, standing}` projection | new suite | surface (DI) |

---

## Edge cases (explicit tests, not just the happy path)

- [x] **A stored `0` estimate** — a supplied value, not an absence: `U4`, `U9`, `D1`, `D11` (`estimate: 0` with `estimateSource: 'goal'`).
- [x] **A stored `false` flag** — the lossiness trap: `U3`, `U9`, `U15`, `D3`, `H2`.
- [x] **A stored empty-string prompt** — distinct from a never-set one: `U4`, `U9`, `D3` (`''` vs `null`).
- [x] **A non-numeric stored estimate** (`'lots'`) — comes back verbatim on the four flat surfaces, and still reads as *absent* on the Direction surface, whose type-checked read is byte-unchanged: `U4`, `D12`.
- [x] **An out-of-range estimate** (`150`) and a **numeric string** (`'75'`) — no clamp, no coercion: `U4`.
- [x] **A non-boolean flag** (`'yes'`) — no `Boolean()` coercion: `U4`.
- [x] **A partial subset** (one of four set) — real on 7 live goals: `U3`, `D3`, `D15`, `H2`.
- [x] **A goal with none of the four** — the majority case (23 of 31 live): `U2`, `U8`, `D2`, `D18`, `H2`.
- [x] **A whole corpus with none of the four** — every surface answers without error: `D18`.
- [x] **A multi-line markdown prompt with trailing whitespace and a fenced block**: `U5`, `D5`, `H3`.
- [x] **`null` / `undefined` / `{}` into the projector** — read paths are tolerant: `U11`.
- [x] **Resolver annotations must not leak** (`parentUnresolved`, `slugShadowed`, `cycleOf`) — the ADR's rejected Option C: `U12`.
- [x] **A two-goal ancestry chain with an unjudged boundary step** — proves the blinding contract on the *refusal* envelope: `D13`.
- [x] **An empty live proposal queue** — `H8` says so rather than passing vacuously.
- [x] **Concept Graph API unavailable** — every H test SKIPs individually, the roll-up prints `H-class n executed / m skipped`, an all-skipped H-class shouts, and `TAPESTRY_REQUIRE_LIVE=1` turns it into a suite failure. The D-class still drives all five surfaces.

### Anti-vacuity discipline (OPEN.md #108)

Every loop asserts **arity first**. The live conformance sweep (`H2`) counts the comparisons it
actually made and fails if that count is zero, *and* fails unless it exercised **both** sides
(at least one stored value and at least one never-set property). `H5` counts the eligible goals it
checked. `H6` counts the omissions it observed. `H1` is a census that fails if the corpus stops
carrying the evidence the other live tests discriminate on. Every U-class loop iterates the **spec's**
field list (`EXPECTED_FIELDS`, declared in the test file), never the constant the implementation
exports — a loop over an absent export would run zero bodies.

### Structure-bounded source extraction (OPEN.md #109)

No `src.slice` byte window anywhere. Function bodies are bounded by the **next top-level
declaration** and stripped of whole-line comments; a region that cannot be located fails loudly
(`needBody`) instead of matching nothing.

---

## Test infrastructure

- **Framework:** Node's built-in runner via `npm test` (entry `test/test.js`). **No new frameworks.**
  No Playwright — screens are `goal-intent-fields` #3 and are not tested here.
- **Concept Graph / brain API:** `localhost:$TAPESTRY_PORT`. Port discovered per AGENTS.md §1 —
  `/etc/brainstorm.conf` is not on the host (the stack is in Docker), so the value comes from
  `bin/control-panel.js`'s default: **7778**, confirmed against the running `tapestry` container.
  H-class reads go **through the container** (`docker exec tapestry curl 127.0.0.1:7778`) because
  host-side brain reads are 403 by design (they are the remote caller class).
- **TA pubkey:** never hardcoded. The D-class uses a synthetic pubkey for its synthetic corpus; the
  H-class never needs one (it reads slugs, not handles).
- **Firmware state:** **no `POST /api/firmware/install` required.** No concept is added and none is
  redefined — the live schema node already declares all four, and the goal concept is
  runtime-created, never firmware-seeded (ADR 0002, "Firmware reinstall required? **No**").
- **Fixtures:** **none written.** The D-class corpus is in-memory; the H-class is read-only.

### Prerequisites

| Prerequisite | Needed by | If unmet |
|---|---|---|
| Story 1 on the branch (`INTENT_FIELDS`, `pickIntentFields` exported from `src/lib/brain/goals.js`) | `U17`, `R3`, and the whole implementation | suite fails loudly — it is a dependency, not an option |
| `tapestry` container up, control panel answering on loopback, Neo4j reachable | H-class only | each H test SKIPs; roll-up says `H-class 0 executed / 8 skipped` and shouts; `TAPESTRY_REQUIRE_LIVE=1` escalates to a suite failure |
| Live corpus contains ≥1 goal storing a flag explicitly `false`, ≥1 goal that never set any of the four, ≥1 multi-line prompt, ≥1 owner-ratified goal | `H2`–`H6` | `H1` fails with a message naming exactly which evidence disappeared and noting that the D-class still covers the criterion deterministically |
| **No** graph state is created — no `create-element`, no `note-goal-idea`, no proposal write | — | n/a |

### How to run

```
npm test                                   # the whole suite
node test/return-the-four-on-every-read-surface.test.js   # this story's suite alone
TAPESTRY_REQUIRE_LIVE=1 npm test           # make an all-skipped H-class a failure
```

Read the **`Overall:`** line and the echoed exit code. Background-command exit codes are a recorded
liar in this repo (OPEN.md #103/#105, six times in this run), and the row's own suggested mitigation
(`EXIT=${PIPESTATUS[0]}` under `| tee`) is **bash** — this shell is **zsh**, where it evaporates
silently. Use the brace form:

```
{ npm test; echo "EXIT=$?"; } > /tmp/full.log 2>&1
```

---

## The pin that was re-aimed

`test/store-the-four-when-a-goal-is-captured-or-updated.test.js` **R1** was the single exact-key
sentinel over a goal shape in that whole suite, and it **named this story as its re-pin**. The goal
shape grows from ten fields to fourteen, so R1 now pins fourteen — **the four appended after
`parent`, in the concept's own order** (ADR 0002 d1).

It was **re-aimed, not weakened**: it is still an exact-key, exact-order sentinel over
`Object.keys()`, it keeps its sibling assertion that the existing ten-field projection is still
correct, and it **gained** an assertion that the four are projected verbatim from the stored section.
The suite's header docstring was updated in the same two places that describe R1, so the file does
not lie about which of its tests pass by design. **Nothing else in that suite was touched.**

**Consequence to state loudly:** `store-the-four` now reports **1 failure** (R1) until the
Implementer extends `parseGoalRow`. That is not a story-1 regression — it is story 2's acceptance
pin living in the file the ADR put it in.

---

## Pass-by-design sentinels

**24 of the 54** new tests **pass before the Implementer touches anything** and must **still pass
after**. They are listed in the test file's header too, so a green line is never mistaken for
evidence the feature landed:

`U16 U17` (the Direction surface's own word for the estimate; the shared list of the four) ·
`D7 D9 D10 D13` (the shapes that must **not** gain the four — ADR d6 — and the closed book's no-score
rule) · `D14 D15 D16 D17` (the verbatim class and "nothing acts on them") · `S1 S3 S4 S5 S6 S7 S8`
(purity, require surface, blinding, AC4, the export) · `H1 H6 H7 H8` (the census, export omission,
the unfiltered set, no score key) · `R1 R2 R3`.

The other **30 fail** until the feature lands — which is exactly the `24 passed, 30 failed` in the
verification output below.

---

## Verification

The new tests fail with the current code, and they fail because the feature is missing — not from a
typo, a missing import, or a mis-sliced source window. Confirmed **2026-07-26** on branch
`feat/operational-direction` at commit `a7409ae9`, with the stack **up** (H-class **8 executed / 0
skipped**).

### The new suite, run alone

```
{ node test/return-the-four-on-every-read-surface.test.js; echo "EXIT=$?"; }
```

```
=== return-the-four-on-every-read-surface (goal-intent-fields #2) ===

(the 24 PASS lines are elided here — they are the pass-by-design sentinels listed above)

  FAIL  U1 (AC1): a parsed goal record carries all four properties it stores
        the parsed goal record must carry the key 'prompt'. All four come back on every surface that shows a goal (the frame's success criterion); a missing key is not "not set", it is not answered. Got keys ["uuid","name","slug","statement","origin","capturedOn","createdAt","deliverable","boundary","parent"].
  FAIL  U2 (AC3): a property that was never set is reported as not-set — never as 0, false or an empty prompt
        the parsed record of a goal that never set any of the four must carry the key 'prompt'. All four come back on every surface that shows a goal (the frame's success criterion); a missing key is not "not set", it is not answered. Got keys ["uuid","name","slug","statement","origin","capturedOn","createdAt","deliverable","boundary","parent"].
  FAIL  U3 (AC3, the discrimination): a goal storing a flag as false and a goal that never set it come back different
        a stored false is a value the owner supplied and must survive the read; got undefined.
  FAIL  U4 (AC1): a stored value is copied verbatim — 0, false, an empty string, a non-numeric estimate and an out-of-range estimate all come back as themselves
        the parsed record of a goal with malformed stored values must carry the key 'prompt'. All four come back on every surface that shows a goal (the frame's success criterion); a missing key is not "not set", it is not answered. Got keys ["uuid","name","slug","statement","origin","capturedOn","createdAt","deliverable","boundary","parent"].
  FAIL  U5 (AC2): a multi-line markdown prompt comes back byte-identical — not trimmed, reflowed or re-escaped
        the prompt must be byte-identical to what was stored. Difference: stored "\n# Session prompt\n\nRead the goal, then:\n\n1. orient with `GET /api/concept-graph/summaries`\n2. publish nothing outward\n\n```\n  indented   and   spaced  \n```\n   \n" vs read undefined
  FAIL  U6 (AC1): the goal record projects exactly fourteen fields — the ten it had, plus the four appended after the parent
        the record must project exactly 14 fields (ADR 0002 d1). Got 10: ["uuid","name","slug","statement","origin","capturedOn","createdAt","deliverable","boundary","parent"].
  FAIL  U7 (AC1): the intent projection returns all four keys, in the concept's own order, for a goal that has them
        src/lib/brain/goals.js does not export projectIntentFields() yet — the read-side projector (ADR 0002 d2) is not implemented, so no surface can carry the four with a stable four-key shape.
  FAIL  U8 (AC3): the intent projection still returns all four keys, each not-set, for a goal that set none
        src/lib/brain/goals.js does not export projectIntentFields() yet — the read-side projector (ADR 0002 d2) is not implemented, so no surface can carry the four with a stable four-key shape.
  FAIL  U9 (AC1/AC3): the intent projection copies a stored 0, false and empty string through as themselves
        src/lib/brain/goals.js does not export projectIntentFields() yet — the read-side projector (ADR 0002 d2) is not implemented, so no surface can carry the four with a stable four-key shape.
  FAIL  U10: the intent projection is pure — it returns a new object and mutates nothing
        src/lib/brain/goals.js does not export projectIntentFields() yet — the read-side projector (ADR 0002 d2) is not implemented, so no surface can carry the four with a stable four-key shape.
  FAIL  U11: the intent projection tolerates a missing or empty record without throwing
        src/lib/brain/goals.js does not export projectIntentFields() yet — the read-side projector (ADR 0002 d2) is not implemented, so no surface can carry the four with a stable four-key shape.
  FAIL  U12: the intent projection emits only the four — no other record field leaks into a response
        src/lib/brain/goals.js does not export projectIntentFields() yet — the read-side projector (ADR 0002 d2) is not implemented, so no surface can carry the four with a stable four-key shape.
  FAIL  U13 (AC1): the Direction transcription carries the prompt and the two flags off the goal
        the Direction transcription must carry 'prompt' (ADR 0002 d5). Got keys ["ask","successCriteria","ceiling","estimate","estimateSource"].
  FAIL  U14 (AC3): the Direction transcription reports never-set terms as not-set, and still records an absent estimate as absent
        'prompt' was never set on this goal, so the transcription must report null; got undefined.
  FAIL  U15 (AC3, the discrimination on the Direction surface): a stored false and a never-set flag transcribe differently
        a stored false must transcribe as false; got undefined.
  FAIL  D1 (AC1): the goals list returns all four for a goal that stores them
        the goals list row must carry the key 'prompt'. All four come back on every surface that shows a goal (the frame's success criterion); a missing key is not "not set", it is not answered. Got keys ["uuid","name","slug","statement","origin","capturedOn","createdAt","standing","captureDate","deliverable","boundary","parent","parentUuid","hasChildren","pointerCount"].
  FAIL  D2 (AC3): the goals list returns a goal that never set any of the four — present, error-free, and reported as not set
        the goals list row of a goal that never set any of the four must carry the key 'prompt'. All four come back on every surface that shows a goal (the frame's success criterion); a missing key is not "not set", it is not answered. Got keys ["uuid","name","slug","statement","origin","capturedOn","createdAt","standing","captureDate","deliverable","boundary","parent","parentUuid","hasChildren","pointerCount"].
  FAIL  D3 (AC3, the discrimination): on one list read, a stored false and a never-set flag are distinguishable
        a goal that stored the flag as false and a goal that never set it must read differently on the SAME response: expected false vs null; got undefined vs undefined.
  FAIL  D4 (AC1/AC3): a single goal's detail returns all four — stored values on a goal that has them, not-set on one that does not
        the goal detail must carry the key 'prompt'. All four come back on every surface that shows a goal (the frame's success criterion); a missing key is not "not set", it is not answered. Got keys ["uuid","name","slug","statement","origin","capturedOn","createdAt","standing","captureDate","deliverable","boundary","parent","parentUuid","parentSlug","parentName","hasChildren","pointerCount"].
  FAIL  D5 (AC2): the full multi-line prompt travels on the LIST surface, byte-identical — not truncated and not replaced by a presence indicator
        the list row must carry the prompt as a string, not a flag or a length; got undefined.
  FAIL  D6 (AC1/AC3): the session orientation read returns all four on the goal it serves
        the orientation read's served goal must carry the key 'prompt'. All four come back on every surface that shows a goal (the frame's success criterion); a missing key is not "not set", it is not answered. Got keys ["slug","name","statement","standing","captureDate","deliverable","boundary","parentSlug","parentName","ancestry"].
  FAIL  D8 (AC1): the proposal queue returns the nominated goal's four
        the proposal queue card must carry the key 'prompt'. All four come back on every surface that shows a goal (the frame's success criterion); a missing key is not "not set", it is not answered. Got keys ["proposalId","goal","goalName","whyNow","passedOver","madeOn"].
  FAIL  D11 (AC1): the Direction transcription returns the prompt and the two flags, with the estimate under this surface's own word
        the transcription must carry the prompt byte-identical; got undefined.
  FAIL  D12 (AC3, preserved exactly): the Direction transcription still records an absent or unusable estimate as absent, while the list returns the stored value verbatim
        ...while the goals list returns the stored value verbatim, because AC1 asks for "the stored values" and this story adds no type rule on read. Got undefined.
  FAIL  D18 (AC3, the majority case): a corpus in which no goal ever set any of the four answers on every surface without error
        the list row for 'four-parent' must carry the key 'prompt'. All four come back on every surface that shows a goal (the frame's success criterion); a missing key is not "not set", it is not answered. Got keys ["uuid","name","slug","statement","origin","capturedOn","createdAt","standing","captureDate","deliverable","boundary","parent","parentUuid","hasChildren","pointerCount"].
  FAIL  S2: the goals core exports the read-side projector alongside the write-side picker
        src/lib/brain/goals.js must export projectIntentFields (ADR 0002 d2) — the four surfaces spread it.
  FAIL  H2 (AC1/AC3): every live goal reads back on the goals list exactly as the export stores it
        the live goals list row for 'hand-work-to-the-engineering-team-without-arming-a-book' must carry the key 'prompt'. All four come back on every surface that shows a goal (the frame's success criterion); a missing key is not "not set", it is not answered. Got keys ["uuid","name","slug","statement","origin","capturedOn","createdAt","standing","captureDate","deliverable","boundary","parent","parentUuid","hasChildren","pointerCount"].
  FAIL  H3 (AC2): every prompt stored in the live corpus comes back byte-identical on the goals list
        'hand-work-to-the-engineering-team-without-arming-a-book': the prompt must be byte-identical on the LIST surface — not truncated, reflowed, re-escaped or replaced by a presence indicator. Stored 6155 chars, list returned undefined.
  FAIL  H4 (AC1/AC3): a live goal reads back with its four on the goal detail and on the orientation read
        the live goal detail for 'add-a-concept-to-a-tapestry' must carry the key 'prompt'. All four come back on every surface that shows a goal (the frame's success criterion); a missing key is not "not set", it is not answered. Got keys ["uuid","name","slug","statement","origin","capturedOn","createdAt","standing","captureDate","deliverable","boundary","parent","parentUuid","parentSlug","parentName","hasChildren","pointerCount"].
  FAIL  H5 (AC1/AC3): the live Direction transcription carries the three by name and keeps the estimate under its own word
        the live transcription for 'store-and-show-the-prompt-and-the-estimate' must carry 'prompt'; got keys ["ask","successCriteria","ceiling","estimate","estimateSource"].

      live corpus census: {"total":31,"storedFalse":7,"neverSetAnything":23,"multiLinePrompt":1,"partialSubset":7,"ratified":1}

return-the-four: H-class 8 executed / 0 skipped

return-the-four-on-every-read-surface: 24 passed, 30 failed, 0 skipped
EXIT=1
```

### The full suite

```
{ npm test; echo "EXIT=$?"; } > /tmp/full.log 2>&1
```

```
# store-the-four — the ONE failure is the re-aimed R1:
  FAIL  R1 (scope): parseGoalRow projects exactly its fourteen fields — the ten it had, plus the four appended after the parent
        parseGoalRow must project exactly 14 fields — the ten it projected for story 1 plus the four this story's sibling (goal-intent-fields #2, ADR 0002 d1) appends after `parent`. Got 10: ["uuid","name","slug","statement","origin","capturedOn","createdAt","deliverable","boundary","parent"].

# the roll-up:
store-the-four suite:                            FAIL (39 passed, 1 failed)
store-the-four H-class:                          11 executed / 0 skipped
return-the-four suite:                           FAIL (24 passed, 30 failed)
return-the-four H-class:                         8 executed / 0 skipped

# every suite the ADR named as "must stay green":
harness-lint suite:                              PASS (32 passed, 0 failed)
harness-stats suite:                             PASS (8 passed, 0 failed)
stack-free-npm-test suite:                       PASS (7 passed, 0 failed)
capture-a-goal-and-see-it suite:                 PASS (27 passed, 0 failed)
structures-the-brain-can-trust suite:            PASS (24 passed, 0 failed)
break-a-goal-into-pieces suite:                  PASS (30 passed, 0 failed)
attach-the-world suite:                          PASS (29 passed, 0 failed)
sessions-read-the-brain suite:                   PASS (30 passed, 0 failed)
the-proposal-loop suite:                         PASS (33 passed, 0 failed)
teach-it-what-matters suite:                     PASS (27 passed, 0 failed)
the-brain-survives suite:                        PASS (31 passed, 0 failed)
operational-direction suite:                     PASS (86 passed, 0 failed)

# the only other failing suite — PRE-EXISTING and environmental. It ran at log
# line 2366, ~1000 lines BEFORE either goal-intent suite started, and this
# story writes nothing to strfry:
relationship-primitives-probe suite:             FAIL (8 passed, 1 failed)
  FAIL  H4 (AC-4): repeated probes write NOTHING to strfry — scan counts bracket equal around three identically-answered GETs
        probing must write NO event to strfry (AC-4): scan count went 6015423 -> 6015426. If a concurrent publisher (scheduled task / sync) is suspected, quiesce it and re-run.

# the verdict — read from the Overall line and the ECHOED exit code, never the
# background notification, which reported "exit code 0" for this very run:
Total skipped:                                   51
Overall:                                         FAIL
EXIT=1
```
