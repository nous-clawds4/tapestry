# ADR 0001: Gate-integrity & lint-robustness — invariant placement

**Status:** Proposed
**Date:** 2026-07-25
**Story:** `engineering-team/stories/harness-gate-integrity/1-gate-integrity-and-lint-robustness.md`

## Context

Story `harness-gate-integrity #1` batches five verified defects in the harness's own self-checking machinery (OPEN.md #43, #58, #46, #22, #21). Four are mechanical repairs with no design decision. Two set **durable harness invariants** and need a decision recorded:

1. **#46 — the ADR `## Consequences` invariant.** `engineering-team/templates/adr.md:26` requires a `## Consequences` section; `engineering-team/templates/build-audit.md:42` harvests it for the close-book §5 debt roll-up. Nothing enforces it — `grep -i consequences scripts/harness-lint.sh` → 0 hits. A full-tree survey (157 ADRs) found exactly two without the section: `decisions/task-queue-scheduler/0023-…` (an **active** deliberate stub) and `decisions/done/tag-event-inspector/0001-…` (a **retired** ADR under `done/`). This decision fixes both the *rule shape* and its *scope*.

2. **AC2 — the #43 anti-recurrence self-assertion.** #43's core defect is a severed `overallOk` chain (a stray `;` orphans 9 registered suites from the exit code). The mechanical semicolon fix repairs *this instance*; AC2 asks for the guard that makes the *class* self-detecting. The question is **where that guard lives**. A guard already exists and already failed to catch #43: `test/stack-free-npm-test.test.js` G5 (`:155–173`). G5 reads `test.js` as a source contract, already captures the live chain (`const chain = src.match(/const overallOk =([\s\S]*?);/)`, `:163`), but its per-suite membership check (`:159`) tests `src.includes(\`${resultVar}.fail === 0\`)` over the **whole file** and only iterates a **hardcoded 12-suite `TARGETS`** list — so a term sitting in the dead post-`;` block passes, and un-listed suites are never checked. That is exactly how #43 hid.

