# ADR 0011: Class-thread membership tags (`n`/`s`) + Phase B mechanism amendment

**Status:** Accepted
**Date:** 2026-05-19
**Story:** `engineering-team/stories/14-community-class-thread-pull.md`
**Supersedes:** ADR 0010 §"Decision" mechanism (z-tag recursive walk + classification rule). ADR 0010's owner-only endpoint surface, honest invariants, trust posture, and consequence framing remain in force; only the *walk mechanism* and *classification rule* are replaced.
**Builds on:** ADR 0005 Rev 2, ADR 0007, ADR 0008.

**Numbering note:** the superseded ADR was originally numbered 0009 in commit `e0d568b2`; renumbered to 0010 to yield slot 0009 to the parallel graperank-shared-csv-coordination ADR. This amendment is therefore 0011 (one above the renumbered original).

## Context

Implementer-phase grounding for Story #14 surfaced two findings that broke ADR 0010's pseudocode:

1. **Tapestry's published class-thread encoding is asymmetric.** Class membership ("I am of category C") is encoded via z-tags pointing to the concept's Header. **Class-thread structural relationships** (HAS_ELEMENT, IS_A_SUPERSET_OF) are encoded as *separate* "relationship-descriptor" kind-39999 events with `nodeFrom`/`nodeTo`/`relationshipType` tags + z-tag to the `:relationship` concept. Two-tier encoding: members on one tier, structure on another.

2. **Story #9's export collects members but not structure.** Empirical inventory of the curator's published events on dcosl (29 kind-39999 events) found **zero relationship-descriptor events**. Story #9's query collects Header + Superset + Sets + elements + core-nodes by traversing local Neo4j edges, but doesn't separately collect kind-39999 events z-tagged at `:relationship`. So the curator's class-thread structure is not in the published byte-stream, and Phase B's reconstruction is structurally blocked under the original encoding.

The right fix is not to amend Story #9 (papering over) but to **collapse the two-tier encoding into a single tier** — make the structural relationship live as a tag on the child source event itself, mirroring z-tag's pattern. Single-char + relay-indexed + decentralized + composes with existing primitives.

User-ratified design choices (this discussion):
- **(a)** Combined ADR — tag ratification AND Phase B mechanism amendment in one document.
- **(b)** Letters: `n` (HAS_ELEMENT-inverse, child claims parent set) and `s` (IS_A_SUPERSET_OF-inverse, child claims parent superset).
- **(c)** Migration: dual-emit (new tags + descriptor events) for one cycle, then hard cutover (subsequent ADR drops descriptor emission).
- **(d)** Reserved future-candidates section codifies the uppercase-as-direction convention without burning any uppercase tags now.

## Options considered

### Option A — Single-tier child-claims-parent single-char tags (chosen)
A kind-39999 event carries `['n', '<parent-set-a-tag>']` to claim "I am an element of this parent set" and/or `['s', '<parent-superset-a-tag>']` to claim "I am a subset of this parent superset." Relay-side filtering by `#n=<uuid>` or `#s=<uuid>` (NIP-01 indexed by default since single-char) returns all children of that parent in one round-trip.

**Pros:**
- One filter call enumerates all direct children → Phase B walk is `O(depth)` round-trips instead of `O(events × N)` descriptor-scanning.
- Descriptor events go away after the back-compat cycle → ~50% event-volume reduction on class-thread mutations.
- Mirrors z-tag pattern → already-internalized mental model.
- Story #9's export becomes structurally complete with zero amendment (the events themselves now carry the structure).
- Decentralized by construction (no parent has to maintain a children-list event).

