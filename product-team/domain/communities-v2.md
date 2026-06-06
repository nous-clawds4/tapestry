# Domain Model: Communities (Phase 2)

**Slug:** communities-v2
**Date:** 2026-06-06
**Modeler phase:** Domain Modeling (Phase 4)
**Builds on:** `domain/communities.md` (V1). V1 modeled Circle, Person, Post, Trust Signal, Resolved Definition and **named-but-deferred** Membership/Vouch/Dispute. Those are now built and in scope, so this model promotes them from "named" to "modeled" and adds the genuinely new Phase 2 entities (Reply, Reaction, Notification + Preference, Foothold Invite, Founder Standing, Retirement, Activity).

> Conceptual model only — what the product knows about, not how it stores it. Local handle prefix: `39998:fee78a4ffc01e50124ae34112db6fde62edd098f731311f58f3ef7667a4902bb:<slug>`. Oriented against the live concept graph (36 concepts). Membership/tag concepts are **not** in this instance's graph; they live in brainstorm.world's tag engine and are consumed cross-origin (app-as-consumer).

## Entities

### Circle  *(carried, enriched)*
- **Description:** A community expressed as a stated definition — its purpose, what it takes to belong, and which membership tag it claims — that anyone can stand on or fork; it has no owner.
- **Concept mapping:** existing `…:brainstorm-community` (the Community Declaration shape; kind-39998 with `t=brainstorm-community`).
- **Attributes:**
  | Attribute | Type | Required | Notes |
  |---|---|---|---|
  | name | text | yes | |
  | purpose | text | yes | what the circle is for |
  | belonging-bar | text | yes | what it takes to belong, in plain prose (the rule, not a list) |
  | founder | ref:Person | yes | who declared it — a peer, not an owner |
  | topics | text (multi) | no | for discovery |
  | parent | ref:Circle | no | the circle this one stands on / forked from |
  | claims | ref:Tag-Element (multi) | yes | the membership tag(s) this circle claims; belonging is asserted against these |
  | belonging-threshold | number | yes | how many trusted vouches it takes to belong (e.g. 1 open, 2+ safer) |
  | lifecycle-state | state | yes | active / retired (see lifecycle) |

### Person  *(carried)*
- **Description:** A portable identity that founds, forks, participates in, vouches within, and belongs to circles.
- **Concept mapping:** existing `…:nostr-user`.
- **Attributes:** identity (ref, required), display name (text, optional), picture (URL, optional).

### Post  *(carried, enriched for threading)*
- **Description:** A message contributed to a circle's conversation, optionally in reply to another post.
- **Concept mapping:** existing `…:nostr-event` primitive (a NIP-22 kind-1111 comment anchored to the circle; deliberately not kind-1, to avoid leaking into general nostr clients).
- **Attributes:**
  | Attribute | Type | Required | Notes |
  |---|---|---|---|
  | author | ref:Person | yes | |
  | circle | ref:Circle | yes | the circle it is scoped to |
  | body | text | yes | |
  | time | date | yes | |
  | in-reply-to | ref:Post | no | present when this post is a threaded reply |

### Reaction  *(new)*
- **Description:** A lightweight response a person attaches to a post (the smallest unit of "this room is alive").
- **Concept mapping:** existing `…:nostr-event` primitive (a reaction event); new only as a product notion ("circle reaction").
- **Attributes:** author (ref:Person, required), post (ref:Post, required), symbol (text, required — e.g. a like or emoji), time (date, required).

### Tag-Element  *(consumed — external)*
- **Description:** The membership tag a circle claims; belonging is asserted *against* this tag, and the tag never points back at the circle (a many-to-many relation, so one tag can serve several circles).
- **Concept mapping:** **external** — brainstorm.world's tag engine concept (`tag`), kind-39999, not present in this instance's graph. Consumed, not defined here.
- **Attributes:** slug (text, required), type-header (ref, required — the shared tag type). *Modeled as a reference target; the app reads it, it does not own it.*

### Membership Assertion  *(promoted from deferred — consumed/external shape)*
- **Description:** A signed statement that a person does or does not belong, against a circle's claimed tag — the unit from which membership is derived. It unifies three product acts by who-about-whom and polarity:
  - **Self-tag ("I'm in")** — a positive assertion about oneself.
  - **Vouch** — a positive assertion about another person.
  - **Dispute** — a negative assertion about a person (weightless when it comes from a source the viewer does not trust).
