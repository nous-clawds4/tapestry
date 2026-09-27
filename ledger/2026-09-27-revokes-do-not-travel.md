# A revoke never leaves the instance it was published on: the router streams that carry taggings are `#z`-filtered, and a kind-5 deletion carries no `z`

**Id:** 2026-09-27-revokes-do-not-travel
**Type:** bug
**Opened:** 2026-09-27 (tagging-edges #1, the 2026-09-26 census; ADR 0001 § New debt item 5)
**Status:** OPEN
**Done:** —

**What was seen.** Taggings reach other instances through strfry-router streams. On production they are `nostrUserTag`,
`tag`, `tagPinning`, `taggingWithSpecificTag` and `nostrEventTag`: both directions, to the dcosl relays, filtered by
`#z` on the concept stamps. They live in the instance's router state (`/var/lib/brainstorm/router-state.json`,
`src/api/strfry/routerConfig.js:20`), not in `setup/router-presets.json`. That file's only 39999 presets are `dcosl`
and `dcosl2`. They carry kinds 9998, 9999, 39998 and 39999, and are disabled. Production's stream list was read once,
from `GET /api/strfry/router-status` during this book's orientation (2026-09-25), and has not been re-queried since.

A NIP-09 deletion (kind 5) carries no `z`, so no `#z` filter passes it, and no stream carries kind 5 at all. A revoke
therefore stays on the instance where it was published, and the tagging it removed there still stands everywhere else.

The census of 2026-09-26 shows it. Two of the 27 revokes on tags.brainstorm.world, kind-5 `33a885dc…` (2026-08-26)
and `2359f6ce…` (2026-08-18), name taggings that production and staging still hold. Each was signed by the tagging's
own author and names one tagging by `e` (`fd8e3102…`, `904c0d4e…`). Both taggings are gone from
tags.brainstorm.world, and neither kind 5 is on production or staging. The ops runbook raised the same gap for unpins in July
(`docs/TAG_FEDERATION_OPS.md:11`, repeated in OPEN.md row 25's notes) and left it to decide once dcosl's kind-5
volume was counted. The streams were then set up without kind 5.

*Re-measured 2026-09-27 (tagging-edges #2 Planning):* tags.brainstorm.world holds 40 kind-5 events, 39 of them by
taggers, none dated after the census, so "27" reflects a scope the census did not record. The cross-host pair is
confirmed: `33a885dc…` revokes `fd8e3102…` and `2359f6ce…` revokes `904c0d4e…`, both by event id; both taggings are
still on production and staging, and gone from tags. Production's 21 kind-5s by taggers and staging's one kind-5 name
no tagging.

For tagging-edges, stories 2 and 3 read the local relay. On an instance the revoke never reached, that relay still
holds the tagging, so neither the gap-filler nor the live path has anything to remove, and the edge stands.

**Fix shape.** Carry kind 5 on the same streams that carry taggings and pins, in both directions. `#z` cannot select
them. The options are:
- `{"kinds":[5],"#k":["39999"]}`: narrow, but no UI revoke carries `k` today (OPEN.md row
  `2026-09-27-ui-revoke-names-id-only`).
- kind 5 scoped by author: the taggings' asserters, 2,357 on production.
- a periodic read of kind 5 by `#e`/`#a` for the taggings this instance holds.

Unscoped kind 5 is the fallback. Production already holds 9,341 kind-5 events; dcosl's kind-5 volume is unmeasured.
tagging-edges story 2's ADR should name where kind 5 comes from, next to where taggings come from. (Story 2, approved
2026-09-27, has the graph follow the local relay; carrying revokes between instances stays with this row.)

**Pointer:** ADR `engineering-team/decisions/tagging-edges/0001-tagging-edge-contract.md` § New debt / follow-ups
item 5; census in `engineering-team/epics/tagging-edges.md` § Key facts; OPEN.md row 25 (the runbook and the
`#z`-scoped sync plan).
