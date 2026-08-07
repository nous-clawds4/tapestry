# ADR 0007: Brain-first tapestry authoring via a post-import publish hook

**Status:** Accepted
**Date:** 2026-08-04
**Story:** `engineering-team/stories/tapestries/7-brain-first-tapestry-authoring.md`

## Context

Story tapestries #7 requires every tapestry authoring write to be brain-first (BIBLE §30): the element exists in Neo4j, the letter is published to strfry, the node carries a `tapestryKey` with a derived LMDB doc, and the authored JSON adds `word` alongside `tapestry` + `graph`. ACs: both signing modes reach both stores by flow completion (AC1/AC2); the letter carries all three sections, schema-valid, no surface regression (AC3); derived doc retrievable via the tapestry-key API (AC4); add/remove edits keep the stores agreeing (AC5).

**The load-bearing discovery: all three authoring flows already converge on one server seam.** Create (`ui/src/pages/tapestries/useCreateTapestry.js:54`), add-a-concept (`ui/src/pages/tapestries/AddConceptToTapestry.jsx:67,81`), and take-a-concept-out (`ui/src/pages/tapestries/RemoveConceptFromTapestry.jsx:57,71`) each publish either as the TA (`POST /api/strfry/publish`, `signAs:'assistant'`, owner-403-gated) or with the owner's key (NIP-07 sign → `publishOrThrow` → `publishToLocalStrfry` → the **same endpoint** with `signAs:'client'`, `ui/src/utils/nostrPublish.js:47-50`). The handler is `handlePublishEvent` (`src/api/strfry/commands/publishEvent.js:21-86`); `strfry import` verifies signatures on ingest.

**Constraints:**

- Client-signed publishing through this endpoint is **deliberately permissionless** (ADR security-auth-exposure/0002; comment at `publishEvent.js:31-35`). A brain-write hook must therefore be **author-scoped** — importing *anyone's* tapestry letters into the brain is stage-2 ingest (OPEN.md #136), which carries provenance questions (self-ontology story 2) this story must not preempt.
- TA pubkey and owner pubkey are runtime-resolved, never hardcoded: `getOwnerAssistantPubkey()` (`src/utils/assistantKeys.js`), `getOwnerPubkey()` (`src/utils/config.js:84`).
- Existing machinery, verified live during architecture: `importEventDirect(event, uuid)` (exported from `src/api/normalize/helpers.js:64,142-148`) merges the event node + refreshes `HAS_TAG` tag nodes; the derive engine dispatches `ListItem → deriveWord` (`src/lib/derivers/index.js:19`) via `deriveByKey(tapestryKey)` (`src/lib/tapestry-derive.js:111`); the word deriver **preserves** authored `tapestry`/`graph` sections, normalizes `word`, and builds `graphContext` — resolving the parent JSON Schema through the **z-tag** as well as `HAS_ELEMENT` (`src/lib/derivers/word.js:97-113`), so even implicit-only membership derives correctly.
- The tapestry concept's JSON Schema (fetched live from the graph) requires only `tapestry`, with no `additionalProperties` restriction — adding `word` cannot break AC3 validation.
- The add/remove draft builders parse the existing event's JSON and mutate **only** `json.graph` (`ui/src/pages/tapestries/tapestryDraft.mjs:120-171`) — an authored `word` section survives every republish untouched. AC5 needs no client JSON changes.
- Prior ADRs: tapestries/0001's "strfry is the durable source of truth; Neo4j is not trusted" rationale is **superseded by BIBLE §30** and by this ADR's direction — but its *directory read choice* (View Tapestries reads strfry) **stands unchanged** (story: out of scope until the general ingest exists). ADRs 0003/0005/0006's flows are extended server-side only.

## Options considered

### Option A — Post-import hook in the shared publish endpoint (chosen)

After `strfry import` succeeds in `handlePublishEvent`, a scoped helper inspects the verified event: kind 39999 + z-tag equal to `39998:<TA>:tapestry` + author ∈ {TA pubkey, owner pubkey} → import to Neo4j, label, place, stamp `tapestryKey`, derive — all awaited before the response.

- **Pros:** One seam covers create + add + remove × both signing modes (AC5 costs nothing); future authoring surfaces inherit it; runs server-side where the brain lives; fires only on signature-verified events (post-import); "the instance learns the letters it mails" is exactly the §30-shaped behavior, scoped to the owner's own authorship pending provenance.
- **Cons:** A generic endpoint gains domain-specific logic (mitigated: one isolated module, one call site, explicitly documented as the seed stage-2 ingest will generalize/replace). Brain write rides the *local* publish leg — if local import fails but external relays accept, the brain misses it (same failure envelope the local store already has today; `publishOrThrow` tolerates that partial today).

### Option B — Per-flow client-driven brain write

A dedicated endpoint (e.g. "import this tapestry to the brain") called by each UI flow after its publish resolves.

- **Pros:** Publish endpoint untouched; explicit per-flow control.
- **Cons:** Three client call sites now, N call sites forever — every future flow must remember, which is precisely how the letter-only bug grew; the client orchestrates a brain write it shouldn't own; a publish that succeeds while the follow-up call fails silently re-creates the split-brain; AC5 requires touching two more flows. Rejected.

