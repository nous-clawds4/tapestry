# ADR 0001: One shared picker carries the four onto every constructing goal-write path; the self-provisioned schema declares them

**Status:** Proposed
**Date:** 2026-07-26
**Story:** `engineering-team/stories/goal-intent-fields/1-store-the-four-when-a-goal-is-captured-or-updated.md`

## Context

Four properties are declared on the goal concept and no goal-specific write path accepts them, so
anything the owner supplies is dropped on the way in. This ADR designs the write half only — no read
surface, no screen, and no rule that consults what the four contain.

**The concept, from the graph (not from source).** Orientation ran the three-call pattern from inside
the container against the local instance: `GET /api/concept-graph/summaries` (57 concepts →
`tapestry-owner-goal`, 31 elements), then
`GET /api/concept-graph/node/39998:<TA>:tapestry-owner-goal/neighbors`, then
`GET /api/concept-graph/node/39999:<TA>:tapestry-owner-goal-schema`. `<TA>` came from
`GET /api/assistant/pubkey` at runtime and is never written down here or in code (house rule).

- `39998:<TA>:tapestry-owner-goal` — concept header. Its element records live under the json key
  `tapestryOwnerGoal`.
- `39999:<TA>:tapestry-owner-goal-schema` — the JSON Schema node. A **single-concept-object wrapper**:
  the top-level `properties` has exactly one key, `tapestryOwnerGoal`, whose inner `properties`
  declares twelve fields and whose inner `required` reads exactly `["name","slug","description"]`.
  All four are declared there and all four are **optional**: `prompt` (string), `chanceOfSuccess`
  (number, *"between 0 and 100 … The default is 0, if not otherwise estimated"*), `needsHumanInput`
  and `needsBreakdown` (boolean, `default: false`, *"Absent means false."*).

**Live corpus** (`GET /api/brain/export`, 31 goals): 7 carry `chanceOfSuccess`, 8 `needsHumanInput`
(both `true` and `false` values present), 7 `needsBreakdown`, 1 `prompt` — plus out-of-contract
`promptVersion` and `team` riding along. So "any subset" and the absent-vs-`false` distinction are
already real in stored data, and the four reached those records through record-replacing paths rather
than through any goal-specific write path.

**Where a goal record gets written.** A repo-wide sweep for construction of a `tapestryOwnerGoal`
section (`grep -rn tapestryOwnerGoal --include=*.js --include=*.jsx`, excluding `test/`) returns hits
in exactly one server module. That reproduces the story's derivation and finds no fifth constructing
site, so the kickback clause does not fire again.

*Work-bearing — build a section from a fixed set of fields, all in `src/api/normalize/index.js`:*

| Site | Where | Today |
|---|---|---|
| `noteGoalIdea` — session-attributed **root** capture (second-brain ADR 0005 d7) | core `:2903`, section built `:2927`, handler `:2875`, route `:5202` | builds `{name, slug, description, origin, capturedOn}` — drops all four |
| `createChildGoal` — child capture (ADR 0003 d6) | core `:2217`, section built `:2244-2249`, handler `:2182`, route `:5197` | fixed-field build — drops all four |
| `updateGoalIntent` — intent update (ADR 0003 d7) | core `:2315`, merge `:2351-2354`, handler `:2274`, route `:5198` | merges exactly `deliverable`/`boundary`/`parent` onto the parsed section, so four already stored **survive** an update; none can be set |
| `GOAL_SCHEMA` — what a fresh instance provisions (ADR 0008 d8) | constant `:4828-4850`, consumed by `ensureGoalConcept` `:4856` → `handleSaveSchema` `:4863` | declares eight properties, **omits all four** |

*No-work — replicate a supplied or stored record verbatim, so none can drop anything. Each verified
by reading it, not by inheritance:*

