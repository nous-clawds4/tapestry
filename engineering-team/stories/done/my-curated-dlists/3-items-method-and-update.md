# Story 3: Items, the curation-method panel, and Update list

**Status:** Done
**Created:** 2026-09-11
**Type:** Feature

## Background
Stories 1–2 (Done) gave each curated DList a detail page that opens only for lists the signed-in
user's own assistant curates, and shows the assistant's header and the shared header it points to.
This story finishes the page the operator asked for (book frame bullets 5–7,
`engineering-team/audits/my-curated-dlists/book.md`): the list's items in a table with the
operator's three views, and placeholders for the curation method and the Update list button. It
also takes in one fix from story 2's review.

The operator's vocabulary (book § Acceptance frame; OPEN.md row 259): an **inherited** item is one
the assistant has copied to the local DList; a **candidate** is an item on the shared community list
not yet copied — possibly never, e.g. when it has more downvotes than upvotes (the curation method,
not built in this book, decides).

Facts the story rests on (read this session):
- DList items (kinds 9999/39999) point at their list with a `z` tag carrying the list's coordinate;
  Simple Lists opens an item at `/tapestry/lists/items/<encoded id or coordinate>`.
- "My local DList" is the assistant's header `<kind>:<assistant>:<d-tag>`; "the shared list" is the
  header its pointer names (story 2).
- Nothing copies items yet, so today every shared-list item is a candidate. The copy convention is
  deferred to the book that builds Update (OPEN.md row 259).
- On this Mac Studio the shared `dog-breed` list has two items (sheep dog, golden retriever) in local
  strfry; neither is on the community relay, so staging will show the candidates view empty until
  items reach it.
- Story 2's review (NB-1): the page shows "marked deliberately unaffiliated" beside a live pointer,
  while the house rule is that a real pointer supersedes the sentinel (`dispositionOf` in
  `src/lib/bValueForms.js` / `ui/src/utils/bDisposition.js`; `protocols/drafts/shared-concepts.md:43`).

## User-facing description
As a signed-in user looking at a DList my assistant curates, I want to see the items on my local
DList — with the option to also see items others added and the candidates my assistant could
inherit — and to see where the curation method and the Update button will live, so that I can check
what my list holds today and what it could draw on.

