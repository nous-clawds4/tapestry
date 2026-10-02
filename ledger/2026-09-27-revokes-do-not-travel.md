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

*Re-measured 2026-09-27 (tagging-edges #2 Planning; method: each host's public `GET /api/strfry/scan/stream` with
`filter={"kinds":[5]}`, cross-checked against a matching `GET /api/strfry/scan/count`, read at about 17:07Z; "taggers"
are the authors of the `nostr-user-tag`-stamped kind-39999 taggings the contract accepts on any of the three hosts,
2,402 in all, read the same hour the same way):* tags.brainstorm.world holds 40 kind-5 events, 39 of them by
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

**Update 2026-09-30 (my-assistants #2, ADR my-assistants/0002 Amendment 1): a partial fix, not yet shipped.**
- **Withdrawals carry `k` 39999.** The My Assistants page's Remove and Change publish a kind 5 with `e` (every id),
  `a` (every address) and `k` `39999`, and send it to `wss://dcosl.brainstorm.world` as well as `PUBLISH_RELAYS`.
- **A stream is planned.** The book's § Before shipping turns on a `tagDeletions` router stream (`both`,
  `{"kinds":[5],"#k":["39999"]}`) on each instance, documented in `docs/TAG_FEDERATION_OPS.md`.
- **What it leaves open.** Review 2 found the stream live-only, so a deletion published during a router restart never
  arrives. dcosl's strfry 1.0.4 honours `e` deletions only. UI revokes without `k` still don't ride it. This row
  stays open for the catch-up.

**Update 2026-10-01 (my-assistants book close): the partial fix is shipped and proven.**
- **The stream:** `tagDeletions` is on for staging, tags.brainstorm.world, production and the Mac Studio.
- **The page:** the My Assistants page that publishes these withdrawals is on staging (PRs #795 and #797), not yet
  in production.
- **The proof:** a withdrawal pressed on staging's `/assistants` (kind 5 `8b08e444…`) reached every instance and
  both dcosl relays. The Mac Studio's router log shows it deleting the tagging `c18e7de0…` by `e` and by `a` on
  arrival (`engineering-team/audits/my-assistants/book.md` § Before shipping).
- **Still open:** the catch-up for deletions missed while a router restarts, and UI revokes that carry no `k` (row
  `2026-09-27-ui-revoke-names-id-only`).
