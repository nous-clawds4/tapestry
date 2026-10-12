# Assistant Designation finds a user's TA from the `39998:dlist-header` entry, which Treasure Maps § 4.5 makes the same key as a bare `39998`: whether a bare `39998` entry names the TA is not settled

**Id:** 2026-10-12-bare-39998-ta-discovery
**Type:** protocol
**Opened:** 2026-10-12 (`duty-menus-and-self-maps` #4, ADR 0004 sub-decision 11; the owner's answer 3(a) to the ADR's open question 3)
**Status:** OPEN
**Done:** —

Assistant Designation says that the provider of a user's `39998:dlist-header` entry **is** the user's Tapestry
Assistant (`protocols/drafts/assistant-designation.md`:38), and its dual-author lookup's step 2 finds the TA "from
U's kind-10040 `39998:dlist-header` entry" (:152). Treasure Maps § 4.5 makes `39998:dlist-header` the legacy spelling
of the bare `39998`, and § 6 reads two spellings of one key as one key.

The `/treasure-map` editor writes a bare `39998` and a bare `39999` for the Assistant given Concepts
(`FAMILY.concepts`, `ui/src/pages/treasure-map/editTreasureMap.js`), and that Assistant need not be a TA: Treasure
Maps § 10.1 gives Concepts to Bob's Brainstorm Assistant. So step 2 reads two ways for the editor's Map:
- by its literal spelling, it finds no `39998:dlist-header` entry, and so no TA (step 3);
- as a Treasure Map key, it takes the Assistant given Concepts for the TA.

ADR 0004 V25 works both readings. Shipped `classifyEntry` (`ui/src/utils/treasureMap.js`) takes only the literal
spelling as the designation. Story 4 left Assistant Designation silent on a bare `39998`, as it was before, since the
question lies outside the sentences its AC1 names.

**Fix shape:** an owner decision on whether a bare `39998` entry names a user's TA, then one sentence in Assistant
Designation. The PO places the row: story 5 of `duty-menus-and-self-maps`, which edits Assistant Designation for item
10 of ledger row `2026-10-12-self-maps-spec-fold-forwards`, or a later docs pass.

**Pointer:** ADR `engineering-team/decisions/duty-menus-and-self-maps/0004-treasure-map-key-grammar.md` (sub-decision 5;
sub-decision 11; Verification V25; Open question 3); `protocols/drafts/assistant-designation.md` § Relationship to
NIP-85 and § Dual-author lookup and precedence; `protocols/drafts/treasure-maps.md` § 4.5.

**Note, 2026-10-12 (story 5, ADR `duty-menus-and-self-maps/0005` sub-decision 10).** The owner placed this row in a
docs pass after book `duty-menus-and-self-maps` (answer 5(a) to story 5's open question 5). At ADR 0005's gate the
owner confirmed that one more question rides with it, for that pass: does a bare `39998` ask the Assistant to curate
a list that has no entry of its own in the Map? Treasure Maps § 10.1 gives it "the items filed under" the person's
headers, and Spawning § 3.6, under principle 3's two gates, has it spawn the curated Concept of a list among the
Supported Concepts. But Assistant Designation's blanket entry "names no individual list", and only a per-DList entry
empowers an assistant to curate (§ Per-DList curation entries; ADR 0005, Consequences, cross-book item 4). An
Alternate entry for a list is the same question: Treasure Maps §§ 7 and 9 give that Assistant a duty, which
Assistant Designation, where the first occurrence wins, does not empower. Until the pass decides, a self-Map narrows
to exact keys for such a list (row `2026-10-12-self-map-upkeep-cross-book-notes`, item 4). The row stays OPEN.