- **Concept mapping:** **external** — brainstorm.world's `nostr-user-tag` concept, kind-39999 with a polarity. Consumed cross-origin.
- **Attributes:**
  | Attribute | Type | Required | Notes |
  |---|---|---|---|
  | asserter | ref:Person | yes | who is making the claim |
  | subject | ref:Person | yes | who the claim is about (equals asserter for a self-tag) |
  | tag | ref:Tag-Element | yes | the membership tag being asserted against |
  | polarity | text | yes | belongs / does-not-belong |
  | time | date | yes | |

### Membership / Standing  *(promoted from deferred — derived, not stored)*
- **Description:** Whether a given person belongs to a given circle from a given viewer's point of view — never a stored roster, always derived from the assertions the viewer trusts.
- **Concept mapping:** derived over `…:web-of-trust` / `…:graperank` + Membership Assertions. No stored entity.
- **Derivation:** count the trusted positive asserters; a person belongs when **trusted-vouches ≥ belonging-threshold AND trusted-vouches > trusted-disputes** (two-part, valence-naive gate). **At launch the viewer is the house point of view** (per-viewer is Phase 3).
- **States:** see lifecycle (outsider → applicant → member).

### Trust Signal  *(carried — derived, not stored)*
- **Description:** How much a viewer's web of trust vouches for a person or stands behind a circle's roster — what makes real members legible and impersonators weightless.
- **Concept mapping:** existing `…:web-of-trust` / `…:graperank`.
- **Attributes:** viewer (ref:Person, required — **the house PoV at launch**), subject (ref:Person or ref:Circle, required), strength (number, required — derived, not entered).

### Founder Standing  *(new — derived, not stored)*
- **Description:** The bounded head start a founder holds in their own circle, which visibly diminishes as the circle's internal trust graph fills in — the mechanism that lets a founder be a strong first-mover without becoming an owner.
- **Concept mapping:** derived from the founder relationship + `…:web-of-trust`; no stored entity.
- **Attributes:** founder (ref:Person, required), circle (ref:Circle, required), prominence (number, required — derived; decays as independent trust accrues), legible-rule (text, required — the human-readable basis for the current prominence, so decay is inspectable not silent).

### Foothold Invite  *(new — mechanism is a working assumption)*
- **Description:** An entry a founder or member extends to a true outsider that confers a first foothold without requiring pre-existing trust — the cold-start carrier. Working assumption from discovery: the invite carries a vouch that activates when the outsider creates an identity.
- **Concept mapping:** new product notion; likely realized as a pre-authorized Membership Assertion. *Exact shape pending the domain/cross-team cold-start decision (founder-grant / provisional standing are the named fallbacks).*
- **Attributes:** issuer (ref:Person, required), circle (ref:Circle, required), carried-vouch (boolean, required — whether acceptance confers an initial belongs-assertion), recipient (ref:Person, optional — bound on acceptance), lifecycle-state (state, required — issued / accepted / expired).

### Notification  *(new — derived, not stored as canonical truth)*
- **Description:** A surfaced awareness that something involving a person happened (they were vouched for; new activity in a circle they belong to), delivered only on the person's own terms.
- **Concept mapping:** new product notion; a derived view over events (assertions, posts, reactions). No new stored concept.
- **Attributes:** recipient (ref:Person, required), occasion (text, required — e.g. vouched-for / replied-to / new-activity), source-event (ref, required — the post/assertion/reaction it derives from), time (date, required), seen (boolean, optional).

### Notification Preference  *(new — the sovereignty control)*
- **Description:** A person's own stated rules for what may reach them and how — the entity that makes notifications a service the user controls rather than a hook pulling at them.
- **Concept mapping:** new product notion; a person's own stated configuration. No existing concept.
- **Attributes:** owner (ref:Person, required), occasion (text, required — which kind of occasion), channel (text, required — how/whether to surface it), enabled (boolean, required — **default conservative; every occasion is turn-off-able**).

