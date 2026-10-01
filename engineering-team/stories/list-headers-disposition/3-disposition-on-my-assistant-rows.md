# Story 3: Disposition on My Assistant rows — Submit as a Shared Concept and Keep private, signed by your own Assistant

**Status:** Approved
**Created:** 2026-10-01
**Type:** Feature
**Epic:** `list-headers-disposition`
**Book:** `engineering-team/audits/list-headers-disposition/book.md`

## Background

This is the book's first story that signs anything, and the reason the book exists.

On Concept Headers, **Submit as a Shared Concept** and **Keep private** always sign with the Owner's
Assistant, and any signed-in admin can trigger them, as can a no-session call from inside the container
(OPEN.md row `2026-10-01-concept-headers-disposition-owner-signer`). The owner's rule for this book: *nobody
can trigger somebody else's Assistant to publish anything.* On List Headers, the signer is always the
signed-in person's own Assistant, and only for headers that Assistant wrote.

Stories 1 and 2 gave the page the pieces this needs:
- **My Local Tapestry Assistant** in the Author selector, resolved from the signed-in person;
- the 🧭 column showing each header's disposition.

This story adds the actions for one kind of row: kind-39998 headers the signed-in person's own Assistant wrote.

The owner decided two things at planning (2026-10-01):
- **Any of my Assistant's rows**, not just undecided ones, gets the button. So a decision can be changed: a
  kept-private or wired header can still be submitted as a Shared Concept.
- The panel keeps Concept Headers' **Next undecided →** button, for working through many rows.

Who this serves today:

| Instance | The Owner's Assistant's kind-39998 headers | Customers' Assistants' headers |
|---|---|---|
| This machine | 183 (168 undecided) | none |
| Staging | 45 (32 undecided) | 5, all already wired (from curation) |

b-tags are only ever added. A header that is shared or wired keeps that b-tag. This feature can add to a
decision but never withdraw one.

## User-facing description

As a signed-in person, I want to submit my Assistant's list headers as Shared Concepts, or keep them private,
from List Headers, so that I can settle what my Assistant has published. My Assistant does the signing, and
nobody else can make it, or anyone else's, sign.

## Acceptance criteria

- [ ] **Who gets the button.** Given a signed-in person, a **Disposition…** button appears in the 🧭 cell
      of every kind-39998 row written by *their own* Assistant on this instance, whatever its disposition,
      next to any chips it already shows. No button appears:
      - on rows written by anyone else, including the Owner's Assistant for a non-Owner, and another
        person's Assistant for the Owner;
      - on kind-9998 rows;
      - on any row when signed out, or when the person has no Assistant here.

      Clicking the button opens the panel and doesn't open the list. Clicking elsewhere on the row still
      opens the list.
- [ ] **Submit as a Shared Concept.** Given one of those rows, when the person clicks **Submit as a Shared
      Concept**:
      - a new version of the header is saved on this instance (its relay and its knowledge graph), signed by
        the person's own Assistant, with the same content and every earlier tag, except that the keep-private
        marker is dropped and a b-tag pointing at the header's own address is added;
      - the new version is sent to the community relay;
      - the row then shows 🤝 (next to 🔗 if it was wired) without a reload.

      Given a row that is already self-declared, nothing new is signed: the existing version is sent to the
      community relay again, and the panel says so.
- [ ] **Keep private.** Given an undecided row, **Keep private** saves a new version signed by the person's
      own Assistant with the keep-private marker added. It sends nothing to the community relay, and the row
      then shows 🔒.
      - Given a row that already has a real b-tag (wired or self-declared), **Keep private** can't be chosen,
        and the panel says why.
      - Given a row that is already private, nothing new is signed, and the panel says so.
- [ ] **Nobody else's signer.** Given any request to submit or keep private, this instance signs nothing,
      saves nothing and answers with a refusal when:
      - the caller has no signed-in session, including a call from inside the container;
      - the header wasn't written by the caller's own Assistant, including an admin or the Owner asking about
        another person's Assistant's header;
      - the caller has no Assistant on this instance;
      - the header is kind 9998, or no such header exists here.

      Concept Headers' buttons behave exactly as they do today.
- [ ] **An honest outcome.** After **Submit**, the panel says which of these happened:
      - it was published to the community relay;
      - it was kept on this instance because external publishing is off;
      - it wasn't delivered. The new version is still saved here, and the panel says that too.

      **Keep private** never contacts the community relay.
- [ ] **Next undecided.** After any action, when the person's own Assistant has another undecided row on the
      page, a **Next undecided →** button opens the panel on it. Otherwise the panel offers only **Done**.

## Concepts touched

- `39998:11f23fe40984a07be717d1628bdd0e87a2b4569f05dd7625923c20b89df93767:list`: **list** (the headers being
  re-signed). Handle as it reads in this machine's graph; the pubkey part differs per instance.
- The b-tag, its self-pointing form, and the keep-private marker, with the meanings Concept Headers already
  uses (community-reference ADR 0029; shared-concepts-adoption ADR 0001). No new meaning is introduced.
- The signed-in person's Assistant on this instance: the same one story 1 resolves for **My Local Tapestry
  Assistant**.

## Out of scope

- **Wire to an external shared concept.** *Proposed split:* the third action becomes story 4, on the same
  panel, under the same rule. **Me** rows (signed by the person's own browser signer) move to story 5. All
  three actions still ship together, in this book, before staging.
- **Withdrawing a decision.** No action removes a b-tag.
- **Concept Headers' buttons and New DList's "Sign as Assistant".** They keep their current signer until the
  later fix (OPEN.md rows `2026-10-01-concept-headers-disposition-owner-signer` and
  `2026-10-01-new-dlist-assistant-signer`).
- **A filter for "my undecided rows".** The **My Local Tapestry Assistant** author choice plus sorting by 🧭
  already gets there.
- **The page's `…:null` link for a kind-39998 header with no `d` tag** (story 2's review, non-blocking 1).
  The Architect decides whether to fix it if this story touches that code. No such header exists here or on
  staging.

## Open questions

None. Two choices are confirmed by approving this story:
1. **The split.** Wire becomes story 4 and **Me** rows story 5, which makes five stories in the epic instead of
   four. The book's definition of done is unchanged.
2. **Story 2's AC 6 ("no action in the cell") is narrowed.** It still holds for every row except the person's
   own Assistant's rows, which now carry the **Disposition…** button.

## Linked artifacts
- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
