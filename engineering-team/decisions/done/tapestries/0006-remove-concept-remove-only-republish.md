# ADR 0006: Take a concept out of a Tapestry — remove-only subtract transform, same-coordinate republish

**Status:** Proposed
**Date:** 2026-07-30
**Story:** `engineering-team/stories/tapestries/6-take-a-concept-back-out.md`
**Relationship to prior ADRs:** Extends the epic; contradicts nothing. ADR `done/tapestries/0005`
(§Consequences: "Add-only is structural, so future 'remove' … stories get no head start from this
code — deliberate; those are separately-goaled work") explicitly deferred this slice; this ADR
delivers it inside 0005's conventions — the same pure-transform module, the same publish paths,
the same owner-strict gate, the same re-read pattern. ADRs `done/tapestries/0001`–`0004` deferred
all editing and are untouched. Nothing is superseded.

## Context

Story `tapestries` #6, under the operational Direction book
`engineering-team/audits/take-a-concept-back-out/book.md`. The approved acceptance criteria,
quoted:

- **Offered only where editing is possible.** "Given the owner viewing the Exploration page
  (`/tapestry/tapestries/<uuid>`) of a tapestry whose author is the owner's own pubkey or the
  instance's assistant (TA) pubkey, then a take-out-a-concept affordance is present on that
  existing page (no new page) for its member concepts. Given a tapestry authored by any other
  pubkey, or a viewer who is not the owner, then no removal affordance is offered."
- **The last concept cannot be taken out.** "Given such an editable tapestry whose membership is
  exactly one concept, then taking it out is refused: the owner sees a plain-language refusal
  (not an error after an attempted save), no save is possible for it, and the tapestry is
  unchanged. No save from this surface can leave a tapestry with zero member concepts."
- **Save = removing only, confirmed first, published as tapestries already are.** "Given such an
  editable tapestry with two or more member concepts, when the owner chooses one to take out,
  then nothing is published until the owner confirms the save; declining leaves the tapestry
  unchanged. On confirmation the tapestry is republished under its existing author key via the
  publish paths #3 established and #5 reused (owner-key tapestry → signed in the browser by the
  owner; assistant tapestry → signed as the assistant), with no new server endpoint; and the
  result keeps the tapestry's identity and everything else intact: same uuid/URL, no duplicate
  entry in the Tapestries directory, every other member concept still present, title and
  description unchanged, everything else the element carried unchanged — the only difference is
  that the removed concept, and what the tapestry carried solely on its behalf, is gone. Given
  the publish fails, the owner sees a clear error and the tapestry's membership is unchanged."
- **Gone for me.** "Given a successful save, then the Tapestry view the owner is looking at no
  longer shows the removed concept among the member concepts."
- **Gone for anyone else afterwards.** "Given a successful save, when any other session
  (including one that is not signed in) opens the same tapestry (same uuid/URL, or via the
  directory) afterwards, then the removed concept no longer appears among its member concepts."

**Hard boundary (owner's words):** removing only; a tapestry keeps at least one concept — the
last one is refused; owner's key or the assistant's only, the option is not offered for anyone
else's; no new page and no new server endpoint; publishes the way tapestries are already
published. The story's four ratified readings (owner-strict gate; explicit confirm-before-publish;
up-front plain-language last-member refusal; solely-carried per-member entries leave with the
member) are treated as settled, not re-litigated.

**Concept-graph orientation** (three-call pattern, local stack up, port 7778, TA runtime-resolved
`11f23fe4…93767` — value never hardcoded anywhere in this design):

- `/summaries` → `39998:<TA>:tapestry` — "A graph of concept graphs that validates against
  normalization rules." A tapestry *instance* is a kind-39999 addressable element z-tagged to
  this handle; the directory reads by that z-tag (`Index.jsx:55–57`).
- `/node/39998:<TA>:tapestry/neighbors` → the standard class-thread wiring (schema, concept
  graph, core-nodes graph, properties…). **No concept definition changes in this story** — the
  republished tapestry is an *element*; the `tapestry` concept-header, its schema, and every
  firmware definition are untouched.
- Per removed member the element carries: a node pointing at `39998:<TA>:<slug>` (the concept
  header) and an import pointing at `39999:<TA>:<cg>-concept-graph` (the member shape ADR 0003
  Decision 2-A publishes and ADR 0005 Decision 1-A appends).

**Verified facts (this session, against the live local stack, HEAD of
`feat/take-a-concept-back-out` = `origin/staging`+8 own commits, 0 behind):**

