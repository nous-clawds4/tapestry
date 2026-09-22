# Build Audit: The /setup page, live — each step's real state, and the Setup Alert

**Book:** `engineering-team/audits/setup-status-and-alert/book.md`
**Date:** 2026-09-22
**Branch / commit range:** `feat/setup-status-and-alert`, in three pull requests to staging. The book's diff is
the union of the three, each taken against its merge's first parent:
- **#732, story 1:** merged `a31d448c` on 2026-09-21T19:32:05Z, over `47f32791`;
- **#737, story 2:** merged `6754a16a` on 2026-09-21T22:26:37Z, over `0d1ab6db`;
- **#746, story 3:** merged `4ff93dd4` on 2026-09-22T04:58:55Z, over `75304575`.

The branch merged `origin/staging` before #737, and again before #746 (`c892d529`). The second merge brought in
book `assistant-management`'s Assistant Alert, which shares the Setup Alert's spot (§4 #11).

**Production at this close.** Stories 1 and 2 were already on main, through other sessions' promotions: story 1
with #735 (2026-09-21T21:55:28Z) and story 2 with #739 (2026-09-22T01:38:44Z). Story 3 and this close follow in
the promotion the owner asked for after the close. *(Corrected after the close commit: its first version said the
whole book was not yet on main.)*

**Provenance:** Acceptance-frame. There is no PRD.
- The owner's ask is quoted verbatim in `book.md`, with the nine planning decisions.
- The frame was confirmed when the owner approved stories 1 and 2. Its fifth bullet was added when the owner
  opened story 3 after story 2's review.

**Confidence:** high.
- Every frame bullet traces to a story, and all three stories passed review: story 1 in round 2, story 2 in
  round 1, story 3 in round 4.
- Each story was smoke-tested on `staging.brainstorm.world` with a real, throwaway guest session.
- **The one bullet not observed live** is the same-tab catch-up after a real Follow. Staging allows outside
  publishing, so a live Follow would reach public relays. The hermetic browser tests drive the real UI code
  instead (§5).

> The Build Audit is the as-built record. It does not propose changes — that is `prd-seed.md`'s job.

## 1. What shipped

- **`/setup` shows where the signed-in viewer stands.**
  - Each of the three steps is marked done or not done, by the rules in book § Decisions 1–3.
  - "N of 3 complete" counts the done steps, and "You're all set!" shows at 3 of 3.
  - A done step shows a green ✓, a "Done" badge and its done sentence, such as "1 account followed.".
  - A Treasure Map naming another provider leaves step 3 not done, and says so.
  - A signed-out visitor sees the three steps unmarked, with a prompt to sign in.
  - While the answer is unknown, every step shows as not done.
  
  — `stories/done/setup-status-and-alert/1-setup-shows-where-you-stand.md`
- **One read-only answer for the whole app:** `GET /api/setup/status`, for the session's viewer only.
  - Step 1 is done when this instance holds an assistant for the viewer.
  - Steps 2 and 3 read this instance's relay first. Only on a miss do they ask the outside relays configured for
    that kind, and the newest event found counts. Each outside relay gets 8 s.
  - Each step says whether its check **finished**: it found the event, or found none after at least one outside
    relay answered. It is **pending**, which is what the alert counts, only when it finished and is not done, and
    for step 3 when the Map names no other provider. — story 1
- **The Setup Alert:** an amber pill beside every avatar menu, reading "⚠ Finish setting up your account · N steps
  left", with a "Finish setup →" button that opens `/setup`.
  - It shows on both halves of the app, including the landing page, and in the developer pages' bar.
  - It counts only confidently open steps, so it shows nothing while the check runs or after it failed.
  - It hides for visitors and on `/setup` and its step pages. It cannot be dismissed.
  - Narrower screens drop the count (≤ 1023 px), then the sentence (≤ 639 px).
  - While it shows on a phone, the bar gives up room: the Brainstorm wordmark, the control panel's role badge, and
    the brand's word "Tapestry" (ADR 0002 Amendment 1). — `stories/done/setup-status-and-alert/2-the-setup-alert.md`
- **The Setup Alert, polished:**
  - its button is dark text on the amber, at about 7.5:1;
  - it is announced exactly as it reads at each width, with the ⚠ and the arrow decorative;
  - it and `/setup` catch up without a reload after the app publishes the viewer's own follow list (kind 3) or
    Treasure Map (kind 10040). Neither shows the old answer while the re-check runs;
  - it hides on the setup pages whatever the letter case of the address.
  
  — `stories/done/setup-status-and-alert/3-setup-alert-polish.md`

## 2. Epics & stories rolled up

### Epic: `setup-status-and-alert` (Done at this close)
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 setup-shows-where-you-stand | `/setup`'s real per-step status, the status endpoint and the shared provider | Done | `reviews/done/setup-status-and-alert/1-setup-shows-where-you-stand.md`: CHANGES_REQUESTED in round 1 (a re-sign-in as the same account showed the answer from before the sign-out); PASS in round 2 (`082ffb70`) |
| #2 the-setup-alert | The pill on every top bar, counting only confident steps; ADR 0002 Amendment 1's brand rule | Done | `reviews/done/setup-status-and-alert/2-the-setup-alert.md`: PASS (`9cbbe027`), with four non-blocking findings that became story 3 |
| #3 setup-alert-polish | Contrast, the spoken name, the same-tab catch-up, any letter case | Done | `reviews/done/setup-status-and-alert/3-setup-alert-polish.md`: CHANGES_REQUESTED in rounds 1–3 (a publish race, then two tests that could not fail); PASS in round 4 (`6e51ea72`) |

## 3. As-built inventory

Derived from the three PRs' diffs: 56 files across them. The book's code is three server files and fifteen UI files.

- **User-facing.**
  - **`/setup`** (`ui/src/pages/setup/Index.jsx`, `steps.js`): the real status, the done look, the sign-in line.
  - **The pill:** `ui/src/components/SetupAlert.jsx`, mounted before the avatar menu in `BrainstormUserMenu`, the
    landing page's `UserMenu` (`BrainstormSearch.jsx`), the control panel's `Header` (whose brand word is now its
    own span) and `DevPage`'s `.bsp-auth`.
  - **Styles** (`ui/src/styles.css`): the done look, the pill and its breakpoints, the phone-width `:has()`
    rules, and the brand rule (ADR 0002 Amendment 1).
- **Server.** `src/api/setup/status.js`, new. Its route is in `src/api/index.js`, and its contract in
  `src/api/openapi.yaml`. No other route changed.
- **Client plumbing.**
  - `ui/src/context/SetupStatusContext.jsx`, new: one provider in `App.jsx`, and `useSetupStatus()`.
  - `ui/src/utils/setupStatus.js`, new: `summarizeSetup()`.
  - `ui/src/utils/nostrPublish.js`:
    - `onEventPublished(listener)`, new, with one announcement for each publish that reached a relay;
    - an optional `{ announce }` argument on `publishToLocalStrfry` and `publishToRelays`, which only
      `publishEverywhere` sets.
  - Three pages' local imports now go through `publishToLocalStrfry`: `TrustedAssertions.jsx`, `UserDetail.jsx`
    and `BrainstormSettings.jsx`.
- **Domain.** No concepts changed, and no firmware reinstall.
- **Data & contracts.**
  - **Read only:** the viewer's assistant (`getAssistantPubkeyFor`), their newest kind 3, and their newest kind
    10040. Nothing is published, signed or stored by the checks.
  - **One new route:** `GET /api/setup/status`. Signed out, it answers `{ success, signedIn: false }`. Signed in,
    it answers `{ success, signedIn: true, steps: { account, follow, activate } }`, each step with `done`, `pending`,
    `finished`, and where relevant `followCount`, `otherProvider` and `source`.
  - **Load:** one status read per full page load for a signed-in viewer, and one more after each in-app publish of
    their own kind 3 or 10040. There is no polling.
- **Tests.**
  - **Node:** `test/setup-status.test.js` (39 and 1 environmental skip), `setup-alert.test.js` (6) and
    `setup-alert-polish.test.js` (17).
  - **Re-aimed Node tests:** `treasure-map-relay-presence` R2 and `treasure-map-relay-sync` R4.
  - **Browser:** `tests/brainstorm/setup-status.spec.js` (15), `setup-alert.spec.js` (50) and
    `setup-alert-polish.spec.js` (23).
  - **Re-aimed at the second merge:** `assistant-alert.spec.js`'s two Setup-pill locators.

## 4. Deviations from intent

Harvested from the stories' Out of scope and Deviations, the ADRs' Consequences and amendments, and the reviews.
Reconciled against the diff.

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame bullet 1: a signed-out visitor sees the steps and "a prompt to sign in" | The sign-in line sits above the steps, where a signed-in viewer's progress line sits | interpretation | The visitor reads what signing in will show before the steps. ADR 0001 § 4 listed it after them (story 1 § Deviations) | none | — |
| 2 | Frame bullet 2: "never counts a step whose check is still loading or has failed" | "Finished" needs at least one outside relay to answer. A deployment with no outside relay configured for a kind never finishes that check, so the pill never counts it | constraint-discovered | Silence is not evidence (ADR 0001 § Consequences) | On such a deployment the pill stays quiet about that step; `/setup` still shows it not done | §6 #7 |
| 3 | Decision 2: steps 2 and 3 read outside relays on a local miss | A local miss waits for the slowest configured relay, up to 8 s, on each full page load | constraint-discovered | No server memo, per principle 3; measure first (ADR 0001 § Consequences) | A new account sees "not done" on `/setup`, and the pill appears late, for up to 8 s | §6 #9 |
| 4 | Decision 8: narrower screens drop the count; phones show only the button | Count hidden at ≤ 1023 px and sentence at ≤ 639 px. At ≤ 440 px, while the pill shows, the Brainstorm wordmark, the control panel's role badge and the brand's word hide; the control panel's brand truncates rather than wrap | constraint-discovered | The re-measurement found the brand wrapping and the header growing by 16 px (ADR 0002 Amendment 1; the owner chose "Fix now") | The control panel header keeps its 55 px at every width | — |
| 5 | Frame bullet 2: every page outside `/tapestry` and every `/tapestry` page | No pill on pages without a top bar (the site-wide "Page not found", `/legacy/`). On the phone search-results view it hides with the avatar menu. The developer pages' bar grows by about 7 px when it appears | constraint-discovered | ADR 0002 § Consequences and Amendment 1; story 2 § Out of scope | Those viewers see no pill there | — |
| 6 | Decision 9 and story 2 § Copy: "Finish setup →" in white on the amber | Dark text on the amber, about 7.5:1 (story 3) | intentional-change | White was 2.52:1, below WCAG AA (story 2's review, Non-blocking 1). The owner's call: "Dark text on amber" | Readable | — |
| 7 | Story 2 § Copy: the pill's accessible name is "Finish setting up your account" at every width | Announced as it reads at each width. No `aria-label`; the ⚠ and the arrow are decorative (story 3) | intentional-change | The fixed name hid the count, and on phones did not contain the visible "Finish setup" (WCAG 2.5.3; story 2's review, Non-blocking 2). The owner's call: "Whatever is on screen" | Screen-reader users hear the count; voice control matches the words shown | §6 #5 |
| 8 | Story 2 § Out of scope: a step completed elsewhere shows on the next full page load | Story 3 re-checks after any in-app publish of the viewer's own kind 3 or 10040. Publishes from another app or tab still wait for a full load | intentional-change | Story 2's review, Non-blocking 4. The owner's call: "Yes, after any in-app save". `publishEverywhere` announces once, after the local write (ADR 0003 Amendment 1) | A Follow or a Map edit updates the pill and `/setup` within the check's time | §6 #2 |
| 9 | Frame bullet 2: hidden "on `/setup` and its step pages" | Hidden in any letter case (story 3). Story 2 compared case-sensitively | intentional-change | The router matches any case (story 2's review, Non-blocking 3) | none | — |
| 10 | Frame bullet 3: "The checks only read" | Still read-only. Story 3's re-check listens for the viewer's own publishes in this tab, and adds one status read for each | interpretation | ADR 0003 § Consequences, "Load" | none | — |
| 11 | Decision 7 and 8: the pill beside the avatar menu | Book `assistant-management`'s Assistant Alert mounts just after it at all four hosts. It gives way whenever this pill counts a step, and waits while the check runs | constraint-discovered | That book shipped its pill in parallel; the owner approved side by side (ADR assistant-management/0002 Amendment 1; book § Changes from outside this book) | The two never show together. "Never both" rests on `SetupAlert.jsx`'s guard, pinned by that book's W5 and B3 | §6 #5 |
| 12 | ADR 0003 Amendment 1: "internal versions of the two routes that do not announce" | An optional `{ announce }` argument, default `true`, that only `publishEverywhere` sets | intentional-change | Internal functions moved the local-only guard out of `publishToRelays` and broke `global-publish-gate`'s coverage check (story 3 § Deviations) | none | — |
| 13 | ADR 0003 § 2: the import sites keep their behaviour | `publishToLocalStrfry` resolves a network error as `{ success: false }`, so such a failure reaches each site's "not success" branch rather than its `catch` | interpretation | Both branches only log (story 3 § Deviations) | none | — |
| 14 | Frame bullet 5: catches up after the app publishes | The legacy static pages publish a kind 10040 through `/api/publish-signed-kind10040`, as separate documents | constraint-discovered | A full page load follows them anyway (ADR 0003 Amendment 1, corrections) | none | — |

**Undocumented work:** none.
- Every file in the three diffs traces to a story and its ADR, a test plan, a review, a ledger row or an OPEN.md
  note.
- The two test re-aims in story 3 (`treasure-map-relay-presence` R2, `treasure-map-relay-sync` R4) and the
  merge-time re-aim of `assistant-alert.spec.js` are recorded in story 3 § Deviations and its test plan.

## 5. Quality state at close

- **`npm test` at close,** run after the book flip and the epic close-out, over the tree this close leaves behind
  (`+dirty` is this close, uncommitted):
  `20260922T052334Z-39181-0c8b [book-close-setup-status-and-alert] started 2026-09-22T05:23:34.532Z on 4ff93dd4+dirty — FAIL, exit 1, 3764 passed, 11 failed, 60 skipped, 223/223 suites; failed: most-pinned-tag-index-publish, recognizable-published-ta-profile, llms-txt, tl-membership-method-selector, tl-weighted-sum-method, tl-certainty-method, summaries-element-count · tmp/gate-runs/20260922T052334Z-39181-0c8b.json`
  - **This book's suites all pass:** `setup-status` 39/0/1, `setup-alert` 6/0, `setup-alert-polish` 17/0, and
    `assistant-alert` 15/0 with its re-aimed spec. The two re-aimed suites pass too: `treasure-map-relay-presence`
    35/0 and `treasure-map-relay-sync` 22/0. `harness-lint` passes 76/0, so L2 (a Closed book ⇒ its epic Done) holds.
  - **Four failing suites are this host's known set,** the same as at the last full run here
    (`20260921T051946Z-96058-27a5`, the `setup-page-scaffold` close): the three `tl-*` method suites (OPEN.md row
    191) and `summaries-element-count` (row 285).
  - **Three are new since that run.** Each is a live check against the local stack, and none reads a file this book
    changed:
    - `llms-txt` H1–H2: the local server answers 404 for `/llms.txt`, because the container predates that book's
      route (OPEN.md row 27);
    - `recognizable-published-ta-profile` H1–H3: the local server's proposed assistant profile. The container's
      `src/api/assistant/profileDefaults.js` differs from HEAD (row 27); neither that file nor the suite has changed
      since the last full run;
    - `most-pinned-tag-index-publish` AC-8, a pin's deletion reaching the live tag index. Re-run alone it passes
      7/0 (`20260922T062422Z-16316-a9c8`), so it is a timing flake under the full run's load.
- **The book's own gate** (story 3's plan, 105 suites on the merged tree `5a8b9aa4`):
  `20260922T045233Z-72686-b4bb [setup-alert-3-merge]`. It passed: 2167 passed, 0 failed, and the usual 4
  environmental skips.
- **Browser class, on the merged build:**
  - 181 of 181 across the eleven specs this book or the merge touches: story 1's 15, story 2's 50, story 3's 23,
    the Assistant Alert's 10, the Assistant Management page's 23, and six `/assistant` and profile specs (60);
  - story 3's spec repeated 20 times: 460 of 460;
  - story 3's round-4 mutants, five in its test plan and two more in its review, and stale answers from the mock,
    served at once and 300 ms late, each fail the tests they target (test plan § Round 4; review round 4).
- **Staging** (PR #746, deploy run 35688922991, 97 s).
  - **Smoke tiers 1–5:** clean.
  - **The bundle** is `index-BTpsKaQp.js`, byte-identical to the build the tests ran on.
  - **Signed in as a real throwaway guest:** the pill read "· 3 steps left", with dark text on its chip. Chrome's
    accessibility tree named it exactly as it reads at 1280, 800 and 375 px. `/SETUP` and `/Setup/Follow` showed
    no pill. The session was signed out afterwards.
  - Stories 1 and 2 were smoke-tested the same way after PRs #732 and #737.
- **Known open issues:**
  - ledger rows `2026-09-21-failed-strfry-scan-reads-empty` and `2026-09-21-relay-reader-socket-leak` (bugs in
    shared readers the endpoint uses);
  - ledger row `2026-09-22-setup-alert-no-pill-checks-early` (story 2's "no pill" tests);
  - ledger row `2026-09-22-setup-book-test-soft-spots` (five smaller test and comment follow-ups).
- **Debt from the ADRs' Consequences:**
  - one status read per page load and per own publish (§4 #3, #10);
  - a check that never finishes without outside relays (§4 #2);
  - the endpoint's per-relay loop duplicates `fetchEvents.js`'s, to be unified if a third caller appears (ADR
    0001, follow-up c);
  - "never both" depends on this pill's show rule (§4 #11).

## 6. Carry-forward register

- [ ] **1. The three step pages:** their UX and function. They stay placeholders. (intake 2026-09-20, item 3, which
      stays open; stories 1–3 § Out of scope)
- [ ] **2. Catching up on a step completed in another app or tab** before the next full page load. There is no
      polling and no focus re-check. (story 3 § Out of scope; ADR 0001 § Consequences; §4 #8)
- [ ] **3. How someone gets an assistant:** becoming a customer, or an Admin being given a key. Until the
      create-account page does it, a guest's step 1 stays not done. (story 1 § Out of scope)
- [ ] **4. Brainstorm's "Go to your dashboard" button and its `?next=` hand-off.** (story 1 § Out of scope)
- [ ] **5. The two pills now follow different naming rules.** The Setup Alert is announced as it reads (§4 #7).
      The Assistant Alert still names itself with a fixed `aria-label`, deliberately copied from story 2, so its
      count is never announced, and on phones its visible "Manage Assistant →" is not part of its name. (carried
      as `assistant-management` audit §6 #6, noted there 2026-09-22; §4 #11)
- [ ] **6. An accessibility pass beyond the pill.** (story 3 § Out of scope; ledger row
      `2026-09-21-no-accessibility-baseline-without-prd`)
- [ ] **7. Deployments without outside relays** never finish the step 2 and 3 checks, so the pill never counts
      them. Whether that is right for such a deployment is a product question. (§4 #2)
- [ ] **8. Not verified:**
      - screen readers and voice control;
      - Firefox and Safari;
      - a live Follow's same-tab catch-up;
      - the "about 2.5 s live" catch-up for a viewer with no Map;
      - signing out while a publish is in flight.
      
      (story 3's review, rounds 3–4, Non-blocking)
- [ ] **9. The endpoint's cost:**
      - no rate limit: a throwaway session can open up to 11 outbound relay reads per request on a local miss;
      - `getConfigFromFile` runs about six times per request.
      
      Both are bounded, and each is a note, not an ask. (story 1's review, Non-blocking 5–6)
- [ ] **10. Test soft spots:** story 2's "no pill" checks (ledger row `2026-09-22-setup-alert-no-pill-checks-early`),
      and five smaller ones (ledger row `2026-09-22-setup-book-test-soft-spots`).
- [ ] **11. Shared-reader bugs the endpoint leans on:** ledger rows `2026-09-21-failed-strfry-scan-reads-empty` and
      `2026-09-21-relay-reader-socket-leak`, and OPEN.md row 314 (a `querySync` "strict" read is not confident).

**Earlier audits, updated at this close:**
- **`setup-page-scaffold` §6:** #2, #3, #4 and #8 are ticked, and #1 gains a note.
  - #2, what "Create your account" means per visitor: book § Decisions 1 and 5.
  - #3, whether signed-out visitors keep seeing `/setup`: Decision 4.
  - #4, when a follow list or a Map counts as done: Decisions 2 and 3.
  - #8, the done state: story 1's done look.
  - #1 stays open for its third item, the step pages.
- **`assistant-management` §6 #6** gains a note: the Setup Alert no longer names itself with the sentence alone.

## 7. Process findings (harness)

**Measured at retro time** (`bash scripts/harness-stats.sh`, 2026-09-22):
- 239 reviews decided, 237 of them PASS at the end.
- The headline kick-back rate reads 0%, because it counts final verdicts only. This book's four sent-back rounds
  (story 1's round 1 and story 3's rounds 1–3) show only among the 46 reviews with kick-back history (OPEN.md row
  309).
- Re-review churn: 3. Books: 6 open, 63 closed before this one.
- This book opened six `meta` rows, two bug rows and two cleanup rows (one at this close). It extended three
  existing `meta` rows and OPEN.md row 28. Every harness lesson below has a row or a recorded decline.

| Finding | Source | Terminal state |
|---|---|---|
| **A scoped gate's walker triage misses suites.** Five forms, all in this book: a walker of `test/` left out (`gate-result-record`); the branch's own ledger rows, which `session-start` reads; the walkers a merge of the shared line brings; Phase 4 touching `ledger/` after Test Design's triage; suites that read a tree through a script they spawn (`harness-lint`, `rollup-scanners`). Ports to Direction mode: yes | review 1, harness friction (both rounds); story 2, before its staging PR; review 3, harness friction (rounds 1–2) | OPEN.md row `2026-09-21-abbreviated-path-names-no-gate` (extended five times, with a grep recipe) |
| **The `:4173` preview forwards `/api` to the live stack,** so a "hermetic" spec is hermetic only through its catch-all route; Playwright's global setup also reaches the live stack. Ports: yes | review 1, harness friction 2; review 2, harness friction 1 | OPEN.md row `2026-09-21-vite-preview-proxies-live-stack` (extended) |
| **The browser class had no recipe for signing in,** so the provider's sign-in lifecycle went untested until the reviewer drove it (story 1's round-1 blocking bug). Ports: yes | review 1, harness friction 3 | OPEN.md row `2026-09-21-b-class-no-signin-recipe` |
| **On a later review round the Implementer appends Deviations but does not revise the ones the fix made false.** Ports: yes | review 1, round 2, harness friction 1 | OPEN.md row `2026-09-21-deviations-not-revised-on-rework` |
| **A book with no PRD gets no accessibility check from any role,** so a 2.52:1 button passed four phases. Ports: yes | review 2, harness friction 2 | OPEN.md row `2026-09-21-no-accessibility-baseline-without-prd` |
| **The review verdict parser read a sent-back review as passed** because of prose after the verdict. Ports: yes | review 3, round 1, harness friction 2 | OPEN.md row 28 (a recurrence note) |
| **A browser test was called satisfiable after one run.** Three clauses followed: repeat runs and a stale final answer (round 2); a code mutant that keeps showing X for every "never shows X" check, and stale answers served late (round 3); a hide-then-wrong mutant, run with a late answer, for every "no X at the end" check (round 4). Ports: yes | review 3, harness friction (rounds 2–4) | OPEN.md row `2026-09-21-single-run-satisfiability` (extended twice) |
| **An ADR's re-aim list missed tests that pin the old behaviour by value:** an endpoint literal (R2), and a function's exact signature (R4). Ports: yes | story 3, Phase 4 and round 2 (§ Deviations; test plan) | OPEN.md row `2026-09-21-adr-reaim-list-misses-outcome-asserts` (fifth and sixth instances) |
| **A suite left a fake relay socket installed for every later suite in the process,** so an unreachable relay read as "accepted" only inside the gate. Ports: yes | story 3, Phase 4 (test plan § During Implementation) | OPEN.md row `2026-09-21-honest-publish-fake-socket-leaks` |
| **Two books built the same top-bar spot in parallel,** and this book's name change broke the other book's spec at the merge. Whole-suite runs after the merge caught it. Ports: yes | this close's merge (`c892d529`, `5a8b9aa4`) | OPEN.md row `2026-09-22-parallel-books-no-shared-line-recheck` (this book's half added) |
| **Self-written tests and self-written code missed a lifecycle bug** that the independent reviewer found (story 1, round 1). | review 1, Blocking 1 | declined: the harness already delegates review to an independent agent, which is what caught it. The missing mechanism is the sign-in recipe row above |
| **A source sentinel matched a word in a comment** (story 3's D1 flagged "aria-label" in `SetupAlert.jsx`'s header). | story 3 § Deviations | declined: a one-off, fixed by rewording the comment. Story 3's S3 now strips comments before matching |
| **No live Follow was possible on the local stack,** which allows outside publishing. | story 3 § Deviations | declined: the scratch stack (`scripts/scratch-stack.sh`) is the existing path for live publishing tests. The hermetic tests drive the real UI code here |
| **The retro's kick-back rate hides this book's four sent-back rounds.** | `harness-stats.sh` at retro | OPEN.md row 309 (already open; nothing new to add) |
| **Mutant mechanics:** the browser pane runs at most five preview servers, and Playwright re-reads a spec when it respawns a worker, so a spec must not change during a repeat run. | story 3, round 4 (session) | declined: tool mechanics, not process. Kept in the agent's memory note on the test-design oracle |
