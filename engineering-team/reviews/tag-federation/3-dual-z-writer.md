# Review: Story 3 — Dual-z writer (canonical + local z on new tags/taggings, W11)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-17
**Epic:** tag-federation (Half 2 — Part B)
**Branch:** `feat/dual-z-writer` (stacked on `feat/b-tag-primitive`)
**Diff:** `git diff 548b37bc~1 548b37bc` (implementation commit `548b37bc`)
**Story:** `engineering-team/stories/tag-federation/3-dual-z-writer.md`
**ADR:** `engineering-team/decisions/tag-federation/0003-dual-z-writer.md`
**Test plan:** `engineering-team/stories/tag-federation/3-dual-z-writer.test-plan.md`

## Quality gates (run by reviewer, not trusted)

- [x] **Gate 1 — `node test/dual-z-writer.test.js`** → **14 passed, 0 failed.** All 7 prior FAILs flipped green; the 7 baseline PASSes stayed green.
- [x] **Gate 2a — `node test/nostr-user-tag-hybrid-ea-writer.test.js`** (ADR-0022 e+a regression) → **10 passed, 0 failed.** Proves the hybrid e+a wire shape is intact and the second z is additive.
- [x] **Gate 2b — `node test/profile-tag-polish.test.js`** → **11 passed, 0 failed.**
- [x] **Gate 3 — `npm --prefix ui run build`** → **`✓ built in 15.14s`.** Compiles clean. Only output before that is the standard chunk-size advisory (>500 kB), which is a warning, not an error. JSX syntax gate satisfied (`Tag.jsx` is the only changed `.jsx`).
- [x] **Gate 4 (optional) — `node test/test.js`** → Up through the pin stories all suites green; the **only** red is the documented pre-existing flake `tl-publication-from-pins` → `POST /api/trusted-list/refresh-pinned-tag rejects an unauthenticated call` → "fetch failed" (server-state flake, unrelated to this diff). `dual-z-writer` is registered in the runner (`test/test.js:103,276,472`). No regression attributable to this change. (Concurrent local runs contend on the server port; the standalone suites in Gates 1–3 are the authoritative signal.)
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._

## Spec adherence (7 ACs)

- [x] **AC-1 (tag element dual-z):** `useProfileTags.js:124-126` — `createTag` keeps `['z', TAG_HANDLE]` (canonical, unchanged const) and appends `...(hasLocalTa ? [['z', \`39998:${taPubkey}:tag\`]] : [])` (local, runtime-interpolated). Two z entries by construction.
- [x] **AC-2 (tagging dual-z):** `publishProfileTag.js:80-81` — keeps `['z', NOSTR_USER_TAG_HANDLE]` (canonical) and appends `...(hasLocalTa ? [['z', \`39998:${localTaPubkey}:nostr-user-tag\`]] : [])` (local, runtime).
- [x] **AC-3 (composes with hybrid e+a — most important regression):** `publishProfileTag.js:61` `tagAddress = \`39999:${tag.authorPubkey}:${tag.slug}\`` unchanged; `['a', tagAddress]` (`:78`) and `['e', tag.eventId]` (`:79`) intact; `content` JSON mirror (`:84-86`) untouched. The local z is appended *after* canonical and *before* `['polarity', …]`, exactly the ADR's "After" block. Gate 2a (10/0) independently confirms the e+a shape is not regressed. The second z is purely additive.
- [~] **AC-4 (local list populates):** Deferred to deployed-env verification per the ADR/test-plan (live-only, not host-unit-testable). Correctly deferred — see "Things tests can't catch" below. Not a blocker.
- [x] **AC-5 (no migration / no regression to old events):** No backfill or rewrite of existing events anywhere in the diff. The change is write-time-only on newly-signed events. Confirmed by inspection of all four changed files. (Distinct-value live behavior deferred per below — not a blocker.)
- [x] **AC-6 (runtime local TA pubkey — anti-hardcode):** Both local z's are template-literal interpolations of the runtime arg (`${taPubkey}` / `${localTaPubkey}`), never a literal. Grep confirms each writer file carries **exactly one** `82b75e47…` occurrence — the pre-existing `const TA_PUBKEY` (`useProfileTags.js:7`, `publishProfileTag.js:15`) — and `Tag.jsx` carries **zero**. No new 64-hex literal introduced. The canonical z is the sanctioned ADR-0015 literal exception; the local z is runtime. CLAUDE.md "never hardcode the TA pubkey" honored.
- [~] **AC-7 (David verification breadcrumb):** PR-description deliverable, not a code artifact. Outstanding for the eventual PR (the "two z per event, one pointer-`b` per header" note + reversal breadcrumb). Noted as remaining; not a code blocker.

