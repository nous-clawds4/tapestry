# ADR 0002: Per-read POV-resolution status (`povResolution`) + cached Meili-stats provisioned check

**Status:** Accepted (with gate amendment, below)
**Date:** 2026-07-09
**Story:** `engineering-team/stories/pov-selectable-tag-surfaces/2-honest-state-for-unprovisioned-pov.md`

## Context

Story 1 (ADR 0001) made one explicit POV selection govern search and every tag surface via
`PovContext` + `resolvePovReadParams`. Story 2 makes the surfaces **honest** when the selected POV
can't actually filter. The acceptance criteria, quoted back:

- **AC-1** Own-POV-not-computed is disclosed, not silently house-substituted.
- **AC-2** Unfiltered-counts are disclosed (surface still works — disclosure, not blockage).
- **AC-3** Not-computed is distinguishable from genuinely-empty (no bare empty state).
- **AC-4** *The read itself reports its honesty* — an explicit machine-readable signal of what
  actually ran (filtered normally / unfiltered / fell back / not computed), consumable by any
  integrator without heuristics (note-TL `["truncated"]` doctrine).
- **AC-5** Provisioned POVs are untouched — strict no-regression; dev/fresh instances keep
  functioning.
- **AC-6** Consistency across surfaces — one definition of "provisioned," derived from the scoring
  machinery itself.

### The three silent degraded modes (verified in code 2026-07-09)

1. **Count-everyone.** `trustPredicateFor(povSuffix, minRank, …)`
   (`src/api/event-tags/index.js:114-125`) returns `() => true` when `!povSuffix ||
   !Number.isFinite(minRank)`. The profile-tags stack repeats the same guard inline —
   `const wotFiltering = !!povSuffix && Number.isFinite(minRank)` in `handleTagsForProfile` (:264),
   `handleWotTags` (:340), `computeTagMatches` (:474), `aggregateProfilesTagged` (:632),
   `aggregateTagPins` (:704), `handleTagIndex` (:1032), `handleAuthoredBy` (:1247). Unfiltered
   counts render exactly like trusted counts. The reads DO already return `povSuffix`/`minRank`
   (nullable), so a sophisticated consumer can infer this mode — but nothing else.
2. **Silent house substitution.** `resolvePov` (`src/api/_shared/pov.js:46-71`): the
   `wotPov==='user'` branch reads the user's prefs file for `rankAuthor`; when absent,
   `delegatedPubkey` falls through to `housePrefs.delegatedPubkey` (line 60). Nothing in the return
   value says which branch supplied the delegate — a user who selected "my own" silently sees house.
3. **Silent emptiness.** `povSuffix` resolves and `minRank` is finite, but no Meili doc carries
   `wot_rank_<suffix>` (scores never computed for that delegate on this instance). The predicate
   rejects everyone (`if (!doc) return false; … typeof r === 'number' && r >= minRank`) and the
   surface renders as genuinely-empty.

### "Provisioned" — pinned by ADR 0001's NIP-85 alignment note

