# Story 1: Strfry-free relationship add/delete primitives

**Status:** Done
**Created:** 2026-07-21
**Type:** Feature
**Epic:** `relationship-primitives`

## Background

Operator's request (verbatim, intake 2026-07-18):

> In any case, I am thinking that for now, we should just build simple tool that allows me to add (or delete) a HAS_ELEMENT relationship in neo4j between two nodes that exist in neo4j, without dealing with strfry at all. And we're going to need a lot more very simple, very basic tools like that, starting with tools to add or delete the other basic relationship types.

The governing premise that makes strfry-free correct here (operator, verbatim): *"The information in neo4j should be considered the reference; it is 'me', the second brain of the tapestry owner / operator … Strfry is simply one format by which information can be communicated between one tapestry instance and another."* These operations edit the reference directly.

Today no such tools exist: every existing composite write bakes in node-type assumptions, side effects, and strfry emission; **no single-edge delete exists anywhere**; and the only strfry-free arbitrary-pair primitive is raw Cypher — no existence checks, no whitelist, no idempotency contract, no structured result.

Context that changed since scoping (2026-07-21): the surface these land on is now **default-deny for unauthenticated mutations** (epic `security-auth-exposure`), and default-deny alone still admits *authenticated non-owners* — so each operation must carry its own explicit owner gate rather than relying on the shared surface's auth.

This story realizes the full acceptance frame of book `engineering-team/audits/relationship-primitives/book.md` (armed Direction-mode run). One story covers both operations — operator-ratified: they share a whitelist, a validation path, and a test harness.

## User-facing description

As the Tapestry operator, I want to add or delete a single, typed relationship between two nodes that already exist in my instance's Neo4j reference graph — by plain `curl` from the local/Docker host, with validation and a structured answer — so that routine graph curation no longer requires raw Cypher and never touches strfry or publishes any nostr event.

## Acceptance criteria

- [x] **Add is idempotent.** Given two nodes that already exist in Neo4j (each identified by uuid) and a whitelisted relationship type supplied by the caller, when the add operation is called, then the relationship exists afterward and the response reports *created*; when the identical call is repeated, then exactly one such relationship exists and the response reports *already-existed*.
- [x] **Delete is targeted.** Given that relationship exists, when the delete operation is called, then only the named relationship type between the named node pair is removed (never a bulk sweep) and the response reports *deleted*; when the call is repeated — or made for a relationship that never existed — then nothing is removed and the response reports *not-found*.
- [x] **Preconditions fail loudly, never silently no-op.** When either operation is given a `fromUuid` or `toUuid` that does not exist in Neo4j, or a relationship type absent from the whitelist, then nothing changes and the error response names which precondition failed. The whitelist admits only relationship types already carried by the firmware alias layer, and its names resolve through that alias layer rather than hardcoded string literals — so an alias change cannot silently orphan the whitelist. Net-new custom types (e.g. `HAS_SUBGOAL`) are rejected.
- [x] **Owner-gated, locally reachable.** Each operation independently enforces an explicit owner gate — it does not rely on the surface's default-deny alone, which blocks only unauthenticated callers. An owner session or a trusted local caller (plain `curl` from the local/Docker host, consistent with the existing `/api/normalize` calling convention) succeeds; an authenticated **non-owner** receives 403 from both operations; an unauthenticated remote caller is denied.
- [x] **Strfry-free, with the install hazard documented.** Neither operation touches strfry, re-signs or publishes any nostr event, regenerates any `json` tag, or triggers derivation — an automated test asserts no event is written by either operation. The firmware-install overwrite hazard (an install can re-add a deleted edge and delete an added one) is documented where an operator using these operations will encounter it; changing install's behavior is explicitly out of scope (operator decision, 2026-07-18).

**Minimum test coverage** (floor fixed by the book's acceptance frame, for Test Design): add-new, add-idempotent, delete-existing, delete-missing, nonexistent endpoint node, rejected `relType`, authenticated non-owner → 403 from both operations, and the no-strfry-write assertion. Tests exercise the **local** stack only and leave the graph as they found it — create and clean up their own fixture nodes; never mutate firmware or `39998:<TA>:shared-concept` structure as a side effect (book ceiling clarification).

## Delivery

Live on `staging.brainstorm.world` with the staging smoke test passing (book frame). Per the pre-registration's evidence split: staging gets a **read-only deployment probe** only (an auth-class response distinguishable from a missing route proves the routes are deployed); all functional evidence is captured against the local stack; the deploy-safety `safe-to-merge` check is run against staging before this book's merge and its output journaled. The Director never invokes add/delete against a deployed instance.

## Concepts touched

(`<TA>` = the per-deployment Tapestry Assistant pubkey — resolved at runtime, never hardcoded.)

- `39998:<TA>:relationship` — relationship (the thing each operation adds or deletes)
- `39998:<TA>:relationship-type` — relationship type (what the whitelist validates the caller-supplied type against)
- `39998:<TA>:class-thread` — class thread (the structural pattern whose edges these primitives edit)
- `39998:<TA>:set`, `39998:<TA>:superset` — node types named in the delegated parent-label-validation question

## Out of scope

Verbatim from the intake entry: strfry emission of any kind; a reconciler; publication-intent modeling; curator-assertion wire format; UI affordances; fixing the `/elements/add-node` crash; fixing the `publishToStrfry` silent-drop bug (own entry needed — see the 2026-07-18 session findings on `add-to-set`).

Additionally, per the book and its pre-arming refresh (2026-07-21):

- Changing firmware install's behavior — the overwrite hazard is **documentation-only** in this book; treating it otherwise is frame-changing.
- Net-new custom relationship types (e.g. `HAS_SUBGOAL` for the upcoming `second-brain` work) — a post-book whitelist extension.
- The authenticated-non-owner gap on the rest of the admin-mutation surface — scoped separately (intake 2026-07-21); this story gates only its own two operations.

## Open questions

None blocking. The book's pre-registration delegates six design decisions to the Director (exhaustive list in `book.md` → "Open design decisions delegated to the Director"): route naming under the fixed `/api/normalize/*` mount; initial whitelist membership among firmware-aliased types; one route vs two; parent-label validation strictness; response shape and status codes for the idempotent cases; and the test strategy for a contract that is a Neo4j side effect. The acceptance criteria above are deliberately neutral to how each resolves; resolutions are journaled at the phase boundary per the pre-registration.

## Deviations

- (Implementation, 2026-07-21) The module-header usage example sends `"relType":"CLASS_THREAD_TERMINATION"` (canonical slug) instead of the ADR's sketched `"relType":"HAS_ELEMENT"`, with the alias spelling mentioned unquoted alongside. The ADR's own S-class spec (ratified as test S2) forbids any whitelisted Neo4j alias appearing as a quoted literal anywhere in `relationships.js` — including the doc comment — so the stricter clause won. No behavior difference: both spellings are accepted at runtime.

## Linked artifacts

- Book: `engineering-team/audits/relationship-primitives/book.md` (acceptance frame — this story traces to all its bullets)
- Intake: `engineering-team/stories/_intake.md` → "2026-07-18 — Feature: primitive relationship add/delete endpoints (Neo4j-only, strfry-free)"
- Handoff: `docs/RELATIONSHIP_PRIMITIVES_HANDOFF.md`
- ADR: `engineering-team/decisions/relationship-primitives/0001-strfry-free-relationship-primitives.md`
- Test plan: `engineering-team/stories/relationship-primitives/1-relationship-add-delete-primitives.test-plan.md`
- Review: `engineering-team/reviews/relationship-primitives/1-relationship-add-delete-primitives.md` (PASS, 2026-07-21)
