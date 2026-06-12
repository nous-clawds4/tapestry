# `b`-Tag Affiliation Architecture — Design Handoff

**Status:** 🔴 OPEN — design settled in scoping (this doc); **nothing ratified yet**. Ratification pieces P1–P4 (§5) each await a docs-mode story. Flip to ✅ SUPERSEDED as the pieces land in `protocols/` + BIBLE.

**Created:** 2026-06-12, from a Protocol-Spec scoping session (Phase 1: conversation + two grounding audits over the spec corpus and the live instance).
**Builds on:** [`protocols/drafts/inherit-from.md`](../protocols/drafts/inherit-from.md) (the `b` tag / Resolved Definition; ADRs 0027/0028, BIBLE §25/§26); BIBLE §22 (`communityReference`, Flaw A, the community-reference model); [`protocols/drafts/communities.md`](../protocols/drafts/communities.md) (founding tenet, personal records); [`protocols/worksheet.md`](../protocols/worksheet.md) W1/W5/W6.
**Related:** [`docs/COMMUNITIES_PROTOCOL_DESIGN_HANDOFF.md`](./COMMUNITIES_PROTOCOL_DESIGN_HANDOFF.md) — still OPEN on §7 three-branch reconciliation, which **sequences any implementation** of this design (docs ratification can proceed now).
**Audience:** the protocol author + future ratifying sessions (docs-mode stories under the `community-reference` epic lineage).

> **Why this doc exists.** A proposal — "every local DList header carries a `b` tag to a community header; items carry dual `z` tags; firmware hardcodes the community headers" — was scoped against the full spec corpus. Two-thirds survived (strengthened); one-third was rejected and rerouted. Along the way three genuinely new decisions landed (the `b` type registry, the dual-author header rule, TA discovery via kind 10040) and one undocumented hazard was found (override-masquerade). This doc preserves the decisions, the rejections *with their reasons*, and the open questions, so ratification doesn't re-litigate any of it.

---

## 0. The originating proposal and what survived

| Part | Proposal | Outcome |
|---|---|---|
| 1 | Every local DList/concept header carries a `b` tag pointing at a community header | **Adopted, modified** — opt-in/seeded, not mandated; default posture is *pointer*, not inheritance (D1, D2) |
| 2 | Items carry dual `z` tags (personal header + community header) | **Initially rejected, then rehabilitated in revised form** (D1, revision 2) — the local-first publication premise plus post-hoc trust gating plus cloud redundancy dissolved the original three objections; deliberately-published items carry personal `z` + current cloud `z`'s (≤5), resolved via the `b`-graph at write time |
| 3 | Firmware hardcodes a community DList header per concept | **Adopted, modified** — generalizes the shipped `communityReference`, which becomes the *seed* of the on-wire `b` rather than a parallel mechanism (D4) |

---

## 1. Settled decisions

### D1 — Affiliation rides the header's `b` tag; dual `z` tags on items are rejected

The affiliation between a local concept/DList header and a community header is expressed **once, in one replaceable, owner-signed event**: a `b` tag on the local header. Items keep **exactly one `z`** (to the local/personal header) — which is also the published base NIP's recommended practice ("a distinct event for each individual item"). The community association of items is **derived read-side**: follow the header's `b` edge, then union `#z` across the deferring headers (the base NIP's own list-redundancy retrieval pattern).

Why dual-`z` was rejected (preserve these; they are the load-bearing reasons):

1. **W1 recurrence.** A second `z` bakes the community curator's pubkey into user-signed, immutable item history — the `LEGACY_Z_TAG_PUBKEY` failure class (tags-branch ADR 0015), multiplied across every user's history. Re-pointing the header's `b` fixes future writes only; historical items are stuck (only original authors can re-sign — ADR 0022's authorship wall).
2. **Inert on arrival.** ADR 0011's binding trust gate makes Phase-B consumers skip events whose pubkey ≠ the curator's (anti cross-instance election), and the class-thread spec's security rules say a foreign-signed tag "derives nothing in that graph." The second `z` would be at best a discoverable self-claim, never membership.
3. **Redundant + denormalizing.** With the `b` on the header, the association is derivable at read time; writing it into items stores nothing new while opening a divergence channel (header re-points, old items don't).

The genuine gap part 2 pointed at — *no mechanism today puts a member's item into a community's list at all* — is real and is **routed, not solved here**: it belongs to the deliberately deferred election surface (ADRs 0010/0011) and most plausibly to the `dlist-tag` direction in the taggings family (worksheet W10): trust-weighted, disputable, third-party-assertable, read-side aggregated, no community pubkey baked into the item.

**Scope clarification (2026-06-12, raised by the LFO-membership scenario).** D1 governs **structural containment** — an item's `z` to its parent list. It does *not* mean community-directed assertions avoid shared handles. A kind-39999 tagging ("Alice is a member of LFO") — which *is* a list item (an item of the tag concept's list); the distinction below is between the event's two reference *slots*, not between event categories — carries two distinct concept references with different rules:

