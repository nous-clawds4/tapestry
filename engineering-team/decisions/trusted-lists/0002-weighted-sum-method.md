# ADR 0002: Weighted-sum method — fold in the aggregator, score on the existing slot

**Status:** Accepted
**Date:** 2026-08-27
**Story:** `engineering-team/stories/trusted-lists/2-input-agreement-method.md`

## Context

Rung 2 publishes one per-member score — the signed trust-weighted sum Σ(w×r) — on TLs when
the `input` method is active, leaving membership/ordering count-based. Constraints and
existing machinery:

- `aggregateProfilesTagged` (`src/api/profile-tags/index.js:640`) already fetches each
  gate-passing asserter's Meili doc and reads `wot_rank_<povSuffix>` for the gate
  (`:666-672`); when `wotFiltering` is false (no POV / no minRank) no ranks exist at all.
- `runOnePin` (`src/api/trustedList/refreshPinnedTags.js`) dispatches membership through the
  Story-1 `membershipFolds` map and already threads `m.score` → p-tag third slot + content
  JSON via `buildAndPublishTL` (`items[].score`, `String()`-serialized).
- **Collision:** the Story-12 `includeScoreInTL` branch (`refreshPinnedTags.js:169-186`) sets
  `m.score` to the member's own `wot_rank` — a *different meaning* for the same slot.
- POV cascade (`src/api/_shared/pov.js`): ephemeral observers with no user-prefs fall back to
  house prefs; `wotFiltering` requires `povSuffix && Number.isFinite(minRank)`.
- Float noise: summing decimal weights in binary floats yields values like
  `0.30000000000000004` — hostile to the story's hand-validation purpose.
- Predicate interaction: an exact 50/50 **count** split can never appear on the TL
  (`applies > disputes` fails), so the story's "equal-rank apply + dispute → score 0"
  known-value is unobservable as written; an equal-**weight**, unequal-count scenario shows
  the same property and passes the predicate.

## Options considered

### Option A — Accumulate weights inside `aggregateProfilesTagged` (chosen)

Extend the existing per-target entries with `weightedInput` (Σw) and `weightedSum` (Σw×r),
accumulated in the same loop that already buckets counts, using the already-fetched author
docs; expose `wotFiltering` (already returned) as the weights-available signal.

Pros: exactly the spec handoff's seam; zero extra I/O (docs already in hand); counts and
weights provably derive from the same gate + bucketing. Cons: touches a shared aggregator —
mitigated by additive-only fields (callers that ignore them are unaffected).

### Option B — Second pass in `runOnePin` (re-fetch docs, weigh there)

Pros: aggregator untouched. Cons: duplicates the gate/bucketing logic and re-fetches Meili
docs — two sources of truth for "who counts", the exact drift class the estate avoids.
Rejected.

## Decision

**Option A**, with these bindings:

1. **Fold:** in the aggregation loop, for every counted tagging: `w = doc[rankField]/100`,
   `r = +1` (apply) / `−1` (dispute); `entry.weightedInput += w`, `entry.weightedSum += w*r`.
   Only when `wotFiltering` is true (identical author set to the counts).
2. **Dispatch:** in `runOnePin`, `input` runs the same `applyDisputesFunction` (membership +
   ordering unchanged by construction), then attaches `score = round6(weightedSum)` from the
   target's entry. **Fallback:** if the method resolves to `input` but `wotFiltering` is
   false, the fold degrades to `count` and the wire tag records `count` — the tag always
   names the math that ran (story AC).
3. **Score slot collision:** when the active method is not `count`, the Story-12
   `includeScoreInTL` enrichment is **skipped** — the method's score owns the slot. (Legacy
   meaning preserved under `count`; divergence documented here and in the review.)
4. **Serialization:** `round6(x) = Number(x.toFixed(6))` — kills float noise for hand
   validation. *Deviation from the story's "unrounded":* full precision modulo 6-decimal
   rounding; flagged at the gate. p-tag carries `String(score)` (negative values legal at
   this rung); content JSON carries the number.
