# Review: Story 1 — My Curated DLists: the menu item, the list of empowered DLists, and the detail page's front door

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-11
**Diff:** `git diff 551bbe4a...HEAD` (base `551bbe4a` = origin/staging at the branch point; HEAD `ee45d981`; branch `feat/my-curated-dlists`); implementation `c4803b13..ee45d981`
**Story:** `engineering-team/stories/my-curated-dlists/1-my-curated-dlists-page.md`
**ADR:** `engineering-team/decisions/my-curated-dlists/0001-my-curated-dlists-page.md`
**Test plan:** `engineering-team/stories/my-curated-dlists/1-my-curated-dlists-page.test-plan.md`

Branch commits audited (oldest first): `5c0cb42f` book open · `455c936c` story · `835301bd` ADR · `c4803b13` failing tests · `ee45d981` implementation. The implementation commit touches `ui/src` (two new pages, two new hooks, a new section in `treasureMap.js`, one route block, one nav line), the story's `## Deviations`, and OPEN.md row 261. It changes no test file.

## Quality gates (run by reviewer, not trusted)

- [x] **Story-scoped gate** (the test plan's command: the new suite plus the eight guards): `TOTAL_FAIL=0`, 186 pass. `my-curated-dlists-page` 19/0 · `tl-treasure-map-panel` 18/0 · `treasure-map-panel-summary` 18/0 · `dlist-curation-panel` 18/0 · `dlist-curation-tl-panel` 19/0 · `tl-treasure-map-optin-publish` 23/0 · `dlist-curation-map-entries` 14/0 · `treasure-map-relay-presence` 35/0 · `treasure-map-relay-sync` 22/0.
- [x] **The suite failed before the implementation.** I extracted the tree at `c4803b13` into the scratchpad (`git archive` of `ui/src` and the suite) and ran it: 4 pass / 15 fail. U1–U9 and S1–S6 are red, R1–R4 green, which matches the test plan's recorded run.
- [x] **Full `npm test`**, run in the background into a scratchpad log (OPEN.md row 83), exit 1, `Overall: FAIL`. 162 suites pass and 3 fail, with 4 failing tests. All four are OPEN.md row 191's: the L0 publish-policy guards in `tl-membership-method-selector`, `tl-weighted-sum-method` and `tl-certainty-method` (`allowExternalPublish:true` on this container), plus `tl-certainty-method` LP (the prune script refuses under the same posture). The two row-261 LB matrices (`tl-weighted-sum-method` LB, `tl-certainty-method` LB) **skipped** in this run ("meili indexing did not settle in budget"). In the Implementer's run they failed. So this run neither reproduced nor refuted row 261. Apart from those two lines, the per-suite summary matches the Implementer's log (`diff` of the 165 suite lines). Total skipped: 56 here, 54 there; the two extra skips are those LB tests. `my-curated-dlists-page` passed 19/0. None of the red suites can be affected by this diff: they test the server's publish policy, the prune script, and server-published TLs under `src/`, and the branch changes nothing outside `ui/src`, `test/` and docs. I didn't change the machine's publish posture (row 191).
- [x] **Served bundle = HEAD.** The local stack serves `index-BXfRYMA9.js` from the bind-mounted `dist/`. A Vite build of HEAD into the scratchpad produced the same hash, so the live check below ran against exactly the committed code.
- [x] **Live browser check.** Headless Chromium (Playwright 1.56.1, `executablePath` pointing at the cached chromium-1228, per OPEN.md row 232) against `:7778` with `page.route` mocks for `/api/auth/status` and `/api/auth/user-classification` (a customer `7777…` whose assistant is `253d40c4…`, or none) and the kind-10040 `/api/strfry/scan`. Some scenarios also mocked the kind-10040 `/api/relay/external` and the general-purpose-relays cypher. Everything else hit the real stack: the header scans in local strfry, the dcosl fetches, and the four general-purpose relays. First I checked the real data from the API: the local TA is `11f23fe4…` and its `list` header ("list") is in local strfry; `253d40c4…`'s `dog-breed` header ("dog breed") exists only on dcosl. The synthetic Map had these entries: `39998:dog-breed`→mine @dcosl, `39998:list`→TA, `39999:missing-list`→mine @dcosl, a later `39998:dog-breed`→TA, `39998:dlist-header`, `30382:rank`, `39998:https-hint`→mine @`https://example.com`, and `39998:a/b 50%`→mine in uppercase hex. A MutationObserver recorded every distinct state of `<main>`, which catches flashes.
  - **Signed out** (list page and a direct detail URL): the page shows "⏳ Checking sign-in…" or "⏳ Checking your Treasure Map…", then the sign-in sentence. The prompt never flashed before auth resolved.
  - **Menu:** 🍇 My Grapevine lists TA Treasure Map, **My Curated DLists**, Trusted Assertions, Trusted Lists, Trust Determination, Search Preferences, Meilisearch. The new item is active on the list page and on every detail URL; TA Treasure Map is not (and is active on its own page). Breadcrumbs read "Home › My Grapevine › My Curated DLists", with "› Detail" on detail pages.
  - **The list** (Map found): five rows in Map order.
    - "dog breed": the name was fetched from dcosl through the entry's hint; a link; "your assistant"; the duplicate note.
    - "list": found locally; plain text; "another pubkey · 11f23fe4…3767"; "Only lists your own assistant curates open here."
    - "missing-list" (39999): a link; "⚠️ Header not found locally or on wss://dcosl.brainstorm.world".
    - "https-hint": a link; the hint was not fetched.
    - "a/b 50%": a link; the uppercase delegate counted as mine.
    - `dlist-header` and `30382:rank` were absent.
    - Requests: one kind-10040 scan, three header scans (one per (kind, pubkey)), and `/api/relay/external` only for dog-breed and missing-list.
  - **Detail via the SPA:** dog breed shows "39998:dog-breed · curated by your assistant · 253d40c4…6ec0" and "Header found on wss://dcosl.brainstorm.world."; the back link returns to the list. `a/b 50%` opens at `…/39998%3Aa%2Fb%2050%25` with the heading "a/b 50%".
  - **Direct visits.** Each of these showed one sentence plus the back link and no list content:
    - `39998%3Alist`: "…is empowered for another pubkey · 11f23fe4…3767 — only lists your own assistant curates open here."
    - `…unknown`: "not on your Treasure Map".
    - `garbage` and `39998%3Adlist-header`: "…is not a curated-DList address."
    - `39999%3Adog-breed` and `39998%3ADog-Breed`: "not on your Treasure Map".

    `39999%3Amissing-list` and `39998%3Adog-breed` open.
  - **No assistant:** the line "You don't have a Tapestry Assistant on this instance, so none of these lists open here." appears above the list; there are zero links and no per-row "Only lists…". The detail page shows the no-assistant sentence.
  - **No Map** (local miss, real relays): "No Treasure Map found — Searched local strfry and 4 general-purpose relays: wss://relay.damus.io, …" plus "Go to TA Treasure Map →". The detail page says the same, naming the relays. The relay step carried all four URLs.
  - **A Map with no DList entries** (only `30382`, `30392` and `dlist-header`): "Your Treasure Map empowers no DLists yet. Empower your assistant to curate one from the DList Curation panel on TA Treasure Map." with a link.
  - **Failures:** a failed local kind-10040 scan, an unsuccessful relay step, and a failed relay-list cypher each gave its own red error on the list page. The detail page gave "Your Treasure Map could not be read: …". None read as "no DLists" or "no Map".
  - **The OPEN.md row-260 race:** I navigated within the SPA from TA Treasure Map (auth already resolved) with the Map only on relays and the relay-list cypher delayed 3 s. The local miss came at +88 ms, and the relay step waited until +3126 ms, after the list settled. The rows rendered, and "No Treasure Map found" never did.
  - **Logging out on the detail page** goes straight to the sign-in sentence; no list content lingers.
  - **Narrow (390 px) screenshot:** rows wrap legibly.
  - **Console and network:** the only 4xx responses were `GET /api/user-prefs` → 401 from the app shell (the mocked session has no server session) and a server 400 for a malformed percent-encoded document URL I sent on purpose (`%E0%A4%A`). That URL is rejected before the SPA loads, and the app's own links never produce one. There were no page errors. The only non-GET request was `POST /api/neo4j/query` carrying the read-only relay-list `MATCH` (plus the `/api/auth/logout` I mocked for the logout case). Nothing was signed, published, or imported. Every observation in the story's `## Deviations` live-verification paragraph reproduced.
- [x] `bash scripts/harness-lint.sh`: `harness-lint: clean (0 violations)` before this review; re-run after the review and the story flip (see On PASS).
- [ ] `npm run test:playwright`: N/A. The test plan has no Playwright half, and the installed driver still can't launch (OPEN.md row 232). The live check above stands in for it.
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._ (The scratch build above was only used to compare bundle hashes.)

## Spec adherence
- [x] Every acceptance criterion has a passing test and was seen live:
  - **AC-1 (menu item)** → S1, S2, R1, R2. `Layout.jsx:50` sits directly after the TA Treasure Map line with no `end`. `App.jsx:357-365` is the nested `curated-dlists` block (index → list page, `:id` → detail with crumb "Detail"). Live: nav order, active state, breadcrumbs.
  - **AC-2 (whose Map; the states before a list)** → U6, S3, S5.
    - `MyCuratedDLists.jsx:35-54`: while auth loads, a checking line rather than the prompt; the sign-in prompt when signed out; the loading line; a red error box; "No Treasure Map found" naming the relays, with the link.
    - `useTreasureMap.js:50-99`: local first, then the relays only after the relay list settles; every failure is `error`.
    - Live: all three failure modes and the race.
  - **AC-3 (the list)** → U1, U2, U3, U7, U8, U9, S3. `curatedDListRows` (`treasureMap.js:275-291`): first entry per raw first element, with `ignoredDuplicates`. `lookupCurationHeaders` (`:347-393`). `CuratedDListRow` (`MyCuratedDLists.jsx:88-128`): the name from `names[1]` or the d-tag with a note, `<code>{kind}:{d}</code>`, the badge, the hint, the duplicate note. The empty state is at `:55-61`. Live: as above.
  - **AC-4 (only my assistant's lists open)** → U3, U6, S3, S6. `mine` compares against `user.assistantPubkey`, lowercased (`treasureMap.js:276`, `:285`). The link renders only when `row.mine` (`MyCuratedDLists.jsx:103-105`), including rows whose header wasn't found. The no-assistant line is at `:65-67`. Live: links only on mine rows, including missing-list, https-hint and a/b 50%.
  - **AC-5 (the detail page's front door)** → U4, U5, U6, S4. `CuratedDListDetail.jsx:32-51`: `useParams()` without decoding, one `curatedDListAccess` decision, one sentence per status, the back link, no list content. When the list opens (`:53-75`): heading, `<code>`, "curated by your assistant · <short>", the header's lookup state. Live: SPA and direct, every case.
  - **AC-6 (nothing else moves)** → S6, R3, R4, plus the eight guards. `git rev-parse` blob ids for `TrustedAssertions.jsx`, `TreasureMapTagsPanel.jsx`, `DListCurationPanel.jsx` and `pages/lists/DListDetail.jsx` are identical at `551bbe4a` and HEAD. There is no diff under `ui/src/pages/lists/`, `ui/src/config/avatarMenuLinks.js`, `ui/src/components/Header.jsx`, or any server path. The new files contain no signer, no `/api/strfry/publish`, no `publish*` helper, and no POST of their own. The live network log agrees.
- [x] **The test plan's flagged interpretation (auth loading first) is a faithful reading of ADR sub-decision 4.** The ADR lists `signed-out` before "`checking` (auth or Map still loading)". But `AuthContext` keeps `user === null` for the whole initial auth check (`AuthContext.jsx:25-26`, `:45-79`), so under the literal order, the "auth still loading" arm of `checking` could never fire on first load. Every direct visit would then show the signed-out sentence while auth resolves, which is exactly the defect ADR fact 5 pins on the Treasure Map page, and it contradicts ADR note 4. With auth first (`treasureMap.js:321`), everything else keeps the ADR's order. The implementation checks `map-error` and `no-map` before the Map-loading `checking` (`:326-328`), the reverse of the ADR's listing. That doesn't change behaviour, because `mapStatus` holds one value at a time. Live: the checking state came first, then the right sentence, and no signed-out sentence flashed while signed in.
- [x] No criterion is silently dropped.
- [x] No behavior added that isn't in the story. The three logged deviations stay within the ACs:
  - Naming only a relay that was actually checked keeps the not-found note honest (but see NB-1 on its wording).
  - Hiding the per-row "Only lists…" when the viewer has no assistant lets AC-4's third sentence (the page-level line) say why once.
  - The author/kind filter on the relay answer (`useTreasureMap.js:89`) is defensive and leaves ADR sub-decision 5's order and stop rule unchanged.

## ADR adherence
- [x] Files changed match implementation notes 1–8 exactly, and nothing else. The util section, the five exports and their signatures and shapes are as in note 1. The hooks' return shapes match notes 2–3, including `refresh` and the ADR-required header comment (`useTreasureMap.js:17-24`). The pages follow notes 4–5, including the insertion marker for stories 2–3 (`CuratedDListDetail.jsx:72-73`). The route block and nav line are verbatim notes 6–7.
- [x] Layering follows Option C. The decisions (which entries count, who may open a detail page, the two-step lookup) are pure, dependency-injected functions in the util, which still has zero imports (the eight suites load it as plain ESM). The hooks only bind the real fetchers, and the pages render.
- [x] No new dependencies.
- [x] **The ADR's review obligation** ("keeping the new hook's lookup order equal to the Treasure Map page's", Option C Cons): I compared `useTreasureMap.js` with `TrustedAssertions.jsx:25-94` line by line. The relay-list cypher is character-for-character the same, parsed the same way (`nostrRelay.websocketUrl`). The local filter is `{ kinds: [10040], authors: [pubkey], limit: 1 }` and stops on a hit. The relay step is `/api/relay/external?filter=…&relays=…`, newest wins. The differences are the two sub-decision 5 sanctions (it waits for the relay list; failures are `error`), plus two harmless extras: URL de-duplication (`:43`) and the relay-answer filter (`:89`, a logged deviation).
- [x] The header lookup keeps ADR `dlist-curation/0006`'s rule as `TreasureMapTagsPanel.jsx:50-96` implements it (a local batch per (kind, delegate), then the ws/wss hint only for what is still missing, newest wins). It adds the `failed` marker and the d-tag check at the hint, as sub-decision 6 asks.

## Concept-graph integrity
- [x] Handles are in `kind:pubkey:slug` form. `/api/concept-graph/summaries` on the local stack lists `39998:11f23fe4…:list`, `…:tapestry-assistant` and `…:shared-concept`, the three the story names. The rows' coordinates are built as `<kind>:<pubkey>:<d>` (`treasureMap.js:284`).
- [x] Firmware reinstall: not needed. No concept definition changed.
- [x] Orientation went through `/summaries` (the ADR's Concepts line; I re-checked above). No BIBLE re-derivation.

## Things tests can't catch
- [x] No secrets in committed files. `/usr/bin/grep` over the branch's added lines finds no 64-hex literal (the fixtures are computed, e.g. `'a'.repeat(64)`) and no key material.
- [x] No leftover debug logging, `console.log`, `debugger` or TODOs in the new files or the util section.
- [x] No commented-out code. The one comment block in the detail page is the ADR-specified insertion marker.
- [x] Error paths and edge cases handled where it matters. Every failure renders as an error (live: three modes). A failed header step shows "Couldn't check the header", never "absent". Garbage never throws (U3, U4, U6, U9). URL shapes round-trip through the real `matchRoutes` (colons, slashes, `%`, spaces, non-ASCII, a literal `%3A`), with one router-level exception (NB-5).
- [x] Concurrency and race conditions:
  - `useTreasureMap`: step 1 cancels on cleanup (`:53`, `:67`). Step 2 runs only after a local miss **and** once `useCypher`'s `loading` is false. `useCypher` starts `loading: true` (`useCypher.js:16`), so no window opens before the query is issued. Step 2 cancels on cleanup and lists `pubkey` in its deps (`:98-99`), so a pubkey change or `refresh` drops an in-flight relay answer. A failed relay list is `error` (`:73-75`), and an empty one is a skip that reads `none` (`:77`, per note 2).
  - `useCurationHeaders` keys on coordinates and hints (`:21`, `:31`), not on array identity, so a re-render doesn't re-fetch. It cancels on change and on unmount (`:26-30`). `lookupCurationHeaders` never rejects, so there's no unhandled rejection.
  - Remaining: a one-commit stale-state window on a direct account-to-account switch. The shipped UI can't reach it (NB-2).
- [x] Security: every value renders as React text (including the decoded id in the `bad-id` sentence). Route ids go through `encodeURIComponent` under a fixed base path. Relay hints are shown as text, not links. The hint fetch uses the existing `/api/relay/external` exactly as Map Entries does, over the viewer's own Map.

## House rules check
- [x] Concept Graph API authority respected.
- [x] No new lint, typecheck or build tooling.
- [x] Per-deployment TA pubkey: the new files contain no `taPubkey` and no pubkey literal (S6, and the sweep). "Mine" is `useAuth().user.assistantPubkey` (OPEN.md row 188); a viewer without an assistant has nothing that is "mine". The ADR 0015 `LEGACY_*` constants are untouched.
- [x] Architecture invariants:
  - POV-first: the viewer's own Map (`authors: [user.pubkey]`) and own assistant. A shared or bookmarked URL resolves against the *viewer's* Map, never the author's.
  - Decentralized-first: every entry is listed, whatever pubkey it names; only opening a list is scoped to the viewer's own assistant, and that happens at read time.
  - Filter at view time: nothing is stored; both pages re-derive on every load.
  - Local-first (principle 4): nothing is written.

## Product-guide adherence *(when the story traces to a PRD)*
- [ ] N/A. The book is acceptance-frame (no PRD, no style guide). The copy follows ADR notes 4–5.
- [ ] N/A.

## Findings

### Blocking
None.

### Non-blocking
1. **ui/src/pages/grapevine/MyCuratedDLists.jsx:95** (same text at `CuratedDListDetail.jsx:61`). When a row's hint isn't ws/wss (live: `https://example.com`), the note reads "Header not found locally; no relay hint", while the same row shows that hint (`MyCuratedDLists.jsx:114`). The deviation's intent, never naming a relay that wasn't checked, is right, but "no relay hint" is false in this case. Only a hand-edited Map can carry such a hint (the DList Curation panel writes ws/wss). Optional improvement: say the hint isn't a ws/wss relay, so it wasn't checked.
2. **ui/src/hooks/useTreasureMap.js:50-99**. Stale *responses* are handled, but the returned state isn't tied to the pubkey it belongs to. On the first commit after `pubkey` changes directly from A to B (not via null), the hook still returns A's `found` state until step 1's `setState(LOADING)` re-renders. For that one commit the pages compute B's rows and access decision from A's Map, and step 2 may start one relay fetch for B that the next render cancels. The shipped UI can't reach this: sign-in is offered only when signed out (`ui/src/components/Header.jsx:119-121`), and logout goes through null (confirmed live). Optional improvement, before OPEN.md row 249 moves the Treasure Map page onto this hook: keep `pubkey` in the state object and report `loading` while it differs from the argument.
3. **ui/src/pages/grapevine/CuratedDListDetail.jsx:17**. While auth resolves, the detail page says "⏳ Checking your Treasure Map…" (one `checking` sentence covers both auth and the Map); the list page says "⏳ Checking sign-in…" for the same moment. Cosmetic.
4. **ui/src/utils/treasureMap.js:359-391**. `lookupCurationHeaders` awaits each local scan and each hint fetch one after another, as Map Entries does. That's fine at today's Map sizes (live: about 150 ms per dcosl fetch). Optional improvement, for story 3 or the row-249 migration: run each step's calls concurrently so page latency is bounded by the slowest relay, not the sum.
5. **ui/src/utils/treasureMap.js:306** (a router limitation, not a util bug). A d-tag containing the literal characters `%2F` doesn't round-trip. React Router 7.13.1 decodes the segment and then turns `%2F` back into `/` inside params, so `…/39998%3Aa%252Fb` arrives as `39998:a/b` and reads "not on your Treasure Map". I checked this against the real `matchRoutes`; every other shape round-trips. It's unrealistic for real d-tags. I'm recording it so stories 2–3, which reuse the route, don't have to rediscover it.

### Harness friction *(anything the process itself got wrong this story — stale doc, wrong port/path, contradictory instruction; each becomes an OPEN.md row, type `meta`)*
1. OPEN.md row 232 recurred: `npm run test:playwright` still can't launch on this machine, so the live check used `executablePath` → chromium-1228. Existing row; no new row.
2. OPEN.md rows 83, 191 and 261 recurred: the full suite exceeds the foreground cap and is red by default here, so the reviewer reconciles the failures against three rows by hand. The two row-261 tests also flip between FAIL and SKIP depending on Meili load, so a single run can't confirm or clear that row. Existing rows; no new row.
3. CLAUDE.md § "Per-deployment TA pubkey" still calls `82b75e47…` this machine's local TA; this stack answers `11f23fe4…` (`/api/assistant/pubkey`). It didn't mislead this review (I checked the API), and five OPEN rows already record it (44, 71, 127, 168, 223). Those duplicates are themselves the signal for the next `/whats-open` triage to collapse them into one fix. No new row.

## Verdict
**PASS**

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection performed; the result is reported in the chat (human-gated), not recorded here. `/close-book` not offered.
