# Review: Story 4 — Show your Assistant's raw Treasure Map

**Reviewer:** Claude (acting as Reviewer). No independent checker was applied (optional; this is a code story).
**Date:** 2026-10-14
**Diff:** `git diff origin/staging...HEAD`. The merge-base is `9d73e4e9` and HEAD is `5515caac`. These hashes are
local and will change on the next rebase, so each commit is also named by its subject:
- `bf16714f` "adr: 0003 the-found-version-rides-the-answer … accepted"
- `5fa417b3` "test: failing tests for show-your-assistants-raw-treasure-map …" (Phase 3)
- `99e40cef` "adr: 0003 amendment 1, the raw event is the one field that may carry a pubkey"
- `fe662d5e` "test: re-aim U16 and add R7 for ADR 0003 amendment 1" (Phase 3)
- `bb7ab423` "test-plan: record the gate after ADR 0003 amendment 1"
- `5515caac` "impl: show-your-assistants-raw-treasure-map (assistant-self-map #4, ADR 0003)" (Phase 4)

**Role separation holds.** The implementation commit touches no test file. The two test commits touch no source:
- the test commits touch only `test/`, `tests/`, the story, the test plan and one ledger row;
- the implementation commit touches only `src/`, `ui/src/`, `BIBLE.md`, ADR 0001, the book and the story's
  `## Deviations`.

## Quality gates (run by reviewer, not trusted)

- [x] **`npm test`** on `5515caac`, a clean tree (`GATE_LABEL=s4-review npm test`). `npm run -s gate:status -- --label
  s4-review`:

  > `20261014T002118Z-21335-4fab [s4-review] started 2026-10-14T00:21:18.613Z on 5515caac — PASS, exit 0, 6035 passed, 0 failed, 582 skipped, 309/309 suites`

- [x] **Playwright, chromium.** The UI was served by `vite preview` on :4184 from `dist/`.
  - **The build is current.** `dist/index.html` was written at 23:55:49Z. That is after the last write to every UI
    source the diff edits (23:53Z). No file under `ui/src` is newer than it, and `git diff HEAD -- ui` is empty.
  - `tests/brainstorm/assistant-self-map.spec.js`: **33 passed, 0 failed** (1.1 m). That covers R0–R6 and every
    story 1–3 test, re-aimed N6 included.
  - **The fixtures' other readers.** `published()` now builds an `event`. I also ran the eight other specs that load
    `selfMapFixtures`: `assistant-alert`, `assistant-attention`, `assistant-coming-soon`, `assistant-duty-menu`,
    `assistant-management-page`, `assistant-profile-check`, `assistant-shared-categories` and
    `assistant-trusted-content`. Result: **81 passed, 5 skipped, 0 failed** (4.6 m). This backs AC-5's "the hub card,
    its count line and the Assistant Alert read the same".
- [x] **Shared lines** (book § Shared lines). `git fetch origin staging` showed that `origin/staging` moved during this
  review, from `9d73e4e9` to `072c4274`.
  - `git merge-tree --write-tree HEAD origin/staging` is clean (exit 0).
  - Of this story's files, only `test/registry.js` is also touched upstream: another book registers its two suites
    there. Nothing upstream touches `selfMap.js`, `attention.js`, the page, the copy module, `styles.css`,
    `openapi.yaml`, BIBLE or the self-Map suites.
  - See Harness friction 2 for what that move means for the push.
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped (the UI was built only to serve the browser spec)._

## Spec adherence

