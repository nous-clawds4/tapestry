# ADR 0019: Collapse pin publication into a single "Export" concept

**Status:** Proposed
**Date:** 2026-05-29
**Story:** `engineering-team/stories/21-collapse-into-export-concept.md`

## Context

Story 21 asks us to (a) collapse the three pin-publication affordances
— "Refresh now" (kind-30392 recompute), "Share" (kind-30392 naddr
copy), and "Export for other clients" (kind-30000 publish) — into a
single **Export** concept; (b) keep both list kinds current as the
user re-tags / reconfigures a pinned tag; (c) surface honest two-line
sync status; and (d) normalize the default curation cutoff to 1.

### What already exists (the substrate we build on)

The Pin/TL stack is mature. The relevant primitives:

- **`PinnedListPanel.jsx`** (`ui/src/components/PinnedListPanel.jsx`)
  — the "Pinned" tab body (Story 20 / ADR 0018). Today it renders
  three distinct owner actions in its header: `🔄 Refresh now`
  (`handleRefresh` → `POST /api/trusted-list/refresh-pinned-tag`),
  `⚙️ Edit curation` (`CurationMethodDialog`), and
  `<TLShareButton dTag variant="full">`; plus a separate
  "Export for use in other clients" `<section>` containing
  `<TLExportButton>` and a one-line `nip51ExportStatus` message.
  The metadata `<dl>` carries a single **"Share ID (naddr)"** row
  for the kind-30392 (`PinnedListPanel.jsx:215–220`).

- **`<TLExportButton>`** (`ui/src/components/TLExportButton.jsx`) —
  opens a popover with a **title input**, a **relay-preview block**
  (NIP-65 write relays via `fetchUserWriteRelays()` + the well-known
  fallback list + warning), and Export/Cancel. On confirm it calls
  `publishNip51ExportForPin()`.

- **`<TLShareButton>`** (`ui/src/components/TLShareButton.jsx`) —
  composes a kind-30392 naddr client-side (`nip19.naddrEncode`,
  `taPubkey` from `useConfig()`) and copies it.

- **`publishNip51ExportForPin({pinEventId, title, writeRelays})`**
  (`ui/src/utils/publishTagPin.js:230+`) — POSTs
  `/api/trusted-list/prepare-nip51-export`, NIP-07 signs the returned
  unsigned kind-30000 template, publishes via `publishEverywhere` to
  the union of the user's write relays + `WELL_KNOWN_FALLBACK_RELAYS`,
  and returns `{ signed, naddr, dTag, memberCount, publishRelays }`.

- **`POST /api/trusted-list/prepare-nip51-export`**
  (`src/api/trustedList/index.js:handlePrepareNip51Export`) — reads
  the **current kind-30392** for membership (step 6, per ADR 0017 Q7),
  not a fresh WoT scan. Session-auth gated; validates pin author ==
  session.

- **`POST /api/trusted-list/refresh-pinned-tag`**
  (`handleRefreshOnePinnedTag`) — recomputes + republishes the
  **TA-signed** kind-30392 for one pin. Session-auth gated; validates
  pin author == session.

- **Status signals from `GET /api/profile-tags/pins`**
  (`src/api/profile-tags/index.js:handlePins`):
  - `tlStatus = { status:'ok'|'never'|'retracted'|'unsupported',
    lastRefreshAt, tlEventId, memberCount }` (kind-30392 freshness;
    `enrichRowsWithTLStatus`, lines 1382–1452).
  - `nip51ExportStatus = { status:'never-exported'|'ok-fresh'|'stale',
    exportedAt, exportEventId, memberCount, diffVsTL:{added,removed},
    currentTitle }` (kind-30000 vs current kind-30392 p-set diff;
    `enrichRowsWithNip51ExportStatus`, lines 1475–1557).

