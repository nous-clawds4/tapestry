# ADR 0003: The screen is the interpretation point — one pure `goalIntent` formatter feeding the three screens that already exist; and a number appears only where the owner recorded one, which is exactly the width of the ratified supersession of `second-brain` 0006 d13/AC6

**Status:** Proposed
**Date:** 2026-07-27
**Story:** `engineering-team/stories/goal-intent-fields/3-show-the-four-on-the-goal-screens-that-already-exist.md`
**Amends:** `second-brain` ADR 0006 — **d13 / AC6 only**, narrowly and explicitly (see d1 below). ADR 0006
remains **Accepted** and in force in every other respect; its *system-generated*-ranking prohibition is
untouched. **ADR 0006's header carries the reciprocal `**Amended by:**` pointer as of this ADR's own
commit** — one line added, zero removed, body and Status untouched. That placement is the same-flow
precedent, verified in git rather than assumed: `second-brain` 0002's pointer and
`operational-direction` 0001's pointer were each written in the amending ADR's `adr:` commit
(`d7bd8b53`, `8da154ec`), not in a later `impl:` one. (`community-reference` 0027/0028 differ because
that is the Protocol-Spec docs-mode flow, where the `spec:` commit *is* the implementation step.)
**Builds on:** `goal-intent-fields` ADR 0001 (the write half; `INTENT_FIELDS`, absence as key-absence) and
ADR 0002 (the read half; `projectIntentFields`, absence as `null` on the four projecting responses) — both
**shipped on this branch**. This ADR consumes ADR 0002's contract and adds no server code.

## Context

Stories 1 and 2 made the four intent properties storable and returnable. Verified live from inside the
container 2026-07-27, all three of this story's screens' data sources already carry them:

| Read surface | verified today |
|---|---|
| `GET /api/brain/goals` | 19 keys/row, ending `prompt, chanceOfSuccess, needsHumanInput, needsBreakdown` |
| `GET /api/brain/goals/:slug` | `goal.chanceOfSuccess = 75`, `needsHumanInput = false` on `store-and-show-…` |
| `GET /api/brain/proposals` | card keys include all four |

So this story is **client-only**: nothing under `src/` changes, and a diff that touches `src/` is a defect.

### Acceptance criteria, quoted back

- **AC1** — all four visible on each projecting screen; the estimate and both flags **as values**; the
  prompt **as its own text** — in full on the goal detail screen, an **excerpt of the actual prompt** on
  list-type screens. A bare badge/icon/"has prompt" label satisfies nothing, on any screen.
- **AC2** — a goal with none of them stored still renders; **the three that declare a default show it —
  the estimate `0`, both flags `false`**; the prompt, which declares none, is shown **explicitly as not
  set** (never a literal `null`/`undefined`, never indistinguishable from a prompt set to empty). *"The
  screen is the interpretation point."*
- **AC3** — no new screen, no new route.
- **AC4** — nothing acts on them: which goals appear, and in what order, is identical to before. No
  sorting, filtering, grouping or badge-driven prioritization. **On the Proposals screen the estimate
  appears as the owner's own recorded value** — not a score, gauge, percentage bar or ranking number, and
  not attached to any runner-up ordering.

### Concept-graph orientation (before any source file was opened)

Three calls, in order, from inside the container — host-side brain reads 403. `<TA>` came from
`GET /api/assistant/pubkey` at runtime and is written down neither here nor in code (house rule).

1. `GET /api/concept-graph/summaries` → 57 concepts; the one this story shows is
   `39998:<TA>:tapestry-owner-goal` ("goals of the owner / operator of this tapestry instance").
   `39998:<TA>:tapestry-proposal` is the card's own concept (a nomination naming one goal).
2. `GET /api/concept-graph/node/39998:<TA>:tapestry-owner-goal/neighbors` → eight machinery edges;
   `IS_THE_JSON_SCHEMA_FOR` → `39999:<TA>:tapestry-owner-goal-schema`.
3. `GET /api/concept-graph/node/39999:<TA>:tapestry-owner-goal-schema` → the declarations that AC2 turns
   into rendering rules. **These are not symmetric, and the asymmetry is the whole of AC2:**

| property | type | what the concept declares |
|---|---|---|
| `prompt` | string | **no `default` key and no default in the prose.** "A markdown file … the prompt given to an agent at the start of a session" |
| `chanceOfSuccess` | number | **no `default` key**; the default lives in the *description*: "A number between 0 and 100 … **The default is 0, if not otherwise estimated.**" |
| `needsHumanInput` | boolean | **`default: false`** + "Absent means false." |
| `needsBreakdown` | boolean | **`default: false`** + "Absent means false." |

**This ADR adds no property and redefines none.** The proposal schema
(`39999:<TA>:tapestry-proposal-schema`) is likewise untouched: `{name, slug, description, summary, type,
goal, whyNow, passedOver[], proposalId, reason, happenedOn}` — it carries no estimate of its own, which is
why the card's estimate is *the goal's*, read through `recordBySlug` (ADR 0002 d9).

### The live corpus, which decides which cases are the common path

`GET /api/brain/goals`, 31 goals, read 2026-07-27:

- **`prompt` is set on exactly 1 of 31**, and that one is **6 155 characters** of multi-line markdown.
- `chanceOfSuccess` set on 7: values `15, 25, 50, 65, 75, 75, 80`. **No goal stores `0`.**
- `needsHumanInput` set on 8 — **5 store `false`, 3 store `true`**.
- `needsBreakdown` set on 7 — all `false`.

