# ADR 0001: Tag-type z-hints (shared core constants) + HINT ∪ USAGE applicability Trusted Lists

**Status:** Accepted (kind-30393; house-POV trusted usage — operator-confirmed 2026-07-06)
**Date:** 2026-07-06
**Story:** `engineering-team/stories/tag-applicability/1-type-hints-and-applicability-lists.md`
**Epic:** `engineering-team/epics/tag-applicability.md`

## Context

Story 1 lays the applicability substrate: (a) newly-created tag-elements emit an **additive**,
pubkey-free z-hint recording their creation context (`tag-for-nostr-pubkey` / `tag-for-nostr-event`),
and (b) a derivation publishes two TA-signed Trusted Lists whose membership is **HINT ∪ USAGE**.
The ratified doctrine (`TAG-IDENTITY-MEMO`): *topic is the Tag's identity; target-type is a
property of the Tagging; applicability is a derived, per-POV view.* The z is a **hint**, never a
gate; the derived lists are the operative source.

### What the codebase gives us (verified)

| Need | What exists | Where |
|---|---|---|
| Note-flow new-tag-element build | `buildTagElement({name,description,taPubkeys})`; concept-z spread at line 72; built **only** in sequence `c` | `src/lib/event-tagging/builders.js:66-76`, `apply.js:122` |
| Pubkey-flow new-tag-element build | **its own** construction (does *not* use the core builder); concept-z literals | `ui/src/hooks/useProfileTags.js:106-141` (append site :126) |
| Signing/authorship | both flows sign **client-side (NIP-07)** → tag-elements are **user-authored**; only TLs are TA-authored | `apply.js:159-163`, `useProfileTags.js:132` |
| Per-type USAGE (already computed) | tag-index rows carry `byType.{profile,event}={applications,disputes}`, **POV-trust-filtered** | `src/lib/event-tagging/taggings.js:193,202-205`; `src/api/event-tags/index.js:370-442` |
| TA-signed TL builder/signer/publisher | `buildAndPublishTL({kind,dTag,title,metric,items,extraTags,content})`; kinds 30392–30395; runtime TA key; `strfry import` | `src/api/trustedList/index.js:116-156` |

Two facts drive the design:

1. **The emit is two physically separate sites** (note core vs profile hook) — there is no
   single tag-element construction path. So the two z strings must be **one shared definition**
   consumed by both. The event-tagging core is already imported by the UI via the
   `@tapestry/event-tagging` Vite alias — so the core is the single home (§1d).
2. **`byType` already gives per-type usage**, POV-trust-filtered — so the USAGE half is a read of
   existing machinery, not a fresh scan (§2). But `byType` is keyed on *taggings*, so a
   hint-carrying tag with **zero** usage is absent from the index → the HINT half needs its own
   `#z` scan.

### Constraints
- **Additive / inert** (regression AC): the extra z must not change `classifyEventTaggings`,
  profile-tags reads, or `/api/tags/index`. Inert **by construction** — `classify.js` matches
  specific concept-z / descriptor patterns (`TAG_A_RE`, `DESCRIPTOR_RE`), and a bare
  `['z','tag-for-nostr-event']` literal matches none; `byType` derives from taggings, not the
  tag-element's own z. The tests must prove this, not assume it.
- **No hardcoded TA pubkey** — the two z's are pubkey-free literals (not composed via
  `conceptZTags`); the TL signer resolves the TA at runtime (`getOwnerAssistantKeys`).
- **No new concepts, no re-stamping, no firmware z-seeding** (epic non-goals).
- JS-without-build; no new dependency.

## Options considered

### Option A — Shared core constants + append at both sites; a derivation module reusing the tag-index computation; two kind-30393 TA TLs *(chosen)*

- **Constants:** a new `src/lib/event-tagging/applicability.js` exporting
  `TAG_FOR_NOSTR_PUBKEY_Z = 'tag-for-nostr-pubkey'` and `TAG_FOR_NOSTR_EVENT_Z = 'tag-for-nostr-event'`,
  re-exported from `index.js`. Consumed by `builders.js` (note) and `useProfileTags.js` (profile,
  via the alias). One definition, no literals scattered.