- **Assertion (Apply/Dispute) entry points** — two:
  1. **Tag page** — `Tag.jsx:79–88` `handleApply`/`handleDispute`
     call `publishProfileTagAssertion()` directly. All tag-page
     surfaces (`TagPageRow`, `TagSomeoneModal`, `TagPageSearch`)
     funnel `onApply`/`onDispute` into these two handlers. **On this
     page the viewer's pin for *this* tag is already known
     (`viewerPin`, `isPinned`).**
  2. **Profile page** — `ProfileTagsSection.jsx` →
     `useProfileTags().applyTag/disputeTag`
     (`ui/src/hooks/useProfileTags.js:88–103`). Here the viewer is
     tagging *another* profile with an arbitrary tag they **may or
     may not** have pinned; no pin context is in scope.

- **Curation reconfig** — `PinnedListPanel.handleEditSubmit` re-signs
  the pin (`pinTag`) and fires `refresh-pinned-tag` fire-and-forget.

- **Pin-time** — `Tag.jsx:publishWithCuration` already fires **both**
  `refresh-pinned-tag` AND `publishNip51ExportForPin` (fire-and-forget)
  on first pin, with no dialog (Story 18 invariant). This already
  matches the "do both by default" model and is left intact.

### The hard constraints (carried from Story 19 / ADR 0017)

1. **Only the user can sign the kind-30000.** Any (re)publication
   needs a NIP-07 prompt — never silent. The kind-30392 (TA-signed,
   `buildAndPublishTL`) *can* be recomputed silently server-side.
2. **No scheduled tasks for non-customers.** The only lever to keep a
   user's kind-30000 current without a cron is their own already-
   signed Apply/Dispute/reconfig moments.
3. **`prepare-nip51-export` reads the *current* kind-30392.** So to
   make a re-exported kind-30000 reflect a just-made assertion, the
   kind-30392 must be recomputed **first**, then the export prepared.

### The cutoff straggler (AC-21/22/23)

- `defaultCurationMethod()` (`publishTagPin.js`) and
  `CurationMethodDialog` already default to **1**.
- **Stale:** `refreshPinnedTags.js:145` —
  `const cutoff = Number.isFinite(curation.cutoff) ? curation.cutoff : 2;`
  (fallback 2, only hit when `curation.cutoff` is absent/non-finite).
- **Stale copy:** `Pins.jsx:42` — "Web of Trust meet the `cutoff`
  (default 2)".

### Concept-graph orientation

Via `/api/concept-graph/summaries`: `39998:<TA>:tag-pinning`
(pin events; both export kinds correlate via the shared d-tag and the
`tag-pinning` z-tag), `39998:<TA>:nostr-user-tag` (Apply/Dispute
assertions — now the *trigger*), `39998:<TA>:web-of-trust` (per-POV
scoring, read-only), `39998:<TA>:tag` (parent). **No new firmware
concept; no reinstall.** The z-tag composition continues to use the
`LEGACY_*` literal per ADR 0015 (unchanged).

## Options considered

### Option A — Client-orchestrated collapse (one modal + a shared re-export orchestrator)

- Replace the three header affordances + the export `<section>` with a
  single **Export** button → an **`<ExportModal>`** (an evolution of
  `<TLExportButton>`): title input, a collapsed **"What will be
  exported?"** disclosure holding two default-checked checkboxes
  (Follow Set / Trusted List), the existing relay-preview, and an
  Export confirm disabled when both are unchecked. On confirm it runs
  (if checked) `refresh-pinned-tag` then (if checked)
  `publishNip51ExportForPin` — in that order.
- Add a **shared client orchestrator**
  `syncPinnedExportsForTag({ tag, viewerPubkey, knownPinRow? })`
  (in `publishTagPin.js`) called after a successful assertion from
  **both** entry points. It finds the viewer's matching pin, recomputes
  the kind-30392, and re-exports the kind-30000 **only if a kind-30000
  footprint exists**. Module-level **debounce keyed by pinEventId**
  coalesces rapid taggings (Open Q1).
- Detail `<dl>` gains **two naddr rows** (kind-30392 + kind-30000),
  each post-export, each with a copy control and a help line.
- A small **client state machine** in `PinnedListPanel` overlays the
  server `tlStatus`/`nip51ExportStatus` with transient session state
  (`exporting`, `declined`) to render the two-line status.
