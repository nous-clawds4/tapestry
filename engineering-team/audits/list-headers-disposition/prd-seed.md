# PRD Seed: Deciding what your own list headers are, signed only by you or your own Assistant

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/list-headers-disposition/audit.md`
**Anchor:** acceptance frame in `book.md`, the owner's ask verbatim plus five intake decisions
**Confidence:** high for what shipped; medium for the personas and the next phase, which were never stated
**Date:** 2026-10-02

> This is a **reverse-engineered baseline** in the product-team PRD shape, built from what shipped. It is a *strawman
> for the product team*, not a ratified spec. Every section is tagged:
> - `[FROM FRAME]` is grounded in the kickoff acceptance frame;
> - `[INFERRED]` is read off the as-built system;
> - `[UNKNOWN — product input needed]` needs a decision.
>
> The product team adopts this as the starting point for `/discover` on the next phase and validates each section.

## 1. Product vision

`[FROM FRAME]` **The author of a sharing decision should be the person who made it.** The book started from a
question: on Concept Headers, who signs when someone clicks **Submit as a Shared Concept**? The answer was always the
Owner's Assistant, and any admin could trigger it. The owner's ask was to build the disposition feature on List Headers
instead, under one hard rule: "nobody can trigger somebody ELSE's Assistant to publish anything". Concept Headers
would be fixed later.

`[INFERRED]` What exists now is the person's own **sharing desk** for list headers.
- A signed-in person finds their own headers: the ones they signed, and the ones their Assistant signed.
- They see which are wired, shared, private or undecided.
- They settle each one: share it with the community, keep it private, or point it at someone else's concept.
- Their own key, or their own Assistant, signs.

That fits principle 2 (publishing is permissionless) and principle 1 (POV-first): whose *signer* acts is personal,
and whose events count stays a read-time question.

`[UNKNOWN — product input needed]` Is List Headers the long-term home for this, or a proving ground before Concept
Headers adopts the same endpoints?

## 2. Personas

`[INFERRED]` From the stories' "As a signed-in person…" lines:
- **The Owner,** who has many of their Assistant's headers (183 on the Mac Studio) and a few under their own key
  (6 locally, 28 on staging). They want to sweep through the undecided ones quickly; hence **Next undecided →**.
- **A customer with their own Assistant here,** whose Assistant's headers they can now settle. An admin is a
  customer in this sense: they act on their own Assistant's rows, never the Owner's.
- **A guest with no Assistant here,** who can still settle headers they signed with their own key.

`[UNKNOWN]` Whether anyone but the Owner has headers to settle today. No customer had a header under their own key on
either instance when story 5 was planned.

## 3. Scope (as-built)

`[FROM FRAME]`:
- **Me** and **My Local Tapestry Assistant** in the List Headers Author selector.
- **A 🧭 b-disposition column.**
- **A Disposition panel** with **Submit as a Shared Concept**, **Keep private** and **Wire to an external shared
  concept**, on the person's own rows only.
- **Nobody can trigger someone else's signer:** not an admin, not the Owner, not a caller with no session.
- **Concept Headers is unchanged.**

`[INFERRED]`, from the stories and ADRs:
- **Assistant rows:** the server signs with the caller's own Assistant.
- **Me rows:** the server prepares; the person's NIP-07 signer signs once; the server accepts only that exact change.
- **Every save** is read back from the relay before the graph changes. A refusal is reported, not hidden.
- **Next undecided →** walks one kind of row at a time.
- **The Wire pick-list** shows the community relay's Shared Concepts. Any list-header address can be pasted.
- **"Already" answers** never ask the signer.
- **The panel closes** when its row stops being the viewer's.

## 4. Domain model

`[INFERRED]`:
- **List header:** a kind-39998 event (replaceable, addressed `39998:<pubkey>:<d>`). Kind 9998 headers aren't
  replaceable, so they can't be dispositioned and show "—".
- **Disposition:** derived from the header's own `b` tags.
  - A self-pointing `b` means **shared**.
  - A `b` pointing at another header means **wired**.
  - The marker `b-tag-deferred` means **private**.
  - No `b` means **undecided**.

  It is a property of the header *as its author published it*. It isn't per-POV, and it isn't stored separately.
- **Signer for a row,** relative to the viewer: **me** (the viewer's account wrote it), **my-assistant** (the
  Assistant this instance holds for the viewer wrote it), or none.
- **Re-sign:** a new version at the same address, `created_at` strictly newer, with exactly the action's change to
  the tags. Content is unchanged.

## 5. Design rules (as-built)

`[INFERRED]` from the shipped UI and the reviews:
- **The 🧭 column reports every author's state;** only the viewer's own rows get a button.
- **Every action reports honestly:**
  - published, or kept here when external publishing is off;
  - didn't reach the community relay;
  - nothing saved, and why.
- **Error sentences end with what happened to the data,** for example "— nothing was saved".
- **One signer prompt per action,** never for an "already", and never for a request the server would refuse.
- **The panel opens where the person can see it,** centred, and walks with **Next**.

`[UNKNOWN]` No design guide covers this page. The panel copies Concept Headers' panel, not a design-system component.

## 6. Carry-forward & open questions

Promoted from build audit §6:
- **Production:** the book is on staging only.
- **Concept Headers' fix:** point its panel at these endpoints, under the same rule. Its admins would lose the
  ability to act on the Owner's Assistant's concepts. Is that wanted?
- **New DList's "Sign as Assistant":** same flaw, same fix.
- **Withdrawing a decision:** nothing removes a `b` today.
- **Showing what a wired header points at.**
- **Wiring by a kind-9998 event id.**
- **One shared disposition component** for both pages.
- **Small fixes already filed:** read-back hardening, the in-flight signer prompt, the duplicate Owner entry.

## 7. What product must validate

- [ ] **Should Concept Headers adopt this rule next,** and what happens to admins' current ability to disposition the
      Owner's Assistant's concepts?
- [ ] **Is "any list-header address" the right Wire rule,** or should a target have to be a known Shared Concept?
      (Owner decision at story 4: any address, for now.)
- [ ] **Do people need to undo a decision** (remove a `b`), or is a new decision always additive?
- [ ] **Is List Headers where non-Owner people will settle their headers,** or should this live on a "My lists" surface?
- [ ] **Does the "cancelled" wording** for any signer failure at the account step read right to people
      (audit §4 #10)?
