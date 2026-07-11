# ADR 0010: Periodic Trusted List publication from pinned tags

**Status:** Proposed
**Date:** 2026-05-18 (amended 2026-05-20)
**Story:** `engineering-team/stories/done/11-tl-publication-from-pins.md`

## Context

Story 11 turns each Pin event from Story 10 (`kind=39999`, `z=tag-pinning`,
authored by the pinner, carrying a `curation-method` JSON) into a signed,
periodically-refreshed kind-30392 Trusted List event in local strfry,
computed under the pin's observer POV. Scope is clamped to
`curation-method.method = "nip85:rank"` per the story; other methods are
forward-compat schema only.

### Concept-graph orientation

Via `/api/concept-graph/summaries` + targeted `neighbors`:

- `39998:<TA>:tag-pinning` — Story-10 concept; Pin events are the input set.
- `39998:<TA>:tag` — each pin's referenced tag (`slug`/`name`/etc. surface
  in the TL).
- `39998:<TA>:nostr-user-tag` — the endorsement/dispute polarity assertions
  whose WoT-trusted aggregation drives membership.
- `39998:<TA>:web-of-trust` — per-POV WoT scoring (`wot_rank_<suffix>`).
- **No new firmware concept.** kind-30392 is an existing nostr event-type
  with an existing read surface in this codebase; this story is its first
  *write* path on this instance, not a new concept. **No firmware reinstall.**

### Existing primitives we reuse

- **`POST /api/trusted-list/publish`** (`src/api/trustedList/index.js:70–125`).
  Already accepts `{ kind, dTag, title, metric, items[] }`, signs with the
  TA key via `getOwnerAssistantKeys()` (`src/utils/assistantKeys.js`), and
  publishes to local strfry via `strfry import --no-verify`. **Exactly the
  build-and-publish primitive we need.** Extended additively in this ADR.
- **`handleProfilesTagged`** (`src/api/profile-tags/index.js:570–694`).
  Already does the heavy lifting: scans local strfry for kind-39999
  `nostr-user-tag` assertions on a given `tagEventId`, applies the POV's
  WoT-author filter (`wot_rank_<povSuffix> >= minRank`), buckets by polarity
  into per-target `applications`/`disputes` counts. **Reused via direct
  function import** (no HTTP-to-self).
- **`resolvePov`** (`src/api/_shared/pov.js:46–71`). Translates
  `{wotPov, userPubkey}` → `{ povSuffix, minRank, delegatedPubkey, … }`.
  Cascades user-prefs → house-prefs. For TL generation we pass
  `{ wotPov: 'user', userPubkey: observer }`.
- **Scheduled-tasks scaffolding** (`src/api/scheduled-tasks/index.js`).
  Per ADR 0003, already keyed by `taskId` (`DEFAULTS` map at line 19, per-task
  timer state at line 34, `initScheduler()` iterates `Object.keys(DEFAULTS)`
  at line 156). **Adding a third task is one `DEFAULTS` entry +
  `taskRegistry.json` line + a new orchestrator script.**
- **`parseCurationMethod` / `parsePinTagEventId` / `TAG_PINNING_Z_TAG`**
  (`src/api/profile-tags/index.js`, exported at lines 1224–1226). Story-10
  helpers; reused here to walk Pin events.
- **`handlePins`** (`src/api/profile-tags/index.js:1139–1207`). The
  Story-10 `/api/profile-tags/pins` reader; this story extends its row
  shape additively to carry `tlStatus`.
- **Trusted List read surface** (`ui/src/pages/grapevine/TrustedListDetail.jsx`
  at lines 30 and 51–78). Reads kind 30392/30393/30394/30395 events,
  iterates `tags` for `p` and `e` entries with `[value, relay, score]`
  shape, plus `title` and `metric` metadata tags. Unrecognized tags are
  ignored — so this ADR can freely add additional metadata tags without
  breaking the existing reader (AC-10).

### CLAUDE.md invariants — what this story must honor

- **POV-first.** Membership is computed *per Pin's observer* via the
  existing WoT-author filter. Two pins with the same `tagEventId` but
  different observers produce two distinct TLs with potentially different
  membership. No "the membership" — only "this POV's membership."
- **Decentralized-first.** Any user's pin produces a TL. The TA signs the
  derivation; it is not the authority on what "counts" — it is reflecting
  what the observer's WoT, applied to anyone's signed assertions, says.
- **Filter at view time, not write time.** The cron *re-reads* assertions
  and trust columns on every refresh — no precomputed membership table.
  TLs are themselves replaceable so the read is current-state, not
  history.

### Project rules

- No new lint/typecheck/build tooling.
- JS-without-build server + UI.
- No new firmware concept ⇒ no firmware reinstall.

### Open questions called out by the story (resolved below)

1. TL addressable coordinate (`d`-tag composition).
2. Retraction mechanism for an unpinned tag's stale TL.
3. Where does the cron live in the existing scheduler.
4. WoT-trusted endorsements/disputes lookup mechanism.
5. "Refresh now" auth gate.
6. Per-tick scope when the global toggle is disabled.
7. Behavior of "Refresh all" with many pins (sequential / parallel / throttled).

## Options considered

### Option A — Extend the existing scheduler pattern; reuse `profiles-tagged` + `trusted-list/publish` via direct imports; status file on disk; empty-replacement retraction

Five composable pieces; each piece reuses an existing primitive.

**(1) Scheduler entry.** Add `refreshPinnedTagTLs` as a third entry in
`src/api/scheduled-tasks/index.js`'s `DEFAULTS` map:

```js
const DEFAULTS = {
  updateAllScoresForOwner: { enabled: false, intervalHours: 24, intervalDays: 0 },
  refreshSearchIndex:      { enabled: false, intervalHours: 24, intervalDays: 0 },
  refreshPinnedTagTLs:     { enabled: false, intervalHours: 24, intervalDays: 0 },
};
```

Zero code change beyond the entry — the generalized scheduler (per ADR 0003)
iterates `Object.keys(DEFAULTS)` already.

**(2) Task registry + orchestrator script.** Add a `refreshPinnedTagTLs` entry
to `src/manage/taskQueue/taskRegistry.json` pointing at a new shell
orchestrator `src/algos/refreshPinnedTagTLs.sh`. The orchestrator emits
structured-log events (TASK_START / PROGRESS / TASK_END / WARN) — same
pattern as `src/algos/refreshSearchIndex.sh` from ADR 0003 — and calls one
endpoint:

```bash
emit_task_event TASK_START refreshPinnedTagTLs
curl -s -X POST http://127.0.0.1:7778/api/trusted-list/refresh-all-pinned-tags \
     | tee -a "$LOG"
emit_task_event TASK_END refreshPinnedTagTLs
```

