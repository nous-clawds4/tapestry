# Review: Story 1 — Operational direction (goal-derived run terms)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-07-26
**Diff:** `git diff origin/staging...HEAD` (impl `a0fb44f3`; HEAD `728df1d0`)
**Story:** `engineering-team/stories/operational-direction/1-operational-direction-mode.md`
**ADR:** `engineering-team/decisions/operational-direction/0001-operational-direction-mode.md`
**Test plan:** `engineering-team/stories/operational-direction/1-operational-direction-mode.test-plan.md`

> **Reviewer independence caveat, stated up front.** The same session authored this code. To compensate, every finding below is derived from an executed probe or a quoted line — not from recollection of intent. The blocking finding was found by *probing what the code does when a caller forgets something*, which is precisely the class of defect authorial memory hides.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **FAIL** (`Overall: FAIL`). Reviewer's own run; see § "Gate result" for the itemization and the pre-existing/caused split.
- [ ] `npm run test:playwright` — not applicable; this story ships no UI.
- [x] _Lint not configured — skipped._ (`scripts/harness-lint.sh` run separately: **clean, 0 violations**.)
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped._

## Spec adherence

| AC | Covered by | Verdict |
|---|---|---|
| **AC1** — two named modes; armed unweakened; row 41 disposed | `S6`, `S11`, `S15`, `S16` + `R1`, `R2`, `R6` | ✅ verified |
| **AC2** — terms transcribed; estimate present/absent; surrendered + unavailable stated | `U24`–`U28`, `S14`, `H5` | ✅ verified |
| **AC3** — anchor required; distance a policy parameter; v1=0 not special-cased | `U1`–`U13`, `U32`, `U33`, `S7`, `H3`, `H4` | ✅ verified |
| **AC4** — boundary narrows, never widens | `U17`–`U23`, `S9` | ⚠️ **partially** — see Blocking 1 |
| **AC5** — non-negotiables by reference, not copy | `S8`, `R3`, `R4` | ✅ verified |

- [x] Every acceptance criterion has a test.
- [ ] **No criterion is silently weakened.** AC4 is the exception — every boundary test injects a verdict, so the criterion is verified only on the path where a caller remembers to. See Blocking 1.
- [x] No behavior added that isn't in the story — except the disclosed `boundaryReview` addition (Blocking 2).

## ADR adherence

- [x] Files changed match the ADR's implementation notes (`direction.js`, `brain/index.js`, `director.md`, the skill, the book template, `CLAUDE.md`, `OPEN.md`, `CHANGELOG.md`).
- [x] Layering respected — the core is **genuinely zero-require** (verified: `S1` asserts it and the file has no `require(` at all).
- [x] No new dependencies — `git diff origin/staging...HEAD -- package.json package-lock.json` is **empty**.
- [ ] **The ADR's documented contract no longer matches the shipped one.** See Blocking 2.

## Concept-graph integrity

- [x] Handles in `kind:pubkey:slug` form; the story writes `39998:<TA>:…` with `<TA>` marked runtime-resolved — correct per CLAUDE.md's per-deployment rule. No literal TA pubkey anywhere in the diff (grepped for `[0-9a-f]{64}` — zero hits).
- [x] **No firmware reinstall required** — verified, not assumed: the diff contains no concept, schema, or property write. The only `save-schema`/`required`-shaped hits are a comment, an error string, a response field, and a doc reference.
- [x] New code orients via the Concept Graph API; the ADR records the `/summaries` orientation, and the core reads records rather than BIBLE.md.

## Things tests can't catch

- [x] No secrets in committed files (swept: `api_key`, `secret`, `password`, `nsec1`, 64-hex — zero hits).
- [x] No leftover debug logging. The single `console.error` in `handleGetDirection` is the house error-path idiom, matching `handleGetProposals`.
- [x] No commented-out code.
- [ ] **Error paths:** one fail-open on missing data — see Non-blocking 1.
- [x] Concurrency — N/A: the endpoint is read-only and takes no mutex. It correctly does **not** enter `serializeGoalWrite`, which is the write path's lock.
- [x] Security: `goalSlug` reaches only a JS string comparison (`direction.js:238`), never Cypher; the Cypher uses the `$headerUuid` parameter built from the runtime TA pubkey. No injection vector. Gate is the platform template `isOwner(req) || req.localTrusted → 403`, verified live (host-side call answers 403).

