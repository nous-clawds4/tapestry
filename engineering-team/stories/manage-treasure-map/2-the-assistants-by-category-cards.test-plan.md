# Test Plan: Story 2 — The Assistants by category cards

**Story:** `engineering-team/stories/manage-treasure-map/2-the-assistants-by-category-cards.md`
**ADR:** `engineering-team/decisions/manage-treasure-map/0002-the-cards-count-with-their-own-rule-over-the-same-read.md`
**Date:** 2026-10-07

Two files, split as story 1's were:

- **Node** — `test/manage-treasure-map-cards.test.js` (registered in `test/registry.js`): the counting rule over the
  story's example table and the ADR's edges, the card shaping, the new words, and source sentinels.
- **Browser** — `tests/brainstorm/manage-treasure-map-cards.spec.js`: what a viewer sees, every API mocked (story 1's
  mocks, plus `/api/profiles` names and, for C10, the sign-out and sign-in endpoints).

Story 1's suites (`test/manage-treasure-map-page.test.js`, `tests/brainstorm/manage-treasure-map.spec.js`) must stay
green unchanged.

## Coverage map

| Criterion | Test | File | Level |
|---|---|---|---|
| AC-1 | C1: the section sits between the FAQ and the raw Treasure Map (top-to-bottom order); heading; Scores, Lists, Concepts with their descriptions; the Mixed line and its `href="/treasure-map/advanced"`; no Edit, Save, Assign to all, Choose an Assistant, Change or All duties | `tests/brainstorm/manage-treasure-map-cards.spec.js` | e2e |
| AC-1 | C8: signed out — no section, no "Not assigned yet", no Assistant profile asked for *(guard: passes before and after)* | same | e2e |
| AC-1 | C1 (Node): three cards, Scores / Lists / Concepts, with the story's titles and descriptions | `test/manage-treasure-map-cards.test.js` | unit |
| AC-2 | K1–K11: every row of the story's example table, one test each | same | unit |
| AC-2 | K12: only valid 64-hex delegates; uppercase counted lowercased; a key's first *valid* delegate | same | unit |
| AC-2 | K13: other kinds count nowhere (`99999`, bare `30000`, `30379`, `30400`, `3040x`, `**`, `''`, `*x`, non-string keys) | same | unit |
| AC-2 | K14: kind range boundaries (30380/30389, 30390/30399, 39998/39999) | same | unit |
| AC-2 | K15: bare `39998` counts for Concepts and covers `*` there (not on Scores or Lists) | same | unit |
| AC-2 | K16: `*:tag` covered by `3038x:tag` or `3038x`, not by `3038x:dlist`; likewise for Lists | same | unit |
| AC-2 | K17: Lists own + family-wide + everything | same | unit |
| AC-2 | K18: Map order of first naming, no repeats | same | unit |
| AC-2 | K19: a covering entry without a valid delegate covers nothing | same | unit |
| AC-2 | K20: null, missing, malformed events → three empty lists, never a throw | same | unit |
| AC-2, AC-3 | C2 (e2e): a Map giving Scores rank → Ava and all Scores → Bea (Mixed · 2 Assistants, both names readable), Lists your own Assistant twice (single, purple avatar), and `*:tag` → D, which is covered on Scores and Lists and never reaches Concepts (Not assigned yet, no avatar) | `tests/brainstorm/manage-treasure-map-cards.spec.js` | e2e |
| AC-2, AC-3 | C3: `*` → an Assistant with no profile — all three cards name it by shortened npub, navy avatar | same | e2e |
| AC-3 | C2 (Node): none / single / mixed states, `count`, `people`, at most three `avatars` | `test/manage-treasure-map-cards.test.js` | unit |
| AC-3 | C3 (Node): `local` only for `localPubkey`; none when it's null | same | unit |
| AC-3 | C4 (Node): display name → name → shortened npub; `null`, `PROFILE_LOOKUP_FAILED` and non-text names fall back | same | unit |
| AC-3 | C5 (Node): a whole-character avatar letter (emoji) | same | unit |
| AC-3 | C4 (e2e): four Assistants → three avatars, "· 4 Assistants", every name readable | `tests/brainstorm/manage-treasure-map-cards.spec.js` | e2e |
| AC-3 | C9: at 375 px with long names, no sideways scroll; every card ends inside the viewport | same | e2e |
| AC-1, AC-3, AC-5 | W1–W3: the section's words, `mixedCount(n)` = "· N Assistants", the Mixed line and its link text, "Raw Treasure Map" | `test/manage-treasure-map-cards.test.js` | unit |
| AC-3 | S1: `myAssistants.js` exports `cardFields` (one name rule for both pages) | same | unit |
| AC-3 | S2: the page imports `fetchProfilesChunked`, takes the local Assistant from `assistantPubkey`, never `taPubkey`/`useConfig` or a 64-hex literal | same | static |
| AC-4 | C5 (e2e): no Treasure Map → three "Not assigned yet", nothing says "Assigned to" | `tests/brainstorm/manage-treasure-map-cards.spec.js` | e2e |
| AC-4 | C6: Map held, then names held → the loading line (`role="status"`), never "Not assigned yet", no card and no npub before the names; then the named cards; the lookup asks for every counted Assistant | same | e2e |
| AC-4 | C7: can't read → the error line (`role="alert"`) and Try again in place of the cards, never "Not assigned yet"; Try again → the cards | same | e2e |
| AC-5 | C10: open the raw viewer, Sign out from the menu, sign back in from the page → the raw viewer is closed | same | e2e |
| AC-5 | C11: hide the FAQ with an answer open and show it again → every question `aria-expanded="false"`, no answer shown | same | e2e |
| AC-5 | C12: Tab from the raw viewer's button focuses the region "Raw Treasure Map"; arrow keys scroll it | same | e2e |
| AC-5 | S3: the `<pre>` has `tabIndex={0}`, `role="region"`, `aria-label={COPY.rawBoxLabel}` | `test/manage-treasure-map-cards.test.js` | static |
| AC-5 (read-only) | C13 and `safe()` in C1: no WebSocket, no non-GET request (the read-only Cypher POST aside), `signEvent` never called | `tests/brainstorm/manage-treasure-map-cards.spec.js` | e2e |