**Cons:**
- New protocol-level commitment to two letters (`n`, `s`). Forward-compatible but not free to undo.
- Existing event corpus (local + curator's dcosl events) doesn't carry the tags; dual-walk during back-compat or owner-side migration required.

### Option B — Amend Story #9 to also export descriptor events (rejected)
Keep the two-tier encoding; extend Story #9's query to collect kind-39999 events z-tagged at `:relationship` whose endpoints are in the collected node set.

**Why rejected:**
- Papers over the underlying complexity (two-tier encoding stays); each new consumer has to walk two tiers forever.
- Doesn't address the relay-indexing question (`:relationship`-z-tagged events aren't single-char-tag indexed by uuid; consumers can't filter by "descriptor pointing at uuid X" efficiently).
- Doubles event volume relative to Option A on every class-thread mutation.
- Misses the structural simplification.

### Option C — Multi-char tags (e.g., `parent-set`, `parent-superset`) (rejected)
Same encoding semantics as Option A but multi-character tag names.

**Why rejected:**
- NIP-01 relay-side indexing is opt-in for multi-char tags; many relays don't index them. Filtering `#parent-set=X` becomes a scan instead of an index hit. Performance materially worse at scale.
- Signals "ad-hoc extension" rather than "canonical protocol primitive."

### Sub-option — Case-encodes-direction (lowercase = child-claims-parent, uppercase = parent-claims-child) (deferred; reserved as a future convention only)
Use `n`/`N` and `s`/`S` to encode direction systematically.

**Why deferred:** parent-claims-child has limited utility in a decentralized world (any aggregate view can be derived from child-claims-parent via relay query); cognitive load of "case means direction" is real if uppercase tags never get used. Reserved as a documented convention so future ADRs can claim uppercase forms with consistent semantics if a concrete need arises.

## Decision

### The two tags

| Tag | Logical relationship | Direction encoded on-wire | Neo4j edge written by consumers |
|---|---|---|---|
| `n` | HAS_ELEMENT-inverse | child event claims parent set | `(parent)-[:HAS_ELEMENT]->(child)` |
| `s` | IS_A_SUPERSET_OF-inverse | child event claims parent superset | `(parent)-[:IS_A_SUPERSET_OF]->(child)` |

**Tag value format:** the parent's a-tag form (`<kind>:<pubkey>:<dtag>` — same shape as `z` tag values). E.g. `['n', '39999:919ba08a…:the-set-of-paid-nostr-relays']`.

**Multi-parent semantics:** an event may carry multiple `n` tags (member of multiple sets) and multiple `s` tags (subset of multiple supersets — rare but expressible). Same multi-tag pattern as `z`.

**Kinds:** these tags are defined for **kind-39999 only** in this ADR. Future ADRs may extend them to other kinds (e.g., kind-9999 ephemeral events) but the present scope is replaceable class-thread events.

**Direction principle (reserved, codified):** lowercase single-char tags encode **child-claims-parent**. Uppercase single-char tags (currently unassigned) would encode **parent-claims-child** for the same logical relationship type if a future ADR adopts the inverse direction. Do not assign uppercase forms speculatively.

### Emission policy (dual-emit cycle)

For one full release cycle after this ADR ships, every Tapestry mutation that creates a class-thread relationship emits **both**:
- The new `n` or `s` tag on the child source event (added to the event's `tags` array before signing).
- The existing relationship-descriptor event (current behavior unchanged).

After the cycle, a follow-up ADR drops descriptor emission. **This ADR does NOT mandate the cutover timing** — that's a future ratification once the dual-emit has been observed in production for at least one full deploy-and-stabilize cycle.

Mutation sites the Implementer MUST audit + amend (non-exhaustive; grep `firmware.conceptUuid('relationship')` to find all):
- `src/api/normalize/index.js` `handleCreateSet` (line ~2940) — emit `s` tag on the Set event before signing.
- `src/api/normalize/index.js` `handleAddToSet` (line ~3014) — publish a replaceable child event carrying the source content + the new `n` tag (replaces the existing item with the tagged version), AND continue publishing the descriptor event.
- Any other site that publishes a `:relationship`-z-tagged event for HAS_ELEMENT or IS_A_SUPERSET_OF.

### Phase B walk mechanism (supersedes ADR 0010 §Decision)

```
visited = Set([communitySupersetUuid])
queue = [communitySupersetUuid]
stats = {fetched:0, materialized:0, edgesMerged:0, skipped:0, errors:[]}
maxDepth = env.BRAINSTORM_COMMUNITY_PULL_MAX_DEPTH || 16
maxFetch = env.BRAINSTORM_COMMUNITY_PULL_MAX_FETCH || 2000
depth = 0

while queue.length && depth < maxDepth:
  nextQueue = []
  for parentUuid in queue:
    // === NEW-ENCODING WALK ===
    // (a) Direct elements: events claiming this parent via #n
    nMembers = await fetchExternal({kinds:[39999], '#n':[parentUuid]}, relayHints)
    // (b) Direct sub-Supersets/Sets: events claiming this parent via #s
    sMembers = await fetchExternal({kinds:[39999], '#s':[parentUuid]}, relayHints)

    // === BACK-COMPAT WALK (pass-1d-equivalent) ===
    // For the root iteration only (depth === 0), also fetch events z-tagged
    // at the curator's concept Header. These are flat-class-thread members
    // (no hierarchy reconstructable; see Story #9 export gap). MERGE them
    // as direct HAS_ELEMENT of communitySuperset.
    zMembers = (depth === 0)
      ? await fetchExternal({kinds:[39999], authors:[curatorPk], '#z':[curatorHeaderUuid]}, relayHints)
      : []

    for ev in [...nMembers, ...sMembers, ...zMembers]:
      if visited.has(uuidOf(ev)) continue
      visited.add(uuidOf(ev))
      if stats.fetched >= maxFetch: break
      stats.fetched++

      // Trust gate: foreign event MUST be authored by the curator
      if ev.pubkey !== curatorPk:
        stats.skipped++
        stats.errors.push({step:'trust-gate', uuid:uuidOf(ev), reason:'non-curator author'})
        continue

      // Publish + materialize
      try {
        await postStrfryPublish(ev)
        await executeCypher(buildImportCypher(ev))
        stats.materialized++
      } catch (e) {
        stats.errors.push({step:'materialize', uuid:uuidOf(ev), message:e.message})
        continue
      }

      // Classify (z-tag = :set means Set)
      isSet = ev.tags.some(t => t[0]==='z' && t[1] === `39998:${curatorPk}:set`)

      // Compute Neo4j edge direction from the encoding-of-origin:
      //   - nMembers/zMembers ⟹ HAS_ELEMENT (parent→child)
      //   - sMembers ⟹ IS_A_SUPERSET_OF (parent→child)
      try {
        if (origin === 'n' || origin === 'z'):
          await runCypher(`
            MATCH (p {uuid:$p}),(c {uuid:$c})
            WHERE p:Superset OR p:Set
            MERGE (p)-[:HAS_ELEMENT]->(c)
          `, {p: (origin==='z' ? communitySupersetUuid : parentUuid), c: uuidOf(ev)})
        if (origin === 's'):
          await runCypher(`
            MATCH (p {uuid:$p}),(c {uuid:$c})
            WHERE p:Superset OR p:Set
            MERGE (p)-[:IS_A_SUPERSET_OF]->(c)
          `, {p: parentUuid, c: uuidOf(ev)})
        stats.edgesMerged++
      } catch (e) {
        stats.errors.push({step:'edge', uuid:uuidOf(ev), message:e.message})
      }

      if isSet:
        await runCypher(`MATCH (n {uuid:$u}) SET n:Set`, {u: uuidOf(ev)})
        nextQueue.push(uuidOf(ev))
      // else: leaf element — no recursion

  queue = nextQueue
  depth++

return {supersetUuid, ...stats, truncated: stats.fetched>=maxFetch, depth}
```

**Direction reminder:** the on-wire encoding is child-claims-parent (`['n', parentUuid]` on the child event). The Neo4j edge MERGE is parent→child (matching install.js pass-1d byte-equivalence). The walk reads child events; the Cypher flips the direction.

**Trust gate:** Phase B refuses to materialize events whose `pubkey !== curatorPk`. This prevents cross-instance election (someone publishing an event with `['n', '39999:<my-localTA>:my-superset']` cannot trick my Phase B into MERGEing edges into my local class thread). Reviewer audit + cycle-local smoke verify.

## Consequences

### Positive
- Class-thread structural relationships become relay-indexed and walkable in O(depth) round-trips.
- Descriptor events deprecate after the back-compat cycle → ~50% event-volume reduction on class-thread mutations + reduced strfry storage + reduced eventSync work.
- Phase B implements as a clean dual-walk during back-compat, single-walk after the cutover ADR ships.
- Story #9 export becomes structurally complete (the events themselves carry the relationships) with zero amendment.
- Resolves the kick-back finding cleanly: instead of working around the published encoding, we evolve it.

### Negative / risk
- **Protocol-level commitment to letters `n` + `s`.** Forward-compatible but not free to undo. Mitigated by: deliberate letter choice, single-ADR ratification, Reserved-Future section documents what neighbors mean.
- **Migration of existing local events.** Owner's existing Sets/elements published prior to this ADR don't carry the new tags. A one-time owner migration ("re-publish my existing events with the new tags") is recommended for cleanliness but not blocking. Bounded scope; idempotent; out-of-band CLI or endpoint (separate small story).
- **Curator's existing dcosl events** similarly don't carry the tags. The back-compat z-at-Header walk in Phase B handles them without requiring curator migration — flat HAS_ELEMENT closure (no hierarchy). Once the curator migrates (or after the cutover ADR drops descriptor emission), the back-compat walk path can be removed.
- **Dual-emit code path** lives in `handleCreateSet`/`handleAddToSet`/etc. for one cycle. Slight ongoing maintenance burden. Removed by the cutover ADR.

### Neutral
- New tags are additive: existing parsers ignore them. Zero impact on instances that don't walk them.
- Story #14's owner-only endpoint surface (ADR 0010 §Decision §"Surface"), honest invariants (no editorial relationships, no election), idempotency posture, and termination guards (visited-set + max-fetch + max-depth) all carry forward unchanged.
- Story #14's UI button on `ConceptDetail.jsx` and BIBLE §22 Phase B paragraph carry forward unchanged.

## Reserved / future-candidates

### Direction convention (reserved)
**Lowercase single-char tags encode child-claims-parent.** If a future relationship requires parent-claims-child encoding alongside the lowercase form, the convention is **uppercase = parent-claims-child** with the same letter denoting the same logical relationship type, only direction inverted. Do not assign uppercase tags speculatively; only when a concrete consumer needs the inverse direction AND that inverse cannot be more cleanly expressed as a derived aggregate query (e.g. relay filter for `#n=X` returns all children of X).

### Candidate future relationship tags (NOT implemented in this ADR)
The following are noted as design-space candidates for future ADRs. **Do not implement without a separate ratification** — each carries open design questions worth deliberate examination:

- **`IS_A_PROPERTY_OF`** (property tree). Candidate letter: TBD (`o`? `p` is NIP-01-reserved). Open question: direction (child-claims-parent likely correct by symmetry with class-thread, but property-tree has 1:N-to-1:N patterns worth examining). Hot-read-path candidate.
- **`REFERENCES`** (community-reference; Story #8 flaw A). Candidate letter: TBD. Open question: publishing semantics — consumer-owned tag on the consumer's concept Header, or a separate "reference manifest" kind-39999 event? Composes with flaw A's "registry as DList" design.
- **Editorial relationships** (`RECOMMENDED_BY`, `ENDORSES`, etc., per ADR 0010 §"Surfaced findings"). Currently no canonical tag-letter; future ADR designs the surface deliberately (trust, provenance, first-class-vs-stub semantics).

## Trust constraints (binding)

1. **Authorship gate (Phase B):** events accepted into the foreign sub-graph MUST have `pubkey === curatorPk` (i.e., signed by the same TA whose Header anchored the #11 IS_A_SUPERSET_OF edge). Cross-pubkey events claiming `#n` or `#s` against curator-sub-graph uuids are skipped + logged + counted as `errors[].step==='trust-gate'`. Reviewer audit verifies.
2. **Local-graph isolation:** Phase B never MERGEs an edge whose parent endpoint is in the LOCAL owner's sub-graph (i.e., parent pubkey === localTA). The only cross-pubkey edge that exists is the #11 `(localSuperset)-[:IS_A_SUPERSET_OF]->(communitySuperset)` anchor, established by firmware install, not by Phase B. Reviewer audit verifies: `MATCH ()-[r]->() WHERE startNode(r).uuid STARTS WITH '39999:<localTA>:' AND endNode(r).uuid STARTS WITH '39999:<curatorPk>:' AND type(r) <> 'IS_A_SUPERSET_OF' RETURN type(r), count(*)` → expect 0.
3. **No editorial-relationship MERGEs.** Only `HAS_ELEMENT` and `IS_A_SUPERSET_OF` edges are MERGEd by Phase B. Reviewer audits the diff.

## Blast radius

| File | Change | Lines (est.) |
|---|---|---|
| `src/api/normalize/index.js` | `handleCreateSet` (~line 2940): emit `s` tag on Set event before signing | +2 |
| `src/api/normalize/index.js` | `handleAddToSet` (~line 3014): publish replaceable child event with `n` tag added before signing | +20 (new replaceable-publish path) |
| Other mutation sites | Audit via `grep firmware.conceptUuid('relationship')`; add tag emission to each | +2–5 each |
| `src/api/concept/pullClassThread.js` | **new** — Phase B handler with dual-walk (n/s + back-compat z) | ~180–230 |
| `src/api/index.js` | +1 line registering the endpoint | +1 |
| `ui/src/pages/concepts/ConceptDetail.jsx` | +1 button + inline progress | ~30–50 |
| `BIBLE.md` §22 + new §23 (or expanded §6) | Phase B paragraph + `n`/`s` tag spec + reserved-future-convention | ~30 |
| `test/community-class-thread-pull.test.js` | Existing T1/T2/T3/T4/T5/R1 sentinels need adjustment for new mechanism | (re-baselined) |
| `engineering-team/stories/14-community-class-thread-pull.test-plan.md` | Re-baselined for new mechanism | (re-baselined) |
| `engineering-team/decisions/0009-…` | Add "Superseded by ADR 0010 §Decision" note at top | +2 |

## Implementation notes

### Emission in `handleCreateSet` (the simple case)
Before the `signAndFinalize` call (line ~2934), prepend the `s` tag:
```js
tags.push(['s', resolvedParentUuid]);  // child-claims-parent: this Set is a subset of <resolvedParentUuid>
```
Keep the existing descriptor-event publication unchanged (dual-emit).

### Emission in `handleAddToSet` (the structurally harder case)
`handleAddToSet` doesn't create the source event — it adds an existing item to a set. To get the `n` tag onto the source event we must **republish the item as a replaceable kind-39999 event with the existing tags + the new `n` tag**.

Approach:
1. Read the existing item's strfry event.
2. Build a new event with the same kind/d-tag/content + existing tags + the new `n` tag.
3. Sign + publish via the TA's key (works only if the item was authored by the local TA; foreign items can't be re-signed).
4. Continue publishing the descriptor event (dual-emit).

Edge case: items NOT authored by the local TA (rare in practice today since `add-to-set` is invoked on owner content) cannot be re-signed. In that case, emit the descriptor event only (skip the `n` tag for that item). Log a warning. The cutover ADR will need to address this if mixed-authorship items become common.

### Migration of existing local events (owner-side, one-shot)
A separate small story / endpoint `POST /api/normalize/migrate-class-thread-tags` (owner-gated, idempotent) walks the local TA's existing Sets and elements, computes the `n`/`s` tags from current Neo4j state, republishes each event with the tags added. Idempotent (already-tagged events skip). Not blocking Phase B's behavioral landing — back-compat z-walk handles missing tags.

### Phase B handler (pullClassThread.js)
Per the pseudocode above. Key implementation requirements (Reviewer audits each):
- Authorship trust gate before any materialization or edge MERGE.
- Cross-pubkey edge prevention (only foreign-foreign edges MERGEd inside the walk; the #11 anchor is the only cross-pubkey edge in the graph).
- No `source` property on any MERGEd `HAS_ELEMENT` or `IS_A_SUPERSET_OF` edge (canonical relationships, not stubs).
- Visited-set + max-fetch budget + max-depth guard (carried forward from ADR 0010 §"Termination guarantees").
- Per-event graceful try/catch (carried forward from ADR 0010).

### BIBLE updates
- §22 (Community-Reference Model): Phase B paragraph documenting the on-demand pull mechanism using `n`/`s` tags.
- New §23 (or expand §6 Class-Thread): canonical spec for `n` and `s` tags — semantics, direction principle, dual-emit migration policy, reserved-future direction convention.
- Glossary: `n` tag, `s` tag.

### Tester re-baselining
The existing T-sentinels in `test/community-class-thread-pull.test.js` need adjustment:
- **T2 (was z-tag walk):** now anchors `#n` AND `#s` filter literals + `kinds:[39999]` in `pullClassThread.js`.
- **T3 (Set classification):** anchors classification via `z=39998:${curatorPk}:set` check.
- **T4 (no `source` property):** unchanged — same invariant, same sweep.
- **T5 (termination guards):** unchanged — visited-set + max-depth still apply (recursion through `s` chains).
- **New T6:** authorship trust gate present (`grep` for `pubkey !== curatorPk` or equivalent).
- **R1:** unchanged — install.js #11 contract preserved.

Plus a new R2 regression guard: `handleCreateSet`/`handleAddToSet` continue to emit descriptor events during back-compat (the dual-emit policy).

## Out of scope (named, deferred)
- Cutover ADR (drops descriptor emission after back-compat cycle).
- Migration CLI/endpoint for existing local events (separate small story).
- `IS_A_PROPERTY_OF`, `REFERENCES`, editorial-relationship tags (Reserved-Future section above).
- kind-1 / WoT-ranking of foreign elements.
- Auto-pull-at-install.
- Election surface.
- Concept-Graph fidelity upgrade.
