# Review: Story 1 — The profile check and the hub's Done mark

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-09
**Diff:** `git show 224ea3b` + `git show d5aa730` on `staging` (both local, unpushed), rebased onto `03e7e66` (which carries
the parallel book `assistant-outbox-relays`, `fe29db2`). Tests: `cfadc1a`, `eea477f` (and the shared fixtures/re-aims in
`a0c4d8b`, `50a6103`, `ac4ffbc`, `ef81af6`).
**Story:** `engineering-team/stories/assistant-profile-checklist/1-the-profile-check-and-the-hubs-done-mark.md`
**ADR:** `engineering-team/decisions/assistant-profile-checklist/0001-the-profile-check-joins-the-one-attention-answer.md`
**Test plan:** `engineering-team/stories/assistant-profile-checklist/1-the-profile-check-and-the-hubs-done-mark.test-plan.md`

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` (`GATE_LABEL=reviewer-profile-checklist npm test`), read with `npm run gate:status -- --label reviewer-profile-checklist`:

  ```
  20261009T163208Z-6889-0b67 [reviewer-profile-checklist] started 2026-10-09T16:32:08.630Z on d5aa7309 — FAIL, exit 1, 5294 passed, 1 failed, 582 skipped, 285/285 suites; failed: harness-lint · /home/user/tapestry/tmp/gate-runs/20261009T163208Z-6889-0b67.json
  ```

  The one failed suite is `harness-lint.test.js`. `bash scripts/harness-lint.sh | grep VIOLATION` prints exactly one line,
  `VIOLATION L10 commit:695fac4` (a 2026-10-03 harness-definition commit from another session, an ancestor of this
  book's first commit `a217d0c`). It is not this book's. The run record lists no other non-PASS suite (the other 26 are
  stack-gated SKIPs) and no stray errors. This book's suites: `assistant-profile-check` 33/0/0,
  `assistant-attention` 38/0/1, `assistant-alert` 15/0/0, `assistant-management-page` 23/0/1,
  `assistant-outbox-check` 29/0/0, `assistant-outbox-relays-page` 18/0/0 (pass/fail/skip).
- [x] Playwright (chromium) against the built UI at `http://localhost:7799` (answered 200), every `/api` route mocked.
  `dist/` was built at 16:20 from `fadd699`; `git diff fadd699 HEAD -- ui/ src/lib/` is empty, so it is current with
  HEAD's UI. Ten specs: **119 passed, 3 skipped, 0 failed**. Per spec: assistant-profile-check 5 ✓,
  assistant-profile-checklist-page 19 ✓, assistant-attention 7 ✓, assistant-alert 10 ✓, assistant-management-page
  21 ✓ + 3 skipped (B8 for `/assistant/profile`, `/assistant/identification-tags` and `/assistant/outbox-relays`: no
  longer placeholders, skipped by design), my-assistant-page 18 ✓, ta-composite-avatar 5 ✓,
  assistant-default-profile 8 ✓, assistant-outbox-relays 12 ✓, assistant-identification-tags-page 14 ✓.
- [x] _Lint not configured; skipped._
- [x] _Typecheck not configured; skipped._
- [x] _Build not configured; skipped._ (No rebuild into `dist/`.)

## Spec adherence

| AC | Tests (plan IDs) | Result |
|---|---|---|
| AC-1 the item list | L1, L2, L3, L4 | pass |
| AC-2 the viewer's own Assistant only | U1, U16, A1, A3 | pass |
| AC-3 which profile; no profile | U11, U14 | pass |
| AC-4 each item's rule (incl. dev box) | U2–U9, U12, F1 | pass |
| AC-5 finished | U4, U9, U10, U13, U15 | pass |
| AC-6 the hub reads it | C1–C4, D1, D2; browser B1–B5 | pass |
| AC-7 read-only, one request | S1, A2, D3, S2 | pass |

- [x] Every acceptance criterion has a passing test.
- [x] No criterion is silently dropped.
- [x] No behavior added that isn't in the story.

