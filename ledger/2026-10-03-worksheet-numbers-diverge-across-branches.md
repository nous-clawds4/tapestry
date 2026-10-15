# Worksheet entries W17 and W18 name different entries on feat/tags and on staging

**Id:** 2026-10-03-worksheet-numbers-diverge-across-branches
**Type:** docs
**Opened:** 2026-10-03 (cross-session review for Brainstorm-UI's Dictionary work; branch `docs/declarative-dlist-rendering`)
**Status:** OPEN
**Done:** —

**What was seen.** On `feat/tags`, `protocols/worksheet.md` has W17 "`field-type` header tag: in the wild, not in the NIP" and W18 "Field types as a DList: portable *actions*, not portable rendering", both Open. On `staging` and `main`, W17 is "Upstream kinds `30386` / `30387` / `30396` / `30397`" and W18 is "Descriptor tag letters `K` / `Z` / `T`", both Closed. The field-type entries exist nowhere on `staging`. Code and docs cite them by number: `feat/tags` story `dlist-item-tagging` #7 cites W17/W18; the GitHub firmware-concept design note cites "W18 url-template". Read on `staging`, those citations land on unrelated entries. A cross-session conversation on 2026-10-02 nearly propagated the wrong meaning to another repository.

It is the worksheet's version of the problem the ledger solved with date+slug ids (OPEN.md § "How to use this ledger").

**Fix shape.** When `feat/tags` next syncs with `staging`, renumber the two field-type entries to the next free numbers (W28 and up), leave a one-line pointer at their old numbers on `feat/tags`, and repoint their citations. Longer term, consider slug anchors for worksheet entries, as the ledger did.

**Pointer:** `feat/tags:protocols/worksheet.md` (W17, W18); `staging:protocols/worksheet.md` (W17, W18); [W27](../protocols/worksheet.md#w27--declarative-rendering-hints-for-dlist-headers) (cites the field-type entries by title).