- **Live census — the "no authored connections" claim verifies; the stop-condition does not
  fire.** Every reachable relay was scanned read-only for kind-39999 elements z-tagged
  `39998:<that instance's TA>:tapestry` (TA resolved per instance via `/api/assistant/pubkey`):
  - local: exactly **one** element, d-tag `b0b48b00` — 4 member nodes, 4 imports,
    `relationships: []`, `relationshipTypes: []`.
  - `tapestry.brainstorm.world`: **0** elements. `tags.brainstorm.world`: **0** elements.
  - `staging.brainstorm.world`: exactly **one** element, d-tag
    `tapestry-tapestry-for-cat-abc0dc1d` — 4 member nodes, `relationships: []`,
    `relationshipTypes: []`.
  Two tapestries exist in the world; neither carries authored connections. Whatever
  `relationships`/`relationshipTypes`/unknown keys an element carries still passes through
  **verbatim** (the transform copies, never rebuilds), so even a hand-authored future event is
  preserved — but no removal-of-a-connected-concept behavior is designed, per the story's
  Out of scope.
- **The live `b0b48b00` element is the divergence fixture.** Its `dog` member node is
  `{slug: "concept-header-for-the-concept-of-dogs", uuid: "39998:<TA>:b08502ed-9adf-42b4-9e10-ef3090179346", name: "dog"}`
  — the header's d-tag is a **random UUID** — while its import is
  `39999:<TA>:dog-concept-graph` (derived at add time from the header's `oSlugs.singular` =
  `dog`). So "derive the import uuid from the node uuid's slug segment" **fails on real data**;
  any attribution design must survive this event (Decision 2).
- **The read-time dedup contract is what re-materializes a member.** `composeGraph`
  (`tapestryGraphModel.js:56–68`) dedups nodes **by slug** across the element graph + resolved
  imports; each `*-concept-graph` carries its concept's header node under the **same slug** the
  tapestry's member node uses (verified on all four live imports — e.g. `dog-concept-graph`
  contains slug `concept-header-for-the-concept-of-dogs`, uuid `39998:<TA>:dog`). Consequence:
  **removing the member node alone is not enough** — if the member's import survives, the
  resolved import re-contributes a `39998:`-uuid node under the removed slug and the concept
  still shows (`memberConcepts` filters composed nodes by `inferNodeType === 'conceptHeader'`,
  `TapestryDetail.jsx:218`). The ratified reading "solely-carried entries leave with the member"
  is therefore load-bearing for AC-4/AC-5, not hygiene.
