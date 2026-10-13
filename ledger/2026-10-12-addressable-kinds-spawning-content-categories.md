# Spawning § 3.2 and Content Categories read "addressable" as NIP-01 does, and Spawning spawns one List kind for category `39998`, where Treasure Maps § 4.3 now differs

**Id:** 2026-10-12-addressable-kinds-spawning-content-categories
**Type:** protocol
**Opened:** 2026-10-12 (`duty-menus-and-self-maps` #4, ADR 0004 sub-decision 11; the owner's answer 3(a) to the ADR's open question 3)
**Status:** OPEN
**Done:** —

Story 4 of `duty-menus-and-self-maps` settled two things in Treasure Maps § 4.3 (ADR 0004 sub-decision 6). There an
*addressable* event kind is one whose events NIP-01 references by address: `30000`–`39999`, and the replaceable kinds
`0`, `3` and `10000`–`19999`, so `3039x:tag:10002` matches `30394` lists only. And category `39998` takes three List
kinds, `30393`, `30394` and `30397`, as Content Categories § 2 gives them. § 4.3 names its departure from the texts
below, which lie outside story 4's scope (its AC6):

- `protocols/drafts/spawning.md` § 3.2, the "event kind k (non-addressable)" row (:64), gives a replaceable kind
  `30393`, a key that matches nothing under § 4.3 (ADR 0004 V16). An Assistant that follows it publishes a list no Map
  key reaches.
- The same table's *DList headers* row (:68) spawns `30397` only, while `3039x:tag` asks for three List kinds in
  category `39998`. An Assistant that follows it cannot keep a `3039x:tag` or `*` self-entry while (T, `39998`) is
  supported: the self-entry would win `30393` and `30394` lists it does not publish (Treasure Maps § 9.2, A part A
  does not publish; ADR 0004 V17).
- `protocols/drafts/content-categories.md` :23 and :193 reference an event "by `e`, or `a` if addressable", in
  NIP-01's narrower sense.

**Fix shape:** point the first and third at Treasure Maps § 4.3. The second asks what an Assistant spawns for
(T, `39998`) under its support gate, which needs a rule, not a wording fix. The PO places the row: story 5 of
`duty-menus-and-self-maps`, or a later docs pass.

**Pointer:** ADR `engineering-team/decisions/done/duty-menus-and-self-maps/0004-treasure-map-key-grammar.md` (sub-decision 6;
Consequences, Other specs; Open question 3); `protocols/drafts/treasure-maps.md` § 4.3.

**Note, 2026-10-12 (story 5, ADR `duty-menus-and-self-maps/0005` sub-decision 10).** The owner placed this row in a
docs pass after book `duty-menus-and-self-maps` (answer 5(a) to story 5's open question 5), so story 5 does not take
it. Story 5 changed only § 4.3's citation of Content Categories, to "its opening table of the four category types"
(row `2026-10-12-key-grammar-review-fold-forwards`, item 4). § 4.3's departure from Spawning § 3.2 and Content
Categories stands. The row stays OPEN.
