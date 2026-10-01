# Blueprint extract: the My Assistants screen

The owner named a Claude Design artifact as the blueprint for this book (2026-09-30):
https://claude.ai/artifact/SiFE8XoAbC3KH5TQbG4Y8m. That artifact is a live design and can change,
so this folder keeps the parts this book builds from, as they stood in the version read at intake
(`1790680640-925e`).

The artifact is a bundled page. Its screens are one design-component template, and each screen's
values come from a script. Neither file here runs on its own. They are reference, saved as `.txt`
so no tool mistakes them for code in this repo.

| File | What it holds |
|---|---|
| `my-assistants-screen.html.txt` | The "My Assistants" screen's markup: both tabs, the rows, the expanded panels, the empty states and every word on the screen. |
| `my-assistants-logic.js.txt` | The account-menu entry, the design's sample-data constants for this screen, and the two functions that fill the screen: `maVals` (Assistants tab) and `mdVals` (Duties tab). |

The design's data is sample data. Names such as "Alice's …", the pubkeys and the Treasure Map
entries are illustrations, not real profiles.
