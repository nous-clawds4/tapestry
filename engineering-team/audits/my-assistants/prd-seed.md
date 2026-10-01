# PRD Seed: My Assistants

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/my-assistants/audit.md`
**Anchor:** the acceptance frame in `book.md`, confirmed by the owner with story 1, plus the owner's 14 recorded
decisions
**Confidence:** high for what shipped and why; medium for the personas and next-phase framing, which no product phase
ever stated
**Date:** 2026-10-01

> This is a **reverse-engineered baseline** in the product-team PRD shape, built from what shipped. It is a *strawman
> for the product team*, not a ratified spec. Every section is tagged `[FROM FRAME]` (grounded in the acceptance
> frame or a recorded owner decision), `[INFERRED]` (read off the as-built system), or `[UNKNOWN — product input
> needed]`. The product team adopts it as the starting point for `/discover` on the next phase and validates each
> section.

## 1. Product vision

- `[FROM FRAME]` **One page where a signed-in person sees every Assistant they've claimed,** and what each one does
  for them according to their Treasure Map. They can also claim a profile as an Assistant, switch the claim between
  "Brainstorm" and "Tapestry", or drop it, on the owner's Claude Design blueprint. A person can have several
  Assistants across several Web-of-Trust service providers; this page is where they keep track of them.
- `[FROM FRAME]` **Trust, in the owner's words at story 4:** "investigate whether the Tags are correct". The page is
  also an audit tool. Is this NIP-05 genuine? Who has tagged this Assistant, and with what?
- `[UNKNOWN — product input needed]` **Whether this page should grow into managing Assistants.** That would mean
  editing duties, adopting a provider's Assistant, or provisioning one. Or does it stay a read-and-claim directory,
  with management on the Treasure Map and Assistant pages?

## 2. Personas

- `[INFERRED]` **The owner-operator** (the requester). Several Assistants across instances (Nous: one on production,
  one on staging, a Brainstorm Assistant at `4b7ba0a1…`). Uses the page to check the claims and the tags.
- `[INFERRED]` **A customer with one Local Assistant.** Arrives with their own Assistant untagged. The page lists it
  anyway and points to Identification Tags (decisions 5 and 9).
- `[UNKNOWN — product input needed]` **Someone with Assistants from several providers** (brainstorm.world plus a
  Tapestry instance). The two tag names exist for them (decision 4), but no one in that position has used the page.

## 3. Scope (as-built)

- `[FROM FRAME]` **The avatar-menu link and `/assistants`,** in the Brainstorm design.
- `[FROM FRAME]` **The list:** both tags count, whoever authored the definition. The viewer's own Assistant on this
  instance is always listed, marked Local and, when untagged, Not tagged.
- `[FROM FRAME]` **Search, Tag, Change, Remove,** signed in the viewer's own extension.
  - Remove withdraws the claim (NIP-09), not a dispute (decision 7).
  - Withdrawals reach the other instances through the community relay and a `tagDeletions` router stream (decision
    10).
- `[FROM FRAME]` **The viewer's own Treasure Map, read-only:**
  - on-map status and duties per Assistant;
  - the not-tagged section with Tag buttons;
  - a Duties tab for the entry types the app reads today (decision 2), with Preferred then Alternates (decision 11).
- `[FROM FRAME]` (decision 14) **NIP-05 status** (Verified, Not valid, Couldn't check), and **View profile** links to
  each Assistant's Brainstorm profile page.
- `[FROM FRAME]` **The honest states:** nothing is claimed while data loads or after a failed read (stories 3 and 4).
- `[INFERRED]` **Out:**
  - other people's Assistants;
  - editing duties;
  - the draft Treasure Map grammar;
  - the design's other screens.

## 4. Domain model

- `[INFERRED]` **An Assistant claim:** a kind 39999 tagging by the viewer.
  - It points at a tag definition, `39999:<author>:my-brainstorm-assistant` or `…:my-tapestry-assistant`, both by
    Nous today.
  - It carries the canonical `z` for `nostr-user-tag`, with polarity 1.
  - A claim is withdrawn by a kind 5 naming its ids and addresses, with `k` = 39999.
- `[INFERRED]` **The Local Assistant:** the instance's delegate for the signed-in person (`getAssistantPubkeyFor`),
  resolved at runtime.
- `[INFERRED]` **A duty:** one distinct key on the viewer's kind 10040, held by Assistants in Map order. The first is
  Preferred, the rest Alternates. It has a group (Scores, Lists, Concepts) and a level (Scope or Exact).
- `[INFERRED]` **A NIP-05 status:** derived on read, from the domain's listing, by the server: verified, invalid or
  unchecked. Nothing is stored (principle 3, filter at view time).
- `[UNKNOWN — product input needed]` **What distinguishes a "Brainstorm" Assistant from a "Tapestry" Assistant** in
  the definitions. Decision 4 says Brainstorm-service vs Tapestry-instance, but the published descriptions are
  identical (audit §4 #11).

## 5. Design rules (as-built)

- `[FROM FRAME]` **The owner's Claude Design blueprint** (version `1790680640-925e`, kept in `blueprint/`). The copy
  tables live in each story's § Copy.
- `[INFERRED]` **Honesty over smoothness.** "Checking…" and "Couldn't check" are preferred to a guess. A failed read
  is never shown as "none" or "not valid". A status always belongs to the input it was computed for.
- `[INFERRED]` **Every press is reported per relay,** one press at a time, and the result is announced to screen
  readers.
- `[INFERRED]` **Links that leave the page open a new tab** and say so to screen readers. Nothing interactive nests
  inside a row's toggle.
- `[UNKNOWN — product input needed]` **One wording for the Tag action.** The blueprint uses "Tag: Brainstorm" in one
  place and "Tag: My Brainstorm Assistant" in another, and both shipped (audit §4 #12).

## 6. Carry-forward & open questions

Promoted from the build audit's §6:
- production promotion;
- catch-up for withdrawals missed while a router restarts;
- a Try again that re-reads the relay list;
- editing duties here, and the draft grammar;
- Curated DList header names;
- NIP-05 status beyond this page;
- safe redirect-following for NIP-05;
- distinct definition descriptions;
- one Tag wording;
- the leaked dev-key fixtures (the owner's call);
- a tighter N7 test.

## 7. What product must validate

- [ ] Does My Assistants stay a directory-and-claim page, or grow into managing Assistants (duties, adoption,
      provisioning)? (§1)
- [ ] What should the two tag definitions' descriptions say, and should they be republished before more people tag
      with them? (§4)
- [ ] One wording for the Tag buttons across the page. (§5)
- [ ] Should NIP-05 status appear on the profile pages and in search too, in the same three states? (audit §6)
- [ ] Is the multi-provider persona real yet, and what does that person need from this page? (§2)
- [ ] Should the page show other people's Assistants (for example a profile's Assistants on its own profile page)? It
      was excluded from this book.
