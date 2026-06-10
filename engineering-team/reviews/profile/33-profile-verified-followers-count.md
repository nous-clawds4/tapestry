# Review: Story 33 — Verified-followers count on the profile page

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-06
**Diff:** `git diff origin/staging...HEAD` — branch `feat/story-33-verified-followers-count`; impl commit `c8d59993` (story `70dd05b7`, adr `30c0aae8`, tests `3a38cfa4`)
**Story:** `engineering-team/stories/profile/33-profile-verified-followers-count.md`
**ADR:** `engineering-team/decisions/profile/0029-profile-verified-followers-count.md`
**Test plan:** `engineering-team/stories/profile/33-profile-verified-followers-count.test-plan.md`

## Quality gates (run by reviewer, not trusted)

- [x] **Node suite (story #33) — PASS, 6/6** (run standalone by the reviewer): T1–T5 + R1 all green; `RESULT {pass:6, fail:0}`.
  - The full `npm test` was *not* used as the signal: it also runs concept-graph suites that require the local stack at `:8877` (down by the user's choice this session). The #33 suite is pure source-regex with no stack dependency, so it was run standalone for a clean result: `node -e "require('./test/profile-verified-followers-count.test.js').run()…"`.
- [x] **`npm run test:playwright` — deferred to staging (not run).** `tests/brainstorm/profile-verified-followers-count.spec.js` is supplementary + live-data dependent; locally the harness can't start (pre-existing `tests/global-setup.js:16` reads `config.use`, undefined in the installed Playwright version) and local Meili has no House scores. Runs at `cycle-staging` against real data. *(Non-blocking — see Findings #1.)*
- [x] **Build** — Vite build compiles cleanly (~47s; only the pre-existing chunk-size warning). Deployed into the running container; `:7778`/`:80` serve 200.
- [x] Lint / Typecheck — not configured (skipped).

## Spec adherence
- [x] Every acceptance criterion has a passing test:
  - **AC1** (label "Verified Followers" in the counter area, beside Following) → **T1**
  - **AC2** (verified score, not the raw total) → **T2** (reads `trustScores.verifiedFollowerCount`)
  - **AC3** (no PoV → House) → **T2** (value from the PoV-resolved `trustScores`) + staging visual
  - **AC4** (personalized when available, else House; partial-personalized → placeholder, accepted) → **T2** + **T4** + staging visual
  - **AC5** (no data → "—") → **T4** (`fmtCount(null/undefined)`→"—"); observed live locally (counter shows "—" with no House scores)
  - **AC6** (zero → "0") → **T3** (`??` preserves 0) + **T4** (`fmtCount(0)`→"0")
  - **AC7** (plain, non-link) → **T5**
- [x] No criterion silently dropped; no behavior added beyond the story.

## ADR adherence
- [x] Matches ADR 0029 §Implementation notes exactly. Diff ([BrainstormProfile.jsx:236-250](ui/src/pages/BrainstormProfile.jsx:236)): a plain `<div className="bsp-count">` (not `<Link>`, no `bsp-count-link`) with `bsp-count-value`=`fmtCount(trustScores?.verifiedFollowerCount ?? trustScores?.followers)` and label `Verified Followers`, placed after the **unchanged** Following `<Link>`.
- [x] **Option A honored — no backend change.** `git diff --name-only origin/staging...HEAD | grep '^src/'` → none. `get-user-counts` / `get-user-data` / `cypherQueries` / algos all untouched.
- [x] No CSS change — the shared `.bsp-count` base styling ([styles.css:3393](ui/src/styles.css:3393)) suffices; `.bsp-count-link` only added link affordance, correctly absent here.
- [x] No new dependencies; no new build/lint tooling.

## Concept-graph integrity
- [x] N/A — no concepts added or changed; the change surfaces an existing precomputed metric. No firmware reinstall required. (Concept Graph API was unreachable this session; correctly treated as non-load-bearing since the feature defines no concepts.)

## Things tests can't catch
- [x] No secrets, no leftover `console.log`/`debugger`, no `TODO`/`FIXME` in the added lines (grep of `^\+` lines: none).
- [x] The two added comments are explanatory rationale (non-link + `??`), appropriate — not commented-out code.
- [x] Edge cases handled: null/undefined `trustScores` → "—" (optional chaining + `fmtCount`); a genuine 0 preserved via `??` (a `||` here would drop it — pinned by T3).
- [x] No concurrency concern (pure render of already-fetched state); no new input boundary or injection vector (renders a server-derived number).

## House rules check
- [x] Concept Graph API authority respected (no concept work).
- [x] No new lint/typecheck/build tooling.
- [x] `dist/` (gitignored, line 97) not committed; only the source file, the two test files, the runner wiring, and the harness docs.

## Findings

### Blocking
None.

### Non-blocking
1. **Live numeric + PoV visual deferred to staging.** Local Meili has no House WoT scores (verified against `/api/search/profiles/meili/document` for Jack + 3 well-known pubkeys → no `wot_*` fields), so the counter renders "—" locally. AC2/AC3/AC4's *numeric* behavior and the personalized `?pov=` path are therefore not visually exercised locally. This is a **data gap, not a code defect** — the read logic is unit-pinned and the data pipeline was traced in ADR 0029 §Context. Close it at `cycle-staging` via the Playwright spec + a manual check on a scored profile.
2. **Deferred follow-ups (correctly NOT in this diff), already in `_intake.md`:** the followers *table* page (sub-feature 2); the duplicate "Verified Followers" rows in `TRUST_METRICS` ([BrainstormProfile.jsx:36](ui/src/pages/BrainstormProfile.jsx:36) & [:43](ui/src/pages/BrainstormProfile.jsx:43)); the verified-cutoff inconsistency (graperank.conf `0.01` vs cypherQueries.js fallback `0.05` vs UI "score > 2"). Confirmed untouched.

## Verdict
**PASS** — the diff matches the story, ADR 0029 (Option A, front-end only), and the test plan; the node gate is clean (6/6, run by the reviewer); scope is tight (one source file, no backend, deferred items untouched). The only open item is live numeric/PoV verification, which is staging-bound by design and recorded as a non-blocking note.