My own probes (scratch scripts against the real modules, nothing changed):
- With all three checks stubbed, `handleAssistantAttention` answers `identification-tags`, `outbox-relays` and `profile`.
  `checkProfile` is called with the session's Assistant even when the request carries a `pubkey` query. With the
  profile and outbox checks both throwing, the answer is 200 with two `check-failed` actions and identification-tags
  intact. **The merge kept both books' behavior.**
- `checkProfile` with a throwing `scanLocalStrict` answers `hasProfile: null` and every counted row unfinished
  `profile-unreadable`, not "no profile".
- Website: `https://X.EXAMPLE/` and `https://x.example:443` are done. `:8443`, `http:` and a trailing-dot host are not.
  Avatar: a `%2e%2e` path that normalizes back to `/generated/<file>` is still the same bare file name, and an
  upper-case hex name is `not-personalized`. Dev box: avatar, NIP-05, website and client tag are finished
  `no-public-address`. Name and About and visibility are still evaluated. The banner is `not-checked`.

## Walk of the diff (story 1's files)

- `src/lib/assistant-profile-items/index.js:14-39`: the seven items in order (banner `counts: false`),
  `COUNTED_PROFILE_ITEM_KEYS`, `PROFILE_CONTENT_FIELDS` (equals `src/api/assistant/index.js:44`, pinned by L3) and
  `COMPOSITE_AVATAR_FILE_RE` (anchored, 8–64 lower hex). No imports. Matches ADR 0001 sub-decision 1 (frozen arrays
  are a harmless addition).
- `src/api/assistant/profileChecklist.js`:
  - `:64-71`: the strict local scan. A failed `strfry scan` rejects, and `:252-254` turns that into
    `profile-unreadable` (ADR sub-decision 2).
  - `:92-102`: `compositeFileOf` requires https, this instance's origin, no user, query or hash, and exactly
    `/generated/<regex name>`. Only a regex-validated bare name reaches `hasStoredAvatar`.
  - `:105-117`: each relay read is raced against `PROFILE_RELAY_BUDGET_MS` (4000). A throw or timeout counts as not
    answered, and the timer is always cleared.
  - `:124-136`: local-only and no-relays read nothing. `outsideOnly` drops this instance's own relay.
  - `:144-203`: the rules follow ADR 0001's table and its order of precedence. `no-public-address` applies to the four
    instance-bound items (`:148`, `:158`, `:170`, `:189`). NIP-05 `unreachable` and visibility `unreachable` are
    unfinished (`:161`, `:200`).
  - `:212-234`: the flags come from the counted rows only. `hasProfile` is `null` on unreadable (Deviation 1, which I
    accept: it keeps the page from offering "Publish the default profile" on a read failure).
  - `:240-269`: no request input. The NIP-05 lookup runs only when the host is this instance's (`:259`). The file
    check runs only for a composite name on a public instance (`:260`, `:267`). A throwing lookup reads as
    `unreachable`.
- `src/api/assistant/attention.js:64, :76, :276-298`: the profile check runs side by side with identification-tags and
  outbox-relays under `Promise.allSettled`. A profile rejection becomes `PROFILE_CHECK_FAILED` and is logged, and an
  identification-tags rejection is still a 500. ADR sub-decision 6 is followed. The deps object handed to
  `checkProfile` overlaps the profile module's own only on `readRelay`, `getConfigFromFile` and
  `getConfiguredPublishRelays`, which are the same functions, so nothing changes meaning.
- `src/api/assistant/avatar.js:152-159`: `hasStoredAvatar` tests the regex first, then `statSync(...).isFile()`. That
  is stricter than the ADR's `existsSync`, which is fine.
- `ui/src/pages/assistant/actions.js:238, :262-277`: `CHECKED_ACTIONS = ['profile', 'identification-tags',
  'outbox-relays']`, and `assistantAttention` returns `done`. `ui/src/pages/assistant/Index.jsx:32-52, :58-59`: the hub
  card's done marks. `ui/src/styles.css:8856`: the done marker rule. These are the outbox book's identical build,
  absorbed by the merge as the brief says. D1 and D2 pin them, and B1/B5 show them in the browser.
