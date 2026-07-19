# Review: Story 3 — Scheduled Tasks panel aggregate countdown

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-07-18
**Diff:** commit `84b1736f` (impl) vs parent `1c99dae4`; concurrent commits audited for separation: `1c99dae4` (Tester re-baseline), `9fd94be6` (unrelated intake). Branch `feat/deploy-safety-gate`, HEAD `56936944` at review time.

## Quality gates (run by reviewer, not trusted)

- [x] `node test/next-task-countdown.test.js` — **24 passed, 0 failed, EXIT: 0** (all of U1–U7, D1–D7, S1–S8, R1–R2).
- [x] `npm test` (full, once) — **exit 0, `Overall: PASS`**. Summary line `next-task-countdown suite: PASS (24 passed, 0 failed)`. **Zero individual `FAIL` test lines in the entire run** (grep-verified), so none of the ledgered flakes (OPEN.md #51/#58/#59/#60) manifested and no skip-masking (#58) was possible this run. `Total skipped: 28` — all pre-existing environmental publish-suite skips (`profile-tags-publish` 1, `authored-tagging-publish` 16, `profile-tag-polish-publish` 8, `note-tagging-raw-events-inspector-http` 3), unrelated to this story.
- [x] `npx playwright test tests/brainstorm/scheduled-tasks-panel-countdown.spec.js --project=chromium` (`BRAINSTORM_SERVER_ACCESSIBLE=true`, local stack) — **7 passed (18.3s)**: AC-1, AC-2, AC-3 ×2, AC-4 ×2, AC-5.
- [x] `bash scripts/harness-lint.sh` — **clean (0 violations)**, exit 0 (pre-existing waivers only).
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._

### Live data path (beyond the stubs)

- `curl http://localhost:7778/api/deploy-safety/status` → `success: true`, `queue.enabled: true`, `queue.stateKnown: true`, `schedule.nextFire: null` — every field the component consumes is present in the live payload.
- Fed that live payload through the on-disk helper: `deriveNextTaskLine(live)` → `{"state":"none-upcoming"}` — correct for a live schedule with `enabledEntryCount: 0`, and exactly the AC-4 state the panel would render.
- `ui/src/utils/nextTaskCountdown.js` dynamic-imports under bare node, stack-free; exports are exactly the two ADR-named functions (`formatTimeToFire`, `deriveNextTaskLine`). Spot outputs: `65 min → "1 hour and 5 minutes"`, `90 min → "1 hour and 30 minutes"`, `0 → null`, `derive(null) → unknown`.
- The **served** bundle inside the container (`/usr/local/lib/node_modules/brainstorm/dist/assets/index-_ADNcIKp.js`) contains both `next-task-line` and `Next Scheduled Task` — the implementation the Playwright run exercised is live, not just on disk.

## Spec adherence

- [x] Every acceptance criterion has a passing test.
- [x] No criterion is silently dropped.
- [x] No behavior added that isn't in the story (the one behavior beyond the line — the parent-staleness fix — is explicitly ADR-authorized; see ADR adherence).

AC-by-AC, cited from disk:

- **AC-1 (one aggregate line, operator's phrasing, hours-and-minutes, rows intact).** Exactly one `<NextScheduledTaskLine …>` usage, `RelaySettings.jsx:2019`, between the hint paragraph (`:2014-2017`) and the Add-button block (`:2021-2026`) per ADR sub-decision 6. Copy at `:1847`: `Next Scheduled Task, <strong>{name}</strong>, starts in {formatted}.` — the operator's requested form. Granularity via `formatTimeToFire` (`nextTaskCountdown.js:29-43`): ceiling on total minutes, days/hours/minutes decomposition, singular/plural, no seconds at any magnitude (U7). Rows untouched: `entries.map → <ScheduledEntryCard …>` (`:2033-2043`) changed only by the additive `onScheduleChanged` prop. Tests: U1–U4, U7, S1, S2, S6, R1; Playwright AC-1 (including display-title enrichment over the endpoint's bare label).
- **AC-2 (soonest among enabled only; comes to reflect changes).** Never re-derived client-side: `deriveNextTaskLine` reads **only** `statusJson.schedule.nextFire` (`nextTaskCountdown.js:71`) — the server's own min-`at`-over-enabled selection inside `computeVerdict()` — and D2 pins that decoy payload fields can't override it (the rejected-Option-B trap). Toggle path: card save success → `onScheduleChanged()` (`:1587`) → parent `fetchList` → `setScheduleVersion(v+1)` (`:1887`) → line re-fetch on version change (`:1817`). Playwright AC-2 proves the disabled-but-sooner entry is never named and the toggle is reflected without reload.
- **AC-3 (visibly counts down; never frozen/negative; moves on).** 1 s tick (`:1822`) recomputing from the cached absolute `line.at` (`:1827`); 10 s poll (`:1821`); both cleared on unmount (`:1823`). `formatTimeToFire` returns `null` at `remainingMs ≤ 0` (`nextTaskCountdown.js:30-32`, U6) so a negative rendering is unreachable; zero-cross triggers one immediate re-fetch per distinct `at` (`:1833-1838`), poll as rate bound. Playwright: minute-boundary tick without reload; post-fire move-on to `none-upcoming` with never-blank/never-stale/never-negative asserts.
- **AC-4 (three-way, never conflated).** Helper precedence (`nextTaskCountdown.js:60-77`): malformed/`success !== true` → `unknown`; `queue.enabled === false` → `queue-disabled` (checked **before** `nextFire`, so a stray fire never yields a countdown — D4); `queue.stateKnown !== true` → `unknown` (never "nothing scheduled" when the truth is unknown — D5); no `nextFire` → `none-upcoming`. Distinct plain-language copy at `:1852-1856`; D7 pins pairwise distinctness; Playwright AC-4 ×2 pins `data-state` plus cross-negatives against the other state's copy.
- **AC-5 (structural sourcing — never contradicts the deploy-safety answer).** The component's sole fetch is `'/api/deploy-safety/status'` (`:1807`; S3 pins it); identity is endpoint-owned `entryId`, surfaced as `data-entry-id` (`:1845`); D1 carries the fields verbatim; R2 confirms the server still exports the consumed contract and `computeVerdict`. Playwright AC-5 compares DOM to the same payload within ADR sub-decision 5's tolerance (60 s + Δt + slack).

## ADR adherence

- [x] Files changed match the ADR's implementation notes — exactly the two named files (`ui/src/utils/nextTaskCountdown.js` new; `ui/src/pages/settings/RelaySettings.jsx` edited), plus story/journal markdown. No backend files touched.
- [x] Layering / module boundaries respected — helper is plain ESM, no React import, no JSX (S8; verified importable by bare node); tick isolated in `NextScheduledTaskLine` so it re-renders one line, not the cards.
- [x] No new dependencies (`git show 84b1736f -- package.json package-lock.json` is empty).

Sub-decisions, one by one:

1. **Data source & naming** — `resolveTitle(entryId, fallback)` (`:1949-1952`) delegates to the panel's `computeDisplayTitle`, endpoint `label` as fallback; identity stays `entryId`, on the DOM as `data-entry-id`. ✓
2. **Cadences** — 1 s tick / 10 s poll / `scheduleVersion` bump on every successful `/list` refetch (mount, modal save, delete, and now card toggle) / `onScheduleChanged` optional no-op prop (`:1520`) invoked in `handleSave`'s success branch after `setTimer` (`:1583-1587`, exactly the ADR's named insertion point) / zero-cross re-fetch guarded once per `at` via ref (`:1803`, `:1834-1837`). ✓
3. **Ceiling formatting** — `Math.ceil(remainingMs / 60000)` (`nextTaskCountdown.js:33`); verified 60 001 ms → "2 minutes", 1 ms → "1 minute", "0 minutes"/"0 hours and 0 minutes" unreachable (U5). ✓ (One documented deviation — see below.)
4. **Display states & reference copy** — four states pinned; on-disk copy matches the ADR's reference strings verbatim (`:1847-1848`, `:1852-1856`); `starting` rendered when `formatted` is null (`:1844`). ✓
5. **AC-5 tolerance** — lives in the spec's assertion (spec `:297-304`), matching the ADR arithmetic; no phantom tolerance export invented. ✓
6. **Placement & styling** — `:2019`, visually distinct (`0.9rem`, `#e0e0e0` vs the muted hint; empty states dimmed `#aaa`). ✓
7. **The deliberate side effect** — `onScheduleChanged={fetchList}` (`:2041`) fixes the pre-existing parent-staleness gap on card toggles. This is behavior beyond the line itself, but it is explicitly authorized and documented in ADR 0003 §Consequences ("Side effect, intentional"); the card's own UI is otherwise unchanged (ADR 0021 undisturbed). ✓

**Story §Deviations audit (one entry):** `formatTimeToFire` drops any zero-valued unit in compound renderings. Verified on disk/live: exactly 1 h → `"1 hour"`, exactly 1 d → `"1 day"`, 1 d + 1 min → `"1 day and 1 minute"`; all ADR-listed examples unchanged (`2 days, 3 hours and 12 minutes`, `1 hour and 5 minutes`, `23 minutes` — reproduced exactly). The deviation stays inside the story's scope note delegating edge-case copy, upholds the ADR's "never shows '0 minutes' while time remains" literal at band boundaries, and is honestly logged. Accepted.

## Concept-graph integrity

- [x] No concept handles touched (story §Concepts touched: None, verified against the live graph at planning; nothing in the diff mentions a handle).
- [x] Firmware reinstall: not required — no concept definitions changed.
- [x] No new code re-derives domain concepts from BIBLE.md.

## Things tests can't catch

- [x] No secrets in committed files (grep of the full impl diff: no keys, no nsec/npub, no passwords).
- [x] No leftover debug logging, `console.log`, `debugger`, commented-out code, or TODO/FIXME in the diff.
- [x] No TA-pubkey literals (no `82b75e47…`, no authors filters, no signing — this surface has no TA dimension, per ADR).
- [x] Error paths: fetch failure keeps the last payload (tick stays honest off the absolute `at`); with no payload ever, `deriveNextTaskLine(null)` → `unknown` → "Schedule status is currently unavailable." — the ADR-specified behavior. Malformed input to `formatTimeToFire` (NaN/non-number) returns `null` defensively.
- [x] Concurrency: zero-cross re-fetch is loop-guarded per `at` with the 10 s poll as rate bound; intervals cleared on unmount; `fetchStatus` is a stable `useCallback([])`.
- [x] Security: read-only GET to a same-origin endpoint; no user input reaches any sink.

## House rules check

- [x] Concept Graph API authority respected (nothing concept-adjacent in the diff).
- [x] No new lint/typecheck/build tooling.

## Separation audit (concurrent commits)

- **`1c99dae4` (Tester re-baseline)** — touches **only** `tests/brainstorm/scheduled-tasks-panel-countdown.spec.js` (stat-verified, 1 file). The defect was real: each `ScheduledEntryCard` renders **two** h3s — the title (`RelaySettings.jsx:1630`) and `Recent Runs ({title})` (`:1736`) — so the original `page.locator('h3', { hasText: 'Alpha Export' })` resolves ambiguously (Playwright strict mode) against **any** correct implementation. The fix, `getByRole('heading', { name: …, exact: true })` (spec `:136-137`), matches only the title heading ("Recent Runs (Alpha Export)" fails the exact-name match) — the assertion's meaning ("the per-entry rows remain present") is preserved, and slightly strengthened. Correctly attributed to the Tester, not smuggled into the impl commit; the Implementer's diff contains no `test/`/`tests/` changes (also stat-verified).
- **`9fd94be6` (concurrent intake)** — touches **only** `engineering-team/stories/_intake.md` (stat-verified, 1 file, additions only). Unrelated content (CLI-advertisement defect, catalog-rot defect, relationship-primitives feature request); benign to this story.
- **`84b1736f` (impl)** — exactly 4 files: the two UI files + the story's §Deviations addition + the Director's journal entry. No scope creep; per-entry rows untouched per story §Out of scope.

## Product-guide adherence

N/A — no-PRD book (acceptance frame); no style/design guide traces to this story.

## Findings

### Blocking

None.

### Non-blocking

1. **`ui/src/pages/settings/RelaySettings.jsx:1844-1848`** — if the endpoint is unreachable *after* a countdown payload was cached and the fire time passes, the line reads "starting now…" until a poll succeeds (the zero-cross re-fetch fails silently, the 10 s poll retries). This is the ADR's own "keep the last payload" design and the honest option, but on a long outage the transitional copy can linger. Optional improvement (future): degrade to `unknown` after N consecutive failed polls.
2. **`ui/src/pages/settings/RelaySettings.jsx:1805-1814`** — two in-flight `fetchStatus` calls (poll racing a version bump) could resolve out of order and briefly install the older of two near-identical payloads; self-corrects within one poll. Inherent in the ADR's design; not worth a request-sequence guard at this cadence.
3. **`ui/src/utils/nextTaskCountdown.js:30`** — an unparseable `nextFire.at` would yield `remainingMs = NaN` → `formatted = null` → "starting now…" (and `NaN <= 0` is false, so no re-fetch loop — safe). The real endpoint always emits ISO timestamps; noting for completeness only.

### Harness friction

None — every doc-cited path, port, precedent, and line anchor checked out this session (`:7778`, container dist at `/usr/local/lib/node_modules/brainstorm/dist`, `povNoticeText`/`admin-tools` precedents, ADR line references).

## Verdict

**PASS**

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place; AC boxes checked; Review link filled.
- [x] Completion detection run (acceptance frame, `engineering-team/audits/deploy-safety-gate/book.md`): bullets 1–4 were already satisfied by stories #1–#2 (Done; their suites re-verified green this run); **bullet 5 is satisfied by this story as of this PASS** (aggregate line live-updating alongside intact rows, all five ACs evidenced above). **Bullet 6 remains open in part:** (a) staging endpoint JSON and (c) a journaled gated merge are already journaled from stories #1–#2's staging promotions; (b) — this story's local-stack rendered-panel evidence plus the staging data the line consumes — lands at Stage 2, after this review. The book is **not yet offered for close**; the offer belongs after story #3's staging evidence completes bullet 6.
