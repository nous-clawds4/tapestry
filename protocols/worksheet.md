# Protocol Worksheet

Problems and ideas that are unsolved, cross-cutting, or not yet owned by a single spec. Each entry is self-contained: the problem, why it matters, and where the related thinking lives. When an entry matures into a coherent design, it graduates to a `drafts/` pre-NIP and the entry here records the handoff instead of being deleted.

Entry format: `W<n>` id, status (**Open** / **Graduated → <spec>** / **Closed**), date raised, problem statement, related references.

---

## W1 — Cross-deployment concept identity

**Status:** Open · raised 2026-06-09

Concept handles embed their publisher's pubkey (`39998:<pubkey>:<slug>`), so every event that joins a concept via `z` tag bakes that pubkey into signed history. Today the Tags concepts (`tag`, `nostr-user-tag`, `tag-pinning`) are addressed under a dev-machine literal that became wire-binding by accident (tags-branch ADR 0015's `LEGACY_Z_TAG_PUBKEY` exception). A universal spec cannot hardcode one deployment's key — so: **how do independent deployments and implementations agree on which concept header is canonical for a given concept?**

Known candidate directions, none ratified:

- **Firmware-blessed pointer** — the current cold-start compromise (BIBLE §22, "Flaw A"): centralized editorial choice, accepted temporarily.
- **Registry-as-DList** — the per-concept pointer becomes a community-curated, Grapevine-ranked DList (BIBLE §22's named exit from Flaw A).
- **`b`-edge aggregation** — a concept's incoming `INHERITS_FROM` edges, weighted by each child author's GrapeRank influence from the observer's PoV, yield "which definition my web of trust agrees on" (ADR 0027; [inherit-from spec](./drafts/inherit-from.md)). Candidate mechanism for the registry exit. Scoped by `community-reference` ADR 0029: the consensus signal counts **inherit-typed** edges only — pointer-typed `b` derives `REFERENCES` and carries zero consensus weight in v1; discovery walks include both types.

**Refs:** BIBLE §22 (community-reference model, Flaw A + exit); [inherit-from spec](./drafts/inherit-from.md) (`b` tag; ex-BIBLE §25); ADRs 0027/0028/0029 (community-reference); tags-branch ADR 0015 (the legacy-literal incident that exposed the problem); handoff doc §2; `docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md` (D5: dev fiat → registry → grapevine trajectory).

## W2 — Single-char tag namespace registry

**Status:** Open · raised 2026-06-09

Our specs are steadily claiming single-char (NIP-01 relay-indexed) tag letters: `z` (parent pointer), `n` (HAS_ELEMENT-inverse), `s` (IS_A_SUPERSET_OF-inverse), `b` (inherit-from / pointer — element-3 typed, per `community-reference` ADR 0029). The direction principle ([class-thread-tags spec](./drafts/class-thread-tags.md), ex-BIBLE §23): lowercase = child-claims-parent; uppercase forms are reserved for parent-claims-child inverses (`B` explicitly reserved, unassigned) and must not be assigned speculatively. The candidate letter for `IS_A_PROPERTY_OF` is TBD (`REFERENCES` no longer needs a letter — it rides `b`'s `"pointer"` type, ADR 0029). **One registry table is needed across all our specs so future ADRs don't collide letters** — and to decide how it composes with letters other NIPs already use.

**Refs:** [class-thread-tags spec](./drafts/class-thread-tags.md) (direction principle, candidate letters; ex-BIBLE §23) and [inherit-from spec](./drafts/inherit-from.md) (`b`; ex-BIBLE §25); ADRs 0011, 0027, 0029 (community-reference).

## W3 — Polarity valence arc

**Status:** Open · raised 2026-06-09

Tagging events carry `polarity` `"1"` (apply) or `"-1"` (dispute); v1 semantics bucket `>= 0.5` as applied and `<= -0.5` as disputed, deliberately reserving the open interval `(-0.5, 0.5)` for a future graded-valence arc (GrapeRank-style weights in `[-1, +1]`). **The graded semantics are undesigned**: what does a 0.3 mean, who interprets it, and does the bucketing rule belong in the Tags spec or in trust-metric-interpreter territory?

**Refs:** [tags spec](./drafts/tags.md) § "Polarity"; tags-branch ADR 0001 (polarity wire format + v1 buckets); tags-branch follow-ups (valence arc deferred); handoff doc §6.

## W4 — `e` vs. `a` for parent-tag references

**Status:** Open · raised 2026-06-09

Tagging and pin events reference the tag they apply/pin by `e` (event id — pins a specific version) and/or `a` (address — survives the author's edits). The tags branch flagged this choice for re-evaluation in its own follow-ups: replaceable events make `e`-references go stale, while `a`-references change meaning under the author's later edits. **Which reference (or which combination, with what precedence) should the spec mandate, and does the answer differ for taggings vs. pins?**

**Refs:** [tags spec](./drafts/tags.md) § "Taggings (assertions)" / § "Pins"; tags-branch ADRs 0001/0009 + follow-ups; the same question shape appears in the DList compat companion (Method 2 mandates `a` for items pointing at kind-34550 events because they're replaceable; Method 3 rides on `z` tags instead).

## W5 — `REFERENCES` publishing semantics

**Status:** Graduated → [inherit-from spec](./drafts/inherit-from.md) · raised 2026-06-09 · resolved 2026-06-12

The concept-level `REFERENCES` relationship (a non-committal "may pull later" bookmark between concepts) had no settled wire form; the open question was: **is it a consumer-owned tag on the consumer's own concept Header, or a separate "reference manifest" kind-39999 event?**

**Resolution (`community-reference` ADR 0029):** option (a), realized as the **pointer-typed `b` tag** — `["b", "<target-a-tag>", "pointer"]` (the type value renamed from "reference" to avoid colliding with the legacy REFERENCES vocabulary), a consumer-owned tag on the consumer's own header (or item — kinds 39998/39999), deriving `(child)-[REFERENCES {source:'b-tag'}]->(target)` under BIBLE §22's collision contract. No single-char letter was spent (W2 updated); the W1 linkage is preserved with the consensus/discovery split recorded there. Wire form now normative in the [inherit-from spec](./drafts/inherit-from.md).

**Refs:** [inherit-from spec](./drafts/inherit-from.md) (resolving authority); `community-reference` ADR 0029; BIBLE §22 (collision contract, deferred list updated); [class-thread-tags spec](./drafts/class-thread-tags.md) § "Direction principle and reserved letters" (ex-BIBLE §23); ADR 0006 line.

## W6 — Set-valued override algebra for Resolved Definition

**Status:** Open · raised 2026-06-09

Resolved Definition ([inherit-from spec](./drafts/inherit-from.md) § "Scope (v1)", ex-BIBLE §26) is field-level in v1: a child's stated field replaces the inherited one wholesale. **How a child adds/removes/replaces individual *elements* of an inherited set** (e.g. "Alice's `dogs` minus Fido plus Rex") is explicitly deferred — by ADRs 0027/0028, unchanged by 0029 — to the first consumer that needs it. When that consumer appears, the algebra belongs in the [inherit-from spec](./drafts/inherit-from.md)'s Scope section and operates over the inherit-typed deference closure only (pointer-typed `b` tags never participate). Note: ADR 0029's pointer-by-default reduces this entry's pressure — inheritance is now opt-in and rarer.

**Refs:** [inherit-from spec](./drafts/inherit-from.md) § "Scope (v1)" (ex-BIBLE §25/§26); ADRs 0027/0028/0029 (community-reference).

## W7 — `item-kind` interplay with concept headers

**Status:** Open · raised 2026-06-09

The DList compat companion introduces `item-kind` on list headers to declare which foreign event kinds a list accepts (e.g. kind 34550 NIP-72 communities as list items). Tapestry's concept headers carry their own conventions (`concept-graph` pointer, firmware schemas, `required`/`allowed` declarations). **Do these compose or compete?** E.g.: should Tapestry concept headers declare `item-kind`? Does a foreign-kind item participate in class threads (`n`/`s`) and inheritance (`b`)? Does the firmware JSON-schema mechanism subsume the header's schema-declaration tags or duplicate them?

**Refs:** `feat/communities:DECENTRALIZED_LISTS_COMPAT.md` (`item-kind`, Methods 2/3); BIBLE §5 (concept-graph tag), §7 (firmware schemas); [class-thread-tags spec](./drafts/class-thread-tags.md) § "Security considerations" (ex-BIBLE §23).

## W8 — Engine-config carriage

**Status:** Open · raised 2026-06-10

Brainstorm Communities' membership engine needs configuration: seed pubkeys, a weighting model, a membership threshold, an influence cutoff. The May records layer carries `seed`/`weighting_model`/`endorsement_threshold` as record tags; the post-redesign declaration model (`feat/communities` ADR 0030) rides threshold + cutoff with the CD's `claims` declaration, resolving through `b`-inheritance. **Where does engine config canonically live — personal records, the Community Declaration, the resolved definition, or split across them — and what is its exact wire encoding?** The [communities spec](./drafts/communities.md) marks both the CD field encodings and this carriage question open.

**Refs:** [communities spec](./drafts/communities.md) § "The Community Declaration" / § "Personal community records"; `feat/communities` ADRs 0029/0030; `feat/communities:COMMUNITY_RECORDS_DLIST.md`; protocols-directory ADR 0004 (finding D2 residue).

## W9 — Roster-rule reconciliation

**Status:** Open · raised 2026-06-10

Two membership roster rules exist for Brainstorm Communities: the **deployed v1 rule** (count-based: `applications ≥ cutoff AND applications > disputes`, single PoV) and the **designed rule** (per-observer, trust-weighted: net assert-vs-dispute weighted by the observer's trust in each asserter, influence-cutoff-gated, threshold from the resolved definition — "no veto" falls out). Reconciling them — and settling threshold mechanics (1 vouch vs. N ≥ 2 for safe spaces, capture doc §5) — is open. The security stakes are real: the no-veto property holds only under the weighted rule.

**Refs:** [communities spec](./drafts/communities.md) § "Membership" / § "Security considerations"; `feat/communities` ADR 0030 (both rules); `docs/COMMUNITIES_PROTOCOL_DESIGN_HANDOFF.md` §3/§5; protocols-directory ADR 0004 (finding D5).

## W10 — Taggings family naming & expansion

**Status:** Open · raised 2026-06-10

The taggings family ([tags spec](./drafts/tags.md) § "The taggings family") has one deployed member and a ratified direction, recorded from the protocol author at story 7's gate: *"we will have a parent concept of taggings, with nostr-user-tag (should we change it to nostr-user-tagging?) and nostr-event-tag as sibling concepts; maybe even dlist-tag as a subset of nostr-event-tag, with dlist-tag being something we would very much like to start using."* Open: (1) the **rename** of `nostr-user-tag` — wire-impactful, since the slug rides in `z` handles on user-signed history (a concept migration, same class as the W1 legacy-literal lessons); (2) the **handles and hierarchy** for `nostr-event-tag` and `dlist-tag` (parent/sibling/subset structure as concepts); (3) sequencing against the event-tagging rollout (kinds 39998/39999 targets first, per the epic handoff §6).

**Refs:** [tags spec](./drafts/tags.md) § "The taggings family" / § "Event tagging (planned)"; story 7 gate record (`engineering-team/stories/protocols-directory/7-tags-spec.md` § Open questions); `docs/PROTOCOLS_DIRECTORY_DESIGN_HANDOFF.md` §6.

## W11 — Cloud formation & multi-z stamping rules

**Status:** Graduated → [tapestry-concepts spec](./drafts/tapestry-concepts.md) · raised 2026-06-12 · resolved 2026-06-13

`community-reference` ADR 0029 ratified the *position* that deliberately-published list items MAY carry multiple `z` stamps; the *practice* (cloud membership, rotation, the stamping rule, re-stamping) was open, the motivating constraint being local-first publication (public aggregation cannot depend on unpublished personal headers, so a stamped item must be self-contained).

**Resolution (`community-reference` ADR 0033, frame ratified — tuning deferred).** The **cloud** is the **derived top-k of the W1 grapevine-resolved consensus signal** — never a published object/manifest (no curator; no-privileged-center); membership is consensus rank, and mutual pointer-`b` edges are the author's *navigation* to the cloud, not a gate. **Rotation is emergent** (nobody governs it; author and consumer recompute), following the §22 trajectory `grapevine-resolved → firmware-blessed → none`; organic clouds bootstrap from singletons. Stamping is **affiliation-anchored** (stamp the declared community's cluster, not the concept-global top-k). A stamped item carries the **personal `z`** (required, ≥1) **plus up to a cap of cloud handles**; **`z` order is not load-bearing** (consumers MUST NOT depend on it). Re-stamp on rotation is **lazy author re-emit** (same `d`-address, kind 39999), with named lossiness (foreign-authored/inactive/kind-9999 items). The cloud is **containment-only** — membership assertions keep the single shared applied-concept handle. **Deferred to implementation:** the exact cap `k` (~5), the ranking formula, the firmware cold-start cluster contents. Design-only, gated on the resolver + on-wire `b`-tags behind the three-branch reconciliation.

**Refs:** [tapestry-concepts spec](./drafts/tapestry-concepts.md) § "Multi-`z` stamping" (resolving home); `community-reference` ADR 0033; `docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md` (D1 rev 2, O11/O12, the local-first constraint) + the 2026-06-13 scope conversation; `community-reference` ADR 0029; base NIP [decentralized-lists](./nips/decentralized-lists.md) § Item declaration (multi-`z` permitted, one-`z` recommended).
