# Review: Story manage-treasure-map #1 — The Manage your Treasure Map page, its menu links, and the Advanced placeholder

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-07
**Diff:** `git diff d489ea6 58bed35` (tests `33977a6` + implementation `58bed35`); implementation alone `git diff 33977a6 58bed35`; story base `dcddbe4`. Branch `staging`.
**Story:** `engineering-team/stories/manage-treasure-map/1-the-manage-your-treasure-map-page.md`
**ADR:** `engineering-team/decisions/manage-treasure-map/0001-a-design-page-on-the-shared-strict-map-read.md`
**Test plan:** `engineering-team/stories/manage-treasure-map/1-the-manage-your-treasure-map-page.test-plan.md`
**Book:** `engineering-team/audits/manage-treasure-map/book.md` (decisions 1–6; blueprint in `blueprint/`)

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS**. `npm run -s gate:status`:
  `20261007T013943Z-16610-7600 started 2026-10-07T01:39:43.977Z on 58bed352 — PASS, exit 0, 4939 passed, 0 failed, 581 skipped, 270/270 suites`.
  The new suite: `manage-treasure-map-page: PASS (22 passed, 0 failed, 2 skipped)`. The 2 skips are the live H-class (no stack).
  Run on its own with `BRAINSTORM_BASE_URL=http://localhost:7799` (the static SPA server), it gives 24 passed, 0 failed, 0 skipped,
  with H executed 2/2. That is weak evidence, since the server isn't the control panel. The ADR's must-stay-green neighbours are all green:
  `my-assistant-page` 31/0, `my-assistants-page` 50/0 (2 skip), `dictionary-concepts` 22/0 (3 skip),
  `assistant-management-page` 23/0 (1 skip), `my-curated-dlists-page` 19/0, `stack-free-npm-test` 6/0 (1 skip),
  `my-assistants-map` 14/0, `my-assistants-actions` 29/0.
- [x] Playwright (chromium, against the built UI served statically with every API mocked; test plan § Test
  infrastructure): `tests/brainstorm/manage-treasure-map.spec.js` + `my-assistants.spec.js` + `my-assistants-map.spec.js`
  — **42 passed, 0 failed** (15 new: T1–T13, T5b, T11a/b; 27 `/assistants`, including the 3 re-aimed assertions).
  Before running, I rebuilt `dist/` from HEAD (`58bed35`, clean tree, `cd ui && npx vite build`). The main bundle's content
  hash was unchanged (`index-C4EN6CEn.js`), so the served UI is the committed code.
- [x] Reviewer's own browser probe (scratch script, not committed; same mocks):
  - At 375 px and 1280 px, in the found, none, error and signed-out states (with the FAQ and an answer open) and on
    `/treasure-map/advanced`, `scrollWidth === innerWidth` in every case.
  - No non-GET request except the read-only Cypher relay-list POST. No WebSocket. `signEvent` was never called.
  - The new toggles and link keep the browser's default focus ring.
  - I compared the screenshots against the blueprint by eye: they match.
- [x] Staging, server half of AC-2/AC-5: `https://staging.brainstorm.world/treasure-map` and `/treasure-map/advanced`
  already answer 200 with the app shell (`<div id="root"`), before deploy. Locally, both fall through nginx's `location /` (`docker/nginx.conf:40`) to the control panel's SPA fallback; R0-3 pins `isBlockedProbePath`.
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped (the Vite build above is only for the browser run)._

## Spec adherence

- [x] **AC-1 (menus).** `avatarMenuLinks.js:119` picks the target from `profileBase`. M1/M2 cover all five kinds
  of person × both shells. M3/M4 check label, icon, third place and a single item. R0-1 checks that the three callers still
  pass `/tapestry/users` / `/user` / `/user`. T11a covers `/`, `/assistants` and `/dictionary` → `href="/treasure-map"`
  and opens it. T11b checks the Tapestry header → `/tapestry/grapevine/treasure-map`. Signed-out menus: that code path
  is untouched, since `personalLinks` is only called for a signed-in user.
