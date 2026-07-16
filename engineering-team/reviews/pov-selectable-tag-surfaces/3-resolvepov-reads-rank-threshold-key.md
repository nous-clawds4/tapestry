# Review: Story 3 — The POV rank threshold actually applies (resolvePov reads the stored key)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-07-09
**Diff:** `git show HEAD` (commit `f6b00cec` on `feat/tags`)
**Story:** `engineering-team/stories/pov-selectable-tag-surfaces/3-resolvepov-reads-rank-threshold-key.md`
**Test plan:** `engineering-team/stories/pov-selectable-tag-surfaces/3-resolvepov-reads-rank-threshold-key.test-plan.md`
**ADR:** none — obvious correctness bug; approach captured in the story (per Standard-strictness Bug row).

## Quality gates (run by reviewer, not trusted)

- [x] `node test/pov-rank-threshold-key.test.js` → **7 passed, 0 failed** (B1–B6 + S1).
- [x] `node test/pov-resolution-status.test.js` (Story 2) → **21 passed, 0 failed** — unregressed.
- [x] `node test/pov-selectable-tag-surfaces.test.js` (Story 1) → **17 passed, 0 failed** — unregressed.
- [x] `node -c src/api/_shared/pov.js` and `node -c src/api/search/profiles/meili/index.js` → both OK.
- [x] Spot-check search suites: `search-result-parity` 11/11, `search-results-url` 9/9, `tag-index` 7/7 — green.
- [x] POV-consumer suites exercising the changed `minRank` path: `profile-tags` 13/13, `profile-tag-consume-by-a-coordinate` 15/15, `event-tagging-read-api` 11/11, `note-trusted-list` (live-gated; ran clean/exit 0) — green.
- [ ] Full `npm test` — not run to completion: it blocks on live-API integration suites that require the running Docker stack (known, stack-dependent, not this diff's). All non-live suites touching the changed code path were run individually and are green. The known dual-z-writer source-contract / live-API failures are pre-existing and unrelated.
- [x] _Lint / typecheck / build not configured — skipped._

## Spec adherence — AC by AC (all traced against `src/api/_shared/pov.js:81-87`)

| AC | Input | Expected | Trace | Test | Result |
|---|---|---|---|---|---|
| Saved threshold applies | `{enabled:true, cutoff:2}` | `minRank===2` | `enabled!==false` ✓, `Number.isFinite(2)` ✓ → 2 | B1 | PASS |
| Disabled filter doesn't filter | `{enabled:false, cutoff:2}` | `minRank===null` | first branch skipped (`enabled!==false` is false); legacy fallback `Number.isFinite(min)` false → null | B2 | PASS |
| Zero is a real floor | `{enabled:true, cutoff:0}` | `minRank===0` | `Number.isFinite(0)===true` and `0` assigned before the `else` — **not** dropped | B3 | PASS |
| No rank filter → null | no `filters`/`filters.rank` | `minRank===null` | `filters?.rank` → `rankFilter=null`; both branches false → null | B4 | PASS |
| Legacy `.min` honored | `{min:3}` | `minRank===3` | cutoff branch false; `Number.isFinite(3)` → 3 | B5 | PASS |
| Cutoff without explicit `enabled` | `{cutoff:4}` | `minRank===4` | `undefined!==false` is true → 4 (present = on) | B6 | PASS |
| Meili tag-match uses resolved threshold | source | no `filters.rank.min` re-derivation | proxy now destructures `minRank` from `resolvePovWithStatus` and passes it (`meili/index.js:143,192`) | S1 | PASS |

Every acceptance criterion has a passing test. No criterion silently dropped. No behavior added beyond the bug fix.

## Detailed verification against the review brief

1. **Derivation correctness.** All six cases traced above hold. `Number.isFinite` guards are correct; `enabled !== false` correctly treats undefined-enabled as on; `0` survives because it is assigned inside the truthy `Number.isFinite(cutoff)` branch (never falls through to `null`).

2. **The bug is real + root-cause fix.** Grep confirms **nothing writes `filters.rank.min`** anywhere in `src/`. The settings UI (`ui/src/pages/grapevine/SearchPreferences.jsx:380,385,693,717,721`) persists `{ enabled, cutoff }` — the exact shape the fix now reads. So pre-fix `minRank` was structurally always `null` for any real user/house config, and the `!!povSuffix && Number.isFinite(minRank)` guard was always false. Fix targets root cause (read the key that is actually written), not a symptom.

3. **No over-reach.** The `return` statement is byte-identical to before — `delegatedPubkey`, `povSuffix`, `filters`, `sort`, `requestedPov`, `delegateSource` all unchanged. Only the `minRank` derivation block changed. The house-prefs path benefits from the same corrected read because `filters` may be sourced from `housePrefs.filters` (`pov.js:71`), and house prefs use the identical `{enabled,cutoff}` shape (same SearchPreferences UI). That is intended and correct.

4. **Meili proxy change.** `minRank` is destructured from `resolvePovWithStatus` (`meili/index.js:143`) and passed to `computeTagMatches` guarded by `Number.isFinite` (`:192`). The profile-filter path (`:154-161`) is UNCHANGED — it still namespaces and forwards the whole `{enabled,cutoff}` object to Meili as `wot_rank_<suffix>` filter columns. No double-application: the profile path filters via Meili index columns; the tag-match path filters a strfry author scan inside `computeTagMatches`. Two distinct mechanisms over two distinct data sources, each applied once.

5. **Strict superset for the unconfigured case.** When `filters` is absent/empty, `rankFilter` is `null` → `minRank` stays `null` → no new filtering imposed on fresh/dev instances. Confirmed (AC B4).

6. **Consistency.** Every POV-aware read resolves its threshold through `resolvePov`/`resolvePovWithStatus` (grep: `profile-tags/index.js`, `event-tags/index.js`, `trustedList/refreshPinnedTags.js`, `meili/index.js`). After this fix the only remaining `filters.rank.min` derivation (the meili proxy's duplicate) is removed, and S1 guards against its return. No read derives its own threshold anymore.

## Consumer-impact assessment (behavior change: thresholds now actually apply everywhere)

Every `minRank` consumer follows the same contract: `wotFiltering = !!povSuffix && Number.isFinite(minRank)`, then keep assertions whose `wot_rank_<suffix> >= minRank`. These consumers were **written expecting a real threshold**; the bug simply never delivered one, so they silently ran unfiltered. No consumer relied on `minRank` being null as intended behavior — flipping to real thresholds is the designed semantic. This is exactly the story's intent ("the selected POV must actually *apply* its threshold").

**`refreshPinnedTags.js` — the notable one (durable, TA-signed output).** `runOnePin` resolves the observer POV via bare `resolvePov` (`:149`) and feeds `minRank` into `aggregateProfilesTagged` (`:156-158`), then publishes a kind-30392 Trusted List with a `['min-rank', String(minRankForTag)]` tag (`:154,203`).

- **Before:** `minRank` always null → TL computed over *all* authors' assertions, tagged `min-rank=0`.
- **After:** for an observer whose prefs carry an enabled cutoff, `minRank` resolves to that cutoff → TL membership is filtered to authors with `wot_rank_<suffix> >= cutoff`, and the `min-rank` tag records the real threshold.

This is **correct, not a surprise in the wrong direction**: the TL is "the observer's trusted list from the observer's POV," so applying the observer's own configured rank threshold is precisely the intended semantic — ignoring it was the bug. Internal consistency is preserved before and after (the `min-rank` tag matched the actual filtering in both states). Note the fix does **not** touch `curation.cutoff` (`:153`), which is the target-level disputes-function cutoff — a different axis from author-level `minRank` — so the disputes function is unchanged and there is no conflation.

*Operational note (non-blocking):* on the next TL refresh cycle, observers who have a saved rank cutoff will republish their pinned-tag TLs with the threshold applied, so membership may shrink relative to the currently-published (unfiltered) TLs. This is the intended correction, but worth an operator heads-up since the output is durable, TA-signed, and federated. This matches the story's live proof M1 (own POV flipped `{mode:unfiltered, minRank:null}` → `{mode:filtered, minRank:2}`).

## Concept-graph integrity
- [x] No concept definitions changed → no firmware reinstall needed.
- [x] No concept handles touched; still `kind:pubkey:slug` elsewhere.
- [x] No TA-pubkey hardcode introduced; no `LEGACY_*` constants removed.

## Things tests can't catch
- [x] No secrets committed.
- [x] No new debug logging (the `console.error` in the tag-match catch is pre-existing).
- [x] No commented-out or dead code; the old `minRankRaw`/`minRankFromFilters` lines are removed, not orphaned.
- [x] Edge cases handled: `0` floor preserved; disabled filter honored; legacy `.min` back-compat retained.
- [x] No concurrency surface introduced (pure synchronous derivation).
- [x] No injection/boundary risk — reads already-parsed prefs objects.

## House rules
- [x] Concept Graph API authority respected (untouched).
- [x] No new lint/typecheck/build tooling.
- [x] Local-only / POV-first architecture honored — filtering stays at read time per active POV; no denormalized global "trusted set" introduced.

## Findings

### Blocking
None.

### Non-blocking
1. **`src/api/_shared/pov.js:83-86`** — the legacy `.min` fallback does not re-check `enabled`, so a hypothetical `{ enabled:false, min:3 }` would still resolve `minRank=3`. This combination cannot occur in practice (the `enabled` flag belongs to the new cutoff shape; nothing writes `.min` at all, and legacy `.min` configs predate `enabled`), so it is theoretical only. No change requested.
2. **`src/api/_shared/pov.js:17`** — the module-header doc comment still reads "`minRank is filters?.rank?.min when finite-numeric`", now stale vs. the implementation. Optional doc tidy; the authoritative inline comment at `:75-80` is correct.

## Verdict
**PASS**

The fix reads the key the UI actually writes (`filters.rank.cutoff` gated by `enabled`), preserves the `0` floor and legacy `.min`, leaves the four other `resolvePov` return fields and the meili profile-filter path untouched, removes the last duplicate threshold derivation, and correctly propagates the real threshold to every POV-aware read — including the durable observer-POV TLs, where applying the observer's own configured threshold is the intended semantic. All acceptance criteria are covered by passing tests; the Story 1 and Story 2 suites are unregressed.