### Option C — Reuse `POST /api/neo4j/event-update` from the client after publish

Zero new server logic (`src/api/neo4j/eventSync.js:312` already imports single events from strfry).

- **Pros:** Cheapest to wire.
- **Cons:** All of Option B's orchestration cons, plus: it re-reads from strfry (write-then-read race), and it covers only the node+tags import — no `ListItem` label, no placement, no `tapestryKey`, no derive, so AC1's Elements-view visibility works but AC4 fails outright. Rejected — though it remains the right *manual* repair tool and the natural seed of stage-2's ingest.

## Decision

**Option A.** The publish endpoint is the only place all six authoring paths (3 flows × 2 signers) already pass through, and §30 says the instance's own letters should update its brain — a scoped post-import hook is that sentence as code. The author allow-list (TA + owner, both runtime-resolved) keeps the permissionless client-publish contract intact for third parties while ending the split-brain for the instance's own authorship.

## Consequences

- **Enables:** AC1–AC5 with zero changes to the add/remove UI flows; a working precedent (guard → import → place → derive) that stage-2's general ingest generalizes by widening the guard and adding provenance.
- **Constrains:** `handlePublishEvent` must await the brain write before responding (the flow-completion bar), lengthening the publish round-trip by a few Cypher calls + one derive; the hook must never turn a successful publish into a failed response (the letter is already accepted — it cannot be unsent), so brain-write failure is *reported* alongside publish success, not conflated with it.
- **Debt / follow-ups:** These brain nodes carry no provenance marking (nothing does — self-ontology story 2); the hook is tapestry-scoped by design and its guard is the thing stage-2 replaces; pre-existing tapestries stay brain-unknown until stage 2 (story: out of scope).
- **Firmware reinstall required?** **No** — no concept definition changes (the schema already tolerates `word`).

## Implementation notes

1. **New file `src/api/strfry/tapestryBrainWrite.js`** — export `async function maybeBrainWriteTapestry(signedEvent)`:
   - **Guard (return `null` fast):** `signedEvent.kind === 39999`; has a `z` tag whose value === `` `39998:${getOwnerAssistantPubkey()}:tapestry` ``; `signedEvent.pubkey` ∈ {`getOwnerAssistantPubkey()`, `getOwnerPubkey()`}. Never hardcode either pubkey (CLAUDE.md).
   - `uuid = 39999:${signedEvent.pubkey}:${dTag}` (d-tag from tags; skip if absent).
   - `await importEventDirect(signedEvent, uuid)` (require from `../normalize/helpers`).
   - Label + slug: `SET e:ListItem`, `e.slug` = parsed json `word.slug || tapestry.slug` when present (mirror `src/api/normalize/index.js:1865-1873`).
   - Placement: resolve the superset once — `MATCH (h:ListHeader {uuid: $tapestryHandle})-[:IS_THE_CONCEPT_FOR]->(sup)` — then `MERGE (sup)-[:HAS_ELEMENT]->(e)`. Idempotent on republish (AC5). (Prune-safe: firmware's transitive-reduction only deletes a direct superset edge when a longer class-thread path exists; tapestry has no subsets.)
   - `tapestryKey`: `SET e.tapestryKey = coalesce(e.tapestryKey, $fresh)` with `crypto.randomUUID()`, read back the winning key (§29 convention: assigned once, never changed).
   - `await deriveByKey(key)` (require from `../../lib/tapestry-derive`; `ListItem → deriveWord` preserves `tapestry`+`graph`, adds `word`+`graphContext`).
   - Return `{success, uuid, tapestryKey, derived}`; on internal error return `{success: false, error}` — never throw across the publish response.
2. **Modify `src/api/strfry/commands/publishEvent.js`** — promisify the `strfry import` exec; on import success: `const brainWrite = await maybeBrainWriteTapestry(signedEvent);` then respond `{success: true, event: signedEvent, ...(brainWrite ? {brainWrite} : {})}`. Response stays backward-compatible (existing callers read only `success`/`event`).
3. **Modify `ui/src/pages/tapestries/tapestryDraft.mjs`** — `buildTapestryDraft` composes `const word = {slug, name: cleanTitle, wordTypes: ['word']};` and the json tag becomes `JSON.stringify({word, tapestry, graph})`. Add/remove builders: **no change** (passthrough verified). Update the module docstring's wire-shape description.
4. **No changes** to `useCreateTapestry`, the add/remove flow components, `ConceptElements`, or any read surface.
5. For the Tester's lane (Phase 3, not implementation): the hook is drivable end-to-end via `POST /api/strfry/publish` on the local stack (assistant path exercises the owner/localTrusted gate; client path with a locally-signed throwaway key exercises the allow-list *rejection* branch — a third-party event must publish fine and produce **no** brain node).

## Out of scope

- The general strfry→Neo4j letter ingest and any peer/provenance semantics (OPEN.md #136 stage 2; self-ontology story 2).
- Backfill of the two pre-existing tapestries; flipping View Tapestries off strfry (stands per ADR 0001).
- Reconciling the external-relays-succeeded/local-failed partial-publish envelope (pre-existing, unchanged).
- The LMDB completeness doctrine (OPEN.md #137).
