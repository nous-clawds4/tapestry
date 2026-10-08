# After Save finds a newer Map, focus can fall to the page body

**Id:** 2026-10-08-treasure-map-focus-after-newer-map
**Type:** bug
**Opened:** 2026-10-08 (treasure-map-edit #5 review, round 2, non-blocking 1)
**Status:** OPEN
**Done:** —

**What was seen.** When Save finds a newer Map (book decision 19), the page shows it with the changes on top and
puts focus back on **Save changes** (story 5 AC-10). In two cases there's no button to land on, so focus falls to
`<body>`:
- **The newer Map already holds the change.** Save is then off (AC-1), yet the alert still says "check them and save
  again".
- **The newer Map names an Assistant** that is neither in the old Map nor one of the person's. The section shows the
  loading line while the name is looked up, which unmounts **Save changes**.

Both are rare. A keyboard or screen-reader person then has to find their place again.

**Fix shape.**
- When Save is off after "changed", focus the alert or the Edit button.
- Have the names-ready rule (story 5 § Deviations) also count Assistants the newer Map names, or keep the save bar
  mounted while names load.
- Add a browser test for each case.

**Pointer:** `engineering-team/reviews/done/treasure-map-edit/5-save-the-edited-map.md` § Round 2, Non-blocking 1;
`ui/src/pages/treasure-map/Index.jsx` (the focus effect in `CategoryCards`, and the names-ready rule).
