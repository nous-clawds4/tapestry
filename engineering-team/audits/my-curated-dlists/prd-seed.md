# PRD Seed: My Curated DLists — a place to work with the lists your assistant curates

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/my-curated-dlists/audit.md`
**Anchor:** acceptance frame in `book.md` (restated at kickoff 2026-09-10 with the operator's answers)
**Confidence:** medium — the as-built is high-confidence and the frame is in the operator's own words
(including the items vocabulary), but the page has been seen only with stubbed sign-in on the local
stack; no real account has used it yet (staging follows the close), and the product framing below is
inferred from one operator's intent
**Date:** 2026-09-11

> A reverse-engineered baseline in the product-team PRD shape. A strawman for `/discover`, not a ratified spec. Sections tagged `[FROM FRAME]`, `[INFERRED]`, `[UNKNOWN — product input needed]`.

## 1. Product vision

`[FROM FRAME]` A signed-in user has **one place to work with the DLists their Tapestry Assistant
curates**: every list their Treasure Map empowers, and — for lists their own assistant curates — the
header the assistant authored, the shared list it builds on, the items it holds, and (to come) the
method it curates by and the button that makes it act.

`[FROM FRAME]` The operator's model of curation: the assistant **copies** items it accepts from the
shared community list into the user's local DList ("inherited"); items not yet copied are
**candidates**, and some may never be inherited — e.g. an item with more downvotes than upvotes. "If
the Assistant weren't doing that, what role would the Assistant even play?"

`[INFERRED]` This page is the **workbench** half of curation; the DList Curation panel on the Treasure
Map page is the **permission** half (add / revoke an empowerment). The two are deliberately separate:
the Map says *who may curate*, this page shows *what the curation is*.

`[UNKNOWN — product input needed]` Whether curated lists are mainly a **staging area** for the user's
own future instance (the dlist-curation seed's open question) or a **standing personal view** — this
page serves both today, but Update's design will pick one.

## 2. Personas

`[INFERRED]` from the stories' "As a…" lines:
- **The curator** — signed in, has empowered their own assistant for one or more community lists,
  wants to see what the assistant published and what it could draw on. Served by stories 1–3.
- **The user whose Map names someone else's assistant** — sees the entry listed with the other pubkey
  but cannot open it here (by design: only the viewer's own assistant's lists open).
- **The user without an assistant on this instance** — sees their entries listed, none openable, with
  the reason.
- **The hosting operator** — the page never writes the hosting instance's graph; the only write
  (Import to local strfry) stores a public, author-signed event in the relay.

`[UNKNOWN]` Whether the **shared list's author** or **other contributors** to a curated list are
personas with any stake (e.g. seeing who inherits their items).

## 3. Scope (as-built)

`[FROM FRAME]` All eight frame bullets shipped: the page and its menu item; only the viewer's own
assistant's lists open; the assistant's header (raw, linked, with the `b`-tag expectations); the
shared header (raw, linked, community-relay fetch + import); the Curation method placeholder; the items
table with the three views (default = the assistant's items; also others'; also candidates to
inherit); the Update list placeholder; nothing else moves.

`[INFERRED]` Also shipped without being named in the frame: the import for **either** header (gate
decision); eight explicit front-door states; honest per-source failures and the 500-item local cap;
the shared list read only on demand; a real pointer beating `b-tag-deferred` (the house rule, folded in
from story 2's review).

**Explicitly out of scope as shipped:** the curation method's controls and logic; Update doing
anything; votes, ratings, trust scores; importing items; changing the Map convention, the
`inherit-items` facet, or the protocol drafts; linking the DList Curation panel's rows to this page.

## 4. Domain model

`[FROM FRAME]` / `[INFERRED]`
- **Treasure Map** (kind 10040, user-signed) — its per-DList entries `["<kind>:<d-tag>", <assistant>,
  <relay>]` are the page's index; first occurrence wins. (Still no concept-graph handle.)
- **My local DList** — the assistant's header `<kind>:<assistant>:<d-tag>`, carrying
  `["b", <shared list>, "inherit-items"]`.
- **The shared list** — the header that pointer names (a self-declared community header).
- **Items** (kinds 9999/39999) — belong to a list by their `z` tag. Three relations to *my* list:
  **mine** (authored by my assistant, `z` = my list), **someone else's** (`z` = my list, another
  author), **candidate** (`z` = the shared list, not yet copied).
- **Copied** — `[FROM FRAME]` settled at story 3's gate: a shared item is copied when one of my
  assistant's items carries its event id or coordinate in any tag. The copy convention itself is open
  (§6).
- **`b-tag-deferred`** — "deliberately unaffiliated", counted only when it stands alone (the house rule).

## 5. Design rules (as-built)

`[INFERRED]`
- **Honest states over clean screens.** Every lookup distinguishes found · not found (with where it
  looked) · couldn't check; a failed read is never presented as "empty"; a capped read says so.
- **The viewer's own POV.** "Mine" is always the viewer's own assistant; a shared URL resolves against
  the viewer's Map.
- **Read-only by default.** One explicit, user-initiated write (import), isolated in one module; the
  placeholders act on nothing.
- **Off / closed on every load.** Raw toggles, the method panel, and the "also show" views never
  persist.
- **Links only where they work.** Simple Lists links appear only for events this instance holds.

`[UNKNOWN]` No style guide governs the page's copy or colours; the disclosure idiom is hand-rolled
again (row 249's chore).

## 6. Carry-forward & open questions

Promoted from audit §6:
- **Update** — the assistant copying (and removing, ranking) items; needs the copy convention and a
  decision on whether copies point only at the local list (else they reappear as candidates).
- **The curation method** — its inputs (votes? trust per POV? both?), its controls, and when it runs
  (on click only, or on a schedule?).
- **Reconciling `inherit-items`** with the operator's "copy" meaning (OPEN.md row 259).
- **Relay-only items** — no Simple Lists link today; import items, or teach Simple Lists to read relays?
- **Candidates on staging** — the shared lists' items must reach the community relay for anyone but the
  list's author to see candidates.

## 7. What product must validate

- [ ] Curation as **copy** (the operator's model) vs **live inheritance** (the ratified facet) — which
      one the protocol states, and what happens to copies when the original changes or is disputed.
- [ ] What the **curation method** decides from — votes, per-POV trust, both — and whether its result
      is visible before Update runs (a preview of what would be copied).
- [ ] Whether **Update** is manual only, or can run on a schedule.
- [ ] Whether **other people's items** on a curated list should ever count (today: shown on request,
      never copied or ranked).
- [ ] Whether the DList Curation panel's rows should **link to this page** (today: to Simple Lists).
- [ ] Whether curated lists should become **discoverable** (a `pointer` `b` so the curation appears in
      the community cloud) — carried from the dlist-curation seed.
