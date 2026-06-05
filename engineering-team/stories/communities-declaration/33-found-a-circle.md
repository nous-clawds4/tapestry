# Story 33: Found a circle by declaring its definition

**Status:** Draft (Planning)
**Created:** 2026-06-05
**Type:** Feature
**Epic:** `communities-declaration` · **Product source:** PRD §5.3 / stories-queue Block 1, Story 1 (Convener).

## Background

The Communities product (PRD `product-team/prd/communities.md`) reframes a community as a **declared definition** with no owner, instead of an admin-owned roster. The first capability — and the end-to-end proof of the whole model — is letting a person **found a circle by declaring it**: a name, a purpose, and a *belonging-bar* (what it takes to belong, stated as a rule in plain prose, not a member list). On publish, the founder lands in the circle as a **peer, not an owner**.

This ships as a **new code path inside the existing `ui-communities` surface**, alongside the frozen bespoke community model (resolved Q#2 — strangler approach; see the epic). Founding a new circle must not disturb existing bespoke circles.

## User-facing description

As a **Convener**, I want to start a circle by describing what it is and what it takes to belong, so that a community exists on my terms without me becoming its owner or its single point of failure.

## Acceptance criteria
Testable from the outside.

- [ ] Given a signed-in user, when they complete the found flow (name, purpose, belonging-bar) and publish, then a new circle exists and is retrievable afterward.
- [ ] Given a successful publish, when it completes, then the founder lands on the new circle's read-only detail view.
- [ ] Given any view of the circle, then the founder is shown as a **peer** — no "owner," "admin," or "moderator" label appears anywhere.
- [ ] Given the found flow, then the belonging-bar is captured as **prose** (a rule), not as a member list or a roster control.
- [ ] Given a signed-out user in the found flow, then sign-in is requested **only at the publish step**, and their typed state survives sign-in.
- [ ] Given a publish failure, then specific copy is shown by failure mode (could not reach the network / signing cancelled / try again), never "something went wrong."
- [ ] Given existing bespoke circles, when a new circle is founded, then the existing circles are unaffected (strangler coexistence).

## Concepts touched
Architect should orient via `/api/concept-graph/summaries` (local stack is up on :8080; the API is at `http://localhost:8080/api/concept-graph/...`, not :8877).

- `39998:<TA>:brainstorm-community` — the community concept, **evolving** from the bespoke owner/signal shape toward a *definition-bearing* Community Declaration. Reuse the handle; the Declaration shape is an evolution, not a parallel concept.
- `39998:<TA>:nostr-user` — the founder's identity (peer, not owner).
- *(Forward reference only)* §25 inherit-from / §26 Resolved Definition — the Declaration shape should be **forward-compatible with a `parent` field** for forking (Block 2), but founding does not exercise inheritance.

## Out of scope
- **Fork / standing-on a parent definition** → Story 4 (`communities-inheritance`).
- **Trust signal** on the circle → Block 3 (`communities-trust-signal`).
- **Membership** — join, vouch, roster, applicant→member → Phase 2 (`communities-membership`, blocked).
- **Posting** to the circle → Story 8 (`communities-participation`).
- **Editing** a circle's definition after publish → later story.
- **Migrating** existing bespoke (kind-39999) circles into Declarations → explicitly not done (strangler; no big-bang migration).
- **Discover / view** as separate surfaces → Stories 2 and 3 (this story only needs the founder to land on a minimal read-only detail to prove the loop).

## Open questions

**Resolved at planning:**
1. **Q#2 (evolve vs parallel)** → **strangler / parallel in the same app** (user-ratified 2026-06-05). New Declaration circles coexist with the frozen bespoke model; no migration.

**Forwarded to the Architect (resolve in the ADR):**
2. **The Community-Declaration shape** — what fields a declared circle carries (name, purpose, belonging-bar, founder, topics, forward-compatible `parent`) and how it maps onto the evolving `brainstorm-community` concept. Does this require a firmware concept-schema change (and therefore a reinstall)?
3. **The coexistence seam** — how Declaration circles and bespoke kind-39999 circles live together in the same app's data/read paths without entangling the frozen code (the strangler boundary).
4. **"Belonging-bar" representation** — captured as free prose for v1, or a light structured form? PO leans free prose (PRD says prose, not a settings table); confirm.
5. **Minimal read-only detail** for the post-publish landing — how much of the (Story 2) detail view is needed here vs. deferred.

## Linked artifacts
- PRD: `product-team/prd/communities.md` §5.3 · Design guide: `product-team/guides/communities-design-guide.md` (Found/Fork stepper, §5.3 screen) · Style guide: `communities-style-guide.md` (peer-not-owner copy, specific errors).
- ADR: [`../../decisions/communities-declaration/0029-community-declaration-shape-and-coexistence.md`](../../decisions/communities-declaration/0029-community-declaration-shape-and-coexistence.md) — **Proposed** (2026-06-05). CD = kind-39998 concept (not a 39999 item); strangler coexistence via a normalized `Circle` projection; no firmware change for founding; forward-compatible with `b`/§26 fork.
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
