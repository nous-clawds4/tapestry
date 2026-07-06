# Test Plan: tag-applicability Story 1 — z-hints + HINT ∪ USAGE applicability Trusted Lists

**Story:** `engineering-team/stories/tag-applicability/1-type-hints-and-applicability-lists.md`
**ADR:** `engineering-team/decisions/tag-applicability/0001-type-hints-and-applicability-lists.md`
**Date:** 2026-07-06

## Test level decision

- **Executes the real code where it can.** The event-tagging core is dependency-free CommonJS,
  so C/E/I tests `require` it and drive the constants, the additive emit (`buildTagElement` +
  `applyEventTagging` via a `sign` spy), and the inertness of the hint through
  `classifyEventTaggings`. The derivation (D) executes the new
  `refreshApplicabilityLists({ deps })` with a filter-dispatching `scanStrfry` fake, injected
  usage rows, and a `publishTL` spy — the whole HINT ∪ USAGE rule + TL shape as observable
  behavior, no live strfry/TA key.
- **Source sentinels** only where the target signs/publishes or is JSX-adjacent: the profile-hook
  emit (P1), the `buildAndPublishTL` `a`-branch (B1), the loopback refresh endpoint (Rt1).

## Coverage map

| Criterion (story AC) | Test(s) | Level |
|---|---|---|
| Additive hint on pubkey-flow creation | P1 (profile-hook emits `['z', TAG_FOR_NOSTR_PUBKEY_Z]`) | sentinel |
| Additive hint on event-flow creation | E1 (builder append, additive), E2 (apply seq-c tag-element carries it) | core exec |
| Hints carry no pubkey, one definition | C1 (exact strings, no 64-hex, exported from core), P1 (UI imports the constant, no literal) | core exec + sentinel |
| Hints inert to every existing reader | I1 (classify identical with/without hint; not mistaken for a tagging), I2 (hint matches no concept-handle pattern → invisible to profile-tags / tag-index / classify) | core exec |
| Derived membership is HINT ∪ USAGE | D1/D2 (usage-only → correct list), D3 (hint-only cold-start), D4 (both), D5 (union dedup by a-coord) | module exec |
| Published as TA-signed TLs, a-coordinate entries | D6 (two lists, kind-30393, d-tags, metric, titles, `a`-items), B1 (`buildAndPublishTL` a-branch), Rt1 (loopback publish endpoint) | module exec + sentinel |
| Additive & no new concepts | E1 (concept-z + d + content unchanged; no-hint path emits nothing), I2 (no concept-handle collision) | core exec |

Supporting: D7 (ordering by usage desc, hint-only last).

## Edge cases

- [x] No `applicabilityZ` → builder emits **no** hint z (backward-compatible) — E1.
- [x] Hint appended **after** the concept-z, exactly once; d-tag/content byte-identical (a-coordinate stable) — E1.
- [x] A tag-element carrying the hint is **not** misclassified as a tagging — I1.
- [x] Hint-only (zero-usage) tag still lists via the HINT half — D3.
- [x] HINT + USAGE for the same type → one member (union dedup) — D5.
- [x] Exactly two lists; members are `a`-coordinates; kind-30393; correct d-tags/metric/titles — D6.
- [x] The `/notes`-style existing readers are untouched (hint invisible by handle-shape) — I2.

## Test infrastructure
- Node runner; suite `test/tag-applicability.test.js` registered in `test/test.js`
  (require + run + `overallOk`), exports `{ run }`.
- No live services: core executed directly; derivation driven by injected
  `loadUsageRows` / `scanStrfry` / `publishTL` fakes; `applyEventTagging` driven with a `sign`
  spy + no-op `publish`.

## How to run
```
npm test
# or: node -e "require('./test/tag-applicability.test.js').run()"
```

## Verification

New tests fail against current code for the right reasons (constants/derivation module absent;
emit not yet appended); the two inertness guards (I1/I2) already hold by construction. Confirmed
2026-07-06 at commit `b312a848` (13 fail / 2 pass):

```
✗ C1: core exports the two pubkey-free hint constants            (undefined pre-impl)
✗ E1: buildTagElement appends applicabilityZ additively          (hint not appended)
✗ E2: applyEventTagging seq-c tag-element carries the event hint (only the two concept-z present)
✓ I1: classify never mistakes a hinted tag-element for a tagging (inert by construction)
✓ I2: hint z matches no concept-handle pattern                   (inert by construction)
✗ P1: useProfileTags emits the pubkey hint from the core constant
✗ D1..D7: refreshApplicabilityLists — HINT ∪ USAGE, dedup, kind-30393 shape, ordering (module absent)
✗ B1: buildAndPublishTL a-coordinate member branch
✗ Rt1: loopback POST /api/trusted-list/refresh-applicability-lists
=> tag-applicability pass: 2 fail: 13
```

No shipped-suite edits were needed (this story adds an optional builder param + a new module;
it changes no existing sentinel).
