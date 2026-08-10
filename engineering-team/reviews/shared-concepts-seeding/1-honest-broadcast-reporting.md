# Review: Story 1 — Tell me what actually happened when I offer or wire a concept

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-08-10
**Diff:** `git diff db939ccc..b2c64237` — 3 files, +118, −11.
**ADR:** none — Architecture skipped by design (Bug under Standard).

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **reviewer-initiated run**: `Overall: FAIL` with exactly **one** failing suite,
      `harness-lint`, which is OPEN.md **#158** firing as this review predicted (L1: a PASS-final
      review with the story not yet flipped). Every other suite `0 failed`, 53 skipped, story suite
      **15/15**. No row-150 flake this run. The Implementer's independent capture (4162 lines, read
      and grepped) showed `Overall: PASS` before this report existed — the two runs agree once #158
      is accounted for.
- [~] `harness-lint` — clean at audit time; **1 violation once this report existed and before the
      story flipped** (L1, OPEN.md #158). Checked by exit code, not through a pipe (OPEN.md #157).
- [x] UI build — `npm run build` succeeds and the cross-boundary CJS alias resolves; verified in the
      bundle, not just in the config.
- [ ] `npm run test:playwright` — not applicable.

## Spec adherence

- [x] All seven criteria covered. AC-1/2/3 by `U2`/`U1`/`U3` plus `U5` and `U8`; AC-4 by `U6` and
      `S2`; AC-5 by `U7`; AC-6 by `S3`; AC-7 by `S4`.
- [x] **The sibling was not left behind.** `wireAndBroadcast` carries the identical fix
      (`dispositionActions.js`), and `S2` is written so that fixing one and leaving the other cannot
      pass. This was the specific half-sweep risk, and it is closed.
- [x] Both owner rulings honored: kept-local reads as information, not error (`U8` asserts the
      absence of failure language *and* the absence of any community-reach claim); no retry
      machinery was added — the not-delivered message says the action can be repeated, nothing more.
- [x] Nothing added beyond the story. `defer` untouched, `publishToRelays` untouched, its eight
      other callers untouched.

**Verified beyond the tests.** Both calling surfaces genuinely render the returned string —
`AdoptionQueue`'s `act` does `setMessage(typeof msg === 'string' ? msg : fallbackDone)` and
`DispositionPanel`'s `run` passes it to `finish` → `setMessage`. `S4` only pins that the token
`message` appears, so this was checked by reading rather than by the pin. No stale references to any
of the four retired message strings survive anywhere in `ui/src`, `src` or `test`.

## Implementation quality

The three judgement calls the Implementer flagged, audited:

1. **Keeping `try`/`catch` with `result = null`** — correct. The catch was dead for the *ordinary*
   failure modes (which is the bug) but not for all of them, and `null` classifies as
   `not-delivered`, so an unexpected throw lands on the honest answer instead of vanishing.
   `U4` covers exactly this shape.
2. **`already` now carrying its own outcome** — not scope creep; it is **AC-5**, which asks that a
   repeat action still say which of the three outcomes the re-broadcast had. The old wording
   ("Already self-declared — re-broadcast to the community relay") asserted delivery unconditionally,
   which is the same defect in smaller form.
3. **No end-to-end submit/wire triggered** — the right call, and worth endorsing explicitly rather
   than treating as a gap. Exercising the live paths publishes an event to a *shared* community
   relay as a side effect of a test; manufacturing relay traffic to prove a message string is a poor
   trade. The three outcomes are covered at the unit level, the wiring structurally, and the build
   output by inspection.

## Things tests can't catch

- [x] No secrets, no debug logging, no commented-out code.
- [x] The core is genuinely zero-require (`U9`) and joins the four existing `src/lib` cores.
- [x] The cross-boundary CJS import was verified in a real build, honoring the warning the existing
      `event-tagging` alias left for exactly this situation.
- [~] Two homes for one rule, and a defensive asymmetry — Non-blocking 1 and 2.

## Findings

### Blocking

None.

### Non-blocking

1. **`ui/src/pages/concepts/ConceptDetail.jsx:113–122` — the rule now has two homes, and they
   already disagree.** The story named this handler "the working model," the fix extracted that
   model into `src/lib/broadcastOutcome.js`, and the original was left un-migrated — so the same
   question ("what did this publish result mean?") is answered by two implementations.

   They are not equivalent. The inline version's failure branch is:

   ```js
   } else {
     setDeclareStatus('Self-declared locally, but the community relay publish failed — click again to retry.');
   }
   ```

   — it does **not** distinguish `already`, while the core does. So *repeat a submit and have the
   re-broadcast fail* reads differently depending on which page you acted from. That is one page
   short of AC-7's parity intent, on the very surface a user is most likely to use.

   *Why not blocking:* the story explicitly scoped this handler out and required it stay intact;
   the Implementer followed the instruction. *Carry-forward:* migrate `ConceptDetail` onto the core,
   which also retires the duplication.

2. **`src/lib/broadcastOutcome.js:95` — the two fallbacks have opposite safety postures.**
   `byVerb[outcome] || byVerb['not-delivered']` falls back to the *safe* answer, which is right.
   But `MESSAGES[verb] || MESSAGES.submit` falls back to a *wrong-but-plausible* one: an unrecognised
   verb silently produces submit wording for some other action. Unreachable today — there are two
   verbs and both are defined — but in a story whose entire subject is not quietly saying the wrong
   thing, the asymmetry is worth closing. *Optional:* make an unknown verb loud, or neutral.

3. **`ui/vite.config.js:10` — the first alias's comment is now stale.** It reads "First
   cross-ui-boundary CJS import — verify the build resolves it via cycle-local"; it is no longer the
   first. Two aliases now, each needing its own regex in `commonjsOptions.include`. Not a defect, but
   a third would want a general rule rather than a third bespoke entry, and the stale "first" will
   mislead whoever adds it. Same class of comment rot the vocabulary pass swept.

### Harness friction

1. **OPEN.md #158, third occurrence — and the first one predicted before it happened.** This is a
   PASS verdict on a story-backed lane, so L1 went red between saving this report and flipping the
   story, and the reviewer's own gate caught it as its sole failure. Third sighting across two
   books, all three inside a reviewer's quality gate. The row's fix shape is now supported by a
   prediction that held, not just by repetition. No new row; **#158** cited.

## Verdict

**PASS**

The defect is closed on all four actions, and the test that matters most is `U4`: for `null`,
`undefined`, `{}`, `{successes: null}`, a string and a number, the classification is asserted never
to be `published`. This story exists because code claimed community reach it had not verified, and
the fix declines to reintroduce that on any shape it did not anticipate.

Two things deserve endorsing rather than passing over. **Keeping the `catch`** looks redundant once
the result is read, but it is not — `publishToRelays` resolving on failure was the bug, and a
genuine throw is still possible; routing it to `null` lands on the honest answer. And **not
triggering the live paths** was correct restraint: proving a message string is not worth publishing
an event to a shared relay, and the Implementer said so plainly instead of quietly skipping it.

The finding I would not want lost is Non-blocking 1. The story used `ConceptDetail` as the model,
extracted it, and left it behind — so the rule has two homes that already diverge on
repeat-and-fail. The instruction was followed exactly; the instruction was the thing that was
slightly wrong. It belongs in this book's carry-forward, not in a future archaeology session.

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection performed; result reported in chat, not recorded here.