## Edge cases

- [x] A Map whose only broad entry reaches no category (`*:tag` with both families covered) — C2.
- [x] An Assistant with no profile, a failed lookup, non-text names — C3 (e2e), C4 (Node).
- [x] More than three Assistants on one card — C4 (both levels).
- [x] Names arriving after the Map — C6 (no flash of npubs).
- [x] Covering entries with invalid delegates — K19.
- [x] Signed out — C8.
- [ ] Concept Graph unavailable / handle not found: not applicable. The story touches no concept.

## Test infrastructure

- **Node:** the gate's runner (`npm test`); alone with `node -e "require('./test/manage-treasure-map-cards.test.js').run()"`.
  JSX structure read with the root `typescript` parser, as story 1's suite does.
- **Browser:** Playwright, chromium. Run here as story 1's was: the UI built with `cd ui && npx vite build` into
  `dist/`, served by a static SPA server whose unmocked `/api/*` answer 404 JSON, `BRAINSTORM_BASE_URL` pointing at
  it. Every request the specs depend on is mocked. C10 also mocks `POST /api/auth/logout`, `/api/auth/verify-user`
  and `/api/auth/login-user`, and the stubbed `window.nostr` signs the login challenge, so C10 is the one test where
  `signEvent` is called and is the one without `safe()`.
- **Fixtures:** fake keys (`'c1'.repeat(32)` …); Maps `MAIN`, `EVERYTHING`, `FOUR`; profiles for Ava, Bea, Cy, Dee,
  Zed Local (your own Assistant here). The profile-ask counter counts only reads naming the fixtures' Assistants, since
  the frame reads other profiles (the viewer's and the instance's) on every page.
- **No live-stack suite** is needed; no firmware state.

## How to run

```
npm test
node -e "require('./test/manage-treasure-map-cards.test.js').run()"
```

For browser/e2e:
```
npm run test:playwright -- tests/brainstorm/manage-treasure-map-cards.spec.js tests/brainstorm/manage-treasure-map.spec.js --project=chromium
```

## Verification

