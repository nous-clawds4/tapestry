# ADR 0002: Seed the pointer-`b` map on the three tag concepts (apply the primitive)

**Status:** Proposed
**Date:** 2026-06-17
**Story:** `engineering-team/stories/tag-federation/2-per-concept-b-tag-seeds.md`
**Builds on:** `community-reference` ADR 0034 (the b-tag primitive — emitter + derivation + stub-retire; DONE and merged on this branch), `community-reference` ADR 0030 (the `communityReference {headerATag, relayHints, knownGoodEventId}` shape and retained functions), ADR 0015 (the `LEGACY_*` named-exception concepts and their literal `82b75e47…` coordinate).
**Citation hygiene:** ADR ids are epic-scoped — an unrelated `0002` may exist on another epic. Cite this as **tag-federation ADR 0002**. Every `82b75e47…` in this ADR is the ADR-0015 legacy *coordinate* (a DATA literal in the manifest), never a hardcoded signing key.

## Context

`community-reference` ADR 0034 built the generic b-tag primitive and merged it on this branch (`feat/b-tag-primitive`): the emitter (`src/firmware/install.js` → `pass_communityReferences`, `:1001`), the derivation (`src/api/neo4j/eventSync.js` → `buildImportCypher`, the `b` branch at `:258-276`), and the stub-retire gate (`install.js:1261-1266`, `seededB`). It was proven on the throwaway `nostr-relay` dev ground — **with no manifest edits beyond `nostr-relay`'s own** (the "stub trap": adding `communityReference` entries against pre-primitive code would deploy the stub, not the `b`; that trap is now defused because the emitter is present here).

This story is the **apply** step: add a `communityReference` block to the three real ADR-0015 named-exception tag concepts — `tag`, `nostr-user-tag`, `tag-pinning` — so that after reinstall each instance's **local** TA header gains a `["b", "39998:82b75e47…:<slug>", "pointer"]` tag pointing at the **canonical** header, and the graph derives the `REFERENCES {source:'b-tag'}` lineage edge. The code already handles all of this; the only new artifact is **manifest data**. This is the "map" half of the dual-z model (Part A); it does not populate the local concept *list* with activity — that is the dual-z writer (Story 3, Part B), additive on this.

### Concepts touched (no schema change)

All three are confirmed in the live concept graph as TA-authored headers (`/api/concept-graph/node/39998:82b75e47…:<slug>`), and on this dev box the local TA pubkey (`/api/assistant/pubkey`) equals that coordinate — `82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833`. Each header's live event id matches its story-supplied `knownGoodEventId` exactly (verified live, see OQ-2):

- `39998:82b75e47…:tag` — canonical header id `6f38f7b7748cbece9f75d131f0c79392cc01fc24cac8a7bdd11a9fc9f24e6fd0`. Local TA-authored. Pin target + (on this box, identical) local header.
- `39998:82b75e47…:nostr-user-tag` — canonical header id `7df925f78f7f416429b52d558712f1a33d018170a3558706024140199dfe7893`. Local TA-authored.
- `39998:82b75e47…:tag-pinning` — canonical header id `69d36397d92c086b5c184840f5af91ad89ab2f7718fcc674418a0b80074c1eef`. Local TA-authored.

No header `json`, schema, or property changes — each header gains **one wire tag**, exactly as `nostr-relay` did under ADR 0034.

### Constraints

- **The manifest template is `nostr-relay`** (`firmware/active/manifest.json:225-230`): `communityReference { headerATag, relayHints }`. The three new blocks must match that shape, adding the optional `knownGoodEventId` (ADR 0030 fixed point 1: verified when present, log-and-continue when absent).
- **ADR-0015 named exception.** These three slugs are exactly the named-exception concepts whose handles are intentionally bound to the literal `82b75e47…` coordinate. The `headerATag` literal here is consistent with — and required by — that exception. It is a *coordinate string in data*, not a signing key, so the "never hardcode the TA pubkey" rule does not apply (see Interaction check).
- **Verify on the local stack — `feat/b-tag-primitive` does NOT auto-deploy anywhere** until merged. (Auto-deploy is per-target: `staging`→staging.brainstorm.world, `feat/pubkey-tagging-target`→tags.brainstorm.world; *this* branch reaches no env until a merge.) The live reinstall behavior needs a running stack, so verify locally; nothing here touches a live env before then.
- No new lint/build tooling (JS-without-build).

