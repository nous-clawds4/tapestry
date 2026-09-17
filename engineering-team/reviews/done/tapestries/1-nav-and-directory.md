# Review: Story 1 — Tapestries navigation + View Tapestries directory + Create stub

**Reviewer:** Claude (acting as Reviewer) + independent reviewer subagent (per OPEN.md #80(b), main session implemented)
**Date:** 2026-07-23
**Diff:** `git diff origin/staging...HEAD` (impl commit `eade7830`)

## Quality gates (run by reviewer, not trusted)

- [x] `npm run test:playwright` — **6/6 PASS** (17.8s), reviewer-run: `npx playwright test tests/brainstorm/tapestries-nav-and-directory.spec.js --project=chromium`. Covers AC-1..5 + the malformed-element edge.
- [~] `npm test` (node `test/test.js`) — **not run as a gate.** The diff is UI-only (React pages + nav/route config under `ui/src/`; no node/server surface), so it exercises none of it; the node suite is also known to fail environmentally on the local stack (OPEN.md #27/#69). No regression surface from this diff into `test/test.js`.
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured (vite build succeeds; `dist/` gitignored, rebuilt in CI) — skipped as a gate._

## Spec adherence
- [x] Every acceptance criterion has a passing test. AC-1 `spec.js:107`, AC-2 `:138`, AC-3 `:163`, AC-4 `:179`, AC-5 `:191`, edge `:216`.
- [x] No criterion silently dropped.
- [x] No behavior added beyond the story (see Scope).

## ADR adherence (tapestries/0001)
- [x] **Strfry data source, not Neo4j** — `Index.jsx:51-54` reads `queryRelay({ kinds:[39999], '#z':[`39998:${taPubkey}:tapestry`] })`. Zero Neo4j references in `ui/src/pages/tapestries/`.
- [x] **No hardcoded TA pubkey** — handle built from `useConfig().taPubkey` (`Index.jsx:38,44,53`), guarded until present (`:44`). No 64-hex literal in the new source (grep clean).
- [x] **uuid = a-tag coordinate** `39999:pubkey:dTag` (`Index.jsx:29`), URL-encoded on nav (`:103`); `TapestryDetail.parseUuid` splits on the first two colons so d-tags survive (`TapestryDetail.jsx:13-22`).
- [x] Files match the ADR's Implementation notes (3 new pages + Layout nav group + App route block). Nav group placed immediately after Nostr Users (`Layout.jsx:51-58`), public (no `ownerOnly`).
- [x] **No new dependencies** (no `package.json` change), no new backend.

## Concept-graph integrity
- [x] Concept handle in `kind:pubkey:slug` form, constructed at runtime.
- [x] No concept definitions changed → **no firmware reinstall required.**
- [x] New code does not re-derive from BIBLE.md; reads events from strfry via the existing `queryRelay` client.

## Things tests can't catch
- [x] No secrets / `console.log` / `debugger` / `TODO` / dead code in the new files (grep clean).
- [x] Async effects guard every post-await `setState` with a `cancelled` flag (`Index.jsx:45-65`, `TapestryDetail.jsx:31-55`) — no state-after-unmount.
- [x] Error paths handled: `toRow` skips d-tag-less events and try/catches `JSON.parse` (malformed → d-tag fallback); the directory renders loading/error/empty states.
- [x] Scope confined to `ui/src/`, `tests/`, `engineering-team/`, `OPEN.md` (verified via `git diff --name-only`).

## House rules check
- [x] Concept Graph API authority respected (no ad-hoc graph writes; reads via runtime handle).
- [x] No new lint/typecheck/build tooling.

## Product-guide adherence
- N/A — this story does not trace to a PRD.

## Findings

### Blocking
None.

### Non-blocking
1. **`ui/src/pages/tapestries/NewTapestry.jsx:18`** — the `tapestry-new-preview` / `form-field` classes have no stylesheet definitions, so the inert preview form is unstyled. Cosmetic only; no functional/test impact. Optional: add a small CSS rule or drop the classes when the real authoring form lands.
2. **`ui/src/pages/tapestries/Index.jsx:99`** — `"{rows.length} tapestries"` renders "1 tapestries" for the singleton seed. Mirrors the existing `users/Index.jsx:152` convention; pluralization is a nicety, not a house rule.
3. **`tests/brainstorm/tapestries-nav-and-directory.spec.js:198`** — AC-5's `getByText(/create new tapestry/i).first()` also matches the nav sublink; `.first()` resolves to it, so the assertion still validates the intended cue (the heading is also present). Slightly imprecise, not brittle.
4. **`ui/src/pages/tapestries/TapestryDetail.jsx:65`** — renders the raw uuid in a `<code>` block beyond the ADR's "title + note." Harmless and useful for a placeholder that Story 2 replaces.

Swept to `OPEN.md` (findings 1 & 3, the two actionable-on-next-touch items) per OPEN.md #80(a).

### Harness friction
1. **Book anchor skipped at intake (3rd occurrence of OPEN.md #78).** `engineering-team/audits/tapestries/book.md` was not opened when the `tapestries` epic started at `/plan-feature`. Unlike the prior two occurrences (reconstructed at close), I opened it **eagerly at this review** — `engineering-team/audits/tapestries/book.md`, Status `Open`, with the acceptance frame — so completion detection has a real anchor when Story 2 lands. Recorded against OPEN.md #78.

## Verdict
**PASS** — the diff matches the story, conforms to ADR 0001, all acceptance criteria are covered by passing tests, and the quality gates are clean. Non-blocking findings only.

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place (`stories/tapestries/1-tapestries-nav-and-directory.md`).
- [x] Completion detection run: the `tapestries` book has **2 stories**; Story 2 (exploration page) is still `Draft`, so the book is **not** complete — `/close-book` **not** offered. (Book anchor opened this review.)
