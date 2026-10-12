# Test Plan: Story 1 — The self-Map page and its check

**Story:** `engineering-team/stories/assistant-self-map/1-the-self-map-page-and-its-check.md` (§ Copy and § Deviations as
amended at Architecture)
**ADR:** `engineering-team/decisions/assistant-self-map/0001-a-self-map-check-from-what-has-landed.md` (accepted
2026-10-12; open questions 1–4 answered as recommended)
**Spec followed (read-only):** `protocols/drafts/treasure-maps.md` §§ 5.1–5.2, 6, 8, 9, 9.2; `duty-menus.md` § 6.2 step 1
**Date:** 2026-10-12 (approved by the owner at the Test Design gate, the same day)

## Coverage map

There are two new Node suites, both registered in `test/registry.js` after `assistant-duty-menu-publish.test.js`:
- `test/assistant-self-map-check.test.js` covers the library (L), the server check through the real handler (U), the
  hub's readings (C) and sentinels (S).
- `test/assistant-self-map-page.test.js` covers the page's copy module (P) and JSX sentinels (D).

The new browser spec is `tests/brainstorm/assistant-self-map.spec.js` (B). The shared words, constants, staging's Owner
Map and the canned answers are in `test/helpers/selfMapFixtures.js` (new).

**How U works.** The real `attention.js` handler runs with the real `selfMap.js` over a fake world. The world is:
- this instance's strfry, and outside relays, each honouring `kinds`, `authors`, `#d` and `limit`, newest first;
- config, Relay Settings and the customer store;
- the schedule entries, the scheduler kill switch, the systemd timer and the clock.

Every dependency is one of those ADR 0001 § Implementation notes 2 names. The other checks are stubbed. The config is
Docker's real one: `BRAINSTORM_RELAY_URL=ws://localhost:7777`, `STRFRY_DOMAIN=staging.brainstorm.world`, so this
instance's relay is `wss://staging.brainstorm.world/relay` (ledger `2026-10-12-test-configs-not-from-deployments`). U33
adds bare metal's public `BRAINSTORM_RELAY_URL`.

