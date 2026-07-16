# Review: Story 2 — Single-letter tag filters on Router Management streams

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-07-16
**Diff:** `git diff 58314b7c..HEAD` (HEAD = `722f8e3f`, branch `feat/router-stream-tag-filters`, worktree `tapestry-wt-router-tag-filters`)
**Story:** `engineering-team/stories/relay-management/2-router-stream-tag-filters.md`
**ADR:** `engineering-team/decisions/relay-management/0002-router-stream-tag-filters.md` (incl. Amendment 1, 2026-07-16)
**Test plan:** `engineering-team/stories/relay-management/2-router-stream-tag-filters.test-plan.md`

Commit sequence audited: `682bda80` (book-open), `759605aa` (story), `97d74e97` (ADR), `6479715a` (failing tests), `a320affa` (ADR amendment), `32992557` (amendment test-scoping), `353f4b15` (implementation), `722f8e3f` (journal). Book/journal/intake/epic edits are process artifacts of this harness, not code scope creep — verified they touch only `engineering-team/**` docs.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **Overall: PASS, exit 0, zero suite-FAIL lines.** Run by me in the worktree with the Docker stack/daemon down, which mirrors CI's `stack-free` job exactly (live-API suites self-skip; per the environment constraint this run must be fully clean with no environmental allowance — and it is). Decisive summary lines from my run:
  ```
  sync-panel-tag-filters suite:                    PASS (20 passed, 0 failed)
  router-stream-tag-filters suite:                 PASS (21 passed, 0 failed)
  Total skipped:                                   242
  Overall:                                         PASS
  EXIT: 0
  ```
  The only occurrence of the string "FAIL" in the whole log is a harness-lint *test name* (`L7: a verdict-bearing file offering FAIL as a verdict is a violation`), not a failure.
