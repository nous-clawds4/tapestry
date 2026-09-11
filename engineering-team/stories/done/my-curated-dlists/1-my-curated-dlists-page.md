# Story 1: My Curated DLists — the menu item, the list of empowered DLists, and the detail page's front door

**Status:** Done
**Created:** 2026-09-10
**Type:** Feature

## Background
The DList Curation panel on the TA Treasure Map page (`dlist-curation` #5, in production
2026-09-10) lets a signed-in user empower their Tapestry Assistant to curate a community DList: the
assistant authors its own header for the list, `<kind>:<assistant>:<d-tag>`, carrying
`["b", <community header>, "inherit-items"]`, and the user's Treasure Map records the empowerment as
one entry per list, `["<kind>:<d-tag>", <assistant pubkey>, <relay hint>]`
(`protocols/drafts/assistant-designation.md` § "Per-DList curation entries"). That panel is where
empowerments are added and revoked. Nothing lets the user *work with* a curated list — see the
header the assistant authored, the community header it points to, the list's items, and (later)
how the assistant curates it.

This book adds that place (`engineering-team/audits/my-curated-dlists/book.md`). This first story
gives it a menu item, lists every DList empowered on the Map, and opens a detail page for the lists
the signed-in user's own assistant curates. Stories 2–3 fill the detail page: the two headers; the
items table, the curation-method placeholder, and the Update list placeholder.

Facts the story rests on (read this session):
- The Map is found where the TA Treasure Map page finds it: this instance first, then the
  general-purpose relays.
- Per-DList entries are kind 39998 or 39999; when a list appears twice, the first occurrence counts
  (ADR `dlist-curation/0002` §5, applied the same way by Map Entries).
- An entry may name any pubkey. The panel writes the signed-in user's own assistant, but the Map is
  the user's to hand-edit, and a different assistant's entry is legitimate.
- "My assistant" is the signed-in user's own assistant on this instance — the instance TA for the
  owner, a per-user key for everyone else (OPEN.md row 188). On staging today, two accounts each
  curate `dog-breed` through two different assistants.

## User-facing description
As a signed-in user who has empowered assistants to curate DLists on my Treasure Map, I want a
"My Curated DLists" page, reachable from the menu right under TA Treasure Map, that lists every
DList my Map empowers — whichever assistant each entry names — and lets me open the ones my own
assistant curates, so that I have one place to go to work with the lists my assistant curates for
me.

## Acceptance criteria
- [ ] **AC-1 (menu item).** Under 🍇 My Grapevine, a "My Curated DLists" item appears directly
      below "TA Treasure Map"; choosing it opens the My Curated DLists page, whose breadcrumb ends
      My Grapevine › My Curated DLists. Every other menu item keeps its label, order, and target.
- [ ] **AC-2 (whose Map; the states before a list).** Signed out, the page asks me to sign in (as
      the TA Treasure Map page does). Signed in, it looks for *my* Treasure Map where the TA
      Treasure Map page looks and shows an explicit loading state; if no Map is found it says so,
      names where it looked, and links to TA Treasure Map. A lookup failure is shown as an error,
      never as "no DLists".
- [ ] **AC-3 (the list).** With a Map found, the page shows one row per DList the Map empowers —
      every per-DList entry, kind 39998 or 39999, whatever pubkey it names — with: the list's name
      (from its header when the header can be found on this instance or at the entry's relay hint;
      otherwise the d-tag, with a note that the header was not found); the kind and d-tag; who is
      empowered (**your assistant**, or **another pubkey** with its short form); and the relay
      hint. If the Map empowers no DLists, the page says so and points to the DList Curation panel
      on TA Treasure Map. When the Map names the same list twice, only the first entry counts and
      the row notes that a duplicate was ignored.
- [ ] **AC-4 (only my assistant's lists open).** Rows naming the signed-in user's own assistant
      are links to that list's detail page — including when the header was not found (the detail
      page reports that). Rows naming any other pubkey are not links, and say why. A signed-in user
      with no assistant on this instance sees the list with no links and a line saying so.
