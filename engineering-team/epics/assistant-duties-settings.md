# Epic: assistant-duties-settings — the duties this instance offers, set by its Owner

**Status:** Done (book closed 2026-10-12; the folders sit under `done/`)
**Created:** 2026-10-12
**Book:** `engineering-team/audits/assistant-duties-settings/book.md` (no PRD — acceptance frame)
**Provenance:** the owner's ask of 2026-10-12, quoted verbatim in the book and settled through seven questions at
intake (book § Decisions).

## Goal

**Let the Owner or an Admin choose the duties every Assistant on this instance offers.** Today the six duties on
every Duty Menu (Scores `30382`; Lists `30392`–`30394`; Concepts `39998`, `39999`) are fixed in code. This epic moves
them into the instance's settings, with today's six as the defaults, and adds an Assistant Duties tab on the Settings
page where the Owner or an Admin adds, removes, orders and points each duty at a relay.

## Stories

`stories/assistant-duties-settings/`.

1. `1-the-assistant-duties-tab.md`: the tab, the saved list with its defaults, and every Assistant's Duty Menu
   offering what the list says.

## Key facts / guardrails

- **Instance configuration, not a gate.** The list is what *this* instance's Assistants offer. It gates no one else's
  events and no one else's menus (CLAUDE.md principle 2). It is not graph state (principle 4).
- **Offered, never active.** A Duty Menu says what an Assistant offers, not what it is doing
  (`protocols/drafts/duty-menus.md` § 1). By the owner's choice (book Decision 1), an added duty may be one this
  instance does not yet publish.
- **Cross-book.** Your Assistant's Treasure Map (`assistant-self-map` #1) reads the same offer. See the book § Found
  at intake.
