# Book of Work: Identification Tags — two authored definitions, two parked taggings

**Slug:** identification-tags-authorship
**Status:** Closed
**Opened:** 2026-09-22
**Closed:** 2026-09-22 (on staging, PR #752, and on production, PR #754 by a sibling session; the close artifacts follow on `close/identification-tags-authorship`)

## Intent anchor

**Acceptance frame (no PRD)**: the owner's ask of 2026-09-22, restated at intake. It changes the previous
book's assumption (`assistant-identification-tags`, closed 2026-09-22, live on production the same day) that
one key, the owner's, authors all four canonical tag definitions.

The owner's words, verbatim:

> I would like to make a change to the Tag system and authorship.
> 1. The `My Tapestry Assistant` Tag has been authored; you should be able to find it, authored by Nous.
> 2. The `My Tapestry Owner` Tag has been authored; you should be able to find it, authored by Nous' Tapestry Assistant.
> Let's use those two authors for those two Tags. For "My Agent" and "My Owner", I am undecided whether to use
> them or not. For the time being, let's simply force those two options to be unchecked and unable to be edited,
> which will make them greyed out and prevent them from being issued. Since Tapestry is an R&D repository, this
> will be acceptable for now. My team will play with this feature and we will decide at a later date whether to
> support these two Tags or not.

**Verified at intake (2026-09-22, relay queries):** both definitions exist and are the ones the app expects by slug.
`39999:15f7dafc4624b1e6b00ab7f863de1a53b71967528070ec7d1837c7a40c1c7270:my-tapestry-assistant` ("My Tapestry
Assistant", by "Nous 🧠", `npub1zhma4lzxyjc7dvq2klux8hs62wm3je6jspcwclgcxlr6grquwfcq28ccgm`) and
`39999:a73a298068496ba25d9d7f35839e5688cb60eab89d5aba095520d7835a9f9528:my-tapestry-owner` ("My Tapestry Owner",
by "Nous 🧠's Tapestry Assistant", `npub15uaznqrgf946yhva0u6c88jk3r9kp64cn4dt5z24yrtcxk5lj55q2fvc99`), both created
2026-09-22 through tapestry.brainstorm.world and on its relay, staging's, tags', nos.lol, primal and dcosl. "My
Owner" in the ask is the tagging the app calls "My Human" (Discovery decision 6 of the previous book).

### Acceptance frame

*Restated 2026-09-22; confirmed at the story gate.*

- [x] **Two definitions, two authors.** "My Tapestry Assistant" is the tag Nous authored; "My Tapestry Owner" is the
      tag Nous' Tapestry Assistant authored. The app names each by that author's address, publishes the two
      taggings against those definitions, and keeps reading "present" by name as before.
- [x] **Two parked taggings.** "My Agent" and "My Human" stay on their cards, unchecked, greyed out and not
      editable; nothing can issue them, from the page or through the Assistant's route. No decision is taken on
      them; unparking one later is a small change.
- [x] **The answer counts what can be issued.** The hub's card, its count line and the Assistant Alert consider
      only the two offered taggings; the parked ones neither mark nor count. *(Confirmed at the story gate,
      2026-09-22.)*
- [x] **Nothing else changes:** no wire-format change, no other page, no change to how "present" is read.

## Epics in this book

- `identification-tags-authorship`: one story, the two authored definitions and the two parked taggings.

## Path

**Standard: a feature, all five phases** (intake 2026-09-22).

## Shared lines

Branch `feat/identification-tags-authorship` off `origin/staging` at `7381c459` (staging, main and the previous
book's branch were at the same code). Before Implementation and again before Review: `git fetch` and
`git merge-tree --write-tree HEAD origin/staging` (ledger `2026-09-22-parallel-books-no-shared-line-recheck`).

## Provenance

- **Mode:** Acceptance-frame
- **Confidence at close:** high. One story, tracing to every frame bullet, reviewed PASS in one round; every bullet
  observed on `staging.brainstorm.world` after the deploy (audit §5), signed out; the signed-in path is covered by the
  mocked browser suites and a local signed-in probe, and Nous' own hub on production is what the promotion will show.

## Close artifacts *(filled by `/close-book`)*

- Build audit: `engineering-team/audits/identification-tags-authorship/audit.md`
- Product feedback: `engineering-team/audits/identification-tags-authorship/prd-seed.md`