- Server changes are minimal: fix the cutoff fallback; ensure pin rows
  carry the asserted-tag identity for matching. **No new endpoint.**

**Pros:** Reuses every existing primitive (endpoints, publish helper,
status enrichers, naddr composition). Honors the "user signs the
30000" and "prepare reads current 30392" constraints by ordering the
two existing calls. Stays stateless-on-read (CLAUDE.md principle 3) —
the orchestrator derives the pin/footprint from `/pins` at action
time. No firmware. Contained server diff.

**Cons:** Re-export is client-orchestrated, so the transient AC-19 UI
only shows when the user is on the Pinned tab; profile-page taggings
re-export "headlessly" (still prompts NIP-07, but no inline progress
bar — acceptable per AC-19 "if this message is visible"). Recomputing
the kind-30392 on every pinned-tag assertion adds Neo4j load (mitigated
by debounce + acting-viewer-only scope; cron remains backstop).

### Option B — Server-driven re-export queue

Server detects assertions touching a pinned tag, recomputes the
kind-30392, and records a "needs re-export" flag; the client polls and
prompts the user to sign the kind-30000.

**Pros:** Centralizes the trigger; survives the user not being on the
page.

**Cons:** Introduces **server-side per-POV mutable state** ("needs
re-export"), exactly the denormalization CLAUDE.md principle 3 warns
against. The kind-30000 *still* needs a client NIP-07 prompt, so the
queue doesn't remove the client step — it adds a polling channel and
stateful surface for no signing benefit. Rejected.

### Option C — Auto-sign the kind-30000 via a delegated/stored key

Have the server (or a delegated signer) sign the kind-30000 so re-export
is truly silent.

**Cons:** The instance has no access to the user's key (NIP-07 only —
see memory "Logged-in user identity data ≠ WoT-sync data"); a TA-signed
kind-30000 surfaces under the TA's identity in other clients, defeating
the whole purpose (the founding constraint of ADR 0017). Violates
decentralized-first. Rejected.

## Decision

We chose **Option A**. It is the only option that respects all three
hard constraints, reuses the existing endpoints and helpers wholesale,
adds no server-side per-POV state, and keeps the server diff to a
cutoff fix plus a tiny response-field guarantee.

### Resolutions to the story's open questions

**Q1 — Re-export debounce.** Coalesce. The orchestrator keeps a
module-level `Map<pinEventId, timer>`; rapid assertions for the same
pin reset a **trailing debounce (~2s)** and fire one recompute +
one re-export. Different pins debounce independently.

**Q2 — Always show both naddr rows.** Yes — show both rows once their
respective kind exists (kind-30392 row when `tlStatus.status==='ok'`;
kind-30000 row when `nip51ExportStatus.status!=='never-exported'`).
Help copy keeps expectations honest (the kind-30392 help line names
its curation-pipeline use; the kind-30000 help line names cross-client
clients).

**Q3 — Self-caused-transient vs other-caused stale.** Distinguish
**within the session** using client knowledge, and treat persistent
server `stale` as the other-caused case:
- The client tracks, per pin, whether *it* just fired a re-export
  this session (`exporting`) or the user *declined* one (`declined`).
- `exporting` → AC-19 transient messaging.
- `declined` → "out of sync — **Export** to update" (no "coming soon"
  caveat; the user can fix it now).
- Otherwise, server `nip51ExportStatus.status==='stale'` on load →
  AC-20 "out of sync (background list refresh coming soon!)".
- **Accepted limitation:** a *declined* re-export that the user then
  navigates away from and returns to later reads as other-caused
  stale (shows the "coming soon" caveat). Harmless — the Export action
  is present either way. Avoids an extra per-assertion strfry scan to
  attribute causality.

### Matching an assertion to a pin

Match by the **(tag.authorPubkey, tag.slug)** identity — the stable
addressable identity that the pin d-tag, the kind-30392 d-tag, and the
kind-30000 d-tag are all composed from (`tl-pin-<obs8>-<author8>-<slug>`).
This is immune to tag-event re-publication (which changes `tagEventId`
but not the addressable identity). Both pin rows
(`row.tag.authorPubkey`, `row.tag.slug` — already present) and the
asserted `tag` object must expose `authorPubkey` + `slug`; the
Implementer verifies `availableTags` (profile page) carries
`authorPubkey` and adds it to that payload if missing.

