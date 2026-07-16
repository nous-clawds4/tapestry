# ADR 0013: Treasure Map (kind 10040) references to pinned-tag Trusted Lists

**Status:** Proposed
**Date:** 2026-05-20
**Story:** `engineering-team/stories/14-treasure-map-pin-integration.md`

## Context

Story 14 closes the cross-app discovery gap for the pin-a-tag epic.
Stories 10–13 produce signed kind-30392 Trusted Lists in local strfry
under the deployment's TA, but no external Nostr client has a way to
*discover* them: a user's identity points only at their NIP-85
kind-30382 metrics (via the user's kind-10040 Treasure Map), not at
their TA-derived TLs. This story adds rows to the user's kind-10040
that point readers at the user's pinned-tag TLs.

### Relevant existing surfaces

- **Publish flow for kind-10040 (legacy admin pages):**
  - `src/api/export/nip85/commands/create-unsigned-kind10040.js:18–147` —
    builds an unsigned template with default 30382 metric rows of the
    shape `["30382:<metric>", <relayPubkey>, <nip85HomeRelay>]`. Reads
    `BRAINSTORM_RELAY_URL` and `BRAINSTORM_NIP85_HOME_RELAY` (fallback
    to the former) from config. `relayPubkey` comes from
    `getAssistantKeys(customerPubkey)` — already deployment-runtime.
  - `src/api/export/nip85/commands/publish-signed-kind10040.js:21–157` —
    validates a NIP-07-signed event, writes to a temp file, spawns
    `bin/brainstorm-create-and-publish-kind10040.js`.
  - `bin/brainstorm-create-and-publish-kind10040.js:22–155` — broadcasts
    the *kind-10040 itself* (not the events it references) to
    `BRAINSTORM_RELAY_URL` + `BRAINSTORM_NIP85_RELAYS` +
    `BRAINSTORM_POPULAR_GENERAL_PURPOSE_RELAYS`. Existing UI callers:
    `public/pages/index.html:756`, `public/pages/customers/*.html`,
    `public/pages/nip85.html:336` — all legacy server-rendered pages.
    No React-app caller yet.

- **Pin data:** `GET /api/profile-tags/pins?viewerPubkey=<hex>` —
  `src/api/profile-tags/index.js:1274–1340` — returns
  `[{pinEventId, createdAt, curationMethod, tag:{eventId, slug, name,
  authorPubkey, ...}, tlStatus}]`. The same module already computes
  the per-pin TL d-tag at `:1374`:
  `tl-pin-${observer.slice(0,8)}-${row.tag.authorPubkey.slice(0,8)}-${row.tag.slug}`.

- **TL d-tag canonical form:** Story 11's `computeTLDTag` at
  `src/api/trustedList/refreshPinnedTags.js:66–68`:
  `tl-pin-<observer8>-<tagAuthor8>-<tagSlug>`. Used by both the
  refresher (writer) and `enrichRowsWithTLStatus` (reader); single
  source of truth.

- **TL publication destination:** Story 11 publishes only to local
  strfry — `src/api/trustedList/index.js:55–67` (`publishToStrfry`).
  On Brainstorm deployments, the local strfry IS the publicly-reachable
  relay at `BRAINSTORM_RELAY_URL`. So a reader pointed at
  `BRAINSTORM_RELAY_URL` (or `BRAINSTORM_NIP85_HOME_RELAY` if
  configured separately) can actually retrieve the events. External-
  relay broadcast of TLs themselves is explicitly out-of-scope of
  this story (Story 11's punt; Story 14 *advertises* what already
  exists, it does not relocate it).

- **TA pubkey runtime helpers:** `src/utils/assistantKeys.js:49–82`
  (`getOwnerAssistantPubkey()`); client `useConfig().taPubkey`
  (`ui/src/context/ConfigContext.jsx:9–35`, backed by
  `/api/assistant/pubkey`). House rule in `CLAUDE.md` —
  "Per-deployment TA pubkey — NEVER hardcode."

- **Pins page (target UI):** `ui/src/pages/Pins.jsx:77–245` — already
  reads `useConfig().taPubkey`, already wires `usePins(user?.pubkey)`,
  already has affordance rows with action buttons (Refresh, Edit,
  TLShareButton). This is the natural home for the new action.

- **Relay-list endpoint:** `GET /api/relays`
  (`src/api/relays/index.js:13–22`) returns `aRelays` from settings,
  including `aTrustedListRelays`. Available at the client via
  `useConfig().aRelays`. The server can read `getSettings().aRelays`
  the same way. Not used today by the create-unsigned-kind10040 flow,
  but available if we decide pinned-tag rows should point at a
  configured TL-relay set rather than the default home relay.

### Concepts touched

- `39998:<TA>:tag-pinning` — read-only; the live pin set is the input
  to the composer.
- `39998:<TA>:tag` — read-only; each pin's referenced tag supplies the
  `slug` / `authorPubkey` that go into the d-tag.
- **No new firmware concepts.** No reinstall.

### Constraints

- **NIP-07 only signs the user's own kind-10040** — the server must
  return an unsigned event for the client to sign; it cannot sign on
  the user's behalf. (Same boundary today's
  `create-unsigned-kind10040.js` already honors.)
