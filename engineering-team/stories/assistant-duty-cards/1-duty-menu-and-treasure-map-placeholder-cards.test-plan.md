# Test Plan: Story 1 — The hub's Duty Menu and Your Assistant's Treasure Map cards, as placeholders

**Story:** `engineering-team/stories/assistant-duty-cards/1-duty-menu-and-treasure-map-placeholder-cards.md`
**ADR:** `engineering-team/decisions/assistant-duty-cards/0001-two-placeholder-entries-in-the-one-action-list.md`
**Date:** 2026-10-11

## Coverage map

The new Node suite is `test/assistant-duty-cards.test.js` (stack-free). The browser half is the existing hub specs,
which loop over the shared hub fixture's actions, so they pick the two cards up from it.

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 | C1: thirteen actions; Duty Menu, then Your Assistant's Treasure Map, close the persona section right after Outbox Relays; the other eleven keep their order | `test/assistant-duty-cards.test.js` | unit (ESM module) |
| AC-1 | C2: each card's section, address, title and description, with no link in the description | `test/assistant-duty-cards.test.js` | unit |
| AC-1 | D2 (re-aimed): the thirteen actions in order, with their words | `test/assistant-management-page.test.js` | unit |
| AC-1 | B1 (via fixture): the hub shows the five persona cards in order, each linking to its address | `tests/brainstorm/assistant-management-page.spec.js` | browser |
| AC-1 | B5 (via fixture): a click anywhere on a card opens its page | `tests/brainstorm/assistant-management-page.spec.js` | browser |
| AC-2 | C3: no alert criteria (the page shows "Not yet defined."), the approved planning notes, no link (not to `/treasure-map`, not anywhere) | `test/assistant-duty-cards.test.js` | unit |
| AC-2 | W1: neither key has a built page in `ACTION_PAGES`, and every action's route is still generated from `ASSISTANT_ACTIONS`, so both route to the placeholder | `test/assistant-duty-cards.test.js` | source |
| AC-2 | W2: the server's probe filter lets both addresses through to the app's catch-all | `test/assistant-duty-cards.test.js` | unit |
| AC-2 | B8 `/assistant/duty-menu` and B8 `/assistant/treasure-map` (via fixture): heading, "Placeholder page.", description, "Not yet defined.", planning notes, way back, no editor link | `tests/brainstorm/assistant-management-page.spec.js` | browser |
| AC-2 | B11 (via fixture): every address loads when typed in and when refreshed | `tests/brainstorm/assistant-management-page.spec.js` | browser |
| AC-2 | H1 (via fixture; guard): the reachable instance serves the app at all fifteen addresses | `test/assistant-management-page.test.js` | live (skips without a stack) |
| AC-3 | C4: `CHECKED_ACTIONS` unchanged; neither card in it | `test/assistant-duty-cards.test.js` | unit |
| AC-3 | C5: with every checked action done, the marks, the count line and the Alert are exactly the placeholders, including both cards; Done is the checked actions only | `test/assistant-duty-cards.test.js` | unit |
| AC-3 | C6: an answer claiming either card is done or pending changes nothing; still marked, counted once, never Done | `test/assistant-duty-cards.test.js` | unit |
| AC-3 | C7: no answer yet, or a failed one: both marked and counted in the Alert | `test/assistant-duty-cards.test.js` | unit |
| AC-3 | C8: a visitor, or a viewer with no Assistant: no marks, nothing counted, whatever the answer | `test/assistant-duty-cards.test.js` | unit |
| AC-3 | B1, B2, B4 (via fixture): marks and "13 actions need attention" for a viewer with an Assistant; none for a visitor or while sign-in resolves | `tests/brainstorm/assistant-management-page.spec.js` | browser |
| AC-3 | B1, B5, B6 (via fixture): the pill reads "13 actions need attention", matching the hub's marks | `tests/brainstorm/assistant-alert.spec.js` | browser |
| AC-4 | S1: the three sections unchanged; the server's attention answer has no check for either card | `test/assistant-duty-cards.test.js` | unit + source |
| AC-4 | S2: the person's Treasure Map page stays at `/treasure-map`, and no hub action takes that address | `test/assistant-duty-cards.test.js` | unit |
| AC-4 | D3–D5, D10 and the rest of the hub suites (re-aimed only through the fixture): the other actions' words, links, notes, the FAQ and the count wording unchanged | `test/assistant-management-page.test.js` and others | unit |

Every "nothing else changes" test (C4, W1, W2, S1, S2) first requires the two entries to exist. So none of them
passes merely because the cards are missing (workflow 3, "Common pitfalls").

## Edge cases

- [x] A server answer that claims a placeholder is done or pending (forged, or a future server key arriving before the
      UI is built): C6.
- [x] No answer yet, and a failed answer: C7.
- [x] A visitor, and a signed-in viewer without an Assistant: C8.
- [x] The address opened directly, and refreshed: W2 (probe filter), B11 and H1 (browser and live server).
- [x] The person's `/treasure-map` is not confused with the Assistant's: C3 (no link) and S2 (no shared address).
- [ ] Concept Graph API unavailable / handle not found: not applicable. The story reads no concept.

## Test infrastructure

- Test framework: Node's built-in runner through the gate (`npm test`, entry `test/test.js`). The new suite is
  registered in `test/registry.js`. Playwright covers the browser half.
