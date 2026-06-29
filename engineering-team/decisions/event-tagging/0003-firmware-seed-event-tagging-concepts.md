# ADR 0003: Seed the event-tagging DList concepts in firmware

**Status:** Proposed
**Date:** 2026-06-26
**Story:** `engineering-team/stories/event-tagging/3-firmware-seed-event-tagging-concepts.md`

## Context

The event-taggings protocol (Story 1, `protocols/drafts/event-taggings.md`) and the Story-1 core compose two firmware-seeded DList concept handles: `39998:<TA>:nostr-event-tag` (the list of event taggings) and `39998:<TA>:tagging-with-specific-tag` (the per-tag tagging-header type, carrying the spec's `recommended: a` / `allowed: e` member-reference rule). Neither exists yet (concept-graph at `:8877` shows `tag`/`nostr-user-tag` but neither new handle). This story seeds them — the epic's first concept-definition change, so a **firmware reinstall** is required.

Facts established from the firmware code:

- **TA binding is runtime.** `src/firmware/install.js` composes header UUIDs as `39998:${taPubkey}:${slug}` (`:368`, `:768`) with the runtime TA, and publishes headers via `/api/strfry/publish` (`:1093`). The concept **files** (`concept-header.json`, `json-schema.json`) carry no pubkey — they are TA-agnostic; the deployment's own TA signs/anchors them at install. So "authored by the deployment's own TA" is automatic.
- **`communityReference.headerATag` is the federation pointer.** It carries a *literal* canonical/curator pubkey + relay hints (+ optional `knownGoodEventId`) (`manifest.json:326`) used to fetch the shared canonical header and link the local concept to it via a `b`-tag (`install.js:1011–1137`). The tag family (`tag`/`nostr-user-tag`/`tag-pinning`) uses it to federate around the legacy canonical pubkey `82b75e47…973833` (ADR 0015). **Operator decision (2026-06-26): event-tagging concepts federate the same way** — so they get a `communityReference` too, pointing at the same canonical authority. (`knownGoodEventId` is optional: without it `install.js:1025` fetches the canonical by `authors:[curator] + #d`.)
- **The firmware concept format supports an `x-tapestry` extension block** — `install.js:176` passes the full `conceptHeader` as `conceptHeaderOverrides` "for extra fields (e.g., x-tapestry)" into `/api/normalize/create-concept`. `tag-pinning` and `nostr-user-tag` already use `x-tapestry.neo4j.nodeLabelRequired`.
- **But `x-tapestry` does NOT reach the published header as wire tags.** `handleCreateConcept` (`src/api/normalize/index.js:1244–1263`) builds the kind-39998 header with a **fixed** tag set (`d`, `names`, `slug`, `concept-graph`, `json`, `description`); `conceptHeaderOverrides` are merged only **inside the `json` blob tag** (`:1239,:1259`), as a Neo4j property — not as top-level event tags. So to put the spec's `["recommended","a"]`/`["allowed","e"]` **on the wire**, the publish seam must emit declared extra header tags — a small, contained extension to that one function (it already emits a fixed list; this adds "spread the concept's declared extra tags").
- **Existing TA-authored DList concepts live only in `firmware/versions/v1.0.0/concepts/`** (each: `concept-header.json` + `json-schema.json` + `manifest.json`, registered in `versions/v1.0.0/manifest.json`). The `versions-grapevine/` track carries only `tag`/`tag-type` — not this family.
- **The d-tag/handle slug comes from the manifest entry's explicit `slug`** (`install.js:175` `dTag: slug`), independent of `oNames`. So the wire-critical handle is whatever `slug` we register.

## Options considered

### Concept location / track

**Option A — `firmware/versions/v1.0.0/concepts/`, mirroring `nostr-user-tag`, WITH a `communityReference` → the canonical authority (recommended).** Two new concept dirs registered in `versions/v1.0.0/manifest.json`; TA-agnostic files; the **runtime TA anchors the local concept** at install, and a `communityReference.headerATag = 39998:<canonical 82b75e47…>:<slug>` federates it to the shared canonical (mirroring `nostr-user-tag`).
- **Pros:** Mirrors the exact home + shape *and federation* of the sibling DList concepts — event-taggings aggregate around the canonical authority like pubkey-tags (operator decision). The concept *files* still carry no pubkey; the canonical literal lives only in the manifest pointer (same place + same value the tag family already uses). Grapevine track untouched.
- **Cons:** Extends the ADR-0015 canonical-literal exception to two more concepts (a deliberate wire commitment — see Consequences). On the canonical/dev deployment (runtime TA == canonical) the pointer resolves to self (harmless).

**Option B — also seed in `versions-grapevine/`.** Rejected: that track doesn't carry `tag`/`nostr-user-tag`/`tag-pinning`; adding only the event-tag concepts there would be inconsistent and serves no current consumer.

**Option C — runtime-TA only, no `communityReference` (deployment-local).** Rejected by the operator (2026-06-26): it makes event-taggings **per-deployment islands** that don't federate — inconsistent with how pubkey-tags work (where prod taggings point back at the canonical concept). The federation-friendly-but-not-enforced model (local island + canonical pointer; a deployment may later splinter) is the chosen direction.

### Expressing `recommended: a` / `allowed: e`

**Option D — literal `["recommended","a"]` / `["allowed","e"]` tags on the published kind-39998 header (recommended, operator decision 2026-06-29).** Match the spec's wire example exactly: the seeded `tagging-with-specific-tag` header carries the rule as top-level event tags, so any third-party implementation reads it straight off the event. Requires the small publish-seam extension above (teach `handleCreateConcept` to emit a concept's declared extra header tags).
- **Pros:** Spec == wire. A generic implementer (the whole point of the NIP) sees the rule with no Tapestry-specific parsing. The cost is contained — one function, mirroring the fixed tags it already emits.
- **Cons:** A few lines of server code in this story (not pure-firmware), and a Test-Design assertion against the *published event*, not just the Neo4j node.

