# Review: Story 1 — /setup shows where you stand

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-21
**Diff:** `git diff 48813298 7fe27582` (whole story: ADR `128f9b9d`, failing tests `f090a409`,
implementation `7fe27582`); implementation alone `git diff f090a409 7fe27582`. Branch
`feat/setup-status-and-alert`, working tree clean.
**Story:** `engineering-team/stories/setup-status-and-alert/1-setup-shows-where-you-stand.md`
**ADR:** `engineering-team/decisions/setup-status-and-alert/0001-one-setup-status-answer.md`
**Test plan:** `engineering-team/stories/setup-status-and-alert/1-setup-shows-where-you-stand.test-plan.md`

Tester and Implementer were the same session, so the tests were read as closely as the code, and
every claim in the Deviations, the test plan's Verification and the commit messages was re-derived.

## Quality gates (run by reviewer, not trusted)

- [x] **The story's scoped gate** (book § Test gate; the full `npm test` is not this book's gate).
  - The walker grep (`/usr/bin/grep -rl readdirSync test/`) was re-run first. It finds one suite
    that the pinned list leaves out: `gate-result-record` (C9 reads every `test/*.test.js`), which
    walks `test/`, and this story adds a suite there. See Harness friction 1. I ran it on its own:
    34 passed, 0 failed, 0 skipped.
  - I ran the test plan's heredoc with `GATE_LABEL=setup-status-1-review`, adding one line that
    prints the suite count (71). `npm run gate:status -- --label setup-status-1-review`:

    ```
    20260921T172611Z-24946-5fc6 [setup-status-1-review] started 2026-09-21T17:26:11.618Z on 7fe27582 — PASS, exit 0, 1485 passed, 0 failed, 4 skipped, 71/71 suites
    ```

  - This is the committed tree. The Implementer's run (`20260921T170840Z-20210-bcaf`) was on
    `f090a409+dirty`. The baseline (`20260921T161604Z-2762-835d`) was 1448 passed and 37 failed,
    all 37 in setup-status. 1448 + 37 = 1485, so the 37 reds became passes and nothing else moved.
    The four skips are the baseline's own: deploy-safety-status 1, show-the-four 2, setup-status H2 1.
- [x] **The Node suite alone, with the opt-in live sign-in** (`SETUP_STATUS_LIVE_SIGN_IN=1`,
  through `.run()`): 40 passed, 0 failed, 0 skipped; H-class 2 executed, 0 skipped. The log has
  46 lines, so the suite did run.
- [x] **UI build** (`npm --prefix ui run build`): passed. The `:4173` preview serves the fresh
  `dist/` (same `index-DBPZgGp7.js`), and that bundle contains `/api/setup/status`.
- [x] **Browser class** (`BRAINSTORM_BASE_URL=http://localhost:4173 npx playwright test
  tests/brainstorm/setup-status.spec.js --project=chromium`): 14 passed (B0–B9).
- [x] **eslint parity** on the touched UI files:
  - At HEAD there is one error: `ui/src/context/SetupStatusContext.jsx:65`
    `react-refresh/only-export-components`.
  - `AuthContext.jsx:8`, `ConfigContext.jsx:5` and `AssistantRosterContext.jsx:19` carry the same
    rule, so the Deviations claim is verified.
  - `App.jsx`, `pages/setup/Index.jsx`, `pages/setup/steps.js` and `utils/setupStatus.js` lint clean.
    The base versions of the first three (`git show f090a409:…` through `--stdin`) were clean too.
- [x] **`bash scripts/harness-lint.sh`:** exit 0, "harness-lint: clean (0 violations)".
- [x] **Reviewer's own checks** (scripts in the session scratchpad, not the repo):
  - **Live `:7778`, 11/11.** The page made no non-GET request in any scenario:
    - signed out;
    - a real throwaway-key session. The only POSTs were the script's own verify-user and
      login-user calls, which create a session and nothing else (`handleAuthLoginUser` read);
    - a stubbed Owner at 375 px.
  - **Hermetic `:4173`, 12/12 plus one INFO.** It checks the provider's lifecycle with a fake
    NIP-07 signer. Every `/api` request was answered in the browser. The INFO line is Blocking 1.
  - **The handler run in the container** (`docker exec`, read-only) for the configured Owner.
