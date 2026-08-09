# Story 1: Show a concept's sharing state on its own page

**Status:** Approved
**Created:** 2026-08-09
**Type:** Feature
**Epic:** `shared-concepts-legibility`
**Book:** `shared-concepts-legibility`

## Background

The book's driving question — *how does Stacie tell whether she has already shared her cat-breed
concept?* — stalls on the page she actually lands on. The concept page offers **"Submit as a Shared
Concept"** with identical wording whether or not the concept has already been submitted. The only
way to learn the answer is to click the button and read a status message that appears afterward.
The action is idempotent, so nothing breaks; but discovery-by-side-effect is not an answer, and it
is the reason the owner — who built the feature — could not tell from the UI what their own
instance had already offered.

Verified live at kickoff: staging's `cat-breed` header carries no b-tag (never submitted) while its
`bengal-cat` header is self-declared and live on the community relay. Both pages look identical.

The state itself already exists and is already displayed **elsewhere**: story 1 of
`shared-concepts-adoption` put disposition chips (wired / self-declared / kept private /
undispositioned) on the *concept-headers list*. This story brings that same answer to the *detail*
page — the surface a person reaches from a search result, a link, or a breadcrumb, and the one
where the action button lives.

**Who is affected:** the owner deciding what to offer the community; anyone landing on a concept
page and wondering whether this instance stands behind it.

## User-facing description

As **the owner**, I want a concept's page to tell me whether I have already shared that concept —
and if so, in what way — **before I click anything**, so that I can see at a glance what my instance
has offered to the community instead of probing a button to find out.

## Acceptance criteria

**"Shared" means published to a public relay** (owner ruling, 2026-08-09). A local declaration is
not enough. The relay is `wss://dcosl.brainstorm.world`, hardwired for now; the eventual source is
the relevant relay set from the concept graph.

- [ ] Given a concept header carrying no affiliation marker, when I open its page, then the page
      shows a "not yet shared" state without my having clicked anything.
- [ ] Given a concept header whose self-pointing marker is **present on the public relay**, when I
      open its page, then the page shows a "shared" state.
- [ ] Given a concept header carrying a self-pointing marker **locally but not found on the public
      relay**, when I open its page, then the page distinguishes this from both "shared" and "not yet
      shared" — it says the concept was declared here but has not reached the community.
- [ ] Given the public relay cannot be reached, when I open a concept page, then the page says the
      sharing state could not be confirmed. It never reports "not shared" on the strength of a check
      that failed to run.
- [ ] Given a concept header wired to someone else's shared concept (its marker points at another
      header), when I open its page, then the page shows a "wired" state **and identifies what it is
      wired to** in a form I can follow.
- [ ] Given a concept header carrying only the reserved keep-private marker, when I open its page,
      then the page shows a "kept private" state — never an error, a blank, or a broken link.
- [ ] Given a concept header carrying more than one marker, when I open its page, then every
      affiliation is represented; a self-pointing marker and an external one are distinguishable.
- [ ] Given a concept that has already been shared, when I look at the action button, then its
      wording tells me a further click **re-submits** rather than submits for the first time.
- [ ] Given a concept that has already been shared, when I invoke the action, then **before it
      proceeds** I am told that the concept has already been submitted and that re-submitting is
      typically unnecessary.
- [ ] Given I submit a concept from its page, when the action reports success, then the displayed
      state reflects it without my reloading the page.

## Concepts touched

- `39998:11f23fe40984a07be717d1628bdd0e87a2b4569f05dd7625923c20b89df93767:shared-concept` — **shared
  concept** (what an affiliation marker points at; the local registry's concept)
- **Concept headers generally** (kind 39998) — the subject whose state is displayed. This story is
  generic across all of them, not scoped to one concept.

> **Architect note — resolve the TA pubkey at runtime.** The handle above carries *this machine's*
> TA (`11f23fe4…`), which differs from the example in CLAUDE.md (`82b75e47…`, the other dev machine)
> and from every deployment. Per the house rule, never hardcode it.

## Out of scope

- **Changing how affiliation is written.** This story is read-and-display only; the three
  disposition actions and their endpoints are already shipped and unchanged.
- **Sourcing the relay set from the concept graph.** The owner named this as the eventual shape; for
  this story the public relay is the hardwired `wss://dcosl.brainstorm.world` that every other
  shared-concepts surface already targets. Whoever generalizes it should expect several call sites.
- **Relay-confirming the *wired* state.** Wiring also broadcasts, so it has the same
  local-vs-published dimension — but the book's question is "have I shared this?", which is about
  self-declaration. Wired is displayed as the local affiliation it is.
- **`mine-only-self-declared` and `disposition-filter-on-concepts`** — the other two legibility
  surfaces in this book; separate stories.
- **`seeding-path`** — the Adoption Queue's demand gate, pending a `/discuss`.
- **The TA ↔ owner handshake** — parked (`_intake.md`, 2026-08-09).
- **`registry-reads-graph`** — the Registry's data-source swap, queued behind this book.

## Open questions

**Both resolved by the owner, 2026-08-09, before approval.**

1. **Does "shared" mean declared locally or published?** — **RESOLVED: published.** *"Shared means
   that it is published to a public relay. Declared locally is not enough."* The PO had recommended
   the cheaper local-only reading; the owner overruled it, and the ruling is the better one — the
   page should not call something shared that the community cannot see. Two consequences the ruling
   creates, both now criteria: a **declared-locally-but-not-published** state exists and must be
   distinguishable, and a **failed relay check must not masquerade as "not shared."**

2. **Should the action button disappear where it cannot work?** — **RESOLVED: it stays.** *"If the
   concept has already been shared, then the action button should remain, because republishing is
   possible and ought to be benign."* Confusion is prevented by wording rather than by removal: the
   button and the confirmation at the point of action both say this is a re-submission, and the
   confirmation adds that re-submitting is typically unnecessary.

   **Carried forward, not resolved:** the button also renders on headers authored by *other*
   instances and for *non-owner* viewers, where the server rejects the call outright. That is a
   different defect from the already-shared case the owner ruled on, and no criterion here covers
   it. File separately.

## Notes for the Architect

- **Do not reuse the fetch-everything community hook.** `useCommunitySharedConcepts` pulls every
  kind-39998 off the relay and filters client-side — acceptable for a directory page, wasteful on a
  page that opens one concept at a time. The published check here is a single addressable
  coordinate, so a precise filter (kind + author + `#d`) returns exactly the one event.
- **The published test is two-part:** the relay copy must exist *and* carry the self-pointing
  marker. A header published before it was declared is on the relay without being shared.
- **No confirmation surface exists on this page today** — the action fires immediately on click. The
  owner's ruling calls for one; whether that is a modal or an inline confirm step is a design call,
  but something must sit between the click and the publish. (The `DispositionPanel` on the Concepts
  *list* is a different surface and is not reachable from here.)

## Linked artifacts
- ADR: `engineering-team/decisions/shared-concepts-legibility/0001-sharing-state-resolver.md`
- Test plan: `engineering-team/stories/shared-concepts-legibility/1-state-on-concept-page.test-plan.md`
- Review: (filled in after Review phase)
