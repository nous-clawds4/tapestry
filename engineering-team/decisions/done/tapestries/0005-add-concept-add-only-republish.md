# ADR 0005: Add a concept to a Tapestry — add-only append transform, same-coordinate republish

**Status:** Proposed
**Date:** 2026-07-28
**Story:** `engineering-team/stories/tapestries/5-add-a-concept-to-a-tapestry.md`
**Relationship to prior ADRs:** Extends the epic; contradicts nothing. ADRs `done/tapestries/0001`
(§Out of scope: "Creating/editing tapestries"), `done/tapestries/0002` (§Out of scope: "Editing
tapestries"; §Consequences: "Establishes the graph-embedding convention that the future
Create/Edit-Tapestry [uses]"), and `tapestries/0003` (§Out of scope: "Editing / deleting a
tapestry") each explicitly deferred this work. This ADR delivers the add-only slice inside the
conventions those ADRs established — nothing is superseded.

## Context

Story `tapestries` #5, under the operational Direction book
`engineering-team/audits/add-a-concept-to-a-tapestry/book.md`. The approved acceptance criteria,
quoted:

- **Offered only where editing is possible.** "Given the owner viewing the Exploration page
  (`/tapestry/tapestries/<uuid>`) of a tapestry whose author is the owner's own pubkey or the
  instance's assistant (TA) pubkey, then an add-a-concept affordance is present on that existing
  page (no new page). Given a tapestry authored by any other pubkey, or a viewer who is not the
  owner, then no add affordance is offered."
- **Only non-members are addable.** "They can find and choose from the concepts that exist on this
  instance, and a concept that is already a member of this tapestry cannot be added (it is
  excluded or not selectable, and no save can produce a duplicate member)."
- **Save = adding only, published as tapestries already are.** "The tapestry is republished under
  its existing author key via the publish paths #3 established (owner-key tapestry → signed in
  the browser by the owner; assistant tapestry → signed as the assistant), with no new server
  endpoint; and the result keeps the tapestry's identity and everything else intact: same
  uuid/URL, no duplicate entry in the Tapestries directory, all prior member concepts still
  present, prior integrations shown unchanged, title and description unchanged — the only
  difference is the new member. Given the publish fails, the owner sees a clear error and the
  tapestry's membership is unchanged."
- **Visible to me.** "The Tapestry view the owner is looking at shows the added concept among the
  member concepts."
- **Visible to anyone else afterwards.** "Any other session (including one that is not signed in)
  opens the same tapestry … afterwards, then the added concept appears among its member concepts."