## ADR adherence (Option A + W11 rule)

- [x] **Option A (inline local z at each writer; `taPubkey` threaded as explicit arg):** Implemented exactly. The pure writer `publishProfileTagAssertion` takes `localTaPubkey` as a destructured arg (`:45`) and calls no hook; `createTag` reads `taPubkey` from the hook-level `useConfig()`. No shared `dualZ` helper was introduced (Option B correctly deferred). No module-level `/api/assistant/pubkey` fetch in the util (Option C correctly avoided).
- [x] **W11 stamping rule:** exactly two z's per event, canonical-then-local, additive. Ordering is by convention only (not load-bearing); the implementation introduces no order dependence.
- [x] **Non-throwing guard (ADR design decision, user-confirmed):** Both guards are warn+omit via conditional spread. `publishProfileTag.js:67-70` and `useProfileTags.js:115-118` compute `hasLocalTa = /^[0-9a-f]{64}$/.test(… || '')` and, when false, `console.warn` only — the local z is omitted via `...(hasLocalTa ? […] : [])`. **No new throw tied to `localTaPubkey`.** The only throws in `publishProfileTag.js` remain the pre-existing ones: `:29` (publishOrThrow relay-failure), `:47` (`!window.nostr`), `:55` (`authorPubkey`). A missing local z has no network cost — canonical still ships — matching the ADR's rationale for not throwing.
- [x] **Threading (OQ-3 wiring):** Threaded from **both** call sites. `useProfileTags.js:75` `buildAndPublishAssertion` passes `localTaPubkey: taPubkey` (dep array updated to include `taPubkey`, `:76`); `createTag` dep array also updated (`:140`). `Tag.jsx:98` `handleApply` and `:104` `handleDispute` both pass `localTaPubkey: taPubkey`. No un-threaded call path remains that would silently drop the local z.
- [x] **React-hooks usage sound:** `useConfig()` is called unconditionally at hook top-level (`useProfileTags.js:23`) and component top-level (`Tag.jsx:44`) — Rules of Hooks satisfied, no conditional/nested call.
- [x] **No firmware reinstall required by this ADR** (no concept/schema/manifest change — purely a wire-tag addition on user-signed events). Correctly not performed; the pointer-`b` reinstall belongs to Story 2.

## Test-change judgment (Implementer modified a test — scrutinized)

The SOFT non-throw test in `test/dual-z-writer.test.js` was changed from a 220-char-preceding-window heuristic to a precise guard regex `/if\s*\([^)]*\blocalTaPubkey\b[^)]*\)\s*\{[^}]*\bthrow\b/`.

- **(a) Was the original a genuine false-positive?** **Yes.** Adding `localTaPubkey` to the function signature at `publishProfileTag.js:45` places that token ~70 chars before the pre-existing `!window.nostr` throw at `:47` (and within ~220 chars of the `authorPubkey` throw at `:55`). The old window-based heuristic would have matched the *signature's* `localTaPubkey` against an unrelated pre-existing throw and failed — a true false-positive caused precisely by the in-spec signature change, not by any forbidden guard.
- **(b) Does the refined version still catch a genuine new throw-guard while not false-positiving on the signature?** **Yes.** The function signature is not an `if (…) { … throw }` construct, so it no longer matches. A genuine new hard-throw guard (`if (!localTaPubkey) { throw … }`) still matches and fails. I confirmed the live source has no such guard (the warn+omit branch is `if (!hasLocalTa) { console.warn(...) }` with no throw), and the test PASSes — for the right reason.
- **(c) Legitimate precision fix or weakened coverage?** **Legitimate precision fix.** It is documented inline in the test comment ("Refined from a crude 220-char-window heuristic… tightened by the Implementer; see review note") and in the implementation commit. It does not weaken real coverage: the test plan already classifies this as a SOFT tripwire (not a positive proof — the positive "warns and still ships canonical" is a live/code-review item). The refinement makes the tripwire *more* targeted (catches the real forbidden pattern, stops flagging the benign signature), not looser. Verdict: acceptable.

