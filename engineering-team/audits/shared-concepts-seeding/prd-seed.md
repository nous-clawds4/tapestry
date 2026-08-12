# PRD Seed: Seeding — putting your concepts out to the community

**Reconstructed from:** book `shared-concepts-seeding` (acceptance-frame, ratified at open), four
shipped stories, two ADRs, four reviews, and the rendered product on three deployments.
**Confidence:** **High** for what shipped and why; **low** for anything about users other than the
owner — this book was scoped from one person's walkthrough, and no user research was done.

*Written by engineering for the product team. It describes the product as built, not as it should
be.*

## 1. Product vision

A Tapestry owner accumulates concepts — their own vocabulary, plus the ~44 that ship with the
software. Some of those concepts are worth putting out to the community so other instances can
converge on shared definitions rather than each inventing their own.

The capability to do that has existed for a long time. What this book addressed was that **it was
neither findable nor honest**: you could share a concept only if you already knew which page to open,
and afterwards the product told you it had worked whether or not anything left the machine.

The product now answers two questions truthfully — *what have I shared?* and *what haven't I?* — and
routes between them.

## 2. Personas

**The owner (the only persona this book served).** Runs their own Tapestry. Has a body of concepts
and a stated intention to work through them. Direct quote, 2026-08-11: *"everything in firmware
needs to have a community shared concept. A few of them do already; the rest of them we will take
care of in due time."*

That sentence is the most important artifact this book produced, and it should shape the next phase:
**the owner treats the un-shared set as a backlog with a goal state of empty.** Not a filter, not a
report — a queue.

**The domain expert (named at the book's open, still unserved).** The kickoff persona was someone
with a cat-breed taxonomy. Nothing in this book was validated against a person who is not the
instance operator. On production today, of 42 concepts, **all 42 ship with the software** — there is
no user-authored domain content anywhere to test against.

## 3. Scope (as-built)

**In:**
- Every path that shares a concept reports what actually happened: it reached the community, or it
  didn't and should be retried. Publication is confirmed against a public relay, not assumed from a
  local write.
- The Concepts list filters to six states, including **Not yet shared (mine)**, composing with the
  author filter.
- **Shared by me** carries a route into that list, with a count of what is waiting.
- Filter state travels in the address, so any state can be linked to and survives a reload.

**Out, deliberately:**
- **Bulk share.** Sharing 33 concepts is 33 separate trips through a small panel.
- Any change to *how* sharing is performed — the book was explicit that the gap was discovery, not
  capability.
- Folding seeding into the Adoption Queue. Its contract is *nomination* — the system proposes, the
  owner ratifies. Seeding is owner-initiated. Two verbs on one surface is a confusion the previous
  book spent itself undoing.

## 4. Domain model

- **Concept** (`39998:<TA>:<slug>`) — a definition in the local graph.
- **Shared concept** — the graph's own words: *"concepts that are shared over nostr. Sharing
  consists primarily of publication to a public relay such as dcosl."* **Publication to a relay is
  what "shared" means.** A local declaration is not enough.
- **Disposition** — what the owner has decided about a concept: *wired* to someone else's shared
  concept, *self-declared*, *deliberately private*, or undecided.
- **Publication** — tri-state: shared · didn't reach the community · **could not be confirmed**. The
  third is not a resting state and must never render as the second.
- **Not yet shared** — the work-list: mine, minus already shared, minus wired, minus deliberately
  private, plus tried-and-didn't-reach; anything unconfirmable is withheld.

**Vocabulary ruling, hard-won, do not re-open.** There is no category between shared and not-shared.
"Offering" was retired because it named exactly such a category. A share that didn't land is a
**failure to retry**, not a state a concept can rest in.

## 5. Design rules (as-built)

1. **A number that advertises a list must be computed by the same function that builds the list.**
   Both ADRs turn on this. It is why the count on one page cannot disagree with the rows on another.
2. **Zero is a claim.** "0 waiting" says *you have shared everything*. It may only be shown when
   every input is sound; when something couldn't be checked, show the route without a number.
3. **An empty list is a claim too.** An unexplained empty result asserts "you have none" — this
   caused two of the book's four kick-backs.
4. **Distinguish "we couldn't check" from "there is nothing."** Collapsing them is how uncertainty
   becomes a false assurance.
5. **A page routes to an action rather than hosting a second copy of it.**
6. **Workflow surfaces are named for the verb; wire inspectors are named for the tag.**

## 6. Carry-forward & open questions

**Ready to scope**
1. **Bulk share.** The clearest successor. The owner's goal makes the queue's length the point, and
   it is currently 33 one-at-a-time errands.
2. **Retry in place.** A concept that didn't reach the community shows its state on the Concepts
   list but offers no retry there.
3. **Prompting adoption at the far end.** A freshly shared concept appears on other instances'
   Community Offerings but is never *nominated* in their Adoption Queue, because nominations derive
   from z-tag usage and a new offering has none. **Seeding is gated at both ends by one mechanism.**
   The book flagged this at open and left it as an open product question — it is the one item here
   that could make the whole feature matter more or less.

**Open questions for product**
- **Is the un-shared list a queue or a filter?** It is built as a filter and used as a queue. If the
  owner's framing holds, the next phase might show progress (6 of 39 done) rather than a row count.
- **Does anyone but the operator want this?** Every persona claim in this book traces to one
  walkthrough. The domain expert who motivated it has never used it.
- **Should firmware concepts be candidates at all?** Asked and answered "yes" — the one concept
  production has shared and all five it has wired are firmware vocabulary. Worth revisiting once
  real user-authored content exists, because the answer may differ for someone with a taxonomy of
  their own.

## 7. What product must validate

1. **That the backlog framing is real.** Does the owner actually work the list down, or does it sit
   at 33? The whole next phase depends on this being a queue and not a curiosity.
2. **That the honesty work is load-bearing.** Two kick-backs and a book were spent on truthful
   reporting. Nobody has yet observed a user encountering a failed share and retrying it — on any
   deployment there is not one concept in that state.
3. **That the signpost is found.** It is one line on a page reachable through two levels of
   navigation. Whether a new owner ever sees it is unmeasured.
4. **Whether the domain expert can get anywhere near this.** She would first have to author concepts,
   which this book never touched. If authoring is the real bottleneck, seeding is a downstream fix to
   an upstream problem — and that reframing belongs in Discovery, not in another engineering book.
