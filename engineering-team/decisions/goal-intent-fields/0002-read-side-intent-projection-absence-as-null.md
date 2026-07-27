# ADR 0002: One read-side projector carries the four onto the five projecting surfaces; absence is reported, never manufactured

**Status:** Proposed
**Date:** 2026-07-26
**Story:** `engineering-team/stories/goal-intent-fields/2-return-the-four-on-every-read-surface.md`

## Context

Story 1 shipped the write half: all four intent properties reach the stored goal record, and a property
never supplied is **absent from the record** (ADR 0001 d2 — key-absence is "the only representation of
'unset' that survives storage, export and restore"). This ADR designs the read half: the surfaces that
show a goal return what is stored, and report a never-set property as not set.

Storing and showing only. Nothing here ranks, filters, gates, clamps, coerces, or otherwise consults
what the four contain, and no screen is designed — screens are `goal-intent-fields` #3.

### The concept, from the graph (not from source)

Orientation ran the three-call pattern from inside the container against the local instance
(host-side brain reads 403): `GET /api/concept-graph/summaries` (57 concepts → `tapestry-owner-goal`,
31 elements), then `GET /api/concept-graph/node/39998:<TA>:tapestry-owner-goal/neighbors` (eight
machinery edges; `IS_THE_JSON_SCHEMA_FOR` → the schema node), then
`GET /api/concept-graph/node/39999:<TA>:tapestry-owner-goal-schema`. `<TA>` came from
`GET /api/assistant/pubkey` at runtime and is written down neither here nor in code (house rule).

- `39998:<TA>:tapestry-owner-goal` — concept header; element records live under the json key
  `tapestryOwnerGoal`.
- `39999:<TA>:tapestry-owner-goal-schema` — the inner `required` reads exactly
  `["name","slug","description"]`; all four are declared and all four are **optional**: `prompt`
  (string), `chanceOfSuccess` (number, *"between 0 and 100 … The default is 0, if not otherwise
  estimated"*), `needsHumanInput` / `needsBreakdown` (boolean, `default: false`, *"Absent means
  false."*). **This ADR adds no property and redefines none.**

### The live corpus decides the shape of "not set"

`GET /api/brain/export` (31 goals, read from inside the container 2026-07-26):

| | goals |
|---|---|
| carry `chanceOfSuccess` | 7 |
| carry `needsHumanInput` | 8 — **and 6 of them store `false` explicitly** |
| carry `needsBreakdown` | 7 |
| carry `prompt` | 1 |
| carry **none** of the four | 23 of 31 |

Two facts follow, and they are the load-bearing ones. **Never-set is the majority case**, so whatever
a surface does with it is the common path, not an edge case. And **a stored `false` already exists
alongside never-set**, so a surface that emits `false` for both is not merely inventing — it is
*lossy*, destroying a distinction the owner already made on live records. One goal
(`see-all-of-a-goal-information-in-the-app`) carries exactly one of the four, so partial subsets are
real too.

`GET /api/brain/goals` today returns 15 keys per row and none of the four — the gap reproduces.

### The extent, re-derived rather than inherited

The query a gate re-runs is `grep -rn parseGoalRow src/`. It returns six call sites; the five
**projecting** surfaces reduce to two readers in one module:

| Reader | Consumers = the projecting surfaces |
|---|---|
| `readResolvedGoals` (`src/api/brain/index.js:95`) | `handleGetGoals` `:221`, `handleGetGoalDetail` `:262`, `handleGetOrient` `:401`, `handleGetProposals` `:469` |
| `readGoalRowsAndResolved` (`:115`) | `handleGetDirection` `:639` |

Five consumers, no sixth. **The story's inventory reproduces exactly; the kickback clause does not
fire.** The other three call sites are not surfaces anyone reads a goal from:

- `fetchGoalRecords` (`src/api/normalize/index.js:2141`) — write-side. The story calls this "the
  decomposition validator"; it actually serves **seven** write cores (`createChildGoal` `:2223`,
  `updateGoalIntent` `:2340`, `createResource` `:2546`, `createWorkRecord` `:2858`, `noteGoalIdea`
  `:2938`, `makeProposal` `:3193`, `recordPrioritySignal` `:4799`). All seven consume records to
  validate and locate; none returns any of the four. The accounting balances either way.
- `restoreBrain` (`src/api/normalize/index.js:5016`) — the restore planner; write-side.
- `familyEntries(goalRows, 'tapestryOwnerGoal', parseGoalRow)` (`src/api/brain/index.js:751`) — the
  **export**, which calls the parser only as a validity filter (`src/lib/brain/export.js:50`) and
  emits `{name, section}` with the **raw stored section** (`:52`). Verbatim class.
- `HYGIENE_CONCEPTS` (`:68`) — the hygiene check emits check results, not goal fields. `hygiene.js`
  reads named fields only (no `Object.keys` anywhere in it), so a wider record is inert there.

**The verbatim class carries the four already and needs no work.** Verified rather than assumed: the
export returns the raw section (above); `GET /api/concept-graph/node/:handle` returns the element's
`json` tag whole (confirmed live against the schema node during orientation). The generic element
screen's record view is the story's one client-side member — it renders the stored json as stored,
and this ADR touches no client file, so the invariant holds by non-action. Generic graph-traversal
reads (`/neighbors`) return handle/name/labels/description and carry **no** goal fields at all, so
they are outside the dichotomy and are not a gap.

### Constraints that bind the design

1. **No layer fabricates a value for a property that was never set** (epic decision 6). Not `0`, not
   `false`, not an empty prompt.
2. **The projecting/verbatim split decides where the work is — not who applies defaults** (epic
   decision 7). It binds every layer, not a class.
3. **`test/operational-direction.test.js` U25** (`:611`) pins an absent estimate to `estimate: null`
   with `estimateSource: 'absent'` — *"never invented"* — on a **projecting** surface, from a
   **closed** book. U24 (`:599`), U26 (`:621`), U28 (`:642`) and H5 (`:1152`) surround it.
4. **The restore round-trip is destructive if defaults are materialized.** `mintRestoredGoal` stores
   an artifact's section verbatim, so an export inventing `chanceOfSuccess: 0` would write those
   zeros in permanently — "never estimated" becomes "estimated at zero" across one backup cycle.
5. **Both pure cores are pinned zero-require**: `goals.js` (`test/capture-a-goal-and-see-it.test.js:311`)
   and `direction.js` (`test/operational-direction.test.js:881`). `direction.js` therefore **cannot
   import `INTENT_FIELDS`**.
6. **`test/store-the-four-…:1118` (R1)** pins `parseGoalRow` to exactly ten fields *and names this
   story as the one that re-pins it* — extending the parser is the anticipated path. **R2** (`:1136`)
   pins that the Direction core keeps its own `chanceOfSuccess` read, "retiring it is story 2's call".
7. **`second-brain` ADR 0005 d11**: orient's `roots` is a *bounded slice* of `{slug, name, standing}`
   and "boundedness is a property of the response". `served` is "the goal in full".
8. **`second-brain` ADR 0006 d13 / AC6**: "no numeric score, percentage, gauge, or ranking number
   appears in any owner-facing proposal **string** or rendered card/spine content." Pinned by H2
   (`test/the-proposal-loop.test.js:705`, over card **key names** `/score|rank|percent/i`) and S11
   (`:615`, over `Proposals.jsx` **source**). See d10 — this is a live hazard for story 3.
9. **`operational-direction` ADR 0001 d6** documents the envelope as
   `terms: {ask, successCriteria, ceiling, estimate, estimateSource}`, and exports `UNAVAILABLE`,
   whose `estimate` entry is pinned by U28.
10. No new dependencies, no lint/typecheck/build tooling (house rule). This is a JS-without-build project.

## Options considered

### Option A — Extend `parseGoalRow` with the four; one pure `projectIntentFields(record)` splices them into each surface's literal; absence is `null`

`src/lib/brain/goals.js` — `parseGoalRow` gains the four, driven by the existing `INTENT_FIELDS`
constant: present ⇒ the stored value **verbatim**, absent ⇒ `null`. A sibling
`projectIntentFields(record)` returns the four-key object the response literals spread. Four surfaces
splice it; the Direction transcription adds its three by name inside `deriveTerms` (purity pin) and
keeps its estimate derivation byte-unchanged.

- **Pros:** absence is *reported* by the same mechanism every sibling field on these surfaces already
  uses (`deliverable`/`boundary`/`parent`/`origin`/`capturedOn` are all `!= null ? … : null`), so
  nothing new has to be explained to a consumer; `null` is **discriminating** — a stored `false`,
  `0` or `''` comes back as itself and only never-set reads `null`, which the live corpus proves is
  a distinction that already exists; one list of names (`INTENT_FIELDS`) drives both halves of the
  epic; `resolveDecomposition` already spreads `{...r}` (`goals.js:146`), so the four reach every
  consumer of the resolved set with no further plumbing; the two shipped "not set" contracts
  (Direction's `estimateSource`, the export's key-omission) are untouched *because* they are on code
  paths this option does not enter; R1 named this story as its re-pin.
- **Cons:** `parseGoalRow`'s `!= null` idiom collapses a *stored* `null` into never-set on these
  surfaces (inherited from the existing ten fields, not introduced here — the export still
  distinguishes them); the read side ends up with the opposite absence convention from the write side
  (key-present-null vs key-absent), a deliberate asymmetry that must be documented or a later reader
  will "fix" it; full prompts now travel on list-type surfaces, which is payload growth the epic
  ratified (decision 1) but did not measure.

### Option B — Leave `parseGoalRow` alone; read the raw section at each surface (generalize the Direction workaround)

Thread raw rows to all five surfaces (as `readGoalRowsAndResolved` already does for one) and pick the
four off `JSON.parse(row.json).tapestryOwnerGoal` at each projection.

- **Pros:** the pinned parser contract never moves; the estimate's existing type-checked read
  (`parseEstimate`) becomes the uniform mechanism.
- **Cons (dispositive):** it *perpetuates* the workaround the book names as the thing it closes about
  itself, and multiplies it by five; every surface re-parses the same JSON it already parsed, and the
  parse/tolerance rule gets restated five times where `parseGoalRow` states it once; `readResolvedGoals`
  — the shared reader ADR 0003 d4/d5 deliberately gave the list and the detail — would have to be
  replaced or duplicated at four call sites; and `parseEstimate`'s type check would become a
  *content* rule applied on read (a non-numeric stored value silently reads as absent), which is
  acceptable as one surface's shipped behavior but not as the general contract, since AC1 requires
  "the stored values". Rejected.

### Option C — Spread the whole parsed record into each response (`{...r, standing, captureDate, …}`)

- **Pros:** one-line change per surface; future record fields propagate free.
- **Cons (dispositive):** it leaks `resolveDecomposition`'s internal annotations —
  `parentUnresolved`, `slugShadowed`, `cycleOf` — into public responses, changing four API shapes far
  beyond the four; the explicit projection literal is what lets a reviewer see at a glance what a
  surface returns, and the detail read deliberately projects a *different* set than the list
  (`parentSlug`/`parentName`). Rejected.

### Option D — Materialize the concept's declared defaults on the projecting surfaces (`0`, `false`, `''`)

The obvious reading of *"all four come back on every surface"*: every response carries all four keys,
with the declared default where nothing was stored.

- **Pros:** every response has a uniform shape; a consumer never branches on absence.
- **Cons (dispositive):** it is forbidden four times over. It **breaks a closed book's shipped
  contract** — U25 pins the Direction transcription, a *projecting* surface, to `null` +
  `estimateSource: 'absent'`, "never invented" (this is precisely why epic decision 7 refuses to bind
  the defaults to the projecting class). It is **lossy on live data** — 6 goals store
  `needsHumanInput: false` today, and a fabricated `false` makes them indistinguishable from the 23
  that store nothing. Inventing a value **is acting on the estimate**, which the ceiling forbids. And
  the epic's round-trip argument stands alone: an export that invented `chanceOfSuccess: 0` would have
  restore write those zeros in permanently. Rejected — and named here because it is the design a
  reader arrives at unaided, and this epic has already spent two Planning rounds on it.

### Option E — Return the four only on request (`?fields=intent`) or from a new endpoint

- **Pros:** list payloads stay exactly as they are; the prompt travels only when asked for.
- **Cons (dispositive):** the frame says all four *come back* on every surface that shows a goal; a
  property that comes back only when a caller knows to ask has not come back. It also adds a query
  contract to four endpoints and a second way to read a goal, for a payload concern the epic already
  ratified out of scope (decision 1; the story's "shrinking any payload for size" bullet). Rejected.

## Decision

We chose **Option A** — because the requirement is that a consumer can tell *"never set"* from
*"set to something that looks like the default"*, and on these surfaces `null` is both the
discriminating answer and the answer every sibling field already gives.

Sub-decisions, each binding:

1. **`parseGoalRow` projects the four, verbatim, `null` when absent.** `src/lib/brain/goals.js:39-50`
   gains four entries built from the existing `INTENT_FIELDS` constant (`:264`) — one list, one
   place, imported rather than re-declared, per story 1's d1. The rule is the read-side mirror of
   `pickIntentFields`'s three prohibitions: **presence is the only test** (`section[f] != null`), and
   a present value is copied **verbatim** — no trim, no `Number()`/`Boolean()` coercion, no type
   check, no range clamp, no default substitution. A stored `0`, `false` or `''` comes back as
   itself. Field order follows `INTENT_FIELDS`, appended after `parent`, so the projection reads
   `{uuid, name, slug, statement, origin, capturedOn, createdAt, deliverable, boundary, parent,
   prompt, chanceOfSuccess, needsHumanInput, needsBreakdown}` — fourteen fields. This is the re-pin
   R1 anticipated.

2. **`projectIntentFields(record)` — the read-side sibling, pure and non-mutating.** Same file, next
   to `pickIntentFields`. Returns a **new object with all four keys always present**, each taken from
   the parsed record (`record[f] != null ? record[f] : null`). Response literals spread it:
   `...projectIntentFields(r)`.
   **The asymmetry with `pickIntentFields` is deliberate and must carry an in-code comment.** On the
   *record*, absence is key-absence — the only representation that survives storage, export and
   restore (ADR 0001 d2). On a *projecting response*, absence is `null` — the shipped idiom of every
   sibling field on these four surfaces, and the one that keeps the response shape stable. Collapsing
   the two into one convention is a regression, not a cleanup.

3. **Why `null` satisfies AC3, stated so a Tester can pin it.** `null` **reports** not-set; it does
   not **substitute** a value. The three things AC3 forbids are `0` for an estimate, `false` for a
   flag, and an empty prompt the owner never supplied — `null` is none of them, and is
   distinguishable from all three. The two shipped "not set" contracts AC3 says are preserved exactly
   are preserved by *not touching their code*: the Direction transcription keeps `estimate: null` +
   `estimateSource: 'absent'` (d5), and the export keeps omitting the key entirely (d8).

4. **The four surfaces that splice the projection**, each in its existing response literal, each
   flat (four keys under the concept's own names, alongside `deliverable`/`boundary`/`parent` — the
   shape the epic says it matches):
   - the goals list — `handleGetGoals`, literal `src/api/brain/index.js:225-241`, every row;
   - a single goal's detail — `handleGetGoalDetail`, literal `:360-378`, the `goal` object;
   - the session orientation read — `handleGetOrient`, literal `:431-442`, the **`served`** goal;
   - the proposal queue — `handleGetProposals`, literal `:475-486`, the **nominated** goal (d9).

5. **The Direction transcription: three added, the estimate untouched.**
   `deriveTerms` (`src/lib/brain/direction.js:136-146`) gains `prompt`, `needsHumanInput`,
   `needsBreakdown`, read off the goal record with the same `!= null ? … : null` idiom the three
   existing prose terms already use. Everything about the estimate is **byte-unchanged**:
   `parseEstimate` (`:118-130`) stays, `readGoalRowsAndResolved` stays, the handler still calls
   `deriveTerms(target, parseEstimate(rowByUuid.get(target.uuid)))` (`:681`), and
   `estimate` / `estimateSource` keep their exact derivation. Retiring the workaround is out of
   scope (story; R2), and U24–U26 continue to pass unmodified.
   Two consequences to state plainly:
   - **`direction.js` stays zero-require** (S1, `:881`), so it **names the three literally** rather
     than importing `INTENT_FIELDS`. This is a deliberate, pinned exception to "one list, one place"
     and must carry a comment pointing at `goals.js`'s constant.
   - **On this surface the estimate travels as `terms.estimate`, not `chanceOfSuccess`** — the
     shipped rename (statement→ask, deliverable→successCriteria, boundary→ceiling,
     chanceOfSuccess→estimate). A test asserting the literal key `chanceOfSuccess` on *every* surface
     would fail here, correctly. The value comes back; the vocabulary is this surface's own. The
     other three are added under the concept's names because the run has no competing word for them.
     `terms` becomes `{ask, successCriteria, ceiling, estimate, estimateSource, prompt,
     needsHumanInput, needsBreakdown}` — an additive extension of ADR 0001 d6's documented envelope,
     contradicting nothing in it.

6. **What deliberately does *not* gain the four, and why.** Each of these names a goal *other than
   the one the surface is about*, or carries no goal content at all. Adding the four to any of them
   is out of this design:
   - **orient `roots`** (`:404-407`) — `{slug, name, standing}`, ADR 0005 d11's *bounded slice* of
     "what exists". It carries no stored goal content today (`standing` is derived, not stored), and
     `served` is where d11 puts "the goal in full". Splicing 24 full prompts into a payload whose
     stated design property is flat size would break that decision without superseding it.
   - **orient `ancestry`** (`:423-430`) and the detail's **`parentSlug`/`parentName`** (`:374-375`) —
     references to a *different* goal, which each carry the four on their own detail read.
   - **the proposal card's `passedOver` entries** (`:480-484`) — the runners-up. A runner-up entry is
     the proposal's record of what it passed over and why (`whyNot`), not the goal the card is
     about. See d9 for the reversal cost.
   - **the Direction envelope's `chain`** (`identify()`, `direction.js:272-277`) — `{slug, uuid}` by
     construction, and **`steps`** (`blindSteps()`, `:285-290`) — **must never** carry the four: the
     blinding contract (operational-direction ADR 0001 d5, 0002 d13, 0003 d16) says a boundary judge
     sees exactly two strings and nothing carrying a progress signal. A diff that adds a goal field
     to `blindSteps` is a defect, not an extension.

7. **Nothing acts on the four.** Untouched, and a diff that changes any of them for this story is a
   defect: `deriveStanding` (`goals.js:68`), `sortGoals` (`:89`), `resolveDecomposition` (`:143`),
   `slugIndex` (`:104`), `validateDecompositionOp` (`:205`), `resolveCaptureDate` (`:79`),
   `openProposals` / `proposalEntry`, `ORIENT_ROOT_CAP` and the roots `.filter().slice()`, every
   resolver-winner tie-break (`:267-272`, `:416-421`), `resolveAnchor` and every refusal in it, and
   the hygiene classifiers. No sort key, filter, cap, gate or refusal reads any of the four. Which
   goals each surface returns, and in what order, is identical before and after.

8. **The verbatim class: no change anywhere, on purpose.** `familyEntries`
   (`src/lib/brain/export.js:47-58`) keeps emitting the raw stored section, so the export keeps
   **omitting** the key for a never-set property — which is both AC3's named requirement and the
   thing that makes restore safe (constraint 4). `handleGetExport` (`:733`) and every concept-graph
   read are untouched. A diff that adds the four to any verbatim path is a defect: it would *narrow*
   a path that currently carries everything, including out-of-contract fields such as `promptVersion`
   and `team` that story 1 found riding on live records.

9. **The proposal card resolves name and the four from one record.** `handleGetProposals` builds
   `nameBySlug` (`:471-474`); it becomes `recordBySlug`, holding the record instead of the name, so
   `goalName` and the four describe the **same** record and can never disagree. The existing
   first-wins-in-scan-order selection is preserved **exactly** (`if (!map.has(slug)) map.set(...)`) —
   it is not switched to the resolver-winner used by the detail read; that difference is pre-existing
   and changing it would be a content change AC4 does not sanction. The fallback stays exactly
   `nameBySlug.get(p.goal) || p.goal` in behavior.

10. **Flagged, not resolved here: the proposal card and `second-brain` AC6.** ADR 0006 d13 forbids a
    numeric score, percentage, gauge or ranking number in any owner-facing proposal **string or
    rendered card/spine content**. Story 2 changes a **server JSON response**, not owner-facing copy,
    and the shipped object-level pin H2 (`/score|rank|percent/i` over card key names) is satisfied —
    `chanceOfSuccess` matches none of those tokens. So this ADR proceeds. **But story 3 is scoped to
    show the four on the Proposals screen, and *rendering* a 0–100 estimate on a proposal card is a
    direct collision with a ratified criterion of a closed book** (and with S11, which scans
    `Proposals.jsx` for `percent`/`toFixed(`). That collision belongs to story 3's ADR and needs an
    explicit resolution — a narrowing supersede of 0006 d13, or a rendering that is not a number —
    ratified by the owner. **This ADR is not license to render it.**

## Consequences

- **Enables:** all four come back on every surface that shows a goal — the read half of the frame;
  a session, the owner's screens (story 3), and the Director all read the same four from the same
  place; the Direction endpoint's raw-record workaround becomes genuinely unnecessary (retiring it
  stays a later, separate decision); and story 3 can be built entirely against
  `projectIntentFields`'s stable four-key shape with `null` as its single "not set" signal.
- **Constrains:** the four remain **carried, never consulted** — any future rule that ranks, filters,
  gates or clamps them must supersede this ADR rather than extend it; `null` is now a
  **public contract** on four surfaces, so a later change to key-omission is a breaking change for
  story 3's screens; the read/write absence asymmetry (d2) is deliberate and collapsing it is a
  regression; `blindSteps` and `identify` are closed to goal content permanently (d6).
- **Payload:** full prompts now travel on the goals list, the goal detail, the orient `served` object
  and the proposal card. Ratified at the Planning gate (epic decision 1) and deliberately unmeasured;
  orient's `roots` is explicitly excluded (d6) so ADR 0005 d11's boundedness property is preserved
  unchanged.
- **Debt / follow-ups:**
  (a) **`UNAVAILABLE`'s `estimate` entry goes stale on this branch.** `direction.js:88-99` says
  *"chanceOfSuccess is read here from the goal's raw record; the goals read API drops it
  (parseGoalRow)"* — after this story the second clause is false. It is **deliberately not changed
  here**: U28 (`:642`) pins that `UNAVAILABLE` names the estimate's dependency goal by slug, and
  editing a closed book's shipped constant is exactly the hazard this epic has been kicked back for
  twice. The book's close should report it, and correcting the sentence belongs with retiring the
  workaround.
  (b) A stored explicit `null` is indistinguishable from never-set on the four projecting surfaces —
  inherited from the existing ten fields, and the export still distinguishes them.
  (c) `INTENT_FIELDS` is exported unfrozen. Left as-is: freezing it is a behavior change to a
  shipped story-1 export, it is a module-private convention in a codebase with no `Object.freeze`
  habit anywhere on this path, and no caller mutates it. If a Tester wants a guard, an S-class
  assertion that the exported list still reads `['prompt','chanceOfSuccess','needsHumanInput','needsBreakdown']`
  is the cheaper instrument than a runtime freeze.
  (d) The story-3 / AC6 collision recorded in d10.
- **Firmware reinstall required?** **No.** No concept is added and none is redefined — the live
  schema node already declares all four (verified from the graph, 2026-07-26), the goal concept is
  runtime-created and has never been firmware-seeded, and this ADR changes only read projections.
  `GOAL_SCHEMA` (story 1's d5) is untouched.

## Implementation notes

Test-file changes belong to Phase 3 (the Tester's lane), not to implementation — including every
re-aim named below.

- **File: `src/lib/brain/goals.js`** — two edits, both additive; the module stays CommonJS with
  **zero `require` calls** (S1, `test/capture-a-goal-and-see-it.test.js:311`).
  - `parseGoalRow` (`:29-51`) — after `parent` (`:49`), add the four from `INTENT_FIELDS` per d1.
    Since `INTENT_FIELDS` is declared at `:264`, either move the constant above `parseGoalRow` or
    build the record then assign the four in a loop before returning — implementer's call; a `const`
    at module scope is hoisted-but-uninitialized, so a loop *inside* the function body works either
    way. Update the module's header docstring (`:10-18`), which enumerates the record shape.
  - Add `projectIntentFields(record)` per d2, next to `pickIntentFields` (`:288`), with a doc comment
    stating the verbatim rule and the deliberate read/write asymmetry. Export it (`:297-306`); the
    export list grows by exactly this one name.
- **File: `src/api/brain/index.js`** — four literals, each gaining one spread; nothing else in the
  handlers changes (gates, Cypher, readers, sorts, caps, tie-breaks all untouched).
  - `handleGetGoals` `:225-241` — `...projectIntentFields(r)` inside the row literal.
  - `handleGetGoalDetail` `:360-378` — `...projectIntentFields(winner)` inside the `goal` literal.
    Do **not** touch `parentSlug`/`parentName`.
  - `handleGetOrient` `:431-442` — `...projectIntentFields(winner)` inside `served`. Do **not** touch
    `roots` (`:404-407`) or `ancestry` (`:423-430`).
  - `handleGetProposals` `:471-486` — `nameBySlug` → `recordBySlug` per d9; `goalName` reads
    `rec && rec.name` with the identical `|| p.goal` fallback; `...projectIntentFields(rec || {})`
    inside the card literal. Do **not** touch `passedOver` (`:480-484`).
  - Add `projectIntentFields` to the existing `require` from `../../lib/brain/goals` (`:26`) — the
    module gains no new require **line**, which matters: the brain module's require list is S-pinned
    as an allow-list of specs across the second-brain suites (`attach-the-world:555`,
    `break-a-goal-into-pieces:536`, `capture-a-goal-and-see-it:327`, `sessions-read-the-brain`,
    `the-proposal-loop`, `teach-it-what-matters`) — the "quadruple pin" ADR 0005 d-Cons names, since
    grown. A destructured name is invisible to all of them; a new `require(...)` spec is not.
- **File: `src/lib/brain/direction.js`** — one edit. `deriveTerms` (`:136-146`) gains `prompt`,
  `needsHumanInput`, `needsBreakdown` per d5, named literally with a comment pointing at
  `goals.js`'s `INTENT_FIELDS` and at the zero-require pin that forbids importing it. `parseEstimate`,
  `UNAVAILABLE`, `SURRENDERED`, `resolveAnchor`, `identify`, `blindSteps` and `boundarySteps` are
  **untouched**.
- **Unchanged, deliberately** (a diff touching these for this story is a defect):
  `src/lib/brain/export.js`, `handleGetExport` (`src/api/brain/index.js:733`), every concept-graph
  endpoint, `src/api/normalize/index.js` in its entirety (`fetchGoalRecords` `:2141`, `restoreBrain`
  `:5016`, `mintRestoredGoal`, `GOAL_SCHEMA`), `src/lib/brain/hygiene.js`, and every file under
  `ui/` (screens are story 3).
- **Test pins the Tester must re-aim** (Phase 3): `test/store-the-four-…:1118` **R1** — the ten-field
  sentinel, which names this story as its re-pin, becomes fourteen; and its sibling assertion that
  the existing projection is still correct should survive as-is. Expected to pass **unmodified**:
  `capture-a-goal-and-see-it` U1/U2/U3 and S1; `break-a-goal-into-pieces` U1/U2;
  `structures-the-brain-can-trust` `:612`; `operational-direction` S1/U24/U25/U26/U28/H5;
  `the-proposal-loop` H2/S11; `sessions-read-the-brain` S6/H7; `the-brain-survives` export tests.
- Test-class guidance (the Tester's lane to specify): **U** — `parseGoalRow` on a section carrying
  all four (verbatim, including `0`, `false`, `''` and a multi-line prompt), a section carrying one,
  and a legacy section carrying none (all four `null`, none `0`/`false`/`''`); `projectIntentFields`
  always emits four keys in `INTENT_FIELDS` order, is non-mutating, and tolerates `null`/`{}`;
  `deriveTerms` carries the three and still reports an absent estimate as `null`+`'absent'`.
  **S** — the four literals each spread the projector; `roots`, `ancestry`, `passedOver`, `chain`,
  `blindSteps` carry none of the four; the proposal card carries no key matching
  `/score|rank|percent/i`; `direction.js` still has zero requires; `goals.js` still has zero requires
  and exports `projectIntentFields`; no sort/filter/cap references any of the four.
  **H** (live, sentinel-named fixture goals, pre-clean + raw teardown — the ADR 0003/0004 precedent;
  legacy goals never mutated) — one fixture goal with all four (including a multi-line markdown
  prompt and `needsHumanInput: false` stored explicitly) and one with none; read both back on all
  five surfaces and assert stored values verbatim on the first (prompt byte-identical on the
  **list** surfaces too) and `null` on the second — with the estimate read as `terms.estimate` on
  the Direction surface; the never-set goal is returned, not omitted, and errors nowhere; the export
  still **omits** the keys for the never-set goal; the goals list's set and order are unchanged
  before/after.
- **Server restart** after the edits: `docker exec tapestry supervisorctl restart brainstorm`.

## Out of scope

- **Showing the four on any screen** — `goal-intent-fields` #3, including the AC6 collision flagged
  in d10. No `ui/` file changes here.
- **Accepting the four at write time** — `goal-intent-fields` #1, shipped.
- **Materializing the concept's declared defaults**, at any layer. The interpretation point is the
  screen (epic decision 6).
- **Retiring the Direction endpoint's raw-record workaround** (`parseEstimate`,
  `readGoalRowsAndResolved`) and **correcting `UNAVAILABLE`'s now-stale `estimate` detail** — both
  reserved; see Consequences (a).
- **Any rule about the four**: ranking, filtering, gating, ordering, clamping, coercion, type
  validation on read, or which prompts may run. A malformed stored value comes back as stored.
- **Shrinking any payload for size**, on any surface. Ratified out at the Planning gate.
- **`dependsOn` / prerequisites** — not one of the four; stays unavailable, and the book's close
  should report it so rather than treat it as missed.
- **OPEN.md row 102** (the schema-`required` defect) — neither fixed, closed, nor evidenced here.