- [x] **AC-2 (page).** Under `BrainstormDesignShell` (D6, T1). Kicker, heading with the accent span, and introduction (V1, T1).
  No Edit or Save (D5, T1). Direct load and refresh work (T10, R0-3, staging check above). 375 px (T12, plus the probe in four states).
- [x] **AC-3 (FAQ).** V2 (exact strings, in order) and T2 (closed at first, in order, one answer at a time, `aria-expanded`
  follows, second press closes, the button hides them). See non-blocking 2 on re-showing after a hide.
- [x] **AC-4 (raw Treasure Map).**
  - The read is `useTreasureMap(viewer, { strict: true })` with `viewer` from `useAuth()` (`Index.jsx:111-113`; D2). It is the same hook and the same call shape as `/assistants` (`assistants/Index.jsx:99`).
  - Phases: V3/V4 (`mapPanelPhase` truth table; unknown → loading). Found: T3, which checks the whole event via `JSON.parse` deep-equal, the flipping label, the chip, and `authors: [viewer]` only.
  - None: T4 (strict=1 on every relay read). Can't read: T5, T5b (`role="alert"`, never the none box; Try again → found).
  - Loading: T6 (`role="status"`). Someone else's 10040: T7.
- [x] **AC-5 (Advanced).** T9 (the line and link, `href="/treasure-map/advanced"`; back link → `/treasure-map`, kicker,
  heading, placeholder sentence, TA link → `/tapestry/grapevine/treasure-map`; a reload reads no Map). D3 (addresses read
  from the menu module). D7 (no data read). T10 (direct load and refresh).
- [x] **AC-6 (signed out; `/assistants`; Tapestry side).**
  - Signed out: T8 (sign-in line and button in place of the raw viewer, no 10040 read).
  - `/assistants`: A1 (`TREASURE_MAP_PATH === '/treasure-map'`) and the three re-aimed browser assertions.
  - Tapestry side: R0-2 (sidebar, My Curated DLists, TA list keep the literal). The diff touches none of those files.
  - Read-only: D4, V7, T13 and `safe()` (nothing signed, published or stored).
- [x] **§ Copy.** I checked mechanically: every string in `COPY` and `FAQS` (`manageTreasureMap.js`) appears verbatim in the
  story's § Copy table, curly apostrophes included (28 of 28). The two headings are inline JSX, as ADR sub-decisions 5–6
  specify, and T1/T9 match their accessible names exactly. "Advanced management →" renders the arrow as an SVG, which is how the blueprint draws it.
- [x] No criterion silently dropped. No behaviour beyond the story: story 2's slot is left empty (`Index.jsx:123-125`), there is no
  "Mixed assignments…" line, and there are no edit controls.

## ADR adherence

- [x] **Sub-decision 1:** the three constants are at `avatarMenuLinks.js:60-62` with the specified values. The module still has
  no imports (0 `import` lines; `assistant-management-page` M3 green). The name `TREASURE_MAP_PATH` was avoided as instructed.
- [x] **Sub-decision 2:** `isTapestryMenu` is module-private and matches the ADR's body exactly (`:65-67`). The entry's key, icon, label and
  position are unchanged. The header comment now says "two deliberate differences, both keyed on `profileBase`" (`:11-19`).
- [x] **Sub-decision 3:** `myAssistants.js:112` passes `profileBase: '/user'`, with an updated comment. `Index.jsx`,
  `AssistantRow.jsx` and `DutiesTab.jsx` are untouched and follow the constant (grep: these are its only three consumers).
- [x] **Sub-decision 4:** `manageTreasureMap.js` is pure with zero imports. It exports `COPY`, `FAQS`, `rawMapText` and `mapPanelPhase` with the
  specified semantics (`authLoading` → loading; no user → signed-out; anything outside found/none/error → loading).
  The deviation that splits the placeholder into three parts so the link sits inside the sentence is logged in the story and is reasonable.
