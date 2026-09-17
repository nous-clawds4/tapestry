# ADR 0001: Ratify the self ontology into the spec

**Status:** Accepted
**Date:** 2026-07-25
**Story:** `engineering-team/stories/self-ontology/1-ratify-the-self-ontology.md`
**Mode:** Docs-mode (Protocol-Spec Workflow phase 3 — Test Design skipped)

## Context

The owner settled Tapestry's identity question on 2026-07-24: **Tapestry is first and foremost a
local-first personal knowledge graph; neo4j is the definitive "me."** The decision and its
consequences live in `docs/SELF_ONTOLOGY_DESIGN_HANDOFF.md` (Status 🔴 OPEN) — a working artifact,
not the canonical spec. This ADR decides **how to ratify** the settled portions into `BIBLE.md` and
`CLAUDE.md`. It introduces no new behavior: no code, no concept/schema change, no wire format.

**Why it matters (the risk being closed).** The codebase holds two contradictory premises. The
always-loaded invariants in `CLAUDE.md` (lines 18–55) present the system as protocol-first — events
are the substrate, neo4j is a computed view — while `relationship-primitives` and the second-brain
work write neo4j state with *no event behind it*. Under the protocol-first premise, a rebuild may
legitimately discard that state. This is a live data-loss risk, not a philosophical preference.

**The hard constraint, inherited from ADR 0033: the section must not present unbuilt behavior as
present.** That constraint bites harder here than it did for PoV, because our material sits at three
different confidence levels rather than two:

1. **True by decision, effective on ratification** — the ontology itself. neo4j is the definitive
   self because we say so; nothing needs to be built for that to be true.
2. **Binding obligations that the system does NOT yet honor** — the provenance taxonomy (no
   representation exists at all), the non-destructive rebuild invariant (today's pipelines *can*
   destroy locally-authored state), the LMDB serialization mode (doesn't exist), coverage (derivers
   cover only concept-graph labels — Set/Superset/ListItem/ListHeader/ConceptHeader/JSONSchema/
   Property — not the NostrUser/FOLLOWS/MUTES/REPORTS graph).
3. **Deliberately open** — provenance representation/migration, backup mechanics (encryption, key
   custody, chunking), the "normalization ⇒ covering" conjecture.

Conflating (1) and (2) would be actively dangerous: a reader who sees *"no pipeline may destroy
locally-authored state"* under a "ratified" heading will believe the system already guarantees it.
It does not. That is a **safety** overclaim, and avoiding it is the central design problem here.

**Additional constraints:**
- `CLAUDE.md` is at **190/190 lines**, its exact cap (`scripts/harness-budgets.txt`). The owner
  explicitly rejected raising the cap; the addition must be paid for by condensing.
