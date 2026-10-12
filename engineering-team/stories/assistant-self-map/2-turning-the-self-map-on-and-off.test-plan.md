# Test Plan: Story 2 — Turning your Assistant's self-Map on and off

**Story:** `engineering-team/stories/assistant-self-map/2-turning-the-self-map-on-and-off.md`
**ADR:** `engineering-team/decisions/assistant-self-map/0002-one-narrow-route-turns-the-self-map-on-and-off.md`
**Date:** 2026-10-12

## Where the tests live

| File | What it holds |
|---|---|
| `test/assistant-self-map-publish.test.js` (new) | The merge (M), the choice store (K), the route's refusals (P), the reads a press needs (R), what is signed (E), the choice and the press (C), where it goes (W), the lock (L), and sentinels (S). |
| `test/assistant-self-map-check.test.js` (extended) | V1–V6: `selfMapOn` in the answer, `gatherSelfMap`, the `forWrite` read, the relay hints. U3, U31 and S6 are re-aimed. |
| `test/assistant-self-map-page.test.js` (extended) | Q1–Q3: the words and the two pure helpers. H1–H2: the client helper. D4 is re-aimed, and D7–D8 are new. |
| `tests/brainstorm/assistant-self-map.spec.js` (extended) | B14–B21: what a viewer sees and does. B12 is re-aimed. |
| `test/helpers/selfMapFixtures.js` (extended) | `PRESS`: the route, codes and story § Copy's words. `PRESS_PAGE_SENTENCES`. `selfMapOn` on every canned answer. `offOf(answer)`. |
| `test/assistant-taggings-publish.test.js` (re-aimed) | S2: `selfMapPublish.js` joins the files allowed to take `privkeyBytesOf` from `identificationTaggings`. |
| `test/registry.js` | Registers the new suite after the self-Map page suite. |

## Coverage map

