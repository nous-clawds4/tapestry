# Review: Story 2 — The two headers: my assistant's DList header and the shared header it points to

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-11
**Diff:** `git diff c7f4579f..HEAD` — the story's whole footprint (`c7f4579f` = story 1's review commit; HEAD `7b1a1b45`; branch `feat/my-curated-dlists`, base `551bbe4a` = origin/staging); implementation `git diff c4964278..7b1a1b45`
**Story:** `engineering-team/stories/my-curated-dlists/2-the-two-headers.md`
**ADR:** `engineering-team/decisions/my-curated-dlists/0002-the-two-headers.md`
**Test plan:** `engineering-team/stories/my-curated-dlists/2-the-two-headers.test-plan.md`

Branch commits audited (oldest first): `c092f827` story · `e3c0c387` ADR · `c4964278` failing tests · `7b1a1b45` implementation. The implementation commit changes four `ui/src` files: `CuratedDListHeaders.jsx` (new), `CuratedDListDetail.jsx`, `useCurationHeaders.js`, and `treasureMap.js` (additions only). It also appends `## Deviations` to the story (no other story line changes) and touches no test file. The rest of the footprint is the ADR, the story, the test plan, the suite and its `test/test.js` registration, and a two-entry update to the epic file. All of it is in scope.

## Quality gates (run by reviewer, not trusted)

- [x] **Story-scoped gate** (the test plan's command: the new suite, story 1's suite and the eight guards): `TOTAL_FAIL=0`, 202 pass.
  - `my-curated-dlists-headers` 16/0 · `my-curated-dlists-page` 19/0
  - `tl-treasure-map-panel` 18/0 · `treasure-map-panel-summary` 18/0
  - `dlist-curation-panel` 18/0 · `dlist-curation-tl-panel` 19/0
  - `tl-treasure-map-optin-publish` 23/0 · `dlist-curation-map-entries` 14/0
  - `treasure-map-relay-presence` 35/0 · `treasure-map-relay-sync` 22/0
