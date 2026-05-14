# Review: Story 4 — Scheduled task to refresh Meilisearch profiles and House PoV WoT scores

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-13
**Diff:** `git diff origin/main...HEAD` — 5 commits on `feat/scheduled-search-and-house-scores-refresh` (`40a402d9`, `4b4977c4`, `ca1c4c7e`, `fac5596f`, `fed75a62`)
**Story:** `engineering-team/stories/4-scheduled-search-and-house-scores-refresh.md`
**ADR:** `engineering-team/decisions/0003-scheduled-search-and-house-scores-refresh.md` (Option A — generalize scheduler + parameterize loader)
**Test plan:** `engineering-team/stories/4-scheduled-search-and-house-scores-refresh.test-plan.md`

## Quality gates (run by reviewer, not trusted)

- **`npm test`** — **PASS**. Output:
  ```
  Configuration Loading:                           PASS
  treasure-maps-router-preset suite:               PASS (5 passed, 0 failed)
  scheduled-search-and-house-scores-refresh suite: PASS (12 passed, 0 failed)
  Overall:                                         PASS
  ```
- **`npm run test:playwright`** — *Not run.* The Playwright browser binary is not installed locally (`npx playwright install` needed; ~200MB chromium download). The Playwright spec at `tests/brainstorm/scheduled-search-and-house-scores-refresh.spec.js` will be exercised against staging post-deploy or after a one-line install on this machine. **Note:** the spec includes a banner-visibility test that would have caught the blocking issue below — installing the browser is recommended before promoting to staging.
- _Lint not configured — skipped._
- _Typecheck not configured — skipped._
- _Build not configured — skipped (UI build verified manually during cycle-local: `dist/assets/index-DIMgpJ3j.js` contains the new strings)._

## Spec adherence

| AC | Coverage | Status |
|---|---|---|
| AC-1 — new card with the prescribed title | `RelaySettings.jsx renders a card titled "Refresh Meilisearch profiles & House PoV scores"` + Playwright (deferred) | ✓ |
| AC-2 — toggle defaults disabled | `scheduler DEFAULTS includes refreshSearchIndex with enabled:false and intervalHours:24` + Playwright (deferred) | ✓ |
| AC-3 — days/hours inputs + 1h minimum | `handleUpdate still enforces the ≥1h minimum interval for any taskId` (regression sentinel still passes) | ✓ |
| AC-4 — next-run / last-run displayed | covered by AC-2 toggle visibility + verified live via API smoke (POST update → status returns nextRunAt) | ✓ |
| AC-5 — disable stops firing | covered live via API smoke (POST disable → timer cleared) | ✓ |
| AC-6 — persistence across container restart | `initScheduler iterates per-task IDs` + the cross-process boundary uses the preexisting `tapestry-data` volume mechanism | ✓ |
| AC-7 — full pipeline with PoV configured | orchestrator existence + four-phase grep + loader parameterization tests | ✓ |
| AC-8 — unset PoV → warn + exit 0 | `refreshSearchIndex.sh handles unset House PoV with a WARN event and does not fail the run` | ✓ |
| AC-9 — pre-run banner linking to Search Preferences | banner text + povPubkey dependency + Search Preferences reference asserted in tests; **see Blocking #1 — link target is wrong** | ❌ |
| AC-10 — per-task history display | covered by ADR-constraint test (`handlers read taskId from req`) + live API smoke confirming history filters by taskId | ✓ |
| AC-11 — existing Owner panel unregressed | `loadScoresIntoMeilisearch.sh still invokes the .js with no CLI args` regression sentinel + live API smoke confirmed enabling refreshSearchIndex does not touch updateAllScoresForOwner state | ✓ |
| AC-12 — docs note | `BIBLE.md or docs/CONFIGURATION.md mentions the new task title and dependencies` | ✓ |

11 of 12 ACs fully satisfied. **AC-9 has the right banner copy and dependency-fetching wiring but the link target is a non-existent route**, breaking the operator's path from the banner to the configuration page.

## ADR adherence