- [ ] _Lint not configured — skipped (eslint parity above is the book's check)._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped (the UI build above is the book's check)._

## Spec adherence

- [ ] **Every acceptance criterion has a passing test.** Mostly. AC-4's fourth bullet fails in one
  reachable path (Blocking 1), and nothing covers the provider's lifecycle. Per AC:
  - **AC-1, signed out:**
    - Tests: B1 and B2, plus U1. The reviewer's L1 and P1 agree.
    - The button calls the same `login().catch(() => {})`, with the same class and text, as
      `BrainstormUserMenu.jsx:86`.
    - Clicking it runs getPublicKey, then signEvent (kind 22242), then verify-user, then login-user
      (P1). No suite clicks it (Non-blocking 2).
    - "A signed-in viewer never sees that line": B2 covers the page while sign-in resolves, and
      B3–B6, B9 and P1 cover it after.
  - **AC-2, the rules:** U3, U16, U17 and B6.
    - The Owner's assistant is the TA: `getAssistantPubkeyFor(Owner) === getOwnerAssistantPubkey()`
      on this instance.
    - A Customer whose Map names the TA gets "another provider" (U17).
    - A guest gets step 1 not done. The real guest answer on the live stack shows it too (L2).
  - **AC-3, where it looks:** U4, U5, U7, U10, U13, U15 and U20.
    - Live, the Owner's answer came from local hits (`source: 'local'`) in 36 ms with no relay
      traffic.
    - A brand-new key finished on the outside relays in 0.8–1.7 s.
  - **AC-4, how it shows:**
    - B3, B4, B6 and B7 pass.
    - L3 adds the ✓ markers, which no test asserts, and shows no link on a done card.
    - The fourth bullet ("while a step's check is still running … not done") holds on a first
      load (B5), but not when the same account signs out and back in (Blocking 1).
  - **AC-5, read-only:**
    - S2 and B8 pass, and L1–L3 saw no non-GET request from the page.
    - The server side is read-only past the module too: `getCustomerRelayKeys` and
      `SecureKeyStorage.getRelayKeys` only read, and so do `getSettings()` and `strfry scan`.
- [x] **No criterion silently dropped.**
- [x] **No behavior beyond the story.**
  - No test pins anything ADR 0001 does not require.
  - Every file changed is on the ADR's list.

## ADR adherence

- [x] **Files match the implementation notes.** `src/api/setup/status.js`, `src/api/index.js`,
  `openapi.yaml`, `ui/src/utils/setupStatus.js`, `SetupStatusContext.jsx`, `App.jsx`, `Index.jsx`,
  `steps.js` and `styles.css`. Nothing in § 7 (Unchanged) was touched.
- [x] **Server, point by point:**
  - **The response shape**, including `reason` and `source: null` on an unfinished step, and no
    pubkeys (U18; the live answers carry none).
  - **`FOLLOW_LIST_RELAY_CATEGORIES`** (`status.js:30`).
  - **`treasureMapRelays` through `currentMap.defaultRelays`** (`:243–245`).
  - **`outsideOnly`**: loopback, the host of `BRAINSTORM_RELAY_URL`, `STRFRY_DOMAIN`, ws/wss only,
    and de-duplication (`:214–235`). Live, `ws://localhost:7777` is dropped from both lists.
  - **`RELAY_BUDGET_MS` 8000 and `LOCAL_SCAN_TIMEOUT_MS` 5000.**
  - **`scanLocalStrict`** rejects on a spawn error, a non-zero exit or the timeout, kills with
    SIGKILL and clears its timer (`:57–96`).
  - **The first *valid* entry wins** (`:156–161`).
  - **The `pending` and `finished` rules** (`:164–199`).
  - **No query parameter is read** (`:253–259`, U2).
  - **The session predicate** is `authenticated === true` plus a 64-hex pubkey.
