# Review: Story 4 — One place: the My Assistant page

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-21
**Diff:** `git diff aa4df2e3...40fe1fc9` — `57c11491` (ledger carry-forward) → `bf4680b9` (ADR 0004) →
`c0efdd84` (test plan + tests) → `40fe1fc9` (implementation, HEAD)

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — the gate's own record, read with `npm run gate:status -- --label review-assistant-profile-4`:

```
20260921T154159Z-47406-48c4 [review-assistant-profile-4] started 2026-09-21T15:41:59.513Z on 40fe1fc9 — FAIL, exit 1, 3505 passed, 96 failed, 45 skipped, 216/216 suites; failed: profile-tags, profile-tags-publish, tag-detail, tag-detail-publish, tag-detail-write-publish, tag-index-publish, profile-tag-polish, pin-a-tag, tl-publication-from-pins, tl-publication-from-pins-publish, customize-pin-curation-publish, most-pinned-tag-index-publish, deploy-safety-status, event-less-create-set, capture-a-goal-and-see-it, tapestry-per-concept-detail-views, structures-the-brain-can-trust, break-a-goal-into-pieces, attach-the-world, sessions-read-the-brain, the-proposal-loop, teach-it-what-matters, the-brain-survives, return-the-four-on-every-read-surface, show-the-four-on-the-goal-screens-that-already-exist, recognizable-published-ta-profile, brain-first-tapestry-authoring, tl-membership-method-selector, tl-weighted-sum-method, tl-certainty-method, profile-lookup-bounds, not-yet-shared-filter, concept-count-canonical, summaries-element-count, author-scoped-inspection-roster
```

  The record says `dirty: false`, so the run is of clean `40fe1fc9`. **The verdict is FAIL, and none of it
  comes from this story.** I compared its per-suite results with the branch's two earlier runs.

  - **The failing set is exactly the Phase-4 run's 35 suites** (`20260921T150333Z-77244-8914`: `c0efdd84`
    plus the then-uncommitted implementation).
  - It is also the Phase-3 run's 37 (`20260921T133655Z-95672-65b9`), less this story's two. Both now
    pass: `my-assistant-page` went from 5/22/0 to 27/0/0, and `assistant-setup-state` from 27/1/0 to 28/0/0.
  - **34 of the 35 have the same pass/fail/skip counts as in the Phase-4 run.** The 35th,
    `teach-it-what-matters`, fails one more live test: H6, "fetch failed" against `:7778`. The Phase-3 run
    shows the same intermittent H6 "fetch failed" in `structures-the-brain-can-trust`. Neither suite
    reaches anything this diff changes.
  - **They are the live-tier suites this machine fails from a worktree.** `:7778` serves the shared
    checkout: `docker exec tapestry … git rev-parse` gives `a55b9631`. That tree has no
    `ui/src/pages/assistant/`, and its `avatar.js` has no `no-picture`.
  - **`recognizable-published-ta-profile`, 10/3/0.** Its H1–H3 check `:7778`'s status answer. **This
    branch's handler passes them.**
    - I mounted the real `createAssistantStatusHandler` on express at an ephemeral port (a scratch
      script, not committed). Only the key store and the owner lookup were faked.
    - Running the suite's `run()` against it gave 13/0/0 for an unconfigured instance.
    - The same server answered `?customerPubkey[]=‹hex›` with 400, through Express's own query parser.
  - **`author-scoped-inspection-roster`, 10/5/0:** its live H1–H5 call `/api/assistant/roster`, which
    the build `:7778` serves predates.
  - **This story's suites and their neighbours, from the same record:**
    - `my-assistant-page` 27/0/0, `assistant-setup-state` 28/0/0;
    - `one-default-assistant-profile` 52/0/0, `assistant-publish-relays` 39/0/0;
    - `stamped-composite-avatar` 15/0/0, `harness-lint` 76/0/0;
    - `stack-free-npm-test` 6/0/1 (its G2 live sample skips, in all three runs).

  The branch is not pushed, so CI `stack-free` (the binding gate) has not run. Every suite this diff adds
  or re-aims is stack-free.

