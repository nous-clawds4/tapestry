# The List Headers Author selector lists the Owner twice on staging and production, because the Owner's pubkey is also the pinned Dave pubkey

**Id:** 2026-10-02-author-selector-duplicate-owner-entry
**Type:** bug
**Opened:** 2026-10-02 (list-headers-disposition book, staging smoke test, Tier 4)
**Status:** OPEN
**Done:** —

**What was seen.** On `staging.brainstorm.world/tapestry/lists`, the Author selector shows "👑 straycat" twice, right
after "All authors".
- `authorOptions` in `ui/src/pages/lists/Index.jsx` pins `ownerPubkey`, then `DAVE_PUBKEY`
  (`ui/src/config/pubkeys.js:6`), then `TA_PUBKEY`.
- On staging and production the Owner's pubkey **is** `DAVE_PUBKEY` (`e5272de9…`), so the same key is pinned twice.
- `authorDisplayName` labels both 👑. React also gets two `<option>`s with the same `key`.

It predates the list-headers-disposition book, which left `authorOptions` unchanged (ADR
list-headers-disposition/0001, "Unchanged"). It is harmless beyond the duplicate: both entries filter the same rows.

**Fix shape:** de-duplicate the pinned list (`[...new Set(pinned)]`, or skip Dave when he is the Owner). Add a test
with `ownerPubkey === DAVE_PUBKEY` that expects one 👑 entry. Other pages that pin the same three may have the same
duplicate; check them when fixing.

**Pointer:** `engineering-team/audits/list-headers-disposition/audit.md` § 5.
