# ADR 0001: Event-less `add-subset` — a strfry-free node primitive that writes an event-shaped Set node with no event behind it

**Status:** Accepted
**Date:** 2026-09-12
**Story:** `engineering-team/stories/node-primitives/1-event-less-create-set.md`

## Context

The operator wants sets that live only in Neo4j — BIBLE §30: "a Neo4j write that is never published is a
private thought." The story's criteria, restated:

1. **Create** — under an existing Superset or Set, given a non-empty name (description optional): a new set
   exists under that parent, it is an element of the `set` concept, the answer names it, and no nostr event
   is signed or stored (local strfry's event count unchanged).
2. **No duplicates** — the same name under the same parent, whether the existing set is event-less or
   lettered, reports the existing set; no second set appears.
3. **Guards** — missing parent, blank name, authenticated non-owner, unauthenticated remote caller: nothing
   is created, and the answer says what was wrong the way the sibling relationship primitives do.
4. **Behaves like any set, stays private** — with members wired by `add-relationship`, the Organization
   (Sets) view lists it with direct and total counts, the concept's element count includes the members,
   and publishing the concept to the community sends nothing for the set.
5. **Survives reinstall** — after a firmware reinstall, the set, its parent link, its membership in `set`,
   and its member links are all still there.

**Concept Graph orientation** was performed first, per AGENTS.md §1–§3, against the local stack (port 7778;
TA pubkey resolved at runtime via `/api/assistant/pubkey`): `/api/concept-graph/summaries`, `/neighbors` for
`39998:<TA>:firmware-concept` and its superset, plus read-only Cypher over `POST /api/neo4j/query`. The
concepts involved: `39998:<TA>:set` (superset `39999:<TA>:set-superset`; all 23 existing Set nodes are its
elements), `39998:<TA>:superset`, and `39998:<TA>:class-thread`. **No concept definition changes.**

**Verified facts** (this checkout, 0 behind `origin/staging`):

- **No event-less node exists.** `MATCH (n:NostrEvent) WHERE n.id IS NULL` returns nothing. Every
  node-creating route signs: `handleCreateSet` (`src/api/normalize/index.js:4252`) signs a Set event plus an
  `IS_A_SUPERSET_OF` descriptor event, then imports through `importEventDirect` (`:135`).
- **What a lettered set leaves in Neo4j.** `importEventDirect` MERGEs `(e:NostrEvent {uuid})` and sets `id,
  kind, pubkey, name, created_at`, adding `:ListItem` for kind 39999; `handleCreateSet` then adds `:Set`
  (`:4320`). Tag nodes are `(:NostrEventTag {uuid, type, value[, value1, value2]})` via `HAS_TAG`, with
  `uuid = sha256("<node uuid>:<tag.join(',')>:<index>")` (`:165`) — derived from the node's *address*, not
  the event id — and old tags are deleted before re-creation (`:157-160`), so a re-import replaces tags in
  place. `kind`/`created_at` are passed as JS numbers and land as floats (a lettered set reads
  `kind "39999.0"`).
- **A lettered set's address and tags.** `39999:<TA>:<dtag.childDTag(name, parentUuid)>` =
  `slug(name)-hash8(parentUuid)` (`index.js:4287`, `src/lib/dtag.js:51`); tags `d`, `name`, `z` → the `set`
  concept, `s` → the parent, then `description` when given (`:4304-4315`). The `s` tag is ADR
  `community-reference/0011`'s child-claims-parent encoding.
- **Read paths.** Organization (Sets) (`ui/src/pages/concepts/ConceptDag.jsx:28-35`) walks
  `IS_A_SUPERSET_OF*0..10` label-free and reads `s.name`. The canonical count
  (`ui/src/utils/conceptCounts.js:46-55`) walks sets transitively. Set Detail
  (`ui/src/pages/concepts/SetDetail.jsx:33`) needs `(:NostrEvent {uuid})` and reads `name`, `pubkey`, labels.
  The Concept Graph API (`src/api/concept-graph/index.js:47,88`) reads Neo4j tag nodes, never strfry.
  Publish concept to community (`src/api/concept/exportSet.js:62`) keeps only
  `n.pubkey = <TA> AND n.id IS NOT NULL`; its route is `requireOwner`-gated (`src/api/index.js:598`), which
  does not honor `req.localTrusted`.
- **Durability.** The only node-deleting Cypher in `src/` is the tag replacement at
  `src/api/neo4j/eventSync.js:339`. Firmware install deletes edges only: pass 1e prunes redundant edges from
  the Supersets of `manifest.concepts` alone (`src/firmware/install.js:745` onward), and pass 1d MERGEs
  `HAS_ELEMENT` from each concept's superset to every node z-tagged to it (`:585-637`).
- **The surface.** The strfry-free family is `src/api/normalize/relationships.js` (ADR
  `relationship-primitives/0001`): a dedicated module whose import boundary is under S-class test, an
  in-handler `isOwner(req) || req.localTrusted` gate, idempotent HTTP 200 answers with a `result`
  discriminator. A host-side POST to :7778 is remote by design and default-denied (401) before any handler;
  the operator path is container loopback. An owner-gated route needs a credential-free probe for deployment
  evidence (ADR `relationship-primitives/0002`, `src/api/normalize/probe.js`).
- **Testing.** The local stack is shared with another active session and is not bind-mounted. The sibling
  suite already targets `TAPESTRY_CONTAINER` (`test/relationship-primitives.test.js:65`).
  `scripts/brain-drill.sh` holds a proven recipe for an ephemeral scratch instance (own network and redis,
  fresh volumes, firmware install, strfry-router stopped). "Writes nothing to strfry" brackets must be
  author-scoped (ADR `test-suite-hermeticity/0001`).

**ADR conflict check.** Consistent with `relationship-primitives/0001` — same module pattern, gate, and
response conventions — with one deliberate difference: its decision 4 was "any node pair, no label policy";
a *node-creating* primitive checks its parent's label (Decision §4). Consistent with
`relationship-primitives/0002` (a sibling probe under the same contract), `community-reference/0011` (the
would-be `s` tag is its encoding; no letter is emitted, so there is no emission site and no descriptor
event), `security-auth-exposure/0001`/`0002`, `test-suite-hermeticity/0001`, `graph-curation-ui/0003` (the
canonical count is untouched), and `self-ontology/0001` (§30; see Consequences on provenance). BIBLE §6's
`NostrEvent` row is amended — a BIBLE edit, not an ADR. Nothing is superseded.

## Options considered

### Option A — An event-shaped node minus the event, in a dedicated strfry-free module *(chosen)*

A new module `src/api/normalize/nodes.js` serving `POST /api/normalize/add-subset`. It writes exactly what
`handleCreateSet` + `importEventDirect` would leave in Neo4j for the same name and parent — same address,
labels, properties, tag nodes, and parent edge — except the event: no `id` property, nothing in strfry, no
descriptor event. It also registers the set as an element of `set`.

**Pros:** every read path works unchanged (Set Detail's `:NostrEvent` match, name reads, both counts, the
tag-based API), and `exportSet`'s existing `id IS NOT NULL` filter already keeps the set private; a letter
minted later for the same address lands on the same node and replaces the would-be tags with identical ones;
duplicate detection spans default lettered sets for free, because the address rule is the same; the
strfry-free guarantee is an import-boundary fact.
**Cons:** the `NostrEvent` label no longer means "an imported event" (§6 amended); "no `id`" becomes the
working marker of an event-less node until §30's provenance design lands; the node carries tag nodes of an
event that doesn't exist yet.

### Option B — A distinct label for event-less nodes, without `NostrEvent`

For example `(:LocalNode:Set)`.

**Pros:** §6 stays literally true; event-less nodes are unmistakable.
**Cons:** Set Detail (`:NostrEvent {uuid}`), `handleCreateSet`'s parent lookup (`index.js:4264`), and every
label-anchored uuid lookup (the uuid indexes are `NostrEvent`-scoped) would miss the node, so criterion 4
fails without UI changes the story rules out. It would also pick §30's provenance representation — a label —
by the back door. **Rejected.**

### Option C — An `eventless` flag on the existing `create-set`

**Pros:** one route; reuses its lookups.
**Cons:** puts the event-less path inside the module that imports `child_process`, `nostr-tools`, and the TA
signing keys, so "writes nothing to strfry" becomes a control-flow claim instead of an import-boundary fact —
the reason ADR `relationship-primitives/0001` rejected extending `index.js` (its Option B). `create-set`'s
by-name `parent` fallback and its silent `alreadyExisted` answer would also leak into the new contract.
**Rejected.**

*Considered within Option A and rejected: a node with no tag nodes.* It is lighter, but the Concept Graph
API's node view, name-based lookups, and install pass 1d's z-registration all read tag nodes, and a later
letter would have to reconstruct them.

## Decision

We chose **Option A**.

1. **Route, module, probe.** `POST /api/normalize/add-subset`, in a new `src/api/normalize/nodes.js`,
   registered inline in `registerNormalizeRoutes` beside the relationship primitives. "add-" is the
   strfry-free family's verb (the `create-*` routes all sign); "subset" says what it makes and avoids a
   near-collision with `add-to-set`. A sibling zero-require probe, `GET /api/normalize/node-primitives` →
   `{ success: true, surface: 'node-primitives', operations: ['add-subset'] }`, gives staging and production
   credential-free deployment evidence under ADR `relationship-primitives/0002`'s contract.
2. **Body:** `{ parentUuid, name, description? }`. `name` is trimmed and must be non-empty; `description`,
   when present, must be a string.
3. **Order** (mirrors `relationships.js` `gateAndValidate`): (1) `isOwner(req) || req.localTrusted`, else
   **403** — before any Cypher runs; (2) body fields, else **400** naming the field; (3) the TA pubkey and the
   `set` concept's superset resolve, else **500** naming the missing piece ("run firmware install").
4. **Parent.** `MATCH (p:NostrEvent {uuid: $parentUuid})`. Absent → **404**
   `{ error: 'Node not found: <uuid>', missing: [<uuid>] }`. Present but carrying neither `Superset` nor `Set`
   → **400** naming its labels. Unlike the edge primitives, this one is not label-policy-free: it creates a
   node, and a Set placed under a header or an element would corrupt a class thread with no later guard.
5. **Address:** `39999:<TA>:<dtag.childDTag(name, parentUuid)>` — the same address `handleCreateSet` gives the
   same name and parent by default.
6. **Duplicates** (a read before the write):
   - (a) a `Set` already under this parent whose `toLower(trim(name))` equals the request's → **200**
     `result: 'already-existed'`, naming that set and whether it has an event (`hasEvent`); nothing written.
   - (b) otherwise, any node already at the computed address → **409** naming it. Two names can share a
     slug; the collision is loud and never silently re-linked.
7. **The write** — one `writeCypher` statement, idempotent by construction: MERGE the node by `uuid` (on
   create: labels `:ListItem:Set`; `name`, `kind` 39999, `pubkey` = TA, `created_at` = now — passed as JS
   numbers as `importEventDirect` does, so the node matches a lettered set property-for-property except
   `id`); MERGE the would-be tag nodes by their deterministic uuids; MERGE
   `(parent)-[:IS_A_SUPERSET_OF]->(set)` and `(setSuperset)-[:HAS_ELEMENT]->(set)`. No `id` property, no
   strfry, no signing, no descriptor event.
8. **Would-be tags,** in `handleCreateSet`'s order: `d`, `name`, `z` (the `set` concept handle), `s` (the
   parent — ADR 0011's claim), then `description` when given. Tag uuids use `importEventDirect`'s formula
   (`index.js:165`). The `z` tag also lets install pass 1d re-derive the `set` registration.
9. **Answers.** `created` →
   `{ success: true, operation: 'add', result: 'created', set: { uuid, name, description?, labels }, parent: { uuid, labels }, registeredUnder: <set superset uuid>, note }`,
   where `note` states the durability fact: *"Event-less set: it exists only in Neo4j — no event backs it,
   so only a Neo4j backup preserves it (BIBLE §30)."* `already-existed` → the same shape with `hasEvent` and
   no `note`. 409 / 404 / 400 / 403 as above; 401 from the default-deny middleware; 500 on driver failure.

## Consequences

- **Enables:** private sets (criteria 1–5), and a node-level strfry-free pattern for the epic's later
  members — delete or rename, and a step that mints a letter for an event-less node.
- **"No `id`" becomes the working marker of an event-less node.** It is a fact about the node, not §30's
  provenance representation, which stays the `self-ontology` epic's open decision; a future representation
  can find these nodes by `id IS NULL` and migrate them.
- **BIBLE §6 is amended:** `NostrEvent` = any imported event, *or* an event-less node that holds an
  event-form address with no event behind it.
- **Letters that point at an event-less node dangle on the wire until it gets a letter.** Lettered
  `add-to-set` targeting one would re-sign the item with an `n` tag naming it; lettered `create-set` beneath
  one would emit an `s` tag naming it; publishing a concept would ship such lettered children. Harmless
  locally. Keep event-less trees event-less and wire members with `add-relationship`. Documented, not guarded.
- **Mortal and box-bound.** No backup covers these nodes today (the brain export carries only the five
  second-brain families); the `note` says so at the point of use.
- **The parent lookup is label-anchored** (`:NostrEvent`, index-backed); every Set and Superset carries that
  label, event-less ones included.
- **Debt:** `scripts/scratch-stack.sh` repeats `brain-drill.sh`'s boot block (a shared lib is a later
  cleanup); `importEventDirect`'s float `kind`/`created_at` quirk is mirrored, not fixed; a letter-minting
  primitive and `delete-subset` are future stories; the probe's `operations` list grows with the family.
