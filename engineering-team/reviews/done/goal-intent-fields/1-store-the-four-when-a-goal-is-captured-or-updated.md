# Review: Story 1 — Store the four when a goal is captured or updated

**Reviewer:** Claude (acting as Reviewer) — fresh context, did not author the diff
**Date:** 2026-07-26
**Diff:** `git diff 39b9a98c..53eaa20d -- src/` (commit `53eaa20d`) — two source files
**Story:** `engineering-team/stories/goal-intent-fields/1-store-the-four-when-a-goal-is-captured-or-updated.md`
**ADR:** `engineering-team/decisions/goal-intent-fields/0001-shared-intent-field-picker-and-provisioned-schema.md`
**Test plan:** `engineering-team/stories/goal-intent-fields/1-store-the-four-when-a-goal-is-captured-or-updated.test-plan.md`
**Frame:** `engineering-team/audits/store-and-show-the-prompt-and-the-estimate/book.md` → *Acceptance frame* (owner-ratified goal; neither widened nor narrowed)

---

## Quality gates (run by me, not trusted)

### `npm test` — full suite, backgrounded, teed

Per OPEN.md #103/#105 the background completion notification's exit code is **not evidence** — it
reported "exit code 0" three times in this review session with no relation to the run. The
authoritative lines, read from the teed log:

```
relationship-primitives suite:                   PASS (23 passed, 0 failed)
relationship-primitives-probe suite:             PASS (9 passed, 0 failed)
structures-the-brain-can-trust suite:            PASS (24 passed, 0 failed)
break-a-goal-into-pieces suite:                  PASS (30 passed, 0 failed)
the-brain-survives suite:                        PASS (31 passed, 0 failed)
sessions-read-the-brain suite:                   PASS (30 passed, 0 failed)
operational-direction suite:                     PASS (86 passed, 0 failed)
store-the-four suite:                            PASS (40 passed, 0 failed)
store-the-four H-class:                          11 executed / 0 skipped
Total skipped:                                   41
Overall:                                         PASS
```

- **Every suite line in the roll-up reads PASS.** Zero suites reported FAIL.
- **Zero `FAIL`-marked test lines** anywhere in the log (the two regex hits are a test *name*
  containing "FAILS OPEN" and a harness-lint line about the literal word FAIL).
