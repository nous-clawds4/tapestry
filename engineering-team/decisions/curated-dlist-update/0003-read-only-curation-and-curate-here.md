# ADR 0003: Another assistant's curation — a read-only mode of the same detail page, seen through the curator's pubkey, with an inline offer to curate it here

**Status:** Accepted
**Date:** 2026-09-12
**Story:** `engineering-team/stories/curated-dlist-update/3-another-assistants-curation-read-only.md`
**Supersedes in part:** `my-curated-dlists` ADR 0001 (sub-decision 4's `no-assistant` and `other-pubkey`
front-door statuses, and the closed list rows) and `dlist-curation` ADR 0005 (the Replace confirmation's
words) — Decision §8; by Amendment 1, also `my-curated-dlists` ADRs 0002 and 0003 (the page's single write).
**Amended by:** Amendment 1 (2026-09-12, at the end) — §5's offer checks its target; §8 adds
`my-curated-dlists` ADRs 0002 and 0003; the Security bullet counts the offer's writes.

## Context

The story's acceptance criteria, in short:
- **AC-1** every row on My Curated DLists links to its detail page. Another pubkey's row says it opens
  read-only. With no assistant here, every list opens read-only and the page line says so (gate
  decision 2).
- **AC-2** the read-only page shows:
  - the list's name, kind and d-tag, and "curated by another assistant · `<short>`";
  - why it is read-only;
  - that assistant's header, with today's lookup states, shown as authored by that assistant (no "not
    authored by your assistant" warning);
  - the shared header;
  - the items, judged from that assistant's side.
- **AC-3** nothing on the page acts:
  - Update is disabled, with the reason (plus the offer, when AC-4 applies);
  - there is no method panel, only one line;
  - no note promises an action the page cannot take — the older link gets no "Update list will upgrade
    it";
  - Import stays (gate decision 1).
- **AC-4** the offer to curate it here instead:
  - it appears when I have an assistant here, the list is kind 39998, and its shared header is known
    (gate decision 3);
  - the plain words come before anything is signed;
  - it does what the panel's Replace does;
  - cancelling changes nothing;
  - afterwards the list opens as mine;
  - otherwise the page says why there is no offer.
- **AC-5** nothing else moves:
  - own lists behave as in story 2;
  - the convention, the endpoint, Map Entries and Simple Lists are unchanged;
  - the TA Treasure Map page changes only as far as AC-4's words require;
  - nothing is signed except through the offer, after I confirm.

The contract is `curated-dlist-update` ADR 0001 Decision §8 and `protocols/drafts/assistant-designation.md`:
- § "Across instances" (`:80`): an instance whose own assistant is not the one named MAY show that
  curation read-only, and MAY offer to replace the entry.
- § "Per-DList curation entries", element 3 (`:62`): "a relay where the assistant-authored header and its
  items can be fetched".

**Facts from the code (read this session).**
- **The front door** — `curatedDListAccess` (`ui/src/utils/treasureMap.js:339–354`), `my-curated-dlists`
  ADR 0001 sub-decision 4.
  - Precedence: `signed-out` → `no-assistant` → `bad-id` → the Map states → `not-on-map` →
    `other-pubkey` / `ok`. `no-assistant` returns before the route id is parsed.
  - The rows come from `curatedDListRows(tags, assistantPubkey)` (`:296–312`). `mine` is identity with the
    viewer's assistant, so with no assistant nothing is mine.
- **The list page** (`ui/src/pages/grapevine/MyCuratedDLists.jsx`):
  - it links only `row.mine` rows (`:103–105`);
  - a row not mine says "Only lists your own assistant curates open here.", and only when the viewer has
    an assistant (`:123`);
  - with no assistant, the page line says none of the lists open (`:65–67`).
- **The detail page** (`ui/src/pages/grapevine/CuratedDListDetail.jsx`):
  - `SENTENCES['no-assistant']` (`:19`) and `['other-pubkey']` (`:25`) render in place of the list;
  - the header lookups run only for `ok` (`:45`);
  - `describeCurationHeader(lookup.event, assistantPubkey)` (`:47`);
  - the subtitle reads "curated by your assistant" (`:72`);
  - the sections, in order (`:74–91`): the assistant's header, the shared header, the method panel, and
    the items. The items section gets the viewer's `assistantPubkey` and the community relay.
- **The headers module** (`ui/src/pages/grapevine/CuratedDListHeaders.jsx`):
  - `AssistantHeaderSection` is titled "Your assistant's DList header", with "Authored by your assistant ·
    `<short>`" or "⚠️ Not authored by your assistant";
  - `NOTE_SENTENCES['older-link']` (`:40–43`, `curated-dlist-update` ADR 0002 §5) promises that "Update list
    will upgrade it";
  - `SharedHeaderSection`'s can't-tell sentences name "your assistant's header".
- **The items module** (`ui/src/pages/grapevine/CuratedDListItems.jsx`):
  - `FROM_LABEL.assistant` is `'your assistant'` (`:23`), and the Author cell says the same (`:132`);
  - `UNAVAILABLE_REASON` reads "your assistant’s header…" (`:27–33`);
  - `CurationMethodPanel` (`:36–54`) and `UpdateListButton` ("Update list isn't built yet.", `:57–64`);
  - `ItemsSection` reads both lists at `communityRelay` (`:85–86`), and its source notes and relay-only
    marker name that relay (`:67–78`, `:130`);
  - `itemsEmptySentence` (`treasureMap.js:614`) begins "Your assistant hasn't added any items to this list
    yet."
- **The Replace flow** (`ui/src/pages/grapevine/DListCurationPanel.jsx`):
  - the panel renders only with a provisioned assistant (`:46`). Its relay hint is
    `useConfig().aRelays?.aDListRelays?.[0] || ''` (`:38–39`);
  - `handleAdd` (`:157–181`) POSTs `{ target }` to `/api/dlist-curation/header`. A 409 is a conflict;
    otherwise it sets `pending`;
  - the Map update is `upsertDListEntry(event, 39998, d, assistantPubkey, relayHint)` (`:150–155`;
    `treasureMap.js:179`, replace in place);
  - the confirmation (`:270–290`) says "Header {already existed|authored} … by your assistant." and
    "Map update: adds `39998:<d>` → your assistant" — for a Replace too (`:283`);
  - `handleSignAndPublish` (`:188–203`) runs `getActiveSignerOrThrow()` (`ui/src/utils/signerGuard.js:55`),
    then `window.nostr.signEvent`, then `publishOrThrow` (`ui/src/utils/publishProfileTag.js:24`), then
    `onPublished`.
- **The endpoint** signs with the caller's assistant key. It takes kind-39998 targets only, answers 200
  `existing:true` for `exact` and `older`, and 409 for a conflict (`curated-dlist-update` ADR 0002).
- **Other facts:**
  - `useTreasureMap` returns `refresh` (`ui/src/hooks/useTreasureMap.js:35`);
  - `COMMUNITY_RELAYS = ['wss://dcosl.brainstorm.world']`
    (`ui/src/hooks/useCommunitySharedConcepts.js:9`);
  - the panel lists only that relay's self-declared shared concepts.
- **Pins** (the Tester's re-aims, Phase 3):
  - `test/my-curated-dlists-page.test.js`: U6 (`:176–211`) — `no-assistant`, including "outranks a bad
    id" (`:190–193`), and `other-pubkey` (`:209–211`); the status list (`:376`); "curated by your
    assistant" (`:381`);
  - `test/my-curated-dlists-headers.test.js`: "Authored by your assistant" (`:213`); the status list
    (`:291`); "curated by your assistant" (`:294`);
  - `test/my-curated-dlists-items.test.js`: `itemsEmptySentence` (`:256–269`); the three exports
    (`:278`); `UpdateListButton` (`:295–296`); the section order and `ItemsSection`'s props (`:343–348`);
  - `test/dlist-curation-panel.test.js`: the control needles (`:180`) and `upsertDListEntry(event, 39998`
    (`:191`), neither changed by §7;
  - `test/assistant-setup-state.test.js`'s `no-assistant` is that feature's own state, and unrelated.
- **Drift:** the branch is 2 commits behind `origin/staging`, and neither touches these files.

**Earlier decisions this extends, and does not contradict.**
- The own-list words stay exactly as `curated-dlist-update` ADR 0002 §5 and `my-curated-dlists` ADRs 0002 and
  0003 set them; `curator` adds the read-only variant beside them.
- ADR 0001's front door and the panel's Replace words are superseded in part (§8).

**Two tensions inside the story, and how this ADR reads them.**
1. **"Before anything is signed" and "does what Replace does".** Replace calls the endpoint first, and the
   endpoint signs and publishes the assistant's header before the Map update is signed.
   - Reading: the plain words come first, and no request is sent until I continue. They say that
     continuing has my assistant write its header for this list (if it has none), and that my Map changes
     only when I sign.
   - "Cancelling changes nothing" means the Map — and so the curation — is unchanged. A header written at
     the second step stays, unused, exactly as it does when the panel's Add is cancelled.
2. **AC-5's "only as far as AC-4's words require".** Option A puts AC-4's words on the detail page, so the
   panel need not change for the offer. But the panel's own Replace says "adds", and never tells the user
   that the other assistant stops curating (the story's Background).
   - §7 gives that confirmation the same words. It is the same replacement through another door.

**Concepts.** None change. Orientation only, verified at Planning against the live graph (this machine's TA
`11f23fe4…`): `39998:<TA>:list`, `39998:<TA>:tapestry-assistant`, `39998:<TA>:shared-concept`.

**POV reflex checks.**
- *Who is this true for?* The viewer's own Map says who curates each list; the page shows that curation as
  its curator published it.
- *Where does trust come from?* Nowhere new; nothing is scored.
- *Could anyone else publish their own version?* Yes. The page reads another assistant's letters
  ungated, and the offer replaces only the viewer's own Map entry.
- *What changes when the POV changes?* Nothing is stored.

Principle 4: no graph write — the header (the endpoint) and the Map (the viewer's extension) are letters.

## Options considered

### Option A — A read-only mode of the same page, seen through the curator's pubkey, and an inline offer (chosen)
- The front door gains `read-only` for any row not mine, retiring `no-assistant` and `other-pubkey`.
- The detail page passes the sections one `curator` (`'mine' | 'other'`) and uses the curator's pubkey
  wherever it used the viewer's assistant. The items are judged from the curator's side.
- A small new component runs the offer on the read-only page: a words-first step, then the panel's endpoint
  call, Map composition and drift-guarded sign-and-publish helpers.
- **Pros.**
  - One page and one set of sections, so own and read-only views cannot drift.
  - The rules stay in the pure util.
  - The offer targets exactly the shared header this curation follows, with no dependence on the
    community listing.
  - After publishing, the page re-reads the Map and opens the list as mine, in place.
- **Cons.** The offer repeats the panel's add-then-sign sequence (about 40 lines). The helpers are reused;
  the sequencing is not. Recorded as debt.

### Option B — The offer links to the DList Curation panel
A link to TA Treasure Map with the panel opened and filtered to this list; the user presses Replace there.
- **Pros.** No new write flow.
- **Cons.**
  - The panel lists only the community relay's self-declared shared concepts, so a shared header held
    elsewhere offers no Replace.
  - Deep-linking a folded panel adds a parameter to a shipped page.
  - The user leaves the list and has to come back to see it open as theirs.

  Rejected.

### Option C — Extract the panel's sequence into a shared hook for both
- **Pros.** One sequence.
- **Cons.** It restructures a shipped panel whose suite pins its source (`dlist-curation-panel` S5/S6),
  which goes beyond AC-5. It is better done when story 5 adds Update's signing — a third caller.
  Recorded as the follow-up.

### Option D — A separate read-only page component
- **Cons.** It duplicates the four sections and their states, so own and read-only views would drift.
  Rejected.

### Option E — Keep lists closed without an assistant here
- **Cons.** It contradicts Planning-gate decision 2. Rejected.

## Decision

We chose **Option A**.

1. **The front door.**
   - `curatedDListAccess` returns one of `'checking' | 'signed-out' | 'bad-id' | 'map-error' | 'no-map' |
     'not-on-map' | 'ok' | 'read-only'`, with the row for both open states.
   - Precedence: `checking` (auth) → `signed-out` → `bad-id` → the Map states → `not-on-map` → `ok` /
     `read-only`.
   - `ok` when the effective row names the viewer's assistant. `read-only` otherwise — including with no
     assistant here, when nothing is mine.
   - `no-assistant` and `other-pubkey` are retired.
2. **The list page.**
   - Every row links to its detail page.
   - A row not mine keeps its badge ("another pubkey · `<short>`"). When the viewer has an assistant, its
     note "Opens read-only here." replaces "Only lists your own assistant curates open here."
   - With no assistant, the page line reads "You don't have a Tapestry Assistant on this instance, so you
     can view these lists here but not curate them." Per-row notes stay off, as today.
3. **The detail page's read-only mode.** Let `readOnly = access.status === 'read-only'` and `curatorPubkey =
   row.pubkey` (for `ok` that is the viewer's assistant). The header lookups run for both open states.
   - **The top of the page:**
     - Subtitle: "`<kind>:<d>` · curated by another assistant · `<short curator>`". Own lists are unchanged.
     - One line below it: "Read-only here: your Treasure Map names this assistant for the list, not your
       assistant on this instance." With no assistant: "Read-only here: your Treasure Map names this
       assistant for the list, and you don't have a Tapestry Assistant on this instance."
     - `describeCurationHeader(lookup.event, curatorPubkey)`: authorship is checked against the curator.
   - **`AssistantHeaderSection({ …, curator })`:**
     - title "Its assistant's DList header" for `other`;
     - authorship "Authored by the curating assistant · `<short>`" (its ⚠️ variant names the curating
       assistant);
     - `NOTE_SENTENCES['older-link']` becomes a function of `curator`. The `other` text is "It uses the
       older link type; only its own assistant can upgrade it." The `mine` text is unchanged;
     - the import is unchanged (gate decision 1).
   - **`SharedHeaderSection({ …, curator })`:** the can't-tell sentences say "its assistant's header" for
     `other`.
   - **`ItemsSection({ …, curator, listRelay, canCurateHere })`,** given `assistantPubkey = curatorPubkey`.
     Its "assistant" rows are the curator's items, and a candidate is a shared item the curator has not
     copied. For `other`:
     - the From label and the Author cell read "its assistant";
     - `UNAVAILABLE_REASON` reads "its assistant’s header…";
     - `itemsEmptySentence({ …, curator: 'other' })` begins "Its assistant hasn't added any items to this
       list yet."
   - **The method panel** renders only for `mine`. For `other`, one line takes its place: "The curation
     method is set where this list's assistant lives."
   - **`UpdateListButton({ curator, canCurateHere })`.** For `mine` it is unchanged. For `other` it is
     disabled, with "Update list runs only on the instance where this list's assistant lives." — plus " You
     can curate it here instead." when the offer is available.
4. **Where a read-only list's items are read.**
   - The curated list's own read uses the Map entry's relay hint when it is a ws/wss URL (the spec's element
     3), else the community relay.
   - The shared list's read stays at the community relay.
   - `ItemsSection` takes `listRelay` for the first read. Its source notes and relay-only markers name the
     relay each row's read used: `listRelay` for the curated list's rows, `communityRelay` for candidates.
   - Own lists pass the community relay, so they are unchanged (AC-5).
5. **The offer.**
   - **Availability** is pure: `curateHereOffer({ assistantPubkey, row, assistantLookup, info })` in
     `treasureMap.js` returns `{ status: 'available', target }` | `{ status: 'checking' }` |
     `{ status: 'unavailable', reason }`. Precedence:
     - `no-assistant` — no assistant here;
     - `kind` — the entry is not kind 39998;
     - otherwise, `sharedListUnavailable(assistantLookup, info)` decides. `checking` → `checking`;
       `failed` / `missing` / `no-pointer` / `deferred` → `unavailable` with that reason; null →
       `available`, with `target = info.pointer.coord`.
   - **The reasons' sentences.** Each begins "You can't curate it here" and ends:
     - `no-assistant`: ": you don't have a Tapestry Assistant on this instance."
     - `kind`: ": this instance curates only kind-39998 lists."
     - `failed`: " yet: its assistant's header couldn't be checked."
     - `missing`: ": its assistant's header was not found, so the shared list it curates is unknown."
     - `no-pointer`: ": its assistant's header names no shared list."
     - `deferred`: ": its assistant's header is marked deliberately unaffiliated."
   - **The component,** `CurateHereOffer`, renders on read-only pages between the read-only line and the
     first section:
     1. It starts as a button, "Curate it here instead", or as the reason's sentence.
     2. **Words** (§6), then [Continue] [Cancel]. No request is sent in this step.
     3. **Continue** POSTs `{ target }` to `/api/dlist-curation/header` — the panel's call. A 409 shows
        "Your assistant already has a header for this list with a different link; it was not changed.",
        then the existing `b` tags. Any other failure shows its message. Both stop the flow.
     4. **Review:**
        - "Header {authored | already existed} for `<d>` by your assistant.";
        - "Map update: replaces `<short curator>`'s entry for `39998:<d>` with your assistant @ `<hint>`.";
        - the preview toggle;
        - [Sign & publish] [Cancel].

        The update is `upsertDListEntry(mapEvent, 39998, row.d, assistantPubkey, relayHint)`, composed
        from the Map on screen. `relayHint` is `useConfig().aRelays?.aDListRelays?.[0] || ''`, as the
        panel reads it.
     5. **Sign & publish:** `getActiveSignerOrThrow()`, then `window.nostr.signEvent({ ...unsigned, pubkey
        })`, then `publishOrThrow(signed)`, then `onPublished()` — the Map's `refresh`. The page then
        resolves to `ok` and opens as mine. A failure shows its message and leaves the Map untouched.
     6. **Cancel** at any step clears the flow, and nothing further is sent.
6. **The words before a replacement.** A pure `replacementSentences(curatorShort)` in `treasureMap.js`
   returns two sentences:
   - "Your Treasure Map names one curating assistant per list: after this, your assistant here curates
     it, and `<curatorShort>` no longer does."
   - "That assistant's header and copies stay where they are."

   The offer adds a third: "Continuing has your assistant here write its own header for this list, if it
   has none; your Treasure Map changes only when you sign."
7. **The panel's Replace confirmation** (tension 2).
   - When the pending add replaces an entry naming another assistant, the Map-update line reads "Map
     update: replaces `<short>`'s entry for `39998:<d>` with your assistant @ `<hint>`.", followed by
     `replacementSentences(short)`.
   - A plain Add (no entry) still says "adds".
   - `handleAdd` records the replaced pubkey in `pending` (`byD.get(d)`, when not mine).
8. **Superseded in part.** Each gets a Status parenthetical and a one-line "Superseded in part" note, citing
   `curated-dlist-update` ADR 0003 by short name:
   - `my-curated-dlists` ADR 0001 — sub-decision 4's `no-assistant` and `other-pubkey` statuses, and the
     closed rows (read-only instead);
   - `dlist-curation` ADR 0005 — the Replace confirmation's words (§7).

## Consequences
- **Enables:**
  - row 267's recognition, end to end. Production's owner can open the staging-curated `dog-breed`
    read-only and move it here;
  - story 5 inherits the curator lens: Update acts for `mine`, and read-only stays disabled.
- **Constrains.** `curator` becomes a prop of the four sections. `curatedDListAccess`'s statuses change,
  and suites pin them. `replacementSentences` is shared by two surfaces.
- **Debt, recorded:**
  - the offer repeats the panel's sign-and-publish sequence (Option C, when story 5 adds a third caller);
  - own lists still read their items at the community relay, not the entry's hint. Story 5 publishes
    copies to the DList relays, so it should align this;
  - whether another pubkey is "my assistant elsewhere" stays unknown.
- **Security:**
  - no new endpoint; the offer goes through the endpoint's verified-session guard and the drift-guarded
    signer;
  - nothing is signed without the user's confirmation;
  - the read-only page writes nothing except the existing import.
- **Firmware reinstall required?** No — no concept definitions change.

## Implementation notes

1. **`ui/src/utils/treasureMap.js`**
   - `curatedDListAccess` (`:339–354`): drop the `no-assistant` early return, and return
     `verdict(row.mine ? 'ok' : 'read-only', row)`. Update its JSDoc.
   - New `curateHereOffer(input)` (§5) and `replacementSentences(curatorShort)` (§6), both pure and
     never throwing.
   - `itemsEmptySentence` (`:614`) accepts `curator` (§3).
2. **`ui/src/pages/grapevine/MyCuratedDLists.jsx`**
   - Every row renders a `Link` (`:103–105`).
   - The note (`:123`) becomes "Opens read-only here." (rows not mine, viewer with an assistant).
   - The no-assistant line (`:65–67`) per §2.
3. **`ui/src/pages/grapevine/CuratedDListDetail.jsx`**
   - `SENTENCES` loses `no-assistant` and `other-pubkey`.
   - Both open states render, and both header lookups run for them (`:45`).
   - `describeCurationHeader(lookup.event, row.pubkey)`.
   - The subtitle and the read-only line (§3).
   - `curator` goes to the sections, and `<CurateHereOffer>` renders in read-only mode (props: `row`,
     `assistantPubkey`, `mapEvent={map.event}`, `onPublished={map.refresh}`, and the offer from
     `curateHereOffer`).
   - The method panel renders for `mine`, else the one line.
   - `ItemsSection` gets `assistantPubkey={row.pubkey}`, `curator`, `canCurateHere`, and `listRelay`:
     the row's ws/wss hint in read-only mode, else `COMMUNITY_RELAY`.
4. **`ui/src/pages/grapevine/CuratedDListHeaders.jsx`**
   - Both sections take `curator` (default `'mine'`), with titles, authorship and can't-tell sentences per
     §3.
   - `NOTE_SENTENCES['older-link']` is keyed by `curator`, and the `mine` text is unchanged.
5. **`ui/src/pages/grapevine/CuratedDListItems.jsx`**
   - `ItemsSection({ …, curator = 'mine', listRelay, canCurateHere })`, with the labels per §3.
   - `listRelay` feeds the first `useListItems` and its notes and markers; candidates keep `communityRelay`
     (§4).
   - `UpdateListButton({ curator, canCurateHere })`.
6. **`ui/src/pages/grapevine/CurateHereOffer.jsx`** (new) — §5's flow.
   - Imports: `upsertDListEntry` and `replacementSentences` (util), `getActiveSignerOrThrow`
     (`../../utils/signerGuard`), `publishOrThrow` (`../../utils/publishProfileTag`), and `useConfig`
     (`../../context/ConfigContext`).
   - It writes only through the endpoint and the Map publish, and only after Continue or Sign & publish.
7. **`ui/src/pages/grapevine/DListCurationPanel.jsx`** (§7) — `pending.replaces` set in
   `handleAdd`; the confirmation line and sentences (`:283`).
8. **ADR annotations** (§8):
   - `engineering-team/decisions/done/my-curated-dlists/0001-my-curated-dlists-page.md`;
   - `engineering-team/decisions/done/dlist-curation/0005-dlist-curation-panel.md` (§7).
9. **Local check (cycle-local).** The container is not bind-mounted, so copy the UI build in. With the
   fetch stub, sign in as staging's customer, whose real Map names `253d40c4…` for `dog-breed`:
   - with `assistantPubkey` set to another key (for example, this instance's TA), the list opens
     read-only, with the offer;
   - with `assistantPubkey: null`, it opens read-only, with the reason and no offer.

   Check the words, and open the offer to its words step. Never press Continue with a real session — it
   signs a header. Under the stub, the endpoint answers 401, which exercises the error path.

**Testable seams (the Tester's call, Phase 3):**
- `curatedDListAccess`:
  - returns `read-only` for a row naming another pubkey, and for any row when the viewer has no assistant;
  - the other statuses and their precedence are unchanged;
  - `no-assistant` and `other-pubkey` are never returned.
- `curateHereOffer`: each reason, and their precedence; `available`, with the pointer's coordinate as the
  target.
- `replacementSentences` with a short pubkey; `itemsEmptySentence` with `curator: 'other'`.
- **Structural:**
  - every list row links, with the notes;
  - the detail page's two modes: the sections get `curator`; there is no method panel when read-only; it
    calls `describeCurationHeader(…, row.pubkey)`;
  - the offer: no fetch before Continue; the endpoint POST carries `{ target }`; it calls
    `upsertDListEntry(…, 39998, …)`, then `getActiveSignerOrThrow` and `publishOrThrow`; it refreshes on
    success;
  - the headers and items label variants;
  - the read-only older-link note does not say "Update list";
  - `UpdateListButton`'s read-only line;
  - `listRelay` feeds the curated list's read;
  - the panel's replace wording (§7).
- The re-aims of the four suites listed in Context.

Regression is the full `npm test`. Known reds: OPEN.md rows 191 and 261. Run single suites through
`require('./test/<name>.test.js').run()`, never `node` on the file.

## Out of scope
- Update (story 5) and the method's controls (story 4).
- Consolidating the sign-and-publish sequence (Option C).
- Reading own lists' items at the entry's relay hint.
- Telling whether another pubkey is the viewer's assistant on another instance.
- Curating kind-39999 lists here; any endpoint change.
- Offering the move from the list page.

## Amendment 1 — the offer checks its target, and the page's writes are counted (2026-09-12)

**Why.** Story 3's review (`engineering-team/reviews/curated-dlist-update/3-another-assistants-curation-read-only.md`,
Non-blocking 1 and 2) found two gaps. The operator chose to close both before the book merges.
- **§5 checks that the curating header names *a* pointer, but not *which*.**
  - The endpoint authors the viewer's assistant's header under the pointer's d-tag
    (`src/api/dlist-curation/index.js:107–109`). The Map update, though, addresses
    `39998:<my assistant>:<row.d>` (§5, step 4).
  - Take a curating header that breaks the spec's "`d` equal to the d-tag of the community header it
    curates" (`protocols/drafts/assistant-designation.md:70`). The user would sign a Map entry addressing a
    header that does not exist — against "A writer MUST publish the header before the Map entry that
    addresses it" (`:74`).
  - A pointer at any kind but 39998 is offered, then refused by the endpoint's kind check
    (`index.js:256–258`) after the words.
  - Every header Tapestry writes conforms, but the page reads signed events from anyone.
- **The page's writes were miscounted.** `my-curated-dlists` ADR 0002 still says the detail page performs
  one write (`:109`, `:144` today), and §8 did not list that ADR. This ADR's own Consequences say "the read-only
  page writes nothing except the existing import", which §5 contradicts.

**Change.**
1. **§5 — availability gains a target check.** After the header's states, `curateHereOffer` returns
   `{ status: 'unavailable', reason: 'target' }` unless `info.pointer.kind === 39998 && info.pointer.d ===
   row.d`.
   - The precedence becomes `no-assistant` → `kind` → the header's states (`checking`, then `failed` /
     `missing` / `no-pointer` / `deferred`) → `target` → `available`.
   - A conforming header is unaffected — every one Tapestry writes, and the live `dog-breed` curation.
2. **§5 — the new reason's sentence**, in the house form: "You can't curate it here: its assistant's header
   doesn't point at a kind-39998 list with the same d-tag."
3. **§8 — two more superseded-in-part notes,** for the page's "single write": `my-curated-dlists` ADR 0002
   (`:109`, `:144`) and ADR 0003 (its AC-6 and Decision, `:24`, `:96` — added after story 3's review round
   2, R2-1). On a read-only list the offer adds two writes, each on an explicit click: the viewer's
   assistant's header on Continue, and the viewer's Map on Sign & publish.
4. **Consequences, Security — read the third bullet as** "the read-only page writes only on explicit clicks:
   the existing import, and the offer's two writes (§5)".

**Implementation notes (Amendment 1).**
- `ui/src/utils/treasureMap.js` `curateHereOffer`: the target check after `sharedListUnavailable`, and its
  JSDoc's precedence.
- `ui/src/pages/grapevine/CurateHereOffer.jsx`: `REASON_TAILS.target`.
- `engineering-team/decisions/done/my-curated-dlists/0002-the-two-headers.md`: extend the Status parenthetical
  ("…; the page's single write by `curated-dlist-update` ADR 0003"), and add a one-line "Superseded in part
  (2026-09-12)" note citing `curated-dlist-update` ADR 0003 by short name.
- `engineering-team/decisions/done/my-curated-dlists/0003-items-method-and-update.md` (R2-1): the same Status
  parenthetical and note.
- The story's § Deviations records the follow-up.

**Testable seams (Amendment 1).**
- `curateHereOffer`:
  - a pointer of another kind (`39999:<author>:dog-breed`) → `target`;
  - a kind-39998 pointer with another d-tag (`39998:<author>:dogs`) → `target`;
  - a header state still outranks `target`;
  - a conforming pointer is still `available`.
- Structural: the `target` sentence in `CurateHereOffer.jsx`.
- Docs: `my-curated-dlists` ADR 0002's note, citing ADR 0003 by short name.
