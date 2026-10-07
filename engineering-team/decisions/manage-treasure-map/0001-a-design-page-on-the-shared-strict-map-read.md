# ADR 0001: The page is a design-shell page on the shared strict Treasure Map read; the menu picks its target by shell

**Status:** Proposed
**Date:** 2026-10-07
**Story:** `engineering-team/stories/manage-treasure-map/1-the-manage-your-treasure-map-page.md`

## Context

Story 1 asks for a view-only **Manage your Treasure Map** page at `/treasure-map`, an **Advanced management**
placeholder at `/treasure-map/advanced`, the Brainstorm-side **My Treasure Map** menu items and the My Assistants
page's three Treasure Map links pointed at it, and everything on the Tapestry side left where it is. Its acceptance
criteria, in short:

- **AC-1** — the landing page's and the Brainstorm top bar's **My Treasure Map** open `/treasure-map`; the Tapestry
  header's still opens `/tapestry/grapevine/treasure-map`.
- **AC-2** — the page renders under the Brainstorm top bar in the blueprint's styling, with no Edit or Save; direct
  loads and refreshes work (staging too); no sideways scroll at 375 px.
- **AC-3** — the FAQ: closed at first, four questions, one answer open at a time.
- **AC-4** — the raw Treasure Map: the signed-in person's own newest kind 10040, "looked for in the same places the My
  Assistants page looks"; found / none (only after a relay was actually read) / can't read + Try again / loading.
- **AC-5** — the Advanced management line and the placeholder page (back link, kicker, heading, placeholder line
  pointing at the TA Treasure Map page).
- **AC-6** — signed out: a sign-in prompt in place of the raw Treasure Map; `/assistants`' three links move; the
  Tapestry side's links don't.

**Concept Graph:** the stack wasn't running, so the graph couldn't be queried (AGENTS.md §2 fallback). The story reads
one nostr event kind (10040) and changes no concept, so no handle is cited here. **Firmware reinstall: not required.**

Facts from the code this decision rests on:

- **The strict Treasure Map read already exists and is what `/assistants` uses.** `useTreasureMap(pubkey, { strict })`
  (`ui/src/hooks/useTreasureMap.js`) reads local strfry first, then the general-purpose relays, newest wins, and
  answers `idle | loading | found | none | error` with the `event` and a `refresh()`. Under `strict`, `none` means
  local strfry missed *and* at least one relay was read and held no Map; an unreachable relay, or no relay to ask, is
  `error` (ADR my-assistants/0003 and its Amendment 1). `/assistants` calls it as
  `useTreasureMap(viewer, { strict: true })` (`ui/src/pages/assistants/Index.jsx:99`). That is AC-4's contract, word
  for word, and "the same places" is guaranteed only by calling the same hook the same way.
- **The design frame already exists.** `ui/src/components/BrainstormDesignShell.jsx` renders the wordmark bar, the
  app's own `BrainstormUserMenu` (with the Setup and Assistant alerts) and a reading column, 720 px by default
  (`wide` gives 1040 px). `Eyebrow` is exported beside it. The shared classes `.bsd-title`, `.bsd-title-accent` and
  `.bsd-lede` (`ui/src/styles.css:9631-9634`) and `.bsd-eyebrow` (`:9625`) are the blueprint's heading block. The
  blueprint's column for both screens is `max-width:720px` (blueprint `treasure-map-screen.html.txt`, its `<main>`),
  so the default column is right.
- **The menu is one list.** `personalLinks` (`ui/src/config/avatarMenuLinks.js:83`) is rendered by all three avatar
  menus: the Tapestry header (`ui/src/components/Header.jsx:93`, `profileBase: '/tapestry/users'`), the Brainstorm top
  bar (`ui/src/components/BrainstormUserMenu.jsx:100`, `profileBase: '/user'`) and the search landing page
  (`ui/src/pages/BrainstormSearch.jsx:509`, `profileBase: '/user'`). `profileBase` is already the one value that
  differs by shell; the module's header comment names it as "the one deliberate difference". Every test that calls
  `personalLinks` loops over exactly `['/user', '/tapestry/users']` (`test/my-assistant-page.test.js` M3/M4,
  `test/my-assistants-page.test.js` M2, `test/dictionary-concepts.test.js` S9, `test/assistant-management-page.test.js`
  M2). The module must keep having no imports (`test/assistant-management-page.test.js` M3).
