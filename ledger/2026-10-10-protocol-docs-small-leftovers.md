# Three small protocol-doc leftovers from the DList Auxiliary Events batch: a stale `Z`, two unindexed drafts, and an inheritance question with one home

**Id:** 2026-10-10-protocol-docs-small-leftovers
**Type:** docs
**Opened:** 2026-10-10 (DList Auxiliary Events pre-NIP session; found by the doc-plan sweep, left out of that batch as "could" items)
**Status:** OPEN
**Done:** —

1. **A stale `Z`.** `protocols/drafts/treasure-maps.md` § 5.1 (line 199) still says a member is read "through the header
   in Z". Uppercase `Z` was rejected on 2026-09-27 (worksheet W18), and Treasure Maps' own § 5.5 (line 235) records
   that. The member is read through its parent header, named by the item's `z`. Reword to "read it through its header
   (the item's `z`)".
2. **Two unindexed drafts.** `protocols/README.md`'s spec index doesn't list `protocols/drafts/filters-on-dlists.md`
   or `protocols/drafts/search-over-tags.md`. Both are owner-authored stubs. Add a row for each with its status, or
   say why they stay unindexed. (A third unindexed draft, `treasure-map.md`, already has its own row:
   `2026-09-27-old-treasure-map-draft-overlaps`.)
3. **An inheritance question with one home.** Does a list that defers to another's definition (an inherit-typed `b`)
   also use that list's auxiliary events, such as its JSON Schema, for roles it has none of its own? Today it is
   only open question 3 of `protocols/drafts/dlist-auxiliary-events.md`. The draft says the question belongs to
   Inherit-From. Add it to `protocols/drafts/inherit-from.md`'s resolution section as an open question, or to
   worksheet W7, so that whoever works on resolution finds it.

**Pointer:** the three files above; `protocols/drafts/dlist-auxiliary-events.md` § 11.
