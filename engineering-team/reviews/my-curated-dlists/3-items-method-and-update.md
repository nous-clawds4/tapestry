# Review: Story 3 — Items, the curation-method panel, and Update list

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-11
**Diff:** `git diff 0b09293c..HEAD` — the story's whole footprint (`0b09293c` = story 2's review commit; HEAD `cdd01bc1`; branch `feat/my-curated-dlists`, base `551bbe4a` = origin/staging); implementation `git diff 36331860..cdd01bc1`
**Story:** `engineering-team/stories/my-curated-dlists/3-items-method-and-update.md`
**ADR:** `engineering-team/decisions/my-curated-dlists/0003-items-method-and-update.md`
**Test plan:** `engineering-team/stories/my-curated-dlists/3-items-method-and-update.test-plan.md`

Branch commits audited (oldest first):
- `96b5cd3e` story, plus OPEN.md row 252's settled back-reference rule and the epic entry.
- `68504103` ADR 0003, plus ADR 0002's "Amended by" line and the epic entry.
- `36331860` failing tests: the new suite, its `test/test.js` registration, story 2's re-aimed U4, and a "Later change" note in story 2's test plan.
- `cdd01bc1` implementation.

The implementation changes four `ui/src` files: `useListItems.js` (new), `CuratedDListItems.jsx` (new), `CuratedDListDetail.jsx`, and `treasureMap.js`. It also appends `## Deviations` to the story. It touches no test file. Nothing else in the footprint falls outside the story, its ADR and test plan, and the ledger/epic cross-references.

## Quality gates (run by reviewer, not trusted)