**Constraints:**
- **No new lesson surfaces / no new tooling** (inherited from the parent `harness-self-improvement` epic and CLAUDE.md's JS-without-build rule). Extend existing machinery; don't add a parallel ledger or gate technology.
- **`harness-lint` convention:** active-consistency checks **skip the retired `done/` tree** — `check_reviews` (`harness-lint.sh:94`) and `check_L2` (`:130`) both `continue` on `done/`. A new invariant should match this unless there's a reason not to.
- **`harness-lint.sh` is an L10 def-path** (`scripts/harness-def-paths.txt`): any commit touching it must also touch `engineering-team/CHANGELOG.md`, or L10 self-fires.
- **`test/harness-lint.test.js:400`** ("the real repo lints clean") asserts `code === 0` on the real tree — so a new fail-tier rule must land **with** its offender resolved (fix or cited waiver) in the same change.
- **All 142 `const <var> = await <suite>.run()` results** in `test.js` are gating suites (142/142 verified) — no non-gating `*Result` var exists, so a "every suite result must gate" contract cannot false-fire.
- **Lane boundary** (ADR template `:35`; OPEN.md #65): test-suite files are the Tester's lane (Phase 3); a Direction Gate-4 pins an empty `test/` diff after Gate-3. This batch is harness infra, so "the SUT" is unusually the scripts + the `test.js` runner — the lane mapping is made explicit in Implementation notes.

No concepts are touched (harness/test infrastructure). Firmware reinstall: **no**.

## Options considered

### Decision 1 — the `#46` ADR-`Consequences` invariant

**Option A — a fail-tier `check_L13` over active ADRs, heading-presence only (chosen).**
Add `check_L13()` to `harness-lint.sh` asserting every **active** ADR (`engineering-team/decisions/*/*.md`, skipping `decisions/done/*` exactly as `check_reviews`/`check_L2` do) contains a `^##[[:space:]]+Consequences` heading; miss ⇒ `violation L13 …`. Only the active stub `task-queue-scheduler/0023` is in scope; it is dispositioned by **backfilling** a truthful one-line Consequences (it is a superseded stub — no standing waiver needed). The retired `tag-event-inspector/0001` is out of scope by the `done/`-skip convention and is left as frozen history (the investigation confirmed no substance was lost there; it was answered under that ADR's `## Architecture invariants` + `Out of scope`).
- *Pros:* matches the established `done/`-skip precedent; catches ADRs at **authoring** (the cheap point, while active); respects frozen history; heading-presence is robust (wording-agnostic); one offender, backfilled, no standing waiver. Self-consistent — this very ADR carries `## Consequences`.
- *Cons:* does not retroactively police historical ADRs; a pre-existing `done/` miss stays un-fixed (acceptable — frozen, and the harvest reads ADRs while they are still active during a book close).

**Option B — `check_L13` over *all* ADRs including `done/`.**
Same rule, but scan the retired tree too ⇒ **both** offenders in scope (backfill the stub; backfill or waive the retired one).
- *Pros:* strictly stronger net; guarantees every ADR ever written carries the section.
- *Cons:* breaks the `done/`-skip convention the other checks follow; polices frozen history for no live benefit (the harvest never re-reads retired ADRs); forces edits to (or a standing waiver for) a settled retired decision. Rejected as inconsistent and higher-noise for no protection the harvest needs.

*(Rejected variant of either: assert the four sub-bullets, not just the heading. Brittle — sub-bullet wording legitimately varies — and it buys nothing the harvest needs; heading-presence is the load-bearing property.)*

### Decision 2 — where the `#43` anti-recurrence guard (AC2) lives

**Option A — strengthen the existing G5 source-contract (chosen).**
Repair `test/stack-free-npm-test.test.js` G5: (a) enumerate **every** gating suite from `test.js` source — match `const (\w+Result)\s*=\s*await \w+\.run\(\)` (142/142 today) instead of the hardcoded 12-item `TARGETS`; (b) assert each `<var>.fail === 0` occurs **within `chain[1]`** (the captured `overallOk` expression), not via whole-file `src.includes`. Keep G5's existing `.skipped`-not-consulted and `process.exit(overallOk ? 0 : 1)` checks.
- *Pros:* repairs the guard that already owns this contract, at the right altitude (a test that reads `test.js` as source); the `chain[1]` switch is the precise fix for why G5 missed #43; generalizing off `.run()` makes it self-maintaining for future suites; runs in the stack-free CI path where #43 bites; adds no surface (honors "no new tooling").
- *Cons:* G5 will fail until #43's core chain fix lands — an ordering constraint (this is *correct*: G5-strengthened is the failing regression test for #43, made green by the Implementer's chain repair).

**Option B — a new `harness-lint` invariant (e.g. `L14`) parsing `test.js`.**
Assert the same structural property from `harness-lint.sh`.
- *Pros:* co-locates it with #46's new invariant; runs on every SessionStart/`/whats-open`.
- *Cons:* wrong altitude — `harness-lint` is a **bookkeeping** linter over stories/reviews/epics/links/budgets/changelog, not a parser of `test.js` runtime internals; it would **duplicate and split** G5's existing purpose across two surfaces; and it adds a surface the "no new lesson surfaces" constraint discourages. Rejected.

## Decision

**Decision 1: Option A** — a fail-tier `check_L13` over active ADRs, heading-presence only, backfilling the single active offender.
**Decision 2: Option A** — strengthen G5; **do not** unify AC2 onto `harness-lint`.

The operator floated unifying #46 and AC2 onto one `harness-lint` surface. We **decline the unification**, deliberately: #46 is a bookkeeping invariant over ADR *files* (harness-lint's native domain); AC2 is a source-contract over `test.js` *internals* whose owner already exists (G5, a test that reads `test.js`). They belong on different, correct surfaces. Net new invariants: **one** (`L13`) — AC2 needs no new L-number.

Consistency check against existing ADRs: this extends `harness-self-improvement/0001` (the `harness-lint` mechanism) and `test-hermeticity-ci/2` (which authored G5); it **contradicts neither** — it repairs G5's membership check (a latent bug in that ADR's deliverable) and adds an invariant in the space `0001` explicitly holds open ("asserts the harness's own invariants"). No supersession.

## Consequences
- **What this enables.** A green harness genuinely gates every registered suite; the #43 *class* becomes self-detecting (a future un-wired suite fails G5); the close-book debt roll-up can trust that every active ADR carries the `Consequences` section it harvests.
- **What this constrains or makes harder.** Every new active ADR must now carry `## Consequences` (the intended constraint). Every future suite added to `test.js` must be wired into the `overallOk` chain or G5 fails — a deliberate tripwire. Any commit touching `harness-lint.sh` now also carries a `CHANGELOG.md` row (pre-existing L10 rule, reaffirmed).
- **New debt / follow-ups.** `tag-event-inspector/0001` (retired) is left without a `Consequences` section by design — recorded here as a known, accepted historical gap, not swept. The `totalSkipped` skip-accounting drift (~27 suites omitted from the aggregate skip tally) is out of scope (story) and remains open. If a future decision wants historical-ADR coverage, that is Option B and a separate change.
- **Firmware reinstall required?** No — no concept definitions change.

## Implementation notes

Concrete, per item. Anchors cite current line numbers on `feat/harness-gate-integrity`, but the semicolon/chain anchors **migrate** — locate by pattern, not by number.

**Lane mapping (this batch, harness infra).** "SUT" = the scripts + the `test.js` runner (Implementer, Phase 4). The `*.test.js` **suites** are the Tester's lane (Phase 3). Split:
- *Tester (Phase 3):* strengthen G5 (`stack-free-npm-test.test.js`) → the failing AC2 regression; a behavioral AC1 test (plant a fail in a formerly-dead suite → `test.js` exit flips); an AC3 check (a `{fail≥1, skipped≥1}` result renders FAIL, not SKIP); an L13 fixture in `harness-lint.test.js`; an empty-tree L8 fixture in `harness-lint.test.js`.
- *Implementer (Phase 4):* the `test.js` chain repair (#43) and summary-line rewrite (#58); `harness-lint.sh` `check_L13` + `check_L8` guard (#46/#21); the stub-ADR backfill + `CHANGELOG.md` row.
- *#22 is the exception:* the artifact under repair **is** a test-suite assertion (`ci-test-job.test.js` W5). Its fix (scope the `indexOf` to the `steps:` region) and its proof (a comment-before-steps fixture that must not false-fail; a gate-before-install mutation that must still fail) are **co-authored in Phase 3** — there is no separate production surface, so the Implementer's Phase-4 diff simply won't include #22. The Reviewer verifies both cases.

**Ordering constraint.** Land the #43 `test.js` chain repair together with (or before) the G5 strengthening — G5-strengthened is red until the chain is whole. In the failing-first flow this is automatic: Tester commits the red G5, Implementer's chain repair greens it.

- **#43 core — File `test/test.js` (Implementer).** Change the first `;` terminating `const overallOk = …` (currently the `theBrainSurvivesResult.fail === 0;` line, ~`:1066`) to ` &&`, re-attaching the 7 orphaned `&&`-joined terms below it (harnessLint…routerStreamTagFilters, ~`:1067–1073`). Then **insert** two terms that were never in the chain — `noteTrustedListResult.fail === 0 &&` and `applicabilityRepublishResult.fail === 0 &&` — anywhere before the chain's terminating `;` (natural spots: beside their sibling suites). Net: all 142 suites gate. `process.exit(overallOk ? 0 : 1)` (~`:1109`) is unchanged.
- **#43 AC2 — File `test/stack-free-npm-test.test.js` G5 (Tester).** Per Decision 2A: enumerate `const (\w+Result)\s*=\s*await \w+\.run\(\)` from the `test.js` source; for each, assert `<var>.fail === 0` is present in `chain[1]` (not `src.includes`). Retain the `.skipped`/`process.exit` assertions. This subsumes the old hardcoded-`TARGETS` membership loop (`:158–162`).
- **#58 — File `test/test.js` (Implementer).** Rewrite the 24 old-form summary lines (`~:512–615`, `const <x>Line = <x>Result.skipped ? SKIP : PASS/FAIL`) to the good-form ternary already used by 14 sibling lines (exemplar `deploySafetyStatusLine`, `~:807`): head `(<x>Result.pass + <x>Result.fail) === 0 && <x>Result.skipped ? SKIP : …`, and append the skipped count to the PASS/FAIL branch. Preserve each suite's existing SKIP-reason string. No change to `overallOk`/`totalSkipped`/`process.exit`.
- **#46 — File `scripts/harness-lint.sh` (Implementer).** Add `check_L13()` after `check_L12()` (`~:270`); iterate `engineering-team/decisions/*/*.md` with a `case … decisions/done/*) continue ;;` guard (mirror `check_L2:130`); require `grep -qE '^##[[:space:]]+Consequences'`, else `violation L13 "$f" "ADR missing template-required '## Consequences' — build-audit §5 (templates/build-audit.md:42) harvests it"`. Add `check_L13` to the run block (`~:304`) and an `L13 adr-consequences` line to the catalog comment (`~:15–26`). **Also:** backfill a truthful `## Consequences` into `decisions/task-queue-scheduler/0023-…` (a one-liner: "None — superseded stub; the decision is carried by #23 / ADR 0020; no new debt" + "Firmware reinstall required? No"); and add the `CHANGELOG.md` row for this def-path commit.
- **#21 — File `scripts/harness-lint.sh` `check_L8` (Implementer).** Guard the empty-array expansion at the `for f in "${files[@]}"; do` loop (`~:198`) using the repo's **length-guard** precedent (`violation():67`, `whats-open.sh:166` — `[ "${#arr[@]}" -gt 0 ]`), *not* the `${arr[@]+…}` form (absent from the repo). Wrap the loop in `if [ "${#files[@]}" -gt 0 ]; then … fi`.
- **#22 — File `test/ci-test-job.test.js` W5 (Tester, per lane mapping).** Before the ordering `indexOf` (`~:99–101`), slice the flattened haystack to the `steps:` region (`const stepsAt = f.indexOf('steps:'); const region = stepsAt === -1 ? f : f.slice(stepsAt);`) and search `region`. Mirrors the existing `ciSection()` idiom (`~:172–178`).

**Regression fixtures (Tester).** L13: a `decisions/foo/0001-x.md` fixture (the `cleanFiles()` tree already seeds epic `foo`) — without `## Consequences` fires L13; with it, clean. L8 empty-tree: a `makeFixture({…}, …)` with **no** wiring/link-doc files (not `withClean`, which always seeds them) asserting no `unbound variable` under system bash. The real-repo `code === 0` test (`harness-lint.test.js:400`) must stay green — i.e. the stub backfill lands in the same change.

## Out of scope
- The `totalSkipped` aggregate skip-tally drift (~27 suites omitted) — informational only; a separate concern (story Out of scope).
- Historical-ADR coverage (`done/` tree) — deliberately excluded (Decision 1A); would be Option B, a separate change.
- Any CI "required check" flip — `test-hermeticity-ci`'s deferred scope.
- `#55` — feat/tags-only; zero staging diff.