- **Read/replace mechanics (unchanged from #5).** Detail page reads by exact coordinate
  (`useTapestryGraph.js:19–24` `readByUuid`: `kinds+authors+#d`); directory reads by `#z`
  (`Index.jsx:55–57`); both via `GET /api/strfry/scan` (`ui/src/api/relay.js:12–22`). Kind 39999
  is NIP-01-addressable: same kind + author + d-tag → newer replaces older, relay-natively, no
  reindex. Both filters verified live this session against `b0b48b00` (an earlier `#z` miss was
  a shell-quoting artifact in my probe, not an index defect — byte-exact filters return the
  event on both the CLI and the HTTP endpoint).
- **Publish paths (reused verbatim).** TA-authored → `POST /api/strfry/publish`
  `{event, signAs:'assistant'}` (server re-signs as TA, `isOwner(req) || req.localTrusted`
  403-gate, awaits `strfry import`); own-key → `getActiveSignerOrThrow(author)`
  (`ui/src/utils/signerGuard.js:59–64`) → `window.nostr.signEvent({...unsignedEvent, pubkey:
  author})` → `publishOrThrow(signed)` (`ui/src/utils/publishProfileTag.js:24–33`). Exactly
  `AddConceptToTapestry.jsx:56–91`.
- **The shipped #5 surface this story extends.** Owner-strict gate `canAdd` at
  `TapestryDetail.jsx:189–190` (`user?.classification === 'owner' && (event.pubkey === taPubkey
  || event.pubkey === user?.pubkey)`, taPubkey from `useConfig()`); sidebar member rows at
  `TapestryDetail.jsx:231–239` (one `<button>` per composed member — selection only); the add
  affordance at line 240; `useTapestryGraph` already returns `event`, `imports` (resolved
  `[{slug, uuid, graph}]`, failures silently dropped, `useTapestryGraph.js:66–78`) and
  `reload()`; `useConceptOptions.js:15–42` `toConcept` exposes `conceptGraphSlug =
  conceptHeader.oSlugs?.singular || dTag` keyed by `handle` — the exact derivation add/create
  used to build the import uuid.
- **Shipped sentinels constrain refactoring.** `test/add-a-concept-to-a-tapestry.test.js` S3
  (lines 348–359) regex-asserts the publish-path strings (`/api/strfry/publish`, `assistant`,
  `getActiveSignerOrThrow`, `signEvent|window.nostr`, `publishOrThrow`) **in
  `AddConceptToTapestry.jsx`'s source**; S4 asserts the owner-strict gate strings in
  `TapestryDetail.jsx`. Extracting the publish branch out of the add component would require a
  Phase-3 re-aim of a shipped suite (weighed in Decision 4).
- **TA pubkey discipline.** Every author comparison and handle composition below uses
  `useConfig().taPubkey` client-side or pubkeys read from the event/uuid itself. ADR 0015's
  legacy-literal exception covers only the tag/nostr-user-tag/tag-pinning z-tag composition and
  is not implicated here (the tapestry family was born runtime-resolved, ADR 0005).

**Constraints:** JS-without-build; no new dependencies; no new page; no new server endpoint;
test-file changes are Phase 3's lane (none are specified here).

## Options considered

### Decision 1 — How the replacement event is built

#### Option 1-A (chosen) — a new pure subtract transform: copy everything, remove one member

Add `buildRemoveConceptDraft({ event, memberUuid, resolvedImports = [], conceptOptions = [] })`
to `ui/src/pages/tapestries/tapestryDraft.mjs` (pure, React-free, dynamic-importable in the
stack-free runner — the same testability contract as both existing builders). It takes the
tapestry element *as read from the relay* and produces the replacement unsigned event by
**verbatim copy + one subtraction**:

- Copy `kind` (assert 39999), `content`, and **every tag unchanged and in order** — `d`, `name`,
  `z`, unknown tags — except the `json` tag, whose parsed value is re-serialized with exactly two
  removals: `graph.nodes` minus the **one** node whose `uuid === memberUuid`, and `graph.imports`
  minus the import(s) **attributed to that member and claimed by no remaining member**
  (Decision 2). Everything else — `tapestry` block, `relationships`, `relationshipTypes`,
  unknown json keys, remaining nodes/imports **in their original order** — passes through
  untouched. "Everything else stays as it was" is a structural property, not a hoped-for outcome.
- **Refuse what can't be removed cleanly** (throws, with messages the UI shows verbatim):
  - event not kind 39999, or no `d` tag (no coordinate to republish to);
  - `json` tag unparseable or not an object; `graph` **absent or null** (a graph-less tapestry
    has no members to take out — the story's Out of scope; the page never offers removal there);
    `graph.nodes` not an array; `graph.imports` present but not an array — mirror of 1-A's
    "refuse what can't be preserved" (ADR 0005), extended per story #5's ratified Deviations;
  - `memberUuid` not found among the element's own `39998:`-uuid nodes (not an authored member —
    covers "ghost" members visible only via imports, Decision 3);
  - the member is the **last** authored concept (Decision 3's count is exactly 1) — the
    plain-language sentence, e.g. "A tapestry keeps at least one concept — the last one can't be
    taken out." (transform-level backstop; the page refuses up-front per AC-2);
  - the removed node's `slug` is shared by another `39998:`-uuid node (composeGraph would have
    been merging them; removal of one cannot be shown distinctly — the mirror of add's
    slug-collision refusal).
- `created_at = Math.max(now, event.created_at + 1)` — strictly newer, so replacement can never
  tie (same rationale as `buildAddConceptDraft`, `tapestryDraft.mjs:176`).
- Returns `{ dTag, uuid: '39999:'+event.pubkey+':'+dTag, unsignedEvent, removed:
  { node, importUuids } }` (no `pubkey` on the unsigned event; the signing branch attaches it).
  The `removed` summary feeds the confirm copy ("Take out *cat*?") and tests.

Also add and export the tiny pure helper **`authoredConceptMembers(event)`** → `[{slug, uuid,
name}]` of nodes with uuid starting `39998:` in the element's own `json.graph.nodes` (`[]` on
missing/malformed json or graph). One definition of "authored membership" shared by the transform
(membership + last-member checks), the page (per-row eligibility + count), and tests — the
membership-definition drift ADR 0005's Consequences warned about now has a single home.

