# A newer Map that only adds an unseen backup Assistant sends the cards back to loading, closing open panels

**Id:** 2026-10-09-unseen-backup-reloads-cards
**Type:** bug
**Opened:** 2026-10-08 (treasure-map-card-details #2, Gate B review, non-blocking 3)
**Status:** OPEN
**Done:** —

Since treasure-map-card-details #2, the page looks up the name of every Assistant a card's details panel lists,
backups included (`wantedKey` in `ui/src/pages/treasure-map/Index.jsx`). The cards wait for that lookup
(`namesReady`). So when the page swaps in a newer Map whose only new Assistant is a backup nobody has looked up yet,
the cards return to "Loading your Treasure Map…" until the lookup settles. That happens for a newer Map shown at Save
(treasure-map-edit decision 19) or after a later read. Returning to the loading line unmounts the cards, so any open
details panel closes. Before, only a new *counted* Assistant did this.

Found by reading the code at review; not exercised. Rare, and low impact: the panel can be reopened, and the
"Edit starting or ending" guarantee (story 2 AC-5) is unaffected. **Fix shape:** keep the cards drawn while a
*refresh* lookup runs (gate only the first draw on names), or hold each card's open state in `CategoryCards`, which
stays mounted.

**Pointer:** `engineering-team/reviews/treasure-map-card-details/2-show-details-panel.md` (non-blocking 3).
