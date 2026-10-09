# Blueprint extract: the Manage your Treasure Map screen

The owner named a Claude Design artifact as the blueprint for this book (2026-10-07):
https://claude.ai/artifact/SiFE8XoAbC3KH5TQbG4Y8m ("Brainstorm onboarding flow design", the same artifact the
my-assistants book built from). That artifact is a live design and can change, so this folder keeps the parts this
book builds from, as they stood in the version read at intake (`1791333324-4c16`).

The artifact is a bundled page. Its screens are one design-component template, and each screen's values come from a
script. None of the files here runs on its own. They are reference, saved as `.txt` so no tool mistakes them for code
in this repo.

| File | What it holds |
|---|---|
| `treasure-map-screen.html.txt` | The "Manage your Treasure Map" screen's markup: heading, introduction, FAQ, the "Assistants by category" cards (with their edit controls), the raw Treasure Map viewer and its "No Treasure Map found" state, and the Advanced management link. Every word on the screen. |
| `treasure-map-logic.js.txt` | The design's sample-data constants for this screen (`TM_CATCH_ROWS`, `TM_CATCH_DEFAULT`, `MA_LOCAL`, `MA_POOL`, `TMK_KINDS`, `TMB_CAT_KEYS`, `TMB_FAQS`), the methods that read the Map's entries (`tmbConflicts`, `tmbPendDel`, `tmEntries`, `tmRaw`), and the screen's `tmb*` render values. |
| `advanced-screen-header.html.txt` | The top of the "Treasure Map — Advanced" screen only (breadcrumb, kicker, heading, introduction). This book builds that page as a placeholder; the rest of the screen is a later book's. |

The design's data is sample data. Names such as "Alice's …", the pubkeys and the Treasure Map entries are
illustrations, not real profiles.