- [x] **Story-scoped gate** (the test plan's command): `TOTAL_FAIL=0`, 249 tests. Per suite, each run on its own:
  - `my-curated-dlists-items` 21/0 · `my-curated-dlists-headers` 16/0 · `my-curated-dlists-page` 19/0
  - `tl-treasure-map-panel` 18/0 · `treasure-map-panel-summary` 18/0 · `dlist-curation-panel` 18/0 · `dlist-curation-tl-panel` 19/0
  - `tl-treasure-map-optin-publish` 23/0 · `dlist-curation-map-entries` 14/0 · `treasure-map-relay-presence` 35/0 · `treasure-map-relay-sync` 22/0
  - `b-coverage-audit-and-disposition` 26/0
  - The eleven suites other than `b-coverage-audit-and-disposition` are every suite that loads `treasureMap.js` in Node, so the util's new `./bDisposition.js` import resolves wherever the util is loaded.
- [x] **Red before green.** I extracted the tree at `36331860` with `git archive` into scratch (so the repo got no worktree metadata) and ran the suites there:
  - New suite: 4 tests / 17 failing. U1–U8 and S1–S9 are red; R1–R4 are green.
  - Story 2's suite: 15/1. Only the re-aimed U4 is red, with `"deferred":true` beside the pointer.
  - Story 1's suite: 19/0.
  - This matches the test plan's recorded run line for line.
- [x] **Full `npm test`**, run in the background at `cdd01bc1` (13:38:56 to 14:25:13, about 46 minutes; OPEN.md row 83). Exit 1, `Overall: FAIL`: 164 suites green, 3 red, 4 failing tests, 56 skipped.
  - **The four failures are OPEN.md row 191's:** the `L0 GUARD` in `tl-membership-method-selector`, `tl-weighted-sum-method` and `tl-certainty-method` (the container answers `allowExternalPublish:true`), plus `tl-certainty-method` LP (the prune refuses under the same posture).
  - **Both row-254 LB matrices skipped** ("meili indexing did not settle in budget").
  - **This story's suites in the full run:** 21/0, 16/0, 19/0.
  - **Same as the Implementer's run.** The whole `Test Results` summary block is identical to the Implementer's log (`diff` reports no difference).
  - I did not change the machine's publish posture.
- [x] **Served bundle = HEAD.** The stack serves `index-BeAS6lUP.js`. A Vite build of HEAD into scratch (`--outDir`, so the repo's `dist/` was untouched) gave a byte-identical file: sha256 `ac5777a7…` for the fresh build, the bytes curl fetched from the stack, and the repo's `dist/` alike. Vite resolves the new import, and the new strings are in the served bundle.
- [x] `bash scripts/harness-lint.sh`: `harness-lint: clean (0 violations)` before this review. I re-ran it after writing this file.
- [x] **Live browser check (mocked auth; 27 scenarios).**
  - **Setup.** Headless Chromium 1228 via `executablePath` (Playwright 1.56.1; OPEN.md row 232). `page.route` mocked:
    - `/api/auth/status`: a synthetic customer, `5e1f…`.
    - `/api/auth/user-classification`: assistant `253d40c4…6ec0`.
    - The kind-10040 scan: a synthetic Map, `["39998:dog-breed", 253d40c4…, wss://dcosl.brainstorm.world]`.

    Everything else hit the real stack unless a scenario injected items, headers or failures. A guard answered any `/api/strfry/publish`.
  - **Real data, checked through the API first:**
    - My list `39998:253d40c4…:dog-breed` has 0 items, both locally and on dcosl.
    - The shared list `39998:11f23fe4…3767:dog-breed` has two local kind-39999 items and none on dcosl: sheep dog `02f68097…` and golden retriever `a1d88492…`.
    - Both headers are local.
  - **Default view (real data):**
    - It reads "Your assistant hasn't added any items to this list yet.".
    - Both boxes are unchecked. The candidates box is enabled.
    - "Update list" is disabled, with "Update list isn't built yet.". A forced click and a dispatched click caused no request and no change.
    - "▸ Curation method" is closed (`aria-expanded="false"`). Opened, it shows "The curation method isn't built yet." and the downvotes/upvotes example, and its only control is its own toggle. Opening it made no request.
    - At load, only my list was read: `#z` = my coordinate, local and dcosl, `limit 500`. The shared coordinate was **not** requested.
  - **"Also show candidates to inherit" ticked:**
    - The shared list was read (local and dcosl). My list was not re-read.
    - **golden retriever** and **sheep dog** appeared as candidates, by `11f23fe4…3767`, "5mo ago", in name order.
    - Each links to `/tapestry/lists/items/39999%3A11f23fe4…%3A<d>`. The golden retriever link opened Simple Lists' item page for event `a1d88492…`.
    - Unticking gives the plain empty sentence. Re-ticking re-reads the shared list. A rapid four-way toggle settles on the right rows.
    - After a reload, both boxes are off and the panel is closed.
  - **Back-references** (my assistant's items injected into my list's local scan):
    - An `e` tag with sheep dog's id: sheep dog leaves the candidates.
    - An `a` tag with golden retriever's coordinate: it leaves.
    - A made-up tag with the id at index 2 and one with the coordinate at index 3: both leave.
    - **Someone else's item** carrying both back-references retires neither. It appears only with "Also show items others added to this list", marked "someone else" with `0be10be1…0be1`.
    - Group order is your assistant → someone else → candidate. Both boxes are off after a reload.
  - **Relay-only and dedupe:**
    - An item only in the dcosl response shows no link and "(on wss://dcosl.brainstorm.world only)".
    - One kind-39999 item with an older local copy and a newer relay copy shows once, with the newer name, linked (NB-3).
  - **States:**
    - **Local scan failed** (`success:false`, or an HTML 502): "⚠️ Couldn’t check this instance’s strfry for items — showing what wss://dcosl.brainstorm.world returned."
    - **Relay failed:** "⚠️ Couldn’t check wss://dcosl.brainstorm.world for items — showing this instance’s only." with the local rows.
    - **Both failed:** "⚠️ Couldn't check — looked in this instance's strfry and on wss://dcosl.brainstorm.world." with no table and no empty sentence, also with "others" ticked.
    - **Cap with a total:** "Showing the first 500 of 812 items found in this instance’s strfry."
    - **Cap with total null:** "Showing the first 500 items in this instance’s strfry — there are more."
    - **A slow relay:** "⏳ Loading items…" until both sources answer.
    - **The shared list failed on both sources:** see Blocking 1.
  - **AC-7** (synthetic assistant headers in the local kind-39998 scan):
    - **`b-tag-deferred` beside the real pointer, in either order:** "Points to 39998:11f23fe4…3767:dog-breed (inherit-items)" and no "deliberately unaffiliated". The shared header is followed and the candidates box is enabled. Ticking it gives the two candidates, and the shared list is read only then.
    - **The sentinel alone:** "It is marked deliberately unaffiliated (b-tag-deferred).". The shared section says "…is marked deliberately unaffiliated.". The box is disabled with "— unavailable: your assistant’s header is marked deliberately unaffiliated", and a forced click neither checks it nor reads the shared list.
    - **The sentinel beside an event-id `b`:** no "deliberately unaffiliated" line, "⚠️ One of its b tags is not a list coordinate.", and the box disabled with "…names no shared list".
    - **The sentinel beside a malformed `b`:** still deferred, following the house rule, plus the not-a-coordinate line.
  - **Candidates box disabled with its reason:**
    - Header missing: "…was not found".
    - Header lookup failed: "…couldn’t be checked".
    - No `b`: "…names no shared list".
    - While the header is being looked up: "…checking your assistant’s header…", enabled once it resolves.
  - **Stories 1–2 and the Treasure Map page:**
    - The list page shows the dog-breed row.
    - The detail page's two header sections read as in story 2 (both local, both "Open in Simple Lists →").
    - The TA Treasure Map page renders its Map Entries.
  - **Across all runs:**
    - Zero publish attempts and zero page errors.
    - Every non-GET request was a read-only Cypher `MATCH`: story 1's relay-list query, and Simple Lists' Neo4j check on the item page.
    - The only 4xx was the app shell's `GET /api/user-prefs` → 401 (the mocked session). The other error, a 502, was one I injected.
    - Every live observation in the story's `## Deviations` reproduced.
- [x] **Extra checks (not in the suite):**
  - **`describeCurationHeader` parity, 1,885 `b` sequences.** Every sequence of up to three values over 12 forms, including malformed, non-string, uppercase-hex, empty and near-miss sentinels.
    - `deferred` equals the house `dispositionOf(values).deferred` in every case.
    - Every other field is identical to story 2's version at `0b09293c`.
    - The 236 `deferred` changes are exactly the sequences with the sentinel beside an a-tag or event-id `b`.
  - **`curatedItemRows` property check, 3,000 randomized trials, 0 mismatches.** The oracle was independent: any tag, positions ≥ 1, my assistant's items only, the author compared case-insensitively, kind 9999 matched by id even when it carries a `d`, kind 39999 by id or coordinate.
  - **The relay endpoint probed with unreachable relays** (`wss://127.0.0.1:1` and an `.invalid` host): both answer `{success:true, events:[]}`, which reads as `relay: 'ok'`. That is ADR 0003 fact 2's inherited limit, now measured.
- [ ] `npm run test:playwright`: N/A. The test plan has no Playwright half, and the driver still needs the `executablePath` workaround (row 232). The live check above stands in for it.
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._ (The scratch build was used only to compare bundle bytes.)

## Spec adherence
- [x] Every acceptance criterion has a passing test, and each was seen live:
  - **AC-1 (the items table)** → U2–U5, U7, S1, S4, S5.
    - `ItemsSection` is at `CuratedDListItems.jsx:81-169`.
    - The table is at `:118-143`. The link is gated on `local` (`:132-134`), and Author reads "your assistant" or a short pubkey (`:136`).
    - The states: loading `:96-97`, couldn't check `:98-99`, source notes `:67-78`, the empty sentence `:111-116`.
    - The one exception is Blocking 1.
  - **AC-2 (others' items)** → U6, S1, S2. The box is `useState(false)` (`:82`) and bound at `:157`. "Someone else" is `from: 'other'` (`treasureMap.js:556`).
  - **AC-3 (candidates)** → U6, U8, S1, S2, S6.
    - The box is `useState(false)` (`:83`), disabled with its reason (`:160-164`).
    - The shared list is read only while it is ticked (`:86`).
    - The "already copied" rule is at `treasureMap.js:557-568`, and `sharedListUnavailable` at `:580-585`.
  - **AC-4 (method placeholder)** → S1–S3. `CurationMethodPanel` (`CuratedDListItems.jsx:36-54`) is closed on load and shows text only.
  - **AC-5 (Update placeholder)** → S3, S9. `UpdateListButton` (`:57-64`) is `<button … disabled>` with no handler, and it sits in the section's header row (`:153`).
  - **AC-6 (nothing else moves)** → S7, S9, R1–R4, story 1's and story 2's suites, and the eight guards.
    - Story 3's footprint under `ui/`/`src/` is exactly the four files.
    - The whole branch touches no Treasure Map page file, no Simple Lists file, not the DList Curation panel, and no server file. (`App.jsx`/`Layout.jsx` are story 1's.)
    - `treasureMap.js` loses only lines inside `describeCurationHeader` (its body and one doc line), the old section heading, and the unexported `B_TAG_DEFERRED`.
    - Story 2's import (`CuratedDListHeaders.jsx`) is still the page's only write.
  - **AC-7 (the pointer wins)** → U1, S8, R3, and story 2's re-aimed U4. The logic is at `treasureMap.js:426-444`, with `deferred` at `:441`. The extra parity check above and the live E-scenarios back it.
- [ ] No criterion is silently dropped: **one AC-1 state is broken.** A failed shared-list read is also called empty (Blocking 1).
- [x] No behavior added that isn't in the story. The logged deviations all stay inside AC-1/AC-3 and ADR sub-decision 7:
  - the util imports `classifyBValue` and `dispositionOf` without `SENTINEL`;
  - `LIST_ITEMS_LIMIT` is exported;
  - the empty sentence is composed per view;
  - the disabled box names its reason inline.

  So do the two small states the Deviations don't list: "⏳ Loading candidates…" (`CuratedDListItems.jsx:104`) and the shared list's own source notes (`:108-110`).

## ADR adherence
- [x] The files changed match implementation notes 1–5:
  - **Note 1:** the four pure functions plus `LIST_ITEMS_LIMIT` sit in a new `Items` section of the util, and `describeCurationHeader` takes the house rule via `import { classifyBValue, dispositionOf } from './bDisposition.js'` (`treasureMap.js:11`). Dropping `SENTINEL` from the import is a logged deviation.
  - **Note 2:** `useListItems` binds `queryRelayBounded` and `/api/relay/external` (`useListItems.js:6-9`, `:29`), is keyed on coordinates plus relay (`:22`, `:32`), and ignores results after unmount (`:27`, `:31`).
  - **Note 3:** the three named exports exist.
  - **Note 4:** the page wiring is at `CuratedDListDetail.jsx:83-91`. The page gets no new hooks (S7) and stays write-free.
  - **Note 5:** nothing else changed.
- [x] Every sub-decision holds:
  1. **Mine vs someone else** is decided by authorship, lowercased (`treasureMap.js:545`).
  2. **"Already copied"** means any string value at index ≥ 1 of any tag on my assistant's items (`:558-563`), matched against the id, or for kind 39999 the coordinate (`:565-566`).
  3. **The lookup** uses one filter on both sources concurrently (`:489-510`), keeps `z`-matching kind 9999/39999 items (`:513-514`), dedupes by `itemRouteId` with the newest version winning and `local` set when any copy is local (`:515-519`), reports status per source, and never rejects.
  4. **The shared list is read lazily**: only while the box is ticked (live network trace).
  5. **Rows are grouped** assistant → other → candidate, then by name case-insensitively, newest first on ties (`:570-572`), with "(unnamed)" as the fallback.
  6. **The link** is gated on `local`.
  7. **The states** are as specified, except Blocking 1.
  8. **The placeholders** act on nothing.
  9. **AC-7** takes `deferred` from `dispositionOf` and the value forms from `classifyBValue`; the util keeps no copy of the literal.
  10. **Placement** is shared header → Curation method → Items with Update.
- [x] No new dependencies. `package.json` and the lockfiles are untouched.
- [x] I re-verified the ADR's facts:
  - **Fact 1:** `DListItems.jsx:364-366` route ids and `:459` navigation; `DListItemDetail.jsx` reads only local strfry.
  - **Fact 2:** `scan.js:57-61`/`:146-153` return an honest envelope; `fetchEvents.js:49-64` has no truncation signal and reads an unreachable relay as success (probed).
  - **Fact 3:** `bDisposition.js`.
  - **Fact 5:** `timeAgo.js`.
  - **Fact 6:** the live data.

## Concept-graph integrity
- [x] Handles are in `kind:pubkey:slug` form. Coordinates are built and parsed as `<kind>:<pubkey>:<d>`. `/api/assistant/pubkey` answers `11f23fe4…3767`, this stack's TA and the shared list's author. No concept is added or changed.
- [x] Firmware reinstall: not needed. No concept definition changed.
- [x] Orientation went through the ADR's Concepts line (orientation only). No BIBLE re-derivation.

## Things tests can't catch
- [x] No secrets in committed files: a `/usr/bin/grep` sweep of every added line in the footprint found no key material and no 64-hex literal; the fixtures are computed.
- [x] No leftover debug logging, `console.*`, `debugger` or TODO in the added lines.
- [x] No commented-out code. The story-2 insertion marker became a one-line placement comment (`CuratedDListDetail.jsx:83`).
- [ ] Error paths and edge cases:
  - **Blocking 1:** a failed shared-list read is also called empty.
  - **NB-2:** partial reads are followed by an unqualified empty sentence.
  - **Inherited:** an unreachable community relay reads as an empty success (probed). ADR 0003 fact 2 already records this, so a relay-side "couldn't check" appears only on the endpoint's 8 s timeout or an HTTP failure.
  - Everything else was seen live (HTML 502, `success:false`, timeouts' slow path, both caps). The pure functions never throw or reject (U2, U4, U7, plus the property check).
- [x] Concurrency and race conditions:
  - **Both `useListItems` calls** are keyed on a string, so re-renders don't re-fetch.
  - **Unticking the candidates box** clears the shared list, so re-ticking shows "⏳ Loading candidates…", never stale rows.
  - **In-flight reads** are cancelled on untick or unmount. A rapid on/off/on/off/on settled on the right rows (live).
  - **Hook order:** `ItemsSection`'s hooks are unconditional (`:82-86`), and the detail page's hook order is story 2's (S7).
  - **One cost:** the shared list is re-read on every re-tick. That follows sub-decision 4 and is cheap.
- [x] Security:
  - Relay-sourced names and pubkeys render as React text.
  - Links are `encodeURIComponent(routeId)` under a fixed base.
  - There is no `dangerouslySetInnerHTML`, no storage, no POST, no signing. S9 and the sweep confirm this, and so does the live network: 0 publish attempts.

## House rules check
- [x] Concept Graph API authority respected.
- [x] No new lint, typecheck or build tooling.
- [x] Per-deployment TA pubkey:
  - No `taPubkey` and no pubkey literal in the new files (S9, and the sweep).
  - "Mine" is `useAuth().user.assistantPubkey`, passed down from the page (`CuratedDListDetail.jsx:38`, `:89`; OPEN.md row 188).
- [x] Architecture invariants:
  - **POV-first:** "your assistant" is the viewer's own assistant, and "someone else" is relative to it.
  - **Decentralized-first:** others' items and every shared item are shown when asked for, with no author gate (live B4, A).
  - **Filter at view time:** nothing is stored. "Already copied" is re-derived on every load.
  - **Local-first (principle 4):** nothing is written. Zero publish attempts and only read-only Cypher across 27 live runs.

## Product-guide adherence *(when the story traces to a PRD)*
- [ ] N/A. The book is acceptance-frame (no PRD, no style guide). The copy follows the story and ADR 0003.
- [ ] N/A.

## Findings

### Blocking
1. **ui/src/pages/grapevine/CuratedDListItems.jsx:115** — a failed shared-list read is also called empty.
   - **What the page shows.** With "Also show candidates to inherit" ticked and the shared list's read failed on **both** sources, the section shows the warning "⚠️ Couldn't check the shared list — looked in this instance's strfry and on wss://dcosl.brainstorm.world." (`:105-107`). When my list is empty, directly under it comes "Your assistant hasn't added any items to this list yet. The shared list offers no candidates to inherit."
   - **The cause.** The clause is gated only on `sharedList` being truthy, and a both-failed read is a truthy object. It is the same state that `:91` already keeps out of the rows.
   - **Seen live.** Scenario D6: my list read fine; both of the shared list's reads answered `success:false`.
   - **When it happens.** My list is read at mount and the shared list only on the later tick, so any outage in between produces it. For example, the control panel restarts during a deploy and both requests get a 502.
   - **What it breaks.**
     - AC-1's explicit rule: "a failed lookup reads 'couldn't check', never 'empty'".
     - ADR sub-decision 7's both-failed state: couldn't check, with no emptiness claim.
     - The story's own `## Deviations`, which says the clause is added "once the shared list has been read".
   - **Why no test caught it.** S5 pins that the strings exist, not that they exclude each other.
   - **Asked change:** add the clause only when the shared read did not fail on both sources (the predicate already at `:91`/`:108`), so the "Couldn't check the shared list" note stands alone. Pin the state so it can't come back: a structural check, or a pure sentence helper in `treasureMap.js` with a unit test (a Tester touch).

### Non-blocking
1. **ui/src/utils/treasureMap.js:557-568, ui/src/pages/grapevine/CuratedDListItems.jsx:136** — an item on both lists is listed twice.
   - **What happens.** An item my assistant authored that also carries the shared list's `z` (a multi-`z` stamp) appears as "your assistant" **and** as a "candidate" whose Author is my own assistant's short pubkey. Seen live (scenario G).
   - **Why it's allowed today.** `protocols/drafts/shared-concepts.md:35` makes an `inherit-items` target "at most a demand-selected extra" stamp, and `protocols/drafts/stamping.md:25` (write rule 3) permits those extras. The code follows the ratified back-reference rule to the letter, and the case is unreachable today, because no assistant authors items and nothing stamps them.
   - **Why it matters later.** If Update's copies are stamped with the shared `z`, every copy would reappear as a candidate.
   - **Optional:** skip a shared item whose identity is already among my assistant's items on my list, and add a line to OPEN.md row 252 so the copy convention accounts for multi-`z`.
2. **ui/src/pages/grapevine/CuratedDListItems.jsx:111-116** — a partial read is followed by an unqualified empty sentence.
   - **What happens.** When one source failed, the note ("Couldn’t check this instance’s strfry for items — showing what wss://… returned.", or the same "for candidates") is followed by "Your assistant hasn't added any items to this list yet." or "The shared list offers no candidates to inherit." Seen live (D1, D7).
   - **Why it isn't blocking.** ADR sub-decision 7 sanctions "rows plus a note", and the note says what was read.
   - **Why it's still misleading.** This machine's shared items live only in local strfry, so a failed local read would say "offers no candidates" on dcosl's word alone.
   - **Optional:** while a source has failed, say "found none on <relay>". The fix for Blocking 1 can cover both.
3. **ui/src/utils/treasureMap.js:518-519** — dedupe, as ADR sub-decision 3 specifies: the newest version is shown, marked `local` if any copy is here.
   - **The consequence.** A kind-39999 item whose newer version exists only on the relay shows the relay's name, but its link (by coordinate) opens Simple Lists on the older local version. Seen live (C).
   - Harmless. Noted for whoever builds Update.
4. **OPEN.md row 252 (no code ask)** — two consequences of the "any tag" rule the copy convention should know:
   - **(a) Deliberate references count.** Any reference to a shared item, such as a reply- or dispute-shaped tag carrying its id, also retires it as a candidate. Accidental collisions are not a risk: 64-hex ids and `kind:pubkey:d` coordinates only match on purpose (the 3,000-trial property check).
   - **(b) An id-only back-reference goes stale.** It stops matching a kind-39999 original once its author replaces it with a new id, so the new version reappears as a candidate unless the copy also carries the coordinate.

### Harness friction *(anything the process itself got wrong this story — stale doc, wrong port/path, contradictory instruction; each becomes an OPEN.md row, type `meta`)*
1. **OPEN.md row 28 recurred.** In the review template, the section titled `On PASS (same commit)` comes after the Verdict heading. `scripts/lib/review-verdict.awk` takes the last verdict-shaped token on a heading or bold line, so any review that isn't a pass and follows the template verbatim parses as a pass. That would trip L1 against the story's correct `Approved` status and miscount in `harness-stats.sh`. I confirmed it with the real extractor on a scratch file, and worded this file's trailing section to avoid it. Existing row; this is another occurrence, no new row.
2. **Existing rows recurred:**
   - Row 83: the full suite took about 46 minutes, backgrounded.
   - Row 191: the suite is red by default under external publishing.
   - Row 254: both LB matrices skipped.
   - Row 232: Playwright needs `executablePath`.
   - Rows 198/226: no bind mount. The brief already knew; the served bundle was compared by bytes.
   - Rows 44/71/127/168/223: CLAUDE.md's stale TA pubkey. No cost here, since I queried `/api/assistant/pubkey`.

## Verdict
**CHANGES_REQUESTED**

## Close-out (same commit)
- [ ] Not applicable: the verdict is not a pass, so the story keeps its `Approved` status.
- [ ] Completion detection: reported in the chat, not recorded here.
