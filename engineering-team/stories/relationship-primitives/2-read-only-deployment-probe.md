# Story 2: Read-only deployment probe for the primitives surface

**Status:** Draft
**Created:** 2026-07-21
**Type:** Feature (fix-forward)
**Epic:** `relationship-primitives`

## Background

The book's acceptance frame, bullet 8(a), requires journaled proof that the relationship-primitives routes are **deployed** on `staging.brainstorm.world` — "a response distinguishable from a missing route." The frame's anticipated mechanism (an auth-class 401/403 answer proving deployment where a 404 would disprove it) was **falsified during story #1's Test Design**: the surface's default-deny auth middleware answers unauthenticated mutations *before* route matching, so a missing route answers identically to a present one; and global CORS handling answers preflight on every path. No existing read-only response from a deployed instance can distinguish the new routes from missing ones.

**Operator ruling (2026-07-21, journaled):** add a fix-forward story — a minimal read-only probe surface deployed alongside the primitives, whose response IS distinguishable from a missing route ("a GET answers where an unregistered path 404s"), so the frame's evidence bullet is satisfiable as written — with no credentials, no graph access, and no mutation.

This is the book's fix-forward allowance in use: story 2 of the 3-story cap (fix-forward stories count).

**Scope note:** this probe exists to *evidence deployment* — nothing more. It is not a health check, a monitoring system, or a status endpoint, and it must stay minimal. Adding operational richness to it is out of scope by design.

## User-facing description

As the operator (or the Director supervising the deploy chain), I want a way to confirm from outside a deployed instance — with no credentials and no side effects — that the relationship-primitives surface shipped there, so that the book's staging delivery evidence can be captured and journaled without mutating or authenticating against the instance.

## Acceptance criteria

- [ ] **Answers without credentials.** Given a deployed instance carrying the primitives, when a remote caller with no credentials and no session makes the read-only probe request, then it receives a successful answer — not an auth challenge or denial.
- [ ] **The answer evidences the primitives surface.** The probe ships alongside the primitives (same delivery unit), and its response affirmatively indicates that the relationship-primitives operations are available on that instance — so a probe answer is attributable evidence that the primitives deployed, not a generic response any instance would give.
- [ ] **Missing-route contrast.** On the same deployed instance, the same kind of request to an unregistered sibling path yields an observably different answer than the probe — so a remote caller can distinguish "probe present" from "route missing," which is exactly what falsified the original mechanism.
- [ ] **Zero side effects.** Probing performs no graph reads or writes, touches no strfry, signs or publishes no nostr event, and triggers no derivation; probing repeatedly leaves the system unchanged. It exposes no capability beyond answering — no mutation, nothing credentialed.
- [ ] **Constitutes bullet 8(a) evidence on staging.** Given the primitives deployed on `staging.brainstorm.world`, when the probe and the sibling-path contrast are exercised from outside and their responses captured, then that record satisfies the frame's bullet 8(a) — journaled proof the routes are deployed, distinguishable from a missing route.

## Delivery

The staging exercise of criteria 1–3 is **read-only evidence capture**, within the book's autonomy ceiling: the Director never mutates a deployed instance, and all functional testing happens against the local stack. Capture of the staging responses (probe + contrast) is journaled per the book's evidence rules.

## Concepts touched

None. The probe deliberately reads nothing from the concept graph — no graph access is part of its contract (operator ruling). It touches no `39998:*` concepts.

## Out of scope

- **Health, monitoring, and status reporting** — uptime checks, metrics, dashboards, version/build metadata beyond affirming this surface's availability. The probe is deployment evidence only (scope note above).
- **Evidencing any other API surface's deployment** — this probe speaks for the relationship-primitives surface, not the instance generally.
- **Any mutation capability and any credentialed behavior** on the probe.
- **Changing the primitives' own auth behavior** — default-deny plus the explicit owner gate stand as specced in story #1; this story adds a probe beside them, it does not touch them.
- The intake entry's out-of-scope list still applies (2026-07-18): strfry emission of any kind; a reconciler; publication-intent modeling; curator-assertion wire format; UI affordances; fixing the `/elements/add-node` crash; fixing the `publishToStrfry` silent-drop bug.

## Open questions

None blocking. The probe's route naming/placement and response shape are the Architect's, resolved in the pattern of the book's delegated decisions #1 and #5 (simplest option that satisfies the frame, journaled with rationale). The acceptance criteria above are deliberately neutral to how each resolves.

## Linked artifacts

- Book: `engineering-team/audits/relationship-primitives/book.md` (acceptance frame bullet 8(a) — the bullet this story makes satisfiable)
- Decision journal: `engineering-team/audits/relationship-primitives/journal.md` (falsification finding + operator ruling, 2026-07-21)
- Predecessor: `engineering-team/stories/relationship-primitives/1-relationship-add-delete-primitives.md` (the surface this probe evidences)
- Intake: `engineering-team/stories/_intake.md` → "2026-07-18 — Feature: primitive relationship add/delete endpoints (Neo4j-only, strfry-free)"
- ADR: `engineering-team/decisions/relationship-primitives/0002-read-only-deployment-probe.md`
- Test plan: `engineering-team/stories/relationship-primitives/2-read-only-deployment-probe.test-plan.md`
- Review: (filled in after Review phase)
