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
- **`b`-edge aggregation** — a concept's incoming `INHERITS_FROM` edges, weighted by each child author's GrapeRank influence from the observer's PoV, yield "which definition my web of trust agrees on" (ADR 0027; [inherit-from spec](./drafts/inherit-from.md)). Candidate mechanism for the registry exit. Scoped by `community-reference` ADR 0029: the consensus signal counts **inherit-typed** edges only — pointer-typed `b` derives `REFERENCES` and carries zero consensus weight in v1; discovery walks include every type (`inherit-items` too — `dlist-curation` ADR 0003).

**Refs:** BIBLE §22 (community-reference model, Flaw A + exit); [inherit-from spec](./drafts/inherit-from.md) (`b` tag; ex-BIBLE §25); ADRs 0027/0028/0029 (community-reference); tags-branch ADR 0015 (the legacy-literal incident that exposed the problem); handoff doc §2; `docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md` (D5: dev fiat → registry → grapevine trajectory); [shared-concepts spec](./drafts/shared-concepts.md) (aggregation-policy home; § Cross-deployment identity states the trajectory).

## W2 — Single-char tag namespace registry

**Status:** Open · raised 2026-06-09

Our specs are steadily claiming single-char (NIP-01 relay-indexed) tag letters: `z` (parent pointer), `n` (HAS_ELEMENT-inverse), `s` (IS_A_SUPERSET_OF-inverse), `b` (inherit-from / pointer — element-3 typed, per `community-reference` ADR 0029). The direction principle ([class-thread-relationships spec](./drafts/class-thread-relationships.md), ex-BIBLE §23): lowercase = child-claims-parent; uppercase forms are reserved for parent-claims-child inverses (`B` explicitly reserved, unassigned) and must not be assigned speculatively. The candidate letter for `IS_A_PROPERTY_OF` is TBD (`REFERENCES` no longer needs a letter — it rides `b`'s `"pointer"` type, ADR 0029). **One registry table is needed across all our specs so future ADRs don't collide letters** — and to decide how it composes with letters other NIPs already use.

**Proposed (owner, 2026-10-09):** `o`, an auxiliary event's pointer to the DList header it serves ("the JSON Schema *of* Dog"), from [W25](#w25--auxiliary-events-of-a-dlist-header-o). It is lowercase because the auxiliary event names its header. Uppercase `O` is reserved for the inverse, the header naming its auxiliary events, and stays unassigned. Neither is adopted until W25 becomes a draft.

**Upstream overlap** (checked 2026-10-09 against `nostr-protocol/nips` master, `a79e21d`):
- `n` is also used by NIP-66 (relay network type), NIP-87 (mint network) and NIP-CC (geocache type modifier).
- `s` and `z` are also used by NIP-69 (order status, and document type `order`, on kind 38383).
- `q` is NIP-18's quote tag. [Assistant Designation](./drafts/assistant-designation.md) uses it with that meaning, for a curated copy's pointer to its original.
- `y` is NIP-69's platform tag.
- `b`, `B`, `o` and `O` appear in no NIP; nor do `j`, `v` or `w`.

A filter that names its kinds isn't affected by the overlap. Only a tag query without `kinds` would mix our events with theirs.

**Refs:** [class-thread-relationships spec](./drafts/class-thread-relationships.md) (direction principle, candidate letters; ex-BIBLE §23) and [inherit-from spec](./drafts/inherit-from.md) (`b`; ex-BIBLE §25); ADRs 0011, 0027, 0029 (community-reference); [W25](#w25--auxiliary-events-of-a-dlist-header-o) (`o`).

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

**Refs:** [inherit-from spec](./drafts/inherit-from.md) (resolving authority); `community-reference` ADR 0029; BIBLE §22 (collision contract, deferred list updated); [class-thread-relationships spec](./drafts/class-thread-relationships.md) § "Direction principle and reserved letters" (ex-BIBLE §23); ADR 0006 line.

## W6 — Set-valued override algebra for Resolved Definition

**Status:** Open — narrowed 2026-09-10 (additive case specified; removal/replacement remains) · first consumer withdrew 2026-09-12 · raised 2026-06-09

Resolved Definition ([inherit-from spec](./drafts/inherit-from.md) § "Scope (v1)", ex-BIBLE §26) is field-level in v1: a child's stated field replaces the inherited one wholesale. **How a child adds/removes/replaces individual *elements* of an inherited set** (e.g. "Alice's `dogs` minus Fido plus Rex") is explicitly deferred — by ADRs 0027/0028, unchanged by 0029 — to the first consumer that needs it. When that consumer appears, the algebra belongs in the [inherit-from spec](./drafts/inherit-from.md)'s Scope section and operates over the inherit-typed deference closure only (pointer-typed `b` tags never participate). Note: ADR 0029's pointer-by-default reduces this entry's pressure — inheritance is now opt-in and rarer.

**Update 2026-09-10 (`dlist-curation` ADR 0003):** the first list-bearing consumer arrived — the assistant-authored curation header. The **additive** case is now specified in the [inherit-from spec](./drafts/inherit-from.md) § "Resolution: the resolved item set" as the `"inherit-items"` type (union over an items-deference closure; a candidate set trust-filtered per item at read time). What remains open here is **removal and replacement** of inherited items; when designed it operates over the items-deference closure, not the definition closure.

**Update 2026-09-12 (`curated-dlist-update` ADR 0001):** the first consumer withdrew — curated lists select items by copying them ([assistant-designation spec](./drafts/assistant-designation.md) § "Curation copies"), and removal there is a deletion, not set algebra. The additive case stays specified for `"inherit-items"`; removal and replacement of inherited items remain open.

**Refs:** [inherit-from spec](./drafts/inherit-from.md) § "Scope (v1)" (ex-BIBLE §25/§26); ADRs 0027/0028/0029 (community-reference).

## W7 — `item-kind` interplay with concept headers

**Status:** Open · raised 2026-06-09

The DList compat companion introduces `item-kind` on list headers to declare which foreign event kinds a list accepts (e.g. kind 34550 NIP-72 communities as list items). Tapestry's concept headers carry their own conventions (`concept-graph` pointer, firmware schemas, `required`/`allowed` declarations). **Do these compose or compete?** E.g.: should Tapestry concept headers declare `item-kind`? Does a foreign-kind item participate in class threads (`n`/`s`) and inheritance (`b`)? Does the firmware JSON-schema mechanism subsume the header's schema-declaration tags or duplicate them?

**Refs:** `feat/communities:DECENTRALIZED_LISTS_COMPAT.md` (`item-kind`, Methods 2/3); BIBLE §5 (concept-graph tag), §7 (firmware schemas); [class-thread-relationships spec](./drafts/class-thread-relationships.md) § "Security considerations" (ex-BIBLE §23).

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

**Status:** Graduated → [stamping spec](./drafts/stamping.md) (convention) + [shared-concepts spec](./drafts/shared-concepts.md) § Clouds (cloud model) · raised 2026-06-12 · resolved 2026-06-13

`community-reference` ADR 0029 ratified the *position* that deliberately-published list items MAY carry multiple `z` stamps; the *practice* (cloud membership, rotation, the stamping rule, re-stamping) was open, the motivating constraint being local-first publication (public aggregation cannot depend on unpublished personal headers, so a stamped item must be self-contained).

**Resolution (`community-reference` ADR 0033, frame ratified — tuning deferred).** The **cloud** is the **derived top-k of the W1 grapevine-resolved consensus signal** — never a published object/manifest (no curator; no-privileged-center); membership is consensus rank, and mutual pointer-`b` edges are the author's *navigation* to the cloud, not a gate. **Rotation is emergent** (nobody governs it; author and consumer recompute), following the §22 trajectory `grapevine-resolved → firmware-blessed → none`; organic clouds bootstrap from singletons. Stamping is **affiliation-anchored** (stamp the declared community's cluster, not the concept-global top-k). A stamped item carries the **personal `z`** (required, ≥1) **plus up to a cap of cloud handles**; **`z` order is not load-bearing** (consumers MUST NOT depend on it). Re-stamp on rotation is **lazy author re-emit** (same `d`-address, kind 39999), with named lossiness (foreign-authored/inactive/kind-9999 items). The cloud is **containment-only** — membership assertions keep the single shared applied-concept handle. **Deferred to implementation:** the exact cap `k` (~5), the ranking formula, the firmware cold-start cluster contents. Design-only, gated on the resolver + on-wire `b`-tags behind the three-branch reconciliation.

**Refs:** [stamping spec](./drafts/stamping.md) (resolving home for the convention) + [shared-concepts spec](./drafts/shared-concepts.md) § Clouds (cloud model), via the pointer at [tapestry-concepts spec](./drafts/tapestry-concepts.md) § "Multi-`z` stamping"; `community-reference` ADR 0033; `docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md` (D1 rev 2, O11/O12, the local-first constraint) + the 2026-06-13 scope conversation; `community-reference` ADR 0029; base NIP [decentralized-lists](./nips/decentralized-lists.md) § Item declaration (multi-`z` permitted, one-`z` recommended).

## W12 — Must a personalized-WoT service-provider support arbitrary POVs?

**Status:** Open · raised 2026-06-18

[Open Ranking](https://github.com/Open-Ranking/protocol) (ORE — an external HTTP protocol for nostr WoT/ranking that the `open-ranking` epic implements) lets a client pass **any** `pov` pubkey to a `pov:true` algorithm. The protocol author's reflex (per the 2026-06-18 scoping discussion) is that **every** WoT service-provider should answer for **any** POV. Brainstorm's architecture says otherwise: per-POV WoT columns (`wot_<metric>_<suffix>`) are **provisioned**, not computed on demand — they exist only for the owner, the configured house POV, and provisioned customers (prod carries ~3). No query-time path computes GrapeRank + loads columns for a brand-new POV. The `open-ranking` book therefore returns **`422` + `X-Reason`** for an unprovisioned `pov` rather than silently serving the house view under the caller's label (POV invariant: don't present a global answer as a personal one).

Open questions: **(1)** Is a non-ORE, Tapestry-namespaced **availability probe** ("is this `pov` provisioned?") worth building — and does an *unauthenticated* probe leak the customer set (for non-house POVs, availability ≈ customer-ness), forcing it behind ORE-A/NWT auth or a self-only check? **(2)** Is it worth **proposing a standard availability / declared-POV mechanism upstream** to ORE, or is the conformant-without-it posture (offer `pov:true`, `422` on unknown) sufficient? Note the same provisioned-POV constraint already shapes what NIP-85 (kind 30382) publishes, so this is intrinsic to "personalized WoT is expensive," not ORE-specific.

**Review finding (open-ranking #1, 2026-06-18):** the shipped `graperank-personalized` `/stats/pubkey` algorithm is *itself* this oracle — an unauthenticated caller distinguishes provisioned (`200`) from unprovisioned (`422` `pov not provisioned`) POVs, enumerating the customer set. Acceptable on **staging** (test data); a **hard gate before any prod promotion** — gate the `pov:true` path behind ORE-A/NWT auth or a self-only check (open question 1, option A/B) first.

**Refs:** `engineering-team/audits/open-ranking/book.md` (acceptance frame; the `422` decision); ORE-01 + ORE-00 (capability doc + conventions, `github.com/Open-Ranking/protocol`); `src/api/_shared/pov.js` (POV→delegate→suffix resolution); `src/algos/nip85/loadScoresIntoMeilisearch.js` + `src/algos/customers/nip85/` (the three POV loaders); the `pov-resolution` epic; BIBLE NIP-85 publishing tables.

**2026-08-12 update (`ore-pov-availability` #1):** open question **(2)** is resolved — we proposed upstream. A submission-ready ORE-01 "Unavailable pov" subsection (error + MUST-NOT-substitute + `X-Reason` guidance + the `202`/`Retry-After` split for still-computing POVs) is drafted per the maintainer-endorsed solution 1 of [Open-Ranking/protocol#8](https://github.com/Open-Ranking/protocol/issues/8): `protocols/upstream/ore-01-pov-unavailable.md`, **submitted 2026-08-13 as [Open-Ranking/protocol#9](https://github.com/Open-Ranking/protocol/pull/9)** (if it merges with edited wording, a cosmetic `X-Reason` re-phrase follow-up applies — ADR `ore-pov-availability/0001` §Consequences). Local alignment (informative refusal, never-substitute test pins, `/developers/open-ranking` docs): ADR `ore-pov-availability/0001`. Open question **(1)** — the enumeration-oracle / auth half (the ADR `open-ranking/0005` gate) — remains open and untouched.

**2026-09-17 update:** maintainer review on [PR #9](https://github.com/Open-Ranking/protocol/pull/9) (2026-08-28): approved — *"The PR is perfect"* — and asked for the ORE-08 gap (flagged as an aside in the PR description) to be fixed in the same PR. The ORE-08 pov-parity text (request-table `pov` field + ORE-01 delegation sentence + missing-`pov` and cannot-serve error rows) is now in the artifact's § "Proposed spec text (08.md)", applied to the PR by the author; awaiting merge. OPEN.md row 304 watches the merge (successor to row 176).

## W13 — Cross-store POV identity: main pubkey (Neo4j cards) vs delegated-key suffix (Meili columns)

**Status:** Open · raised 2026-06-19

A single POV is keyed by **two different pubkeys** depending on the store, which blocks a uniform `pov` identifier across ORE endpoints:

- **Neo4j `NostrUserWotMetricsCard`** (backs ORE-02 `/stats/pubkey`) is keyed by `observer_pubkey` = the human's **main pubkey** (`CUSTOMER_PUBKEY`; owner uses the `NostrUser` node directly).
- **Meili `wot_<metric>_<suffix>` columns** (back ORE-05 `/search/pubkeys`) are keyed by `suffix = delegatedPubkey.slice(0,8)`, where `delegatedPubkey` is a **delegated key** — the **TA** for the owner (`getOwnerAssistantPubkey()`, `src/algos/nip85/loadScoresIntoMeilisearch.js:38,49`) and the **relay key** for a customer (`getCustomerRelayKeys(main).pubkey`, `src/algos/customers/nip85/loadScoresIntoMeilisearch.js:35-36`).

So `/stats/pubkey` personalized (Story 1, shipped) takes `pov` = main pubkey; a naive `/search/pubkeys` personalized would need the delegated suffix, and the search proxy's only main→delegated bridge today is the per-user prefs file (`rankAuthor`, `src/api/_shared/pov.js`), which external ORE callers don't have → it **silently falls back to the house POV** (violates the `422`-honesty rule).

**Resolution direction (planned for `open-ranking` Story 3 — `search-personalized`):** keep ORE `pov` = the human's **main pubkey everywhere**, and add a server-side resolver `resolveProvisionedDelegate(mainPubkey)` → owner-TA (config) / customer-relay-key (`getCustomerRelayKeys`) / `null`. `/stats/pubkey` already uses the main pubkey directly; `/search/pubkeys` personalized resolves main→delegated→suffix, checks the Meili columns exist (readiness check), and `422`s when unprovisioned — no prefs-file dependency, consistent semantics. Open sub-questions: how to treat inactive / mid-provisioning customers; whether the "global" algorithm should rank under the **owner TA suffix** (to match Story 1's owner-baseline global stats) vs the configurable **house delegate** the search proxy defaults to for logged-out users.

**Refs:** `engineering-team/epics/open-ranking.md` (Story 3); `src/api/export/users/queries/get-profile-scores.js` (card keying = main pubkey); `src/api/search/profiles/meili/index.js:142` (proxy `resolvePov`, prefs-based) + `src/api/_shared/pov.js`; the two Meili loaders above; `getCustomerRelayKeys` (`src/api/customers/`); related: W12 (the personalized-endpoint enumeration oracle).

## W14 — Subset/ancestor stamping (z-expansion across class-thread structure)

**Status:** Resolved → [stamping spec](./drafts/stamping.md) § "Layer selection (set × branch) — settled" + [shared-concepts spec](./drafts/shared-concepts.md) § Reach · raised 2026-07-12 · resolved 2026-07-13

Which `z` stamps does a deliberately-published item carry beyond the ratified minimum (personal + joined-concept cloud handles)? The space is two-dimensional ([stamping spec](./drafts/stamping.md) § "Layer selection (set × branch) — settled"): **set layers** climbed via `s` ([class-thread-relationships spec](./drafts/class-thread-relationships.md); fine→coarse; the ladder is dynamic — rungs appear over time) × **branch layers** reached through the author's `b` graph (proximal→distal; **indirect linkage valid**; reach is affiliation-backed — no `b`-path, no candidate stamp; the transitive-correspondence ("correspondence closure") semantics are themselves unspecified). Candidate selection principles, all non-normative: anticipated filter demand on either axis; proximal+distal endpoints per layer (which reproduces the ratified shape at the joined layer); read-time inference as the capability-dependent complement (smart clients recover omissions; dumb clients don't — the write-time selection sets the interop floor for non-expanding clients, which is the real stake). Binding constraint from the stamping read contract: whichever shape lands MUST co-state what non-expanding readers may assume. Successor question to graduated [W11](#w11--cloud-formation--multi-z-stamping-rules), carved out at `nip-reorg` S3; framing refined 2026-07-12 (protocol author + Vinney, S3 amendment gate).

**Resolution (`w14-settlement` ADR 0001, 2026-07-13).** (A) The correspondence-closure question resolved by the three-term split — *affiliation* (one declared hop) / *deference closure* (inherit-typed, unchanged) / **reach** (any-type transitive, [shared-concepts spec](./drafts/shared-concepts.md) § Reach) — with reach **permission-shaped** (third-party edges enable, never route) and **publisher-side only** (SHOULD; never a reader validity gate — spam control is observer-weighted trust). (B) Layer selection resolved as **floor-plus-extras**: the ratified floor unchanged; optional demand-selected intersections within the cap, drawn from reach; ancestors never required; the read contract completed (breadth queries MUST expand via the derived superset walk or accept the defined non-expanding floor).

**Refs:** [stamping spec](./drafts/stamping.md) § "Layer selection (set × branch) — settled"; [class-thread-relationships spec](./drafts/class-thread-relationships.md); `docs/NIP_REORG_DESIGN_HANDOFF.md` O1; `nip-reorg` ADR 0003.

## W15 — Instance identity: is "me" the TA, the owner, or their union?

**Status:** Graduated → BIBLE §31 ("The Self and Its Keys") · raised 2026-08-05 · resolved 2026-08-05

Specs and features keep reaching for a first person — the stamping floor's "personal `z`" ([stamping spec](./drafts/stamping.md)), [shared-concepts](./drafts/shared-concepts.md) aggregation's observer, the S-subset definitions (S2a/S3a "where I am the user" — see the 2026-08-05 intake entry) — but a deployment holds several keys: the owner's main pubkey, the TA, and (multi-tenant) customers' relay keys. W13 already documents the main-vs-delegated split fracturing POV identity across stores. **Whose pubkey is the instance's "me"?**

Owner-proposed direction (2026-08-05, leaning): **the Tapestry instance has its own identity, separate from the Tapestry Owner, and the TA pubkey is that identity.** The owner is a distinct correspondent: owner-authored events meriting absorption into the instance's brain are re-minted by the TA (the restore-brain precedent — second-brain ADR 0008 re-mints a foreign export verbatim under the target's TA) or referenced by a TA-authored pointer event, exactly like any third party's content. "Slightly less frugal, but cleaner." Compatible with W13's ORE direction (external callers name humans by main pubkey; the instance's own selfhood is the TA) and with existing practice (house POV = the instance's default delegate; brain writes sign as TA; Meili owner columns key on the TA suffix). Costs to weigh: duplication vs pointer choice per absorption (duplicate = first-class owned state the TA can evolve/re-sign; pointer = provenance preserved, no copy drift); the NIP-07 client-signed authoring flows (tapestries signAs, profile tags) become owner-letters the TA may absorb — the tapestries-#7 client-signed-path ADR question resolves against this doctrine. Graduation target: a docs-mode ADR + BIBLE statement (self-ontology-adjacent; §30 governs stores, this governs keys).

**Resolution (`self-ontology` ADR 0002, 2026-08-05 — BIBLE §31 "The Self and Its Keys").** The instance is **its own person; the TA pubkey is its key**; the Tapestry Owner is a distinct, maximally-trusted **correspondent** (the Owner is Tony Stark; the TA is Jarvis). Every first-person query answers `authors:[TA]` — the intake entry's S2a/S3a reduce to one author filter. The external layer is untouched: readers resolving a *human's* headers keep [assistant-designation](./drafts/assistant-designation.md)'s personal-wins rule, ratified as a custody-asymmetry security posture (hot server key must never shadow the cold interactive key). Owner letters enter the brain only by **explicit absorption** — re-mint (ADR 0008 precedent) or TA-authored pointer — chosen per feature in that feature's ADR; the tapestries-#7 owner lane is ruled an eager near-term absorption, with stage-2 ingest (OPEN.md #136) inheriting the general provenance lane (no permanent "counts as me" carve-out). Normative for the single-owner deployment; multi-tenant is direction only (persona → delegated key, per W13). Identity attaches to the instance, not the key custodian — the sysadmin/LLM-operator scenario is the proof.

**Refs:** W13; [stamping spec](./drafts/stamping.md) write rule item 1; second-brain ADR 0008; `engineering-team/stories/_intake.md` 2026-08-05 entry (F0); BIBLE §30; **BIBLE §31 + `self-ontology` ADR 0002 (resolving authority)**; `docs/INSTANCE_IDENTITY_DESIGN_HANDOFF.md` (scoping record, superseded).

## W16 — Marking "deliberately no shared affiliation": sentinel b-value vs local disposition

**Status:** Graduated → [shared-concepts spec](./drafts/shared-concepts.md) § "Deliberate non-affiliation" + [inherit-from spec](./drafts/inherit-from.md) § "The `b` tag" (reserved value) · raised 2026-08-05 · resolved 2026-08-06

The b-coverage discipline (intake 2026-08-05, F5) wants every concept header dispositioned: wired to an external shared concept, self-declared, or **deliberately private**. The last state needs a durable marker so audit surfaces stop re-prompting. Candidate forms: **(a)** a sentinel `b` value — e.g. `["b", "b-tag-deferred"]` — a string that is neither an a-tag nor an event id (owner's lean; today's parsers already fail it closed: it matches neither value form, so resolvers render "cannot locate event" and the self-declared matcher can never equal it — surfaces would learn to skip it deliberately); **(b)** no `b` at all plus a local disposition record (brain/registry-style), keeping the wire clean at the cost of the marker not traveling with the header. Note the privacy wrinkle cuts both ways: a fully private header never leaves local strfry, so even a sentinel on it stays local until the header itself is published. Constraint either way: ADR 0029's element-3 registry is closed at `pointer | inherit` — a sentinel VALUE leaves the type registry untouched; a new "deferred" TYPE would need its own ADR. Graduation target: a ruling in [shared-concepts](./drafts/shared-concepts.md) (or a small ADR) + parser guidance in the b-tag surfaces.

**Resolution (owner decision 2026-08-06 at `/discuss`; ratified via `shared-concepts-adoption` ADR 0001, F5 story #1).** **Option (a) — the sentinel** — after weighing the local-disposition alternative: exactly the reserved literal `["b", "b-tag-deferred"]`, no variants, no type element. The wire ruling landed as a **reserved value** in [inherit-from](./drafts/inherit-from.md) § "The `b` tag" (a value, not a type — ADR 0029's registry untouched) with semantics in [shared-concepts](./drafts/shared-concepts.md) § "Deliberate non-affiliation": a disposition marker, not a correspondence claim — zero weight in every aggregate, excluded from reach/closure/clouds, replaced (never accumulated) when a real affiliation arrives. Parser guidance shipped with the ruling: the strfry→Neo4j chokepoint derives edges only for the two locator forms (no phantom target nodes — `src/lib/bValueForms.js` is the single code owner), and the b-surfaces skip the sentinel by name, rendering it as its own state rather than a failed lookup. The owner's original three-action disposition stands: wire external / auto b-tag / keep private; the "auto-b unpublished" half-state was dropped.

**Refs:** `engineering-team/stories/_intake.md` 2026-08-05 entry (F5); community-reference ADR 0029 (registry closure); [inherit-from spec](./drafts/inherit-from.md) (b value forms + the reserved value); [shared-concepts spec](./drafts/shared-concepts.md) § "Deliberate non-affiliation" (resolving authority); `shared-concepts-adoption` ADR 0001 + story `stories/shared-concepts-adoption/1-b-coverage-audit-and-disposition.md`; `ui/src/pages/shared-concepts/ActiveBTags.jsx` + `BTagDetail.jsx` (the parsers, now skipping deliberately).

## W17 — Upstream kinds `30386` / `30387` / `30396` / `30397`

**Status:** Closed — accepted 2026-09-27 · raised 2026-09-27

Four new Trusted Assertion / Trusted List kinds:
- `30386` / `30396` — a Score about a DList item, and a list of DList items;
- `30387` / `30397` — a Score about a list, and a list of lists (`z` members).

None exists in NIP-85. **Question:** propose all four upstream together with the `3039x` list family, or keep them Tapestry-internal for now?

**Suggested:** propose together, alongside the Treasure Maps key grammar.

**Decision (2026-09-27):** ✅ accepted. Propose all four together, as part of the Trusted Lists family, **not** as an amendment to NIP-85 for now. A NIP-85 update can follow later.

**Refs:** [treasure-maps](./drafts/treasure-maps.md) § 4.2; [dlist-header-declaration](./drafts/dlist-header-declaration.md) § 5.1; [amendments-2026-09](./drafts/amendments-2026-09.md) § 6.

## W18 — Descriptor tag letters `K` / `Z` / `T`

**Status:** Closed — rejected 2026-09-27; the pinning replacement is under review in its own issue · raised 2026-09-27

Uppercase descriptor tags describe what a Trusted List (or a pinning context) is about:
- `K` — a kind or NIP-73 type;
- `Z` — a category by coordinate or event id;
- `T` — the Tag or Pin.

NIP-22 uses uppercase `K` for the same meaning, and also uses `E`, `A`, `I` and `P`.

**Suggested:** keep all three; check `Z` and `T` against any newer NIPs before publication.

**Decision (2026-09-27):** ❌ rejected. Consequences:
- Trusted Lists drop `K` / `Z` / `T`. Lists are found by their exact `d` key; browsing by category or Tag happens client-side.
- Pinnings still need a way to say "for this category". Proposed replacement: one multi-letter `["context", <coordinate>]` tag, not relay-indexed. It is under review in a separate issue ([#762](https://github.com/nous-clawds4/tapestry/issues/762)).

**Refs:** treasure-maps § 5.5; [content-categories](./drafts/content-categories.md) § 2; [pins](./drafts/pins.md) § 3; [W2](#w2--single-char-tag-namespace-registry).

## W19 — Tag-element as its own list header (retire the per-tag tagging header)

**Status:** Open — on hold 2026-09-27, pending Vinney's review · raised 2026-09-27

Pubkey taggings name their Tag directly; event taggings name it indirectly, through a per-tag header. Two shapes, one idea.

**Suggested:** for new work, make the tag-element a declared header (`["z", "list"]`, `names`), and have every tagging point its `z` at it directly. Readers union both shapes during the transition. Wire-impactful.

**Decision (2026-09-27):** ⏸ on hold. To be opened as a Tapestry issue for Vinney to review.

**Refs:** [docs/reviews/tags-nip-review-2026-09.md](../docs/reviews/tags-nip-review-2026-09.md) point 3; pins § 2; [W10](#w10--taggings-family-naming--expansion); review issue [#761](https://github.com/nous-clawds4/tapestry/issues/761).

## W20 — Hashed target in assertion `d` tags

**Status:** Open — reportedly fixed on Vinney's branch; not yet on `main` · raised 2026-09-27

`event-tag-<descriptor>-<target8>-<asserter8>` takes `target8` from an `a` target's *author* segment, so two targets by the same author collide.

**Suggested:** `target8` = the first 8 hex characters of sha256 of the full target value. It's the same rule the Pins draft uses (pins § 3.1).

**Decision (2026-09-27):** reportedly already addressed by Vinney. Not yet visible on `main`, where `event-taggings.md` still takes `target8` from the author segment; check his branch before closing.

**Refs:** tags review point 1; [event-taggings](./drafts/event-taggings.md) § The assertion d-tag.

## W21 — Category hints on taggings (`Z` / `K`)

**Status:** Closed — rejected 2026-09-27 · raised 2026-09-27

Finding "Mexican taggings of items in Restaurants in Nashville" takes a scan and an intersection, because a tagging doesn't carry its target's category.

**Suggested:** an optional `["Z", <DList coord>]` or `["K", <kind>]` on taggings. It's a hint, never a gate: readers still verify membership.

**Decision (2026-09-27):** ❌ rejected.

**Refs:** tags review point 6; [spawning](./drafts/spawning.md) § 3.2.

## W22 — Private insights and preferences

**Status:** Closed — approved 2026-09-27 · raised 2026-09-27

Three things want privacy:
- pinnings;
- Treasure Map entries (NIP-85 `.content`);
- Trust Determination Methods.

**Suggested — one pattern for all three:** a private item is published by the owner's Assistant and NIP-44-encrypted to itself, marked `["private", "1"]`, and counts only for its owner.
- Delegation entries in the Map stay public until NIP-85's current private-entry text is checked.
- Trust Determination Methods already follow this pattern.

**Decision (2026-09-27):** ✅ approved.

**Refs:** pins § 9; treasure-maps § 13 Q8; [trust-determination-methods](./drafts/trust-determination-methods.md) § 4.

## W23 — Applicability as the community default for Tag pinnings

**Status:** Closed — approved 2026-09-27 · raised 2026-09-27

**Suggested:** for a generic `spawns-trusted-list` pinning, community(Tag, C) = applicability (hints plus usage), weighted by trust from the owner's point of view. Pinnings adjust it. Applicability hints extend to every content category (`tag-for-kind:<k>`, `tag-for-dlist:<coord>`).

**Decision (2026-09-27):** ✅ approved, including extending the applicability hints to every content category.

**Refs:** pins § 6.2; spawning § 3.5; amendments § 4; [tags](./drafts/tags.md) § Applicability hints.

## W24 — Tag hierarchy (parent and child Tags)

**Status:** Open · raised 2026-09-27

Tags need parent–child relationships in which the child's domain is a subset of the parent's: *Baseball* is a child of *Sports*.

- **Direction.** Implication runs child → parent. Something tagged Baseball is also Sports; something tagged Sports is not necessarily Baseball.
- **Search and lists expand downward.** A search for Sports, or the Sports Trusted List, includes everything tagged with any descendant of Sports.
- **Pins.**
  - Pinning *Sports* to *Spawns a Trusted List* gives a Sports list that already includes Baseball content.
  - It does **not** also spawn a separate list per child by default, because each list costs the Assistant real work. "Include subtopics as separate lists" could be an explicit option.
  - A pin on a child is more specific than a pin on its parent, and wins (the usual most-specific rule).
- **Pinning contexts** can nest the same way, for example Restaurants in Nashville ⊂ Restaurants in Tennessee. A context covers its subsets, and the most specific pin wins.
- **Mechanism, candidate:** the class-thread `s` tag ("subset of"), which already exists. A community-curated relationship list is the alternative.
- **Open question: whose job is it to state that Tag A is a parent of Tag B?**
  - the author of A;
  - the author of B;
  - or a third party.

  The owner's inclination is a **third party**. That argues against `s`, which is authorship-gated, and for a community-curated relationship list, judged per point of view like any other list. To be discussed.

**Refs:** [class-thread-relationships](./drafts/class-thread-relationships.md); [stamping](./drafts/stamping.md) (breadth queries must expand); tags review point 8; pins § 6.2; [W14](#w14--subsetancestor-stamping-z-expansion-across-class-thread-structure).

## W25 — Auxiliary events of a DList header (`o`)

**Status:** Open — revised 2026-10-09: lowercase `o` replaces uppercase `Z` · raised 2026-10-03

A DList header grows up. It starts with items only, then gains subsets, a JSON Schema, opinionated view briefs and other structural nodes. Those events are *about* the header, but they aren't items of it:

- A `z` tag makes an event an item, so `z` can't carry this.
- Tapestry's core nodes ([tapestry-concepts](./drafts/tapestry-concepts.md) § Core nodes of a concept) are tied to their header by deterministic `d` tags and by their payload (`word.coreMemberOf`). That works only when the header's own author publishes them. A third party's JSON Schema or view brief for someone else's header has no dedicated, relay-indexed way to say which header it serves.

**First suggestion (owner, 2026-10-03):** lowercase `z` marks items of the DList; uppercase `Z` marks auxiliary events specific to it, with the event's role as the third element: `["Z", "<a-tag of the DList header>", "opinionated-view"]`. Replaced by the revision below.

**Revised (owner, 2026-10-09):** the auxiliary event names its header with a lowercase `o` ("of": the JSON Schema *of* Dog), and its role is the third element:

```json
["o", "<a-tag of the DList header>", "json-schema"]
["o", "<a-tag of the DList header>", "superset"]
["o", "<a-tag of the DList header>", "opinionated-view"]
```

- **One query finds them all.** `{"#o": ["<a-tag of the DList header>"]}` returns every auxiliary event of a header, whoever published it. Relays index only a tag's first value, so filtering by role happens in the client. A header has few auxiliary events, so that's cheap.
- **`z` stays.** A JSON Schema node is an item of the `json-schema` concept (its `z`) and auxiliary to Dog (its `o`). `z` says what the event is; `o` says which header it serves.
- **The role is the role concept's slug:** `superset`, `json-schema`, `primary-property`, `properties-set`, `property-tree-graph`, `concept-graph`, `core-nodes-graph`, `opinionated-view`. It is not free text, and not a coordinate: a coordinate differs on every deployment ([W1](#w1--cross-deployment-concept-identity)), and the slug doesn't. The event's `z` still names the role concept by coordinate.
- **Anyone can publish one.** A third party's JSON Schema for someone else's header carries the same `o`. Which one counts is decided per point of view when it's read, as for any other assertion.
- **Uppercase `O` is reserved and unassigned.** It would be the inverse: the header naming its auxiliary events. Nothing needs it yet. The `#o` query, `coreNodesGraph.constituents` and the header's `concept-graph` tag already cover that direction. If it's ever added, it means "the header author's pick": one voice among many, and a header republish each time the pick changes.
- **Why `o`.** The owner first suggested `y` or `q`. `q` is NIP-18's quote tag, and [Assistant Designation](./drafts/assistant-designation.md) already uses it for a curated copy's pointer to its original, so `#q` on a header would mix quotes, copies and auxiliary events. `y` is NIP-69's platform tag. No NIP uses `o` ([W2](#w2--single-char-tag-namespace-registry) has the check).

**Where the earlier questions stand:**

- **Earlier rejections.** `Z` was rejected twice on 2026-09-27: as a descriptor on Trusted Lists and pinning contexts (W18), and as a category hint on taggings (W21). Both meant "this event is about X but isn't a member of it", which is close to this meaning. A new letter removes the clash over `Z`, but not that question: the draft must still say why this pointer is different. A possible answer: those were hints added to assertions and lists to make browsing cheaper, while an auxiliary event exists to serve its header, so the pointer says what the event is for.
- **The direction convention.** Answered. Class Thread Relationships reserves uppercase letters for parent-claims-child inverses and says not to assign them speculatively. Lowercase `o` follows the same pattern as `z`, `n`, `s` and `b`: the event names what it belongs to. Recorded in W2.
- **The need.** Unchanged. Opinionated Views works without it: briefs are items of an *Opinionated Views* DList (`z`), name their category in a plain tag, and are filtered client-side (opinionated-views § 7.2). So `o` has to earn its place in the general case, such as third-party core nodes for any header, where client-side filtering doesn't scale. The alternative that needs no new letter is an `a` tag with a role marker. Relays index it today, but `a` already means many things, so `#a` also returns every mention of the header.
- **Roles.** Answered: the role concept's slug (above).

**Still to settle before drafting:**

- Whether the header author's own core nodes also carry `o`, so one query covers every case, or keep relying on deterministic `d` tags and `word.coreMemberOf`.
- Whether the roles are a closed list, like the `b` tag's types, or any slug; and how a reader treats an absent or unknown role.
- Which kinds may carry `o`: kind `39999` only, or any event.
- Where the draft lives. [tapestry-concepts](./drafts/tapestry-concepts.md) covers Tapestry's core nodes, but view briefs and other auxiliary events belong to any DList, which argues for a pre-NIP of its own.

**Refs:** [opinionated-views](./drafts/opinionated-views.md) § 7.2; [tapestry-concepts](./drafts/tapestry-concepts.md) § Core nodes of a concept; [class-thread-relationships](./drafts/class-thread-relationships.md) (direction principle); [assistant-designation](./drafts/assistant-designation.md) (`q`); [W1](#w1--cross-deployment-concept-identity); [W2](#w2--single-char-tag-namespace-registry); [W18](#w18--descriptor-tag-letters-k--z--t); [W21](#w21--category-hints-on-taggings-z--k).

## W26 — DList items in search results

**Status:** Open · raised 2026-10-03

[Opinionated Views](./drafts/opinionated-views.md) says how a DList item looks once it is in a search result. Nothing yet says whether it gets there. Four questions, raised while scoping that draft and deliberately left out of it (owner, 2026-10-03):

1. **Which DLists are searched?** Every header on the relay, the House's Dictionary, or the viewer's own Dictionary.
2. **What does a query match?** The item's name, its description, its field values, or the header's names ("GitHub Accounts" matching "github").
3. **How do results rank from the viewer's point of view?** By the number of trusted filers, or by membership in a Trusted List spawned from the DList ([spawning](./drafts/spawning.md)).
4. **Where do they appear?** A chip per DList, or one "Lists" chip. [content-categories](./drafts/content-categories.md) § 3.2 says the chips come from a display Pin, `search-chips`, but [pins](./drafts/pins.md) § 8.2 doesn't define it: its only display Pin is `profile-page-tags`.

Parts exist: content-categories (the categories and the chip idea), [filters-on-dlists](./drafts/filters-on-dlists.md) (a stub proposing a `dlists` field on relay filters, with the viewer passed for trust filtering), spawning and [trusted-lists](./drafts/trusted-lists.md) (ranked lists). Nothing ties them together for search. It is as much a product question (what's in the first version, and for whom) as a protocol one.

**Refs:** opinionated-views § 2.1 (the default DList card) and its State line; content-categories § 3.2; pins § 8.2; filters-on-dlists; spawning.
