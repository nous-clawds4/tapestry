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

## Verdict

**CHANGES_REQUESTED**

Three blocking items, one root cause. The design is sound, the anchor and staleness guards are well-built and genuinely testable, and the doc work is careful. But the boundary half of a *paired* invariant — one the owner explicitly said must not ship alone — is enforced by prose rather than by code, in a design that chose code enforcement on principle. At v1 it is inert; the moment the policy parameter is raised, which the ADR advertises as a safe config change, the guard silently half-disappears.

Route order: **Architect** ratifies the fail-closed shape (amending ADR d6 and adding the sub-decision) → **Tester** adds the unjudged-steps coverage → **Implementer** makes the core refuse. Non-blocking 1 and 2 are cheap to fold into the same touch.

## On PASS (same commit)

Not applicable — verdict is CHANGES_REQUESTED. The story `**Status:**` stays `Approved`; completion detection is not run.
