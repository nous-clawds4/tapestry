# Test Plan: Story 4 — Show your Assistant's raw Treasure Map

**Story:** `engineering-team/stories/assistant-self-map/4-show-your-assistants-raw-treasure-map.md`
**ADR:** `engineering-team/decisions/assistant-self-map/0003-the-found-version-rides-the-answer.md`
**Date:** 2026-10-13

## Coverage map

Three files, at three levels:

- **Check:** `test/assistant-self-map-check.test.js`, class R. It drives the real attention handler and
  `lookupSelfMap` over injected fakes.
- **Page:** `test/assistant-self-map-page.test.js`.
  - Class W loads the copy module in Node.
  - Class D are source sentinels on the page and `styles.css`.
- **Browser:** `tests/brainstorm/assistant-self-map.spec.js`, class R. Playwright, with every `/api` route mocked.

| Criterion | Test | File | Level |
|---|---|---|---|
| AC-1 | R1: found on this instance's relay, `published.event` is that version | check | integration (DI) |
| AC-1 | R2: found outside (source `relay`), `published.event` is the outside version | check | integration (DI) |
| AC-1 | R3: a version listing none of the Assistant's duties still rides whole | check | integration (DI) |
| AC-1 | W2: `rawTreasureMap` gives the found event for every finished answer that found a version | page | unit |
| AC-1 | D10: the toggle sits in the published card, after the entries, before the state line and buttons | page | source |
| AC-1 | R1 (browser): the closed toggle in the published panel, named by its words alone; no box | spec | browser |
| AC-1 | R2 (browser): it shows for a version listing none (beside the "lists none" line), one found outside, and a customer's | spec | browser |
| AC-2 | R1: every signed field as read, and `event.id === eventId` | check | integration (DI) |
| AC-2 | W1: § Copy's words and marks, word for word, as seen open and closed | page | unit |
| AC-2 | W4: `rawTreasureMapText` is `JSON.stringify(event, null, 2)` and reads back whole; `''` for none | page | unit |
| AC-2 | D11: a `type="button"` toggle, `aria-expanded`, `aria-controls`, aria-hidden marks, a named focusable `<pre>` region | page | source |
| AC-2 | D14: the box wraps, caps its height and scrolls; both elements show keyboard focus | page | source |
| AC-2 | R1 (browser): open shows the event as JSON with every field, then closes | spec | browser |
| AC-2 | R5 (browser): at 375px nothing scrolls sideways, in the box or the page; the box takes focus | spec | browser |
| AC-3 | R5: none found, and unfinished, give `published: null` and no event (beside a control that has one) | check | integration (DI) |
| AC-3 | W3: `rawTreasureMap` is null with no answer, unfinished (even with a stray `published`), check-failed, none found, and a malformed `event` | page | unit |
| AC-3 | R3 (browser): no toggle while checking, a failed request, unfinished, check-failed, none found, no duties, signed out, no Assistant | spec | browser |
| AC-4 | D11: `useState(false)`, so it is closed on every load | page | source |
| AC-4 | D12: the event is read from the current answer, never kept in state, a ref, a memo or an effect, directly or through a name | page | source |
| AC-4 | R4 (browser): see below | spec | browser |
| AC-5 | D4 (re-aimed): no fetch, `/api/`, timer, storage or signature; at most five buttons | page | source |
| AC-5 | D12: the toggle's handler reaches no press state, press helper or refresh | page | source |
| AC-5 | R6 (browser): toggling sends no request, and the other lines and buttons are unchanged | spec | browser |
| AC-5 | Every existing test in the three files, unchanged, plus the re-aimed N3, D4 and N6 | all | all |
| ADR 0003 sub-decision 1 | R4: forWrite here, only in the copy, and only outside, `published.event` is `latest` | check | integration (DI) |
| ADR 0003 Implementation notes 5 | R6: `openapi.yaml` gives `published` an `event` object, and BIBLE §11 names it | check | source |

Browser R4 covers AC-4 in three steps:
- open, a press's new answer with a newer version shows the newer one, every field;
- after a press whose new answer finds none, the toggle and box are gone;
- a reload starts closed.

### Re-aimed tests (story 4 changes what they pin)

- **Page N3** (story 3 AC-4) pinned the copy module's exact shape. Its list gains:
  - `raw.show`, `raw.hide`, `raw.closedMark`, `raw.openMark` and `raw.boxLabel`;
  - the exports `rawTreasureMap` and `rawTreasureMapText`.

  It still fails on any other added or missing key.
- **Page D4** allowed four `<button`s in the page's source; the toggle makes it five.
- **Browser N6** counted every enabled button on an up-to-date page as "Turn off". It now counts only
  `.bs-selfmap-actions` buttons, because the toggle is an enabled button too. It still passes against story 3's build.

