# Test Plan: Story 1 — The Assistant Duties tab

**Story:** `engineering-team/stories/assistant-duties-settings/1-the-assistant-duties-tab.md`
**ADR:** `engineering-team/decisions/assistant-duties-settings/0001-the-offered-duties-live-in-the-instance-settings.md`
**Date:** 2026-10-12

## Coverage map

New suites:
- `test/assistant-duties-settings.test.js`: Node, stack-free; classes L, D, R, A, O, T, S.
- `tests/brainstorm/assistant-duties-settings.spec.js`: browser; B0–B11.

The words, routes and defaults they share live in `test/helpers/assistantDutiesFixtures.js`.

| Criterion | Test | File | Level |
|---|---|---|---|
| AC-1 the tab, who may use it | A1 the route table opens the three routes to the owner's side only | `test/assistant-duties-settings.test.js` | unit |
| AC-1 | A2 the routes are registered behind `requireOwner` | same | source sentinel |
| AC-1 | (every table entry, walked for owner, admin and stranger) | `test/admin-action-sweep-access.test.js` | integration (child process) |
| AC-1 "however the request is made" | R6 the generic `PUT /api/settings` runs the same rule: a refusal writes nothing, a good list is stored normalized | `test/assistant-duties-settings.test.js` | integration (child process) |
| AC-1 | T4 the `TABS` entry right after Assistant Profile, rendered; T5 the route child before `*` | same | source sentinel |
| AC-1 | B1 the Owner opens the URL: not redirected, tab selected, after Assistant Profile; B2 an Admin sees it; a customer and a visitor see the refusal, and the route is never asked | `tests/brainstorm/assistant-duties-settings.spec.js` | browser |
| AC-2 the list and its six defaults | D1 `defaults.json` ships the six | `test/assistant-duties-settings.test.js` | unit |
| AC-2 | R1 GET answers the list the offer uses | same | unit |
| AC-2 | B1 the six in order, each with its key, category and This instance's relay; B11 an added key's category | browser spec | browser |
| AC-2 "the Owner's offer unchanged" | U5, L9–L11 | `test/assistant-duty-menu-check.test.js` | unit / integration |
| AC-3 adding; keys normalized; refusals | L2 `dutyKeyOf`; L3 one rule with `readMenuRows`; L4 `isPublicRelayUrl`; L5, L6 `validateDutyList` | `test/assistant-duties-settings.test.js` | unit |
| AC-3 | R2 PUT saves normalized; R3 each refusal answers 400 with its code and writes nothing | same | unit |
| AC-3 | B3 add with This instance's relay and with a typed one; B4 each refusal's words, the list unchanged | browser spec | browser |
| AC-4 remove, relay, reorder, reset, saving | T2 `refusalLine`; T3 `moveDuty`, `addDuty`, `removeDuty`, `setRelay`, none changing its input; T6 the component's routes, confirm, drag and words | `test/assistant-duties-settings.test.js` | unit / source sentinel |
| AC-4 | R4 reset | same | unit |
| AC-4 | B5 remove, down to none (the empty line); B6 keyboard reorder; B7 drag; B8 change relay and cancel; B9 reset asks first; B10 controls disabled while saving | browser spec | browser |
| AC-5 kept on the server | D2: saved, survives a restart, an empty list persists, reset brings the six back | `test/assistant-duties-settings.test.js` | integration (child processes, temp settings file) |
| AC-5 | O2 a hand-edited list is cleaned and logged, a missing list is empty; O4 read at every check | same | unit / source sentinel |
| AC-5 | S1 no list left in the library; L1 no `OFFER_KEYS` | same | source sentinel |
| AC-5 | U11 (re-aimed) the list moves the offer between answers, with no restart | `test/assistant-duty-menu-check.test.js` | integration |
| AC-6 every Duty Menu follows the list | L9 `buildOffer` over a list; O1 inputs with no `scores` and no customer lookup; O3 typed relays and This instance's relay by category, through `resolveOfferInputs` | `test/assistant-duties-settings.test.js` | unit / integration |
| AC-6 | U6, U7, U8 (re-aimed) the same offer for the Owner, an active customer, an Admin and an inactive customer, with no customer lookup | `test/assistant-duty-menu-check.test.js` | integration |
| AC-6 order counts | L8, U23, U24 (re-aimed) | `test/assistant-duty-menu-check.test.js` | unit / integration |
| AC-6 publishing | W14 (new) the press signs the list, in order, with typed relays, sends to the typed relay, and the check reads it back current; E1, E2, W13 re-aimed | `test/assistant-duty-menu-publish.test.js` | integration (real signing) |
| AC-6 Your Assistant's Treasure Map | AD1 a typed 30382 relay is never live; AD2 an added, unbuilt duty is offered and never active; AD3 an Admin's Scores are offered; U21 (re-aimed) | `test/assistant-self-map-check.test.js` | integration |
| AC-6 "offers" | T7 the copy module | `test/assistant-duties-settings.test.js` | unit |
| AC-6 "offers" | P1 (via fixture) | `test/assistant-duty-menu-page.test.js` | unit |
| AC-6 "offers" | B5, B10 (via fixture) | `tests/brainstorm/assistant-duty-menu.spec.js` | browser |
| ADR sub-decision 9 (records) | S2 BIBLE; S3 the earlier two ADRs; S4 `duty-menus.md`'s implementation line | `test/assistant-duties-settings.test.js` | doc sentinel |