| Path | Where | Why it cannot drop |
|---|---|---|
| direct-record capture, generic element screen | `handleCreateElement` `:1760` | `let finalJson = elemJson;` (`:1803`) — an explicit `json` body is stored byte-verbatim |
| wholesale record replacement, generic element screen | `handleSaveElementJson` `:3302` | supplied json replaces the record via `regenerateJson` (`:3319`), ungated by concept type |
| graph-maintenance json-tag write | `handleSetJsonTag` `:4569` | rebuilds the tag list, substituting the supplied json for the existing `json` tag |
| restore from an export | `mintRestoredGoal` `:4905` | `JSON.stringify({ tapestryOwnerGoal: section })` with the artifact's section untouched (`:4911`) |
| archive import | `handleImportExecute` `src/api/io.js:435` | parses each raw event and writes it through `buildImportCypher` as given |
| forking a node | `handleForkNode` `:4433` | copies every tag off the original onto the new signed event — the `z` concept tag and the `json` tag included — swapping only the `d` tag |
| re-import a record from the relay | `handleEventUpdate` `src/api/neo4j/eventSync.js:311` | body is `{uuid}` alone: it deletes the stored tags and rebuilds from strfry's copy, so it replicates rather than composes |

**A Gate-1 aside that does not hold, checked rather than inherited.** `handleCreateElement`'s no-json
branch was reported to auto-populate every declared property with type defaults, yielding
`prompt: ''`, `chanceOfSuccess: 0` and both flags `false` — present rather than absent, in tension
with the story's AC1. It cannot. The loop at `:1823-1843` iterates the **top-level** `schema.properties`,
and the goal schema's only top-level key is the concept object, so it takes the `t === 'object'`
branch at `:1840` and produces `{ tapestryOwnerGoal: {} }` — an empty section, no defaults reached.
**No defense against that case is designed here**, and none should be added.

**Constraints that bind the design:**

- `src/lib/brain/goals.js` is the shared pure core and must stay CommonJS with **zero** `require`
  calls (`test/capture-a-goal-and-see-it.test.js:311` S1 purity pin). Its export list grows by
  presence, not by an exact-set pin.
- No write-time schema validation exists anywhere: ajv is client-side and display-only, `x-tapestry.unique`
  is advisory, and caller json is stored verbatim (ADR 0001 recon; ADR 0003 recon). Introducing
  validation on this path would be a new class of behavior, not an extension of an existing one.
- All three write cores already run inside `serializeGoalWrite` (`:2129`) and all three handlers
  already carry the `isOwner(req) || req.localTrusted → 403` gate. Neither needs changing.
- Source pins slice handler bodies by name + 8000 chars: `break-a-goal-into-pieces.test.js:556` (S3,
  `handleCreateChildGoal`), `:572` (S4, `handleUpdateGoalIntent` — including the `capturedOn`
  backfill), `sessions-read-the-brain.test.js:469` (S2, `handleNoteGoalIdea`),
  `the-brain-survives.test.js:661/668` (S7, `ensureGoalConcept` + a `GOAL_SCHEMA` carrying the
  wrapper). Additive growth keeps every one of them inside its window.
- Binding prior ADRs: second-brain 0001 (capture rides `create-element`; statement ≡ `description`),
  0003 (d6/d7 write contracts, d13's `required` invariant, d8's save-schema fold), 0005 d7
  (`note-goal-idea`), 0008 d8 (`ensureGoalConcept`/`GOAL_SCHEMA` as "the live schema's fields");
  event-tagging 0002 (never `publishEverywhere`); operational-direction 0001 d6 (the Direction core's
  local `chanceOfSuccess` read, to be retired by story 2, not here). **This ADR contradicts none of
  them and supersedes none.** It closes the `GOAL_SCHEMA`-vs-live-schema drift that ADR 0008 d8's own
  comment already declares an error ("the live schema's fields").

## Options considered

### Option A — One pure `pickIntentFields` in the goals core, applied at each constructing site; `GOAL_SCHEMA` gains the four declarations

`src/lib/brain/goals.js` grows a constant `INTENT_FIELDS` (the four names, in one place) and a pure
`pickIntentFields(input)` that returns an object containing exactly those of the four the caller
**supplied** (`input[f] !== undefined`), copied **verbatim** — no coercion, no trim, no clamp, no
default, no type check. The three constructing handlers call it once and `Object.assign` the result
onto the section they build; `GOAL_SCHEMA` gains the four property declarations with `required`
untouched. The seven replicating paths are recorded as "no change".