- **Emit:** `buildTagElement` gains an optional `applicabilityZ` param and appends
  `['z', applicabilityZ]` when present; `apply.js` (sequence `c`) passes `TAG_FOR_NOSTR_EVENT_Z`.
  `useProfileTags.createTag` appends `['z', TAG_FOR_NOSTR_PUBKEY_Z]` after its concept-z literals
  (:126). Additive — the existing concept-z(s) are untouched and still first.
- **Derivation** (`src/api/trustedList/refreshApplicabilityLists.js`, mirroring `refreshPinnedTags.js`):
  - **USAGE:** reuse the tag-index computation (`core.indexByTag` over the same tagging scan, **house
    POV** trusted predicate — the same path `handleTagIndex` uses). A tag with `byType.event.applications > 0`
    → event set; `byType.profile.applications > 0` → pubkey set. (Builds on the machinery, §2.)
  - **HINT:** `strfry scan {kinds:[39999], '#z':[TAG_FOR_NOSTR_EVENT_Z]}` → event set;
    `#z:[TAG_FOR_NOSTR_PUBKEY_Z]` → pubkey set. (Catches brand-new, usage-less tags.)
  - **UNION** by a-coordinate (`39999:<author>:<slug>`); order by usage count desc (hint-only,
    zero-usage tags last); build `items:[{tag:'a', value:<aCoord>}]`; publish via `buildAndPublishTL`.
- **TL shape:** reuse `buildAndPublishTL` with **kind 30393** (a distinct, already-sanctioned kind in
  the 30392–30395 range — keeps applicability lists cleanly separable from pinned-tag 30392 in
  scans), `metric:'tag-applicability'`, fixed global d-tags
  `tag-applicability-nostr-pubkey` / `tag-applicability-nostr-event` (no observer — these are the
  **house POV's** deployment-global view), `title` = "Tags for Nostr Pubkeys" / "Tags for Nostr
  Events", members as **`a` tags**, and `content` JSON `{members:[{a, applications}]}` for picker
  ranking (counts are free from the index; a bare list is the fallback).
- **`buildAndPublishTL` extension:** add an `item.tag === 'a'` branch to the item loop (→ `['a', value]`),
  alongside the existing `p`/`e` branches. Additive, low-risk, unblocks a-coordinate members.
- **Trigger:** `POST /api/trusted-list/refresh-applicability-lists` (loopback-guarded, like
  `refresh-all-pinned-tags`) + an exported `refreshApplicabilityLists()`. The **schedule** is Story 2.

- **Pros:** minimal change at each emit site; single constant source (§1d); reuses the TL
  signer/publisher and the tag-index usage wholesale; the two lists are the house POV's view
  (POV-consistent); inertness holds by construction.
- **Cons:** the emit is genuinely two edits (note core + profile hook) — unavoidable given the two
  construction paths (Option B rejects unifying them). `buildAndPublishTL` grows one branch.

### Option B — Unify tag-element creation through the core builder (one emit site)

Route `useProfileTags.createTag` through the event-tagging core builder so the hint append lives in
one place.

- **Cons (decisive):** the profile-tag stack (`useProfileTags`, ADR-0015 legacy-z literals) is
  shipped and load-bearing; re-pointing its tag-element construction at the core builder is a
  cross-cutting refactor of the profile-tagging pipeline for no user-facing gain, with real
  regression surface. Two small appends against one shared constant is the additive, lower-risk
  path. Rejected.

### Option C — Derive lists from HINT only (declared z)

- **Cons (decisive):** z-membership is **author-only** and no pre-existing tag carries the new z —
  a hint-only list hides every existing tag and pressures per-type re-minting (identity forks).
  The doctrine's core reason for HINT ∪ USAGE. Rejected.

### Option D — TL members as `e`-tags (tag-element event ids)

- **Cons (decisive):** event ids are edit-fragile; §2 requires **a-coordinates** (stable across
  edits). Hence the `a`-member branch. Rejected.

## Decision

**Option A.** Define the two pubkey-free z constants once in the event-tagging core
(`applicability.js`), append them additively at the two existing emit sites (note-core
`buildTagElement` via an optional param; profile-hook `createTag`), and add a
`refreshApplicabilityLists()` derivation that unions **house-POV-trusted USAGE** (reusing the
tag-index `byType` computation) with **HINT** (`#z` scans) and publishes two **kind-30393**
TA-signed Trusted Lists (members as `a`-coordinates, ranked by usage), via a one-branch extension
of `buildAndPublishTL`. Exposed by a loopback-guarded refresh endpoint; the schedule is Story 2.

## Consequences

- **Enables:** Story 2's type-aware picker (consumes the two lists; falls back to live
  `/api/tags/index` filtered by `byType`); Story 3's same-slug lookup.
