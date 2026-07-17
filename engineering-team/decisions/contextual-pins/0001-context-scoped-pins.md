# ADR 0001: Context-scoped pins — firmware context anchors, stamp-based discovery, discriminated first-class identity

**Status:** Proposed
**Date:** 2026-07-16
**Story:** `engineering-team/stories/contextual-pins/1-pin-a-tag-within-a-community-context.md`

## Context

Today a tag-pinning is a kind-39999 event carrying a single shared `z` — the `tag-pinning`
concept handle — plus a `d` (its replaceable identity), an `e`/`a` to the pinned tag, and a
`curation-method`. Its wire shape is built in one place (`ui/src/utils/publishTagPin.js`)
and read in `src/api/profile-tags/index.js` + `src/api/trustedList/refreshPinnedTags.js`.
A pin's identity is `(tagSlug, tagAuthor, viewer)` — encoded in the pin d-tag
(`tag-pin-<slug>-<author8>-<viewer8>`, `publishTagPin.js:59`) — so **a user can hold exactly
one live pin per tag**. Downstream, that identity flows into four more d-tag schemes:

| # | scheme | kind | site |
|---|---|---|---|
| 1 | `tag-pin-<slug>-<author8>-<viewer8>` | 39999 pin | `publishTagPin.js:59` |
| 2 | `tl-pin-<obs8>-<author8>-<slug>` | 30392 profile TL | `publishTagPin.js:75` + `refreshPinnedTags.js:72` |
| 3 | `tl-pin-notes-<obs8>-<author8>-<slug>` | 30393 note TL | `refreshPinnedTags.js:337` |
| 4 | `notes-pin-…` (note bookmark) | 30003 export | `publishTagPin.js:315` |
| 5 | follow-set export d-tag | 30000 export | server `prepare-nip51-export`, resolved from `pinEventId` |

The story asks for pins to exist **within a community context** (initially LFO and
"Tapestry & Web of Trust"), such that: contextual and neutral pins of the same tag
**coexist** and are each **first-class** (own curation, TL, export, detail); the association
is discoverable by others; the derivation "context pins → display tags" is **portable**
(usable without our server); and contexts are provisioned to a fresh deployment with **no
event IDs in client code**.

**Concepts (verified live via `/api/concept-graph/summaries`, TA `82b75e47…973833`):**
- `39998:<TA>:tag-pinning` — tag pinning (pins reference it via `z`; unchanged).
- `39998:<TA>:tag` — tag (the pinned thing; unchanged).
- **New:** one context concept per offered context (introduced here).

