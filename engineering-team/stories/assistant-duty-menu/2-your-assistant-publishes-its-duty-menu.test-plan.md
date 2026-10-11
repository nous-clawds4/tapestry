# Test Plan: Story 2 — Your Assistant publishes its Duty Menu

**Story:** `engineering-team/stories/assistant-duty-menu/2-your-assistant-publishes-its-duty-menu.md`
**ADR:** `engineering-team/decisions/assistant-duty-menu/0002-the-assistant-signs-its-duty-menu-through-one-narrow-route.md`
**Date:** 2026-10-11

## Coverage map

**New suite:** `test/assistant-duty-menu-publish.test.js`, registered in `test/registry.js` after the page suite. It
covers the route (P, E, W), the guard's new home (G), and sentinels (S).

**Additions to story 1's suites:**
- `test/assistant-duty-menu-check.test.js`: L13, U33–U37.
- `test/assistant-duty-menu-page.test.js`: P7, P8, D6, D7.
- `tests/brainstorm/assistant-duty-menu.spec.js`: B12–B16.

Words live in `test/helpers/dutyMenuFixtures.js` (`PUBLISH`, `PUBLISH_SENTENCES`).

**How the route is tested.** Through the seams ADR 0002's Implementation notes name:
- `getAssistantKeys`, `finalizeEvent`, `importEvent`, `isLocalOnly`, `publishToRelays`, `isPublicHostname` and `now`;
- story 1's `resolveOfferInputs`, `lookupPublishedMenu`, `assistantWriteRelays` and `nousWriteRelays`;
- `getConfiguredPublishRelays`, `outsideOnly` and `getConfigFromFile`.

Events are really signed and verified with nostr-tools. E6 and W10 run the real story-1 functions over low-level fakes.