## Re-aimed suites

The change makes their old oracle wrong, so each is re-aimed. Each re-aimed test says so in its name.

- **`test/helpers/dutyMenuFixtures.js`.**
  - `DEFAULT_DUTIES` is the six.
  - `expectedOffer({ ownRelay, dlistRelay, duties })` follows ADR sub-decision 3. A `scores` argument is ignored.
  - `PAGE.offerExplainer` and `PAGE.offerEmpty` say "offers".
  - `ANSWERS.DONE`'s published rows are in the offer's order.
- **`test/assistant-duty-menu-check.test.js`.**
  - Harness: a `readAssistantDuties` fake (recorded; `duties` option).
  - `offerDiff` compares in order.
  - Tests: L8 (ordered), L9–L11 (over a list), U6/U7/U8 (no Scores condition, no customer lookup), U11 (the list moves the offer), U23/U24 (order counts).
  - Several other tests now fail only because their oracle gives everyone Scores: U17, U19, U20, U31, U33, U38.
- **`test/assistant-duty-menu-publish.test.js`.**
  - The `inputs` seam gets the six when a test names none. `scores` is dropped from every `inputs`.
  - `lowLevel` injects `readAssistantDuties`.
  - W13's title is re-aimed. W14 is new.
- **`test/assistant-self-map-check.test.js`.**
  - Worlds carry `duties`, injected as `readAssistantDuties`.
  - U21's inactive customer is offered Scores now.
  - AD1–AD3 are new.
- **`test/assistant-duty-menu-page.test.js` and `tests/brainstorm/assistant-duty-menu.spec.js`.** Header notes. B10's title is re-aimed. The words change through the fixture.

## Points the ADR leaves open — fixed here (for the Architect to confirm)

1. **`readDutyList`'s answer.** It answers `{ duties, dropped }`. The ADR names `duties` and "the count dropped".
2. **What counts as This instance's relay.** An entry whose `relay` is absent, `null` or `undefined` is This instance's relay, and the cleaned entry has no `relay` field. Any other value is a typed relay, so `''` is `bad-relay`.
3. **Whole-list refusals.** `validateDutyList` refuses a non-array with `index: null`. It refuses `too-many` with `index: null`.
4. **The routes module.** It exports `createAssistantDutiesHandlers(deps)` → `{ get, put, reset }`.
   - **Success.** `{ success: true, duties }`.
   - **A refusal.** `400 { success: false, code, index }`. A PUT body without `duties` is `bad-list`.
   - **A throwing store.** `500 { success: false }`.
5. **The tab's helpers.** They never change the list they are given. `setRelay(list, i, null)` removes the `relay` field.
6. **Where the tab label lives.** It sits in `TABS` beside the others, and the copy module need not repeat it.
7. **The tab's DOM, for the browser spec.**
   - The duties are one list, one `<li>` per duty, in order.
   - Each row shows its key in a `<code>`, and its drag handle is labelled "Drag to reorder".
   - The relay choice is two radio buttons labelled with the story's words. The typed relay is a text field with the `wss://` placeholder, and the key field is labelled "Treasure Map key".
   - Choosing This instance's relay sends no `relay` (or `null`).
8. **Wording of the dropped-entries log.** It names the count and `assistantDuties`.

## Edge cases