**(3) Core refresh module.** New file `src/api/trustedList/refreshPinnedTags.js`
exporting `refreshAllPinnedTags()`, `refreshPinnedTagsForViewer(viewerPubkey)`,
and `refreshOnePinnedTag(pinEvent)`. All three converge on the same
per-pin pipeline:

```
runOnePin(pinEvent):
  curation = parseCurationMethod(pinEvent)
  tagEventId = parsePinTagEventId(pinEvent)
  if curation.method !== 'nip85:rank':
    writeStatus(pinEvent.id, 'unsupported', { reason: 'method ...' })
    return
  observer = curation.observer
  { povSuffix, minRank } = resolvePov({ wotPov:'user', userPubkey: observer })
  if !povSuffix || !Number.isFinite(minRank):
    writeStatus(pinEvent.id, 'error', { reason: 'POV not configured for observer' })
    return
  members = computeMembership({ tagEventId, povSuffix, minRank, cutoff: curation.cutoff })
  tag = lookupTagEvent(tagEventId)   // for slug/name/authorPubkey
  if !tag:
    writeStatus(pinEvent.id, 'error', { reason: 'referenced tag event missing' })
    return
  await publishTL({ pinEvent, tag, observer, members, curation, povSuffix, minRank })
  writeStatus(pinEvent.id, 'ok', { tlEventId, lastRefreshAt: now, dTag, memberCount })
```

`computeMembership` is a thin function in the new module that **imports
`handleProfilesTagged`'s inner logic directly** rather than going through
HTTP. Concretely: refactor the body of `handleProfilesTagged` (lines
593–693) to extract a pure `aggregateProfilesTagged({ tagEventId, povSuffix,
minRank })` helper that returns `Map<targetPubkey, { applications, disputes }>`
*without* the response-shape enrichment (no displayName/picture lookup,
no viewer-union, no Meili enrichment overhead). Both `handleProfilesTagged`
and `computeMembership` call it. Single source of truth; no duplicated
WoT-filter logic; no HTTP-to-self overhead during the cron.

`publishTL` builds the kind-30392 wire shape per the layout below and
calls `handlePublishTrustedList` via direct function import (also
refactored: extract a `buildAndPublishTL({...})` async function from
the body of the route handler, so the route handler becomes a thin
HTTP adapter over the same function the cron uses).

**(4) Refresh endpoints.** Three new routes on the existing `trustedList`
module:

- `POST /api/trusted-list/refresh-all-pinned-tags` — body: none. Called by
  the cron orchestrator. **No auth gate** (LAN-only / loopback-only, per
  the existing run-task convention; the scheduler hits `127.0.0.1`).
  Runs every pin sequentially; returns aggregated result `{success, pins:
  [{pinEventId, status, ...}]}`.
- `POST /api/trusted-list/refresh-pinned-tag` — body: `{ pinEventId }`.
  **Auth gate:** session pubkey must equal `pinEvent.pubkey` (a user can
  only refresh their own pins). Returns `{ success, status, tlEventId? }`.
- `POST /api/trusted-list/refresh-pinned-tags-for-viewer` — query:
  `viewerPubkey=<hex>`. **Auth gate:** session pubkey must equal
  `viewerPubkey`. Iterates the viewer's pins sequentially; returns
  aggregated `{success, pins: [{pinEventId, status, ...}]}`.

**Resolves story open question on auth gate:** authenticated AND scoped
to own pins. The TA does the signing — the auth gate exists to prevent
drive-by refresh-flooding by arbitrary callers, not to authorize the
crypto.

**Resolves "per-tick when toggle off":** the toggle controls only the
scheduler. All three refresh endpoints are always callable (subject to
their auth gates); the toggle gating only suppresses the periodic call.

**Resolves "Refresh all behavior":** sequential, single aggregate
response. Trade: user waits for all pins to refresh before getting the
final status, but for v1 with ~handfuls of pins this is acceptable, and
sequential implicitly throttles strfry writes.

**(5) Per-pin status — derived from strfry, no on-disk persistence.**

Per-pin `tlStatus` is *computed at read time* by `handlePins` looking
up each pin's would-be TL event in local strfry:

```
deriveStatus(pinEvent):
  curation = parseCurationMethod(pinEvent)
  if curation.method !== 'nip85:rank':
    return { status: 'unsupported' }
  tlDTag = `tl-pin-${observer8}-${tagAuthor8}-${tagSlug}`
  // batched: one strfry scan for all pins' dTags returns all TLs.
  tlEv = strfry scan { kinds:[30392], authors:[TA], '#d':[tlDTag] } -> latest by created_at
  if !tlEv:
    return { status: 'never' }
  retracted = tlEv.tags.some(t => t[0]==='status' && t[1]==='retracted')
  return {
    status: retracted ? 'retracted' : 'ok',
    lastRefreshAt: tlEv.created_at,
    tlEventId: tlEv.id,
    memberCount: tlEv.tags.filter(t => t[0]==='p').length,
  }
```

`handlePins` does one batched `{kinds:[30392], authors:[TA], '#d':[...all
viewer's pin tlDTags]}` scan, maps results by d-tag, attaches `tlStatus`
to each row. Cost: one extra strfry scan per `/pins` request, batched
across pins; negligible at v1 scale.

**Status states are derivable; error states are not.** Without a
persistence layer, the cron's per-pin failures (Neo4j unreachable,
observer POV not configured, strfry publish failed, etc.) are NOT
surfaced as a per-row reason on `/pins`. From the UI's perspective such
pins simply show `status: 'never'` — indistinguishable from "never
attempted." This is a deliberate v1 trade — see the cons section. The
cron's structured-log events (`/var/log/brainstorm/taskQueue/events.jsonl`)
are the diagnostic surface for ops.

Manual refresh actions DO surface errors **transiently**: the
HTTP response from `POST /api/trusted-list/refresh-pinned-tag` (or
`-for-viewer`) carries `{success: false, error: "..."}` on failure;
the client `useRefreshPin` hook surfaces it as an inline error / toast
that fades on next page interaction. The `/pins` row's `tlStatus`
itself doesn't carry that message.

**(6) Refresh-on-pin (best-effort, fire-and-forget).** When a user
clicks Pin on the tag detail page, Story-10's `handlePin` already
awaits `pinTag()` which returns the signed pin event. After
`refetchHeader()` succeeds, the page fires a non-blocking
`POST /api/trusted-list/refresh-pinned-tag` with the new
`pinEventId`. The UI does not wait for it — the Pin button flips to
Unpin immediately on the existing path, and the user can navigate to
`/pins` whenever; the TL appears there once the refresh completes.