| Criterion | Tests | File | Level |
|---|---|---|---|
| **AC-1** the remembered choice | K1 path; K2 off until turned on, shape, other Assistants kept, case; K3 an unreadable file reads null and is never overwritten; K4 only Assistant keys; K5 one write at a time, no temp file left | publish | unit (real `fs`, temp path) |
| | C1 an accepted press writes `(Assistant, on, now)` before anything else; C2 the choice holds when this instance's relay refuses; C3 a failed choice write is a 500 and nothing is written; C4 the real store, on then off | publish | integration (injected seams) |
| | V1 `selfMapOn` from the store for the session's Assistant: true, false, or null (unknown, or the read throws), on unfinished answers too; V2 a check that throws carries `selfMapOn: null` | check | integration |
| | P2–P4 and R1–R3 assert that a refused press writes no choice | publish | integration |
| | S4 the choice file has one writer, and it writes by temp file and rename | publish | sentinel |
| **AC-2** buttons and report | Q1 the words; Q2 `selfMapStateLine` in nine states; Q3 `selfMapButtons` in ten states | page | unit (ESM in Node) |
| | E3 already current, E4 nothing to claim, E7 nothing claimed: published false, `unchanged` and its words; E5 Turn on with stale claims publishes their removal | publish | integration |
| | W7 the summary sentences; W6 local-only | publish | integration |
| | D4 the one network call is the helper; D7 the state line, buttons, report and refresh are wired; D8 the words have one home | page | sentinel |
| | B12 nothing but GETs until a press; B14–B17 each state's lines and buttons; B18 Turn on: POST `{on:true}` as JSON, Publishing… with every button disabled, the report, the refresh; B19 Turn off: "now claims no duties"; B20 nothing published still refreshes, while a refusal shows its words and doesn't; B21 no Owner's note for a customer, and no buttons signed out or without an Assistant | spec | browser |
| **AC-3** whose key, what is signed | P1 exports and words; P2 401 before any key is read; P3 400 for a non-boolean `on`; P4 403 no-assistant; P5 the request cannot choose the Assistant, the entries or the relays | publish | integration |
| | H1 the helper posts `{ on }` as JSON to the one route; H2 a non-JSON answer throws, and a refusal passes through | page | unit |
| | E9 read back: after Turn on, story 1's check reads done; after Turn off, it finds no self-entries | publish | integration |
| | S1 the route is registered; S2 the route table entry; S3 nothing else names or calls the press, nothing schedules it, and the generic signer gains nothing | publish | sentinel |
| **AC-4** nothing else is lost | M2 `ownsTag`; M3 `keptTags`; M4 `buildSelfMapEvent` (kind, `created_at` both ways, content, exact tag order, block placement, expiration); M5 the off build, only-self-entries and none-found cases | publish | unit (pure) |
| | E1 Turn on over this instance's own Map: signed, verifies, exact self-entries, kept tags as written, expiration dropped, content kept, `created_at`; E2 a stale self-entry and a `39998:` one are replaced, a `p` tag naming the Assistant and others' entries are kept; E10 the preservation check stops a bad signing result | publish | integration |
| | R1 Map unreadable; R2 local scan of the 10040 fails (even with outside answers); R3 none here and no outside answer; R4 none here and one answer holding none is finished; R5 a newer outside version is the base; R6 a forged base is refused; R7 upkeep unreadable; R8 off doesn't need the Map | publish | integration |
| | V3 `gatherSelfMap` = the check without `selfMapOn`, with `lookup.latest`; V4 `forWrite` reads every place and the newest wins, while the default stays local-first; V5 `forWrite`'s strict finish | check | integration |
| | L1 two presses at once: the second builds on the first and is dated later; L2 `withAssistantLock` order, isolation, recovery after a throw | publish | integration / unit |
| **AC-5** off | E6 removes every self-entry and keeps everything else (expiration included); one kind 10040, no retraction, no deletion; E7 nothing claimed publishes nothing; E8 only self-entries leaves an empty Map | publish | integration |
| | V3 the marks don't move with the choice | check | integration |
| | B17, B19 | spec | browser |
| **AC-6** where it goes | W1 local first; W2 the set (write relays plus the found self-entries' relays), guarded and sent once each, never this instance's relay, a read-only relay, Nous' relays or the Map hints; W3 off reaches every relay that held the claim; W4 a typed relay goes as configured, unguarded, and a non-public event-named relay gets a not-sent row; W5 the 50 cap; W6 local-only; C2 a failed local write sends nothing | publish | integration |
| **R3-N2** (story 1 review) | V6 hints only from entries whose key parses | check | integration |
| **Records** | S5 openapi path and `selfMapOn`, BIBLE §11 row and attention row, BIBLE §15 file line, ADR 0001 note | publish | sentinel |

## Edge cases

- [x] **An empty body, a non-object body, a string `on`, `null`, a numeric `on`:** a 400, and nothing changes (P3).
- [x] **Extra fields** naming another Assistant, entries or relays: either a 400 with nothing changed, or ignored (P5). The ADR allows either.
- [x] **Concurrent presses for one Assistant** (L1), and concurrent store writes for twenty Assistants (K5).
- [x] **This instance's relay wiped** (R3), **restored from an older backup** (R5), **forged** (R6).
- [x] **The local write refused** after the choice is recorded (C2). **The choice store failing** (C3).
- [x] **An unknown choice** (`null`): no state line; buttons as if off (Q2, Q3).
- [x] **Off with self-entries still found:** Turn off shows, so no claim is stuck (Q3, B17).
- [x] **A version that is only self-entries** (E8). **No version anywhere** (R4, M5).
- [x] **Expiration kept when off** (E6, M5), dropped beside a self-entry (E1, M4).
- [x] **Sixty old relays** (W5). **Local-only** (W6). **No relay at all** (W7).

## Points the ADR leaves open, fixed here (for the Implementer; challenge them at the gate)

1. **The press's injected story-1 functions take their input alone, bound to the low-level fakes**, as the Duty Menu suite's `integratedDeps` does:
   - `gatherSelfMap(input)`;
   - `lookupSelfMap(input)`;
   - `lookupViewerMap(viewer)`, which answers `lookupNewest`'s `{ finished, event }`;
   - `resolveOfferInputs(viewer)`;
   - `assistantWriteRelays(input)`.

   The other seams follow `dutyMenuPublish.js`: `getAssistantKeys`, `finalizeEvent`, `importEvent`, `isLocalOnly`, `publishToRelays`, `isPublicHostname`, `now`, `getConfiguredPublishRelays`, `getConfigFromFile` and `outsideOnly`. The new one is `writeSelfMapChoice(pk, on, nowSeconds)`.
2. **The accepted answer's fields.**
   - **Always:** `ok`, `on` and `published`.
   - **When nothing was published:** `unchanged` and `message`.
   - **When published:** `outcome`, `message`, `localOnly`, `selfEntries` (a count) and `relays { total, success, results }`.
   - **When the local write failed:** `ok: false` and `stage: 'local'`.
3. **The 400's words are not pinned.** Only its status and code are.
4. **`readSelfMapChoice` and `writeSelfMapChoice` may be sync or async.** The tests `await` both.
5. **The canned answers are all on.** Every canned answer in `selfMapFixtures.js` carries `selfMapOn: true`, except `CHECK_FAILED`, which is `null`. Story 1's browser tests B6 and B9 then keep their status lines, because the status line hides only while off. Story 2's tests turn an answer off with `offOf(answer)`.
6. **The report's relay line is `<relay> — <relayLine(row)>`**, as the Duty Menu page draws it (B18).

## Shared line: book `assistant-duties-settings`

Its story 1 review asked for an Architecture amendment to how the self-Map reads offer rows that aren't bare kinds (`origin/staging` at `72dba9e`). That changes `evaluateSelfMap`'s offer map and `readUpkeep`, the functions this story only calls.
- **The new tests use the shipped list,** the six bare kinds (and W4's two typed Concept relays), and pin nothing about compound offer keys.
- **W4 puts both Concept kinds at the typed relay.** Story 1's engine claims a bare `39998` only where `39998` and `39999` share a relay. If their amendment changes that rule, W4's expected self-entry may need re-aiming, by the Tester.

## Test infrastructure

- **Runner.** The Node runner, `npm test` (`test/test.js` → `test/registry.js`), read through `npm run gate:status`. Playwright for `tests/brainstorm/`.
- **Stack.** No live stack. Every Node test injects its dependencies, and the browser spec mocks every `/api` route.
- **Keys.** Every version of the Assistant's kind 10040 is signed with a key generated per test. The press's own signature is verified on a JSON copy: nostr-tools caches verification on the object, and a spread copy would carry it.
- **Config.** The deployments' real values: Docker's `ws://localhost:7777` with `STRFRY_DOMAIN`, and the shipped Assistant Duties list (ledger `2026-10-12-test-configs-not-from-deployments`).
- **The choice store** runs on a temp path, through `TAPESTRY_SELF_MAP_CHOICE_PATH` (K1–K5, C4). The environment is restored after.
- **Firmware state:** none needed.
- **Browser runs:**
  - build `ui/` with `vite build`, then serve it with `vite preview`;
  - run with `BRAINSTORM_BASE_URL=<preview>`, `BRAINSTORM_SERVER_ACCESSIBLE=true` and `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`, `--project=chromium`;
  - stop the preview by its pid, never with `pkill -f`.

## How to run

```
npm test
npm run gate:status
node test/assistant-self-map-publish.test.js        # the new suite alone
```

For browser/e2e:
```
cd ui && npx vite build --outDir <dir> && npx vite preview --outDir <dir> --port <p> --strictPort &
BRAINSTORM_BASE_URL=http://localhost:<p> BRAINSTORM_SERVER_ACCESSIBLE=true PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
  npx playwright test tests/brainstorm/assistant-self-map.spec.js --project=chromium
```

## Verification

The new tests fail against the current code for the reason they should: the module, export or behaviour is missing.
Confirmed on 2026-10-12, on `66e23820` with these test files.

**The Node gate**, `npm run gate:status`:

```
20261012T231707Z-29937-406a [s2-phase3-real] — FAIL, exit 1, 5859 passed, 68 failed, 582 skipped, 308/308 suites;
failed: assistant-self-map-check, assistant-self-map-page, assistant-self-map-publish, tagging-edges-realtime-wrapper
```

- **`assistant-self-map-publish`: 51 failed of 51.**
  - M1–M5: `src/lib/self-map/index.js must export ownsTag()` (and `keptTags`, `buildSelfMapEvent`).
  - K1–K5 and C4: `src/api/assistant/selfMapChoice.js does not exist`.
  - P, R, E, C, W and L: `src/api/assistant/selfMapPublish.js does not exist`.
  - S1: `src/api/index.js has no app.post('/api/assistant/self-map', …)`. S2: `want a signed-in action with a why, got
    undefined`. S5: the six records are missing.
- **`assistant-self-map-check`: 9 failed.**
  - U3: `fields: want [… "selfMapOn" …]`. U31: the check-failed answer lacks `selfMapOn: null`.
  - S6: `the one self-Map route is POST /api/assistant/self-map, got []`.
  - V1: `selfMapOn true, got undefined`. V2: `SELF_MAP_CHECK_FAILED.selfMapOn is null, got {…}`. V3: `must export
    gatherSelfMap()`.
  - V4: `forWrite: the newer outside version wins, got … (the older)`. V5: `local scan failed: { finished: false,
    reason: 'instance-unanswered' }, got {"finished":true}`.
  - V6: `the 39998: entry's relay is neither guarded nor asked, got [… "wss://bad-hint.example" …]`.
- **`assistant-self-map-page`: 7 failed.**
  - D4: `no import { setAssistantSelfMap } …`. Q1: the seven sentences are missing.
  - Q2 and Q3: `must export selfMapStateLine()` and `selfMapButtons()`. H1 and H2: `setAssistantSelfMap.js does not
    exist`. D7: `no selfMapStateLine(answer) …`.
- **`tagging-edges-realtime-wrapper`: 1 failed.** That is RW7, the known flake: "the first restart came 0.77 s after
  the first start". The suite then passed alone (24/0), and the occurrence is recorded on ledger row
  `2026-10-08-realtime-wrapper-timing-flake-under-load`. This diff touches no wrapper code.
- **Every other suite passed,** the re-aimed `assistant-taggings-publish` S2 included (19 passed, 1 skipped).

**The browser spec, against a build of the current UI** (`vite build` and `vite preview`, chromium):
- 13 passed (B0–B11, B13): story 1's tests still hold with the fixture changes.
- 9 failed (B12, B14–B21), each on a missing state line or button: for example `B14 … expect(locator).toBeVisible()
  failed` for "Your Assistant's self-Map is off."

**That the tests can pass.** I checked this against a throwaway prototype of ADR 0002 in a scratch worktree. It was
never committed, and has been deleted:
- the full Node gate `20261012T232414Z-3182-3d89 [s2-phase3-proto]` gave 5926 passed and 1 failed. The one failure is
  S5, the docs the prototype left out;
- this spec gave 22 of 22 against its build;
- the eight other hub specs that share these fixtures gave 81 passed and 5 skipped.

Three test defects that the prototype exposed were fixed before the runs above:
- S1 read `src/api/index.js` through `codeOnly`, which mistakes `/*` in a route string for a comment;
- W4 put only `39998` at the typed relay;
- S6's route regex also matched the route's "why" sentence.