- **POV note (pre-empting the invariant check):** the lists are the **house POV's** applicability
  view — TA-signed, derived with the house-POV trusted predicate. This is POV-consistent (the TA
  is the house delegate); per-user applicability is a future extension, not v1. The USAGE half is
  therefore **WoT-gated** (anti-spam): an untrusted pubkey applying a garbage tag to an event does
  **not** put it in the list. *(Operator flag — see below; the brief's "tags observed being
  applied" could be read as unfiltered. I chose trusted-usage because it's POV-consistent and
  spam-resistant, and it's free from the existing index.)*
- **Constrains:** the two z strings + the TL kind/d-tag/shape become the contract Story 2 depends on.
- **Debt:** the emit lives in two places (documented); if a third tag-element construction path
  ever appears, revisit unifying on the core builder.
- **Firmware reinstall?** **No.** No concept/schema change; the z's are inert wire literals, not
  concept seeds (epic non-goal). A docs-mode follow-up records the two-string convention in
  `protocols/drafts/tags.md` once shipped.

## Implementation notes

- **`src/lib/event-tagging/applicability.js`** (new): export `TAG_FOR_NOSTR_PUBKEY_Z`,
  `TAG_FOR_NOSTR_EVENT_Z` (bare literals). Re-export from `src/lib/event-tagging/index.js`.
- **`src/lib/event-tagging/builders.js`** — `buildTagElement({..., applicabilityZ})`: after the
  concept-z spread (:72), `if (applicabilityZ) tags.push(['z', applicabilityZ]);`.
- **`src/lib/event-tagging/apply.js`** — sequence `c` (:122) passes `applicabilityZ: TAG_FOR_NOSTR_EVENT_Z`.
- **`ui/src/hooks/useProfileTags.js`** — `createTag`: import the constant from `@tapestry/event-tagging`;
  push `['z', TAG_FOR_NOSTR_PUBKEY_Z]` after the local-z (:126). Signing/publish path unchanged.
- **`src/api/trustedList/index.js`** — `buildAndPublishTL` item loop: add
  `else if (item.tag === 'a') tags.push(['a', item.value]);`. No change to `p`/`e`.
- **`src/api/trustedList/refreshApplicabilityLists.js`** (new): `refreshApplicabilityLists()` →
  (1) reuse the tag-index `byType` computation at house POV; (2) `#z` hint scans; (3) union by
  a-coord, order by usage desc; (4) two `buildAndPublishTL` calls (kind 30393, the two d-tags,
  `metric:'tag-applicability'`, `a`-items, counts in `content`). Export a loopback endpoint
  `POST /api/trusted-list/refresh-applicability-lists` registered in `trustedList/index.js`'s
  `register()` (mirror `handleRefreshAllPinnedTags`'s `isLoopbackRequest` guard).
- **Testability (seam):** `refreshApplicabilityLists({ deps })` should accept injected
  `scanStrfry` / `indexByTag` / `publishTL` so the union rule (hint-only, usage-only, both), the
  a-coordinate encoding, ordering, and the two-lists output are behavioral tests with in-memory
  fakes — no live strfry/TA key. The two constants get a pure equality test. The **inertness**
  regression: feed a tag-element carrying the extra z through `classifyEventTaggings` and assert
  identical output to the same event without it.

## Out of scope
- The type-aware picker and the **schedule** (Story 2); the same-slug warning (Story 3).
- Unifying the two emit paths (Option B); per-user (non-house) applicability views.
- Firmware seeding of the z's; graduating them to a-tag handles (a future pointer-b-tag bridge).

## Open questions for the gate
1. **TL kind** — I chose **30393** (distinct kind in the sanctioned 30392–30395 range) over
   "30392 + a distinct metric". Confirm, or prefer metric-only disambiguation on 30392.
2. **WoT-gated usage** — I chose house-POV **trusted** usage (anti-spam, POV-consistent) over
   raw/unfiltered "any tagging counts". Confirm this is the intended reading of §2.
