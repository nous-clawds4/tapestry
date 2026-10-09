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