| Criterion | Tests | File | Level |
|---|---|---|---|
| **AC-1** the viewer's own Assistant, only theirs | U1 a visitor gets `{ signedIn: false }`, nothing checked · U2 no Assistant: `actions: {}`, no scan · U3 the action has exactly the ADR's ten fields; every line exactly its seven; statuses, reasons and categories from the ADR's lists · U4 one `checkSelfMap({ viewer, assistantPubkey })` from the session whatever query, params or body say; the viewer's Map and the Assistant's 10040 are read, the stranger the request names never is · S1 `selfMap.js` never reads the request | check | unit (DI) · source |
| **AC-2** the duties, and which are live | U5 staging's Owner Map verbatim, with Scores live: one item per key naming the TA in Map order (`39998`, `3038x`, `39999`); `3038x`'s `30382` line offered at the public relay; one not-offered line for its other kinds; `30382:rank` and `30382:followers` given elsewhere; `39999` not-published-here · U6 no Score schedule: `not-scheduled` · U7 the brief gap: with a 12 h schedule, 23 h is live and 25 h is `upkeep-stopped` with `lastLandedAt` · U8 never landed: `not-landed` · U9 the shortest interval wins · U10 each Owner Score task counts; a disabled entry, `TASK_QUEUE_ENABLED=false`, the kill switch, List and sync tasks, and a customer task for the Owner don't · U11 the systemd timer at `BRAINSTORM_PROCESS_ALL_TASKS_INTERVAL` (`12hours`, `6h`, `1d`, `1days`, unparseable as 12 h); no timer means `not-scheduled`; `TASK_QUEUE_ENABLED=false` doesn't stop the timer · U12 a cron entry's interval · U15 an Alternate has the duty too · U17 Lists: `older-form` for the TA even when published and refreshed; `not-published-here` for a customer · U18 Concepts: `nothing-to-publish`, and `not-landed` for a missing `39998:<d>` · U20 unchecked keys · U21 a customer's Scores under each of their schedule tasks; another customer's entry or the Owner's export doesn't count; an inactive customer's Scores are not offered · U22 the DList-relay case (no public address) · U32 with the real Duty Menu check beside it, every offered or active line and every should-say entry carries the offer's relay for its kind (Owner and customer) | check | unit (DI) |
| **AC-3** what the self-Map should say | U5 `["30382", R]` and `["39998", R]` (ADR sub-decision 2's worked example) · U6 `39998` only · U13 the metric trap: `30382` plus `30382:verifiedFollowersCount` gives eleven `30382:<metric>` entries and no `30382` · U14 the template Map is claimed verbatim, entry for entry · U16 a bare `*` gives its meets, never itself · U18 `39998:<d>` is claimed verbatim when its header is here · U19 **the Concept reading, pinned once** (sub-decision 4): a bare `39998` that would win `39999:foo` isn't claimed; `39998` beside `39999` gives `39998` only; `39999` sorts before `39998` · U20 a `tag` key blocks a bare `30382` · U22 `39998` at the DList relay; that relay down leaves the check unfinished, never "not live" · U23 no Map, or a Map naming only other keys: nothing to claim · U33 bare metal's public relay · L3 § 6 order through `compareKeys` | check | unit (DI) |
| **AC-4** which self-Map is found | U24 local first: the newest local version counts, and no outside read of the self-Map · U25 one outside round: the Map's relays for entries naming the Assistant, and its 10002 write relays, each guarded. Never another Assistant's hint, a read-only relay, a refused host or this instance's own relay. The newest answer counts, a tie to the lowest id · U26 the found self-entries normalized; the other entries counted, not compared · U27 "finished": a failing self-Map scan with no outside answer is `no-relay-answered`; with one answer it finishes; every local scan failing is `instance-unanswered` · U28 at most 50 event-named relays · L4 `readSelfEntries` | check | unit (DI, pure) |
| **AC-5** true, the mark, the count line | U29 the same entries in another order and spelling are current; done; lines active at the offer's relay · U30 a claim on Scores that aren't live: out of date, pending, a false claim on the `30382` line, `39998` still active; another relay, a missing or an extra entry is out of date · U23 both empty is done · U31 a throwing check gives the exact `check-failed` answer, and the others still answer · L5 `sameSelfEntries` · C1 the card's words; its criteria line; no planning notes · C2 `treasure-map` in `CHECKED_ACTIONS` right after `duty-menu`; not Coming soon · C3 the two readings (done, pending, unfinished, check-failed, missing, not answered) · C4 `attentionCountText(0)` is **Nothing needs attention**; 1 and 3 unchanged; every action done reaches zero · B1 hub card · B2 the count line at zero, the pill gone; one pending reads "1 action needs attention" | check, browser | unit · browser |
| **AC-6** the page | P1 every § Copy sentence (the three added reasons included), Checking…, the status words and category names, in the copy module · P2 `statusLine` for up to date (also with nothing to claim), not published (also an empty published Map) and out of date · P3 no status line when unfinished, check-failed or unanswered · P4 `reasonLine` for every reason, word for word; `upkeep-stopped` with a date, never raw seconds; none for an active line · D1 the route · D2 one shared answer, its own entry, words and helpers from the copy module · D3 the hub's frame and states · D5 no sentence retyped in the JSX · D6 the links through their path constants · B3 signed out · B4 no Assistant · B5 up to date, the Owner: each line, both panels, Done, the status line, both links, the Owner's line with its count, the public line, the back link · B6 not published · B7 out of date with a false claim · B8 upkeep stopped with a date · B9 a customer with nothing to claim · B10 no duties, with the link · B11 unfinished, instance-unanswered, Checking…, the request failed | page, browser | unit (ESM) · source · browser |
| **AC-7** read-only, one request | S1 no signing, publishing, strfry import or file writes in the check or the library · S2 `attention.js` wiring (`Promise.allSettled`, `TREASURE_MAP`, `SELF_MAP_CHECK_FAILED`, header) · S6 no new route; the attention route stays `PUBLIC_READ` · D4 the page never fetches, refreshes, polls, stores, signs or publishes, and has only the sign-in button · B12 one GET of the answer per load, nothing but GETs, no button | check, page, browser | source · browser |
| **ADR sub-decisions 6 and § Implementation notes** | L1 the library's exports, CommonJS, no I/O · L2 `PUBLISHED_SCORE_METRICS` equals both publishers' eleven metric tags (read from their source) · S3 `schedulerSwitch.js` (pure `fs`); `scheduler.js` requires it and still exports `schedulerEnabled` (deploy-safety reads it) · S4 `cron-parser` `4.9.0` exact in `package.json` and the lockfile's root · S5 `src/api/openapi.yaml` and BIBLE §11 | check | source |

## Edge cases

- [x] Rank and followers carved out to another key: not the TA's duties, so a `30382` self-entry may win them (U5).
- [x] The Owner's Map's `client` tag, and an entry whose element 2 isn't a key (L4, U26).
- [x] `39998:dlist-header`, a trailing empty segment, an upper-case author, and a relay in another case with a trailing
      slash (L4, U26, U29).
- [x] `39998:` and `39999:` self-entries are ignored (L4, U26).
- [x] The interval boundary is tested away from the exact edge (23 h / 25 h, 11 h / 13 h), since "about two" is the
      owner's words.
- [x] A NIP-01 `created_at` tie: the lowest id wins (U25).
- [x] This instance's own relay named inside events, by its Docker address (`ws://localhost:7777`) or its public one:
      never read as outside (U25).
- [x] 75 event-named relays: at most 50 read (U28).
- [x] The DList relay down: unfinished, not "not live" (U22).
- [x] A check that throws: the exact `check-failed` answer, and 200 (U31).

## Points the ADR leaves open, pinned here

The Architect proposed these as ADR 0001 Amendment 1 (2026-10-12), and the owner approved them at this phase's gate.

| # | Point | Pinned as | By |
|---|---|---|---|
| 1 | `lastLandedAt`'s unit | the newest event's `created_at`, in seconds | U7 |
| 2 | `readSelfEntries`' return | `{ selfEntries: [{ key, relay }], otherEntries }` | L4 |
| 3 | `compareKeys`' direction | sorting with it puts the more specific key first (sub-decision 2 sorts "most specific first") | L3, U19 |
| 4 | Which kinds get a line | only the offered kinds where the viewer's key still wins some insight. `39998`'s item has no `39999` line when the Map's own `39999` entry wins that kind. | U5 |
| 5 | Lines' relays | offered and active lines carry the offer's relay; not-offered and elsewhere lines carry `null` | U5, U29, U32 |
| 6 | `SELF_MAP_CHECK_FAILED`'s fields | the ten answer fields: unfinished, `check-failed`, `mapFound: false`, `duties: []`, `shouldSay: []`, `published: null`, `current: null`, `instanceMap: false` | U31 |
| 7 | The copy module's helpers | `statusLine(answer)` and `reasonLine(line)`, as `dutyMenuCopy.js` has `statusLine` ("built as DutyMenu.jsx is") | P2–P4, D2 |
| 8 | Which could-not-check line each reason shows | `no-relay-answered` → "No relay answered, …"; `instance-unanswered`, `check-failed` and a failed request → "Could not check: this instance did not answer." | B11 |
| 9 | The not-offered line's key | not pinned: the check suite never reads it, and the browser spec shows whatever the answer gives | — |

## Re-aimed suites

Each re-aim keeps its test meaningful, says so in its name or a comment ("re-aimed by assistant-self-map #1"), and was
found empirically, not by guess. A throwaway prototype of the UI half was put in a scratch worktree:
- the card checked, with its criteria line and no planning notes;
- the zero count line;
- a stub page route;
- the attention wiring.

The whole stack-free gate and the hub's browser specs ran there, and every existing failure is listed below. The
prototype was never committed.

**Stubs, so each suite's reads stay its own.** The Node suites that drive `GET /api/assistant/attention` now stub
`checkSelfMap` beside `checkDutyMenu`:
- `assistant-attention`;
- `assistant-outbox-check`;
- `assistant-profile-check`;
- `assistant-shared-categories`;
- `assistant-trusted-content`;
- `assistant-duty-menu-check`.

**Fixtures.**
- `dutyCardsFixtures.js`:
  - the Treasure Map card's criteria line and null planning notes (from `selfMapFixtures`);
  - `CHECKED` gains `treasure-map` after `duty-menu`;
  - `PLACEHOLDER_KEYS` is empty.
- `assistantManagementFixtures.js`: `countText(0)` is "Nothing needs attention".
- `comingSoonFixtures.js`: `STILL_PLACEHOLDER` is renamed `LEFT_ALONE`.
- `dutyMenuFixtures.js`: `STILL_PLACEHOLDER` is retired.

**Node tests (15 that fail today, all passing against the prototype):**

| Suite | Test | Was | Now |
|---|---|---|---|
| `assistant-management-page` | D4 | the card has no criteria, and the placeholder's notes | the story's criteria line, no notes (through the fixture) |
| | D6 | `0 actions need attention` | `Nothing needs attention` at zero |
| `assistant-coming-soon` | C1 | the left-alone card has no check | it is checked |
| | C3 | every check done: 1 and 1; failed: pill 1 | 0 and 0; failed: pill 0 |
| | C5 | the card is always marked and counted | it reads as a checked action |
| `assistant-duty-cards` | C3 | the placeholder page has no criteria | the built card's criteria, no notes, no placeholder |
| | C4, C5, C7 | the placeholder lists and counts | through the fixture (names updated) |
| | C6 | an answer about the card changes nothing | done → Done, pending → counted |
| | W1 | no built page | both cards have built pages |
| | S1 | the server does not answer `treasure-map` | it answers both cards |
| `assistant-duty-menu-check` | C2 | `treasure-map` is not checked | it follows `duty-menu` |
| | C4 | always marked, never Done | read by its own answer |
| | C5 | — | passes through the fixture |

Also changed, and passing both today and against the prototype:
- `assistant-duty-menu-page` D1: the Treasure Map clause moved to the new page suite.
- `assistant-identification-tags-page` S3: the built-pages list gains `treasure-map`.

**Browser specs (Chromium; 130 pass against the prototype build).**
- **`SM.withSelfMap` (a pending answer) added**, keeping their counts:
  - `assistant-alert`;
  - `assistant-management-page`;
  - `assistant-attention`;
  - `assistant-profile-check`.
- **The Treasure Map card given a pending answer:**
  - in `answerWith`: `assistant-trusted-content`, `assistant-shared-categories`, `assistant-duty-menu` (B2's count of
    always-counted cards stays 1);
  - in `ALL_DONE`: `assistant-coming-soon`.
- **Re-aimed, failing against today's build:**
  - `assistant-attention` B4 (the fetch fails: no pill, nothing left to count);
  - `assistant-coming-soon` CS2 (8 marked, no pill);
  - `assistant-coming-soon` CS7 (the Treasure Map page is built: neither line).
- **`assistant-management-page` B8** skips the Treasure Map page, as it skips the other built pages.

## Test infrastructure

- **Runners.** Node's own runner (`npm test` → `test/test.js`, suites in `test/registry.js`) and Playwright
  (`tests/brainstorm/`). Read a run's result with `npm run gate:status`.
- **Concept Graph API.** Not used: no concept changes, and the stack is absent here.
- **Firmware.** Nothing required.
- **Fixtures.** `test/helpers/selfMapFixtures.js`. It holds:
  - staging's Owner Map, verbatim in shape, with fixture keys standing in for live ones (CLAUDE.md: never a TA
    literal);
  - Docker's config;
  - the eleven published metrics;
  - the schedule-entry shape;
  - the copy;
  - canned answers, and `withSelfMap` for hub specs.