| Criterion | Code | Tests (all passing in the runs above) | Result |
|---|---|---|---|
| **AC-1** closed toggle when a version is found, anywhere, listing none or some | `AssistantTreasureMap.jsx:267–284`. It shows on `rawTreasureMap(answer)` (`:157`) and sits after `<Entries … selfEntries>` (`:266`), before the state line (`:285`) and the buttons (`:287`) | check R1–R3 (`test/assistant-self-map-check.test.js:1626/1637/1652`); page W2 (`test/assistant-self-map-page.test.js:480`), D10 (`:583`); browser R1, R2 (`tests/brainstorm/assistant-self-map.spec.js:643/668`) | Met |
| **AC-2** open shows the event, whole, indented; label flips; wraps at phone width | `assistantTreasureMapCopy.js:194–196`. The `<pre>` is `AssistantTreasureMap.jsx:279–281`; `styles.css:9065–9069` | check R1 (every signed field, `event.id === eventId`); W1 (`:469`), W4 (`:526`), D11 (`:603`), D14 (`:657`); browser R1, R5 (`:753`): box and page `scrollWidth` within width at 375px; the box takes focus | Met |
| **AC-3** nothing to toggle without a version | `assistantTreasureMapCopy.js:185–191`. The server keeps `published: null` on `unfinished` (`selfMap.js:338–341`) and on `SELF_MAP_CHECK_FAILED` (`:59–62`) | check R5 (`:1677`); W3 (`:498`), malformed `event` included; browser R3 (`:689`): eight states, each with its own line drawn as a control | Met |
| **AC-4** never stale; starts closed | Only `rawOpen` is state (`:156`). The event is re-derived from the current answer on every render (`:157`). The provider drops the answer while `checking` (`AssistantAttentionContext.jsx:66–67`) | D11 `useState(false)`; D12 (`:629`) follows the name `rawEvent` into setters, hooks and effects; browser R4 (`:714`): a newer version replaces the old, an answer with none removes the toggle, a reload starts closed | Met |
| **AC-5** nothing else changes; toggling sends nothing | `onClick={() => setRawOpen(!rawOpen)}` (`:274`) touches no press state, helper or refresh | D4 re-aimed (`:224`); D12's handler check; browser R6 (`:768`): no `/api` request, only GETs, one attention call, the other lines and buttons as before; the eight hub and Alert specs above | Met |

Copy, word for word: `SELF_MAP_COPY.raw` (`assistantTreasureMapCopy.js:90–96`) matches § Copy.
- I checked the marks by code point: `▸` U+25B8 and `▾` U+25BE in both the story and the module. Both use straight
  apostrophes.
- The visible label is the mark, a space, then the words: "▸ Show your Assistant's raw Treasure Map" and
  "▾ Hide your Assistant's raw Treasure Map".
- Browser R1 confirms the accessible name is the words alone.
- Story 3's rule holds: the copy module's new words never say "self-Map".

- [x] Every acceptance criterion has a passing test.
- [x] No criterion is silently dropped.
- [x] No behavior is added beyond the story. The styling extras are cosmetic: two are in `## Deviations`, one is not
  (NB1).

## ADR adherence (ADR 0003, sub-decisions 1–6, Implementation notes, Amendment 1)

- [x] **Sub-decision 1, `published.event`.** `found()` adds `event: latest` (`src/api/assistant/selfMap.js:256`).
  - **Every path that builds a found version goes through `found`:**
    - local-first: `:279`;
    - the outside round: `:292`;
    - `strictOutsideRound` (`:334`), which forWrite reaches at `:266` for "here", "only in the copy" and "only
      outside" (check R4, `:1661`).
  - **No `event` without a version.** `found(null, …)` gives `published: null`. `unfinished()` and
    `SELF_MAP_CHECK_FAILED` never call `found`.
  - **Pass-through and the press.** `evaluateSelfMap` passes `published` through
    (`src/lib/self-map/index.js:519, 533`). The press is unchanged.
  - **`event` is never reshaped.** forWrite rewrites only `published.source` (`selfMap.js:273–274`).
- [x] **Sub-decisions 2–3.** `rawTreasureMap` (`assistantTreasureMapCopy.js:185–191`) checks exactly the ADR's
  conditions: `finished === true`, `published` is an object, and `event` is a non-null, non-array object.
  `rawTreasureMapText` is `JSON.stringify(event, null, 2)` or `''`. The module stays import-free.
- [x] **Sub-decision 4.** `raw = { show, hide, closedMark, openMark, boxLabel }`. Page N3 still fails on any other key
  or export, because the set comparison is exact.
- [x] **Sub-decision 5.** The JSX at `AssistantTreasureMap.jsx:267–284` follows the ADR's sketch line for line.
- [x] **Sub-decision 6.** Three rules plus two `:focus-visible` rules (`styles.css:9058–9070`), beside
  `.bs-selfmap-actions`.
  - The box: `white-space: pre-wrap; overflow-wrap: anywhere; max-height: 28rem; overflow-y: auto`.
  - No `bsd-tm-raw-*` class is reused.
  - The card body already has `min-width: 0` (`:9030`), so the `<pre>` can shrink inside the flex card.