- `ui/vite.config.js:32-34, :47, :54`: the alias and CommonJS include (ADR Implementation notes 1).
- `src/api/openapi.yaml:291-376` and `BIBLE.md:527` (§11 row) and `:8` (Last updated): both describe the profile
  action as built.
- `tests/brainstorm/assistant-profile-check.spec.js` (`d5aa730`): the re-aim for the third checked action. Every
  mocked answer marks outbox-relays done, so the counts still move with the profile alone. It does not weaken any
  profile assertion.

## ADR adherence
- [x] Files changed match ADR 0001's implementation notes (library, server module, `attention.js`, `avatar.js`
  export, UI, documents).
- [x] Layering respected: the server computes, the UI reads one answer, and no new request.
- [x] No new dependencies.

## Concept-graph integrity
- [x] No concept handles touched. The story's only concept, `39998:<TA>:nostr-user`, is used only as "whose".
- [x] No concept definitions changed, so no firmware reinstall is needed.
- [x] N/A: no concept orientation needed (stack absent; AGENTS.md §2 fallback, as the ADR records).

## Things tests can't catch
- [x] No secrets. No hardcoded TA pubkey: no 64-hex literal in the added lines. No deployment names: the domain is
  read at runtime through `describeInstance()`.
- [x] No leftover debug logging. The two `console.error` lines are the designed check-failed logs.
- [x] No commented-out code.
- [x] Error paths are covered: a strict scan failure, a lookup throw, a relay throw or timeout, a check throw.
- [x] Concurrency: the reads are independent and the timers are cleared.
- [x] POV (principle 1): only the session's own Assistant is checked, and no pubkey goes into the answer (U16).
  Principle 3: nothing is stored, memoized or polled.

## House rules check
- [x] Concept Graph API authority respected (no concept surface).
- [x] No new lint, typecheck or build tooling. The Vite alias extends the existing build config and the ADR
  authorized it.

## Findings

### Blocking
None for this story.

### Non-blocking (OPEN.md / ledger candidates)
1. **src/api/assistant/profileChecklist.js:246-266**: worst-case latency is understated. ADR 0001 says "up to about
   5 s". On a local miss, `resolveAssistantProfileState` first asks the publish relays (up to `RELAY_BUDGET_MS`
   4 s / `BACKSTOP_MS` 5 s), and only then do the NIP-05 lookup (5 s) and the visibility reads (4 s) start, so the
   attention answer can take about 10 s on the first load after a profile is found only outside. Separately,
   **src/api/nip05.js:148-150** clears its 5 s abort timer before `resp.json()`, so the body read has no time bound.
   That is pre-existing, and the domain is this instance's own. Candidate row: correct the ADR's figure, and keep the
   abort armed through `resp.json()`.
2. **src/api/openapi.yaml:363-376**: the profile item rows document only `key/counts/finished/done/reason`. The detail
   fields the page reads (`picture`, `address`, `value`, `expected`, `hasName`, `hasAbout`, `relaysTotal`,
   `relaysAnswered`, `relaysHolding`) are not listed.
3. **src/api/assistant/avatar.js:83-93**: `hasStoredAvatar` → `defaultGeneratedDir()` runs `mkdirSync` and
   `accessSync` on every attention request where the picture is a composite. It is a trivial side effect for a check
   that is meant to be read-only.
4. **Shared line:** `origin/staging` moved by one merge since the rebase (`ff3d4e6c`, PR #787, router hardening). It
   touches `BIBLE.md` and `test/registry.js`. `git merge-tree --write-tree HEAD origin/staging` is clean. Per the
   book's § Shared lines, rebase and re-run the gate before pushing.

### Harness friction
1. The hand-off brief suggested `TEST_GATE_LABEL=…` for labelling the run. The gate reads `GATE_LABEL`
   (`test/helpers/gateRunner.js:93`; `engineering-team/README.md` § "Running and reading the test gate" is correct).
   A run tagged with the suggested name would be unlabelled. This was a brief error, not a doc defect. No row is
   needed unless it recurs.

## On PASS
- Story status flip and completion detection are left to the main session, per the brief (no flips, no commit here).
  Note: stories 2 and 3 are CHANGES_REQUESTED, so the book is not complete.

## Verdict
**PASS**
