# Story 3: Narrow Active b-tags by person, and by kind of author

**Status:** Done
**Created:** 2026-09-20
**Type:** Feature

## Background

Story 2 widens the page to every author in the relay. That is the honest view, and it is the wrong
*default* view: most of the time a reader wants their own b-tags, not the whole relay's.

Two different questions need answering, and collapsing them into one control answers neither:

- **Whose events am I looking at?** The owner's, mine, a particular customer's. A person here
  means *both of their keys* — their own account and the assistant this instance issued them —
  because "what have I filed" and "what has my assistant filed on my behalf" are the same practical
  question for the reader asking it.
- **What kind of author signed this?** An assistant this instance controls, one of the people those
  assistants belong to, or somebody else entirely. This is the federation question, and it is
  independent of *which* person.

Keeping them as two selectors is what makes "show me only my assistant's, not my own" and "show me
everything that came from outside" both expressible.

**Grouping is not conflation.** BIBLE §31 holds that the Owner is *"a correspondent, not an alias"*
— privileged in trust, never merged in identity. Listing a person's events beside their assistant's
does not merge the two identities: every row still names its signer (story 2), and the author-type
selector separates them on demand. A design that loses that distinction — one that reports a
person's events and their assistant's as indistinguishable — violates §31 and must be rejected.

## User-facing description

As someone inspecting b-tags, I want the page to open on my own b-tags and let me widen to any
other person, or to any class of author, so that I get my view by default and the whole relay's
when I ask for it.

## Acceptance criteria

- [ ] Given a reader signed in as an account with an assistant, when Active b-tags loads, then the
      person selector is on **Mine** and the table lists exactly the events signed by that reader's
      own account or by that reader's assistant — and no others.
- [ ] Given no one signed in, when Active b-tags loads, then the person selector is on **Owner**
      and the table lists the events signed by the owner's account or the owner's assistant.
- [ ] Given a reader signed in as an account with **no** assistant provisioned, when Active b-tags
      loads, then the person selector is on **Mine**, the table lists that reader's own
      account-signed events, and the page shows a notice saying the reader has no assistant key —
      without erroring and without silently falling back to another person.
- [ ] Given any person is selected, when the reader changes the person selector to another person
      offered by the instance, then the table narrows to that person's account and assistant; and
      when the reader selects the everyone option, then no author narrowing is applied at all —
      including events from authors this instance does not control and that appear under no named
      person.
- [ ] Given the author-type selector, when the reader picks each of its options in turn, then the
      table shows, respectively: every author; only authors that are assistants this instance
      controls; only authors that are accounts those assistants belong to; and only authors that
      are neither.
- [ ] Given both selectors, when a combination selects nothing (for example one person together
      with the everyone-else author type), then the table reports that the combination matches no
      rows and says why — it does not silently show an unfiltered or a differently-filtered table.

## Vocabulary (Product Owner's proposal — open to the owner's wording)

Two controls, each with a one-line legend beneath or on hover:

- **Showing:** `Everyone` · `Owner` · `Mine` · *each customer, by display name*
  — a person carries both their account and their assistant.
- **Signed by:** `Anyone` · `Assistants` · `People` · `Everyone else`
  — *Assistants* = assistants this instance controls. *People* = the accounts those assistants
  belong to (owner, admins, customers). *Everyone else* = neither.

The two compose by intersection. **Mine + Assistants** is "just what my assistant filed";
**Mine + People** is "just what I signed myself"; **Everyone + Everyone else** is "everything that
came from outside this instance."

## Concepts touched

- `39998:<TA>:concept-header` — concept header (the event being narrowed).

## Out of scope

- Persisting the selection across sessions or across devices. The POV selector persists via user
  preferences; this story does **not** — the selection resets to the default on each load, and
  persistence is a follow-on if the owner wants it.
- Provisioning or repairing a missing assistant key. The notice reports the condition; the page
  that fixes it is a named future surface, not this story.
- Applying either selector to Active z-tags or any other table.
- Any narrowing by trust, web-of-trust rank, or point of view. These selectors narrow by
  **authorship**, which is a property of the event, not of any POV. Nothing here is POV-namespaced,
  and nothing derived from a selection is precomputed or stored (invariants #1 and #3).
- Inactive customers, and any account the roster does not offer.

## Open questions

- ~~**The wording above.**~~ **Settled at the story gate (2026-09-20):** the owner approved the
  proposed labels unchanged. The one correction was elsewhere — story 4's panel note reads
  `* self-declaration`, not `* self-referencing`.

## Linked artifacts
- ADR: `engineering-team/decisions/author-scoped-inspection/0002-author-scoped-views-on-active-b-tags.md`
- Test plan: `engineering-team/stories/author-scoped-inspection/3-narrow-by-person-and-by-author-type.test-plan.md`
- Review: `engineering-team/reviews/author-scoped-inspection/1-4-author-scoped-inspection.md` (PASS)
