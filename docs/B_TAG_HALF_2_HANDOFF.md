# Tag federation — HALF 2 handoff (the dual-z completion: local z + b-tag map)

_Authoritative handoff for the second half of the tag-federation epic. Written 2026-06-17 so a
fresh agent (post context-clear) can pick this up cold. Read this start to finish before touching
firmware, the writer, or the manifest._

> **One-paragraph orientation.** The product goal is: tags/taggings visible and working on every
> `*.brainstorm.world` instance. **Half 1** (epic `tag-federation` Story 1) ships that *visibility*
> by federating + read-unioning the **canonical z** events already carry — no firmware/wire change.
> **Half 2 (this doc)** completes the *concept-graph-correct* "dual-z" model: events also carry a
> **local z**, and each instance's **local concept header carries a `b` tag** pointing to the one
> canonical header. Half 2 is **purely additive** on Half 1 — nothing in Half 1 gets reworked.

---

## 1. The dual-z model (the destination — "David's model", ratified in principle)

**Per event** (a tag-element or a tagging assertion): two `z` tags —
- **canonical z** → `39998:82b75e47…:<slug>` — network-wide identity; makes the tag visible on
  every instance. **Events already carry this today** (single-z, ADR-0015). Half 1 federates it.
- **local z** → `39998:<thisInstanceTA>:<slug>` — membership in *this* instance's own concept;
  populates the local concept-graph list (fixes the orphan) and roots the tag "here". **NEW in Half 2.**

**Per concept header**: a **`b` tag**, `["b", "39998:82b75e47…:<slug>", "pointer"]`, on the
*local* header → the *canonical* header. The **map**: trace each instance's local concept back to
the one canonical definition. **NEW in Half 2.**

Ratified basis: dual-z = the multi-z carve-out (ADR community-reference/0029 §6; full stamping
practice is worksheet **W11**, *not yet designed*). local→canonical `b` = ADR
community-reference/0030 ("communityReference v2 — seed, not stub"), pointer type from ADR 0029.

Roles, stated once so they don't get muddled:
| z / tag | lives on | role |
|---|---|---|
| canonical z (`82b75e47…`) | each event | universal visibility/identity — **Half 1 already ships this** |
| local z (`<instanceTA>…`) | each event (Half 2) | this instance's own concept membership; local list populates |
| `b` tag (pointer) | each local concept **header** (Half 2) | maps local concept → canonical concept |

**Existing data note:** today's tags carry the canonical z only. After Half 2's writer change,
*new* events get both z's; *old* events stay canonical-only. So old tags stay visible everywhere
(canonical z) but won't retroactively appear in the *local* list. No migration needed for the goal.

---

## 2. State of the world (verified 2026-06-17 across origin branches)

- **The b-tag primitive is DESIGN-ONLY EVERYWHERE.** No emitter, no resolver, no edge-derivation,
  `INHERITS_FROM` in zero `src/` files — confirmed on `feat/communities` and every other origin
  branch. There is **nothing to port**; Half 2 is a **build**.
- **Install still does the legacy STUB.** `src/firmware/install.js` → `pass_communityReferences`
  (~line 998) materializes a Neo4j-only `MERGE …REFERENCES… SET r.source='firmware-community'`
  (~line 1223). This is the thing ADR 0030 retires.
- **Only `nostr-relay` carries a `communityReference`** in the manifest today (its stub pilot →
  `39998:919ba08a…:nostr-relay`). `nostr-relay` is a **throwaway dev test ground** — not prod, not
  meaningful — so it's the safe place to exercise the primitive (no migration to protect). The
  **real prod concepts** are `tag` / `nostr-user-tag` / `tag-pinning` and the Communities concepts.
- **Canonical bundles are already on dcosl.** Full header+aux bundles for `tag` (7 ev),
  `nostr-user-tag` (8), `tag-pinning` (8) — authored by `82b75e47…`, on `wss://dcosl.brainstorm.world`.
  So the install-pass fetch target already exists.
- **Wire spec:** `protocols/drafts/inherit-from.md` (normative). Governing ADRs:
  `engineering-team/decisions/community-reference/{0027,0029,0030}.md`. Background investigation:
  `docs/B_TAG_SHAPE_STATE_AND_PLAN.md`.

---

## 3. ⚠️ The stub trap (do not skip)

**Do NOT add `communityReference` entries to `firmware/active/manifest.json` until the b-tag
emitter is built.** Today's `pass_communityReferences` materializes the legacy
`REFERENCES{source:'firmware-community'}` stub for *any* manifest concept carrying a
`communityReference`. Adding entries for the tag concepts against pre-primitive install code
deploys the **stub**, not the b-tag — on real instances. Build the emitter + derivation FIRST
(Story 2), THEN add manifest entries (Story 3).

---

## 4. Half 2 = two stories

### Story 2 — the shared b-tag primitive (build the foundation)

Implements ADR 0030 §2/§4 + ADR 0029 §3. Generic over any manifest concept with a
`communityReference`; exercise/prove it on `nostr-relay` (the dev ground); **no manifest edits**.
Three parts:

1. **EMITTER** (in `pass_communityReferences`, `src/firmware/install.js`): for each manifest
   concept carrying a `communityReference`, after fetch + optional `knownGoodEventId` pin-verify,
   **republish the TA-authored local header with `["b", "<headerATag>", "pointer"]` appended**
   (TA-signed; **idempotent**; **never-clobber** — skip if the header already carries any `b`).
   Replaces the stub-as-expression role.
