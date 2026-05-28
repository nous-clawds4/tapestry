# ADR 0017: NIP-51 kind-30000 list export from pinned tags

**Status:** Proposed
**Date:** 2026-05-28
**Story:** `engineering-team/stories/done/19-nip51-list-export-from-pins.md`

## Context

Story 19 adds a parallel cross-client publication path for pinned-tag
Trusted Lists: every pin should produce a kind-30000 NIP-51 follow
set (signed by the *user*, not the TA) in addition to the existing
kind-30392 TL (signed by the TA, auto-refreshed). The user-signing
constraint is what makes the kind-30000 portable: other nostr clients
render the list under the user's identity, which is the whole point.

The 24-AC story covers wire-shape (AC-1–AC-4), replaceability
(AC-5–AC-8), title customization (AC-9), the re-export action
(AC-10–AC-13), two distinct share affordances (AC-14), staleness UI
(AC-15–AC-17), Brainstorm-internal no-regression (AC-18–AC-20),
cross-client portability proof (AC-21–AC-22), and POV invariants
(AC-23–AC-24).

### Concept-graph orientation

Via `/api/concept-graph/summaries` + targeted `neighbors`:

- `39998:<TA>:tag-pinning` — Story-10 concept; pin events drive
  membership and d-tag composition. **This ADR reuses the existing
  `tag-pinning` z-tag for the kind-30000 export** — see Decision.
- `39998:<TA>:nostr-user-tag` — endorsement / dispute assertion
  concept; unchanged.
- `39998:<TA>:web-of-trust` — per-POV scoring; unchanged.
- `39998:<TA>:tag` — parent concept; unchanged.
- **No new firmware concept.** kind-30000 is a standard nostr
  event-type; the z-tag binding reuses an existing concept. **No
  firmware reinstall.**

### Existing primitives we reuse (with file:line references)

- **`computeTLDTag({ observer, tagAuthorPubkey, tagSlug })`** —
  client at `ui/src/utils/publishTagPin.js:61`, server at
  `src/api/trustedList/refreshPinnedTags.js:66`. Returns
  `tl-pin-<obs8>-<author8>-<slug>`. **The kind-30000 export reuses
  this verbatim** so the d-tag is byte-identical to the kind-30392
  d-tag for the same pin. Correlation across the two events is the
  shared d-tag.

- **`pinTag({ tag, curationMethod })`** — client-side pin
  signer at `ui/src/utils/publishTagPin.js:91`. NIP-07 signs the
  kind-39999 pin event under the user's key and calls
  `publishOrThrow` to write it everywhere. **The kind-30000 export
  follows the same shape: build unsigned → `window.nostr.signEvent`
  → `publishOrThrow`.**

- **`publishOrThrow(signed)`** —
  `ui/src/utils/publishProfileTag.js:23`. Publishes via
  `publishEverywhere` (local strfry + external A-relays), throws
  only if BOTH local and external fail. We reuse this for the
  kind-30000 publish.

- **`useConfig().taPubkey`** — `ui/src/context/ConfigContext.jsx:14–18`.
  Already in the codebase; the existing `TLShareButton` uses it.
  The kind-30000 export DOES NOT use `taPubkey` as the signer
  identity — the *user* signs — but it does use it for resolving
  the `tag-pinning` concept handle's TA suffix where required.
  **Per CLAUDE.md "Per-deployment TA pubkey",** the runtime helper
  is the right surface for any TA-pubkey-as-author or TA-pubkey-as-
  signer-identity reads. **Per ADR 0015,** the z-tag composition
  uses the `LEGACY_TA_PUBKEY` literal at
  `ui/src/utils/publishTagPin.js:34` to preserve cross-deployment
  historical-event compatibility — the kind-30000 z-tag follows the
  same rule.

- **`TLShareButton`** — `ui/src/components/TLShareButton.jsx:19`.
  Renders the existing kind-30392 share button. **We DO NOT modify
  it.** A new sibling component `<TLExportButton>` handles the
  kind-30000 export action. The two co-exist; the user picks per
  AC-14.

- **`useTLDetail(dTag)`** — `ui/src/hooks/useTLDetail.js:14`. Reads
  the kind-30392 event by d-tag and enriches its `p`-tag members
  with profile metadata. **We extend the PinDetail render to also
  show the user's latest kind-30000 export status, but `useTLDetail`
  itself remains kind-30392-only** (separation of concerns: the
  hook reads "the live trusted list"; the kind-30000 surface
  computes against it but is rendered separately).

- **`handlePins`** — `src/api/profile-tags/index.js:1300`. Returns
  the viewer's pinned-tag rows with `tlStatus` derived live from
  strfry. **We extend `enrichRowsWithTLStatus` (lines 1378–1446)
  to additionally fetch and attach the viewer's latest kind-30000
  export per pin, computing a `nip51ExportStatus` object per row**
  (see Decision and Implementation notes).

- **`runOnePin`, `aggregateProfilesTagged`** —
  `src/api/trustedList/refreshPinnedTags.js:120` and
  `src/api/profile-tags/index.js` (extracted per ADR 0010). The
  membership compute the kind-30000 export needs is **the same
  function the kind-30392 cron uses** — single source of truth,
  no drift. The new endpoint reads the *current kind-30392's
  p-tag set* in v1 (per Open Q in the story, PO leaned read
  current 30392) rather than re-running the WoT-author scan — see
  Decision Q1 below.

- **`/api/strfry/scan`** — already in the codebase (used by
  `useTLDetail.js:36`). Client uses it for the kind-30000 read
  surface where needed (PinDetail's export-status render).

- **`/api/trusted-list/refresh-pinned-tag`** —
  `src/api/trustedList/index.js`. Story 11's manual refresh
  endpoint. **Unchanged here.** The kind-30000 export does not
  go through this endpoint.

### NIP-51 spec — what we honor

Per the NIP-51 "Sets" section quoted in the story's Background:

- Kind 30000 = follow set, `p`-tag items, parameterized
  replaceable (NIP-33: same `(kind, pubkey, d-tag)` → relay holds
  only the latest). **Replaceability AC block (AC-5–AC-8) is
  enforced structurally** by reusing `computeTLDTag` (stable d-tag)
  and never issuing NIP-09 deletes.
- Optional metadata tags: `title`, `image`, `description`. **We use
  `title` for the user's chosen name** (default fallback per the
  story); **we use `description` for the "via Brainstorm" hint**
  (PO lean in Open Q); **we do not use `image` in v1** (no source
  for instance-or-TA branding image yet; future addition is
  one-tag-line).