- **POV-first**: the d-tag includes `observer8`; a user who pinned
  the same tag under two different observer POVs would have two TLs
  and two distinct rows. (v1 default is `observer = self`, so this
  is theoretical for most users — but the design must not collapse
  them.)
- **Decentralized-first**: the user signs; the server does not
  publish on their behalf without a signature.
- **Filter-at-view-time**: the composer reads the live pin set on
  every call; no on-disk "what did the user advertise last time"
  state. Re-running the action with a changed pin set always
  produces a kind-10040 reflecting the current state.
- **Runtime TA pubkey** (CLAUDE.md): server uses
  `getOwnerAssistantPubkey()`; client uses `useConfig().taPubkey`.
  No literal hex pubkeys introduced.

## Options considered

### Option A — One kind-10040 row per pinned-tag TL (strict NIP-85 per-event addressing)

Each currently-pinned tag (with method `nip85:rank` and a resolvable
tag concept) becomes one row:

```
["30392:tl-pin-<observer8>-<tagAuthor8>-<tagSlug>", <TA-pubkey>, <relayUrl>]
```

The discriminator after `30392:` is the exact `d` tag of the TL —
matching the existing `["30382:<metric>", ...]` pattern where the
metric IS the d-tag of a 30382. A generic NIP-85 reader sees this row
and issues `REQ {kinds:[30392], authors:[<TA>], "#d":["tl-pin-..."]}`
exactly as it issues `REQ {kinds:[30382], authors:[<TA>], "#d":["rank"]}`
for the metric rows. No Brainstorm-specific reading code required.

The user re-publishes their kind-10040 each time they want the
advertised set to track their live pin set (matches the story's
user-triggered model — AC-1, AC-11).

**Pros:**
- Strict NIP-85 conformance (AC-10).
- Exact event addressing — readers don't fetch unrelated TLs to find
  the user's.
- Composes with the existing
  `enrichRowsWithTLStatus` / `computeTLDTag` source-of-truth d-tag.
- No interpretation of nonstandard 4th/5th tag elements.

**Cons:**
- N pinned tags → N rows. A user with dozens of pins has a verbose
  kind-10040.
- Re-publishing required on every pin set change. Matches the
  user-triggered model but means stale advertisements between clicks.
- Each row independently points to a relay; the relay-URL choice has
  to be made per row (in practice, the same URL for all rows in v1).

### Option B — Single category row covering all the user's pinned-tag TLs

One row tells readers "all my pinned-tag TLs are at this author@relay;
filter by `observer == me` or by `metric == pinned-tag-membership`":

```
["30392", <TA-pubkey>, <relayUrl>, "pinned-tag-membership", <userPubkey>]
```

(The exact element ordering is up to the design — the point is *one
row* for the whole category.)

**Pros:**
- Compact: one row regardless of pin count.
- No re-publication needed when the pin set changes; the row is a
  category pointer, not a per-event pointer.