| Criterion | Tests | File | Level |
|---|---|---|---|
| **AC-1** the button and its report | P7 the words (`DUTY_MENU_COPY.publish.{button, publishing, subject, empty, requestFailed}`) · P8 the client helper: one POST, no body, `{ status, ...json }`, and "This instance did not answer" on a non-JSON answer · D4 (re-aimed) publishing only through the helper, `refresh()` in one place · D6 the button's words, its disabled rule (publishing, `'checking'`, `current`), `describeServerPublish` + `relayLine` in an aria-live region, `result.ok === true` before refreshing, the empty line on `duties === 0` · W9 the answer's shape and summary sentences · B12 enabled when none, out of date, unfinished or failed; disabled when up to date and while checking · B13 Publishing… (disabled), one POST with no body, the report (summary + accepted, rejected, unreachable, timed out, not-sent lines), the answer asked again, the panel Done, the report kept · B14 a refusal, a failed request and a failed local write each give one line, nothing asked again · B15 kept-local words and skipped lines; the empty line | page, publish, browser | unit (ESM) · source · DI · browser |
| **AC-2** whose key, what is signed | P1 exports, CODES and WORDS · P2 401 before any key is read · P3 403 `no-assistant`: key looked up for the session's viewer, nothing else read, signed, written or sent · P4 the body is never read (a getter records any read); query, kind, pubkey, tags, rows and content change nothing · P5 signed by the session's own Assistant, Owner and customer alike · P6 one press signs exactly one event, kind 39999 · P7 500 with `WORDS.failed` on a throw · S1 the route registered · S2 no other caller in `src/`, `bin/`, `setup/` or `scripts/`; the client helper is the UI's one caller; nothing scheduled; no key literal; tags via `buildMenuTags`; the generic signer untouched | publish | DI · source |
| **AC-3** the event | L13 `buildMenuTags`: d, Nous' z, p, then one duty tag per duty row in order; three tags for an empty offer; a menu by § 6.1 whose rows read back as the offer · E1 kind, content `''`, verifies, tags exactly as L13 · E2 `isDutyMenu` holds; rows read back are the offer · E3 an empty offer publishes an empty menu, `duties: 0` · E4 `created_at`: now; one second after a newest from the future, even an invalid one; now when the newest is older · E5 the author check: signed by another key, Nous' z dropped, or a second p → 500, nothing written or sent · E6 read back by story 1's check (real offer, real local-first read, an older version from the future): current and Done | check, publish | unit · DI |
| **AC-4** where it goes | W1 local first; a failed local write sends nothing, with the local-failure sentence · W2 the set, each relay once: the Assistant's write relays, the new rows' relays, the found menu's row relays (from an invalid one too), Nous'; never this instance's own, never the profile publish set · W3 Nous' list not found: nothing for Nous · W4 configured row relays sent without a lookup, even when an event names them too; event-named relays looked up · W5 a refused relay reads `not-sent: not a public address`, paired with an accepted one that is sent; the summary counts only relays sent to · W6 at most 50 event-named relays, the first 50 in the ADR's order after de-duplication against each other and the configured set; beyond that no lookup, send or row; the configured relay on top · W7 local-only: skipped rows, kept-local sentence, nothing sent · W8 a DNS lookup that never answers costs only the 3 s budget · W10 a relay hanging in the newest-version lookup costs at most the 8 s relay budget plus the DNS budget · G1 `relayHostGuard` exports `isPublicRelayHostWithin`, `within` and `LOOKUP_BUDGET_MS` = 3000 · G2 `relayListPublish` re-exports the same function and budget · G3 `dutyMenu.js` and `dutyMenuPublish.js` require the guard's home and never name `relayListPublish` | publish | DI · source |
| **AC-5** this instance's relay first, reading | U33 a version here: the newest here counts, even with a newer one outside; no Map or relay-list lookup, no DNS check, no outside read · U34 a newest version here that is not a menu → none, still no outside read · U35 none here, or a failed scan: the two rounds run, the newest found counts, "finished" unchanged · U36 `lookupPublishedMenu` returns `latest` (here, invalid, outside, none) beside `published`; the answer's shape stays U3's exact seven fields · U37 `assistantWriteRelays` and `nousWriteRelays` exported, sharing the check's one Nous cache · re-aimed U15, U16, U17, U19, U20, U31 (below) · S3 openapi documents the route and says the attention read is local-first | check, publish | DI · source |
| **AC-6** an empty menu says so | D7 `DUTY_MENU_COPY.emptyMenu` shown for a found menu with no rows · P7 its words · B16 "Your Assistant's Duty Menu lists no duties." under the heading and the Done mark | page, browser | source · browser |
| **Docs** (sub-decision 9) | S3 `openapi.yaml`: the route, and the local-first note in the attention entry's duty-menu part · S4 BIBLE §11: a POST row for the route; the attention row's duty-menu part names the DList fallback and the 50-relay cap · S5 `attention.js`'s header names the duty-menu check among the checks run side by side, not "Three actions", and in the answer's shape | publish | source |

## Edge cases

- [x] A body with a getter: reading it at all fails P4.
- [x] Session shapes: none, a non-hex pubkey, and `authenticated: false` (P2).
- [x] A newest version from the future, one that is older, and an invalid one: it still sets `created_at` (E4), and its
      rows still get the replacement (W2).
- [x] A signer that signs with another key, drops Nous' z, or adds a p (E5).
- [x] Relays in other spellings, this instance's own relay and loopback in the Assistant's list, a configured relay
      also named by an event, Nous naming a configured relay (W2, W4, W6).
- [x] Nous' list not found (W3). An empty offer (E3, L13). An offer row that isn't a duty row (L13).
- [x] 66 event-named relays with duplicates, against a cap of 50 (W6).
- [x] A DNS lookup that never answers (W8); a relay that hangs during the lookup (W10).
- [x] A newer menu outside while this instance's relay holds an older one (U33). An invalid newest version here (U34).
      A failed local scan (U35).
- [x] Browser: a 403 refusal, a 502 that is not JSON, a failed local write, local-only, an empty publish (B14, B15).

## Open points for the Architect / PO (flagged, not resolved)

1. **The relay-list-publish suite does not stay "green unedited".** ADR 0002's Consequences say only S3 needs a
   re-aim. But A10 checks `relayListPublish.js` itself for the DNS `Resolver`, which sub-decision 6 moves to
   `src/utils/relayHostGuard.js`. A10 is re-aimed (below) to read the guard's home and to require that the route
   imports it.