5. **UI/registry:** `IMPLEMENTED_METHOD_IDS` gains `'input'`; the panel option flips
   `available: true` with label "Weighted sum — trust-weighted applies − disputes" and a
   single-number blurb.
6. **Known-value scenario adjustment:** the 50/50 case ships as *equal-weight, unequal
   count* — two rank-40 applies + one rank-80 dispute → member passes the count predicate,
   score 0. A negative-score case (two rank-3 applies + one rank-90 dispute → −0.84) is
   added to make dispute-dominance visible.

### The operator validation kit

`scripts/tl-ladder-validate.js` (host-run Node, no new deps; env `BRAINSTORM_BASE_URL`,
`MEILI_URL_HOST` as in the live suites). Method-aware expectation table so rung 3 reuses it
unchanged. Steps:

1. **House-POV precondition:** probe the active POV via the `tags-for-profile` pattern
   (`test/helpers/livePov.js:50-62`). If `povSuffix`/`minRank` are missing, write
   `grapevine.searchPreferences` (fixed dev delegate + `filters.rank {enabled, cutoff: 3}`)
   into the container's `/var/lib/brainstorm/settings.json` via `docker exec` (dev-only kit;
   prints what it changed).
2. **Set the method** to `input` the same way (printed loudly — it is changing the
   operator's pipeline setting on a dev stack).
3. **Seed:** ephemeral scenario npubs via `nak`; Meili docs with the scenario ranks under
   `wot_rank_<povSuffix>` (upsert + bounded task-wait, mirroring `livePov`); one tag + pin
   (ephemeral observer, cutoff 1) + taggings per scenario, published through
   `/api/strfry/publish`.
4. **Refresh** via the docker-exec loopback; **read back** each TL via `strfry scan`;
   **print** a table: scenario, expected score, published score, ✓/✗, plus the raw p-tag for
   optional eyeballing. Exit non-zero on any ✗.

Re-runnable: fixture names carry a `tlkit-` prefix + timestamp; re-runs create fresh
scenario tags (old fixture TLs retract naturally as their pins vanish — same lifecycle as
any dev events; local relay only).

## Consequences

- Rung 3 becomes: add one branch (`certainty`) that reads the same two accumulators and
  applies `(weightedSum/weightedInput) × (1 − 0.5^weightedInput)` — no new plumbing, kit
  reused with a new expectation column.
- The shared aggregator gains two additive fields; other callers (`handleProfilesTagged`)
  ignore them — no read-path change.
- `includeScoreInTL` semantics fork by method (point 3) — must be reconciled at rung 4 when
  the score slot is formalized.
- The p-tag score slot carries non-integer/negative strings while `input` is active —
  the operator-ratified contract bend; rung 4 settles it.
- **Firmware reinstall required?** No.

## Implementation notes

- `src/api/profile-tags/index.js` — in `aggregateProfilesTagged`: initialize
  `weightedInput: 0, weightedSum: 0` on new entries; accumulate inside the existing
  apply/dispute branches only when `wotFiltering` (the author doc + rankField are in scope);
  no signature change (`wotFiltering` already returned).
- `src/api/trustedList/membershipMethods.js` — `IMPLEMENTED_METHOD_IDS = ['count', 'input']`.
- `src/api/trustedList/refreshPinnedTags.js` — extend the `membershipFolds` map with
  `input`; compute effective method (`input` + no `wotFiltering` → `count`) BEFORE the wire
  tag is written; guard the `includeScoreInTL` block with `membershipMethod === 'count'`;
  `round6` helper local to the module.
- `ui/src/pages/grapevine/TrustDetermination.jsx` — flip the `input` entry to
  `available: true`, update label/blurb.
- `scripts/tl-ladder-validate.js` — new, per the kit spec above.

## Out of scope

- Rung 3 math beyond the accumulator reuse noted; rung 4 formalization (predicate flip,
  0–100 integers, `rigor` tag, `membership-method` spec-or-strip, `includeScoreInTL`
  reconciliation).
- Any UI display of scores beyond the raw published events (the operator reads events/kit
  output at this rung).