- [x] **Sub-decision 5:** `Index.jsx` follows the specified structure and imports. Its FAQ is a `<button aria-expanded>`
  with a single open index. The raw toggle has `aria-expanded`, the show/hide labels and the chip. Panel phases: `<pre>`, none box, `role="alert"`
  with Try again → `map.refresh`, `role="status"`. The Advanced `<Link>` uses `TREASURE_MAP_ADVANCED_PATH`. The viewer comes from the session only:
  no `useParams`, search params or `localStorage`.
- [x] **Sub-decision 6:** `Advanced.jsx` is static. It has the back link with a chevron to `MANAGE_TREASURE_MAP_PATH`, the Eyebrow, the h1 with the accent,
  and the placeholder with `<Link to={TA_TREASURE_MAP_PATH}>`. It calls no data hook.
- [x] **Sub-decision 7:** `App.jsx` imports the two constants and adds two routes beside `MY_ASSISTANTS_PATH`, outside
  `/tapestry` (D1 AST walk), each with a neighbour-style comment. There is no server, middleware or catch-all change.
- [x] **Sub-decision 8:** the `.bsd-tm-*` block sits after `.bsd-ma-*` (`styles.css:10158-10218`) and uses the blueprint's
  measurements and colours (I compared it against `treasure-map-screen.html.txt` property by property). The `<pre>` is `#151c2a`/`#e2e8f0`,
  `var(--bsd-mono)` 12 px, `overflow-x: auto`, `max-width: 100%`. `.bsd-ma-btn` / `.bsd-ma-status` are reused as allowed. Their
  `margin-top` is overridden by later, equal-specificity `.bsd-tm-raw-state` / `.bsd-tm-signed-out` rules, which is correct source-order
  resolution. **No leak:** every new selector is `.bsd-tm-*` or `.bsd-page a.bsd-tm-back`, and no JSX outside
  `pages/treasure-map/` uses a `bsd-tm-` class.
- [x] No new dependencies. `package.json` is unchanged. The Node suite's use of the root `typescript` parser follows existing precedent
  (`test/my-assistant-page.test.js`).
- [x] **Test edits outside the new files:** only the three ADR-named re-aims (`my-assistants.spec.js:190`,
  `my-assistants-map.spec.js:175`, `:377`, each `/tapestry/grapevine/treasure-map` → `/treasure-map`, with a comment citing
  sub-decision 3) and one `test/registry.js` line. All four are in the Tester's commit `33977a6`. The implementation commit
  `58bed35` touches no test file.

## Concept-graph integrity

- [x] No concept handles are touched; the story reads kind 10040 only.
- [x] Firmware reinstall: not required (ADR says so; no concept definitions changed).
- [x] N/A for `/summaries`: no concept-graph code.
- [x] No TA pubkey is used anywhere in the diff, so the per-deployment TA-pubkey rule isn't engaged. The `LEGACY_*` constants are untouched.

## Things tests can't catch

- [x] No secrets. The test files use only fixture keys (`'a1'.repeat(32)` …).
- [x] No `console.*`, `debugger`, TODO or commented-out code in the new or changed source.
- [x] Error paths: Try again is wired to the hook's `refresh`, and `login().catch(() => {})` matches `/assistants`
  (AuthContext records the error for its modal). See non-blocking 3 for a known hook limitation this page inherits.
- [x] State: sign-out resets the hook to `idle` (`useTreasureMap.js:60`), so no Map from a previous session is ever shown
  after a sign-in. One cosmetic state carry-over is in non-blocking 1.
- [x] Security: whose Map is read comes from the session only. The relay-step filter also drops events whose pubkey isn't the
  viewer's (`useTreasureMap.js:102`; T7). The page writes nothing.
- [x] Accessibility: the toggles are real `<button>`s with `aria-expanded`, the icons are `aria-hidden`, status and error use
  `role="status"`/`role="alert"`, and focus rings are intact. One small gap is in non-blocking 4.
- [x] No scope creep: 8 files in the implementation commit, all named by the ADR, plus the story's Deviations section.

## House rules check