## House rules check

- [x] Concept Graph API authority respected.
- [x] No new lint/typecheck/build tooling.
- [x] `CLAUDE.md` at **190/190** — the doctrine change is a line-neutral rewrite of `:148`, as ADR d7 required. Budget honored, no cap edit.
- [x] `harness-lint.sh` clean (0 violations), including the L10 CHANGELOG touch-rule for the three harness-definition paths.

## Findings

### Blocking

1. **`src/lib/brain/direction.js:231`–`330` + `src/api/brain/index.js` (`handleGetDirection`) — the boundary invariant fails OPEN, and the endpoint never closes it.**

   `resolveAnchor` runs the boundary check **only if** the caller injects `boundaryVerdict`. `handleGetDirection` never does (verified: `grep -n boundaryVerdict src/api/brain/index.js` → no match). So a chain with unjudged widening steps returns eligible. Executed probe:

   ```
   no verdict fn supplied, distance 2 →
     eligible: true | refusal: null
     boundary steps that existed but were NEVER judged: 2
   ```

   **Why this is blocking and not cosmetic.** The ADR chose Option B over Option A on the explicit grounds that *"the safety precondition of an autonomous run would be enforced by an agent reading prose about itself."* As shipped, the **anchor** half is enforced in code and the **boundary** half is enforced in prose — `roles/director.md:38` says *"An unjudged step is never a pass,"* which is exactly the prose enforcement Option A was rejected for. The invariant is advisory in the one place it must not be.

   **Concrete failure scenario.** The owner performs the anticipated policy act and sets `BRAINSTORM_MAX_ANCHOR_DISTANCE=2` — which ADR d3 promises is a config change requiring *"no new machinery."* The endpoint now returns `eligible: true` for a three-goal chain whose boundaries were never compared. A Director keying on the `eligible` field runs a goal whose boundary **widens** its parent's. That is precisely the laundering path the owner ruled on: *"a distant anchor without boundary inheritance is a laundering path… shipping the anchor without the inheritance rule is worse than shipping neither."* d3's promise is therefore not kept: raising the parameter today silently disables half the guard.

   Inert at v1 (distance 0 ⇒ zero steps), which is why it escaped — but the whole design intent is that raising the parameter be safe *by construction*.

   **Asked change:** make it fail **closed** — when `boundarySteps(chain).length > 0` and no verdict function was supplied, refuse instead of returning eligible. Route the code choice through the Architect (below), since a new refusal code is a design decision.

2. **`engineering-team/decisions/operational-direction/0001-operational-direction-mode.md` § d6 — the ADR's documented response contract does not match the shipped one, and the `boundaryReview` design is unratified.**

   d6 documents:

   ```
   { success, eligible, anchor, terms, surrendered, unavailable, chain }
   ```

   The endpoint additionally returns `boundaryReview`, `maxAnchorDistance`, and `derivedAt`. The Implementer disclosed this rather than hiding it — good — but the ADR is the agreed contract, and a future Architect or Director reading d6 gets a wrong shape. For a governing document about **autonomous-run eligibility**, that is materially worse than ordinary doc drift.

   **Asked change:** the Architect amends the ADR — either ratify `boundaryReview` as a sub-decision (d10) with the fail-closed behavior from Blocking 1, or adopt the alternative the Implementer flagged (a distinct refusal code for unjudged steps) and record that instead. Reviewer does not ratify design.

3. **`test/operational-direction.test.js` — no test covers the failure mode in Blocking 1.**

   Every boundary test injects a verdict (`:474`, `:490`, `:503`, `:616`). Nothing asserts what happens when steps exist and nobody judged them — the one path that actually fails. A test asserting the fail-closed refusal must land with the fix, in the Tester's lane.

### Non-blocking

1. **`src/lib/brain/direction.js:148`–`154` — `isAnchorStale` fails open on unknowable data.** A `null` `createdAt` on either side returns `false` (not stale). Low reachability: both values come from `e.created_at`, present on every real event. But this is a safety guard, and the conservative default is to refuse when currency cannot be established. Worth a deliberate ruling on the next touch rather than a silent default.

