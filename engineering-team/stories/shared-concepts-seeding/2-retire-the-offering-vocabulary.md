# Story 2: Retire "offering" — there is only shared, and didn't-reach

**Status:** Approved
**Created:** 2026-08-10
**Type:** Refactor
**Epic:** `shared-concepts-seeding`
**Book:** `shared-concepts-seeding`

## Background

The previous book introduced **My Offerings** and **Community Offerings** to name a category: a
concept this instance has put forward, whether or not it reached the public relay. The owner then
asked the question that undid it:

> I still don't understand the difference between an Offering and a Shared concept… what is the
> point of Offering without Sharing?

There is no point. A declaration that exists locally but not on the relay arises exactly three ways
— the broadcast failed, the deployment has external publishing switched off, or the two steps are
momentarily out of step. None is a state anyone chooses.

**And it was already ruled out.** From the b-coverage story, 2026-08-06:

> The old "auto-b but don't publish" half-state is dropped (owner, 2026-08-06).

The owner explicitly rejected declaring-without-publishing as a supported option. The "offering"
vocabulary quietly resurrected that half-state and promoted it to a page title — so the product now
names, as a category, a thing the owner decided should not exist.

**The correction is not cosmetic.** Under the current wording there are two peer categories
(*offered* and *shared*) and a user reasonably reads them as alternatives. Under the corrected model
there is **one category and one failure**: a concept is shared, or an attempt to share it did not
reach the community and needs another try. The data is unchanged — the tri-state was always right —
it is the *labelling of the middle value* that overreached.

**Who is affected:** anyone reading these surfaces, including the owner, who could not derive the
distinction from the words after building the feature. That is the bar this book's predecessor set
for itself and missed here.

## User-facing description

As **the owner**, I want the words on these surfaces to describe only states that actually exist —
shared, or tried and didn't get there — so that I am not invited to reason about a category the
product deliberately does not support.

## Acceptance criteria

- [ ] Given I look at the page listing what this instance has put out to the community, then it is
      named for **sharing**, not for offering.
- [ ] Given I look at the page listing what other instances have put out, then it is named for
      **sharing** too, and the two read as an obvious pair.
- [ ] Given a concept of mine reached the community relay, then it reads as **shared**.
- [ ] Given a concept of mine did **not** reach the relay, then it reads as a **failure to reach the
      community with a retry** — not as a category of its own, and not as a resting state.
- [ ] Given the relay could not be reached at all, then it still reads as **unconfirmed**, distinct
      from both of the above.
- [ ] Given any outcome message about a share attempt, then it describes the local half rather than
      naming it — **no third noun** is introduced for "declared but not published".
- [ ] Given I search the shipped product for the retired vocabulary, then **no user-facing surface**
      uses "offering" or "offered" to name one of these states.
- [ ] Given a developer reads the code, endpoint and filenames behind these pages, then they do not
      encounter the retired vocabulary either — the word is gone from the internal surface, not just
      the visible one.
- [ ] Given all of the above, then **nothing about behavior changes**: the same concepts appear in
      the same order with the same underlying states, and every existing action works as before.

## Concepts touched

None. This story changes words — visible and internal — and the endpoint that serves one page. No
wire format, no concept definition, no firmware reinstall.

## Out of scope

- **Renaming the route `/tapestry/shared-concepts/mine`.** It is neutral and carries none of the
  retired vocabulary. The precedent from the last rename stands: a URL a user may have bookmarked is
  not worth churning for no visible gain.
- **Rewriting the closed `shared-concepts-legibility` book's artifacts.** Its audit, PRD seed, ADRs,
  stories and reviews were accurate when written and are the historical record of what shipped. They
  get a forward pointer, not a retcon — see Open question 2.
- **The concept page's own submit-button wording.** It says "Submit as a Shared Concept", which is
  already share-anchored. Revisit only if it reads oddly beside the new names.
- **Any change to the tri-state itself, or to how it is computed.** The values were always right.
- **The remaining seeding work** — the bulk "not yet shared" filter, and whatever survives of the
  offer-from-the-page idea once this rename settles.

## Open questions

**Both resolved at approval, 2026-08-10 — the owner approved with both PO recommendations.**

1. **Does the page listing my shares still show the ones that failed?** — **RESOLVED: yes.** Shown in
   place and styled as a problem rather than as a peer state, so the page's name stays honest while
   the exception stays visible. A failed share is the row most worth acting on.
2. **What does the closed book's audit get?** — **RESOLVED: a forward pointer, not a retcon.** One
   dated line at the top of the audit and the seed noting the later rename; bodies untouched. A
   closed audit's value is being accurate as of its close.

## Linked artifacts
- ADR: (skipped — Refactor with the naming already settled; no design choice remains)
- Test plan: `engineering-team/stories/shared-concepts-seeding/2-retire-the-offering-vocabulary.test-plan.md`
- Review: (filled in after Review phase)