Pros: remove-only **by construction** — identity (`d`), `name`, `z`, title/description, authored
connections (none exist live, but pass through anyway), unknown fields, ordering all survive
verbatim for *any* d-tag shape (the live bare-hex `b0b48b00` included); same coordinate →
relay-native replacement → AC-5 for free; pure and unit-testable stack-free. Cons: a third
builder in `tapestryDraft.mjs` (~70 lines with the matcher), which now hosts the full
create/add/remove lifecycle — acceptable cohesion, it is the module's stated purpose.

#### Option 1-B (rejected) — rebuild via `buildTapestryDraft` from the remaining members

Parse title/description out of the element, list the remaining members, re-run
`buildTapestryDraft` with the existing d-tag suffix. Rejected on the same four defects ADR 0005
catalogued when it rejected this shape for add, all still live: (1) `dTag = 'tapestry-' +
slugifyTitle(title) + '-' + suffix` (`tapestryDraft.mjs:42`) can never reproduce `b0b48b00` — the
republish lands on a new coordinate, failing "same uuid/URL, no duplicate entry" outright;
(2) it rewrites the `name` tag from slug to title on the live event — an edit beyond removing;
(3) it zeroes `relationshipTypes`/`relationships` — harmless against today's census, wrong by
construction the day a tapestry carries authored data; (4) it re-derives **every** remaining
member's import from today's headers, silently rewriting rows the owner didn't touch (see
Decision 2-B). Pros: zero new model code. The story's ceiling is remove-only; this option can
edit as a side effect of rebuilding.

#### Option 1-C (rejected without much contest) — server-side removal endpoint

Violates the boundary verbatim ("no new server endpoint") and would strand own-key signing
server-side where it can't happen. Named for completeness.

### Decision 2 — Attributing "what the tapestry carried solely on its behalf" (which imports leave)

The element stores no node→import mapping; the add-time derivation (`oSlugs.singular`) is not in
the element; and the live `dog` member proves the node uuid's slug segment (`b08502ed-…`) can
diverge from the import's (`dog`). Attribution therefore needs evidence.

#### Option 2-A (chosen) — union-of-evidence matcher inside the pure transform, fed page data

Inside `buildRemoveConceptDraft`, import `I` is **carried for** authored member node `M` iff any
of:

- **(a) read-time containment:** `resolvedImports` (the page's already-resolved
  `useTapestryGraph.imports`, passed in) has an entry with `I.uuid` whose `graph.nodes` contains
  a node with `slug === M.slug`. This is *the* authoritative test — it is literally the mechanism
  by which a surviving import would re-materialize the removed member at compose time (dedup by
  slug), so removing exactly what matches it is what makes "no longer shows that concept" true.
  It also handles the cleanup case that most needs this feature: a member whose concept header
  was **deleted from the instance** (no picker option exists) but whose import still resolves.
- **(b) options derivation:** `conceptOptions` (the page's `useConceptOptions()` list, passed in)
  has an option `O` with `O.handle === M.uuid` and
  `I.uuid === '39999:' + pubkeyOf(O.handle) + ':' + O.conceptGraphSlug + '-concept-graph'` — the
  exact uuid add/create derive (`useConceptOptions.js:37`, `tapestryDraft.mjs:154`). Decisive
  even when the import fails to resolve; covers the live `dog` divergence
  (`b08502ed…` → `oSlugs.singular` `dog` → `dog-concept-graph`).
- **(c) short-slug derivation:** `I.uuid === '39999:' + pubkeyOf(M.uuid) + ':' + dTagOf(M.uuid) +
  '-concept-graph'` — zero external data, covers the common `cg === shortSlug` case (three of the
  four live members) even when the header is deleted *and* the import is unresolvable.

An import is **removed iff** it is carried for the removed member **and not** carried for any
remaining `39998:`-uuid node (the "solely on its behalf" guard — an import shared because two
headers derive the same concept-graph stays while either member remains). An import carried for
**no** member under any matcher passes through unchanged: it is "everything else," and removing
what we cannot attribute would be an edit beyond removing. All pubkeys above come from the
handles themselves (`pubkeyOf` = the middle segment) — the transform needs no `taPubkey`
parameter and can hardcode nothing.

Pros: correct on every live event; each matcher covers the others' blind spots (resolution
failure ↔ deleted header ↔ slug divergence); pure and unit-testable with fixture arrays; the
functional guarantee (a) is stated as such. Cons: ~25 lines of matcher logic; one documented
residual — an import that is *unresolvable now*, *unmatched by (b)/(c)*, and would *later*
resolve to contain the removed slug would re-materialize the member then. That requires the
member's header **and** concept-graph both deleted **and** a divergent `cg` **and** later
resurrection of the old concept-graph event — and if the owner recreates that concept, a tapestry
entry pointing at it is arguably meaningful again. Accepted and recorded rather than blocking
every removal on any unresolvable import.

