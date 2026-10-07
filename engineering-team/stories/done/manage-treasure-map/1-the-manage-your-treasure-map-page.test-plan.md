# Test Plan: Story 1 — The Manage your Treasure Map page, its menu links, and the Advanced placeholder

**Story:** `engineering-team/stories/done/manage-treasure-map/1-the-manage-your-treasure-map-page.md`
**ADR:** `engineering-team/decisions/done/manage-treasure-map/0001-a-design-page-on-the-shared-strict-map-read.md`
**Date:** 2026-10-07

Two files, split as the my-assistants book split them:

- **Node** — `test/manage-treasure-map-page.test.js` (registered in `test/registry.js`): the menu's targets, the
  view-model's words, phases and raw text, and source sentinels on the JSX the runner can't execute.
- **Browser** — `tests/brainstorm/manage-treasure-map.spec.js`: what a viewer sees, with every API network-mocked
  (the `tests/brainstorm/my-assistants-map.spec.js` pattern: the Treasure Map read as the shared hook reads it, local
  strfry first, then the general-purpose relays through `/api/relay/external?…&strict=1`).

Plus three re-aimed assertions in the `/assistants` specs (ADR § Implementation notes, "Re-aim").

## Coverage map

| Criterion | Test | File | Level |
|---|---|---|---|
| AC-1 | M1: the menu module names the three addresses | `test/manage-treasure-map-page.test.js` | unit |
| AC-1 | M2: profileBase `/user` → `/treasure-map`; `/tapestry/users` → the TA page, for owner, admin, customer (with and without an Assistant) and guest | same | unit |
| AC-1 | M3: My Treasure Map keeps label, icon and place (third) in both menus, which list the same items *(guard: passes before and after)* | same | unit |
| AC-1 | M4: exactly one Treasure Map item per menu *(guard)* | same | unit |
| AC-1 | R0-1: each menu still passes its shell's profileBase (Header `/tapestry/users`; Brainstorm top bar and landing page `/user`) *(guard)* | same | static |
| AC-1 | T11a: from `/`, `/assistants` and `/dictionary`, My Treasure Map has `href="/treasure-map"` and opens the page | `tests/brainstorm/manage-treasure-map.spec.js` | e2e |
| AC-1 | T11b: from `/tapestry/about`, the Tapestry header's My Treasure Map opens `/tapestry/grapevine/treasure-map` *(guard)* | same | e2e |
| AC-2 | V1: COPY holds every fixed word of § Copy, exactly, with curly apostrophes | `test/manage-treasure-map-page.test.js` | unit |
| AC-2 | D1: App.jsx routes `MANAGE_TREASURE_MAP_PATH` → `<ManageTreasureMapPage />` and `TREASURE_MAP_ADVANCED_PATH` → `<TreasureMapAdvancedPage />`, outside the `/tapestry` tree (AST walk) | same | static |
| AC-2 | D5: no Edit, Editing, Save changes, Assign to all or Choose an Assistant in the page | same | static |
| AC-2 | D6: both pages render `<BrainstormDesignShell>`, not `wide` | same | static |
| AC-2 | T1: under the Brainstorm top bar; kicker, heading (accent on "Treasure Map"), introduction; no edit controls | `tests/brainstorm/manage-treasure-map.spec.js` | e2e |
| AC-2, AC-5 | R0-3: neither address is blocked as a probe *(guard)*; H: live, both answer the app *(skips without a stack)* | `test/manage-treasure-map-page.test.js` | unit / live |
| AC-2, AC-5 | T10: typed in and refreshed, both render their headings, never "Page not found" | `tests/brainstorm/manage-treasure-map.spec.js` | e2e |
| AC-2 | T12: at 375 px, FAQ open and a long tag line in the raw viewer, no sideways scroll; the `<pre>` ends inside the viewport; same for the placeholder | same | e2e |
| AC-3 | V2: FAQS are the four `{ q, a }` pairs in order | `test/manage-treasure-map-page.test.js` | unit |
| AC-3 | T2: closed at first; four questions in order; one answer at a time (`aria-expanded` follows); a second press closes; the button hides them | `tests/brainstorm/manage-treasure-map.spec.js` | e2e |
| AC-4 | V3: `mapPanelPhase` truth table over `(authLoading, user, status)` | `test/manage-treasure-map-page.test.js` | unit |
| AC-4 | V4: an unknown or missing status is `loading`, never `none` | same | unit |
| AC-4 | V5, V6: `rawMapText` is the whole event as found, tags in order, indented; `''` for no event | same | unit |
| AC-4 | D2: the page imports the shared `useTreasureMap`, calls it with `strict: true`, takes the viewer from `useAuth()`, and reads no route or query parameter | same | static |
| AC-4 | T3: found locally — closed, labelled, **kind 10040** chip; open shows the event (parsed equal to the fixture), label flips, closes; every 10040 read asked for `authors: [viewer]` only | `tests/brainstorm/manage-treasure-map.spec.js` | e2e |
| AC-4 | T4: none — local miss, strict relay read reached a relay and found nothing; every relay read carried `strict=1` | same | e2e |
| AC-4 | T5: can't read — error line (`role="alert"`) and Try again, never the none box; Try again reads again and shows the Map | same | e2e |
| AC-4 | T5b: no general-purpose relay and a local miss → can't read, never none | same | e2e |
| AC-4 | T6: still reading — loading line (`role="status"`), no none box, no JSON; then the Map | same | e2e |
| AC-4 | T7: a relay answering with someone else's 10040 → none; their pubkey never appears | same | e2e |
| AC-5 | D3: the pages read the three addresses from `avatarMenuLinks.js`; no re-typed path in the pages or the view-model | `test/manage-treasure-map-page.test.js` | static |
| AC-5 | D7: the placeholder calls no data read (`useTreasureMap`, `useCypher`, `fetch`, `queryRelay`, profile lookups) | same | static |
| AC-5 | T9: the Advanced line and link (`href="/treasure-map/advanced"`); placeholder back link (`href="/treasure-map"`), kicker, heading, placeholder sentence, TA Treasure Map link (`href="/tapestry/grapevine/treasure-map"`); a reload of it reads no Map; the back link returns | `tests/brainstorm/manage-treasure-map.spec.js` | e2e |
| AC-6 | A1: `myAssistants.js`'s `TREASURE_MAP_PATH` is `/treasure-map` | `test/manage-treasure-map-page.test.js` | unit |
| AC-6 | re-aimed: `/assistants` introduction link, an open row's **Manage on Treasure Map**, an open duty's **Manage** link → `href="/treasure-map"` | `tests/brainstorm/my-assistants.spec.js:190`, `tests/brainstorm/my-assistants-map.spec.js:175`, `:377` | e2e |
| AC-6 | R0-2: the sidebar's TA Treasure Map, My Curated DLists' path and the TA list's link still name `/tapestry/grapevine/treasure-map` *(guard)* | `test/manage-treasure-map-page.test.js` | static |
| AC-6 | D4, V7: neither page nor the view-model imports a publisher or signer, calls `signEvent`/`publish…(`, uses storage, or sends a non-GET | same | static |
| AC-6 | T8: signed out — heading, introduction, FAQ, Advanced line; the sign-in line and **Sign in with nostr** in place of the raw viewer; no 10040 read at all | `tests/brainstorm/manage-treasure-map.spec.js` | e2e |
| AC-6 | T13 (and `safe()` in T1, T3, T8, T9): across the states, `signEvent` is never called, no non-GET request (the read-only Cypher POST aside), no WebSocket | same | e2e |