2. **One local scan, or two?** Sub-decision 7 says the two rounds "run as they do today", and today round 2 includes the
   local scan. It also says a scan that succeeded with none "still counts toward finished", which reads as reusing the
   first scan. Story 1's U12 and U25 still pin exactly one local menu scan; a second scan would fail them. They are left
   as they were. If the Architect wants a second scan allowed, those two tests change.
3. **A hanging send.** The route sets no budget around `publishToRelays`. That function bounds each relay itself
   (profile publish), and that is not re-tested here. AC-4's bounded time is pinned for the DNS lookups (W8) and for the
   newest-version lookup's relay reads (W10).
4. **The profile publish set is not a send target.** AC-4 lists four places. The relays this instance publishes
   profiles to are where the two relay lists are read, so W2 pins that they are not sent the menu.
5. **The client helper's export name.** The ADR names the file, `ui/src/utils/publishAssistantDutyMenu.js`, but not
   the export. P8 and D6 expect `publishAssistantDutyMenu`, after the file and its precedent.
6. **"The body is never read"** is pinned literally (P4), not only as "the body changes nothing".
7. **`nousWriteRelays`' first argument** (which relays to look Nous' list up on) is not pinned.

## Re-aimed suites (this phase, not Phase 4)

Each re-aim is pinned against the current code: it fails there only where it should, or passes as a guard. Each was
also checked against a throwaway sketch of ADR 0002 in a scratch copy, deleted afterwards. There, the HEAD version of
the suite failed where shown and the re-aimed version passed.

- **`test/assistant-duty-menu-check.test.js`** (AC-5: with a version here, the outside relays are not asked).
  - **U15:** the latest across the outside answers is now tested with no version here (two outside versions; the tie
    on two outside relays). The local-newer case stays. *HEAD U15 fails on the sketch.*
  - **U16:** the older valid version and the newer invalid one are both outside. *HEAD U16 fails on the sketch.* U34
    pins the same rule for versions here.
  - **U17:** the Assistant's own menu is on an outside relay, so the sloppy relay is still read. *HEAD U17 passes on
    the sketch but no longer reads that relay.*
  - **U19:** no version here, the menu on another hint relay, one relay hanging. *HEAD U19 passes on the sketch but no
    longer exercises the hang.*
  - **U20:** no version here, and the menu on the Assistant's write relay. *HEAD U20 fails on the sketch.*
  - **U31:** both versions outside. *HEAD U31 fails on the sketch.*
- **`test/assistant-duty-menu-page.test.js`.**
  - **D4:** the page now publishes (story 2 AC-1). It may call `publishAssistantDutyMenu` and import it and the shared
    report util, and must call `refresh()` in exactly one place. Fetching, timers, storage, `/api/` strings and signing
    stay refused. *HEAD D4 fails on the sketch.*
  - **D5:** story 2's sentences may not be typed into the JSX either.
- **`test/assistant-relay-list-publish.test.js`.**
  - **S3:** back to strict; story 1's carve-out for `dutyMenu.js` is removed (sub-decision 6).
  - **A10:** the `Resolver` rule now reads the guard's home, and the route must require
    `../../utils/relayHostGuard`. *HEAD A10 fails on the sketch* (open point 1).
- **`tests/brainstorm/assistant-duty-menu.spec.js`.** The mock takes an attention-answer queue and a `publish` answer
  for the POST; B1–B11 are unchanged.
- **`test/helpers/dutyMenuFixtures.js`.** Adds `PUBLISH` and `PUBLISH_SENTENCES` (§ Copy).

## Test infrastructure

- **Node runner through the gate (`npm test`).** Stack-free: no key store, strfry, relay, DNS or network. The route
  suite bounds every handler call (15 s) and restores the console it quiets, so a hanging handler fails its own test
  and never silences the suites after it.
- **Browser:** Playwright with every `/api` route mocked, the POST included. Build and serve the UI, then
  `BRAINSTORM_SERVER_ACCESSIBLE=true BRAINSTORM_BASE_URL=<origin> npx playwright test tests/brainstorm/assistant-duty-menu.spec.js --project=chromium`.
  **Not run here:** there is no built UI or stack. The spec was loaded in Node with a stub `@playwright/test` and lists
  17 tests.
