# Story 1: Pin a tag within a community context

**Status:** Draft
**Created:** 2026-07-16
**Type:** Feature

## Background

Today a pinned tag is **neutral** — a user pins a tag and it stands alone, with no
indication of *why* or *for whom* it matters. Communities (e.g. LFO) want to say
"these are the pinned tags relevant to us" so a community-specific client can surface
them — for example, as topic chips in its navigation. There is no way to express that a
pin belongs to a community's context, so there is nothing for such a client to read.

This story introduces **contexts** (a lightweight, community-scoped grouping) and lets a
user pin a tag *within* a chosen context, in addition to (not instead of) pinning it
neutrally. It is deliberately a stepping stone toward full Community Declarations, which
are too large to build now; a context is the minimal durable anchor that gets community
pins flowing and gives other teams something concrete to build clients against.

A second motivation is **reusability**. A core project goal is that the things we pioneer
here are easy for other people to implement in their own clients. So the logic that turns
a community's context pins into a display-ready, trust-filtered set of tags must be
available as a portable, stack-agnostic building block — not locked inside our server.

Affected: anyone who pins tags; community operators (starting with LFO) who want to read a
community's pinned tags; third-party client developers who will consume or reimplement
this.

## User-facing description

As a user, I want to pin a tag **within a community context** (or neutrally, as today), so
that the communities I care about can surface the tags I've pinned for them — while my
neutral pins stay separate and my curation of each pin stays independent.

As a community-client developer, I want a portable way to turn "the pins in this
community's context" into a trust-filtered list of tags, so that I can build a community
feed (e.g. tag chips in the nav) without depending on this project's server stack.

## Acceptance criteria

Testable from the outside. "Context" = a named, community-scoped grouping offered to the
user at pin time. The initial offered set is **LFO** and **Tapestry & Web of Trust**.

**Pinning within a context**

- [ ] Given the pin affordance on a tag, when a user pins without choosing a context, then the tag is pinned neutrally exactly as it is today (no behavior change to the existing one-step pin).
- [ ] Given the pin affordance, when a user chooses to pin to a context, then they are offered the current set of contexts (initially LFO and Tapestry & Web of Trust) and can pick one; choosing a context is optional.
- [ ] Given a user pins tag T to context C, when the pin is created, then it is associated with exactly one context (C).
- [ ] Given a user has pinned tag T neutrally, when they also pin T to context C, then **both pins coexist** — the neutral pin and the context pin both remain and are independently addressable.
- [ ] Given a user has pinned tag T to context C, when they also pin T to a different context D, then both context pins coexist independently.
- [ ] Given a user removes one of their pins of tag T (the neutral one, or a specific context pin), when the removal is published, then the other pins of T are unaffected.

**First-class parity**

- [ ] Given a context pin exists, then it has the same first-class capabilities as a neutral pin — its own curation configuration, its own materialized trusted list, its own list export, and its own detail view — with none of these shared with or clobbering the user's other pins of the same tag.
- [ ] Given a user reconfigures the curation of one pin of tag T, when the change is published, then the trusted lists/exports of their other pins of T are unaffected.

**Discoverability & trust filtering**

- [ ] Given pins associated with context C by various authors, when a consumer queries for "pins in context C", then it receives the pins associated with C and does **not** receive pins that were never associated with C (a neutral pin of the same tag does not appear).
- [ ] Given a set of context-C pins from multiple authors and a chosen point of view (POV), when the community's tags are derived, then only pins whose authors pass that POV's trust filter are counted, and the result is the **de-duplicated** set of pinned tags (two people pinning the same tag yields one tag), each carrying enough to display it (name/slug).

**Portability**

- [ ] Given a collection of pin events and a supplied POV trust check, when the "context pins → display tags" derivation runs, then it produces the trust-filtered, de-duplicated tag list **without** requiring this project's server, database, or relay process (pure input → output; any data access is supplied by the caller).

**Provisioning to a fresh deployment**

- [ ] Given a fresh deployment, when the standard firmware install runs, then the initial contexts exist as addressable anchors derivable from their names — with **no event IDs copied into client code** — so the same client works across deployments.

## Concepts touched

- `39998:82b75e47…973833:tag-pinning` — tag pinning (existing; a pin gains an optional association to a context)
- `39998:82b75e47…973833:tag` — tag (existing; the thing being pinned — unchanged)
- **NEW** context/community-scoped concept headers, one per offered context (initially "LFO" and "Tapestry & Web of Trust"). Introduced by this story; the Architect resolves the exact handles, slugs, and the mechanism by which a pin references a context. (Design intent from advisory: contexts are firmware-seeded concept headers; the pin references its context as a **stamp** per the Stamping convention — the containment side of stamping's containment-vs-membership boundary — using the deployment's runtime Tapestry Assistant identity, never a hardcoded literal.)

## Out of scope

- **Rendering context chips in *our own* client UI.** Deferred to a follow-on story in this epic. This story delivers the pins and the portable derivation helper (the reference other clients build against), not a chip nav in our product.
- **User-created contexts.** v1 offers a fixed, hardcoded set. Letting users create or name their own context is deferred.
- **More than one context per pin.** A pin references exactly one context. Breadth ("this tag matters to several communities") is expressed by holding several context pins of the tag, not by multi-context pins.
- **Full Community Declarations / communities.** Contexts are a deliberate proto-step; deference, membership, rosters, and the `claims` model are out.
- **Automatic / cloud stamping.** Contexts are applied only by the user's explicit choice (declared affiliation). No auto-routing a pin into a community the user didn't pick.
- **Sub-context breadth expansion.** A query for a context returns pins stamped *directly* with that context; walking sub-communities to gather "everything under C" is out.
- **Community-derived POV.** The trust filter uses the viewer's POV (or the instance default when logged out); sourcing the filter from a community's resolved web of trust waits for Community Declarations.

## Open questions

- Confirm the slug for "Tapestry & Web of Trust" (proposed `tapestry-web-of-trust`); "LFO" → `lfo`. (Display names are as written; slugs are the Architect's to finalize.)
- Confirm the follow-on split: is our-client chip rendering genuinely a separate story #2, or does any minimal in-product surfacing belong here? (PO recommendation: separate story.)

## Linked artifacts

- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