**Cons:**
- Breaks NIP-85's `"<kind>:<discriminator>" + <author> + <relay>`
  shape. Readers need to interpret the 4th/5th elements — Brainstorm-
  specific knowledge that contradicts AC-10's "consumable without
  Brainstorm-specific code paths."
- The reader still has to fetch *every* 30392 from the TA at the
  named relay and post-filter by `metric` or `observer` tag — both
  of those are multi-letter event tags, **not indexed by strfry**,
  so the filter happens client-side after a full kind-30392 scan.
  On a deployment with many users this is wasteful.
- Loses per-TL precision: no way to point at exactly one of the
  user's pinned-tag TLs.

### Option C — Hybrid (category row + per-pin rows)

Emit Option B's category row AND Option A's per-pin rows.

**Pros:**
- Two paths for two reader types: a category-aware Brainstorm reader
  uses the category row; a strict NIP-85 reader uses the per-pin rows.
- Future-proof for adding non-TL pinned-tag artifacts.

**Cons:**
- Over-engineered for v1. The two paths must stay in sync, doubling
  the composer's logic and the test surface.
- More bytes; messier event. Adds complexity for a use case
  (Brainstorm-aware category reading) we haven't proven we need.

## Decision

We chose **Option A** — one row per currently-pinned tag, discriminator
= the canonical TL d-tag.

The decision drivers:

1. **AC-10 is the architectural anchor.** External readers MUST be
   able to consume the advertisement without Brainstorm-specific code.
   Option A reuses the exact NIP-85 `["<kind>:<d-tag>", <author>,
   <relay>]` pattern already in use for 30382 metrics. Option B
   silently demands a new convention.
2. **Indexed filtering matters.** Option A's `#d` filter is indexed by
   strfry and every conformant relay. Option B's required post-filter
   on a multi-letter `observer` / `metric` tag is not — readers would
   pay a full-TA-scan cost on every lookup. That cost grows with
   instance population.
3. **Re-publication on pin-set change is acceptable.** The story
   explicitly models the action as user-triggered (AC-1, AC-11). The
   only "cost" of N rows + re-publication is bytes and one extra
   NIP-07 sign — both negligible at expected pin counts (single-
   digits to low double-digits per user in v1).
4. **Option C is YAGNI.** No concrete external reader yet exists that
   would consume a category row. Until one does, the extra surface
   is dead weight. Should one appear, a future ADR can add Option B's
   row alongside Option A's per-pin rows without breaking anything.

The d-tag is computed via the same shape Story 11's `computeTLDTag`
and Story 12's `enrichRowsWithTLStatus` already use, ensuring the
advertisement points at the actual event ID — past, present, or
future — that lives at that addressable slot.

### Implementation shape

**Server — new endpoint:** `POST /api/profile-tags/treasure-map/build-unsigned`

Module: `src/api/profile-tags/treasureMap.js` (new file).

Body (JSON):

```json
{ "viewerPubkey": "<64-char-hex>" }
```

`viewerPubkey` defaults to `req.session.pubkey` if not provided
(matches the existing `create-unsigned-kind10040.js` defaulting
convention).

Steps:

1. Auth gate: `req.session.authenticated` required. Otherwise 401.
2. Validate `viewerPubkey` is hex; reject 400 if not.
3. Resolve `taPubkey = getOwnerAssistantPubkey()`. If null → 500
   with "TA pubkey not resolvable."
4. Resolve `relayUrl = getConfigFromFile('BRAINSTORM_NIP85_HOME_RELAY',
   getConfigFromFile('BRAINSTORM_RELAY_URL', ''))`. If empty → 500
   with "Relay URL not configured."