- [x] `npm --prefix ui run build` (vite) — exit 0, `✓ built in 14.97s`. The chunk-size warning (>500 kB) is pre-existing, not from this diff.
- [x] Stack-up differential context (journaled, not re-runnable here): the post-implementation stack-up full run recorded a FAIL-name set byte-identical to the pre-implementation baseline at `58314b7c` (the 34 OPEN.md #27 environmental fails; `journal.md` entries 02:16 / 04:44 / 04:45). The only test-file change since that run is the ratified amendment scoping, which I audited line-by-line below.
- [ ] `npm run test:playwright` — not run: no Playwright coverage exists for this surface; the test plan fixes the levels as executed helpers + source-level JSX assertions (ADR §Implementation 4), and the local stack is down by environment constraint. Residual live-loop risk is the staging item noted under Findings.
- [x] _Lint / typecheck not configured — skipped._

## Spec adherence

- [x] **Every acceptance criterion has a passing test** (coverage map cross-checked against the actual suite; all 21 tests pass in my run):
  - **AC-1** (entry/validation at story-#1 parity): parity is by construction — the same `TagFilterEditor` component and the same validation core, asserted by S1 (`test/router-stream-tag-filters.test.js:311` — reuse, `form.filter` single source of truth, `!/setTagFilters/` no parallel state), S2 (:326 — helpers imported from the shared module), S3 (:336 — block between Event Kinds and Limit), U1/U3 (rows derived/written back); the validation core itself is executed by the sibling suite (20/20 in the same run).
  - **AC-2** (saved into deployed config, composed, per-stream, byte-compat): B1–B6 + R2 executed. B5 proves byte-identical `generateConfig` output for kinds/limit-only streams after sanitization (incl. today's `{"kinds":[],"limit":5}` default and a plugin-bearing stream); B6 proves `#z` composed with kinds/limit in the emitted config text with the sibling stream's block byte-identical; B2/B3 prove the closed-vocabulary reconstruction (garbage dropped, hand-edited legal keys survive).
  - **AC-3** (survives save → restart, existing flow): B8 (sanitize idempotent + pure), S5 (sanitize at the client-JSON ingress only; toggle/restore/init/ensureState untouched), R1 (exports + `supervisorctl restart strfry-router` mechanics unchanged). Structurally, tag filters ride `stream.filter` — the exact field already persisted to `router-state.json` and regenerated into the config by `initRouter` at boot; no new restart behavior exists in the diff.
  - **AC-4** (round-trips into the editor; removal deletes exactly that key): U1/U2/U4/U5 executed (inverse property, exact-key deletion, `authors` survival, verbatim display, case-sensitive letters), S4 (read card shows saved filters).
  - **AC-5** (OPEN.md #25 stream expressible; presets stay kinds-only): B7 executes the full pipeline (kinds-only preset filter + `#z` row → `applyTagFilters` → `sanitizeStreamFilter` → config text `{"kinds":[39999],"limit":5,"#z":[handles]}`); R3 asserts every preset in `setup/router-presets.json` remains kinds-only and story-#1's surface is untouched.
- [x] No criterion silently dropped.
- [x] No behavior added beyond the story. Production diff = exactly three files: `src/api/strfry/routerConfig.js` (sanitizer + ingress wiring + export), `ui/src/utils/tagFilterValidation.js` (two pure helpers + header comment), `ui/src/pages/settings/RelaySettings.jsx` (import, Tag Filters block in `StreamEditor`, read-card line). No `negentropySync.js` change, no preset change, no restart-semantics change, no new endpoints.
- [x] **Deviations section audited** (story §Deviations): the read card renders saved tag entries as ` #z: v1, v2` appended to the existing `Filter:` line rather than the ADR's example text `+ tag filters …`. The ADR marks that format with "e.g." (non-normative); the normative requirements — Filter line extended, filters visible without opening the editor, render condition changed to "has kinds or tag entries" — are all met at `ui/src/pages/settings/RelaySettings.jsx:619-624`. Within latitude; properly logged.

## ADR adherence

- [x] Files changed match ADR §Implementation notes 1–4 exactly, down to the JSX snippet (`RelaySettings.jsx:141-144` matches the ADR's snippet verbatim, incl. `disabled={false}`) and the sanitizer's per-key rules (`routerConfig.js:45-68`: non-object → `undefined`; empty `kinds:[]` preserved; `ids`/`authors` dropped when empty after filtering; `since`/`until`/`limit` via `Number.isInteger`; `/^#[a-zA-Z]$/` tag keys kept when non-empty; insertion order via `Object.keys`).
- [x] Sub-decisions honored: whitelist boundary = deployed parser's closed vocabulary, not UI capability (B3 proves `ids`/`authors`/`since`/`until` survive an unrelated save); sanitize at the client-JSON ingress only (`routerConfig.js:220-225` inside `handleUpdateRouterConfig`; `handleToggleStream`/`handleRestoreDefaults`/`initRouter`/`ensureState` untouched — S5 asserts both directions); server-side guard is a CJS twin (`TAG_FILTER_KEY_RE` at `routerConfig.js:33`), no `ui/` cross-import into the server tree.
- [x] Layering respected: pure helpers in the shared ESM module; React wiring in `RelaySettings.jsx`; shape enforcement server-side. `generateConfig`/`applyConfig` untouched.
- [x] No new dependencies (no `package.json`/lockfile diffs; test suite uses already-present `nostr-tools`).
- [x] **Amendment 1 blast-radius audit** (`git diff 6479715a..HEAD -- test/`, walked line by line):
  - `test/sync-panel-tag-filters.test.js` — exactly the ratified edit: the `negentropySyncRegion` helper (matches the amendment's prescribed code, loud-fail on missing marker) + S1's usage match and S3's three `indexOf` lookups re-input from `src` to `panel`. **Every predicate and every assertion message is byte-identical; nothing removed.** S1's file-global `function TagFilterEditor` declaration assertion is retained as ratified.
  - `test/router-stream-tag-filters.test.js` — the ratified defensive-symmetry clause: the `relaySettingsRegion` twin + S1/S3/S4 swap `sliceSection`-with-named-end-markers for owning-component regions. Predicates/messages unchanged. This is strictly *tightening*: I verified the region layout in the current file (`StreamEditor` 39→214 `ToggleSwitch`; `RouterStatus` 246→673 `TimestampPicker`; `NegentropySync` 894→1308 `StreamingETLPanel` — matching the amendment's "currently StreamingETLPanel" note), so each assertion now runs against a region equal to or narrower than before, and a missing start marker fails loudly instead of slicing to EOF.
  - Guarding power spot-verified statically: the sync panel's instance at `RelaySettings.jsx:1184` carries `disabled={running}` inside the 894–1308 region (S1 passes for the right reason); its Authors (1167) < Tag Filters (1182) < Time Range (1190) ordering holds within the region (S3 likewise). If either regresses, the narrowed assertions fail. Nothing in the amendment diff weakens anything.

## Concept-graph integrity

- [x] Handles referenced (not redefined) and in `kind:pubkey:slug` form: story §Concepts touched cites `39998:<this instance's TA>:nostr-relay` with runtime resolution. Deliberately no tag-family concepts — the editor is generic operator tooling per the epic guardrail; a `#z` value is an opaque string throughout the diff.
- [x] No concept definitions changed → **no firmware reinstall required** (ADR §Consequences states it explicitly; nothing in the diff touches concept definitions or `/summaries` consumers).
- [x] Orientation done at Architecture time via the concept-graph API (ADR §Constraints); the new code paths carry no concept-graph semantics to orient.

## Things tests can't catch

- [x] **No secrets.** Sweep of all added lines in `src/`, `ui/`, `test/` for debug/secret/hardcode patterns: clean. Test fixtures mint their own pubkey via `getPublicKey(generateSecretKey())` (`test/router-stream-tag-filters.test.js:101`) — **no hardcoded TA pubkey anywhere in the diff**, per house rule. ADR 0015's `LEGACY_*` constants are untouched (their files aren't in the diff).
- [x] No leftover debug logging — the only `console.log` additions are the test runner's own ✓/✗ output and `test/test.js` summary lines (house pattern in every suite).
- [x] No commented-out code; comments in the diff are explanatory and cite the ADR.
- [x] **Injection surface verified myself** (the AC-2 write path): a tag value reaches the config file only through `JSON.stringify(stream.filter)` at `routerConfig.js:141`, constrained upstream by the sanitizer to non-empty strings (`routerConfig.js:61`). `JSON.stringify` escapes `"` → `\"`, `\` → `\\`, and all control characters U+0000–U+001F (raw newlines become the two-character `\n` escape), so no value can terminate the JSON string, inject a raw newline, or otherwise escape the single-line `filter = {…}` production into the config grammar; U+2028/2029 are emitted raw but sit inside the quoted JSON string and are not config-line terminators; Node's well-formed `JSON.stringify` escapes lone surrogates. Tag *keys* are regex-pinned to `#` + one ASCII letter. The pre-existing **unescaped** interpolation of `urls`/`pluginDown`/`pluginUp` (`routerConfig.js:146-159`, `"${url}"` style) is unchanged by this story and recorded in ADR §Consequences as out-of-scope — see Non-blocking 1.
- [x] Error paths: nullish/non-object tolerance on both helpers and the sanitizer is executed (U2, U3, B4); the sanitizer's whitelist closes the previously-open "one bad POST crash-loops every stream durably" hole (ADR evidence tests 4–6).
- [x] Concurrency: the sanitizer is pure and synchronous; the POST's full-replacement + `saveState` + `applyConfig` concurrency profile (last-write-wins, no locking) is exactly what exists today — unchanged.
- [x] Scope creep: none in code (three files, all ADR-named). `_intake.md` gains the PICKED UP flip plus a triaged NOT-PICKED-UP proposal (meta-ledger sweep) — intake triage is that file's designated purpose, not story scope.

## House rules check

- [x] Concept Graph API authority respected (no source-derived concept claims; orientation journaled at Gate 2).
- [x] No new lint/typecheck/build tooling; JS-without-build posture intact.
- [x] Docker/stack rules respected — the suite is stack-free by design (no `/etc` or `/var/lib` writes, no `supervisorctl`, no network; B-tests assert over returned config text).

## Product-guide adherence

- N/A — acceptance-frame book (no PRD); copy is operator-facing settings UI matching the sibling panel's conventions (same label + hint pattern as story #1).

## Findings

### Blocking

None.

### Non-blocking

1. **`OPEN.md` (ledger row pending)** — ADR §Consequences flags the pre-existing unescaped `urls`/`pluginDown`/`pluginUp` interpolation in `generateConfig` (`src/api/strfry/routerConfig.js:146-159`) "for the ledger as a hardening candidate", and `journal.md` (Gate 2) defers the row to ship time. No row exists in `OPEN.md` yet — make sure it lands at `/cycle-staging`/book close so the flag doesn't evaporate.
2. **`src/api/strfry/routerConfig.js:57-58` + `ui/src/pages/settings/RelaySettings.jsx:54`** — negative integers satisfy `Number.isInteger` (kinds/since/until/limit) and `parseInt` lets an operator enter a negative kind. Whether the deployed parser accepts e.g. `"kinds":[-1]` is outside the ADR's evidence set (tao-json signed/unsigned mismatch is conceivable). This is *pre-existing* exposure — today's opaque pass-through persists the same value — and the implementation matches the ratified ADR spec exactly, so not blocking; fold a "negative/absurd integer bounds" line into the same hardening ledger row as finding 1 if desired.
3. **`ui/src/pages/settings/RelaySettings.jsx:118`** (pre-existing, untouched) — `form.filter.kinds.map(...)` throws if a hand-edited stream's filter lacks `kinds` (or the stream has no filter), crashing the editor on open. Unreachable from any UI flow (UI-created streams always carry `kinds`, even empty, and the sanitizer preserves it); the new code alongside it (`tagFiltersFromFilter(form.filter)`) is deliberately nullish-tolerant. Candidate line for the same hardening row.
4. **Staging verification item (AC-3's physical loop)** — the live save → router-restart round-trip was not exercisable in this review: the local Docker daemon is down (journaled environment change), and the local `strfry-router` process has been FATAL-stale since May regardless (ADR §Verified evidence b). Durability rests on structural evidence (filter rides the already-persisted `stream.filter`; `initRouter` regenerates config from state at boot; ADR parser evidence 1–3; B8/S5/R1) — solid, but per the book's pre-authorized gate plan the `/cycle-staging` smoke should include one saved tag-filtered stream surviving a restart and round-tripping into the editor before the book is offered for close.

### Harness friction

1. None this story from the review seat. (The verdict-parser trailing-token constraint — OPEN.md #28 — is honored by this file's layout: the close-out checklist precedes the verdict, and nothing verdict-shaped follows it.)

## On-verdict close-out (same commit as this review)

- [x] Story `**Status:**` flipped to `Done` in place (`engineering-team/stories/relay-management/2-router-stream-tag-filters.md`).
- [x] Completion detection run against `engineering-team/audits/router-stream-tag-filters/book.md`: frame bullets 1–4 are satisfied by this diff, but the book's own "Done looks like" line requires the story to **ship to `staging`** with staging verification, and the session-mode plan reserves the close offer for after that. The book stays `Open`; do not offer `/close-book` until the `/cycle-staging` smoke (incl. Finding 4's check) is done.

## Verdict

**PASS**