## Edge cases

- [x] A Map that exists only on a relay that couldn't be reached reads as can't read, never none (T5, T5b; V3).
- [x] Someone else's Map on a relay is never shown (T7); the read only ever asks for the viewer's own (T3).
- [x] Unknown hook status never reads as none (V4).
- [x] A very long tag line doesn't widen the page at 375 px (T12).
- [x] Signing in hasn't settled → loading, not signed out, not none (V3 rows with `authLoading: true`).
- [x] The Tapestry side doesn't move (T11b, R0-2).
- [ ] Concept Graph API unavailable / handle not found: not applicable. The story touches no concept.

## Test infrastructure

- **Node:** the gate's runner (`npm test`, `test/test.js` → `test/registry.js`); the suite also runs alone with
  `node -e "require('./test/manage-treasure-map-page.test.js').run()"`. JSX structure is read with the root
  `typescript` dependency's parser, as `test/my-assistant-page.test.js` does (a library call, not a lint step).
- **Browser:** Playwright (`npm run test:playwright`), chromium. Every `/api/*` the pages call is mocked per test, so
  no stack state is needed. No WebSocket is allowed.
- **Concept Graph API:** not used. The live H-class (two tests) skips without a stack.
- **Firmware state:** none needed.
- **Fixtures:** fixed fake keys (`'a1'.repeat(32)` …), a four-entry kind 10040 (`MAP`), someone else's 10040, a
  long-tag variant for T12.
