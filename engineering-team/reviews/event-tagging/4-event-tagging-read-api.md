# Review: Story 4 — Event-tagging read API

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-29
**Diff:** working tree vs `21cc23cb` (test-design commit) — new `src/lib/event-tagging/classify.js`, `src/api/event-tags/index.js`; edits to `src/lib/event-tagging/index.js`, `src/api/index.js`
**Story:** `engineering-team/stories/event-tagging/4-event-tagging-read-api.md`
**ADR:** `engineering-team/decisions/event-tagging/0004-event-tagging-read-api.md`

## Quality gates (run by reviewer, not trusted)

- [x] `node test/event-tagging-read-api.test.js` → **11 passed, 0 failed, 0 skipped** (independent re-run; the HTTP smoke is PASS, not SKIP, after the brainstorm restart).
- [x] Regression: `event-tagging-core` **15/15** (classify.js added, **purity guard still green**), `event-tagging-spec` 5/5, `global-publish-gate` 8/8, `event-tagging-firmware-seed` 11/11.
- [x] `node --check` clean on both new server files.
- [x] _Lint / Typecheck / Build not configured — skipped._

## Spec adherence
- [x] Every AC mapped to a passing test. The rich, sovereignty-prone logic is proven **deterministically** in the pure classifier unit tests (the Tester's design call paid off): 3-state classification, authority-as-parameter, namespace-agnostic candidates, polarity grouping, POV predicate.
- [x] **Sovereignty AC met in code.** `resolveAuthorities` (`event-tags/index.js:78`) = `?authorities=` override, else `unique([CANONICAL, runtime TA])`; `classifyEventTaggings` gates on the passed `honoredAuthorities` set (`classify.js:78`). `CANONICAL` is a **default**, overridable — not a hardcoded gate. **Unverifiable ≠ illegitimate** is implemented (`classify.js`: absent header → `unverifiable`; resolved-but-unhonored → excluded).
- [x] Read-only; addressable (`#a`) + note (`#e`) targets; `headers-for-tag` for writers; applicable-tags reuses `/api/profile-tags/available-tags` (no new endpoint).

## ADR adherence
- [x] Matches ADR 0004: pure classifier in the core (CJS, dependency-free), thin `src/api/event-tags` handler (scan → resolve distinct descriptor headers → POV predicate → classify), `resolvePov` reused, malformed/missing target → **400** (live-confirmed). Routes wired with literal strings in `src/api/index.js`.
- [x] **No firmware/concept change** → no reinstall (correct).
- [x] Candidate scan is target-keyed/namespace-agnostic (`core.filterTagsAppliedToEvent`, no `#z` gate).

## Concept-graph integrity
- [x] N/A (read-only). Handles composed via the core; the only literal is the `CANONICAL` *default authority* (ADR-0015 lineage, documented overridable).

## Things tests can't catch
- [x] **Read-only / no leak:** the module has no publish/external-relay surface (`grep` clean); scans **local strfry** only (no `federatedScan`/remote union — consistent with the story's local-only scope).
- [x] **Shell/filter-injection:** `strfryScan` mirrors `profile-tags` exactly (`JSON.stringify` → single-quote shell-escape `'\''`). User inputs reach the filter only as JSON-encoded values; hex inputs are validated, and the free-form `slug`/`address` tail is single-quote-escaped (the only shell-hazard char inside single quotes). Same safety basis as the existing, shipped pattern.
- [x] **Correctness of the indirection:** the assertion descriptor `39999:<author>:tagging:<slug>-tagging` equals the per-tag header's coordinate `39999:<header.pubkey>:<d=tagging:<slug>-tagging>` — matched by `headerByCoord`; legitimacy checks the header's `z` against honored `39998:<A>:tagging-with-specific-tag`. Verified by the classifier tests + the live 200/shape check.
- [x] No secrets, no debug logging, no commented-out code.

## House rules check
- [x] No hardcoded TA as a gate (the `CANONICAL` default is overridable). No new lint/typecheck/build tooling.

## Findings

### Blocking
_None._

### Non-blocking
1. **Helper duplication (acknowledged by the Implementer).** `strfryScan`, `dedupeReplaceable`, `meiliFetchProfilesByPubkey` are re-implemented (~40 lines) rather than imported from `profile-tags` (which doesn't export them). Per ADR 0004 ("mirror or extract — keep DRY where cheap") this is an allowed call; if `event-tags` and `profile-tags` keep growing shared read machinery, extracting to `src/api/_shared/` would be the cleanup. Not required now.
2. **`slug` (headers-for-tag) and the `address` tail aren't format-validated** beyond the coordinate regex. Safe (escaped + JSON-encoded; garbage just yields an empty result), but a tighter `slug` check would fail faster. Optional.
3. **Live header-resolution path not exercised with real tagging data** — no taggings exist on the relay yet (Story 5 publishes them), so `for-event` was live-confirmed only for the empty/200/shape path; the populated path is covered by the classifier unit tests. A natural end-to-end live check lands when Story 5 produces real taggings. Informational.

## Verdict
**PASS** — matches ADR 0004; read-api 11/11 (0 skip), no regressions, core purity intact; the sovereignty guarantee (authority as parameter, unverifiable ≠ illegitimate) is implemented and deterministically tested. Non-blocking items are cleanup/informational.
