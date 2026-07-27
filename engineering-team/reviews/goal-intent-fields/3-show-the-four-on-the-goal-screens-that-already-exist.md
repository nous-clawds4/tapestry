# Review: Story 3 — Show the four on the goal screens that already exist

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-07-27
**Diff:** `git diff ccd23e28..a88b7b77` (implementation commit `a88b7b77`)
**Story:** `engineering-team/stories/goal-intent-fields/3-show-the-four-on-the-goal-screens-that-already-exist.md`
**ADR:** `engineering-team/decisions/goal-intent-fields/0003-screen-side-intent-display-and-the-narrow-d13-supersession.md` (+ **Amendment 1**)
**Test plan:** `…/3-show-the-four-on-the-goal-screens-that-already-exist.test-plan.md`
**Book / frame:** `engineering-team/audits/store-and-show-the-prompt-and-the-estimate/book.md` — operational Direction, goal-derived acceptance frame

Production surface of the diff, in full: one new module (`ui/src/utils/goalIntent.js`, 87 lines), three
screens (+13 / +12 / +17−2 lines), one CSS declaration. Plus the story's `## Deviations` section, the
Director journal, and two gate logs — the established convention in this book's audit folder.

---

## Quality gates (run by the Reviewer, not trusted from the Implementer)

Both classes were run. `npm test` alone is not sufficient evidence for this story — that was the
Gate-3 finding, and it is respected here.

### Node — `npm test`