## Consequences

- **Enables** a single mental model: one "Export" that publishes both
  lists, both current, with the kind differences hidden behind an
  opt-in disclosure — and keeps the cross-client kind-30000 dynamic
  for non-customers via their own tagging moments.
- **Constrains:** the kind-30000 re-export always costs a NIP-07
  prompt (accepted, decision ①); the per-assertion kind-30392
  recompute adds Neo4j/strfry load (debounced; acting-viewer-only;
  cron backstop unchanged).
- **Follow-up debt:** a true background refresh of the kind-30000 for
  other-caused drift (the "coming soon" caveat) remains out of scope;
  precise self-vs-other stale attribution is deferred (see accepted
  limitation).
- **Firmware reinstall required?** **No.** No concept definitions
  change.

## Implementation notes

### Server (minimal)

- **`src/api/trustedList/refreshPinnedTags.js:145`** — change the
  cutoff fallback `: 2` → `: 1` (AC-21). Keep
  `Number.isFinite(curation.cutoff) ? curation.cutoff : 1` so explicit
  values >1 are honored (AC-23).
- **`src/api/profile-tags/index.js:handlePins`** — confirm each pin
  row's `tag` carries `authorPubkey` + `slug` (it does, per
  `enrichRowsWithTLStatus`). No new endpoint. (Optionally also expose
  the referenced `tagEventId` for debugging, but matching uses
  authorPubkey+slug.)

### Client — Export modal

- **`ui/src/components/TLExportButton.jsx` → `ExportModal`** (rename or
  new `ui/src/components/ExportModal.jsx`; retire `TLExportButton` and
  `TLShareButton` as standalone usages in `PinnedListPanel`). Add:
  - a collapsed **"What will be exported?"** `<details>`/disclosure
    with two checkboxes — **Follow Set (kind-30000)** and **Trusted
    List (kind-30392)** — both `defaultChecked` (AC-3/AC-4);
  - confirm button `disabled` when **both** unchecked (AC-5);
  - keep the title input + relay-preview (relevant when 30000 is
    checked);
  - on confirm (AC-6/AC-7), run **in order**:
    1. if 30392 checked → `POST /api/trusted-list/refresh-pinned-tag
       {pinEventId}` (await);
    2. if 30000 checked → `publishNip51ExportForPin({pinEventId,
       title})` (NIP-07 prompt; reads the now-fresh 30392);
    - leave the unchecked kind's existing event untouched.
  - on success, call `onExported()` so `PinnedListPanel` refetches
    `tl`, `pinRow`, and re-renders the naddr rows + status.

### Client — single Export affordance in PinnedListPanel

- **`ui/src/components/PinnedListPanel.jsx`** — replace the header's
  `🔄 Refresh now`, `<TLShareButton>`, and the separate
  "Export for use in other clients" `<section>`/`<TLExportButton>`
  with **one `Export` button** that opens `<ExportModal>` (AC-1/AC-2).
  Keep `⚙️ Edit curation` (separate action).
- **`handleEditSubmit`** — after the reconfig re-pin + refresh, also
  run the re-export tail (`syncPinnedExportsForTag`) so a curation
  change re-publishes the kind-30000 footprint (AC-13).

### Client — detail naddr rows (AC-8–11)

- In the `<dl>`, replace the lone "Share ID (naddr)" row with two
  rows, each rendered only when its kind exists:
  - **Trusted List (naddr)** — `nip19.naddrEncode({kind:30392,
    pubkey:taPubkey, identifier:dTag, relays:[]})` + copy control;
    help line ≈ *"The Trusted List includes ranks; useful in curation
    pipelines."*
  - **Follow Set (naddr)** — `nip19.naddrEncode({kind:30000,
    pubkey:user.pubkey, identifier:dTag, relays:WELL_KNOWN_FALLBACK_RELAYS})`
    + copy control; help line ≈ *"Look for this list in your favorite
    client that supports Lists and Follow Sets."*
  - Copied value is the **naddr** (AC-11), never a raw id. Use the
    well-known fallback relays for the 30000 naddr so it resolves
    without an async write-relay fetch on render.