Two consequences bind the design. A 6 155-character prompt on a 31-row tree row is not a styling nit — it
is the reason AC1 says *excerpt* on list-type screens. And **`false` is a stored value on live records**,
so the screen's rendering of `false` and of never-set must both exist and may legitimately look the same
(the screen is where the default is applied) — but the code must never conflate them by falsiness.

**The decisive live fact for the hard question below:** there is **one open proposal today**
(`proposed-decide-what-a-session-receives-…`), and its nominated goal has **all four unset**. On the
Proposals screen the never-set estimate is not an edge case — right now it is the *only* case.

### The extent, re-derived rather than inherited

The query a gate can re-run is `grep -rn "api/brain" ui/src/`. It returns exactly four hits in three hook
files plus one export call in `Goals.jsx`:

| hook | consumer | screen |
|---|---|---|
| `useBrainGoals` → `/api/brain/goals` | `ui/src/pages/brain/Goals.jsx:30` | the Goals list |
| `useBrainGoalDetail` → `/api/brain/goals/:slug` | `ui/src/pages/brain/GoalDetail.jsx:98` | the Goal detail |
| `useBrainProposals` → `/api/brain/proposals` | `ui/src/pages/brain/Proposals.jsx:24` | the Proposals queue |

**Three projecting screens, no fourth. The story's inventory reproduces exactly; the kickback clause does
not fire.** `Goals.jsx`'s fifth hit is `fetch('/api/brain/export')` (`:43`) — a download, not a display.
**All three hooks pass the parsed JSON straight through** (`setGoals(json.goals)`, `setGoal(json.goal)`,
`setProposals(json.proposals)`) with no key whitelist, so **no hook changes** and a hook diff is a defect.

### The record-rendering class — two facts the Gate-1 audit is right about

The story characterizes this class as screens that "already display whatever the record holds, the four
included". Verified against source, that is true of one member and **untrue** of the screen next to it:

- **`ui/src/pages/concepts/ElementDetail.jsx:403` / `:545`** —
  `<pre className="json-block">{JSON.stringify(fullJson, null, 2)}</pre>`. The stored record whole. The
  four appear the moment they are stored. **Untouched by this ADR; the invariant holds by non-action.**
- **`ui/src/pages/concepts/ConceptElements.jsx:273`** — the generic element *list* renders
  `JSON.stringify(parsed, null, 0).slice(0, 80)` + `…`. That is **not** the record as stored. It is also
  not a projecting screen: it consumes no goal read and is concept-agnostic. **It is in neither class, so
  no clause of this story fires on it, and it stays untouched.** Recorded here so that a later reader does
  not "fix" it into scope: widening it would be a change to every concept's element list, for a story
  whose ceiling is three goal screens.

### Constraints that bind the design

1. **`second-brain` ADR 0006 d13 / AC6** (Accepted): "**No numeric score, percentage, gauge, or ranking
   number** appears in any owner-facing proposal string or rendered card/spine content." Its upstream is
   the style guide's *"Comparisons, not decimals. Relative value is expressed in words and rankings; a
   numeric score never appears in owner-facing copy in v1."*
2. **The shipped pins over these three files** — all of which must survive:
   - `the-proposal-loop.test.js:615` **S11** — source scan of `Proposals.jsx` for
     `/\bscore\b|\brank\b|\bpercent|\bgauge\b|★|⭐|toFixed\s*\(/i`. **Comments count.**
   - `the-proposal-loop.test.js:705` **H2** — no card **key name** matching `/score|rank|percent/i`.
   - `the-proposal-loop.test.js:635` **S13**, `capture-a-goal-and-see-it.test.js:410` **S8**,
     `attach-the-world.test.js:518` **S8**, `sessions-read-the-brain.test.js:600` **S10** — banned-jargon
     scans over quoted strings *and* JSX text (`element, kind, schema, event, pubkey, superset, concept
     header, persona, acceptance criteria, lease, payload, endpoint`), plus **no exclamation marks** in
     `Proposals.jsx` JSX text.
   - `attach-the-world.test.js:507` **S7** and `sessions-read-the-brain.test.js:581` **S9** —
     `GoalDetail.jsx` carries **no** `<input>`, `<textarea>`, `<form>`, `onSubmit=`, `contentEditable`, and
     no `onEdit`/`onDelete`/`editRecord`/`deleteRecord`. The story's "no editing affordance" is already
     mechanically enforced.
   - `attach-the-world.test.js:499` **S6** — `GoalDetail.jsx` carries no `dangerouslySetInnerHTML`,
     `<iframe>`, `<embed>`, `<object>`. **A markdown renderer for the prompt is therefore out.**
   - `capture-a-goal-and-see-it.test.js:373` **S5b** — `Goals.jsx` contains no `/toggle|checkbox|switch/i`
     token **anywhere in the file**; `:387` **S7** — no `'achieved'`/`'abandoned'` standing words.
   - `teach-it-what-matters.test.js:616` **S12** — `GoalDetail.jsx`, `App.jsx`, `Layout.jsx`, `styles.css`
     reference no signal surface.
3. **Epic decision 6 + the epic's defaults guardrail:** no layer fabricates a value; **at the screen — the
   interpretation point — absence is *displayed* using the concept's declared defaults.**
4. **Epic decision 9(b)** (a Product Owner call, overrulable): full prompt text on the goal detail screen;
   an **excerpt of the actual prompt text** on list-type screens; a bare presence indicator counts as
   visible nowhere.