- **Firmware state:** none. **Live API:** none.

## How to run

```
node -e "require('./test/assistant-duty-menu-publish.test.js').run()"
node -e "require('./test/assistant-duty-menu-check.test.js').run()"
node -e "require('./test/assistant-duty-menu-page.test.js').run()"
npm test            # then: npm run gate:status
```

## Verification

The new and re-aimed tests fail with the current code (`fc485945` plus this phase's test changes), each because the code
predates ADR 0002: `dutyMenuPublish.js`, `relayHostGuard.js`, `buildMenuTags`, the local-first read, `latest`, the
write-relay helpers, the client helper, the button and the docs don't exist yet. None fails on a typo or an import error
in a test.

**Full gate.** `npm run gate:status` → `20261011T215635Z-23778-4221 [duty-menu-2-tester] … on fc485945+dirty — FAIL,
exit 1, 5683 passed, 43 failed, 582 skipped, 303/303 suites; failed: assistant-relay-list-publish,
assistant-duty-menu-check, assistant-duty-menu-page, assistant-duty-menu-publish`.

Compared suite by suite with the last green run (Review's `20261011T210326Z-20170-8287` on `b5c732ed`, 5665 passed,
0 failed), only those four changed; the one other difference is another book's new suite, `assistant-shared-categories`
(20 / 0). No other suite fails.

| Suite | Last green run | This run | Failing |
|---|---|---|---|
| `assistant-duty-menu-publish` (new) | — | 0 / 31 | all |
| `assistant-duty-menu-check` | 55 / 0 | 56 / 5 | L13, U33, U34, U36, U37. U35 and the six re-aims pass now and on the sketch. |
| `assistant-duty-menu-page` | 11 / 0 | 10 / 5 | P7, P8, D4 (re-aimed), D6, D7. D5 (re-aimed) passes. |
| `assistant-relay-list-publish` | 32 / 0 / 1 | 30 / 2 / 1 | A10, S3 (both re-aimed) |

**`test/assistant-duty-menu-publish.test.js`: 0 passed, 31 failed**: all 31 fail. The gate record keeps only the first 20 failure messages, so this excerpt is from a direct run on the same tree:

```
FAIL  P1: the module exports what ADR 0002 sub-decision 1 names — the handler factory and handler, publishDutyMenuFor, DUTY_MENU_SUBJECT "Your Assistant's …
      src/api/assistant/dutyMenuPublish.js does not exist. ADR 0002 sub-decision 1 creates it: createPublishDutyMenuHandler, handlePublishDutyMenu, publishDutyMenuFor, DUTY_MENU_SUBJECT, CODES, WORDS.
FAIL  P3: a signed-in viewer with no Assistant here gets 403 no-assistant in the approved words; the key is looked up for the session's viewer and nothing …
      src/api/assistant/dutyMenuPublish.js does not exist. ADR 0002 sub-decision 1 creates it: createPublishDutyMenuHandler, handlePublishDutyMenu, publishDutyMenuFor, DUTY_MENU_SUBJECT, CODES, WORDS.
FAIL  E6: read back by story 1's check, the new menu is current and the action Done — with the real offer, the real local-first read and an older version h…
      src/api/assistant/dutyMenu.js must export assistantWriteRelays() (ADR 0002 § Implementation notes).
FAIL  W2: the set, each relay once — the Assistant's write relays, the new rows' relays, the rows of the menu found at publish time (read even from an inva…
      src/api/assistant/dutyMenuPublish.js does not exist. ADR 0002 sub-decision 1 creates it: createPublishDutyMenuHandler, handlePublishDutyMenu, publishDutyMenuFor, DUTY_MENU_SUBJECT, CODES, WORDS.
FAIL  W10: a relay that hangs while the newest version is looked up costs at most the story-1 relay budget (8 s) plus the DNS budget — the press still answ…
      src/api/assistant/dutyMenu.js must export assistantWriteRelays() (ADR 0002 § Implementation notes).
FAIL  G1: src/utils/relayHostGuard.js exports isPublicRelayHostWithin, within and LOOKUP_BUDGET_MS = 3000 — an IP literal or a private-by-construction name…
      src/utils/relayHostGuard.js does not exist. ADR 0002 sub-decision 6 moves isPublicRelayHostWithin, within and LOOKUP_BUDGET_MS there.
FAIL  G3: dutyMenu.js and dutyMenuPublish.js take the guard from src/utils/relayHostGuard, and never name relayListPublish (sub-decision 6)
      src/api/assistant/dutyMenu.js does not require ../../utils/relayHostGuard; src/api/assistant/dutyMenu.js names relayListPublish; src/api/assistant/dutyMenuPublish.js does not exist
FAIL  S1: the route is registered — app.post('/api/assistant/duty-menu/publish', require('./assistant/dutyMenuPublish').handlePublishDutyMenu) in src/api/i…
      src/api/index.js does not register app.post('/api/assistant/duty-menu/publish', require('./assistant/dutyMenuPublish').handlePublishDutyMenu)
FAIL  S3: openapi.yaml documents POST /api/assistant/duty-menu/publish, and its attention entry says the Duty Menu is read from this instance's relay first…
      openapi.yaml has no /api/assistant/duty-menu/publish path; the attention entry's duty-menu part does not say the read is local-first (AC-5)
FAIL  S4: BIBLE §11 has a POST row for /api/assistant/duty-menu/publish, and the attention row's duty-menu part names the DList fallback and the 50-relay c…
      no BIBLE §11 POST row for /api/assistant/duty-menu/publish; the attention row's duty-menu part does not name the DList fallback; the attention row's duty-menu part does not name the 50-relay cap
FAIL  S5: attention.js's header names the duty-menu check in its list of the checks run side by side, and in the answer's shape (sub-decision 9; NB9)
      that paragraph does not name the duty-menu check among them: "Three actions are checked, side by side; a check that throws becomes its action's `check-failed` answer and never takes another action with it (except identification-t…
```

**`test/assistant-duty-menu-check.test.js`: 56 passed, 5 failed** (failing: L13, U33, U34, U36, U37).

```
FAIL  L13: buildMenuTags gives d, Nous' z and p (the Assistant), then one ["duty", key, relay] per duty row of the offer in its order, and nothing else; an…
      src/lib/duty-menu must export buildMenuTags() (ADR 0001 sub-decision 1 / § Implementation notes).
FAIL  U33: when this instance's relay holds any version of the Assistant's menu, the newest there counts — even with a newer one outside — and nothing else…
      the newest here counts, done: {"finished":true,"done":false,"pending":true,"reason":null,"offer":[{"tag":"duty","key":"30392","relay":"wss://tapestry.example/relay"},{"tag":"duty","key":"30393","relay":"wss://tapestry.example/rel…
FAIL  U34: a newest version here that is not a menu by § 6.1 means the Assistant has none — even when an older version here is one — still with no outside …
      no outside read: ["wss://hint.example","wss://hint-two.example","wss://a-write.example","wss://a-write-two.example","wss://nous-write.example"]
FAIL  U36: lookupPublishedMenu returns `latest`, the newest version found whatever its validity, beside `published` — the one here, an invalid one, one fou…
      here: {"published":{"rows":[{"tag":"duty","key":"30392","relay":"wss://tapestry.example/relay"},{"tag":"duty","key":"30393","relay":"wss://tapestry.example/relay"},{"tag":"duty","key":"30394","relay":"wss://tapestry.example/relay…
FAIL  U37: dutyMenu.js exports the publisher's write-relay helpers — assistantWriteRelays gives the Assistant's write relays (no read-only ones), and nousW…
      src/api/assistant/dutyMenu.js must export assistantWriteRelays() (ADR 0001 sub-decision 1 / § Implementation notes).
```

**`test/assistant-duty-menu-page.test.js`: 10 passed, 5 failed** (failing: P7, P8, D4, D6, D7).

```
FAIL  P7: the publish words — DUTY_MENU_COPY.publish has the button, Publishing…, the subject, the empty line and the request-failed line, and DUTY_MENU_CO…
      DUTY_MENU_COPY.publish: want {"button":"Have your Assistant publish its Duty Menu","publishing":"Publishing…","subject":"Your Assistant's Duty Menu","empty":"Your Assistant's Duty Menu now lists no duties.","requestFailed":"This …
FAIL  P8: the client helper publishAssistantDutyMenu() — one POST to /api/assistant/duty-menu/publish with no body, answering { status, ...json }; an answe…
      ui/src/utils/publishAssistantDutyMenu.js does not exist. ADR 0002 sub-decision 8 creates it, as ui/src/utils/publishAssistantRelayList.js.
FAIL  D4: one request and no polling — the page never fetches itself, never polls, stores nothing and signs nothing; it publishes only through publishAssis…
      the page: refresh() in 0 places, want one (after a written menu); no publishAssistantDutyMenu() call
FAIL  D6: the button and its report — the words from DUTY_MENU_COPY.publish, disabled while publishing, while checking or when the menu is current; the rep…
      missing: publishAssistantDutyMenu imported from '../../utils/publishAssistantDutyMenu'; missing: the button's words (DUTY_MENU_COPY.publish.button); missing: Publishing… (DUTY_MENU_COPY.publish.publishing); missing: the empty lin…
FAIL  D7: AC-6 — the published panel shows DUTY_MENU_COPY.emptyMenu when the menu found has no rows (story 2 AC-6; ADR 0002 sub-decision 8)
      the page does not show DUTY_MENU_COPY.emptyMenu
```

**`test/assistant-relay-list-publish.test.js`: 30 passed, 2 failed, 1 skipped** (failing: A10, S3).

```
FAIL  A10: the route's default lookup stays off the threadpool — a dns.promises Resolver in the guard's home, src/utils/relayHostGuard.js, which the route …
      src/utils/relayHostGuard.js does not exist; the route does not require ../../utils/relayHostGuard; the guard does not use a dns.promises Resolver
FAIL  S3: nothing publishes a relay list at Assistant creation, and the generic signer is untouched — only src/api/index.js requires the new module (AC-2)
      only src/api/index.js may name relayListPublish: src/api/assistant/dutyMenu.js
```

**Satisfiable and discriminating.** I wrote a throwaway sketch of ADR 0002 in a scratch copy of the tree, outside this
repo, and deleted it after the check. It had:
- the guard moved to `src/utils/relayHostGuard.js`;
- `buildMenuTags`;
- the local-first read, with `latest` and the two write-relay helpers;
- `dutyMenuPublish.js` and the route;
- the client helper and the page's button, report and empty line;
- the docs lines.

Against it:
- `assistant-duty-menu-publish` passed 31 / 0, `assistant-duty-menu-check` 61 / 0, `assistant-duty-menu-page` 15 / 0 and
  `assistant-relay-list-publish` 32 / 0 / 1;
- `assistant-duty-cards`, `assistant-management-page`, `assistant-outbox-check`, `assistant-outbox-relays-page` and
  `assistant-attention` all passed;
- the HEAD versions of the touched suites failed exactly where they were re-aimed (check U15, U16, U20, U31; page D4;
  relay-list A10).

Mutating the sketch turned the intended tests red:

| Mutation | Tests that turn red |
|---|---|
| not local-first | U33, U34 |
| no `latest` on the local path | U36 |
| two local scans | U12, U13, U15, U25 (open point 2) |
| the body read | P4 |
| the offer read before the key | P3, P5 |
| no author check | E5 |
| `created_at` always now | E4, E6 |
| earlier rows only from a valid version | W2 |
| no cap | W6 |
| configured relays guarded | W4, W6 |
| local-only ignored | W7 |
| the profile publish set sent to | W2, W3, W4, W6, W7 |
| no DNS budget | W8 |
| the fan-out before the local write | P6, W1–W10 |
| the helper sending a body | P8 |
| `buildMenuTags` keeping a not-offered row | L13 |

The DNS-budget mutation first showed that a hanging handler could leave the console silenced for later suites. The
suite now bounds every handler call and restores the console it captured at load (Test infrastructure).

