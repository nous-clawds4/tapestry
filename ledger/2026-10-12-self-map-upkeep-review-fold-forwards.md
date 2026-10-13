# Story 5's review left four spec wording gaps, two older Spawning and Assistant Designation lines, and the epic's story-5 entry

**Id:** 2026-10-12-self-map-upkeep-review-fold-forwards
**Type:** protocol
**Opened:** 2026-10-12 (`duty-menus-and-self-maps` #5 review, non-blocking findings 1–4 and 6–7)
**Status:** OPEN
**Done:** —

Story 5 (the rules that keep a self-Map true) passed review. None of the items below changes a rule. In each case
the normative text nearby, or the citation's own words, leads a careful reader to one answer. Items 1–5 are for the
docs pass after book `duty-menus-and-self-maps`. Item 6 is for the PO, before or at that book's `/close-book`.

1. **The marker's meaning is pinned to the `d` alone** (review NB1). `protocols/drafts/trusted-lists.md`:75–78 says a
   publisher "stops maintaining a list at its `d`" and that the marker "means only that the list is no longer
   maintained there". One reason the same sentence gives, "migrates it off a kind", keeps the `d`: the Migration note
   (:148–150) retracts the legacy `30393` lists "at the same `d` tags", and the list goes on at that `d` on `30394`.
   Spawning § 4's `status` row (`spawning.md`:160) and Trusted Lists' ADR 0005 Sources clause (:8–9) repeat "at its
   `d`". *Ask:* "at its address (its kind and `d`)" in all three.
2. **§ 9.2's What follows a stop, the lead's set** (review NB2). `treasure-maps.md`:405 says a reader that sees the
   change no longer takes as confirmed or maintained "the insights that no remaining self-entry of the key wins and
   speaks for". The paragraphs it cites (Confirmed duties :417, Maintained :419) and the third case (:429) make that
   judgment the reader's: "that the reader takes to speak for it" (What a reader can tell). *Ask:* "…wins and that
   the reader takes to speak for (What a reader can tell)".
3. **§ 13 question 13's "(principle 3)"** (review NB3). `treasure-maps.md`:657 cites
   `[Spawning](./spawning.md)'s two gates (principle 3)`. Elsewhere in Treasure Maps a bare "(principle N)" is
   Treasure Maps' own (:344, :353, :405), whose principle 3 has no gates. *Ask:* "Spawning's two gates (Spawning § 1,
   principle 3)".
4. **Spawning § 5's Hand-off and Retire for a § 3.6 Concept** (review NB6). `spawning.md`:170 ("The old one
   retracts") and :171 ("retract in place") are written for Lists. For a curated Concept (§ 3.6) no retraction
   convention exists, and Assistant Designation keeps the header, its `b` and, since story 5, the copies at a stop
   (§ Curation copies, When curation stops; Revocation). The header part predates story 5. *Ask:* say that a
   Concept's Hand-off and Retire follow Assistant Designation § Curation copies, When curation stops.
5. **Assistant Designation's Deployment status** (review NB7). `assistant-designation.md`:177 (not normative) still
   says "nothing copies items yet (stories 3–5)". The shipped curation code makes `copy-` items
   (`src/api/dlist-curation/updateEvents.js`:50–52). *Ask:* update the sentence with the doc pass.
6. **The epic's story-5 entry never recorded the owner's answers** (review NB4).
   `engineering-team/epics/duty-menus-and-self-maps.md`:42 still ends "The owner decides at approval, and this entry
   then records the answers to the story's open questions 2, 4 and 5". The approval commit `7ab2c955` touches only the
   story file, and the story's Approval paragraph says the PO commits the epic with it. Story 5's AC5 gives epic edits
   to approval, so no later phase made them. The answers are in the story (Open questions) and in ADR 0005's
   Context. *Ask (PO):* replace that sentence with the answers: 2(a), a maintained List with no members is never
   marked and a marked List is never a copy (revising ADR 0003 A2-1, ADR 0005 sub-decisions 4 and 9); 4(a), the two
   late items and row `2026-10-12-key-grammar-review-fold-forwards` items 1–5 rode in story 5; 5(a), the two
   `protocol` rows go to a docs pass after the book. The frame does not change.

**Pointer:** review `engineering-team/reviews/done/duty-menus-and-self-maps/5-self-map-upkeep.md` § Findings, non-blocking;
ADR `engineering-team/decisions/done/duty-menus-and-self-maps/0005-self-map-upkeep.md`; story
`engineering-team/stories/done/duty-menus-and-self-maps/5-self-map-upkeep.md`; related rows
`2026-10-12-addressable-kinds-spawning-content-categories` and `2026-10-12-bare-39998-ta-discovery` (the same docs
pass).

**Note, 2026-10-13 (PO, after story 5's review).** Item 6 is done: the epic's story-5 entry now records the
owner's answers to questions 2, 4 and 5 and that the frame did not change, in the commit "story: epic records
story 5's owner answers (duty-menus-and-self-maps #5)". The row stays OPEN for items 1–5.
