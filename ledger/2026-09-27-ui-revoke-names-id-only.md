# The UI revoke names only the tagging's event id, so an older version of the revoked tagging that reaches the relay later is accepted again

**Id:** 2026-09-27-ui-revoke-names-id-only
**Type:** bug
**Opened:** 2026-09-27 (tagging-edges #1, the orientation read of the revoke path; ADR 0001 § New debt item 6)
**Status:** OPEN
**Done:** —

**What was seen.** `revoke` in `ui/src/hooks/useProfileTags.js:150-165` publishes a kind 5 whose only tag is
`['e', eventId]` (:157). Its content is `'revoked'`, and it carries no `a` and no `k`. strfry 1.1.0 (source read in
the container) treats the two forms of deletion differently:
- **`e`.** It records the deletion as (event id, author) and afterwards refuses only that id (`golpe.yaml:72`,
  `src/events.cpp:274-277`).
- **`a`.** It records the deletion as (address, `created_at`). It removes every stored version at the address up to
  that `created_at` (`events.cpp:339-363`) and refuses any later arrival at or before it (`events.cpp:310-323`).

A tagging is replaceable, so an older version of it can still sit on a relay the newer one never reached. With only
the `e`, such a version arriving after the revoke is accepted: nothing newer is stored at the address to mark it
replaced (`events.cpp:279-307`). It then stands, and the stance the author revoked comes back. In the 2026-09-26
census the only revokes (content `revoked`) are 27 on tags.brainstorm.world, all `e`-only. No kind 5 on any of the
three hosts names a tagging's address.
`unpinTag` (`ui/src/utils/publishTagPin.js:403-418`) sends the same `e`-only kind 5 for a pin, which is also a
kind-39999 event.

**Fix shape.**
- Add `['a', '39999:<author>:<d>']` to the revoke, spelled exactly that way with the author's lower-case hex. strfry
  hashes the raw value when it records the deletion, but rebuilds `kind:hex(pubkey):d` when it checks an arrival
  (`golpe.yaml:80`, `events.cpp:313`). Any other spelling deletes the stored versions but refuses nothing later.
- Keep the `e`. `wss://dcosl.brainstorm.world` runs strfry 1.0.4, which honours only `e` (OPEN.md row 297).
- Add `['k', '39999']`, so a stream or reader can select tagging deletions by `#k` (OPEN.md row
  `2026-09-27-revokes-do-not-travel`).
- Supply the `d`. The hook receives only the event id (`ui/src/components/ProfileTagsSection.jsx:116`), and the
  assertion rows the read serves carry no `d` (`src/api/profile-tags/index.js:303-310`). The read should return
  each tagging's `d` (or its address), and the revoke should take it.
- Make the same change to `unpinTag`.

**Pointer:** ADR `engineering-team/decisions/tagging-edges/0001-tagging-edge-contract.md` § New debt / follow-ups
item 6 and "What strfry 1.1.0 actually does"; strfry source at `/usr/local/src/strfry` in the `tapestry` container.
