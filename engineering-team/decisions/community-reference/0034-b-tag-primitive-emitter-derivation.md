# ADR 0034: the shared `b`-tag primitive — emitter + edge derivation + stub retirement

**Status:** Proposed
**Date:** 2026-06-17
**Story:** `engineering-team/stories/community-reference/38-b-tag-primitive-emitter-derivation.md`
**Builds on:** `community-reference` ADR 0030 (communityReference v2 — seed, not stub; fixed points 2/3/4 are the target install semantics this ADR wires), ADR 0029 (the `pointer`|`inherit` type registry; the derivation gate; pointer = zero consensus weight), ADR 0027 (the `b` write primitive), ADR 0005/0008 (the deployed stub + Phase-A superset link this ADR's emitter supersedes as the affiliation *expression*).
**Wire spec:** `protocols/drafts/inherit-from.md` (normative `b` tag shape + the type-gated derivation contract).
**Citation hygiene:** ADR ids are epic-scoped — an unrelated `0034` may exist on another epic/branch; cite this decision as **community-reference ADR 0034** with the epic-scoped path. `82b75e47…` appearing in this ADR is the ADR-0015 legacy *coordinate* (the dev-box TA pubkey, which is also the local instance's TA here), never a hardcoded signing key.

## Context

ADRs 0027/0029/0030 ratified — **on paper only** — a redesign of how a firmware-blessed affiliation is expressed. Today (`src/firmware/install.js` → `pass_communityReferences`, ~line 998) install materializes an invisible, off-wire, Neo4j-only `(localHeader)-[:REFERENCES {source:'firmware-community'}]->(communityHeader)` stub (the MERGE is at `src/firmware/install.js:1221-1226`, `SET r.source = 'firmware-community'`). The target redesign: firmware **publishes the affiliation as the TA's own signed, revocable `b` tag** on the concept header, and the graph **derives** the edge from that published event — the same way every other tag-derived relationship is built.

This is a **build, not a port**: verified across origin branches there is no `b` emitter, no `b`→edge derivation, and `INHERITS_FROM` appears in zero `src/` files. The only concept carrying a `communityReference` today is the dev-ground pilot `nostr-relay` (manifest `firmware/active/manifest.json:225-227`, `headerATag = "39998:919ba08af778…2a7ee2ff:nostr-relay"`). Its local TA header is `39998:82b75e47…:nostr-relay` (confirmed live in the concept graph). **This story touches no manifest entries** — that is the "stub trap" (handoff §3): adding `communityReference` entries against pre-primitive install code deploys the stub, not the `b`. Manifest edits are Story 3.

### Concepts touched (no schema change)

- `39998:82b75e47…:nostr-relay` — the local TA-authored **nostr-relay** header. Its affiliation expression moves from the `firmware-community` Neo4j-only stub to a published `["b", "39998:919ba08a…:nostr-relay", "pointer"]` tag → derived `REFERENCES {source:'b-tag'}` edge. No production concept (`tag`/`nostr-user-tag`/`tag-pinning`/Communities) is touched.
- The `b` tag primitive itself — newly given a working emitter + derivation. No concept *definition* (schema, header `json`) changes; the header gains one wire tag, not a new property.

### Key constraints (from CLAUDE.md, the handoff §5, and the wire spec)

1. **Never seed `inherit` from firmware.** Pointer carries zero consensus weight (ADR 0029 §4). An `inherit` seed would fake the W1 deliberate-deference signal and subscribe every deployment to the curator's future edits. The emitter seeds `"pointer"` only; the *derivation* must still handle both types (registry-correct), because operators may publish `inherit` by hand.
2. **Type-gate on explicit `"inherit"`, never on "not pointer."** Absent element 3 reads as `"pointer"` (wire spec `:41`, ADR 0029 §2). A sloppy/untyped `b` must derive the *pointer* form.
3. **No manifest edits** — `firmware/active/manifest.json` stays byte-identical (AC-8; verify by diff).
4. **Per-deployment TA pubkey — never hardcode.** The TA authored the header and is the only key that can re-sign it. The emitter signs through the existing runtime TA key path (`helpers.js` `loadTAKey()`/`signAndFinalize()`, backed by `getOwnerAssistantKeys()` → secure storage). `firmware.getTAPubkey()` (runtime, `assistantKeys.getOwnerAssistantPubkey()`) is already used throughout `pass_communityReferences` to compute the local header uuid. The `82b75e47…` in the manifest `headerATag`'s *peer* is the **community curator** coordinate (`919ba08a…` for nostr-relay), not a signing key.
5. **No new lint/build tooling** (JS-without-build).

### What `buildImportCypher` does and does NOT do (the crux)

`src/api/neo4j/eventSync.js` → `buildImportCypher(event)` (`:175-266`) materializes an event and creates a `(:NostrEventTag {type:'b'})` node linked via `(header)-[:HAS_TAG]->(tag)`. But it builds derived `REFERENCES` edges **only for `e` and `a` tags** (`:231-258`), and those are *tag-level* `(:NostrEventTag)-[:REFERENCES]->(:NostrEvent)` edges — **not** the *header-level* `(child:ListHeader)-[:REFERENCES {source}]->(target)` edge the story requires. So the `b`→**header-level**-edge derivation is genuinely new code; it does not exist anywhere today and `buildImportCypher` will silently drop the `b` into a tag node with no consequential edge unless we add the derivation.

## Options considered

### SEAM 1 — where the `b`→edge derivation lives (OQ-2)

#### Option 1A — derive inside `buildImportCypher` (`src/api/neo4j/eventSync.js:213-259`), as a third tag branch alongside `e`/`a` (chosen)

Add a `else if (tag[0] === 'b' && tag[1])` branch that, for a kind-39998/39999 header, emits a **header-level** statement: parse element 3; explicit `"inherit"` → `MERGE (child)-[:INHERITS_FROM]->(parent)` (no `source`); else (`pointer`/absent) → `MERGE (child)-[:REFERENCES]->(target) SET r.source = 'b-tag'`. `child` is the event's own node (uuid = its a-tag); `target` is the `b` value (a-tag), MERGE-created as a naked `:NostrEvent {uuid}` if absent (same `ON CREATE` pattern the `a` branch already uses at `:253-254`).

*Pros:* `buildImportCypher` is **the** single strfry→Neo4j import primitive — it already runs on (a) fresh-install foreign-header import (`install.js:1052`, `:1080`), (b) the local header via `importEventDirect`/create-concept, and (c) ongoing single-event sync. Hooking here means the derivation fires on **both fresh install and ongoing sync** for free (answers OQ-2 directly), with no new dispatch site. The `e`/`a`→REFERENCES precedent is right there to mirror. Registry-correct in one place.
*Cons:* `buildImportCypher`'s existing `e`/`a` REFERENCES are tag-level (`NostrEventTag`→ref); the `b` edge is header-level (event-node→target), so the branch is structurally a *little* different from its neighbors (it MATCHes `e` the event node, not `t${i}` the tag node) — must be written carefully so a reader doesn't assume symmetry. The header-level vs tag-level distinction must be commented.

#### Option 1B — a dedicated post-derive pass in `install.js` (mirror the existing REFERENCES-wiring block at `:1208-1255`)

Read each seeded header's `b` tag and wire the edge in a new `install.js` loop, exactly as the stub MERGE block does today.

*Pros:* keeps `eventSync.js` untouched; lives next to the stub it replaces; trivially scoped to install.
*Cons:* **does not fire on ongoing sync** — only on firmware install. Operator-published `b` tags (the registry-correct `inherit` case, and any post-install re-point) would never derive an edge. That defeats "the graph derives from published events like every other tag-derived relationship" (the whole ADR-0030 thesis) and re-creates the install-only coupling the stub had. The story explicitly asks for derivation that "runs on both fresh install and ongoing sync" (OQ-2). Rejected.

#### Option 1C — a standalone derivation module called from both install and the sync path

A new `deriveBTagEdges(event)` helper imported by both `buildImportCypher`'s caller and the eventSync update path.

*Pros:* clean separation; testable in isolation.
*Cons:* introduces a second dispatch point that must be wired into every place events enter Neo4j — exactly what `buildImportCypher` already centralizes. More surface, more ways to miss a call site, for no gain over 1A. Rejected (1A gets the same "runs everywhere" property by extending the existing centralizer).

**Decision: Option 1A.** The derivation belongs in `buildImportCypher` because that function is the single chokepoint every event already flows through — install-time foreign import, local-header import, and ongoing single-event sync — so one branch there satisfies "derive on install *and* sync" with the least new surface and the clearest precedent (`e`/`a`).

### SEAM 2 — how the emitter republishes the local header (the EMITTER)

#### Option 2A — scan the live local header from strfry, append the `b`, re-sign with the TA key, republish (chosen)

In `pass_communityReferences`, after the existing fetch/pin-verify of the *community* header, also fetch the **local TA header** (`39998:<taPubkey>:<slug>`) from local strfry via `GET /api/strfry/scan?filter={"kinds":[39998],"authors":[taPubkey],"#d":[slug]}`. Never-clobber check: if its `tags` already contain **any** `["b", …]`, skip (suppress the seed). Otherwise build a new template = the live header's `kind`/`content`/`tags` with `["b", cr.headerATag, "pointer"]` appended, **re-sign with the TA key** (the existing `signAndFinalize` path — `helpers.js:43-51`, key via `loadTAKey()`/`getOwnerAssistantKeys()`), republish to strfry (`/api/strfry/publish`, already used at `install.js:1051`), and import via `buildImportCypher` (which now — Seam 1 — derives the edge).

*Pros:* re-signs from the *current* published header (preserves whatever tags the live header carries — names/slug/json/concept-graph), so the seed is purely additive and never drops operator edits. Uses only existing helpers (`signAndFinalize`, `/api/strfry/publish`, `buildImportCypher`) — no new signing or publish machinery. The never-clobber check reads the live event, honoring ADR 0030 fixed point 3 ("any existing `b`, any type, any target, suppresses the seed"). Idempotent: second run sees the `b` it wrote and skips.
*Cons:* requires a local strfry scan the stub never did; if the local header is somehow absent (it isn't — pass1 created it before `pass_communityReferences` runs), the emitter must skip gracefully. One more fetch per `communityReference` concept (one concept today).

#### Option 2B — reconstruct the header from the manifest/concept definition and sign a fresh one

Rebuild the header tags from the firmware concept JSON (as create-concept does at `index.js:1244-1263`) plus the `b`, and sign that.

*Pros:* no local scan; deterministic from firmware.
*Cons:* re-derives the entire header from scratch, risking divergence from the live published header (drops any operator-applied edits, any tags create-concept didn't originate). Heavier coupling to the header-build internals. The never-clobber check would still need to read the live header anyway (you can't know if a `b` exists without reading it), so this saves nothing and adds a divergence channel. Rejected.

#### Option 2C — reuse the foreign-event passthrough path the stub uses (`/api/strfry/publish` with no re-sign)

The stub publishes the *community* header unchanged (`install.js:1051`, "you cannot sign someone else's event"). Reuse that path for the local header.

*Cons:* the *local* header is the TA's own — appending a `b` **requires** re-signing (the id/sig change). The passthrough path is for foreign events specifically because they can't be re-signed; it's the wrong tool here. The emitter must sign. Rejected — but noted because it clarifies *why* the emitter is a new signed-publish, not the stub's passthrough.

**Decision: Option 2A.** Re-sign from the live header so the seed is additive and never-clobber reads real state, using only existing helpers.

## Decision

We chose **Option 1A** (derivation in `buildImportCypher`) and **Option 2A** (emitter re-signs the live local header), implementing ADR 0030 fixed points 2/3/4 and ADR 0029 §3, with these fixed points:

1. **EMITTER (pointer-only, idempotent, never-clobber).** In `pass_communityReferences`, for each `communityReference` concept: after the existing community-header fetch + optional `knownGoodEventId` pin-verify, fetch the local TA header; **if it carries any `b` tag, skip** (never-clobber); else append `["b", "<cr.headerATag>", "pointer"]`, re-sign with the TA key, republish, and import. **Never seed `inherit`.**
2. **DERIVATION (registry-correct, type-gated).** `buildImportCypher` gains a `b`-tag branch: explicit `"inherit"` (element 3 `=== 'inherit'`) → `(child)-[:INHERITS_FROM]->(parent)` (no `source`); everything else, **including absent element 3** → `(child)-[:REFERENCES {source:'b-tag'}]->(target)`. Direction child→target, **no flip** (wire spec `:46`). The gate keys on the explicit string `'inherit'` — never "not pointer."
3. **STUB RETIRED for `b`-carrying headers.** The post-derive REFERENCES-wiring block (`install.js:1211-1231`) must **not** MERGE `REFERENCES {source:'firmware-community'}` for a header that now carries a `b` (the edge derives from the published event as `source:'b-tag'`). Pre-existing `firmware-community` stub edges are **not removed** by this story (AC-7) — they stay legacy-but-harmless under the `source`-filtered collision contract (ADR 0029 §3, BIBLE §22). The IS_A_SUPERSET_OF wiring (`install.js:1233-1253`) is **untouched** (OQ-3).

### Open-question resolutions

- **OQ-1 (fetch-failure behavior).** **The seed proceeds from the manifest `headerATag` literal even when the community-header fetch or pin-verify fails.** Rationale: the seed needs only the `headerATag` literal (local to the manifest) plus the *local* TA header (local to strfry); the remote fetch + `knownGoodEventId` pin are the anti-lever that gate **materializing the foreign community node + the superset link**, not the pointer-`b` seed. A `"pointer"` carries zero consensus weight and grants no deference, so seeding it without verifying the remote is safe — it is a bookmark to a coordinate, exactly what the literal is. This honors §22's graceful-install principle (ADR 0030 fixed point 1: "log-and-continue when absent") and does **not** contradict fixed point 2's "mismatch → log + skip" — that skip governs the *foreign-node materialization* path (don't import a node whose id you couldn't verify), while the local pointer-seed proceeds. **Crisp rule:** the pointer-`b` is seeded whenever (the local header exists) AND (it carries no `b`); the community-header/superset materialization remains gated on a successful, pin-verified fetch as today. A fetch failure logs, skips the foreign materialization, and still seeds the local `b`. (Note: when the foreign node isn't materialized, the derived `REFERENCES {source:'b-tag'}` edge MERGE-creates a naked target node by uuid — the same `ON CREATE` behavior the `a`-tag branch already relies on at `eventSync.js:253-254`; this is correct, the target node fills in if/when it later syncs.)
- **OQ-2 (where the derivation hooks in).** `src/api/neo4j/eventSync.js` → `buildImportCypher` (`:175-266`), a new `b`-tag branch in the tag loop (alongside `e` at `:231` / `a` at `:241`). Because `buildImportCypher` is the single strfry→Neo4j import primitive invoked on fresh-install import (`install.js:1052`/`:1080`), local-header import (`importEventDirect`/create-concept), and ongoing single-event sync, the derivation runs on **both install and sync** with no new dispatch site.
- **OQ-3 (ADR-0008 superset link unaffected).** Confirmed. Only the `REFERENCES` *expression* changes (stub → derived `b`-tag edge). The community-Superset fetch/materialize (`install.js:1063-1090`) and the `IS_A_SUPERSET_OF` MERGE (`install.js:1233-1253`) are not modified. `nostr-relay`'s `(localSuperset)-[:IS_A_SUPERSET_OF]->(communitySuperset)` link is untouched.
- **OQ-4 (firmware reinstall to verify).** **Yes.** The emitter runs inside `pass_communityReferences`, which only executes during install. Verification recipe: `POST /api/firmware/install` on this instance (carries the `nostr-relay` `communityReference`), then assert: (a) the local header event `39998:<taPubkey>:nostr-relay` carries `["b","39998:919ba08a…:nostr-relay","pointer"]` (`strfry scan '{"kinds":[39998],"authors":["<taPubkey>"],"#d":["nostr-relay"]}'`); (b) Cypher `MATCH (c {uuid:'39998:<taPubkey>:nostr-relay'})-[r:REFERENCES]->(t) RETURN r.source` returns `'b-tag'`; (c) **no** `REFERENCES {source:'firmware-community'}` edge is freshly MERGEd from that header in this run; (d) re-run install → still exactly one `b` tag, one edge, header not re-published (idempotent + never-clobber). No concept *definition* changed, so the reinstall is to exercise the emitter, not to refresh schemas.

## Consequences

- **Enables** the affiliation map to be **on-wire, cross-deployment-visible, and operator-revocable** (re-point the header's `b`, no firmware surgery) — the W1 substrate. Unblocks Story 3 (dual-z writer + per-concept manifest seeds), which depends on this primitive landing first.
- **Constrains:** `buildImportCypher` now produces a header-level `REFERENCES`/`INHERITS_FROM` edge for any `b` it sees — every `REFERENCES` consumer must filter on `source` (already binding; ADR 0029 made it a third producer class). The never-clobber rule means a deployment that re-points and later wants the firmware default back must remove its `b` manually (re-seeding is suppressed by design).
- **New debt / follow-ups:** a sweep to clean pre-existing `firmware-community` stub edges (deferred, AC-7). The ADR-0008 superset-link promotion to a wire form (flagged in ADR 0030 fixed point 7; not this story). Story 3's manifest entries + dual-z writer.
- **Firmware reinstall required?** **Yes — to verify** (OQ-4). Not because a concept *definition* changed (none did — the header gains a wire tag, not a schema/property), but because the emitter only runs during install; the local verification path is reinstall-then-inspect.

## Implementation notes

Concrete sites (line numbers as of this reading; re-locate by quote if drifted). Reuse existing helpers only — no new signing/publish/build tooling.

### 1. Emitter — `src/firmware/install.js` → `pass_communityReferences` (~`:998-1106`)

After the community-header fetch + pin-verify (`:1030-1043`) and independent of the superset block, add the local-header seed (the existing graceful `try/catch` already wraps the loop body):

- **Fetch the live local header:** scan local strfry —
  `await apiGet('/api/strfry/scan', { filter: JSON.stringify({ kinds:[39998], authors:[taPubkey], '#d':[slug] }) })` — take `events[0]` as `localHeader`. (`taPubkey` is already in scope at `:1001` via `firmware.getTAPubkey()`.)
- **Skip if absent** (defensive — pass1 created it): log + continue the local-seed step; do not throw.
- **Never-clobber check (exact shape):**
  `const hasB = Array.isArray(localHeader.tags) && localHeader.tags.some(t => t[0] === 'b');`
  `if (hasB) { console.log('… b already present — seed suppressed (never-clobber)'); }` — skip the republish (this is also the **idempotency** mechanism: a second install sees the `b` it wrote on the first and suppresses).
- **Else seed:** build template from the live header and append the pointer-`b`:
  `const newTags = [...localHeader.tags, ['b', cr.headerATag, 'pointer']];`
  re-sign + publish + import using helpers already imported/used in this module:
  - re-sign via the same TA-signing primitive create-concept uses (`signAndFinalize({ kind: 39998, content: localHeader.content || '', tags: newTags })`, `src/api/normalize/helpers.js:43-51` — TA key from `loadTAKey()`/`getOwnerAssistantKeys()`; **never a literal**). If `pass_communityReferences` cannot reach that helper directly from `install.js`, expose a thin `POST /api/normalize/republish-header` (or equivalent existing signed-publish route) and call it via `apiPost` — Tester/Implementer to confirm the cleanest existing seam; **do not introduce a new signer**.
  - publish: `await apiPost('/api/strfry/publish', { event: signed })` (as at `:1051`).
  - import (triggers the new derivation): `await executeCypher(buildImportCypher(signed))` (as at `:1052`).
- **OQ-1:** this whole local-seed step is **independent of the community-header fetch result** — it runs even if `!ev` (the `:1036` "not found" path) or the pin mismatch path (`:1040`). Restructure so the community-fetch-failure `continue` does not skip the local seed (e.g. seed before the foreign-materialize block, or hoist the seed out of the `if (ev)` guard). The Implementer must preserve graceful behavior: any error in the seed logs and continues.

### 2. Derivation — `src/api/neo4j/eventSync.js` → `buildImportCypher` (`:213-259`)

Add a third tag branch after the `a` branch (`:241-258`). **This edge is header-level — `child` is the event node `e` (the header), not the `t${i}` tag node** (unlike the `e`/`a` branches which build `(:NostrEventTag)-[:REFERENCES]->`):

```
} else if (tag[0] === 'b' && tag[1]) {
  const targetUuid = tag[1];                 // the target a-tag
  const bType = tag[2];                      // element 3; may be undefined
  const isInherit = bType === 'inherit';     // type-gate on EXPLICIT 'inherit' only
  // child = this event's own node (uuid = its a-tag for replaceable kinds)
  if (isInherit) {
    refStatements.push(
      `MATCH (child:NostrEvent {uuid:'${esc(uuid)}'}) ` +
      `MERGE (parent:NostrEvent {uuid:'${esc(targetUuid)}'}) ` +
      `MERGE (child)-[:INHERITS_FROM]->(parent)`            // no source
    );
  } else {                                   // pointer OR absent → REFERENCES{source:'b-tag'}
    refStatements.push(
      `MATCH (child:NostrEvent {uuid:'${esc(uuid)}'}) ` +
      `MERGE (target:NostrEvent {uuid:'${esc(targetUuid)}'}) ` +
      `MERGE (child)-[r:REFERENCES]->(target) SET r.source = 'b-tag'`
    );
  }
}
```

- `uuid` is already computed at `:179` (`<kind>:<pubkey>:<dTag>` for replaceable kinds — the header's a-tag). For kind-39999 carriers it is likewise the item's a-tag.
- Type-gate is `bType === 'inherit'` — **explicit**; absent/`'pointer'`/anything-else falls to the `REFERENCES` branch. **Never** write `bType !== 'pointer'`.
- MERGE makes both the seed and re-runs **idempotent** — exactly one edge regardless of run count (AC-5).
- The `b` tag also still becomes a `(:NostrEventTag {type:'b'})` via the existing loop body (`:227-229`) — harmless; only the header-level edge is consequential.

### 3. Stub retirement — `src/firmware/install.js` post-derive block (`:1208-1255`)

In the REFERENCES-wiring loop (`:1211-1231`), **gate the `firmware-community` MERGE on the absence of a seeded `b`**. Simplest: have the emitter record on each `pending` entry whether it seeded/observed a `b` (`link.seededB = true` when the header carries a `b` after the emitter step), then:
`if (link.seededB) { /* edge derives from the published event; skip stub MERGE */ }` else run the existing `MERGE … SET r.source='firmware-community'` (`:1221-1226`) unchanged (back-compat for any concept that somehow has a `communityReference` but no seedable header).
- **AC-7:** do **not** delete pre-existing `firmware-community` edges here.
- **OQ-3:** leave the `IS_A_SUPERSET_OF` block (`:1233-1253`) and the superset fetch/materialize (`:1063-1090`) untouched.

### 4. Testability hooks (per handoff §4)

- **Published header carries pointer-`b`:** scan `{"kinds":[39998],"authors":["<taPubkey>"],"#d":["nostr-relay"]}`; assert exactly one `["b","39998:919ba08a…:nostr-relay","pointer"]`.
- **`REFERENCES{source:'b-tag'}` edge exists:** `MATCH (c {uuid:'39998:<taPubkey>:nostr-relay'})-[r:REFERENCES]->(t) RETURN r.source` → `'b-tag'`.
- **No `firmware-community` stub for that header (fresh):** assert no edge with `r.source='firmware-community'` is MERGEd from that header in the run (pre-existing ones may remain — AC-7).
- **Idempotent + never-clobber:** run install twice → one `b`, one edge, header not re-published on the second run; pre-set a foreign-target `b` by hand → seed suppressed.
- **Derivation unit (registry-correct):** feed `buildImportCypher` a synthetic header with `["b",X,"inherit"]` → `INHERITS_FROM` (no `source`); with `["b",X,"pointer"]` and with `["b",X]` (absent) → both `REFERENCES{source:'b-tag'}`.
- **Stub-test migration:** `nostr-relay`'s existing `community-reference-nostr-relay-stub` tests move their assertion from `source:'firmware-community'` to `source:'b-tag'` (dev ground — no prod impact).

## Out of scope

- **Manifest entries for the real tag concepts** + the **dual-z writer (W11)** — Story 3 (the stub trap; depends on this primitive).
- **The resolved-definition READ primitive** (live inherit-resolution walk; ADRs 0028/0032) — pointer-typed tags don't resolve, so the read-walk isn't needed here. This is the `b` *write* + *edge derivation* only.
- **Cleanup/migration of pre-existing `firmware-community` stub edges** (AC-7 keeps them legacy-but-harmless; a sweep is future work).
- **The ADR-0008 Phase-A superset-link promotion** to a wire form (ADR 0030 fixed point 7; design-only).
- **Securing/burning the canonical `82b75e47…` key** (deferred; not Half 2).
