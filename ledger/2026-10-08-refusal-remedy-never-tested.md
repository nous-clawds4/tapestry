# A guard that refuses names a remedy, and nothing checks that the remedy clears it

**Id:** 2026-10-08-refusal-remedy-never-tested
**Type:** meta
**Opened:** 2026-10-08 (treasure-map-edit #5 review, round 1, harness friction 1)
**Status:** OPEN
**Done:** —

**What was seen.** treasure-map-edit #5's Save refuses when a newer Treasure Map has appeared since the page read it,
and says "Reload the page to see the new one" (book decision 17, ADR 0005). The newer-Map check reads this instance's
relay and the outside relays, newest first. The page shows this instance's relay's Map whenever it has one. So when only
an outside relay holds the newer Map, the reload shows the same old Map, and the next Save is refused again, for good.
One way in is the app's own allowed outcome: a save that only outside relays accepted.

The test plan drove the refusal (SV4), but never the reload it asks for, and the ADR's two read paths were never set
side by side. The review found it hands-on (Blocking 1).

This is adjacent to `2026-09-22-rule-stories-need-bypass-probing`, which is about getting *around* a rule. This one is
about getting *past* a refusal the way it tells you to.

**Fix shape.**
- Any story whose guard refuses with a remedy ("reload", "sign in again", "try later") has a test plan that drives the
  remedy once and checks the guard then lets the person through.
- An ADR that adds a guard reading state names the read the page itself shows, and says when the two can disagree.

A line in `engineering-team/workflows/3-test-design.md` § Common pitfalls would carry the first.

**Pointer:** `engineering-team/reviews/done/treasure-map-edit/5-save-the-edited-map.md` § Findings, Blocking 1, and
§ Harness friction 1.
