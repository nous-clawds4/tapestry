> **Repo metadata — not part of the spec text.**
> **Status:** 📝 pre-NIP
> **Canonical:** not yet published
> **In flight:** describes a feature in flight on the unmerged branches `feat/communities` (Avi) and `feat/pubkey-tagging-target` (Vinney); the three-branch reconciliation is an OPEN delivery decision — see `docs/COMMUNITIES_PROTOCOL_DESIGN_HANDOFF.md` §7.
> **Sources:** `docs/COMMUNITIES_PROTOCOL_DESIGN_HANDOFF.md` §1–§6 (design authority, ratified here per protocols-directory story 6 / `protocols-directory` ADR 0004); `feat/communities` ADRs 0029/0030/0033/0034/0039/0040; `feat/communities:COMMUNITY_RECORDS_DLIST.md` (coexistence layer); `feat/communities:COMMUNITY_ENDORSEMENTS_DLIST.md` is **superseded for membership** by the 2026-06-05 redesign (ADR 0004, finding D1) and is not ratified here.

---

Communities
=====

This NIP defines **communities** as a thin reading of the concept graph specified by [Tapestry Concepts](./tapestry-concepts.md) and [Inherit-From & Resolved Definition](./inherit-from.md): a community is a concept, its definitions are ordinary addressable events, its members are trust-weighted elements, and nothing in the protocol holds privileged power. "Brainstorm Communities" is the reference deployment's name for this design.

## Founding tenet: no privileged center

Every Community Declaration is **its author's own view, resolved from their own point of view**. There is no protocol-level founder, leader, anchor, or canonical roster — and no default field for any of those, because a slot for "leader" makes centralization read as expected.

- Centralization is always a **hard opt-in**, expressed in your own declaration via the `b` tag ("I defer to X"), and **revocable** (re-publish without it).
- "Canonical" membership is **emergent, never imposed**: when many participants `b`-defer to the same declaration *and* their webs of trust overlap, their resolved rosters converge — and that convergence *is* the community. Any of them can defer out tomorrow.
- Disagreement is **native**: participants who diverge simply keep, drop, or re-point their deference. There is no global leadership to dispute, so no dispute machinery exists.

Centralization must be built by participants, never assumed by the protocol.

## Relationship to other specs