- Files changed match ADR Implementation notes:
  - `src/api/scheduled-tasks/index.js` — taskId-keyed `Map<taskId, timerState>`, handlers require taskId, `initScheduler` iterates `Object.keys(DEFAULTS)`. ✓
  - `src/algos/refreshSearchIndex.sh` — new orchestrator, four phases (preferences read → profile resync → conditional 10040+30382 sync → conditional loader). Uses `structuredLogging.sh` helpers with the correct 4-arg signature. ✓
  - `src/algos/nip85/loadScoresIntoMeilisearch.js` — `parseArgs` exported, `require.main === module` guard, optional `--povPubkey`/`--delegatedPubkey` with owner-default fallback. ✓
  - `src/manage/taskQueue/taskRegistry.json` — `refreshSearchIndex` entry pointing at the new script. ✓
  - `ui/src/pages/settings/RelaySettings.jsx` — `<ScheduledTaskCard>` sub-component extracted; two cards rendered; `<HousePovUnconfiguredBanner>` reads `/api/grapevine/preferences` and renders only when `povPubkey` is unset. ✓
  - `docs/CONFIGURATION.md` — new "Scheduled Tasks" section with both task descriptions and the two dependencies (House PoV, treasureMaps preset). ✓
- No new dependencies. No neighboring refactor. Scope inside ADR.
- The ADR explicitly noted: *"The banner should link to the Search Preferences route (Implementer: verify the exact route in the existing Search Preferences page before hardcoding)."* This verification step was missed — see Blocking #1.

## Concept-graph integrity

Not applicable — no concept definitions touched, no firmware files modified. ADR explicitly stated "No firmware reinstall required." Verified `firmware/` directory unchanged in diff.

## Things tests can't catch

- **Secrets / credentials:** None added. ✓
- **Debug logging:** All `console.log` additions in `src/api/scheduled-tasks/index.js` are operational logs prefixed with `[scheduled-tasks]`, matching the module's existing logging pattern. Same for the orchestrator's `echo "$(date): ..."` lines (matching `loadScoresIntoMeilisearch.sh` style). ✓
- **Commented-out code:** None. ✓
- **Leftover TODOs / FIXMEs:** None. ✓
- **`emit_task_event` signature compliance:** The orchestrator calls follow `emit_task_event "<event_type>" "<task_name>" "<target>" "<metadata_json>"` per `src/utils/structuredLogging.sh:149-153`. All 10 call sites verified. ✓
- **Bash injection safety:** `$pov` and `$deleg` are interpolated into JSON filter strings passed to `strfry sync`. Source is the operator-controlled `/api/grapevine/preferences` settings, which are hex pubkey strings (no quotes or shell metacharacters). The Settings API has its own input validation. ✓
- **Concurrency on `taskRunning` flag:** Node is single-threaded; the flag is set/reset within a single async chain per task. Two tasks have independent state via `getTimerState(taskId)`. ✓
- **`req.body` undefined check:** The new code uses `req.body.taskId` directly. This is consistent with the existing handler pattern and relies on the app-wide `express.json()` middleware. No regression. ✓
- **JSON validity in `taskRegistry.json`:** Verified by the test's `JSON.parse(...)` which would have failed if the new entry broke the file. ✓
- **Owner-side regression:** Live API smoke confirmed `updateAllScoresForOwner` status/handlers continue to work and that toggling `refreshSearchIndex` doesn't bleed state. Existing `loadScoresIntoMeilisearch.sh` invocation unchanged (regression sentinel test passes). ✓

## House rules check

- No new lint / typecheck / build tooling added. ✓
- Concept Graph API authority — not touched. ✓
- Firmware reinstall — not applicable. ✓
- No skipped hooks / no destructive git operations. ✓
- Committer identity warning persists across all 5 commits (user opted to keep as-is earlier in the session); not a blocking issue. ✓

## Findings

### Blocking

1. **`ui/src/pages/settings/RelaySettings.jsx:1380`** — The `HousePovUnconfiguredBanner`'s `<a href="/home/my-grapevine/search-preferences">` points to a route that does not exist.
   - **Actual route** per `ui/src/App.jsx:230` (`{ path: 'search-preferences', element: <SearchPreferences /> }` nested under `path: 'grapevine'`) and `ui/src/components/Layout.jsx:37`: `/tapestry/grapevine/search-preferences`.
   - **Effect on AC-9**: the banner copy is correct ("House PoV is not configured — the score-refresh half will be skipped until you set it in Search Preferences") but clicking the link would 404 the operator, breaking the banner's purpose as a guided path from the warning to the configuration page.
   - **Root cause**: the ADR Implementation notes explicitly flagged this verification step ("Implementer: verify the exact route in the existing Search Preferences page before hardcoding"). The Implementer (me, in the prior phase) conflated the UI breadcrumb display ("Home > My Grapevine > Search Preferences") with the URL route.
   - **Asked change**: Update the `href` to `/tapestry/grapevine/search-preferences`.

### Non-blocking

