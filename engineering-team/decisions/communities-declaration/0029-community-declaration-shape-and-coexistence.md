# ADR 0029: Community Declaration shape + strangler coexistence with the bespoke model

**Status:** Proposed
**Date:** 2026-06-05
**Story:** `engineering-team/stories/communities-declaration/33-found-a-circle.md`
**Epic:** `communities-declaration`
**Builds on:** the Communities PRD (`product-team/prd/communities.md`); the Communities-Protocol design (`docs/COMMUNITIES_PROTOCOL_DESIGN_HANDOFF.md` — "a community is a kind-39998 concept"); ADR 0027/0028 (§25 `b` inherit-from + §26 Resolved Definition — the fork substrate this shape must be forward-compatible with).

## Context

Story 33 introduces founding a circle as a **declared definition** in the "right way" model, while the existing app keeps running the **frozen bespoke model** (per resolved Q#2 — strangler, same app surface). Two decisions are load-bearing for the whole MVP:

1. **What is a Community Declaration (CD), on the wire and as a shape?** The bespoke model represents a community as a **kind-39999 ListItem** (`buildCommunityRecord`) on a per-curator kind-39998 `brainstorm-communities` DList header, with membership as kind-39999 endorse/veto signals. The Communities Protocol design states a community **is a kind-39998 concept** in its own right — forkable via a `b` tag (ADR 0027 widened `b` to kind-39998). So the CD is *not* a 39999 item; it is its own 39998 concept header.
2. **How do CDs coexist with the frozen bespoke circles** in one app without entangling frozen code, and **without putting Story 33 on the firmware critical path?**

Grounding: the bespoke app already publishes its kind-39999 records to the relay and reads them back **directly** (client-side relay fetch), independent of firmware/concept-graph ingestion (the Slice-2 dataSources stub). The CD path can use the same direct-relay pattern, which keeps founding unblocked by firmware.

## Options considered

### Option A — CD is a new kind-39998 concept event, read direct from the relay; discovery unions both models (chosen)

A CD is a **kind-39998 event** with `d` = slug, carrying the definition as tags (name, purpose, belonging-bar, founder, topics, and a forward-compatible `b` parent for Block 2). It is marked as a community so reads can distinguish it from the bespoke `brainstorm-communities` DList header and other concept headers. The app **publishes and reads CDs directly from the relay** (mirroring the bespoke relay-fetch pattern), so **no firmware change is required** for Story 33. New builder + read modules live beside the frozen bespoke ones; discovery/detail read paths **union** bespoke (39999) and CD (39998) sources into one normalized `Circle` projection carrying a `model: 'bespoke' | 'declaration'` discriminator. Founding writes a CD only; the bespoke create path is frozen.

**Pros:**
- Matches the protocol ("a community is a kind-39998 concept") and is forkable via `b` on the 39998 — forward-compatible with Block 2 / §25/§26 with no reshaping.
- Strangler-clean: new modules, frozen modules untouched; one normalized projection isolates the UI from the two shapes.
- Off the firmware critical path: direct relay read/write, same proven pattern the bespoke app uses; concept-graph ingestion of CDs is a separable substrate story.
- No data migration; both models coexist; convergence happens when Phase-2 membership lands.

**Cons:**
- Two read paths to maintain during the transition (accepted, temporary — the strangler's known cost).
- CDs as kind-39998 events that the concept-graph doesn't yet ingest means they aren't first-class graph citizens until the firmware-evolution story (acceptable; the app reads them directly meanwhile).

### Option B — Evolve the bespoke kind-39999 `community-record` in place to be the CD (rejected)

Reuse `buildCommunityRecord` / the 39999 shape and add definition fields.

**Why rejected:** conflates the frozen model with the new one and entangles frozen code (violates the strangler stance). It also contradicts the protocol — a community must be a kind-39998 concept to be forkable via `b` (ADR 0027); a 39999 item is not the right substrate. It would force a later reshape when Block 2 lands.

### Option C — CD is kind-39998 but require firmware concept-schema evolution + graph ingestion before founding (rejected for this story)

Make CDs full concept-graph citizens (schema nodes, concept-graph tag per ADR 0007, normalize ingestion) before the app can found one.

**Why rejected:** puts Story 33 on the firmware critical path (schema change → reinstall → ingestion wiring) for no MVP benefit. The app reads/writes CDs directly from the relay today. Full graph citizenship is real and valuable, but it is a **separable substrate story**, not a precondition for founding.

## Decision

Adopt **Option A.**

### The Community Declaration (kind-39998)
- **Kind:** 39998 (a concept header in its own right — a community *is* a concept).
- **Identity:** `d` = slug (per-founder; no hard dedup, consistent with the bespoke policy).
- **Definition tags (illustrative names; final spelling in implementation):**
  - `name` — display name
  - `description` — the purpose (reuse the bespoke tag name for projection symmetry)
  - `belonging` — the belonging-bar, **free prose** (a rule, not a member list)
  - `founder` — the founder's pubkey (a peer, not an owner)
  - `topic` — repeated, for discovery
  - **type marker** — a tag identifying this 39998 as a community CD (e.g., a `z`/type reference to the `brainstorm-community` concept), so reads filter CDs apart from the bespoke `brainstorm-communities` DList header and other concept headers
  - **forward-compatible** `b` — `["b", "<parent-CD a-tag>", "inherit"]` when forking (Block 2). **Not written by founding.**
- **content:** empty (definition lives in tags, consistent with the bespoke records).
- **Concept mapping:** instances of the evolving `brainstorm-community` concept. The concept becomes the *type/schema* CDs conform to; each CD is its own 39998 header.

### Coexistence seam (strangler)
- New module(s) for the CD builder + CD relay-read, **beside** the frozen bespoke modules (which are not touched).
- A single normalized `Circle` projection that both the bespoke (39999) and CD (39998) sources map into, carrying `model: 'bespoke' | 'declaration'`. The UI renders from the projection and stays ignorant of the two shapes.
- **Discovery unions** both sources (dedupe by slug; on collision the model is surfaced, no silent merge). **Founding writes a CD only.** The bespoke create flow is frozen.

### Firmware
**No firmware change or reinstall for Story 33.** CDs are published to and read from the relay directly. Concept-graph ingestion of CDs (so they become first-class graph citizens, with schema + the ADR-0007 concept-graph tag) is a **separate substrate story**, forwarded below.

### Answers to the story's forwarded questions
2. **CD shape / concept mapping** → kind-39998 event, tags above, instances of the evolving `brainstorm-community` concept. **No firmware change** for founding.
3. **Coexistence seam** → new modules + a normalized `Circle` projection with a `model` discriminator; discovery unions; founding writes CD only; bespoke untouched.
4. **Belonging-bar** → **free prose** (a single tag), per the PRD.
5. **Minimal post-publish detail** → the founder lands on a read-only detail rendering name/purpose/belonging-bar/founder-as-peer from the normalized projection. The fuller detail surface is Story 2; this story needs only enough to prove the loop.

## Consequences

### Positive
- The MVP's circle model is the protocol-correct one (39998 concept), forkable by Block 2 with no reshape.
- The frozen bespoke app keeps working; no migration, no destabilization of the live deployment.
- Founding ships without any firmware dependency.

### Negative / risk
- Two read paths during the transition (temporary, the strangler's accepted cost). Mitigation: the normalized projection confines the divergence to the data layer.
- CDs aren't graph-ingested yet, so they won't appear in concept-graph queries until the firmware-evolution story. Mitigation: the app reads them directly; flagged as a named follow-up.
- A kind-39998 event that isn't a full concept could confuse a concept-graph normalize pass that assumes every 39998 is an ingestible header. Mitigation: the type-marker tag lets both the app and a future normalize pass identify CDs deliberately.

### Neutral
- Additive: the bespoke modules and ADRs are untouched; no behavior change to existing circles.

**Firmware reinstall required?** **No** (for this story).

## Implementation notes (for the Implementer)
- New `ui-communities/src/events/declaration.js`: `buildCommunityDeclaration({ viewerPubkey, circle, parentATag })` → kind-39998 with the tags above (`parentATag` → a `b` tag; unused by founding).
- New CD relay-read (filter kind-39998 by the community type-marker) projecting to the normalized `Circle` shape `{ model:'declaration', slug, name, purpose, belongingBar, founder, topics, parent? }`.
- Found flow: on publish, write the CD, then land on the read-only detail rendered from the projection. Sign-in requested only at publish; preserve typed state. Specific publish-error copy (reuse `lib/errors.js`).
- Discovery/detail: union the bespoke and CD sources behind the normalized projection; tag each with `model`. Do not touch `build.js`'s bespoke builders.
- Copy per `communities-style-guide.md`: founder is a peer; no owner/admin/moderator labels; specific errors.

## Out of scope (named, deferred)
- **Fork / `b` resolution** (Block 2, Story 4) — the shape is forward-compatible; founding does not write `b`.
- **Trust signal** (Block 3).
- **Membership** (Phase 2, blocked).
- **CD concept-graph ingestion** (schema nodes, ADR-0007 concept-graph tag, normalize pass) — **separate substrate story**; not needed for founding.
- **Migration** of bespoke kind-39999 circles into CDs — explicitly not done.
- **Editing** a CD after publish — later story.
