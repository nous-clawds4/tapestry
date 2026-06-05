# Domain Model: Communities

**Slug:** communities
**Date:** 2026-06-05
**Modeler phase:** Domain Modeling (Phase 4)

> Conceptual model only — what the product knows about, not how it stores it. Handle prefix for this instance: `39998:fee78a4ffc01e50124ae34112db6fde62edd098f731311f58f3ef7667a4902bb:<slug>`.

## Entities

### Circle
- **Description:** A community expressed as a *stated definition* — its purpose and what it takes to belong — that anyone can stand on or fork; it has no owner.
- **Concept mapping:** existing `…:brainstorm-community` — **but evolving.** Today that concept is owner/signal-shaped; the right-way Circle is *definition-bearing* (a "Community Declaration"). Reuse the handle; the definition shape is an evolution engineering reconciles, not a parallel concept.
- **Attributes:**
  | Attribute | Type | Required | Notes |
  |---|---|---|---|
  | name | text | yes | |
  | purpose | text | yes | what the circle is for |
  | belonging-bar | text | yes | what it takes to belong, in plain terms (the *rule*, not a member list) |
  | founder | ref:Person | yes | who declared it; not an owner — a peer |
  | topics | text (multi) | no | for discovery |
  | parent | ref:Circle | no | the circle this one stands on / forked from |

### Person
- **Description:** An identity that founds, forks, participates in, and (Phase 2) belongs to circles.
- **Concept mapping:** existing `…:nostr-user`
- **Attributes:**
  | Attribute | Type | Required | Notes |
  |---|---|---|---|
  | identity | ref | yes | the portable identity (public key) |
  | display name | text | no | from their profile |
  | picture | URL | no | from their profile |

### Post
- **Description:** A message contributed to a circle's conversation.
- **Concept mapping:** existing `…:nostr-event` primitive (a standard note); no dedicated concept — new only as a product notion ("circle post").
- **Attributes:**
  | Attribute | Type | Required | Notes |
  |---|---|---|---|
  | author | ref:Person | yes | |
  | circle | ref:Circle | yes | which circle it's scoped to |
  | body | text | yes | |
  | time | date | yes | |

### Trust Signal *(viewer-relative, derived — not stored)*
- **Description:** How much a given viewer's web of trust vouches for a person — the signal that makes real members legible and impersonators weightless.
- **Concept mapping:** existing `…:web-of-trust` / `…:graperank`
- **Attributes:**
  | Attribute | Type | Required | Notes |
  |---|---|---|---|
  | viewer | ref:Person | yes | trust is *per point-of-view*, never absolute |
  | subject | ref:Person | yes | who is being assessed |
  | strength | number | yes | derived from the trust graph, not entered |

### Resolved Definition *(derived — not stored)*
- **Description:** A circle's *effective* definition after following its `parent` (fork/stand-on) chain and applying the child's overrides.
- **Concept mapping:** **new (newly-ratified substrate)** — BIBLE §25 inherit-from + §26 Resolved Definition; no prior concept node.
- **Attributes:** none of its own — it is *computed* from a Circle and its parent chain (child's stated fields win over inherited ones).

## Relationships
Named and directional:

- Person **founds** Circle
- Circle **stands on / forks** Circle *(child → parent; the definition-inheritance edge)*
- Person **posts** Post **in** Circle
- Person **trusts** Person *(per-viewer; the basis of Trust Signal)*
- Resolved Definition **derives from** Circle + its parent chain

## States and lifecycle

- **Circle:** drafted → declared (live) → *(may be)* forked-from / stepped-back-from. A circle **persists** after its founder steps back — no owner to collapse it.
- **Post:** composed → published.
- *(Membership states applicant → member are **deferred to Phase 2** — see below.)*

## New vs. existing (Tapestry products)

- **Maps to existing concepts:** Circle → `brainstorm-community` *(evolving shape)*, Person → `nostr-user`, Post → `nostr-event`, Trust Signal → `web-of-trust` / `graperank`.
- **Genuinely new (newly-ratified substrate):** the **stands-on / fork** relationship and **Resolved Definition** (BIBLE §25/§26) — these have no prior concept node and are what this session ratified.

## Deferred entities (Phase 2 — named, not modeled)

Per scope, the Belonger's membership layer is Phase 2 and is **not modeled here**:

- **Membership / Standing** — the per-viewer roster and the applicant → member lifecycle.
- **Vouch** — a trust-weighted assertion that a person belongs *(will map to the mid-integration trust/identity primitive — the cross-team dependency)*.
- **Dispute** — a trust-weighted assertion that a person does **not** belong (weightless when it comes from an untrusted source).
