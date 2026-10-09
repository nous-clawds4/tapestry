# ADR 0002: Honor a stream's configured limit when the router connects

**Status:** Accepted
**Date:** 2026-10-09
**Story:** `engineering-team/stories/relay-stream-gaps/2-stream-limit-refetches-on-reconnect.md`

## Context

The story's acceptance criteria, restated:

- **AC-1:** a download stream (down or both) with limit N gets, within 10 s of connecting to a
  relay, that relay's newest matching events the local relay lacks, up to N per relay. This
  applies when the stream is turned on, after a router restart, and after a deploy. The
  relay may cap N (strfry: 500).
- **AC-2:** with the busy streams at the default limit, a staging deploy leaves no missing
  minute in the 2026-10-09 minute-by-minute comparison.
- **AC-3:** live delivery is unchanged. Upload streams are unchanged. Nothing is stored twice.
- **AC-4:** the editor explains the Limit (re-sent on connect, downloads only). New streams and
  the presets default to 500. Blank or 0 is shown as "live only (nothing fetched on connect)".
- **AC-5:** a stream with no limit stays live only.

The product decisions are settled: default 500; saved streams on each instance are not
changed; blank or 0 means live only.

**Why the limit does nothing today.** In strfry 1.1.0, `StreamGroup::connOpen`
(`src/apps/mesh/cmd_router.cpp:160–168`) builds the REQ for a down or both stream as a copy of
the configured filter and then unconditionally sets `filterToSend["limit"] = 0;`. A relay
answers that with no stored events, only live ones. The same line is in strfry master
(`:177`), so upgrading strfry won't fix it. The configured limit is still parsed into
`filterCompiled` (the up-direction matcher), where it plays no part in matching.

**How strfry reaches the image.** `Dockerfile:18–33` clones strfry at `STRFRY_REF=1.1.0`,
runs `patches/strfry-redis/apply-patches.sh` (sed edits, each verified with a grep that
fails the build loudly if the pattern stopped matching), then builds. So the image already
carries a strfry patch set with a fail-loud convention.

**How a limit reaches strfry.** The stream editor's Limit field
(`ui/src/pages/settings/RelaySettings.jsx:151–156`, new-stream default `limit: 5` at `:37`)
→ `sanitizeStreamFilter` (`src/api/strfry/routerConfig.js:57–80`, `limit` kept when
`Number.isInteger`, negatives included) → `router-state.json` → `generateConfig` emits it
inside `filter = {…}` → strfry. The presets (`setup/router-presets.json`) carry `limit: 5`,
except `treasureMaps`, which has none.

**Interplay with ADR 0001.** After ADR 0001, raising a stream's limit in the editor is a filter
change. strfry reconnects that stream on reload, so with this ADR the new limit is fetched
immediately.

**Constraints.** JS without a build step, and no new dependencies. Stay on strfry 1.1.0. Keep
`generateConfig`'s bytes for an unchanged filter (test R2). Instance stream state on the data
volume is not migrated (product decision 2). No concepts change.

## Options considered

### Option A: Patch strfry's router to keep a configured limit

One edit to `connOpen`: send the configured `limit` when the filter has one, and keep 0
only when it doesn't:

```cpp
if (!filterToSend.find("limit")) filterToSend["limit"] = 0;
```

It lives in a new `patches/strfry-router/apply-patches.sh` with the same fail-loud sed + grep
convention, run by the Dockerfile right after the Redis patches.

Pros:
- One line, at the exact spot that discards the limit.
- The relay does the work: it caps N at its maximum, dedupes on the local write, and the
  stream continues live after EOSE as today.
- No absent limit changes behavior (AC-5 for free).
- It works on every connect path strfry has: first connect, the reconnect cron after a drop,
  ADR 0001's filter-change reconnect, a router restart, and a deploy.

Cons:
- Grows the strfry patch set. A `STRFRY_REF` bump must re-verify it, though the fail-loud
  grep makes a miss a build failure, not a silent regression.
- The first deploy rebuilds strfry: the layer cache misses from the new `COPY` onward, adding a
  few minutes once.

### Option B: Refetch from Node when the router reports a connection

The control panel tails the router's log. On each `<stream>: Connected to <url>` line it opens
its own websocket to that relay, REQs `{…filter, limit: N}`, and writes the results with
`strfry import`.

Pros: no C++ change.

Cons:
- Duplicates what strfry already does on the same socket.
- Races the router's live subscription.
- Adds a long-lived log tailer, a websocket client and an import pipe to the control panel.
- Misses connects that happen while the control panel is down.
- Couples to a third log string.