- [x] **Implementation notes 1–5, every doc named:**
  - `selfMap.js:25–26` header;
  - the copy module's header `:18–19`;
  - the page header `:39–42`;
  - the CSS comment `:9058`;
  - `openapi.yaml:350–351` (the `published` list) and `:414` (the `event` property). `js-yaml` parses the file, and
    the description carries Amendment 1's sentence verbatim;
  - BIBLE §11 attention row (`BIBLE.md:527`), with the ADR's words exactly;
  - ADR 0001's line under sub-decision 7's shape;
  - the `attention.js:58–59` header.
- [x] **Implementation note 7.** The book records the recheck at `9d73e4e9`. My own recheck at `072c4274` is above.
- [x] **Amendment 1.**
  - The exception is named in all three places the amendment lists: openapi, the `attention.js` header and U16.
  - U16 (`test/assistant-attention.test.js:585`) deletes only `actions['treasure-map'].published.event` from a
    deep copy before its unchanged check.
  - R7 (`:1710`) runs the real handler: `published.event` is present, and without it the answer names neither the
    viewer nor the Assistant (case-insensitive).
  - **My read of the code agrees:** no other field of any action gained a pubkey. The server-side diff is one key in
    `found()`.
- [x] Layering is unchanged. There is no new route, no `routeAccess.js` entry and no new dependency.

**The re-aimed tests are legitimate.**
- **Page N3:** the exact key and export sets now include story 4's five keys and two helpers. Any other change still
  fails.
- **Page D4:** the button cap goes from 4 to 5, for the toggle. A sixth button still fails, and D12 separately pins
  that the toggle is not a press.
- **Browser N6:** it now counts only `.bs-selfmap-actions` buttons. The count was the means to find Turn off, not
  N6's subject, which is no "self-Map" on screen. Story 2's B tests and story 4's R6 still pin which press buttons show
  and are enabled.
- **Attention U16:** see Amendment 1 above. R7 is its counterpart on the real handler, so the exception can't widen
  unnoticed.

## Concept-graph integrity

- [x] Handles: none touched. The story reads one kind 10040; no concept, schema or handle changes.
- [x] Firmware reinstall: not required (ADR 0003 Consequences). Correctly not performed.
- [x] `/summaries` orientation: not applicable. No concept code was added.

## Things tests can't catch

- [x] **Secrets:** none. No TA-pubkey literal in source. The fixtures use their existing test constants.
- [x] **Debug logging and commented-out code:** none added. The existing `console.error` lines in `attention.js` log
  only `err.message`. The answer, and so the event, is never logged.
- [x] **What `event` can be.** It is always a kind 10040 authored by the Assistant: every candidate passes `mine`
  (`selfMap.js:252`, kind and pubkey), including the copy (`:265`).
  - **Local:** strfry verifies signatures on write.
  - **Outside:** `readRelayEvents` verifies each signature by default (`src/api/_shared/relaySource.js:241, 285`).
  - **The press's copy (`stored`):** it is signature-checked by `checkedCopy` (`selfMapPublish.js:159–167`,
    `verifyEvent` at `:164`), and `latest` is re-verified at `:206`.
  - **The copy never reaches the attention answer.** `checkSelfMap` calls `gatherSelfMap` with `forWrite: false`
    (`selfMap.js:353`), so `stored` is ignored there (`:262`).
  - So the raw view shows only what the check already trusts (ADR 0003 "Trust").
- [x] **The press route doesn't leak `published`.** Every press `result` carries `published` as a boolean
  (`selfMapPublish.js:228, 255, 295`), never the lookup's object.
  - `published.event` and `lookup.latest` are the same reference.
  - The press only reads `latest`, writes it to the copy, and builds from it. Nothing on the attention path mutates
    it.
- [x] **XSS.** The JSON is a React text child of a `<pre>` (`AssistantTreasureMap.jsx:280`), so React escapes it.
  There is no `dangerouslySetInnerHTML` or `innerHTML` anywhere under `ui/src/pages/assistant/`. `content` and tags
  are shown as inert text.
- [x] **Client persistence.** The attention provider keeps the answer in React state only
  (`AssistantAttentionContext.jsx:41`). It has no storage, so the pubkey-bearing event is never persisted in the
  browser.
- [x] **Races.** The page keeps no copy of the event. The provider's request key and `cancelled` flag (`:50–64`)
  already discard stale responses.
  - `rawOpen` deliberately survives a press, so the box reopens on the new version (ADR sub-decision 5).
  - Browser R4 shows the old version never reappears.