- [x] Empty list: saved, persists, offers nothing, and the tab shows the empty line (L5, D2, R2, L9, B5).
- [x] A missing or non-array list in the settings: an empty offer, never the six (O2, L7, L9).
- [x] A hand-edited `settings.json` with bad entries: they are dropped from the offer and the tab, and logged (R1, O2, L7).
- [x] A duplicate after normalization (`30382:rank` and `30382:rank::`) (L6, R3).
- [x] 200 entries are allowed; 201 are refused (L6, R3).
- [x] A key of exactly 512 characters is allowed; 513 is refused (L2).
- [x] A typed relay in another spelling is stored in its one spelling (L5, R2, O3, W14).
- [x] No public address:
  - an added Concept key falls back to the DList relay;
  - other keys at This instance's relay are left out;
  - a typed relay stays (L8, L9, O3).
- [x] The settings file fails: each route answers 500 (R5).
- [x] Concurrent saves: not tested. The ADR accepts last-write-wins, and the tab re-reads the server's answer after each save (B3).
- [x] Concept Graph API unavailable: not involved; no concept or firmware changes.

## Test infrastructure

- **Node suites.** The built-in runner through `npm test` (`test/registry.js` gains `assistant-duties-settings.test.js`).
  - Read a run's result per [Running and reading the test gate](../../README.md#running-and-reading-the-test-gate).
  - Every Node suite is stack-free.
  - Settings-file tests run in child processes with a temp `TAPESTRY_SETTINGS_PATH`, which is fixed when `src/config/settings.js` loads. Nothing under `/var/lib` is read or written, and no other suite's settings module is disturbed.
  - Every offer-building suite injects `readAssistantDuties`, so a developer's own `settings.json` cannot steer it.
- **Browser spec.** Hermetic: every `/api` route is mocked, and the duties routes behave as the server would. To run it:
  1. Build the UI into `tmp/` (gitignored).
  2. Serve it with `vite preview`, which answers deep links with the app shell.
  3. Set `BRAINSTORM_SERVER_ACCESSIBLE=true` and `BRAINSTORM_BASE_URL`.

  The spec answers `/tapestry/**` with the shell itself, so a plain static server works for it too. The Duty Menu spec needs `vite preview`.
- **Concept Graph API.** Not used; the stack was absent.
- **Firmware state.** None needed.
- **Fixtures.** `test/helpers/assistantDutiesFixtures.js` (new) and `test/helpers/dutyMenuFixtures.js` (re-aimed).

## How to run

```
npm test
# or one suite:
node -e "require('./test/assistant-duties-settings.test.js').run()"
```

For browser/e2e:
```
cd ui && npx vite build --outDir ../tmp/ads-dist --emptyOutDir
cd ui && npx vite preview --outDir ../tmp/ads-dist --port 4176 --strictPort --host 127.0.0.1   # background
BRAINSTORM_SERVER_ACCESSIBLE=true BRAINSTORM_BASE_URL=http://localhost:4176 \
  npx playwright test tests/brainstorm/assistant-duties-settings.spec.js tests/brainstorm/assistant-duty-menu.spec.js --project=chromium
```

## Verification

The new tests fail with the current code, each because the feature is missing, never because of a typo or an import.
Confirmed on 2026-10-12, on the base `d6dcda0b8` plus this phase's test changes.

**The Node suites, one by one.**

```
assistant-duties-settings:   0 passed, 34 failed  (every L, D, R, A, O, T, S test — see "Why each fails")
assistant-duty-menu-check:  51 passed, 14 failed  (L8, L9, L11, U6, U7, U8, U11, U17, U19, U20, U24, U31, U33, U38)
assistant-duty-menu-publish: 33 passed, 3 failed  (E1, W13, W14)
assistant-self-map-check:   60 passed, 4 failed   (U21, AD1, AD2, AD3)
assistant-duty-menu-page:   14 passed, 1 failed   (P1: the two "offers" sentences)
(unchanged: assistant-attention, assistant-outbox-check, assistant-profile-check, assistant-shared-categories,
 assistant-trusted-content all still pass; stack-free-npm-test passes with the new registry line)
```

**The browser specs**, built from the same tree and served by `vite preview`:

```
tests/brainstorm/assistant-duties-settings.spec.js: 12 failed (B0–B11; the URL redirects to /tapestry/settings/relays, no tab, no rows)
tests/brainstorm/assistant-duty-menu.spec.js:      15 passed, 2 failed (B5, B10: the two "offers" sentences)
```

**The full gate** (`npm test`, `GATE_LABEL=assistant-duties-settings-phase3`), from `npm run gate:status`:

