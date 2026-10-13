# Test Plan: Story 3 — One name for your Assistant's Treasure Map

**Story:** `engineering-team/stories/assistant-self-map/3-one-name-for-your-assistants-treasure-map.md`
**ADR:** none. The owner skipped Architecture at the Planning gate: § Copy names every line, and nothing under the hood
moves.
**Date:** 2026-10-13

## How the tests carry § Copy

Every suite of this epic reads the words from one place, `test/helpers/selfMapFixtures.js`. Story 3 re-aims that file
to § Copy's "New" column:
- the hub's criteria line (`ALERT_CRITERIA`, which `dutyCardsFixtures.js` also reads for the hub's own suites);
- the page's lines (`PAGE`: two reasons, the false listing, both headings, the empty and none lines, could not check,
  the three status lines, the Owner's line, the public line);
- the press's words (`PRESS`: the subject, the three buttons, the three state lines, the Owner's note, the line after a
  Turn off, the three "nothing was published" messages, the not-signed-in refusal).

Story 1's and story 2's § Copy keep the words as they were approved; the fixture notes the re-aim beside each block.

So every existing test that compares a line, word for word, now checks the new line. The tests that check *when* each
line and button shows, and what a press does, are untouched, and they must still pass with the new words. That is
AC-4's main evidence.

## Coverage map