- [x] **Payload size: estimated, not measured live.** There is no stack here.
  - The fixtures' canned 7-tag event adds 1,042 B to a 2,565 B action.
  - At about 115 B per extra entry, a 40-entry Owner Map would add about 5 KB.
  - That matches the ADR's "low kilobytes", which the ADR accepted. Its Out of scope defers per-consumer trimming
    until it is measured.
- [x] **Accessibility.** The toggle carries:
  - `type="button"`, a string `aria-expanded` and `aria-controls`;
  - its marks in an `aria-hidden` span.

  The box is a named, focusable `region` (`tabIndex={0}`), so a keyboard can scroll it. Both elements have
  `:focus-visible` outlines. While the box is closed, `aria-controls` names an id that isn't in the DOM. The ADR
  prescribes this and the disclosure pattern allows it. Not a finding.
- [x] Input validation at the boundary is unchanged: the route takes no new input.

## House rules check

- [x] Concept Graph API authority respected (no concepts touched).
- [x] No new lint, typecheck or build tooling, and no new dependency.
- [x] TA pubkey resolved at runtime where used (no new use).

## Product-guide adherence *(when the story traces to a PRD)*

Not applicable: the book `assistant-self-map` has a no-PRD acceptance frame. § Copy is checked above.

## Findings

### Blocking

None.

### Non-blocking

1. **`ui/src/styles.css:9061`** — An unrecorded styling choice.
   - The toggle sets `font-size: 0.85rem` after `font: inherit`. ADR 0003 sub-decision 6 names only `font: inherit`.
   - The story's `## Deviations` records two cosmetic touches, hover underline and left alignment, but not this one.
   - It matches the neighbouring `.bs-outbox-note` lines (`:9086`) and is harmless.
   - Optional: add it to `## Deviations`, since book close harvests that section.
2. **`ledger/2026-10-07-staging-sessions-push-red-tests.md:116`** — A stale commit hash.
   - The recurrence note says "the failing-tests commit `ccc3cda0` is held locally and pushed together with the
     implementation".
   - `ccc3cda0` is the pre-rebase hash. It is not an ancestor of HEAD and not on any branch. The held commit is now
     `5fa417b3`, which will change again on the next rebase.
   - Optional: cite it by subject line, or by the hash once it is on `origin/staging`.
3. **`engineering-team/stories/assistant-self-map/4-show-your-assistants-raw-treasure-map.test-plan.md:120, 140`** —
   The same stale-hash problem.
   - "On `6f57e8e9`" and "a build of `6f57e8e9`'s UI" name the pre-rebase ADR commit, now `bf16714f`.
   - The gate run ids in the same section stand on their own.
   - Optional: the same fix as NB2.
4. **`ui/src/pages/assistant/assistantTreasureMapCopy.js:2`** — A stale header line.
   - The header still says "the page's words and two pure helpers". The module now exports seven functions.
   - It was already stale after story 2; story 4 adds two more.
   - Optional: drop the count.

### Harness friction

1. **This story recurs on ledger row `2026-10-11-phase-docs-cite-rebased-hashes`** (OPEN). NB2 and NB3 are this
   story's occurrences.
   - This review's own `5515caac` and the gate record's "on 5515caac" will also stop resolving once the branch is
     rebased onto the new `origin/staging`.
   - That's why the Diff section names each commit by subject.
   - Asked: add an occurrence line to that row.
2. **This story recurs on ledger row `2026-10-07-staging-sessions-push-red-tests`** (OPEN), from the receiving side.
   - **What moved.** During this review `origin/staging` moved to `072c4274`. That tip registers another book's two
     intentionally failing suites in `test/registry.js`: `assistant-scores-route` and `assistant-scores-page`, from
     the commit "test: failing tests for the-scores-page (assistant-scores #1)".
   - **What that book expects.** Its own test plan records an overall FAIL with 41 failures.
   - **What it means here.** A gate run on this branch after rebasing onto that tip will not be green, for reasons
     outside this story.
   - **What this review covers.** The full-gate evidence is the `s4-review` run on `5515caac`, whose base is
     `9d73e4e9`. I did not run the gate on the rebased tree.
   - Asked: add an occurrence line to that row, and read any post-rebase gate per suite.

## Verdict

**PASS**

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place, and the story's Review link filled in.
- [x] Completion detection performed. The result is reported in the chat, not here.
