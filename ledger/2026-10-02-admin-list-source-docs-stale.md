# Two docs say admins come only from `BRAINSTORM_ADMIN_PUBKEYS`, but the server checks settings.json's list first

**Id:** 2026-10-02-admin-list-source-docs-stale
**Type:** docs
**Opened:** 2026-10-02 (tagging-edges #5 review 1 fix round; seen by its docs implementer)
**Status:** OPEN
**Done:** —

**What was seen.**
- **What the server checks.** `getAdminPubkeys` (`src/utils/config.js:99-112`) returns `adminPubkeys` from
  `/var/lib/brainstorm/settings.json` whenever that list is non-empty. That is the list `POST /api/admin/add|remove`
  writes. Only otherwise does it read `BRAINSTORM_ADMIN_PUBKEYS` from `brainstorm.conf`.
- **What two docs say.** OPERATIONS §10.2 (BullBoard, about `:470`) and BIBLE's BullBoard paragraph (about `:1681`)
  say admins are the pubkeys in `BRAINSTORM_ADMIN_PUBKEYS`.
- **Already fixed for the switch.** Story 5 fixed the same sentence in OPERATIONS §12.9, but left these two, which
  are outside its scope.

**Fix shape.** Name both sources in both places, in §12.9's wording. When settings.json's `adminPubkeys` is non-empty,
it is the list. Otherwise `BRAINSTORM_ADMIN_PUBKEYS` is. Both are re-read on every request.

**Pointer:** `OPERATIONS.md` §10.2 and §12.9 (the fixed sentence); `BIBLE.md` (BullBoard paragraph);
`src/utils/config.js` `getAdminPubkeys`.