- **Firmware reinstall required?** **No** — no concept definition changes.

## Implementation notes

Test-file changes (the new suite and its runner registration) belong to Phase 3 — the Tester's lane — never
to implementation.

- **New `src/api/normalize/nodes.js`** — imports exactly `crypto`, `../../lib/neo4j-driver` (`runCypher`,
  `writeCypher`), `./firmware` (`getTAPubkey`, `conceptUuid`), `../../middleware/auth` (`isOwner`), and
  `../../lib/dtag` (`childDTag`). Nothing else: no `child_process`, `nostr-tools`, `assistantKeys`,
  `publishToStrfry`, or `signAndFinalize`. Exports `handleAddSubset` plus a pure
  `buildSubsetTags(uuid, name, parentUuid, setConceptUuid, description)` returning `[{ uuid, type, value }]`
  for U-class tests. The header comment carries the event-less contract, the `note`, and the dangling-letter
  consequence.
- **The write statement,** sketched:
  ```cypher
  MATCH (p:NostrEvent {uuid: $parentUuid})
  MATCH (:NostrEvent {uuid: $setConceptUuid})-[:IS_THE_CONCEPT_FOR]->(setSup:Superset)
  OPTIONAL MATCH (pre:NostrEvent {uuid: $uuid})
  WITH p, setSup, pre IS NULL AS created
  MERGE (s:NostrEvent {uuid: $uuid})
    ON CREATE SET s:ListItem:Set, s.name = $name, s.kind = $kind,
                  s.pubkey = $pubkey, s.created_at = $createdAt
  WITH p, setSup, s, created
  UNWIND $tags AS t
  MERGE (tn:NostrEventTag {uuid: t.uuid})
    ON CREATE SET tn.type = t.type, tn.value = t.value
  MERGE (s)-[:HAS_TAG]->(tn)
  WITH DISTINCT p, setSup, s, created
  MERGE (p)-[:IS_A_SUPERSET_OF]->(s)
  MERGE (setSup)-[:HAS_ELEMENT]->(s)
  RETURN created, s.uuid AS uuid, labels(s) AS labels, setSup.uuid AS setSupersetUuid
  ```
  Zero rows means a pre-check was bypassed — answer 500, never a false success.
