# PRD Seed: Whose view is this?

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/author-scoped-inspection/audit.md`
**Anchor:** acceptance frame in `book.md`
**Confidence:** high for scope and design rules (a confirmed frame, verified against a running
deployment); **medium** for vision and personas — the frame says what to build and for whom in one
sentence, and everything wider than that is read off the system.
**Date:** 2026-09-21

> A **strawman for the product team**, not a ratified spec. Tags: `[FROM FRAME]` (grounded in the
> kickoff acceptance frame), `[INFERRED]` (read off the as-built system), `[UNKNOWN — product input
> needed]`.

## 1. Product vision

`[INFERRED]` The Shared Concepts area lets an instance operator see what their instance points at
and what it borrows from others. `shared-concepts-row-detail` established one principle for it —
*a wire identifier must be available, but it should not be the thing a person reads.* This book
asserts a second, and it is the more consequential of the two:

**A view is something the reader chooses, not something the code assumes.**

Active b-tags had answered one question — *what has my assistant filed?* — while presenting itself
as an inspector of the relay. The narrowness was invisible: nothing on the page said whose view it
was, so a reader could not tell that four of seventeen rows were missing. The fix was not simply
to widen. It was to make the scope an **explicit, legible, reader-owned choice** — which is why
the book shipped two selectors with legends and an author column, rather than one wider query.

`[UNKNOWN — product input needed]` Whether this principle should now be applied across the Shared
Concepts area, or stays local to the wire inspectors. Four other surfaces in the same nav
(`Registry`, `Shared by me`, `Shared with the community`, `Adoption Queue`) each answer a
first-person question and none of them says so on screen.

## 2. Personas

`[FROM FRAME]` The frame names the reader only through what they need: someone who has to tell a
self-declaration from a correspondence, and one person's assertions from another's. Behaviourally
three readers appear in the epic, and the book serves them unequally:

- **The operator debugging federation** — the best-served. `Everyone else` isolates exactly the
  rows that arrived from outside this instance.
- **The developer learning the wire format** — served incidentally. The author column and the
  self-declaration mark both teach something the page previously hid.
- **`[INFERRED]` The multi-tenant customer** — newly addressable for the first time, and the
  least validated. The default view is now *theirs*, but no customer has used it: the whole
  signed-in path was exercised by mocked sessions and by the operator's own account.

## 3. Scope (as-built)

`[FROM FRAME]` Shipped and on staging (not yet promoted to production):

1. Active b-tags lists every b-tag-carrying concept header in the local relay, whoever signed it.
2. Each row names the author of the local carrier, distinct from the author of its target.
3. **Showing** — `Everyone` · `Owner` · `Mine` · each customer by name. A person means *both* their
   account and the assistant this instance issued them.
4. **Signed by** — `Anyone` · `Assistants` · `People` · `Everyone else`, independent of (3) and
   intersecting with it.
5. Default: the signed-in reader's own view, falling back to the owner's when signed out. A reader
   with no assistant key keeps "Mine" and is told why.
6. Self-declarations (a b-tag pointing at its own event) are visually distinct and say so in the
   detail panel.
7. The instance can state which assistants it controls and whose account each belongs to.

**Deliberately out:** Active z-tags; assistants this instance does not control; persistence of the
selection; any narrowing by trust or point of view.

## 4. Domain model

`[INFERRED]` No entity was added. One relationship became **nameable in product terms** for the
first time:

> **An account and its assistant are two identities and one person.**

That is the whole of "Showing". It is also the book's sharpest constraint, because BIBLE §31 holds
that the owner is *"a correspondent, not an alias"* — privileged in trust, never merged in identity.
The resolution shipped here is worth stating as a product rule, not just an engineering one:

> **A view may group two identities; the data must never merge them.** Every row names its own
> signer, and the second selector separates the pair on demand.

Three classes of author now exist in the product's vocabulary, and the third is a **residual, not
an identification**:

| Class | Means |
|---|---|
| Assistants | a delegated key this instance issued |
| People | the account such a key belongs to (owner, admin, customer) |
| Everyone else | *neither* — this instance can say "not ours" and nothing more |

`[UNKNOWN — product input needed]` Whether "Everyone else" should ever become an identification.
`39998:<TA>:tapestry-assistant` exists for exactly that and holds no elements.

## 5. Design rules (as-built)

`[INFERRED]` Rules this book established by doing, none previously written down:

1. **A surface that narrows must say what it narrowed to.** Both selectors carry a one-line legend;
   the empty state names both selections rather than reporting a bare zero.
2. **A default the reader did not choose is still shown to them** — the selector displays `Owner`
   when signed out rather than leaving the control blank.
3. **Don't render a scope you don't know yet.** The page withholds its table until the roster
   answers, rather than painting a wider view and snapping.
4. **A marked row must survive its own hover.** Emphasis and interaction feedback are separate
   signals and neither may erase the other.
5. **Mark, don't warn.** The self-declaration treatment uses a hue the table uses nowhere else,
   deliberately not the warning palette — it is a distinction, not a problem.

## 6. Carry-forward & open questions

Promoted from audit §6, in the order a product reader should consider them:

1. **The z-tags sibling is now inconsistent with its twin.** Two pages named for the tag they
   inspect; one lets you choose whose view, one doesn't. The cheapest coherent next step.
2. **The multi-tenant path has shipped but never been used by a customer.** The default view is
   theirs; nobody has confirmed it reads correctly to them.
3. **"Everyone else" is a residual class.** Naming foreign assistants is a genuine product
   question, not a technical leftover.
4. **The widened read is unbounded** and a truncated result would render as complete. Deferred
   during the book; it is now more load-bearing than when it was deferred.
5. **Should the selection persist?** Deliberately not, unlike the POV selector — the two behave
   differently on adjacent surfaces.
6. **A BIBLE §31 §Scope refresh** — its multi-tenant direction is marked "not yet built" and the
   read half now is.

## 7. What product must validate

- [ ] Does *"a view is something the reader chooses"* generalize to the other Shared Concepts
      surfaces, or stay with the wire inspectors?
- [ ] Is "Mine" the right default for a **customer** on a shared instance, or should a customer see
      the instance's view first and their own second?
- [ ] Are `Assistants` / `People` / `Everyone else` the right words? They were proposed by
      engineering and approved unchanged at the story gate — approval of a proposal, not a
      preference expressed independently.
- [ ] Should a foreign assistant be identifiable (§4), and if so, who publishes that claim?
- [ ] Is `* self-declaration` the right thing to show a **non-operator** reader? It is protocol
      vocabulary on a page a customer can now reach.
- [ ] Does the **owner** still need a one-click "the whole relay" view, now that the default is
      personal rather than instance-wide?
