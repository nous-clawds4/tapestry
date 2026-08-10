# Story 2: One place that lists everything my instance has offered

**Status:** Approved
**Created:** 2026-08-09
**Type:** Feature
**Epic:** `shared-concepts-legibility`
**Book:** `shared-concepts-legibility`

## Background

The book's second frame bullet: *she can see, in one place, **every concept her own instance has
offered** to the community.* Today she cannot. The Self-declared directory lists every instance's
declarations pulled from the community relay, with an Author column and no filter — so answering
"what have I offered?" means scanning a list of other people's work by eye.

The obvious fix is a "mine" filter. **Story 1 makes that fix wrong on its own.** Once "shared" means
*published to a public relay*, a filter over a relay-sourced list can only ever show what **reached**
the relay. A concept declared here whose broadcast failed would be absent from a page whose whole
promise is completeness — the page would be confidently, silently incomplete, which is worse than
the honest ignorance it replaces.

**This is not hypothetical; it is the current state of this instance.** Measured at planning time:

| | Count |
|---|---|
| Concepts self-declared in local strfry by this TA | **4** — `b-coverage-fixture-s1b`, `tapestry`, `dog`, `dog-breed` |
| Of those, present as self-declared on `wss://dcosl.brainstorm.world` | **3** — `tapestry`, `dog`, `dog-breed` |

One declaration never made it out. *(Honest caveat: the missing one is a test fixture, so this
particular row is an artifact rather than a concept anyone wanted to share. But the divergence is
real, the mechanism is the shipped one — declare locally, then broadcast, and the broadcast is a
separate step that can fail — and nothing on any surface currently reveals it.)*

So the story is not "add a filter." It is: **show my offerings from both stores, and say which is
which.** Story 1 established that distinction on one concept's page and the ADR anticipated this
story needing the same answer in bulk.

**Who is affected:** the owner deciding what she has already contributed and what still needs
pushing out; anyone auditing whether this instance's intentions actually reached the community.

## User-facing description

As **the owner**, I want one place listing every concept my instance has offered to the community —
**including any that never actually made it out** — so that I can see my complete offering set at a
glance and spot the ones that still need to be sent.

## Acceptance criteria

- [ ] Given my instance has declared some concepts, when I open my own offerings, then **every one
      of them is listed**, whether or not it reached the community relay.
- [ ] Given one of my declared concepts is present on the community relay, when I view my offerings,
      then it is shown as **shared**.
- [ ] Given one of my declared concepts is **not** on the community relay, when I view my offerings,
      then it is shown as **declared here but not yet sent** — visibly distinct from a shared one.
- [ ] Given the community relay cannot be reached, when I view my offerings, then the page says the
      published state could not be confirmed. It must not present my declarations as unsent on the
      strength of a check that failed to run.
- [ ] Given other instances have also declared concepts, when I view **my** offerings, then only my
      instance's appear.
- [ ] Given I want the community-wide view of everyone's declarations, then it remains available —
      this story adds a way to see mine, it does not remove the directory.
- [ ] Given a row is shown as declared-but-not-sent, when I follow it, then I reach the place where
      that concept can be sent.

## Concepts touched

- `39998:11f23fe40984a07be717d1628bdd0e87a2b4569f05dd7625923c20b89df93767:shared-concept` — **shared
  concept**
- **Concept headers generally** (kind 39998) — the subjects being listed.

> **Architect note — resolve the TA pubkey at runtime.** "Mine" is defined by the TA pubkey
> (BIBLE §31), which differs on every deployment; the handle above is this machine's and is
> illustrative only. Production's is `919ba08a…` and staging's is `8e901369…` — three different
> values already in play this session.

## Out of scope

- **Changing what "shared" means.** Settled in story 1: published to a public relay.
- **A second way to send a concept.** Story 1 shipped the submit/re-submit affordance with its
  confirmation on the concept page; the final criterion asks for a route *to* that, not a duplicate
  of it. See Open question 2.
- **Listing concepts I have *adopted* (wired to someone else's).** Adopting is not offering — see
  Open question 1.
- **`disposition-filter-on-concepts`** — the sibling surface; separate story.
- **`seeding-path`** — pending a `/discuss`.
- **The registry's Neo4j arc** (`registry-reads-graph` and successors) — queued behind this book.
- **Retiring or replacing the community-wide directory.**

## Open questions

**Both resolved at approval, 2026-08-09.** The owner approved the story without overriding either
PO recommendation, so both stand as written. Recorded this way rather than as an explicit ruling
because that is what happened; both narrow scope, so adopting them is the conservative reading, and
either can be widened without invalidating the criteria above.

1. **Offered only, or also wired?** — **RESOLVED: offerings only.** The frame says "offered," and
   the vocabulary work exists precisely to keep offering, adopting and cataloguing apart. Mixing
   adopting into a page about offering would re-create the confusion this book is dismantling.

2. **Send from the row, or route to where sending lives?** — **RESOLVED: route there.** Story 1
   shipped that action wrapped in a confirmation and a state badge; a second copy would be two
   places to keep honest, and the confirmation would be the first thing to rot. The final acceptance
   criterion asks only that a not-yet-sent row lead somewhere useful.

## Linked artifacts
- ADR: `engineering-team/decisions/shared-concepts-legibility/0002-my-offerings-bulk-resolver.md`
- Test plan: `engineering-team/stories/shared-concepts-legibility/2-mine-only-self-declared.test-plan.md`
- Review: (filled in after Review phase)