- [ ] **UI provider (ADR § 3):**
  - It is mounted inside `AssistantRosterProvider`, around `RouterProvider` (`App.jsx:493–497`).
  - Fetching is lazy: signed in on `/`, nothing is fetched (P0).
  - A late answer for another account is dropped (P4, P5).
  - **"`user` becoming `null` resets the state to `idle`" (ADR:362) is not honored for the same
    account.** See Blocking 1.
- [x] **Layering.** The rule lives in one server module. The util is pure ESM. The page reads only
  the provider (D3), and the provider is the only reader.
- [x] **No new dependencies.** `package.json` and the lockfiles are unchanged.

## Concept-graph integrity

- [x] **Handles.** No handle appears in code. The story names `39998:<TA>:…`, and all four named
  concepts are present in the live `/api/concept-graph/summaries` under this instance's TA.
- [x] **Firmware.** No concept changed, so no reinstall.
- [x] **Orientation.** The ADR oriented through `/summaries`, and the code touches no concept.

## Things tests can't catch

- [x] **No secrets committed.** No 64-hex literal in any changed file. The key reads return
  pubkeys only (`getAssistantPubkeyFor`'s narrowed return).
- [x] **No debug output.** The one `console.error` sits on the 500 path (`status.js:278`).
- [x] **No commented-out code.**
- [x] **Error paths.** A throw answers 500 (U19). A failed scan is `local-unreadable`, and a
  failed, non-JSON or signed-out answer is `failed` in the UI (B5, B9).
- [ ] **Concurrency and races.** A different account never sees a stale answer (P4, P5). The same
  account re-signing in is shown the answer from before its sign-out while the new check runs
  (Blocking 1).
- [x] **Security.**
  - There are no parameters, so no SSRF surface: relays come only from operator config, and the
    instance's own relay is excluded.
  - Outbound reads are bounded per request.
  - The middleware lists hold no substring that matches `/api/setup/status`, so it is public and
    checks the session itself. The container's drifted `auth.js` differs only by
    `/personalized-pagerank`.
  - A rate note is in Non-blocking 5.
- [x] **Resource cleanup.**
  - The module clears its timers (`status.js:111–123`, `:63–68`) and kills a scan that times out.
  - A relay read that loses the 8 s race runs on inside `readRelayEvents`' own bounds (about 14 s)
    and closes its relay in `finally`.
  - The one leak path is in the shared primitive and predates this story (Non-blocking 4).

## House rules check

- [x] **Concept Graph API authority respected.**
- [x] **No new lint, typecheck or build tooling.**
- [x] **No hardcoded TA pubkey.** The TA appears only as the Owner's own assistant, through
  `getAssistantPubkeyFor` (CLAUDE.md house rule; book guardrails).
- [x] **The approved setup-page-scaffold #1 copy is byte-identical.** R1 checks it, and I compared
  the scaffold story's § Copy by hand.

## Product-guide adherence *(no PRD; the book has an acceptance frame)*

- [x] **Copy.** Every new string matches story § Copy byte for byte, with straight apostrophes:
  "Sign in to see which steps you've done.", "Sign in with nostr", "Done", "Done: ", the two done
  sentences, the another-provider sentence, "{N} accounts followed." / "1 account followed.", and
  "You're all set!".
- [x] **Designed states.** Signed out, still loading, checking, failed, done and not done are all
  rendered. There is no horizontal scroll at 375 px (B7, L3).

## Findings

### Blocking

1. **`ui/src/context/SetupStatusContext.jsx:30` and `:48`: after a sign-out, signing back in as
   the same account shows that account's previous answer as current while the new check is still
   running.**
   - **The cause.**
     - The request key is `${pubkey}#${attempt}` (`:30`).
     - Neither sign-out nor sign-in bumps `attempt`, and nothing clears `result` (`:29`). So when
       the same pubkey signs in again, `:48` finds `result.request === request` and reports
       `phase: 'answered'` with the answer from before the sign-out.
     - Meanwhile the effect at `:32–46` has started a new read, since `request` went from `null`
       to the same key.
     - The same recurrence follows any `authLoading` true→false flip for an unchanged user
       (`AuthContext.jsx:45`, which every `login()` runs through `:143`).
   - **Reproduced.** In the reviewer's hermetic run on the built UI, P3 signed in, got "3 of 3",
     signed out, then signed in as the same account with a 2.5 s status answer. It logged
     "previous answer (3 of 3) shown while the new read was in flight: true", before settling on
     the new answer, "1 of 3".
   - **What this contradicts.**
     - **AC-4** (story `:80`): "while a step's check is still running, or when it has failed, the
       step shows as not done".
     - **ADR 0001 § 3** (`:361–362`): "`user` becoming `null` resets the state to `idle`".
     - **Story 2 AC-2** (`2-the-setup-alert.md:54`). The ADR has story 2 add no fetch of its own
       and read `pendingCount` from this same provider. So the pill would count steps from the old
       answer while a check is still running, which that criterion forbids.
     - **The Deviation "The provider derives its phase instead of storing it"** (story `:145–150`)
       says "an answer for a previous account is never shown". That is true and verified (P4, P5),
       but it does not mention the same-account case. That makes this an unrecorded departure from
       ADR § 3.
   - **Asked change.**
     - Make every new read of the status start from `checking`, including a re-sign-in as the same
       pubkey. One way that the `set-state-in-effect` rule does not flag: a sign-in generation
       adjusted during render when the request goes away, and made part of the key. Or drop the
       held `result` when `request` becomes `null`.
     - Pin it with a hermetic B-class test in `tests/brainstorm/setup-status.spec.js`:
       1. sign in and get an answer;
       2. sign out;
       3. sign in as the same account with a delayed status answer;
       4. assert that "Done:" never appears and "0 of 3 complete" shows while that answer is in
          flight.
     - The reviewer's script shows the technique: a fake `window.nostr` through `addInitScript`,
       and in-browser mocks for verify-user, login-user and logout.
     - Record the fix in § Deviations.
     - If the owner would rather keep the old answer during a re-check, AC-4 and ADR § 3 need
       amending first, and story 2's AC-2 re-examined.

### Non-blocking

1. **`ui/src/pages/setup/Index.jsx:107–114`: the sign-in line sits above the steps.** ADR 0001
   (`:390`) lists it after the steps ("then the signed-out line"). The Deviation (story `:137–138`)
   cites only the story's silence. Either place is reasonable. Optional: name the ADR's wording in
   the Deviation.
2. **Test gaps the reviewer covered by hand.**
   - B1 (`setup-status.spec.js:193–194`) checks that the sign-in button is visible, but never clicks
     it.
   - B3 (`:214–229`) never asserts the ✓ marker.
   - The provider's lifecycle (lazy fetch, a new fetch on account change, the reset on sign-out)
     has only token sentinels (`test/setup-status.test.js:743–752`).
   - The Admin variant of AC-2 goes through the same code path as the Customer case.
   - P0–P5 and L3 cover all of these. Blocking 1's new test closes the lifecycle gap.
3. **`test/setup-status.test.js:884–890`: H2 cannot tell the two live branches apart.** It accepts
   either "finished and absent" or "unfinished". On this run the real answer for a brand-new key
   was finished, with all three steps pending.
4. **A socket leak that predates this story, in the primitive it reuses.**
   - nostr-tools 2.10.4's own connect timeout (4.4 s, `lib/cjs/index.js:677–682` in the
     container) rejects without closing `this.ws`.
   - `readRelayEvents` (`src/api/_shared/relaySource.js:247–253`) retries with a new `Relay`. So a
     relay that opens after 4.4 s leaves an open socket that nobody closes.
   - This story adds a caller that runs on every signed-in `/setup` load that misses locally: up
     to 11 reads.
   - A candidate ledger row (bug), outside this story's scope.