**Option E — `x-tapestry` block only (Neo4j property / inside the `json` blob).** Rejected by the operator: the rule would not appear as a clean wire tag, so the published header diverges from the spec — bad for the interop the NIP exists to enable. (`x-tapestry.neo4j.nodeLabelRequired` is still used for its actual purpose.)

**Option F — only prose in the description.** Rejected: not machine-discoverable as a structured rule.

## Decision

**Option A + Option D.** Seed both concepts under `firmware/versions/v1.0.0/concepts/`, mirroring `nostr-user-tag`'s three-file shape, registered in `versions/v1.0.0/manifest.json` **with** a `communityReference` pointing at the canonical authority (so they federate). Emit the member-reference rule as **literal `["recommended","a"]` / `["allowed","e"]` tags on the published kind-39998 header** (spec-wire fidelity), via a small extension to the concept-publish seam. Reinstall firmware; verify against **the published header event** (and the concept-graph API at `:8877`).

This is the **firmware half** of federation; the **wire half** is ADR 0001 (amended 2026-06-26): publishers emit one concept `z` per namespace via the core's `taPubkeys` list (`[canonical, local]` to federate, `[own]` to splinter). Together: each deployment seeds a **local** concept under its runtime TA *and* bridges to the **canonical** concept via the `communityReference` `b`-tag, while assertions carry both the canonical and local concept `z`-tags. Federation is opt-in and unenforced (worksheet W1 owns the canonical-identity choice).

Rationale: it reuses the established firmware pattern *and its federation* exactly, so event-taggings aggregate around the same canonical authority as pubkey-tags (operator decision). The concept files stay identity-free; the canonical literal lives only in the manifest pointer — the same place and value the tag family already uses. The wire-critical values are the manifest `slug`s, set to exactly `nostr-event-tag` and `tagging-with-specific-tag` to match the core's composed handles.

## Consequences

