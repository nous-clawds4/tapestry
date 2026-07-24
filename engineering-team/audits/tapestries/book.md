# Book: tapestries

**Status:** Open
**Opened:** 2026-07-23 *(eagerly, at the Story 1 Review gate — the intake `/plan-feature` step
skipped the anchor; caught and opened here rather than reconstructed at close. 3rd occurrence of
OPEN.md #78.)*
**Mode:** human-gated per-story cycle (no Direction-mode section; never armed)

## Intent anchor — acceptance frame (no PRD; captured from the operator's ask)

The operator's ask, session of 2026-07-23:

> "I would like to start building a new feature called Tapestries … A Tapestry is a collection of
> individual concepts that are grouped together under some common theme or for some common purpose
> … several new pages … underneath Nostr Users, we will see Tapestries. When we open Tapestries, we
> will see direct links to two pages: View Tapestries, which will show a list of each element of the
> Tapestry concept, and Create New Tapestry, which for now will be just a stub. Each item of the
> View Tapestries page should link to a page that allows the exploration of that individual
> Tapestry. The Tapestry Exploration page will be modeled to a great extent after the Firmware
> Explorer section in settings … Future features will include the abilities to create a new Tapestry
> and to edit an existing Tapestry, but we will not build those features yet."

Scope fixed by operator answers during Planning / Architecture (2026-07-23):

1. **Read-only skeleton**; create/edit deferred to future stories.
2. **Directory data source = strfry** (`queryRelay`), not Neo4j — forced by an observed Neo4j
   reconcile that drops tapestry elements (ADR `tapestries/0001`; root cause deferred to OPEN.md #87).
3. **Route by uuid** (the a-tag coordinate); **public** placement in the main nav.
4. **Exploration page = as-authored** rendering from the element's `graph` block + resolved imports,
   modeled on the Firmware Explorer's read-only views (drop install/version/constraints); no new
   backend.

Definition of done: the acceptance criteria of both stories under
`engineering-team/stories/tapestries/`, operator-gated at every phase.

## Epic set

- `engineering-team/epics/tapestries.md` — 2 stories:
  1. `stories/tapestries/1-tapestries-nav-and-directory.md` — nav shell + View Tapestries directory
     + Create stub. **Done** (review PASS 2026-07-23, ADR 0001; on `feat/tapestries-skeleton`).
  2. `stories/tapestries/2-tapestry-exploration-page.md` — the Tapestry Exploration page. **Done**
     (review PASS 2026-07-23, ADR 0002; on `feat/tapestries-skeleton`).

**Both stories are Done → the book looks complete; `/close-book` offered at the Story-2 review gate.**

Future (not yet storied, out of this book unless re-scoped): create a Tapestry; edit a Tapestry;
POV/WoT filtering of the directory.

## Seed data (real, for demos + acceptance)

Authored on the local stack during this book: element `39999:<TA>:tapestry-for-dog-ca3b675e`
("Tapestry for Dog") with a full `graph` block, plus the `dog`, `dog-breed`, `irish-setter`, and
`golden-retriever` concepts. (Durable in strfry; the Neo4j projection of the element is subject to
the OPEN.md #87 desync — the directory reads strfry, so it is unaffected.)