- **Pros:** absence is expressed by the only mechanism that survives a JSON round-trip — the key is
  simply not written, which is exactly AC1's "absent from the record"; one list of names, which
  story 2 imports rather than re-declaring; the shape is the one `deliverable`/`boundary`/`parent`
  already travel, so it inherits their gate, serialization, refusal, and privacy posture unchanged;
  verbatim copy is the only rule-free option, satisfying AC5's "not rejected, gated, reordered, or
  transformed because of what those four contain"; the core stays non-mutating and dependency-free.
- **Cons:** a fifth intent property later means editing two constants (the picker's list and
  `GOAL_SCHEMA`) rather than none; `updateGoalIntent` ends up carrying two field lists with different
  semantics (see d4 — deliberate, and a documented asymmetry a future reader could mistake for an
  oversight); wrong-typed input is stored as supplied rather than corrected, which is the story's
  declared-undefined territory but will look permissive.

### Option B — Schema-driven pass-through: copy any body key the live schema declares

Each constructing site reads the concept's JSON Schema and copies any request-body key that appears
under `properties.tapestryOwnerGoal.properties`.

- **Pros:** future intent properties need no code change at all; no hard-coded list anywhere.
- **Cons (dispositive):** it turns the schema into a **write-time gate**, which this codebase has
  deliberately never had (ajv advisory, caller json verbatim) — an undeclared property would be
  silently dropped, a content-driven transform AC5 forbids; on a fresh instance it would consult the
  very constant that omits the four, so the feature would fail exactly where criterion 4 says it must
  work; it silently widens `update-goal-intent` to overwrite `name`/`slug`/`description`, a far larger
  contract change than the story asks; and it adds a schema read (or a cache with an invalidation
  problem) to every goal write. Rejected.

### Option C — Change no write path; document the record-replacing paths as the way to set the four

The seven no-work paths already carry the four. Tell callers to use them.

- **Pros:** zero code.
- **Cons (dispositive):** it is the status quo, and the status quo is the gap the ask describes. Setting
  the four on an existing goal would mean replacing its whole record through the ungated
  `save-element-json`, the escape hatch second-brain ADR 0003 already flags as debt and whose Option C
  was rejected for making the contract "agent goodwill, not system behavior"; and `create-element`
  refuses duplicate names, so it cannot update. It also leaves criterion 4 untouched: a fresh instance
  still declares eight properties and silently drops the four however they are supplied. Rejected.

### Option D — A dedicated `POST /api/normalize/set-goal-intent-fields` endpoint

- **Pros:** the three existing write contracts stay byte-stable; the new surface's refusals are isolated.
- **Cons (dispositive):** it splits "update a goal's intent" across two endpoints with two contracts,
  so a caller must know which of seven fields lives where — contradicting ADR 0003 d7's framing of
  `update-goal-intent` as *the* intent-update primitive; it does nothing for either capture path, so
  AC1 would still fail; and it adds a fourth goal-write endpoint to gate, serialize, and test in
  exchange for four optional fields. Rejected.

## Decision

We chose **Option A** — because absence is the requirement, and "don't write the key" is the only
implementation of absence that survives storage, export, and restore unchanged; and because copying
verbatim is the only handling of the four that consults nothing about them.

Sub-decisions, each binding:

1. **`INTENT_FIELDS` — one list, one place.** `src/lib/brain/goals.js` gains an exported constant
   `INTENT_FIELDS = ['prompt', 'chanceOfSuccess', 'needsHumanInput', 'needsBreakdown']` — the four in
   the concept's own declared names, used verbatim as request-body keys (no new vocabulary; the
   existing `deliverable`/`boundary` body keys already equal their record keys). Story 2 reads this
   constant rather than re-declaring the names on the read side.

2. **`pickIntentFields(input)` — pure, non-mutating, rule-free.** Same file. Returns a new object
   carrying exactly those of `INTENT_FIELDS` for which `input[f] !== undefined`, each value copied as
   supplied. Explicitly **not** done: no `trim`, no `Number()`/`Boolean()` coercion, no type check, no
   range clamp, no default substitution, no rejection. **`undefined` is the only omission test** — a
   supplied `null` is a supplied value and is stored as `null`; a `!= null` test would silently drop
   it, which is a content-driven transform AC5 forbids. Non-mutating keeps the module's character
   (`sortGoals`, `resolveDecomposition`); `Object.keys()` of the result doubles as the "which fields
   were written" report, in `INTENT_FIELDS` order, deterministically.