1. **`test/scheduled-search-and-house-scores-refresh.test.js:185-187`** — The banner-link assertion `assert(/Search Preferences|search-preferences|grapevine\/search/i.test(src), ...)` matches the wrong URL because `search-preferences` is a substring of both `/home/my-grapevine/search-preferences` (the bug) and `/tapestry/grapevine/search-preferences` (the fix). After Blocking #1 is fixed, tightening the regex (e.g. `/\/tapestry\/grapevine\/search-preferences/.test(src)`) would prevent this exact recurrence. Not blocking the merge, but worth a one-line test hardening pass alongside the fix.

2. **`src/algos/nip85/loadScoresIntoMeilisearch.js:23-25`** — When neither `--povPubkey` nor `BRAINSTORM_OWNER_PUBKEY` is available, the error message reads "povPubkey not provided and BRAINSTORM_OWNER_PUBKEY not configured". On the owner default path (no CLI args), this can read as if the operator did something wrong by not providing `--povPubkey` — when actually they didn't intend to. A clearer message: "BRAINSTORM_OWNER_PUBKEY not configured (and no --povPubkey CLI override provided)". Cosmetic.

3. **`tests/brainstorm/scheduled-search-and-house-scores-refresh.spec.js`** — The Playwright spec includes a banner-visibility test that would have caught Blocking #1 by clicking the link. Before promoting to staging, recommend running the spec once (`npx playwright install` then `BRAINSTORM_BASE_URL=http://localhost npm run test:playwright`).

## Verdict (initial)

**CHANGES_REQUESTED**

One blocking issue (the wrong banner URL) breaks AC-9's intent. The fix is one line. After:
1. Fixing `ui/src/pages/settings/RelaySettings.jsx:1380` to `/tapestry/grapevine/search-preferences`,
2. Rebuilding the UI (`npm --prefix ui run build`),
3. Confirming `npm test` still PASS, and
4. (Optional) tightening the test regex per Non-blocking #1,

re-run `/review-changes` and this should be PASS-ready. The other 11 ACs are fully satisfied, the ADR's design is faithfully implemented, no scope creep, no regressions in the existing Owner pipeline (live-verified via API smoke).

---

## Re-review (post-fix)

**Date:** 2026-05-13
**Fix commit:** `7371d58b impl-fix: correct HousePovUnconfiguredBanner href + tighten test regex (review 4 Blocking #1)`

**Changes applied:**
1. `ui/src/pages/settings/RelaySettings.jsx:1380` — href corrected from `/home/my-grapevine/search-preferences` to `/tapestry/grapevine/search-preferences`. Verified against the actual route in `ui/src/App.jsx:230` (`{ path: 'search-preferences' }` nested under `{ path: 'grapevine' }` under the `tapestry` parent) and `ui/src/components/Layout.jsx:37`.
2. `test/scheduled-search-and-house-scores-refresh.test.js:173-180` — banner-URL assertion tightened from a permissive substring match (`/Search Preferences|search-preferences|grapevine\/search/i`) to a strict path match (`/\/tapestry\/grapevine\/search-preferences/`) — Non-blocking #1 from the initial review. The stricter regex would NOT match the previously-shipped wrong URL, so this exact class of typo cannot recur silently.

**Quality gates (re-run):**
- `npm test` — **PASS**. 12/12 in the scheduled-search-and-house-scores-refresh suite, 5/5 in the treasure-maps suite, Configuration Loading PASS, Overall PASS.
- Source verified at `ui/src/pages/settings/RelaySettings.jsx:1380` — only one `search-preferences` occurrence and it's the corrected one.
- UI bundle rebuilt (`✓ built in 20.14s` → `dist/assets/index-BtapSows.js`); rebuilt bundle contains the corrected URL and does **not** contain the previous wrong URL.

**Non-blocking #2 (loader error wording)** — not addressed in this fix. Tracked as cosmetic; can fold into a future doc / DX pass if desired. Does not affect verdict.

**Non-blocking #3 (Playwright headless install)** — still applies. Recommended to install (`npx playwright install`) before the staging promotion so the spec's banner-visibility test exercises the live route. Does not block this PASS verdict because the unit test now strictly validates the URL string.

## Verdict (final)

**PASS**

All 12 ACs satisfied. Blocking #1 fixed; the corresponding test is now strict enough to prevent recurrence. ADR design faithfully implemented; no scope creep; no regressions in the Owner pipeline (live-verified via API smoke during cycle-local). Diff is mergeable as-is. Recommended next step: open a PR from `feat/scheduled-search-and-house-scores-refresh` → `staging` and follow the `cycle-staging` → `cycle-prod` promotion path. Before staging, recommend a one-time `npx playwright install` so the Playwright spec runs on the local stack as additional defense-in-depth.