5. Fetch the viewer's live pins by reusing the same composition
   `handlePins` uses:
   - `strfryScan({kinds:[39999], '#z':[TAG_PINNING_Z_TAG], authors:[viewerPubkey]})`
   - `dedupeReplaceable(pinEvents)`
   - For each pin: parse `curationMethod`, `parsePinTagEventId(pin)`.
   - Bulk-fetch referenced tag events (one extra `strfryScan`).
   - Drop dangling / malformed.
   - Extract internal helper from `handlePins` into
     `enumerateViewerPinsWithTagMeta(viewerPubkey)` so this story and
     `handlePins` share the same composition path. **No behavior
     change for `handlePins`.**
6. Partition pins into `included` and `excluded`:
   - Included: `curationMethod.method === 'nip85:rank'` AND
     `isHexPubkey(curationMethod.observer)` AND tag concept resolved.
   - Excluded: anything else; carry `{pinEventId, tag, reason}`.
     Reasons: `unsupported-method`, `malformed-observer`, `missing-tag`.
7. Fetch the viewer's most-recent existing kind-10040 from local
   strfry: `strfryScan({kinds:[10040], authors:[viewerPubkey], limit:1})`
   sorted by `created_at` desc (defensive; strfry usually returns
   newest-first for replaceable kinds).
8. Compose the new event's tags:
   - **If no prior kind-10040 exists:** seed with the default set
     today's `create-unsigned-kind10040.js` produces (the same 11
     `["30382:<metric>", relayPubkey, nip85HomeRelay]` rows). Reuse
     by extracting a `buildDefaultNip85Metrics(taPubkey, relayUrl)`
     helper into a new
     `src/api/export/nip85/buildKind10040Metrics.js` and call it
     from both `create-unsigned-kind10040.js` and the new composer.
     **Behavior of existing endpoint unchanged.**
   - **If a prior kind-10040 exists:** copy ALL its tags except
     those whose first element matches `/^30392:tl-pin-/`. Those
     are prior pinned-tag entries that get replaced. (Match is
     prefix `30392:tl-pin-` to leave room for non-pin 30392 rows a
     user may have added by other means — defensive, even if not
     currently common.) Counts: `preservedEntries = N`.
9. For each `included` pin, compute
   `dTag = computeTLDTag({observer, tagAuthorPubkey, tagSlug})`
   (import from `src/api/trustedList/refreshPinnedTags.js` — or
   move to a shared util if circular import is a problem). Append
   `[`30392:${dTag}`, taPubkey, relayUrl]`. If two pins resolve to
   the same `dTag` (different events at the same addressable slot),
   dedupe — the slot is one TL.
10. Return:

```json
{
  "success": true,
  "data": {
    "unsignedEvent": {
      "kind": 10040,
      "pubkey": "<viewerPubkey>",
      "created_at": <now>,
      "content": "",
      "tags": [ ... ]
    },
    "summary": {
      "addedPinEntries": [{ "pinEventId", "tagSlug", "tagName", "dTag" }, ...],
      "excludedPins":   [{ "pinEventId", "tagSlug", "tagName", "reason" }, ...],
      "preservedEntries": <N>,
      "seededDefaults": <true|false>
    }
  }
}
```

