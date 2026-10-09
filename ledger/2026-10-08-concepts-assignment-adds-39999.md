# Assigning Concepts on /treasure-map now adds both `39998` and `39999`

**Id:** 2026-10-08-concepts-assignment-adds-39999
**Type:** feature
**Opened:** 2026-10-08 (owner request; operator-present hotfix, the trace 0-intake §3 asks for)
**Status:** DONE
**Done:** 2026-10-08 (commit `b84484c8`, branch `fix/concepts-family-39999`)

Edit mode on `/treasure-map` added one Concepts family entry, `39998`, when an assignment found the Map had none (book
decisions 12 and 15). At the owner's request it now writes both of the Concepts kinds: `39998` and `39999` are each
moved to the new Assistant in place when the Map has them, and each added when it doesn't, `39998` first. Assign to all
does the same. `FAMILY` in `editTreasureMap.js` is now a list per category.

This amends decisions 12 and 15 of the closed treasure-map-edit book: "for Concepts `39998`" now reads "for Concepts
`39998` and `39999`". Two consequences worth knowing:

- A Map that has `39998` but no `39999` now gains `39999` when Concepts is assigned, even to the Assistant `39998`
  already names, so Save turns on for that pick. Picking a card's current Assistant still cancels the pick, as before.
- The draft grammar (`protocols/drafts/treasure-maps.md` § 4.5) defines the bare `39998` as all of the observer's Concept
  headers and doesn't give the bare `39999` a meaning of its own; the card rule already reads it as a whole-kind Concepts
  entry. If `39999` should be named in the draft, that's a protocol note for the owner. The card rule's `*` shadowing
  (a bare `*` is hidden for Concepts by `39998` alone) is unchanged.

Verified: the six Treasure Map Node suites (edit-mode 48/48, switches 34/34, save 24/24, cards, card-rule edges, page)
and the seven browser specs (109/109) against the worktree's own build on :7799.

**Pointer:** `ui/src/pages/treasure-map/editTreasureMap.js` (`FAMILY`, `editedTags`);
`engineering-team/audits/treasure-map-edit/book.md` decisions 12 and 15.
