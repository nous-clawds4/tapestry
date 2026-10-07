# The Treasure Map cards' counting rule mis-scores three draft-grammar edge cases no Map writes today

**Id:** 2026-10-07-treasure-map-card-rule-edge-cases
**Type:** bug
**Opened:** 2026-10-07 (manage-treasure-map #2 review 1, non-blocking 1–3)
**Status:** OPEN
**Done:** —

`categoryAssistants` (`ui/src/pages/treasure-map/manageTreasureMap.js`, ADR manage-treasure-map/0002 sub-decision 2)
follows the story's enumeration literally. Against the draft grammar (`protocols/drafts/treasure-maps.md` §4.3, §4.7,
§6) it differs in three cases that nothing in the app writes today:

1. **Prefix shadowing.** A `*:<rest>` entry is shadowed only by an exact `3038x:<rest>` (or `3039x:<rest>`). With
   `3038x:tag` → B and `*:tag:<X>` → D, Scores reads Mixed (B, D), though under §6 D reaches no Score. A trailing
   empty segment (`3038x:tag:`) has the same gap.
2. **System words by family.** `*:rank` (`rank` is a Score metric, §4.7, so it reaches only Scores) counts on Lists, and `*:contexts` (Lists-only,
   §4.3) counts on Scores.
3. **Two spellings of one key.** `39998` and `39998:dlist-header` (and `*` and `*:`) count as separate keys, so both
   first Assistants count.

**Fix shape.** Compare keys segment by segment as §6 does (a covering entry is a prefix of the shadowed one in the
system and category segments), apply the system words' family limits, and normalise the two legacy spellings, with
Node cases for each. Worth doing before the Edit book reuses `categoryAssistants` to preview assignments. If the draft
grammar is ratified first, fold this into the single parser ADR 0002's Consequences anticipates.

**Pointer:** `engineering-team/reviews/manage-treasure-map/2-the-assistants-by-category-cards.md` § Findings,
non-blocking 1–3.