- **Running the browser spec without a stack** (how it was run here): build the UI (`cd ui && npx vite build`, which
  writes `../dist`), serve `dist/` with an SPA fallback that answers any unmocked `/api/*` with 404 JSON, and point
  Playwright at it with `BRAINSTORM_BASE_URL`. Every request the specs depend on is mocked, so the result matches a
  run against the real control panel. The same setup runs the existing `/assistants` specs green, apart from the
  three re-aimed assertions (see Verification).

## How to run

```
npm test
node -e "require('./test/manage-treasure-map-page.test.js').run()"
```

For browser/e2e:
```
npm run test:playwright -- tests/brainstorm/manage-treasure-map.spec.js tests/brainstorm/my-assistants.spec.js tests/brainstorm/my-assistants-map.spec.js --project=chromium
```

## Verification

The new tests fail with the current code. Confirmed on 2026-10-07 at commit `d489ea6` (plus this phase's test files).

**Node** (`test/manage-treasure-map-page.test.js`): 17 fail, 5 pass, 2 skip. The passes are the guards that must hold
before and after (M3, M4, R0-1, R0-2, R0-3); the skips are the live H-class (no stack). Every failure is the feature
missing, never a loader or syntax error:

```
FAIL  M1 … MANAGE_TREASURE_MAP_PATH: want "/treasure-map", got undefined; TREASURE_MAP_ADVANCED_PATH: … got undefined; TA_TREASURE_MAP_PATH: … got undefined
FAIL  M2 … /user {"classification":"owner",…}: want /treasure-map, got "/tapestry/grapevine/treasure-map"; … (every person)
FAIL  V1–V7 … ui/src/pages/treasure-map/manageTreasureMap.js does not exist. ADR 0001 sub-decision 4: the pure view-model, loadable in Node.
FAIL  A1 … myAssistants.js TREASURE_MAP_PATH should follow the Brainstorm menus to /treasure-map; got "/tapestry/grapevine/treasure-map"
FAIL  D1 … ui/src/App.jsx does not import pages/treasure-map/Index
FAIL  D2, D5, D7 … ui/src/pages/treasure-map/Index.jsx (Advanced.jsx) does not exist
FAIL  D3, D4, D6 … ui/src/pages/treasure-map/Index.jsx and …/Advanced.jsx must both exist / do not exist
PASS  M3, M4, R0-1, R0-2, R0-3
SKIP  H (R0) ×2 — stack unreachable
manage-treasure-map-page: 5 passed, 17 failed, 2 skipped
```

Neighbouring suites unchanged and green: `my-assistants-page` 50/0 (2 skip), `my-assistant-page` 31/0,
`dictionary-concepts` 22/0 (3 skip), `assistant-management-page` 23/0 (1 skip), `my-curated-dlists-page` 19/0,
`stack-free-npm-test` 6/0 (1 skip; G5, every suite registered, passes).

**Browser** (`tests/brainstorm/manage-treasure-map.spec.js`, chromium, against the built UI as above): 14 fail, 1
passes (T11b, the Tapestry header's guard). Every failure is the page not existing yet (`/treasure-map` renders the
app's "Page not found") or the Brainstorm menus' old target:

```
T1, T8, T10  waiting for getByRole('heading', { name: 'Manage your Treasure Map.', level: 1 }) — element(s) not found
T2, T12, T13 waiting for locator('main').getByRole('button', { name: 'Frequently asked questions' }) — not found
T3–T7        waiting for locator('main').getByRole('button', { name: /^(View|Hide) the raw Treasure Map/ }) — not found
T9           waiting for getByText('Need fine-grained control over every entry?') — not found
T11a         Expected: "/treasure-map"  Received: "/tapestry/grapevine/treasure-map"
T11b         passed
```

**Re-aimed `/assistants` specs** (`my-assistants.spec.js`, `my-assistants-map.spec.js`, same setup): 24 pass, 3 fail —
exactly the three re-aimed assertions, each `Expected "/treasure-map", Received "/tapestry/grapevine/treasure-map"`.