2. **`src/api/brain/index.js` (`handleGetDirection`) — the chain is re-resolved by slug, not uuid.** The walk in `resolveAnchor` traverses `byUuid`, but the handler maps `outcome.chain` slugs back through `resolved.find(g => g.slug === slug)`. With a shadowed duplicate ancestor slug, `find` may return a different record than the one walked, so `boundaryReview.steps` could carry the wrong boundary text. `ambiguous-slug` guards only the *target*, not ancestors. Inert at v1 (chain length 1). Cheap fix when Blocking 1 is addressed: carry uuids in `chain`, or return the records from the core.

3. **Import-violation error strings across the eight brain suites are stale** — they enumerate seven modules while the allowlist has carried ten since `proposals`/`signals`/`export`, and now eleven. Pre-existing drift, correctly left alone by this story; the test plan already flags it. Worth an OPEN.md `meta` row at book close.

### Harness friction

1. **The harness reported "exit code 0" for THREE consecutive full-gate runs that were each actually `Overall: FAIL`** — including this reviewer's own run, whose true exit was `REVIEWER_GATE_EXIT=1`. The first was a detached `nohup … &` launcher (the tool captured the launcher's exit, not the suite's); the second and third were the background-tool wrapper reporting its own status. In every case the real verdict came only from an explicitly echoed `EXIT=$?`. **A Direction-mode run keying on the completion notification would have journaled a green gate that was red** — and Gate 4 is defined as "run the full suite yourself," which this defect silently satisfies with a false green. Mitigation until fixed: always tee the suite to a log and read `Overall:` / an explicit `EXIT=$?`, never the notification. → OPEN.md row, type `meta`.

2. **The stack probe is flaky.** `stackAvailable()` (2 s `fetch` + a `docker exec`) intermittently returned false with the stack demonstrably up, flipping six H-class tests between *executed* and *skipped* across consecutive runs of the same code. A skipped H-class run still reports suite PASS, so a Gate-3 "H executed" claim is not reproducible. → OPEN.md row, type `meta`.

## Gate result

Reviewer's own `npm test`, run independently of the Implementer's, recorded verbatim:

```
REVIEWER_GATE_EXIT=1
structures-the-brain-can-trust suite:            FAIL (23 passed, 1 failed)
break-a-goal-into-pieces suite:                  FAIL (29 passed, 1 failed)
operational-direction suite:                     PASS (61 passed, 0 failed)
Total skipped:                                   51
Overall:                                         FAIL
```

Two failures, both **pre-existing and not caused by this story** — provenance established by evidence, not assertion:

- `structures-the-brain-can-trust` **H4** and `break-a-goal-into-pieces` **H1**: the live goal-concept schema carries `required = ['name','slug','description','chanceOfSuccess']`, violating second-brain ADR 0003 d13.
- The offending schema node was signed **2026-07-25T21:07:47Z**; this story's first commit `bc804339` is **2026-07-26T02:36:05Z** — a **5 h 28 m** gap.
- This story's `src/` diff contains **zero** schema/firmware/concept writes, and its only change to those two suites is one widened import-allowlist regex.
- Tracked as **OPEN.md #102**; repair belongs to `store-and-show-the-prompt-and-the-estimate`.

I independently confirm the Implementer's split. Accepting a red gate on these two is correct; they are not this story's to fix, and fixing them here would be an unreviewed schema write the story explicitly forbade.

**The story's own suite passes 61/61**, and `the-brain-survives` — the one genuine regression this story caused — is repaired by the route re-pin in `02dc2bfa`, which correctly kept the exact-length check (verified: a hypothetical eighth route still trips it).

## Process notes (credit where the harness worked)

- The **failing-tests-first contract did its job**: `U23` was unsatisfiable by any correct implementation, and because the Implementer could not quietly weaken it, the defect surfaced in the phase that owned it. The fix changed the *fixture*, not the assertion, and was verified to retain its teeth.
- `git diff 02dc2bfa..HEAD -- test/` is **empty** — the implementation commit touched no test.
- Both post-Gate-3 test edits were separately committed with reasoning and are positive/fixture-only. I checked each for weakening and found none.

## Verdict — Round 1

**CHANGES_REQUESTED**