- Concept Graph API: not used. No firmware precondition.
- Fixtures:
  - `test/helpers/dutyCardsFixtures.js` (new): the two cards' approved words, their keys, the persona order, all
    thirteen keys in order, and the checked actions.
  - `test/helpers/assistantManagementFixtures.js` (re-aimed): `ACTIONS` gains the two cards after Outbox Relays,
    taken from the new fixture. Every hub suite and spec reads this one list, so one copy of the words serves all.
- Re-aimed literal pins (each says so in its title or a comment):
  - `test/assistant-management-page.test.js`: D2 (11 → 13), D3's title (seven → nine without a link) and H1's title
    (thirteen → fifteen addresses);
  - `test/assistant-outbox-check.test.js` C1: 11 → 13. The persona section's first three are still Profile,
    Identification Tags and Outbox Relays;
  - `test/assistant-identification-tags-page.test.js` R2: title only;
  - `tests/brainstorm/assistant-management-page.spec.js`: the B1, B8 header and B11 titles;
  - `tests/brainstorm/assistant-alert.spec.js`: the B1 title;
  - `tests/brainstorm/assistant-outbox-relays.spec.js` B1: the persona section held exactly 3 cards. It now holds
    as many as the fixture's persona entries, and Outbox Relays is still the third. Added at Implementation, as a
    kick-back to Test Design: the browser half of the Node C1 re-aim above, missed in the first pass and caught by
    the green browser run (see § Verification).
- Not covered by a test: ADR sub-decision 5, the count-free code comments. A comment carries no behaviour, so the
  Reviewer checks it by reading.
- Browser run without the Docker stack:
  - build the UI (`cd ui && npx vite build`);
  - serve `dist/` with an SPA fallback on `:7778` (a throwaway Express server that answers 404 under `/api`, as
    `bin/control-panel.js`'s catch-all serves the app). The specs mock every API call they make.

## How to run

```
npm test
node -e "require('./test/assistant-duty-cards.test.js').run()"
```

For the browser half:

```
cd ui && npx vite build && cd ..
# serve dist/ with an SPA fallback on :7778 (or point BRAINSTORM_BASE_URL at a running instance), then:
npx playwright test tests/brainstorm/assistant-management-page.spec.js tests/brainstorm/assistant-alert.spec.js --project=chromium
```

## Verification

The new tests fail with the current code, each because the two entries are missing. Nothing fails from a typo or a
load error. Confirmed on 2026-10-11 at commit `8934a574`.

**Baseline** (the same commit with none of these test changes): gate record `20261011T153551Z-6371-269c`. Overall
PASS: 5587 passed, 0 failed, 582 skipped, 298 suites.

**With the failing tests**: gate record `20261011T154047Z-11232-4429`. Overall FAIL: 5581 passed, 18 failed, 582
skipped, 299 suites. Every failure:

```
assistant-duty-cards: FAIL (0 passed, 12 failed, 0 skipped)
  C1   thirteen actions, got 11; the actions in order: want [...,"outbox-relays","duty-menu","treasure-map","trusted-assertions",...], got [...,"outbox-relays","trusted-assertions",...]
  C2–C8, W1, W2, S1, S2
       ASSISTANT_ACTIONS has no entry with key "duty-menu" or "treasure-map" (ADR assistant-duty-cards/0001 sub-decisions 1–2)
assistant-management-page: FAIL (19 passed, 4 failed, 1 skipped)
  D2   expected exactly 13 actions (...; assistant-duty-cards #1 a fourth and fifth), got 11
  D3, D4, D10
       the fixture's entries from position 4 on meet the module's entries one place earlier
       (e.g. "Duty Menu: want [], got [NIP-85 Trusted Assertions]")
  H1   SKIP: no live instance
assistant-outbox-check: FAIL (28 passed, 1 failed, 0 skipped)
  C1   thirteen actions, got 11
assistant-identification-tags-page: FAIL (15 passed, 1 failed, 0 skipped)
  R2   13 actions, as the hub fixture lists them
```

Gate totals: 5581 + 18 = 5599 = 5587 + the 12 new tests. No other suite changed.

**Browser half**: the UI was built from `8934a574` and served on `:7778`, then the two hub specs were run on
chromium. Result: 10 failed, 23 passed, 3 skipped (the three built pages' B8 entries, skipped as before). The 10
failures:

```
management B1   "Your Assistant's Public Persona" holds 5 card(s) — Expected: 5, Received: 3
management B2   the "Duty Menu" card is still there — Expected: 1, Received: 0
management B4   once sign-in resolves, the marks and the count arrive ("13 actions need attention") — not found
management B5   "Duty Menu" is an <a href="/assistant/duty-menu"> — Expected: 1, Received: 0
management B8   /assistant/duty-menu is a page — "Page not found" Expected: 0, Received: 1
management B8   /assistant/treasure-map is a page — "Page not found" Expected: 0, Received: 1
management B11  /assistant/duty-menu (typed in) — "Page not found" Expected: 0, Received: 1
alert B1        Expected substring "· 13 actions need attention", Received "… · 11 actions need attention …"
alert B5        every action needs attention in this mock — Expected: 13, Received: 11
alert B6        1280px: the count shows ("13 actions need attention") — not found
```

**Amendment at Implementation (2026-10-11).** The first browser run against the implemented build (six hub specs on
chromium) failed one test that this plan had missed:

```
assistant-outbox-relays B1   persona listitems — Expected: 3, Received: 5
```

It is the browser twin of the Node C1 re-aim. It was re-aimed the same way, in its own `test:` commit ahead of the
implementation commit.