```
20261012T220655Z-6009-e15b [assistant-duties-settings-phase3] started 2026-10-12T22:06:55.113Z on d6dcda0b+dirty — FAIL, exit 1,
5807 passed, 56 failed, 582 skipped, 307/307 suites; failed: assistant-duty-menu-check, assistant-duty-menu-page,
assistant-duty-menu-publish, assistant-self-map-check, assistant-duties-settings
```

The 56 failures are exactly the intended ones: 34 + 14 + 3 + 4 + 1. The other 302 suites pass.

**Why each fails.**
- **Library (L).** The rule's functions are missing, and `buildOffer` ignores `duties`.
- **Defaults (D).** `defaults.json` has no `assistantDuties`.
- **Routes (R).** `assistantDutiesApi.js` does not exist. R6: the generic PUT stores a bad list (200).
- **Access (A).** No route-table entries and no registrations.
- **Offer inputs (O).** `resolveOfferInputs` answers `scores`, looks the customer up, and never reads the list.
- **The tab (T).**
  - The tab's module and component don't exist.
  - There is no `TABS` entry and no route child.
  - The Duty Menu copy still says "publishes".
- **Records (S).** `OFFER_KEYS` and the literals remain, and the docs are not updated.
- **Re-aimed suites.** The current code gates Scores by customer status and compares menus order-blind.

## Round 2 (ADR Amendment 1; review round 1)

The review's Blocking 1 and non-blocking 1–3. The owner chose whole kinds (book Decision 8), so the story's AC-3 and
AC-4 are amended.

| Change | Tests | File |
|---|---|---|
| A duty is a whole kind (five digits, trimmed); everything narrower or broader is refused | L2, L3, L5, L6, L7, L8, L9 (re-aimed); **L10** (new): `30382:rank`, `3038x`, `3039x:tag`, `*`, `39999:my-list`, `39998:dlist-header` refused with `bad-key` and dropped by `readDutyList`, never offered | `test/assistant-duties-settings.test.js` |
| The routes and the generic PUT refuse them | R3 (narrower and family keys), R6 (narrower key) | same |
| A hand-edited narrower key is dropped and logged | R1 (GET), O2 (offer) | same |
| The routes log what they drop | **R7** (new): GET and reset log the count; a clean list logs nothing | same |
| `MAX_KEY_LENGTH` is removed | L1 | same |
| An empty typed relay is kept for the server to refuse | T3 (`setRelay(list, i, '')`) | same |
| The offer's own tests use whole kinds | O3 | same |
| Both pages agree on a hand-edited narrower key | **AD4** (new): with `30382:rank` in place of `30382`, the Duty Menu offers no `30382` row and the self-Map's line is not offered, with no false claim | `test/assistant-self-map-check.test.js` |
| The publish over a changed list | W14 (re-aimed: `30395` in place of `3039x:tag`) | `test/assistant-duty-menu-publish.test.js` |
| The relay panel follows its duty | **B12** (new): another row removed and another moved, Save writes that duty's relay only; removing its own duty closes the panel | `tests/brainstorm/assistant-duties-settings.spec.js` |
| An empty Another relay is refused | **B13** (new): the empty relay is sent; the `bad-relay` words show; the list is unchanged | same |
| Whole kinds in the browser | B3 (`30395`), B11 (`30383`) re-aimed | same |

### Fixed here (round 2)

- **R7:** the warning matches `[settings/assistant-duties]`, the count and `assistantDuties`, as Amendment 1 item 5
  words it.
- **B12:** the panel stays open across another row's change; Move up/down and Remove stay usable while it is open.

### Verification (round 2)

Confirmed on 2026-10-12 against `a6d6e3f88`, the round-1 implementation with Amendment 1 accepted. The new and
re-aimed tests fail only where round 2's behaviour is missing.

```
assistant-duties-settings:   25 passed, 11 failed  (L1, L2, L6, L7, L10, R1, R3, R6, R7, O2, T3)
assistant-self-map-check:    64 passed, 1 failed   (AD4)
assistant-duty-menu-check:   65 passed;  assistant-duty-menu-publish: 36 passed (W14 re-aimed, passes);  assistant-duty-menu-page: 15 passed
tests/brainstorm/assistant-duties-settings.spec.js (chromium, vite preview): 12 passed, 2 failed (B12, B13)
```

Why they fail:
- the current code accepts and offers every key readers keep;
- the GET, the reset and the generic PUT keep narrower keys;
- the routes log nothing;
- `setRelay` turns `''` into This instance's relay;
- the relay panel is tied to a row index.
