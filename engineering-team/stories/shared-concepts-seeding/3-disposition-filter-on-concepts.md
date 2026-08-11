# Story 3: Find, in bulk, which of my concepts I haven't shared

**Status:** Approved
**Created:** 2026-08-10
**Type:** Feature

## Background

This is the book's **third frame bullet**: *"She can find, in bulk, which of her concepts she hasn't
shared."* It is the bulk half of seeding — the other two bullets are about sharing one concept and
about being told the truth afterward.

**The surface today** (`/tapestry/concepts`, 62 concepts on this instance): an **Author** dropdown,
and a Coverage control that is a single checkbox — **"Undispositioned (mine)"**. Author composes with
nothing else. There is no way to express "everything of mine that hasn't gone out to the community."

Every row already carries its local disposition, rendered as a chip: **wired** 🔗 (points at someone
else's shared concept), **self-declared** 🤝, **deliberately private** 🔒, or no chip at all —
undispositioned, which renders a `Disposition…` button.

### The thing this story has to get right

The obvious implementation is to filter on the row's local disposition, and the queued intake entry
recommends exactly that ("cheapest of the four — the data is already on every row"). **That framing
predates this book and is now wrong.** Since it was written, the vocabulary was settled and two
stories shipped on it:

- The concept graph — the authoritative source for domain concepts — defines
  `39998:<TA>:shared-concept` as *"concepts that are shared over nostr. Sharing consists primarily of
  **publication to a public relay** such as dcosl."*
- The **Shared by me** page already answers "have I shared this?" and records the owner's ruling in
  its own header: *"There is no category between shared and not-shared. A concept whose local write
  succeeded but whose broadcast did not land is a FAILURE to be retried, not a resting state"*
  (2026-08-06; seeding #2).
- That page's answer is **tri-state** — shared / didn't reach the community / **unconfirmed** — and
  *"`null` means the relay could not be asked and must never render as not-sent."*

A local self-declaration is therefore *not* the same as being shared. A concept can carry the 🤝 chip
and still not be on any public relay — that is precisely the failure story #1 was written to report
honestly. So a filter that reads the chip and calls the result "not yet shared" would put a second,
contradicting answer to the same question on a second page. That is the failure this book has twice
paid to undo, and it is the main risk in this story.

**Who is affected:** the owner with a body of concepts and no way to see which ones still need to go
out. On this instance that is 4 shared against 62 total.

## User-facing description

As the owner of a Tapestry, I want to narrow the Concepts list to my own concepts that haven't
reached the community, so that I can work through them without opening each one to find out.

## Acceptance criteria

- [ ] **AC-1 (it composes).** Given the Concepts list, when an author is selected *and* the
      not-yet-shared state is selected, then exactly the concepts matching both are listed — the two
      controls narrow together rather than one replacing the other.
- [ ] **AC-2 (the two pages agree).** Given any concept, when **Shared by me** reports it as
      **Shared**, then the Concepts list must not show it under not-yet-shared; and when Shared by me
      reports **"Didn't reach the community"**, the Concepts list must show it under not-yet-shared.
      *Neither page may be able to contradict the other about the same concept.*
- [ ] **AC-3 (unconfirmed is never called not-shared).** Given the community relay cannot be reached,
      when the not-yet-shared state is selected, then no concept whose publication could not be
      confirmed is presented as not shared. The person is told the state is unconfirmed rather than
      shown a list that silently reads as fact.
- [ ] **AC-4 (a local declaration alone is not "shared").** Given a concept that carries a
      self-declaration locally but is absent from the community relay, when the not-yet-shared state
      is selected, then that concept **is** listed. *This is the criterion that fails if the filter
      is built on the row's chip instead of on publication.*
- [ ] **AC-5 (each control says what it selects).** Given the filter controls, when any single state
      is selected, then the rows listed are exactly those matching that control's own label — in
      particular *not yet shared* and *undispositioned* select different sets and are not presented
      as synonyms.

## Concepts touched

- `39998:11f23fe40984a07be717d1628bdd0e87a2b4569f05dd7625923c20b89df93767:shared-concept` — **shared
  concept** — the concept whose definition ("publication to a public relay") is what "shared" must
  mean here. Read-only; this story does not change the definition.
- `39998:11f23fe40984a07be717d1628bdd0e87a2b4569f05dd7625923c20b89df93767:concept-header` — **concept
  header** — the rows being filtered.

*(Handles carry this instance's runtime TA pubkey and are per-deployment — the Architect should
re-resolve rather than copy these literals.)*

## Out of scope

- **Changing what sharing means, or how it is performed.** No new share action, no change to
  `Submit as a Shared Concept`. The book is explicit: the capability exists; the gap is discovery.
- **The Adoption Queue.** Its contract is nomination — the system proposes, the owner ratifies.
  Seeding is owner-initiated. Two verbs on one surface is the confusion the previous book spent
  itself undoing.
- **`share-from-shared-by-me`** (frame bullet 1) — the next story, and one that may reduce to a link
  *into* whatever this story builds.
- **Bulk share.** Selecting many concepts and sharing them in one action is a different feature. This
  story ends at *finding* them.
- **The registry arc** (`registry-reads-graph` → `materialization-writers` →
  `registry-sets-and-provenance`) — independent, still queued.

## Open questions — **RESOLVED at the Planning gate, 2026-08-10**

All three were put to the owner with the recommendations below and **approved as recommended**:
**exclude 🔒 / exclude 🔗 / build the work-list**. Recorded rather than deleted, because the frame
bullet's wording ("which of her concepts she hasn't shared") is literally true of all three groups,
so a later reader will otherwise re-open the same question and may answer it differently.

The binding consequence: **AC-2 and AC-4 are the constraints that matter**, and "not yet shared"
means *undispositioned, plus tried-but-didn't-reach* — not "everything absent from a relay."

1. **Do deliberately-private 🔒 concepts belong in "not yet shared"?** Literally they are not shared.
   But the owner already *decided* about them, so listing them makes the work-list noisier every time
   she uses it. **Recommendation: exclude them**, and let the control's label say so.
2. **Do wired 🔗 concepts belong?** These point at someone else's shared concept — already affiliated
   with the community, just not by publishing their own. **Recommendation: exclude them** for the
   same reason: they are not candidates for seeding.
3. **If both are excluded, the remainder is "undispositioned + tried-but-didn't-reach."** Is that the
   list you actually want — the true work-list — or do you want the literal reading, everything not
   presently on a relay? **Recommendation: the work-list.** It matches why the bullet exists, and the
   failures belong in it because story #1 established they are a failure to retry, not a resting
   state.

**Follows from the ratified answers, for the Architect:** with 🔒 and 🔗 excluded, "not yet shared"
sits close to the existing *Undispositioned (mine)* checkbox plus the failure cases. Two controls
that look like near-synonyms is the confusion this book has already spent itself undoing, which is
what AC-5 forbids — a named state selector may serve better than a second checkbox. That is a design
call, not a requirement.

## Linked artifacts
- ADR: `engineering-team/decisions/shared-concepts-seeding/0001-not-yet-shared-filter-joins-the-bulk-sharing-answer.md`
- Test plan: `engineering-team/stories/shared-concepts-seeding/3-disposition-filter-on-concepts.test-plan.md`
- Review: (filled in after Review phase)