- **Enables** event taggings and per-tag tagging headers to aggregate into the concept graph (the foundation for Story 4's read API). Without this, `z`-references to these handles resolve to nothing.
- **Firmware reinstall required? YES.** After adding the files, run the reinstall (AGENTS.md §6: `POST /api/firmware/install`) so the concepts land in Neo4j and their headers publish. On the local dev stack (now running) this is how Test/Implement verify.
- **Cross-story consistency (content):** Story 1 sets event-tagging assertion `content` to `''` (empty). So `nostr-event-tag`'s `json-schema` must **not require** content — a permissive schema (no required content payload) keeps empty-content assertions valid. Flagged below.
- **Wire-critical slugs:** the manifest `slug` fields are embedded in published `z` handles by the Story-1 core; they must be exactly `nostr-event-tag` / `tagging-with-specific-tag` (not the `oNames`-derived `nostr-event-tagging`). Getting these wrong silently breaks discovery.
- **Spec-wire fidelity is now a hard requirement (not a verify-item):** the published `tagging-with-specific-tag` kind-39998 header MUST carry literal `["recommended","a"]` and `["allowed","e"]` tags, asserted against the actual event. This pulls a **small server change** into this story — extending `handleCreateConcept` (`src/api/normalize/index.js`) to emit a concept's declared extra header tags (it already emits a fixed `d`/`names`/`slug`/… set; this spreads a declared list). Scope grows from pure-firmware to firmware + a contained publish-seam tweak.
- **Identity rule:** the concept *files* carry no pubkey; the local concept is anchored under the runtime TA. The **one** literal is the `communityReference.headerATag` canonical pointer — a deliberate **extension of the ADR-0015 canonical-pubkey exception** (which today enumerates `tag`/`nostr-user-tag`/`tag-pinning`) to `nostr-event-tag` + `tagging-with-specific-tag`, so they federate around the same authority. This is a wire commitment, not a stray hardcode: it is the canonical-namespace value, in the same manifest slot the tag family uses. A reviewer who sees it should read it as intentional federation, paired with the runtime-TA local seed.
- **Splinter path:** because the local concept is seeded under the runtime TA and assertions carry the local `z` too, a deployment can later drop the `communityReference`/canonical `z` and operate as its own island — no migration of the local concept needed (consistent with the "unenforced" model).

## Implementation notes

### Files (mirror `firmware/versions/v1.0.0/concepts/nostr-user-tag/`)

**`firmware/versions/v1.0.0/concepts/nostr-event-tag/`**
- `concept-header.json` — `word` (`concept-header-for-the-concept-of-nostr-event-tags`, wordTypes `["word","conceptHeader"]`); `conceptHeader` with `description` (an event that applies a specific Tag to a specific event, referenced by `e` or `a`; permissionless; aggregated per-POV), `oNames` `{singular:"nostr event tagging", plural:"nostr event taggings"}`, matching `oSlugs/oKeys/oTitles/oLabels`, and `x-tapestry": { "neo4j": { "nodeLabelRequired": true } }`.
- `json-schema.json` — permissive: top-level object, **`required: []`**, an optional `nostrEventTag` object documenting (for forward-compat) the target reference and `polarity`, but not required (assertions carry empty content per Story 1).
- `manifest.json` — `{"HAS_ELEMENT":[],"IS_A_SUPERSET_OF":[]}` (no seeded elements/supersets), mirroring `nostr-user-tag/manifest.json`.

**`firmware/versions/v1.0.0/concepts/tagging-with-specific-tag/`**
- `concept-header.json` — same shape; `oNames` `{singular:"tagging with specific tag", plural:"taggings with specific tags"}`; `description` = the type whose members are per-tag tagging headers, each pointing at its Tag via `a` (preferred) or `e`; `x-tapestry": { "neo4j": { "nodeLabelRequired": true } }`; **and a declared set of literal header tags** so the published kind-39998 header carries the rule on the wire (spec fidelity):
  ```json
  "headerTags": [ ["recommended", "a"], ["allowed", "e"] ]
  ```
  (field name is the Implementer's choice as long as the seam reads it; `headerTags` is the suggested convention.)
- `json-schema.json` — permissive (members are tagging-headers, content empty).
- `manifest.json` — empty relationships as above.

**Publish-seam extension — `src/api/normalize/index.js` `handleCreateConcept`**
- After building `headerTags` (`:1244`), spread any extra tags the concept declares (e.g. `conceptHeaderOverrides.headerTags`) onto the header `tags` before `signAndFinalize` (`:1263`). Each entry is a `[name, ...values]` tag array. Keep it generic (any future concept may declare extra header tags), and skip the declaring field from the `json`-blob merge set so it isn't double-encoded. ~5 lines, mirroring the existing fixed-tag emission.

### Registration — `firmware/versions/v1.0.0/manifest.json`

Add two entries mirroring the `nostr-user-tag` block (`:316–333`), **with** a `communityReference` pointing at the canonical authority (the legacy literal the tag family already federates around) and the same relay hint:
```json
{ "slug": "nostr-event-tag", "dir": "./concepts/nostr-event-tag/",
  "conceptHeader": "concept-header.json", "jsonSchema": "json-schema.json",
  "categories": ["tag", "nostr"],
  "communityReference": {
    "headerATag": "39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:nostr-event-tag",
    "relayHints": ["wss://dcosl.brainstorm.world"] } },
{ "slug": "tagging-with-specific-tag", "dir": "./concepts/tagging-with-specific-tag/",
  "conceptHeader": "concept-header.json", "jsonSchema": "json-schema.json",
  "categories": ["tag", "nostr"],
  "communityReference": {
    "headerATag": "39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:tagging-with-specific-tag",
    "relayHints": ["wss://dcosl.brainstorm.world"] } }
```
`slug` is wire-critical (above). `knownGoodEventId` is intentionally omitted — install fetches the canonical by `authors + #d` (`install.js:1025`); it can be backfilled after the canonical header is first published. On the canonical/dev deployment the pointer resolves to its own freshly-seeded header (self-reference, harmless). No changes to existing entries.

### Reinstall + verify (Test/Implement, against the running stack)
- `POST /api/firmware/install` (AGENTS.md §6).
- `GET /api/concept-graph/summaries` → both handles `39998:<TA>:nostr-event-tag` and `39998:<TA>:tagging-with-specific-tag` present.
- **Fetch the published `tagging-with-specific-tag` kind-39998 header event** (e.g. scan strfry by `authors:[TA] #d:[tagging-with-specific-tag]`) → its `tags` include literal `["recommended","a"]` and `["allowed","e"]`. This is the spec-fidelity assertion; the Neo4j node check is secondary.
- Existing concepts (`tag`, `nostr-user-tag`, …) still resolve (regression).

## Out of scope

- The read API over these concepts (Story 4); the write path / UI (Stories 5–6).
- **Backfilling `knownGoodEventId`** and any operational sync of the canonical headers to the federation relay — a rollout detail, not this story's seeding.
- A per-deployment **config knob to choose/override the canonical namespace** (the full "splinter or pick your own canonical" UX) — future; this story wires the default federation (local + canonical pointer). The canonical-identity question is worksheet W1.
- Changes to `tag`/`nostr-user-tag`/`tag-pinning` or their schemas.
- Revisiting Story 1's empty-`content` decision (the schema here is permissive to match it).