- **Browser spec.** It needs `BRAINSTORM_BASE_URL` to serve the **built** UI, and
  `BRAINSTORM_SERVER_ACCESSIBLE=true`. With no Docker daemon here, it runs against `vite preview` of `ui/dist`, with
  Chromium at `/opt/pw-browsers`. Every `/api` route is mocked.

## How to run

```
npm test                                              # the stack-free gate; then: npm run gate:status
node -e "require('./test/assistant-self-map-check.test.js').run()"
node -e "require('./test/assistant-self-map-page.test.js').run()"
(cd ui && npm run build && npx vite preview --port 4173 &)
BRAINSTORM_BASE_URL=http://localhost:4173 BRAINSTORM_SERVER_ACCESSIBLE=true npx playwright test tests/brainstorm/assistant-self-map.spec.js
```

## Verification

**On today's code**, 2026-10-12, at `388394f8` plus this phase's test changes, the stack-free gate gives:

```
20261012T153858Z-8660-4f0e [self-map-phase3] — FAIL, exit 1, 5739 passed, 72 failed, 582 skipped, 306/306 suites;
failed: assistant-management-page, assistant-coming-soon, assistant-duty-cards, assistant-duty-menu-check,
assistant-self-map-check, assistant-self-map-page
```

The 72 failures are exactly the expected ones:
- the 47 new check tests. Every L, U, S1–S5 and C test fails because `src/lib/self-map`, `src/api/assistant/selfMap.js`
  or the wiring doesn't exist, or the card is still a placeholder. S6 (no new route) passes, as a guard should;