## Options considered

### Option A — three explicit per-concept `communityReference` blocks, matching the `nostr-relay` template, each with `relayHints:["wss://dcosl.brainstorm.world"]` + the verified `knownGoodEventId` (chosen)

Add the block to each of the `tag` (`:300-308`), `nostr-user-tag` (`:309-318`), and `tag-pinning` (`:319-327`) manifest objects. Identical shape to `nostr-relay`, plus the pin. The emitter, derivation, and stub-gate already consume this field — no code change.

*Pros:* Per-concept explicit entries are exactly what ADR 0030 fixed point 5 ratified (mixed curators possible, no slug-derivation dependency). Mechanical, reviewable as data, zero new code surface. Pins included so AC-6's verify-and-skip path is actually exercised (rather than silently degrading to the no-pin log-and-continue path). The blocks differ only in `headerATag` slug + `knownGoodEventId`, so they read uniformly.
*Cons:* Pins are point-in-time (captured 2026-06-17); a canonical re-publish before this ships would mismatch (handled — see OQ-1; the pointer-`b` still seeds, only foreign-materialization skips).

### Option B — omit `knownGoodEventId`, ship `{headerATag, relayHints}` only (exact `nostr-relay` parity)

Drop the pin; rely on ADR 0030's "log-and-continue when absent."

*Pros:* No staleness risk; nothing to re-capture; byte-for-byte the proven `nostr-relay` shape.
*Cons:* Loses the install-time anti-lever entirely — the foreign community header would materialize with **no** id verification, the exact risk `knownGoodEventId` exists to guard (ADR 0030 fixed point 1c). The story's AC-1 explicitly requires the three verified `knownGoodEventId`s, and AC-6 requires exercising the mismatch path — both impossible without the pin. Rejected: it discards a ratified safety lever to dodge a non-fatal staleness case that AC-6 already handles gracefully.

### Option C — one shared `communityReference` factored out / slug-derived

Derive `headerATag` from the slug and share one block.

*Cons:* ADR 0030 fixed point 5 deliberately chose **per-concept explicit** entries (O9 slug-derivation stays dormant) so curators can differ per concept and the manifest stays declarative-not-computed. There is no factoring mechanism in the manifest format, and inventing one is out of scope for an apply-the-primitive story. Rejected.

## Decision

We chose **Option A**: three explicit `communityReference` blocks, matching the `nostr-relay` template, each carrying `relayHints:["wss://dcosl.brainstorm.world"]` and its verified `knownGoodEventId`. No source change — the primitive (ADR 0034) already consumes the field.

### Exact manifest blocks to add

Insert a `communityReference` member into each of the three concept objects, after their existing `categories` array (mirroring `nostr-relay` at `:222-230`). The concept objects are at `firmware/active/manifest.json` `:300-308` (`tag`), `:309-318` (`nostr-user-tag`), `:319-327` (`tag-pinning`). After the edit each object reads:

**`tag`** (insert after `"categories": ["tag"]`, comma-separated):
```json
            "communityReference": {
                "headerATag": "39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:tag",
                "relayHints": [
                    "wss://dcosl.brainstorm.world"
                ],
                "knownGoodEventId": "6f38f7b7748cbece9f75d131f0c79392cc01fc24cac8a7bdd11a9fc9f24e6fd0"
            }
```

**`nostr-user-tag`** (insert after `"categories": ["tag", "nostr"]`):
```json
            "communityReference": {
                "headerATag": "39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:nostr-user-tag",
                "relayHints": [
                    "wss://dcosl.brainstorm.world"
                ],
                "knownGoodEventId": "7df925f78f7f416429b52d558712f1a33d018170a3558706024140199dfe7893"
            }
```