Three blocking items, one root cause. The design is sound, the anchor and staleness guards are well-built and genuinely testable, and the doc work is careful. But the boundary half of a *paired* invariant — one the owner explicitly said must not ship alone — is enforced by prose rather than by code, in a design that chose code enforcement on principle. At v1 it is inert; the moment the policy parameter is raised, which the ADR advertises as a safe config change, the guard silently half-disappears.

Route order: **Architect** ratifies the fail-closed shape (amending ADR d6 and adding the sub-decision) → **Tester** adds the unjudged-steps coverage → **Implementer** makes the core refuse. Non-blocking 1 and 2 are cheap to fold into the same touch.

### Round 1 disposition

All three round-1 blocking items are **verified closed** in Round 2 below.

---

# Round 2 — ADR 0002 (fail-closed boundary judgment)

**Date:** 2026-07-26
**Diff:** `git diff origin/staging...HEAD` (impl `a84bd51c`; Tester-lane fix `ea8bc058`)
**ADR:** `engineering-team/decisions/operational-direction/0002-fail-closed-boundary-judgment.md` (amends `0001`)

## Round-1 findings — verified closed, by probe

Each re-run rather than read.

| Round-1 finding | Probe | Result |
|---|---|---|
| **B1** boundary guard fails open | the exact failing call: distance 2, no verdicts | `eligible:false`, `refusal:'boundary-unjudged'` — **closed** |
| — length mismatch | `['narrows']` for 2 steps | `boundary-unjudged` — **closed** |
| — unrecognized token | `['narrows','yes']` | `boundary-unjudged` — **closed** |
| — judged widen still distinct | `['narrows','widens']` | `boundary-widened` — **closed** |
| — honest message | `/widen/i` on the unjudged error | absent — **closed** |
| **B2** ADR contract stale | ADR 0002 d6 rewrites the shape; `0001` carries the reciprocal `**Amended by:**` header | **closed** (but see R2-1) |
| **B3** no unjudged coverage | `U34`–`U37`, `U39` | **closed** |
| **NB1** staleness fails open | `isAnchorStale({createdAt:null}, …)` | `true` — **closed** (d12) |
| **NB2** chain re-resolved by slug | `chain[0].uuid` present; handler uses `outcome.steps` | **closed** (d13) |

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — see § "Gate result (round 2)". **`Overall: PASS`** — with a caveat that materially limits what it proves.
- [ ] `npm run test:playwright` — N/A, no UI.
- [x] `harness-lint.sh` — clean, 0 violations.
- [x] **Gate-4 mechanicals:** `git diff ea8bc058..HEAD -- test/` is **empty** (0 lines); core has **0** `require()` calls; `package.json`/`package-lock.json` diff is **empty**.

## Findings — Round 2

### Blocking

1. **`src/api/brain/index.js` (`handleGetDirection`, refusal envelope) — the documented two-call flow dead-ends: the refusal carries no `boundaryReview`.**

   Both governing documents instruct the Director to read `boundaryReview.steps` on a `boundary-unjudged` refusal:

   - `engineering-team/roles/director.md:38` — *"Then: (1) read `boundaryReview.steps`; (2) spawn one fresh blinded judge per step…"*
   - `.claude/skills/direct-feature/SKILL.md:46` — *"…re-ask with `?verdicts=<ordered,list>` in `boundaryReview.steps` order."*

   The refusal envelope has no such key. Simulated exactly from the handler's own object:

   ```
   What a Director actually receives on call 1:
     envelope keys  : success, eligible, refusal, error, detail, chain, maxAnchorDistance
     boundaryReview : undefined
     director.md says to read boundaryReview.steps → UNDEFINED — cannot judge
     steps are actually at detail.steps → [{"parentBoundary":"BOUNDARY-gp","childBoundary":"BOUNDARY-p"}, …]
   ```

   The data exists — at `detail.steps` — so this is **fail-safe, not fail-open**, and materially less severe than the round-1 finding. The guard still refuses correctly; nothing unjudged can run. But a Director following its role file finds `undefined` and cannot execute step 2, so **the mechanism this entire amendment exists to provide is unusable by the agent it was written for.** Improvising past a broken mechanism by reading the raw JSON is precisely the behavior this design rejects.

   **ADR 0002 contradicts itself here, which is how it slipped through.** d11 (line 75) says call 1 returns *"`eligible:false`, `refusal:'boundary-unjudged'`, plus `boundaryReview.steps`"*; d6's refusal shape (line 105) omits `boundaryReview` entirely. The implementation faithfully followed d6 and thereby broke d11.

   Inert at v1 (distance 0 ⇒ eligible directly). Broken the moment `BRAINSTORM_MAX_ANCHOR_DISTANCE` is raised — **the same trigger, and the same "inert now, wrong when raised" reasoning that made the round-1 finding blocking.** Passing this while having blocked that would apply a weaker standard to the fix than to the defect.

   **Asked change:** include `boundaryReview: { required, steps }` in the refusal envelope (one line), **or** correct both docs to say `detail.steps`. Either is fine; the ADR's d11/d6 contradiction must be resolved in the same touch so the contract has one answer.

