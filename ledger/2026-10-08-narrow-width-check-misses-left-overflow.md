# "No sideways scroll" was the whole 375 px check, and it can't see content pushed off the left edge

**Id:** 2026-10-08-narrow-width-check-misses-left-overflow
**Type:** meta
**Opened:** 2026-10-08 (treasure-map-edit #3 review, harness friction 2)
**Status:** OPEN
**Done:** —

treasure-map-edit #3's ADR and test plan made one check stand for the whole 375 px case (E16): `scrollWidth −
clientWidth` is 0. Below about 440 px, the All duties list was anchored to the right edge of a button that had wrapped
to the left. So the list hung 148 px off the left edge of the screen, and every name in it was cut off. The page still
had no sideways scroll, because content pushed off the *left* edge never adds scroll width, so E16 passed. Story 1's
T12 had checked element bounds ("ends inside the viewport"), which would have caught it. The review found it by eye and
by measuring.

**Fix shape.** Add a line to `engineering-team/workflows/3-test-design.md` § Common pitfalls: a narrow-width check
asserts each positioned or popped-over element's bounding box lies inside the viewport (`x ≥ 0`, `x + width ≤ vw`), in
every state that moves it, not only that the page doesn't scroll sideways.

**Pointer:** `engineering-team/reviews/done/treasure-map-edit/3-edit-mode-assign-and-preview.md` § Findings, Blocking 1, and
§ Harness friction 2.
