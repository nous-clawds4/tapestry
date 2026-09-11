# Story 1: My Curated DLists — the menu item, the list of empowered DLists, and the detail page's front door

**Status:** Approved
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
  (its meaning is changing — OPEN.md row 252 — but not in this book).
- Linking the DList Curation panel's rows to the new page (the panel is unchanged).
- Opening lists curated by any pubkey other than the viewer's own assistant (listed only).

## Open questions
None. (The book's one open question — what makes a community item "already on my local DList" —
belongs to story 3's gate.)

## Linked artifacts
- ADR: `engineering-team/decisions/my-curated-dlists/0001-my-curated-dlists-page.md`
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)

Link by path only — never record verdicts or round history in this file (bare `KICK_BACK`/`CHANGES_REQUESTED` tokens in gate/round context trip harness-lint L14; backticked mentions are exempt). Outcomes live in the review file and, in Direction mode, the run journal. (ADR harness-gate-integrity/0002.)