## Acceptance criteria
- [ ] **AC-1 (the items table).** Below the two headers, an "Items" section lists the items on my
      local DList — items whose list reference is my assistant's header — in a table with columns
      **Name · Author** (your assistant, or a short pubkey) **· From** (your assistant / someone else
      / candidate) **· Added** (age), each row linking to the item's Simple Lists entry. By default
      only items my assistant authored are shown. Items are looked for in this instance's strfry and
      on the community relay. Loading and empty states are explicit ("Your assistant hasn't added
      any items to this list yet."); a failed lookup reads "couldn't check", never "empty".
- [ ] **AC-2 (also show: others' items).** An "Also show items others added to this list" checkbox,
      **off on every load**, adds items whose list reference is my assistant's header but whose
      author is anyone else, marked **someone else**.
- [ ] **AC-3 (also show: candidates).** An "Also show candidates to inherit" checkbox, **off on every
      load**, adds items on the shared list (whose list reference is the shared header my
      assistant's header points to) that my assistant has not already copied, marked **candidate**.
      A shared item counts as **already copied** when one of my assistant's items on my local DList
      points back at it — carries its event id or its coordinate in any tag. When there is no shared
      header to draw from (no pointer, deliberately unaffiliated, or my assistant's header not
      found), the option says why and adds nothing.
- [ ] **AC-4 (curation method — placeholder).** A "Curation method" panel, **closed on every load**;
      opened, it says the method isn't built yet and what it will decide — e.g. skipping candidates
      with more downvotes than upvotes. Nothing in it acts.
- [ ] **AC-5 (Update list — placeholder).** An "Update list" button is visibly present but not
      functional: disabled, with a line saying it isn't built yet. Nothing is signed or published.
- [ ] **AC-6 (nothing else moves).** Stories 1–2 behave as before (apart from AC-7); story 2's
      import stays the page's only write; the TA Treasure Map page, the Simple Lists pages, and the
      DList Curation panel are unchanged.
- [ ] **AC-7 (the pointer wins — story 2's review fix).** When my assistant's header carries both a
      real pointer and `b-tag-deferred`, the page follows the pointer and does not call the header
      "deliberately unaffiliated" (the house rule); a header carrying only `b-tag-deferred` still
      reads "marked deliberately unaffiliated".

## Concepts touched
- `39998:<TA>:list` — list (the local DList and the shared list; their items)
- `39998:<TA>:shared-concept` — shared concept (the shared list the candidates come from)
- `39998:<TA>:tapestry-assistant` — tapestry assistant (the author whose items are "mine")

## Out of scope
- The curation method's real controls and logic; Update actually copying, removing, or ranking items.
- Votes, ratings, and trust scores in the table (the method's inputs, later).
- Importing items into local strfry.
- Any change to the Map convention, the `inherit-items` facet, or the protocol drafts — the copy
  convention stays deferred (OPEN.md row 259), which now also records that a copy must point back
  at its original (AC-3's rule).

## Open questions
None — settled at the story gate (2026-09-11), the operator taking the recommendations: "already
copied" is an explicit back-reference (the original's event id or coordinate in any tag of my
assistant's item); the columns are Name · Author · From · Added with a link, no votes; story 2's
review fix is folded in as AC-7.

## Deviations
- **The util imports `classifyBValue` and `dispositionOf` only** — not `SENTINEL`: once `deferred`
  comes from the house rule, nothing in `treasureMap.js` needs the literal (ADR note 1 listed all
  three; the no-copy pin holds either way).
- **`LIST_ITEMS_LIMIT` (500) is exported from the util** so the lookup and the "Showing the first N of
  M" note share one number.
- **The empty sentence is composed per view**: "Your assistant hasn't added any items to this list
  yet." plus " No one else has either." when others are shown, plus " The shared list offers no
  candidates to inherit." once the shared list has been read; a failed or partial shared-list read gets
  its own note ("Couldn't check the shared list — …"), mirroring sub-decision 7 for my list.
- **The disabled candidates box names its reason inline** ("— unavailable: your assistant's header is
  marked deliberately unaffiliated" / "names no shared list" / "was not found" / "couldn't be
  checked"), keyed by `sharedListUnavailable`.
- **Live verification via the fetch-stub remount** (local stack, bundle `index-BeAS6lUP.js`; auth and
  the Map stubbed, items injected per mode for my list only — everything else real). `dog-breed`
  (your assistant's header now local after story 2's review import): default view "Your assistant
  hasn't added any items to this list yet.", Update disabled, the method panel closed; only my list
  read (local + dcosl) until "candidates" was ticked, then the shared list read (local + dcosl) and
  **golden retriever** and **sheep dog** appeared as candidates by `11f23fe4…3767`, linked to their
  Simple Lists item pages; the method panel opened to its text. With my assistant's item copying
  sheep dog (an `a` tag with its coordinate) and someone else's corgi injected: default → sheep dog
  (your assistant); + others → corgi (someone else); + candidates → golden retriever only; both boxes
  back off after a reload. The 500 cap → "Showing the first 500 of 812 items found in this instance's
  strfry."; a failed local scan → "Couldn't check this instance's strfry for items — showing what
  wss://dcosl.brainstorm.world returned." AC-7: a header with `b-tag-deferred` beside a pointer shows
  the pointer, no "deliberately unaffiliated", the shared header followed, candidates enabled; the
  sentinel alone still says "deliberately unaffiliated" and disables candidates with that reason; no
  `b` → "names no shared list"; the header missing → "was not found". Console: no errors besides the
  stub's `/api/user-prefs` 401s.
- **Round 2 (ADR 0003 Amendment 1):** the empty sentence now comes from `itemsEmptySentence`, which
  claims "no candidates" only after a shared-list read that did not fail on both sources. Its base
  sentence keeps the straight apostrophe the page rendered before. Live (bundle `index-BOgUwrwR.js`):
  with both shared reads failing, the section reads "⚠️ Couldn't check the shared list — looked in this
  instance's strfry and on wss://dcosl.brainstorm.world." then "Your assistant hasn't added any items to
  this list yet." — no "no candidates"; with a clean read, the two candidates as before.

## Linked artifacts
- ADR: `engineering-team/decisions/my-curated-dlists/0003-items-method-and-update.md`
- Test plan: `engineering-team/stories/my-curated-dlists/3-items-method-and-update.test-plan.md` (suite: `test/my-curated-dlists-items.test.js`; re-aims story 2's U4)
- Review: `engineering-team/reviews/my-curated-dlists/3-items-method-and-update.md`

Link by path only — never record verdicts or round history in this file (bare `KICK_BACK`/`CHANGES_REQUESTED` tokens in gate/round context trip harness-lint L14; backticked mentions are exempt). Outcomes live in the review file and, in Direction mode, the run journal. (ADR harness-gate-integrity/0002.)