- the 10 new page tests. The copy module and the page don't exist;
- the 15 re-aimed placeholder pins (§ Re-aimed suites).

No other suite changed state.

**Against the prototype** (scratch worktree, never committed), the same gate gives:

```
20261012T150721Z-10723-1c57 [self-map-proto] — FAIL, exit 1, 5742 passed, 69 failed, 582 skipped, 306/306 suites
```

Before the re-aims, the failures were the new suites plus the 17 tests listed above. After them, all eleven touched
existing suites pass against the prototype, among them:
- `assistant-management-page` 23/23, `assistant-coming-soon` 12/12, `assistant-duty-cards` 12/12;
- `assistant-duty-menu-check` 65/65, `assistant-duty-menu-page` 15/15, `assistant-identification-tags-page` 16/16;
- and the five stubbed attention suites.

**The browser specs**, Chromium, `vite preview` of a build:
- **Today's build:** `assistant-self-map.spec.js` B0–B12 fail. B0 fails because the bundle lacks the page; B1–B12
  because the page or the check isn't there. B12 also needs the duties panel drawn first, so a read-only check can't
  pass on a placeholder. The re-aimed `assistant-attention` B4 and `assistant-coming-soon` CS2 and CS7 fail. The other
  hub specs pass: 79 passed, 5 skipped.
- **The prototype's build:** the hub-level specs pass, 130 of 130. The prototype's stub page doesn't draw the real
  page, so the new spec is left for Implementation.