### Option C: Leave strfry alone; rely only on scheduled negentropy syncs (story 3)

Pros: no patch at all.

Cons: doesn't do what the operator chose. Every deploy and reconnect still opens a hole until
the next scheduled run. The Limit field keeps meaning nothing, or has to be removed, which the
operator declined.

## Decision

We chose **Option A**. The defect is one line in strfry, so the fix is one line in strfry. It
uses the patch mechanism the image already has, and covers every connect path with no new
moving parts in Node. Option B rebuilds the same thing outside strfry, with more ways to fail.
Option C is the backstop (story 3), not a substitute.

## Consequences

- A download stream with limit N refetches up to N newest matching events per relay on every
  connect. Deploy and restart holes shorter than N fill in seconds.
- **Saved streams change meaning without a migration.** Staging's and production's streams
  saved with `limit: 5` start refetching 5 per connect, a small gain, until the operator
  raises them (decision 2). Streams with no limit (`treasureMaps`, staging's `userProfiles`)
  stay live only (decision 3).
- **Cost per reconnect:** up to N events per relay re-sent and signature-checked. strfry's
  writer drops the ones already stored, so nothing is written twice and nothing reaches the
  Redis pipeline twice. At N = 500 on kind 0 that is about 0.5 MB per relay per reconnect.
- **Both-direction streams:** events a reconnect brings in that are new locally are, like live
  events today, offered upstream to the stream's other relays. No new behavior; the volume is
  bounded by N.
- **Relays that refuse large limits:** strfry relays cap silently at `maxFilterLimit` (500 in
  strfry 1.1.0's shipped `strfry.conf`). A relay that rejects a high limit outright would
  close the subscription. The operator lowers that stream's limit; the story makes N
  per-stream for this reason.
- **A negative limit becomes meaningful,** where it was harmless before. Ingress now drops a
  negative `limit` (a slice of OPEN.md row 31(b), limited to `limit`).
- **The patch set grows to two directories.** A `STRFRY_REF` bump re-verifies both; the
  Dockerfile comment says so.
- **Not fixed:** gaps larger than N, backdated events, kinds no stream covers, and the upload
  direction. Story 3's scheduled sync covers the first three.
- **Firmware reinstall required?** No.

## Implementation notes

**`patches/strfry-router/apply-patches.sh` (new; mirror `patches/strfry-redis/apply-patches.sh`)**
- `set -e`; `STRFRY_DIR="${1:-.}"`; target `src/apps/mesh/cmd_router.cpp`.
- If the file already contains `if (!filterToSend.find("limit"))`, print "(skipping)" and exit 0
  (idempotent).
- Otherwise `sed -i 's|^\( *\)filterToSend\["limit"\] = 0;|\1if (!filterToSend.find("limit")) filterToSend["limit"] = 0;|'`,
  then verify with `grep -q` that the new line is present **and** no bare
  `filterToSend["limit"] = 0;` line remains. On failure print an `ERROR: … upstream may have
  changed` line to stderr and `exit 1`.
- A header comment cites strfry 1.1.0 `cmd_router.cpp` `connOpen`, ADR relay-stream-gaps/0002,
  and the semantics: absent → 0 (live only); present → sent as-is; the relay caps.

**`Dockerfile`**
- After the Redis `COPY` (`:19`): `COPY patches/strfry-router/ /tmp/strfry-router-patches/`.
- In the strfry `RUN` chain, right after the Redis `apply-patches.sh` line:
  `&& bash /tmp/strfry-router-patches/apply-patches.sh /usr/local/src/strfry \`.
- Update the `STRFRY_REF` comment (`:21–25`) to name both patch directories.

**`src/api/strfry/routerConfig.js` — `sanitizeStreamFilter` (`:57–80`)**
- For `limit` only: keep it when `Number.isInteger(val) && val >= 0`. `since`/`until` are
  unchanged. Update the doc comment.

**`setup/router-presets.json`**
- Every preset's `filter.limit` becomes `500`, `treasureMaps` included (it gains `"limit": 500`).
  Kinds and everything else are unchanged, and no tag filters are added (test R3's guardrail).
  Instances' saved state is untouched; presets only seed a first boot, Restore Defaults and
  Import Preset.

**`ui/src/pages/settings/RelaySettings.jsx`**
- Add `const DEFAULT_STREAM_LIMIT = 500;` and use it in `emptyStream()` (`:37`, replaces `5`) and
  as the Limit input's placeholder (`:155`).
- Limit field (`:151–156`): label `Limit (fetched on connect)`. Hint below it: `Each time this
  stream connects, every relay re-sends up to this many of its newest matching events, then
  streams live. Downloads only. Blank or 0 = live only (nothing fetched on connect). strfry
  relays send at most 500.` When `form.dir === 'up'`, the hint is instead `Not used: upload-only
  streams send new local events as they arrive.`
- Stream card summary (`:626`): for `dir !== 'up'`, `limit > 0` → ` (fetches up to N on
  connect)` and blank or 0 → ` (live only: nothing fetched on connect)`. For `dir === 'up'`,
  nothing. Keep the existing condition that shows the summary line.

**`OPERATIONS.md:812`**
- "a router stream brings nothing published upstream while it was down, which includes every
  deploy" becomes: on reconnect a router stream refetches only the newest events up to its
  Limit (live only when the Limit is blank or 0); anything beyond that published while it was
  down, which includes every deploy, needs a negentropy sync.

**`BIBLE.md` §14 (after ADR 0001's sentence)**
- One sentence: a stream's Limit is how many of each relay's newest matching events it
  refetches on every connect (honored by the image's patched strfry router; upstream strfry
  ignores it); blank or 0 = live only.

**Tests (Phase 3, Tester's lane, listed so they aren't missed)**
- Stack-free: run the new `apply-patches.sh` against a fixture copy of the 1.1.0 `connOpen`
  block. The patched line is present and the bare line gone; a second run is a no-op that
  exits 0; a fixture without the target line exits non-zero with the `ERROR` message.
- Dockerfile wiring: the `COPY` exists and the router apply runs inside the strfry `RUN`
  chain, after the Redis apply and before `make`.
- Presets: every preset's limit is 500; R3's kinds-only guard still holds.
- Sanitizer: a negative `limit` is dropped; 0 and positive are kept; other keys unchanged.
- UI source: the default, label, hints and card wording above.
- AC-1/AC-2 live checks are verification steps, not `npm test` (see below).

**Verification after deploy (AC-1/AC-2, staging)**
1. After the deploy that ships this, the operator raises staging's busy download streams
   (`WoT`, the tag streams, `tagDeletions`) to 500 in the editor. Under ADR 0001 each raise
   reconnects that stream, which refetches immediately; that is AC-1 observed live.
2. On the next staging deploy, re-run the 2026-10-09 minute-by-minute comparison
   (`wot.grapevine.network` kinds 0/3/1984/10000 against staging) across the deploy minute.
   Expect no missing events for the raised streams (AC-2).

## Out of scope

- Gaps larger than N, backdated events, kinds no stream covers: story 3.
- The upload direction's start point (the router begins at the newest local event).
- Migrating saved stream limits on any instance (decision 2).
- Upstreaming the patch to hoytech/strfry. Worth offering, but outside this book.

## Verified evidence

Run 2026-10-09 in the session sandbox (no Docker), against a strfry built from tag `1.1.0`
(golpe `665df82`) with `patches/strfry-redis/apply-patches.sh` applied as the Dockerfile does,
plus the proposed sed:
`s|^\( *\)filterToSend\["limit"\] = 0;|\1if (!filterToSend.find("limit")) filterToSend["limit"] = 0;|`.
The sed matched exactly one line (`cmd_router.cpp:164`). The build succeeded (`make -j4`, exit
0; `strfry --version` → `strfry 1.1.0`).

Setup: an upstream strfry relay on `127.0.0.1:7801` with its own DB. The router (`strfry
router`) writes into a separate local DB. Its config has two down streams to the upstream:
`s1` `{"kinds":[1],"limit":5}` and `s2` `{"kinds":[7]}` (no limit). Before the router started,
12 kind-1 and 4 kind-7 events were published upstream from a throwaway key, `created_at` 1 s
apart.

1. **Limit honored on connect (AC-1).** Three seconds after start, the local DB held exactly 5
   kind-1 events, and their ids are the newest 5 of the 12.
2. **No limit stays live only (AC-5).** The local DB held 0 kind-7 events.
3. **Live delivery unchanged (AC-3).** Two more kind-1 published upstream arrived (local 7).
4. **Raising the limit refetches, and nothing is stored twice (AC-1, AC-3; ADR 0001 path).**
   The config was rewritten in place (`fs.writeFileSync`) with `s1`'s limit 5 → 20. The router
   logged `Loading router config file`, `s1: Disconnected`, `s1: Connecting`, `s1: Connected`,
   `Writer: added: 7 dups: 7`. The local DB then held all 14. `s2` logged nothing: it was not
   reconnected.

Items 4–6 of ADR 0001's evidence (rejection, file replacement, log destination) came from the
same run and are recorded there.