### Non-blocking

1. **`src/api/brain/index.js` — `boundaryReview.required` is `true` on a *successful* judged response.** After call 2 succeeds, `required: steps.length > 0` is still `true`, meaning "there were steps," not "steps still need review." Nothing keys on it any more — both docs now key on the `boundary-unjudged` refusal — so it is misleading rather than harmful. Worth either renaming to `stepCount`/`judged` or computing it as "still outstanding."

2. **No test covers the call-1 → call-2 data handoff.** `S17` asserts the handler reads `req.query.verdicts`; `H7` asserts the parameter is inert at v1. Nothing asserts that call 1's refusal hands the Director what call 2 needs — which is exactly why Blocking 1 survived. A test pinning the refusal envelope's step payload belongs with the fix.

3. **Round-1 NB3 (stale import-violation error strings across the eight brain suites) is unchanged** — still pre-existing, still correctly untouched.

## Gate result (round 2)

**`Overall: PASS`.** The story suite: **70 passed, 0 failed, 8 skipped.**

**The green is weaker than it looks, and the Implementer flagged this rather than banking it.** The Docker daemon is down this session, so H-class everywhere skips: **371 skipped, against 51 when the stack was up.** Two consequences:

- **OPEN.md #102 is masked, not fixed.** The two pre-existing schema failures now read `SKIP`:
  ```
  SKIP  H4 (AC 3): the primary-property record agrees with the extended schema on the live instance
  SKIP  H1 (ADR d13): the goal schema declares optional deliverable, boundary, parent
  ```
  A green gate here is not evidence that defect is resolved — it is evidence the tests that catch it did not run.
- **The `?verdicts=` path has never been exercised over the wire.** `H1`–`H8` last ran green at `a0fb44f3`, which predates the parameter. Coverage of the new behavior is 33 executed U-class tests plus two source assertions — good, but no live call. Blocking 1 is precisely the class of defect an executed `H` test would have caught, which is corroboration, not coincidence.

## Process notes

- The Implementer **disclosed** the H-class gap and the masked #102 rather than reporting "gate green." That is the behavior the harness wants, and it is why this review could focus on the wire contract instead of re-deriving the gate's meaning.
- **The Tester-lane discipline held under pressure.** `U6`/`U7`/`U8` went red from a correct implementation; the fix supplied verdicts rather than relaxing assertions, landed in its own commit *before* the implementation, and left `git diff ea8bc058..HEAD -- test/` empty. I checked all three for weakening — `U6`'s proof is now strictly stronger than before.
- **ADR 0002's test-impact predictions were wrong twice** (`U32`, then `U6`/`U7`/`U8`), and Blocking 1 is a third mis-specification in the same document — its own d11 and d6 disagree. All three share a cause: the ADR described consequences by reading rather than by executing. → `meta` row at book close.

## Verdict — Round 2

**CHANGES_REQUESTED**

The blocking defect from round 1 is genuinely and thoroughly fixed — I re-ran the exact probe and every adjacent branch, and the guard now fails closed for every caller, with an honest refusal that does not claim a judgment nobody made. The staleness and chain-identity fixes are clean. The Tester-lane work was disciplined.

One blocking item remains, and it is the fix's own blind spot rather than a regression: the flow the amendment introduces cannot be executed as documented, because the refusal that triggers it withholds the data the Director is told to read. Fail-safe, one line to fix, and inert until the policy parameter is raised — but that is the identical circumstance under which I blocked round 1, and consistency requires the same answer.