5. **`src/api/setup/status.js:263–266`: no rate limit.** Any signed-in session, including a
   throwaway guest, can make each GET open up to 11 outbound relay reads on a local miss. Each GET
   is bounded, and the public `/api/relay/external?strict=1` already allows a superset without a
   session. A note, not an ask.
6. **`src/api/setup/status.js:216–218`: `getConfigFromFile` runs on every request.**
   - It is called 4 times per request, plus 2 more in `defaultRelays()`.
   - Each call reads and logs the whole config file (`src/utils/config.js:16–56`).
   - When a key is missing, each call falls back to `execSync('source …')`.
   - Optional: read the two keys once per request.
7. **ADR 0001 `:59` cites "OPEN.md rows 280 and 314".** Row 280 is now the host-`node_modules` row
   (`OPEN.md:312`). The `querySync` row is 314 alone, after the renumbering that row 307 records.
   `relaySource.js:225` has carried the same stale "row 280" since before this story.
8. **The ADR's three follow-ups, dispositioned (the ADR leaves this to the Reviewer):**
   - **(a) A failed strfry scan reads as empty** in `scanLocal` (`src/api/dlist-curation/index.js:147–155`,
     which resolves on `close` whatever the exit code) and in `/api/strfry/scan`
     (`src/api/strfry/queries/scan.js:129`). Recommend a new ledger row (bug): a failed scan
     reading as "none here" can make Map regeneration run blind.
   - **(b) `fetchCurrentMap`'s `querySync` "strict" read**: extend OPEN.md row 314; no new row.
   - **(c) The duplicated per-relay loop** (`status.js:111–123` against `fetchEvents.js:34–47`): no
     row. The ADR already records when to unify them (a third caller).