- The handoff doc **stays 🔴 OPEN** (unlike ADR 0033's, which flipped to SUPERSEDED) — only part of
  its content ratifies here.
- Concept Graph API was unreachable (local stack down) during both Planning and Architecture. This
  is pure spec touching **no concept-graph domain concepts**, so no handle resolution is required.

## Options considered

### Option A — Two blocks: "Ratified" / "Open" (literal ADR 0033 shape)

Mirror §27's split: everything settled goes in one normative block, open questions in another.

- **Pros:** exactly matches the established precedent; shortest section; one fewer heading.
- **Cons:** collapses confidence levels (1) and (2) into one block. The rebuild invariant and the
  provenance taxonomy would read as present-tense guarantees when neither is implemented. For a
  claim whose whole purpose is *preventing data loss*, a reader mistaking aspiration for enforcement
  is the worst possible failure. Rejected.

### Option B — Three blocks: "The ontology (ratified)" / "Obligations (binding, not yet enforced)" / "Deliberately open"

Structure carries the boundary, as in ADR 0033, but with a third block splitting *true-by-decision*
from *binding-but-unenforced*. Each obligation in block 2 carries a one-line **current status**
naming the gap (e.g. "no provenance marking exists today; treat unreproducible state as precious").

- **Pros:** impossible to read an obligation as an enforced guarantee — they sit under a heading that
  says otherwise, each with its own reality check. Block 2 doubles as a **live gap register**: as
  epic stories 2–6 land, statuses flip, and the section stays honest without restructuring. Keeps
  the spec self-contained. Auditable — a reviewer can check every block-2 item against reality.
- **Cons:** one more heading than the precedent; block 2's status lines must be maintained as stories
  land (acceptable — that maintenance *is* the value, and the epic file tracks the stories).

### Option C — Ontology into BIBLE; all obligations stay in the handoff doc

Ratify only the identity model; leave provenance/rebuild/LMDB/coverage in the (kept-OPEN) handoff.

- **Pros:** smallest BIBLE change; cleanest normative core.
- **Cons:** the obligations are precisely what future contributors must honor — burying them in a
  `docs/` working file means the canonical spec doesn't state the data-loss rule at all. Splits one
  topic across two homes; a reader of BIBLE §30 would not learn that rebuilds are dangerous.
  Rejected for the same reason ADR 0033 rejected its Option C.

## Decision

**Option B.** A three-block §30 — **The ontology (ratified)**, **Obligations this creates (binding;
not yet enforced)**, **Deliberately open** — puts the *decided vs. enforced vs. undecided* boundary
into the document structure itself. This is ADR 0033's structural-split principle, extended by one
block because this story's material carries three confidence levels rather than two.

**On the PO's judgment call — how much handoff nuance becomes normative prose:** BIBLE gets
**definitions and rules**; the handoff keeps **derivations and reasoning**. Concretely:

- **§3 (asserted core)** → BIBLE gets the *definition* ("me minus everything recomputable") plus the
  recomputable inventory as an explicitly non-exhaustive list, and one sentence on why the boundary
  matters (it scopes backups and bounds what rebuilds may touch). BIBLE does **not** get the
  "most-compact-me" conjecture or the conversational derivation that produced it.
- **§8 (coverage)** → BIBLE gets the *definition*, the normative rule **coverage ≠ normalization**,
  and the current deriver gap. The "normalization ⇒ covering" conjecture gets **one sentence**,
  explicitly marked plausible-and-deferred, in block 3 — not an argument.

Rule of thumb for the Implementer: **if a sentence explains *why we came to believe* something, it
belongs in the handoff; if it states *what is true* or *what you must do*, it belongs in BIBLE.**

**On CLAUDE.md:** add a fourth invariant with a pointer to §30, paid for by deleting the
`### The non-technical journey, end to end` block — the file's single largest purely-illustrative
passage, whose every normative claim is already stated elsewhere in the same section (natural
language is primary, line 72; plain-language register/no jargon, line 86; conversational gates,
line 89; routing, the tables at 91–121; engineering handoff, lines 68 and 104). Net line change: **0**.

## Consequences

- **Enables:** one canonical authority for the identity model; future epic stories (provenance,
  rebuild hardening, serialization, backup, monitoring) cite §30 as their premise; a session reading
  only `CLAUDE.md` now learns neo4j is the definitive self and won't "correct" brain-first work.
- **Constrains:** future changes to the identity model must update §30. Block 2's status lines
  become a standing maintenance obligation — each epic story that lands should flip its status.
- **Deliberate non-repeal:** the three existing invariants are **not** weakened. §30 must state that
  they continue to govern the event/social axis unchanged. A reader must not conclude that
  "local-first" licenses write-time gating of peers' events, POV-blind global truth, or write-time
  filtering. The Reviewer should treat any such implication as a defect.
- **Accepted loss:** `CLAUDE.md` loses its end-to-end non-technical narrative. Mitigation: it is
  pure illustration (no unique normative content), and the fuller journey is documented in
  `product-team/README.md`. If the owner objects, the fallback donor is the redundant
  "failure mode this guards against" restatement (line 82) plus one adjacent line.
- **New debt:** none in code. The epic already tracks stories 2–6; this ADR settles none of them.
- **Firmware reinstall required?** **No** — pure spec; no concept definitions changed.

## Implementation notes

Docs-mode: BIBLE prose + CLAUDE.md edit + handoff annotation. **No source, no tests, no config.**
Line numbers below are current-state anchors; locate by the quoted content, which is stable.

### 1. `BIBLE.md` — new `## 30. The Self and Its Stores`

Insert **after §29 (Derived-JSON Store, ends ~line 1759) and before the closing footer**
(`*This document is maintained by the development team…*`). Match §27/§29 style: bold thesis lead,
tables where they earn their place, normative language, ADR cross-ref at the end (`See ADR 0001…`).
Three blocks, in this order:

1. **The ontology (ratified).** Lead: Tapestry is first and foremost a local-first personal
   knowledge graph. A three-row table — **Store | Role | Notes** — carrying: **neo4j** = the
   definitive "me" (complete, mortal, restorable in full from a neo4j backup); **tapestry LMDB** =
   "me" but a subordinate cache, derivable from neo4j, never a co-equal seat of self (cross-ref
   §29); **signed nostr events** = "letters," authored by me or received from peers — the
   proof/communication/durability axis, not the identity substrate. Then, as prose:
   - **Derivability ≠ identity** — that events sit at the bottom of the *derivation* stack does not
     make them the seat of self. A letter is derivable from me; it is not me.
   - An unpublished neo4j write is a **private thought**; signing and publishing is **writing and
     mailing a letter**. An instance may in principle operate without ever signing an event.
   - **The asserted core** — "me minus everything recomputable." Non-exhaustive recomputable
     inventory: derived/implicit relationships (§5–§6), WoT scores, JSON Schema documents
     recomputable from a full property tree, and all tapestry-LMDB derived JSON (§29). One sentence
     on why the boundary matters: it scopes backups and bounds what a rebuild may touch.
   - **How this relates to principles 1–3** (required — do not omit): the decentralized-first /
     POV-first / filter-at-view-time invariants still govern the **event and social axis unchanged**
     — accept all signed events, no write-time gating of peers, trust filtering at read time per POV.
     A trusted peer's incoming event still updates the brain without replacing it as the seat of
     self. On a multi-tenant instance, "me" = the **owner-POV slice** (cross-ref §27).

2. **Obligations this creates (binding; not yet enforced).** Open with an explicit sentence: *these
   are requirements the system must grow into — none is enforced today.* Four items, each with a
   one-line **Status:** naming the present gap:
   - **Provenance taxonomy.** Every node/edge is exactly one of *asserted / locally-authored*
     (precious), *event-projection* (disposable), *peer-received* (trust-weighted).
     *Status: no provenance marking exists; representation/migration deferred (epic story 2).*
   - **Non-destructive rebuild invariant.** No pipeline — import, normalization, firmware reinstall,
     reconciliation, or dev tooling — may destroy locally-authored state. Include the interim rule:
     **until provenance exists, treat any state a rebuild cannot reproduce as precious by default.**
     *Status: not enforced; hardening is epic story 3.*
   - **LMDB dual role.** Primary/ongoing = compact low-latency cache, lossy and partial *by right*;
     secondary/intermittent = full lossless serialization for backup. The two modes must be
     **distinguishable**, so a cache entry is never mistaken for backup-grade data. Cross-ref §29.
     *Status: only the cache mode exists (§29 shows derived:0 on live instances); serialization mode
     is epic story 4.*
   - **Coverage.** A document set **covers** the graph iff every node and edge is losslessly
     represented in at least one document and the set reassembles the graph exactly. **Coverage is
     distinct from normalization** — normalization (§10) guarantees internal consistency, not
     deriver completeness. *Status: today's derivers cover only concept-graph labels, not the
     NostrUser/FOLLOWS/MUTES/REPORTS graph.*

3. **Deliberately open.** Short list, each one line, explicitly not-yet-decided: provenance
   representation/migration/writer-discipline; backup mechanics — encryption scheme, **key custody**
   (the key protecting the self's backup must survive outside the self), chunking against relay
   event-size limits, manifest/reassembly, relay choice, retention; serialization-mode marking and
   run manifests; and the **"normalization ⇒ covering" conjecture** (one sentence: plausible, deferred,
   *not assumed*). Note the chosen backup *pipeline shape* is ratified — lossless serialization →
   encrypted chunked events → mirror relay — while none of its mechanics are; and that publishing the
   graph as constituent *semantic* events is nostr-native but **necessarily lossy for the
   definitive-me**, since asserted state has no event form.

   Close with: `See ADR 0001 (self-ontology) for the ratification decision; working notes and the
   reasoning that produced this section live in docs/SELF_ONTOLOGY_DESIGN_HANDOFF.md.`

### 2. `BIBLE.md` — ToC + freshness line

- ToC (after line 42): add `30. [The Self and Its Stores](#30-the-self-and-its-stores)`. Verify the
  GitHub anchor: "The Self and Its Stores" → `#30-the-self-and-its-stores`.
- Update the `**Last updated:**` line (~line 8) per the file's convention.

### 3. `CLAUDE.md` — fourth invariant, net **0** lines

- **Add (+4 lines), inserted after line 45** (the blank line ending principle 3's bullets, i.e.
  immediately before `### Reflex checks when designing anything`): a blank line, the heading
  `### 4. Local-first: neo4j is the definitive "me"`, a blank line, and **one** paragraph covering:
  Tapestry is first and foremost a local-first personal knowledge graph; **neo4j is the definitive
  self**; the tapestry LMDB is a subordinate cache; signed events are "letters" (proof/comms/
  durability, not identity); locally-authored graph state may have no event behind it and **must
  never be discarded as "rebuildable from strfry"**; principles 1–3 still govern the event/social
  axis unchanged; full standard + obligations in **BIBLE §30**.
- **Delete (−4 lines): lines 123–126** — the `### The non-technical journey, end to end` heading,
  its blank line, its single prose paragraph, and one adjacent blank — leaving exactly one blank
  line between line 121 (`**When in doubt, ask one question:** …`) and `## Engineering Team Mode`.
- **In-line edits (0 line cost):** line 20 — `three principles` → `four principles`, and extend its
  caution to note the new one guards the *opposite* drift (instincts trained on event-sourced or
  fully-decentralized systems will treat the graph as a disposable projection). Line 55 — extend the
  closing sentence so designs touching storage, rebuilds, or backup are also checked against
  principle 4.
- **Verify:** `wc -l CLAUDE.md` returns **190**, and `bash scripts/harness-lint.sh` is clean.
  Do **not** edit `scripts/harness-budgets.txt` — there is no cap change.
- **A CHANGELOG row IS required.** `CLAUDE.md` is listed in `scripts/harness-def-paths.txt`, so any
  commit touching it is a **harness-definition commit** and must also touch
  `engineering-team/CHANGELOG.md` (the touch-rule, lint check **L10**) — independently of whether a
  budget cap moved. Add the row in the **same commit** as the `CLAUDE.md` edit. Note that
  `harness-lint.sh` cannot catch this pre-commit: L10 inspects the latest *commit* touching def
  paths, so the gate reads clean while the edits are still uncommitted and only fails afterwards.
  *(Corrected after the self-ontology #1 review — the original text wrongly inferred "no cap change,
  therefore no CHANGELOG row", conflating the budgets-file cap rule with L10.)*

### 4. `docs/SELF_ONTOLOGY_DESIGN_HANDOFF.md` — annotate, keep OPEN

- **Keep `**Status:** 🔴 OPEN`** and keep the full body. Do **not** flip to SUPERSEDED — the
  remaining open designs (§4 representation, §7 mechanics, §8 conjecture) have not landed.
- Add a short pointer near the top: which sections ratified and where they landed (§2/§3/§9 → BIBLE
  §30 block 1; §4/§5/§6/§8 → block 2 as binding obligations), and that the open questions in §11
  remain this epic's deferred work.

## Out of scope

- **All code** — no provenance marking, no rebuild hardening, no serialization mode, no backup
  pipeline, no monitoring. Those are epic stories 2–6.
- **Deciding any open question** from handoff §11 — they are documented as open, not resolved.
- **Raising the `CLAUDE.md` line cap** — explicitly rejected by the owner; hence no
  `scripts/harness-budgets.txt` edit. (This does **not** exempt the change from the CHANGELOG
  touch-rule — see Implementation notes §3: editing `CLAUDE.md` at all requires a CHANGELOG row.)
- **Flipping the handoff to SUPERSEDED** — deferred until the rest of its content ratifies.
- **Test Design** — skipped (docs-mode; no executable behavior). The gates are `npm test` staying
  green, `harness-lint` clean, `CLAUDE.md` at 190, and the Reviewer's accuracy/cross-reference audit.
