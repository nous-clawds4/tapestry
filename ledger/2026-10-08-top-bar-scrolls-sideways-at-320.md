# At 320 px the Brainstorm top bar pushes /treasure-map and /assistants sideways while the Assistant pill shows

**Id:** 2026-10-08-top-bar-scrolls-sideways-at-320
**Type:** bug
**Opened:** 2026-10-08 (treasure-map-edit #3 review, round 2, non-blocking 2)
**Status:** OPEN
**Done:** —

**What was seen.** At 320 px, with the Assistant pill showing, the avatar menu (`.bs-usermenu`,
`ui/src/components/BrainstormUserMenu.jsx`) ends at x = 344, so the page scrolls sideways by 24 px. The review measured
it on the built UI with every `/api` route mocked. It happens:
- on `/treasure-map`, with Edit on and off, on both story 3 builds (round 1's and round 2's);
- on `/assistants`.

Nothing scrolls at 360 px or wider. It isn't treasure-map-edit's code: the top bar comes from the design shell.

**Why no test caught it.** `tests/brainstorm/assistant-alert.spec.js` B9 checks from 320 to 1280 px that no top bar
scrolls sideways with the pill showing, but on other pages, not on `/treasure-map` or `/assistants`.

This is a different bug from `2026-09-22-tapestry-header-covers-content`, which is about the control panel's fixed
header on `/tapestry` pages.

**Fix shape.** Let the top bar's right-hand group shrink at the narrowest widths, for example by shortening the pill
or letting its label truncate. Then extend B9, or the page's own 320 px check, to `/treasure-map` and `/assistants`.

**Pointer:** `engineering-team/reviews/done/treasure-map-edit/3-edit-mode-assign-and-preview.md` § Round 2, Findings
(round 2), non-blocking 2.
