# The self-Map page spells some tag-key duty lines as a Profiles-category key, and misses an elsewhere line beside them

**Id:** 2026-10-12-self-map-profiles-category-lines
**Type:** bug
**Opened:** 2026-10-12 (book `assistant-self-map`, review of story 1 round 2, finding R2-N2)
**Status:** OPEN
**Done:** —

**What happens.** `dutyLines` in `src/lib/self-map/index.js` names a family key's line by its meet with one kind. Under
Treasure Maps § 4.4 as ADR `duty-menus-and-self-maps/0004` settled it, an empty category followed by a value, in a
`30392` or `30382` `tag` or `pin` key, is the Profiles category, not *any*. So:
- a viewer entry `3039x:tag::⟨X⟩` shows a line keyed `30392:tag::⟨X⟩`, which now names only the Profiles list, though
  the part spans every category. Duty Menus § 6.2 step 4 says such a meet "has no key";
- a more specific `30392:tag:⟨D⟩:⟨X⟩` naming another key shows no `elsewhere` line, though § 6 gives that list to it.

**Impact.** Display only. These keys are `unchecked` (ADR `assistant-self-map/0001`), so the check never claims them.

**Fix shape.** Show the viewer's own key for a meet that lands on the Profiles spelling, and match tag keys by § 4.4's
reading when looking for `elsewhere` keys. Each with a test.

**Pointer:** `engineering-team/reviews/assistant-self-map/1-the-self-map-page-and-its-check.md` § Round 2, R2-N2.