2. **DERIVATION** (Pass-3 / eventSync): materialize a header's `b` tag into a Neo4j edge —
   `pointer` (or absent type) → `(child)-[:REFERENCES {source:'b-tag'}]->(target)`; `inherit` →
   `(child)-[:INHERITS_FROM]->(parent)` (no `source`). Build registry-correct even though firmware
   only seeds `pointer`. **Type-gate on explicit `"inherit"` — absent reads as `pointer` (never
   gate on "not pointer").**
3. **RETIRE THE STUB** for b-carrying headers: don't MERGE the `firmware-community` stub when a `b`
   is present (the edge derives from the published event); pre-existing stubs stay legacy-but-
   harmless (consumers filter on `source`).

**Out of scope for Story 2:** the resolved-definition READ primitive — the live inherit-resolution
merge/closure walk (ADRs 0028/0032, wire spec §"resolved definition"). Story 2 is the `b` *write*
primitive + the *edge derivation* only; pointer-typed tags don't participate in resolution, so the
read-walk isn't needed for the firmware-pointer-seed use.

Testability: after install with a `communityReference` concept (nostr-relay), assert (a) the
published header carries the pointer-`b`, (b) a `REFERENCES{source:'b-tag'}` edge exists, (c) no
`firmware-community` stub for that header, (d) idempotent + never-clobber. `nostr-relay`'s existing
stub tests (`community-reference-nostr-relay-stub`) move from `source:'firmware-community'` to
`source:'b-tag'` (no prod impact — dev ground).

Open questions for Story 2's architect: does a *fetch failure* (no pin) block the seed or proceed
(the `headerATag` literal is in the manifest regardless)? Where exactly does the `b`→edge
derivation live relative to existing Pass-3/eventSync? Is `nostr-relay`'s ADR-0008 superset link
unaffected (it should be — only the `REFERENCES` expression changes)?

### Story 3 — dual-z writer + per-concept seeds (apply the model to the tag concepts)

Depends on Story 2 landing. Two parts:

1. **Dual-z writer (W11 — NEEDS DESIGN FIRST).** The tag/tagging writer
   (`ui/src/utils/publishProfileTag.js` and the tag-element creation path) stamps **two** `z`
   tags: the existing canonical (`82b75e47…:<slug>`) **and** the local
   (`<thisInstanceTA>…:<slug>`). W11 ("cloud formation / multi-z stamping rules") is the
   *undesigned* practice — design it as part of this story (which coords, ordering, interaction
   with the ADR-0022 hybrid e+a `a`-tag we already ship). Existing single-z events are not migrated.
2. **Per-concept `communityReference` seeds.** Add `communityReference { headerATag:
   "39998:82b75e47…:<slug>", relayHints:["wss://dcosl.brainstorm.world"], knownGoodEventId:<id> }`
   to `firmware/active/manifest.json` for `tag` / `nostr-user-tag` / `tag-pinning`. **Only after
   Story 2** (stub trap). Capture each `knownGoodEventId` from the bundles already on dcosl so
   install pins the right header. Reinstall firmware → headers gain pointer-`b` → derive the edge →
   the local concept-graph list populates and lineage is explicit.

After Story 3: the local `…<instanceTA>…:nostr-user-tag` list (today an orphaned empty header)
populates with locally-authored taggings, each local header points to its canonical header, and
the `/tapestry` concept browser is correct on every instance. **The tag UI / visibility from Half 1
is unchanged** — this is concept-graph correctness, layered on.

---

## 5. Guardrails / invariants (don't violate these)

- **Canonical authority key `82b75e47…`** is the ADR-0015 legacy literal (= the dev-box TA). It's
  the canonical coordinate for the tag concepts. There is a separate, deferred decision about
  *securing or burning* that key (see `docs/B_TAG_SHAPE_STATE_AND_PLAN.md` discussion) — **not part
  of Half 2**; Half 2 just references the coordinate.
- **POV-first / decentralization-first** (CLAUDE.md) — unchanged by Half 2. The `b` pointer carries
  **zero consensus weight** (ADR 0029) and breaks the affiliation chain; it's a bookmark, not
  deference. Never seed `inherit` from firmware (it would subscribe every deployment to the
  curator's future edits and fake the consensus signal — the whole reason ADR 0029 added `pointer`).
- **`communityReference` field stays** (ADR 0030 §1): it remains the home for the literal +
  `relayHints` + optional `knownGoodEventId` pin + the ADR-0008 superset-link driver. Its *role*
  changes from "materialize the stub" to "seed the published `b`".
- **No new lint/build tooling** (CLAUDE.md). Firmware reinstall (`POST /api/firmware/install`)
  required after Story 3's manifest change.

## 6. Pointers

- ADRs: `engineering-team/decisions/community-reference/0027-inherit-from-tag-b.md`,
  `…/0029-b-type-registry.md`, `…/0030-communityreference-seed-not-stub.md`
- Wire spec: `protocols/drafts/inherit-from.md`
- Stub install pass: `src/firmware/install.js` → `pass_communityReferences` (~998; stub MERGE ~1223)
- Tag writer (gets the second z in Story 3): `ui/src/utils/publishProfileTag.js`
- Half 1 story: `engineering-team/stories/tag-federation/1-tags-visible-across-environments.md`
- Epic: `engineering-team/epics/tag-federation.md`
- Background: `docs/B_TAG_SHAPE_STATE_AND_PLAN.md`