3. **The two capture sites.** `handleNoteGoalIdea` (`:2875`) and `handleCreateChildGoal` (`:2182`)
   each compute `const intent = pickIntentFields(req.body || {})` and pass it as a new named parameter
   to their core; `noteGoalIdea` (`:2903`) and `createChildGoal` (`:2217`) `Object.assign(section, intent)`
   after their existing section build (`:2927` and `:2249` respectively). The whitelist is applied in
   the handler — the trust boundary, and the region the S-class pins scan — so no raw body object ever
   reaches a core. Everything else about both paths is untouched: gate, `serializeGoalWrite`, the
   `name-collides` collision guard, the `noted` work record, `dtag.slug(name)`, `publishToStrfry` +
   `importEventDirect`.

4. **The update site, and the deliberate two-list shape.** `handleUpdateGoalIntent` (`:2274`) keeps
   `provided` (`:2284`) as **exactly the three string fields it governs today**, and computes `intent`
   separately. Two consequences, both required:
   - The "at least one field" 400 (`:2287`) becomes
     `provided.length === 0 && Object.keys(intent).length === 0` — a **presence** test, never a content
     test, so `{goal, prompt: ''}` proceeds.
   - The `empty-value` refusal loop (`:2293-2301`) and the `.trim()` calls (`:2304-2306`) **stay bound
     to the three**. The four must never enter that loop: it rejects any non-string and any
     empty-after-trim value, so admitting `chanceOfSuccess: 75` there would reject a write because of
     what one of the four contains (AC5), and trimming would break AC3's byte-identical prompt.
     **This is the one place the obvious implementation is wrong** — appending the four to `provided`
     is a one-line change that silently creates a validation rule the frame forbids. The asymmetry is
     deliberate and must carry an in-code comment saying so.

   `updateGoalIntent` (`:2315`) then does `Object.assign(section, intent)` and
   `fields.push(...Object.keys(intent))` alongside the existing three assignments (`:2351-2354`).
   The `capturedOn` backfill (`:2346-2349`) runs first and is untouched, as is `regenerateJson`
   (`:2356`) — so everything else already on the goal, including any of the four already stored and
   any out-of-contract field such as `promptVersion`, passes through as it does today.

