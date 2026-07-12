# NIP Reorganization — Shared Concepts / Class Thread Relationships / Stamping — Design Handoff

**Status:** 🔴 OPEN — organization, names, and vocabulary policy settled in scoping (this doc); **nothing ratified yet**. Ratification stories S1–S4 (§5) each await a docs-mode pass. Flip to ✅ SUPERSEDED as the pieces land in `protocols/`.

**Created:** 2026-07-12, from a Protocol-Spec scoping session (`/discuss`, Product Expert lens), downstream of the same session's tag-sync investigation and the z/b/s stamping conversation.
**Builds on:** [`protocols/nips/decentralized-lists.md`](../protocols/nips/decentralized-lists.md) (published base NIP); [`protocols/drafts/tapestry-concepts.md`](../protocols/drafts/tapestry-concepts.md) § "Multi-`z` stamping" (ADR 0033, graduated W11); [`protocols/drafts/inherit-from.md`](../protocols/drafts/inherit-from.md) (the `b` primitive; ADRs 0027/0028/0029); [`protocols/drafts/class-thread-tags.md`](../protocols/drafts/class-thread-tags.md) (`n`/`s`); [`protocols/worksheet.md`](../protocols/worksheet.md) W1/W2/W10/W11.
**Related:** [`docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md`](./B_TAG_AFFILIATION_DESIGN_HANDOFF.md) (D1 rev 2, the local-first constraint — design provenance for the stamping convention); [`docs/TAG_FEDERATION_OPS.md`](./TAG_FEDERATION_OPS.md) (ops half of tag federation; its "dcosl is clean" claim is stale per the 2026-07-12 census — see OPEN.md).
**Audience:** the protocol author + future ratifying sessions (docs-mode stories, protocol-spec workflow §3).

> **Why this doc exists.** The 2026-07-12 scoping conversation settled how to reorganize the shared-concept protocol surface into NIPs: which documents exist, what each contains, what they're named, and what vocabulary they're allowed to use. It also isolated the one large open design question (subset/ancestor stamping) into its proper future home instead of blocking the reorg on it. This doc preserves the decisions and their reasons so ratification doesn't re-litigate.

---

## 0. The originating proposal and what changed in scoping

The protocol author proposed a four-NIP organization:

| # | Proposal | Outcome |
|---|---|---|
| 1 | Decentralized Lists (exists, published) | **Unchanged** — remains the base NIP |
| 2 | "Community Concepts" — b-tags for community/canonical/shared concepts | **Adopted, split and renamed** — the `b` *primitive* stays in inherit-from.md; the *policy* layer becomes a new NIP named **"Shared Concepts"** (D1, D2, D3) |
| 3 | A NIP for `s` tags; maybe separate from `n` | **Adopted, merged** — `n` and `s` stay in one NIP, renamed **"Class Thread Relationships"** (D4) |
| 4 | A NIP for z-tag selection at publish time, incl. subsets | **Adopted** — new NIP **"Stamping: z-tag selection for published list items"**, extracted from tapestry-concepts § Multi-`z`; the subset question ships in it as an explicit open section, not settled first (D5, D6) |

---

## 1. Settled decisions

### D1 — Primitive/policy split for #2

The `b`-tag **wire primitive** (pointer/inherit types, resolution algorithm, first-listed-wins, deference closure) and the **shared-concept policy** (affiliation, aggregation, clouds, identity) are different documents with different audiences and different stability. inherit-from.md remains the primitive NIP, unchanged in scope except as noted in D3. The new **Shared Concepts** NIP is the policy layer that *consumes* `b`.

**Why:** the primitive is ratified and mechanical; the policy layer is partly ratified (ADR 0033) and partly open (W1). Separating them keeps stable text from being hostage to open questions — which matters because these will publish individually, as decentralized-lists did.

### D2 — Vocabulary policy: retire "canonical" *and* "consensus" from normative text

Both words smuggle in a privileged center the architecture refuses to have. "Canonical" asserts a unique authority (rejected in ADR 0033's cloud design — no manifest, no curator, no privileged center). "Consensus" asserts a *global, settled fact about the community* — but the ADR 0033 signal is observer-relative (GrapeRank-weighted from the observer's PoV; two observers legitimately compute different clouds) and never finalizes (rotation is emergent). An implementer who reads "consensus" will build a global lookup.

The replacement is a **three-word split**, one per referent:

| Word | Referent |
|---|---|
| **deference** | the raw signal — an inherit-typed `b` edge *is* a deference claim; what the resolver computes is *aggregated deference, as seen by an observer*. (inherit-from.md already speaks this language: "deference closure," "everyone who defers to this definition.") |
| **convergence** | the process — how shared conventions arise: emergent, gradual, measurable in degree, never final. Names rotation honestly. |
| **convention** | the outcome — the handles in conventional use among a community of authors. A "shared concept" is one whose handle is in conventional use. |