- Public membership only in v1; encrypted (NIP-44) members
  out-of-scope (NIP-51 supports it via encrypted `content`).

### CLAUDE.md invariants

- **POV-first.** The kind-30000's `p`-tag set is the kind-30392's
  membership at publish time, which is itself the result of the
  pin's observer-POV WoT-author filter applied to current
  assertions. Two distinct users pinning the same tag → two
  distinct kind-30000 events (different `pubkey` field) with
  potentially-different membership.
- **Decentralized-first.** Anyone publishes anything; the kind-30000
  is signed by *the pinner*, not by the TA. The TA never gates,
  filters, or aggregates kind-30000 events.
- **Filter at view time, not write time.** Membership at publish
  time is read from the *current* kind-30392 (which itself is
  re-derived on every cron tick from raw assertions). The
  kind-30000 is a snapshot of that read.

### Project rules

- No new lint / typecheck / build tooling.
- JS-without-build server + UI.
- No new firmware concept → no firmware reinstall.

### Open questions from the story (resolved below in Decision)

1. Pin-time signing UX (one prompt or two?)
2. Z-tag concept choice (reuse vs new).
3. Share-naddr recipient relay list policy.
4. Title-input UX timing (pin-time vs export-only).
5. Where the "via Brainstorm" hint lives (`title` vs `description`).
6. `/pins` row staleness display shape.
7. Membership computation at re-export time (read 30392 vs fresh
   compute).
8. What if the user's local kind-30392 is stale at re-export time.
9. Unpin-time UI hint about kind-30000 not auto-retracting.

## Options considered

### Option A — Server prepares unsigned template; client signs + publishes via existing primitives

A single new server endpoint produces an *unsigned* kind-30000 wire
event populated with current membership; the client signs it via
NIP-07 and publishes it via the existing `publishEverywhere` /
`publishOrThrow` path. A new UI component, `<TLExportButton>`,
parallels `TLShareButton` but is visually distinct.

**Pros:**

- Single source of truth for d-tag composition, z-tag value,
  `description` default, member-set selection: the server.
  Client never re-implements those — it just signs.
- The server already exports `computeTLDTag`, knows the
  `LEGACY_TA_PUBKEY` for z-tag, and can read the current kind-30392.
  Mechanical reuse.
- Pin-time and re-export action share the same endpoint + client
  flow. One sign-and-publish helper, two call sites.
- Staleness derivation lives on the server (added to the existing
  `handlePins` `tlStatus` derivation) — one strfry scan, batched.
- Manual title customization slots in cleanly: client passes
  `title` (optional) in the POST body → server returns it on the
  unsigned template → user signs.
- No new firmware concept; no reinstall.

**Cons:**

- New server endpoint adds surface area (~40–60 LoC).
- Coupling: the client trusts the server-returned unsigned template
  shape. Mitigated by NIP-07: the user always sees what they're
  signing — the second NIP-07 prompt shows the event to the user.

### Option B — Client does it all (no server template endpoint)

The client reads the kind-30392 via the existing `/api/strfry/scan`
(or extends `useTLDetail`), pulls members, builds an unsigned
kind-30000 in pure JS, signs, publishes. The server is touched
only for the new staleness fields on `handlePins`.

**Pros:**

- No new server endpoint.
- Entirely client-side flow; the server's surface stays the same.

**Cons (why rejected):**

- D-tag composition (currently in two places per ADR 0010 — client
  helper + server helper) gets a third call site. Each future
  composition change has to update three files in lockstep.
- Z-tag value composition becomes client-side; the
  `LEGACY_TA_PUBKEY` literal already lives client-side
  (`publishTagPin.js:34`) which is fine, but adding *another*
  consumer at a different call site invites the same class of bug
  ADR 0015 documents.
- `description` default copy lives client-side, no server
  enforcement; if a future story wants instance-specific text
  there, it requires a client change.
- The membership-read is still server-side anyway (we hit
  `/api/strfry/scan`), so the "client-only" framing is misleading —
  we just shift complexity into the client component.

### Option C — Skip pin-time auto-export; only manual Export button publishes the kind-30000

Pin time only publishes the kind-39999 (existing). The first
kind-30000 ever lives in the user's "Export for use in other
clients" click. Story AC-1's "two events published on pin" becomes
"two events available on pin, one auto-published, one one-click-away."

**Pros:**

- One NIP-07 prompt at pin time (UX symmetry with Story 18's
  no-interstitial first-pin invariant).
- No coupling between pin completion and a second signing flow.

**Cons (why rejected — would require Story 19 amendment):**

- Story AC-1 explicitly says both events publish at pin time.
  This option would require kicking back to PO.
- The user has to find and click the Export action *again* on
  every initial pin to enable cross-client sharing. The "I pinned
  a tag, now my friends can subscribe to it in Damus" promise gets
  one extra UI step the user might not discover.
- A future "publish your kind-30000 list" notification banner
  would close the gap, but it's net more UI complexity than just
  signing at pin time.

If sequential NIP-07 prompts turn out to be a hard UX problem in
practice (e.g. some browser extensions struggle with rapid
sequential prompts), Option C is the natural fallback — we'd add
PO sign-off and amend Story AC-1.

## Decision

**Option A.** New server endpoint `POST
/api/trusted-list/prepare-nip51-export` produces an unsigned
kind-30000 template; client signs via NIP-07 and publishes via
`publishOrThrow`. New UI component `<TLExportButton>` parallels
`TLShareButton` visually and semantically. Existing kind-30392
publish, refresh, and read paths stay untouched.

