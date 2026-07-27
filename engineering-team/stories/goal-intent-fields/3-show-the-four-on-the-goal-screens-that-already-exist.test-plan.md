# Test Plan: Story 3 — Show the four on the goal screens that already exist

**Story:** `engineering-team/stories/goal-intent-fields/3-show-the-four-on-the-goal-screens-that-already-exist.md`
**ADR:** `engineering-team/decisions/goal-intent-fields/0003-screen-side-intent-display-and-the-narrow-d13-supersession.md`
**Book:** `engineering-team/audits/store-and-show-the-prompt-and-the-estimate/book.md`
**Date:** 2026-07-27
**Suite:** `test/show-the-four-on-the-goal-screens-that-already-exist.test.js` — 36 tests, registered in `test/test.js`

---

## The one thing this suite exists to pin

Stories 1 and 2 shipped a guarantee: **a never-set property arrives as `null`, and a stored `0` /
`false` / `''` arrives verbatim.** This story spends that guarantee at the screen — and the screen is
where it is easiest to throw away:

| written this way | what it does to a live record |
|---|---|
| `!goal.chanceOfSuccess` | a stored `0` reads as never-set |
| `!goal.needsHumanInput` | a stored `false` reads as never-set — **7 live goals store exactly that** |
| `!goal.prompt` | a prompt set to empty reads as never-set |

A test a falsiness implementation would still pass has not tested this. **Four tests fail under
falsiness and I ran a falsiness implementation to prove it** (see *Adversarial verification*):

- **U4** — `estimateLineOnProposalCard(0)` must render the number; `(null)` must render words. Under
  `v ? number : words` the stored `0` takes the words branch.
- **U5** — the two estimate formatters must agree at `0` and differ at `null`. Falsiness inverts that.
- **U7** — `promptDisplay('')` is `empty`, `promptDisplay(null)` is `unset`, and the two texts differ.
  Under `if (!p) return UNSET` they collapse into one.
- **S4** — the structural pin: no `!`, `?`, `||`, `&&`, `if (x)` or `Boolean()` guard on any of the
  four, anywhere in the module or the three screens.

**One case is deliberately *not* discriminable, and the plan says so out loud.** AC2 makes a never-set
flag display the declared default `false`, and a stored `false` also displays `false` — so on screen
they legitimately look identical. No unit assertion can catch falsiness on a flag. **S4 is the only
pin for that case**, which is why it is structural rather than behavioural. A reviewer should treat
S4 as load-bearing, not as belt-and-braces.

---

## Coverage map

Every acceptance criterion maps to more than one test. `U` = pure unit (stack-free, gates CI),
`S` = structure-bounded source assertion (stack-free), `H` = live local stack (read-only, skips when
absent), `R` = regression sentinel (passes before *and* after).

