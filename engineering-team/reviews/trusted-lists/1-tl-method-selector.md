# Review: Story 1 — TL membership-method selector (Count only)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-08-27
**Diff:** `git diff a397054c...HEAD` (implementation commits `34e0ee03` + copy-fix `HEAD`)
**Story:** `engineering-team/stories/trusted-lists/1-tl-method-selector.md`
**ADR:** `engineering-team/decisions/trusted-lists/0001-tl-membership-method-selector.md`
**Test plan:** `engineering-team/stories/trusted-lists/1-tl-method-selector.test-plan.md`

## Quality gates (run by reviewer, not trusted)

- [x] Story suite (`test/tl-membership-method-selector.test.js`, live layer against the running
      stack at :8778): **12 passed, 0 failed, 0 skipped** — including the live pipeline test
      (L1+L2) and the local-only publish guard (L0).
- [x] Neighboring-suite regression (Implementer-run this session, output inspected):
      `tl-publication-from-pins-publish` 7/7, `customize-pin-curation-publish` 3/3 (+1
      standing skip). The touched `runOnePin` path is exactly what these exercise.
- [x] `node --check` on both changed server files; `defaults.json` parses.
- [x] UI `vite build` clean; served bundle at :8877 verified to contain the panel.
- [ ] Full `npm test` not re-run at review (multi-suite live gate, ~long); the touched
      surface's suites all pass. Playwright: n/a — no spec for this page; browser smoke was
      HTTP-level only (extension unavailable), operator hand-test is the story's next step.
- [x] _Lint / typecheck / build not configured — skipped per project rules._

## Spec adherence

- [x] AC-1 selector: panel in `TrustDetermination.jsx` (component at :31, rendered :375) —
      four ladder methods, three `disabled` with "(not yet available)"; S1 passes.
- [x] AC-2 pipeline-wide + durable: single key `trustedLists.membershipMethod` in the
      two-layer settings store; PUT body scoped to `{ trustedLists: { membershipMethod } }`
      (deep-merge preserves siblings); persistent-volume settings.json survives restarts;
      U7 proves disk-read-per-call; S2 passes.
- [x] AC-3 pipeline honors, output unchanged: `runOnePin` resolves per refresh
      (`refreshPinnedTags.js:160-167`); `count` dispatches to the untouched
      `applyDisputesFunction`. L1 asserts the full today-shape live.
- [x] AC-4 wire audit: `['membership-method', methodId]` appended to `extraTags`
      (`refreshPinnedTags.js:212`); L2 asserts it live.
- [x] AC-5 default: `defaults.json:54-56` ships `"count"`; resolver fail-safes cover missing
      file, garbage, malformed JSON, valid-but-future ids (U3–U6).
- [x] AC-6 local-only: L0 guard confirms `allowExternalPublish:false` on the live stack; guard
      FAILS (not skips) if violated.
- [x] No criterion silently dropped; no behavior beyond the story (note-TL/30393 path and
      retraction path correctly untouched — no membership fold runs there).

## ADR adherence

- [x] Files changed exactly match the ADR's implementation notes (defaults.json,
      membershipMethods.js as the module option, runOnePin thread-through, TrustDetermination
      panel; settingsApi.js untouched as predicted).
- [x] Method ids match the ADR table; dispatch structured as a map for rungs 2–4.
- [x] Lazy `require('../../config/settings')` matches the `getAdminPubkeys` idiom.
- [x] No new dependencies.

## Concept-graph integrity

- [x] No concept definitions changed; firmware reinstall correctly not required.
- [x] No new handle literals introduced (the test suite's `LEGACY_Z_TAG_PUBKEY` follows the
      ADR-0015 named exception, same as its sibling suites).

## Things tests can't catch

- [x] No secrets, no debug logging, no commented-out code in the diff.
- [x] Error paths: resolver never throws; UI reverts optimistic state on failed PUT and
      surfaces the error; 401/403 → read-only rendering.
- [x] Concurrency: settings read is per-refresh and atomic at the file level (same posture as
      every existing settings consumer); no new race surface.
- [x] Security: method value is validated against a server-side allowlist before use and
      before hitting the wire; the PUT rides the existing owner/admin gate (L3 confirms the
      unauthenticated reject).

## Non-blocking observations (no action required this story)

1. **`membershipFolds[membershipMethod]()` trusts the resolver's allowlist.** If a future rung
   adds an id to `IMPLEMENTED_METHOD_IDS` without adding the fold branch, this throws at
   refresh time. Acceptable coupling (ids and branches land together, and the rung stories'
   tests will catch it), but worth remembering at rung 2.
2. **Non-owner sessions display the default, not necessarily the active method.**
   `GET /api/settings` is owner-gated, so the read-only rendering assumes `count`. Harmless
   while `count` is the only method; at rung 2+ a non-owner viewing the page could see a stale
   claim. If that matters then, expose a public read of the single active-method value —
   rung-2 planning should decide. (Recorded here so it isn't rediscovered.)
3. **`membership-method` tag's deploy fate** is already tracked as an open question on Story 4
   (spec-or-strip before deploy) — noted as the standing wire caveat, not a defect.

## Verdict

**PASS** — every acceptance criterion has a passing test run by the reviewer against the live
stack, the diff matches the ADR precisely, and the count path is provably unchanged (the live
test pins today's shape with the single permitted delta). Non-blocking observations above are
forward pointers for rung 2, not defects.