The `summary` powers the preview UI (open question resolved: yes,
show a preview before opening NIP-07's prompt).

**Server — publish:** reuse existing
`POST /api/publish-signed-kind10040` (no change). It already verifies
the signature, enforces `kind === 10040`, and broadcasts to local +
NIP-85 + popular relays via `bin/brainstorm-create-and-publish-kind10040.js`.
The "publish to local strfry AND outbox relays" requirement of AC-3
is already satisfied by the existing script.

**Client — new hook:** `ui/src/hooks/usePublishTreasureMap.js`

```
export default function usePublishTreasureMap(viewerPubkey) {
  // state: { phase: 'idle'|'building'|'previewing'|'signing'|'publishing'|'done'|'error',
  //          preview: { addedPinEntries, excludedPins, preservedEntries, seededDefaults } | null,
  //          unsignedEvent: <event> | null,
  //          publishedEventId: <id> | null,
  //          error: string | null }
  // returns: { state, buildPreview, confirmAndPublish, reset }
}
```

`buildPreview()` calls the new endpoint, stores `summary` +
`unsignedEvent`, transitions to `'previewing'`.

`confirmAndPublish()` calls `window.nostr.signEvent(unsignedEvent)`,
then `POST /api/publish-signed-kind10040` with
`{signedEvent, pubkey: viewerPubkey}`. Transitions through
`'signing'` → `'publishing'` → `'done'` (or `'error'` at any step;
prior kind-10040 is unchanged because no partial-publish exists in
this flow — the only writes happen in the final POST).

**Client — Pins page surface:** `ui/src/pages/Pins.jsx`

Add a new component `<AdvertiseTreasureMapPanel viewerPubkey={user.pubkey} />`
between the existing `<PinsIntro />` and the `<RefreshAll>` row.
Placement rationale: the user is already on the surface where they
manage pins; one action lives where they already are. The new panel:

- Renders a single primary button: **"Advertise my pinned tags on
  my Treasure Map"** plus a one-line description: "Update your
  kind-10040 event so other Nostr apps can discover your pinned-tag
  Trusted Lists. Your existing NIP-85 metric entries are preserved."
- On click: `buildPreview()` → renders a preview block with three
  sub-sections:
  1. **Adding:** list of `addedPinEntries` (tag name + 8-char d-tag prefix).
  2. **Excluding:** list of `excludedPins` with reasons (rendered as
     "Cannot include `<tagName>` — unsupported curation method").
  3. **Preserving:** "N existing entries preserved" (or "Seeding
     default NIP-85 metric entries" if no prior 10040 existed).
- Below the preview: **"Sign and publish"** (calls
  `confirmAndPublish()`) and **"Cancel"** (calls `reset()`).
- Inline status during `signing` / `publishing`.
- On `done`: success message with the new event id; the panel
  collapses to a compact "Last advertised <time> ago — re-advertise"
  affordance. (Persistence of "last advertised" is OPTIONAL polish —
  if the existing kind-10040 read returns `created_at`, derive from
  that. No new on-disk state.)
- On `error`: inline error string; the user can retry without losing
  the preview.

**Anonymous gating (AC-8):** the panel is rendered inside the
`if (!user)` early-return block's *negative branch* in `Pins.jsx`,
so anonymous users never see it. Mirrors how the existing edit/refresh
controls are auth-gated.

**Idempotence (AC-11):** falls out of step 8's "strip prior
30392:tl-pin-* rows and replace with live set." Re-running with no
pin changes produces a kind-10040 with the same set of pin rows
(differing only in `created_at` / `id`), and the existing NIP-85
metric rows are preserved verbatim.

**Failure atomicity (AC-9):** no event is written to any relay until
the final `/api/publish-signed-kind10040` POST. NIP-07 cancellation,
build-unsigned errors, and network errors during sign all leave the
prior kind-10040 untouched on every relay. The publish step itself
is single-call; either it succeeds across the script's broadcast set
or it returns an error (script-level partial successes are surfaced
as success today by `publish-signed-kind10040.js:135` — that
behavior is unchanged by this story).

### Open-question resolutions

- **Tag prefix / row shape:** per-pin discriminator rows of shape
  `["30392:tl-pin-<observer8>-<tagAuthor8>-<tagSlug>", <TA>, <relay>]`.
  Rationale: above (Option A).
- **Where the action lives:** `/pins` page as a new panel between
  the intro and the refresh row. One surface; settings cross-link
  is not added (the existing kind-10040 controls in
  `BrainstormSettings.jsx` are owner/admin-scoped and out-of-scope
  for this user-facing action).
- **Preview before signing:** yes — the preview is mandatory before
  the NIP-07 prompt fires. Rationale: this is an event the user is
  signing with their own key; visibility is a defensive default.
- **Relay URL source:** reuse
  `BRAINSTORM_NIP85_HOME_RELAY` (fallback `BRAINSTORM_RELAY_URL`)
  — same lookup the existing `create-unsigned-kind10040.js` uses.
  Matches the rest of the kind-10040 entries. Architect deliberately
  does NOT add a "fan out to all `aTrustedListRelays`" path in v1:
  rows then bloat to N*M (N pins × M relays), and the v1 TLs only
  live at the deployment's local strfry anyway.
- **Server endpoint shape:** new endpoint
  `/api/profile-tags/treasure-map/build-unsigned` rather than
  extending `/api/create-unsigned-kind10040`. The legacy endpoint is
  consumed by the admin/owner setup pages
  (`public/pages/customers/*.html`, `public/pages/nip85.html`) and
  has no current React-app callers; adding an
  `includePinnedTagTLs` flag would couple the legacy admin flow to
  the user-facing pin flow. Two endpoints, one shared
  default-metrics builder.
- **AC-7 vs AC-12 boundary:** "supported method, awaiting first TL
  generation" → included (the row points at the addressable slot;
  the slot is empty until the first refresh, which is fine). "Method
  not `nip85:rank`" → excluded with reason `unsupported-method`.
  Same partition function powers both ACs.

## Consequences

**What this enables:**
- A user's pinned-tag TLs become cross-app discoverable via the same
  NIP-85 mechanism that already advertises their metric assertions.
- Future "discover this user's pinned tags from another instance" UX
  has a deterministic discovery path: read the user's kind-10040 →
  follow the `30392:tl-pin-*` rows → fetch.
- Reuse of the existing kind-10040 publish script means no new
  outbox-relay configuration is introduced; the broadcast story is
  already solved.

**What this constrains or makes harder:**
- Every pin-set change requires a re-publication of kind-10040 to
  stay accurate. v1 makes this a user-triggered action; future
  auto-republish would need separate consent UX (out of scope here).
- The pinned-tag rows point to a relay that must remain reachable
  for the TLs to be retrievable. If a deployment ever changes its
  `BRAINSTORM_RELAY_URL`, prior kind-10040 rows go stale; a re-
  advertise rebuilds them under the new URL. Acceptable.
- The 4-element-or-greater NIP-85 row shape is NOT introduced —
  rows stay strict 3-element. This forecloses future per-row
  metadata in kind-10040 without a follow-up ADR.

**New debt / follow-ups:**
- A "last advertised on" surface: nice-to-have polish, derivable
  from the existing kind-10040's `created_at`. Not load-bearing for
  this story.
- An auto-republish-on-pin-change setting: future story; needs
  consent UX (publishing a signed event repeatedly without explicit
  consent each time is a meaningful UX promise to make).
- Cross-instance Treasure-Map reading to surface OTHER users'
  pinned tags inside Brainstorm: separate story, separate ADR.
- The default-metrics builder extraction adds one small shared
  module (`src/api/export/nip85/buildKind10040Metrics.js`). The
  Implementer keeps the existing
  `create-unsigned-kind10040.js` byte-equivalent in output.
- **AC tied to Story 16:** This ADR explicitly uses the runtime TA
  helpers — server `getOwnerAssistantPubkey()`, client
  `useConfig().taPubkey`. The Implementer MUST NOT introduce any
  hardcoded TA pubkey literal in the new files. Story 16's
  "Known violations" list must stay unchanged after this story
  ships.

**Firmware reinstall required?** No. No new concepts; no concept
schema changes.

## Implementation notes

Files to create:

- `src/api/profile-tags/treasureMap.js` — the new composer +
  HTTP handler. Exports `handleBuildUnsignedTreasureMap(req, res)`.
  Registers the route in `registerProfileTagsRoutes` at
  `src/api/profile-tags/index.js:1422`.
- `src/api/export/nip85/buildKind10040Metrics.js` — pure builder of
  the default 30382 metric tags (extracted from existing
  `create-unsigned-kind10040.js:71–127`). Signature:
  `buildDefaultNip85Metrics(relayPubkey, relayUrl) → tags[]`.
- `ui/src/hooks/usePublishTreasureMap.js` — the client orchestration
  hook described above.
- `ui/src/components/AdvertiseTreasureMapPanel.jsx` — the UI panel
  rendered in `Pins.jsx`. Internally uses
  `usePublishTreasureMap` + `useConfig` (for `taPubkey` / `aRelays`
  read-only display purposes if desired) + `window.nostr.signEvent`.

Files to modify:

- `src/api/profile-tags/index.js`:
  - Extract the pin-with-tag-metadata composition out of
    `handlePins` (lines 1283–1327) into a reusable internal
    `enumerateViewerPinsWithTagMeta(viewerPubkey)`. `handlePins`
    keeps the `enrichRowsWithTLStatus` call after the extracted
    helper returns. No external behavior change.
  - In `registerProfileTagsRoutes`: add
    `app.post('/api/profile-tags/treasure-map/build-unsigned', handleBuildUnsignedTreasureMap)`.
  - Export `enumerateViewerPinsWithTagMeta` if the new
    `treasureMap.js` module imports it directly (cleaner than
    cross-module reach into internal helpers).
- `src/api/export/nip85/commands/create-unsigned-kind10040.js`:
  Replace the inline 11-row tag block (lines 71–127) with a call to
  `buildDefaultNip85Metrics(relayPubkey, nip85HomeRelay)`. The
  endpoint's output must remain byte-equivalent (same tag order,
  same content) — the change is pure refactor for code reuse.