A selected POV is provisioned **iff its resolved `povSuffix` has real `wot_rank_<suffix>` columns**
— exactly what the customer/score pipeline creates — never a hand-maintained registry (POV-first:
the answer comes from the computation's own state).

**The affordable check exists already in spirit:** search's own readiness machinery
(`BrainstormSearch.jsx` `checkMeiliScores()`, :179) reads the Meili index **stats**
(`fieldDistribution` — a map of field name → number of documents carrying it) and checks for
`wot_*` fields. The same stats document answers the per-suffix question in O(1):
`fieldDistribution['wot_rank_<suffix>'] > 0`. One GET covers **all** suffixes, needs no
filterable-attribute configuration, and Meili maintains the distribution as index metadata (no
scan). Server-side we fetch it directly from `MEILI_URL` (`http://nostr-search-meili:7700`,
`process.env.MEILI_URL` override), the same base the tag stacks already use for
`meiliFetchProfilesByPubkey` (`src/api/event-tags/index.js:52`, same pattern in profile-tags),
which tolerates Meili being absent in dev.

### Constraints

- **Additive only.** Integrators (LFO) already consume these reads per
  `docs/INTEGRATION_GUIDE_event-tagging-for-external-clients.md`. New fields only; no existing
  field changes meaning; filtering outcomes byte-identical (this story *discloses*, never changes
  what counts).
- **POV-first / filter-at-read-time.** No stored "provisioned" registry; derive from Meili's own
  state at read time (cached briefly).
- No TA-pubkey literals; JS-without-build; no new tooling.
- Dev boxes may have **no Meili at all** — the design must degrade sanely there (that IS mode-1/3
  territory; AC-5 requires those instances keep functioning).
- Out of scope: provisioning itself / named `resolvePov` branches (NIP-85 epic); search's own
  readiness UX (no regression only); the applicability picker; blocking any mode.

### Concept-graph orientation

Checked `/api/concept-graph/summaries` + neighbors for `web-of-trust` / `nostr-event-tag`: the
concepts touched (tag, nostr-user-tag, nostr-event-tag, web-of-trust) are structural; **no concept
definition or schema changes** — this is read-response + UI honesty plumbing only.

## Options considered

### Option A — Per-read `povResolution` from a shared status module; provisioned check via cached Meili index-stats *(chosen)*

**Server.**

1. `src/api/_shared/pov.js` — `resolvePov` gains two **additive** return fields (no behavior
   change): `requestedPov` (`'user' | 'house'` — normalized: `'user'` iff the existing
   `wotPov==='user' && userPubkey` branch condition held) and `delegateSource`
   (`'user-prefs' | 'house-prefs' | 'none'` — which cascade step actually supplied
   `delegatedPubkey`). Also gains an optional second `deps` param
   (`{ readUserPrefsImpl, loadHousePrefsImpl }`, defaulting to the real ones) for unit testing.
2. New `src/api/_shared/povStatus.js`:
   - `computePovStatus({ requestedPov, delegateSource, povSuffix, minRank, scoresExist })` — **pure**
     (the crux test seam). Returns the status object (shape below).
   - `getWotFieldDistribution({ fetchImpl })` — one GET
     `${MEILI_URL}/indexes/${MEILI_INDEX}/stats`, returns `fieldDistribution` or `null` on any
     failure. Module-level single-entry cache: TTL **60 s** on success, **10 s** on failure (so a
     down Meili isn't hammered but recovery is quick). `__resetPovStatusCacheForTests()` exported.
   - `scoresExistFor(povSuffix, fieldDistribution)` — pure:
     `distribution ? (distribution['wot_rank_'+suffix] > 0) : null`.
   - `resolvePovWithStatus({ wotPov, userPubkey }, deps)` — async composer every read handler calls
     instead of bare `resolvePov`: runs `resolvePov`, **skips the probe entirely when not
     filtering** (`!povSuffix || !Number.isFinite(minRank)` → `scoresExist: null`, no Meili
     dependency — zero added requests on dev boxes), else probes; returns
     `{ …resolvePovOutput, povResolution }`.
3. Every POV-aware tag read swaps `resolvePov` → `resolvePovWithStatus` and adds `povResolution`
   to its response (see table in Implementation notes). `buildTrustPredicate`
   (`src/api/event-tags/index.js:127`) returns it alongside `povSuffix`/`minRank`, so `for-event`
   and `/api/tags/index` get it for free. **The trust predicates themselves are untouched.**

**The status shape** (one new top-level response key, `povResolution`):

```json
{
  "mode": "filtered" | "unfiltered" | "not-computed",
  "fellBackToHouse": false,
  "requested": "user" | "house",
  "delegateSource": "user-prefs" | "house-prefs" | "none",
  "povSuffix": "abcd1234",
  "minRank": 2,
  "scoresExist": true
}
```

- `mode` — what filter actually ran, with documented precedence:
  `unfiltered` (no suffix or no finite minRank — the exact `wotFiltering` guard) →
  `not-computed` (`scoresExist === false`) → `filtered` (scoresExist `true` **or** `null`/unknown;
  we never claim a degradation we can't prove).
- `fellBackToHouse` — `requested === 'user' && delegateSource !== 'user-prefs'`. Deliberately
  **orthogonal** to `mode`: "whose POV ran" and "did a filter run" compose (own-requested can fall
  back to a house that is filtered, unfiltered, or not-computed — a single flat enum would need
  combinatorial values; two orthogonal fields with a headline `mode` is both simpler and more
  honest). The story's four states map to: filtered-normally = `(filtered, false)`; unfiltered =
  `(unfiltered, *)`; fell-back = `(*, true)`; not-computed = `(not-computed, *)`.
- `povSuffix`/`minRank` are duplicated inside for integrator locality (the top-level copies stay).
- `scoresExist: null` = probe unavailable (Meili down / error) — machine-visible, but never
  escalated to `not-computed`. **Decision: Meili-down ≠ not-provisioned.**

**Client.**

4. Each of the six Story-1 surfaces' data sources exposes the status **from its own read**
   (per-read, not context-level — see Option B): `useEventTags`, `useTagIndex`, `useTagDetail`,
   `useProfileTags`, `useAuthoredTagging` add a `povResolution` state (default `null`) set from
   the response; `TagPageSearch` reads it off the meili response it already handles.
5. One shared component `ui/src/components/PovStatusNotice.jsx` (`{ status, variant }`) renders
   the disclosure; returns `null` when `status` is null **or** `(mode==='filtered' &&
   !fellBackToHouse)` — provisioned POVs render nothing (AC-5). `variant='banner'` for pages,
   `variant='compact'` for in-card/inline spots. One component = one wording source (AC-6).
6. CSS: `.bs-pov-notice` / `.bs-pov-notice--compact` in `ui/src/styles.css`, modeled on the
   existing muted-notice pattern (`bsp-event-search-notice` placement, `bsp-tags-loading`
   typography) with an amber/warning tint — it is a *disclosure*, not an error, so not the red
   `bsp-tags-error`.

**Pros:** AC-4 satisfied literally (the read itself reports); status always describes the exact
read that produced the numbers on screen (no cache/race gap); zero extra HTTP round-trips
client-side; probe cost amortized to ~0 by the 60 s cache and skipped entirely when unfiltered;
one pure function defines the state machine (testable without Meili); strictly additive
everywhere.
**Cons:** every read handler is touched (mechanically — one call-swap + one response key);
`povResolution` is duplicated across N in-flight responses (bytes, negligible); per-process cache
means each worker probes once per TTL (fine).

### Option B — One status endpoint consumed by `PovContext`

`GET /api/pov/status?wotPov&userPubkey` computed once per selection change; surfaces render from
context; read responses unchanged.

**Pros:** one fetch per selection; no response-shape changes; single UI wiring point.
**Cons:** **Fails AC-4 outright** — "the read itself reports its honesty" is the story's explicit
integrator requirement (LFO consumes the reads, not our context). Also less honest even for our
own UI: the status is computed at a different time than the read (prefs edits, score loads, and
the `for-tag` response cache can all make the banner disagree with the numbers under it), and it
adds an endpoint + a request. Could complement Option A later (e.g. for the POV *menu* itself),
but cannot replace it. **Rejected as the mechanism** (nothing precludes adding it later).

### Option C — Per-read signal, but provisioned-check via a 1-doc filtered search

Same as A, but probe with `POST /indexes/profiles/search { filter: "wot_rank_<suffix> EXISTS",
limit: 1 }` (or a sampled `meiliFetchProfilesByPubkey`-style doc check).

**Pros:** answers "≥1 doc has the column" just as directly.
**Cons:** `EXISTS` requires `wot_rank_<suffix>` to be in `filterableAttributes` — that's
provisioning-pipeline state we'd now *depend on* for the honesty signal (a suffix loaded without
filterable config would read as not-provisioned: a false mode-3); one query **per suffix** vs one
stats GET covering **all** suffixes; a sampled-doc check is probabilistic (sampling docs that
happen to lack the column ≠ not provisioned). Stats `fieldDistribution` is authoritative,
config-free, and already the pattern search's own `checkMeiliScores` trusts. **Rejected.**

## Decision

We chose **Option A**. AC-4 makes per-read reporting non-negotiable, and the Meili index-stats
`fieldDistribution` is the only probe that is simultaneously authoritative ("does any doc carry
`wot_rank_<suffix>`" — the machinery's own state, per ADR 0001's provisioned definition),
O(1)-per-TTL for all suffixes at once, and dependency-free on dev boxes (probe skipped when
unfiltered; `null` when unreachable). The orthogonal `mode` + `fellBackToHouse` shape encodes all
combinations of the three degraded modes without a combinatorial enum.

## Consequences

- **Enables:** honest tag surfaces (AC-1..3, 6); integrators detect degraded reads without
  heuristics (AC-4); and the *later product decision* the story defers — blocking rather than
  disclosing a mode — becomes a one-line client check on an already-shipped signal.
- **Behavioral non-change (AC-5), argued:** `trustPredicateFor` and every inline `wotFiltering`
  guard are untouched; `resolvePov` gains return fields only (all 9 call sites destructure — table
  below); responses gain one new key (`povResolution`) and no existing key changes; the UI adds a
  notice element that renders `null` for provisioned POVs. Filtering outcomes are byte-identical.
  Responses are a strict superset.
- **Latency:** +1 cached GET per read when filtering (TTL 60 s → amortized ~0); zero when
  unfiltered (dev boxes: zero).
- **Known residual dishonesty (documented, accepted):** when Meili is *fully down* and a POV is
  configured, per-doc lookups fail → the predicate rejects everyone → results are empty, and
  `mode` still says `filtered` (with `scoresExist: null` as the machine-visible hint). Escalating
  an outage to `not-computed` would be a false provisioning claim; distinguishing outage-empty from
  filtered-empty needs failure-awareness inside `meiliFetchProfilesByPubkey` — noted as a possible
  follow-up, out of scope here.
- **Staleness is not detected.** "Provisioned" = columns exist on ≥1 doc. A suffix with *old*
  scores still reads `filtered` (`fieldDistribution` has no age). The ACs require distinguishing
  "never computed," which this does; stale-score detection (e.g. via `wot_updated_at`) is
  follow-up debt for the NIP-85 provisioning epic.
- **`for-tag` response-cache key fix (required for signal correctness):** `forTagCache`'s key
  (`src/api/event-tags/index.js:346`) omits `wotPov`/`userPubkey` while the cached body already
  contains POV-dependent fields (`povSuffix`, `minRank` — pre-existing latent bug for integrators;
  our own UI callers all send no POV params today so no live behavior varies). The key MUST gain
  the normalized POV params so a cached `povResolution` can never describe another POV's read.
  Behavior-preserving for all current callers (their key gains a constant suffix).
- **Docs:** add `povResolution` to `docs/INTEGRATION_GUIDE_event-tagging-for-external-clients.md`
  (additive field, marked as the honesty signal mirroring the note-TL partial signal).
- **Firmware reinstall required?** **No** — no concept/schema/definition change.

### `resolvePov` caller compatibility (all 9 call sites verified — every one destructures)

| Caller | Destructures | Impact of additive fields |
|---|---|---|
| `src/api/profile-tags/index.js:260` (`handleTagsForProfile`) | `povSuffix, minRank` | none; swaps to `resolvePovWithStatus` |
| `src/api/profile-tags/index.js:336` (`handleWotTags`) | `povSuffix, minRank` | none; swaps |
| `src/api/profile-tags/index.js:887` (`handleProfilesTagged`) | `povSuffix, minRank` | none; swaps |
| `src/api/profile-tags/index.js:1028` (profile-side `handleTagIndex`, `/api/profile-tags/index`) | `povSuffix, minRank` | none; swaps |
| `src/api/profile-tags/index.js:1243` (`handleAuthoredBy`) | `povSuffix, minRank` | none; swaps |
| `src/api/trustedList/refreshPinnedTags.js:149` (observer POV, profile TL) | `povSuffix, minRank` | none; **stays on sync `resolvePov`** (publisher, not a read response; TL honesty is the existing partial-signal doctrine) |
| `src/api/trustedList/refreshPinnedTags.js:322` (observer POV, note TL) | `povSuffix, minRank` | none; stays on sync `resolvePov` |
| `src/api/search/profiles/meili/index.js:142` (meili proxy) | `povSuffix, filters, sort` | none; swaps (response gains `povResolution` for `TagPageSearch`; the search page ignores it — its own readiness UX untouched) |
| `src/api/event-tags/index.js:128` (`buildTrustPredicate`) + `:354` (`handleForTag`) | `povSuffix, minRank` | none; swap |

(`computeTagUsageRows` / applicability consume `buildTrustPredicate` but destructure only
`isAsserterTrusted` — unaffected; applicability stays instance-global, out of scope.)

## Implementation notes

### Server

- **`src/api/_shared/pov.js`** — additive: track `delegateSource` through the existing cascade
  (`'user-prefs'` when `userPrefs.rankAuthor` supplied the delegate; `'house-prefs'` when line 60's
  fallback did; `'none'` otherwise); compute `requestedPov = (wotPov === 'user' && userPubkey) ?
  'user' : 'house'` (mirror the branch condition exactly — do not add validation the branch doesn't
  have). Return both. Optional `deps = { readUserPrefsImpl, loadHousePrefsImpl }` second parameter,
  defaulting to the current internals.
- **`src/api/_shared/povStatus.js`** (new) — exports:
  - `computePovStatus({ requestedPov, delegateSource, povSuffix, minRank, scoresExist })` → the
    `povResolution` object. Pure; no I/O. Mode precedence exactly:
    `(!povSuffix || !Number.isFinite(minRank))` → `'unfiltered'`; else `scoresExist === false` →
    `'not-computed'`; else `'filtered'`. `fellBackToHouse = requestedPov === 'user' &&
    delegateSource !== 'user-prefs'`. Nullable normalization matches the endpoints' existing
    `povSuffix || null` / `Number.isFinite(minRank) ? minRank : null`.
  - `getWotFieldDistribution({ fetchImpl = fetch } = {})` — `GET
    ${MEILI_URL}/indexes/${MEILI_INDEX}/stats` (same env/default pattern as
    `src/api/event-tags/index.js:52`); returns `data.fieldDistribution || null`; `null` on non-OK
    or throw. Single module-level cache entry `{ at, value }`; TTL 60 000 ms success / 10 000 ms
    failure. `__resetPovStatusCacheForTests()`.
  - `scoresExistFor(povSuffix, fieldDistribution)` — pure; `null` when distribution is null.
  - `async resolvePovWithStatus({ wotPov, userPubkey }, deps = {})` — compose: `resolvePov` → if
    the `wotFiltering` guard fails, `scoresExist = null` **without probing**; else
    `scoresExistFor(povSuffix, await getWotFieldDistribution(deps))` → return
    `{ ...resolved, povResolution: computePovStatus(...) }`.
- **Endpoints attaching `povResolution` to their JSON response** (call-swap + spread one key):

  | Endpoint | Handler |
  |---|---|
  | `GET /api/event-tags/for-event` | `handleForEvent` via `buildTrustPredicate` (also return `povResolution` from it) |
  | `GET /api/tags/index` | event-tags `handleTagIndex` via `buildTrustPredicate` |
  | `GET /api/event-tags/for-tag` | `handleForTag` (swap at :354; **add normalized `wotPov`/`userPubkey` to `cacheKey`** at :346) |
  | `GET /api/profile-tags/tags-for-profile` | `handleTagsForProfile` |
  | `GET /api/profile-tags/profiles-tagged` | `handleProfilesTagged` |
  | `GET /api/profile-tags/authored-by` | `handleAuthoredBy` |
  | `GET /api/profile-tags/index` | profile-side `handleTagIndex` |
  | `GET /api/profile-tags/wot-tags` | `handleWotTags` (no current consumers; symmetry — same one-line swap) |
  | `GET /api/search/profiles/meili` | `handleMeiliSearchProfiles` (swap at :142) |

  Not attached: `available-tags`/`by-id` (not POV-filtered), `applicability` (instance-global, out
  of scope), TL publishers (not read responses), `match` (internal; composed into the meili proxy).

### Client

- **Hooks** — `ui/src/hooks/useEventTags.js`, `useTagIndex.js`, `useTagDetail.js` (rows fetch),
  `useProfileTags.js`, `useAuthoredTagging.js`: add `const [povResolution, setPovResolution] =
  useState(null)`, set from `data.povResolution || null` in the existing success branch, expose it
  in the return object. `ui/src/components/TagPageSearch.jsx`: keep `data.povResolution` in local
  state from the response it already parses.
- **`ui/src/components/PovStatusNotice.jsx`** (new, shared — the AC-6 single wording source):
  `({ status, variant = 'banner' })`. Render `null` when `!status || (status.mode === 'filtered'
  && !status.fellBackToHouse)`. Message matrix (copy tunable at review; semantics fixed):
  - `unfiltered`, not fellBack: "Counts here are **not trust-filtered** — this instance has no
    point of view configured."
  - `filtered` + `fellBackToHouse`: "Your point of view isn't available on this instance —
    showing the **house** point of view instead." (AC-1)
  - `unfiltered` + `fellBackToHouse`: "Your point of view isn't available here, and no house point
    of view is configured — counts are **not trust-filtered**."
  - `not-computed`, not fellBack: "The selected point of view has **no computed trust scores** on
    this instance — nothing can be counted under it. An empty page here does *not* mean nothing is
    tagged." (AC-3)
  - `not-computed` + `fellBackToHouse`: "Your point of view isn't available; the house point of
    view it fell back to has no computed scores here."
  - Compact variant: short label ("counts unfiltered" / "showing house POV" / "POV not computed
    here") with the full sentence as `title`.
- **Placement (banner over results — never blockage, AC-5/AC-2):**
  - `ui/src/pages/Tags.jsx` — banner from `useTagIndex().povResolution`, above the listing.
  - `ui/src/pages/Tag.jsx` — banner from `useTagDetail().povResolution`, below the header (covers
    both tabs — one page-level disclosure; the Notes tab's `for-tag` read carries its own
    `povResolution`, and per the gate amendment `useNotesForTag`/`usePinnedNotes` are POV-threaded
    in this story, so the banner and the notes agree).
  - `ui/src/components/AuthoredTaggingSection.jsx` — banner from `useAuthoredTagging()`.
  - `ui/src/components/ProfileTagsSection.jsx` — compact, above the tag row.
  - `ui/src/components/NoteTags.jsx` — compact, rendered only when the card shows counted tags
    (`tags.length > 0`) **or** `mode === 'not-computed'` (so unfiltered dev feeds aren't spammed on
    untagged notes, but silent-emptiness is still disclosed per card).
  - `ui/src/components/TagPageSearch.jsx` — compact, under the input (the
    `bsp-event-search-notice` slot pattern).
- **CSS** — `ui/src/styles.css`: `.bs-pov-notice` (block, muted amber tint, small type — follow
  `bsp-event-search-notice`/`bsp-tags-loading` scale) and `.bs-pov-notice--compact` (inline,
  `0.75rem`).

### Testability seams (for the Tester)

1. **`computePovStatus` (pure — the crux):** table-driven over all states with **no Meili**:
   `(house, house-prefs, suffix, minRank, true)` → `filtered/false`; `(house, none, null, null, –)`
   → `unfiltered`; `(user, house-prefs, suffix, minRank, true)` → `filtered` + `fellBackToHouse`;
   `(user, user-prefs, suffix, minRank, false)` → `not-computed` (own computed-delegate-without-
   scores variant); `(user, house-prefs, suffix, minRank, false)` → `not-computed` + fellBack;
   `scoresExist: null` → `filtered` (never a false mode-3); minRank `0` is finite → filtering.
2. **Probe:** `getWotFieldDistribution({ fetchImpl })` with a fake fetch — success/ non-OK/ throw →
   distribution / null / null; TTL behavior via `__resetPovStatusCacheForTests()`;
   `scoresExistFor` — present-positive / present-zero / absent / null-distribution.
3. **`resolvePov` provenance:** with injected `readUserPrefsImpl`/`loadHousePrefsImpl` — each
   cascade branch yields the right `requestedPov`/`delegateSource`, and the pre-existing five
   return fields are byte-identical to before (the no-regression check).
4. **Endpoint contract:** each listed endpoint's response carries `povResolution` whose
   `povSuffix`/`minRank` equal the existing top-level fields (self-consistency), and on a no-Meili
   dev box reads still succeed with `mode: 'unfiltered'` (AC-5). `for-tag`: two requests differing
   only in POV params do not share a cache entry.
5. **UI:** `PovStatusNotice` pure render per matrix row (incl. the two null-render cases);
   source-contract — each of the six surfaces wires its own read's `povResolution` into
   `PovStatusNotice` (per-read, not from context).

## Out of scope

- Provisioning POVs / named `resolvePov` branches / staleness detection via `wot_updated_at` —
  NIP-85 epic.
- Blocking (rather than disclosing) any degraded mode — later product decision this signal enables.
- Search's own readiness UX (`myWotReady` machinery) — untouched; the meili proxy's new field is
  additive and ignored by `BrainstormSearch`.
- Outage-vs-empty disambiguation inside `meiliFetchProfilesByPubkey` — noted follow-up.
- The applicability picker (instance-global) and all write/publish paths.

## Gate amendment (2026-07-09, operator-ratified)

**The Story-1 completeness fix is folded INTO this story** (superseding the out-of-scope line this
section replaces): during Architecture review it was discovered that ADR 0001's surface sweep missed
the tag page's **Notes** views — `ui/src/hooks/useNotesForTag.js` and `ui/src/hooks/usePinnedNotes.js`
(both call `GET /api/event-tags/for-tag`) send **no** `wotPov`, so the tag page shows POV-threaded
*profiles* beside house-only *notes*. Since this ADR already touches `handleForTag` (status attach +
the POV-aware `forTagCache` key), the threading fix rides along:

- `useNotesForTag` and `usePinnedNotes` gain `usePov().povParams` threading — the identical pattern
  as the six Story-1 surfaces (spread the params; add the POV fields to effect deps).
- The `forTagCache` key gains the normalized POV params (already required above for signal
  correctness — the same change serves both).
- The tag page's Notes tab now also carries an accurate per-read `povResolution`; the page-level
  banner (from `useTagDetail`) remains the single Tag-page disclosure surface — no second banner.
- Tests extend the Story-1 surface-consumption suite (S2-family) to these two hooks.

This is a **threading** fix (Story-1 doctrine), not new disclosure scope; it is included so the
"consistency across every tag surface" AC is true of the tag page's notes as well as its profiles.

## Amendment 2 (2026-07-09, after live testing) — unfiltered wording split + testable message util

Live testing surfaced that the single `unfiltered` message ("this instance has no point of view
configured") is inaccurate when a **delegate resolved but no rank threshold is set** (`povSuffix`
present, `minRank` null). The two unfiltered causes are already distinguishable from `povResolution`
(`povSuffix` present ⇒ a delegate resolved), so the wording must reflect them. No status-shape change
is needed (`povSuffix` already carries the distinction). Changes:

- **New `ui/src/utils/povNoticeText.js`** — a **pure** `povNoticeText(status)` returning
  `{ full, short }` or `null` (same "extract the pure rule for tests" convention as
  `povReadParams.js` / `computePovStatus`). It owns the whole wording matrix, now split by
  `!!status.povSuffix` within each unfiltered branch:
  - `unfiltered`, delegate absent (`!povSuffix`): "…this instance has no point of view configured."
  - `unfiltered`, delegate present (`povSuffix`): "…the selected point of view has no trust threshold set."
  - the `fellBackToHouse` unfiltered variants split the same way (house delegate present vs none).
- **`PovStatusNotice.jsx`** — imports `povNoticeText` and renders its output (null-render rule
  unchanged: null status or `filtered && !fellBackToHouse`). The `.jsx` keeps only the presentation;
  the testable wording logic lives in the plain-`.js` util (the Node harness can't parse JSX, but can
  dynamic-`import()` the util — same as `povReadParams`).
- Tests: behavioral over `povNoticeText` (all matrix rows incl. the new split + the two null cases);
  source-contract that `PovStatusNotice` delegates to it.

Still additive/disclosure-only; no filtering change, no status-shape change.