- [ ] **AC-5 (the detail page's front door).** The detail page identifies the list — its name when
      found, its kind and d-tag, "curated by your assistant" with the assistant's short pubkey — and
      links back to My Curated DLists. Reached directly (a bookmarked or shared URL), it shows a
      list only if that list is empowered on the signed-in user's own Map *and* names their own
      assistant; otherwise it says which case applies (signed out · no assistant on this instance ·
      not on your Map · empowered for another pubkey) and shows no list content. The headers, the
      items, and the curation controls are stories 2–3.
- [ ] **AC-6 (nothing else moves).** The TA Treasure Map page — every panel, including DList
      Curation and its links to Simple Lists — and the Simple Lists pages are unchanged. This story
      writes nothing: no event is signed, published, or imported.

## Concepts touched
- `39998:<TA>:list` — list (the DLists the page enumerates; TA pubkey per deployment, resolved at
  runtime)
- `39998:<TA>:tapestry-assistant` — tapestry assistant (the delegate named on each Map entry;
  "mine" is the signed-in user's own)
- `39998:<TA>:shared-concept` — shared concept (the community header each assistant header points
  to; shown from story 2)
- The Treasure Map itself (kind 10040) has no concept handle (`dlist-curation` prd-seed §4).

## Out of scope
- The two headers — raw events, Simple Lists links, the `b`-tag expectations, the import path
  (story 2).
- The items table, the curation-method panel, and the Update list button (story 3).
- Adding, replacing, or revoking empowerments — they stay on the TA Treasure Map page's DList
  Curation panel.
- Any change to the Map convention, the assistant-header endpoint, or the `inherit-items` facet
  (its meaning is changing — OPEN.md row 259 — but not in this book).
- Linking the DList Curation panel's rows to the new page (the panel is unchanged).
- Opening lists curated by any pubkey other than the viewer's own assistant (listed only).

## Open questions
None. (The book's one open question — what makes a community item "already on my local DList" —
belongs to story 3's gate.)

## Deviations
- **The not-found text names only a relay that was actually checked.** Both pages build it with
  `describeHeaderLookup({ relay: lookup.checkedRelay }, …)`, so an entry whose hint is not ws/wss
  reads "Header not found locally; no relay hint" rather than naming an `https://` hint the lookup
  never fetched (Map Entries passes the row and names it).
- **The per-row "Only lists your own assistant curates open here." shows only when the viewer has an
  assistant.** With no assistant, every row is closed and the page-level line ("You don't have a
  Tapestry Assistant on this instance…") says why once (AC-4's second sentence).
- **`useTreasureMap` keeps only kind-10040 events authored by the viewer from the relay step.** The
  Treasure Map page takes the relay answer as-is; the order and stop rule are unchanged (ADR
  sub-decision 5) — this only stops a misbehaving relay from handing over someone else's Map.
- **Live verification via the fetch-stub remount** (no NIP-07 in the automated browser; memory note
  "Verifying signed-in UI"), local stack, bundle `index-BXfRYMA9.js`. Stubbed: sign-in (a customer
  whose assistant is `253d40c4…`) and the kind-10040 scan (a synthetic Map pointing at real headers);
  everything else was real. Seen: the menu item directly below TA Treasure Map, highlighted on both
  pages; signed out → the sign-in prompt (unstubbed); three rows — `dog breed` (the header fetched
  from dcosl through the entry's hint), the TA's `list` (found locally; another pubkey; closed; "Only
  lists…"), `missing-list` (39999; "Header not found locally or on wss://dcosl…"; still a link) —
  with the duplicate note on dog-breed; links only on my assistant's rows; relay fetches only for the
  two headers missing locally. Detail: `dog breed` opens (breadcrumb … › My Curated DLists › Detail,
  "curated by your assistant · 253d40c4…6ec0", "Header found on wss://dcosl…"); direct visits read
  "39998:list is empowered for another pubkey · 11f23fe4…3767 — …", "39998:unknown is not on your
  Treasure Map.", "“garbage” is not a curated-DList address.", the no-assistant sentence (and the
  list with no links plus its line), "No Treasure Map found — searched local strfry and wss://…" (four
  relays; the relay step ran with the full list after the local miss), and the lookup error (list and
  detail) — none showing list content. Console: only `GET /api/user-prefs` 401s from the app shell
  (the stubbed session has no server session); every request the new pages made returned 200. Not
  done: a narrow-viewport screenshot (the Browser pane was not displayed), and nothing under a real
  signer (nothing here writes).

## Linked artifacts
- ADR: `engineering-team/decisions/my-curated-dlists/0001-my-curated-dlists-page.md`
- Test plan: `engineering-team/stories/my-curated-dlists/1-my-curated-dlists-page.test-plan.md` (suite: `test/my-curated-dlists-page.test.js`)
- Review: `engineering-team/reviews/my-curated-dlists/1-my-curated-dlists-page.md`

Link by path only — never record verdicts or round history in this file (bare `KICK_BACK`/`CHANGES_REQUESTED` tokens in gate/round context trip harness-lint L14; backticked mentions are exempt). Outcomes live in the review file and, in Direction mode, the run journal. (ADR harness-gate-integrity/0002.)