**Governing constraints (from advisory + specs):**
- **Stamping** (`protocols/drafts/stamping.md`) is the ratified convention for multi-`z`
  published items. A pin is a **containment item** (an item joining a concept's list), so
  multi-`z` is on the correct side of stamping's "containment vs. membership" boundary.
  Stamps are **explicit declared affiliation** — never auto-routed into a community the
  author didn't choose. Plain `#z` filtering is the interop floor; `z` order is not
  load-bearing.
- **Runtime TA, not the legacy literal.** The existing pin `z` uses `LEGACY_Z_TAG_PUBKEY`
  under the ADR event-tagging/0015 exception (preserve historical pin visibility). That
  exception is scoped to concepts with historical data. Contexts are greenfield → the
  context `z` MUST compose from the deployment's **runtime** TA
  (`getOwnerAssistantPubkey()` server / `useConfig().taPubkey` client), per the CLAUDE.md
  per-deployment-TA rule. A legacy literal here would break discovery on every non-dev
  deployment.
- **Firmware seeding** is the no-event-IDs provisioning path: `src/firmware/install.js`
  publishes each `firmware/active/concepts/<slug>/` as kind-39998 with `dTag: slug`, handle
  `39998:<runtimeTA>:<slug>` — derivable from slug alone at runtime.

## Options considered

### Option A — Single pin event, two `z` tags ("display-only")
One pin event carries both the `tag-pinning` `z` and the context `z`. This is the minimal
"stamping" read of the request.
- **Pros:** tiny diff; no d-tag changes; the context `#z` scan finds the pin.
- **Cons:** the pin is still **one** object with one identity/TL/export. A user cannot hold
  a neutral pin *and* a contextual pin of the same tag — the second replaces the first at
  the same d-tag. **Fails the coexistence and first-class acceptance criteria.** Stamping
  governs *discoverability of one item*, not *how many items exist*.

### Option B — Distinct pin events via a centralized d-tag discriminator + context stamp _(chosen)_
Context becomes part of pin identity through a single discriminator segment threaded across
all five d-tag schemes (bare = empty ⇒ existing pins byte-identical). Each pin additionally
carries a context `z` **stamp** for discovery. Neutral and contextual pins are different
d-tags ⇒ they coexist and are independently first-class; `dedupeReplaceable` (which keys on
`(author, d-tag)`) collapses each correctly with **no change**.
- **Pros:** meets coexistence + first-class + discovery; the discriminator is one helper, so
  future "other ways to pin the same tag" extend it in one place; existing pins untouched.
- **Cons:** touches five d-tag schemes + the plural read; more surface than Option A.

### Option C — Context anchor as a kind-3000x single-author list
Model each context as a NIP-51 list the pin points at.
- **Cons:** 3000x is single-author (violates decentralized-first — only its owner defines
  the context) and is a *membership list* (readers expect it to enumerate members), and it
  is off the firmware-installer path (reintroduces the event-ID provisioning problem).
  **Rejected.**

**Anchor-form sub-decision (folded in):** contexts are **kind-39998 firmware concepts**
(the dlist form), not 3000x lists — this gives runtime-derivable handles, federation-ready
dual-`z` structure later, and a genuine proto-Community-Declaration stepping stone.

## Decision

**Option B**, with contexts as firmware-seeded kind-39998 concepts.

- A **context** is a firmware concept keyed by a bare slug, handle
  `39998:<runtimeTA>:<contextSlug>`. Initial set: `lfo` (display "LFO") and
  `tapestry-web-of-trust` (display "Tapestry & Web of Trust"). Bare slugs converge on the
  same slug identity a real Community Declaration will use; because a member-authored CD is
  signed under a *different* author than the TA, adopting a real CD is still a **lazy
  re-stamp** (Stamping § Re-stamping), explicitly accepted — but the slug carries.
- A **contextual pin** is a kind-39999 pin that (a) carries the context handle as a second
  `z` **stamp** (runtime TA), and (b) has context folded into its identity via a single
  `pinVariantKey` discriminator, applied uniformly to all five d-tag schemes.
- **Discovery needs no new endpoint.** `#z:[contextHandle]` is a native strfry filter; any
  client scans it directly. Neutral pins lack the stamp, so they never appear — satisfying
  "explicit affiliation only."
- **Portability:** the pure derivation `contextPinsToTags(pinEvents, { trustFilter })` lives
  in the stack-agnostic SDK (`src/lib/event-tagging/`); all I/O (relay scan, POV lookup) is
  the caller's, injected via `trustFilter`.

## Consequences

- **Enables** coexisting, first-class neutral + contextual pins; a reusable derivation other
  teams build against; and a clean upgrade path to Community Declarations.
- **Constrains:** the discriminator MUST stay centralized — five schemes computing context
  ad hoc would drift. Context is recovered from the pin's **`z` stamp**, never by parsing a
  d-tag (d-tags stay opaque; that opacity is what makes the empty-suffix backward-compat
  safe).
- **Load-bearing invariant (retraction):** `retractStaleTLs` (`refreshPinnedTags.js:254`) is
  safe for N-pins-per-tag **only because** it diffs on the full `Set(currentDTags)`, not on
  `(obs,author,slug)`. `enumeratePinnedTags` MUST keep deduping by `(author, full d-tag)` and
  every live contextual pin MUST contribute its full discriminated TL d-tag to
  `currentDTags`. Never collapse the enumerator by `(obs,author,slug)` — that would silently
  retract all-but-one contextual TL. A reviewer seeing such a dedupe MUST reject.
- **Interop floor:** a plain `#z:[contextHandle]` scan returns pins stamped *directly* with
  that context. Sub-context breadth ("everything under C") would require superset (`s`-tag)
  expansion — out of scope, and readers must not assume the direct scan is exhaustive.
- **Firmware reinstall required?** **Yes** — two new concepts; `POST /api/firmware/install`
  after adding them (AGENTS.md §6). Local-dev only during build (per project constraint).
- **Amends two ADR-0015 guard tests (operator-approved 2026-07-16).** `pinTag` regains a
  `taPubkey` parameter — used **only** to compose the context `z` stamp. ADR 0015's guards in
  `test/restore-historical-data-and-fix-tl-author-filter.test.js` forbade `taPubkey` on
  `pinTag` outright; they are refined to their true intent: (a) the tag-pinning **base** `z`
  must still be composed from `LEGACY_TA_PUBKEY` (asserted directly, and strengthened); (b) a
  caller may pass `taPubkey` **only** alongside a `context` — never into a neutral pin. The
  ADR-0015 protection is preserved, not weakened. `LEGACY_TA_PUBKEY` / `TAG_PINNING_HANDLE`
  are unchanged.

## Implementation notes

**SDK (`src/lib/event-tagging/`, CommonJS, re-export from `index.js`; vite-aliased for the client):**
- New `pins.js`:
  - `pinVariantKey({ contextSlug })` → `''` when falsy, else `` `-in-${contextSlug}` ``. The
    single discriminator. (Bare pins ⇒ empty ⇒ current d-tags unchanged.)
  - `contextHandle(taPubkey, contextSlug)` → `` `39998:${taPubkey}:${contextSlug}` ``.
  - `contextSlugOfPin(pinEvent, taPubkey)` → the `contextSlug` recovered from the pin's `z`
    stamps (match a `39998:<taPubkey>:<slug>` that is one of the known context slugs), or
    `null`. (Matching against the known-context set disambiguates the context stamp from the
    `tag-pinning` `z`, which composes from the *legacy* pubkey, not the runtime TA.)
  - `contextPinsToTags(pinEvents, { trustFilter })` → pure: dedupe by the pinned tag's
    a-coordinate, drop authors failing `trustFilter(authorPubkey)`, return
    `[{ tagSlug, tagName, tagAuthorPubkey, aCoord }]`. No I/O.
  - `KNOWN_CONTEXTS = [{ slug:'lfo', name:'LFO' }, { slug:'tapestry-web-of-trust', name:'Tapestry & Web of Trust' }]`
    — reference default set (product-config; a deployment may override).

**Firmware (`firmware/versions/v1.0.0/` — target of the `active` symlink):**
- Add `concepts/lfo/concept-header.json` + `json-schema.json`, and
  `concepts/tapestry-web-of-trust/…`, mirroring
  `concepts/tag-pinning/concept-header.json`'s shape (oNames/oSlugs/…, `nodeLabelRequired`).
- Register both in `manifest.json` `concepts[]`.

**Write path (`ui/src/utils/publishTagPin.js`):**
- `computePinEventDTag(...)` — append `pinVariantKey({ contextSlug })`.
- `pinTag({ tag, curationMethod, context, taPubkey })` — when `context` set: push
  `['z', contextHandle(taPubkey, context.slug)]` (runtime TA, passed by the caller from
  `useConfig().taPubkey`) and thread `contextSlug` into the pin d-tag. Existing
  `TAG_PINNING_HANDLE` `z` stays.
- `computeTLDTag(...)`, `computeNoteBookmarkDTag(...)` — append `pinVariantKey`.

**Server (`src/api/trustedList/refreshPinnedTags.js`):**
- `computeTLDTag(...)` and the note-TL d-tag (`:337`) — append `pinVariantKey`.
- `runOnePin(pin)` / note twin — recover `contextSlug = contextSlugOfPin(pin, TA_PUBKEY)`
  (`TA_PUBKEY` here is the runtime helper already imported) and feed the d-tag builders.
- `enumeratePinnedTags` unchanged; **do not** dedupe by `(obs,author,slug)` (invariant above).

**Server (`prepare-nip51-export` in `src/api/trustedList/…`):**
- When resolving the export d-tag from `pinEventId`, recover the pin's context via
  `contextSlugOfPin` and apply `pinVariantKey` so the kind-30000/30003 export d-tag matches.

**Read path (`src/api/profile-tags/index.js:791–808`):**
- Replace singular `viewerPin` with **`viewerPins`**: the scan already returns all of the
  viewer's pins of the tag (`authors:[viewer], #e:[tagEventId], #z:[TAG_PINNING_Z_TAG]`);
  `dedupeReplaceable` now yields one entry per (bare + each context). Map to
  `[{ context: <slug|null>, pinEventId, createdAt, curationMethod }]`. (Keep a `viewerPin`
  convenience = the `context:null` entry for minimal client churn if useful.)

**Client UI (`ui/src/pages/Tag.jsx`, `ui/src/components/TagPinAffordance.jsx`, `PinnedListPanel.jsx`):**
- `useTagDetail` (`ui/src/hooks/useTagDetail.js:25`) — `viewerPin` state → `viewerPins`.
- Affordance: two actions — **`Pin`** (neutral, unchanged one-step) and
  **`Pin to community…`** → picker over `KNOWN_CONTEXTS` → `pinTag({ …, context, taPubkey })`.
- Per-context pin state (is-pinned, curation panel, unpin) derived from `viewerPins`.

## Out of scope

- In-product chip-nav rendering (our client) — follow-on story #2; this ADR ships the pins,
  the stamp, and the pure `contextPinsToTags` helper only.
- User-created contexts; more-than-one-context-per-pin; automatic/cloud stamping;
  sub-context breadth expansion; community-derived POV; full Community Declarations. All
  deferred per the story.