#### Option 2-B (rejected) — re-derive `imports` from the remaining members

The goal-prompt's sketch ("rebuild from the reduced member list and the removed member's import
row drops with it"). Faithful to the prompt's *intent* but not to the boundary's letter: deriving
from **today's** headers rewrites rows the owner didn't touch — if `dog`'s `oSlugs.singular` had
drifted to `hound` since creation, removing `cat` would silently rewrite the dog import to
`hound-concept-graph`. That is an edit beyond removing and breaks "everything else stays as it
was" structurally (ADR 0005 rejected the same move as its Option 1-B defect 4). It also fails
entirely for members whose header no longer exists on the instance.

#### Option 2-C (rejected) — derivation-only matching ((b) + (c), no containment)

Simpler, no resolved-imports input. Rejected because it orphans the import exactly in the
mistaken-member cleanup case: header deleted (no option → (b) dead) with divergent cg ((c) dead)
while the import still resolves — the member node is removed but the import re-contributes the
header node at compose time and **the concept still shows**, failing AC-4/AC-5. (a) is the
matcher that tracks the actual read-time semantics; it stays.

### Decision 3 — What counts as membership, and the last-member rule

**Option 3-A (chosen) — the authored graph block, `39998:`-uuid nodes only.** Member concepts =
`authoredConceptMembers(event)` — nodes with a `39998:` uuid in the *element's own*
`json.graph.nodes` (ADR 0005 Decision 2-A extended from add to remove). The removable set is
exactly this list; the last-member refusal fires when its length is 1 (a graph carrying one
header plus property/superset nodes still refuses — the boundary's word is *concept*). The page
derives per-row eligibility and the count from the same helper; the transform re-checks both
(defense in depth, unit-testable without a DOM). "Ghost" members — visible in the composed graph
only via a resolved import, absent from the authored block — get **no** take-out control, and the
transform refuses them with a clear message: what they need removed is an *import with no node*,
which is an integration-shaped edit, not membership removal (no live instance of this shape
exists; recorded in Out of scope).

**Option 3-B (rejected) — the composed graph** (`memberConcepts`, what the sidebar lists).
Rejected on ADR 0005's grounds, sharpened here: composition fluctuates with import resolution, so
the last-member count could change between renders (a refusal that appears and disappears), and
ghosts would be offered a removal the transform cannot express. The sidebar continues to *render*
from the composed graph (read model, ADR 0002 — unchanged); eligibility is simply intersected
with the authored set (matching by `uuid`: composed members carry the authored uuid because the
element graph is composed first and its uuid wins, `tapestryGraphModel.js:60–66`).

### Decision 4 — Gate and signing branch

**Chosen — reuse #5's owner-strict gate and both publish paths verbatim; duplicate the ~18-line
signing branch in the new component rather than extract it.** `TapestryDetail` computes one
`canEdit = user?.classification === 'owner' && !!event && (event.pubkey === taPubkey ||
event.pubkey === user?.pubkey)` (the existing `canAdd` expression renamed; gates both
affordances — same Director-ratified owner-strict reading, same runtime-resolved `taPubkey`,
same second line of defense in the server's 403 gate). The signing branch is data, not a
decision: `event.pubkey === taPubkey` → `POST /api/strfry/publish {event, signAs:'assistant'}`;
else → `getActiveSignerOrThrow(author)` → `window.nostr.signEvent({...unsignedEvent, pubkey:
author})` → `publishOrThrow(signed)` — byte-for-byte the branch at `AddConceptToTapestry.jsx:64–82`.

*Named alternative — extract a shared `publishTapestryElement()` helper, rejected for this
story.* DRY says one publish branch; two things outweigh it here: (i) the boundary pins "adding
is already built and **stays as it is**" — the design that touches zero shipped add-path lines is
the frame-aligned one; (ii) shipped sentinel S3 (`test/add-a-concept-to-a-tapestry.test.js:348–359`)
asserts the publish-path strings in `AddConceptToTapestry.jsx`'s *source*, so extraction forces a
Phase-3 re-aim of a shipped suite (the docstring workaround #5's Deviations recorded is a smell,
not a pattern to repeat). The drift cost is real and accepted — recorded in Consequences with a
rule-of-three trigger: a third consumer of the branch extracts it, re-aiming S3 in that story's
Test Design.

### Decision 5 — UI composition: per-member control, inline confirm, post-save re-read

**Chosen:**

- **A new `RemoveConceptFromTapestry` component** (`ui/src/pages/tapestries/RemoveConceptFromTapestry.jsx`),
  rendered once inside `TapestryDetail`'s sidebar "Concepts" section (directly under the member
  rows, above/beside `AddConceptToTapestry` — the affordance lives with the members the page
  already shows; no new page, no new route). Props: `{ event, imports, onRemoved }`. Internally
  `useConfig()`, `useConceptOptions()` (its own call — the add component keeps its private one,
  untouched), and this state machine:
  - **Idle:** each *eligible* member (authored, per Decision 3) renders a small "Take out…"
    control in a list inside the component (member name + action), only when
    `authoredConceptMembers(event).length >= 2`. When the count is exactly 1, the component
    renders **the plain-language refusal sentence instead of any control** — AC-2's refusal is
    something the owner *sees*, up-front, with no way to attempt the save: e.g. "A tapestry
    keeps at least one concept, so its last one can't be taken out."
  - **Armed (confirm step):** choosing a member publishes nothing; the component swaps in an
    inline confirmation — "Take out *{name}*? The tapestry itself stays, at the same address;
    only this concept leaves it. Nothing changes until you confirm." with **Take out** and
    **Cancel** buttons. Cancel (or picking a different member) returns to idle with the tapestry
    untouched — the ratified confirm-before-publish moment, satisfied in the DOM.
  - **Saving:** confirm → `buildRemoveConceptDraft({ event, memberUuid, resolvedImports:
    imports, conceptOptions: concepts })` → the Decision-4 signing branch → on success
    `onRemoved(removedNode)`; on throw, show `err.message` inline (transform refusals and
    publish failures alike), membership unchanged — nothing was accepted by the relay. Busy
    guard against double-submit (mirror `AddConceptToTapestry.jsx:57`).
- **Why not per-row "×" buttons on the existing member rows:** the sidebar rows are `<button>`
  elements (`TapestryDetail.jsx:231–239`); nesting an action inside them is invalid HTML, and
  restructuring every row to a wrapper-div-plus-two-buttons churns the shipped selection UI that
  "stays as it is." A separate control block under the list keeps the shipped rows byte-identical
  and gives the confirm step an obvious home. (*Named alternative, rejected:* row-level controls
  with a lifted "armed" state in `TapestryDetail` — more direct pointing, but it moves publish
  state into the page component and touches the shipped row markup for layout alone.)
- **Why inline two-step rather than `window.confirm()`:** the house `confirm()` idiom exists
  (`FirmwareExplorer.jsx:189`, `Dashboard.jsx`) but is an ops-surface idiom — unstylable,
  JS-blocking, awkward for the plain-language sentence the ratified reading asks for, and
  clunkier under the mocked-Playwright pattern the epic's suites use. The AC's "nothing is
  published until the owner confirms" is satisfied identically; the inline step also carries the
  member's name. (*Named alternative, rejected:* `window.confirm(...)` — fewer lines, native, but
  the refusal/confirm copy is the product surface here.)