Run with the brace form the ledger requires (`{ npm test; echo "EXIT=$?"; } > log 2>&1`, OPEN.md #111);
verdict read from the log's own `Overall:` line and the echoed code, never from a background
notification (OPEN.md #103 / #105).

```
show-the-four suite:                             PASS (37 passed, 0 failed)
show-the-four H-class:                           5 executed / 0 skipped
store-the-four suite:                            PASS (40 passed, 0 failed)
store-the-four H-class:                          11 executed / 0 skipped
return-the-four suite:                           PASS (54 passed, 0 failed)
return-the-four H-class:                         8 executed / 0 skipped
Total skipped:                                   51
Overall:                                         PASS
EXIT=0
```

- **Whole gate: 1312 `PASS`, 0 `FAIL`.** `grep -cE "^  FAIL"` over the 3 770-line log returns `0`, and
  `grep -E "suite: +.*FAIL"` returns nothing.
- **No environmental noise fired this run.** `relationship-primitives` 23/0 and
  `relationship-primitives-probe` 9/0 (OPEN.md #75 did not fire); `most-pinned-tag-index-publish` 7/0.
  Nothing to distinguish.
- The story-3 suite was also run standalone (`node test/show-the-four-…test.js`) → **37 passed, 0 failed,
  0 skipped, `EXIT=0`**, H-class 5 executed / 0 skipped, live census
  `{"total":31,"withPrompt":1,"longestPrompt":6155,"withEstimate":7,"storedFalse":7,"storedTrue":3,"noneOfTheFour":23}`.

**Every pin the ADR said must survive unmodified, verbatim from my log:**

```
:2994  PASS  S11 (AC6): the Proposal view renders NO numeric score — no score/gauge/percentage/star affordance
:3000  PASS  H2 (AC6): the queue card carries NO numeric score field — comparisons and words only
:2996  PASS  S13 (AC7): the Proposal view carries no banned jargon and no exclamation marks
:2403  PASS  S5b (AC 5): the privacy line is an indicator — no toggle/control vocabulary in the view
:2405  PASS  S7 (AC 2/AC 6): standing words in the view stay within the canonical set
:2583  PASS  S7 (ADR d10 / AC 6): the Goal detail carries no write/edit affordance
:2637  PASS  S9 (ADR d12 / AC 3/AC 6): the record entry renders … still no edit affordance
:3111  PASS  S12 (ADR d14 — sentinel, zero UI diff): no brain UI file references signals
```

Suite roll-ups for every closed book this diff could touch: `the-proposal-loop` 33/0,
`capture-a-goal-and-see-it` 27/0, `attach-the-world` 29/0, `sessions-read-the-brain` 30/0,
`teach-it-what-matters` 27/0, `break-a-goal-into-pieces` 30/0, `operational-direction` 86/0.

**No test file was modified by this story.** `git diff --stat ccd23e28..a88b7b77 -- test/ tests/` is
empty, and the only commit on this branch touching `test/the-proposal-loop.test.js` is `584a8f58`
(`operational-direction` #1, a one-line import allow-list on **S8**, already reviewed and shipped). S11
at `:615` and H2 at `:705` are byte-untouched — the supersession's narrowness is substantiated, not
asserted.

### Browser — `npx playwright test tests/brainstorm/goal-intent-screens.spec.js --project=chromium`

```
Running 8 tests using 8 workers
  8 passed (3.2s)
PW_EXIT=0
```

**Zero-test trap checked:** the "Running 8 tests" line matches the pass count of 8, so the spec is not
exiting 0 vacuously. Single-project run used deliberately — a bare run drives all five configured
projects and only chromium's browser is installed here, which produces red that says nothing about the
code.

### The bundle under test — verified independently, not via `B0` alone

`B0` is content-based and passed, but it only proves the served bundle *contains* a string the module
exports. I went one step further, because "green and invisible" is this story's whole risk:

```
$ npx vite build --outDir <scratch>/dist-verify --emptyOutDir     # from the committed, clean ui/ tree
$ diff -rq <scratch>/dist-verify dist                             → identical
   index-EZ-5jXBH.js   index-DjU1IrwW.js   index-CC1xe2Pz.css     (same content hashes both sides)
```

A fresh build of the committed sources reproduces the served bundle **byte for byte**. The browser class
therefore measured the code in this diff, not a leftover artifact from the Tester's Gate-3 adversarial
build. Source mtimes (11:22–11:23) all precede the bundle's (11:24), and `git status` on `ui/` is clean.

- _Lint not configured — skipped._
- _Typecheck not configured — skipped._
- _No build step for the server; the UI build is the existing `ui && npm run build` path, unchanged._

---

## Spec adherence

| AC | Verdict | Evidence I checked myself |
|---|---|---|
| **AC1** all four visible; prompt as its own text (full on detail, excerpt on list-type) | **Met** | `B1`/`B3`/`B5` green; and rendered visually — see the eyeball section. Detail shows the prompt in full (`B3`'s deep marker ~2 000 chars in, past `PROMPT_EXCERPT_MAX`); Goals row and card show the prompt's own opening characters, not a badge. |
| **AC1** record-rendering clause | **Met, by non-action** | See "The record-rendering clause" below. |
| **AC2** never-set goal still renders; three declared defaults shown; prompt shown explicitly *not set* | **Met** | `U3`/`U6`/`U7`/`U8`, `B2`/`B4`/`B6` green; confirmed on screen: `Could run on its own: 0 out of 100 · Needs you: no · Too big as it stands: no` and `Prompt: No prompt written yet.` No literal `null`/`undefined` anywhere. |
| **AC3** no new screen, no new route | **Met, by non-action** | `ui/src/pages/brain/` holds exactly three files; `App.jsx`, `Layout.jsx` untouched by the diff (`git diff --name-status` confirms); `S5` green. |
| **AC4** nothing acts on them; the card's estimate is the owner's own recorded value | **Met** | `B7` (rendered order == sent order, with the mock ordered adversarially against the estimates); `S6`/`S7` green; `B6`'s no-digit assertion green. The diff adds no `sort`/`filter`/`slice`/conditional class/colour reading any of the four. |

No criterion is silently dropped, and no behavior is added beyond the four display lines per screen.

---

## ADR adherence

**Files changed match d3–d8 exactly**, and the "unchanged, deliberately" list is honored:

- `ui/src/utils/goalIntent.js` — new, plain ES module, no `react` import, no JSX (d3, `S1`).
- `Goals.jsx:184–187` — two `brain-goal-hint` spans inside `brain-goal-main`, after `showHint` (d5).
- `GoalDetail.jsx:192–195` — four `brain-detail-field` paragraphs, after `boundary`, **before** `showHint`
  (`:196`), in the intent block, never in `RecordEntry` (d5 + d1's spine boundary).
- `Proposals.jsx:112–115` — two `brain-proposal-whynow` paragraphs between `whyNow` (`:111`) and the
  `passedOver` block (d5); module docstring corrected per the implementation note.
- `styles.css:8202` — exactly one declaration, `.brain-detail-prompt { white-space: pre-wrap; }` (d8).
  No new `--` custom property (`S11`).
- **`git diff --stat ccd23e28..a88b7b77 -- src/` is empty** — the test plan explicitly assigned this check
  to me because no test has a stable mid-branch baseline. Client-only, as the ADR requires.
- Hooks, `App.jsx`, `Layout.jsx`, `ElementDetail.jsx`, `ConceptElements.jsx`, `ui/package.json`,
  `package.json`, `playwright.config.js`, `vite.config.js` — none appear in the diff.
- **ADR 0006's reciprocal `**Amended by:**` pointer appears exactly once** (`:6`), written in the ADR's
  own commit `b70299e3` (+1/−0). No duplicate was added at implementation — the ADR called a second one
  a defect, and there isn't one.
- **No new dependency, no new lint/typecheck/build tooling.** `@playwright/test@^1.56.1` was already a
  dependency; Amendment 1's premise correction holds.

---

## The four judgments this review was asked to make independently

### 1. Absence is `== null`, never falsiness — verified from the source, not from the tests

I read the module and grepped every branch rather than taking `U4`/`U5`/`U7`/`S4`'s word for it. The
complete set of conditionals in `ui/src/utils/goalIntent.js`:

```
:57  if (value == null) return { state: 'unset', text: PROMPT_UNSET };
:60  if (collapsed === '') return { state: 'empty', text: PROMPT_EMPTY };
:61  const bound = typeof max === 'number' && Number.isFinite(max) && max > 0 ? max : 0;
:62  if (bound === 0) return { state: 'text', text: raw };
:63  if (collapsed.length <= bound) …
:69  if (value == null) return '0 out of 100';
:79  if (value == null) return ESTIMATE_UNSET_ON_CARD;
:85  if (value === true) return 'yes';
```

Every absence test on a stored value is `== null`. `flagWord` discriminates on `=== true`, so a stored
`false` and a never-set flag both take the declared-default path *without* a truthiness test — which
matters, because 7 live goals store `false` explicitly (H1's census this run). The only truthiness-shaped
expression on `:61` is a guard on the **`max` parameter**, not on any of the four.

The three screens contain **no guard at all** on the four: `grep` over all three files returns exactly six
call sites (`Goals.jsx:185,187`; `GoalDetail.jsx:192–195`; `Proposals.jsx:113,115`), each a bare
`formatter(record.field)` inside a template literal or JSX expression. There is no `&&`-render, no `?:`,
no `||` fallback anywhere near them — so the bare-presence-indicator shape AC1 forbids
(`{g.prompt && <span>has prompt</span>}`) is absent by construction, not merely by scan.

**Judgment: the shipped code is genuinely free of the falsiness bug.** Independent of the four tests
that claim to kill it.

### 2. The narrow supersession — nothing wider shipped

Checked against ADR 0003 d1's four "what is *not* superseded" clauses:

- **Owner-authored only.** `estimateLineOnProposalCard` (`:78–81`) emits a number *only* when
  `value != null`. `estimateLine` — the formatter that manufactures `0` — **does not appear in
  `Proposals.jsx`** (`S8`, and I confirmed by grep). Rendered proof, side by side, in my screenshot: a
  card with an owner-recorded 75 reads `Could run on its own: 75 out of 100`; the card next to it, whose
  goal has no estimate, reads `Could run on its own: no — you haven't estimated this one`. No
  manufactured `0` sits beside a real `75`. That is d2's boundary holding at the level where it is decided.
- **The runners-up.** The `passedOver` block is byte-untouched in the diff; `B5` asserts every rendered
  runner-up contains **no digit at all** (with an arity guard so it cannot pass vacuously); my screenshot
  shows `Some other goal — it can wait`, numberless.
- **The spine.** The four render in the detail page's intent block, above `Resources`; `RecordEntry` is
  untouched and `S9` bounds it structurally.
- **The system-generated-ranking prohibition.** No ordering, filtering, grouping or badge was added;
  `B7` proves rendered order equals sent order against an adversarial mock; `U14` proves the module
  exposes no rank/order/compare export.
- **`the-proposal-loop`'s pins are green *unmodified*** — S11 `:2994`, S13 `:2996`, H2 `:3000` in my log,
  with `git` confirming the file is untouched on this branch by this story. I also re-ran S11's own regex
  directly against the new `Proposals.jsx` and against `goalIntent.js`: no hit for
  `/\bscore\b|\brank\b|\bpercent|\bgauge\b|★|⭐|toFixed\s*\(/i` in either.

The width matches the epic's decision 8 verbatim ("scoped to owner-authored values only"). **Nothing
wider shipped.**

### 3. Deviation 3 — adequately recorded; an ADR amendment is not needed

The deviation records that the estimate + flags line is one element, and that `B6` scopes its no-digit
assertion to the innermost element carrying `LABEL_ESTIMATE` — so putting a date or a count into that
same element would break AC4's card boundary.

I judge this **adequately recorded**, for four reasons:

1. It is a consequence of a decision the ADR already made, not a new one. **d5 pins that element's
   content exactly** (one `<p className="brain-proposal-whynow">` carrying the `·`-separated line). An
   editor who adds a date to it has already departed from d5; the deviation only names what breaks.
2. The constraint is a property of the *test's* scoping choice, and the test says so itself, in the place
   an editor of that test will read it: `tests/brainstorm/goal-intent-screens.spec.js:424–428` —
   *"Scoped to the innermost element carrying the label so a date elsewhere on the card cannot make this
   pass or fail by accident."*
3. The failure mode is loud and self-diagnosing: `B6` prints `Estimate area read: "…"` with the offending
   text, so a future editor is told exactly what tripped it.
4. `## Deviations` is the harness's designated home for "judgment calls too small for an ADR amendment,"
   and `/close-book` harvests it into `audit.md`. An amendment here would be ceremony for a constraint
   that is already stated twice.

### 4. The record-rendering clause — Amendment 1's ruling holds, and I verified the premise it rests on

Amendment 1 rules AC1's *"on a record-rendering screen, all four remain visible as stored"* a **regression
guard, not a capability test**. That is only true if the capability was already true before this story. I
checked the mechanism rather than accepting the claim:

- `src/lib/brain/goals.js:302–310` — `pickIntentFields` writes the four into the goal **section** of the
  stored element JSON (`parsed.tapestryOwnerGoal`, read back at `:40–63`). Story 1's write path puts them
  *in the record*, not in a side table.
- `ui/src/pages/concepts/ElementDetail.jsx:93–97` — `fullJson` is `JSON.parse(elem.json)` whole, with no
  projection; `:403` and `:545` render `JSON.stringify(fullJson, null, 2)`. No key whitelist, no `pick`.
- Therefore the four appear on that screen the moment story 1 stores them, and nothing in *this* story
  could make them appear there. The only thing this story could do is break it — and its diff does not
  touch the file at all.

`S12` guards the two stringify sites and the absence of a whitelist. **The ruling holds**, and the
decision not to write a browser test for it is right: driving that screen would test the class's
membership property, not this story.

---

## Eyeball — the thing no test asserts

The test plan explicitly leaves "visual layout, colour, typography" to me. I drove the three screens
through headless chromium against the served bundle with the spec's own fixtures and looked at the result.

- **Goals list.** `.brain-goal-main` is a flex column, so the two new lines stack cleanly under the goal
  name at 0.8 rem in `--text-muted` — the same weight and colour as the existing viability hint. No badge,
  no chip, no colour keyed to a value. Reads: `Could run on its own: 75 out of 100 · Needs you: no · Too
  big as it stands: yes`, then the prompt excerpt ending in `…`.
- **Goal detail.** The four sit with `Done means:` / `Stays inside:` in the same `<strong>label</strong>
  value` idiom, above `Resources`. `white-space: pre-wrap` works — the markdown prompt keeps its heading,
  blank lines and numbered list, with no renderer and no `innerHTML`.
- **Proposals.** The decisive one, and it renders exactly as d2 intends (see judgment 2 above). The
  Approve/Skip pair, the skip field, the empty/error states and the "considered instead" block are
  visually unchanged.

Register: the copy is plain-language and consistent with the surrounding screens. `Could run on its own:` /
`Needs you:` / `Too big as it stands:` avoid every system word. No jargon, no exclamation marks in any
owner-facing string (`R5` re-checked; the three `!` characters in `goalIntent.js` are inside the header
comment that *quotes the bug*, which is what the ADR asked for and what `S4`'s comment-masking anticipates).

---

## Concept-graph integrity

- **No concept added, none redefined.** The ADR's orientation was done through
  `/api/concept-graph/summaries` → `…/neighbors` → the schema node, not from BIBLE.md, and it is recorded
  in the ADR's Context.
- **Firmware reinstall: not required, and correctly called out** (ADR Consequences). The live schema node
  already declares all four; the goal concept is runtime-created and never firmware-seeded; this diff
  changes client rendering only.
- **Handles.** No handle is constructed in this diff. The only `kind:pubkey:slug` strings anywhere near it
  are test fixtures inside `page.route` mocks.
- **TA pubkey: never hardcoded.** `git diff … -- ui/ | grep -E "[0-9a-f]{60,}"` returns nothing. The
  production diff touches no pubkey at all.

## Things tests can't catch

- **Secrets:** none. No key, token or pubkey literal in the production diff.
- **Debug code:** none. No `console.*`, `debugger`, `TODO`, `FIXME` or commented-out code in the four
  production files.
- **Race conditions:** N/A — four pure functions and pure render expressions; no async, no state, no
  effect added.
- **Security:** the prompt renders as text through React's default escaping. No
  `dangerouslySetInnerHTML`, `<iframe>`, `<embed>`, `<object>` (re-checked directly, and `attach-the-world`
  S6 re-passes). A markdown renderer was correctly rejected in the ADR (Option F) rather than smuggled in.
- **Error paths:** `promptDisplay` is total over every value a parsed record can hold (`U13`, 11 shapes ×
  4 formatters). `String(value)` on a JSON-parsed value cannot throw.
- **Scope creep:** none. The diff is the ADR's file list and nothing else. The two out-of-book working-tree
  entries (`OPEN.md` row 115, `product-team/discoveries/second-brain-prior-art.md`) belong to a concurrent
  session, are not in this commit, and were left untouched.
- **Frame integrity:** the book's **generated** Direction section was not hand-edited — `book.md` does not
  appear in this commit at all. The acceptance frame is neither widened nor narrowed: storing and showing
  only, nothing acts on the four, no new screen.

## House rules check

- Concept Graph API authority respected (orientation before source, recorded in the ADR).
- No new lint/typecheck/build tooling; `package.json`, `ui/package.json`, `playwright.config.js` and
  `vite.config.js` are all untouched.
- Per-deployment TA pubkey resolved at runtime everywhere — this diff introduces no use of it.

---

## Findings

### Blocking

**None.**

### Non-blocking

1. **`ui/src/pages/brain/Goals.jsx:187`** — every goal row now gains two lines, and on the live corpus
   **23 of 31 rows will read the identical sentence "No prompt written yet."** This is *required* by
   AC1 + AC2 (the prompt must appear as text on list-type screens, and a never-set prompt must say so),
   so it is not a defect and not a change I'm asking for. But it roughly triples the Goals list's height
   for a payload that is 74% one repeated sentence. Worth carrying to the book's return edge as a product
   observation — the operator can overrule epic decision 9(b) (a PO call, explicitly flagged overrulable)
   without disturbing anything else.
2. **`ui/src/utils/goalIntent.js:68` vs `:78`** — the same never-set goal reads `0 out of 100` on the
   Goals list and `no — you haven't estimated this one` on the Proposals card. I confirmed this is visible
   in practice, not just theoretical. It is the ratified Option A cost, documented in ADR 0003 Consequences
   (c) and named there as the operator's single open lever (Option B is a one-line change to which
   formatter two screens import). Recorded, not asked.
3. **`ui/src/pages/brain/GoalDetail.jsx:195`** — the live 6 155-character prompt renders in full, pushing
   `Resources` and the record spine well below the fold with no collapse affordance. ADR debt (b),
   explicitly out of this story's ceiling (a disclosure control would be new screen machinery).
4. **`ui/src/styles.css:8202` / `brain-goal-hint`** — the hint class now carries two meanings on the Goals
   row (viability hint and intent lines). ADR debt (a), cosmetic, deliberately deferred to keep the "no new
   design tokens" criterion unarguable.

### Harness friction

1. **`engineering-team/roles/reviewer.md:22`** reads *"test: `npm test` (**or** `npm run test:playwright`)"*.
   For this story the two gates are conjunctive, not alternative — `npm test` going 37/0 on a build that
   renders nothing is the exact failure the Gate-3 kick-back found. It did not mislead me (the story, the
   ADR amendment and the test plan all shout it), but the role file is the first thing a Reviewer reads,
   and its "or" is the wrong conjunction for any story with a browser-visible surface. Suggest an OPEN.md
   `meta` row proposing *"run every gate the story's test plan names"*. **I have not added it** — `OPEN.md`
   is currently modified by a concurrent session and is outside this book; the row is for whoever commits
   to add or consciously skip.

## Verdict

**PASS**

The diff is mergeable as-is. It does exactly what the ADR specifies, on exactly the files the ADR names,
with no server change, no new dependency, no new screen and no new token. The one design decision the
whole story turns on — a number appears only where the owner recorded one — is correct in the code, proved
at the rendering level, and visible on screen. Every closed-book pin the supersession could have broken is
green **without being re-aimed**, which is the strongest available evidence that the supersession is as
narrow as it claims.

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place (no file moved — retirement is per-epic).
- [x] Completion detection run — see below. `/close-book` **offered, not run**.

### Completion detection

`goal-intent-fields` now has all three stories `Done`, and it is the book's only epic. Every bullet of the
acceptance frame is satisfied by what shipped:

| Frame bullet | Satisfied by |
|---|---|
| Each of the four can be **set when a goal is captured** | story #1 (40/0) |
| Each of the four can be **set when a goal is updated** | story #1 (40/0) |
| **All four come back on every surface that shows a goal** | story #2 (54/0) + story #3 (37/0 + 8/8 browser) |
| **Storing and showing only** — no rules about which prompts may run | held; no rule was added anywhere |
| **Nothing acts on** the estimate or the flags | AC4 — `B7`, `S6`, `S7`, `U14` |
| **No new screen is built** | AC3 — `S5`; `App.jsx` / `Layout.jsx` untouched |
| Surrendered items stated **and reasons given** | `book.md` → "Knowingly surrendered in this mode" |

**The book looks complete.** Offered to the operator; the system proposes done, it does not declare it.