5. **The ceiling:** storing and showing only; nothing acts on the four; **no new screen and no new route**.
6. **Out of scope by the story:** any editing affordance; **new design tokens or components invented for
   these four**.
7. **House rules:** no new dependencies, no new lint/typecheck/build tooling; never hardcode the TA pubkey
   (this ADR's client code touches no pubkey at all).

### The hard question, stated before it is answered

**AC2 requires a never-set estimate to render at its declared default, `0`, on each projecting screen —
including the Proposals card. That displayed `0` is not an owner-authored value.** It is a screen-applied
interpretation of absence. The owner's ratified supersession of d13/AC6 (epic decision 8) is scoped to
**owner-authored values only**. So the manufactured `0` falls *outside* the ratification and *inside*
d13's prohibition — and today it is the live case, since the only open proposal nominates a goal with no
estimate. Rendering it would put a number no one authored on a proposal card. That is not a technicality:
next to a card showing a real `75`, a manufactured `0` reads as "the owner rates this one zero" — a false
attribution and precisely the apparent-ranking harm d13 exists to prevent. It is also the same
*lossiness* that got Option D rejected in ADR 0002, reappearing one layer up.

The resolution is in d2. It is not a widening, it is not a narrowing, and it does not come from me — it
comes from **AC4 of this same story**.

## Options considered

### Option A — one pure `goalIntent` formatter module; a **number** renders only where the owner recorded one on the Proposals card, and at the declared default `0` on the two screens d13 does not reach *(chosen)*

A new pure ES module `ui/src/utils/goalIntent.js` (no React import, no JSX — a utility, not a component)
holds every absence rule and every owner-facing string for the four. All three screens import it. The
estimate has **two** exported formatters: `estimateLine` (applies the declared default `0` — Goals and
Goal detail) and `estimateLineOnProposalCard` (a number only when `chanceOfSuccess != null`; otherwise the
default in plain words — the Proposals card, per AC4 and d13).

- **Pros:** the three screens can never disagree about the same goal's absence rules, because there is one
  implementation of them; the `null`-vs-`0`-vs-`false` discrimination is written once, in the one place a
  reviewer can check it; **every shipped pin survives unmodified** — no `score`/`rank`/`percent`/`gauge`/
  `toFixed(` token is introduced into `Proposals.jsx`, and `chanceOfSuccess` matches none of H2's key
  patterns; the supersession is exercised at exactly the width the owner ratified and no wider; the
  interpretation stays at the screen, where epic decision 6 puts it, and no fabricated number ever reaches
  a proposal card.
- **Cons:** the same never-set goal reads `0 out of 100` on the Goals list and *"no — you haven't
  estimated this one"* on the Proposals card. That is a real inconsistency an owner can notice. It is
  principled (one screen is governed by d13, two are not) and documented — but it is a cost, and it is the
  main thing to overrule if the operator wants uniformity.

### Option B — the same module, but the never-set estimate renders in words on **all three** screens

- **Pros:** perfectly uniform; no manufactured number renders anywhere, which sits closest to the epic's
  thrice-ratified "never invented"; 23 of 31 rows in the Goals list stop showing a zero no one wrote.
- **Cons (dispositive):** AC2 says the estimate shows `0`, and only AC4 licenses a departure — and AC4 is
  scoped, in its own words, "**On the Proposals screen**". Extending the departure to two screens where no
  ADR and no criterion asks for it is the Architect quietly rewriting an acceptance criterion. Rejected on
  lane, not on taste — and named here because if the operator prefers uniformity, **this is the change to
  make**, and it is a one-line change to which formatter two screens import.

### Option C — render the manufactured `0` as a number on the Proposals card too, and widen the supersession to cover screen-applied defaults

The literal reading of AC2 across all three screens.

- **Pros:** AC2 is satisfied word-for-word everywhere; one formatter instead of two; nothing to explain.
- **Cons (dispositive):** it requires **widening the operator's ratification**, which is not the
  Architect's to do and not the Director's either. It puts a number the owner never wrote on a proposal
  card, next to numbers they did write, which is the false-attribution harm above. And it is
  *unnecessary*: AC4 of this story already says what appears in the estimate's place on that screen must
  be "the owner's own recorded value", so the story itself has already answered the question the
  supersession would have had to be stretched to answer. **Rejected — but flagged loudly:** if the
  operator reads AC2's `` `0` `` as glyph-literal on the Proposals card and overrules AC4's reading, then
  this option is the only coherent one and **the supersession must be widened by the owner first**. That
  return is a one-paragraph question, not a redesign.

### Option D — render the four inline in each screen, no shared module

- **Pros:** smallest possible file count; nothing new under `ui/src/utils/`.
- **Cons (dispositive):** the `null`/`0`/`false`/`''` discrimination would be written three times, and the
  falsiness bug (below) would have three chances to appear instead of one. The owner-facing strings would
  drift between screens, and the Reviewer's register audit would have three places to check. Every rule
  this ADR states about absence would become unenforceable by inspection of one file. Rejected.

### Option E — a `<GoalIntent>` React component rendered by all three screens

- **Pros:** the DRYest rendering; one place for the markup as well as the rules.
- **Cons (dispositive):** the story puts "**new design tokens or components** invented for these four"
  **out of scope**, in as many words. A shared presentational component is exactly that. It would also
  force one markup shape onto three screens whose layouts genuinely differ (a compact tree row, a detail
  page's labelled-fact stack, an emphasis card). Rejected on the story's own boundary.

### Option F — render the prompt as markdown on the goal detail screen

- **Pros:** a 6 155-character markdown prompt is far more readable rendered.
- **Cons (dispositive):** it needs a markdown dependency (house rule: no new dependencies) or
  `dangerouslySetInnerHTML`, which `attach-the-world` S6 pins `GoalDetail.jsx` free of. Rejected; the
  prompt renders as plain text with its line structure preserved.

## Decision

We chose **Option A**. Sub-decisions, each binding.

---

### d1. The supersession, written explicitly — its exact width, and what survives it

**`second-brain` ADR 0006 d13 / AC6 is narrowly superseded, as follows and no further.**

> Where d13 reads *"No numeric score, percentage, gauge, or ranking number appears in any owner-facing
> proposal string or rendered card/spine content"*, it is **narrowed** to exclude **a value the owner
> themselves recorded on the goal the card is about**. Specifically: the goal's `chanceOfSuccess`, when
> the owner has set it, **may be rendered as its number** on the Proposals card.

**Provenance:** raised through the Director, **ratified by the operator 2026-07-27**; recorded as epic
decision 8 in `engineering-team/epics/goal-intent-fields.md`. This ADR is where it becomes an
engineering decision; ADR 0002 d10 explicitly routed it here and stated it was "not license to render it".

**What is *not* superseded, and remains fully in force:**

- **The system-generated-ranking prohibition, entire.** No computed score, no gauge, no percentage bar,
  no ranking number, no ordinal, no "top pick" marker may appear on a proposal card or anywhere else.
  AC4 is where that boundary is tested, and d6 below is where it is enforced.
- **Every clause of ADR 0006 other than the d13 sentence above** — the append-only mint, the
  type discriminator, decisions-as-separate-facts, open-ness derived at read, the copy discipline's
  banned-jargon list and no-exclamation-marks rule, the equal-weight Approve/Skip, the verbatim strings.
  ADR 0006's Status stays **Accepted**.
- **d13's reach over `passedOver`.** The runners-up carry no estimate and never will (ADR 0002 d6 keeps
  them out of the read projection). Attaching any number to a runner-up remains forbidden outright — it
  is the ranking d13 was written against.
- **d13's reach over the spine.** The goal detail's `records` list *is* "spine content". The four are
  rendered in the goal's **intent block** at the top of the detail page, never inside `RecordEntry`. A
  diff that puts any of the four into `RecordEntry` engages d13 and is a defect.

**The width is narrow enough that no shipped test changes.** S11's token scan, H2's key-name scan and
every jargon scan pass **unmodified** under this decision — verified by inspection of their regexes
against the strings d3–d5 pin. A supersession that requires no closed book's test to be re-aimed is the
strongest available evidence that it is as narrow as it claims to be.

**The style guide (`product-team/guides/second-brain-style-guide.md`, "Comparisons, not decimals") still
reads as before.** Engineering never writes into `product-team/`. The book's close carries it on the
return edge — see Consequences.

---

### d2. The hole in the supersession, and the resolution — the manufactured `0` is answered by AC4, not by widening

**The question.** A never-set estimate rendered as `0` on the Proposals card is not an owner-authored
value, so d1's supersession does not cover it, so d13 still forbids it. AC2 nonetheless requires the
declared default to be shown. Both cannot be true of a rendered numeral.

**The resolution, from the story itself.** AC4 says, in its own words:

> "On the Proposals screen the estimate appears as **the owner's own recorded value**"

A manufactured `0` is not the owner's own recorded value. **AC4 therefore already forbids rendering it as
a number on that screen** — independently of d13, and without anyone widening or narrowing anything. AC2
and AC4 are jointly satisfiable, and there is exactly one way to satisfy both:

> **On the Proposals card, the estimate renders as a number when — and only when — the owner recorded one.
> When it was never recorded, the card shows the concept's declared default in plain words.** On the Goals
> list and the Goal detail, which d13 does not reach, a never-set estimate renders at the declared default
> `0`, per AC2 read literally.

**Why this satisfies AC2 rather than dodging it.** AC2 requires the screen to *apply* the declared default
instead of showing raw absence — that is what "the screen is the interpretation point" means, and it is
why AC2 forbids a literal `null`. It does not require a particular glyph, and **AC2 proves this itself**:
in the same sentence it says both flags show `` `false` ``, and no screen in this codebase will ever print
the token "false" at an owner — it is off-register and the style guide forbids system vocabulary. The
backticked values in AC2 denote **the state the default specifies**, rendered in each screen's own
register. The card's wording states the default (*"no"* — an estimate of 0 means no chance unattended) and
says why it is the default (*"you haven't estimated this one"*), so it is neither raw absence nor a
fabricated claim about what the owner thinks.

**Two readings I considered and rejected, recorded so no one re-derives them:**

- *"The supersession covers the declared default because the concept declares it."* Rejected — it
  contradicts the epic's own ratified reasoning. Epic decision 6 holds that the concept's default wording
  "addresses a **consumer**, not a transport": it is an instruction on how to *read* absence, not a value
  anyone authored. Calling the rendered `0` "owner-authored" would overturn decision 6 to save a glyph.
- *"A constant `0` on every card can't rank anything, so d13 is not engaged."* Rejected — it is not
  constant. The corpus already holds estimates from 15 to 80, so a manufactured `0` will sit next to real
  numbers as soon as a second proposal opens, and it will sit *below all of them*.

**The one thing that would change this decision.** If the operator reads AC2's `` `0` `` as glyph-literal
on the Proposals card and overrules AC4's plain reading, then Option C is the only coherent design and
**the owner must widen the supersession before it is built**. That is a decision for the operator, not for
me and not for the Director. It is flagged in Consequences as the single open lever on this ADR.

---

### d3. `ui/src/utils/goalIntent.js` — one pure module holding every absence rule and every string

New file. Plain ES module: **no React import, no JSX, no default export of a component** — a utility in
the established `ui/src/utils/` family (`timeAgo.js`, `nodeName.js`, `povNoticeText.js`), so the story's
"no new components" boundary is honored by construction.

**The discriminator is `== null`, never falsiness.** This is the one bug this feature is built to attract
and it must not be written:

```js
// WRONG — collapses three distinct stored states into "never set":
if (!goal.prompt)          // '' (set to empty) reads as never-set
if (!goal.chanceOfSuccess) // a stored 0 reads as never-set
if (!goal.needsHumanInput) // a stored false reads as never-set — 5 live goals store exactly that
```

Every absence test in this module and in the three screens is `value == null` (or an explicit
`=== undefined || === null`). ADR 0002 d1 guarantees a stored `0`, `false` or `''` arrives verbatim and
only never-set arrives as `null`; this module is the only place that distinction is consumed.

**Exports** (owner-facing strings are constants so the three screens agree and a Tester can pin them):

| export | value / behaviour |
|---|---|
| `LABEL_PROMPT` | `'Prompt:'` |
| `LABEL_ESTIMATE` | `'Could run on its own:'` |
| `LABEL_NEEDS_YOU` | `'Needs you:'` |
| `LABEL_TOO_BIG` | `'Too big as it stands:'` |
| `PROMPT_UNSET` | `'No prompt written yet.'` |
| `PROMPT_EMPTY` | `'The prompt is empty.'` |
| `ESTIMATE_UNSET_ON_CARD` | `"no — you haven't estimated this one"` |
| `PROMPT_EXCERPT_MAX` | `140` |
| `promptDisplay(prompt, max = PROMPT_EXCERPT_MAX)` | returns `{ state, text }`; see d4 |
| `estimateLine(v)` | `v == null ? '0 out of 100' : \`${v} out of 100\`` — applies the declared default |
| `estimateLineOnProposalCard(v)` | `v == null ? ESTIMATE_UNSET_ON_CARD : \`${v} out of 100\`` — d2 |
| `flagWord(v)` | `v === true ? 'yes' : 'no'` — `false` **and** absent both yield `'no'`, which is the declared default `false`, applied |

`estimateLine` is deliberately tolerant of a non-numeric stored value: it interpolates whatever came back.
Type-validating on read is forbidden by ADR 0002's out-of-scope list, and re-introducing it at the screen
would be the same rule in a new layer.

**Every string above is checked against the shipped scans:** none contains a banned-jargon word, an
exclamation mark, or any of `score` / `rank` / `percent` / `gauge` / `toFixed(` / `toggle` / `checkbox` /
`switch` / `achieved` / `abandoned`. The import specifier `'../../utils/goalIntent'` is likewise clean —
it is scanned as a quoted string by four of those tests.

**Copy is a review consideration, not an acceptance criterion** (the story says so). The *structure* above
is the decision; the exact words are the Reviewer's register audit to challenge, and the operator may
reword any of them without disturbing anything else in this ADR.

---

### d4. `promptDisplay` — three states, because AC2 names three

```
prompt == null                  → { state: 'unset', text: PROMPT_UNSET }
whitespace-collapsed is ''      → { state: 'empty', text: PROMPT_EMPTY }
otherwise                       → { state: 'text',  text: <the excerpt, or the full text> }
```

- **`unset` vs `empty` must be visibly different strings.** AC2: a never-set prompt rendered as "an area
  indistinguishable from a prompt that was set to empty" does not satisfy it. Two distinct sentences make
  that mechanically testable rather than a matter of judgement.
- **The excerpt is of the actual prompt text** (epic decision 9(b)): whitespace-collapse
  (`String(p).replace(/\s+/g, ' ').trim()`) so a multi-line markdown prompt cannot reflow a tree row, then
  a **head** truncation at `PROMPT_EXCERPT_MAX` with a trailing `…` only when it actually truncated.
  Head, not middle: `GoalDetail.jsx`'s existing `truncateMiddle` (`:28`) is for *locators*, where the tail
  identifies the file; prose is recognized from its opening. `140` is roughly one wrapped line at list
  width and enough to recognize a prompt's opening — the live prompt is 6 155 characters, so *something*
  must bound it.
- **`max = 0` (or `Infinity`) means no truncation** — the goal detail passes it to get the full text
  through the same function, so the three states are decided in exactly one place. The detail screen
  renders the **verbatim** prompt, not the collapsed one, with its line structure preserved by CSS
  (`white-space: pre-wrap`) — never a markdown renderer, never `dangerouslySetInnerHTML` (S6).

---

### d5. What each screen renders — and "list-type screen" is pinned here

**"List-type screens" is defined, closing the gap the Gate-1 audit found.** The story names exactly three
projecting screens and calls exactly one of them the detail screen. **List-type = the other two: the Goals
list and the Proposals card.** This is elimination over the story's own closed inventory, not an
invention: epic decision 9(b) contrasts "full text on the goal detail screen" with "an excerpt … on
list-type screens", and the only screens left to be contrasted with are those two. The Test Designer may
treat this as settled.

**`ui/src/pages/brain/Goals.jsx` — the Goals list.** Inside the existing `<span className="brain-goal-main">`
(`:173-176`), after the existing `showHint` line, two additional lines, both using the existing
`brain-goal-hint` class:

1. `` `${LABEL_ESTIMATE} ${estimateLine(g.chanceOfSuccess)} · ${LABEL_NEEDS_YOU} ${flagWord(g.needsHumanInput)} · ${LABEL_TOO_BIG} ${flagWord(g.needsBreakdown)}` `` — the `·` separator is the house idiom (`brain-detail-meta`).
2. `promptDisplay(g.prompt).text` — the excerpt, or `PROMPT_UNSET`, or `PROMPT_EMPTY`.

**`ui/src/pages/brain/GoalDetail.jsx` — the Goal detail.** After the existing "Stays inside:" line
(`:180-182`) and **before** `showHint`, in the same `<p className="brain-detail-field"><strong>Label:</strong> value</p>`
idiom the page already uses for `deliverable`/`boundary`:

1. `<strong>{LABEL_ESTIMATE}</strong> {estimateLine(goal.chanceOfSuccess)}`
2. `<strong>{LABEL_NEEDS_YOU}</strong> {flagWord(goal.needsHumanInput)}`
3. `<strong>{LABEL_TOO_BIG}</strong> {flagWord(goal.needsBreakdown)}`
4. `<p className="brain-detail-field brain-detail-prompt"><strong>{LABEL_PROMPT}</strong> {promptDisplay(goal.prompt, 0).text}</p>` — the **full** prompt.

All four go in the **intent block**, never in `RecordEntry` (d1: the record list is spine content).

**`ui/src/pages/brain/Proposals.jsx` — the Proposals card.** Inside the existing `<li className="brain-proposal-card">`,
after `whyNow` (`:102`) and **before** the "considered instead" block (`:103`), so the four describe the
nominated goal and are visually separated from the runners-up:

1. `<p className="brain-proposal-whynow">` carrying
   `` `${LABEL_ESTIMATE} ${estimateLineOnProposalCard(p.chanceOfSuccess)} · ${LABEL_NEEDS_YOU} ${flagWord(p.needsHumanInput)} · ${LABEL_TOO_BIG} ${flagWord(p.needsBreakdown)}` ``
2. `<p className="brain-proposal-whynow">{promptDisplay(p.prompt).text}</p>` — the excerpt.

`estimateLineOnProposalCard` — **not** `estimateLine` — is the one place d2 lands in code, and it carries
an in-code comment naming this ADR's d1/d2 and `second-brain` 0006 d13, so a later reader cannot
"harmonize" the two formatters without reading why they differ.

**Nothing is added to `passedOver`** (`:103-115`). The runners-up render exactly as today. ADR 0002 d6
already keeps the four off them server-side; this ADR keeps them off the screen.

---

### d6. Nothing acts on the four — the client-side statement of AC4

Untouched, and a diff that makes any of them read one of the four is a defect:

- `Goals.jsx`'s `useMemo` grouping (`:94-108`) — `roots`/`childrenOf` are built from `parentUuid` only.
  Render order is `roots.forEach(walkDown)` over the **server's** order (`sortGoals`, untouched).
- `Goals.jsx`'s `closedIds` disclosure state, `freshUuids` highlight, and `showHint` (`:142`).
- `Proposals.jsx`'s `proposals.map` (`:99`) — the server's order, unfiltered.
- `GoalDetail.jsx`'s `showHint` (`:160`) and the `records` list order.

No `sort`, `filter`, `slice`, `reduce`, conditional class, colour, weight or icon anywhere in the three
files may read `prompt`, `chanceOfSuccess`, `needsHumanInput` or `needsBreakdown`. **The flags render as
plain muted words at the same weight as their neighbours — never as a coloured badge or a pill**, because
AC4 forbids "badge-driven prioritization" and a red "needs you" chip is exactly that. Which goals appear,
and in what order, is byte-identical before and after on all three screens.

---

### d7. No new screen, no new route, no new component, no new hook, no dependency

`ui/src/App.jsx` (`:209-211`, three brain routes) and `ui/src/components/Layout.jsx` (nav entries) are
**untouched** — AC3 holds by non-action, which is the cheapest way for it to hold. The three hooks are
untouched (they already pass the four through). No package is added; no lint/typecheck/build tooling is
added; `ui/package.json` is untouched.

---

### d8. `styles.css` — exactly one new declaration, no new design token

`ui/src/styles.css` gains **one** rule, appended to the existing brain block (~`:8201`):

```css
.brain-detail-prompt { white-space: pre-wrap; }
```

Everything else reuses classes that already exist: `brain-goal-hint` (0.8rem, `var(--text-muted)`) on the
Goals rows, `brain-detail-field` (max-width 70ch) on the detail, `brain-proposal-whynow` (margin 0,
max-width 70ch) on the card. **No new custom property (`--*`) is defined, so no new design token is
created; no React component is created.** The story's out-of-scope bullet is honored, and it is verifiable
by `git diff --stat ui/src/styles.css` showing a single added line.

`white-space: pre-wrap` is an established idiom in this stylesheet (`:1339`, `:1603`, `:2100`) — it is the
only way the full markdown prompt keeps its line structure without a renderer or `innerHTML`.

**The one honest smell:** `brain-goal-hint` was named for the viability hint and now also carries the
intent lines. Reusing it keeps the "no new design tokens or components" criterion unarguable; splitting it
is a later cleanup, recorded in Consequences.

## Consequences

- **Enables:** the owner sees the prompt, the estimate and both flags on the three goal screens they
  already use, without an export — the *show* half of the book's frame. With stories 1 and 2 shipped, the
  frame's "all four come back on every surface that shows a goal" is met end to end.
- **The supersession is now recorded in an ADR**, not only in a Director's journal and an epic decision
  list. That was the epic's thrice-repeated lesson ("a ratified answer has to land everywhere it is
  recorded"); this is the landing.
- **Constrains:** the four are **carried, never consulted** on the client too — any future ordering,
  filtering, grouping, gating or badge derived from them must supersede this ADR rather than extend it.
  `estimateLineOnProposalCard` is a **contract**, not a helper: collapsing it into `estimateLine` puts a
  manufactured number on a proposal card and re-opens d13.
- **The single open lever, needing the operator and no one else.** If AC2's `` `0` `` is meant
  glyph-literally on the Proposals card, d2's resolution is wrong and **Option C is the design — but the
  owner must widen the supersession first**, because a screen-applied default is not an owner-authored
  value. Neither the Architect nor the Director may widen it. Say the word and this ADR returns with one
  formatter instead of two. Conversely, if uniformity across the three screens matters more than AC2's
  literal `0`, **Option B** is a one-line change to which formatter `Goals.jsx` and `GoalDetail.jsx`
  import.
- **The style guide still says "a numeric score never appears in owner-facing copy in v1."** Engineering
  does not write into `product-team/`. `/close-book` should carry this on the return edge: the prohibition
  now has a ratified exception for owner-authored values, and the guide is the product team's to update.
- **Debt / follow-ups:**
  (a) `brain-goal-hint` now carries two meanings on the Goals row (the viability hint and the intent
  lines). Splitting it is cosmetic and out of this story's ceiling.
  (b) A 6 155-character prompt renders in full on the goal detail page with no collapse affordance. A
  disclosure control would be new screen-level machinery this story's ceiling excludes; if the page proves
  unwieldy, that is a separate ask. (`Goals.jsx` additionally may not contain the words `toggle`,
  `checkbox` or `switch` at all — S5b — so any future collapse there needs the disclose/expand vocabulary.)
  (c) The two-formatter split for the estimate is a per-screen inconsistency the owner may notice; it is
  documented in d2 and is the price of not widening a ratification.
  (d) `ConceptElements.jsx`'s 80-character JSON preview means the generic element **list** does not show
  a goal's four in any useful form. It is in neither of the story's two classes and is deliberately left
  alone; recorded so it is not mistaken for a gap.
- **Firmware reinstall required?** **No.** No concept is added and none is redefined — the live schema
  node already declares all four (verified from the graph 2026-07-27), the goal concept is runtime-created
  and has never been firmware-seeded, and this ADR changes only client rendering. No `POST
  /api/firmware/install` step, and no live-instance operational step of any kind.

## Implementation notes

Test-file changes belong to **Phase 3** (the Tester's lane), not to implementation — including every
re-aim named below.

- **New file: `ui/src/utils/goalIntent.js`** — per d3/d4. Pure ES module; **no `import` from `react`**; no
  JSX. Header comment states: the `== null` rule and why falsiness is wrong (naming the three live stored
  states `0`, `false`, `''`); that absence is *interpreted* here because the screen is the interpretation
  point (epic decision 6); and that `estimateLineOnProposalCard` exists because of `second-brain` 0006 d13
  as narrowed by this ADR's d1/d2 — never merge the two formatters.
- **File: `ui/src/pages/brain/Goals.jsx`** — one `import` line; two rendered lines inside
  `<span className="brain-goal-main">` per d5. Nothing else changes: not the `useMemo` (`:94-108`), not
  `walkDown`/`rows` (`:185-192`), not the export affordance, not the gate, not the skeletons, not
  `discloseRow`, not `freshUuids`. The file must still contain no `toggle`/`checkbox`/`switch` token (S5b)
  and no `'achieved'`/`'abandoned'` (S7).
- **File: `ui/src/pages/brain/GoalDetail.jsx`** — one `import` line; four `<p className="brain-detail-field">`
  lines per d5, placed after the `boundary` line (`:180-182`) and before `showHint` (`:183`). **Do not
  touch `RecordEntry` (`:68-93`), `PointerCard`, `freshnessLine`, or `truncateMiddle`.** The file must
  remain free of `<input>`/`<textarea>`/`<form>`/`onSubmit=`/`contentEditable`/`onEdit`/`onDelete` (S7/S9)
  and of `dangerouslySetInnerHTML`/`<iframe>`/`<embed>`/`<object>` (S6).
- **File: `ui/src/pages/brain/Proposals.jsx`** — one `import` line; two `<p className="brain-proposal-whynow">`
  lines per d5, between `whyNow` (`:102`) and the "considered instead" block (`:103`). **Do not touch
  `passedOver`, the Approve/Skip controls, the skip field, the confirmations, or the empty/error states.**
  - **The module docstring at `:12-13` must be corrected.** It currently reads *"No numbers anywhere
    (design principle 2): comparisons and words only, never a decimal"* — false once an owner-recorded
    estimate renders. Replace with a sentence that states the narrowed rule and points at this ADR, e.g.
    *"A number appears only where the owner recorded one on the goal — never a system-generated one (ADR
    `second-brain` 0006 d13, narrowed by `goal-intent-fields` 0003 d1/d2)."*
  - **The replacement text must not contain** `score`, `rank`, `percent`, `gauge`, `★`, `⭐` or
    `toFixed(` — **S11 scans the whole file, comments included**, and it is a shipped pin from a closed
    book that must keep passing.
- **File: `ui/src/styles.css`** — one appended rule per d8: `.brain-detail-prompt { white-space: pre-wrap; }`.
- **File: `engineering-team/decisions/second-brain/0006-the-proposal-loop.md`** — **already done; do
  not touch it again.** The reciprocal `**Amended by:**` pointer was written after `:5` (the
  `**Story:**` line, before `**Builds on:**`) in this ADR's own commit, per the same-flow precedent
  cited in the header above — one line added, zero removed, body and Status untouched. **A second
  pointer added at implementation would be a duplicate and is a defect.**
- **Unchanged, deliberately** (a diff touching these for this story is a defect): all three hooks
  (`useBrainGoals.js`, `useBrainGoalDetail.js`, `useBrainProposals.js` — they already pass the four
  through); `ui/src/App.jsx`; `ui/src/components/Layout.jsx`; `ui/src/pages/concepts/ElementDetail.jsx`
  and `ConceptElements.jsx`; `ui/package.json`; **everything under `src/`** — the story is client-only and
  a server diff means the extent was mis-derived.
- **No server restart is needed.** The control panel bind-mounts the repo, and `ui/` is served as built
  assets — the Implementer follows the existing UI build/serve path for this repo; no new tooling.

**Test pins expected to pass unmodified** (state them so a surprise is loud): `the-proposal-loop` S10,
**S11**, S12, S13, **H2**; `capture-a-goal-and-see-it` S5, S5b, S6, S7, S8, S9, S11, S12;
`attach-the-world` S6, S7, S8, S9, S10; `sessions-read-the-brain` S9, S10, S11, S12;
`break-a-goal-into-pieces` and `teach-it-what-matters` S12; and every story-1/2 server suite, which this
story does not touch.

**Test-class guidance — the Tester's lane to specify, not to inherit:**

- **U** — `goalIntent.js` is pure and directly unit-testable, which is the main reason it exists.
  `estimateLine(null) === '0 out of 100'` and `estimateLine(0) === '0 out of 100'`;
  `estimateLineOnProposalCard(null) === ESTIMATE_UNSET_ON_CARD` and
  `estimateLineOnProposalCard(0) === '0 out of 100'` — **the `0`-vs-`null` pair on both formatters is the
  discriminating test**, and a falsiness implementation fails exactly there. `flagWord(false) === 'no'`,
  `flagWord(undefined) === 'no'`, `flagWord(true) === 'yes'`. `promptDisplay` over all three states
  including `''` and `'   '` (both `empty`, and `PROMPT_EMPTY !== PROMPT_UNSET`), a 6 000-character
  multi-line prompt (collapsed, `≤ PROMPT_EXCERPT_MAX + 1`, ends `…`, **begins with the prompt's own first
  characters**), a short prompt (unchanged, **no** `…`), and `max = 0` (verbatim, uncollapsed, no `…`).
- **S** — each of the three pages imports `goalIntent` and renders all four; **`estimateLine` does not
  appear in `Proposals.jsx` and `estimateLineOnProposalCard` appears nowhere else** (the d2 boundary,
  mechanically); no new route in `App.jsx` and no new nav entry in `Layout.jsx` (AC3, as a diff-free
  assertion); the three hooks are unchanged; `ui/src/styles.css` defines no new `--` custom property;
  `goalIntent.js` imports nothing from `react`; none of the three pages contains `sort(`/`filter(` reading
  any of the four (AC4); `RecordEntry` in `GoalDetail.jsx` references none of the four (d1's spine
  boundary); and the shipped scans above re-asserted against the *new* file contents.
- **H** (live stack, the ADR 0003/0004 sentinel-fixture precedent; legacy goals never mutated) — a fixture
  goal with all four set (multi-line prompt, an estimate, `needsHumanInput: false` stored **explicitly**)
  and one with none; assert each of the three endpoints still returns the four, so a screen failure can
  be told apart from a story-2 regression. Screen rendering itself is S-class here: this project has no
  browser test harness, and adding one is new tooling the house rule forbids without its own ADR.

## Out of scope

- **Widening the supersession** to cover screen-applied defaults. Owner-only; see d2 and Consequences.
- **Any editing affordance** for the four — a prompt editor, an estimate control, a flag switch. Setting
  is story 1's write path; `GoalDetail.jsx` is pinned free of form elements and stays that way.
- **New screens, routes, tabs, views, components or design tokens.**
- **Rendering the prompt as markdown**, or any markdown/sanitizer dependency (Option F).
- **A collapse/expand affordance for the full prompt** on the detail page — new screen machinery.
- **Any rule about the four**: ordering, filtering, grouping, gating, ranking, colour-coded urgency,
  "needs you" badges, type validation or clamping on read. A malformed stored value renders as stored.
- **`ConceptElements.jsx`'s 80-character preview** — in neither of the story's two classes; untouched.
- **Server changes of any kind**, including retiring the Direction endpoint's raw-record workaround and
  correcting `UNAVAILABLE`'s now-stale `estimate` sentence (both reserved by ADR 0002).
- **`product-team/guides/second-brain-style-guide.md`** — engineering never writes there; the book's
  close carries it on the return edge.
- **OPEN.md row 102** (the schema-`required` defect) and **`dependsOn` / prerequisites** — neither fixed,
  closed, nor evidenced here.