- [x] **The suite failed before the implementation.** I extracted the tree at `c4964278` into the scratchpad (`git archive` of `test/`, `ui/src` and the package files) and ran the suite there: 3 pass / 13 fail. U1–U7 and S1–S6 are red (the three exports and the headers module don't exist yet); R1–R3 are green. This matches the test plan's recorded run line for line.
- [x] **Full `npm test`**, run in the background into a scratchpad log (OPEN.md row 83; about 45 minutes). Result: exit 1, `Overall: FAIL`, 163 suites pass and 3 fail, 4 failing tests, 56 skipped.
  - **The four failures are OPEN.md row 191's:** the L0 publish-policy guards in `tl-membership-method-selector`, `tl-weighted-sum-method` and `tl-certainty-method` (this container answers `allowExternalPublish:true`), plus `tl-certainty-method` LP (the prune script refuses under the same posture).
  - **Both row-261 LB matrices skipped** ("meili indexing did not settle in budget").
  - **Same as the Implementer's run.** The per-suite summary (173 lines, including the skip total) is identical to the Implementer's log, which has the same four failures and the same two skips.
  - **This story's suites:** `my-curated-dlists-headers` 16/0 and `my-curated-dlists-page` 19/0 in the full run.
  - **Unrelated to this diff.** None of the red suites can be affected by it: they test the server's publish-policy guard and the prune script, and story 2 changes only `ui/src`, `test/` and docs.
  - I did not change the machine's publish posture.
- [x] **Served bundle = HEAD.** The stack serves `index-C4lzGt9g.js`. A Vite build of HEAD into the scratchpad produced a byte-identical file, identical both to the repo's `dist/` and to the bytes the stack actually serves (fetched with curl).
  - The `tapestry` container has no bind mount of the repo (Harness friction 2), so I also diffed the seven server files the AC-4 reasoning rests on against the container's copies. All are byte-identical: `publishEvent.js`, `tapestryBrainWrite.js`, `auth.js`, `redis-consumer.js`, `fetchEvents.js`, `eventSync.js`, `api/index.js`.
- [x] **Live browser check (mocked auth).**
  - **Setup.** Headless Chromium (Playwright 1.56.1, with `executablePath` pointing at the cached chromium-1228, per OPEN.md row 232) against the local stack. `page.route` mocked three things:
    - `/api/auth/status`: a synthetic customer, `5e1f…`.
    - `/api/auth/user-classification`: assistant `253d40c4…`.
    - The kind-10040 `/api/strfry/scan`: a synthetic Map with `39998:dog-breed` → `253d40c4…` @ dcosl, and `39998:review2-no-such-dlist` → the same.

    Everything else hit the real stack unless noted below.
  - **Real data, checked through the API first:** `253d40c4…`'s `dog-breed` header (`adcc9abc…`) was only on dcosl and carries `["b","39998:11f23fe4…:dog-breed","inherit-items"]`; the shared header (`c1fc1a32…`) is in local strfry.
  - **The real dog-breed page:**
    - The heading reads "dog breed".
    - The assistant section shows:
      - "Found on wss://dcosl.brainstorm.world — not in this instance's strfry." with **Import to local strfry**;
      - "Authored by your assistant · 253d40c4…6ec0";
      - "Points to 39998:11f23fe4…3767:dog-breed (inherit-items)".

      It has no problem lines and no Simple Lists link.
    - The shared section shows "dog breed · 39998:11f23fe4…3767:dog-breed" and "In this instance's strfry. Open in Simple Lists →", linking to `/tapestry/lists/39998%3A11f23fe4…%3Adog-breed`.
    - Both raw toggles are closed on load (no `<pre>`).
    - Each toggle opened to JSON equal to the event as received (compared serialized, key order included), closed again, and was closed after a reload.
    - The shared link opened Simple Lists: "A LIST OF dog breeds", "✅ In Neo4j", Event ID `c1…`.
  - **Pointer states**, using synthetic assistant headers injected into the kind-39998 local scan:
    - **No `b` tag:** "⚠️ It has no b tag, so it points at no shared header." The shared section says "Can't tell which shared header: your assistant's header names no shared header."
    - **An event-id `b`:** "⚠️ One of its b tags is not a list coordinate.", plus the same shared-section sentence.
    - **Type `pointer`, and type absent:** both show "Points to … (pointer)" and "⚠️ Its pointer type is “pointer”, not inherit-items.", and the shared header is still followed.
    - **Two coordinates:** "⚠️ It has more than one pointer — this page follows the first." The first coordinate is followed.
    - **Sentinel alone:** a neutral line, "It is marked deliberately unaffiliated (b-tag-deferred).", and the shared section says "Can't tell which shared header: your assistant's header is marked deliberately unaffiliated."
    - **Sentinel beside a pointer:** both lines appear and the pointer is followed (see NB-1).
    - **Three problems at once:** the three sentences in order, with the first coordinate followed.
    - **A pointer to a header that exists nowhere:** the shared section says "⚠️ Header not found locally or on wss://dcosl.brainstorm.world."
  - **Assistant header missing** (real lookups, using a Map entry whose d-tag exists nowhere): "⚠️ Header not found locally or on wss://dcosl.brainstorm.world." The shared section says "Can't tell which shared header: your assistant's header was not found."
  - **Failed lookups** (both steps stubbed to fail):
    - For the assistant's header: "⚠️ Couldn't check — looked locally and on wss://dcosl.brainstorm.world." The shared section says "…your assistant's header couldn't be checked."
    - For the shared header: "⚠️ Couldn't check — looked locally and on wss://dcosl.brainstorm.world."
  - **Import failure** (publish stubbed):
    - A 200 `{success:false,error}` reads "Import failed: stubbed refusal".
    - An HTML 500 reads "Import failed: request failed (500)".
    - In both cases the rest of the section is unchanged, the shared section is unchanged, and the only request after the click is the POST (no re-check).
    - The body was `{ event, signAs: 'client' }`, with the event equal to the dcosl copy.
  - **Stubbed success whose re-check still misses** (the re-check slowed to 2 s):
    - A double-click sent one POST; the button was disabled and read "⏳ Importing…".
    - The section then read "✓ Imported — re-checking…".
    - Finally it read "Imported, but the re-check did not find it in this instance's strfry." Exactly one re-check scan was made.
  - **The shared section's own relay path** (its local scan stubbed empty; the real dcosl fetch):
    - It shows "Found on wss://dcosl.brainstorm.world — not in this instance's strfry." with the import control.
    - A stubbed import whose re-check finds the header flips the section to "In this instance's strfry." with the link.
    - A stubbed import that doesn't land shows the did-not-find line.
    - In both cases the re-check scanned only the shared author, so `onImported` is bound to the right `refresh`, and the assistant section did not change.
  - **Story 1's surfaces:** the list page shows both rows, with the not-found row's warning. The front door shows "39998:review2-not-on-map is not on your Treasure Map."
  - **Console and network:** the only 4xx in every run was `GET /api/user-prefs` → 401 from the app shell (the mocked session has no server session). There were no page errors. Nothing reached the server's publish endpoint in the mocked runs: every publish was stubbed, and a guard blocked any unstubbed one.
  - Every observation in the story's `## Deviations` live-verification paragraph reproduced.
- [x] **The one real import.** On the real dog-breed page, `/api/strfry/publish` was not routed at all; the request and response were only observed.
  - **Request:** one `POST`, `application/json`, body keys `[event, signAs]`, `signAs: 'client'`, and a `body.event` equal to the dcosl event as received (`adcc9abc724533f7…`).
  - **Response:** 200 `{success:true, event:…}`, with **no `brainWrite` key**, so the brain-first hook returned null.
  - **Page:** the section re-checked (one scan) and read "In this instance's strfry. Open in Simple Lists →", linking to `/tapestry/lists/39998%3A253d40c4…%3Adog-breed`. The shared section was unchanged.
  - **Simple Lists:** the link opened Simple Lists for `39998:253d40c4…:dog-breed`: "A LIST OF dog breeds", Event ID `adcc9abc…`. Simple Lists' own badge read "⬜ Not in Neo4j". I did not touch its Import-to-Neo4j buttons.
  - **strfry, afterwards:** `GET /api/strfry/scan` with `{kinds:[39998], authors:[253d40c4…], '#d':['dog-breed']}` now returns that one event. Its id, pubkey, created_at, kind, content, sig and tags equal the dcosl copy.
  - **Neo4j, afterwards:** `GET /api/neo4j/event-check?uuid=39998:253d40c4…:dog-breed` now answers `status: "missing_from_neo4j"`, `neo4j: null` (before the import it answered `not_found`). I counted nodes directly in Cypher before, right after, and four more times over the next minute:
    - nodes with that uuid: 0;
    - nodes with that event id: 0;
    - nodes with pubkey `253d40c4…`: 0;
    - total `NostrEvent` count: unchanged across the import (951 → 951).
  - **This import changed local state.** The `dog-breed` assistant header for `253d40c4…` is now in the Mac Studio's local strfry, so this machine no longer has the relay-only case for that header. Staging still exercises the shared-header import path (book § Known constraints).
- [x] `bash scripts/harness-lint.sh`: `harness-lint: clean (0 violations)` before this review; I re-ran it after writing the review and flipping the story (see On PASS).
- [ ] `npm run test:playwright`: N/A. The test plan has no Playwright half, and the installed driver still can't launch (OPEN.md row 232). The live checks above stand in for it.
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._ (The scratch build above was only used to compare bundle bytes.)

## Spec adherence
- [x] Every acceptance criterion has a passing test and was seen live:
  - **AC-1 (my assistant's header)** → U2, U5, S1, S2, S3.
    - The section is `AssistantHeaderSection` (`CuratedDListHeaders.jsx:134-164`).
    - Where it was found is `FoundHeader` (`:108-123`): local shows the link; relay shows the import.
    - Authorship is at `:142-146`.
    - `RawEventToggle` (`:41-59`) starts with `useState(false)` and renders `JSON.stringify(event, null, 2)`.
    - Seen live.
  - **AC-2 (the pointer, checked)** → U1–U4, S1.
    - `parseCoordinate` and `describeCurationHeader` are at `treasureMap.js:404-439`.
    - One sentence per problem (`CuratedDListHeaders.jsx:33-38`, `:151-153`), plus the neutral sentinel line (`:150`).
    - Live: every state, alone and combined.
  - **AC-3 (the shared header)** → U6, U7, S1–S3, S5, R2.
    - The row is `curationPointerRow(info?.pointer, COMMUNITY_RELAY)`, with `COMMUNITY_RELAY = COMMUNITY_RELAYS[0]` (`CuratedDListDetail.jsx:12`, `:47`).
    - It goes through a second `useCurationHeaders`, so the lookup is local first, then the community relay (`:48`).
    - The section is `SharedHeaderSection` (`CuratedDListHeaders.jsx:167-201`).
    - Live: both the local path and the relay path.
  - **AC-4 (import to local strfry)** → U7, S4–S6.
    - **Client.** `ImportToLocalButton` (`CuratedDListHeaders.jsx:66-105`) holds the module's only POST; the body is `JSON.stringify({ event, signAs: 'client' })` (`:80`). Success means `res.ok && data.success` (`:83`), followed by `onImported()` (`:85`). A failure shows inline (`:86-87`, `:102`).
    - **Server.**
      - Client events are never re-signed (`publishEvent.js:58-63`).
      - They are piped into `strfry import` without `--no-verify` (`:69-83`).
      - The endpoint is a public mutation (`auth.js:454`).
    - **Graph.**
      - `tapestryBrainWrite.js:36-43` acts only on kind 39999 with the tapestry `z`, authored by the TA or the owner, so a kind-39998 header can't match.
      - `redis-consumer.js:110-115` handles kinds 3/10000/1984 and ignores every other kind.
      - `supervisorctl` lists no other event-to-graph service. The legacy `addToQueue.mjs` listener (kinds 3/10000/1984/1) isn't running.
    - **External relays.** The endpoint only runs `strfry import`, and this machine's router config has no stream matching kind 39998 (NB-6 covers the opt-in `dcosl` preset).
    - Live: the real import above.
  - **AC-5 (not found, couldn't check)** → U7, S1.
    - `LookupMiss` (`CuratedDListHeaders.jsx:126-131`) handles not-found and couldn't-check.
    - The shared section's "can't tell which shared header" cases are at `:169-181`.
    - Seen live.
  - **AC-6 (nothing else moves)** → S6, R1–R3, plus the eight guards.
    - Across the whole branch (`551bbe4a..HEAD`), no Treasure Map page file, no Simple Lists file, and not the DList Curation panel is touched.
    - `treasureMap.js` has zero removed lines.
    - Story 2 leaves `MyCuratedDLists.jsx`, `useTreasureMap.js`, `App.jsx` and `Layout.jsx` untouched.
    - The four story-1 files carry no publish, POST or signing (grep, plus S6 of both suites).
    - The hook's return grew additively; `MyCuratedDLists.jsx:32` still destructures `{ headers }`.
    - Live: story 1's surfaces behave as before.
- [x] No criterion is silently dropped.
- [x] No behavior added that isn't in the story.
  - The two logged deviations stay inside AC-1/AC-3 and ADR sub-decision 6: the sections take `info` and `checking`, and the shared section gets a name line.
  - The "Not authored by your assistant" warning is ADR sub-decision 3 / note 3.

## ADR adherence
- [x] The files changed match implementation notes 1–5 exactly:
  - **Note 1:** the three pure functions live in the util's My Curated DLists area, and the util still has zero imports.
  - **Note 2:** `nonce` is in the effect's deps (`useCurationHeaders.js:34`), `refresh` is a stable `useCallback` (`:25`), and the hook returns `{ ...state, refresh }` (`:36`).
  - **Note 3:** the four named exports exist; the signature change is a logged deviation.
  - **Note 4:** the detail page is wired as specified, keeps the story-3 marker (`CuratedDListDetail.jsx:82`), and stays write-free.
  - **Note 5:** nothing else changed.
- [x] Every sub-decision holds:
  1. **The followed pointer** is `communityPointerOf`'s (`treasureMap.js:426`), so Map Entries and this page follow the same pointer.
  2. **The problems** are defined and ordered as specified (`:429-432`), and `deferred` is a separate flag (`:436`; see NB-1).
  3. **Authorship** is compared lowercased (`:434`), with a warning branch (`CuratedDListHeaders.jsx:145`).
  4. **The shared lookup** uses `COMMUNITY_RELAYS[0]` through `lookupCurationHeaders`.
  5. **The link** is gated on `where === 'local'` (`:109`).
  6. **The import** sends the event as received, calls `refresh`, and reports a re-check that still misses.
  7. **The raw toggles** are local state, `false` on mount, never persisted.
- [x] No new dependencies.
- [x] I re-verified the ADR's facts:
  - **Fact 3:** `COMMUNITY_RELAYS` is at `useCommunitySharedConcepts.js:9`.
  - **Fact 4:** the `TrustedAssertions.jsx:99-120` idiom, `publishEvent.js`, `auth.js:451-454`, `tapestryBrainWrite.js:36-43`, and the stream's kinds.
  - **Fact 5:** Simple Lists reads only local strfry.
  - **Fact 6:** story 1's S6 pin.

## Concept-graph integrity
- [x] Handles are in `kind:pubkey:slug` form. `/api/concept-graph/summaries` on the local stack lists `39998:11f23fe4…:list`, `…:shared-concept` and `…:tapestry-assistant`, and `11f23fe4…` is this stack's TA (`/api/assistant/pubkey`). Coordinates are built and parsed as `<kind>:<pubkey>:<d>`.
- [x] Firmware reinstall: not needed. No concept definition changed.
- [x] Orientation went through the ADR's Concepts line (orientation only). No BIBLE re-derivation.

## Things tests can't catch
- [x] No secrets in committed files. The story's added lines contain no 64-hex literal and no key material; the fixtures are computed.
- [x] No leftover debug logging, `console.log`, `debugger` or TODOs.
- [x] No commented-out code. The one comment block is the ADR-specified story-3 marker.
- [x] Error paths and edge cases handled where it matters. Seen live: failed lookups, missing headers, a refused import, and a non-JSON 500. Garbage input never throws (U1, U5).
- [x] Concurrency and race conditions:
  - **`useCurationHeaders`:** each run cancels the previous one on a key or nonce change. Old headers are kept during a load, but readers index by the current coordinate, so a changed shared row reads "checking", never the old result.
  - **The detail page:** re-checking the assistant's header keeps the same pointer, so the shared lookup's key doesn't change and it doesn't re-fetch (live trace).
  - **`ImportToLocalButton`:**
    - `busy` disables the button (a live double-click sent one POST).
    - Success sets `imported` and clears `sawRecheck` before calling `onImported`.
    - The effect marks `sawRecheck` once `checking` turns true.
    - A local result unmounts the button; a result still on the relay shows the did-not-find line (both seen live).
    - NB-3 records two soft spots.
- [x] Security:
  - All relay-sourced text renders as React text, and the raw event goes into a `<pre>` via `JSON.stringify`. Links are `encodeURIComponent(coord)` under a fixed base, and there is no `dangerouslySetInnerHTML`.
  - The import sends only what it received, and strfry verifies the author's signature (no `--no-verify`), so a relay can't slip in a forged event.
  - The permissionless client-signed path is intentional (ADR `security-auth-exposure/0002`).

## House rules check
- [x] Concept Graph API authority respected.
- [x] No new lint, typecheck or build tooling.
- [x] Per-deployment TA pubkey: no `taPubkey` and no pubkey literal (S6, and the sweep). "Your assistant" is `useAuth().user.assistantPubkey` (OPEN.md row 188).
- [x] Architecture invariants:
  - **POV-first:** the viewer's own Map and own assistant; the shared header is the public event the viewer's own header names.
  - **Decentralized-first:** the import uses the permissionless client-signed path, gates nothing, and stores the event exactly as its author signed it.
  - **Filter at view time:** nothing is stored; every load re-derives from the header's own tags.
  - **Local-first (principle 4):** Neo4j is not written. Verified live, before and after the real import.

## Product-guide adherence *(when the story traces to a PRD)*
- [ ] N/A. The book is acceptance-frame (no PRD, no style guide). The copy follows ADR note 3.
- [ ] N/A.

## Findings

### Blocking
None.

### Non-blocking
1. **ui/src/utils/treasureMap.js:436, ui/src/pages/grapevine/CuratedDListHeaders.jsx:150** — the sentinel beside a pointer contradicts the house rule.
   - **What the page shows.** A sentinel beside a real pointer renders "It is marked deliberately unaffiliated (b-tag-deferred)." next to "Points to … (inherit-items)" (seen live).
   - **What the house says.** The single code owner of the W16 ruling disagrees. `dispositionOf` sets `deferred` only when the sentinel stands alone — "a real b always beats a stale sentinel" (`src/lib/bValueForms.js:34-52`; UI mirror `ui/src/utils/bDisposition.js:27-45`). `protocols/drafts/shared-concepts.md:43` agrees: a real affiliation supersedes the sentinel, which is "replaced, not accumulated".
   - **Why it isn't blocking.**
     - ADR 0002 (sub-decision 2, note 1) deliberately chose "any `b` value", and U4 pins that.
     - No house tool writes this shape: the DList Curation endpoint refuses a sentinel-only header as `conflict` (`src/api/dlist-curation/index.js:66-72`).
     - The page derives nothing from the sentinel (the pointer is still followed), so the protocol's MUST holds.
   - **Optional follow-up** (needs an ADR amendment and a U4 re-aim): when a real pointer is present, word the sentinel as a leftover the pointer supersedes, or reuse the `dispositionOf` rule.
2. **ui/src/pages/grapevine/CuratedDListHeaders.jsx:117-121** (cause: story 1's `lookupCurationHeaders`, `ui/src/utils/treasureMap.js:385-386`) — "not in this instance's strfry" can come from a failed check.
   - **What happens.** When the local step fails but the relay step finds the header, the section says "— not in this instance's strfry." (seen live with the local scan stubbed to fail). That claims the header is absent locally on the strength of a failed check, because the relay-hit result drops the local `failed` mark.
   - **Why it isn't blocking.** AC-5's "never 'not found'" rule is about misses, so this doesn't violate it, though it's the same honesty principle. The import offered in that state is harmless: strfry dedups, and the re-check reports what it finds.
   - **Optional improvement:** keep the local failure on relay hits and say "Found on <relay>; couldn't check this instance's strfry."
3. **ui/src/pages/grapevine/CuratedDListHeaders.jsx:72, :95, :98-101** — two soft spots in the re-check state machine. Neither is reachable in practice.
   - **(a) A stuck message.** `sawRecheck` relies on seeing `checking` turn true. A re-check that resolved inside the same task it started in would leave "✓ Imported — re-checking…" up for good. That can't happen while the lookup goes over the network.
   - **(b) A duplicate POST.** The button is re-enabled during the re-check, so a second click re-POSTs the same event. strfry treats it as a duplicate, so this is harmless.
   - **Related wording.** "Imported, but…" reports the endpoint's success. `strfry import` can report success even for lines it rejects (it has a `--show-rejected` flag), which is exactly why the re-check is the honest signal.
   - **Optional improvement:** have `refresh()` return the lookup promise and await it, and disable the button while `imported && checking`.
4. **ui/src/pages/grapevine/CuratedDListHeaders.jsx:148** — "Points to" shows the shortened coordinate (`39998:11f23fe4…3767:dog-breed`), where ADR note 3 says `<coord>`. The full coordinate is visible only in the raw JSON (and in the link's href when local). This is harmless for the page's own pointer. The Deviations log records the short form only for the shared section's name line.
5. **ui/src/utils/treasureMap.js:398** — a fifth, unpinned copy of the `b-tag-deferred` literal. The house pins the literal byte-identical in four places (`test/b-coverage-audit-and-disposition.test.js:340-356`) and exports it from the UI mirror (`ui/src/utils/bDisposition.js:12`). The util's zero-import rule (ADR note 1) explains why it's copied rather than imported. Optional improvement: add `treasureMap.js` to that S3 list.
6. **AC-4's scope, stated for the record** (ADR 0002 fact 4 and Consequences).
   - **Where the claims hold.** "Writes nothing to the graph" and "publishes to no external relay" hold for everything this feature can produce or point at. The DList Curation endpoint writes only kind-39998 headers and accepts only kind-39998 community headers (`src/api/dlist-curation/index.js:23`, `:244`). Verified live.
   - **(a) Kind 39999.** The route and the pointer both admit kind 39999, and the import doesn't restrict kinds. So an owned tapestry letter found only on a relay would trip the endpoint's brain-first hook (`tapestryBrainWrite.js:36-43`); such a letter is kind 39999, carries `z = 39998:<TA>:tapestry`, and is authored by the TA or the owner. No house-written header has that shape, and anyone can already POST such an event to the public endpoint.
   - **(b) The `dcosl` preset.** With the `dcosl` router preset enabled, strfry's router would mirror an imported header to the two DCoSL relays. The preset is at `setup/router-presets.json:3-13`: `dir: both`, kinds 9998/9999/39998/39999, `defaultEnabled: false`. The ADR's Consequences already hedge this, and this machine's live router config has no such stream.
   - **Optional improvement:** offer the import only for kind 39998, and name the preset in the ADR's hedge.

### Harness friction *(anything the process itself got wrong this story — stale doc, wrong port/path, contradictory instruction; each becomes an OPEN.md row, type `meta`)*
1. **No orientation surface names the b-value code owner.** BIBLE.md, AGENTS.md, `protocols/README.md` and `protocols/drafts/inherit-from.md` never mention `src/lib/bValueForms.js` or `ui/src/utils/bDisposition.js`; only other epics' ADRs and test plans do. ADR 0002 oriented from `communityPointerOf` and inherit-from § reserved value, re-derived the sentinel rule, and diverged on the sentinel-beside-pointer case (NB-1). Suggested new `meta` row: point inherit-from § reserved value (or `protocols/README.md`) at the code owner.
2. **CLAUDE.md's bind-mount claim recurred**, this time in this review's own brief ("the container serves `dist/` from the bind-mounted repo") and in story 1's review (its served-bundle line).
   - `docker inspect tapestry` shows four named volumes and no repo mount. The served bundle is a `docker cp`'d copy: the container's `dist/assets` holds 190 files, the repo's 17.
   - It didn't mislead this review, because I compared the served bytes with a fresh build and the seven AC-4 server files with the container's copies.
   - Existing rows 198 and 226; no new row.
3. **OPEN.md rows 83, 191, 261 and 232 recurred.**
   - The full suite ran about 45 minutes in the background, dominated by the live pin suites' container-side TL refreshes.
   - It is red by default on this machine (row 191).
   - The row-261 LB pair skipped again, in both my run and the Implementer's.
   - `test:playwright` still needs the `executablePath` workaround.
   - Existing rows; no new rows.

## Verdict
**PASS**

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection performed; the result is reported in the chat (human-gated), not recorded here.