- **`/assistants` takes its Treasure Map link from the menu.** `TREASURE_MAP_PATH` in
  `ui/src/pages/assistants/myAssistants.js:108` is the `my-treasure-map` entry's `to`, read from `personalLinks` with
  an empty `profileBase`. The introduction (`Index.jsx:173`), each row's **Manage** (`AssistantRow.jsx:122`) and the
  Duties tab (`DutiesTab.jsx:74`) all use it, and `test/my-assistants-page.test.js` D2 forbids the literal path there.
- **Direct loads need no server change.** `bin/control-panel.js` serves `dist/index.html` for any non-API path that
  `isBlockedProbePath` (`src/utils/siteTrust.js:285`) lets through. It blocks only dot-segments and a fixed list of
  file extensions; `/treasure-map` and `/treasure-map/advanced` are neither. `/assistants` shipped the same way.
- **Tapestry-side links stay literal and untouched:** the sidebar (`ui/src/components/Layout.jsx:49`, pinned by
  `test/my-curated-dlists-page.test.js:425`), `MyCuratedDLists.jsx:9`, and `TrustedAssertionsList.jsx:183`.

## Options considered

### Option A — a new design-shell page that calls the shared hook (chosen)

A page module under `ui/src/pages/treasure-map/` on `BrainstormDesignShell`, with a pure view-model beside it, reading
the Map through `useTreasureMap(viewer, { strict: true })`. The Advanced placeholder is a second, static page in the
same folder.

- **Pros:** AC-4's "same places" holds by construction: one hook, one call shape. No server work. The frame, heading
  classes and button styles are reused, so the page looks like `/assistants` and `/dictionary` without new tokens.
  Story 2's cards read the same `map` value the raw viewer already holds.
- **Cons:** the page is client-read, so a Map is read once per visit per tab, as on `/assistants`. That's the accepted
  cost there too.

### Option B — a session-scoped server endpoint for the viewer's Map

`GET /api/treasure-map/mine`, reading the session's pubkey and doing the local-then-relays lookup server-side (as
`/api/setup/status` does for its step 3).

- **Pros:** the viewer comes from the session, never the browser; one request.
- **Cons:** a second implementation of "where to look and what `none` means", which can drift from the hook that
  `/assistants` uses, the exact defect AC-4's wording rules out. It adds an API route, OpenAPI entry and handler tests
  for no behavior the hook lacks. The viewer is the signed-in person either way, and a kind 10040 is public, so the
  session-scoping buys nothing here.

### Option C — a tab inside `/assistants`

Show the Map as a third tab on My Assistants.

- **Cons:** the story fixes the address at `/treasure-map` (book decision 2) and the menu item's target; a tab would
  need its own deep link and would tie the two pages' lifecycles together. Rejected.

### Menu sub-options (AC-1)

- **M1 (chosen):** `personalLinks` picks the **My Treasure Map** target from `profileBase`: a menu whose profile pages
  live under `/tapestry/` gets the TA Treasure Map page, every other menu gets `/treasure-map`. No call site changes;
  the value that already distinguishes the shells keeps being the only one.
- **M2:** a new explicit `shell: 'main' | 'tapestry'` argument. Clearer at the call site, but it's a second value that
  must agree with `profileBase`, and a call that forgets it silently sends the Tapestry menu to the new page.
- **M3:** replace `profileBase` with `shell` and derive both targets. The cleanest end state, but it rewrites three
  call sites and five test suites' calls for no behavior change. Worth doing only if a third per-shell difference
  appears.

## Decision