- `ui/src/pages/Pins.jsx`: mount
  `<AdvertiseTreasureMapPanel viewerPubkey={user.pubkey} />`
  inside the authenticated `return (...)` block, between
  `<PinsIntro />` (line 140) and the refresh-all row (line 151).
  No prop drilling beyond `viewerPubkey`; the panel reads
  `taPubkey` / `aRelays` from context itself if needed for any
  display-only purpose.

### Wire-shape examples

**No prior kind-10040, one pinned tag:** the produced tag list is the
11 default 30382 metric rows + one
`["30392:tl-pin-abc12345-def67890-mySlug", "<TA>", "<homeRelay>"]`.

**Prior kind-10040 with one historical 30382 metric customization and
no prior pinned-tag rows, three currently-pinned tags:** the produced
tag list is the prior kind-10040's tags verbatim + three new
`["30392:tl-pin-...", "<TA>", "<homeRelay>"]` rows appended.

**Prior kind-10040 with two pinned-tag rows from a previous run, user
has unpinned one and pinned a new one (net: still two pinned):** the
produced tag list strips both `30392:tl-pin-*` rows from the prior
event, keeps every other tag verbatim, appends the live set's two
rows (different d-tags than before).

### Test fixtures (notes for the Tester)

- Existing publish-flow test fixtures fetch
  `/api/assistant/pubkey` once at setup (per Story 13's bug-fix
  preamble). The new tests should do the same — never hardcode the
  literal `82b75e47...`.