Route: **Architect** resolves the d11/d6 contradiction (one shape, stated once) → **Tester** adds the call-1 payload assertion → **Implementer** aligns the envelope. Non-blocking 1 folds into the same touch.

### Round 2 disposition

The round-2 blocking item is **verified closed** in Round 3 below.

---

# Round 3 — ADR 0003 (one `boundaryReview` shape)

**Date:** 2026-07-26
**Diff:** `git diff origin/staging...HEAD` (impl `54875c07`; Tester-lane `b74d8fcd`)
**ADR:** `engineering-team/decisions/operational-direction/0003-one-boundary-review-shape.md` (amends `0002`)

## Round-2 finding — verified closed by walking the whole flow

Not "the key is present" — the actual two-call sequence, envelope assembly reproduced from the handler:

```
call 1 refusal      : boundary-unjudged
boundaryReview.steps: [{"parentBoundary":"B-gp","childBoundary":"B-p"},{"parentBoundary":"B-p","childBoundary":"B-c"}]
required            : true
call 2 eligible     : true
required after judge: false          ← d15
steps still present : 2
```

A Director following `roles/director.md:38` verbatim can now read `boundaryReview.steps`, judge each blind, and re-ask. **The flow executes.**

Corroborating checks:

| claim | probe | result |
|---|---|---|
| d14 symmetry across *all* refusals | `goal-not-found`, `no-anchor-in-range`, `anchor-stale` | each carries `steps: []`, `required: false` — no caller branch needed |
| d15 `required` semantics | eligible-after-judging | `false` — the round-2 NB1 wart is gone |
| d16 one address | `detail.steps` | absent; `stepCount`/`verdictsSupplied` retained |
| blinding on refusal path | step keys | `childBoundary,parentBoundary` only |
| `blindSteps` coverage | all three return paths | `:417`, `:424`, `:437` — one projection, no per-path re-derivation |

## The Tester's `S21` repair — independently verified, not taken on trust

`S21` is *the* guard for the round-2 defect, and the Tester rewrote its extraction mid-round. A guard that was silently disarmed would be worse than no guard, so I re-ran it **using the suite's own `functionBody()` and `resJsonBlocks()`** (`eval`'d out of the test file — not a reimplementation that might differ):

```
S21 vs handler WITH round-2 defect : {"refusalOk":false,"successOk":true}
S21 vs shipped handler             : {"refusalOk":true, "successOk":true}
```

It fails on the defect it names and passes on the shipped code. **The teeth are real.** The Tester's own account of the two defects in that assertion — failing on correct code at a 3200-byte window, *and* passing on broken code through a bleeding ±400 window that missed by 520 characters of luck — matches what I reproduced.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **`Overall: PASS`**, `REVIEWER_EXIT=0`. Story suite **76 passed, 0 failed, 10 skipped**. Matches the Implementer's report exactly.
- [ ] `npm run test:playwright` — N/A, no UI.
- [x] `harness-lint.sh` — clean, 0 violations.
- [x] **Gate-4 mechanicals:** `git diff b74d8fcd..HEAD -- test/` **empty**; core at **0** `require()`; `package.json`/`package-lock.json` diff **empty**.
- [x] Secrets/debug sweep on the round-3 diff — clean.

## Spec adherence

| AC | Covered by | Verdict |
|---|---|---|
| **AC1** | `S6`, `S11`, `S15`, `S16`, `R1`, `R2`, `R6` | ✅ |
| **AC2** | `U24`–`U28`, `S14`, `H5` | ✅ |
| **AC3** | `U1`–`U13`, `U32`, `U33`, `S7`, `H3`, `H4` | ✅ |
| **AC4** | `U17`–`U23`, `U34`–`U40`, `U45`–`U48`, `S9`, `S21` | ✅ — **now fully satisfied.** Round 1 marked this partial; the guard fails closed *and* the flow it requires is executable. |
| **AC5** | `S8`, `R3`, `R4` | ✅ |

## Findings — Round 3

### Blocking

**None.**

### Non-blocking