- [x] Concept Graph API authority respected (no concept work).
- [x] No new lint, typecheck or build tooling.
- [x] JS without a build step is preserved (the view-model loads in Node as is).

## Product-guide adherence *(no PRD; blueprint-backed acceptance frame)*

- [x] Copy matches § Copy verbatim (28/28 strings, plus both headings).
- [x] Blueprint patterns are honoured with the frame's tokens (`--border`, `--bsd-line`, `--accent`, `--bsd-mono` …), not raw
  values, except where the blueprint itself names a literal (`#151c2a`, `#fafaf9`, `#9aa1ac`). The loading, error and signed-out states
  the blueprint lacks are designed, using the `/assistants` status and button styles.

## Findings

### Blocking

None.

### Non-blocking

1. **`ui/src/pages/treasure-map/Index.jsx:115` — the raw panel's open state survives a sign-out and sign-in in the same tab.**
   Sign-out only sets `user` to null (`ui/src/context/AuthContext.jsx:174-181`; there is no navigation). The raw card is replaced
   by the sign-in prompt, but `rawOpen` stays `true`. In my probe, signing in again brought the card back with
   `aria-expanded="true"` and the `<pre>` already showing. The data is correct: it's a fresh read of the new session's own Map, and
   no stale event is shown. "Closed at first" holds on arrival. Optional: reset `rawOpen` when `viewer` changes (e.g.
   `key={viewer}` on the card, or an effect).
2. **`ui/src/pages/treasure-map/Index.jsx:62,65` — hiding and re-showing the FAQ re-opens the last answer.** `setShown(!shown)`
   leaves `open` as it was. AC-3 reads "Pressed, it shows the four questions … each closed". That holds on the first press,
   but a strict reading would also cover a re-show. The blueprint behaves the same way (`blueprint/treasure-map-logic.js.txt:135-137`:
   `tmbFaqOpen` survives `tmbToggleFaq`), as does the ADR's single `faqOpen` index, so this is faithful to the design. T2 doesn't
   exercise a re-show. Optional: `setOpen(null)` on hide, if the owner wants the strict reading.
3. **`ui/src/pages/treasure-map/Index.jsx:103` — Try again inherits the hook's known relay-list retry bug.** `refresh`
   (`ui/src/hooks/useTreasureMap.js:43`) re-runs only the local scan, so a failed general-purpose relay-list read stays
   `error` until reload. This is already OPEN as `ledger/2026-10-01-treasure-map-retry-skips-relay-list.md`, which names
   `/assistants` as the only caller offering Try again. `/treasure-map` is now a second caller. Ask: add it to that ledger entry
   (orchestrator), so the fix's browser case covers both pages. Not this story's to fix: the ADR reuses the hook unchanged.
4. **`ui/src/pages/treasure-map/Index.jsx:87` — the `<pre>` scrolls sideways but can't take keyboard focus.** At 375 px, long tag
   lines and the 128-character `sig` need horizontal scrolling. Chromium makes scroll containers focusable on its own, but Safari and
   Firefox don't. Optional: `tabIndex={0}` and an `aria-label` on the `<pre>`.
5. **AC-2 "on staging as well".** The server half is verified: staging already serves the app shell for both addresses.
   The full claim (the router renders the page) can only be checked after the book ships to staging. Suggested
   post-deploy check: `BRAINSTORM_BASE_URL=https://staging.brainstorm.world node -e "require('./test/manage-treasure-map-page.test.js').run()"`
   (H-class), plus a manual load of both addresses.

### Harness friction

1. None found in the process docs. One environment note: the provided `dist/` had an mtime six minutes older than
   `58bed35`. A rebuild gave an identical main-bundle hash, so the results stand. A reviewer working without the stack should still
   rebuild (or compare hashes) before trusting a pre-built `dist/`.

## Verdict
**PASS**

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place (by the orchestrating session, in this review's commit).
- [x] Completion detection performed (by the orchestrating session): the book is not complete. Story 2 (the
  Assistants by category cards) is still to be written, and the book hasn't shipped to staging.