- **The `z` slot** (parent/event-type concept, e.g. `nostr-user-tag`) follows D1's architecture: point at *your deployment's* header; cross-deployment discoverability rides the header's `b` affiliation. (This is the slot where the `LEGACY_Z_TAG_PUBKEY` accident lives; W1's exit applies here.)
- **The applied-concept slot** (the tagging's target, e.g. the LFO community concept) **points at the shared referent directly** — per the ratified communities design ("tag against it"; the shared referent is an ordinary, forkable, *powerless* concept whose members are its trust-weighted elements). Community-directed speech acts exist to be cross-observer comparable; the shared reference is the point, and the referent's powerlessness is what makes the baking acceptable.

**The write-time selection rule is designation, not stature.** The client fills the applied-concept slot by following the local header's `b` pointer (the locator role of `b`, preserved from the original proposal) — a stable, author-controlled, revocable designation. "Use the currently highest-stature ancestor on the `b`-tree" is rejected as a write rule: stature is observer-relative and time-varying, so it would bake an unstable computed value into signed history and scatter different users' assertions across different ancestors. Stature is how the grapevine picks *defaults* and how observers *weight* what they read — never what writers compute at publish time.

**Consumer query patterns** under this split: membership aggregators (e.g. an LFO website in House PoV) use one filter on the applied-concept's shared handle, then trust-weight asserters per their PoV (the W9 designed rule) — no `b`-walk needed. List aggregation ("the community's dogs") uses the two-step `#b` → multi-`#z` union. Naive single-`#z` consumers are bridged by curator-side projection (compat Method 2) — the curator's own signed re-listing of accepted items.

**Read-pattern economics + the depth-1 affiliation rule (2026-06-12 follow-up, raised by the real-time tabulation concern).** The fair cost comparison is *derived-state vs derived-state*, not filter-vs-walk: the single-`z`-plus-author-whitelist pattern also depends on out-of-band derived state (the whitelist is a trust-computation output), and the `b`-architecture's analog — the affiliated-handle set — is *cheaper* state (headers are few, replaceable, sticky; trust scores churn constantly). Warm-path real-time tabulation is one filter in both architectures (`{"#z":[...handleSet], authors:[...]}`); cold start costs one extra `#b` round trip.

*The handleSet recipe:* resolve the community handle `H`; one REQ `{"kinds":[39998], "#b":["H"]}` (a **one-value filter at any community size** — returns all *direct* affiliates, the dominant case; deeper inherit-chain members via the short reverse-BFS below; scale pressure lives in the response, never the filter); validate headers (both `b` types count for direct affiliation); trust-gate the *authors* (the whitelist applies to one header per member, not per item); `handleSet = {"39998:"+pubkey+":"+d}`. Maintain by subscription on the same filter + periodic full re-derive (reconciliation backstop). Shortcut: for deterministic-`d` concepts the handleSet is a pure function of the whitelist (`pk → "39998:"+pk+":"+slug`), making the `#b` query a pure *discovery* channel — surfacing unknown affiliates as candidate signal for the W9 roster computation. This promotes slug determinism (O9) to a load-bearing property.

**Transitivity (revised 2026-06-12 — the earlier blanket depth-1 rule was an overcorrection, caught on review).** The challenge: deference *is* judgment-delegation, so Alice `-inherit→` Bob `-inherit→` Charlie should chain — and the resolved-definition machinery already agrees (the deference closure is transitive; absent overrides, Alice's resolved definition *is* Charlie's, so refusing her in Charlie's aggregate would contradict resolution's own answer). The corpus also already anticipates graded transitivity (the communities handoff's distance-weighted closure overlap). The refined rule is a **type split**, which is what the type registry implies anyway:

> **Affiliation-for-aggregation = the community header appears in the header's deference closure**, following **unbroken `"inherit"`-typed chains only**. A `"reference"` anywhere breaks the chain (a bookmark delegates no judgment; "not agreement" per the family table), and a bare `"reference"` affiliates only its own author — depth-1 inherently. Same walk, same visited-set and depth guard as resolution; closure membership is a set, so multi-`b` order is irrelevant here.

The founding tenet is honored *through the type choice*: declaring `"inherit"` is opting into documented live-transitive delegation (the trust-coupling section; revocable; distance-weighting available to aggregators); what *would* violate hard opt-in — affiliation through a link carrying no deference — is exactly what the reference-breaks-the-chain rule forbids. Performance stays bounded: the dominant case (seeded references + direct inherits) is round one of the single `#b=[H]` query; full inherit-closure discovery is a short reverse-BFS (multi-value `#b` per frontier round), bounded by natural chain shallowness + the depth guard.

*Honest cost accounting for transitivity (2026-06-12 review):* vs depth-1, cold start adds frontier rounds (small: only inherit-typed edges expand, and `"reference"` is the default — the default type does the load-shedding); the real added cost is **maintenance** — a new inherit can attach anywhere in the tree, so incremental watching needs multi-value `#b` subscriptions over the member set (same chunking mechanics as the item query) plus the periodic re-walk backstop. Bounded by three facts: aggregators choose their own depth (a depth-1 aggregator is a valid conservative consumer; distance-decay sends deep layers toward zero, so round-1-full + lazy-refinement is the expected pattern); instances compute the closure over materialized `INHERITS_FROM` edges locally (the relay BFS is the cold-start/sync path, never the per-read path); thin clients consume projections. Delegation composes consistently: personal `-inherit→` TA header, TA `-reference→` community means the TA's seed does **not** transitively capture the personal header — affiliation still requires your own direct `b` to the community (the W1 hygiene working as intended); a personal header carries `["b", <TA-header>, "inherit"]` *and* `["b", <community-header>, "reference"|"inherit"]` side by side. Noted-not-designed: "inherit the fields, not the chain" (definition-inheritance without affiliation-transitivity) is inexpressible via overrides (closure membership can't be overridden); if a real consumer wants it, it's a new element-3 type value per ADR 0027's extensibility. Zero-derived-state consumers (thin clients on vanilla relays) are served by curator-side projection (Method 2), which recreates the one-filter-no-whitelist pattern with trust-gating moved into the curator's signature. Tapestry instances themselves tabulate against local Neo4j (edges materialized), not relays. *The type-split transitivity rule is settled-in-scoping but constrains P1 — confirm at the P1 gate.*

**D1 REVISION 2 (2026-06-12, later the same session) — multi-z rehabilitated; `b` defines the cloud, `z` stamps it.** Three arguments, raised in review, dissolved the original rejection in sequence:

1. **Post-hoc gating was always the only gating** (the 500k-whitelist scenario): at any serious scale, trust-gating happens after receipt, locally — never in the filter. The filter's job is selectivity; the whitelist's job is acceptance. Under that model the "inert under trust gates" objection dissolves: ADR 0011's rule governs *edge derivation in the curator's graph*; post-hoc whitelist filtering **is** the consumer-side editorial act the class-thread spec demands. A multi-z self-claim consumed by a trust-gating observer is spec-coherent.
2. **Author-republish + the redundancy cloud mitigates the W1 baking**: kind-39999 items are addressable, so the author can re-stamp at the same `d`-address, cheaply and rarely; a cloud of ~5 mutually-referencing community headers means partial rotation (2 of 5) costs authors nothing, and full rotation is a *priced, acknowledged* loss. The `LEGACY_Z_TAG_PUBKEY` lesson was about a single, unmanaged, accidental baked literal; a redundant, deliberate, author-refreshable stamp set is the mitigated form.
3. **The local-first premise (decisive, and foundational — see also the new constraint below)**: most personal headers never leave the local relay; selective publication is the norm. Read-side derivation is structurally broken for selectively-published items (a public item pointing at a private header is orphaned; `#b` can't discover an invisible affiliation), and fixing it read-side would *force* header disclosure to share one item — the wrong privacy posture. Multi-z makes the published item a **self-contained public artifact carrying exactly the disclosure the author chooses**. Completeness inverts too: if "publishing for community visibility = stamp the cloud `z`'s" is the practice, the `#z` index is complete with respect to deliberately-public items — the right corpus.

**The revised division of labor:** headers keep the full `b` machinery (`"inherit"` deference, `"reference"` affiliation), and the `b`-graph is additionally **how the cloud is defined and discovered** — cloud membership = mutual reference-typed `b` edges among respected headers; the client resolves the current cloud at write time by following its header's `b` (the locator role, from the original proposal). Deliberately-published items carry the personal `z` (which may point at a *private* header) **plus the current cloud handles (≤5)**. Private items carry one `z` and stay local. Aggregation: one filter on the cloud handles (≤5 values — fits any relay limit at any community size), post-hoc trust-gate. **The `b`-graph is the live, replaceable map; the `z` stamps are durable index snapshots** — the map drifts, the snapshots age with redundancy. The closure/handleSet machinery exits the item-aggregation hot path (it remains for definitional resolution and the W1 consensus signal), retroactively mooting most of the transitivity-cost concern for items.

*Still true on the ledger:* baked pubkeys remain in signed history (priced and mitigated, no longer accidental); the published base NIP's one-`z`-per-event recommendation needs an explicit Tapestry-layer carve-out (P1); NIP-25 reactions target the whole item, not per-list; foreign/abandoned items orphan on full cloud rotation (accepted). *Newly opened:* cloud formation and rotation governance, and the stamping rule — see O11/O12.

**Foundational constraint (recorded here; belongs in any ratifying ADR's context): local-first publication.** The design must assume most personal headers and items never reach public relays; public aggregation can never depend on the presence of personal headers; publishing one item must not force disclosure of the list it belongs to, the rest of the list, or the author's affiliation structure beyond the stamps the author chooses.

**The scale ceiling (10k–100k members) is symmetric and pre-existing.** Enumerated-set relay filters (`authors:[10k pubkeys]` or `"#z":[10k handles]`) exceed practical filter limits in *both* architectures, at the same step (item tabulation), for the same reason — handleSet derivation itself never hits it (one-value `#b` filter). The at-scale ladder, identical for both designs: (1) **chunking** (~1k–5k transition zone; a few hundred values per REQ); (2) **sync-then-local-filter** — negentropy-sync the kind-space into a local store and tabulate there (the existing instance pattern; the WoT pipeline already does this for 30382s; a 100k handleSet ≈ 10 MB of sticky state); (3) **curator-side projection** — consumers query one value (`{"#z":["H"]}`) at any community size; aggregation is done once by the party who cares. Special case: where a shared indexed value exists on the item itself (the applied-concept slot in taggings), a one-value filter works at any scale with trust-gating after receipt (bandwidth pays for discarded spam; the filter never grows). The only relay pattern giving a single complete one-value containment filter would be a shared write-time marker on every item (dual-`z`) — which partial adoption breaks anyway, on top of the W1 baking; at scale, the answer is "materialize the aggregate once," not "walk harder."

### D2 — `b` type registry: `"reference"` (default) | `"inherit"` (opt-in)

The `b` tag's element 3 (the **type**, designed extensible by ADR 0027: *"Reserved future types … are not defined here"*) becomes a two-value registry:

- **`"reference"`** — a pointer/locator: "my header corresponds to that community header." No resolution semantics, no live tracking, no endorsement. **This is the new default**, including the fail-safe reading of an *absent* element 3 — an underspecified tag gets the least-commitment semantics rather than accidentally granting live deference.
- **`"inherit"`** — live definitional deference, exactly the current spec semantics (resolved definition computed on read, tracks the parent's future edits, field-level override). **Opt-in, always explicit.**

This **inverts ADR 0027's ratified `default "inherit"`** and therefore needs an amending ADR — but the cost is docs-only: zero `b` tags exist on any wire, zero resolver/emitter code exists anywhere, and the one named consumer (the Communities affiliation pointer) is described as carrying `type "inherit"` explicitly where it is named (ADR 0027, BIBLE §25). Caveat: `communities.md` itself describes the CD's `b` deference *without* naming the type — it relies on the old default, so under the inverted default an untyped CD `b` would silently become a non-deferring reference. Hence the P1 touch to make its wording explicit.

Mental model (the author's framing, worth preserving): **RAM vs storage.** Personalized headers are RAM; community definitions are storage. Most headers are touched infrequently — a pointer suffices. High-interest lists opt into `"inherit"` (and the deployment then maintains a fast local copy — D6). It also resolves the question this design previously left open (*"REFERENCES posture vs `b` posture for the firmware pointer"*): all seeds are reference-typed `b` tags; deference is always a later, deliberate act. W5's option (a) — "a consumer-owned tag on the consumer's own concept Header" — is thereby satisfied with no new single-char letter spent.

**Why two types — collapse-to-inherit-only reviewed and rejected (2026-06-12).** Eliminating `"reference"` was considered (it descends from the older REFERENCES relationship, which predates the `b` tag) and rejected on three grounds: (1) an inherit-typed firmware seed makes every deployment's definitions live-track the blessed curator by *default* — deference assumed by the protocol, inverting the founding tenet; reference-typed seeds are tenet-compatible bookmarks; (2) the honest-consensus property (H2) requires that seeds not vote in the deference-aggregation signal; (3) reference is the **chain-breaker** that keeps transitive affiliation (below) both safe and cheap — if every link is inherit, every casual pointer expands the closure and the TA-delegation chain silently affiliates users with the deployment's seed. *Decision rubric — one question:* **"when they edit their list, should the meaning of yours change?"** Yes → `"inherit"` (CD→parent-CD deference, personal→TA delegation, sub-community adopting parent rules). No, just connected/corresponding → `"reference"` (firmware seeds; a personal list joining the community cluster while keeping its own curation; the write-time locator). A *direct* reference already gets the author's items into the community aggregate; inherit adds the three transitive consequences (definitional tracking, chain membership, consensus vote). *Parked for P1:* renaming the type value (e.g. `"pointer"`) to stop colliding with the legacy REFERENCES relationship/edge vocabulary, semantics unchanged.

### D3 — Type-gating: resolution, materialization, aggregation

Consequences of D2 that the amending ADR must carry (each site verified against current text):

- **Resolution is gated to `"inherit"`.** The current pseudocode walks *every* `b` tag; in a mixed-type world that is wrong behavior. Four sites need the filter made explicit: the resolution loop and the derived-relationship section in `inherit-from.md`, ADR 0028's closure definition, and BIBLE §26's closure query. First-listed-wins precedence is defined over the *inherit-typed subset* (reference tags don't perturb ordering).
- **Edge materialization splits by type.** `"inherit"` → `INHERITS_FROM` (unchanged). `"reference"` → a `REFERENCES` edge that **must set `source`** (e.g. `source:'b-tag'`) to honor BIBLE §22's binding collision contract against the high-volume tag-level `REFERENCES` — this would be the first *asserted* (wire-derived) `REFERENCES`, alongside today's `source:'firmware-community'` install stub.
- **Aggregation (the W1 candidate signal) counts inherit-typed edges only.** A bookmark to a definition you disagree with must not count as agreement. v1: reference edges weigh **zero**; graded weighting deferred to the future registry ADR (which ADR 0027 already declares separate and unratified). Distinguish this from **discovery/correspondence walks** (e.g. "enumerate headers affiliated with concept X to union their `#z` items"): those include *both* types — a `"reference"` is exactly a correspondence claim. Inherit-only gating is for the definition-*consensus* signal; both-types inclusion is for event *discovery*.
- **Query-shape note.** Element 3 is non-indexed by design, so relays cannot filter `#b` by type — "enumerate all deferrers in one round trip" degrades to fetch-then-filter. Acceptable (consumers materialize edges locally) but must be named in the ADR.

### D4 — `communityReference` becomes the seed, not a parallel mechanism

`communityReference` (`{headerATag, relayHints[], knownGoodEventId?}`, BIBLE §22; live today for exactly one concept, `nostr-relay`) **stays** — it does four things the `b` tag cannot:

1. **Bootstrap** — a fresh install has published nothing; the literal must live code-side, and the manifest is the boundary-rule-sanctioned home for hardcoded handles (never spec prose).
2. **Fetch** — `relayHints` say where the bytes are; `b`'s element 3 is the type marker, so the tag has no relay-hint slot (and §22's relay invariant is operational config anyway).
3. **Pinning** — `knownGoodEventId` is the install-time anti-lever to `"inherit"`'s live-deference risk: a compromised curator can't poison fresh bootstraps.
4. **Superset link** — the same pass drives the Phase-A `IS_A_SUPERSET_OF` materialization (ADR 0008).

What changes:

- **Install behavior:** fetch + pin-verify the community header, then **seed `["b", <headerATag>, "reference"]` onto the TA-authored local header** — *only if the header doesn't already carry a `b`* (never clobber a re-pointed header; the published live state outranks the static default, §22's precedence applied at install).
- **The graph derives from published events.** The manifest-materialized `REFERENCES` stub retires for `b`-carrying headers; the edge comes from the event like every other tag-derived relationship.
- **Coverage widens** from one concept to all firmware concepts — Flaw A consciously widened **as the cold-start tier**, with the binding precedence `grapevine-resolved → firmware-blessed → none` preserved verbatim.
- **General principle** (state once in the ADR): *the manifest seeds published tags; the graph derives from published events; Neo4j-only stubs were the interim form.* The same promotion direction applies *in spirit* to the Phase-A superset link, but with a wire caveat the follow-up must resolve: the `s` tag is child-claims-parent with a **flipped** derived edge, so an `s` on the TA's local superset would derive `(communitySup)-[IS_A_SUPERSET_OF]->(localSup)` — the *inverse* of ADR 0008's canonical `(localSup)-[IS_A_SUPERSET_OF]->(communitySup)`. Expressing the Phase-A direction on-wire needs either a curator-side tag (not ours to publish) or the reserved-unassigned uppercase inverse. Flagged as an ADR 0008 follow-up, not done here.

### D5 — The trajectory: dev fiat → curated registry → emergent trust aggregation

Ratified as the intended W1 progression, with the explicit acknowledgment that the chooser of the blessed header is today the firmware author (the dev team) — Flaw A's centralized editorial choice, accepted as cold start. **The D2 type split makes the handover measurable and honest:** firmware seeds are `"reference"`-typed (discoverability without manufactured consensus), only deliberate `"inherit"` edges feed the aggregation signal, so the grapevine tier's readiness to supersede the firmware tier is *visible in the data* — watch the inherit-edge mass grow.

The same **seed-then-supersede pattern recurs at three scopes**, each handover explicit and on-wire:

| Scope | Seed | Supersedes it |
|---|---|---|
| Deployment | firmware seeds `"reference"` `b` on TA-authored headers | operator/user re-points or upgrades to `"inherit"` |
| User | TA-authored header (install-time, automated) | personal-authored header claims the concept (D7) |
| Network | firmware-blessed pointer (Flaw A tier) | grapevine-resolved aggregation over inherit edges |

### D6 — Live-tracking = opt-in `"inherit"` + a deployment-side materialized cache

The performance goal ("read one event for the resolved definition, no repeated re-resolution") is met **deployment-side, with zero wire change**. The spec's "computed on read … never snapshotted into the node" stays the wire/semantics rule; caching was always carved out as legitimate ("**Caching** is a consumer/performance concern, out of scope here" — BIBLE §26 verbatim; ADR 0028 carves caching out three times in similar wording). Concretely: opting a header into `"inherit"` is the signal for the instance to maintain a materialized resolved definition (Neo4j), refreshed on parent edits.

- **Machinery exists** to build the updater from: the `pass_communityReferences` fetch-publish-materialize sequence, the strfry-router remote-subscription layer, BullMQ schedulers for periodic refresh, the on-demand-pull/owner-consent posture from ADR 0010, and the reconciliation lesson from ADRs 0018/0020 (event-driven refresh needs a periodic full re-resolve backstop; never trust an id-match fast-path). ADR 0006's deferred "Element/superset materialization" stream (BIBLE §5's "the deferred element/superset materialization stream", the consumer of ADR 0007's concept-graph tag) is the natural conceptual slot.
- **On-wire snapshots are deferred** — see hazard H1 (§2). If a published self-contained header is ever genuinely needed (offline resilience), the safe path is a stated-vs-synced field marking, landing at the spec's already-open payload-binding item (`inherit-from.md`: "which parts of a node's `json`-tag payload participate in resolution — is **not yet formalized**"). Until a real consumer needs it: don't.

### D7 — Dual-author headers: personal root, TA fallback; precedence by designation, never recency

Both authorship modes are supported, because both are necessary: the personal key is **never** available server-side (NIP-07 is interactive-only; BIBLE Key Design Decision 6 — the TA signs all automated operations), so install-time and batch-authored headers are TA-signed by necessity; personal signatures are preferred wherever the user can sign (including via external apps).

**Lookup-and-precedence rule:** for user U and concept slug S — the **personal-authored header** (`39998:<U>:<S>`) is the resolution root if it exists; else the **TA-authored header** (TA discovered via D8); else none. Deterministic, author-controlled, observer-independent — the resolution values the inherit-from spec already names.

**Most-recent-wins across pubkeys is rejected**, with prejudice: every recency rule in the corpus is same-author NIP-01 replaceability; cross-pubkey selection is *never* recency-based anywhere (it's trust-weighted aggregation, author-controlled ordering, or tiered fallback); a cross-signer recency rule would let a stale-but-later TA write shadow a deliberate personal edit, and hands a compromised TA a forged-timestamp override of the user. The in-repo grain uniformly supports personal-preferred-with-fallback (Warm Start `self → owner → cold`; search PoV user-then-house; `grapevine → firmware → none`).

**Freshness via composition, not recency:** if the user wants the TA's actively-maintained header to govern, the personal header carries `["b", "39998:<TA>:<S>", "inherit"]` — delegation expressed through the deference machinery itself, explicit and revocable. The precedence question collapses into the existing resolution rule.

### D8 — TA discovery via a kind-10040 entry (companion pre-NIP)

The user's kind 10040 (NIP-85 "Trusted Assertions" / TA Treasure Map) gains an entry designating the user's Tapestry Assistant pubkey for DList-header authorship. This extends an already-deployed pattern, not a new mechanism:

- 10040 is **user-signed** (NIP-07, signature-verified before publish), already the stack's only nostr-native npub-rooted path to the assistant pubkey, and its grammar — triples `["<kind>:<assertionType>", <providerPubkey>, <relayUrl>]` — fits a new entry exactly. Republishing the 10040 is the natural **revocation** path (same revocability property as the `b` tag).
- **Backward compatible:** all existing consumers either prefix-filter on `"30382:"` or exact-match the `"30382:rank"` tag; in both cases unknown tags are ignored, so a new entry breaks nothing.
- **Two known costs:** (a) the two 10040 generators (`bin/brainstorm-create-kind10040.js` and the `/api/create-unsigned-kind10040` handler; a third API command wraps the former) rebuild the full tag list from config and would **clobber** a new entry — merge-preserve logic is a required implementation story; (b) **NIP-85 is upstream** (Vitor Pamplona's spec, not in our `protocols/` index) — so the entry is specced as a **local companion pre-NIP** in `protocols/drafts/` (the established pattern), optionally proposed upstream later.

---

## 2. Hazards documented (previously recorded nowhere)

**H1 — Override-masquerade.** If a header republishes inherited fields as its own stated fields (an on-wire synced copy), resolution rule 1 ("own stated fields win") makes those copies indistinguishable from deliberate overrides: they freeze the parent's future edits until the next sync and misrepresent authorial intent to every third-party resolver. The corpus documents only the *inverse* hazard (parent drift / the live-`b` retroactive lever) and frames override-pinning purely as a feature. Fix-site if on-wire snapshots are ever needed: the unformalized payload-binding item in `inherit-from.md` (stated-vs-synced field marking). Until then: caches stay deployment-side (D6). Note: a published self-contained snapshot is IMPORT's quadrant (absorb + importer-authoritative + snapshot/pull), which is *not* the wanted posture here — the community stays authoritative.

**H2 — Seeded-consensus inflation.** If firmware-seeded affiliations were inherit-typed (or untyped under the old default), the W1 aggregation signal would be inflated by manufactured deference — the grapevine "consensus" would echo the seed. Solved structurally by D2/D3: seeds are `"reference"`, aggregation counts `"inherit"` only.

**H3 — W1 recurrence via item-level pointers (revised with D1 revision 2).** A **single, unmanaged, accidental** baked literal in user-signed items reproduces the `LEGACY_Z_TAG_PUBKEY` incident class at scale — that remains true and killed the *original* dual-`z` form. The mitigated form (D1 rev 2) is acceptable because it changes every adjective: **redundant** (cloud of ≤5, partial rotation absorbed), **managed** (client-resolved from the live `b`-graph at write time; author re-stamp available at the same `d`-address), and **deliberate** (stamped only on items the author chooses to publish for community visibility, with full-rotation lossiness priced in). Election/acceptance remains a separate observer-side or curator-side layer — stamps are discoverability self-claims, never derived edges in anyone else's graph.

---

## 3. Worksheet ledger impact

| Entry | Effect of this design |
|---|---|
| **W1** (cross-deployment concept identity) | Advanced substantially: operationalizes candidates 1 (firmware-blessed, widened as cold-start tier) and 3 (`b`-edge aggregation, now with honest signal provenance per D2/D3). Not resolved: the cold-start chooser is still the firmware author, by design, per the D5 trajectory. |
| **W2** (single-char registry) | Untouched — no new letters; `REFERENCES`-as-own-letter assumption revised in favor of riding `b`'s type element (a letter saved). |
| **W5** (`REFERENCES` publishing semantics) | **Closes via option (a)**: `b` with type `"reference"` *is* the consumer-owned tag on the consumer's own header. The closing ADR must settle the edge-materialization + `source`-contract point (D3) and update the §22 deferred list. |
| **W6** (set-valued override algebra) | Pressure drops (inheritance is now opt-in and rarer) but still **fires with the first list-bearing `"inherit"` consumer** — design lands in `inherit-from.md` §Scope per the existing deferral. |
| **W7** (item-kind interplay) | The carrier question (manifest field vs on-wire header tag) is answered: *both, layered* — manifest seeds, wire expresses (D4). item-kind/foreign-kind questions remain open. |
| **W10** (taggings family) | Named as the routing target for item-level community assertion (`dlist-tag`) — the election surface's most plausible vehicle (D1). |

---

## 4. Open questions

- **O1 — `b`-tag ordering with seeds.** First-listed-wins matters only among `"inherit"` tags (reference tags are excluded from resolution, so this question *shrank* under D2) — but the amending ADR should still state where a later-added `"inherit"` sits relative to an existing seeded `"reference"` (recommended: ordering is free; only inherit-typed relative order is load-bearing).
- **O2 — The 10040 entry's assertion-type string** and the companion pre-NIP's exact scope (per-kind? blanket "DList headers"? expiry?); local-only vs upstream proposal.
- **O3 — Which spec owns the dual-author lookup/precedence rule (D7)** — `tapestry-concepts.md`, the new companion pre-NIP, or a section of `inherit-from.md`.
- **O4 — Graded weighting of `"reference"` edges in aggregation** (v1 = zero) — deferred to the registry ADR.
- **O5 — The election surface** (item-level community acceptance; `dlist-tag` design) — explicitly out of scope here; W10 + ADRs 0010/0011 own it.
- **O6 — Foreign-kind items** (e.g. a kind-34550 Community as a list item; compat Methods 2–3) — untouched; W7 owns it.
- **O7 — Sequencing:** implementation of any piece lands in the three-branch reconciliation territory (`COMMUNITIES_PROTOCOL_DESIGN_HANDOFF.md` §7, OPEN). Docs ratification proceeds now; code waits.
- **O8 — On-wire synced-snapshot marking** (stated-vs-synced) — deferred until a real consumer needs it (H1).
- **O9 — Slug determinism for seeding:** live headers use singular d-tags (`dog`); the proposal spoke of plurals (`dogs`). Matters for any "blessed pubkey + derived slug" scheme in firmware seeding.
- **O10 — Seeding scope:** manifest concepts only, or runtime-created concepts too (the latter needs a new blessing path). *Narrowed at the story-34 gate (`community-reference` ADR 0030): manifest-only ratified; the runtime blessing path remains open.*
- **O11 — Cloud formation and rotation governance (opened by D1 rev 2):** what constitutes cloud membership (mutual reference-typed `b` edges? a trust threshold? curator designation?), who rotates members in/out, how clients detect rotation, and what the cloud's relationship is to the W1 grapevine-resolved selector (is the cloud just "the top-k of the consensus signal"?).
- **O12 — The stamping rule (opened by D1 rev 2):** how many cloud handles to stamp (cap ~5?), which ones when the cloud is larger, ordering semantics if any, whether the personal `z` is required or optional on public items, and the re-stamp protocol on full rotation (lazy author re-emit per the ADR 0022 pattern?).

---

## 5. Ratification plan (each piece = one docs-mode story)

| Piece | Deliverable | Touches |
|---|---|---|
| **P1 — `b` type registry + type-gating** ✅ shipped — `community-reference` ADR 0029 / story #33 (2026-06-12; type value renamed `"reference"` → `"pointer"` at the planning gate) | Amending ADR (supersedes ADR 0027's `default "inherit"` text and its restatements in `inherit-from.md` / BIBLE §25/§21, plus ADR 0028's ungated resolution/closure text) | `protocols/drafts/inherit-from.md` (type registry, fail-safe default, type-gated resolution ×2 sites, aggregation scoping, query-shape note); BIBLE §6/§21/§25/§26; `communities.md` (explicit `type "inherit"` wording); worksheet W1/W2/W5/W6 |
| **P2 — `communityReference` v2: seed-not-stub** ✅ ratified — `community-reference` ADR 0030 / story #34 (2026-06-13; manifest-only, per-concept entries, pinning optional; install-pass code story gated on the three-branch reconciliation) | ADR | BIBLE §22 (seed semantics, stub retirement, never-clobber rule, coverage widening, the seeds-tags principle — Target/Status-today split per the §27 precedent); firmware manifest schema notes; ADR 0008 follow-up flag (superset-link promotion) |
| **P3 — Dual-author headers + TA discovery** | Companion pre-NIP (`protocols/drafts/`) + ADR | new pre-NIP (10040 entry + lookup/precedence rule per O3); BIBLE Assistant-Keys section pointer |
| **P4 — Resolved-definition cache (deployment-side)** | Implementation-leaning ADR/BIBLE section (eng-team flow, not protocol) | BIBLE (materialization design, refresh + reconciliation backstop); explicitly *not* a `protocols/` spec |

Suggested order: P1 → P2 → P3 (P1 unblocks the others' vocabulary); P4 whenever an implementation story wants it.

---

## 6. Provenance — where this came from

Scoped 2026-06-12 in a single Protocol-Spec session: proposal assessment (11-agent audit over the spec corpus, ADRs, BIBLE, worksheet, and the live concept graph — which confirmed, among other things, **zero `b` tags exist on any of the 34 live headers** and all are TA-signed), follow-up on `communityReference` redundancy, the centralization analysis behind D5, and a second grounding audit (10040 grammar and consumers, user-vs-TA prior art, ADR 0027 type-slot extensibility, caching prior art). Key verbatim anchors, all verified against current text during scoping: ADR 0027's extensible-type sentence; `decentralized-lists.md`'s multi-`z` permission *and* one-`z`-per-event recommendation; ADR 0011's trust gate; BIBLE §22's `communityReference` definition, Flaw A framing, and precedence; `communities.md`'s founding tenet and "the community claims the tag, not the reverse"; BIBLE §26 / ADR 0028's caching carve-out; AGENTS.md §5's TA-pubkey handle invariant.
