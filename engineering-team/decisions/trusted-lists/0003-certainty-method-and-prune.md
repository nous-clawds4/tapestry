# ADR 0003: Certainty method (0–100 from rung 3) + fixture prune

**Status:** Accepted (operator delegated the rung-3 cycle; gates answered under that delegation)
**Date:** 2026-08-27
**Story:** `engineering-team/stories/trusted-lists/3-certainty-method.md`

## Context

ADR 0002 left rung 3 as "add one branch reading the same accumulators." Two operator
decisions since: certainty publishes on the **0–100 scale immediately** (decimals kept;
rung 4 only rounds + flips the predicate), and this story carries the **fixture prune**
(OPEN 182) so live refreshes stop grinding through months of test debris. `strfry delete
--filter` is available in the deployed strfry build (verified in-container).

## Decision

Minimal-diff continuation of ADR 0002's structure:

1. **Formula branch.** `membershipFolds.certainty` in `runOnePin`: reuse
   `applyDisputesFunction` for membership/order; per member read the rung-2 accumulators and
   attach `score = round6(((weightedSum / weightedInput) * (1 - 0.5 ** weightedInput)) * 100)`
   (0 when `weightedInput` is 0). Fallback generalized: ANY non-count method without
   `wotFiltering` degrades to `count` (wire tag records what ran).
2. **Registry/UI.** `IMPLEMENTED_METHOD_IDS = ['count','input','certainty']`; the certainty
   entry flips `available: true`; blurb states the 0–100 scale.
3. **Kit.** `expectation('certainty', …)` gains the ×100 (it already had the formula); the
   implemented-methods import means `certainty` and `--all` (three columns) just work.
4. **Prune — `scripts/tl-prune-fixtures.js`** (dev-only, host-run):
   - Guard: refuses unless `/api/publish-policy` reports local-only.
   - Fixture slug prefixes (single exported list, extend as suites are added):
     `tlkit-`, `wsumkv-`, `wsumfb-`, `tlmm-`, `repro-`, `repro2-`, plus legacy suite
     prefixes `s11b-`, `s12-`, `tl-tag-`, `cpin-` where they appear in d-tags.
   - Mechanism: `strfry scan` kinds 39999 + 30392/30393, match d-tag against prefixes
     (substring after the standard `profile-tag-`/`tag-pin-`/`tl-pin-` frames), collect ids,
     delete in chunks via `strfry delete --filter '{"ids":[…]}'` inside the container.
     Deleting by explicit id list — never by kind/author alone — is the safety property.
   - Kit integration: `tl-ladder-validate.js` runs the prune before seeding (flag
     `--no-prune` to skip).
   - Report counts per kind; idempotent.

## Consequences

- Rung 4 shrinks to: integer rounding, predicate flip + score ordering, `rigor` tag,
  `membership-method` spec-or-strip, `includeScoreInTL` reconciliation.
- The rung-2 `input` method keeps raw-sum scale (already operator-validated); scales differ
  between methods by design and the method tag disambiguates.
- Prune makes `refresh-all` seconds again; zombie-refresh hazard (review #2 finding) is
  reduced but not eliminated — serialization discipline still applies.
- **Firmware reinstall required?** No.

## Implementation notes

- `src/api/trustedList/refreshPinnedTags.js` — add `certainty` fold; generalize fallback:
  `const membershipMethod = (requestedMethod !== 'count' && !wotFiltering) ? 'count' : requestedMethod;`
- `src/api/trustedList/membershipMethods.js` — IMPLEMENTED list.
- `ui/src/pages/grapevine/TrustDetermination.jsx` — certainty `available: true`, 0–100 blurb.
- `scripts/tl-ladder-validate.js` — ×100 in certainty expectation; pre-seed prune call.
- `scripts/tl-prune-fixtures.js` — new, per §4.
- Tests (Phase 3): new suite `test/tl-certainty-method.test.js` (registry, UI contract, live
  known-values under certainty, prune existence + effectiveness); expectations computed by
  the same JS expression as the implementation (float-exact, no hand-rounded literals).

## Out of scope

Rung 4 items (above); Meili fixture-doc cleanup; legacy-suite hardening (OPEN 183).
