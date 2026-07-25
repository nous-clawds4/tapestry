# The Self and Its Stores — Ontology, Provenance, and Backup — Design Handoff

**Status:** 🔴 OPEN
**Partly ratified (2026-07-25, `self-ontology` #1 / ADR 0001):** the settled material now lives in **`BIBLE.md` §30 (The Self and Its Stores)** — §2/§3/§9 as the ratified ontology (plus the "How this relates to principles 1–3" non-repeal), and §4/§5/§6/§8 as *binding obligations, not yet enforced*, each carrying a current-status line. `CLAUDE.md` gained a fourth architecture invariant pointing at §30. **This doc stays OPEN**: the open designs in §4 (provenance representation/migration), §7 (backup mechanics — encryption, key custody, chunking), and §8 (the normalization ⇒ covering conjecture) have **not** landed. They remain this epic's deferred work — see §11 and `engineering-team/epics/self-ontology.md`. Flip to ✅ SUPERSEDED only once they ratify. Where §30 and this doc overlap, **§30 is authoritative**; this doc keeps the reasoning that produced it.
**Created:** 2026-07-24
**Provenance:** Scoped in direct owner conversation (2026-07-24, the session that shipped the tapestry-key await fix + BIBLE §29), not via a `/discuss` subagent — the scoping *was* the conversation. This is the **Capture** step of the Protocol-Spec Workflow (`engineering-team/workflows/protocol-spec-workflow.md`): settled decisions + open questions, recorded so nothing lives only in the transcript. Ratify settled pieces into `BIBLE.md` + ADRs in docs-mode; flip this to ✅ SUPERSEDED once they land.

---

## 1. Why this exists — the unresolved tension

The codebase embodies two models at once:

- **Protocol-first** (CLAUDE.md architecture invariants): signed events are the substrate; neo4j is a per-POV computed *view*; import / normalization / firmware reinstall / reconciliation treat the graph as freely re-derivable from strfry.
- **Brain-first** (second-brain, graph-curation, relationship-primitives): neo4j accumulates **locally-authored state with no event behind it** — the relationship-primitives epic is literally "strfry-free relationship add/delete."

Both are live today, which means rebuild flows built under the first model can silently destroy state that only exists under the second. The owner resolved the tension explicitly on 2026-07-24. This doc records the resolution and its consequences.

## 2. The ontology (SETTLED — owner decision, 2026-07-24)

**Tapestry is, first and foremost, a local-first personal knowledge graph.** The decentralized-protocol layer is real and first-class, but it is not the identity layer.

| Store | Ontological role |
|---|---|
| **neo4j** | **The definitive "me."** Complete, mortal, restorable in full from a neo4j backup. The seat of self. |
| **tapestry LMDB** (`src/lib/tapestry-store.js`, BIBLE §29) | Also "me," but **not a co-equal seat of self** — the brain's cache / working memory, derivable from neo4j. |
| **strfry / nostr events** | **"Letters"** — artifacts *authored by* me (or received from peers). The proof + communication + durability **axis**, not the identity substrate. |

Corollaries, all settled:

- **Derivability ≠ identity.** Events largely sit at the bottom of the *derivation* stack (events → graph → cache), but the derivation axis and the identity axis are different axes. A letter is derivable from me; it isn't me. My brain isn't derivable from my letters.
- **Publishing is optional to selfhood.** A neo4j write without a published event = a private thought. Signing + publishing = writing and mailing a letter. In principle a full Tapestry instance could operate without ever signing a single nostr event.
- **Unpublished brain-state is mortal and box-bound.** That's accepted, not a bug — with the discipline that durability is provided deliberately (backups, §7), not assumed.
- **Events are not demoted.** They remain first-class on their own axis: the only *verifiable, trust-weightable, peer-shareable* form of an assertion. The brain can think privately, but it cannot be trusted by others until it speaks. WoT runs on signatures; nothing here licenses gating peers' events at write time (§9).

## 3. The asserted core — "me minus everything recomputable" (SETTLED framing)

The owner's conjecture: neo4j is (roughly) the most *compact* full representation of the self. Sharpened during scoping: neo4j-as-stored also holds **recomputable** material, so the true minimum — the **asserted core** — is neo4j minus everything recomputable:

Recomputable inventory (grows over time; non-exhaustive):
- **Derived / implicit relationships** — re-materializable from event structure + normalization rules (BIBLE §5–§6, §10).
- **WoT scores** — GrapeRank / influence / verified counts, recomputable from the follow/mute/report graph.
- **JSON Schema documents** — the schema stored for a JSONSchema node is recomputable from a full property tree.
- **All tapestry-LMDB derived JSON** — by definition (§29 cache).

The asserted core is then: locally-authored graph state (published or not), plus received-and-kept assertions, plus non-derivable local bookkeeping. **The compact me is small — and that's a feature**: it is what backups must preserve losslessly (§7) and what rebuilds must never touch (§5). Defining its boundary *is* the provenance model (§4) — same question, two hats.

## 4. The provenance primitive (SETTLED as requirement; OPEN as design)

Every node and edge must be classifiable as exactly one of:

| Class | Meaning | Rebuild policy |
|---|---|---|
| **(a) asserted / locally-authored** | authored here; may or may not ever have been published | **Precious.** Survives every rebuild, reimport, reinstall, reconcile. |
| **(b) event-projection** | materialized from event structure (import, normalization, derive) | **Disposable.** Re-derivable from the local event archive. |
| **(c) peer-received** | a peer's signed assertion, recorded and trust-weighted | Re-derivable from events if the events are retained; trust filtering stays read-time, per POV. |

Without this flag, neither safe rebuilds (§5) nor minimal backups (§7) are possible.

**Open design questions:**
- Representation: property on every node/edge? labels? a separate provenance ledger? (Must survive dumps/restores; must be cheap on the millions-of-edges social graph — probably *default-(b/c) with explicit (a) marking*, since (a) is the small set.)
- Migration: classifying the *existing* graph (heuristics: strfry-free-primitive writes → (a); import/derive writers → (b)/(c); ambiguous residue → owner review?).
- Writer discipline: every write path declares its class (relationship-primitives → (a); stream-consumer/import → (b)/(c); normalization/derive → (b)).

## 5. Rebuild & reconciliation guarantee (SETTLED as requirement)

**Invariant: no pipeline may destroy class-(a) state.** Risk surfaces to audit and harden:

- strfry→neo4j **import** and the stream-consumer ETL
- **Normalization** passes that rebuild derived structure
- **Firmware reinstall** (including `tapestryKey` re-initialization — fresh UUIDs orphan existing LMDB entries)
- **Reconciliation** (`reconciliation-rearchitecture` / `reconciliation-incremental-mode` is the beachhead — its non-destructive posture becomes the *rule*, not an option)
- Dev tooling (`scripts/dev-refresh.sh`, wipes)

Until provenance (§4) exists, the interim rule of thumb: treat any state a rebuild cannot reproduce as precious by default.

## 6. LMDB dual role (SETTLED)

One tool, two non-overlapping purposes, explicitly separated:

1. **Primary, ongoing: low-latency compact cache.** Lossy and partial *by right* — a denormalized read model (single-document reads instead of multi-hop path queries). This is §29's existing role.
2. **Secondary, intermittent: full lossless serialization** — the staging format for backups (§7). Coverage-complete (§8), verifiable, produced on demand; not maintained continuously.

The two can coexist in one LMDB (full serialization + low-latency cache, at the price of compactness), but a given entry/run must be **distinguishable as to which mode produced it** — a cache entry must never be mistaken for backup-grade data. **Open:** mode marking (separate keyspace? envelope flag?) and a **serialization-run manifest** (key set + content hashes + timestamp + graph snapshot identity) so a backup is a verifiable artifact, not a hope.

## 7. Backup routes (SETTLED intent; OPEN design)

| Route | Properties |
|---|---|
| **neo4j dump** | Definitive and complete by decision; opaque; tied to neo4j tooling/versions. |
| **LMDB covering serialization** | Lossless **iff** coverage (§8) holds; doubles as the export/packaging surface. |
| **Encrypted nostr stash** (chosen pipeline) | (1) produce the full lossless serialization into LMDB (§6 mode 2); (2) **chunk + encrypt** it into nostr events; (3) stash on a safe relay (e.g. a mirror relay). Encrypted → privacy preserved; lossless → the self reconstitutable in full at the time and place of our choosing. |

Honest asymmetry (settled): nostr is a full backup **only** via the encrypted-blob pipeline. Publishing the graph as constituent *semantic* events is nostr-native and verifiable but **necessarily lossy for the definitive-me** (class-(a) state has no event form) — by the ontology itself, "I can always reconstruct myself from my published events" is false.

**Open:** encryption scheme (NIP-44-to-self? age?) and **key custody** — the backup of the self is protected by a key that must survive *outside* the self; chunk size vs relay event-size limits; manifest/reassembly event design; which relay(s); retention/rotation; whether the event archive (for (b)/(c) re-derivation) rides along or is assumed from relays.

## 8. Coverage — a first-class concept (SETTLED concept; OPEN property)

**Definition:** a set of derived documents **covers** the graph iff every node and edge is represented losslessly in at least one document and the set reassembles to the graph exactly.

- **Coverage ≠ normalization** (settled). Normalization rules (§10) guarantee the graph's *internal consistency*; they say nothing about whether the *deriver set* captures everything losslessly. Owner's conjecture — error-free normalization makes a concept-graph covering *feasible* — is plausible and **deferred to a future discussion**; it is not assumed.
- **Current gap:** registered derivers cover only concept-graph labels (Set, Superset, ListItem, ListHeader, ConceptHeader, JSONSchema, Property) — not the NostrUser/FOLLOWS/MUTES/REPORTS social graph, which is the bulk of a real instance.
- **Scope-shrinking insight (settled):** with provenance, a full-self backup = **asserted-core serialization + event archive** — classes (b)/(c) re-derive from events, so the covering obligation may bind only on the (small) asserted core, not on millions of social edges. This makes §7 tractable.
- **Second use (forward-looking):** coverage is also the right frame for Alice→Bob *communication* — packaging a covered subgraph for a peer.

## 9. What stays protocol-first (SETTLED)

The architecture invariants are **not repealed** — they govern the event/social axis: accept all signed events (no write-time gating of peers), POV-namespaced trust, filter at view time. A trusted peer's incoming event still often outranks the local graph's current belief — that's what learning from peers *is*; it updates the brain, it doesn't replace it as the seat of self. The multi-tenant caveat stands: on a shared instance, "me" = the **owner-POV slice**; the ontology as written targets the single-owner personal deployment. Ratification should reconcile the CLAUDE.md invariants' framing with this doc via ADR (add the identity axis; change no read/write-time behavior toward peers).

## 10. Consequence map — candidate work (NOT yet stories)

1. **Provenance primitive** (§4) — the gating piece; everything else leans on it.
2. **Non-destructive rebuild/reconcile hardening** (§5) — audit the risk surfaces; make incremental/non-destructive the rule.
3. **Deriver audit + lossless serialization mode + run manifest** (§6, §8).
4. **Backup pipeline** (§7) — serialize → encrypt → chunk → stash → verified restore drill.
5. **Health monitoring** (pre-dates this doc; folds in): orphan nodes; nodes lacking LMDB docs; LMDB docs failing schema validation; staleness (`tapestryJsonUpdatedAt`); coverage drift; provenance integrity once (1) lands. Existing signals to assemble: Health Audit (§9 BIBLE), normalization rules, `/api/tapestry-key/status`, BullMQ scheduler.

Sequencing intuition: (1) → (2) → (3) → (4), with (5) attachable at any point after (1).

## 11. Where we paused / open questions ledger

- Provenance representation, migration, and writer discipline (§4).
- Serialization-mode marking + manifest design (§6).
- Encryption scheme, key custody, chunking, relay choice, retention (§7).
- The normalization⇒covering conjecture for the concept graph (§8) — owner is fairly confident; deliberately deferred.
- Whether the event archive is part of the backup artifact or assumed recoverable from relays (§7/§8).
- Multi-tenant "whose brain" implications beyond the owner-POV answer (§9).
- Ratification order: likely one umbrella ADR for the ontology (§2–§3, §9) first, then per-piece ADRs following the consequence map.