### Fixtures (`test/helpers/selfMapFixtures.js`)

- `published(...)` now carries `event`: a canned kind 10040 built by the new `foundEvent()` from its own fields, whose
  `id` is `eventId`. `over.event` (`null` included) replaces it.
- `RAW` holds § Copy's words and ADR 0003's box name.
- `ANSWERS.LISTS_NONE` is a finished answer whose version lists none of the Assistant's duties.
- No existing assertion reads `published`'s key set (the Duty Menu suite's exact-keys check is about its own
  `published`), so the extra field breaks nothing; the gate run below confirms it.

## Edge cases

- [x] **A version listing none of the Assistant's duties.** Check R3, page W2, browser R2 (owner choice 2).
- [x] **A version found only outside, or only in the press's copy.** Check R2 and R4. The browser R2 version is found
  outside.
- [x] **An unfinished answer carrying a stray `published`.** Page W3. Only a finished check's version shows.
- [x] **A malformed `event`** (missing, null, an array, a string). Page W3.
- [x] **The answer being asked for again** (`checking`) while the box is open. Browser R4: the box comes back on the
  new version, never the old one.
- [x] **Long lines at phone width.** Browser R5. The canned event's 64- and 128-hex strings overflow a 375px card
  unless the box wraps.
- [x] **"Nothing happened" checks** are paired with a control that shows the path ran:
  - check R5's found version;
  - page W3's found version, and D12's guard that the toggle exists;
  - browser R3's toggle on a found version, and each state's own line;
  - browser R6's toggle presses.
- [ ] Concept Graph API unavailable, or a handle not found: not applicable. The story touches no concept.

## Test infrastructure

- **Node:** the repo's gate (`npm test`, `test/registry.js`), read through `npm run gate:status`. No new suite file
  is registered; the three suites are already in the registry.
- **Browser:** Playwright with Chromium at `/opt/pw-browsers`, against a built UI served by `vite preview`, as for
  stories 2 and 3. There's no Docker daemon here; the spec mocks every `/api` route.
- **Concept Graph / firmware:** none. The stack isn't running, and no live-API suite applies.

## How to run

```
GATE_LABEL=<label> npm test
npm run -s gate:status -- --label <label>
```

For the browser half, build and serve, then run from the repo root:
```
(cd ui && npm run build && npx vite preview --port 4184 --strictPort) &
BRAINSTORM_BASE_URL=http://localhost:4184 BRAINSTORM_SERVER_ACCESSIBLE=true PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
  npx playwright test tests/brainstorm/assistant-self-map.spec.js --project=chromium
```

## Verification

**On `6f57e8e9` with these tests, 2026-10-13:**

- **The Node gate:** run `20261013T232017Z-18826-ea76 [s4-phase3]` was still running at this commit; its verdict is recorded
  in the next commit.
- **The suites, alone:**
  - check: 87 passed, 6 failed. The six are R1–R6:
    - R1–R4: "published.event is the found version itself … got undefined";
    - R5: its control, "a version found here rides as published.event";
    - R6: openapi.yaml has no `event` line, and the BIBLE row doesn't name it.
  - page: 21 passed, 10 failed: N3 (missing the raw keys and the two exports), W1–W4, D10–D14. Each fails on the
    missing words, helpers, toggle or styles; none fails on an import or a typo.
- **The browser half,** against a build of `6f57e8e9`'s UI: 26 passed, 7 failed.
  - The 7 are R0 (the bundle lacks the toggle's words) and R1–R6 (no toggle; R3 on its control).
  - Every story 1–3 test passes, the re-aimed N6 included.

**The tests can pass.** I checked against a throwaway prototype of ADR 0003 in a scratch worktree, which was never
committed and has been deleted. It had:
- `event: latest` in `found()`;
- `SELF_MAP_COPY.raw` and the two helpers;
- the toggle as sub-decision 5 sketches it;
- the three style rules;
- the `openapi.yaml` and BIBLE lines.

Against it:
- **Node:** check 93/0, page 31/0.
- **Browser:** the whole spec, **33 passed**.
- **Three mutants are caught:**
  - `rawTreasureMap` ignoring `finished`: W3.
  - The page keeping the first event it saw in state, through an effect: D12 and browser R4 ("the box shows the newer
    version"). D12 first missed this mutant, because it went through a name (`const fresh = rawTreasureMap(answer)`).
    D12 now follows that name.
  - The box without wrapping (`white-space: pre`): D14 and browser R5 (scrollWidth 1028 against clientWidth 276).
