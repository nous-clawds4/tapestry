# Story 3: Create a Tapestry (members-only authoring)

**Status:** Draft
**Created:** 2026-07-24
**Type:** Feature

## Background
The `tapestries` epic shipped the **read-only** surface — a directory (`View Tapestries`) and a
per-tapestry Exploration page — and explicitly deferred authoring to "a future story." The
`/tapestry/tapestries/new` page (`NewTapestry.jsx`) is an inert placeholder: it previews the planned
fields but has no working submit. The build audit's `prd-seed.md` names this exact page as the next
phase and flags its authoring UX as the biggest open question.

This story delivers the **first working authoring capability**: the instance owner creates a Tapestry
by naming it and choosing which existing concepts it groups, and publishes it as a real, explorable
tapestry element — no hand-editing of nostr events. It is deliberately a **members-only** slice:
authoring the cross-concept integrations *between* members (subsets / elements / enumerations) is left
to a fast-follow. v1's job is to establish the complete **create → publish → appears in directory →
explorable** loop and the authoring conventions later stories build on.

**Who is affected:** the instance **owner** (the "curator" persona). Explorers (any visitor) benefit
indirectly — newly created tapestries appear in the public directory and render on the existing
Exploration page.

## User-facing description
As the **instance owner**, I want to create a new Tapestry by giving it a title and description and
selecting which existing concepts it groups — and publish it either under **my own key** or as my
**Tapestry Assistant** — so that the Tapestry appears in the directory and is explorable just like the
seeded ones, without me having to hand-craft a nostr event.

## Acceptance criteria
Testable from the outside (members-only v1).

- [ ] **Owner-gated.** Given a visitor who is not the owner/admin (unauthenticated, guest, or a regular
  signed-in user), when they view the Tapestries directory or navigate to `/tapestry/tapestries/new`,
  then no working create affordance is offered to them and the page explains that creating a Tapestry
  is owner-only. Given the owner/admin, the create affordance and a working form are available.
- [ ] **Compose.** Given the owner on the Create page, when the form loads, then they can enter a
  **Title** (required) and a **Description** (optional) and select **one or more** existing member
  concepts by name (searching/choosing from the concepts that exist on this instance).
- [ ] **Publish shape.** Given a title and ≥1 selected concept, when the owner submits, then a
  **kind-39999** tapestry element is published to the relay that (a) is **z-tagged** to the tapestry
  concept handle (`39998:<TA>:tapestry`) so it appears in the directory, and (b) carries a `json` tag
  whose `tapestry` block holds the title + description and whose `graph` block contains **one
  concept-header node and one `*-concept-graph` import per selected concept**.
- [ ] **Signing selector, owner-enforced.** Given the owner has chosen "**my own key**", when they
  submit, then the event is signed via their NIP-07 signer (author = owner's pubkey). Given they chose
  "**Tapestry Assistant**", then the event is server-signed as the TA (author = TA pubkey). A request
  to mint a **TA-signed** event from a non-owner session is refused by the server.
- [ ] **Round-trips.** Given a successful publish, when it completes, then the owner is taken to (or
  given a direct link to) the new Tapestry, the new Tapestry is retrievable in the **directory**, and
  it renders on the **Exploration page** with its selected member concepts listed.
- [ ] **Validation & failure are visible.** Given a submit with no title or zero selected concepts, the
  form blocks submission and states what's required (nothing is published). Given a signer/relay
  failure during publish, the owner sees a clear error and no partial or duplicate tapestry is silently
  created.

## Concepts touched
Handles use the instance's runtime-resolved TA pubkey (`<TA>`) — **never hardcode it** (CLAUDE.md).

- `39998:<TA>:tapestry` — **Tapestry** concept. Its *elements* are individual tapestries; a created
  tapestry is a kind-39999 element **z-tagged** to this handle (this is what the directory reads).
- Per selected member concept: `39998:<TA>:<slug>` — the concept **header** (becomes a `graph.nodes`
  entry), and `39999:<TA>:<slug>-concept-graph` — the concept's importable graph (becomes a
  `graph.imports` entry, resolved at read time by the Exploration page). *The Architect resolves the
  data source for the concept picker and the exact node/import shape at runtime.*

## Out of scope
- **Cross-concept integration authoring** — asserting subsets / elements / enumerations *between*
  selected members. v1 publishes membership only; those relationships surface via import resolution on
  the Exploration page. Explicit authoring (and auto-derivation from the live graph) is a fast-follow.
- **Editing or deleting** an existing Tapestry.
- Letting **non-owners** publish tapestries; POV/WoT filtering of the directory.
- Transitive import expansion (property-tree / core-nodes graphs).

## Open questions
- **Default signing identity** — should the selector default to **Tapestry Assistant** (consistent with
  the TA-signed seed tapestries; a uniform curated gallery) or the **owner's own key** (provenance /
  decentralized-first)? *PO proposal: default to Tapestry Assistant, owner can switch per-create.*
- **Concept-picker data source under an empty/absent local graph** — the local Docker stack is down and
  its graph is empty, so the picker can't be smoke-tested against live concepts locally; v1 must be
  verifiable via unit tests + `vite build` + mocked UI, and must degrade gracefully when no concepts are
  available. *Flagged for the Architect (data source + empty-state); not a blocker for approval.*

## Linked artifacts
- ADR: `engineering-team/decisions/tapestries/0003-create-tapestry-authoring.md`
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
