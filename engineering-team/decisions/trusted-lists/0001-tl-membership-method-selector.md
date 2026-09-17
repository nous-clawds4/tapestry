# ADR 0001: TL membership-method selector — settings-backed pipeline-global choice

**Status:** Accepted
**Date:** 2026-08-27
**Story:** `engineering-team/stories/trusted-lists/1-tl-method-selector.md`

## Context

The story requires a "TL membership method" selector on the Trust Determination Methods page
(`ui/src/pages/grapevine/TrustDetermination.jsx`) that governs how the **server-side** TL
refresh pipeline computes membership — a single pipeline-wide setting, durable across browser
changes and container restarts, with only **Count** (today's math) selectable in this story,
and the computing method recorded on every published TL event.

Relevant existing machinery:

- **Server settings store** — `src/config/settings.js`: two layers, git-tracked
  `src/config/defaults.json` deep-merged under user overrides at
  `/var/lib/brainstorm/settings.json` (persistent volume → survives container restarts).
  Exposed via `src/api/settings/settingsApi.js`: `GET /api/settings` and deep-merge
  `PUT /api/settings`, both owner/admin-gated (`requireOwner`).
- **UI precedent** — `ui/src/pages/grapevine/SearchPreferences.jsx` is a grapevine page that
  already reads and writes `/api/settings`; the new panel follows its pattern.
- **The page's existing selector** — `TrustDetermination.jsx` currently manages the
  *viewer-side* scoring method (`SCORING_METHODS` in `ui/src/context/TrustContext.jsx`,
  localStorage-persisted, per-browser). The new control is server-side and must be visually
  and mechanically distinct from it.
- **The pipeline** — `src/api/trustedList/refreshPinnedTags.js`: `runOnePin` aggregates via
  `profileTags.aggregateProfilesTagged`, computes membership in `applyDisputesFunction`
  (`refreshPinnedTags.js:99`), and publishes through `buildAndPublishTL`
  (`src/api/trustedList/index.js`) with `extraTags` (`observer`, `source-tag`, `cutoff`,
  `min-rank`) and a `metric` tag (`'pinned-tag-membership'`).

Constraints: no new lint/build tooling; local-only publishing during this book. Concept
handles verified against the live graph after stack bring-up (2026-08-27):
`39998:<TA>:nostr-user-tag` (taggings) and `39998:<TA>:tag-pinning` (pins) exist as expected;
this story touches no concept definitions. **Local-machine note:** the standard host ports are
occupied by other projects (`infra-*` strfry holds 7777/7778; `bs-test-neo4j` holds
7474/7687), so `docker-compose.override.yml` maps tapestry to alternates — control panel
`localhost:8778`, web `8877`, strfry `8777`. Use `TAPESTRY_PORT=8778` on this machine.

## Options considered

### Option A — Settings-store key + owner-gated existing API (chosen)

Add `trustedLists.membershipMethod` to `src/config/defaults.json` (default `"count"`). The
pipeline reads it through `getSettings()` at refresh time. The UI panel on
`TrustDetermination.jsx` reads `GET /api/settings` and writes the one key via the existing
deep-merge `PUT /api/settings`, exactly as `SearchPreferences.jsx` does.

Pros: zero new persistence machinery; durable on the persistent volume; owner/admin-gated for
free (method choice is an operator act); defaults layer makes "no selection ever made =
count" literal; the settings page's reset semantics come along free.
Cons: `PUT /api/settings` is a broad endpoint — the panel must write only its key (deep-merge
makes this safe); requires owner login to change (correct for this story's persona).

### Option B — Per-pin curation-method extension

Extend the pin event's curation payload with a method field; each TL computed per its pin.

Pros: consistent with how `cutoff`/`includeScoreInTL` already ride pins; per-tag
experimentation.
Cons: the operator explicitly chose pipeline-global at Planning; requires re-publishing every
pin to change method (poor fit for "switch and compare" testing); wire churn on a draft spec
mid-validation. Rejected on operator direction; revisit only if a future story wants per-pin
override.

### Option C — `brainstorm.conf` env var

Pros: trivially global.
Cons: not runtime-editable from the UI; needs container restart per switch — antithetical to
the switch-and-test loop; invisible to the settings page. Rejected.

## Decision

We chose **Option A**. The method is operator-scoped pipeline configuration, which is exactly
what the two-layer settings store exists for, and the owner-gated API + grapevine-page
precedent mean the whole story is additive glue with no new subsystems.

Method identifiers (stable wire strings, fixed now for all four rungs):

| id | UI label | rung |
|---|---|---|
| `count` | Count — verified taggers (current) | 1 (this story) |
| `input` | Input & agreement — weighted sum + apply/dispute average | 2 (planned) |
| `certainty` | Certainty — input → confidence × agreement | 3 (planned) |
| `score` | Score — formalized 0–100 contract | 4 (planned) |

## Consequences

- Rungs 2–4 become: add one branch to the membership computation + enable one radio option.
  The selector, persistence, auth, and wire-recording never change again.
- Every TL the pipeline publishes gains a `['membership-method', '<id>']` tag — **a new
  wire-visible tag on TL events**. The TL event shape belongs to the in-flight tags/TL draft
  spec lineage; the protocols directory entry should gain this tag's definition at rung 4
  (Formalization), when the wire contract is written up anyway. Until then this ADR is its
  record. Consumers ignore unknown tags, so this is backward-compatible.
- An unknown/invalid stored method value must fall back to `count` (fail-safe: the pipeline
  must never refuse to refresh because settings hold a bad string).
- The UI gains a second, differently-scoped control on a page that already has one selector —
  the panel must label the distinction ("how TLs are computed" vs. "which trust source this
  browser views through") or operators will conflate them.
- **Firmware reinstall required?** No — no concept definitions change.

## Implementation notes

- **File: `src/config/defaults.json`** — add `"trustedLists": { "membershipMethod": "count" }`.
- **File: `src/api/trustedList/refreshPinnedTags.js`**
  - Add a small resolver, e.g. `resolveMembershipMethod()`: reads
    `getSettings().trustedLists?.membershipMethod` (require `../../config/settings` lazily,
    matching `getAdminPubkeys`' pattern in `src/utils/config.js:95-102`), validates against
    the known-id set, falls back to `'count'` on anything else. Called inside `runOnePin` per
    refresh (settings reads are cheap file reads; no caching, so a switch applies to the next
    refresh with no restart).
  - In `runOnePin`, thread the resolved id: with `'count'` the existing
    `applyDisputesFunction` path runs unchanged (byte-identical output requirement), and the
    id is appended to `extraTags` as `['membership-method', methodId]`. Structure the
    dispatch as a small map/switch so rungs 2–4 add branches without touching the count path.
- **File: `src/api/settings/settingsApi.js`** — no changes expected; deep-merge PUT already
  accepts the new key. Verify no validator rejects unknown keys (validateRelayUrls only
  checks URL shapes).
- **File: `ui/src/pages/grapevine/TrustDetermination.jsx`** — new panel "TL membership
  method" below the existing viewer-side method section: radio list of the four ids in ladder
  order, `input`/`certainty`/`score` rendered disabled with a "not yet available" note;
  current value from `GET /api/settings` (`settings.trustedLists.membershipMethod`); on
  change, `PUT /api/settings` with body `{ trustedLists: { membershipMethod: <id> } }` only
  (deep-merge preserves siblings). Non-owner sessions: render read-only showing the active
  method (the PUT would 403 anyway). Follow `SearchPreferences.jsx` for fetch/save/toast
  patterns.
- **Constants:** define the method-id list once, server-side (e.g. exported from
  `refreshPinnedTags.js` or a small `src/api/trustedList/membershipMethods.js`), and mirror
  it as a UI constant next to the panel. (No shared module system between server and UI in
  this no-build project; a comment on each side pointing at the other is the existing idiom.)
- The unchanged-output AC ("identical to today for the same inputs") is observable via the
  published TL: same members/counts/order/d-tag, with the single addition of the
  `membership-method` tag. The Tester should pin that delta precisely.

## Out of scope

- The math of rungs 2–4 (each gets its own ADR or an amendment here when planned).
- Per-pin method override (Option B's territory).
- Protocol-spec text for the `membership-method` tag (deferred to rung 4's Formalization).
- Any change to viewer-side `SCORING_METHODS` / `TrustContext`.