## Concept-graph integrity
- [x] Handles remain `kind:pubkey:slug` form (`39998:<pubkey>:<slug>`, `39999:<pubkey>:<slug>`).
- [x] No concept definition / schema change → no firmware reinstall required (ADR §"Firmware reinstall required? No"). Correct.
- [x] No BIBLE re-derivation; the change is a wire-tag append consistent with established patterns.

## Things tests can't catch
- [x] No secrets introduced. The only 64-hex literals are the pre-existing sanctioned ADR-0015 canonical const (one per writer file).
- [x] **Dev-box degenerate-z reality:** On this box the runtime TA == canonical (`/api/assistant/pubkey` → `82b75e47…`), so the two z's resolve to identical strings. The source-contract tests correctly assert "two z entries emitted, second runtime-sourced" (the assertion of record per ADR §"Dev-box degenerate-z caveat" + test plan) rather than "values differ." The distinct-value case (AC-4 local-list population, AC-5 no-migration live behavior, and the non-dev distinct-z confirmation) is appropriately deferred to deployed-env verification — the user explicitly chose to leave live testing for whoever merges to a deployed env. **Not a blocker.**
- [x] `console.warn` lines are intentional dev-time guards per the ADR (warn+omit contract), not leftover debug logging.
- [x] No commented-out code; comments are the intentional ADR-anchored wire-shape annotations.
- [x] Error/edge paths: missing/malformed local TA → warn + omit (canonical still ships); the canonical publish is never blocked. Race conditions: N/A (synchronous tag-array construction).

## House rules check
- [x] Concept Graph API authority respected (no concept redefinition).
- [x] No new lint/typecheck/build tooling.
- [x] Per-deployment TA pubkey rule honored: canonical = sanctioned ADR-0015 literal exception; local z = runtime `useConfig().taPubkey`. No `LEGACY_*` const removed.

## Findings

### Blocking
None.

### Non-blocking
1. **AC-7 (PR deliverable)** — the David breadcrumb ("each new Tag/Tagging now carries TWO z tags — canonical unchanged + local runtime, NEW for the local list; existing single-z events not migrated" + the reversal breadcrumb: removing the second `['z', …]` line reverts to single-z with no migration) must be carried in the eventual PR description. Tracked, not a code blocker.
2. **AC-4 / AC-5 live behavior** — local-list population, no-migration confirmation, and the non-dev distinct-z verification remain for deployed-env testing by whoever merges to a non-dev instance. Deferred by explicit user decision; correctly out of the host suite. Tracked, not a blocker.

## Verdict
**PASS**

The diff implements the ADR's Option A exactly: a purely additive local z stamped at both writers, composed from the runtime instance TA (never hardcoded), threaded from both call sites via top-level `useConfig()`, guarded by warn+omit (no new throw), with the ADR-0022 hybrid e+a shape provably intact (Gate 2a 10/0). All four gates pass (dual-z 14/0, hybrid e+a 10/0, polish 11/0, UI build ✓; the only full-suite red is the documented pre-existing `tl-publication-from-pins` server flake). The Implementer's test change is a legitimate, documented precision fix that removes a real signature-induced false-positive while still catching a genuine forbidden guard. Story 3 should be marked **Done**. Remaining: the AC-7 David breadcrumb for the PR, and AC-4/AC-5 deployed-env verification (both explicitly deferred, neither a code blocker).