- [x] **Stack-free suites, run by hand** in a scratch export of `40fe1fc9`, with
      `BRAINSTORM_BASE_URL=http://127.0.0.1:9`.
  - `my-assistant-page` 27/0/0, `one-default-assistant-profile` 52/0/0, `assistant-publish-relays` 39/0/0.
  - `assistant-setup-state` 26/0/2, `stamped-composite-avatar` 13/0/2 and
    `recognizable-published-ta-profile` 8/0/5. The skips are their live H-classes.
  - Both preconditions for a hermetic run hold here: there is no `/etc/brainstorm.conf`, and no `strfry`
    on PATH. Q3 needs neither: with no config, the profile-relay reader falls back to its two defaults, so
    Q3's "the person themselves" case has relays to ask.
- [x] **`npm run test:playwright`** — the five specs, run against this worktree's build. `vite preview
      --outDir <worktree>/dist` serves it on `:4173`. Result: **45/45.**
  - `my-assistant-page` B0–B17 (18), `assistant-setup-prompt` B0–B9 (10), `assistant-default-profile`
    B0–B7 (8), `ta-composite-avatar` B0–B4 (5) and `assistant-publish-result` B0–B3 (4). Every `/api` route
    is mocked.
  - **The bundle is this tree's, and it is current.**
    - The preview process serves `<worktree>/dist`.
    - `dist/index.html` (11:41:19) is newer than every file under `ui/src`, and the tree is clean.
    - `index-C6ihl9RE.js` contains "no-picture", "key is missing" and "Open My Assistant".
  - Regression check: `scheduled-tasks-panel-countdown` opens Tapestry Settings, whose tab bar this diff
    changes. It passes 7/7.
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped_ (the UI bundle the browser class ran against was built from this tree).

## Spec adherence

- [x] **Every acceptance criterion has a passing test.** To check that each test would fail on a
      regression, I planted 29 single-edit mutants in a scratch export of `40fe1fc9`, never in the
      worktree, and ran the six neighbouring Node suites against each. Five survived every Node suite.
      Each of those I built into its own bundle, served on `:4174`, and ran against the new spec. The tables
      follow.

| Criterion | Tests | Where the behaviour lives |
|---|---|---|
| **AC1** — the pubkey, whether the profile is published, the NIP-05 and the public link; edit, publish and each relay's result; the Owner's page is the instance TA's | B2, B3; the re-aimed `assistant-publish-result` B1–B3 and `assistant-default-profile` B6; W13, W14 | The page gives the editor `user.pubkey` (`ui/src/pages/assistant/Index.jsx:50-54`). The editor shows the pubkey and the `/user/‹assistant›` link (`AssistantProfileEditor.jsx:348-358`), the NIP-05 (`:360-370`) and "Currently published" (`:371-376`). The Owner's pubkey resolves to the TA's keys (`src/utils/assistantKeys.js:20-26`) |
| **AC2** — every entry point leads to the page, and neither Settings area edits | B4–B10; story 1's B3, B4, B5 and B8 (re-aimed); D6; M3, M5; W1–W7 | The menus: `avatarMenuLinks.js:74, :118`, with `classification` passed at `Header.jsx:94`, `BrainstormUserMenu.jsx:101` and `BrainstormSearch.jsx:510`. The dashboard: `Dashboard.jsx:744, :780`. The banner: `UserDetail.jsx:104-110`. The tab: `settings/Index.jsx:19, :108`. The old address: `App.jsx:466`. `/settings`: `BrainstormSettings.jsx:475-482`. The editor's only importer is the page (W3) |
| **AC3** — someone who may create one goes menu → page → create; for someone who may not, the item is disabled with its reason and the page explains | M1–M3, B11, B12, B13, W10–W12, Q1 | One pair of predicates (`avatarMenuLinks.js:40-54`) decides both the item (`:74`) and the page (`Index.jsx:36-46`). The create button renders only for `canCreateAssistant` (`AssistantProfileEditor.jsx:294-326`). `refreshUser` (`AuthContext.jsx:163-172`) tells the rest of the app |
| **AC4** — only actions that can succeed; a failure says what happened | B13–B17, W8–W10, A1, Q1 | The generator renders only when `status.isOwner` (`AssistantProfileEditor.jsx:382-433`). The Owner's no-key words come with no button (`:282-293`). The proxy sends `code: 'no-picture'` (`avatar.js:200`), and the editor keys its copy on it (`AssistantProfileEditor.jsx:144-157`) |
| **AC5** — a visitor is asked to sign in and sees no controls | B1 | `Index.jsx:25-35`. The editor is not rendered, so no status request is made |

  **One reading to note (AC3).** An Owner whose TA key is missing finds "My Assistant's Profile" enabled,
  not disabled.
  - ADR 0004 sub-decision 2 chose this on purpose. The page then tells that Owner, in the Owner's words,
    that the key is missing — the case the story's Background names.
  - The test plan lists it as an edge case (M2, B13).
  - I accept that reading.

**Mutants that a Node test caught.** Every failure was in `my-assistant-page`. No other suite failed
or crashed under any mutant.

| Planted defect | Caught by |
|---|---|
| the no-key answer omits `isOwner` / says `true` for everyone | Q1 / Q1 |
| the status / publish handler accepts an array `customerPubkey` (the old check) | Q4 / E1 |
| the no-key branch asks with `allowRelayLookup: true` (the ledger's mutant 1) | Q2, Q3 |
| the default `getPersonName` status dependency forces `true` (the ledger's mutant 2) | Q3 |
| `getPersonName` ignores its flag (the ledger's mutant 3) | Q3 |
| the non-public "NIP-05: none" line is removed (story 3's B7) | W15 |
| `useComposite` writes a missing `url` (story 3's B3) | W16 |
| the proxy drops `code: 'no-picture'` | A1 |
| the menu item is keyed on `assistantPubkey` alone (the old rule) | M3 |
| `mayCreateAssistant` admits the Owner | M1 |
| the landing page's menu does not pass `classification` | W7 |
| the generator is offered whenever `status` exists | W8 |
| the "no picture" copy is keyed on the 404 alone | W9 |
| the create button ignores `canCreateAssistant` | W10 |
| `provisionKey` does not tell its host | W11 |
| `refreshUser` sets `loading` | W12 |
| the public link goes back to `/tapestry/users/…` | W13 |
| Settings' `switchTab` ignores `to` | W5 |
| the flat redirect is removed | W2 |
| the `/settings` card's link is removed | W6 |

**Mutants that no Node test caught.** I built each into its own bundle and ran the new spec against it.

| Planted defect | Caught by (browser, mutant bundle on `:4174`) |
|---|---|
| the page ignores `hasMyAssistantPage` (`Index.jsx:36`) | B11 |
| the page drops its visitor branch (`Index.jsx:25`) | B1 |
| the page passes a no-op as `onAssistantCreated` (`Index.jsx:53`) | B12 |
| `refreshUser` keeps the old `assistantPubkey` (`AuthContext.jsx:167`) | B12 |
| any 404 reads "no profile picture" (`&&` → `\|\|`, `AssistantProfileEditor.jsx:147`) | B16 |
| the page offers creation to everyone (`canCreateAssistant={true}`) | not built: it cannot be reached while the page's own check holds |

  - One more planted edit, an extra early call to the host in `provisionKey`, changed no behaviour. The
    call after success stayed, so I do not count it.
  - The four browser-only catches are non-blocking finding 1.

- [x] **No criterion is silently dropped.**
- [x] **No behaviour was added beyond the story and the ADR.** Each Deviation matches the diff.
  - The `MenuItem` and `AvatarMenuLink` changes are comments only (`Header.jsx:22-27`,
    `AvatarMenuLink.jsx:5-9`). The markup is untouched, so OPEN.md row 216 rightly stays open.
  - The page's CSS block (`styles.css:8624-8651`) repeats `.bs-setup-main`'s rules one for one.
  - `settings-action-btn` has no CSS anywhere in the app: `git grep` over every `*.css` finds 0 hits.
  - With no key and no way to create one, the editor keeps the "Your Tapestry Assistant Profile" heading
    (`AssistantProfileEditor.jsx:294-302`).
- [x] **The copy is the ADR's, word for word:**
  - the page's states (`Index.jsx:24-44`);
  - the Owner's no-key paragraph (`AssistantProfileEditor.jsx:287-289`);
  - the "can't create one here" line (`:299`);
  - the failure message (`:153-154`);
  - the `/settings` card (`BrainstormSettings.jsx:477-481`).

## ADR adherence

- [x] **Sub-decision 1, the page.** `/assistant` has `<TopBar />` inside `.bsp-page` and the `h1` "🤖 My
      Assistant". Its four states come in the ADR's order (`Index.jsx:22-67`). The loading, visitor and
      explanation states make no request; B1 and B11 assert that the status log stays empty.
- [x] **Sub-decision 2, one predicate.**
  - `mayCreateAssistant` is true for `admin` or `customer`. `hasMyAssistantPage` adds anyone with an
    assistant, and the Owner. Both are `false` for `null` and `undefined` (`avatarMenuLinks.js:40-54`;
    M1, M2).
  - The item (`:74`) and the page (`Index.jsx:4, :36, :52`) use the same two functions.
  - The roles match what `provision-key` accepts, less the Owner (`src/api/assistant/index.js:473-488`).
  - They also match `user-classification`, where `customer` means an active customer
    (`src/api/auth/getUserClassification.js:60-68`).
- [x] **Sub-decision 3, every entry point links and nothing else edits.** The links are as in the AC2 row.
  - The redirect is a flat `/tapestry` child beside `manage/audit` (`App.jsx:462-466`).
  - The Settings page's own `assistant` child is gone (`:480-488`). No tie remains: the flat route scores
    35 and the splat 23.
  - `git grep AssistantProfileEditor -- ui/src` finds the component and one importer, the page.
- [x] **Sub-decision 4, only what can succeed.**
  - The generator block renders only when `status.isOwner` (`AssistantProfileEditor.jsx:382-433`). The
    preview, "Use this avatar", the fallback and the notice are all inside it.
  - The no-key branch has the three cases in the ADR's order (`:282-326`).
  - The status handler's no-key answer carries `isOwner` (`src/api/assistant/index.js:392`). It is
    computed before the key lookup (`:364`).
  - Publish and "Reset to defaults" stay for everyone. The publish handler admits the person themselves
    (`:193`).
- [x] **Sub-decision 5, a failure says what happened.**
  - `code: 'no-picture'` is added to the "no picture" 404 only (`avatar.js:196-200`), which sits behind
    the owner gate (`:185`).
  - The editor reads the body defensively and gives its friendly copy only for a 404 that carries that
    code (`AssistantProfileEditor.jsx:145-155`).
  - Every other answer shows the server's `error`, or its status. The branded fallback is still offered.
- [x] **Sub-decision 6.** The link goes to `/user/${status.assistantPubkey}` (`:353-358`), and
      `/user/:pubkey` is a route (`App.jsx:132`). The banner keeps its wording and its `isMyAssistant` gate
      (`UserDetail.jsx:58, :103-110`).
- [x] **Sub-decision 7.**
  - `refreshUser` is the ADR's snippet (`AuthContext.jsx:163-172`). It never touches `loading`, and it is
    in the provider value (`:184`).
  - `provisionKey` awaits `loadStatus()` and then tells the host (`AssistantProfileEditor.jsx:229-230`).
  - The setup hook's effect depends on `user?.assistantPubkey` (`useAssistantSetupState.js:59`), and B12
    proves that the dashboard learns of the new assistant without a reload.
- [x] **Sub-decision 8.** See "Carry-forwards" below.
- [x] **The implementation notes, file by file.** The diff matches each "Changed" section. That includes
      the `App.jsx` comment that names both route changes (`:462-465`), `switchTab`'s `tab.to || tab.path`
      (`settings/Index.jsx:108`), and the header comment of `avatarMenuLinks.js` (`:11-23`).
- [x] **"Unchanged, deliberately" holds.**
  - `git diff --stat` is empty for `profileDefaults.js`, `profileState.js`, `profilePublish.js`,
    `roster.js`, `useAssistantSetupState.js` and `public/`.
  - The provision handler and the avatar gates are unchanged, as are the dashboard's "Use the default
    profile", Express and nginx.
  - The only change to `MenuItem` and `AvatarMenuLink` is the disclosed rewording of their comments.
- [x] **Express and nginx need nothing.**
  - The SPA catch-all serves `/assistant` (`bin/control-panel.js:346-350`).
  - The probe-path blocker lets it through: `isBlockedProbePath('/assistant')` is `false`.
  - `docker/nginx.conf` has no `/assistant` location.
  - Staging and production already answer `GET /assistant` with `200 text/html`, the app shell (a passive
    GET, 2026-09-21).
- [x] **Test-file changes.**
  - D6 and the three editor specs are re-aimed as the ADR lists, and both "no picture" mocks send the
    code.
  - Story 1's spec B3, B4, B5 and B8 were re-aimed too, beyond the ADR's list: they check where the
    prompt leads rather than open the old address. The owner approved this at Test Design.
  - Q8, R1, D3–D5, D7 and `stamped-composite-avatar` S1 and H1 pass, with their files untouched.
  - The new suite is one line in `test/registry.js` (`:242`).
- [x] **Layering.** There is no new endpoint. The role → offer mapping lives in the UI, beside the
      server's enforcement, which is unchanged. That is the trade the ADR names.
- [x] **No new dependencies.** No `package.json` or lockfile changes.
  - The suite parses JSX with the root `typescript` dependency, present since `3fe0f453` (2025-04-12).
  - It is a library call inside one test, approved by the owner at Test Design, and adds no lint or
    typecheck step.
- [x] **Lane discipline.** `c0efdd84` touches only tests, the test plan and the story's links.
      `40fe1fc9` touches no test file.

## Carry-forwards

- [x] **OPEN.md rows 148 and 154, in the branch's first commit (`57c11491`).**
  - Only the two Done cells change: "PR pending" becomes "PR #724, promoted to production by #725".
  - Both references check out. `aa4df2e3` is "Merge pull request #724", and `ef7fc09c` on `origin/main` is
    "Merge pull request #725". Both contain `c31fd815`.
- [x] **Ledger `2026-09-21-status-no-key-relay-gate-unpinned`: both items are done.**
  - **Item 1.** Q2 pins the flag the no-key branch passes. It is `true` for the person, the Owner, an
    Admin and the in-container operator, and `false` for an anonymous caller and a stranger.
  - Q3 drives the real `getPersonName` through `createAssistantStatusHandler`'s own default dependency.
    It stubs `profileState`'s two helpers, which `profileDefaults.js:242-248` reads at call time, and uses
    a fresh pubkey for each case.
  - **Item 2.** W15 and W16 are the CI-run counterparts of story 3's B7 and B3.
  - Against the real code, all three of the row's mutants and both W mutants fail the suite (the first
    mutant table above).
- [x] **Ledger `2026-09-21-assistant-api-review-tidy-ups`: (a) and (c) are done, and (b) remains.**
  - **(a), both halves.** `typeof customerPubkey !== 'string'` joins both checks
    (`src/api/assistant/index.js:185, :358`). Q4 and E1 pin it, and Express's real query parser confirms it.
  - **(c).** Both comments now say that NIP-05 is published on a public instance only
    (`src/api/assistant/index.js:37-41`, `AssistantProfileEditor.jsx:11-14`). That matches the code:
    - `finalizeAssistantProfile` sets `nip05` and the client tag only when public
      (`profileDefaults.js:232-233`);
    - the `nostr.json` mapping is written only when public (`index.js:280-283`).
  - **(b), the name memo:** not folded, as ADR 0004 sub-decision 8 says. `profileDefaults.js` is
    unchanged.
- [x] **The approvals given at Test Design are honoured.**
  - The TypeScript parser is used as a library in `test/my-assistant-page.test.js:91-104` only.
  - Story 1's re-aimed B3, B4, B5 and B8 check that the pathname is exactly `/assistant`.

## Concept-graph integrity

- [x] No concept definition, handle or schema changes; this is navigation and presentation only.
- [x] **Firmware reinstall: not required.**
- [x] I re-checked the ADR's orientation locally, read-only. `:7778`'s TA is `e00ed090…`, its `/summaries`
      lists 9 concepts, and `nostr-user` is not among them. No new code reads concepts.

## Things tests can't catch

- [x] **No secrets.** The tests use fixture pubkeys only and generate a signing key per test. No added
      line holds a TA pubkey literal.
- [x] **No debug leftovers.** No added line in `src/` or `ui/` has a `console.*`, a `debugger` or a TODO.
- [x] **No commented-out code.**
- [x] **Error paths.**
  - A non-JSON error body from the proxy reads "the server answered ‹status›"
    (`AssistantProfileEditor.jsx:145, :153`).
  - A refused provision shows the server's words, and the button is disabled while the request runs
    (`:312-324`). The server refuses a second key with 409.
  - A failed `refreshUser` is swallowed, and the next sign-in check catches up
    (`AuthContext.jsx:169-171`).
  - `provisionKey` reloads the status before it tells the host. `loadStatus` handles its own errors, so a
    failed reload shows Retry.
- [x] **Races.**
  - `refreshUser` updates `user` only when the answer is about the same person
    (`data.pubkey === prev.pubkey`). A sign-out, or a sign-in as someone else, during the fetch is not
    overwritten.
  - The editor stays mounted through the refresh: `user.pubkey` does not change, and `hasMyAssistantPage`
    stays true. B12 watches for "Checking sign-in…".
- [x] **Security: nothing new tells an anonymous caller whether a pubkey is an admin or a customer.**
  - The one new field on the status answer is `isOwner`, on the no-key branch. It compares the queried
    pubkey with the owner's, which `/api/owner/pubkey` already gives to anyone
    (`src/api/owner/index.js:12-18`). Before this diff, an anonymous caller could already see
    `hasRelayKey: false` for the owner's pubkey.
  - `code: 'no-picture'` sits behind the owner gate (`avatar.js:185`).
  - The array guard narrows what reaches either handler.
  - The page makes no request for a visitor or for a guest with no assistant (B1, B11). It never reads
    `taPubkey` (W14), and it asks only about `user.pubkey` (B2, B3).
  - Option C's membership oracle was rejected at Architecture, and nothing like it appears in the diff.
  - One exposure next door predates this story: non-blocking finding 2.
- [x] **Principle 1.** The page manages the viewer's own assistant. B3 asserts that every status request
      asks about the Customer, never the TA. Principles 2–4: no write gate is added, nothing is
      denormalized, and nothing local is destroyed.
- [x] **Scope.** Nothing was added beyond the disclosed Deviations.

## House rules check

- [x] Concept Graph API authority respected (no concept work in this diff).
- [x] No lint/typecheck/build tooling added. The `typescript` use above is a library call in a test,
      approved at Test Design.
- [x] **No per-deployment TA pubkey is hardcoded.** The page never reads the TA. The server resolves the
      Owner's assistant from the owner's pubkey.

## Product-guide adherence *(when the story traces to a PRD)*

- [x] N/A — the book is an acceptance frame, not a PRD.

## Findings

### Blocking

None.

### Non-blocking

1. **`tests/brainstorm/my-assistant-page.spec.js` B1, B11, B12 and B16 have no CI-run counterpart.** So
   the test plan's line 24, "the CI-enforced backstop for the B-class", overstates the W-class again. This
   comes one story after W15 and W16 closed the same gap for story 3.
   - Each of these single edits passes every Node suite and is caught only by the browser class, which
     CI does not run:
     - the page ignores `hasMyAssistantPage` (`ui/src/pages/assistant/Index.jsx:36`) — B11. The editor's
       defence-in-depth line still explains, so the harm to a user is small;
     - the page drops its visitor branch (`:25`) — B1. A visitor would read "Your account has no Tapestry
       Assistant…" and get no sign-in button on the page (AC5);
     - the page passes a no-op as `onAssistantCreated` (`:53`), or `refreshUser` keeps the old
       `assistantPubkey` (`ui/src/context/AuthContext.jsx:167`) — B12;
     - `&&` becomes `||` in the "no picture" condition (`ui/src/components/AssistantProfileEditor.jsx:147`)
       — B16. Every 404 would then read "you have no profile picture" (AC4).
   - The W-cases stop short:
     - W14 asserts that the page imports `hasMyAssistantPage`, not that the page's check uses it;
     - W9 accepts the `||` form;
     - W11 and W12 do not look at the page's wiring, or at what `refreshUser` sets.
   - I ran the browser class against a mutant bundle for each, so this does not block.
   - **Ask (Tester's lane), in story 5 or as a ledger row:**
     - add W-cases for the four, using the suite's existing JSX helpers: the editor rendered only after
       the `!user` branch and under `hasMyAssistantPage(user)`; `onAssistantCreated={refreshUser}`;
       `refreshUser` setting `assistantPubkey` from `data`; and the "no profile picture" copy guarded by
       `body.code === 'no-picture'`;
     - reword the test plan's line 24.
2. **Pre-existing, not introduced here: `GET /api/assistant/status` tells anyone which pubkeys hold an
   assistant key on this instance.**
   - The keyed branch gives any caller, signed in or not, `hasRelayKey: true` and the `assistantPubkey`
     (`src/api/assistant/index.js:400-431`).
   - Customers are public anyway (`/api/get-customers`, per ADR author-scoped-inspection/0001). A pubkey
     that holds a key but is not on that list is an admin, or a guest who kept a key. The admin roster is
     otherwise owner-only (`/api/admin/list`).
   - This diff neither creates nor widens the exposure. ADR 0004 honours its own constraint: the status
     answer "must not start saying" who is an admin or a customer, and it doesn't.
   - It is not on the ledger. **Ask:** file a ledger row for a decision, for example: answer the keyed
     fields only to the callers that `allowRelayFallback` admits.
3. **`ui/src/styles.css:802-805` gives a stale example.** The comment still names "My Assistant's Profile
   with no provisioned assistant key" as the disabled case. Since this story, an Admin or a Customer with
   no key finds that item enabled. Deviation 1 updated the two component comments; this third one was
   missed. Optional: "…with no assistant and no way to create one here".
4. **ADR 0004 says of the two "who may create" rules that "each one's comment names the other" (§ What
   we trade away).**
   - `mayCreateAssistant`'s comment names `provision-key` (`ui/src/config/avatarMenuLinks.js:32-37`).
   - The provision handler's comment (`src/api/assistant/index.js:453-464`) does not name
     `mayCreateAssistant`, and the ADR's own "Unchanged, deliberately" list keeps that handler as it is.
   - Optional: add one comment line there, or drop the claim from the ADR.

### Harness friction

1. **Setting `STRFRY_DOMAIN` in the environment does not choose an instance shape for a hermetic run.**
   - `getConfigFromFile` reads only `/etc/brainstorm.conf` (`src/utils/config.js:16-66`). With no file,
     `describeInstance()` reports an unconfigured instance, whatever the environment says.
   - I tried it. With `STRFRY_DOMAIN=staging.brainstorm.world`, and again with
     `STRFRY_DOMAIN=192.168.1.50:7777`, the real handler still answered `isPublicInstance: false`.
   - Story 3's review reports the real handler passing for three instance shapes, one of them
     "`STRFRY_DOMAIN=staging.brainstorm.world` (public)", with "only the key store and the owner lookup"
     faked. If the variable was set this way, that review's public and LAN runs repeated the unconfigured
     one.
   - Nothing is left uncovered: story 3's stack-free suite pins the public and LAN shapes (52/0/0 here).
     The trap is in the verification step.
   - Candidate meta row: document a hermetic way to pick an instance shape, such as injecting
     `getConfigFromFile` or `describeInstance` through the seam.

## Verdict

**PASS**

- Every acceptance criterion has a test that passes, and each one catches a planted defect: a Node test
  catches most of them, and the browser class catches four page-level behaviours.
- The diff follows ADR 0004 sub-decision by sub-decision. It adds no dependency and no endpoint, and it
  tells anonymous callers nothing new.
- The carry-forwards are honoured:
  - rows 148 and 154 cite #724 and #725;
  - both items of the `…-status-no-key-relay-gate-unpinned` row are done, and hold against the real code;
  - tidy-ups (a) and (c) are done, and (b) stays open as the ADR says.
- The `npm test` record's FAIL comes from the 35 environmental live-tier suites and nothing from this
  story.
- The four findings are non-blocking.

## On PASS (same commit)
- [ ] Story `**Status:**` flipped to `Done` in place — applied by the orchestrating session in the review
      commit, with the story's Review link.
- [x] Completion detection performed; the result and any book arithmetic recorded in the run journal (Direction) or the chat (human-gated) — never in this file. `/close-book` offered if the book looks complete.