- **Post-save visibility by re-read, not optimism** (ADR 0005 Decision 4, unchanged mechanism):
  `TapestryDetail` passes `onRemoved` = a handler that calls the existing `reload()` and, iff the
  removed member's slug is the currently `selected` concept, resets `selected` to
  `{ kind: 'integration', key: 'graph' }` so the page never shows the detail pane of a concept
  that is no longer a member. The publish endpoint completes `strfry import` before responding
  (TA branch) and `publishOrThrow` requires local acceptance (own-key branch), so the re-read
  races nothing. AC-4 is the re-read; AC-5 is the same read every other session performs against
  the replaced coordinate — one mechanism, not two code paths.
- **Degraded/malformed tapestries get no removal affordance** in either degraded branch
  (`rawGraph === null` first-add offer stays exactly as shipped; malformed graphs get nothing) —
  a graph-less tapestry has no members to take out (story Out of scope), and the transform would
  refuse anyway.

## Decision

We chose **1-A + 2-A + 3-A + 4 + 5**: a pure subtract transform (`buildRemoveConceptDraft`) that
copies the existing element verbatim and removes exactly one authored member node plus the
import(s) attributed to it by union-of-evidence (read-time containment ∪ options derivation ∪
short-slug derivation) and claimed by no remaining member, at the same coordinate; membership and
the last-concept refusal judged from the authored graph block via one shared helper
(`authoredConceptMembers`); the affordance gated by the same owner-strict expression as #5 and
published through the unchanged #3/#5 paths chosen by the event's author; delivered as one new
sidebar component with an inline confirm step, an up-front plain-language last-member refusal,
and post-save re-read. No new page, no new server endpoint, no new dependency, no concept
definition change, no change to any shipped add/create behavior.

