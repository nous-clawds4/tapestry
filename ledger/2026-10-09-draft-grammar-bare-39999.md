# The draft Treasure Maps grammar doesn't say what a bare `39999` key means, and assigning Concepts now writes one

**Id:** 2026-10-09-draft-grammar-bare-39999
**Type:** protocol
**Opened:** 2026-10-08 (the Concepts hotfix, ledger `2026-10-08-concepts-assignment-adds-39999`; carried by the
treasure-map-card-details close)
**Status:** OPEN
**Done:** —

At the owner's request, Edit mode on `/treasure-map` now writes both `39998` and `39999` when Concepts is assigned.
`protocols/drafts/treasure-maps.md` § 4.5 defines the bare `39998` as "all of the observer's Concept headers". It names
`39999:<d-tag>` but gives the bare `39999` no meaning of its own. The page's card rule already reads a bare `39999` as
a whole-kind Concepts entry, and nothing breaks. But a reader of the draft can't tell whether `39999` is redundant
with `39998`, narrower (headers declared as kind-39999 items only), or required by some readers.

**Owner's decision needed:** name the bare `39999` in § 4.5 and § 10 (and say whether `39998` alone still covers
`39999` headers, which is what the card rule's `*` shadowing assumes today), or record that it is written only for
readers that look a kind up exactly.

**Pointer:** `protocols/drafts/treasure-maps.md` § 4.5, § 10.12; `ui/src/pages/treasure-map/editTreasureMap.js`
`FAMILY`; `ui/src/pages/treasure-map/manageTreasureMap.js` `shadowed`.

**Note, 2026-10-11 (provisional answer).** At the gate of ADR `duty-menus-and-self-maps/0002` Amendment A1, the owner
confirmed A1-8 as the Duty Menus spec's reading until story 3 of that epic settles it here: a bare `39998` covers every
Concept key, `39999` headers included; a bare `39999` covers the `39999:<d>` keys; a `39999` kind slot beats a bare
`39998`; and menu rows keyed `39998:` / `39999:` (nothing after the colon) are ignored. The row stays OPEN until Treasure
Maps § 4.5, § 6 and § 10 say so (story 3, `engineering-team/epics/duty-menus-and-self-maps.md`).

**Note, 2026-10-11 (story 3's approval).** The owner moved the key-grammar questions to story 4 of the epic (story 3,
open question 2(a)). Read "story 3" above, and every "story 3" in ADR `duty-menus-and-self-maps/0002`'s A1-8, A1-9 and
A1-10 and the lines that speak of them, as story 4 (recorded in ADR 0003). The row stays OPEN until Treasure Maps
§ 4.5, § 6 and § 10 say so, and until two sentences story 3 wrote to wait on A1-8 are updated to match: § 3's on a K
that is a Concept kind and a colon alone, and § 9.2's Ties (story 3's Deviations).