### Activity (Signs of Life)  *(new — derived, not stored)*
- **Description:** A legible indication that a circle is alive — recent posts, replies, reactions, and vouches — readable without an account so a visitor can tell a living circle from a dormant one.
- **Concept mapping:** derived over Posts / Reactions / Membership Assertions; no stored entity.
- **Attributes:** circle (ref:Circle, required), most-recent-activity (date, required), recent-volume (number, required — derived).

### Resolved Definition  *(carried — derived, not stored)*
- **Description:** A circle's effective definition after following its parent (fork/stand-on) chain and applying the child's overrides — including inherited `claims` and `belonging-threshold`.
- **Concept mapping:** new substrate (BIBLE §25 inherit-from + §26 Resolved Definition); no concept node.
- **Attributes:** none of its own — computed from a Circle and its parent chain (child's stated fields win).

## Relationships
Named and directional:

- Person **founds** Circle
- Circle **stands on / forks** Circle  *(child → parent; the definition-inheritance edge)*
- Circle **claims** Tag-Element  *(the membership tag; many-to-many — the tag never points back)*
- Person **posts** Post **in** Circle
- Post **replies to** Post  *(threading)*
- Person **reacts to** Post
- Person **asserts** Membership Assertion **about** Person  *(self-tag / vouch / dispute, against a Tag-Element)*
- Membership / Standing **derives from** trusted Membership Assertions  *(per viewer; house PoV at launch)*
- Person **trusts** Person  *(per-viewer; the basis of Trust Signal and the gate)*
- Founder Standing **derives from** the founder relationship + the circle's internal trust
- Person **extends** Foothold Invite **to** Person  *(the cold-start edge)*
- Notification **derives from** an event **for** Person, **gated by** that Person's Notification Preference
- Activity **derives from** a Circle's Posts / Reactions / Assertions
- Resolved Definition **derives from** Circle + its parent chain

## States and lifecycle

- **Circle:** drafted → declared (active) → **retired** *(new in Phase 2 — a trust-consistent retirement, not a unilateral owner deletion; clears the 3 legacy test circles)*. May also be forked-from / stepped-back-from; persists when its founder steps back (no owner to collapse it).
- **Membership / Standing (per person per circle, derived):** outsider → **applicant** (self-applied "I'm in" but below the bar) → **member** (cleared the two-part gate). *The applicant state exists in the model; surfacing applicants distinctly in the UI is Phase 3 — it needs a `selfApplied` per-row flag from the tag engine (Vinney ask).*
- **Founder Standing:** privileged (seed) → decaying → peer  *(visible on a legible rule).*
- **Foothold Invite:** issued → accepted (activates the carried vouch) → expired.
- **Post:** composed → published. **Reaction:** attached. **Notification:** generated → surfaced (per preference) → seen.

## New vs. existing (Tapestry products)

- **Maps to existing concepts (this instance's graph):** Circle → `brainstorm-community`; Person → `nostr-user`; Post & Reaction → `nostr-event`; Trust Signal, Membership/Standing, Founder Standing → `web-of-trust` / `graperank` (derived).
- **Consumed external concepts (brainstorm.world tag engine, cross-origin — not in this graph):** Tag-Element → `tag`; Membership Assertion → `nostr-user-tag`. The app reads these; it does not define or recompute them.
- **Genuinely new product notions:** Foothold Invite, Notification, Notification Preference, Activity (signs of life), the `replies-to` threading on Post, the Circle `retired` state, and the legible Founder-Standing-decay. The stands-on/fork relationship + Resolved Definition (BIBLE §25/§26) remain new substrate, now also carrying inherited membership fields.

## Deferred entities (named, not modeled)
- **Per-viewer point-of-view** for Trust Signal and Membership → **Phase 3** (launch derives both from the house PoV).
- **Applicant surfacing** (the distinct applied-not-member view) → **Phase 3** (the state is modeled; the UI/flag is deferred).
- **Member profile / directory** as a richer entity → **Phase 3** (launch uses Person's inline identity only).
- **Moderation / dispute-resolution** beyond the existing weightless-dispute mechanic → **Phase 4** (needs its own discovery).
- **Cross-surface portable belonging** and **emergent canonical community** (convergent rosters) → **Phase 4**.
