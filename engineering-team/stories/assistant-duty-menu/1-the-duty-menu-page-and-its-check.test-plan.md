# Test Plan: Story 1 — The Duty Menu page and its check

**Story:** `engineering-team/stories/assistant-duty-menu/1-the-duty-menu-page-and-its-check.md`
**ADR:** `engineering-team/decisions/assistant-duty-menu/0001-a-duty-menu-check-beside-the-others.md` (with Amendments 1 and 2, 2026-10-11)
**Spec followed (read-only):** `protocols/drafts/duty-menus.md` §§ 4, 5, 6.1, 8.1
**Date:** 2026-10-11

## Coverage map

There are two new Node suites, both registered in `test/registry.js` after `assistant-duty-cards.test.js`:

- `test/assistant-duty-menu-check.test.js` covers the library (L), the server check (U), the hub's readings (C) and
  server sentinels (S).
- `test/assistant-duty-menu-page.test.js` covers the page's copy module (P) and JSX sentinels (D).

The new browser spec is `tests/brainstorm/assistant-duty-menu.spec.js` (B). The shared words, constants and canned
answers are in `test/helpers/dutyMenuFixtures.js` (new).

| Criterion | Tests | Test file | Level |
|---|---|---|---|
| **AC-1** the answer is about the viewer's own Assistant | U1 visitor gets `{ signedIn: false }`, nothing looked up · U2 no Assistant gets `actions: {}`, nothing looked up · U3 `actions['duty-menu']` has exactly `offer, published, current, finished, done, pending, reason`; `published` = `{ rows, createdAt, source, eventId }` · U4 `checkDutyMenu` runs once with the session's `{ viewer, assistantPubkey }` whatever query/params/body say; only that Assistant's menu and that viewer's Map are read · S1 `dutyMenu.js` never reads `req.*` | check suite | unit (DI) · source |
| **AC-2** the offer | U5 Owner gets 30382 + 30392–30394 + 39998/39999 at the normalized own relay · U6 active customer gets Scores (customer looked up for the viewer) · U7 not a customer / inactive / pending get no Scores but Lists and Concepts · U8 customer lookup throws: no Scores, offer still answers, not check-failed · U9 non-public own relay (loopback, private IP, `.local`): no Scores/Lists; Concepts at the first non-private DList relay · U10 local-only: no DList fallback; own relay still used when public; no public relay at all gives an empty offer · U28 local-only is read through the `isLocalOnly` seam, which wins over env and config · S5 its default calls `isPublishLocalOnly()` · U29 a DList relay spelled `wss://Dcosl.example/` is offered as `wss://dcosl.example` · L11 `buildOffer` normalizes `ownRelay` and `dlistRelay` · U11 the offer follows the settings between two answers of one loaded server ("no code change") · U18 an unfinished check still carries the offer · L9 `buildOffer` gives the K1 rows per input, in Scores → Lists → Concepts order · L10 every offer is valid on its own (duty rows only, unique keys, no empty relay, no `39998:`/`39999:`, no family key, each key in exactly one Treasure Map category) · P2/P3 categories (below) | check suite, page suite | unit (DI, pure) |
| **AC-3** which menu is "published" | U12 one local scan plus every relay in the three § 8.1 places (Map hints for this Assistant, its 10002 write relays, Nous' 10002 write relays), each once, with § 8.1's filter; never another Assistant's hint or a read-only relay · U13 this instance's own relay is never read as outside (named by the Map, the 10002 or the offer); the offer's DList relay is read when there is no public address · U14 event-named relays are read only if `isPublicRelayHostWithin` accepts them (refused never read, accepted read); a configured relay is read whatever the guard says · U15 the newest across all answers counts (outside newer beats local older, and the reverse); a tie goes to the lowest id · U16 newest fails § 6.1 → no menu even if an older one is valid (control: older alone is found) · U17 another author's newer menu or another kind is ignored · U18 finished = local scan ok or ≥1 relay answered; else `no-relay-answered`, flags false, `current: null` · U19 a hanging relay is skipped at 8 s · U20 a failed hint lookup only shrinks round 2 · U21 a found Nous 10002 is cached 1 h (not re-read, but its relays still asked; re-read after the hour) · U22 a miss is never cached · L3/L4 `isDutyMenu`: the four § 6.1 conditions, each failing alone (with a passing control) · L12 the fifth condition (Amendment 2 item 1): `["z", "list"]` or a `39998:<64 hex>:concept-header` z, Nous' or anyone's, means not a menu; other `z` tags still pass · U31 a newest version with such a `z` leaves the Assistant with no menu, though an older conforming one exists · U32 at most 50 event-named relays are guarded and read: the first 50 after normalizing, `outsideOnly` and de-duplication, in § 8.1's order; the offer's configured relay is read on top (Amendment 2 item 2) | check suite | unit (DI, pure) |
| **AC-4** current, and the hub's mark | U23 same rows in another order and spelling (`39998:dlist-header`, relay case/slash), with name/description/json/extra z → current, done, not pending · U24 different relay / missing row / extra row / extra not-offered row → out of date, pending (control: current) · U25 no menu anywhere → finished, published null, not current, pending · U26 empty offer: empty menu → done; no menu → pending, not done (owner's answer 3(b)); a menu with rows → out of date · U27 a throwing check → the exact `check-failed` answer; other actions answer; 200 · L5/L6 `readMenuRows` keeps, normalizes, drops (including a relay that isn't `ws://`/`wss://`, and a bare naddr key) and dedupes after the drops; a not-offered row's relay is `null` · U29 a menu written with the normalized DList spelling is current · U30 in the answer a not-offered row has `relay: null`, and an `https://` duty row is gone · L7 `normalizeMenuKey` agrees with `entryOf` (the Phase-3 agreement test) · L8 `sameRows` ignores order and nothing else · C1 the entry keeps its words; alert criteria = the ADR's sentence; planning notes null · C2 `duty-menu` in `CHECKED_ACTIONS` right after `outbox-relays`; `treasure-map` not · C3 the two readings across ten answers (done → unmarked, in Done, not counted; pending → marked and counted; unfinished, check-failed, missing, not answered, checking → marked, not counted) · C4 the Treasure Map card stays marked, counted and never Done · C5 counts drop by one when the Duty Menu is done · C6 nothing for visitors or no-Assistant viewers (guard) · B1 hub card Done/marked, screen-reader name, link · B2 count line and pill for done / pending / unfinished | check suite, browser spec | unit · browser |
| **AC-5** the page | D1 `App.jsx` imports `DutyMenuPage` from `./pages/assistant/DutyMenu`; `ACTION_PAGES['duty-menu']`; the Treasure Map card has none · D2 reads `useAuth`, `useAssistantAttention`, `assistantAttention(...)` for the mark, its own `ASSISTANT_ACTIONS` entry, `./dutyMenuCopy`, `categoryOf`, `statusLine` · D3 TopBar, back link, title/description, sign-in line and button, no-assistant line and `/setup` link, `checking`/`failed` phases, Needs attention / Done with screen-reader prefixes, the hub's frame classes · D5 none of § Copy's sentences is typed into the JSX · P1 the copy module holds every § Copy sentence, "not offered" and the three category names · P2 `categoryOf` per key, `*` → all three in order · P3 `categoryOf` agrees with `appliesTo` · P4 `statusLine` for done / none / out of date / empty offer · P5 no status line for an unfinished, check-failed or missing answer · P6 the panel's none line ("No Duty Menu was found for your Assistant.") and the not-published status line are two sentences (Amendment 2 item 3) · B3 signed out · B4 no Assistant · B5 up to date (rows one per line with category, key, relay; Done; status; public line; back link) · B6 none published (the none line and the status line, each once) · B7 out of date, with a "not offered" row · B8 unfinished reason, no status line · B9 Checking…, then the request-failed line and no status line · B10 empty offer | page suite, browser spec | unit (ESM) · source · browser |
| **AC-6** read-only, one request | S1 `dutyMenu.js` never imports into strfry, signs, publishes or writes · U3/U4 the answer comes inside `GET /api/assistant/attention` · S3 `attention.js` runs `checkDutyMenu` beside the others (`Promise.allSettled`, `DUTY_MENU = 'duty-menu'`, header comment) · D4 the page never fetches, refreshes, polls, stores, publishes or signs · B11 one GET of the answer per load, no parameters, nothing but GETs | check suite, page suite, browser spec | source · browser |
| **Docs** (Amendment 1 item 7) | S4 `openapi.yaml`'s `/api/assistant/attention` block names `duty-menu`, has `offer`, `published` and `current` fields and the `no-relay-answered` reason; BIBLE §11's row names the duty-menu check | check suite | source |

**ADR sub-decision 1 extras:** L1 pins the library: CommonJS, no I/O requires, no `process.env`, the constants and the
five functions. L2 pins `src/lib/nous.js` and a header built from `NOUS_PUBKEY`. S2 pins that Nous' key is written once,
in `nous.js`, and never retyped in the library or the check.

## Edge cases

- [x] Rows that don't parse, empty or missing relays, and `39998:`/`39999:` keys: dropped before the duplicate check (L6).
- [x] A `not-offered` row before a `duty` row with the same key: the first wins, whatever its tag (L6).
- [x] Two spellings of one key (`3039x:tag:` / `3039x:tag`, `39998:dlist-header` / `39998`): one row (L5, L6, U23).
- [x] A Concept key ending in `:` stays verbatim (L5, L7).
- [x] Upper-case author, a second `z` tag, a `z` naming a dictionary copy, a nomination (`p` ≠ author) (L3, L4).
- [x] A relay named twice across sources (`wss://Hint.Example/` in the Assistant's 10002 and the Map): read once (U12).
- [x] Loopback, this instance's host and `STRFRY_DOMAIN` in the Map, the 10002 or the offer: never read outside (U13).
- [x] A sloppy relay returning another author's newer menu or another kind (U17).
- [x] A NIP-01 `created_at` tie: the lowest id wins (U15).
- [x] The Map unreadable, so there are no hints (U20). A Nous 10002 that isn't found (U22).
- [x] A customer store that throws (U8). Customers with status `inactive` and `pending` (U7).
- [x] An empty offer with: an empty menu, no menu, or a menu that still has rows (U26).
- [x] The Duty Menu answer missing from the attention answer, a failed request, and the checking phase (C3).
- [x] A `z` of `list`, or naming a concept-header by Nous or anyone, beside Nous' `z` and before it; near misses that
      stay menus: `39998:<hex>:something-else`, a `30382` address, a kind-`39999` concept-header, a concept-header
      address without a 64-hex author, `lists` (L12).
- [x] 75 event-named relays, 70 distinct: a duplicate across Map entries in another spelling, one shared between the
      Map and the Assistant's list, five shared between the two relay lists, and this instance's own relay first in
      the Map — none of them takes a place among the 50 (U32).

## Open points, settled by ADR 0001 Amendment 1

The first draft of this plan left eight points open. The Architect settled each in ADR 0001 Amendment 1
(2026-10-11), and each is now pinned:

| # | Point | Settled as | Pinned by |
|---|---|---|---|
| 1 | The status line when the check did not finish or failed | No status line; the published panel's reason line is the only line | P5; browser B8, B9 |
| 2 | How local-only mode is read | `isPublishLocalOnly()` (env, then config) behind a seam named `isLocalOnly` | U28 (an injected seam wins over env and config, both ways); S5 (the default calls `isPublishLocalOnly()`); U10 still sets all three ways at once |
| 3 | `dlistRelay`'s spelling | `buildOffer` normalizes `ownRelay` and `dlistRelay` | L11; U29 (`wss://Dcosl.example/` is offered as `wss://dcosl.example`, and a menu written with that spelling is current and done) |
| 4 | A `duty` row whose relay isn't a relay address | Dropped like a missing relay, so a duty row's relay is never null | L6 (`https://…`, garbage and a number, dropped before the kept row); U30 |
| 5 | A `not-offered` row's `relay` | `null`, in `readMenuRows` and in the answer | L5, L6 (`relay: null` in the expected rows); U30 |
| 6 | naddr/nevent keys | Compared as written in a segment; a bare naddr in the kind slot is dropped | L5 (`3039x:tag:naddr1…` kept as written); L6 (bare `naddr1…` dropped) |
| 7 | Docs | `openapi.yaml` describes the action (`offer`, `published`, `current`, `no-relay-answered`), and BIBLE §11's row names the check | S4 |
| 8 | The SSRF guard's home | `dutyMenu.js` reads `isPublicRelayHostWithin` from `relayListPublish.js`; moving it is a later refactor | the `assistant-relay-list-publish` S3 re-aim below |

ADR 0001 Amendment 2 (2026-10-11, chosen by the owner before Review) added three more, each pinned the same way:

| # | Point | Settled as | Pinned by |
|---|---|---|---|
| A2.1 | The fifth § 6.1 condition (ADR duty-menus-and-self-maps/0003 sub-decision 11) | `["z", "list"]` or a `39998:<64 hex>:concept-header` z means not a menu; if that is the newest version, the Assistant has none | L12; U31 |
| A2.2 | A cap on relays named inside events | The first 50 after normalizing, `outsideOnly` and de-duplication, in § 8.1's order; configured relays and the local scan are not capped | U32 |
| A2.3 | The published panel's none line | "No Duty Menu was found for your Assistant."; the status line keeps "Your Assistant has not published a Duty Menu yet." | P1 and D5 (through the fixture); P6; browser B6 |

Still not covered, by design: the real relays, DNS and customer store (every read is injected, the house pattern for
`/api/assistant/attention`); and the browser spec's run (see Test infrastructure).

## Re-aimed suites (this phase, not Phase 4)

Every re-aim was confirmed both ways:

- Against HEAD, it fails only on the re-aimed assertions, or passes where it is a guard.
- Against a throwaway sketch of the ADR's modules, it passes. The HEAD version of the same suite fails there, as listed.

The sketch lived in a scratch copy of the repo and is not part of this phase's output (see Verification).

- **`test/helpers/dutyCardsFixtures.js`.** The Duty Menu card's `alertCriteria` is now the ADR's sentence and its
  `planningNotes` are null; both come from `dutyMenuFixtures.js`, and the old words are kept in a comment. `CHECKED`
  gains `duty-menu` after `outbox-relays`. A new `PLACEHOLDER_KEYS = ['treasure-map']`. *Why:* ADR 0001 sub-decision 6.
  The hub fixture (`assistantManagementFixtures.js`, note added) reads these cards, so hub D4 follows.
- **`test/assistant-duty-cards.test.js`.**
  - C3, C5, C6, C7, W1 and S1 now hold the placeholder pins for the card that stays a placeholder (the Treasure Map's).
  - C4 reads the new `CHECKED`.
  - C7's title now says the Alert counts the placeholders only.
  - C1, C2, C8, W2 and S2 are unchanged.
  - *Why:* the Duty Menu card is now a checked action with its own page and answer. Against the sketch, the HEAD version
    fails C3–C7, W1 and S1.
- **`test/assistant-management-page.test.js` D4** (no edit; it reads the fixture) now wants the Duty Menu's new
  criteria and null notes. *Why:* sub-decision 6.
- **`test/assistant-identification-tags-page.test.js` S3.** `built` gains `duty-menu`. *Why:* the new page joins
  `ACTION_PAGES`; HEAD's S3 fails against the sketch.
- **`test/assistant-relay-list-publish.test.js` S3.** `src/api/assistant/dutyMenu.js` may name `relayListPublish` to
  read its SSRF guard, but never for a publishing export (`createPublishRelayListHandler`, `handlePublishRelayList`,
  `publishAssistantRelayListFor`). *Why:* ADR 0001 sub-decision 3 takes `isPublicRelayHostWithin` from there, and the
  sentinel's intent (nothing publishes a relay list at Assistant creation) still holds. HEAD's S3 fails against the
  sketch.
- **The `checkDutyMenu` stub (returns `ANSWERS.DONE`)** goes into the fakes of `test/assistant-attention.test.js`,
  `test/assistant-outbox-check.test.js`, `test/assistant-profile-check.test.js` and
  `test/assistant-trusted-content.test.js`. *Why:* the handler runs a fifth check that reads the Map, two relay lists
  and outside relays, which these suites' scan and read counts must not see. Against the sketch, HEAD's versions fail
  attention U3/U4/U9/U11 and outbox U3/U4/U8/U12. In profile-check and trusted-content the stub is defensive: without it
  the real check would reach `CustomerManager` and real DNS. This is the precedent the trusted-content story set for
  `checkTrustedContent`.
- **Browser specs.**
  - `assistant-alert.spec.js` and `assistant-management-page.spec.js`: every mocked answer carries the Duty Menu as
    pending (no menu found, `DM.withDutyMenu`), which marks and counts it as the placeholder was, so their counts hold.
    `assistant-management-page.spec` B8 also skips `/assistant/duty-menu` (no longer a placeholder).
  - `assistant-attention.spec.js`: the same pending answer, so B1–B3 and B5 keep their counts. B4, where the fetch fails
    and the pill counts placeholders only, goes **7 → 6**.
  - `assistant-profile-check.spec.js` and `assistant-trusted-content.spec.js`: the same pending answer.
- **Unchanged, checked:**
  - The `outbox-check`, `attention`, `profile-check` and `trusted-content` C-classes derive the placeholders from
    `CHECKED_ACTIONS`.
  - `assistant-outbox-relays.spec`, `assistant-identification-tags-page.spec` and `assistant-taggings-publish.spec` pin
    hub marks only; an unanswered Duty Menu is still marked.
  - `assistant-profile-checklist-page` P1 (case-only file-name clash): `dutymenu` and `dutymenucopy` differ.

## Test infrastructure

- **Node runner through the gate (`npm test`).** The server check is driven through `handleAssistantAttention` with
  the seams ADR 0001's Implementation notes name:
  - `scanLocal`, `readRelay`, `getConfigFromFile`, `readConfiguredRelays`, `getConfiguredPublishRelays`,
    `mapDefaultRelays`, `isPublicRelayHostWithin` (the fake accepts a host or a URL), `getCustomer` and `now`.
  - `checkDutyMenu` on the handler (a spy or a throw).
  - The real `outsideOnly`, `lookupNewest`, `treasureMapRelays`, `lookupNewestReplaceable` and `isPublicHost` run over
    those fakes.
  - The other checks (`checkOutboxRelays`, `checkProfile`, `checkTrustedContent`) are stubbed.
  - Stack-free: no strfry, relay, DNS or network.
- **Seams this plan pins where the ADR left a detail open:**
  - `checkDutyMenu({ viewer, assistantPubkey }, d)` gets the handler's merged deps (sub-decision 7).
  - The Nous cache is module-level in `dutyMenu.js`. Each test loads `attention.js` and `dutyMenu.js` afresh, and the
    cache tests reuse one load, so the reset export's name isn't pinned.
  - `now()`: the cache tests move the clock by +1000 (within the hour) and by +1 h +1000 (after it), which reads right
    in milliseconds or seconds.
  - The action's field set is exactly sub-decision 4's seven.
  - `src/lib/duty-menu` exports `normalizeMenuKey` (§ Implementation notes).
  - Local-only mode: the `isLocalOnly` seam (Amendment 1 item 2). The fakes also set the config value and
    `process.env.BRAINSTORM_PUBLISH_LOCAL_ONLY` (restored after) to the same value, except in U28, where only the seam
    disagrees.
- **Copy module:** words are found by value anywhere in its non-function exports, so the export's name and shape are the
  Implementer's.
- **Browser:** Playwright with every `/api` route mocked. Build the UI under test, serve it, then
  `BRAINSTORM_SERVER_ACCESSIBLE=true BRAINSTORM_BASE_URL=<origin> npx playwright test tests/brainstorm/assistant-duty-menu.spec.js --project=chromium`.
  **Not run here:** this container has no `node_modules` (no `@playwright/test`), no built UI and no stack. Each
  touched spec was instead loaded in Node with a stub `@playwright/test`, to prove its requires and constants resolve:
  `assistant-duty-menu` 12 tests, `assistant-attention` 7, `assistant-management-page` 26, `assistant-alert` 10,
  `assistant-profile-check` 5, `assistant-trusted-content` 7.
- **Firmware state:** none (no concept changes). **Live API:** none. The Duty Menu answer needs a signed-in session, so
  an anonymous GET never reaches it; the visitor answer is pinned by `assistant-attention` H1.
- **Fixtures:** `test/helpers/dutyMenuFixtures.js` (new: Nous' key, the header, § 8.1's filter, the budget, the cache
  hour, the cap of 50 event-named relays (Amendment 2), § Copy, the K1 oracle `expectedOffer`, canned answers, `withDutyMenu`). Re-aimed: `dutyCardsFixtures.js` and
  `assistantManagementFixtures.js` (note only).

## How to run

```
node -e "require('./test/assistant-duty-menu-check.test.js').run()"
node -e "require('./test/assistant-duty-menu-page.test.js').run()"
npm test            # then: npm run gate:status
```

For browser/e2e (needs a built UI, see above):
```
npm run test:playwright
```

## Verification

The new tests fail with the current code, confirmed on 2026-10-11 at commit `0592560f` plus this phase's test changes.
No failure is an import or syntax error in a test: each names the missing module, export or behavior, and the ADR clause.

**`test/assistant-duty-menu-check.test.js`: 1 passed, 51 failed.** The one pass is C6, a guard that holds before and
after (no marks for visitors, paired with a control). Excerpt:

```
FAIL  L1: the library exists, is CommonJS with no I/O, and exports the constants and the five functions; DUTY_MENU_KIND 39999, DUTY_MENU_D "duty-menu", DUTY_MENU_HEADE…
      src/lib/duty-menu/index.js does not exist. ADR 0001 sub-decision 1 creates it: the pure Duty Menu library (DUTY_MENU_KIND, DUTY_MENU_D, DUTY_MENU_HEADER, isDutyMenu, readMenuRows, normalizeMenuKey, sameRows, buildOffer).
FAIL  L11: buildOffer gives every relay in its one spelling — ownRelay and dlistRelay pass through normalizeRelayUrl (ADR 0001 Amendment 1 item 3)
      src/lib/duty-menu/index.js does not exist. ADR 0001 sub-decision 1 creates it: the pure Duty Menu library (DUTY_MENU_KIND, DUTY_MENU_D, DUTY_MENU_HEADER, isDutyMenu, readMenuRows, normalizeMenuKey, sameRows, buildOffer).
FAIL  U1: without an authenticated session the answer is { success: true, signedIn: false }, and no menu, Map or customer is looked up (AC-1)
      src/api/assistant/dutyMenu.js does not exist. ADR 0001 § Implementation notes creates it: checkDutyMenu, resolveOfferInputs, lookupPublishedMenu, evaluateDutyMenu, DUTY_MENU_CHECK_FAILED.
FAIL  U14: a relay named inside an event is read only when isPublicRelayHostWithin accepts its host — a refused hint, Assistant write relay or Nous write relay is neve…
      src/api/assistant/dutyMenu.js does not exist. ADR 0001 § Implementation notes creates it: checkDutyMenu, resolveOfferInputs, lookupPublishedMenu, evaluateDutyMenu, DUTY_MENU_CHECK_FAILED.
FAIL  U28: local-only mode is read through the isLocalOnly seam — injected true leaves Concepts off the DList relay though the environment and config say false; inject…
      src/api/assistant/dutyMenu.js does not exist. ADR 0001 § Implementation notes creates it: checkDutyMenu, resolveOfferInputs, lookupPublishedMenu, evaluateDutyMenu, DUTY_MENU_CHECK_FAILED.
FAIL  C1: the Duty Menu entry keeps its title, address, section and description, and its page now has the ADR's alert criteria and no planning notes (AC-4; ADR 0001 su…
      alertCriteria: want "If your Assistant has not published a Duty Menu, or the one it published differs from what this instance offers for it now.", got null; planningNotes: want null, got "Your Assistant will tell the world whic…
FAIL  C2: CHECKED_ACTIONS gains duty-menu right after outbox-relays, in ASSISTANT_ACTIONS order; the Treasure Map card is not checked (AC-4; ADR 0001 sub-decision 6)
      CHECKED_ACTIONS ["profile","identification-tags","outbox-relays","trusted-assertions","trusted-lists","dlists"]: duty-menu is not checked
FAIL  C3: the two readings for the Duty Menu — done: unmarked, in Done, not counted; pending (no menu, out of date, empty offer and no menu): marked and counted; unfin…
      done: marked want false, got true; done: in Done want true, got false; done: counted in the Alert want false, got 1 (alertCount 7, placeholders 6); done, empty offer and empty menu: marked want false, got true; done, empty offe…
FAIL  C5: the hub's count line and the Alert drop by one for a viewer whose Duty Menu is done — with every check done they count the placeholders only (AC-4; ADR 0001 …
      all done: the marks are the placeholders ["treasure-map","bounties","pins","tags","notifications-and-alerts","preferences"], got ["duty-menu","treasure-map","bounties","pins","tags","notifications-and-alerts","preferences"]; al…
PASS  C6: a visitor, or a signed-in viewer with no Assistant here, sees no mark, no Done and nothing counted, whatever the Duty Menu answer says (AC-4)
FAIL  S2: Nous' key is written once — in src/lib/nous.js — and the library and the check take it from there (ADR 0001 sub-decision 1: "the one definition of Nous' key")
      src/lib/nous.js does not exist: ADR 0001 sub-decision 1 makes it the one place the key is written
FAIL  S3: attention.js runs the duty-menu check as a fifth side-by-side check — a checkDutyMenu dependency, the key DUTY_MENU = "duty-menu" beside the others — and its…
      no checkDutyMenu dependency; no DUTY_MENU = "duty-menu" key constant; the header comment documents the duty-menu check
FAIL  S4: the OpenAPI document and BIBLE §11 describe the duty-menu action of GET /api/assistant/attention — its offer, published and current fields and the no-relay-a…
      the block names the duty-menu action; the block's schema has the offer field; the block's schema has the published field; the block's schema has the current field; the block names the no-relay-answered reason; BIBLE §11: the /a…
FAIL  S5: the check reads local-only mode through an isLocalOnly dependency whose default is the house reader, isPublishLocalOnly (ADR 0001 Amendment 1 item 2)
      src/api/assistant/dutyMenu.js does not exist
assistant-duty-menu-check: 1 passed, 51 failed, 0 skipped
```

**`test/assistant-duty-menu-page.test.js`: 0 passed, 10 failed.**

```
FAIL  P1: the copy module loads in Node and holds every sentence the story's § Copy gives this page, the exception "not offered", and the three category names (AC-5; §…
      ui/src/pages/assistant/dutyMenuCopy.js does not exist. ADR 0001 sub-decision 6 creates it: the story's words, categoryOf(key) and statusLine(answer).
FAIL  P5: no status line when the check did not finish — statusLine gives none for an unfinished answer, a check-failed one, or no answer at all; the reason line is th…
      ui/src/pages/assistant/dutyMenuCopy.js does not exist. ADR 0001 sub-decision 6 creates it: the story's words, categoryOf(key) and statusLine(answer).
FAIL  D1: App.jsx serves /assistant/duty-menu with the page — DutyMenuPage imported from ./pages/assistant/DutyMenu and given to ACTION_PAGES under duty-menu; the Trea…
      no `import DutyMenuPage from './pages/assistant/DutyMenu'`; ACTION_PAGES has no 'duty-menu': <DutyMenuPage />
FAIL  D2: the page reads the one shared answer — useAuth, useAssistantAttention, the hub's assistantAttention reading for its mark, the action's own entry — and takes …
      ui/src/pages/assistant/DutyMenu.jsx does not exist — ADR 0001 sub-decision 6 creates it
FAIL  D4: read-only and one request — the page never fetches, never calls refresh(), never polls, stores nothing, and publishes or signs nothing (AC-6; ADR 0001 sub-de…
      ui/src/pages/assistant/DutyMenu.jsx does not exist — these refusals need a real page to mean anything
FAIL  D5: the page's own words have one home — none of § Copy's sentences is typed into DutyMenu.jsx; it shows them from ./dutyMenuCopy (AC-5; § Copy)
      ui/src/pages/assistant/DutyMenu.jsx does not exist — the words must come from there
assistant-duty-menu-page: 0 passed, 10 failed, 0 skipped
```

**Before → after, per touched suite** (pass/fail/skip; before = gate run `20261011T192709Z-24550-ec0f`, after = gate run
`20261011T194947Z-28777-c03a`):

| Suite | Before | After | Why |
|---|---|---|---|
| `assistant-duty-menu-check` (new) | — | 1 / 51 / 0 | new; C6 is a guard (1 / 45 in the gate run, before Amendment 1's six tests) |
| `assistant-duty-menu-page` (new) | — | 0 / 10 / 0 | new (0 / 9 in the gate run, before P5) |
| `assistant-duty-cards` | 12 / 0 / 0 | 9 / 3 / 0 | **C4, C5, C7 fail, the re-aimed assertions only** (duty-menu checked; the Alert counts six placeholders); C3, C6, W1, S1 re-aimed and pass (the Treasure Map card) |
| `assistant-management-page` | 23 / 0 / 1 | 22 / 1 / 1 | **D4 fails, the re-aimed assertion only** (the Duty Menu's criteria and notes) |
| `assistant-identification-tags-page` | 16 / 0 / 0 | 16 / 0 / 0 | S3 re-aimed; passes before and after |
| `assistant-relay-list-publish` | 15 / 17 / 1 | 15 / 17 / 1 | S3 re-aimed, passes; the 17 failures are the baseline's missing `nostr-tools` |
| `assistant-attention` | 37 / 1 / 1 | 37 / 1 / 1 | stub added; L2 fails on the baseline's missing `nostr-tools` |
| `assistant-outbox-check` | 29 / 0 / 0 | 29 / 0 / 0 | stub added |
| `assistant-profile-check` | 32 / 1 / 0 | 32 / 1 / 0 | stub added; F1 fails on the baseline's missing `multer` |
| `assistant-trusted-content` | 29 / 1 / 0 | 29 / 1 / 0 | stub added; R2 fails on the baseline's missing `nostr-tools` |
| `assistant-alert` | 15 / 0 / 0 | 15 / 0 / 0 | reads the re-aimed hub fixture; unchanged |
| `stack-free-npm-test` | 6 / 0 / 1 | 6 / 0 / 1 | G5 (every suite registered) passes with the two new suites |

**Full gate.** Before (`npm run gate:status`): `20261011T192709Z-24550-ec0f [duty-menu-tester-baseline] … on 0592560f — FAIL, exit 1, 4545 passed, 650 failed, 585 skipped, 299/299 suites`.

After: `20261011T194947Z-28777-c03a [duty-menu-tester-after] … on 0592560f+dirty — FAIL, exit 1, 4542 passed, 708 failed, 585 skipped, 301/301 suites`.

The container has no `node_modules`, so the baseline is already red: 86 suites fail on `Cannot find module
'nostr-tools'` / `'multer'` and similar. Diffing the two records suite by suite, exactly four suites changed: the two new ones, `assistant-duty-cards` (C4, C5, C7) and `assistant-management-page` (D4). The other 297 have the same verdict and the same pass, fail and skip counts. The totals add up: failures +58 = 45 + 9 + 3 + 1; passes −3 = +1 − 3 − 1.

**After Amendment 1.** The gate runs above predate Amendment 1's tests. Since then only three files changed: the two
new suites (L5, L6 tightened; L11, U28–U30, S4, S5 and P5 added; clearer failure wording in S2, D4 and D5) and the new
browser spec (B7's row, B8 and B9). No shared fixture or other suite changed, so no other suite can have moved. Rerun
on 2026-10-11: `assistant-duty-menu-check` 1 / 51, `assistant-duty-menu-page` 0 / 10, `assistant-duty-cards` 9 / 3
(C4, C5, C7), `assistant-management-page` 22 / 1 / 1 (D4) — the last two unchanged from the gate run.

**Satisfiable and discriminating.** In a throwaway copy of the repo in the session scratchpad (never in this tree, and
not committed or handed over), a minimal sketch of ADR 0001's modules (with Amendment 1, and the `openapi.yaml` and BIBLE lines) makes all 52 check
tests and all 10 page tests pass,
and every re-aimed suite pass apart from its baseline environment failures. Mutating the sketch turns the intended
tests red:

| Mutation | Tests that turn red |
|---|---|
| no SSRF guard | U14 |
| no Nous cache | U21 |
| caching a miss | U22 |
| an older valid menu wins | U16 |
| no `outsideOnly` | U12, U13 |
| inactive customers get Scores | U7 |
| guarding configured relays | U14 |
| reading read-only 10002 relays | U12 |
| no relay budget | U19 |
| a throwing customer lookup | U8 |
| unfinished drops the offer | U18 |
| an empty offer with no menu counts as done | U26 |
| local-only ignored | U10 |
| dedupe before the drops | L5, L6 and others |
| a `p` count ignored | L4, U16 |
| a `z` prefix match | L4 |
| Concept keys trimmed | L5–L7, U23 |
| an order-sensitive `sameRows` | L8, U23 |
| Lists as `3039x` | L9, L10, U5 and others |
| `39998:` kept | L6 |
| `*` as Scores only | P2, P3 |
| `statusLine` ignoring `current` | P4 |
| `CHECKED_ACTIONS` out of order | C2 |
| `treasure-map` checked | C2, C4, C5 |
| offer relays not normalized | L11 |
| an `https://` duty relay kept | L6, U30 |
| a not-offered relay of `''` | L5, L6, U30 |
| local-only read from env, not the seam | U28, S5 |
| a status line when unfinished | P5 |
| the BIBLE row without the duty-menu check | S4 |
| `openapi.yaml` without the `current` field | S4 |

The sketch was rebuilt for Amendment 1 in a fresh scratch copy and deleted after this check. With it,
`assistant-duty-cards` passed 12 / 0, `assistant-management-page` 23 / 0 / 1 and `assistant-outbox-check` 29 / 0; the
attention and relay-list-publish suites showed only their baseline environment failures.

### Amendment 2 (2026-10-11, after Implementation, before Review)

The implementation landed at `b2477a93` on `staging` (`7f9fdf92` before a rebase; gate `20261011T202823Z-11237-12cc`: PASS, 5661 passed, 0 failed). ADR 0001
Amendment 2 followed at `2a4e63ab` (`6f9bd983` before a rebase). Gate records quoted below keep the hashes they ran
on, which are pre-rebase. This round added L12, U31, U32 and P6, changed the fixture's none line (which P1 and
D5 read) and browser B6, and added `MAX_EVENT_RELAYS` to the fixture.

Against the implementation, only the new or changed tests fail, each because the implementation predates the amendment:
it has no fifth § 6.1 condition, no cap (it guards and reads all 70 relays), and the old none sentence.

```
FAIL  L12: isDutyMenu refuses an otherwise conforming menu that carries ["z", "list"], or a z naming a concept-header (39998:<64 hex>:concept-header, Nous' or anyone's…
      ["z", "list"]: want false (not a menu); a z naming Nous' concept-header: want false (not a menu); a z naming another author's concept-header: want false (not a menu); the concept-header z before Nous' z: want false (not a menu)
FAIL  U31: when the newest version carries ["z", "list"] or a concept-header z, the Assistant has no menu — published null, pending — though an older conforming versio…
      ["z", "list"]: want finished, published null, pending; got {"finished":true,"done":true,"pending":false,"reason":null,"offer":[{"tag":"duty","key":"30392","relay":"wss://tapestry.example/relay"},{"tag":"duty","key":"30393","relay":"wss://tapestry.example/re…
FAIL  U32: at most 50 relays named inside events are guarded and read per check — the first 50 after normalizing, outsideOnly and de-duplication, in § 8.1's order (Map…
      isPublicRelayHostWithin was asked 70 times, want at most 50; the guard is asked about exactly the first 50: 20 beyond them (e.g. ["write-10.example","write-11.example","write-12.example"]), 0 of them not asked (e.g. []); 70 event-named relays read, want at …
assistant-duty-menu-check: 52 passed, 3 failed, 0 skipped
FAIL  P1: the copy module loads in Node and holds every sentence the story's § Copy gives this page, the exception "not offered", and the three category names (AC-5; §…
      missing, word for word: "No Duty Menu was found for your Assistant."
FAIL  P6: the published panel's none line and the not-published status line are two sentences — "No Duty Menu was found for your Assistant." in the copy module, and st…
      the copy module holds the none line "No Duty Menu was found for your Assistant."
assistant-duty-menu-page: 9 passed, 2 failed, 0 skipped
```

Full gate, `npm run gate:status`: `20261011T203927Z-16078-299a [duty-menu-tester-amendment2] … on 6f9bd983+dirty — FAIL,
exit 1, 5660 passed, 5 failed, 582 skipped, 301/301 suites; failed: assistant-duty-menu-check, assistant-duty-menu-page`.

Diffed suite by suite against the implementation's green run, only those two suites changed:
- `assistant-duty-menu-check` went from 52 / 0 to 52 / 3 (L12, U31, U32);
- `assistant-duty-menu-page` went from 10 / 0 to 9 / 2 (P1, P6).

Every other suite has the same counts, `assistant-duty-cards` (12 / 0) and `assistant-management-page` (23 / 0 / 1)
included. The totals add up: 5661 + 4 new tests = 5660 + 5.

**Satisfiable.** I patched a throwaway copy of the tree in the session scratchpad, and deleted it after this check:
- `isDutyMenu` refuses `["z", "list"]` and a `39998:<64 hex>:concept-header` z;
- the event-named relays are cut to the first 50 after `outsideOnly`, before the guard;
- the copy's none line is the new sentence.

With those patches the check suite passes 55 / 0 and the page suite 11 / 0; `assistant-duty-cards` passes 12 / 0 and
`assistant-management-page` 23 / 0 / 1.
