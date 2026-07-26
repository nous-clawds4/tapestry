# Build Audit: Operational Direction

**Book:** `engineering-team/audits/operational-direction/book.md`
**Date:** 2026-07-26
**Branch / commit range:** `d218de89..911b8855` (feature branch `feat/operational-direction`; staging PR #469 `ae0d86c7`; promotion PR #470 `911b8855`)
**Provenance:** Acceptance-frame — anchor **transcribed verbatim** from the owner goal `hand-work-to-the-engineering-team-without-arming-a-book`, not reconstructed from git
**Confidence:** **high on intent fidelity, medium on completion.** Two separate judgments, deliberately not averaged into one number — see §0.

## 0. Two confidences, and why they differ

**Intent fidelity — high.** The anchor is an owner-authored goal that predates every commit in this book. Its `deliverable` and `boundary` were read at session start and again at close and are **byte-identical** (`termsMatch → {match: true, changed: []}`). The frame was written from those two fields, deliberately *before* consulting the diff. This is not the low-confidence reconstruction `workflows/6-book-close.md` step 1 assigns to anchor-less books, and the reason is recorded rather than assumed.

**Completion — medium, and the gap is the honest part.** The book manifest was written **after** production deploy. It gated nothing: three review rounds, two `CHANGES_REQUESTED` verdicts, and the story's `Done` flip all happened without this file existing. More materially, **the delivered capability has never been exercised** — zero operational Direction runs have occurred, and this book's own goal is *ineligible* under the rules it shipped (§4 D5). What is verified is that the machinery exists, is reachable, and refuses correctly. What is unverified is that a run *works end to end*.

## 1. What shipped

- **A second Direction-mode on-ramp — "operational direction"** — where a run's terms are *derived* from an owner-ratified goal (`deliverable → success criteria`, `boundary → ceiling`, `statement → the ask`, `chanceOfSuccess → the estimate`) instead of hand-authored per run. The existing armed mode is untouched. — `stories/operational-direction/1-operational-direction-mode.md`
- **A read-only eligibility gate, `GET /api/brain/direction/:slug`** — owner/loopback-gated, mutation-free, answering whether a given goal may be run and on what terms. — ADR `0001` d1
- **Three safety guards enforced in code, not prose**, each failing closed and naming what it refused: an **owner-ratified anchor** (nearest ancestor named by an `approved` proposal fact); **ratification staleness** (a goal re-signed after its approval carries a ratification nobody granted); and the **boundary-narrowing invariant** (a sub-goal narrows its parent's boundary, never widens it). — ADR `0001` d2/d4/d5, `0002` d10/d12
- **A two-call blinded boundary-judgment flow** — call 1 refuses `boundary-unjudged` and returns the steps carrying *only* the two boundary strings; the Director judges each blind and journals the verdicts; call 2 re-asks with `?verdicts=`. — ADR `0002` d11, `0003` d14
- **Governing text naming two modes** — `roles/director.md`, the `direct-feature` skill, and the book template each state which on-ramp to use when, with the ceiling, stopping rules, judge protocol, and journal applying **by reference, never restated**. — ADR `0001` d7
- **A goal-derived book section** — `## Direction mode (operational) — goal-derived`, generated (hand-editing it is a defect), carrying verbatim provenance, and halting on any drift between the goal's live terms and the recorded text. — ADR `0001` d9.1–d9.3

## 2. Epics & stories rolled up

### Epic: `operational-direction`

| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 `operational-direction-mode` | The whole book: derived terms, the eligibility read + pure core, the three guards, the two-call flow, and the governing-doc changes | **Done** | `reviews/operational-direction/1-operational-direction-mode.md` (3 rounds) |

**ADRs:** `0001-operational-direction-mode` (d1–d9.3) · `0002-fail-closed-boundary-judgment` (d10–d13, amends 0001) · `0003-one-boundary-review-shape` (d14–d16, amends 0002).

**Review history — unusual and worth stating:** three rounds, verdicts `CHANGES_REQUESTED → CHANGES_REQUESTED → PASS`. Against a project baseline of a **1% kick-back rate across 142 decided reviews** (`scripts/harness-stats.sh`, run at retro), this book ran ~67%. Disposition in §7.

## 3. As-built inventory

**User-facing (operator surface):**
- `GET /api/brain/direction/:slug` — read-only; gated `isOwner(req) || req.localTrusted → 403`. Optional `?verdicts=<ordered,list>` (`narrows`/`widens`, one per boundary step). Answers **403 to unauthenticated callers even for nonexistent slugs** — the gate fires before slug resolution, so no existence information leaks.
- No UI. No screen, route, or component changed.

**Domain:**
- **No concept, schema, or property changed. No firmware reinstall required or performed.** Verified against the diff, not assumed.
- Concepts *read*, never redefined: `39998:<TA>:tapestry-owner-goal`, `39998:<TA>:tapestry-proposal` (`<TA>` resolved at runtime — no literal pubkey anywhere in the diff).

**Data & contracts:**
- **Response envelope** (both outcomes carry the same `boundaryReview` shape, so callers never branch): `{success, eligible, anchor{slug,distance,proposalId,approvedOn}, terms{ask,successCriteria,ceiling,estimate,estimateSource}, surrendered[], unavailable[], chain[{slug,uuid}], maxAnchorDistance, boundaryReview{required,steps[{parentBoundary,childBoundary}]}, derivedAt}`. Refusals swap `anchor`/`terms` for `refusal`/`error`/`detail`, HTTP 200 (the brain refusal idiom).
- **Seven refusal codes, exhaustive:** `goal-not-found`, `ambiguous-slug`, `no-anchor-in-range`, `chain-broken`, `anchor-stale`, `boundary-widened`, `boundary-unjudged`.
- **Policy parameter:** `BRAINSTORM_MAX_ANCHOR_DISTANCE`, default **0**, returned in every response so a run's artifacts record which value was in force.

**Code:**
- `src/lib/brain/direction.js` — **new**, 455 lines, **zero `require()`** (the ninth in the `goals.js`/`proposals.js` dependency-free family).
- `src/api/brain/index.js` — +124 lines: the handler, the `readGoalRowsAndResolved` helper, route registration. **Runtime diff is purely additive: 2 files, +579, 0 deletions.**

**Harness / docs:** `roles/director.md` (+34), `.claude/skills/direct-feature/SKILL.md` (+7), `templates/book.md` (+35), `CLAUDE.md` (doctrine line rewritten **in place, net 0 lines** — the 190 cap holds), `engineering-team/CHANGELOG.md` (2 rows), `OPEN.md` (#41 → DONE, #102 new).

**Tests:** `test/operational-direction.test.js` — **new, 86 tests** (37 U · 22 S · 10 H · 6 R, plus the ADR 0002/0003 additions); runner registration wired into `overallOk`; **eight** sibling brain suites re-pinned for the ninth import; `the-brain-survives` route pin re-pinned 6 → 7.

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | *"can be handed to the engineering team without anyone hand-writing a pre-registration"* | Handing requires an **owner-ratified anchor** — an `approved` proposal fact on the goal or a near ancestor — plus a boundary-narrowing check. Neither is mentioned in the deliverable. | **added-beyond-scope** | Story Background: *"Deriving goalposts from a goal record is only safe if the record is the owner's."* Sessions can author goals (`createChildGoal`, second-brain #3); the owner's goal `make-sure-only-prompts-i-wrote-can-run` names the hazard. The pair ships together because *"a distant anchor without boundary inheritance is a laundering path."* | A goal can be **refused** for reasons its own text doesn't predict. Handing off is cheaper than arming, but not unconditional. | Owner must run `make-proposal` + `approve-proposal` per goal — see D5 |
| 2 | *"the terms come from the goal itself"* (goal `description`) | `chanceOfSuccess` is read from the **raw record**, not the goals API, which drops it. `dependsOn` does not exist at all. Both returned as `UNAVAILABLE` data with named dependencies. | **constraint-discovered** | ADR `0001` d6 + story Out of scope. *"named as dependencies rather than left silently missing."* | The estimate is transcribed but invisible through the normal read surface; prerequisites cannot be derived at all. | `store-and-show-the-prompt-and-the-estimate` |
| 3 | *"without anyone hand-writing a pre-registration"* | An operational book still gets a `## Direction mode (operational) — goal-derived` **section** — generated, not hand-written, with hand-editing declared a defect. | **interpretation** | Reserved for the owner by the brief and **ratified at the Architecture gate** (story Open Q #2, 2026-07-25) under three owner conditions: generated-artifact warning in its own body; verbatim provenance; halt-and-re-derive on mismatch. ADR `0001` d9.1–d9.3. | Arming becomes **transcription rather than authorship** — the cost the goal targeted is removed without losing the audit trail. | — |
| 4 | *"this check is exercised over a multi-goal chain — so raising the parameter later requires no new machinery"* (AC4) | The boundary machinery exists and is fully unit-tested, but at v1 (`maxAnchorDistance = 0`) the chain is one goal, so **zero steps are ever produced in production**. | **deferred** | ADR `0001` d3: distance is an owner **policy parameter** (PRD §7.5/§7.6), v1 = 0, never special-cased. ADR `0002` d10 exists specifically to make raising it safe. | None today. The guard is inert until the owner raises the parameter — which is exactly when it starts mattering. | Raising `BRAINSTORM_MAX_ANCHOR_DISTANCE` is a future owner policy act |
| 5 | *"A goal … can be handed to the engineering team"* | **The capability has never been exercised.** Zero operational runs. And **this book's own goal is ineligible under the rules it shipped** — it carries no `approved` proposal fact, so the endpoint answers `no-anchor-in-range`, verified live on local, staging, **and production**. | **constraint-discovered** | Anchor requirement (D1) applied to the goal that motivated it. Nothing in the brief asked for the goal to be pre-ratified. | The deliverable is **enabled, not demonstrated.** No goal in the graph is currently handable. | **An owner `make-proposal` + `approve-proposal` on some goal is the next act that makes this real** |
| 6 | — (nothing in the anchor) | `OPEN.md` #102 filed: the live goal-concept schema carries `required = [name, slug, description, chanceOfSuccess]`, violating second-brain ADR 0003 d13. | **added-beyond-scope** *(discovery, not build)* | Surfaced by this book's own gate. Provenance established: the schema node was signed **5h28m before** this book's first commit, and the diff contains zero schema writes. | ~25 live goals lacking `chanceOfSuccess` are schema-invalid **on the local instance**. Staging/prod status **unknown** — the reads are gated. | `store-and-show-the-prompt-and-the-estimate`; probe staging/prod |

**Undocumented work:** none. Every file in the 25-file diff traces to the story, one of the three ADRs, or an ADR-declared test obligation. The eight sibling-suite re-pins and the `the-brain-survives` route re-pin are covered by ADR `0001`/`0003` Consequences; the two `CHANGELOG` rows by the lint L10 touch-rule; `OPEN.md` #41/#102 by their own commits.

## 5. Quality state at close

- **Test gate at close:** see §5.1 below (recorded verbatim from the run made during this close).
- **Story suite:** 86 passed, 0 failed, **0 skipped** — all 10 H-class tests executed against a live stack.
- **Production verification:** deploy run [30210120336](https://github.com/nous-clawds4/tapestry/actions/runs/30210120336) green in 1m20s; Tier 1 stable at attempt 3; the new route answers **403 not 404** (deployment proof for a gated endpoint); Tier 5 regression all 200.
- **Known open issues:**
  - **`OPEN.md` #102** — pre-existing goal-schema drift; **not fixed, not caused here.** Live locally; **unknown on staging and production.**
  - Four non-blocking review items (round 3): the empty-slug guard escapes the symmetric envelope shape; `H9` can't catch it; `resJsonBlocks()` is string-naive; `S9`'s byte-offset markdown window survives.
- **Debt logged by ADRs:**
  - **The trust model is unchanged and unimproved** (`0002` d11, restated in `0003`). A Director can pass `narrows` without spawning a judge, exactly as it could rubber-stamp any gate. The `?verdicts=` parameter is **not** a trust boundary and the ADRs refuse to pretend otherwise; the controls remain the blinded judge, the journal, and operator audit. Closing it would need a judge-verdict record the harness does not have.
  - Reproducibility surrendered by design in operational mode (baseline commit + pinned governing versions), retained in armed mode.

### 5.1 Gate at close

Run during this close, with the stack up. **Recorded as it came out — the gate is RED.**

```
structures-the-brain-can-trust suite:            FAIL (23 passed, 1 failed)
break-a-goal-into-pieces suite:                  FAIL (29 passed, 1 failed)
operational-direction suite:                     PASS (86 passed, 0 failed)
Total skipped:                                   41
Overall:                                         FAIL
REAL_EXIT=1
```

**Both failures are `OPEN.md` #102 and neither belongs to this book.** Identical assertion in each: *"required must stay exactly [name, slug, description] … got ["name","slug","description","chanceOfSuccess"]"* — the live goal-concept schema, violating second-brain ADR 0003 d13. Provenance was established during the book rather than assumed: the offending schema node was signed **2026-07-25T21:07:47Z**, and this book's first commit (`bc804339`) is **2026-07-26T02:36:05Z** — a **5h28m** gap. The book's diff contains **zero** schema, firmware, or concept writes, and touched those two suites only by widening an import allowlist.

**This book's own suite is 86/0/0 with all H-class executed.** Closing a book on a red repo gate is recorded deliberately rather than waved through: the red is a pre-existing instance-data defect with a ledger row and an owner (`store-and-show-the-prompt-and-the-estimate`), and it blocked neither the staging nor the production deploy, both of which were verified independently.

**A caution for whoever reads this next:** an earlier close-adjacent run reported `Overall: PASS` **only because the Docker daemon was down**, which pushed skips from 51 to 371 and turned both of these failures into `SKIP`. A green gate on this repo is not evidence #102 is fixed unless the skip count is low. At this close it is 41.

## 6. Carry-forward register

- [ ] **Ratify a goal so the mode can actually be used** — `make-proposal` + `approve-proposal` on a target goal; without it no goal is handable (§4 D5). **This is the single act standing between "built" and "usable."**
- [ ] **`store-and-show-the-prompt-and-the-estimate`** — makes `chanceOfSuccess`/`prompt` readable through the goals API, and owns the `OPEN.md` #102 schema repair (§4 D2, D6).
- [ ] **Probe staging and production for the #102 schema drift** — status unknown on both; the reads are gated.
- [ ] **`task-timeline` pre-arming refresh** — `audits/task-timeline/book.md` is pre-registered but `Armed: No`; its Direction-mode section needs a refresh before arming now that a second mode exists (precedent: relationship-primitives' *"Pre-arming refresh, operator-ratified"*). Flagged by the story, deliberately not performed.
- [ ] **`make-sure-only-prompts-i-wrote-can-run`** — the named upstream dependency on prompt authorship; neither implemented nor weakened here.
- [ ] **Raising `BRAINSTORM_MAX_ANCHOR_DISTANCE` above 0** — a future owner policy act (PRD §7.6). ADR `0002` makes it *safe*; it does not perform it.
- [ ] **Live verification of the eligible path** — every live test to date exercises refusals, because no goal is ratified. The `eligible: true` branch is unit-tested only.
- [ ] **Four non-blocking review items** (§5) — all cheap, none load-bearing.
- [ ] **Six pending goalpost-class amendments** to the same two doc files (`OPEN.md` rows 57, 63, 64, 74, 76, 92) — each awaits its own ratification; deliberately fenced out of this book.

## 7. Process findings (harness)

Retro run on measurement, not anecdote: `scripts/harness-stats.sh` at close reports **739 phase commits · 142 reviews decided · 1% kick-back rate · 25 books closed**.

| Finding | Source | Terminal state |
|---|---|---|
| **Background-gate exit codes were reported as 0 on runs that were actually `Overall: FAIL`** — twice. Once a detached `nohup … &` launcher (captured the launcher's exit), once the background-tool wrapper. Both real verdicts came only from an explicitly echoed `EXIT=$?`. A Direction-mode run keying on the notification would have journaled a green gate that was red. | Review rounds 1–2, "Harness friction" | **OPEN.md row 105** (`meta`) |
| **The stack probe is flaky** — `stackAvailable()` intermittently returned false with the stack demonstrably up, flipping ten H-class tests between *executed* and *skipped* across consecutive runs of identical code. A skipped H-class run still reports suite PASS, so a Gate-3 "H executed" claim is not reproducible. | Review round 2, "Harness friction" | **OPEN.md row 106** (`meta`) |
| **ADR-authored test-impact predictions were wrong twice and self-contradictory once.** `0002` mis-called `U32` (predicted a loud failure; it would have *silently passed* while missing the seventh refusal), omitted `U6`/`U7`/`U8` entirely, and its d11 contradicted its own d6 on the refusal envelope. `0003` responded by marking its own prediction untrustworthy and instructing the Tester to run the suite — which held. **Generalize: an ADR should state test impact as a hypothesis to execute, never as a fact.** | ADRs `0002`/`0003`; test plan rounds 2–3 | **OPEN.md row 107** (`meta`) |
| **Two tests passed vacuously in two consecutive rounds** — `U38` and `U48` each iterated a collection the feature did not yet produce, so the loop body never ran and the assertion was green by default. Both were caught by probing rather than by running. **Rule: assert arity before inspecting element shape.** | Test plan rounds 2–3 | **OPEN.md row 108** (`meta`) |
| **A byte-offset source assertion failed on correct code *and* passed on broken code — the same test, the same round.** `S21` used a fixed 3200-char window (reported "no success envelope" when the handler grew past it) and a ±400-char marker window that bled into the adjacent envelope (reported a pass against a handler carrying the exact defect it guards, missing by 520 characters of luck). Fixed with structure-bounded extraction; `S9`'s 4000-char markdown window survives. **A green suite is not evidence a guard works; running the guard against the defect it names is.** | Test plan round 3; review round 3 | **OPEN.md row 109** (`meta`) |
| **Completion detection could not fire, because no book existed at kickoff.** The book was opened *after* production deploy, so every per-story PASS checked for a book and found none. The eager-anchor rule exists precisely to prevent this, and nothing enforced it. | This close; `workflows/5-review.md` completion detection | **OPEN.md row 110** (`meta`) |
| **This book's kick-back rate was ~67% (2 of 3 rounds) against a 1% project baseline** across 142 decided reviews. | `scripts/harness-stats.sh` at retro | **Declined** — not a defect to fix. Both kick-backs found genuine fail-open safety holes (a paired invariant enforced in prose rather than code; a documented flow that dead-ended), in a book whose subject *is* the rules governing autonomous runs. The rate is the harness working as designed on safety-critical governance text, not thrash. Recorded so the outlier isn't later mistaken for either dysfunction or a norm. |

**Porting check (Direction ↔ human-gated):** rows 105 and 106 bite *harder* in Direction mode — a Director journaling a misreported gate result, or a self-reported "H executed" that silently skipped, both corrupt the decision journal, which is the run's primary artifact. Rows 107–109 are flow-agnostic. Row 110 is human-gated-specific in origin but its remedy (open the book at intake) is the rule both flows already share.