| Criterion | Test | File | Level |
|---|---|---|---|
| AC-1, the page's words | P1, P2, P4 (story 1's lines, word for word); Q1, Q2 (story 2's lines) — re-aimed | `test/assistant-self-map-page.test.js` | unit |
| AC-1, no old name | **N1:** no string the copy module gives (every sentence, the Owner's line with a count, every line `statusLine`, `selfMapStateLine`, `reasonLine` and `couldNotCheckLine` return) contains "self-Map" or "self-entries" | `test/assistant-self-map-page.test.js` | unit |
| AC-1, no old name in the page's code | **N2:** outside comments, `AssistantTreasureMap.jsx` and the copy module contain no "self-Map" or "self-entries" | `test/assistant-self-map-page.test.js` | source sentinel |
| AC-1, AC-3, on screen | **N6:** the page in ten states, then after a Turn off's report, then the hub: no sentence on screen says "self-Map" or "self-entries". The states are signed out, the request failing, unfinished, check failed, nothing listed, up to date (Owner), out of date, off, off while still listing, a customer | `tests/brainstorm/assistant-self-map.spec.js` | browser |
| AC-1, on screen, word for word | B6, B13–B24 read each line through the re-aimed fixtures | `tests/brainstorm/assistant-self-map.spec.js` | browser |
| AC-2, the press's words | P1 (`SELF_MAP_SUBJECT`, `WORDS`), P2 (not signed in), E3, E4, E7 (each "nothing was published"), C2 (local failure), W6 (local-only), W7 (the summary, no other relay) — re-aimed | `test/assistant-self-map-publish.test.js` | integration (faked deps) |
| AC-2, no old name | **N4:** thirteen presses (a publish with relay rows, a Turn off that publishes, local-only, no other relay, a failed local write, already current, nothing to claim, nothing claimed, not signed in, no Assistant, a bad request, not read, a throw). No string in any answer says "self-Map"; nor do the exported subject and refusal words | `test/assistant-self-map-publish.test.js` | integration (faked deps) |
| AC-3, the hub's words | C1 (the criteria line, word for word) — re-aimed; the hub's own suites through `dutyCardsFixtures.js` | `test/assistant-self-map-check.test.js` and the hub suites | unit |
| AC-3, no old name | **N5:** no string anywhere in the hub module's exports says "self-Map" | `test/assistant-self-map-check.test.js` | unit |
| AC-4, only words change | **N3:** the copy module keeps every key path, kind of value and export it had before story 3 (listed in the test) | `test/assistant-self-map-page.test.js` | unit |
| AC-4, the same states, buttons, requests and answers | every existing test of the three suites and the browser spec, unchanged apart from the words they read (Q2's and Q3's state and button rules, B12–B24's shown and enabled buttons, the press's E, R, C, K, M, W tests, the answer's fields) | as listed | all |

## Edge cases

- **Lines built from parts.** The report's summary comes from the shared publish summary with the press's subject;
  W7 and N4 check the assembled sentence, not only the constant.
- **The Owner's line** is a function of the count; N1 calls it.
- **Comments and code names may keep "self-Map"** (story 3 § Out of scope). N2 strips comments and checks only what is
  left. The hyphenated form appears in no code identifier, so a hit there is a string a person could read.
- **The person's own Treasure Map.** "Your Treasure Map" lines are unchanged; nothing here checks them differently.

## Test infrastructure

- Node suites: the repo's runner (`npm test`), read through `npm run gate:status`. The choice file goes to a temp path
  (`TAPESTRY_SELF_MAP_CHOICE_PATH`), never `/var/lib/brainstorm`.
- Browser: Playwright against a built UI served by `vite preview`, as for story 2 (the spec mocks every `/api` route).
- Fixtures: `test/helpers/selfMapFixtures.js` (re-aimed), `test/helpers/dutyCardsFixtures.js` (reads the criteria from
  it).

## How to run

```
GATE_LABEL=<label> npm test
npm run -s gate:status -- --label <label>
```

For the browser half, from `ui/`, build and serve, then from the repo root:
```
BRAINSTORM_BASE_URL=http://localhost:4184 BRAINSTORM_SERVER_ACCESSIBLE=true PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
  npx playwright test tests/brainstorm/assistant-self-map.spec.js --project=chromium
```

## Verification

**On `8650d48` with these tests, 2026-10-13:**
- **The Node gate:** `20261013T201638Z-15395-294c [s3-phase3] — FAIL, exit 1, 5971 passed, 20 failed, 582 skipped,
  308/308 suites; failed: assistant-management-page, assistant-duty-cards, assistant-self-map-check,
  assistant-self-map-page, assistant-self-map-publish`. Every failure is a line in its old words:
  - page: P1, P2, P4, Q1, Q2 (a line not word for word), N1, N2 (the old name in the copy module);
  - check: C1 (the criteria line), N5 (the old name in the hub module);
  - publish: P1, P2, E3, E4, E7, C2, W6, W7 (the press's words), N4 (the old name in what a press says);
  - the hub's own suites: `assistant-management-page` D4 and `assistant-duty-cards` C3, which read the criteria line
    through `dutyCardsFixtures.js`.

  N3 passes, as it should: it guards that the copy module keeps its shape (AC-4).
- **The browser half,** against story 2's build (`ui/` is unchanged since): 19 failed, 102 passed, 5 skipped. The 19
  are B5–B7, B9, B11–B24, which look for a new line, and N6. N6 lists 62 old-name sentences on screen, across every
  state and after a Turn off's report.
- **The tests can pass.** I checked against a throwaway prototype in a scratch worktree, which swapped exactly § Copy's
  lines in the copy module, the hub module and the press. It was never committed and has been deleted.
  - Node: self-map page 22/0, check 87/0, publish 92/0; management page 23/0 (1 skipped, as before); duty cards 12/0;
    Duty Menu 65/0 and 36/0; attention 38/0 (1 skipped).
  - Browser, the self-Map spec and the nine hub specs against its build: **121 passed, 5 skipped** (the 120 of story 2
    plus N6).
  - Two mutants of it are caught: the Owner's line left in its old words (N1, N2), and the nothing-claimed message left
    in its old words (E7, N4).

**What no screen shows.** The hub card's criteria line is shown only on the generic action page; the Treasure Map has
its own page. So AC-3 is pinned in the hub module (C1, N5, the hub suites), and N6 guards the hub's visible text.
