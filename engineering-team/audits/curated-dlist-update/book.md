# Book of Work: Curated DList Update — the assistant copies, with a preview

**Slug:** curated-dlist-update
**Status:** Closed
**Opened:** 2026-09-11
**Closed:** 2026-09-17
**Strictness:** Standard (project default, proposed at kickoff 2026-09-11; no Light profile).

## Intent anchor

**Acceptance frame (no PRD)** — the operator's ask of 2026-09-11 ("make the Update list button
work"), the book after `my-curated-dlists`. Its protocol half was settled the same day in `/discuss`
(OPEN.md rows 259 and 267; the settled points are in the epic, § "Settled at kickoff"), and the
operator's answers on Update itself are folded in: a preview before the assistant signs, manual only,
and a curation method that mirrors Simple Lists' "Generate Trusted List" panel.

### Acceptance frame

- [x] **The protocol says "copy".** The spec states how my assistant copies a community item into my
      curated list, how the copy points back at its original, and how a copy is removed — and that my
      curated list is exactly the items filed under it (nothing is inherited live). OPEN.md rows 259
      and 267 are settled in the spec.
- [x] **Headers and words agree.** My assistant's header links to the shared list as a `pointer`; a
      header published with the older `inherit-items` link is upgraded in place, shown to me before my
      assistant signs. What I read says "copy", not "inherit" — the DList Curation panel's description
      and My Curated DLists' labels.
- [x] **Another assistant's curation opens read-only.** A list my Treasure Map empowers for an
      assistant that is not my assistant on this instance (for example, my assistant on another
      instance) opens read-only, with Update disabled and an offer to curate it here instead.
- [x] **The curation method.** The Curation method panel shows the Scoring Method and point of view I
      chose on the Trust Determination page and lets me set the cutoff. Which community items qualify
      is decided the way the Simple Lists "Generate Trusted List" panel decides it.
- [x] **Update list works, with a preview.** Pressing Update list shows what my assistant would do —
      the point of view, method and cutoff at the top; the items it would copy, refresh and delete; why
      each candidate was skipped — and my assistant signs and publishes only after I approve.
- [x] **Safe by default.** A failed or incomplete read never proposes a deletion. Nothing runs on a
      schedule. The method, point of view and cutoff are not written onto the header.

## Epics in this book
- `curated-dlist-update` — the copy convention (docs-mode), the header's `pointer` link and "copy"
  wording, read-only curations by another assistant, the curation-method panel, and Update list with
  its preview.

## Known constraints acknowledged at kickoff
- **Manual only.** Update runs when the user presses the button; a schedule comes in a future session.
- **No method on the header.** A future session will create a concept for Trust Determination Methods
  (name to be chosen), and the DList header will point at an element of it. Until then the Scoring
  Method and point of view live where the Trust Determination page keeps them — per browser — so two
  browsers can propose different Updates; the preview names what it used.
- **"My assistant" is the signed-in user's own** — the instance TA for the owner, a per-user key for
  everyone else (OPEN.md row 188). The Simple Lists panel's Trusted List is signed by the instance
  owner's assistant; Update mirrors that panel's rule, not its signer.
- **Deletions need relays that honor them.** Removal is a NIP-09 deletion request; whether the relays
  holding copies accept and honor kind 5 (including the `a` form) is checked before Update relies on
  it. Local strfry runs with no write policy; the community relay's policy is unchecked.
- **Live data (from the `my-curated-dlists` book, checked 2026-09-10/11).** Two headers on the
  community relay carry the older `inherit-items` link — staging's TA `8e901369…` and the customer
  assistant `253d40c4…`, both for `dog-breed`. The shared `dog-breed` list has no items on the
  community relay (staging's candidates are empty); its two items (`sheep dog`, `golden retriever`)
  are in this Mac Studio's local strfry.
- **Ledger.** New OPEN.md rows from this book start at 271 (origin/staging holds 268–270 at kickoff).

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** high for what the branch contains — every frame bullet traces to a story with
  passing tests, each review reached PASS, and the book's five suites plus the six it re-aimed are green at
  `30b76593`. **Low for behaviour in the wild:** nothing has shipped, and no real Update has ever been
  published, so the community relay's handling of kind-5 deletions is still unobserved (audit §5).

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/curated-dlist-update/audit.md`
- Product feedback: `engineering-team/audits/curated-dlist-update/prd-seed.md`