9. **Live data.** On this machine the Owner's Map names `4b7ba0a1…` for rank and followers, not
   this instance's TA (`11f23fe4…`). So the Owner's real answer is "step 3 not done, another
   provider", which is correct by the rules. AC-2's "Owner with the TA is done" is therefore proven
   by U17's fixture, not by live data.

### Harness friction *(each becomes an OPEN.md row, type `meta`)*

1. **The pinned gate list left out a walker of `test/`.**
   - The triage of the `readdirSync` hits treated `test/` as untouched: "the rest walk trees this
     story does not touch" (test plan `:150`).
   - But every story whose Test Design adds a suite touches `test/`, and `gate-result-record` C9
     walks it. `stack-free-npm-test` was pinned for that reason; `gate-result-record` was not.
   - Harmless this time (34/0/0 when run on its own).
   - This is a new instance of ledger row `2026-09-21-abbreviated-path-names-no-gate`. Extend that
     row, or state in the gate recipe that the `test/` walkers belong to any story that adds a
     suite.
2. **The `:4173` preview origin is not isolated from the live stack.**
   - Vite applies `server.proxy` (`ui/vite.config.js:40–48`, `/api` → `http://localhost:7778`) to
     `vite preview` as well. `curl :4173/api/setup/status` answered from `:7778`.
   - So "hermetic" B-class specs are hermetic only because of their catch-all route. A missed mock,
     including a POST, reaches the live local stack, and neither the test plan nor the spec
     precedent says so.
   - Fix shape: `preview: { proxy: {} }`, or a stated rule that every B-class spec registers an
     `/api/**` catch-all first.
3. **The B-class has no recipe for signing in inside a hermetic browser.**
   - Memory `verifying-signed-in-ui` says there is no signer in the automated browser, so D-class
     token sentinels stood in for the provider's lifecycle, and Blocking 1 went uncaught.
   - In Playwright 1.56.1, a fake `window.nostr` set through `page.addInitScript`, plus in-browser
     mocks for verify-user, login-user and logout, drives real sign-in, sign-out and account
     switches. Reference: the reviewer's `provider-race-check.js`.
   - Recommend adding it to the B-class precedent. Story 2's pill will need it.

## On PASS (same commit)

- [ ] Story `**Status:**` flipped to `Done` in place. *(Not applicable: changes requested.)*
- [ ] Completion detection. *(Not applicable: changes requested.)*

## Verdict

**CHANGES_REQUESTED**
