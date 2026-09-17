# Second Brain — Story 2 Session Handoff (2026-07-23)

**Status:** ✅ ADDRESSED — story 2 (structures-the-brain-can-trust) review PASS 2026-07-23; the queue's defect inventory was falsified live (edges adjudicated legitimate-and-retained, operator-ratified); the real drift (primary-property records lagging extended schemas) reconciled on both work-item concepts. See `engineering-team/reviews/second-brain/2-structures-the-brain-can-trust.md` and the story-3 handoff.

> Written at the close of the story-1 session (capture-a-goal-and-see-it: shipped to
> production 2026-07-23, review PASS). This is the pickup prompt for the next session,
> with the load-bearing discoveries from story 1 baked in. When story 2 ships, flip
> this Status to ✅ ADDRESSED.

## Pickup prompt

Pick up story 2 of the second-brain book — **"Structures the brain can trust."**
Story 1 shipped to production 2026-07-23. The book, epic, and stories folder
already exist — do **not** re-open the book. Branch fresh off updated staging
(`git checkout staging && git pull`, then re-create `feat/second-brain`).

Read, in order:

1. `product-team/stories-queue.md` — the Second Brain block, Story 2 (hygiene;
   PRD §5.7, §7.8). Queue order is pickup order.
2. `product-team/prd/second-brain.md` — §5.7 and §7 (the Policy Constitution
   binds every story).
3. `engineering-team/epics/second-brain.md` and
   `engineering-team/audits/second-brain/book.md` — roster, guardrails,
   coverage-gap notes.
4. `engineering-team/decisions/second-brain/0001-goal-capture-and-goals-view.md` —
   binding context: its Consequences flag items story 2 must pick up, and the
   pure core it shipped (`src/lib/brain/goals.js`) is the shared classification
   surface your checker must reuse, never re-derive.
5. `engineering-team/reviews/second-brain/1-capture-a-goal-and-see-it.md` —
   PASS; non-blocking findings swept to OPEN.md rows 82–83.
6. `engineering-team/audits/relationship-primitives/audit.md` §3+§6 — story 2's
   declared dependency is **shipped**: `POST /api/normalize/delete-relationship`
   is live (owner-gated, whitelist `HAS_ELEMENT` | `IS_A_SUPERSET_OF`, targeted,
   strfry-free). Reference it; never re-implement or extend its whitelist.

## Load-bearing corrections from story 1's recon (verified live 2026-07-22)

Reconcile the queue's defect inventory against the live graph **before** writing
acceptance criteria:

- The queue's "two known stray membership edges" claim is partly stale: the
  `set-superset` / `superset-superset` → goal-superset `HAS_ELEMENT` edges are
  **incoming** and legitimate class-thread data (the goal superset is itself an
  element of the set and superset concepts) — not pollution. The candidate real
  irregularity is the header-side `HAS_ELEMENT` wiring on the two work-item
  concept **headers** (`tapestry-owner-goal` → `concept-header-superset`;
  inspect the `project-for-the-engineering-team` sibling live). Edge
  **direction** is the discriminator — the `/neighbors` endpoint erases it, so
  verify with directed Cypher, not neighbors output.
- Firmware install pass 1d (`src/firmware/install.js:594-639`) re-derives
  `HAS_ELEMENT` from z-tags across **all** ConceptHeaders: a deleted edge whose
  z-tag survives returns on reinstall. Story 2 cleans and detects; installer
  changes stay out of scope (operator decision 2026-07-18) — so the check must
  detect recurrence rather than assume cleanup is permanent.
- New hygiene-inventory item from ADR 0001 Consequences (a): the goal schema
  was extended (optional `origin`/`capturedOn`) via save-schema, which does not
  regenerate the primary-property node — known drift the checker should cover.

## Practicalities

- The TA pubkey is runtime-resolved (local instance currently `11f23fe4…`; the
  `82b75e47…` value quoted in CLAUDE.md is stale).
- The full live `npm test` runs ~24 min — background it from the start
  (OPEN.md row 83).
- New suites register in `test/test.js`'s **live** gating chain, before the
  severed terminator (OPEN.md #43).

## Then

Act as the engineering Product Owner: promote Story 2 — "Structures the brain
can trust" — via `/plan-feature` into `engineering-team/stories/second-brain/`
(next story number: 2).

Run human-gated: the operator answers every phase gate. Any owner-facing copy
comes verbatim from `product-team/guides/second-brain-style-guide.md`. One
story per session.
