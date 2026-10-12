# Four shipped readers take some Concept keys otherwise than Treasure Maps §§ 4.5, 4.6 and 6: the /treasure-map card rule, its editor, the Dictionary entry page and the My Assistants duties list

**Id:** 2026-10-12-treasure-map-concept-key-readers
**Type:** bug
**Opened:** 2026-10-12 (`duty-menus-and-self-maps` #4, ADR 0004 sub-decision 11)
**Status:** OPEN
**Done:** —

Story 4 of `duty-menus-and-self-maps` settled the Treasure Maps key grammar (ADR 0004). A bare `39998` covers every
Concept header, those declared as kind-39999 items included; a bare `39999` covers the headers declared as kind-39999
items; and a `39999` key beats a bare `39998` in § 6. A Concept kind and a colon alone (`39998:`, `39999:`) is not a
key (§ 4.5). No key reaches a Concept header whose `d` is `dlist-header`, so `39999:dlist-header` names no Concept, as
`39999:duty-menu` names none (§ 4.6). Four shipped readers take some of these keys otherwise. Story 4 changed no
code; the code books follow the answers.

- **Created by story 4.**
  - `entryOf`/`appliesTo` (the card rule, `src/lib/treasureMapCategories.mjs`) count an entry keyed `39998:`, `39999:`
    or `39999:dlist-header` for Concepts. That reaches the card, its details and the server's check
    (`categoryAssistants`, `src/api/assistant/trustedContent.js`).
  - `roleOf` (`ui/src/pages/treasure-map/editTreasureMap.js`) lists a `39998:` entry as an individually assigned
    Concept duty, which the override switch removes. Only a hand-written Map, or another client's, reaches this, since
    the editor writes the bare kinds.
  - `conceptCurator` (`ui/src/utils/treasureMap.js`, shown on the Dictionary entry page,
    `ui/src/pages/dictionaries/ConceptEntry.jsx`) gives a header declared as a kind-39999 item to the blanket
    `39998:dlist-header` entry, where § 6 gives it to a `39999` entry (Case A: with `["39998:dlist-header", TA]` and
    `["39999", B]`, it names TA, where § 6 names B).
  - `classifyEntry` lists `39999:dlist-header` as a per-DList entry, which the My Assistants duties list
    (`treasureMapDuties`, `ui/src/pages/assistants/myAssistants.js`) shows as the duty "Curated DList: dlist-header".
    That list shows no duty for a bare `39999`.
- **Older.**
  - `conceptCurator` ignores a bare `39998` (§ 4.5's legacy spelling) and falls back to the local Assistant (Case B,
    the editor's bare kinds).
  - The card rule counts `39999:duty-menu` (§ 4.6).
  - `classifyEntry` lists `39999:duty-menu` as a per-DList entry, which `treasureMapDuties` shows as the duty "Curated
    DList: duty-menu", and `findDListEntries` keeps it.
  - `readMenuRows` (`src/lib/duty-menu/index.js`) drops a `duty` row whose relay is not `ws://`/`wss://`, which the
    spec keeps.
  - `treasureMapDuties` shows no duty for a bare `39998`.
- **What already agrees:** a bare `39998` hiding `*` on the Concepts card (1(a)); a bare `39999` not hiding it;
  trimming `30392:tag::` (4(a)); `readMenuRows`, which ignores `39998:`/`39999:` rows and drops an empty-relay row
  before the duplicate check (finding 17); and `findDListEntries` in ignoring `39998:` and `39999:dlist-header` (not
  `39999:duty-menu`, above). No other reader was checked.
- Book `assistant-self-map`'s "Provisional key grammar" line (`engineering-team/audits/assistant-self-map/book.md`) is
  now settled.
- **Fix shape:** `entryOf` returns null for exactly `39998:` or `39999:`; `appliesTo` leaves out `39999:dlist-header`
  and `39999:duty-menu`; `conceptCurator` follows § 6 for the bare kinds; `classifyEntry` and `findDListEntries` leave
  out `39999:dlist-header` and `39999:duty-menu`, and `treasureMapDuties` reads the bare kinds as § 4.5 does; each with
  a test.

**Pointer:** ADR `engineering-team/decisions/duty-menus-and-self-maps/0004-treasure-map-key-grammar.md` (Context,
"Shipped code that reads these keys"; sub-decision 11; Consequences, Shipped code; Verification V22, V24 and V25);
`protocols/drafts/treasure-maps.md` §§ 4.5, 4.6 and 6; ledger row `2026-10-12-duty-menu-code-cross-book-notes`; book
`assistant-self-map`.