1. **`src/api/brain/index.js` (`handleGetDirection`, empty-slug guard) — one envelope still escapes d14's symmetric shape.** The early return for a blank slug emits `{success, eligible, refusal, error}` with **no `boundaryReview` and no `maxAnchorDistance`**, so a caller reading `boundaryReview.steps` unconditionally — exactly what `director.md:38` instructs — would throw on `undefined`. Reachable: `GET /api/brain/direction/%20` trims to `''`.

   **Deliberately not blocking, and the reasoning matters for consistency.** Rounds 1 and 2 were blocked because their triggers were *anticipated legitimate acts* — raising `BRAINSTORM_MAX_ANCHOR_DISTANCE`, which ADR 0001 d3 advertises as safe. This trigger is a malformed URL no documented caller constructs (a Director builds the path from the book's goal slug), and the outcome is fail-safe: a refusal either way, nothing runs. Blocking it would be pedantry, not skepticism. Fold into the next touch: give the guard the same `boundaryReview: {required:false, steps:[]}` and `maxAnchorDistance`.

2. **`H9` cannot catch finding 1** — it exercises one well-formed slug. The envelope-shape claim deserves a degenerate-input case whenever finding 1 is fixed.

3. **`resJsonBlocks()` brace-matching is string-naive.** It counts `{`/`}` without skipping string or template literals, so a `res.json` literal containing a brace inside a string would miscount. No such literal exists today. Worth a comment or a guard before this extractor is reused elsewhere.

4. **`S9`'s 4000-char markdown window** — the same byte-offset class the Tester eliminated for JS, still present for the `director.md` section slice, which grew this story. Correctly scoped out; belongs in the `meta` row.

### Harness friction

Carried forward, unchanged: the **"exit code 0" misreporting** on background gate runs (two occurrences, both actually `Overall: FAIL`); the **flaky stack probe** flipping H-class between executed and skipped. Both still want `meta` rows.

New: **ADR-authored test-impact predictions were wrong twice and self-contradictory once across this story** (`0002`'s `U32` call, `0002`'s `U6`/`U7`/`U8` omission, `0002`'s d11-vs-d6 conflict). ADR 0003 responded by marking its own prediction untrustworthy and telling the Tester to run the suite — which the Tester did, and it held. That is a good pattern worth generalizing: **an ADR should state test impact as a hypothesis to execute, not as a fact.**

## Gate result (round 3) — and what it does not prove

**`Overall: PASS`, `REVIEWER_EXIT=0`.** Same structural caveat as round 2, and it has not improved:

- **373 skipped**, against **51** with the stack up. Docker's daemon is down this session.
- **OPEN.md #102 remains masked, not fixed** — its two tests still `SKIP`.
- **`H1`–`H10` have never executed against this code.** The `?verdicts=` parameter and the new symmetric envelope have **never been exercised over the wire.** Coverage is 37 executed U-class tests plus structure-bounded source assertions — strong, and strictly better than round 2 — but not a live call.

**Consequence for the deploy chain, stated as a precondition rather than a worry:** `/cycle-local` brings the stack up, so `H1`–`H10` will execute there. **They must be green before staging.** A PASS on this diff is not a substitute for that run, and two of this story's three blocking findings were the class an executed H-test would have caught first.

## Verdict — Round 3

**PASS**

The round-2 blocking finding is closed, verified by executing the whole two-call sequence rather than by confirming a key exists. Every acceptance criterion is now satisfied and tested, AC4 included — which round 1 could only mark partial. The design that emerged over three rounds is materially better than what round 1 proposed: a paired invariant enforced in code for both halves, one address for the steps, refusals that assert only what they established, and `required` that answers the question actually asked of it.

Two things earn this PASS beyond the diff itself. The Tester caught and fixed a guard that was **passing on broken code**, and disclosed it rather than banking the green — I reproduced that independently with the suite's own extractors. And the Implementer twice declined to fold Tester-lane repairs into implementation commits, keeping `git diff <gate-3>..HEAD -- test/` empty both times, so the failing-tests-first contract held under three rounds of pressure.

Four non-blocking items remain, all cheap, none load-bearing. The real outstanding risk is environmental, not in the diff: **the wire contract is unverified, and the deploy chain must run H-class green before staging.**

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection run — **no book exists.** `engineering-team/audits/operational-direction/` was never opened; it was flagged at Planning and the operator elected not to open one. There is therefore no acceptance frame to compute or judge completion against, and **no `/close-book` offer is made.** Recorded here because a future `/close-book` will want an anchor and will find none — the operator may want to open one retroactively before the epic retires.