The new tests fail with the current code. Confirmed on 2026-10-07 at commit `90e6a78` (plus this phase's test files),
against a build of that commit.

**Node** (`test/manage-treasure-map-cards.test.js`): **31 fail, 0 pass.** Every failure is the feature missing:

```
FAIL  K1–K20 … ui/src/pages/treasure-map/manageTreasureMap.js does not export categoryAssistants() (ADR 0002)
FAIL  C1–C5  … ui/src/pages/treasure-map/manageTreasureMap.js does not export categoryCards() (ADR 0002)
FAIL  W1     … COPY is missing ["Assistants by category","Assigned to","Mixed","Not assigned yet","Raw Treasure Map","Scores",…]
FAIL  W2     … COPY.mixedCount(n) is missing (ADR 0002 sub-decision 4)
FAIL  W3     … COPY.mixedLineBefore / mixedLineLink / mixedLineAfter missing
FAIL  S1     … ui/src/pages/assistants/myAssistants.js does not export cardFields
FAIL  S2     … ui/src/pages/treasure-map/Index.jsx should import fetchProfilesChunked from utils/profileBatch (ADR 0002 sub-decision 5)
FAIL  S3     … the raw box: tabIndex undefined, want {0}; role undefined, want "region"; aria-label undefined, want {COPY.rawBoxLabel}
manage-treasure-map-cards: 0 passed, 31 failed
```

**Browser** (`tests/brainstorm/manage-treasure-map-cards.spec.js`, chromium): **12 fail, 1 passes** (C8, the
signed-out guard). Story 1's spec, run alongside: 15/15 pass.

```
C1–C5, C9   waiting for …filter({ hasText: 'Trust scores for profiles and content, one at a time.' })… — no card
C6, C7      waiting for getByText('Assistants by category') — no section
C10         the raw viewer starts closed for the new session — Expected "false", Received "true"
C11         Expected "false", Received "true" (the answer re-opens after hide and show)
C12         waiting for getByRole('region', { name: 'Raw Treasure Map' }) — not found
C13         waiting for getByRole('button', { name: 'Try again' }) — no section to retry
12 failed, 16 passed (C8 + story 1's 15)
```

Story 1's Node suite (`manage-treasure-map-page`): 22 passed, 0 failed, 2 skipped, unchanged.

## Amendment — story 1's raw-panel checks scoped to the raw viewer (2026-10-07, at the start of Implementation)

Missed at Test Design: with ADR 0002 sub-decision 5, the section above the raw viewer shows the same loading line,
error line and **Try again** as the raw viewer does. Four story 1 tests looked for those page-wide
(`tests/brainstorm/manage-treasure-map.spec.js` T5, T5b, T6, T13), so with the raw viewer open they would match twice
and fail on Playwright's strict mode, not on a defect. They now look inside the raw viewer's own box (`rawBox`: the
innermost element holding its button). The assertions are unchanged; the section's own lines are covered by this
story's C6, C7 and C13. Re-run against the build of `ccece6b` (story 1's code): 15/15 pass. Committed on its own,
before any implementation change.

## Amendment 2 — after review 1 (2026-10-07)

- **C14 (new, `tests/brainstorm/manage-treasure-map-cards.spec.js`)** — AC-5, ADR 0002 Amendment 1: `/api/auth/status`
  is held, the raw viewer is opened while sign-in is settling, the hold is released, and the viewer must still be open
  with the Map in it once the session's user has arrived. Against the build of `06c4738` (`key={viewer}`) it fails for
  that reason: `expect(locator('pre')).toBeVisible()` — "the Map shows in the still-open viewer", element not found.
- **Two of Amendment 1's lines go back to page-wide** (review 1, non-blocking 4): T5's closing "no error line" and T6's
  closing "no loading line" (`tests/brainstorm/manage-treasure-map.spec.js`) are end-state `toHaveCount(0)` checks
  that can't double-match, so they check the whole page again. T5 and T6 pass against `06c4738` with them.

## Amendment 3 — after review 1, round 2 (2026-10-07)

- **C15 (new, `tests/brainstorm/manage-treasure-map-cards.spec.js`)** — AC-5, ADR 0002 Amendment 2: signed in as one
  person, Sign out from the menu, then a second person signs in with `/api/auth/status` held; they open the raw viewer
  while their sign-in settles; the hold is released; the viewer must still be open, showing the second person's Map.
  Against the build of `84fad91` (Amendment 1's switch counter) it fails for that reason:
  `expect(locator('pre')).toBeVisible()` — "the viewer is still open, with the second person's Map", element not found.
- **The spec's mocks follow the session's person.** `window.nostr` answers with `window.__pubkey` when a test sets it,
  `/api/auth/status` and `/api/auth/user-classification` answer with `state.sessionPubkey`, the session check waits on
  `state.authHold` (C14's option, now on `state`), and the local Map read answers each person with their own Map. Every
  other test leaves these at the first person: on `84fad91` the other 14 tests, C10 and C14 among them, still pass.