**Hard boundary (owner's words):** adding only; no new page; no new server endpoint; publish the
way tapestries are already published; affordance only on tapestries authored under the owner's key
or the instance TA, and only offered to the owner.

**Concept-graph orientation** (three-call pattern, local stack up, port 7778):

- `39998:<TA>:tapestry` — "A graph of concept graphs that validates against normalization rules."
  A tapestry *instance* is a kind-39999 addressable element z-tagged to this handle; the directory
  reads by that z-tag. **This story republishes such an element with one more member. No concept
  definition changes** — the `tapestry` concept-header, its schema, and every other firmware
  definition are untouched.
- Per added member: `39998:<TA>:<slug>` (the concept header, becomes a graph node) and
  `39999:<TA>:<cg-slug>-concept-graph` (the import the Exploration page resolves at read time) —
  the exact member shape ADR `tapestries/0003` Decision 2-A publishes at create time.

**Verified facts (this session, against the live local stack and HEAD `db7c5a7a`, 0 behind
`origin/staging`):**

- **Relay-native replacement.** Kind 39999 is in NIP-01's addressable range: same kind + same
  author pubkey + same d-tag → the newer event replaces the older in strfry. Corroborated by the
  book's cited work record (`worked-find-out-whether-saving-a-tapestry-again-actually-updates-it-cc07369c`):
  tapestries are read back *from the relay* by exact coordinate (`useTapestryGraph.js:19–24`
  `readByUuid`; `Index.jsx:55–58` `#z` scan); Neo4j is not in the read path; **there is no reindex
  step**. Editing a tapestry *is* republishing it at the same coordinate.
- **The one live tapestry breaks every "rebuild it" assumption.** The local relay holds exactly
  one tapestry element (author = TA): d-tag **`b0b48b00`** — a bare random hex, *not* the
  `tapestry-<slugified-title>-<suffix>` shape `buildTapestryDraft` derives; its `name` tag is the
  *slug* (`tapestry-for-farm-animals`), not the title (`Tapestry for Farm Animals`); and its
  `json` tag has **no `graph` block at all** (it renders as the Exploration page's `degraded`
  branch). Any design that reconstructs identity or tags from content mis-handles this real event
  (details under Option 1-B).
- **Publish paths (reused, not rebuilt).** `POST /api/strfry/publish` (`src/api/strfry/commands/publishEvent.js`):
  `signAs:'assistant'` re-signs `{kind,created_at,tags,content}` with the TA key, gated
  `isOwner(req) || req.localTrusted` (403 otherwise) and waits for `strfry import` before
  responding; `signAs:'client'` publishes an already-NIP-07-signed event, permissionless.
  Client side: `publishOrThrow(signed)` (`ui/src/utils/publishProfileTag.js:24`) = local +
  external co-publish, throwing only when *both* fail; `getActiveSignerOrThrow(expected)`
  (`ui/src/utils/signerGuard.js:55`) refuses signer/session drift. `useCreateTapestry.js:86–114`
  is the exact create-time composition of these.
- **Owner gate idiom on #3's surfaces.** `hasAdminAccess(user)` (`ui/src/utils/auth.js:6`,
  classification `owner`/`admin`) gates the directory's create button (`Index.jsx:42,94`) and the
  `/new` form (`NewTapestry.jsx:17,47`) — shipped behavior per ADR 0003 Decision 4. This story's
  gate is decided separately in Decision 3 (the frame's acting user is the owner, strictly).
- **Picker.** `useCreateTapestry.js` loads options via `queryRelay({kinds:[39998], authors:[taPubkey]})`
  and `toConcept()` (lines 20–47) → `{handle, shortSlug, conceptGraphSlug, descriptiveSlug, name,
  searchText}`; `NewTapestry.jsx:37–44,141–169` implements the typeahead over `searchText`.
- **Read model.** `useTapestryGraph(uuid)` parses the uuid (`parseUuid` → `{kind, pubkey, dTag}`,
  so **the author key is already in hand on the detail page**), fetches the element, resolves
  imports, composes via `composeGraph` (dedup by node `slug`, `tapestryGraphModel.js:56–68`). It
  currently **discards the raw event** and exposes no refetch.
- **TA pubkey is per-deployment** (CLAUDE.md): every author comparison and handle composition
  below uses `useConfig().taPubkey` client-side; the tapestry's author comes from the event/uuid
  itself. No literals anywhere in this design.

**Constraints:** JS-without-build (no new lint/build tooling), no new dependencies, and the
template's rule that test-file changes are Phase 3's lane (none are specified here).

## Options considered

### Decision 1 — How the replacement event is built

#### Option 1-A (chosen) — a new pure append transform: copy everything, append one member

Add `buildAddConceptDraft({ event, member, taPubkey })` to
`ui/src/pages/tapestries/tapestryDraft.mjs` (pure, React-free, same testability contract as
`buildTapestryDraft`). It takes the tapestry event *as read from the relay* and produces the
replacement unsigned event by **verbatim copy + one append**:

- Copy `kind` (assert 39999), `content`, and **every tag unchanged and in order** — `d`, `name`,
  `z`, unknown tags — except the `json` tag, whose parsed value is re-serialized with exactly two
  additions: `graph.nodes += {slug: member.descriptiveSlug, uuid: member.handle, name: member.name}`
  and `graph.imports += {slug: 'concept-graph-for-'+cg, uuid: '39999:'+taPubkey+':'+cg+'-concept-graph'}`
  (cg = `member.conceptGraphSlug || member.shortSlug`) — the identical member shape create uses
  (ADR 0003 Decision 2-A), skipping the import append if an import with that uuid already exists.
  The `tapestry` block and any unrecognized json keys pass through untouched.
- **Missing graph block → create the envelope** `{graphType:'tapestry', nodes:[…], relationshipTypes:[],
  relationships:[], imports:[…]}` on first add (nothing is removed or altered — this is the minimal
  container for a member, and without it the instance's only live tapestry, `b0b48b00`, could never
  be grown). A `json` tag absent entirely is treated as `{}` and gains the graph envelope.
  (Reading confirmed at the Architecture gate: the envelope on first add is inside "adding only.")
- **Refuse what can't be preserved:** throw if the `json` tag exists but doesn't parse, or if
  `graph` exists but `graph.nodes` isn't an array — an add-only guarantee can't be given over a
  structure the transform doesn't understand.
- **Refuse duplicates:** throw if any existing node has `uuid === member.handle` (already a
  member) or `slug === member.descriptiveSlug` with a different uuid (would silently merge at
  compose time, `composeGraph` dedups by slug).
- `created_at = Math.max(now, event.created_at + 1)` — strictly newer, so replacement can never
  tie (NIP-01 resolves equal timestamps by id, which could keep the *old* event on a same-second
  create-then-add).
- Returns `{ dTag, uuid: '39999:'+event.pubkey+':'+dTag, unsignedEvent }` (no `pubkey` on the
  unsigned event; the signing branch attaches it).

Pros: **add-only by construction** — identity (`d`), `name`, `z`, title/description, authored
integrations, unknown fields all survive verbatim, so "everything else unchanged" is a structural
property, not a hoped-for outcome; same d-tag verbatim → guaranteed same coordinate → relay-native
replacement, for *any* d-tag shape; handles the real `b0b48b00` event correctly; pure and
unit-testable stack-free. Cons: a second builder in `tapestryDraft.mjs` (~40 lines) whose member
shape must stay in step with `buildTapestryDraft`'s (they share the member object, which contains
the drift).