| Criterion | Test | Level |
|---|---|---|
| **AC1** all four visible; estimate + flags as values | `U1` the three screens share one formatter that knows how to show each of the four | unit |
| AC1 | `U2` an estimate the owner recorded is shown as the number they recorded | unit |
| AC1 | `U6` a flag set to true reads differently from one set to false | unit |
| AC1 | `S2` all three goal screens draw their wording from the one shared formatter | source |
| AC1 | `S3` all three goal screens render all four — estimate, both flags, prompt as text | source |
| **AC1** prompt **as its own text**, excerpt on list-type screens | `U9` a long multi-line prompt becomes an excerpt of the prompt's **own opening**, on one line | unit |
| AC1 | `U10` a prompt that already fits is shown whole, with no truncation mark | unit |
| **AC1** prompt **in full** on the goal detail | `U11` with truncation off the prompt comes through byte-identical, every line preserved | unit |
| AC1 (no bare presence indicator) | `S3` (`promptDisplay(` required) + `S4` (a `{g.prompt && <badge/>}` guard is a falsiness guard and fails) | source |
| AC1 (malformed stored value) | `U12` a malformed stored estimate is shown as stored — the screen adds no type rule | unit |
| AC1 (record-rendering class unchanged) | `S9` the four never enter `RecordEntry`; `S10` the three hooks name none of the four | source |
| **AC2** never-set estimate shows the declared `0` (Goals list, Goal detail) | `U3` an estimate nobody set is shown at the declared default of 0 | unit |
| **AC2** never-set estimate on the Proposals card (ADR d2) | **`U4`** a stored 0 is a number and a never-set estimate is words | unit |
| AC2 (d2's boundary) | **`U5`** the two formatters agree where the owner recorded a value, differ only where nobody did | unit |
| **AC2** never-set flags show the declared `false` | `U6` a flag nobody set reads exactly as a flag set to false | unit |
| **AC2** never-set prompt shown explicitly as *not set* | **`U7`** unset / empty / text are three different things | unit |
| AC2 (never a literal `null`/`undefined`, never a blank area) | `U8` a prompt nobody wrote says so in words | unit |
| AC2 (renders without error) | `U13` every formatter answers without throwing for every value a record can hold | unit |
| AC2 (the falsiness prohibition, structural) | **`S4`** no screen and no formatter decides "not set" by falsiness | source |
| **AC3** no new screen, no new route | `S5` `ui/src/pages/brain/` holds exactly three files; App.jsx route count and Layout.jsx nav count frozen | source |
| AC3 (no new component / design token) | `S1` the formatter is a plain utility, not a component; `S11` no new `--` custom property | source |
| **AC4** nothing acts on them; order identical to before | `S6` no sort/filter/reduce/reverse/useMemo region on the three screens names any of the four | source |
| AC4 (no badge-driven prioritization) | `S7` none of the four drives a colour, a badge or a conditional style | source |
| **AC4** the estimate on the Proposals card is the owner's own recorded value | **`U4`** (no digit where nothing was recorded) + **`S8`** (`estimateLine` may not appear in `Proposals.jsx`) | unit + source |
| AC4 (no ordering helper exists at all) | `U14` the shared formatter exposes no rank/order/compare/filter export | unit |
| **The narrow supersession stays narrow** (ADR d1) | `S8` the words-only formatter is used on the card and nowhere else | source |
| d1 — d13's reach over `passedOver` is untouched | `S9` the runners-up block names none of the four | source |
| d1 — d13's reach over the spine is untouched | `S9` `RecordEntry` names none of the four | source |
| d1 — the system-generated-ranking prohibition survives | `R1` (source, closed-book pin) + `H5` (live card keys) | source + live |
| **Attribution** — a blank screen is *this* story's defect, not story 2's | `H2` `H3` `H4` the three reads still carry all four | live |
| Evidence that the live cases exist at all | `H1` census of the live corpus | live |
| Shipped pins from **closed books** must stay green | `R1` `R2` `R3` `R4` re-asserted against the **new** file contents | source |
| The gap those pins cannot reach | `R5` the shared module's copy held to the same register | source |
| Stories 1 and 2 untouched (client-only) | `R6` `pickIntentFields` / `projectIntentFields` contracts, stack-free | unit |

---

## Edge cases — explicit tests, not just the happy path

- [x] **A stored `0` estimate** — U4 (card), U3/U5 (list + detail). *The falsiness killer.*
- [x] **A stored `false` flag vs a never-set flag** — U6 asserts they render the same **and records
      that this is why S4 exists**; a stored `false` is on 7 live goals (H1).
- [x] **A prompt set to the empty string, and one of pure whitespace** — U7 (`empty`, distinct from
      `unset`).
- [x] **A 10 762-character, 168-line markdown prompt** — U9 (collapsed to one line, bounded, begins
      with the prompt's own opening, marked as truncated) and U11 (verbatim with `max = 0`).
- [x] **A prompt shorter than the excerpt bound** — U10 (no truncation mark that would claim text
      that was never cut).
- [x] **A malformed / out-of-range / non-numeric estimate** (`'lots'`, `150`, `-3`, `'75'`) — U12.
      Type validation on read is out of scope; a malformed value renders as stored.
- [x] **Every value a stored record can hold, through every formatter** — U13: `null`, `undefined`,
      `''`, `'   '`, `0`, `false`, `true`, `42`, `'text'`, `{}`, `[]` × 4 formatters = 44 checks,
      arity-asserted.
- [x] **A goal with none of the four** — H3 drives the live detail read for one (23 of 31 live goals).
- [x] **A proposal whose nominated goal has no estimate** — H4. On this instance that is not an edge
      case: it is the **only** live proposal.
- [x] **The live proposal queue is empty** — H4/H5 return `SKIP`, never a silent pass (OPEN.md #108).
- [x] **Concept Graph API / stack unavailable** — every H test skips; the U and S classes still gate.

**Not covered, and why:** rendered pixels. This project has no browser test harness for the control
panel, and ADR 0003 explicitly declines to ratify one ("adding one is new tooling the house rule
forbids without its own ADR"). Playwright exists in the repo but targets a deployed instance, not the
React tree. AC1's *"visible"* is therefore proved as **(the formatter produces the right text — U)
× (the screen puts the goal's value through that formatter and renders it — S)**. That composition is
the ADR's own sanctioned level; the residue is a Reviewer eyeball on the three screens, listed below.

---

## Test infrastructure

- **Framework:** Node's built-in runner, `npm test` (entry `test/test.js`). No new framework.
- **New suite:** `test/show-the-four-on-the-goal-screens-that-already-exist.test.js`, wired into
  `test/test.js` (require, `await run()`, summary line, `H-class` roll-up line, `overallOk` conjunct,
  `totalSkipped` list). **That is the only file outside the new suite that this phase touched.**
- **Loading the formatter:** `ui/src/utils/goalIntent.js` is ESM (`ui/package.json` is
  `"type": "module"`), so the U-class loads it by dynamic `import()` of the plain `.js` — the
  `test/pov-notice-text.test.js` precedent. The harness cannot parse `.jsx`, which is exactly why
  ADR 0003 d3 puts the rules in a util.
- **Live API:** `localhost:$TAPESTRY_PORT` (7778 on this machine — `bin/control-panel.js` default;
  `/etc/brainstorm.conf` does not exist on the host, the stack is in Docker). H-class reads go over
  the container loopback (`docker exec tapestry curl 127.0.0.1:7778`) because host-side brain reads
  return 403.
- **Firmware state:** **no `POST /api/firmware/install` precondition.** ADR 0003 adds no concept and
  redefines none; the goal concept is runtime-created and has never been firmware-seeded.

### Prerequisites for the live (H) class

Read-only, but they depend on graph state:

1. The stack must be up (`docker exec tapestry`, control panel on `$TAPESTRY_PORT`). Otherwise all
   five H tests skip.
2. `GET /api/brain/goals`, `/api/brain/goals/:slug`, `/api/brain/proposals` must return the four —
   i.e. **`goal-intent-fields` #2 must be shipped** (it is, on this branch). H2/H3/H4 exist precisely
   to say so out loud when a screen shows nothing.
3. The live corpus must still contain the discriminating cases. **H1 asserts this rather than
   assuming it**, and prints a census. Measured 2026-07-27:
   `{"total":31,"withPrompt":1,"longestPrompt":6155,"multiLinePrompt":1,"withEstimate":7,
   "storedFalse":7,"storedTrue":3,"noneOfTheFour":23}`
4. H4/H5 additionally need at least one **open** proposal. Live today: 1 open, nominating a goal with
   **no recorded estimate** — d2's live case. If the queue empties, both return `SKIP`.

### Fixtures

**None are written.** No test creates, mutates or deletes a goal, a proposal or any graph node.

> **Deliberate deviation from ADR 0003's H-class suggestion, recorded rather than silent.** The ADR
> proposes a sentinel-fixture pair (a goal with all four, a goal with none). I chose the read-only
> route that `goal-intent-fields` #2 established, for two reasons: (a) the live corpus already
> contains **every** case the fixtures would have created — H1 asserts each one and fails loudly if
> that stops being true; and (b) neo4j is the definitive "me" (CLAUDE.md principle 4), so writing
> fixtures into it is real risk for coverage the stack-free U-class already provides
> deterministically. The H-class's job here is **attribution**, not determinism.

Synthetic fixtures used by the U-class (in-suite, no I/O): a 168-line, 10 762-character markdown
prompt modelled on the live 6 155-character one, a short one-line prompt, and the eleven-value
tolerance list.

---

## Harness defects this suite is built around

| OPEN.md | The defect | What this suite does |
|---|---|---|
| **#104 / #106** | A fully-skipped H-class still reports suite **PASS** | `run()` prints `show-the-four: H-class n executed / m skipped`, shouts when the live class did not run at all, and **fails the suite** under `TAPESTRY_REQUIRE_LIVE=1`. The reachability probe retries three times (the recorded false-negative mode). `test/test.js` prints the roll-up line too. |
| **#108** | Tests iterating a collection the feature does not produce pass **vacuously** | Every sweep asserts arity **first** and counts the comparisons it made. `S6` fails if it found fewer than 2 sort/filter/group regions; `S7` fails if not one line mentions any of the four (**it fails today for exactly that reason** — the honest signal that the feature is absent); `S9` fails if the `passedOver` block was not found; `H2`/`H3`/`H4`/`H5` each assert their check count. `H4`/`H5` return **SKIP**, not PASS, on an empty queue. |
| **#109** | Byte-offset source assertions fail on correct code **and** pass on broken code | No `src.slice(start, start + N)` anywhere. `RecordEntry` is bounded by the **next top-level declaration**; every call region is bounded by **paren balance** computed on a comment/string-masked copy that preserves offsets. **This bit me during authoring and the fix is recorded in the suite:** my first masker treated every `'` as a string delimiter, so the apostrophe in the JSX prose *"The proposer couldn't run"* opened a phantom string that swallowed 40 lines of `Proposals.jsx` — including the whole `passedOver` block `S9` bounds. A quote is now a delimiter only when its partner is on the **same line** (true of every real JS string, false of a JSX apostrophe); template literals keep multi-line handling. |
| **#111** | `EXIT=${PIPESTATUS[0]}` under `\| tee` is bash and evaporates in this zsh | Every run below used the brace form `{ npm test; echo "EXIT=$?"; } > log 2>&1`, and the verdict was read from the `Overall:` line **and** the echoed code — never from a notification. |
| **#75** | `relationship-primitives` H8 / `-probe` H4 bracket a *global* strfry count while the router imports continuously | Unrelated to this story. Reported separately below if it fires; not fixed here. |

Two further traps this suite closes that no ledger row names yet:

- **Masked comments, not masked strings, for the falsiness scan.** ADR 0003 d3 instructs the
  Implementer to write a header comment that *quotes* the bug (`if (!goal.prompt)`) in order to warn
  against it. A scan that read comments would fail on exactly the code that documents itself best, so
  `S4` masks comments and leaves strings intact (a falsiness pattern must never be hidden from it).
- **Moving copy into a util moves it out of the shipped scans' reach.** Four closed-book tests scan
  owner-facing strings *per `.jsx` file*. ADR 0003 moves the new owner-facing wording into
  `goalIntent.js`, where none of them looks. **`R5`** applies the union of those word lists — plus the
  no-exclamation-mark rule and the-proposal-loop S11's token ban — to the module itself.

---

## How to run

```
npm test                                    # the full gate
node test/show-the-four-on-the-goal-screens-that-already-exist.test.js   # this suite alone
TAPESTRY_REQUIRE_LIVE=1 npm test            # fail if the H-class did not execute
```

Read the verdict from the log, never from a notification (OPEN.md #111):

```
{ npm test; echo "EXIT=$?"; } > /tmp/gate.log 2>&1
grep -E "^EXIT=|^Overall:|^show-the-four" /tmp/gate.log
```

---

## Verification — the new tests fail, and they fail for the right reason

Confirmed 2026-07-27 at commit `19a6e428`, with the stack up (H-class **5 executed / 0 skipped**).

### The suite alone

```
=== show-the-four-on-the-goal-screens-that-already-exist (goal-intent-fields #3) ===
  FAIL  U1 (AC1/AC2): the three goal screens share one formatter that knows how to show each of the four
        ui/src/utils/goalIntent.js does not exist yet. ADR 0003 d3 puts every absence rule and every owner-facing
        string for the four in ONE pure module that all three goal screens import — so the null-vs-0-vs-false
        discrimination is written once, where a reviewer can check it. Without it nothing can be shown.
  FAIL  U2 (AC1): an estimate the owner recorded is shown as the number they recorded
  FAIL  U3 (AC2): on the Goals list and the Goal detail an estimate nobody set is shown at the declared default of 0
  FAIL  U4 (AC2/AC4 — THE discriminating test): on the Proposals card a stored 0 is a number and a never-set estimate is words
  FAIL  U5 (ADR d2): the two estimate formatters agree wherever the owner recorded a value and differ only where nobody did
  FAIL  U6 (AC1/AC2): a flag set to true reads differently from one set to false, and a flag nobody set reads as the declared false
  FAIL  U7 (AC2 — THE second discriminating test): a prompt nobody wrote, a prompt set to empty, and a prompt with text are three different things
  FAIL  U8 (AC2): a prompt nobody wrote says so in words — never a literal null, never a blank space
  FAIL  U9 (AC1): on a list-type screen a long multi-line prompt becomes an excerpt of the prompt's own opening, on one line
  FAIL  U10 (AC1): a prompt that already fits is shown whole, with no truncation mark
  FAIL  U11 (AC1): the Goal detail gets the prompt in full — every line of it, exactly as stored
  FAIL  U12 (AC1, tolerance): a malformed stored estimate is shown as stored — the screen adds no type rule
  FAIL  U13 (AC2): every formatter answers without throwing for every value a stored record can hold
  FAIL  U14 (AC4): the shared formatter offers no way to rank, order or compare goals by the four
  FAIL  S1 (story scope): the shared formatter is a plain utility, not a new component
        ui/src/utils/goalIntent.js is missing or unreadable (see U1).
  FAIL  S2 (AC1): all three goal screens draw their wording from the one shared formatter
        ui/src/pages/brain/Goals.jsx (the Goals list) must import ui/src/utils/goalIntent (ADR 0003 d3). One module
        means the three screens can never disagree about the same goal's absence rules, because there is one
        implementation of them.
  FAIL  S3 (AC1): all three goal screens render all four — the estimate, both flags, and the prompt as text
        ui/src/pages/brain/Goals.jsx (the Goals list) must show all four (AC1). It names [];
        missing ["prompt","chanceOfSuccess","needsHumanInput","needsBreakdown"].
  FAIL  S4 (AC2 — the falsiness pin): no screen and no formatter decides "not set" by falsiness
        ui/src/utils/goalIntent.js is missing or unreadable (see U1/S2).
  PASS  S5 (AC3): no new screen and no new route — the change lands only on the three screens that already exist
  PASS  S6 (AC4): nothing on these screens sorts, filters or groups by the four
  FAIL  S7 (AC4): none of the four drives a colour, a badge or a conditional style
        not one line across the three screens mentions any of the four, so this sweep inspected nothing and would
        have passed vacuously (OPEN.md #108). The feature is not implemented.
  FAIL  S8 (ADR d2): the words-only estimate belongs to the Proposals card, and the number-applying one never appears there
        ui/src/pages/brain/Proposals.jsx must use estimateLineOnProposalCard (ADR 0003 d2) — the one place a
        never-recorded estimate must render in words rather than as a manufactured 0.
  PASS  S9 (ADR d1): the four never enter the goal's record spine and never attach to a runner-up
  PASS  S10 (ADR d7): the three brain hooks are untouched — they already pass the four through
  PASS  S11 (story scope): no new design token is invented for the four
      live corpus census: {"total":31,"withPrompt":1,"longestPrompt":6155,"multiLinePrompt":1,"withEstimate":7,"storedFalse":7,"storedTrue":3,"noneOfTheFour":23}
  PASS  H1 (evidence — pass-by-design): the live corpus still holds every case these screens must render
  PASS  H2 (attribution): every goal the Goals list serves already carries all four, so a blank screen is this story's defect
  PASS  H3 (attribution): the goal detail read carries all four for a goal with a prompt and for a goal with none
      live proposal queue: 1 open, 1 with no recorded estimate
  PASS  H4 (attribution + AC4): the open proposal card carries all four, and today's live case is a never-recorded estimate
  PASS  H5 (second-brain 0006 d13, what survives — pass-by-design): the live proposal card carries no key that reads as a score, rank or percentage
  PASS  R1 (second-brain 0006 d13 / the-proposal-loop S11+S13): the Proposals view still shows no computed score, and no exclamation mark
  PASS  R2 (capture-a-goal-and-see-it S5b/S7/S8): the Goals view still carries no control vocabulary, no future standing word, and no jargon
  PASS  R3 (attach-the-world S6/S7 + sessions-read-the-brain S9/S10): the Goal detail stays display-only, with no way to inject markup
  PASS  R4 (teach-it-what-matters S12): the brain UI still references no priority-signal surface
  FAIL  R5 (the gap the shipped scans cannot reach): the shared formatter's owner-facing copy is held to the same register as the screens
        ui/src/utils/goalIntent.js is missing or unreadable (see U1).
  PASS  R6 (stories 1 and 2, stack-free): the write and read halves this story rests on are untouched
show-the-four: H-class 5 executed / 0 skipped

show-the-four-on-the-goal-screens-that-already-exist: 15 passed, 21 failed, 0 skipped
EXIT=1
```

**Every failure is "the feature is missing", not a typo or an import error.** Three distinct
right-reason shapes appear:

1. **The module does not exist** (U1–U14, S1, S4, R5) — `fs.existsSync` is checked before the dynamic
   import, so the message names the missing file and what it is for, never `ERR_MODULE_NOT_FOUND`.
2. **The screens do not consume it** (S2, S3, S8) — the files exist and are read successfully; the
   assertion names the missing import, the missing property names, and the missing formatter.
3. **The sweep inspected nothing** (S7) — the arity guard fires rather than passing vacuously.

**The 15 that pass today are pass-by-design and are listed in the suite header** so a green line is
never mistaken for evidence the feature landed: `S5 S6 S9 S10 S11` (AC3/AC4 hold by non-action),
`H1–H5` (story 2's reads, which this story consumes), `R1–R4` and `R6` (closed-book pins and the
story-1/2 contracts). **They must still pass after implementation.**

### Adversarial verification — proving the discriminating tests discriminate

A failing test proves the feature is absent. It does **not** prove the test would catch a *wrong*
implementation. So I built two throwaway `ui/src/utils/goalIntent.js` implementations, ran the suite
against each, and deleted them (verified: `git status --porcelain ui/src/` clean afterwards; no
production code was written by this phase).

**Probe A — the falsiness implementation** (`if (!prompt)`, `v ? … : …`, `flagWord = v => v ? …`):

```
  PASS  U1   PASS  U2   PASS  U3
  FAIL  U4  (AC2/AC4 — THE discriminating test)
  FAIL  U5  (ADR d2)
  PASS  U6
  FAIL  U7  (AC2 — THE second discriminating test)
  PASS  U8 … U14   PASS  S1
  FAIL  S4  (the falsiness pin)
  PASS  R5
→ 3 U-class failures + S4. The falsiness bug is caught four independent ways.
```

**Probe B — the ADR d3/d4 implementation** (`value == null` throughout, `promptDisplay` with three
states, two estimate formatters, `flagWord(v) = v === true ? 'yes' : 'no'`):

```
  PASS  U1 … U14   PASS  S1   PASS  S4   PASS  R5
→ all 14 U-class tests, plus the module's three source pins, pass.
```

This is the evidence that the U-class is **satisfiable by the design the ADR chose** (not
over-constrained) **and discriminating against the design it warns about**. Note that U6 passes under
falsiness — that is the flag case the plan flags above, and it is why S4 exists.

### The full gate

`{ npm test; echo "EXIT=$?"; } > gate3-full.log 2>&1` — 3 790 lines, ~28 minutes, stack up.
**`show-the-four` is the only failing suite in the entire gate.**

```
$ grep -nE "suite: +.*FAIL" gate3-full.log
3786:show-the-four suite:                             FAIL (15 passed, 21 failed)

$ grep -E "^(store|return|show)-the-four|^Total skipped:|^Overall:|^EXIT=" gate3-full.log
store-the-four suite:                            PASS (40 passed, 0 failed)
store-the-four H-class:                          11 executed / 0 skipped
return-the-four suite:                           PASS (54 passed, 0 failed)
return-the-four H-class:                         8 executed / 0 skipped
show-the-four suite:                             FAIL (15 passed, 21 failed)
show-the-four H-class:                           5 executed / 0 skipped
Total skipped:                                   51
Overall:                                         FAIL
EXIT=1
```

**Siblings 1 and 2 stay fully green and untouched** — 40/0 and 54/0, with their live classes
executing (11 and 8, 0 skipped). No sibling test was modified by this phase.

**Every pin ADR 0003 says must survive, verbatim from the same log:**

```
PASS  S11 (AC6): the Proposal view renders NO numeric score — no score/gauge/percentage/star affordance
PASS  H2 (AC6): the queue card carries NO numeric score field — comparisons and words only
PASS  S13 (AC7): the Proposal view carries no banned jargon and no exclamation marks
PASS  S5b (AC 5): the privacy line is an indicator — no toggle/control vocabulary in the view
PASS  S7 (AC 2/AC 6): standing words in the view stay within the canonical set the epic has reached
PASS  S7 (ADR d10 / AC 6): the Goal detail carries no write/edit affordance — the record section is append-only
PASS  S8 (AC 2/AC 7): the Goal detail's new owner-facing strings are jargon-clean …
PASS  S9 (ADR d12 / AC 3/AC 6): the record entry renders session, questions, and produced pointers — still no edit affordance
PASS  S10 (AC 7): the Goal detail's new owner-facing strings are jargon-clean
PASS  S12 (ADR d14 — sentinel, zero UI diff): no brain UI file references signals …
```

`the-proposal-loop.test.js:615` (**S11**) and `:705` (**H2**) — the two the narrow supersession is most
likely to break — pass **unmodified**. Suite roll-ups: `the-proposal-loop` 33/0,
`capture-a-goal-and-see-it` 27/0, `attach-the-world` 29/0, `sessions-read-the-brain` 30/0,
`teach-it-what-matters` 27/0, `break-a-goal-into-pieces` 30/0, `the-brain-survives` 31/0,
`structures-the-brain-can-trust` 24/0, `operational-direction` 86/0.

**OPEN.md #75 did not fire this run** — `relationship-primitives` 23/0 and
`relationship-primitives-probe` 9/0, no strfry scan-count drift. (If it fires on a later run it is
the known environmental signature, unrelated to this story, and must be distinguished rather than
fixed here.)

**Total skipped: 51** — all pre-existing publish-flow suites whose preconditions were unmet; none of
them belongs to this epic, and this suite contributed 0 skips.

**Files this phase touched, in full:**

```
?? test/show-the-four-on-the-goal-screens-that-already-exist.test.js   (the failing suite)
?? engineering-team/stories/goal-intent-fields/3-…​.test-plan.md        (this plan)
 M test/test.js                                                        (+12 −1: registration only)
 M OPEN.md                                                             (row 112 new; #109 and #111 occurrence notes)
```

`test/test.js` gains only the require, the `await showTheFour.run()` call, the summary line, the
`H-class` roll-up line, the `overallOk` conjunct and the `totalSkipped` entry. **No production code
and no sibling test was written or modified.** The two throwaway probe implementations were deleted;
`git status --porcelain ui/src/` is clean.

---

## What this suite deliberately does not assert, and who covers it

| Not asserted | Why | Who covers it |
|---|---|---|
| Rendered pixels / a real browser | No browser harness for the control panel; ADR 0003 declines to add one (house rule: no new tooling without an ADR) | Reviewer eyeball on the three screens |
| **`git diff --stat -- src/` is empty** | A test has no stable baseline to diff against mid-branch | **Reviewer must run it.** ADR 0003: "everything under `src/` — the story is client-only and a server diff means the extent was mis-derived." `R6` covers the *contracts*, not the diff |
| The exact owner-facing wording | The story says copy is "a review consideration, not an externally testable criterion" | Reviewer's register audit. The suite pins *structure* (three distinct states, words vs numbers, no jargon, no `!`), never a sentence |
| `.brain-detail-prompt { white-space: pre-wrap; }` by name | A class name is an implementation detail the ACs do not pin; `S11` pins the criterion that *is* in the story (no new design token) | Reviewer against ADR d8 |
| ADR 0006's reciprocal `**Amended by:**` pointer | Written in the ADR's own commit; a second one at implementation is a defect | Reviewer |
| OPEN.md row 102 (schema `required`) and `dependsOn` | Out of this epic by the book's own words | Neither fixed nor evidenced here |

---

## Open questions for the Product Owner / Architect

**None blocking.** Two things the Implementer should know are decided:

1. **`estimateLineOnProposalCard` is pinned as a separate function name** (`S8`, `U5`). ADR d3 names
   it and d2 makes it a contract rather than a helper; the suite enforces that
   `Proposals.jsx` uses it and that `Goals.jsx` / `GoalDetail.jsx` do not. If the operator exercises
   ADR 0003's *"single open lever"* (Option B — uniformity, or Option C — widen the supersession),
   **U3, U4, U5 and S8 are the tests to re-aim**, and the change is small in each.
2. **`PROMPT_EXCERPT_MAX` is required as an export, but its *value* is not pinned.** U9 asserts only
   that the excerpt is bounded by whatever the module declares, is strictly shorter than a
   10 762-character prompt, keeps the prompt's own opening, and marks its truncation. `140` is the
   ADR's choice and the suite does not hard-code it.