Normative framing: *authors declare affiliation (pointer-`b`) and deference (inherit-`b`); aggregated deference, observer-resolved, is how conventions converge.* The observer-relative qualifier ("an observer's view of aggregated deference") is mandatory in normative text; never "the consensus," never "the canonical header."

**Scope of the rename:** living specs only. inherit-from.md's Aggregation section currently self-labels "Consensus (deference) aggregation" — on migration (D3) the first word drops, the second stays. ADRs 0029/0033 and the worksheet history keep their wording — vocabulary is superseded in living specs, decision records are not rewritten.

"Shared concepts" replaces "community concepts" as the preferred phrase wherever the living specs currently say "community/shared" (tapestry-concepts § Multi-`z` already says "shared/community concepts," so this is promotion of existing phrasing).

### D3 — Shared Concepts NIP: contents

- The **policy** consumers need to interoperate with shared concepts: declared affiliation (pointer-`b` on one's own header), deference (inherit-`b`), and the **cloud** — the derived, observer-resolved top-k of aggregated deference (the ADR 0033 model, restated under D2 vocabulary: no published manifest, mutual pointer-`b` as navigation not gate, emergent rotation, bootstrap-from-singleton).
- **Absorbs inherit-from.md's "Aggregation: who defers to a definition" section** (deference aggregation vs discovery walks) — that section is policy, not tag mechanics. inherit-from.md keeps a one-line cross-reference.
- **The W1 identity question** (cross-deployment concept identity) gets its home-base treatment here: the trajectory (firmware-blessed pointer → registry-as-DList → grapevine-resolved aggregation) stated, with W1 remaining the open-problem tracker. Exactly how much is restated vs referenced is an authoring call (O2).
- Defines **no new wire format**. Everything rides `b` (inherit-from) and `z` (decentralized-lists / tapestry-concepts).

### D4 — Class Thread Relationships: rename, keep `n`+`s` together

class-thread-tags.md is renamed **"Class Thread Relationships"** (file: `class-thread-relationships.md`). Substance unchanged. Rationale: (a) removes the "tags" collision with the Tags/Taggings feature; (b) the document's payoff was always the *derived relationships* (`HAS_ELEMENT`, `IS_A_SUPERSET_OF`) — the tags are their wire encoding. `n` and `s` stay in one NIP: they share the value format, the child-claims-parent direction principle, the derivation flip, and the entire security section; splitting would duplicate ~80% of the prose.

One guard: the intro keeps the derived-vs-explicit principle crisp — these relationships are *derived from single-char tags on the child's own events*, never from explicit relationship events.

### D5 — Stamping NIP: extraction now, subset question inside it

New NIP: **"Stamping: z-tag selection for published list items"** (file: `stamping.md`). Contents:

- The **ratified multi-`z` convention** moved out of tapestry-concepts § "Multi-`z` stamping" (personal `z` required ≥1; up to a cap of cloud handles; affiliation-anchored; `z`-order not load-bearing; lazy author re-emit; containment-only). tapestry-concepts keeps a short pointer (its § retains number/title per the docs-mode convention).
- The **read-side contract** stated on the same page as the write rule: what consumers may assume about which stamps exist, and when they must instead expand queries (the two halves of one contract).
- An explicit **"Open: subset/ancestor stamping"** section (O1) with the Widgets / Widgets-for-Carpenters / Widgets-for-Electricians running example.
- Framing: stamping decisions are *computed from* `b` (affiliation → which shared handles), `s` (structure → the subset question), and possibly `n`. References Shared Concepts and Class Thread Relationships.

### D6 — Sequencing: reorg before settling the subset question

All four affected documents are pre-NIP drafts — only decentralized-lists has a published canonical identity — so renames and section moves are cheap *now* and get more expensive as any draft nears publication. The Stamping NIP therefore lands with the ratified text plus the open section; the subset design iterates in its proper home instead of blocking the reorg.

### D7 — Resulting dependency stack (acyclic)

```
Decentralized Lists                 (base kinds, z pointer)                       [published]
  └─ Tapestry Concepts             (data model: a-tag z, word-wrapper, core nodes; loses § Multi-z → pointer)
       ├─ Inherit-From (b)         (primitive: pointer/inherit, resolution; loses § Aggregation → pointer)
       ├─ Class Thread Relationships (primitive: n/s membership & structure)      [rename]
       ├─ Shared Concepts          (policy: affiliation, deference, clouds, identity; consumes b)  [new]
       └─ Stamping                 (policy: z-selection incl. subsets; consumes b, s, ± n; references Shared Concepts)  [new]
```

Downstream consumers ([`tags.md`](../protocols/drafts/tags.md), [`communities.md`](../protocols/drafts/communities.md)) reference Stamping instead of restating dual-`z` rules.

### D8 — Cross-reference and index sweep is in scope

- [`protocols/README.md`](../protocols/README.md): index rows for the two new drafts + the rename, per the status ladder.
- Worksheet: **W11's "graduated →" pointer re-aims** at Stamping once it lands; **W1's refs gain** Shared Concepts as the aggregation-policy home; a **new worksheet entry** opens for subset/ancestor stamping (successor question to W11).
- BIBLE pointer sections stay consistent with wherever their normative text now lives.

---

## 2. Open questions

### O1 — Subset/ancestor stamping (the centerpiece; needs its own `/discuss`)

When Alice publishes an item into *Widgets for Carpenters* (subset of *Widgets*, per `s`), does the item carry `z` stamps for the ancestor concept too?

- **(a) Stamp the joined concept only; consumers expand at read time** — the ADR 0033 status quo. Read-side does an `s`-walk and unions `#z` queries. Honest about hierarchy liveness; but relays can't do transitive queries, so "all Widgets" costs one round-trip per subset.
- **(b) Write-time ancestor stamping** — the item carries the full chain (Alice's 4-z example: personal+shared × {Widgets-for-Carpenters, Widgets}). Single-filter relay queries work; but hierarchy is denormalized into signed history — re-parenting goes stale, healing is lazy-author-re-emit only (foreign-authored and inactive authors' items never heal), and cap pressure is real (~5 z-slots; 2 per chain level before any cloud redundancy).
- **(c) Hybrids** — e.g. stamp direct + root-superset only; or cap-aware truncation rules.

Whatever is chosen, the **read contract must be stated alongside it** (may consumers assume ancestor stamps exist, or must they expand?). → New worksheet entry on landing (D8).

### O2 — How much of W1 restates inside Shared Concepts vs stays referenced (authoring call at S1; keep W1 as the tracker either way).

### O3 — Exact file/title strings and README status-ladder rows (authoring call at each story; suggestions in D3–D5).

### O4 — Adjacent, out of reorg scope, don't lose:
- **Target-typed *tag definitions*** — the 2026-07-12 conversation floated splitting Tags into Tags-of-users/Tags-of-events at the *definition* level; pushed back (W10's ratified family splits *taggings* by target, not tags; target-typing belongs on the tagging concepts' `required p`/`required e`). Unresolved; belongs to the tags/W10 lineage, not this reorg.
- **Pins still single-`z`** — `publishTagPin.js` emits only the canonical `tag-pinning` handle (no local runtime-TA `z`), lagging the dual-`z` writers for tag-elements and assertions (tag-federation ADR 0003). Implementation, not spec — but the Stamping NIP shouldn't silently paper over the gap. Track as an eng-team story candidate.

---

## 3. Where we paused

Scoping is complete for the reorg itself; O1 is deliberately deferred into the Stamping NIP's open section. Nothing has been ratified; no `protocols/` file has been touched.

---

## 4. Vocabulary quick-reference (for the authoring stories)

| Retired (normative text) | Use instead |
|---|---|
| canonical (header/concept) | shared concept; the handle in conventional use; (for the ADR-0015 literal specifically: "the legacy literal" / "the firmware-blessed handle") |
| consensus (signal/rank) | aggregated deference (observer-resolved); deference rank |
| the community has decided / consensus formed | conventions converge(d) |
| community concepts (where interchangeable) | shared concepts |

ADRs and worksheet history keep their original wording.

---

## 5. Ratification plan (docs-mode, one epic)

Proposed epic slug: `nip-reorg`. Four thin stories, protocol-spec workflow §3 (`/plan-feature` → ADR → skip tests → author → review → `cycle-staging`):

| Story | Deliverable |
|---|---|
| **S1 — Shared Concepts** | `protocols/drafts/shared-concepts.md` (D2 vocabulary, D3 contents); inherit-from.md § Aggregation → pointer |
| **S2 — Class Thread Relationships** | rename + title sweep (D4); inbound-link fixes |
| **S3 — Stamping** | `protocols/drafts/stamping.md` (D5); tapestry-concepts § Multi-`z` → pointer; the O1 open section; new worksheet entry |
| **S4 — Index & cross-ref sweep** | `protocols/README.md` rows; W1/W11 re-pointers; tags.md/communities.md reference Stamping; BIBLE pointer consistency (D8) |

S1–S3 are order-independent in substance; S4 last. If any story's ADR finds the split wrong-shaped, kick back here rather than improvising in the spec text.