We chose **Option A with M1**. It's the only option where AC-4's "the same places the My Assistants page looks" is true
by construction rather than by keeping two implementations in step, and M1 adds the second per-shell difference
without adding a second per-shell value.

Sub-decisions:

1. **Addresses are exported constants** in `ui/src/config/avatarMenuLinks.js`, beside `MY_ASSISTANTS_PATH`, with no
   imports added:
   - `MANAGE_TREASURE_MAP_PATH = '/treasure-map'`
   - `TREASURE_MAP_ADVANCED_PATH = `${MANAGE_TREASURE_MAP_PATH}/advanced``
   - `TA_TREASURE_MAP_PATH = '/tapestry/grapevine/treasure-map'`

   (Not `TREASURE_MAP_PATH`: `myAssistants.js` already exports a constant of that name with a different job.)
2. **The menu (M1).** In `personalLinks`, the `my-treasure-map` entry's `to` is
   `isTapestryMenu(profileBase) ? TA_TREASURE_MAP_PATH : MANAGE_TREASURE_MAP_PATH`, where `isTapestryMenu` is a small
   module-private function: `typeof profileBase === 'string' && profileBase.startsWith('/tapestry/')`. Key, icon,
   label and position don't change. The module's header comment is updated: there are now two deliberate differences,
   both keyed on `profileBase`.
