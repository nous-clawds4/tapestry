# Book of Work: List Headers disposition, signed only by you or your own Assistant

**Slug:** list-headers-disposition
**Status:** Closed
**Opened:** 2026-10-01
**Closed:** 2026-10-02

## Intent anchor

**Acceptance frame (no PRD)**: the owner's ask, restated at intake (2026-10-01). Completion is
*judged* against the bullets below.

It started from a question about who signs when someone clicks **Submit as a Shared Concept** on
Concept Headers. The answer was always the Owner's Assistant, and any admin can trigger it. The
owner's ask, verbatim (copied from the session transcript, not retyped):

> Let's discuss making the logged-in user the author. It occurs to me that a better place for this button to exist might be the List Header page, not the Concept Header page. Here is how I would like this to work: on the Simple DLists page, in the Author selector, I would like to add two options to the top: 1. Me 2. My Local Tapestry Assistant. Next, we should have a b-disposition column, analagous to the column that exists currently in the Concept Headers table. Then we should build the Disposition feature on the List Headers page, modelled after the Concept Headers page, but let's make sure that nobody can trigger somebody ELSE's Assistant to publish anything. In the future, we will fix this in Concept Headers. But for now, let's simply build this as a new feature into List Headers. Make sense?

The owner's answer to the five decisions below, verbatim:

> agree with all five, go ahead with /plan-feature

### Acceptance frame

*Proposed 2026-10-01 with story 1. It's confirmed when the owner approves story 1.*

- [x] On List Headers, the Author selector offers **Me** and **My Local Tapestry Assistant** at the
      top. Each shows only the signed-in person's own headers, or only their own Assistant's.
- [x] A 🧭 column shows each header's b-disposition: wired, self-declared, kept private, or not yet
      decided. A header that can't be re-published (kind 9998) shows "—".
- [x] On rows that the signed-in person or their own Assistant wrote, a Disposition panel offers
      **Submit as a Shared Concept**, **Keep private**, and **Wire to an external shared
      concept**. The person's own signer signs **Me** rows. The person's own Assistant signs
      **My Assistant** rows.
- [x] Nobody can make somebody else's key or somebody else's Assistant sign anything through this
      feature: not an admin, not the owner, and not a caller with no session.
- [x] Concept Headers and its disposition buttons are unchanged. The Concept Headers fix and the
      same flaw in New DList's **Sign as Assistant** are each recorded as a ledger row.
- [x] The book is shipped to staging. Production only on the owner's explicit go.

## Decisions at intake

Settled in the advisory discussion before planning. The owner agreed to all five.

1. **Your own signer signs your own headers.** On a **Me** row, the signed-in person's browser
   signer (NIP-07) signs the new version, so the person is literally the author. The server only
   checks the signature. It never holds the person's key.
2. **No session, no "me".** A call that comes from inside the container with no signed-in session
   is refused on this page's actions. Concept Headers lets such calls through today. This feature
   doesn't.
3. **Kind 9998 headers can't be dispositioned.** They aren't replaceable and have no
   `kind:pubkey:d-tag` address. A new version would be a different event and would orphan the
   items that point at the old one. Their 🧭 cell shows "—".
4. **All three actions follow the same rule.** Submit, Keep private, and Wire each re-sign the
   header. All three move over together.
5. **New DList's "Sign as Assistant" is out of scope.** It has the same flaw (it signs as the
   Owner's Assistant, and admins can use it). It gets a ledger row next to the Concept Headers
   fix, so both are fixed together later.

Implied by the ask and stated for the record: a **My Assistant** row is signed by the Assistant
this instance holds for the signed-in person, and by no one else's.

## Epics in this book
- `list-headers-disposition`: the Me / My Assistant author options, the 🧭 column, and the
  Disposition panel on List Headers.

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** high. The owner confirmed the frame with story 1. Every bullet maps to Done stories whose
  final reviews passed. The book shipped to staging via PR #801 (merge `02a0d5a0`), and the smoke checks ran on the
  live instance. It is not in production.

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/list-headers-disposition/audit.md`
- Product feedback: `engineering-team/audits/list-headers-disposition/prd-seed.md`