Communities ride entirely on primitives defined upstream: the addressable kinds and `z` conventions of [Decentralized Lists](../nips/decentralized-lists.md) and [Tapestry Concepts](./tapestry-concepts.md); definitional deference and the resolution algorithm of [Inherit-From & Resolved Definition](./inherit-from.md); and the membership signal of the pubkey-tagging wire format — **specified by the Tags & Taggings pre-NIP (story 7, pending; until then the latest wire word is `feat/communities` ADR 0030's a-primary correction, quoted under "Membership")**. This spec adds only the thin community-specific layer on top.

## A community is a concept

**community = concept; member = element; Community Declaration = concept-definition; `b` = definition-inheritance.**

- **Identity is concept identity, inherited wholesale.** "Which *LFO* is *the* LFO" is the same question as "which `dogs` is *the* dogs." The shared referent is an ordinary community concept (kind 39998) — forkable, trust-rankable, and **powerless**, exactly like any concept. There is no privileged node above the definitions. How independent deployments select a *canonical* concept identity is the open problem tracked as worksheet [W1](../worksheet.md#w1--cross-deployment-concept-identity).
- **Bootstrap:** a newcomer becomes comparable by pointing at the concept — tagging against it (entering the **population**) and/or `b`-deferring to a declaration in its cluster (adopting a **ruleset**). A first mover gets only a forkable naming advantage: zero protocol power.
- **Safety property — population and ruleset stay separate.** This is load-bearing, not tidiness: a captured definition-hub can drift cutoffs and roles for its voluntary deferrers, but it **cannot retag people** — the who's-in layer does not move with a rogue rule-hub.

## The Community Declaration

A Community Declaration (CD) is a **kind 39998 concept event**, `d` = community slug (per-author; not deduplicated across authors), publishable and readable directly from relays. Its definition rides in its tags:

| Field | Meaning |
|---|---|
| name | display name |
| description / belonging | what the community is about; who belongs (free prose) |
| topic | topical tag (repeatable) |
| founder | **informational only** — MUST NOT confer any algorithmic privilege (see the founding tenet) |
| type marker | a `z` reference identifying the event as a community declaration, distinguishing it from other kind-39998 headers |
| `b` | optional deference to a parent declaration ([Inherit-From](./inherit-from.md)) — forking and convergence ride on this |
| claims | the tag-element coordinates this community consumes as its membership signal (see "Membership"), plus the membership threshold and influence-cutoff preset; resolves through `b`-inheritance like any other definitional field |

*The exact tag spelling of these fields is **not yet formalized** on the wire — the sources fix the field set and semantics but not the byte-level encoding.* A declaration needs no `b` tag: a `b`-less CD is a standalone definition (a root with zero special status); plural roots are normal, and multi-parent deference resolves per the [resolution rule](./inherit-from.md).

## Sameness: two axes

"Same community" is two orthogonal, per-observer, graded measures — and you need the **conjunction**:

1. **Definition overlap** — graded similarity over deference closures (e.g. overlap coefficient), from `0` (unrelated) to `1` (identical).
2. **Mutual membership** — each party actually a member (below).

Overlap alone means "talking about the same thing"; membership alone means "each in *a* community." Consequence (a feature, stated plainly): overlap-based sameness is **non-transitive** — communities overlap and bleed; they do not partition people into disjoint buckets. Any gating feature must therefore gate against a *specific* declaration's resolved definition (the enforcer's own); there is no global roster.

## Membership

Membership is **the pubkey-tagging primitive, consumed** — not a community-specific schema. A membership assertion is a kind 39999 event (wire format owned by the Tags & Taggings pre-NIP, story 7 pending; shape per `feat/communities` ADR 0030's a-primary correction):

```
["p", "<targetPubkey>"]                    the person being tagged
["a", "39999:<tagAuthorPubkey>:<slug>"]    the tag-element applied — stable identity (claim/scan this)
["e", "<tagEventId>"]                      the element version at apply-time — provenance only
["z", "<the deployment's nostr-user-tag concept address>"]   assertion type-header
["polarity", "1" | "-1"]                   apply / dispute
```

- **The community claims the tag, not the reverse.** A CD's `claims` field lists the tag-element a-coordinates (`39999:<tagAuthor>:<slug>`) that count as its membership signal. Many-to-many: one community may claim several tag-elements; one tag-element may feed several communities. The tag itself stays general — no community pointer is baked into it. A newly founded community conventionally auto-claims its founder's own tag-element.
- **Self-tag vs. vouch** = whether the assertion's author equals its `p` target. **Disputes** = `polarity: -1`.
- **Roster (v1, as deployed):** candidates are pubkeys carrying any claimed tag-element; the gate is count-based — `applications ≥ cutoff AND applications > disputes`.
- **Roster (as designed):** per-observer and trust-weighted — `score = Σ over asserters of (observer's trust in asserter × polarity)`, counting only asserters above an influence cutoff, then gated by the resolved definition's threshold. Disputes are weighted, not counted, so "no veto" falls out automatically.
- *The two roster rules are **not yet reconciled** — tracked as worksheet [W9](../worksheet.md#w9--roster-rule-reconciliation).* Membership is **derived on read** in either rule, never stored.
- **Roles are predicates over the roster**, defined in the resolved definition: *applicant* (self-tagged, below threshold), *member* (cleared threshold). Admin is **off** in v1. Authoring a CD makes you a definer, not a member — the zoologist who defines "dog" is not a dog.

## Personal community records (coexistence layer)

The deployed record layer predates the declaration model and coexists with it (two read paths united by the consuming application; founding new communities writes declarations only). Each user maintains one `brainstorm-communities` DList (kind 39998 header, deterministic `d` = `brainstorm-communities`) holding their **personal records**: kind 39999 items, one per community, `d` = `t` = community slug, with `name`/`description`/`image`/`topic`/`language`, **informational-only** `founder`, engine-config fields (`relay`, `seed`, `weighting_model`, `endorsement_threshold` — carriage post-redesign tracked as worksheet [W8](../worksheet.md#w8--engine-config-carriage)), optional NIP-72 wrapping via a bare `a` tag (`34550:<creator>:<d-tag>`), and `template-source` lineage (event-id **snapshot** of the record copied from — deliberately not an a-tag, so later edits by the source do not retarget the lineage).

There is no canonical record of any community anywhere: there are N personal records, and the community **is** their convergent overlap. Joining = publishing your own record (or, in the declaration model, tagging in / deferring); there is no join request and no acceptance.

## Posts, threading, and reactions

- **Posts** are NIP-22 kind `1111` events scoped to a community by `["a", "<community address>"]` (uppercase `A` carries the community scope on replies).
- **Replies** (one level) add `["e", "<parent post id>", "", "<parent author>"]`, `["k", "1111"]`, and `["p", "<parent author>"]`, inheriting the community's uppercase `A`. The presence or absence of the parent `e` tag is the wire signal distinguishing replies from top-level posts.
- **Reactions** are NIP-25 kind `7` events carrying `A`/`e`/`p`/`k` scope tags with content `+` (react) or `-` (un-react). The aggregation rule is wire-binding: a post's count = distinct reactors whose **most recent** reaction is `+` (latest-per-reactor; `-` is a removal marker, not a dislike).

## Foothold invitations

A member may extend a **foothold** to a newcomer:

- **Invite:** kind 39999, `d` = `invite-<code>`, with `["a", "<community address>"]`, `["p", "<issuer>"]`, and a `z` type-header naming the deployment's `foothold-invite` concept.
- **Redemption:** kind 39999, `d` = `redeem-<code>`, same `a`/`p` shape, `z` → the deployment's `foothold-redemption` concept — the recipient's signal that the invite was accepted.
- **Acceptance effects** are ordinary membership assertions (above): the recipient self-tags, and the issuer vouches, both via the standard assertion shape.

## Security considerations

- **The live-`b` retroactive lever.** Deference tracks future edits ([trust-coupling](./inherit-from.md)), so a dominant declaration holds a retroactive editorial lever over its live deferrers, and a compromised mid-chain declaration can drift a deferrer's community identity (closure shift). Mitigations: (1) the population/ruleset split — a rogue rule-hub cannot retag anyone; (2) making closure-overlap **distance-weighted** (nearer shared ancestors count more) when the sameness metric is refined.
- **No veto by construction** (designed rule): disputes are trust-weighted, so no single hostile disputer can eject a member; under the deployed count-based rule this property is weaker — one of the W9 reconciliation stakes.

## Open questions

Kept visibly open; this spec decides none of them:

1. **Three-branch reconciliation** (`staging` / `feat/communities` / `feat/pubkey-tagging-target`) — an organizational delivery decision; see `docs/COMMUNITIES_PROTOCOL_DESIGN_HANDOFF.md` §7.
2. **Engine-config carriage** — where `seed`/`weighting_model`/threshold/cutoff live post-redesign (records? declaration `claims`? resolved definition?) → worksheet [W8](../worksheet.md#w8--engine-config-carriage).
3. **Roster-rule reconciliation** — deployed count-based vs. designed trust-weighted, plus threshold mechanics (1 vouch vs. N ≥ 2 for safe spaces) → worksheet [W9](../worksheet.md#w9--roster-rule-reconciliation).
4. **Canonical concept identity across deployments** → worksheet [W1](../worksheet.md#w1--cross-deployment-concept-identity).
5. **CD field encodings** — the exact tag spelling of the declaration's fields and the `claims` declaration (marked above).