5. **`GOAL_SCHEMA` declares the four; `required` does not move.** The constant (`:4828-4850`) gains the
   four property declarations, worded from the live schema node read via the graph, in the constant's
   existing stripped style: `prompt` `{type:'string'}`, `chanceOfSuccess` `{type:'number'}`,
   `needsHumanInput` and `needsBreakdown` `{type:'boolean', default:false}`, each with the concept's
   own description sentence. `required` stays exactly `['name','slug','description']` and
   `x-tapestry.unique` is untouched. The `default: false` annotation is inert — nothing in the codebase
   reads `def.default` (`handleCreateElement`'s defaults are **type**-based, `:1836-1841`) — so it
   documents "absent means false" without becoming a rule.
   **This ADR takes no position on OPEN.md row 102.** That row concerns the already-signed live schema
   node; this decision concerns what a fresh instance provisions for itself. Different layer, different
   artifact, and nothing here is evidence about that row's state.

6. **Seven paths change, recorded as "no change."** `handleCreateElement` (`:1760`), `handleSaveElementJson`
   (`:3302`), `handleSetJsonTag` (`:4569`), `mintRestoredGoal` (`:4905`), `handleImportExecute`
   (`src/api/io.js:435`), `handleForkNode` (`:4433`), `handleEventUpdate` (`src/api/neo4j/eventSync.js:311`).
   Each replicates a supplied or stored record verbatim and therefore already satisfies the story.
   **A whitelist must not be added to any of them** — that would *narrow* a path that currently carries
   everything, including out-of-contract fields the export is required to preserve. If a further
   replicating path is found, it is a row in the story's table, not a change here.

7. **No operational step on this instance.** Unlike ADR 0003 d13, this story needs **no** live
   `save-schema` call: the live schema node already declares all four (verified from the graph,
   2026-07-26), and re-signing it would be churn. `ensureGoalConcept` is a no-op wherever the concept
   exists, so d5 changes behavior only on an instance that lacks it. Should some other deployment's
   schema node lack the four, the remedy there is the same one-time `save-schema` bootstrap ADR 0003
   d13 describes — outside this diff.

## Consequences

- **Enables:** all four settable through every path that captures or updates a goal, including on an
  instance that has never seen the concept; a single `INTENT_FIELDS` list for story 2's read side to
  import instead of re-declaring; verification with no new read work, since `GET /api/brain/export`
  returns each stored section verbatim (`familyEntries`, `src/lib/brain/export.js:47`); and the
  precondition for story 2 retiring the Direction core's local `chanceOfSuccess` read
  (operational-direction ADR 0001 d6 — retiring it is story 2's call, not required here).
- **Constrains:** the four are **carried, never consulted** — any future rule that gates, ranks,
  filters, or clamps them must supersede this ADR rather than extend it; `updateGoalIntent` now
  carries two field lists with intentionally different semantics, and collapsing them into one is a
  regression, not a cleanup; `GOAL_SCHEMA` is re-established as a mirror of the live schema's fields,
  so a future property added to one must be added to the other.
- **Debt / follow-ups:** (a) verbatim copy means a wrong-typed value (`chanceOfSuccess: "75"`) is
  stored as supplied — the story declares that undefined, and any future rule about it is a new
  decision, not a bug fix here; (b) the drift this closes was invisible because `ensureGoalConcept`
  is a no-op on every instance that already has the concept — nothing in the harness would have caught
  a second such drift, and a checker comparing `GOAL_SCHEMA` against the live schema node is a natural
  later addition; (c) `save-element-json` / `set-json-tag` remain ungated wholesale-replacement
  hatches (second-brain ADR 0003 debt (a)) — untouched and unwidened here.
- **Firmware reinstall required?** **No.** The goal concept is runtime-created and has never been
  firmware-seeded (verified: no goal concept under `firmware/versions/*/concepts/`, and no
  `tapestryOwnerGoal` anywhere in `firmware/`). `GOAL_SCHEMA` is a code constant consumed by
  `ensureGoalConcept` at runtime, only when the concept is absent. No concept is added, and none is
  redefined on this instance — the live definition already declares all four.

## Implementation notes

Test-file changes belong to Phase 3 (the Tester's lane), not to implementation — including any
re-aim of the source pins named below.

- **File: `src/lib/brain/goals.js`** — add exported `INTENT_FIELDS` (d1) and pure
  `pickIntentFields(input)` (d2), with a doc comment stating the three prohibitions explicitly: copied
  verbatim, `undefined` is the only omission test, nothing about the values is inspected. Must stay
  CommonJS with **zero `require` calls** (S1 purity pin, `test/capture-a-goal-and-see-it.test.js:311`).
  Export list grows by exactly these two names. `parseGoalRow` is **not** touched here — extending it
  is story 2's, and it is pinned by `test/structures-the-brain-can-trust.test.js:613`.
- **File: `src/api/normalize/index.js`** — four edits, all additive:
  - `handleNoteGoalIdea` (`:2875`) — lazy-require `pickIntentFields` from `../../lib/brain/goals`
    (the module's established in-body require idiom), compute `intent`, pass it to `noteGoalIdea`;
    in `noteGoalIdea` (`:2903`) `Object.assign(goalSection, intent)` after the section literal at `:2927`.
  - `handleCreateChildGoal` (`:2182`) — same; in `createChildGoal` (`:2217`) `Object.assign(section, intent)`
    after `section.parent = parentSlug;` (`:2249`).
  - `handleUpdateGoalIntent` (`:2274`) — per d4: `intent` computed separately from `provided`; the
    `:2287` 400 becomes a presence test over both and its message names all seven accepted fields; the
    `empty-value` loop (`:2293-2301`) and the `.trim()` calls (`:2304-2306`) keep iterating **only**
    `provided`, with a comment recording why the four are exempt (AC5 + byte-identical prompt). In
    `updateGoalIntent` (`:2315`), `Object.assign(section, intent)` and `fields.push(...Object.keys(intent))`
    beside the existing three assignments (`:2351-2354`); the `capturedOn` backfill and `regenerateJson`
    are untouched.
  - `GOAL_SCHEMA` (`:4828-4850`) — add the four property declarations per d5. **Do not touch `required`**
    and do not touch `x-tapestry.unique`.
- **Unchanged, deliberately** (d6 — a diff that adds field handling to any of these is a defect):
  `handleCreateElement` `:1760`, `handleSaveElementJson` `:3302`, `handleSetJsonTag` `:4569`,
  `mintRestoredGoal` `:4905`, `handleForkNode` `:4433`, `src/api/io.js:435`,
  `src/api/neo4j/eventSync.js:311`.
- **Also unchanged:** every route registration (no new endpoint); the three in-handler gates; the
  `serializeGoalWrite` mutex (`:2129`) — all three cores already run inside it, so no new serialization;
  the collision guards; `deriveStanding` and every standing rule (the four feed nothing).
- **Untouchables:** `src/api/normalize/relationships.js`, `src/api/normalize/probe.js` (byte-pinned),
  `src/middleware/auth.js`, `firmware/`, the four ADR-0015 `LEGACY_*` files.
- **Privacy posture unchanged:** the three write paths continue to ride `publishToStrfry` +
  `importEventDirect`; no `publishEverywhere` / `nostrPublish` anywhere in the diff; the goal z-tag
  stays outside every outbound router stream.
- **Handler-slice budget:** the S pins slice 8000 chars from each handler's name
  (`break-a-goal-into-pieces.test.js:556`/`:572`, `sessions-read-the-brain.test.js:469`); each
  handler+core pair is well inside that today and stays inside after these additions. Don't relocate
  the gate or the named refusal tokens out of the window.
- **Server restart** after the edits: `docker exec tapestry supervisorctl restart brainstorm`.
- Test-class guidance (the Tester's lane to specify): **U** = `pickIntentFields` — each field alone,
  all four, none, `undefined` omitted vs `null` stored, no trim on a padded multi-line prompt, no
  coercion of a numeric string, non-mutation of the input, deterministic key order. **S** =
  `goals.js` still zero-require and exports both new names; the four never appear inside
  `handleUpdateGoalIntent`'s `empty-value`/trim region; `GOAL_SCHEMA` declares the four with `required`
  still exactly `['name','slug','description']`; the seven replicating paths carry no field whitelist.
  **H** = on sentinel-named fixture goals with pre-clean and raw teardown (the ADR 0003/0004 precedent;
  the legacy goals are never mutated) — capture via each of the two capture paths with a subset
  supplied, read back through `GET /api/brain/export`, assert the supplied keys present with the
  supplied values **and the unsupplied keys absent from the section**; a multi-line markdown prompt
  byte-identical on round-trip; update setting one of the four leaves the other three and every
  pre-existing field untouched; a capture with none of the four still succeeds.

## Out of scope

- **Returning or showing the four** — `goal-intent-fields` #2 and #3. `parseGoalRow` and every read
  projection are untouched here.
- **Any rule about the four**: rejection, clamping, coercion, defaulting at write time, ranking,
  filtering, gating, or which prompts may run. A malformed value's fate stays undefined, per the story.
- **Which properties are `required`**, on any instance — and **OPEN.md row 102**, which concerns the
  already-signed live schema node. Neither is touched, fixed, or evidenced by this ADR.
- **Clearing a value back to unset**, and **backfilling** the four onto goals that already exist.
- **`dependsOn` / prerequisites** — not one of the four; stays unavailable, and the book's close should
  report it so rather than treat it as missed.
- **Retiring the Direction core's local `chanceOfSuccess` read** (operational-direction ADR 0001 d6) —
  this story makes it retirable; story 2 decides.
- **Gating `save-element-json` / `set-json-tag`** — pre-existing debt, separately tracked, neither
  fixed nor widened here.
