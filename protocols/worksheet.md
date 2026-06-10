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
- **`b`-edge aggregation** — a concept's incoming `INHERITS_FROM` edges, weighted by each child author's GrapeRank influence from the observer's PoV, yield "which definition my web of trust agrees on" (ADR 0027; BIBLE §25). Candidate mechanism for the registry exit.

**Refs:** BIBLE §22 (community-reference model, Flaw A + exit), §25 (`b` tag); ADRs 0027/0028; tags-branch ADR 0015 (the legacy-literal incident that exposed the problem); handoff doc §2.

## W2 — Single-char tag namespace registry

**Status:** Open · raised 2026-06-09

Our specs are steadily claiming single-char (NIP-01 relay-indexed) tag letters: `z` (parent pointer), `n` (HAS_ELEMENT-inverse), `s` (IS_A_SUPERSET_OF-inverse), `b` (inherit-from). The direction principle ([class-thread-tags spec](./drafts/class-thread-tags.md), ex-BIBLE §23): lowercase = child-claims-parent; uppercase forms are reserved for parent-claims-child inverses (`B` explicitly reserved, unassigned) and must not be assigned speculatively. Candidate letters for `IS_A_PROPERTY_OF` and `REFERENCES` are TBD. **One registry table is needed across all our specs so future ADRs don't collide letters** — and to decide how it composes with letters other NIPs already use.

**Refs:** [class-thread-tags spec](./drafts/class-thread-tags.md) (direction principle, candidate letters; ex-BIBLE §23), BIBLE §25 (`b`/`B`); ADRs 0011, 0027.

## W3 — Polarity valence arc

**Status:** Open · raised 2026-06-09

Tagging events carry `polarity` `"1"` (apply) or `"-1"` (dispute); v1 semantics bucket `>= 0.5` as applied and `<= -0.5` as disputed, deliberately reserving the open interval `(-0.5, 0.5)` for a future graded-valence arc (GrapeRank-style weights in `[-1, +1]`). **The graded semantics are undesigned**: what does a 0.3 mean, who interprets it, and does the bucketing rule belong in the Tags spec or in trust-metric-interpreter territory?

**Refs:** tags-branch ADR 0001 (polarity wire format + v1 buckets); tags-branch follow-ups (valence arc deferred); handoff doc §6.

## W4 — `e` vs. `a` for parent-tag references

**Status:** Open · raised 2026-06-09

Tagging and pin events reference the tag they apply/pin by `e` (event id — pins a specific version) and/or `a` (address — survives the author's edits). The tags branch flagged this choice for re-evaluation in its own follow-ups: replaceable events make `e`-references go stale, while `a`-references change meaning under the author's later edits. **Which reference (or which combination, with what precedence) should the spec mandate, and does the answer differ for taggings vs. pins?**

**Refs:** tags-branch ADRs 0001/0009 + follow-ups; the same question shape appears in the DList compat companion (Method 2 mandates `a` for items pointing at kind-34550 events because they're replaceable; Method 3 rides on `z` tags instead).

## W5 — `REFERENCES` publishing semantics

**Status:** Open · raised 2026-06-09

The concept-level `REFERENCES` relationship (a non-committal "may pull later" bookmark between concepts) has no settled wire form. The open question — formerly recorded in BIBLE §23, now homed here (the [class-thread-tags spec](./drafts/class-thread-tags.md) points at this entry): **is it a consumer-owned tag on the consumer's own concept Header, or a separate "reference manifest" kind-39999 event?** Interacts with W2 (it's a candidate for a single-char letter) and with the registry exit in W1 (BIBLE §23 ties it to the flaw-A exit; §22's deferred list carries it only as a reserved-future candidate).

**Refs:** BIBLE §22 (deferred list); [class-thread-tags spec](./drafts/class-thread-tags.md) § "Direction principle and reserved letters" (ex-BIBLE §23); ADR 0006 line.

## W6 — Set-valued override algebra for Resolved Definition

**Status:** Open · raised 2026-06-09

Resolved Definition (BIBLE §26) is field-level in v1: a child's stated field replaces the inherited one wholesale. **How a child adds/removes/replaces individual *elements* of an inherited set** (e.g. "Alice's `dogs` minus Fido plus Rex") is explicitly deferred — by ADRs 0027 and 0028 — to the first consumer that needs it. When that consumer appears, the algebra belongs in the inherit-from spec.

**Refs:** BIBLE §25 (scope note), §26 (Scope v1); ADRs 0027/0028.

## W7 — `item-kind` interplay with concept headers

**Status:** Open · raised 2026-06-09

The DList compat companion introduces `item-kind` on list headers to declare which foreign event kinds a list accepts (e.g. kind 34550 NIP-72 communities as list items). Tapestry's concept headers carry their own conventions (`concept-graph` pointer, firmware schemas, `required`/`allowed` declarations). **Do these compose or compete?** E.g.: should Tapestry concept headers declare `item-kind`? Does a foreign-kind item participate in class threads (`n`/`s`) and inheritance (`b`)? Does the firmware JSON-schema mechanism subsume the header's schema-declaration tags or duplicate them?

**Refs:** `feat/communities:DECENTRALIZED_LISTS_COMPAT.md` (`item-kind`, Methods 2/3); BIBLE §5 (concept-graph tag), §7 (firmware schemas); [class-thread-tags spec](./drafts/class-thread-tags.md) § "Security considerations" (ex-BIBLE §23).