- **New `src/api/normalize/nodePrimitivesProbe.js`** — zero requires by contract; exports `PROBE_RESPONSE`
  and `handleNodePrimitivesProbe`.
- **`src/api/normalize/index.js`**, in `registerNormalizeRoutes` beside `:5510-5517` — inline-require both
  modules; `app.post('/api/normalize/add-subset', handleAddSubset)` and
  `app.get('/api/normalize/node-primitives', handleNodePrimitivesProbe)`. Nothing else in `index.js` changes.
- **New `scripts/scratch-stack.sh`** with `up` / `down` — boots an ephemeral instance by `brain-drill.sh`'s
  recipe (own network and redis, fresh anonymous volumes, no published ports, strfry-router stopped), copies
  this checkout's `src/` into it, restarts its control panel, runs firmware install, and prints the container
  name for `TAPESTRY_CONTAINER`. It never touches the `tapestry` container. Engineering tooling, not a test
  file.
- **Docs:** BIBLE §6, the `NostrEvent` row (the amendment above); BIBLE §11, rows for
  `POST /api/normalize/add-subset` and `GET /api/normalize/node-primitives` beside `:443-445`; BIBLE's
  "Last updated" line.
- **For the Tester (Phase 3):**
  - U-class, with a pre-require stub of `neo4j-driver` (the `test/strfry-wipe-owner-gate.test.js` pattern):
    403 before any Cypher runs; the 400 cases; 404 / parent-label 400 / 409 / 500 discrimination; `created`
    vs `already-existed`; `buildSubsetTags`' order and tag uuids against `importEventDirect`'s formula; `note`
    only on `created`.
  - S-class: `nodes.js`'s require list is exactly the five above and names none of the forbidden modules or
    functions; the probe module has zero requires; both routes are registered.
  - H-class, against `TAPESTRY_CONTAINER` — SKIP when the stack is absent or `/api/normalize/node-primitives`
    is not served: an author-scoped strfry bracket around a create; the matrix create → repeat
    (`already-existed`) → a lettered same-name fixture (`already-existed`, `hasEvent: true`) → address-held
    409 → 404 / 400; criterion 4 by running `ConceptDag.jsx`'s and `conceptCounts.js`'s Cypher and
    `exportSet.js`'s traversal query (its route is `requireOwner`, unreachable over loopback); criterion 5 via
    a firmware reinstall that runs only against an explicitly named scratch container — never the default
    `tapestry` — behind an opt-in variable; teardown of every fixture node.

## Out of scope

- Minting a letter for an event-less set, and any strfry emission.
- The UI (the "+ New Set" button stays lettered); changes to `create-set`, `add-to-set`, or
  `importEventDirect`.
- §30's provenance representation; backups.
- Deleting or renaming sets; event-less creation of other node kinds.
- Firmware-install behavior.
- `importEventDirect`'s float `kind`/`created_at` quirk.
- Refactoring `brain-drill.sh` to share the scratch boot block.