#### Option 1-B (rejected) — rebuild via `buildTapestryDraft` with the existing d-tag suffix

The goal-prompt's sketch: parse title/description/members out of the existing event and re-run
`buildTapestryDraft(...)` passing the existing `dTagSuffix` instead of a fresh one. Rejected on
four concrete mismatches, each verified against real data:

1. **It cannot hit the coordinate.** `buildTapestryDraft` unconditionally derives
   `dTag = 'tapestry-' + slugifyTitle(title) + '-' + dTagSuffix` (`tapestryDraft.mjs:42`). The live
   tapestry's d-tag is `b0b48b00` with title "Tapestry for Farm Animals" — **no suffix exists**
   that makes the derivation produce `b0b48b00`. The republish would land on a *new* coordinate:
   a second directory row and a still-unchanged original — failing "same uuid/URL, no duplicate
   entry" outright. (Patching the builder with a d-tag override converges on Option 1-A while
   keeping the remaining three defects.)
2. **It rewrites the `name` tag.** The builder sets `['name', cleanTitle]`; the live event's
   `name` tag is the slug. An edit beyond adding.
3. **It drops authored integrations.** The builder hardcodes `relationshipTypes: [],
   relationships: []` — correct for create (members-only v1), destructive for edit the moment a
   tapestry carries integrations (ADR 0003's named fast-follow, or hand-authored events). The AC
   requires "prior integrations shown unchanged."
4. **It re-derives imports from today's concept headers**, so a header whose `oSlugs` changed
   since the tapestry was created would have its *existing* import silently rewritten — again an
   edit beyond adding.

Pros: zero new model code. Cons: as above — the story's ceiling is add-only, and this option can
silently edit (or duplicate) as a side effect of rebuilding.

#### Option 1-C (rejected without much contest) — server-side edit endpoint

A `POST /api/tapestries/:uuid/members` that loads, mutates, signs, publishes. Violates the
boundary verbatim ("no new server endpoint") and would put owner-key signing server-side where it
can't be. Named only for completeness.

### Decision 2 — Where "current membership" is judged from

**Option 2-A (chosen) — the authored graph block of the event being edited.** Members = nodes with
`uuid` starting `39998:` in the *element's own* `json.graph.nodes` (what `useTapestryGraph` already
exposes as `rawGraph`). The picker excludes those uuids; the transform independently throws on
them (defense in depth, unit-testable without a DOM). Pros: it is literally the structure being
edited — exclusion and append can't disagree; defined even when import resolution fails or the
graph is being created on first add. Cons: none material.