If the refresh-on-pin call fails (server down, auth lapsed,
membership-compute error), the pin still landed in strfry, so the
state is consistent with "the user pinned but the TL hasn't been
generated yet." Manual "Refresh now" on `/pins` is the recovery path,
and the next cron tick will pick it up regardless.

This eliminates the "weird moment" where a user pins something and
sees nothing happen downstream until the next cron tick. The fix is
purely client-side (one extra HTTP call from `Tag.jsx`'s `handlePin`)
— no new server surface, no protocol change.

**TL wire shape (kind-30392) — composition:**

```js
{
  kind: 30392,
  pubkey: "<TA pubkey>",
  created_at: <unix>,
  tags: [
    ["d", `tl-pin-${observer.slice(0,8)}-${tag.authorPubkey.slice(0,8)}-${tag.slug}`],
    ["title", tag.name],
    ["metric", "pinned-tag-membership"],
    ["observer", observer],
    ["source-tag", tag.eventId, tag.authorPubkey, tag.slug],
    ["cutoff", String(curation.cutoff)],
    ["min-rank", String(minRank)],
    // One `p` tag per member; existing reader expects [pubkey, relay, score].
    // v1 default has includeScoreInTL=false → no score, no relay.
    ...members.map((m) => ["p", m.pubkey]),
  ],
  content: JSON.stringify({
    members: members.map((m) => ({
      pubkey: m.pubkey, endorsements: m.applications, disputes: m.disputes,
    })),
  }),
}
```

Rationale:

- **`d`-tag** = `tl-pin-<observer8>-<tagAuthor8>-<tagSlug>`. Encodes the
  `(observer, tag-by-author+slug)` identity that AC-2 names. Two distinct
  observers pinning the same tag → distinct TL slots. Same observer pinning
  the same slug from two different authors → distinct TL slots
  (tag-author-pubkey disambiguates). The pin-event-id is *not* in the d-tag
  because the pin event id changes on re-pin (after unpin), and AC-9 wants
  re-pinning to refresh the *same* TL slot, not orphan a new one.
- **`title`, `metric`** present so the existing TrustedListDetail page
  renders a human-readable header.
- **`observer`, `source-tag`, `cutoff`, `min-rank`** as plain event tags so
  consumers can interpret a TL standalone (the v1 product constraints from
  the story).
- **`p` tags carry pubkey only** (no relay, no score) — keeps the existing
  reader's `[pubkey, relay, score]` parse loop intact and respects the
  Story-10 `includeScoreInTL=false` default. Once Story-11 (epic-internal)
  lets users flip `includeScoreInTL=true`, this code site adds the rank
  score as the third element of the `p` tag and the score column lights up
  in the existing reader automatically.
- **Per-member endorsement/dispute counts** in the JSON `content` body
  rather than parallel tags. Single readable payload; existing tag-loop
  reader is unaffected; future enriched-reader (Story-13 onward) parses
  content.

**Retraction (AC-9): empty replacement, derived from strfry — no
status-file diff.**

On each cron tick, the refresh module:

1. Scans live strfry for current pin events:
   `currentPins = strfry { kinds:[39999], '#z':[TAG_PINNING_Z_TAG] }`
   (deduped). Build `currentDTags = Set` from each pin's computed
   `tl-pin-<observer8>-<tagAuthor8>-<tagSlug>`.
2. Scans live strfry for all TA-signed pinned-tag TLs:
   `allOurTLs = strfry { kinds:[30392], authors:[TA] }`, filtered to
   those whose `d`-tag starts with `tl-pin-`. (The prefix is this
   codebase's convention; no other write path uses it.)
3. For each TL whose `d`-tag is NOT in `currentDTags` AND which does
   NOT already carry a `["status","retracted"]` marker tag: publish an
   empty-membership replacement (same `kind=30392`, same `d`-tag,
   `created_at = now`, no `p` tags, `["status","retracted"]` marker,
   empty content body). The relay's addressable-replaceable index now
   resolves the slot to an empty TL.

The "already retracted" check (the marker tag on step 3) is the
idempotency guard that prevents the cron from re-emptying a slot on
every subsequent tick. The diff is fully derivable from strfry — no
local state needed.

Empty replacement was chosen over kind-5 deletion because:
- It uses the same wire shape the cron uses everywhere else (one event
  type to read).
- Consumers parsing the relay over time see a clean
  "TL slot went to 0 members at timestamp T" signal rather than a
  bare deletion notice.
- A future TL reader could distinguish "retracted" from "no members
  passed the disputes function" via the `["status", "retracted"]` tag.

**UI surfaces.**

Settings → Scheduled Tasks (AC-6): one more `<ScheduledTaskCard>` rendered
by `ScheduledTasksPanel` in `ui/src/pages/settings/RelaySettings.jsx`
(the same component extracted in ADR 0003). Props:
`taskId="refreshPinnedTagTLs"`, `title="Pinned-tag Trusted List refresh"`,
hint copy explaining that this generates kind-30392 events for each
pinned tag under its observer's POV.

`/pins` page (`ui/src/pages/Pins.jsx`): each pin row gains:
- A **status indicator** (small text/badge) showing `tlStatus.status` and
  `lastRefreshAt` (`'Refreshed <X> ago'` / `'Never refreshed'` / `'Refresh
  failed: <reason>'` / `'Unsupported curation method'`).
- A **"Refresh now"** button per row (disabled when status is
  `unsupported`).
- A **"Refresh all"** button at the top of the list (hidden when no
  pins exist or when all pins are `unsupported`).

The hook `usePins` is extended to read the new `tlStatus` field from
each row's response. A new hook `useRefreshPin(viewerPubkey)` wraps
the two refresh endpoints and exposes `{ refreshing, refreshOne,
refreshAll, lastResult, error }`.

**Pros:**

- Five small, composable extensions to existing primitives — no new
  scheduler, no new publish path, no new Meili column, no new firmware
  concept.
- Honors all three CLAUDE.md invariants — POV is per-pin, derived at
  read time from live assertions; the TA signs a derivation, not an
  authority.
- The membership compute reuses `handleProfilesTagged`'s WoT-filter
  logic via a refactored pure helper — single source of truth. Future
  POV-correctness fixes in `aggregateProfilesTagged` flow automatically
  to TL generation.
- The publish primitive (`handlePublishTrustedList`) is also factored
  into a pure-function form callable from the cron without HTTP-to-self.
- d-tag composition is stable across re-pin cycles (excludes pin
  event id) so AC-9 retraction works without orphaned slots.
- Empty-replacement retraction stays inside the same wire shape — one
  event type for consumers to read; no kind-5 special-case.
- AC-10 honored: the existing TrustedListDetail page reads the new TLs
  unchanged (its tag-loop ignores `observer`/`source-tag`/`cutoff`/
  `min-rank`; `title` and `metric` and `p` tags render as today).
- **Zero new persistent surfaces.** Status is derived from strfry on
  every `/pins` request; retraction is derived from a strfry diff;
  no JSON files, no atomic-write concerns, no fan-out scale problems.
  Strfry is already the source of truth for the wire-shape data
  (pins + TLs); the codebase doesn't introduce a parallel one.
- **Refresh-on-pin closes the "I just pinned, why is nothing
  happening" gap.** A user pinning a tag triggers an immediate TL
  generation in the background; the `/pins` page shows the new TL on
  next render. No protocol change; one extra fire-and-forget HTTP
  call from `Tag.jsx`'s `handlePin`.

**Cons:**

- Refactor of `handleProfilesTagged` (extracting `aggregateProfilesTagged`)
  is mechanical but touches code Story 3/4/9 depend on. Mitigated by
  the existing test suites — if the refactor preserves the
  byTarget/sort/response shape, all those tests stay green.
- Same shape applies to extracting `buildAndPublishTL` from
  `handlePublishTrustedList`. The route handler becomes a thin
  argument-parse adapter over the same function.
- **No persistent error-reason visibility.** Per-pin failures during
  the cron (Neo4j unreachable, observer POV not configured, strfry
  write failed) are NOT surfaced as a per-row reason on `/pins` — the
  row simply shows `status: 'never'`. Ops diagnose via the
  structured task log (`events.jsonl`); end users see only the
  current outcome, not the history. Story-10's pin row currently
  doesn't surface error history either, so this is consistent with
  the existing UX. Transient errors from explicit "Refresh now"
  clicks DO surface via HTTP response → inline error in the UI.
- Sequential "Refresh all" trades responsiveness for simplicity. With
  hundreds of pins, the UX would suffer; not a v1 concern, but the
  upgrade path (worker pool or async queue + a status surface — likely
  reintroduced when scale forces it) is straightforward when needed.
- The retraction diff scans the *entire* TA-signed kind-30392 set in
  local strfry on every cron tick. For very long-lived instances with
  many historical TLs this is O(N) per tick. v1 acceptable; if it
  becomes hot, indexing by d-tag prefix in strfry — or just gating the
  scan to TLs younger than the last cron run — is the optimization.
- The new `observer` / `source-tag` / `cutoff` / `min-rank` tags are
  *this codebase's* convention, not part of the public kind-30392 spec
  yet. Other clients reading the relay can ignore them; this codebase's
  enriched reader (a follow-up surface) will know how to consume them.
- We never publish to external relays in v1 (per epic). Cross-app
  consumption requires Story-14 (Treasure Map integration) to surface
  the d-tags upward.

### Option B — Dedicated micro-service / separate process for TL generation

A new Node process under supervisor (`brainstorm-tl-cron` or similar)
owning the scheduler tick + membership compute + publish. Communicates
with the main process via the relay (the new process is just another
nostr client).

**Pros:**
- Failure isolation: a hung TL refresh doesn't block other API requests.
- Easy to swap out (rewrite in another language without touching main).

**Cons (why rejected):**
- All the function-import sharing in Option A becomes HTTP boundaries.
  The membership compute either re-implements `aggregateProfilesTagged`
  (drift risk) or hits the API over HTTP (overhead).
- One more supervisor program to manage; one more log stream.
- Auth + ownership checks become more complex (the new process doesn't
  share the session store).
- v1 has no need for failure isolation: the existing scheduler runs
  in-process for two other tasks and that's been fine.

### Option C — Client-side TL generation

The user's browser, after pinning, holds responsibility for periodically
re-publishing kind-30392 (signing with their own NIP-07 key, not the TA).

**Pros:**
- No server-side cron at all — simplifies infrastructure.
- TL author = the observer (cleaner identity story).

**Cons (why rejected):**
- Requires the browser tab to be open at the moment a refresh fires —
  cron-on-a-browser-tab is famously unreliable. The story explicitly
  says "periodically generate and publish" without a "while the user is
  online" qualifier.
- Each refresh prompts the user to approve a NIP-07 signature — degrades
  UX to the point of probably being uncheckable.
- The epic explicitly specifies "TA-side cron" for this exact reason.

### Option D — Eagerly compute TLs at pin time; nightly re-emit instead of recompute

Pin → immediately compute initial TL → write it once → cron job
re-emits the *same* TL nightly (just refreshing `created_at`).

**Pros:**
- Removes the recompute load from the cron.

**Cons (why rejected):**
- The whole point of the cron is to *re-derive*. Endorsements and
  disputes change over time (new assertions get authored; assertion
  authors enter/leave the WoT). Re-emitting yesterday's membership
  defeats the purpose.
- Story AC-5 binds the *current* counts to the disputes function — not
  yesterday's snapshot.

### Option E — Compute membership over HTTP instead of via direct function import

The refresh module hits its own server's `/api/profile-tags/profiles-tagged`
endpoint via HTTP (`http://127.0.0.1:7778`) rather than importing
`aggregateProfilesTagged` directly.

**Pros:**
- Zero refactor of `handleProfilesTagged`.

**Cons (why rejected):**
- Per-pin: at least one HTTP round-trip plus full response-shape
  marshalling (including Meili-enrichment work we don't need —
  `displayName`/`picture` lookups for every member).
- Logical coupling without programmatic sharing — when `handleProfilesTagged`
  evolves, the cron's expectations drift.
- Authentication or rate-limit middleware at some future point would
  surprise the loop. Direct function calls are immune.

## Decision

**Option A.** Extend the existing scheduler with one `DEFAULTS` entry; add
one orchestrator shell script + `taskRegistry` entry; introduce a
`refreshPinnedTags.js` module that owns the per-pin pipeline; refactor
`handleProfilesTagged` and `handlePublishTrustedList` to expose their
core logic as pure functions; add three refresh endpoints (one cron-side,
two user-side with auth + ownership gates); persist per-pin status in a
JSON file; retract unpinned TLs via empty replacement.

Why: it's the smallest set of additions that reuses every existing
primitive (`handleProfilesTagged` for WoT-filtered counts;
`handlePublishTrustedList` for the publish + sign path;
`scheduled-tasks` for the cron + UI panel pattern;
`TrustedListDetail.jsx` for the read surface), respects all three
CLAUDE.md invariants (POV-per-pin, decentralized publication, view-time
filtering), and produces TLs that the existing read surface renders
unchanged (AC-10).

## Consequences

**Enables:**
- Pinned tags become productized: each pin generates a self-describing
  kind-30392 TL refreshed on a cadence, consumable by any nostr client
  reading local strfry.
- Single mechanism for the cron path, the manual refresh paths, and
  refresh-on-pin: same `runOnePin()` function with three callers
  (cron orchestrator, user-triggered HTTP endpoints, and the client-side
  fire-and-forget after a successful Pin).
- Refresh-on-pin eliminates the "weird moment" between pinning and the
  TL appearing.
- The factored `aggregateProfilesTagged` and `buildAndPublishTL` helpers
  become reusable for future stories (Story-13 "most pinned"
  aggregation can reuse `aggregateProfilesTagged` for its tag-wide
  scan; future score-bearing TL stories reuse `buildAndPublishTL`
  with `includeScoreInTL=true` arg).
- Zero new persistence; strfry is the only source of truth for both
  the pinning state and the derived TL state.

**Constrains / makes harder:**
- `handleProfilesTagged` and `handlePublishTrustedList` route bodies
  become thin adapters around the new pure helpers. Story 3/4/9 test
  suites must remain green through the refactor — mitigated by Tester
  in Phase 3 explicitly running those suites + the new ones.
- The new metadata tags (`observer`, `source-tag`, `cutoff`,
  `min-rank`) are codebase convention, not (yet) public NIP. External
  clients reading our TLs are forward-compatible (they ignore
  unknown tags) but not interoperably-informed. Acceptable for v1;
  a NIP write-up is a follow-up if external interest emerges.
- Sequential "Refresh all" — see con above.
- Without a persistence layer, per-pin error history is lost. The
  `/pins` row's `tlStatus` is a current-state read; failed cron runs
  appear identical to "never refreshed." If product feedback demands
  per-row error reasons later, a status file becomes a justified
  addition.

**Follow-ups / debt:**
- **Customize curation at pin time** (epic-Story-11). When this lands,
  the runtime `cutoff` / `observer` / `includeScoreInTL` are read from
  the pin's curation-method directly (already happens in this ADR —
  Story-11's edit surface just writes different values). The generator
  for `includeScoreInTL=true` is a 3-line add (third element of `p`
  tag).
- **Methods other than `nip85:rank`.** Each future method maps to a
  new branch inside `computeMembership`. The scaffolding is uniform.
- **"Most pinned" aggregation** (epic-Story-13). The cron's pin scan
  already enumerates every pin in local strfry — a sibling helper that
  buckets by tagEventId and reports counts under the active POV's
  WoT-author filter is straightforward.
- **External-relay broadcast** (Story-14 territory). Currently
  publish-local-only via `strfry import`. A future story can extend
  `buildAndPublishTL` with an external-relay broadcast pass.
- **Retraction tombstone style.** If a future product decision favors
  kind-5 deletion (e.g., for relay storage hygiene), the refresh
  module's `retract(...)` function is the single site to change.
- **Status-file fan-out / atomic writes.** Mechanical scale-up when
  pin counts grow.
- **Hook-up to a "tag detail page" indicator.** Currently a user sees
  TL status on `/pins` only. A future story could surface "this pin's
  TL was last refreshed N hours ago" inline on the tag detail page's
  Pin affordance.

**Firmware reinstall required?** **No.** Pure code change.

## Implementation notes

Concrete guidance for the Implementer.

### Server — `src/api/profile-tags/index.js`

**Refactor (no behavior change):** Extract `aggregateProfilesTagged` from
`handleProfilesTagged` (lines 593–693). Signature:

```js
async function aggregateProfilesTagged({ tagEventId, povSuffix, minRank }) {
  // Same strfry scan + dedupe + author-WoT-filter + bucket loop the
  // existing handler runs. Returns:
  //   { byTarget: Map<targetPubkey, { pubkey, applications, disputes }>,
  //     wotFiltering: boolean }
  // No Meili-enrichment, no viewer-union, no sort, no response shape.
}
```

`handleProfilesTagged` becomes: parse-and-validate query → `resolvePov` →
`aggregateProfilesTagged(...)` → viewer-union pre-pass → Meili-enrichment
→ sort → respond. All existing tests should pass unchanged.

Export `aggregateProfilesTagged` from the module.

**Extend `handlePins`** (lines 1139–1207) to enrich each row with a
`tlStatus` field **derived from strfry** (no on-disk file). Pseudocode:

```js
// After the existing pin-event aggregation, before responding:
function computeTLDTag({ observer, tagAuthorPubkey, tagSlug }) {
  return `tl-pin-${observer.slice(0,8)}-${tagAuthorPubkey.slice(0,8)}-${tagSlug}`;
}
const TA_PUBKEY = '<resolved at module init from getOwnerAssistantKeys()>';

const rowsWithMeta = pins.map(p => ({
  ...p,
  _curationMethod: parseCurationMethod(p._pinEvent), // already computed
  _dTag: computeTLDTag({
    observer: parseCurationMethod(p._pinEvent)?.observer,
    tagAuthorPubkey: p.tag.authorPubkey,
    tagSlug: p.tag.slug,
  }),
}));

// One batched scan for all TL slots:
const allDTags = rowsWithMeta
  .filter(r => r._curationMethod?.method === 'nip85:rank' && r._dTag)
  .map(r => r._dTag);
let tlByDTag = new Map();
if (allDTags.length > 0) {
  const tls = await strfryScan({
    kinds: [30392],
    authors: [TA_PUBKEY],
    '#d': allDTags,
  });
  // Latest per d-tag wins (kind-30392 is addressable replaceable; defensive).
  for (const ev of tls) {
    const d = (ev.tags||[]).find(t=>t[0]==='d')?.[1];
    if (!d) continue;
    const cur = tlByDTag.get(d);
    if (!cur || ev.created_at > cur.created_at) tlByDTag.set(d, ev);
  }
}

for (const row of rowsWithMeta) {
  const method = row._curationMethod?.method;
  if (method !== 'nip85:rank') {
    row.tlStatus = { status: 'unsupported', lastRefreshAt: null, tlEventId: null, memberCount: null };
    continue;
  }
  const tl = tlByDTag.get(row._dTag);
  if (!tl) {
    row.tlStatus = { status: 'never', lastRefreshAt: null, tlEventId: null, memberCount: null };
    continue;
  }
  const retracted = (tl.tags||[]).some(t => t[0]==='status' && t[1]==='retracted');
  row.tlStatus = {
    status: retracted ? 'retracted' : 'ok',
    lastRefreshAt: tl.created_at,
    tlEventId: tl.id,
    memberCount: (tl.tags||[]).filter(t => t[0]==='p').length,
  };
}

// Strip the underscore-prefixed temp fields before responding.
```

The TA pubkey can be resolved lazily at first call via
`getOwnerAssistantKeys()` (mirroring `loadTAKey` in `src/api/trustedList/index.js`)
and cached at module scope. No new state across requests.

### Server — `src/api/trustedList/index.js`

**Refactor:** Extract `buildAndPublishTL` from `handlePublishTrustedList`:

```js
async function buildAndPublishTL({
  kind, dTag, title, metric, items, extraTags = [], content = '',
}) {
  // Same signing + publish path the route handler runs. `extraTags`
  // appends additional [k, v, ...] arrays to the tag list before
  // signing. `content` carries the JSON body (default '').
  // Returns { event, uuid }.
}
```

`handlePublishTrustedList` becomes a thin adapter that parses+validates
the request body and calls `buildAndPublishTL`. Existing API contract
unchanged; the existing tests for `/api/trusted-list/publish` stay green.

Export `buildAndPublishTL`.

### Server — new module `src/api/trustedList/refreshPinnedTags.js`

Exports `refreshAllPinnedTags()`, `refreshPinnedTagsForViewer(viewerPubkey)`,
`refreshOnePinnedTag(pinEvent)`. Internal helpers:

- `enumeratePinnedTags()` → strfry scan for `{kinds:[39999], '#z':[TAG_PINNING_Z_TAG]}`,
  `dedupeReplaceable`. Returns the deduped pin events.
- `lookupTagEvent(tagEventId)` → strfry scan `{kinds:[39999], ids:[tagEventId]}`,
  `parseTagPayload`. Returns `{ eventId, slug, name, authorPubkey } | null`.
- `computeMembership({ tagEventId, povSuffix, minRank, cutoff })` →
  calls `aggregateProfilesTagged`, applies disputes function
  (`apps >= cutoff && apps > disputes`), returns `[{ pubkey, applications,
  disputes }, ...]`.
- `runOnePin(pinEvent)` — the orchestrator pipeline described in
  Option A pseudo-code. Returns `{ status, error?, tlEventId?, dTag?,
  memberCount? }`. No persistence side-effect; logs errors to the
  structured task log via the orchestrator's stdout (cron path) or
  swallows them silently (refresh-on-pin best-effort path).
- `retractStaleTLs()` — derive-from-strfry diff:
  1. Scan current pins; build `currentDTags = Set` from each pin's
     `(observer, tagAuthor, tagSlug)`.
  2. Scan all TA-signed kind-30392 events; filter to those with
     `d`-tag starting `tl-pin-`.
  3. For each TL whose `d`-tag is NOT in `currentDTags` AND which
     doesn't already carry `["status","retracted"]`: publish an empty
     replacement via `buildAndPublishTL` (kind=30392, same `d`-tag,
     no `p` tags, marker tag, empty content).

`refreshAllPinnedTags`:
1. `pins = await enumeratePinnedTags()`
2. `for (const pin of pins) await runOnePin(pin)` — sequential.
3. `await retractStaleTLs()`
4. return `{ pins: results }`.

`refreshPinnedTagsForViewer(viewerPubkey)`:
1. Like above but filter pins to `pin.pubkey === viewerPubkey`.
2. Does NOT call `retractStaleTLs` (single-viewer scope; another
   viewer's pins should not be touched).

`refreshOnePinnedTag(pinEvent)`:
1. `await runOnePin(pinEvent)`.

### Server — three new routes on `trustedList`

In `src/api/trustedList/index.js`'s `register(app)`:

```js
app.post('/api/trusted-list/refresh-all-pinned-tags', handleRefreshAllPinnedTags);
app.post('/api/trusted-list/refresh-pinned-tag', handleRefreshOnePinnedTag);
app.post('/api/trusted-list/refresh-pinned-tags-for-viewer', handleRefreshForViewer);
```

Handlers:

- `handleRefreshAllPinnedTags(req, res)` — calls
  `refreshAllPinnedTags()`. Responds with `{success, pins:[...]}`. No
  auth gate (cron is loopback-only by convention; the existing
  `updateAllScoresForOwner` and `refreshSearchIndex` orchestrators
  also call no-auth-gated endpoints under the same pattern).
- `handleRefreshOnePinnedTag(req, res)` — body `{ pinEventId }`. Looks
  up the pin event; verifies session pubkey via the auth-status
  middleware that profile-tag endpoints already use; rejects 403 if
  `pinEvent.pubkey !== sessionPubkey`. Calls `refreshOnePinnedTag(pin)`.
  Responds `{success, status, ...}`.
- `handleRefreshForViewer(req, res)` — query `viewerPubkey`. Verifies
  session matches `viewerPubkey`; 403 otherwise. Calls
  `refreshPinnedTagsForViewer(viewerPubkey)`. Responds `{success, pins:[...]}`.

The session-pubkey lookup uses the existing auth-status pattern from
`src/api/profile-tags/index.js` or its equivalent — Implementer to
confirm the existing helper path (`req.session?.user?.pubkey` or
similar; an existing tag-write endpoint should show the canonical
form).

### Server — `src/api/scheduled-tasks/index.js`

Add one entry to the `DEFAULTS` map at line 19:

```js
refreshPinnedTagTLs: { enabled: false, intervalHours: 24, intervalDays: 0 },
```

No other changes required — the generalized scheduler picks it up.

### Server — `src/manage/taskQueue/taskRegistry.json`

Add a `refreshPinnedTagTLs` entry pointing at the new orchestrator
script (`src/algos/refreshPinnedTagTLs.sh`). Mirror the shape of the
`refreshSearchIndex` entry from ADR 0003 (category, paths, etc.).

### Server — new orchestrator `src/algos/refreshPinnedTagTLs.sh`

Pseudocode:

```bash
#!/usr/bin/env bash
set -euo pipefail
source "$BRAINSTORM_LIB_DIR/structuredLogging.sh"

emit_task_event TASK_START refreshPinnedTagTLs
resp=$(curl -sf -X POST http://127.0.0.1:7778/api/trusted-list/refresh-all-pinned-tags || true)
if [ -z "$resp" ]; then
  emit_task_event WARN refreshPinnedTagTLs '{"reason":"refresh endpoint failed"}'
fi
emit_task_event TASK_END refreshPinnedTagTLs
```

### Client — `ui/src/pages/Tag.jsx` (Story 10's pin handler)

Extend Story-10's `handlePin` (`ui/src/pages/Tag.jsx`) to fire a
best-effort refresh after the Pin event publishes successfully:

```jsx
const handlePin = async () => {
  if (!tag) return;
  setPinning(true); setPinError(null);
  try {
    const signed = await pinTag({ tag });        // returns the signed pin event
    await refetchHeader();
    // Refresh-on-pin (Story 11): fire-and-forget. Best-effort.
    fetch('/api/trusted-list/refresh-pinned-tag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinEventId: signed.id }),
    }).catch(() => { /* swallow — user can manually refresh from /pins */ });
  } catch (e) { setPinError(e.message || 'Pin failed'); }
  finally { setPinning(false); }
};
```

`unpinTag` doesn't need a callback — the cron's `retractStaleTLs`
phase handles unpinned slots. (If product feedback says retraction
should happen instantly, the same fire-and-forget shape applies here
later: a `/api/trusted-list/retract-pinned-tag` endpoint. Not in v1.)

### Client — `ui/src/hooks/usePins.js`

No behavioral change beyond what the server returns. The
`tlStatus` field now appears on each row; existing destructuring
(`row.tag`, `row.pinEventId`, `row.curationMethod`) is unchanged.

### Client — new hook `ui/src/hooks/useRefreshPin.js`

```js
export default function useRefreshPin(viewerPubkey) {
  const [refreshing, setRefreshing] = useState(null); // null | 'one:<id>' | 'all'
  const [lastResult, setLastResult] = useState(null);
  const [error, setError] = useState(null);

  const refreshOne = useCallback(async (pinEventId) => {
    setRefreshing(`one:${pinEventId}`); setError(null);
    try {
      const r = await fetch('/api/trusted-list/refresh-pinned-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinEventId }),
      });
      const data = await r.json();
      if (!r.ok || !data.success) throw new Error(data?.error || `status ${r.status}`);
      setLastResult(data);
      return data;
    } catch (e) { setError(e.message); throw e; }
    finally { setRefreshing(null); }
  }, []);

  const refreshAll = useCallback(async () => { /* analogous, hits refresh-pinned-tags-for-viewer */ }, [viewerPubkey]);

  return { refreshing, refreshOne, refreshAll, lastResult, error };
}
```

### Client — `ui/src/pages/Pins.jsx`

Each row (`<li class="bs-pins-row">`) gains:

- A `<span class="bs-pins-row-status">` rendering one of:
  - `'Refreshed <X> ago'` (status='ok')
  - `'Never refreshed'` (status='never')
  - `'Refresh failed: <reason>'` (status='error')
  - `'Unsupported curation method (v1 supports nip85:rank only)'`
    (status='unsupported')
  - `'Retracted'` (status='retracted'; pin still exists but the TL was
    most recently retracted — should be rare given retraction targets
    pins that no longer exist; surface anyway for debugging).
- A `<button class="bs-pins-row-refresh">Refresh now</button>`
  (disabled when status='unsupported' or `refreshing === 'one:<this id>'`).

Above the `<ul>`, a `<button class="bs-pins-refresh-all">Refresh all</button>`
(disabled while `refreshing === 'all'` or while no refreshable pins
exist).

Wire these via the new `useRefreshPin(user.pubkey)` hook + the
existing `usePins.refetch()` (call after a successful refresh so the
status display updates).

### Client — `ui/src/pages/settings/RelaySettings.jsx`

Add one more `<ScheduledTaskCard>` instance inside `ScheduledTasksPanel`:

```jsx
<ScheduledTaskCard
  taskId="refreshPinnedTagTLs"
  title="Pinned-tag Trusted List refresh"
  hint="Periodically generates a NIP-85 Trusted List (kind-30392) for every pinned tag, computed under that pin's observer POV using the pin's curation-method. Default schedule: every 24 hours."
/>
```

(No banner needed; the panel works without further configuration once
any user has pinned at least one tag with a resolvable POV.)

### CSS — `ui/src/styles.css`

Append under the existing `bs-pins-*` namespace:

- `.bs-pins-row-status` — status text styling (variants for ok / error /
  unsupported / never / retracted).
- `.bs-pins-row-refresh` — per-row refresh button.
- `.bs-pins-refresh-all` — list-top refresh-all button.
- Spinner / loading affordance during in-flight refreshes.

### Tests (Tester writes these — surfaces listed so the Implementer knows the contract)

**Contract:**
- `POST /api/trusted-list/refresh-all-pinned-tags` returns
  `{success: true, pins: []}` when no pins exist.
- `POST /api/trusted-list/refresh-pinned-tag` 400s on missing
  `pinEventId`, 404s on unknown, 403s on session-mismatch.
- `POST /api/trusted-list/refresh-pinned-tags-for-viewer` 400s on
  missing/malformed `viewerPubkey`, 403s on session-mismatch.
- `/api/profile-tags/pins` rows now carry a `tlStatus` object with
  `status` ∈ `{'ok','never','unsupported','retracted'}`, `lastRefreshAt`,
  `tlEventId`, `memberCount` fields. Default `{status: 'never', ...}`
  when no TL event is present in strfry. No `error` field (intentional —
  see ADR).
- `scheduled-tasks` recognizes `refreshPinnedTagTLs`: status, update,
  history endpoints all 200 with the new taskId.

**Publish-flow (live):**
- Pinning a tag, then triggering refresh, results in a kind-30392 event
  in local strfry with: TA pubkey signer, the expected `d`-tag shape,
  `["observer", <observer>]`, `["source-tag", <tagEventId>, <author>,
  <slug>]`, `["cutoff", "2"]`, `["min-rank", "<n>"]`, one `p` tag per
  member that passes the disputes function, and a JSON `content` body
  with per-member counts.
- The disputes function filters correctly: a target with 1 trust-trusted
  endorsement and 0 disputes is included when cutoff=1; excluded when
  cutoff=2. A target with 2 endorsements and 3 disputes is excluded
  (endorsements not > disputes).
- Refreshing the same pin a second time replaces the prior TL in place
  (no duplicate events for the same `d`-tag; latest `created_at` wins).
- Unpinning a tag, then triggering `refresh-all-pinned-tags`, results
  in an empty-replacement TL for the prior `d`-tag (kind=30392, no `p`
  tags, `["status","retracted"]` marker).
- Pin events with `curation-method.method !== 'nip85:rank'` produce
  `tlStatus.status === 'unsupported'` and no published TL.
- Pin events whose observer has no resolvable POV produce
  `tlStatus.status === 'never'` (no TL emitted; error visible only
  in the HTTP response of a manual refresh, not as persistent state).
- **Refresh-on-pin:** publishing a Pin event from the UI fires a
  best-effort `POST /api/trusted-list/refresh-pinned-tag`. After it
  completes, the same pin's row on `/pins` reads `tlStatus.status ===
  'ok'` with a recent `lastRefreshAt`. The Pin button does NOT block
  on the refresh — it flips to "Unpin" as soon as the underlying
  `pinTag()` resolves.

**UI:**
- `/pins` row shows refresh status; "Refresh now" triggers
  `refresh-pinned-tag` and the row's status updates after.
- "Refresh all" triggers `refresh-pinned-tags-for-viewer`; all rows
  update; sequential progress visible.
- Settings → Scheduled Tasks has a panel for `refreshPinnedTagTLs`;
  enabling it persists; the cron tick triggers the orchestrator script.
- Unsupported-method pin shows the hint text and the disabled Refresh
  button.
- `kind-30392` TLs generated by the cron are visible at
  `/tapestry/grapevine/trusted-lists/` (the existing list page) and
  open in `TrustedListDetail.jsx` without modification (AC-10).

## Amendment 2026-05-20 — Brainstorm-side TL consumption surfaces

After the cron + refresh-on-pin landed, the PO flagged that there was
nothing for an end user to *do* with the published TLs from inside the
Brainstorm UI — every consumption path was assumed to live in other
nostr clients. Three surfaces were added under this story to close that
gap:

1. **TL detail page at `/pin/:dTag`.** Click-through from `/pins` rows
   that have `tlStatus.status === 'ok'` (or 'retracted'). Renders the
   TL's title, observer, source-tag link, cutoff, min-rank, last
   refresh, and a member list with avatars / displayName / NIP-05 /
   endorsement+dispute counts / link to `/user/:pubkey`. Includes a
   Refresh-now button (enabled only when the viewer is the pin's
   observer) and a Share button (see #3 below). Data is fetched
   client-side: `/api/strfry/scan` for the kind-30392, `/api/profiles`
   for member enrichment. **No new server endpoint.**

2. **Search-result filter chips.** Below the Brainstorm Search input
   (both landing-page popup and Enter-results page), a chip row renders
   one chip per pinned tag the viewer has. Active chip narrows results
   to members of that TL via a client-side filter on the existing
   `results[]` / `suggestions[]` arrays. Single-select (multi-chip
   union/intersection is a follow-up). Chips disable themselves when
   the underlying TL hasn't been generated, has zero members, or is
   unsupported. **No new server endpoint.**

3. **TL share button (NIP-19 naddr).** Inline `🔗` button on each
   `/pins` row (compact variant) and on the `/pin/:dTag` page (full
   variant). Click → copies a NIP-19 `naddr` (encoding
   `kind=30392, pubkey=TA, identifier=dTag, relays=[]`) to the
   clipboard with a brief `✓` confirmation. Recipients paste it into
   other nostr clients to look up the TL on any relay that mirrors
   local strfry.

New files:
- `ui/src/pages/PinDetail.jsx` — the detail page.
- `ui/src/hooks/useTLDetail.js` — TL event + member enrichment fetch.
- `ui/src/hooks/useTagMemberSets.js` — batch fetch of all viewer
  pinned-tags' member sets, for the chip row.
- `ui/src/components/PinnedTagChips.jsx` — chip row.
- `ui/src/components/TLShareButton.jsx` — naddr-to-clipboard button.

Modified files:
- `ui/src/App.jsx` — added the `/pin/:dTag` route.
- `ui/src/pages/Pins.jsx` — rows with `tlStatus.status='ok'` (or
  'retracted') link to `/pin/:dTag` instead of `/tag/...`; Share
  button added to each row's actions.
- `ui/src/pages/BrainstormSearch.jsx` — chip row mounted in both
  landing and results layouts; `applyPinFilter` wrapper applied to
  `suggestions` (live popup) and `results` (Enter-results page).
- `ui/src/utils/publishTagPin.js` — exposed `TA_PUBKEY` so the
  client-side strfry/naddr helpers can reference it without
  re-fetching `/api/assistant/pubkey`.
- `ui/src/styles.css` — appended share / PinDetail / chip styles.

Trade-offs accepted:
- **No new server endpoint for the detail page or chips.** The
  `/api/strfry/scan` endpoint already exists (used by
  `BrainstormSettings.jsx` and others) — the client invokes it directly
  for the kind-30392 lookups. Trades a small amount of duplicated
  parsing logic between server and client against a much smaller
  server surface. If multiple future surfaces need the same
  parsed-TL-with-enriched-members payload, this would consolidate into
  a `GET /api/profile-tags/tl/:dTag` endpoint.
- **Client-side TL-membership filter on search results.** Meili's
  filter syntax does support `pubkey IN [...]`, but threading a new
  param through the Meili proxy + autocomplete pipeline is more
  surface than v1 needs. The TL member set is typically small
  (handfuls to low-hundreds); a `Set.has(pubkey)` predicate over the
  search response is O(N) on N hits. If pubkey allowlists for search
  become a recurring need, the Meili proxy is the natural extension
  point.
- **Single-chip active at a time.** Two-chip union/intersection is
  more powerful but multiplies the UX surface (operator selection,
  empty-intersection messaging, ...). v1 picks the smallest useful
  shape.
- **The PinDetail Refresh-now button re-uses the existing
  `/api/trusted-list/refresh-pinned-tag` endpoint** via a small extra
  lookup: fetch the viewer's `/api/profile-tags/pins` rows, find the
  one whose `tag.eventId` + `tag.slug` match the TL's `source-tag`,
  use its `pinEventId`. Trade: one extra round-trip per Refresh-now
  click on this page. Acceptable; avoids a new route.

Follow-ups (not in this amendment):
- Multi-chip filter UX (union / intersection).
- Server-side `GET /api/profile-tags/tl/:dTag` endpoint if multiple
  surfaces consume the same payload.
- "Filter by TL membership" surface on the tag-index `/tags` page too.
- A reverse "Which of my TLs is this profile in?" chip row on
  `/user/:pubkey` (PO explicitly skipped this in scoping).

## Out of scope

- Customizing `curation-method` (epic-Story-11).
- Methods other than `nip85:rank`.
- Per-pin cadence.
- External-relay broadcast (epic-Story-14).
- "Most pinned" tag-index aggregation (epic-Story-13).
- NIP-44 encryption (epic-Story-15).
- TL versioning / archival.
- `includeScoreInTL = true` branch (still depends on Story-11 to flip
  it; when that lands, the generator's `p`-tag emission is the only
  site to update).
- Editing or revoking individual TL members from the UI.
- Per-row persistent error history on `/pins`. Failed refreshes
  appear as `status: 'never'`. Reintroducing a status surface (file or
  similar) is the path if this hurts UX in practice.
- Instant retraction on unpin (kind-5-like hook). Cron diff handles
  it on the next tick; a future `/api/trusted-list/retract-pinned-tag`
  endpoint following the refresh-on-pin pattern is a natural follow-up.
- A NIP write-up of the `observer` / `source-tag` / `cutoff` /
  `min-rank` tag conventions.
- Parallel "Refresh all" with a worker pool.
- Hooking the refresh module to a `--single-pin` CLI for ops use.
