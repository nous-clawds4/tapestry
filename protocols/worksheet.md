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

**Refs:** BIBLE §22 (community-reference model, Flaw A + exit); [inherit-from spec](./drafts/inherit-from.md) (`b` tag; ex-BIBLE §25); ADRs 0027/0028/0029 (community-reference); tags-branch ADR 0015 (the legacy-literal incident that exposed the problem); handoff doc §2; `docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md` (D5: dev fiat → registry → grapevine trajectory); [shared-concepts spec](./drafts/shared-concepts.md) (aggregation-policy home; § Cross-deployment identity states the trajectory).

## W2 — Single-char tag namespace registry

**Status:** Open · raised 2026-06-09

Our specs are steadily claiming single-char (NIP-01 relay-indexed) tag letters: `z` (parent pointer), `n` (HAS_ELEMENT-inverse), `s` (IS_A_SUPERSET_OF-inverse), `b` (inherit-from / pointer — element-3 typed, per `community-reference` ADR 0029). The direction principle ([class-thread-relationships spec](./drafts/class-thread-relationships.md), ex-BIBLE §23): lowercase = child-claims-parent; uppercase forms are reserved for parent-claims-child inverses (`B` explicitly reserved, unassigned) and must not be assigned speculatively. The candidate letter for `IS_A_PROPERTY_OF` is TBD (`REFERENCES` no longer needs a letter — it rides `b`'s `"pointer"` type, ADR 0029). **One registry table is needed across all our specs so future ADRs don't collide letters** — and to decide how it composes with letters other NIPs already use.

**Refs:** [class-thread-relationships spec](./drafts/class-thread-relationships.md) (direction principle, candidate letters; ex-BIBLE §23) and [inherit-from spec](./drafts/inherit-from.md) (`b`; ex-BIBLE §25); ADRs 0011, 0027, 0029 (community-reference).

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

**Status:** Open · raised 2026-06-09

Resolved Definition ([inherit-from spec](./drafts/inherit-from.md) § "Scope (v1)", ex-BIBLE §26) is field-level in v1: a child's stated field replaces the inherited one wholesale. **How a child adds/removes/replaces individual *elements* of an inherited set** (e.g. "Alice's `dogs` minus Fido plus Rex") is explicitly deferred — by ADRs 0027/0028, unchanged by 0029 — to the first consumer that needs it. When that consumer appears, the algebra belongs in the [inherit-from spec](./drafts/inherit-from.md)'s Scope section and operates over the inherit-typed deference closure only (pointer-typed `b` tags never participate). Note: ADR 0029's pointer-by-default reduces this entry's pressure — inheritance is now opt-in and rarer.

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

**Status:** Open · raised 2026-08-05

The b-coverage discipline (intake 2026-08-05, F5) wants every concept header dispositioned: wired to an external shared concept, self-declared, or **deliberately private**. The last state needs a durable marker so audit surfaces stop re-prompting. Candidate forms: **(a)** a sentinel `b` value — e.g. `["b", "b-tag-deferred"]` — a string that is neither an a-tag nor an event id (owner's lean; today's parsers already fail it closed: it matches neither value form, so resolvers render "cannot locate event" and the self-declared matcher can never equal it — surfaces would learn to skip it deliberately); **(b)** no `b` at all plus a local disposition record (brain/registry-style), keeping the wire clean at the cost of the marker not traveling with the header. Note the privacy wrinkle cuts both ways: a fully private header never leaves local strfry, so even a sentinel on it stays local until the header itself is published. Constraint either way: ADR 0029's element-3 registry is closed at `pointer | inherit` — a sentinel VALUE leaves the type registry untouched; a new "deferred" TYPE would need its own ADR. Graduation target: a ruling in [shared-concepts](./drafts/shared-concepts.md) (or a small ADR) + parser guidance in the b-tag surfaces.

**Refs:** `engineering-team/stories/_intake.md` 2026-08-05 entry (F5); community-reference ADR 0029 (registry closure); [inherit-from spec](./drafts/inherit-from.md) (b value forms); `ui/src/pages/shared-concepts/ActiveBTags.jsx` + `BTagDetail.jsx` (the parsers that would skip sentinels).