**`tag-pinning`** (insert after `"categories": ["tag"]`):
```json
            "communityReference": {
                "headerATag": "39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:tag-pinning",
                "relayHints": [
                    "wss://dcosl.brainstorm.world"
                ],
                "knownGoodEventId": "69d36397d92c086b5c184840f5af91ad89ab2f7718fcc674418a0b80074c1eef"
            }
```

The Implementer must add the comma after the preceding `categories` array (currently the object's last member) when inserting. No other manifest member changes; verify the diff touches only these three objects.

### Open-question resolutions

- **OQ-1 (pin freshness) → accept the AC-6 graceful-skip; do NOT block on re-capture, but the Implementer SHOULD re-confirm the three pins are still live on dcosl at implementation time as a cheap freshness check.** Rationale: AC-6 (= ADR 0034 OQ-1) makes a stale pin **non-fatal** — the pointer-`b` is seeded from the manifest `headerATag` literal regardless; only the *foreign community-header materialization* and the superset link skip on mismatch. The pointer carries zero consensus weight (ADR 0029), so seeding a bookmark to a coordinate is safe even if the remote moved. Therefore re-capture is an optimization (it keeps the foreign-materialize path working), not a correctness gate. Recommendation: a one-line scan against dcosl during implementation; if a pin drifted, update that one `knownGoodEventId` and note it in the PR — but never let a mismatch block the ship, because the seed (AC-2/AC-3, the story's actual deliverable) is unaffected.
- **OQ-2 (the three local headers are TA-authored) → CONFIRMED, all three.** Verified live this session via the Concept Graph API: `/api/concept-graph/node/39998:82b75e47…:<slug>` returns each header with `pubkey: 82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833` (the local TA, per `/api/assistant/pubkey`) and `kind: 39998`, and each `id` equals its story `knownGoodEventId` (`tag`→`6f38f7b7…`, `nostr-user-tag`→`7df925f7…`, `tag-pinning`→`69d36397…`). All three are **simple TA-authored headers**, structurally identical to `nostr-relay` (which ADR 0034 already proved the emitter re-signs cleanly). None is built differently — no flag breaks the emitter's re-sign step. **Caveat for the Tester/Implementer:** this was confirmed on the **local dev box**, where the local TA *happens to equal* the `82b75e47…` coordinate, so here the local header and the canonical pin target are the **same event** (a degenerate but valid case — `seededB`/never-clobber still apply, and the derived `REFERENCES` edge is a self-loop from the local header to itself by uuid; this is harmless and idempotent). On a **non-dev deployment** the local TA differs, so the local header is `39998:<thatInstanceTA>:<slug>` and the `b` points at the distinct `82b75e47…` canonical — the non-degenerate map. The Implementer/Tester must verify the seed on the **local** stack (the live reinstall needs a running stack; this branch doesn't auto-deploy) but should reason about the non-dev shape in the test plan.

## Live verification (2026-06-17) — and one finding

Live-verified on the dev container (`docker cp` the branch's `install.js`+`eventSync.js`+manifest → restart → `POST /api/firmware/install` → inspect strfry + Neo4j):

- **All four headers seeded correctly.** `nostr-relay` → `b` `39998:919ba08a…:nostr-relay` (the **foreign** coordinate — a genuine cross-pubkey case on this box, since the local TA is `82b75e47…`); the three tag concepts → `b` `39998:82b75e47…:<slug>`.
- **All four edges derived `REFERENCES {source:'b-tag'}`.** `nostr-relay`'s spans **two distinct nodes** (`82b75e47…`→`919ba08a…`) — proving the non-degenerate local→canonical shape the emitter produces on a real deployment (the tag concepts are self-loops *only* because this dev box's local TA equals the canonical coordinate; the machinery is identical). This is the decisive evidence that the seed will have the correct effect on a live instance with a distinct TA.
- **Stub retired:** log `"REFERENCES derives from published b-tag — firmware-community stub skipped"`; no `firmware-community` edge on any of the four. Superset link (`IS_A_SUPERSET_OF`) intact (OQ-3 confirmed live).

**Finding — never-clobber is within-run-only, not across-reinstall (accepted as defensible).** On a second install the headers were re-published (new event ids) and the emitter logged `"pointer-b seeded"` again, **not** `"seed suppressed"`. Cause: firmware `pass1`/`pass2` rebuild each TA header from the static concept definition (no `b`) *before* `pass_communityReferences` runs, so the emitter always scans a `b`-less header and re-seeds the firmware-default `b`. Consequences: (a) the *outcome* stays idempotent — exactly one `b` and one edge after every install (verified); (b) but ADR 0034 fp1 / ADR 0030 fp3's intent that *an operator's manually re-pointed `b` survives* is **not** achieved across a firmware reinstall — the reinstall reverts to the firmware default. **Decision (requester, 2026-06-17): accept.** A reinstall restoring firmware defaults is defensible; an operator re-pointing a firmware-owned header is inherently fragile. Tracked: `OPEN.md` #8 (incl. a future "updateable firmware" idea) + ADR 0034 should note the within-run-only scope. This is an emitter (Story 38) property surfaced here, not a defect in this story's manifest data.

## Consequences

- **Enables** the affiliation *map* on the three real tag concepts — each instance's local header now carries an on-wire, operator-revocable pointer to the one canonical definition, cross-deployment-visible. Unblocks Story 3 (dual-z writer / list-populating, Part B), which is purely additive on this.
- **Constrains:** once seeded, an operator who wants the firmware default *back* after re-pointing must remove their `b` by hand (never-clobber suppresses re-seeding — by design, ADR 0034 fixed point 1).
- **New debt / follow-ups:** none new beyond what ADR 0034 already flagged (the pre-existing `firmware-community` stub-edge sweep; Story 3). AC-7's David breadcrumb (one-`b`-per-header vs his "two b-tags" phrasing) is a PR-description deliverable, not code.
- **Firmware reinstall required? YES — and this is the *first* reinstall that activates the primitive on real concepts.** Not because any concept *definition* changed (none did — each header gains one wire tag, not a schema/property), but because the emitter only runs inside `pass_communityReferences` during install. Because ADR 0034's emitter + derivation + stub-gate are present on this same branch (verified: `install.js:1001,1041,1261`; `eventSync.js:258`), this is **not a stub trap** — the reinstall publishes the pointer-`b` and derives `source:'b-tag'`, not the legacy stub. **Run the verification reinstall on the LOCAL stack** (`POST /api/firmware/install`) — the live behavior needs a running stack. `feat/b-tag-primitive` does not auto-deploy anywhere; auto-deploy only triggers wherever this eventually merges (`staging`→staging.brainstorm.world, `feat/pubkey-tagging-target`→tags.brainstorm.world), so verify before merging onward.

## Implementation notes

- **File: `firmware/active/manifest.json`** — add the three `communityReference` blocks above into the `tag` (`:300`), `nostr-user-tag` (`:309`), `tag-pinning` (`:319`) concept objects. This is the **only** file changed. No source edits.
- **No code touched.** The consuming code is already on this branch: emitter `src/firmware/install.js:1001` (`pass_communityReferences` — fetch local header `:1046`, never-clobber `:1054`, seed + re-sign `:1059-1064`, `seededB` gate `:1041`/`:1140`); stub-retire `install.js:1261-1266`; derivation `src/api/neo4j/eventSync.js:258-276` (the `b` branch). Do not modify any of these (ADR 0034 owns them).
- **Verify recipe (local, inherited from ADR 0034 OQ-4):** `POST /api/firmware/install`, then per slug assert (a) the local header `39998:<localTA>:<slug>` carries exactly one `["b","39998:82b75e47…:<slug>","pointer"]` (`/api/strfry/scan` with `{"kinds":[39998],"authors":["<localTA>"],"#d":["<slug>"]}`); (b) Cypher `MATCH (c {uuid:'39998:<localTA>:<slug>'})-[r:REFERENCES]->(t) RETURN r.source` → `'b-tag'`; (c) no `firmware-community` stub freshly MERGEd from that header this run; (d) re-run install → still exactly one `b`, one edge, header not re-published (idempotent + never-clobber).

### Interaction check (confirmed safe — touches only the intended path)

- **vs the ADR-0015 `LEGACY_Z_TAG_PUBKEY` z-tag composition (same three concepts):** orthogonal. The `z` is the parent-pointer on *child* tag/apply/dispute/pin events; the `b` is a NEW tag on the *concept header*. Different events, different tag letter, different purpose. The seed appends only a `b`; it never reads or writes a `z`. No collision.
- **vs the ADR-0022 hybrid e+a writer:** orthogonal — that governs `nostr-user-tag` *parent references* on user-tag events, not the concept header. The `b` seed is on the header only.
- **vs the search-is-local gate (tag-federation ADR 0001):** unaffected — this story changes a header's wire tag and a Neo4j edge, not search routing.
- **vs the hardcode rule (CLAUDE.md "NEVER hardcode the TA pubkey"):** the `headerATag` literal is the **ADR-0015 named exception** — these three slugs are exactly the carve-out concepts whose handles are intentionally bound to the literal `82b75e47…` coordinate to preserve historical activity across deployments. The literal is a *data coordinate string in the manifest*, consumed as `cr.headerATag` (a `b`-tag value), never as an `authors:` filter, signer read, or identity check. The emitter resolves the **local** TA pubkey at runtime via `firmware.getTAPubkey()` to build the local-header uuid it re-signs (`install.js`); only the *peer* of the pointer is the literal coordinate. This requires **no new hardcode-rule handling** and is consistent with how `nostr-relay`'s `headerATag` already carries the `919ba08a…` curator coordinate as data. A reviewer should treat these three `headerATag` literals as the sanctioned exception, not a violation.

### Testability (for the Tester)

- **Data-contract (unit-testable, no stack):** parse `firmware/active/manifest.json`; assert the three concept objects each carry a `communityReference` with the exact `headerATag` (the `82b75e47…:<slug>` coordinate), `relayHints === ["wss://dcosl.brainstorm.world"]`, and the exact `knownGoodEventId` per slug. Assert no *other* manifest object gained a `communityReference` (diff scope). This is the bulk of the testable surface and needs no running stack.
- **Behavioral outcome (needs the reinstall-then-inspect live recipe, inherited from ADR 0034 OQ-4):** after `POST /api/firmware/install` on the local stack, per concept the local header carries the pointer-`b` (AC-2), the `REFERENCES {source:'b-tag'}` edge exists (AC-3), and no fresh `firmware-community` stub edge is MERGEd from that header (AC-4). Idempotency/never-clobber (AC-5) = run install twice. AC-6 (graceful-skip on pin mismatch) is exercisable by temporarily pointing one `knownGoodEventId` at a wrong id and asserting the `b` still seeds while foreign-materialization logs-and-skips. These are not pure unit tests — they require the live reinstall recipe.
- **Degenerate-box note for the Tester:** on this dev box the local TA equals the canonical coordinate, so the derived edge is a self-loop and the local header == the pin target; the assertions still hold. The test plan should also describe the non-dev shape (distinct local TA → `b` points at a foreign coordinate) even though it can only be *run* on the local box (the live reinstall needs a running stack).

## Out of scope

- **The dual-z writer (W11) / local concept-list population** — Story 3 (Part B), additive on this.
- **Any change to the b-tag primitive** (emitter/derivation/stub-gate — ADR 0034, done) or to `nostr-relay`.
- **Migrating existing single-z tag events.**
- **Re-parenting these three concepts off the `82b75e47…` literal** (ADR 0015's "eventual full retirement" — a separate epic; the literal stays as the sanctioned data coordinate here).
