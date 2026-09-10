# Story 1: Browse a DList with header-driven item fields

**Status:** Approved
**Created:** 2026-09-09
**Type:** Feature *(Light lane — workflows/light-profile.md; Gate A approved 2026-09-09 —
user-facing surface (not the operator browser); vote publishing out of the book; the
`github-account` firmware concept queued after story 2; Design note, not ADR; page size 50.
Scoped gate:
`node -e "require('./test/dlist-browse.test.js').run().then(r=>process.exit(r.fail?1:0))"`
plus the guard suite
`node -e "require('./test/strfry-write-assertion-bracket.test.js').run().then(r=>process.exit(r.fail?1:0))"`;
the new suite is also registered in `test/test.js` for the full-suite gate.)*

## Background
The book (`audits/dlist-item-tagging/book.md`) tags the items of Decentralized Lists, starting
with `39998:b83a28b7…:github-accounts`. Before an item can be tagged it has to be *found and
read* in the app. Today the only DList surface is the operator-side raw browser under
`/tapestry/lists`: it lists every header on local strfry, shows items in a fixed column set, and
never consults the header's field declarations — while the item *authoring* form does (it builds
its inputs from the header's `required` / `optional` / `recommended` tags). The read side has to
catch up: a list header is self-describing, and the app should render items from that
description so any list — not just the one we care about this month — reads correctly.

Live facts about the target list (relay probes, 2026-09-09): the header declares
`["required","github-username"]` and `["field-type","github-username","text"]`; its 7 items carry
their fields as top-level tags (`["github-username","vcavallo"]`, `["description","…"]`) with
empty content, authored by 4 different pubkeys. Membership is by `z` tag (`#z` = the header's
coordinate). Any pubkey may add an item — which is why item authorship must be visible.

## User-facing description
As a signed-in user, I want to open a Decentralized List in the app — from a list of lists or by
pasting its coordinate — and read its items rendered by the fields the list itself declares, so
that I can see what is on the list (and who put it there) before deciding what to tag.

## Acceptance criteria
- [ ] AC-1: Given a DList header coordinate `39998:<pubkey>:<d>` present on local strfry, when
      the user navigates to that list in the app, then the page shows the header's singular and
      plural names, its description, and its author.
- [ ] AC-2: Given the same list, the page shows its items — every kind-39999 event whose `z` tag
      equals the header's coordinate — one row per item, each row showing the item's author
      (avatar / name where a profile is known) and age.
- [ ] AC-3: Given a header that declares fields (`required`, `optional`, `recommended` tags),
      when items are rendered, then there is one column per declared field, in header order,
      required fields visibly distinguished from optional/recommended ones, and an item missing a
      required field shows an explicit "missing" mark rather than a blank.
- [ ] AC-4: Given a header that declares a field whose `field-type` is unknown or absent, the
      field still renders as text; a field named `github-username` (or whose `field-type` is a
      GitHub-username type) renders as a link to `https://github.com/<value>`.
- [ ] AC-5: Given a list with more items than one page shows, the page shows a bounded first
      page with a "showing N of M" count and a way to reach the next page; the total is stated as
      unknown (not zero) when the relay scan was bounded.
- [ ] AC-6: Given the app's list index, when the user opens it, then the `github-accounts` list
      (and every other 39998 header on local strfry) is reachable from it, with its name and item
      count.
- [ ] AC-7: Given a coordinate whose header is not on local strfry, the page says so plainly and
      does not crash.
- [ ] AC-8: Existing up/down (kind-7) counts on items remain visible where they were.

## Concepts touched
*(Handles composed from the runtime TA pubkey — never hardcoded.)*
- `39998:<TA>:nostr-kind` — element `kind-39999` (DList Item); `kind-39998` (DList header).
- `39998:<TA>:nostr-relay` — set `dlist-relays` (where lists live; local strfry first).
- Spec: `protocols/nips/decentralized-lists.md` (header field declarations, `z` membership),
  `protocols/drafts/decentralized-lists-compat.md` (`item-kind`, additive declarations).

## Out of scope
- Tagging an item (story 2), the tag page's Items view (story 3), pins/TLs (story 4).
- Publishing votes (book-level Gate-A decision).
- Creating or editing lists/items (the existing `/tapestry/lists/new` forms stay as they are).
- Fetching lists from external relays; local strfry is the source (the `dcosl` router stream
  already mirrors list events in).
- Neo4j import of list events.

## Open questions *(resolved at Gate A, 2026-09-09)*
1. **Where does this live?** Two candidates: (a) grow the operator-side `/tapestry/lists` browser
   in place; (b) a new user-facing Lists surface next to `/tags` and `/pins` (the Brainstorm app
   side, where the tagging affordances already are). **Decided: (b)** — the tagging UX
   in stories 2–4 lives on that side, and the `/tapestry/lists` browser is an operator tool with
   Neo4j import buttons the ordinary user shouldn't meet. Reuse its fetch pattern; don't fork
   its pages.
2. **Votes.** curate-psi's votes are plain NIP-25 kind-7 `+`/`-` reactions; this app reads them
   but has no reaction publish path. **Decided: out of this book** (votes are orthogonal) — the tagging stance
   (apply/dispute polarity) is the app's endorse/dispute primitive, and a kind-7 publish path is
   a separate small story once the tagging loop is proven.
3. **Page size** — 50.
4. **Two field conventions.** DCoSL headers declare fields as `required`/`optional`/`recommended`
   tags and items carry them as flat top-level tags (the `github-accounts` shape). Tapestry
   firmware concepts instead carry a JSON schema and items carry a word-wrapper `json` payload.
   **Decided:** v1 renders from the DCoSL header tags (the target list's shape); the JSON
   schema path joins when/if the `github-account` firmware concept (epic candidate 6) lands.

## Design note *(Light profile — written after Gate A, ratified at Gate B)*
—

## Edge cases & not-covered
—

## AC→handle lines
—

## Linked artifacts
- ADR: none expected (no irreversibility trigger; a Design note suffices)
- Test suite: `test/dlist-browse.test.js` (the story's scoped gate — proposed)
- Review: `engineering-team/reviews/dlist-item-tagging/1-browse-a-dlist-with-header-driven-fields.md`

Link by path only — never record verdicts or round history in this file.