3. **`/assistants` follows the Brainstorm menus.** `myAssistants.js`'s `TREASURE_MAP_PATH` keeps being derived from the
   `my-treasure-map` entry, but with `profileBase: '/user'` (the Brainstorm menus' value), and its comment says so.
   It then resolves to `/treasure-map`, and the introduction, **Manage** and Duties-tab links follow with no change to
   `Index.jsx`, `AssistantRow.jsx` or `DutiesTab.jsx`.
4. **The view-model** is `ui/src/pages/treasure-map/manageTreasureMap.js`: pure, no React import, no imports at all
   (or only `.js`-suffixed siblings), so a Node suite loads it as it is (the `myAssistants.js` precedent). It exports:
   - `COPY`: every string in the story's § Copy for both pages, keyed by element. Curly apostrophes.
   - `FAQS`: the four `{ q, a }` pairs, in the story's order.
   - `rawMapText(event)`: `JSON.stringify(event, null, 2)`, the event exactly as the hook returned it (the same text
     the TA page's hand-edit panel starts from, `TreasureMapManualEdit.jsx`); `''` for no event.
   - `mapPanelPhase({ authLoading, user, status })` → `'signed-out' | 'loading' | 'found' | 'none' | 'error'`:
     `authLoading` → `loading`; no `user` → `signed-out`; then `idle`/`loading` → `loading`, and `found`, `none`,
     `error` map to themselves. Anything unrecognised is `loading`, never `none`: the page never claims there is no Map
     before a read has said so.
5. **The page** is `ui/src/pages/treasure-map/Index.jsx`, default export `ManageTreasureMapPage`, inside
   `<BrainstormDesignShell>` (default 720 px column). Top to bottom, following the blueprint's markup:
   - `<Eyebrow>{COPY.kicker}</Eyebrow>`, `<h1 className="bsd-title">Manage your <span
     className="bsd-title-accent">Treasure Map</span>.</h1>`, `<p className="bsd-lede">{COPY.intro}</p>`.
   - **FAQ:** a `<button aria-expanded>` toggling `faqShown`; when shown, a card listing `FAQS`, each question a
     `<button aria-expanded>` and its answer a `<p>` rendered only when `faqOpen === i`. Pressing an open question
     closes it; pressing another opens that one (one `faqOpen` index, so at most one answer).
   - **Story 2's slot:** nothing is rendered between the FAQ and the raw viewer in this story. Story 2's cards go there
     and read the same `map` value.
   - **Raw Treasure Map:** when the phase is `signed-out`, the signed-out line and a **Sign in with nostr** button
     (`login()` from `useAuth`, as on `/assistants`) take its place. Otherwise a `<button aria-expanded>` with the
     label `COPY.rawShow` / `COPY.rawHide` and a **kind 10040** chip toggles a panel that shows, by phase:
     `found` → `<pre>` of `rawMapText(map.event)`; `none` → the blueprint's **No Treasure Map found** box;
     `error` → the error line (`role="alert"`) and **Try again** calling `map.refresh`; `loading` → the loading line
     (`role="status"`).
   - **Advanced line**, for every visitor: `COPY.advancedPrompt` and a `<Link to={TREASURE_MAP_ADVANCED_PATH}>` reading
     **Advanced management →**.
   - **The read:** `const viewer = user ? user.pubkey : null; const map = useTreasureMap(viewer, { strict: true });`
     The viewer is the session's user, never a route or query parameter, so nobody else's Map can be shown (AC-4). A
     signed-out visitor passes `null`, which the hook answers `idle` without reading.
   - The page publishes, signs and stores nothing; no `localStorage`.
6. **The Advanced placeholder** is `ui/src/pages/treasure-map/Advanced.jsx`, default export `TreasureMapAdvancedPage`,
   static, in the same shell. Top to bottom, from `blueprint/advanced-screen-header.html.txt`: a back link (chevron +
   **Manage your Treasure Map**, `<Link to={MANAGE_TREASURE_MAP_PATH}>`); `<Eyebrow>Treasure Map · Advanced</Eyebrow>`;
   `<h1 className="bsd-title">Advanced <span className="bsd-title-accent">Treasure Map</span> management.</h1>`; and
   the placeholder line, whose **TA Treasure Map** link is `<Link to={TA_TREASURE_MAP_PATH}>`. It calls no hook that
   reads data. (The story's § Copy row "breadcrumb … › Treasure Map · Advanced" is this back link above the kicker,
   which is how the blueprint lays them out.)
7. **Routes.** `ui/src/App.jsx` adds, beside the `MY_ASSISTANTS_PATH` route and outside the `/tapestry` tree:
   `{ path: MANAGE_TREASURE_MAP_PATH, element: <ManageTreasureMapPage /> }` and
   `{ path: TREASURE_MAP_ADVANCED_PATH, element: <TreasureMapAdvancedPage /> }`, importing the two constants from
   `avatarMenuLinks`. No server, middleware or catch-all change.
8. **Styles.** A new `.bsd-tm-*` block in `ui/src/styles.css`, after the `.bsd-ma-*` block, taking the blueprint's
   measurements and colours for the parts that are this page's own: the FAQ toggle and card, the raw-viewer toggle and
   its **kind 10040** chip, the dark `<pre>` (`#151c2a` on `#e2e8f0`, IBM Plex Mono 12 px), the none box, the Advanced
   line, and the back link. The sign-in, **Try again** and status lines reuse `.bsd-ma-btn` / `.bsd-ma-status` as they
   are; the design's buttons and status lines are the same on both pages. At 375 px nothing is wider than the column;
   the `<pre>` has `overflow-x: auto` and `max-width: 100%`, so a long tag line scrolls inside its own box and the
   page never scrolls sideways.

## Consequences

- **Enables story 2.** The cards need the same Map and the same phases; they'll take `map.event` and
  `mapPanelPhase`'s answer from this page and their derivation will live in `manageTreasureMap.js`, beside this
  story's helpers, testable in Node.
- **Constrains:** the **My Treasure Map** target now depends on `profileBase`. A future fourth menu must pass a
  `profileBase` that says which shell it's in. If a third per-shell difference appears, take M3 then.
- **Shared button classes:** this page now depends on `.bsd-ma-btn` / `.bsd-ma-status`. If a third page reuses them,
  rename them to a neutral `.bsd-btn` / `.bsd-status` in one change. Not now.
- **The Tapestry side is untouched**, including the `/tapestry/grapevine/treasure-map` literals in `Layout.jsx`,
  `MyCuratedDLists.jsx` and `TrustedAssertionsList.jsx`. Moving those onto `TA_TREASURE_MAP_PATH` is a tidy-up for
  another day; `test/my-curated-dlists-page.test.js:425` pins the sidebar's literal.
- **The copy runs ahead of the app** in three places, by the owner's decision (book decision 4). It's all in `COPY`,
  so revising it later is a one-file change.
- **Firmware reinstall required?** No. No concept definition changes.

## Implementation notes

- `ui/src/config/avatarMenuLinks.js` — sub-decisions 1 and 2. Still no imports.
- `ui/src/pages/assistants/myAssistants.js:108` — sub-decision 3 (`profileBase: '/user'`; comment updated).
- `ui/src/pages/treasure-map/manageTreasureMap.js` (new, pure) — sub-decision 4.
- `ui/src/pages/treasure-map/Index.jsx` (new) — sub-decision 5. Imports: `BrainstormDesignShell, { Eyebrow }`,
  `useAuth`, `useTreasureMap`, `Link`, the view-model, and `TREASURE_MAP_ADVANCED_PATH`.
- `ui/src/pages/treasure-map/Advanced.jsx` (new) — sub-decision 6.
- `ui/src/App.jsx` — sub-decision 7, with a one-line comment in the neighbours' style naming manage-treasure-map #1.
- `ui/src/styles.css` — sub-decision 8.
- **For the Tester (Phase 3):**
  - **Node, the menu:** for both `profileBase` values and the usual classifications, `my-treasure-map` keeps key,
    label, icon and index, and its `to` is `/treasure-map` for `/user` and `/tapestry/grapevine/treasure-map` for
    `/tapestry/users`; the three new constants have their values; the module still has no imports.
  - **Node, the view-model:** `mapPanelPhase` across every `(authLoading, user, status)` combination, including that
    nothing but `status: 'none'` with a signed-in user yields `none`; `rawMapText` keeps every field and the tags'
    order; `COPY` and `FAQS` hold the story's exact strings (curly apostrophes).
  - **Node, static:** `App.jsx` routes both constants to the two pages, outside `/tapestry`; neither page nor the
    view-model contains the literal `/tapestry/grapevine/treasure-map` or `/treasure-map` (they read the constants);
    neither page imports a publisher or signer; `myAssistants.js`'s `TREASURE_MAP_PATH` is `/treasure-map`.
  - **Playwright, network-mocked** (as `tests/brainstorm/my-assistants*.spec.js` mock `/api/strfry/*` and the Cypher
    relay list): signed out (sign-in prompt, no Map request with a pubkey); each panel phase (found, strict none, no
    relay reached → error, then Try again → found; loading held open); FAQ behaviour; no Edit/Save button; the
    Advanced link and placeholder (back link, TA link); both routes on direct load and reload; 375 px no sideways
    scroll with a long tag line in the `<pre>`; the two Brainstorm menus' item → `/treasure-map` and the Tapestry
    header's → the TA page.
  - **Re-aim** (Phase 3's lane, not the Implementer's): `tests/brainstorm/my-assistants.spec.js:190` and
    `tests/brainstorm/my-assistants-map.spec.js:175` and `:377` expect `href="/tapestry/grapevine/treasure-map"` on
    `/assistants`; after this story they expect `/treasure-map`.
  - **Must stay green unchanged:** `test/my-assistant-page.test.js` M3, M4, W7; `test/my-assistants-page.test.js` M2,
    D2; `test/dictionary-concepts.test.js` S9; `test/assistant-management-page.test.js` M2, M3;
    `test/my-curated-dlists-page.test.js` (the sidebar literal); `tests/brainstorm/setup-alert-polish.spec.js` (it
    opens the TA page directly, which doesn't move).

## Out of scope

- The **Assistants by category** cards and the "Mixed assignments…" line (story 2, its own ADR).
- The design's Edit mode, the "edited" raw preview, publishing a kind 10040, and the full Advanced page (a later book).
- Replacing the Tapestry side's literal TA Treasure Map paths with `TA_TREASURE_MAP_PATH`.
- Moving the TA Treasure Map page onto `useTreasureMap` (OPEN.md row 249; unchanged by this ADR).
