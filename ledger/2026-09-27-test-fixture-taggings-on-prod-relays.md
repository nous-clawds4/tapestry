# Test fixtures from eleven live suites are 91% of the taggings on production, staging and tags.brainstorm.world, and the local-only guard does not keep them local

**Id:** 2026-09-27-test-fixture-taggings-on-prod-relays
**Type:** cleanup
**Opened:** 2026-09-27 (tagging-edges #1, the kickoff census of 2026-09-26)
**Status:** OPEN
**Done:** —

**What was seen.** A read-only census on 2026-09-26 (each host's public `GET /api/strfry/scan/stream`, kind 39999
with the `nostr-user-tag` or `tag` concept stamp) counted 6,972 taggings on tapestry.brainstorm.world. Of these,
6,377 name a tag whose slug carries a 13-digit millisecond timestamp, which marks a test fixture. So do 3,248 of
its 3,359 tag elements. Staging (6,370 of 6,965) and tags.brainstorm.world (6,387 of 6,980) hold the same set.
The rest, 595 taggings by 59 taggers about 349 people across 77 tags, is an upper bound on the real set, because
the rule misses second-resolution slugs such as `repro-tag-1784350725`. The embedded timestamps run from
2026-07-18 to 2026-09-22. 4,021 of the fixture taggings are signed by the seven committed dev keys in
`test/helpers/livePov.js:36-42` (OPEN.md row 163), and the rest by per-run keys from `nak key generate`. The counts
were recomputed on 2026-09-27 from the saved census JSONL and match.

**Where they come from.** Eleven live suites mint these slugs:

| Slug prefix | Suite | Fixture taggings on prod |
|---|---|---|
| `test-tag-`, `birb-test-` | `test/profile-tags-publish.test.js:164`, `:280` | 1,205 + 11 |
| `tlmm-cert-` | `test/tl-certainty-method.test.js:235` | 1,100 |
| `wsumkv-` | `test/tl-weighted-sum-method.test.js:354` | 1,078 |
| `tagindex-s4-` | `test/tag-index-publish.test.js:134`, `:158` | 846 |
| `wysiwyg-s17-` | `test/tag-detail-curated-view-and-pin-polish-publish.test.js:241` | 816 |
| `tl-tag-s11b-` | `test/tl-publication-from-pins-publish.test.js:255` | 438 |
| `tagdetail-s2-` | `test/tag-detail-publish.test.js:148` | 330 |
| `cpc-tag-s12b-` | `test/customize-pin-curation-publish.test.js:240` | 210 |
| `mpt-a-s13b-` | `test/most-pinned-tag-index-publish.test.js:191` | 208 |
| `s3np-s3np-` | `test/tag-detail-write-publish.test.js:153` | 86 |
| `tlmm-` | `test/tl-membership-method-selector.test.js:310` | 49 |

That settles the question row 293 left open: `most-pinned-tag-index-publish`'s fixtures do reach the public hosts.

**How they get out.** Every one of these suites POSTs signed events to the local `/api/strfry/publish`, which
runs `strfry import` into the local relay (`src/api/strfry/commands/publishEvent.js`). strfry-router then sends
every newly stored event that matches an `up` or `both` stream to that stream's relays, however the event was
stored (`handleDBChange` → `outgoingEvent` in `src/apps/mesh/cmd_router.cpp`, the container's strfry source at
`f31a1b9`). The shipped `dcosl` preset is `both` for kinds 9998/9999/39998/39999 with `wss://dcosl.brainstorm.world`
(`setup/router-presets.json`, disabled by default). All three public hosts run `both` streams with dcosl for the
`nostr-user-tag` and `tag` stamps (`GET /api/strfry/router-status` on each, 2026-09-27). So whatever one stack
uploads, all three receive.

**Why the guard does not stop it.** The local-only guard (`BRAINSTORM_PUBLISH_LOCAL_ONLY`, event-tagging ADR 0002)
governs only the browser client's fan-out in `ui/src/utils/nostrPublish.js`. The ADR lists router redistribution
as out of scope (`engineering-team/decisions/event-tagging/0002-global-publish-gate.md:95`). Even so,
`docs/CONFIGURATION.md:12` says that with the guard on "all Nostr publishing stays on the local relay only".
Eight of the eleven suites never read the guard. The three trusted-lists suites read it in an `L0 GUARD` test, but
their runners catch a failed test and move to the next one, so the seeding tests publish whether the guard
passed or not (`test/tl-certainty-method.test.js:199` for the guard, `:220` for the seeding test, `:339-345` for
the loop; the same shape at `tl-weighted-sum-method.test.js:290`/`:449` and
`tl-membership-method-selector.test.js:251`/`:400`). OPEN.md row 191 describes the guard as a refusal, but all it
does is turn a line red. The `tlmm-cert-`, `wsumkv-` and `tlmm-` fixtures (2,227 taggings, 2026-09-07 to
2026-09-22) come from exactly those three suites, so the guard did not stop them, whichever way it read. Which
stack uploaded them was not established. This machine today has the guard on (`/api/publish-policy` answers
`allowExternalPublish:false`) and every router stream disabled.

**Readers meanwhile.** By design (CLAUDE.md principle 2) the fixtures are accepted like any signed event, and a
POV's read-time trust filter is what keeps them out of that POV's view. The cost falls on everything that reads
unfiltered: relay storage, scans, sweeps and every count of the corpus. The tagging-edges projection will also
carry them as edges, like any other tagging (`engineering-team/epics/tagging-edges.md`, "POV stays at read time").

**Fix shape.**
- **Stop the leak.** Keep live-suite fixtures on the local relay. Either the suites skip before seeding when the
  stack would upload their kinds (row 191's skip-not-fail proposal, extended to the eight unguarded suites), or the
  guard grows to cover router `up`/`both` streams (a scope change to ADR 0002). Either way, a failed `L0` must stop
  its suite's seeding, and `docs/CONFIGURATION.md:12` should say what the guard actually covers.
- **Clean up.** Only as a sanctioned, operator-run removal, on dcosl and on the three hosts in the same window.
  NIP-09 is not available here: the per-run keys were never saved, and none of the hosts' dcosl streams carries
  kind 5 anyway (row 25). A host cleaned while dcosl still holds the fixtures gets them back from any later
  `strfry sync` against dcosl, and row 25's tag-sync plan is one. Classify with the timestamp-slug rule, with
  ambiguous cases kept, and first run the sweep row 128 requires: test sources pin some corpus by id (for example
  `test/tag-detail.test.js:100`, `cpc-tag-fixture-1784351872-7e0ce5`). The existing `scripts/tl-prune-fixtures.js`
  is local-only and covers only the trusted-lists prefixes.

**Pointer:** `engineering-team/epics/tagging-edges.md` (the census paragraph; the census JSONL is session scratch
and not in the repo); OPEN.md rows 25, 128, 163, 191 and 293; ADR `event-tagging/0002` § Out of scope;
`docs/CONFIGURATION.md` § Publish policy; `setup/router-presets.json`.

**Update 2026-09-29: the Mac Studio is not in the safe state described above.** "This machine today has the guard on
… and every router stream disabled" does not hold for the Mac Studio's stack. There are two dev machines, so it may
describe the other one. Checked on the Mac Studio on 2026-09-29:
- `/api/publish-policy` answers `allowExternalPublish:true`.
- `GET /api/strfry/router-status` shows the `tag`, `nostrUserTag`, `tagPinning`, `taggingWithSpecificTag` and
  `nostrEventTag` streams as `both` and enabled: kind 39999, `#z` = the upstream tag concepts. So are `WoT` (`both`)
  and `trustedAssertions` (`up`).
- `/var/lib/brainstorm/router-state.json` has held these flags since 2026-07-18.

So a full local `npm test` on the Mac Studio sends the tag suites' fixtures to those streams' relays. The
Dictionary › Concepts fix ran only its own suites there. `dictionary-concepts` publishes nothing. The
`trusted-dictionary` fixtures are kind 39998 headers and kind 39999 items whose `z` points at those headers, and no
enabled stream matches them.

**Update 2026-09-30: it happened again, 6 more fixtures.** In my-assistants #1's Implementation phase, a session
started the full `npm test` on the Mac Studio (with `BRAINSTORM_PUBLISH_LOCAL_ONLY=true`, which, as above, does
not govern the router) and stopped it at suite 5 of 245 once it recalled this row. Gate run
`20260930T205145Z-52141-32fb`, INTERRUPTED at 4/245.
- **What it stored locally** (read-only `strfry scan` since 20:51:40Z):
  - `profile-tags-publish` stored the tag element `test-tag-1790801508978-c4wvi8`, four taggings of it
    (`profile-tag-test-tag-1790801508978-c4wvi8-…`) and one kind 5, all signed by `9c416f3a…`. That's the first
    committed dev key in `test/helpers/livePov.js` (`AUTHOR_POOL[0]`), so these five can be retracted with a kind 5;
  - `tag-detail-publish` stored the tag element `tagdetail-s2-1790801523159-jaxgr2`, signed by `9bf41bc0…`, a
    per-run `nak key generate` key that was not kept, then was stopped. That one cannot be retracted.
- **What reached outside:** a read-only REQ by id to `wss://dcosl.brainstorm.world` found **all six kind 39999
  events**. It did not find the kind 5: no stream carries kind 5, so the relay keeps the tagging the suite retracted
  locally.
- **No cleanup was done.** Publishing deletions is the owner's call.

The session's instructions (Implementer role, workflow 4) say to run `npm test`. On this machine that instruction
and this row conflict, and nothing in the workflow points here.