### Client — re-export orchestrator (AC-12–16)

- **`ui/src/utils/publishTagPin.js`** — add
  `syncPinnedExportsForTag({ tag, viewerPubkey, knownPinRow })`:
  1. Resolve the matching pin: use `knownPinRow` if provided (tag
     page), else `GET /api/profile-tags/pins?viewerPubkey=` and find
     the row whose `tag.authorPubkey`+`tag.slug` match the asserted
     tag. No match → return (AC-16).
  2. Debounce (module-level `Map<pinEventId, timer>`, ~2s trailing).
  3. On fire: `POST /api/trusted-list/refresh-pinned-tag {pinEventId}`
     (await). Then, **iff** `row.nip51ExportStatus.status !==
     'never-exported'`, `publishNip51ExportForPin({pinEventId,
     title: row.nip51ExportStatus.currentTitle})` (AC-12/AC-13). If
     never-exported → recompute only, no prompt (AC-15).
  4. Expose lifecycle (`changed`→`exporting`→`idle`/`declined`) via an
     optional callback so a mounted `PinnedListPanel` can drive the
     transient UI.
- **`ui/src/pages/Tag.jsx`** `handleApply`/`handleDispute` — after
  `publishProfileTagAssertion(...)`, call
  `syncPinnedExportsForTag({ tag, viewerPubkey:user.pubkey,
  knownPinRow: pinRow })` when `isPinned`, threading lifecycle into a
  lifted `exportSync` state passed to `PinnedListPanel`.
- **`ui/src/hooks/useProfileTags.js`** `applyTag`/`disputeTag` — after
  the assertion + `refetch()`, call `syncPinnedExportsForTag({ tag,
  viewerPubkey })` (fetches pins itself; no-op when the tag isn't
  pinned).

### Client — two-line sync status state machine (AC-17–20)

- In `PinnedListPanel`, compose two lines from `tlStatus`,
  `nip51ExportStatus`, and the transient `exportSync` state:
  - **Line 1 (timestamp):** `exportSync==='exporting'` → "Exporting…";
    else "Last exported {timeAgo}" using `nip51ExportStatus.exportedAt`
    when a 30000 exists, else `tlStatus.lastRefreshAt` (AC-17).
  - **Line 2 (status):**
    - `exportSync==='changed'|'exporting'` → "Pinned list changed,
      last export out of sync" (AC-19, transient);
    - `exportSync==='declined'` → "Last export out of sync — Export to
      update" (AC-14);
    - `nip51ExportStatus.status==='ok-fresh'` (or no 30000 and
      `tlStatus.status==='ok'`) → "Last export is in sync with current
      Pin" (AC-18);
    - `nip51ExportStatus.status==='stale'` → "Last export out of sync
      (background list refresh coming soon!)" (AC-20).
- **`ui/src/pages/Pins.jsx:42`** — update copy "(default 2)" →
  "(default 1)" (AC-22).

### Invariants (AC-24–26)

- kind-30392 stays TA-signed (`buildAndPublishTL` untouched); kind-30000
  stays user-signed (`publishNip51ExportForPin` signing untouched).
- The orchestrator only ever touches the **acting viewer's own** pin
  (both server endpoints validate pin author == session), so one
  viewer's re-export never alters another's (AC-25/AC-26).
- Internal read paths (Pinned-tab members, Search "Pinned tag" filter)
  continue to read the kind-30392 unchanged (AC-24).

## Out of scope

- Background/scheduled refresh of the kind-30000 for other-caused drift
  (the "coming soon" caveat).
- Precise server-side self-vs-other stale attribution (deferred; the
  client distinguishes within-session only).
- Any change to pin-time behavior (`Tag.jsx:publishWithCuration`
  already does both, silently, with no dialog — left as-is).
- New firmware concepts / z-tag re-parenting (separate epic, ADR 0015).