- The composer is a pure function modulo the strfry scans; the
  Tester can stub `strfryScan` at the module boundary the same way
  Story 11's tests stub the refresher's strfry calls.
- AC-10's "external reader can enumerate" is testable in-process by
  invoking the composer's output through a generic kind-10040
  parser (the same shape `BrainstormSettings.jsx` and
  `SearchPreferences.jsx` already use today — `event.tags.filter(t
  => t[0].startsWith('30392:'))` gives the pinned-tag pointer set
  without any Brainstorm-specific knowledge).

## Out of scope

- **Auto-republish on pin-set change.** User-triggered only in v1.
- **Cross-instance Treasure-Map reading** that surfaces another
  user's pinned tags inside Brainstorm — separate feature, separate
  ADR.
- **Mirroring TLs themselves to external relays.** Story 11
  punted this to "epic-Story-14"; this ADR's scope is the
  *advertisement*, not the relocation. If a future story relocates
  the TLs, the relay-URL source in step 4 above is the single
  place to change.
- **Per-pin "do not advertise this one" toggle.** v1 advertises the
  full live `nip85:rank` pin set; per-pin privacy is a future story.
- **A migration path** that re-signs prior advertisements under a
  changed TA — N/A; the user signs their own kind-10040 with their
  own key; the TA is referenced as the *author of the events the
  user is pointing at*, not as the author of the 10040.
- **Pruning kind-10040 outbox relays.** The existing publish
  script's relay set is reused as-is.
