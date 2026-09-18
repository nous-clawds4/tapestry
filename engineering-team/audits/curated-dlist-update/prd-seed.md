# PRD Seed: My Assistant Curates a Community List for Me

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/curated-dlist-update/audit.md`
**Anchor:** acceptance frame in `book.md` (six bullets, operator-confirmed 2026-09-11)
**Confidence:** high for *what was built* — every frame bullet traces to a story with passing tests.
**Low for what users do with it:** nothing has shipped, no real Update has ever been published, and no
user other than the operator has touched any of it.
**Date:** 2026-09-17

> A reverse-engineered baseline in PRD shape, built from what exists on an unmerged branch. It is a
> strawman for the product team, not a ratified spec. Sections are tagged `[FROM FRAME]`, `[INFERRED]` or
> `[UNKNOWN — product input needed]`. This book continues the one `audits/my-curated-dlists/prd-seed.md`
> opened: that book built the page, this one made its Update list button real.

## 1. Product vision

`[FROM FRAME]` A community list is written by whoever writes it. **My** version of that list is whatever
my Tapestry Assistant has *copied into it* on my behalf — nothing is inherited live, and nothing appears
in my list that my own curation method accepted. The assistant is an agent I direct and can watch: it
shows me exactly what it would do, and it acts only when I say so.

`[INFERRED]` The product's centre of gravity is **legibility of an agent's judgment**, not automation.
Every surface this book built exists to answer one of three questions before anything is signed: *what
would it do, why did it decide that, and what actually happened when it tried?* The engineering cost was
concentrated there — roughly half the book is about telling the truth when a read fails or a publish
outcome is unknown.

`[UNKNOWN — product input needed]` Why a user wants a *curated* copy rather than a subscription to the
community list. The frame assumes the value ("my curation method's choices are what readers see"); no
user has confirmed it, and the only real data in the world is one two-item `dog-breed` list.

## 2. Personas

- `[FROM FRAME]` **The list curator** — has a Tapestry Assistant on this instance, empowers it for a
  community list through their Treasure Map, picks a scoring method and a cutoff, and presses Update.
  Today this is the operator and one staging customer.
- `[FROM FRAME]` **The same person on another instance** — their Treasure Map is one event every instance
  reads, and it names one curating assistant per list. Everywhere else, their own curation is "another
  pubkey's": it opens read-only, with an offer to move it here. This persona is why read-only exists at
  all, and it is real (production's owner sees staging's assistant for `dog-breed`).
- `[INFERRED]` **The signed-in viewer with no assistant on this instance** — can open every empowered list
  read-only and curate none. Told so in one sentence.
- `[INFERRED]` **The community list's author** — never consulted, never notified, and unable to prevent a
  copy. Publishing is permissionless; a copy says it is a copy (`q`) so readers can collapse it back.
- `[UNKNOWN — product input needed]` **The reader of someone else's curated list.** The protocol makes
  curated lists discoverable through declared affiliation, and specifies how a reader merges a copy into
  its original. No surface in this book serves that reader.

## 3. Scope (as-built)

`[FROM FRAME]` In scope and shipped (on the branch): the copy convention in the protocol; curated headers
that link with `pointer` and screens that say "copy"; read-only curation with an offer to curate here; a
curation method panel with per-candidate verdicts and an editable cutoff; Update's preview; and Update's
publish, with a per-item, per-place report.

`[FROM FRAME]` Deliberately out, and still out: **a schedule** (Update runs on a press, never on its own);
**writing the method, point of view or cutoff onto the header** (they live per browser until a Trust
Determination Methods concept exists); **undo**; **choosing items one at a time** (one approval covers the
whole preview); **moving or deleting another assistant's copies** when a curation moves instances.

`[INFERRED]` One thing entered scope that the frame never named: **honest relay reads**. Making "a failed
read never proposes a deletion" true required a new strict mode on the shared relay-read endpoint, because
the old one reported an unreachable relay as an empty success. Three other surfaces still use the old
behaviour.

## 4. Domain model

`[INFERRED]` from the shipped wire format (spec: `protocols/drafts/assistant-designation.md` § "Curation
copies"):

- **Community list** — a header (kind 39998) and its items (kind 39999), by any author.
- **Curated list** — my assistant's own header (kind 39998), carrying exactly one typed link to the
  community header: `pointer`, meaning *affiliation*, not containment. **My curated list is exactly the
  items filed under my header.** A header written before this book carries the older `inherit-items` link
  and reads as "older" until Update upgrades it.
- **Copy** — my assistant's own item (kind 39999) under my header, carrying what the original's author
  wrote plus two back-references: the original's address and the *exact version* it copied. A repeat
  Update replaces a copy rather than duplicating it. A copy is a **snapshot**: an author's edit reaches it
  only when my assistant refreshes.
- **Removal** — a deletion request (kind 5) by my assistant. The original then returns to being a
  candidate; no rejection is stored, so a rejected item is simply one that does not qualify today.
- **Curating assistant** — the Treasure Map (kind 10040) names **one per list, network-wide**. Moving a
  curation is replacing that entry.
- **Curation method** — a scoring method, a point of view and a cutoff. A candidate's score is its
  author's implicit upvote plus trust-weighted upvotes minus downvotes; it qualifies at score at or above
  the cutoff — the same rule Simple Lists' "Generate Trusted List" panel uses, now literally the same code.
  **The method lives in my browser, not on my list.**

## 5. Design rules (as-built)

`[INFERRED]` — these emerged decision by decision and were never written down as rules:

1. **Never propose from a read you could not complete.** A failed or capped read proposes nothing, never a
   deletion, and the surface names the read that failed in the user's own words ("couldn't check your list
   on the community relay").
2. **Show before you sign.** The preview is the contract; the assistant publishes exactly what it showed,
   re-reading everything first and refusing anything that changed.
3. **Never claim an outcome you do not know.** "Nothing was published" is said only when nothing was; an
   unknown answer says so and re-reads the list. This rule cost a review round and two ADR amendments.
4. **Report per item and per place.** Publishing succeeds partially all the time; the page shows where each
   item landed, retries nothing, and lets the next Update propose what is still missing.
5. **Say whose assistant, and open read-only when it is not yours.** Never withhold the page.
6. **Say why an affordance is absent.** Every unavailable state of "curate it here instead" has its own
   sentence; the offer is never shown if the server would refuse it.
7. **Nothing runs on a schedule.**

`[UNKNOWN — product input needed]` No rule was ever recorded for **what a user should do when a place will
not honor a deletion**. Today the copy is flagged as "deletion requested — still shown by <place>", and the
user is left to decide.

## 6. Carry-forward and open questions

Promoted from audit §6. Engineering-side chores (OPEN.md renumbering at the merge, epic retirement, the
test-suite path repointing) are not product questions and are not repeated here. What the product team
should weigh:

- **The first real Update is still unpublished.** Every user-facing claim in this seed is backed by tests
  and stubs, not by a single public event. The community relay honors only one of the two deletion forms,
  so removal behaviour in the wild is the first thing to observe.
- **The method is per browser.** Two browsers can propose, and publish, different plans for the same list.
  The intended fix is a Trust Determination Methods concept the header points at — a separate book.
- **A schedule**, and **item-by-item approval**, are the two most obvious next capabilities; both were
  deferred at kickoff, not rejected.
- **Moving a curation between instances leaves the other assistant's copies where they are.** Nothing
  cleans up, and the product has never said what should.
- **Nothing serves the reader of someone else's curated list**, though the protocol now specifies how.
- **Large lists are untested.** Today's list has two items; the preview's reads fan out at roughly 13
  connections at 500 items, and one read path fails honestly past about 110 candidates.

## 7. What product must validate

- [ ] `[UNKNOWN]` **Is the copy model what users expect?** A copy is a snapshot that only refreshes when the
      assistant refreshes it, and a removed item silently becomes a candidate again. Both are defensible;
      neither has been shown to a user.
- [ ] `[UNKNOWN]` **Should "curate it here instead" work when my own assistant authored the shared list?**
      Today the offer is withheld, because the server refuses it. The spec arguably permits a
      self-declared header to serve both roles. This was settled as an engineering rule at a planning
      gate; underneath it is a product question (story 3 review, R2-2).
- [ ] `[UNKNOWN]` **One approval, or item-by-item?** One approval covers the whole preview today. The
      moment a list is big enough for that to feel risky is unknown, because no list is.
- [ ] `[UNKNOWN]` **Should curated lists be discoverable?** The `pointer` link makes them so, with zero
      aggregation weight. No surface exposes it.
- [ ] `[UNKNOWN]` **What should a user do about a deletion a relay will not honor?** Flagged is the current
      answer.
- [ ] `[INFERRED — validate]` **That "one curating assistant per list, network-wide" is the durable model.**
      Every surface in this book assumes it, and it was settled with no protocol change.
- [ ] `[INFERRED — validate]` **That honesty outranks completeness.** The book repeatedly chose "couldn't
      check" over a plausible-looking answer, including on Simple Lists, where a slow rank provider now
      shows a warning where it previously showed silently partial numbers. That trade is a product stance,
      and it has now been made on a page this book did not own.