Resolves the nine story open questions as follows:

### Q1 — Pin-time signing UX

**Two sequential NIP-07 prompts.** First prompt: the kind-39999 pin
event (existing Story-10 flow). After it succeeds AND
`publishOrThrow` returns AND the (existing fire-and-forget) refresh
POST has been kicked off, the client immediately calls
`POST /api/trusted-list/prepare-nip51-export` with the pin's event
id. On response, the client immediately invokes
`window.nostr.signEvent(template)` — second NIP-07 prompt — and
publishes the signed event. The second prompt's copy comes from
the user's NIP-07 extension's standard signing dialog (we don't
control wording across NIP-07 implementations); the kind-30000 wire
shape is itself self-describing (`title`, `description`,
visible `p`-tags), so the user sees what they're publishing.

The server endpoint computes membership inline (does not depend on
the just-fired refresh of kind-30392 having completed). It
computes its own membership snapshot using the same primitives the
refresh cron uses (`aggregateProfilesTagged`). Race-safe: even if
the refresh is in-flight, both surfaces converge on the same WoT-
filtered member set.

If the second prompt fails (user rejects, extension errors), the
pin still landed — the user can later click "Export for use in
other clients" to retry the kind-30000 publish. Failure surfaces
inline on `Tag.jsx` (toast or banner).

### Q2 — Z-tag concept

**Reuse `tag-pinning`.** The z-tag value is the exact same handle
as the kind-39999 pin event:
`39998:${LEGACY_TA_PUBKEY}:tag-pinning`. Rationale:

- Semantically: the kind-30000 IS an export *of* a tag-pinning.
- Operationally: Brainstorm's read paths that want to find
  "kind-30000 exports of pinned tags" filter
  `kinds:[30000], #z:[<tag-pinning handle>]`. Distinguishes from
  arbitrary user-authored kind-30000 follow sets cleanly.