**Option 2-B (rejected) — the composed graph.** `composed.nodes` filtered to `conceptHeader`.
Rejected: composition mixes in nodes contributed by *resolved imports* (best-effort, network-
dependent — `useTapestryGraph.js:63–69` skips failures silently), so membership would fluctuate
with resolution success; and it's undefined on the degraded tapestry that most needs the feature.

### Decision 3 — Affordance gating and the signing branch

**Chosen — strict owner gate (Director ruling at the Architecture gate, 2026-07-28):** render the
affordance iff `user?.classification === 'owner' && (author === taPubkey || author === user?.pubkey)`,
where `author = parseUuid(uuid).pubkey` (data already on the page) and `taPubkey =
useConfig().taPubkey` (runtime-resolved, never a literal). The acting user is the **owner,
strictly**: the story's AC-1 says "a viewer who is not the owner, then no add affordance is
offered," its Out of scope names "editing by non-owner users," and the goal's prompt says "let the
owner add a concept" — an `admin` who is not the owner gets no affordance. Any other author, or
any non-owner viewer → the affordance simply doesn't render; there is nothing to disable or
explain. The signing branch is then **data, not a decision** (the goal-prompt's "one branch"):
`author === taPubkey` → `POST /api/strfry/publish {event, signAs:'assistant'}` (server 403-gates
non-owners — the same second line of defense create has); else `author === user.pubkey` →
`getActiveSignerOrThrow(author)` → `window.nostr.signEvent({...unsignedEvent, pubkey: author})` →
`publishOrThrow(signed)`. Both are verbatim the #3 publish paths — "publishing the way Tapestries
are already published."

*Named alternative — `hasAdminAccess(user)` (owner or admin), rejected.* It is #3's shipped
curator gate (`Index.jsx:42`, `NewTapestry.jsx:17`), and reusing it would keep "who curates?"
answering identically across the epic's affordances. Rejected because it admits `admin`
classifications, exceeding the frame's acting user — the frame wins over idiom consistency. The
cost is recorded honestly: **an admin who is not the owner can create a tapestry (#3, shipped)
but cannot add to one (this story)**. Story #3's gate is left untouched — harmonizing "who
curates" epic-wide would change shipped behavior outside this story's frame and is
separately-goaled work if the owner ever wants it (see Consequences). Note the own-key path
self-limits regardless of gate choice — it only renders when the *session* pubkey equals the
author, and `getActiveSignerOrThrow` pins the extension to it.

### Decision 4 — UI composition and how "visible to me" is satisfied

**Chosen:**

- **Extract the picker loader** into a new `useConceptOptions()` hook (move `toConcept` + the
  kind-39998 scan effect out of `useCreateTapestry.js` verbatim; `useCreateTapestry` consumes it,
  no behavior change to create). The add flow needs the same options + `searchText` typeahead
  data; a second copy would drift.
- **A new `AddConceptToTapestry` component** (`ui/src/pages/tapestries/AddConceptToTapestry.jsx`)
  rendered inside `TapestryDetail`'s existing sidebar "Concepts" section — the affordance lives on
  the existing Exploration page, no new page and no new route. It owns the typeahead (same
  pattern as `NewTapestry.jsx:141–169`), excludes current members (Decision 2), and on selection
  performs the save (one concept per save, matching the story; repeat to add more), with an inline
  error on failure and a busy state while publishing.
- **Post-save visibility by re-read, not optimism:** extend `useTapestryGraph` to also return the
  raw `event` (the transform's input — it already fetched it and throws it away) and a `reload()`
  function (a bumped counter in the effect deps). On successful publish the page calls `reload()`,
  re-reading the same coordinate from strfry, so the member list the owner sees *is* the published
  truth — the same read any other session performs (which is what makes "visible to anyone else
  afterwards" the same mechanism, not a second code path). The publish endpoint completes
  `strfry import` before responding, so the re-read races nothing.
- **Degraded handling:** `TapestryDetail`'s `degraded` early-return branch also renders the
  affordance when the graph block is *absent* (`rawGraph === null`) and the gate passes — first
  add creates the envelope (Decision 1-A) and un-degrades the tapestry. A *malformed* graph
  (`degraded` with `rawGraph !== null`) gets no affordance: the transform would refuse anyway.

*Named alternative — optimistic local update.* Append the node to client state and skip the
re-read. Rejected: the ACs are about what the relay now holds; optimistic state can show a member
whose publish was refused, tied, or replaced — exactly the class of bug the evidence goal existed
to rule out. The re-read is one cheap request against a local relay.

*Second alternative — reuse `useCreateTapestry` wholesale in the detail page.* Rejected: it drags
`create()` and its create-shaped signature into a page that must never create; the extraction is
smaller than the excuse not to do it.

## Decision

We chose **1-A + 2-A + 3 + 4**: a pure append transform (`buildAddConceptDraft`) that copies the
existing event verbatim and appends exactly one member node + import at the same coordinate;
membership judged from the authored graph block; the affordance gated **strictly to the owner**
(`user?.classification === 'owner'` and author ∈ {taPubkey, user.pubkey}) with the signing branch
decided by the author pubkey through the unchanged #3 publish paths; delivered as a sidebar
component on the existing Exploration page with post-save re-read. No new page, no new server
endpoint, no new dependency, no concept definition change.

## Consequences

- **Enables** the first editing slice of the epic: any owner/TA tapestry grows in place — same
  uuid/URL, one directory row, relay-native replacement, visible to every subsequent reader
  (local strfry serves both the directory and the detail read for all sessions).
- **Add-only is structural**, so future "remove" / "edit integrations" stories get no head start
  from this code — deliberate; those are separately-goaled work.
- **Observation — the epic now has two curator gates.** #3's create surfaces admit
  owner-or-admin (`hasAdminAccess`, shipped); this affordance admits the owner only (Director
  ruling honoring the frame). An admin who is not the owner can create a tapestry but cannot add
  to one. This ADR changes nothing about #3; harmonizing "who curates" epic-wide is
  separately-goaled work if the owner ever wants it.
- **Constrains:** the member object (`{handle, shortSlug, conceptGraphSlug, descriptiveSlug,
  name}`) is now shared by create and add; a change to it touches both builders. Two-tab
  concurrent edits are last-write-wins with whole-event granularity (the second save republishes
  its own loaded base) — accepted; the actor is a single owner, and the base is whatever the
  page loaded, which is what the owner is looking at.
- **Debt / follow-ups:** external co-publish for TA-signed tapestries remains out (unchanged
  from ADR 0003 — add inherits create's reach); the `name`-tag slug/title divergence on legacy
  events passes through unchanged (normalizing it would be an edit beyond adding); the ~71 unread
  Neo4j tapestry rows stay untouched per the book.
- **Firmware reinstall required?** **No** — no concept definitions change anywhere in this
  design; the republished tapestry is an *element*, not a definition.

## Implementation notes

No test files here — suites, mocks, and runner registration are Phase 3 (Tester's lane).

- **EDIT `ui/src/pages/tapestries/tapestryDraft.mjs`** — add and export
  `buildAddConceptDraft({ event, member, taPubkey })` per Decision 1-A. Throws (with messages the
  UI can show verbatim): event not kind 39999 / no `d` tag; unparseable existing `json` tag;
  `graph` present but `graph.nodes` not an array; `member.handle` already a member; slug
  collision; missing `taPubkey` or member fields. Tag copy preserves order; replaces the first
  `json` tag's value (appends one if none existed). `created_at = Math.max(Math.floor(Date.now()/1000),
  (event.created_at || 0) + 1)`. Returns `{ dTag, uuid, unsignedEvent }` with
  `uuid = '39999:' + event.pubkey + ':' + dTag`.
- **NEW `ui/src/pages/tapestries/useConceptOptions.js`** — `toConcept()` and the
  `queryRelay({kinds:[39998], authors:[taPubkey]})` load effect moved verbatim from
  `useCreateTapestry.js`; returns `{ concepts, conceptsLoading, conceptsError }`.
- **EDIT `ui/src/pages/tapestries/useCreateTapestry.js`** — consume `useConceptOptions()`;
  `create()` unchanged.
- **NEW `ui/src/pages/tapestries/AddConceptToTapestry.jsx`** — props `{ event, onAdded }`.
  Internally: `useConfig().taPubkey`, `useAuth()`, `useConceptOptions()`; current member uuids +
  slugs derived from `event`'s parsed json (Decision 2-A); typeahead over `searchText` excluding
  members; on pick → `buildAddConceptDraft` → the Decision-3 signing branch → on success
  `onAdded()` and clear; on throw show `err.message` inline, membership untouched (nothing was
  accepted by the relay). Busy-guard against double-submit (mirror `NewTapestry.jsx:68`).
- **EDIT `ui/src/pages/tapestries/useTapestryGraph.js`** — add `event` (the raw fetched event) to
  the returned state; add `reload()` (state counter included in the effect's dependency array).
  No change to parsing, import resolution, or `composeGraph`.
- **EDIT `ui/src/pages/tapestries/TapestryDetail.jsx`** — compute
  `canAdd = user?.classification === 'owner' && event && (event.pubkey === taPubkey || event.pubkey === user?.pubkey)`
  (imports: `useAuth`, `useConfig` — **not** `hasAdminAccess`; the gate is owner-strict per
  Decision 3); render `<AddConceptToTapestry event={event} onAdded={reload} />` in the sidebar
  "Concepts" section when `canAdd`; also render it in the `degraded` branch when
  `rawGraph === null && canAdd` (first-add path for `b0b48b00`-shaped tapestries). No affordance
  in `notFound`, error, or malformed-graph states.
- **Reuse, no new deps:** `parseUuid`, `queryRelay`, `publishOrThrow`, `getActiveSignerOrThrow`,
  `useAuth`, `useConfig`, existing typeahead CSS classes
  (`tapestry-concept-filter` / `tapestry-concept-picker` / `tapestry-concept-option`).

**Testability guidance for Phase 3 (Tester decides mechanics).** The binding CI gate is the
stack-free `node test/test.js` runner. `buildAddConceptDraft` is dynamic-importable exactly like
`buildTapestryDraft` (ADR 0003's pattern): assert same-d-tag/coordinate on a `b0b48b00`-shaped
fixture (bare-hex d-tag, slug-valued `name` tag, no graph block → envelope created, all other
tags byte-identical); verbatim pass-through of authored relationships and unknown json keys;
duplicate-member and malformed-graph throws; `created_at` strictly greater on same-second input.
Source-assertions on `TapestryDetail.jsx` (gate expression — owner-strict: an `admin`
classification gets no affordance — and the degraded-branch condition) and mocked-Playwright
coverage of both signing branches mirror `tapestry-create.spec.js`.

## Out of scope

- Removing a member; authoring/altering integrations between members (`relationships` stay
  whatever they were); any edit to title, description, `name` tag, or any non-membership field.
- Editing tapestries authored by anyone else — including *which key* could republish them
  (unsettled, separately goaled; the affordance simply never renders for them).
- Batch-adding in one save (repeat the flow instead); non-owner editing of their own tapestries.
- Any change to story #3's shipped `hasAdminAccess` create gate; epic-wide "who curates"
  harmonization (separately-goaled if ever wanted — see Consequences).
- External co-publish for TA-signed tapestries; POV/WoT filtering of directory or affordance.
- The ~71 unread Neo4j tapestry rows (recorded on the evidence goal; explicitly not this story's
  problem) and any Neo4j write-back — the graph is not in the tapestry read path.
- Concurrent-edit merge semantics beyond last-write-wins.