## Consequences

- **Enables** the second editing slice: owner/TA tapestries now shrink as well as grow in place —
  same uuid/URL, one directory row, relay-native replacement, gone for every subsequent reader.
- **Remove-only is structural**, like add-only before it: connection editing, title/description
  edits, deletion, and non-owner editing get no head start from this code — deliberate.
- **The member↔import derivation now has two readers.** `useConceptOptions.toConcept` (write-side
  derivation, add/create) and Decision 2's matcher (read-side attribution, remove) must stay in
  step; both are anchored to the same `conceptGraphSlug` field and uuid shape, and the shared
  `authoredConceptMembers` helper pins the membership definition in one place.
- **The publish branch is now duplicated** in `AddConceptToTapestry.jsx` and
  `RemoveConceptFromTapestry.jsx` (Decision 4, deliberate). Rule of three: the next story that
  needs it extracts a shared helper and re-aims sentinel S3 in its own Test Design phase.
- **Documented residual (Decision 2-A):** an import that is unresolvable, unmatched by either
  derivation, and only later resolvable to contain the removed member's slug would re-materialize
  that member when it resolves. Requires the member's header and concept-graph both deleted plus
  a divergent concept-graph slug; accepted over blocking removals on any unresolvable import.
- **Concurrent edits** stay last-write-wins with whole-event granularity (unchanged from #5); the
  actor is a single owner and the base is what the page loaded.
- **Architecture invariants:** no write-time gating is added anywhere (the render gate is an
  affordance; the server 403 gate predates this story — publishing stays permissionless);
  nothing per-POV is precomputed; Neo4j is untouched (tapestry elements are relay events — the
  ~71 unread Neo4j rows stay explicitly out of scope per the book).
- **Firmware reinstall required?** **No** — no concept definitions change anywhere in this
  design; the republished tapestry is an *element*, not a definition.

## Implementation notes

No test files here — suites, fixtures, and runner registration are Phase 3 (Tester's lane).

- **EDIT `ui/src/pages/tapestries/tapestryDraft.mjs`** — add and export:
  - `authoredConceptMembers(event)` → `[{slug, uuid, name}]` of `39998:`-uuid nodes from the
    element's own parsed `json.graph.nodes`; `[]` on missing/unparseable json or missing/null
    graph (never throws — the page uses it for eligibility).
  - `buildRemoveConceptDraft({ event, memberUuid, resolvedImports = [], conceptOptions = [] })`
    per Decisions 1-A + 2-A + 3-A. Throws (messages shown verbatim in the UI): non-39999 / no
    `d` tag; unparseable or non-object `json`; absent/null `graph`; `graph.nodes` not an array;
    `graph.imports` present-but-not-array; `memberUuid` not an authored `39998:` member; last
    authored concept ("A tapestry keeps at least one concept — the last one can't be taken
    out."); removed slug shared by another `39998:` node. Tag copy preserves order; only the
    first `json` tag's value changes. `created_at = Math.max(Math.floor(Date.now()/1000),
    (event.created_at || 0) + 1)`. Returns `{ dTag, uuid: '39999:'+event.pubkey+':'+dTag,
    unsignedEvent, removed: { node, importUuids } }`. Helper `pubkeyOf`/`dTagOf` parse handles by
    first/second colon (same split rule as `parseUuid`, `useTapestryGraph.js:6–12` — d-tags may
    contain colons).
- **NEW `ui/src/pages/tapestries/RemoveConceptFromTapestry.jsx`** — props
  `{ event, imports, onRemoved }`; internals per Decision 5: `useConfig().taPubkey`,
  `useConceptOptions()`, `authoredConceptMembers(event)`; idle list of eligible members with a
  per-member "Take out…" control (count ≥ 2) or the single refusal sentence (count === 1); armed
  inline confirm naming the member with Take out / Cancel; confirm →
  `buildRemoveConceptDraft` → the Decision-4 signing branch (duplicated verbatim from
  `AddConceptToTapestry.jsx:64–82`: TA-author → `fetch('/api/strfry/publish', …signAs:
  'assistant'…)` with non-ok/`!data.success` → thrown error; else `getActiveSignerOrThrow(author)`
  → `window.nostr.signEvent({...draft.unsignedEvent, pubkey: author})` → `publishOrThrow`); busy
  guard; inline `err.message` on failure; on success call `onRemoved(removed.node)`. Reuse
  existing classes (`tapestry-concept-option`-family, `placeholder`, `error`) — no new CSS files.
- **EDIT `ui/src/pages/tapestries/TapestryDetail.jsx`** — rename `canAdd` → `canEdit` (same
  expression, lines 189–190; both affordances gate on it; S4's regexes are unaffected). In the
  sidebar Concepts section render, alongside the existing `<AddConceptToTapestry …/>`:
  `{canEdit && <RemoveConceptFromTapestry event={event} imports={imports} onRemoved={handleRemoved} />}`
  where `handleRemoved(node)` = `reload()` + reset `selected` to `{kind:'integration',
  key:'graph'}` iff `selected.kind === 'concept' && selected.slug === node.slug`. `imports` is
  already returned by `useTapestryGraph` — destructure it. **No change** to the degraded
  branches, the member-row markup, or the add affordance.
- **NO changes** to `useTapestryGraph.js`, `useConceptOptions.js`, `useCreateTapestry.js`,
  `AddConceptToTapestry.jsx`, `tapestryGraphModel.js`, `Index.jsx`, or any server file.
- **Reuse, no new deps:** `parseUuid` semantics, `publishOrThrow`, `getActiveSignerOrThrow`,
  `useConfig`, `useAuth` (already imported in `TapestryDetail`), existing CSS classes.

**Testability guidance for Phase 3 (Tester decides mechanics).** The binding CI gate is the
stack-free `node test/test.js` runner; `buildRemoveConceptDraft` and `authoredConceptMembers` are
dynamic-importable like the existing builders. High-value fixtures: a `b0b48b00`-shaped event
(bare-hex d-tag, slug-valued `name` tag, the live four members **including the `dog` divergence**
— node uuid `…:b08502ed-…` with import `…:dog-concept-graph`) asserting same-d-tag/coordinate,
byte-identical non-json tags, removed node + its import gone, remaining nodes/imports
order-preserved; attribution via each matcher alone ((a) resolved-import containment with
options empty; (b) options with resolution empty; (c) neither); the shared-import keep-guard;
unattributable-import pass-through; last-member and shared-slug refusals; ghost-member refusal;
`created_at` strictly greater on same-second input; regression — `buildTapestryDraft` and
`buildAddConceptDraft` unchanged. Source assertions: `TapestryDetail.jsx` renders
`RemoveConceptFromTapestry` gated on the owner-strict expression; the component contains both
publish paths (mirror of S3), the confirm step, and the refusal sentence; mocked-Playwright flows
for both signing branches, decline-leaves-unchanged, and the not-offered cases mirror
`tapestry-create.spec.js` / the #5 spec.

## Out of scope

- Adding a concept (#5, shipped — zero lines of its path change); authoring/altering/removing
  integrations between members (`relationships`/`relationshipTypes` pass through verbatim);
  any behavior for removing a concept that participates in authored connections — none exists on
  any reachable relay (census in Context); when connections exist that is successor work.
- Emptying or deleting a tapestry (the last-member refusal is the boundary's floor); tapestries
  with no member concepts at all (degraded — nothing to take out; first-add stays #5's path).
- Removing "ghost" members that appear only via imports (refused with a clear message; no live
  instance) — an import-editing successor if it ever occurs.
- Editing tapestries authored by anyone else, including whose key could republish them; editing
  by non-owner users; any change to #3's `hasAdminAccess` create gate or epic-wide gate
  harmonization (unchanged from ADR 0005).
- Batch-removal in one save (repeat the flow; one member per confirm); undo / restore / history
  surfaces (replacement history exists on the relay; no affordance here).
- Extracting the shared publish helper and re-aiming sentinel S3 (rule-of-three follow-up,
  Consequences); external co-publish for TA-signed tapestries (unchanged from ADR 0003/0005).
- POV/WoT filtering of the directory or affordances; the ~71 unread Neo4j tapestry rows; any
  Neo4j write-back (the graph is not in the tapestry read path).
- Concurrent-edit merge semantics beyond last-write-wins.