- No new firmware concept → no reinstall.
- Uses `LEGACY_TA_PUBKEY` (matching the pin event's z-tag) per ADR
  0015. The kind-30000 z-tag composition follows the same
  legacy-pubkey rule the pin event does, so historical-event
  compatibility (Story 16's eventual cleanup) carries over
  identically.

### Q3 — Share-naddr recipient relay list

**Include the instance's public relay URL in the naddr `relays`
array, when configured; omit otherwise.** Implementation:

- New client field `useConfig().publicRelayUrl`, sourced from a
  new tiny `/api/config/public-relay` server endpoint that reads
  `BRAINSTORM_RELAY_URL` from `/etc/brainstorm.conf` (the existing
  config file). If unset, returns `{ success: true, url: null }`.
  Client uses `[url]` if non-null, otherwise `[]`.
- Existing `TLShareButton` continues to use `relays: []` — we DO
  NOT modify it (AC-18 no-regression). Future story may unify.

### Q4 — Title-input UX timing

**Title input only on the Export action, NEVER at pin time.**
Rationale: Story 18 AC-10 / AC-12 hard-require no-dialog first-pin.
A title prompt would violate that. At pin time, the server's
unsigned template uses the default `title` (the tag's display name)
silently; the user can re-export later to change it. On the
re-export action (`<TLExportButton>` click), a small inline input
appears (or a tiny popover — Implementer's call) pre-filled with
the current title; user can edit or accept; clicking "Export"
sends `{ title }` in the POST body.

### Q5 — "Via Brainstorm" hint placement

**`description` carries the hint; `title` is purely the user's
choice (or just the tag name as the default fallback).**

Default `title`: `<tag display name>` (just the tag's `name`
field, or `slug` as a fallback).

Default `description`:
`"A Pinned-tag list from Brainstorm — members are trusted in this
tag under the exporter's web-of-trust point of view. Re-publish
from your Brainstorm instance to update."`

The PO's "let the user choose the name" instruction is honored:
title defaults to bare tag name; user can edit on re-export.
description is fixed and instance-managed (not user-editable in
v1; AC-23/-24 implications are unchanged).

### Q6 — `/pins` row staleness display shape

**A small status line, immediately below the existing
`renderStatusLine(tlStatus)` output, in `Pins.jsx:194–212`.** One
of:

- `Not yet exported · ▸ Export` (status='never-exported')
- `Exported X ago · in sync` (status='ok-fresh')
- `Exported X ago · N changes since · ▸ Re-export` (status='stale')

Treated as a distinct visual row (small font, secondary color).
Live `<TLExportButton>` itself renders in the existing row
actions area, immediately after `<TLShareButton>` (so the user
sees the two buttons adjacent).

PinDetail uses a richer treatment: a new section between the
metadata `<dl>` and the members heading, titled "Export for use
in other clients," with the export button (full variant), the
exported-at timestamp, the staleness count, and the user-chosen
title affordance.

### Q7 — Membership computation at re-export time

**Read the *current kind-30392* in v1; do NOT trigger a fresh
WoT-author scan.** Rationale: PO's lean; the kind-30392 is already
POV-filtered, is the canonical Brainstorm state, and is fast to
read (one strfry scan). A user who wants fresher membership clicks
"Refresh now" on the kind-30392 first, then exports — the existing
flows already support this. Bypasses double-work in the common
case.

If a future story wants a "force fresh compute" option, the
endpoint can grow a query param later.

### Q8 — What if local kind-30392 is stale at re-export time

**Allow it.** Export reflects the kind-30392 as it stands at the
moment of the request. The UI's staleness row (Q6) shows the
user the kind-30392's `lastRefreshAt`, so they can decide whether
to refresh first. No automatic chained refresh — keeps the action
predictable and avoids surprise NIP-07 / Neo4j load.

### Q9 — Unpin-time UI hint

**Add a single sentence to the unpin confirmation flow in
`Pins.jsx`'s `handleEditUnpin` and `PinDetail.jsx`'s
`handleEditUnpin`.** The `CurationMethodDialog` (Story 12 / ADR
0011) is where unpinning happens today. Add to its unpin button's
tooltip or to an inline hint when an export exists:

> Your published cross-client list (kind-30000) won't be
> automatically retracted. Open the pin's detail page later and
> re-export with no members to retract it.

Exact copy is the Implementer's call (or a follow-up polish). A
dedicated "retract export" button is out of scope (per story Out
of Scope).

## Consequences

**Enables:**

- Pinning a tag automatically yields a NIP-51-compliant kind-30000
  follow set under the user's key, openable as a feed in any
  mainstream nostr client.
- A clearly-labeled "Export for use in other clients" action lets
  the user re-publish with current membership and choose a custom
  title.
- Two distinct share affordances on every pin surface, visually
  separable, semantically different.
- Staleness signal across `/pins` and `/pin/:dTag` keeps the user
  honest about what's published where.
- Honors all three CLAUDE.md invariants: POV-per-pin, the user
  signs their own export, membership re-derived on read.
- D-tag is stable per pin (mirrors the kind-30392 d-tag), so
  re-exports overwrite the same NIP-33 addressable slot. The user
  never accumulates parallel kind-30000s for the same pin; no
  NIP-09 deletes against their previous events.

**Constrains / makes harder:**

- Two NIP-07 prompts on first pin. If the user dismisses the
  second prompt, the kind-30000 publish fails silently; they'd
  need to click Export later. Captured as an Open follow-up: a
  banner could prompt them.
- Extending `enrichRowsWithTLStatus` to also fetch the user's
  kind-30000 export adds one strfry scan per `/pins` request
  (batched across all viewer's pin d-tags). Minor; same shape as
  the existing scan.
- The new `/api/config/public-relay` endpoint reads
  `BRAINSTORM_RELAY_URL` from `/etc/brainstorm.conf`. If the
  config file is missing (rare; dev-only edge case), the endpoint
  returns `null` and the naddr is relays-less — acceptable.
- The kind-30000 export's `description` is instance-managed (not
  user-editable in v1). If users complain, follow-up makes it
  user-editable alongside `title`.

**Follow-ups / debt:**

- **Per-pin or per-user opt-out toggle.** Currently pinning
  always publishes both. A future "skip cross-client export"
  toggle is a story if user feedback asks.
- **Retract-on-unpin for kind-30000.** A dedicated "publish empty
  kind-30000 to retract" button is a follow-up. v1 only surfaces
  the hint at unpin time.
- **External-relay broadcast of the kind-30000.** Currently
  `publishOrThrow` writes to local strfry + A-relays via the
  existing publish helper. Whether A-relays count as "external
  distribution" varies per deployment. Story 14 (Treasure Map
  integration, paused) is the right home for explicit
  external-broadcast policy.
- **NIP-51 image tag.** Could carry instance branding (Brainstorm
  logo, instance avatar). v1 omits; one-line addition later.
- **User-editable `description`.** v1 keeps it as a fixed
  Brainstorm hint; user-editable in a follow-up.
- **Multi-chip union / intersection** of pinned-tag filters
  (existing Story 11 follow-up); not affected by this story.
- **Bulk-export at deploy time.** When this story ships, the first
  time each existing pin's owner visits the UI they see a "Not
  yet exported" status. A "one-click export all my pins" affordance
  is a polish follow-up.

**Firmware reinstall required?** **No.** Pure code change; reuses
the existing `tag-pinning` concept for the z-tag.

## Implementation notes

Concrete guidance for the Implementer.

### Server — new endpoint at `src/api/trustedList/index.js`

Register one new route, `register(app)`:

```js
app.post('/api/trusted-list/prepare-nip51-export', handlePrepareNip51Export);
```

Handler shape (`handlePrepareNip51Export(req, res)`):

```js
// Input: { pinEventId: string, title?: string, sessionPubkey: string }
// (sessionPubkey from existing session middleware; the unsigned
// template's `pubkey` field is set to it).
//
// 1. Look up the pin event by id from local strfry.
// 2. Parse curation-method; reject unsupported methods (mirror
//    Story-10 / ADR 0009 parsing).
// 3. observer = curationMethod.observer; tagAuthor = pin tag
//    author (parsed via existing helper); tagSlug = pin tag slug.
// 4. Compute d-tag via the existing computeTLDTag.
// 5. Read current kind-30392 from local strfry for that d-tag
//    (kinds:[30392], authors:[<runtime TA>], '#d':[dTag]); take
//    the latest by created_at.
// 6. Collect `p`-tag pubkeys from the kind-30392 (handle missing
//    or retracted TL: members = []).
// 7. Resolve title:
//      title = req.body.title || tag.name || tag.slug;
//    (Default fallback per Q4 / Q5.)
// 8. description = constant Brainstorm hint string (per Q5).
// 9. z-tag value = `39998:${LEGACY_TA_PUBKEY}:tag-pinning` —
//    SAME literal the client-side publishTagPin.js uses.
//    Constant lives in src/api/trustedList/index.js next to the
//    existing TA-related literals.
// 10. Build unsigned template:
//       {
//         kind: 30000,
//         pubkey: sessionPubkey,
//         created_at: nowSeconds,
//         tags: [
//           ['d', dTag],
//           ['z', `39998:${LEGACY_TA_PUBKEY}:tag-pinning`],
//           ['title', title],
//           ['description', BRAINSTORM_EXPORT_DESCRIPTION],
//           ...members.map((pk) => ['p', pk]),
//         ],
//         content: '',
//       }
// 11. Respond { success: true, unsigned, dTag, memberCount: members.length }.
//
// On error (pin not found, malformed curation, no observer, etc.),
// respond { success: false, error: '...' } with appropriate HTTP
// status.
```

**Auth gate:** require session pubkey present; the template's
`pubkey` field MUST equal `sessionPubkey`. (We can't enforce that
the user signs it — they could replace the `pubkey` before signing
— but we set it to the session's pubkey by default; the user has
to deliberately swap it, in which case publish-everywhere's relay
acceptance will catch the mismatch.)

**Constants:**

- `LEGACY_TA_PUBKEY` — at module top, mirroring
  `ui/src/utils/publishTagPin.js:34`. Comment: "see ADR 0015."
- `BRAINSTORM_EXPORT_DESCRIPTION` — at module top. Copy per Q5.

### Server — extend `handlePins` `tlStatus` derivation

In `src/api/profile-tags/index.js`, extend
`enrichRowsWithTLStatus` (lines 1378–1446) — or add a sibling
`enrichRowsWithNip51ExportStatus(rows, viewerPubkey)` invoked
immediately after — to add a `nip51ExportStatus` field per row:

```js
// One batched scan:
//   kinds:[30000], authors:[viewerPubkey], '#d':[...allDTagsForViewer]
// Map by d-tag; latest per d-tag wins.
//
// For each row:
//   const exportEv = exportsByDTag.get(row._tlDTag);
//   if (!exportEv) {
//     row.nip51ExportStatus = { status: 'never-exported', exportedAt: null,
//                               exportEventId: null, memberCount: null,
//                               diffVsTL: null };
//     continue;
//   }
//   const exportMembers = (exportEv.tags||[]).filter(t=>t[0]==='p').map(t=>t[1]);
//   const tlMembers = row.tlStatus?.status === 'ok'
//     ? // pull from the same enrichRowsWithTLStatus pass, OR re-scan
//       (tlByDTag.get(row._tlDTag)?.tags||[]).filter(t=>t[0]==='p').map(t=>t[1])
//     : [];
//   const exportSet = new Set(exportMembers);
//   const tlSet = new Set(tlMembers);
//   const added = tlMembers.filter(m => !exportSet.has(m)).length;
//   const removed = exportMembers.filter(m => !tlSet.has(m)).length;
//   const status = (added + removed) === 0 ? 'ok-fresh' : 'stale';
//   row.nip51ExportStatus = {
//     status, exportedAt: exportEv.created_at,
//     exportEventId: exportEv.id, memberCount: exportMembers.length,
//     diffVsTL: { added, removed },
//   };
```

Add `tlByDTag` to `enrichRowsWithTLStatus`'s return value (it's
local now) so the export-status pass can read the latest TL
without a second scan.

### Server — new `/api/config/public-relay` endpoint

In `src/api/config/index.js` (or wherever existing
`/api/config/*` routes register; if no module exists, follow
`/api/relays`'s pattern):

```js
// GET /api/config/public-relay
// Returns { success: true, url: <BRAINSTORM_RELAY_URL or null> }.
```

Read `BRAINSTORM_RELAY_URL` from `/etc/brainstorm.conf` using
whatever existing `loadConf()` helper the codebase has (look for
how `BRAINSTORM_RELAY_URL` is read in
`src/algos/nip85/publish_nip85_30382.js:368` — same env-var name).

### Client — new component `ui/src/components/TLExportButton.jsx`

Mirrors `TLShareButton`'s shape but performs the export action:

```jsx
// Props:
//   pinEventId — the kind-39999 pin event id (needed to call the
//                prepare endpoint).
//   dTag       — the d-tag (used for naddr construction post-publish).
//   currentTitle — optional, pre-fills the title input.
//   variant    — 'compact' | 'full'.
//   onExported — optional callback fired after publish (so the
//                parent can refetch and update the staleness UI).
//
// State: { exporting, copied, error, titleDraft, showingTitleInput }.
// Click flow:
//   1. If !showingTitleInput, open inline title input (small popover
//      anchored to button); pre-fill with currentTitle.
//   2. User edits or accepts; clicks "Export" inside the popover.
//   3. POST /api/trusted-list/prepare-nip51-export {pinEventId, title}.
//   4. window.nostr.signEvent(unsigned) — NIP-07 prompt.
//   5. publishOrThrow(signed).
//   6. naddr = nip19.naddrEncode({
//        kind: 30000, pubkey: signed.pubkey, identifier: dTag,
//        relays: publicRelayUrl ? [publicRelayUrl] : [],
//      });
//   7. Copy naddr to clipboard. Show ✓.
//   8. Call onExported?.().
//
// Use useConfig().publicRelayUrl (new — added to ConfigContext
// per the new /api/config/public-relay endpoint).
```

Distinct from `TLShareButton`:

- Icon: `📤` instead of `🔗` (or text+icon `📤 Export for other clients`).
- Tooltip: "Sign and publish a NIP-51 follow set under your key for use in other nostr clients."
- Disabled when `!window.nostr` or when not logged in (handles AC-13).

### Client — extend `ui/src/context/ConfigContext.jsx`

Add a third fetch in the existing `useEffect`:

```jsx
fetch('/api/config/public-relay')
  .then(r => r.json())
  .then(d => { if (d.success) setPublicRelayUrl(d.url); })
  .catch(() => {});
```

Expose `publicRelayUrl` on the provider value alongside `taPubkey`,
`ownerPubkey`, `aRelays`.

### Client — `ui/src/utils/publishTagPin.js`

Extend `pinTag` (or add a sibling `pinTagWithNip51Export`) so that
after the existing pin publish + the (existing) fire-and-forget
refresh-on-pin, the function also fires the prepare-nip51-export
flow. Recommended shape: keep `pinTag` semantics unchanged; add a
new helper `publishNip51ExportForPin({ pinEventId, title })` that
encapsulates `prepare → sign → publishOrThrow → return naddr`. The
caller (`Tag.jsx:handlePin`) invokes both in sequence:

```js
const signed = await pinTag({ tag });  // existing
fetch('/api/trusted-list/refresh-pinned-tag', { ... }).catch(() => {});  // existing
// New:
try {
  await publishNip51ExportForPin({ pinEventId: signed.id });
  // No title arg at pin time per Q4 — uses server default (tag.name).
} catch (e) {
  // User dismissed second prompt, or NIP-07 errored. Pin still
  // landed. Surface inline; do not unwind.
}
```

`publishNip51ExportForPin` lives in
`ui/src/utils/publishTagPin.js` (next to `pinTag`) for cohesion.

### Client — `ui/src/pages/Tag.jsx` (Story-10's pin handler)

Wire the new call after the existing refresh-on-pin. Surface the
second-prompt failure via an inline error (or a passive toast).
Do not block the Pin button's "Pinned"-transition on the second
publish — the pin itself succeeded, that's the source-of-truth for
the visible state.

### Client — `ui/src/hooks/usePins.js`

No behavioral change. The server now returns `nip51ExportStatus`
per row; the hook passes it through. Existing destructuring of
`row.tag`, `row.pinEventId`, `row.curationMethod`, `row.tlStatus`
is unchanged.

### Client — `ui/src/pages/Pins.jsx`

Each row gains:

1. A new line below `renderStatusLine(row.tlStatus)`:
   `renderExportStatusLine(row.nip51ExportStatus)`:
   - `never-exported` → `"Not yet exported for other clients"`
   - `ok-fresh` → `"Exported {timeAgoShort} · in sync"`
   - `stale` → `"Exported {timeAgoShort} · {added}+ / {removed}− changes since"`
2. A `<TLExportButton>` in `<div className="bs-pins-row-actions">`
   immediately after `<TLShareButton>` (so the two are adjacent).
   `pinEventId={row.pinEventId} dTag={tlDTag} currentTitle={...} onExported={() => refetch()}`.

The `currentTitle` for `<TLExportButton>` is pulled from the
viewer's previously-published kind-30000's `title` tag (returned
on the row's `nip51ExportStatus` — add a `currentTitle` field to
that object on the server side; same scan; trivial extension). If
never exported, default to `row.tag.name`.

### Client — `ui/src/pages/PinDetail.jsx`

Add a new section between the metadata `<dl>` (line ~199–240)
and the `<h2>` Members heading (line ~242), titled "Export for
use in other clients":

```jsx
<section className="bs-pindetail-export">
  <h3 className="bs-pindetail-export-heading">Export for use in other clients</h3>
  <p className="bs-pindetail-export-help">
    Publish this list as a NIP-51 follow set under your key so others
    can subscribe to it in Damus, Amethyst, Iris, Coracle, etc.
    {/* additional copy per Q9 / Implementer */}
  </p>
  <div className="bs-pindetail-export-row">
    <TLExportButton
      pinEventId={pinEventId}
      dTag={tl.dTag}
      currentTitle={nip51Export.title}
      variant="full"
      onExported={refetch}
    />
    <span className="bs-pindetail-export-status">
      {/* same shape as Pins.jsx export status line */}
    </span>
  </div>
</section>
```

`pinEventId` comes from the existing `/api/profile-tags/pins`
lookup (already used by `openEditDialog` at line 109–126); reuse
that lookup, cache `pin.pinEventId` in state for use here.

### Client — `ui/src/components/CurationMethodDialog.jsx`

When `mode === 'edit'` and an unpin button is shown (Story 18 /
ADR 0016), add the kind-30000-not-auto-retracted hint per Q9 as
a small notice above or near the unpin button:

> Your published cross-client list (kind-30000) won't be
> automatically retracted. Re-export with no members from the
> pin's detail page to retract it.

Exact copy is the Implementer's call.

### CSS — `ui/src/styles.css`

Append under the existing `bs-pins-*` and `bs-pindetail-*`
namespaces:

- `.bs-tl-export` (mirror `.bs-tl-share`, distinct color).
- `.bs-pins-row-export-status` (small font, secondary color, with
  variants for `is-never`, `is-fresh`, `is-stale`).
- `.bs-pindetail-export` section block.
- `.bs-pindetail-export-row` (button + status side-by-side).
- A small inline title-input popover used by `<TLExportButton>`.

### Wire-shape — Tests (Tester writes these; Implementer's contract)

Per the AC list and the wire shapes in Decision Q1–Q5, the
testable assertions are:

- `POST /api/trusted-list/prepare-nip51-export` returns
  `{ success: true, unsigned: { kind: 30000, pubkey: <sessionPubkey>,
  tags: [['d', dTag], ['z', '39998:<LEGACY_TA>:tag-pinning'],
  ['title', <expected>], ['description', BRAINSTORM_EXPORT_DESCRIPTION],
  ...p-tags], content: '' }, dTag, memberCount }`.
- D-tag from this endpoint equals the d-tag the kind-30392 publish
  path uses for the same `(observer, tagAuthor, tagSlug)`.
- `p`-tags' pubkey set equals the current kind-30392's `p`-tag
  set for the same d-tag.
- Title defaults to `tag.name` when omitted; respects the request
  `title` when provided.
- 400 on missing `pinEventId`; 404 on unknown; 403 on
  session-pubkey mismatch (if implemented).
- `GET /api/profile-tags/pins` rows now carry
  `nip51ExportStatus: { status, exportedAt, exportEventId,
  memberCount, diffVsTL, currentTitle }`. `status` ∈
  `{'never-exported', 'ok-fresh', 'stale'}`.
- `GET /api/config/public-relay` returns
  `{ success: true, url: 'wss://...' | null }`.
- Publish flow (live, NIP-07-enabled fixtures):
    - Pinning a tag fires both NIP-07 prompts; both events land
      in local strfry; both events share the same d-tag; the
      kind-30000 is signed by the user's pubkey.
    - The kind-30000's `p`-tag pubkey set equals the freshly
      published kind-30392's `p`-tag pubkey set at the same
      moment (Q1 race-safe assertion).
    - Re-export with a new title replaces the previous kind-30000
      at the same `(kind, pubkey, d)` coordinate (NIP-33
      addressable-replaceable); no NIP-09 deletion is published;
      `created_at` is strictly later; the prior event id is no
      longer the latest for that coordinate.
    - Re-export with members changed produces a kind-30000 whose
      `p`-tag set matches the current kind-30392's `p`-tag set;
      the previous title (or default) is preserved unless the
      user passed a new one.
- UI:
    - `/pins` row shows the new export-status line and the
      `<TLExportButton>` adjacent to `<TLShareButton>`.
    - `/pin/:dTag` page shows the new "Export for use in other
      clients" section between metadata and members.
    - Clicking `<TLExportButton>` opens a title input popover;
      typing + Export triggers NIP-07; success copies the naddr
      to the clipboard; status line updates.
    - `<TLShareButton>` continues to work exactly as today
      (kind-30392 share); no regression.
    - When `window.nostr` is unavailable, `<TLExportButton>` is
      disabled with a tooltip.

## Out of scope

- The follow-up items called out in the story's Out of Scope
  section (retraction-on-unpin button, scores in `p`-tags,
  ~~multi-relay broadcast~~, NIP-44-encrypted lists, opt-out
  toggle, arbitrary-user export surfacing, "Trusted List" UI
  rename). **Multi-relay broadcast is now in scope per the
  Amendment below.**
- The user-editable `description` (v1 keeps it instance-managed).
- The `image` tag (v1 omits; future).
- A "bulk export all my pins" button (deferred polish).
- Renaming `TLShareButton` (kept exactly as is; the new
  `<TLExportButton>` lives alongside).
- Modifying the existing kind-30392 cron, refresh endpoints, or
  retraction logic.
- Multi-chip union/intersection of pinned-tag filters (Story 11
  follow-up; not affected by this ADR).

## Amendment 2026-05-28 — multi-relay broadcast to user's NIP-65 write relays (supersedes Q3)

After the initial ADR landed, the PO surfaced a gap: a kind-30000
that only lives on this Brainstorm instance's local strfry won't
be discoverable in other nostr clients, because those clients
fetch a user's events from the *user's own relays* (per NIP-65,
kind 10002). For the cross-client UX promise to hold, the
kind-30000 publish must also broadcast to the user's NIP-65
write relays, AND the `naddr` must include those relays so
recipients can locate the event.

This amendment supersedes **Q3** ("Share-naddr recipient relay
list") from the original Decision section and resolves the four
new open questions added to the story's Amendment.

### A1 — Source of the user's NIP-65 list

**Local strfry only**, queried lazily at the moment of an Export
action (no caching across the session beyond one click's flow).
Read via the existing `/api/strfry/scan` endpoint:

```js
{ kinds: [10002], authors: [user.pubkey] }
```

The latest by `created_at` wins (kind 10002 is replaceable per
NIP-01). Parse the event's tags:

```
Each ["r", "wss://...", "read"|"write"|""] tag is a relay entry.
- Third element "write" or absent → write relay.
- Third element "read" → read-only; DO NOT use for publish.
```

If local strfry has no kind-10002 for the user, treat as "no
relay list known" — apply the AC-27 fallback (A3 below).

### A2 — Ensure `syncWoT.sh` pulls kind-10002 into local strfry

Today the WoT sync pulls
`kinds:[0, 3, 1984, 10000, 30000, 38000, 38172, 38173]` (per
`src/manage/negentropySync/syncWoT.sh`). **Kind 10002 is not in
the list** — meaning the user's NIP-65 relay metadata is not
guaranteed to be present in local strfry, even for users in the
viewer's WoT.

**This amendment adds `10002` to the WoT-sync kind list.** It's
a one-line edit and is required for this feature to function for
any user beyond the deployment's owner / TA. The change is small
and well-scoped to this story; the Implementer ships it as part
of Story 19.

For the logged-in user themselves, their kind-10002 should be
synced anyway (the user is in their own WoT by definition), but
this amendment ensures the wider WoT of users who might also
export pins have their relay lists locally readable. (No
direct effect on Story 19's primary flow — the logged-in user
exports their own list — but is the consistent infrastructure
fix.)

### A3 — Fallback when the user has no kind-10002

**Publish to local strfry only and warn the user prominently
in the UI.** Concretely:

- The export still succeeds (publish to local strfry succeeds).
- The pre-publish UI (AC-26) shows the warning copy from AC-27:
  `"You haven't published a NIP-65 relay list, so this list will
  only land on this Brainstorm instance's relay. Other nostr
  clients won't find it unless they have this relay configured.
  To make it discoverable, publish a NIP-65 relay list and try
  again."`
- The `naddr` includes `relays: []` (no hint to give).
- The user MAY still click Export to confirm; they MAY also
  cancel and go set up a relay list first.
- We do NOT auto-publish to the instance's `aRelays` as a
  fallback — that would publish under the user's identity to
  relays they have not claimed, which is a respect-of-identity
  violation.
- We do NOT refuse to publish — the local strfry copy at least
  preserves the user's intent, and a future re-export after they
  publish a NIP-65 list will replace the local-only event with a
  fully-broadcast one (via NIP-33 replaceability — same d-tag).

### A4 — Naddr relay count

**Include all of the user's NIP-65 write relays in the `naddr`'s
`relays` field**, in the order they appear in their kind-10002
event. Rationale: naddr size is not a practical concern (typical
relay-set is 3–8 entries; the `bech32` encoding handles tens of
entries without issue). More relays in the naddr = better odds
of discovery in the recipient's client. If the user has 0 write
relays (per A3), `relays: []`.

### A5 — When the user's write-relay list changes between exports

**Re-read on every Export action; no cross-action caching.**
Each click of `<TLExportButton>` does:

```js
1. Fetch user's latest kind-10002 from local strfry.
2. Show relay preview in popover with current write relays.
3. On user confirm: POST /api/trusted-list/prepare-nip51-export
   with the write-relay list (so the server can compose the
   correct naddr to return alongside the unsigned template).
4. NIP-07 sign.
5. publishEverywhere(signed, writeRelays + ['ws://localhost/strfry']).
6. Copy returned naddr to clipboard.
```

A user who updates their NIP-65 between Export clicks sees the
new relay list on the next click. Simple, predictable.

### A6 — UI updates for AC-26 and AC-27

The `<TLExportButton>` click flow gains a relay-preview step
before publish. Concrete shape:

1. User clicks button → small popover anchored to the button.
2. Popover content:
   - **Title input** (per Q4): pre-filled with current title or
     default; editable.
   - **Relay preview** (per AC-26): one of two states:
     - Has write relays:
       ```
       This will publish the NIP-51 list '<title>' to:
       • wss://relay.damus.io
       • wss://nos.lol
       • wss://relay.primal.net
       (3 of your write relays, from your NIP-65 relay list,
       plus this Brainstorm instance's relay.)
       ```
     - No kind-10002 found:
       ```
       ⚠️ You haven't published a NIP-65 relay list, so this list
       will only land on this Brainstorm instance's relay.
       Other nostr clients won't find it unless they have this
       relay configured. To make it discoverable, publish a NIP-65
       relay list and try again.
       ```
   - **[Export]** primary button + **[Cancel]** secondary.
3. On Export click → server endpoint → NIP-07 sign → publish flow.

The Implementer picks the popover vs modal vs inline-expansion
choice; the AC's rule is that the user sees the relay preview
*before* the NIP-07 prompt.

### A7 — Server endpoint changes

The `POST /api/trusted-list/prepare-nip51-export` endpoint
receives one new optional field in the request body:

```js
// { pinEventId, title?, writeRelays?: string[] }
```

If `writeRelays` is provided, the server uses it to compose
the returned `naddrPreview` (so the client and server agree on
the naddr's relay list). If omitted, the server reads the user's
kind-10002 from local strfry itself and uses that. **For
defense-in-depth and consistency,** the server should be the
authoritative source for the user's relay list; the client
passes its known list as a hint, the server verifies / corrects.

The returned payload gains:

```js
{
  success: true,
  unsigned: { ... },                  // as before
  dTag,
  memberCount,
  naddr: '<nip19-encoded>',           // NEW — pre-encoded, so the
                                       //   client doesn't have to repeat
                                       //   the encoding logic.
  writeRelays: ['wss://...', ...],   // NEW — what the server saw
                                       //   in the user's kind-10002, so
                                       //   the client can confirm in
                                       //   the UI relay preview.
}
```

### A8 — Client publish flow update

The existing `publishEverywhere(signed, relays)` helper (per
`ui/src/utils/nostrPublish.js`) accepts a `relays` argument.
The `publishNip51ExportForPin` helper invokes it with
`writeRelays.concat([local-strfry-url])` (or similar — whatever
the existing nostrPublish helper does to ensure local-strfry
publish; the Implementer reads `nostrPublish.js` to determine
the right invocation).

`publishOrThrow`'s "throw only if BOTH local and external fail"
policy continues to apply: external-relay timeouts /
write-failures are tolerated as long as local strfry succeeds.

### A9 — Backward-compat: `BRAINSTORM_RELAY_URL` / public-relay endpoint

Q3's original resolution introduced a new `/api/config/public-relay`
endpoint and a new `useConfig().publicRelayUrl` field. **The new
direction supersedes the use case for these.** The Implementer
SHOULD NOT add the public-relay endpoint or the ConfigContext
field, as they would be unused.

The existing `aRelays` field on `ConfigContext` remains untouched
(consumed by other parts of the app).

### A10 — Supersedes Q3 — final naddr policy

- The naddr is composed by the **server** in `prepare-nip51-export`
  (per A7) using the user's NIP-65 write relays from local strfry.
- The client uses the server-returned naddr verbatim.
- If the user has no kind-10002, `naddr.relays = []`.
- The naddr's `kind=30000, pubkey=<user>, identifier=<dTag>` are
  unchanged from the original Q3.

### Implementation note additions for the Amendment

In addition to the original Implementation notes, the
Implementer adds:

- **Sync:** edit `src/manage/negentropySync/syncWoT.sh` line 31
  to include `10002` in the synced kinds list.
- **Server:** extend `handlePrepareNip51Export` to:
  - Read the user's latest kind-10002 from local strfry.
  - Parse `r` tags; collect write relays (third element `write`
    or absent).
  - Compose the naddr with those relays.
  - Return `naddr` + `writeRelays` in the response payload.
- **Client `<TLExportButton>`:** add the relay-preview popover
  per A6. Two states (has-relays / no-relays). Use the
  server-returned `naddr` and `writeRelays` from the response;
  pass `writeRelays` to `publishEverywhere`.
- **Client `publishNip51ExportForPin`:** updated to call
  `publishEverywhere(signed, writeRelays)` instead of the bare
  `publishOrThrow`. Implementer confirms `publishEverywhere`
  handles local strfry inclusion automatically (per the existing
  helper's docstring) — if it does not, prepend the local strfry
  URL to the relay list.
- **Tests** (additions to the existing test contract):
  - Endpoint response includes `naddr` and `writeRelays` fields.
  - With a user who has a kind-10002 with 3 write relays, the
    response's `writeRelays` is exactly that list (order
    preserved).
  - With a user who has no kind-10002, the response's
    `writeRelays` is `[]` and the naddr's `relays` field is `[]`.
  - With a user whose kind-10002 has mixed read/write entries,
    only write (and read+write, i.e. no explicit `read`-only) are
    returned.
  - Publishing the signed kind-30000 invokes `publishEverywhere`
    with the user's write relays; spying on that call (in a
    test environment with a mock publish helper) confirms the
    target list.

### What this Amendment does NOT change

- All other Decision sections (Option A choice; Q1, Q2, Q4, Q5,
  Q6, Q7, Q8, Q9) stand as-written.
- Wire-shape of the kind-30000 event itself (tags, content,
  d-tag composition) — unchanged.
- Brainstorm-internal read surfaces (`/pins`, `/pin/:dTag`,
  filter chips) — unchanged.
- The CLAUDE.md invariants (POV-first, decentralized-first,
  filter-at-view-time) — re-confirmed; multi-relay publish is
  consistent with "decentralized-first" (the user's own relays,
  the user's own identity).

### Firmware reinstall

Still **no**. The Amendment is a publish-target and UI change;
no concept-graph changes.
