# Test Plan: Story 1 — Scores, Lists and Concepts on the hub

**Story:** `engineering-team/stories/assistant-trusted-content-status/1-scores-lists-and-concepts-on-the-hub.md`
**ADR:** `engineering-team/decisions/assistant-trusted-content-status/0001-scores-lists-and-concepts-join-the-one-attention-answer.md`
**Date:** 2026-10-08

## Coverage map

Node suite `test/assistant-trusted-content.test.js` (registered in `test/registry.js`); browser suite
`tests/brainstorm/assistant-trusted-content.spec.js`, plus SV17 in `tests/brainstorm/treasure-map-save.spec.js` (it owns
the save flow's signer, relay and publish mocks). Shared words and answer shapes: `test/helpers/trustedContentFixtures.js`.

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 the names | C4 the section's order (Scores, Lists, Concepts, Bounties, Pins, Tags); keys, addresses, descriptions and NIP links unchanged; the rule as alert criteria; the link to `/treasure-map` · C5 `actions.js` keeps one import, which carries `MANAGE_TREASURE_MAP_PATH` · re-aimed `assistant-management-page` D2/D4 (titles, criteria, links from the shared fixtures) · TC1 the hub shows the three names in order, no old name · TC5 ×3 each page's title, criteria and link, which opens `/treasure-map` · re-aimed `assistant-management-page.spec` B1/B8 | `test/assistant-trusted-content.test.js`, `test/assistant-management-page.test.js`, `tests/brainstorm/assistant-trusted-content.spec.js`, `tests/brainstorm/assistant-management-page.spec.js` | unit (ESM) · browser |
| AC-2 one answer, the viewer's own, read-only | U7 the outside relays are asked for the viewer's 10040 only, never this instance's own relay · U8 the local scan asks for the viewer's 10040; others' Maps never count · U12 exactly the three keys and six fields, no pubkey · A1 the three keys in the one answer, the check run once for the session's viewer and Assistant, query parameters ignored · A3 nothing for a visitor or a viewer with no Assistant; the default dependency is wired · S1 never writes, no request read, `/setup`'s read reused, no TA literal · S2 openapi + BIBLE §11 | `test/assistant-trusted-content.test.js` | unit (DI) · source |
| AC-3 the rule | R1 the rule's one home is import-free and environment-free, with its exports · R2 the Treasure Map page re-exports the very same functions and defines none · R3 the moved rule reads a Map as before · U1 done / not-assigned / other-assistants-only · U2 Mixed is done, in every category and spelling · U3 `*` alone; `*` hidden by a bare `3038x` for Scores only; `*:tag` never counts · U4 a backup does not count · U5 case-blind pubkeys; junk entries count for nobody · U9 the newest local Map decides · U11 `evaluateTrustedContent`'s table · U13 the loader returns the one rule by identity · U14 key → category map · A4 end to end through the real check and loader | `test/assistant-trusted-content.test.js` | unit (ESM, DI) |
| AC-4 finished | U6 no Map anywhere → finished `no-map` · U10 unfinished: `local-unreadable` (and no outside read), `no-outside-relays`, `outside-unreachable` · TC3 an unfinished category is marked but not in the pill | `test/assistant-trusted-content.test.js`, `tests/brainstorm/assistant-trusted-content.spec.js` | unit (DI) · browser |
| AC-5 the hub reads it | C1 `CHECKED_ACTIONS` gains the three, in order · C2 the two readings per key and reason (no answer, checking, failed, each unfinished reason, check-failed: marked, not counted; each pending reason: marked, counted; done: in `done`, neither) · C3 nothing for visitors / no Assistant · D2 the Done look (copy, `is-done`, ✓, the green badge, the CSS rule) · A2 a throwing check is `check-failed` and leaves Identification Tags intact · TC2 all done: Done, out of the count and pill · TC3 one of each · TC4 the screen-reader names | `test/assistant-trusted-content.test.js`, `tests/brainstorm/assistant-trusted-content.spec.js` | unit · source · browser |
| AC-6 it catches up | D1 the provider's listener refreshes on a kind 10040 by the viewer, keeps the tagging rule, never polls · SV17 save a Map on `/treasure-map`, reached in-app from the Scores card's page; the attention answer is asked again; back on the hub, in the same document, Scores says Done | `test/assistant-trusted-content.test.js`, `tests/brainstorm/treasure-map-save.spec.js` | source · browser |

## Edge cases

- [x] A Map that names the viewer's Assistant only as a backup (U4): it does not count, as the card shows only the first.
- [x] The all-duties `*` hidden by a bare family entry, and a `*:…` scope (U3, R3).
- [x] Upper-case delegate pubkeys; delegates that aren't 64-hex; tags that aren't arrays (U5).
- [x] A Map signed by someone other than the viewer, handed back by the local relay (U8).
- [x] Two of the viewer's Maps locally, and an older and a newer Map on two outside relays (U9, U7).
- [x] This instance's own relay in the Map relay list (U7, U10 `no-outside-relays` with only loopback relays).
- [x] An unreadable local relay never falls through to the outside relays (U10).
- [x] The rule module fails to load: the check rejects (U13), and the handler answers `check-failed` for all three (A2).
- [x] Another book's check (`checkProfile`) present or not: A-class fakes stub it, so the suite holds in either order.

## Not covered (and why)

- **The loader's memo being cleared after a failed load** (ADR 0001 sub-decision 5). It would need the module path to be
  injectable, which the ADR doesn't call for; U13 pins the observable half (a failed load rejects, the handler isolates it).
- **The real relays and a real Map.** Every read is injected (the house pattern for `/api/assistant/attention`); no live
  H-class test, since an anonymous GET never reaches this check (the visitor answer is pinned by the existing
  `assistant-attention` H1).
- **SV17 before implementation fails at its first step** (no "Scores" card yet), not at the re-check itself. The re-check
  is pinned pre-implementation by D1.

## Re-aimed suites (this phase, not Phase 4)

- `test/helpers/assistantManagementFixtures.js`: the three entries' titles, alert criteria and `editLink` come from
  `trustedContentFixtures.js`.
- `test/assistant-attention.test.js` `fakes()` and `test/assistant-profile-check.test.js` `attentionFakes()`: stub
  `checkTrustedContent`, so they stay about their own action and read no relay.
- `test/assistant-profile-check.test.js` C3: its "placeholder that says done" is Bounties (Trusted Lists is checked now).
- `tests/brainstorm/assistant-alert.spec.js`, `assistant-management-page.spec.js`, `assistant-attention.spec.js`,
  `assistant-profile-check.spec.js`: every mocked answer carries the three as pending (no Map), which marks and counts them
  as the placeholders were, so their counts hold. `assistant-management-page.spec` B8 checks each page's own link.
  `assistant-attention.spec` B4 (the fetch fails) counts five placeholders, the end state once this book and
  assistant-profile-checklist #1 have both landed.
- `tests/brainstorm/treasure-map-save.spec.js`: `setup()` takes `attention` (answers in turn); without it the route answers
  as before.
- *Added at Phase 4 (Tester lane, its own commit):* `test/treasure-map-edit-mode.test.js` W4 and
  `test/treasure-map-card-details.test.js` S1 read `categoryAssistants`' JSDoc and body from the *source* of
  `manageTreasureMap.js`; they now read `src/lib/treasureMapCategories.mjs`, where the rule moved. The ADR's § For the
  Tester named this class of pin; Phase 3 missed these two.
- *Corrected at Phase 4 (Tester lane, its own commit), two bugs in this plan's own browser tests, found on the first run
  against the implementation:* TC4 built the marked card's accessible name as `Needs attention:Lists` (the shared
  fixture's prefix has no trailing space; the page reads `Needs attention: Lists`); SV17 saved under the local-only
  policy, whose ending is the kept-local report, not the "Treasure Map updated" confirmation it waited for — it now saves
  as SV2 does. SV17 was then confirmed to fail on a build without the 10040 re-check, at "the attention answer is asked
  again after the save".

## Test infrastructure

- Node's runner through the gate (`npm test`). The server check is driven through the dependencies ADR 0001 names:
  `scanLocal`, `readRelay`, `getConfigFromFile`, `mapDefaultRelays`, `loadCategoryRule`; the handler takes
  `checkTrustedContent`. Stack-free: no strfry, no relay, no network.
- **Seams this plan pins where the ADR left a detail open:** `checkTrustedContent({ viewer, assistantPubkey }, deps)`
  reads `deps.loadCategoryRule` (A4 relies on `attention.js`'s `defaultDeps()` supplying the real one);
  `TRUSTED_CONTENT_ACTIONS` is the key → category object; `evaluateTrustedContent` returns all three keys for every
  input.
- Browser: Playwright, every `/api` route mocked. Build the UI under test and serve it, then
  `BRAINSTORM_SERVER_ACCESSIBLE=true BRAINSTORM_BASE_URL=<origin> npx playwright test <spec> --project=chromium`.
- Firmware state: none (no concept changes).
- Fixtures: `test/helpers/trustedContentFixtures.js` (new), `test/helpers/assistantManagementFixtures.js` (re-aimed).

## How to run

```
npm test
```

For browser/e2e:
```
npm run test:playwright
```

## Verification

The new tests fail with the current code. Confirmed on 2026-10-08 at commit `354c39a4` plus this phase's test changes.

Node, `test/assistant-trusted-content.test.js`: **0 passed, 30 failed**. The modules are missing, the three are
placeholders with their old words, and there is no Done look and no 10040 re-check. No import or syntax error. For
example:

```
FAIL  R1: src/lib/treasureMapCategories.mjs exists, has no import or require …
      src/lib/treasureMapCategories.mjs does not exist. ADR 0001 sub-decision 1 moves the Treasure Map page's category rule there.
FAIL  U1: a Map on this instance's relay — Scores to the viewer's Assistant only is done; …
      src/api/assistant/trustedContent.js does not exist. ADR 0001 sub-decision 5 creates it: …
FAIL  A1: the one answer carries Scores, Lists and Concepts under their action keys …
      the handler — trusted-assertions: want {"category":"scores","finished":true,"done":true,…}, got undefined; …
FAIL  C1: CHECKED_ACTIONS includes trusted-assertions, trusted-lists and dlists …
      CHECKED_ACTIONS ["identification-tags"]: missing trusted-assertions; missing trusted-lists; missing dlists
FAIL  C4: the three entries — first in Publication of Trusted Content, titled Scores, Lists, Concepts …
      trusted-assertions title: want "Scores", got "Trusted Assertions"; … editLink: want {"text":"Manage your Treasure Map →","to":"/treasure-map"}, got null; …
FAIL  D1: the provider re-asks after a Map save …
      the listener never looks at kind 10040; …
```

Re-aimed Node suites, against a clean export of this branch's base (`git archive HEAD`) versus the branch:
`assistant-attention` 39/0 → 39/0; `assistant-alert` 15/0 → 15/0; `assistant-identification-tags-page` 16/0 → 16/0;
`manage-treasure-map-cards` 31/0 → 31/0. `assistant-management-page` 24/0 → 22/2: D2 and D4 now want the new titles,
criteria and link (AC-1). `assistant-profile-check` 33 failed → 33 failed: it is assistant-profile-checklist #1's
pre-implementation suite, unchanged in outcome. `stack-free-npm-test` 6/1 → 6/1: G2 needs the live control panel and
fails the same on the base; G5 (every suite registered) passes.

Browser, against this branch's UI built before implementation and served with `vite preview` (chromium):
`assistant-trusted-content.spec.js` TC1–TC5: **7 failed**, each on the old titles (for example `Expected: "Scores" /
Received: "Trusted Assertions"`, `the Scores card is on the hub — Expected: 1, Received: 0`). In
`treasure-map-save.spec.js`, SV17 fails ("Scores needs attention before the save — element(s) not found"); SV1–SV16 pass
with the new `setup()` option. Re-aimed specs: `assistant-alert` all pass; `assistant-attention` all pass except B4, which failed
before this phase's re-aim too (it expected 8, already assuming assistant-profile-checklist #1's implementation) and now
expects the five placeholders;
`assistant-management-page` B1 and B8 ×3 fail on the old words (AC-1), the rest pass.
