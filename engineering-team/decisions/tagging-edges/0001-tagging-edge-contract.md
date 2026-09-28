# ADR 0001: The tagging edge contract — one pure module every TAGS writer calls

**Status:** Accepted
**Date:** 2026-09-26
**Story:** `engineering-team/stories/tagging-edges/1-tagging-edge-contract.md`
**Amended (2026-09-27):** by `tagging-edges/0002` — the write guard (writers follow the relay's current version),
kind-5 reading, writer-set properties, the stamp-pubkey binding, R2-NB3, step 5 (R2-8, R2-NB2), clarifications 10
and 13, and the consequences on tag-element fetching and revokes. Carry-forwards R2-4 to R2-7 were applied with story
2's implementation (R2-4 strfry bullet, R2-6 step 1 and clarification 9, R2-7 stance paragraph).

## Context

Story `tagging-edges` #1 asks for one agreed definition of the NostrUser→NostrUser relationship that reflects a
tagging, before anything writes one. Its acceptance criteria, restated (the story holds the exact wording):

- **AC-1** — every deployed tagging shape (address and id, address only, id only) converts to a record of the same
  form. The record holds:
  - from = the author; to = the `p` pubkey, lower-case;
  - identity = `39999:<author>:<d>`, plus the event id and `created_at`;
  - the stance exactly as published, or *absent*;
  - the tag's event id when the event names one, and which of the two stamps the event carried;
  - the tag's address and slug whenever the address is known, either named by the event or resolved from a
    supplied tag element whose id the tagging names.

  If the tagging names only an id and that element is not supplied, the record holds the id, no address and no
  slug, and is marked unresolved. It never takes another author's same-slug tag.
- **AC-2** — anything that is not a tagging gets no record, a named reason, and never a throw. That covers
  another kind, no `d`, no `nostr-user-tag` stamp, zero or several `p`, a non-64-hex `p`, no tag named, several
  different tags named, or an `a` not of the form `39999:<64-hex>:<slug>`. A record is produced for any author,
  a self-tagging, a dispute, a neutral "0", an absent stance, or a tag that is not on this relay.
- **AC-3** — of two versions at one identity, the newer `created_at` stands, and on a tie the lower event id
  (NIP-01). The result is the same whichever order the versions arrive in. When the target changes, the outcome
  names the target that no longer holds this tagging.
- **AC-4** — a kind-5 applies only if the tagger signed it and it names either the version's id, or the tagging's
  address with `created_at` no earlier than the version's. A revoke naming a superseded version, a later version,
  or signed by anyone else does not apply. The answer is the same whether the revoke arrives before or after the
  version.
- **AC-5** — BIBLE §6 lists `TAGS` among the social relationships between NostrUser nodes.
  - FOLLOWS, MUTES and REPORTS appear beside it by direction and source event kind only.
  - For `TAGS` it gives the direction, source events, what identifies one and what it records, that an absent
    stance counts as apply, and the rules of AC-3 and AC-4.
  - The glossary separates `TAGS` from `HAS_TAG` / `NostrEventTag`.
  - The docs say that no pipeline writes `TAGS` yet.

**Concepts (oriented via the Concept Graph, 2026-09-26).** Calls, in order, before any source reading in this
phase: `/api/concept-graph/summaries` (at session start and again in Planning); `/node/39998:<TA>:nostr-user-tag/neighbors`;
`/node/39998:<TA>:relationship-type/neighbors`; `/node/39999:<TA>:relationship-type-superset/neighbors`;
`/node/39999:<TA>:relationship-types-for-nostr/neighbors`; `/node/39999:<TA>:relationship-type-schema`; and, in
Planning, `/node/39999:<TA>:nostr-user-tag-schema`. Firmware files and source were read only afterwards.
- `39998:<TA>:nostr-user-tag` (local TA `8387ec0e…`, resolved at runtime) has the full core-node set. Its
  `REFERENCES` neighbour is the canonical header
  `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:nostr-user-tag` (the ADR 0015 literal,
  present locally as a community-reference node). Taggings on every deployment carry the canonical stamp; since
  2026-06-17 most writers also add the publishing deployment's own (`tag-federation/0003`).
- `39999:<TA>:nostr-user-tag-schema` describes the content `{"nostrUserTag": {taggedPubkey*, tagEventId*,
  tagAddress?}}`. The story names three departures from it: address-only taggings are accepted, the stance is
  read from the `polarity` tag, and the target is read from `p`.
- `39998:<TA>:relationship-type` registers edge types as elements
  (`firmware/versions/v1.0.0/concepts/relationship-type/`). Its `nostr` set holds authors, references, has-tag
  and two class-thread types (`manifest.json`). FOLLOWS, MUTES and REPORTS are **not** registered.

**Decisions this ADR must agree with, checked:**
- `0001-profile-tag-architecture.md` (flat, :79, :55):
  - identity is (author, target, tag) through the replaceable `d`;
  - a flip is an overwrite;
  - a revoke is a kind-5 naming the assertion id;
  - an absent `polarity` means `"1"`.

  Agrees.
- `profile/0022-nostr-user-tag-hybrid-ea-reference.md`: `a` is the tag's identity and `e` is provenance. Agrees
  (see the resolution rule below).
- `profile-tag-hardening/0001-consume-profile-tags-by-a-coordinate.md`: readers take `a` first, then `e` through a
  by-id map, with no cross-check (`assertionTagCoordinate`, `src/api/profile-tags/index.js:192-201`). Agrees; the
  resolution order below is the same.
- `tag-federation/0003-dual-z-writer.md`: two z stamps. Agrees (`zCanonical` / `zLocal`).
- `0015-restore-historical-data-and-fix-tl-author-filter.md` fixes where the canonical literal may live. This ADR
  adds no copy: both pubkeys are parameters.
- `event-tagging/0009-unified-taggings-normalization.md` decides that the dependency-free core
  `src/lib/event-tagging` is the one **read-time** normalization layer: "profile-tagging … registry members, not
  parallel cores" (Decision 1), under its constraint 1, "read/aggregation only". This ADR's module parses the same
  `nostr-user-tag` assertions for a **write-side projection** into Neo4j, which 0009's scope excludes. It is still
  a second parser of those assertions, and the departure is deliberate (Decision → "Relation to event-tagging/0009").

**The code a writer would otherwise borrow from, and why it can't be borrowed as is.**
- `src/lib/event-tagging/taggings.js:44-58`: the `nostr-user-tag` member's `extractTag` accepts **only an `a`
  tag** (`COORD_RE`). It therefore drops id-only taggings, which are 97% of the census (6,739 of 6,972 on
  production). This also drops them from `/api/tags/index` and tag applicability
  (`src/api/event-tags/index.js:480` → `normalizeTaggings` skips a tagging whose `extractTag` returns null). That
  is a live read-side defect: the diagnosis of OPEN.md row 45 (see follow-ups below).
- `readPolarity` exists four times (`src/lib/event-tagging/classify.js:25`, `src/lib/event-tagging/taggings.js:24`,
  `src/lib/identification-tags/index.js:65`, `src/api/profile-tags/index.js:141`). Each maps an absent stance to
  `1`, which erases the *absent* value AC-1 must keep.
- `src/api/profile-tags/index.js:162-173` `dedupeReplaceable` keeps the **first** of two versions with equal
  `created_at`, not NIP-01's lower id. The module is not pure either: it resolves the TA at load (`:55`), logs, and
  imports relay and Meili I/O.
- The existing FOLLOWS / MUTES / REPORTS writers each derive edge shape inline, and they disagree.
  `src/pipeline/stream/redis-consumer.js:92-105` writes property-less REPORTS. The reconcile path writes
  `report_type` plus a wall-clock `timestamp`. This is the failure the story exists to prevent.

**What strfry 1.1.0 actually does** (source read in the container, `/usr/local/src/strfry/src/events.cpp`):
- Replaceable identity is the first `d` tag strfry indexes: a `d` longer than 255 bytes is skipped, and when no
  `d` is left the identity is `''` (:48-62, :282-286). *(Corrected in the review round, clarification 9.)*
- On equal `created_at` the lower id stands (:246-249).
- An `a`-deletion covers stored versions with `created_at <=` the deletion, and refuses later arrivals at or
  before it (:320, :352).
- An `e`-deletion that arrives before its event is honoured through the deletion index (:274).
- A kind-5 naming another author's address is rejected (:43-45).
- Hex in `id` / `pubkey` / `e` / `p` is decoded case-insensitively and compared as bytes (:12-13, :39-41).
- A kind-5 can delete a kind-5, which NIP-09 says has no effect (:333-338).
- *(Amended by `tagging-edges/0002`, R2-4.)* Remaining address-deletion divergences from the definition: strfry
  skips an `a` value over 255 bytes, so it does not honour an `a`-deletion naming such an address, where the
  contract gives `names-address` (`events.cpp:48`); it parses the kind with `stoull`, so `039999`, `+39999` and
  ` 39999` delete on the relay, where the contract gives `not-named` (`EventUtils.h:38-39`); and its deletion index
  hashes the raw `a` while lookups use the lower-case form (`golpe.yaml:80`, `events.cpp:313`), so an upper-case
  pubkey in the address does not delete on the relay, where the contract lower-cases it and gives `names-address`.
  Writers follow the relay's current state, so each divergence decides only whether the relay still holds the
  tagging.

**Census replay** (a throwaway prototype of this contract run over the 2026-09-26 JSONL from all three hosts):
- Every tagging became a record: 6,972 / 6,965 / 6,980, with 0 refusals.
- 6 on each host stay unresolved, because the tag element they name is gone and no tag by that slug exists.
- 0 a+e mismatches.
- Polarity values seen: "1", "-1", "0", or absent, and nothing else.
- Within a host, no kind-5 applies to a stored tagging.
- **Across hosts**, 2 UI revokes on tags.brainstorm.world apply to taggings still stored on production and
  staging. The dcosl router stream carries kinds 9998/9999/39998/39999 but no kind 5
  (`setup/router-presets.json:6,19`), so revokes do not travel with taggings.

**Constraints.**
- JS without a build step, CommonJS, and Node's hand-rolled test style (`test/registry.js`); no new dependencies.
- CLAUDE.md principles 1–3: the record carries a raw assertion, never trust, counts, ranks, names or an
  "applied" flag.
- Principle 4 / BIBLE §30: `TAGS` edges are event-projection state, re-derivable from the relay. Deletes must be
  scoped to this type and one tagging.
- The TA pubkey is never hardcoded outside the ADR 0015 sites.

## Options considered

### Option A — a new pure module, `src/lib/tagging-edges/` (chosen)
A dependency-free folder holds the contract. It converts an event to an edge record or a refusal, picks the
standing version, decides whether a revoke applies, and lists what a revoke names. Both stamp pubkeys are
parameters. Stories 2 and 3 require it; nothing else changes.
- **Pros:**
  - One definition for every future writer.
  - Pure, so it can be tested with no stack, and a purity guard can pin that.
  - Keeps *absent*, the `e` fallback and NIP-01 tie-breaking without changing any reader's behavior.
  - Adds no new literal.
  - An epic-scoped home where story 2 can add its pure diff beside it.
- **Cons:**
  - A fifth `polarity` reader and a second `nostr-user-tag` parser beside 0009's core; convergence is follow-up
    debt.
  - Repeats a few lines of parsing the core already has.

### Option B — extend the event-tagging core (`src/lib/event-tagging/`), per 0009 Decision 1
Add a sibling file exported from `src/lib/event-tagging/index.js`, reuse `COORD_RE` and the family registry, and
widen `nostrUserTagMember.extractTag` to fall back to `e`.
- **Pros:**
  - Honors 0009's single-core decision literally.
  - The core's purity guard (`test/event-tagging-core.test.js:235`) would cover the new file.
  - Widening `extractTag` would also fix the `/api/tags/index` id-only omission.
- **Cons:**
  - The core is the read-time SDK seed ("lift this folder wholesale", `src/lib/event-tagging/index.js:13-14`),
    and 0009 fences it to read/aggregation; a Neo4j edge vocabulary and write-side rules do not belong there.
  - Widening `extractTag` changes what `/tags` counts. That is user-visible and outside this story's acceptance
    criteria.
  - The core's `readPolarity` loses *absent*.
  - Coupling the read stack to the write stack means a reader fix could silently change edge shape.

### Option C — reuse the profile-tags helpers directly
Import `assertionTagCoordinate`, `dedupeReplaceable` and `readPolarity` from `src/api/profile-tags/index.js`.
- **Pros:** least new code.
- **Cons:**
  - Not pure: TA lookup and logging at load, plus relay and Meili imports.
  - `dedupeReplaceable` breaks ties differently from AC-3.
  - `readPolarity` loses *absent*.
  - The pipeline would depend on an HTTP handler module.

### Sub-decision — registering `TAGS` in the relationship-type concept
Adding `firmware/versions/v1.0.0/concepts/relationship-type/elements/tags.json` would make `TAGS` a graph-visible
relationship type, at the cost of a firmware change and reinstall. FOLLOWS, MUTES and REPORTS are not registered
either, so registering one of the four would be inconsistent. **Deferred:** register all four together later (a
OPEN.md row `2026-09-27-register-social-relationship-types`). No firmware change here.

## Decision

We chose **Option A**. It gives every writer one pure definition without changing any reader. It keeps the three
things the story needs that the existing helpers lose: the *absent* stance, resolution through `e`, and NIP-01
tie-breaking. It adds no new copy of the canonical literal.

**Relation to event-tagging/0009.** This ADR **narrowly supersedes 0009 Decision 1 ("not parallel cores") for the
write-side projection of `nostr-user-tag` assertions only**. 0009 keeps governing read-time normalization, and this
ADR changes nothing there. The
two parsers differ on purpose, in three ways: *absent* is kept, `e` resolves the tag, and ties go to NIP-01. When
0009's deferred Phase-2 cleanup runs, it should converge the core's member onto these rules, starting with the
`e` fallback (OPEN.md row 45). A later NostrUser→NostrEvent edge will need the core's indirect
tagging-header resolution. Whether it extends this module or joins the core is decided then; only the standing
and revoke rules below are meant to carry over unchanged. A one-line scope note is added to 0009 pointing here.

**Binding for later stories:**
- The gap-filling pass (story 2) and the real-time path (story 3) derive every `TAGS` property through this module.
- No writer composes `TAGS` properties any other way, and none adds event-derived properties the module does not
  produce.
- *(Amended by `tagging-edges/0002`.)* Every write and delete is conditional on the graph state its decision was made from. The writer
  takes the relationship's write lock, re-reads it in the same transaction and proceeds only if it still equals what
  was read — every property with its type, both ends, and its element id; a create proceeds only while no `TAGS`
  relationship holds the address, which the uniqueness rule `tags_address` makes atomic. The decision is made from a
  relay read taken after that graph read, and follows the relay's current version at the address, older or newer:
  strfry has already applied the version order and every deletion it honours, so no write re-checks AC-3's order.
  Story 2 pins its decision against `standingEdge` over the standing-rule truth table, with exactly two documented
  divergences (`older-ignored` → the relay's version; `no-incoming` → a removal).
- *(Amended by `tagging-edges/0002`.)* Writer-set properties: story 2 decided none. A `TAGS` relationship carries exactly the nine
  properties below.
- *(Review round, 2026-09-27; amended by `tagging-edges/0002`, R2-5.)* **A writer must refuse to start unless both
  stamp pubkeys are lowercase 64-hex;** either one missing, empty, not 64 hex characters or containing an upper-case
  letter refuses the run and names that identity. A writer started without them would read every tagging as a
  non-tagging and retire every edge (step 2 plus the retirement rule). Story 2's mass-delete guard counts every
  AC-3 removal per run.
- *(Amended by `tagging-edges/0002`.)* **R2-NB3.** A relationship at a tagging address is removed when the relay holds nothing at its
  address, or holds a version there the definition refuses, and only while it still holds the version the decision
  was made from, subject to the mass-removal limit. It stays while the relay holds an accepted version at its
  address, even when a deletion names it.
- *(Review round.)* **Callers pass only relay-verified events.** The module does not check signatures; strfry
  verifies them before storing, and every writer reads from the relay.

### The contract

The `TAGS` relationship is `(:NostrUser {pubkey: from})-[:TAGS {…}]->(:NostrUser {pubkey: to})`, one per tagging
address. All of its properties are event-derived:

| Property | Type | Meaning |
|---|---|---|
| `address` | string | `39999:<author>:<d>`: the tagging's replaceable address and its identity (unique per `TAGS`, enforced in story 2). It equals a letter node's `uuid` if tagging events are ever imported |
| `eventId` | string | the id of the version that stands (would join a letter node's `id`) |
| `createdAt` | integer | that version's `created_at`, in unix seconds. Not `timestamp`, which older edges' writers fill inconsistently and `src/api/neo4j/neo4jStatus.js:208` reads across all types |
| `polarity` | string or null | the first `polarity` tag's value exactly as published (`"1"`, `"-1"`, `"0"`, …); `null` means absent |
| `tagAddress` | string or null | `39999:<tagAuthor>:<slug>` (pubkey lower-case) when known, whether named by `a` or resolved from a supplied tag element; otherwise `null` |
| `tagEventId` | string or null | the tag-element version the event names in `e`, lower-case, when it names one |
| `tagSlug` | string or null | the last part of `tagAddress`, or `null` when `tagAddress` is `null`. An identifier, never a display name |
| `zCanonical` | boolean | the event carries `39998:<canonical>:nostr-user-tag` |
| `zLocal` | boolean | the event carries `39998:<this deployment's TA>:nostr-user-tag`. Relative to the reading deployment: the same event can differ between deployments |

Edge properties are camelCase, like derived NostrUser properties. NostrEvent nodes keep their wire names
(`id`, `created_at`, `uuid`). Nothing else goes on the relationship: no trust, rank, count, tag name, bucketed
stance or "applied" flag. "Resolved" means `tagAddress IS NOT NULL` and is not stored separately. **Graph readers
bucket the stance** with `coalesce(toFloat(r.polarity), 1.0)`: ≥ 0.5 is apply, ≤ −0.5 is dispute, anything else
is neutral. *(Amended by `tagging-edges/0002`, R2-7.)* That matches today's tag surfaces for every value on the
relays today (`"1"`, `"-1"`, `"0"`, absent); malformed values such as `""`, `"NaN"` or `"-Infinity"` can bucket
differently in Cypher and in JS (BIBLE §6).

**Which version stands (AC-3).** At the same `address`:
- The greater `createdAt` stands. On equal `createdAt`, the lexically lower `eventId` stands (NIP-01, as strfry
  does).
- Equal `eventId` means the same version. Its tag address and slug are kept from whichever side has them, so
  resolution only ever moves from `null` to a value.
- A newer **non-tagging** version at the same address, i.e. a refusal that carries an address, retires the edge.
  The relay keeps only the newest version at an address, whatever its content.
- **No tombstone.** Once an edge is retired, `standingEdge(null, older)` would accept an older tagging.
  Order-independence is therefore promised for edge against edge. Retirement relies on the relay's replaceable
  rule: a writer fed from the local relay never sees an older version after a newer one is stored, because strfry
  refuses it, and story 2's sweep reads only the relay's current version per address. *(Amended by `tagging-edges/0002`.)* An id-only
  revoke is the exception: strfry then accepts an older version re-sent at the address, and writers follow it,
  because they follow the relay's current version. Order-independence remains a property of `standingEdge`.

**The tag reference.** When the event carries `a`, that is the tag's identity (`profile/0022`,
`profile-tag-hardening/0001`); `e` is provenance, and a mismatch between them is not refused. AC-2's "several
different tags named" is read as "more than one distinct `a`, or more than one distinct `e`". Ruled by the owner at the
Architecture gate (2026-09-27); the story's AC-2 now reads that way.

**What a revoke removes (AC-4).** **Hex case, one rule for taggings and deletions alike.** An event's own `id` and `pubkey` must be lowercase
(NIP-01), or it is not an event this module accepts. Tag *values* (`p`, `e`, and the pubkey segment of `a`) are
lower-cased before use, because strfry decodes them case-insensitively.

A kind-5 applies to a version if and only if:
- `deletion.pubkey === version.from` (the deletion passes the same event check), and
- either one of the deletion's `e` values, lower-cased, equals `version.eventId`, or one of its `a` values, with
  the pubkey segment lower-cased, equals `version.address` and `deletion.created_at >= version.createdAt`.

It is a pure function of the two events, so arrival order cannot change the answer.

## Consequences

- **Enables:** stories 2 and 3 share one definition, so their edges cannot drift the way REPORTS did. Story 2 can
  create the uniqueness rule on `TAGS.address` knowing exactly what writes to it. The contract is plain objects,
  not tied to a store.
- **Constrains:**
  - Id-only taggings resolve only when the caller supplies tag elements, so story 2 must fetch them; the census
    shows all but 6 resolve against the relay. Story 2's sweep re-attempts edges with `tagAddress IS NULL` on
    every run. *(Amended by `tagging-edges/0002`.)* Story 2 reads tag elements by the two `:tag` stamps in the same relay scan as the
    taggings.
  - Callers supply both stamp pubkeys: the runtime TA through `getOwnerAssistantPubkey()`, and the canonical
    pubkey from an ADR 0015 site. Requiring `src/api/profile-tags` from the pipeline is the dependency Option C
    rejected. Story 2 therefore either requires it lazily inside its entry point, following the precedent at
    `src/api/assistant/identificationTaggings.js:72`, and records that, or proposes an ADR 0015 amendment moving
    the literal into a pure constants module. It must not add a new literal.
  - **Revokes do not travel with taggings today.** The dcosl stream has no kind 5, and UI revokes carry no `k`.
    *(Amended by `tagging-edges/0002`.)* Writers read no kind-5 events to decide removals: the relay's current state reflects every
    deletion strfry honours, and a deletion strfry did not honour removes nothing (story 2 AC-3). Story 3 follows
    the same rule — a kind-5 prompts a re-read of the relay, never a removal by itself. Bringing kind 5 into the
    router stream is OPEN.md row `2026-09-27-revokes-do-not-travel`. Census evidence: 2 revokes on tags.brainstorm.world apply to taggings still
    stored on production and staging.
  - **An e-only revoke removes only the version it names.** An older version re-sent afterwards stands again, and
    strfry accepts it too. The UI revoke (`ui/src/hooks/useProfileTags.js:150-163`) should also name the address
    (NIP-09); that is OPEN.md row `2026-09-27-ui-revoke-names-id-only`. A kind-5 that names another kind-5 is ignored here (NIP-09), but strfry drops
    the named kind-5, so passes fed from the relay can't see it afterwards.
  - Retiring the canonical stamp (ADR 0015's "eventual full retirement") would make taggings stamped only by
    another deployment be refused as `no-nostr-user-tag-stamp`. Any such migration must revisit this contract.
- **Differences left in place, knowingly:** the read side (`/api/profile-tags/*`, `/api/tags/index`, the 0009
  core) keeps its own polarity reader and first-seen tie-break, and the core still drops id-only taggings. None of
  that changes here.
- **New debt / follow-ups (ledger rows, filed 2026-09-27 in the review round):**
  1. The 0009 core's `nostrUserTagMember.extractTag` drops id-only taggings from `/api/tags/index` and
     applicability — already tracked as OPEN.md row 45 ("the unified tag index reports far fewer tags"); this is
     its diagnosis.
  2. Register TAGS, FOLLOWS, MUTES and REPORTS in the relationship-type concept — OPEN.md row
     `2026-09-27-register-social-relationship-types`.
  3. The nostr-user-tag schema's stale `tagEventId`-required rule — OPEN.md row
     `2026-09-27-user-tag-schema-requires-event-id`.
  4. Document FOLLOWS / MUTES / REPORTS properties (their writers disagree) — OPEN.md rows
     `2026-09-27-social-edge-properties-undocumented` and `2026-09-27-reports-writers-disagree-on-shape`.
  5. Bring kind 5 into the tagging router streams — OPEN.md row `2026-09-27-revokes-do-not-travel`.
  6. UI revoke should also name the address — OPEN.md row `2026-09-27-ui-revoke-names-id-only`.
- **Firmware reinstall required?** No. No concept definition changes.

## Implementation notes

- **New folder `src/lib/tagging-edges/`**, CommonJS and pure: no requires outside the folder, no I/O, no
  `Date.now()` / `Math.random()`, no crypto, no logging. Node globals (`Buffer`) are fine.
  - `contract.js` holds everything below.
  - `index.js` re-exports `contract.js`; story 2 adds siblings here.
- **Constants:**
  - `TAGS_RELATIONSHIP = 'TAGS'`.
  - `REFUSAL`, a frozen map of stable reason strings: `not-an-event`, `wrong-kind`, `no-d`,
    `no-nostr-user-tag-stamp`, `no-target`, `several-targets`, `bad-target`, `no-tag-reference`,
    `several-tag-references`, `bad-tag-address`.
- **`taggingToEdge(event, { canonicalPubkey, localPubkey, tagElementsById } = {})`** returns either
  `{ ok: true, edge }` or `{ ok: false, reason, address?, eventId?, createdAt?, from? }`. The body runs inside
  `try`; a thrown error returns `{ ok: false, reason: 'not-an-event' }`. It never throws. The checks run in this
  order:
  1. **Event.**
     - `id` and `pubkey` match `/^[0-9a-f]{64}$/` (lowercase, NIP-01).
     - `created_at` is a non-negative integer and `tags` is an array.
     - Otherwise → `not-an-event`.
     - `kind !== 39999` → `wrong-kind`.
     - `d` is the value of the first `d` tag that strfry indexes (clarification 9): `d` tags whose value is a
       string longer than 255 UTF-8 bytes (`Buffer.byteLength`) are skipped. If that first remaining `d` is
       missing, not a string, or empty, or no `d` remains → `no-d`. *(Amended by `tagging-edges/0002`, R2-6.)*
       strfry rejects an event whose `d` value is not a string (`events.cpp:35`), and files one whose first
       remaining `d` is missing or empty, or that has no `d` left, under `d = ''`.
     - Once step 1 passes, every later refusal also carries `address` (`39999:${pubkey}:${d}`), `eventId`,
       `createdAt` and `from`.
  2. **Stamp.** At least one `z` equals `39998:${canonicalPubkey}:nostr-user-tag` or
     `39998:${localPubkey}:nostr-user-tag`; otherwise → `no-nostr-user-tag-stamp`. This sets `zCanonical` and
     `zLocal`. If both pubkeys are equal, both flags are true. A missing or empty pubkey option matches nothing.
  3. **Target.**
     - Take every `p` value that is a string, lower-cased, and count the distinct ones: 0 → `no-target`, more
       than 1 → `several-targets`.
     - The remaining value must match `/^[0-9a-f]{64}$/`, else `bad-target`. It becomes `to`.
     - Self-taggings (`to === from`) are accepted.
  4. **Tag reference.**
     - Distinct `a` values (strings) greater than 1 → `several-tag-references`. A single `a` must match
       `/^39999:([0-9a-fA-F]{64}):(.+)$/s` (the slug may contain any character, as strfry takes everything after
       the second colon), else `bad-tag-address`; its pubkey segment is lower-cased.
     - `e` values that are not 64-hex are ignored. The rest are lower-cased; more than one distinct →
       `several-tag-references`. NIP-10 markers are not considered.
     - Neither a valid `a` nor a valid `e` → `no-tag-reference`.
  5. **Resolution.**
     - With `a`: `tagAddress` is the normalized `a` and `tagSlug` its last segment. `e` only fills `tagEventId`.
     - Without `a` but with an `e`, look up `tagElementsById.get(e)`. *(Amended by `tagging-edges/0002`.)* The element is usable only if
       it passes the step-1 event check, its `id` is the `e` the tagging names, it is kind 39999, it has an identity
       `d` — the first `d` of 255 bytes or fewer, read as step 1 reads a tagging's own; a missing, empty or
       non-string one makes it unusable — and it carries `39998:<canonical>:tag` or `39998:<local>:tag` as a `z`.
       Any error while looking it up or reading it counts as absent. A usable element gives `tagAddress = 39999:${el.pubkey}:${d}`; an
       unusable or absent one leaves `tagAddress` and `tagSlug` as `null`.
     - The module never searches for a tag by slug.
  6. **Stance.** `polarity` is the first `polarity` tag's `[1]` when that is a string, else `null`. Every string
     value is accepted.
  7. **Edge.** `{ type: 'TAGS', from: pubkey, to, address, eventId: id, createdAt: created_at, polarity,
     tagAddress, tagEventId, tagSlug, zCanonical, zLocal }`, and nothing else.
- **`standingEdge(current, incoming)`** returns `{ standing, superseded, droppedTarget, changed, reason }`.
  - `current` is an edge or `null`.
  - `incoming` is an edge, a refusal carrying an `address`, or `null`.
  - `reason` is one of `no-incoming`, `new`, `newer`, `older-ignored`, `same-version`, `retired-by-non-tagging`,
    `address-mismatch`.

  The outcomes:
  - **Incoming is `null`:** `current` stands; `changed: false`, reason `no-incoming`.
  - **No current, incoming is an edge:** it stands; `changed: true`, reason `new`.
  - **No current, incoming is a refusal:** `standing: null`; `changed: false`, reason `retired-by-non-tagging`.
  - **Different addresses:** `current` stands and nothing changes; reason `address-mismatch`. It never throws.
  - **Same `eventId`:** `standing` is `current`, with `tagAddress` / `tagSlug` filled from `incoming` if
    `current`'s are null, and `zCanonical` / `zLocal` taken from `incoming`. `changed` is true if any property
    differs from `current`; reason `same-version`. If `incoming` is a refusal with the same id, it is treated as
    retiring the edge.
  - **Incoming stands** (AC-3 order):
    - If `incoming` is an edge, it stands, with reason `newer`.
    - If it is a refusal, `standing` is `null`, with reason `retired-by-non-tagging`.
    - In both cases `superseded` is `current`, `changed` is true, and `droppedTarget` is `current.to` when the
      edge is retired or its target differs.
  - **Current stands:** `standing` is `current`, `superseded` is `incoming`, `changed: false`, reason
    `older-ignored`.
  - **Order-independence:** for two edges `a` and `b` at one address, `standingEdge(a, b).standing.eventId ===
    standingEdge(b, a).standing.eventId`.
- **`revokeApplies(edge, deletion)`** returns `{ applies, reason }`, where `reason` is one of `names-event-id`,
  `names-address`, `not-a-deletion` (not kind 5, or failing the same event check as step 1, including a
  non-lowercase `id` / `pubkey`), `not-the-tagger`, `address-deletion-older`,
  `not-named`. It never throws.
- **`revokeTargets(deletion)`** returns `{ eventIds, addresses }`: the kind-5's valid `e` values (lower-cased)
  and its `a` values (pubkey segment lower-cased), or both empty for anything that is not a kind 5. This is the
  single place story 3 finds which edges a revoke could touch.
- **Tests (Tester's lane, Phase 3):** a new suite registered in `test/registry.js`. It covers:
  - the census shapes from the story's Open questions, and every `REFUSAL` reason;
  - the refusal-carries-address and retire cases;
  - both orders in `standingEdge`, including the same-id resolution upgrade;
  - revoke-before-version, and the hex-case and first-`d` cases;
  - a purity guard over `src/lib/tagging-edges/`, modelled on `test/event-tagging-core.test.js:234-252`.

  Fixture pubkeys are fake 64-hex, as in that suite.
- **BIBLE (AC-5):**
  - **§6:** a new `#### Social Graph Relationships (NostrUser → NostrUser)` after `#### Infrastructure` (the last
    `####` under `### Relationship Types`).
    - `FOLLOWS` (kind 3), `MUTES` (kind 10000) and `REPORTS` (kind 1984) are listed by direction and source kind
      only.
    - `TAGS` is described in full: source kind 39999 with a `nostr-user-tag` stamp; identity; the property table;
      the standing and revoke rules; that an absent stance counts as apply, with the `coalesce` bucketing; "raw
      assertion — no trust or counts; filter per POV at read time"; and its §30 class, event-projection state
      re-derivable from the relay.
    - A plain status line: *no pipeline writes `TAGS` yet* (story 2 adds the gap-filling pass, story 3 the
      real-time path). Pointers to `src/lib/tagging-edges/` and this ADR.
  - **§21 Glossary:** a `TAGS` row distinguishing it from `HAS_TAG` / `NostrEventTag`, which carry nostr tag
    arrays.
  - **§30:** append `TAGS` to the coverage status line (BIBLE.md:1838).
  - Prepend a `Last updated:` entry (lint L9). No §16 entry: nothing user-visible ships, and story 2 adds one.
  - **Wording trap:** `test/assistant-attention.test.js:681-688` fails if BIBLE text outside the Last-updated line
    says "the canonical definitions" or "canonical tag definitions". Say "the canonical `nostr-user-tag` stamp".
- **ADR 0009:** add one line under its header, "**Narrowed (2026-09-26):** Decision 1 is superseded for the
  write-side projection of `nostr-user-tag` assertions into Neo4j `TAGS` edges only, by `tagging-edges/0001`;
  read-time normalization is unchanged." This goes in the ADR commit, not the implementation.
- **Unchanged:** `src/api/profile-tags/`, `src/api/event-tags/`, `src/lib/event-tagging/`, the follows pipeline,
  firmware, UI, and `protocols/`.

## Clarifications (Test Design, 2026-09-27)

Test Design validated the suite against a blind reference implementation and mutation testing. That work found
places where this ADR left a detail open. They are settled here, each by the rule the ADR already states, so the
Implementer and the tests agree. Ratified by the owner at the Test Design gate (2026-09-27):

1. **A supplied tag element is an event, so it passes the step-1 event check.** Its `id` and `pubkey` must be
   lowercase 64-hex (the hex-case rule), or the element is unusable and the record stays unresolved. The resolved
   `tagAddress` is therefore always lowercase in its pubkey segment.
2. **`tagSlug` is everything after `39999:<pubkey>:`** in `tagAddress`, and equals the tag element's `d` even when
   that `d` contains `:`. "Last segment" / "last part" above mean this.
3. **`a` values are normalized before they are counted.** Each well-formed `a` has its pubkey segment lower-cased
   first, the same as `p` and `e`, so two `a` values that differ only in pubkey case are one tag. Only the pubkey
   segment is lower-cased; the slug keeps its case.
4. **Empty results are explicit.** `superseded` and `droppedTarget` are `null` whenever no version is superseded or
   no target is dropped. `revokeTargets` returns arrays. A step-1 refusal (`not-an-event`, `wrong-kind`, `no-d`)
   carries no `address` / `eventId` / `createdAt` / `from` keys.
5. **`revokeApplies` with an edge that is not an object** returns `{ applies: false, … }` and never throws.
6. **`standingEdge(null, null)`** returns `standing: null`, `changed: false`, reason `no-incoming`.
7. **"Pure" also excludes `new Date` and any use of `process`**, beside the `Date.now()` / `Math.random()` / I/O /
   crypto / logging already listed. The purity guard judges code, not comments.
8. **A missing or empty pubkey option matches nothing for the `:tag` stamp too** (step 5), as it does for the
   `:nostr-user-tag` stamp (step 2).

**Review round (2026-09-27), ratified by the owner at the Review gate:**

9. **The identity `d` is the first `d` strfry indexes.** strfry skips a `d` longer than 255 bytes and files the event
   under the next `d` (`events.cpp:48`, :59-62, :282-286). Step 1 skips such `d` tags the same way, so a version the
   relay stored under a later `d` gets that address and can retire or replace the edge there.
10. **The version order works whatever numeric type `createdAt` has.** It compares with `>` / `<` and falls to the
    event id only on a tie, so a `createdAt` read back from Neo4j (a driver Integer or a BigInt) orders the same as
    a JS number, for numeric types. *(Amended by `tagging-edges/0002`.)* A `createdAt` that is missing, `null`, a string, NaN, a float or
    a boolean is not ordered safely: JS and Cypher compare such values differently. The gap-filling pass never
    orders a stored `createdAt` to decide a write and repairs any that is not an integer; any writer that orders
    stored edges must first guard `standsOver` against such values.
11. **A supplied element resolves only if its `id` is the `e` the tagging names.** Any error while reading the
    element counts as absent, so the tagging stays unresolved rather than being refused.
12. **Address patterns match any character after the second colon**, line terminators included (the `s` flag), for
    tagging `a` values and for revoke addresses alike.
13. **An event with an upper-case `id` or `pubkey` stays outside the contract** (NIP-01). strfry accepts such an
    event and can replace or delete by it, so a version like that neither retires nor revokes an edge here; story
    2's sweep, which reads the relay's current state, removes the edge instead, reported as `not-on-relay`
    (`tagging-edges/0002`).

## Out of scope

- Writing `TAGS` to Neo4j:
  - the uniqueness constraint and index on `TAGS.address` / `TAGS.eventId`;
  - the conditional-write Cypher guard and its parity test;
  - writer-set provenance properties;
  - whether NostrUser ends are created on write;
  - how tag elements and kind-5 events are fetched.

  All of that is story 2. Settled by `tagging-edges/0002`: the `tags_address` constraint, with no `TAGS.eventId`
  index (story 3 adds one if it needs it); the lock–re-read–verify guard and its parity test; writer-set properties
  (none); ends created on write by a bare keyed `MERGE`; tag elements fetched by `:tag` stamp in the same scan as the
  taggings; kind 5 not fetched.
- The real-time transport (story 3) and the control panel (story 4).
- Changing any reader's polarity, tie-break or `e` handling (the 0009 Phase-2 cleanup).
- Importing tag elements as nodes (OPEN.md #136 stage 2).
- Registering relationship types in firmware.
- NostrUser→NostrEvent edges.
