# Story 4's review left non-blocking wording gaps in Treasure Maps and Duty Menus, for the PO to place

**Id:** 2026-10-12-key-grammar-review-fold-forwards
**Type:** protocol
**Opened:** 2026-10-12 (`duty-menus-and-self-maps` #4 review, non-blocking findings 1–6)
**Status:** OPEN
**Done:** —

Story 4 (the Treasure Maps key grammar) passed review. Its non-blocking findings 1–5 are wording and metadata gaps
that story 4's changes left behind, or made easier to misread. None changes a rule. In each case the normative text
nearby gives a careful reader one answer. The PO places the row: story 5 of `duty-menus-and-self-maps`, which edits
both specs, or a later docs pass. It is kept apart from row `2026-10-12-self-maps-spec-fold-forwards` so that story 5
can still close that row as the book's frame bullet 6 says. Line numbers are as of `05954589`.

1. `treasure-maps.md` § 11, "How many colons?" (:606). "Fewer segments, or an empty one, makes a scope" is not true
   of the Profiles category: `30392:tag::⟨Podcaster⟩` is exact (§ 4.4, :186). "The same for every kind" leaves out
   Concept keys, which have no system and whose `d` may hold colons (§ 4.5). KB-2 fixed the same claim in At a glance
   (:39). Give § 11 KB-2's exceptions, or fold it with principle 8's gloss (review NB1).
2. `duty-menus.md` § 5.2 (:113). "The key does not offer the insights under this key" glosses a `not-offered` row per
   row, while § 2's Offered is now per insight (:50): with `not-offered 30385` and `duty 30385:rank`, the rank
   insights are offered. Write "An exception: the insights this row wins (§ 6.2) are not offered" (review NB2).
3. `treasure-maps.md` § 10.5, `30382:tag:::<metric>` (:506). "My supported Tags for profiles" sits two rows below
   :500 and :503, where "each category of profiles" means the Profiles category and DLists of people. The key matches
   the Profiles category only. Write "…for each Tag in my supported Tags in the Profiles category, except where this
   Map says otherwise", as :504 reads (review NB3).
4. `treasure-maps.md` § 4.3, Addressable kinds (:164). "Content Categories (its table of category types, and § 4)"
   could mean any of three CC tables: the opening table (:19–24, the one meant), § 2's list-kind table (:79–86) or
   § 3.1. Write "its opening table of the four category types". This may ride with row
   `2026-10-12-addressable-kinds-spawning-content-categories` instead (review NB4).
5. `duty-menus.md` Sources line (:6), ADR 0003's clause. It leaves out § 9's pointer to Treasure Maps § 9.2
   (Counting Maps), which came with the owner's NB14 fold under ADR 0003 A2 (`fe163bc0`), and names Amendment A1 only.
   Write "ADR 0003 with Amendments A1 and A2 (… § 7's own-Assistant exception, § 9's Counting Maps pointer, § 10 and
   § 14 follow)". The self-maps row's new Sources-line item (:67–68) says Duty Menus' line "lists every section
   touched", which holds for its ADR 0004 clause only (review NB5).
6. *Placement only.* `05954589` added two items to row `2026-10-12-self-maps-spec-fold-forwards` (:62–68),
   principle 8's gloss and the Treasure Maps Sources line against At a glance, "for story 5 or a later docs pass". The
   owner's frame bullet 6 and the epic's story-5 entry list story 5's items and close that row with it. The PO may move
   the two items here, so that story 5 can close that row, or take them into story 5 with the owner's OK (review NB6).

**Pointer:** `engineering-team/reviews/duty-menus-and-self-maps/4-treasure-map-key-grammar.md` § Findings,
non-blocking 1–6; ADR `engineering-team/decisions/duty-menus-and-self-maps/0004-treasure-map-key-grammar.md`
(Clarifications after acceptance, KB-2); related rows `2026-10-12-self-maps-spec-fold-forwards` and
`2026-10-12-addressable-kinds-spawning-content-categories`; book `engineering-team/audits/duty-menus-and-self-maps/book.md`
frame bullet 6.