- **The story's own suite: 40 passed / 0 failed / 0 skipped**, with the live class genuinely
  executed — `H-class 11 executed / 0 skipped`, not silently skipped (OPEN.md #104/#106).
- **The pre-warned pre-existing flake did not fire in my run.** `relationship-primitives` H8 and
  `relationship-primitives-probe` H4 — which bracket a *global* strfry event count while
  `strfry-router` imports continuously — both passed. Had they failed I would have recorded them as
  pre-existing and unrelated; they did not, so there is nothing to discount.

*My own `EXIT=${PIPESTATUS[0]}` echo came back empty — `PIPESTATUS` is bash, this shell is zsh. That
is my slip, not a signal. I closed it with a second, independent run below rather than leaving the
gate resting on a log line alone.*

### Standalone confirmation with a hard exit code

```
TAPESTRY_REQUIRE_LIVE=1 node test/store-the-four-when-a-goal-is-captured-or-updated.test.js
→ REVIEWER_STANDALONE_EXIT=0
  store-the-four: H-class 11 executed / 0 skipped
  store-the-four-when-a-goal-is-captured-or-updated: 40 passed, 0 failed, 0 skipped
  (40 PASS lines; zero FAIL lines; zero SKIP lines)
```

`TAPESTRY_REQUIRE_LIVE=1` makes an all-skipped H-class a suite failure, so exit 0 here means the live
assertions ran against the running stack — including `H11` (nothing outside the harness fixtures was
written, moved or touched), which also proves my full-gate run's teardown was complete.

### Other gates

- [x] `npm run test:playwright` — **not applicable.** This story builds no screen; the screen work is
      `goal-intent-fields` #3. No `ui/` file is in the diff.
- [x] *Lint not configured — skipped.*
- [x] *Typecheck not configured — skipped.*
- [x] *Build — no build step (JS-without-build, by design).*

---

## Spec adherence

| AC | Verdict | Evidence I checked myself |
|---|---|---|
| **AC1** — accepted at capture by every capture path; unsupplied fields **absent**; empty subset still succeeds | ✅ | `U3`–`U5`, `U7`, `U10` green; `H1`/`H2`/`H3` green live. `assertAbsent` uses `hasOwnProperty` and `assertPresent` uses `Object.is` (`test:549-560`) — so "absent" cannot be satisfied by a stored `false`/`0`/`''`, and the H-class is genuinely discriminating. `H9` proves the direct-record path did not regress, rider included. |
| **AC2** — accepted at update; other three and everything else unchanged | ✅ | `S5` green; `H5` green live, asserting `name/slug/description/origin/capturedOn/deliverable/boundary/parent/promptVersion` byte-equal across the update. `updateGoalIntent:2386` still `regenerateJson(uuid, {...wrapper, tapestryOwnerGoal: section})`; the `capturedOn` backfill (`:2371-2374`) is untouched and runs first. |
| **AC3** — stored in the shape the concept declares | ✅ | `U8` green; `H4` green live (multi-line markdown prompt byte-identical through sign → store → export; estimate a `number`; flags `boolean`). `S4` green — nothing trims the four. |
| **AC4** — a fresh instance declares all four; `required` unchanged | ✅ *with a stated residual* — see **AC4 judgment** below | `S6` (evaluated, not regex-matched), `S12`, `H10` all green. Independently: I read the live schema node from the Concept Graph API and the four declarations in `GOAL_SCHEMA` are **byte-identical** to it. |
| **AC5** — nothing acts on them at write time | ✅ | `U6`, `U9`, `S8` green; `H6`/`H7`/`H8` green live — `prompt: ''` and `chanceOfSuccess: 0` both proceed and store; an adversarial-looking prompt is stored unexamined at capture *and* at update. The new 400 is a **presence** test (`:2307`), never a content test. |

- [x] No criterion silently dropped.
- [x] No behavior added that isn't in the story. The diff stores; it consults nothing.

**Ceiling check.** The frame's ceiling is *"Storing and showing only. No rules about which prompts may
run, nothing acts on the estimate or the flags, and no new screen is built."* The diff adds no rule
keyed on content; the only refusal it touches is the pre-existing "at least one field" 400, widened
from three names to seven and still a presence test. No screen. No read surface — correctly absent
here, since stories 2 and 3 own those. **Frame neither widened nor narrowed.**

---

## ADR adherence

Walked sub-decision by sub-decision, against the source rather than the commit message.

| Sub-decision | Verdict | Where |
|---|---|---|
| **d1** — `INTENT_FIELDS`, one list, one place | ✅ exactly `['prompt','chanceOfSuccess','needsHumanInput','needsBreakdown']`, ADR order | `src/lib/brain/goals.js:263` |
| **d2** — pure, non-mutating, rule-free picker; `undefined` the only omission test | ✅ fresh `{}`, `!== undefined`, verbatim copy, no trim/coerce/clamp/default/reject; doc comment states all three prohibitions | `src/lib/brain/goals.js:257-294` |
| **d3** — whitelist at the handler, `intent` as a named core parameter, `Object.assign` after the section build | ✅ both capture paths | handlers `:2202-2205`, `:2923-2927`; cores `:2258`, `:2965` |
| **d4** — the deliberate two-list shape | ✅ **the crux, and it holds** — see below | `:2293-2330`, `:2380-2384` |
| **d5** — `GOAL_SCHEMA` declares the four; `required` and `x-tapestry` do not move | ✅ | `:4882-4885`; `required` `:4872`; `x-tapestry` `:4887`; top-level `required` `:4890` |
| **d6** — the seven replicating paths change, recorded as "no change"; no whitelist added | ✅ none of them appears in the diff; `S7` green | — |
| **d7** — no operational step on this instance; no firmware reinstall | ✅ no `save-schema` call in the diff; `firmware/` contains zero files mentioning `tapestryOwnerGoal` (verified by me) | — |

### d4 — the asymmetry the ADR calls "the one place the obvious implementation is wrong"

This is the sub-decision most likely to be quietly collapsed, so I traced it line by line rather than
reading the comment and moving on:

- `intent` is computed at **`:2303-2304`**, *before* the refusal at `:2307`. ✅ (`S5` pins the order.)
- `provided` at **`:2305-2306`** still holds **exactly** `deliverable`, `boundary`, `parent`. ✅
- The refusal at **`:2307`** is `provided.length === 0 && Object.keys(intent).length === 0` — a
  presence test across both lists. `{goal, prompt: ''}` therefore proceeds. ✅
- The `empty-value` loop at **`:2317-2325`** iterates `provided` only. The four never enter it. ✅
- The `.trim()` calls at **`:2328-2330`** apply only to the three. `intent` is passed through
  untrimmed at `:2331`. ✅

**The mandated comment is present (`:2293-2302`) and — more to the point — it is accurate.** I checked
its two factual claims against the loop it describes rather than taking them on faith: the loop does
reject any non-string (`typeof value !== 'string'`), so `chanceOfSuccess: 75` would indeed be refused
for its content; and `.trim()` would indeed destroy AC3's byte-identity. The comment names the trap in
the language a future "cleanup" author would need to hear ("looks like tidying"). This is exactly what
d4 asked for.

- [x] Files changed match the ADR's implementation notes — **two source files, no more.**
- [x] Layering respected: the pure core stays pure (**zero `require()` calls**, verified by count),
      the whitelist is applied at the handler (the trust boundary), no raw `req.body` reaches a core
      (`S2`/`S3` assert this and are green).
- [x] No new dependencies: the commit touches 3 files total (2 source + the journal). No
      `package.json`, no lockfile.
- [x] Test files untouched by the Implementer: `git diff 39b9a98c..53eaa20d -- test/` = **0 lines.**

---

## What I verified independently rather than inheriting

The ADR and story make several load-bearing claims. I re-derived the ones a defect could hide behind.

1. **`GOAL_SCHEMA` vs. the live concept.** Read `39999:<TA>:tapestry-owner-goal-schema` through the
   Concept Graph API from inside the container, with `<TA>` resolved at runtime from
   `/api/assistant/pubkey` (never written down). The four types, descriptions, and the two
   `default: false` annotations are **byte-identical** to the constant. The constant's stripped style
   (omitting the live node's `name`/`slug`/`title` keys on the booleans) matches its eight
   pre-existing entries. House rule honored: the graph, not source, was the authority for the wording.

2. **The work-bearing class really is closed — the kickback clause does not fire.** Re-ran the
   repo-wide sweep for `tapestryOwnerGoal` across `src/ ui/ scripts/ bin/`: twelve hits. Four payload
   sites (`:2264` child capture, `:2386` update, `:2970` root capture, `:4953` restore mint), the
   schema constant (`:4869`, `:4890`), a family→key map in the restore executor (`:5060` — it feeds
   `mintRestoredGoal` a section verbatim, so it composes nothing), and four read-side references
   (`goals.js:26/37`, `direction.js:126`, `brain/index.js:751`). **No fifth constructing site.**

3. **The no-work class characterization, sampled by reading not by inheritance.**
   `handleSaveElementJson:3357` (`regenerateJson(uuid, json)` — supplied json verbatim),
   `mintRestoredGoal:4953` (`JSON.stringify({tapestryOwnerGoal: section})`, artifact section
   untouched), `handleCreateElement:1803` (`let finalJson = elemJson`). All three replicate. `H9`
   proves it empirically end-to-end: an out-of-contract `promptVersion` rider survives the export.

4. **Growing the schema cannot start auto-populating defaults.** This was the one way the d5 change
   could have broken AC1's "absent." `handleCreateElement`'s no-json branch (`:1823-1843`) iterates
   the **top-level** `schema.properties` and does **not** recurse; with the single-concept-object
   wrapper that is one key, taking the `t === 'object'` branch at `:1840`. Growing the *inner*
   properties is therefore inert to it. The ADR's Gate-1 disproof is correct, and `S6`'s wrapper
   assertion keeps it correct.

5. **The one AC4 step no test executes is content-agnostic.** `handleSaveSchema:1928-1961` persists
   `{$schema, type:'object', ...schema}` — an object spread — and never inspects or filters
   `properties`. The fold (`reconcilePrimaryPropertyForConcept:2073-2087`) then mirrors
   `schemaObject.properties` (stripped to `{type}`) and `required` onto the *primary-property* node,
   never the schema node. So on a fresh instance the four land on both, and nothing in that path can
   behave differently because the constant grew. This is the reasoning behind the AC4 judgment below.

6. **No caller can be silently captured by the widened whitelist.** `grep` across `src/ ui/ scripts/
   bin/` finds **no in-repo caller** of `note-goal-idea`, `create-child-goal`, or `update-goal-intent`
   beyond their three route registrations, and no internal `invokeNormalizeHandler` use of the three
   handlers. So no existing request body that happens to carry a `prompt` key starts writing one.

7. **No injection surface from prompt content.** `publishToStrfry:115` writes the event JSON to
   `strfry import`'s **stdin**; nothing interpolates event content into a command line. `H8`'s
   byte-identical round-trip of `$(whoami)` and `rm -rf /` corroborates empirically.

---

## AC4 — my judgment, since I was asked to make it rather than inherit it

**The residual gap is real and correctly stated by the Tester:** nothing in `npm test` executes
`ensureGoalConcept` against an instance that lacks the goal concept. AC4 is carried by three
decomposed links — `S12` (the wiring), `S6` (the evaluated constant), `H10` (parity with the live
concept) — all green.

**I judge that sufficient for this story.** Four reasons, stated so they can be argued with:

1. **The unexercised step is a data change, not a behavior change.** `ensureGoalConcept` and
   `handleSaveSchema` are untouched by this diff. What changed is the *content* of a constant that
   `handleSaveSchema` spreads without inspecting (finding 5 above). There is no branch in the
   provisioning path that can behave differently because `GOAL_SCHEMA` now declares twelve properties
   instead of eight.
2. **The path has been drilled end-to-end before.** Restore-onto-a-fresh-target is the only route that
   reaches `ensureGoalConcept` at all, and second-brain #8's `scripts/brain-drill.sh` exercised it and
   shipped. This story rides a proven path with different cargo.
3. **The three links close the parts that could actually drift.** `S12` pins the wiring so the chain
   can't be re-routed around the constant; `S6` **evaluates** the literal (a mis-slice throws rather
   than silently matching nothing — the row-109 failure mode) and pins the wrapper, `required`, and
   `x-tapestry`; `H10` pins the constant against the live concept so a fresh instance cannot diverge
   from what this instance means by the four.
4. **The cost of closing it is disproportionate to the residual risk.** The drill boots a second
   container and journals a durable record into the live brain — real side effects — to prove a
   data-only change to a constant whose consumer provably doesn't read it. The Implementer declining
   to run it *and saying so* was the right call; a quiet skip or a quiet run would both have been
   worse.

**What I will not claim:** that AC4 is proven end-to-end. It is proven by decomposition plus a read of
the single unexercised step. I'm recording the drill as a **book-close item, not a story blocker** —
the natural moment is the close of `store-and-show-the-prompt-and-the-estimate`, when one scratch
instance can serve the whole book (stories 1–3) instead of being spent on a constant.

---

## Concept-graph integrity

- [x] **Handles in `kind:pubkey:slug` form.** The diff adds no handle. The one I constructed for
      verification (`39999:<TA>:tapestry-owner-goal-schema`) is correctly formed and the TA pubkey was
      resolved at runtime.
- [x] **No hardcoded TA pubkey.** Zero 64-hex literals among the added lines. The house rule and the
      ADR-0015 `LEGACY_*` exception are both untouched — none of those four files is in the diff.
- [x] **Firmware reinstall correctly *not* required, and I verified the premise rather than the
      claim:** zero files under `firmware/` mention `tapestryOwnerGoal`. The goal concept is
      runtime-created; `GOAL_SCHEMA` is a code constant consumed only when the concept is absent. No
      concept is added and none redefined on this instance — the live definition already declares all
      four (read from the graph).
- [x] **Orientation via the Concept Graph API.** The ADR ran the three-call `/summaries` → neighbors →
      schema-node pattern and sourced its property wording from the graph, not from BIBLE.md. The
      resulting constant is byte-identical to the graph, which is the strongest evidence that the
      authority was respected in practice and not just in narration.

---

## Things tests can't catch

- [x] **No secrets.** No keys, tokens, or pubkey literals.
- [x] **No leftover debug logging.** No `console.log` added; the only `console.error` lines are the
      pre-existing handler catches.
- [x] **No commented-out code.** The added comments are all explanatory and all load-bearing (d2's
      three prohibitions, d3's trust-boundary note, d4's trap warning).
- [x] **Edge cases where they matter.** `pickIntentFields(undefined)` → `{}` via `input || {}`; a
      non-object input yields `{}` harmlessly; `Object.assign(section, undefined)` is a no-op, so a
      core called without `intent` degrades safely rather than throwing.
- [x] **Concurrency.** All three cores still run inside the `serializeGoalWrite` mutex (`:2129`); the
      picker is pure with no shared mutable state; the whitelist is computed in the handler *before*
      the serialized section, which cannot introduce a new interleaving. No new serialization needed.
- [x] **Security — the whitelist is a strict improvement.** Four fixed literal key names copied onto a
      fresh `{}`: no prototype-pollution path, no `__proto__` reachability, and strictly less of the
      request body reaches storage than a spread would. Values land in `JSON.stringify` and, on the
      Cypher side, in parameterized writes — the same path `description`/`deliverable` have always
      taken, so no new class of input is introduced.
- [x] **Scope creep — none.** Two source files, +96/−6 lines. No read surface, no screen, no route, no
      endpoint, no dependency.

---

## House rules check

- [x] **Concept Graph API authority respected** — property wording taken from the graph and verified
      byte-identical.
- [x] **No new lint/typecheck/build tooling.** No `package.json` or lockfile change.
- [x] **Per-deployment TA pubkey never hardcoded.** Zero 64-hex literals added; no `LEGACY_*` constant
      touched or removed.
- [x] **Architecture invariants.** POV-first, decentralized-first, filter-at-view-time, local-first:
      all four are neutral to this diff. It stores owner-authored fields verbatim on the owner's own
      local records, gates nothing at write time, denormalizes nothing per-POV, and destroys no
      locally-authored graph state.

---

## Findings

### Blocking

**None.**

### Non-blocking

1. **`src/api/normalize/index.js:2384`** — `fields.push(...Object.keys(intent || {}))`. The `|| {}`
   guard isn't in ADR d4 (which writes `Object.keys(intent)`), and the line above it
   (`Object.assign(section, intent)`) tolerates `undefined` natively, so the two lines guard
   differently for the same risk. The guard is reachable only if a future caller invokes
   `updateGoalIntent` without `intent` — in which case silently writing nothing is a worse outcome
   than throwing. *Optional:* default it at the signature (`intent = {}`) so all three cores read
   alike, or drop the guard.

2. **`src/lib/brain/goals.js:263`** — `INTENT_FIELDS` is exported as a mutable array, and story 2 will
   import it as the single source of the names. `Object.freeze([...])` would make "one list, one
   place" structural rather than conventional. Not required by the ADR; a one-token change next time
   the file is touched.

3. **`src/api/normalize/index.js:2198-2205`** — the new whitelist block was inserted between the
   "Refusal contract (ADR 0003 d6)" comment and the `serializeGoalWrite` call it documents, leaving
   that comment separated from its subject by a blank line and an unrelated block. Cosmetic; on the
   next touch, move the new block above the refusal comment.

4. **Observation, deliberately not adopted into this story — OPEN.md row 102.** While verifying d5
   against the graph I read the live goal-schema node's inner `required` as
   `["name","slug","description"]`. Row 102 reports it as `[...,"chanceOfSuccess"]` and names
   `structures-the-brain-can-trust` H4 and `break-a-goal-into-pieces` H1 as failing live because of
   it — **both suites PASS in my gate** (24/0 and 30/0). This diff cannot have caused that: it runs no
   `save-schema` and `ensureGoalConcept` is a no-op on this instance (ADR d7). Row 102 therefore looks
   stale or aimed at a different artifact. I'm recording it for triage and **not** resolving it: the
   story and the ADR both explicitly disclaim being evidence about that row, and quietly closing
   someone else's bug from a review would violate the boundary they drew.

5. **A diagnosed harness defect has no ledger row.** The Director's Gate-4 journal quantifies why
   `relationship-primitives` H8 and `relationship-primitives-probe` H4 are structurally unsound rather
   than merely flaky — they bracket a **global** strfry event count while `strfry-router` imports at a
   measured ~1 event/15s, so passing is the coincidence — with evidence (`6014735 → 6014739` inside
   one bracket). OPEN.md #104/#106 cover probe flakiness and skipped classes, which is a *different*
   failure. Nothing covers this one. Both suites passed in my run, which is exactly why it should be
   filed now rather than after it's forgotten. **Recommend a `meta` row.**

### Harness friction

1. **OPEN.md #103/#105 reproduced, again.** Background completion notifications reported "exit code 0"
   three times in this session with no relation to the suite's verdict. Read `Overall:` from the teed
   log instead — as the row already prescribes.
2. **The `EXIT=$?` half of row 103's mitigation silently fails under zsh.** Row 103 advises "tee the
   suite to a log and read `Overall:` (or an explicit `EXIT=$?`)". Combining the recommended `| tee`
   idiom with `${PIPESTATUS[0]}` produces an **empty string** under zsh (the array is
   `$pipestatus[1]`), so the fallback evidence silently evaporates exactly when it's being relied on —
   which is what happened to me. *Candidate addition to row 103:* name the zsh form, or recommend
   `set -o pipefail` / a standalone re-run for the hard exit code. I closed the gap with the
   standalone run (`REVIEWER_STANDALONE_EXIT=0`).

---

## Verdict

**PASS**

The diff does exactly what the story, the ADR, and the frame ask, and nothing else. The gate is green
by my own hand — full suite `Overall: PASS` with every suite line PASS, plus a standalone run with a
hard `exit 0` and the live class demonstrably executed (11/0). ADR d4's asymmetry — the one place the
obvious implementation is wrong — is implemented correctly and documented accurately in code. The
four are carried and never consulted: absence is expressed by not writing the key, and `null`, `0`,
`false`, and `''` all survive as supplied values. `GOAL_SCHEMA` grows by exactly four declarations,
byte-identical to the live concept, with `required` and `x-tapestry.unique` unmoved and the
single-concept-object wrapper intact. The seven replicating paths are untouched and gained no
whitelist.

AC4 keeps a stated residual — no test provisions a concept-less instance — which I judge acceptable on
the reasoning above and record as a **book-close item**, not a blocker.

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place. No files moved — retirement is per-epic, and
      `goal-intent-fields` is still in flight (stories 2 and 3 are `Approved`).
- [x] **Completion detection run — the book is NOT complete, so no offer is made.** The acceptance
      frame of `store-and-show-the-prompt-and-the-estimate` has three deliverable bullets. This story
      satisfies two — *set when a goal is captured* and *set when a goal is updated* (the write half).
      The third — *"all four come back on every surface that shows a goal"* — is untouched by design
      and is owned by `goal-intent-fields` #2 (read surfaces) and #3 (screens), both still
      `**Status:** Approved`. The boundary bullets hold so far (no rule about prompts, nothing acts on
      the estimate or flags, no new screen), but they are ceiling conditions, not deliverables, and
      cannot complete a book on their own. **Book stays Open.**
