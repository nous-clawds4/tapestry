# Test Plan: Story 4 — One place: the My Assistant page

**Story:** `engineering-team/stories/assistant-profile/4-my-assistant-page.md`
**ADR:** `engineering-team/decisions/assistant-profile/0004-my-assistant-page-hosts-the-one-editor.md`
**Date:** 2026-09-21

The tests are in two new files, plus re-aims of five existing ones.

- **`test/my-assistant-page.test.js`** — Node runner tests, registered in `test/registry.js` right after
  `one-default-assistant-profile`. All of them are stack-free.
  - **M — one predicate for the menu item and the page.** `mayCreateAssistant`, `hasMyAssistantPage`,
    `personalLinks` and `MY_ASSISTANT_PATH`, called directly. `ui/src/config/avatarMenuLinks.js` has no
    imports, and `ui/package.json` makes it an ES module, so the suite loads it with `import()`.
  - **Q — the status answer**, through its seam (`createAssistantStatusHandler`).
    - Q1: the no-key answer carries `isOwner`.
    - Q4: an array-shaped `customerPubkey`.
    - Q2 and Q3 are guards carried forward from ledger `2026-09-21-status-no-key-relay-gate-unpinned`,
      item 1. They pin who may make the no-key branch's name lookup reach the relays. Q2 checks the flag
      the seam passes. Q3 drives the **real** `getPersonName` through the handler's own default
      dependencies, with `profileState`'s two lookup helpers stubbed.
  - **E — the publish handler**, through its seam: an array-shaped `customerPubkey`.
  - **A — the avatar proxy.** Its "no picture" answer carries `code: 'no-picture'`. The test drives the
    real handler; strfry is absent, so the owner has no picture.
  - **W — the browser code, by source.** CI runs no browser, so this is the part of the B-class that CI
    checks. It is a backstop for the B-tests a source check can reach, not for all of them. At this
    story's review, B1, B11, B12 and B16 had no W counterpart; story 5 added W17–W20 for them (ledger
    `2026-09-21-my-assistant-checks-browser-only`). W15 and W16 are guards carried forward from item 2 of
    ledger `2026-09-21-status-no-key-relay-gate-unpinned` (the counterparts of story 3's B7 and B3).
- **`tests/brainstorm/my-assistant-page.spec.js`** — the Playwright **B** class: what the page, the menus
  and every entry point *do*. It is hermetic, because every `/api` route is mocked.
- **Re-aims.** Each one follows from ADR 0004's decisions.
  - **`test/assistant-setup-state.test.js` D6** (in the ADR's list). It pinned the dashboard's two old
    destinations. It now pins `/assistant` for every role, and that neither old path remains.
  - **`tests/brainstorm/assistant-setup-prompt.spec.js` B3, B4, B5 and B8** (story 1). **These were not
    in the ADR's list; sub-decision 3 requires them.** Each clicks the prompt and asserted
    `/tapestry/settings/assistant` or `/settings`. They now expect the pathname `/assistant`, compared
    exactly, because a regex `/assistant$/` would also match the old address.
  - **Three specs that opened the editor at the old address now open `/assistant`:**
    `ta-composite-avatar.spec.js`, `assistant-publish-result.spec.js` and
    `assistant-default-profile.spec.js`.
    - Their status mocks already carry `isOwner: true`, so the Owner-only generator still shows.
    - The two "owner has no picture" mocks now send `code: 'no-picture'`, which is what they mean.

**One choice for you to approve: reading JSX with the `typescript` parser.**

- W7, W8 and W10 ask structural questions. For example: is "Generate badged avatar" rendered only
  under a `status.isOwner` guard?
- A regex cannot tell JSX text such as "don't" from a JavaScript string, so the suite parses the file
  with `ts.createSourceFile(…, ScriptKind.JSX)`.
- `typescript` has been a root runtime dependency since 2025-04 (the graperank engine), so `npm ci`
  installs it in CI.
- This is a library call inside a test. It adds no lint or typecheck step and no new tooling.
- If the dependency were ever removed, the suite fails with a message that names it.
- The guard check accepts the natural shapes: `g && …`, `g ? … : …`, `if (g) …`, `if (!g) return`, and a
  helper component rendered only under `g`.

## Coverage map

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC1 | `B2: the Owner's page shows their assistant — the instance TA's pubkey, whether its profile is published, its NIP-05, and a link to its public profile at /user/‹TA›` | `tests/brainstorm/my-assistant-page.spec.js` | e2e |
| AC1 | `B3: a Customer's page is about the Customer's own assistant — every status request asks about them, the pubkey shown is their assistant's, never the instance TA's` | spec | e2e |
| AC1 | `B1`–`B3` of `assistant-publish-result.spec.js` — publishing from the page shows each relay's result (re-aimed to `/assistant`) | `tests/brainstorm/assistant-publish-result.spec.js` | e2e (re-aimed) |
| AC1 | `B6: the editor offers exactly the seven editable fields, and shows the NIP-05 read-only` (re-aimed to `/assistant`) | `tests/brainstorm/assistant-default-profile.spec.js` | e2e (re-aimed) |
| AC1 | `W13: the public-profile link goes to /user/‹assistant› — the profile page search results use — not the control panel's`, `W14: the page wears the Brainstorm top bar, decides with the menu's own predicates, shows the viewer's own assistant, and never reads the instance TA` | `test/my-assistant-page.test.js` | source |
| AC2 | `M3: "My Assistant's Profile" leads to the My Assistant page exactly when the page has something for the viewer — from both menus — and otherwise stays disabled with its unchanged explanation`, `M5: the page's address is one exported constant, "/assistant" — and "Assistant Management" leads there too` | node | unit |
| AC2 | `W1: /assistant is a route, and it renders the My Assistant page`, `W7: every avatar menu tells personalLinks who the viewer is` | node | source |
| AC2 | `B4: in the Brainstorm avatar menu — on /about and on the landing page — "My Assistant's Profile" and "Assistant Management" both lead to /assistant, for the Owner, an Admin and a Customer`, `B5: in the Tapestry avatar menu, … both open /assistant` | spec | e2e |
| AC2 | `B6: the dashboard's prompt and its checklist item both lead to /assistant — here for a Customer, whom they used to send to /settings`; story 1's `B3`, `B4`, `B5`, `B8`; `D6: the prompt sends every viewer to the My Assistant page — /assistant for every role; neither old destination remains` | spec / story-1 spec / `test/assistant-setup-state.test.js` | e2e / e2e (re-aimed) / source (re-aimed) |
| AC2 | `B7: the "Edit Assistant profile" banner … leads to /assistant — not to the Owner-only Settings tab`, `W4` | spec / node | e2e / source |
| AC2 | `B8: the Tapestry Settings "Assistant Profile" tab opens /assistant`, `W5` | spec / node | e2e / source |
| AC2 | `B9: the old address /tapestry/settings/assistant lands on /assistant — for the Owner, and for a Customer whom the Settings page would have turned away`, `W2` | spec / node | e2e / source |
| AC2 | `B10: the Brainstorm /settings page has no assistant editor of its own — it links to /assistant`, `W6`, `W3: the profile editor has one host — only the My Assistant page imports AssistantProfileEditor; neither Settings area does` | spec / node | e2e / source |
| AC3 | `M1: an Admin or a Customer may create an assistant here — the roles provision-key accepts, less the Owner, whose assistant is the instance TA; nobody else may`, `M2: the My Assistant page has something for exactly these people …` | node | unit |
| AC3 | `B11: a signed-in guest with no assistant finds "My Assistant's Profile" disabled with its explanation and "Assistant Management" still leading to /assistant — where the page explains, with no editor, no create button and no status request` | spec | e2e |
| AC3 | `B12: an Admin with no assistant reaches /assistant from the avatar menu and creates their assistant there — the page never drops back to its sign-in check, and the dashboard knows about the new assistant without a reload` | spec | e2e |
| AC3 | `W10: with no key, only someone who may create an assistant is offered "Create my Tapestry Assistant key" — and the Owner is told the instance's key is missing`, `W11: after creating the key the editor tells its host …`, `W12: sign-in state can be re-read quietly — AuthContext offers refreshUser, which re-reads the classification and never sets loading` | node | source |
| AC3, AC4 | `B13: an Owner whose Tapestry Assistant key is missing is told so, in the Owner's words, and is not offered a key they cannot create`, `Q1: the no-key answer says whether it is the Owner's assistant …` | spec / node | e2e / unit (status seam) |
| AC4 | `B14: only the Owner is offered the badged-avatar generator — not an Admin, whose assistant would wear the Owner's face, and not a Customer, whom the server refuses`, `W8` | spec / node | e2e / source |
| AC4 | `B15: when the instance refuses the badged-avatar request, the page says what the server said — never "you have no profile picture"`, `B16: when the Owner's picture cannot be fetched, the page says why, in the server's words …`, `B17: an Owner who really has no profile picture is told exactly that, and offered the branded image instead` | spec | e2e |
| AC4 | `W9: when the generator fails, only the proxy's "no-picture" answer reads as "no profile picture" …`, `A1: when the owner has no profile picture, the avatar proxy says so in a machine-readable code — { code: "no-picture" } — beside its words` | node | source / unit (real handler) |
| AC5 | `B1: a visitor who is not signed in is asked to sign in at /assistant, and sees no one's assistant controls — no editor, and no status request` | spec | e2e |
| ADR — carry-forward | `Q2: with no key, the person's-name lookup reaches the relays under ADR 0001's rule …` (guard), `Q3: through the handler's own default dependencies, the real name lookup asks no relay for an anonymous caller or a stranger, and one for the person` (guard) — ledger `2026-09-21-status-no-key-relay-gate-unpinned`, item 1 | node | unit (status seam) / unit (real wiring) |
| ADR — carry-forward | `W15: on an instance that is not public, the editor says no NIP-05 is published, and why` (guard), `W16: "Use this avatar" returns before touching the picture when the upload offers no public url` (guard) — the same row's item 2 | node | source |
| ADR — carry-forward | `Q4: an array-shaped customerPubkey is refused with 400 — not a 500 from the npub encoder — and nothing is looked up`, `E1: … refused with 400 by the publish handler too — whoever is signed in — and nothing is signed or written` — ledger `2026-09-21-assistant-api-review-tidy-ups`, item (a) | node | unit (both seams) |
| Guard | `M4: "My Profile" keeps following each menu's own profile page` | node | unit |
| Prerequisite | `B0: the served origin runs a build that contains the code under test` | spec | prerequisite |

A few B-tests pin fragments of copy that the ADR fixes:

- B11: `/no Tapestry Assistant/i`, from the page's explanation;
- B13: `/key is missing/i`, from the Owner's no-key copy;
- B17: `/no profile picture/i`, the existing copy kept for the genuine case.

## Edge cases

- [x] A guest who kept an assistant from an earlier role: the page is theirs (M2, M3).
- [x] The Owner whose TA key is missing: the menu item stays enabled, and the page explains, in the Owner's
      words, with no create button (M2, Q1, B13).
- [x] Nobody signed in: both predicates are false (M1, M2). The page asks for a sign-in and makes no status
      request (B1).
- [x] A single-element array as `customerPubkey`, on both handlers, whoever is signed in (Q4, E1).
- [x] The old address for a role that the Settings page turns away (B9, a Customer).
- [x] Three answers from the proxy: a 403 refusal (B15), a 404 that is not "no picture" (B16), and the
      genuine "no picture" (B17).
- [x] The no-key name lookup's relay gate: through the seam (Q2) and through the real wiring (Q3).
- [x] After a key is created, the dashboard knows at once without a reload, and the page never falls back to
      "Checking sign-in…" (B12).
- [x] Unmocked routes answer `success: false`, so no test depends on a guessed payload.
- [ ] Rewording the two NIP-05 comments (ledger tidy-up (c)). Comments are not behaviour, so no test pins
      them. The Reviewer checks them.
- [ ] The name memo (ledger tidy-up (b)). It is not in this story (ADR 0004 sub-decision 8).
- [ ] Phone widths. The page reuses `/setup`'s column, and the story defers any visual redesign.
- [ ] The legacy pages. They belong to story 5.
- [ ] The server gates on the avatar endpoints and on `provision-key`. They are unchanged by design (ADR 0004,
      "Known gaps").
- [ ] Live H-class tests. This suite has none. The local stack serves the main checkout.

## Test infrastructure

- **Node runner.** `npm test` runs every suite in `test/registry.js` through the gate engine. This suite
  is one line there. A run's verdict is read with `npm run gate:status`.
- **Hermetic by construction.** There is no `/etc/brainstorm.conf` and no `strfry` on PATH, on this Mac
  and on the CI runner.
  - **A1** loads a fresh copy of `avatar.js` while `getConfigFromFile` is patched to name a fixture owner.
    - It first loads `multer`, `auth.js` and `index.js` with the real config, so nothing else keeps the
      stand-in.
    - Afterwards it restores the config function and puts back whatever `avatar.js` module was already
      cached.
  - **Q3** assigns stubs to `profileState.scanLocalKind0` and `queryRelaysKind0`, and restores them in a
    `finally`.
    - `profileDefaults.js` reads both at call time (`:242-248`).
    - Each case uses a fresh random pubkey, because the name memo is module-level.
- **Browser.** Playwright with chromium. Every `/api` route is mocked, with a catch-all first.
  - B8 mocks `/api/settings`, because the Settings page loads it before it shows its tabs.
  - B12 reaches the dashboard without a reload: `history.pushState` plus a `popstate` event, which React
    Router handles as a navigation.
  - The spec needs an origin that serves the **built** UI under test.
- **Firmware state:** none — no concept changes.
- **Fixtures.** Fixture pubkeys only (`aa…`, `bb…`, `ad…`, `a1…`, `a2…`, `cc…`, `c1…`, `dd…`, `ee…`,
  `e1…`), freshly generated keys for signing, and random pubkeys in Q3. No live keys.

## How to run

```
node test/my-assistant-page.test.js
```

The whole gate is `npm test`, and its verdict is read with `npm run gate:status`. On this machine about 35
suites fail for environmental reasons (the local stack serves the main checkout), so CI's `stack-free` job
is the binding gate.

For the browser class, build the worktree's UI and serve it.

- The main checkout's local, gitignored `.claude/launch.json` has an entry, `ap4-worktree-ui-preview`. It
  runs `vite preview --outDir <worktree>/dist --port 4173` from `ui/`, and `preview_start` starts it.
- Then run the specs:

```
cd ui && npx vite build
BRAINSTORM_SERVER_ACCESSIBLE=true BRAINSTORM_BASE_URL=http://localhost:4173 npx playwright test tests/brainstorm/my-assistant-page.spec.js tests/brainstorm/assistant-setup-prompt.spec.js tests/brainstorm/ta-composite-avatar.spec.js tests/brainstorm/assistant-publish-result.spec.js tests/brainstorm/assistant-default-profile.spec.js --project=chromium
```

## Verification

Confirmed on 2026-09-21 in the worktree. The code under test is `bf4680b9` (the ADR commit); the new and
re-aimed tests are uncommitted on top of it.

**New Node suite:** 5 passed, 22 failed, 0 skipped. Every failure names what is missing, or shows the old
behaviour by value:

```
FAIL  M1, M2   ui/src/config/avatarMenuLinks.js does not export mayCreateAssistant() / hasMyAssistantPage() …
FAIL  M3   /user, the Owner, with the instance TA: expected to "/assistant", got "/user/aaaa…"; … an Admin with none yet: expected to "/assistant", got null; …
FAIL  M5   avatarMenuLinks.js exports MY_ASSISTANT_PATH = '/assistant' … — got undefined
FAIL  Q1   the Owner: the no-key answer must carry isOwner: true … — got undefined
FAIL  Q4   … expected 400, got 500 {"success":false,"error":"hex string expected, got object"}
FAIL  E1   the Owner publishing with customerPubkey [‹hex›]: expected 400, got 500 {"success":false,"error":"hex string expected, got object"}
FAIL  A1   … the "no picture" answer carries code: 'no-picture' … — got {"success":false,"error":"The owner has no profile picture"}
FAIL  W1, W14   ui/src/pages/assistant/Index.jsx does not exist …
FAIL  W2   App.jsx must have { path: 'settings/assistant', element: <Navigate to="/assistant" replace /> } …
FAIL  W3   expected exactly [ui/src/pages/assistant/Index.jsx], got ["ui/src/pages/BrainstormSettings.jsx","ui/src/pages/settings/Index.jsx"]
FAIL  W4   UserDetail.jsx still links to /tapestry/settings/assistant …
FAIL  W5   the tab must carry to: MY_ASSISTANT_PATH — got { key: 'assistant', path: 'assistant', label: '🤖 Assistant Profile' }
FAIL  W6   /settings must offer a link to MY_ASSISTANT_PATH …
FAIL  W7   … missing in the Tapestry menu …: personalLinks({ pubkey: user.pubkey, assistantPubkey: user.assistantPubkey, profileBase: '/tapestry/users', }); …
FAIL  W8   /Generate badged avatar/ is rendered at ui/src/components/AssistantProfileEditor.jsx:343 without a status.isOwner guard
FAIL  W9   generateComposite must tell the proxy's "no-picture" answer apart — it never mentions that code
FAIL  W10  the editor must take a canCreateAssistant prop …
FAIL  W11  provisionKey must call onAssistantCreated after a successful provision …
FAIL  W12  AuthContext.jsx has no refreshUser …
FAIL  W13  the link must be `/user/${status.assistantPubkey}`
PASS  M4, Q2, Q3, W15, W16   (guards)
```

**Re-aimed story 1 suite:** 27 passed, 1 failed. D6: "/tapestry/settings/assistant is no longer a
destination".

**Neighbours, unchanged by the re-aims:**

- story 2's suite: 39 of 39;
- story 3's suite: 52 of 52;
- `stamped-composite-avatar`: 15 of 15;
- `stack-free-npm-test`: 7 of 7 (G5 sees the new suite registered);
- ta-avatar #2's `recognizable-published-ta-profile`: 10 of 13. Its live H1–H3 fail identically on the
  untouched worktree: they hit `:7778`, which serves the main checkout's pre-story-3 code.

**Browser class** against this worktree's own build (`vite preview` on :4173; every `/api` route mocked).

- **New spec: 18 of 18 fail, each for the story's reason.**
  - B0: the bundle lacks `no-picture`.
  - B1–B3, B11 (after its menu half passes), and B13–B17: `/assistant` renders "Page not found".
  - B4: the menu item is `/user/aaaa…`.
  - B5: the item goes to `/tapestry/users/aaaa…`.
  - B6: the checklist item goes to `/settings`.
  - B7 and B8: they go to `/tapestry/settings/assistant`.
  - B9: it stays at the old address.
  - B10: `/settings` still has a "Publish profile" button.
  - B12: the item is disabled (`href` null).
- **Re-aimed specs: 11 passed, 16 failed.**
  - The editor tests fail at "the My Assistant page must show the editor".
  - Story 1's B3, B4, B5 and B8 fail with the old destinations as their values.
  - The dashboard-only tests in those specs pass unchanged.

**The tests can pass, and they judge.** A test that fails today can still be wrong, if it would also fail
against a correct implementation. To rule that out, the tests were run against a throwaway reference
implementation of ADR 0004. It was written in the session scratchpad, outside the repo, and is **not
committed**. The Implementer writes the real one.

- **Node suites:**
  - new suite: 27 of 27;
  - story 1: 28 of 28;
  - story 2: 39 of 39;
  - story 3: 52 of 52;
  - `stamped-composite-avatar`: 15 of 15;
  - `stack-free-npm-test`: 7 of 7.
- **Browser, against the reference build:** 45 of 45. That is the new spec, story 1's re-aimed spec and the
  three re-aimed editor specs.
- **The reference surfaced no inconsistency in ADR 0004.**
- **Mutations.** Each was planted one at a time in the reference, and each was caught by the test written
  for it.

| Planted defect | Caught by |
|---|---|
| the no-key branch asks with `allowRelayLookup: true` (ledger mutant 1) | Q2, Q3 |
| the default `getPersonName` status dependency forces `true` (ledger mutant 2) | Q3 |
| `getPersonName` ignores its flag (ledger mutant 3) | Q3 |
| the no-key answer omits `isOwner` | Q1 |
| status / publish accept an array `customerPubkey` | Q4 / E1 |
| the avatar proxy drops `code: 'no-picture'` | A1 |
| `mayCreateAssistant` admits the Owner | M1 |
| `mayCreateAssistant` admits a guest | M1, M2, M3 |
| `hasMyAssistantPage` needs a key (the old rule) | M2, M3 |
| the menu item keeps pointing at a profile view | M3 |
| the Tapestry menu does not pass `classification` | W7 |
| the generator is offered to every role | W8; B14 (browser) |
| every generator failure reads "no profile picture" | W9; B15, B16 (browser) |
| the create button ignores `canCreateAssistant` | W10 |
| the Owner with no key gets the Customer copy | W10 |
| `provisionKey` does not tell its host | W11 |
| `refreshUser` sets `loading` | W12; B12 (browser: the page drops back to its sign-in check) |
| the page does not pass `refreshUser` | B12 (browser: the dashboard never learns) |
| the public link stays on `/tapestry/users/…` | W13 |
| the Settings page keeps its own `assistant` child (a tie) | W2 |
| the redirect lives inside the Owner-only Settings page | B9 (browser: a Customer stays at the old address) |
| `/settings` keeps its editor | W3 |
| the banner still links to the Settings tab | W4 |
| the page reads the instance TA | W14 |
| the page shows the editor to a guest with no assistant | B11 (browser) |
| the non-public NIP-05 line is removed | W15 |
| `useComposite` no longer returns early without a `url` | W16 |

- **Stability.** A second run of all five specs against the reference gave 45 of 45. The new spec, run
  three times over at 6 workers (`--repeat-each=3`), gave 54 of 54, with no flaky tests.

**Full gate.** `npm run gate:status -- --label ap4-phase3-failing`:

```
20260921T133655Z-95672-65b9 [ap4-phase3-failing] started 2026-09-21T13:36:55.399Z on bf4680b9+dirty — FAIL, exit 1,
3482 passed, 119 failed, 45 skipped, 216/216 suites
```

37 suites failed.

- **Two are this story's own, as intended:**
  - `my-assistant-page`: the 22 above;
  - `assistant-setup-state`: D6 alone.
- **The other 35 are this machine's environmental failures, not side effects of these tests.** Each fails
  only its live tier (H- and L-class tests, "fetch failed", concept-graph reads) against the `:7778` stack,
  which serves the main checkout.
  - All suites are loaded before any runs, and this phase touches only test files.
  - 34 of the 35 run before this suite (it is 209th of 216).
  - The one that runs after it, `author-scoped-inspection-roster`, fails only its live H1–H5. Run on its
    own, it gives the same 10 pass / 5 fail.
  - `recognizable-published-ta-profile`'s H1–H3 fail the same way on the untouched worktree.
