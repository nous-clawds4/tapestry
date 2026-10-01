# Review: Story 2 — Tag, re-tag and untag your Assistants from the My Assistants page

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-30
**Diff:** `git diff d161b422..67563473` on `feat/my-assistants` (base = story 1's review commit). Commits:
- `03947c28`, story 1's ledger correction, carried in the range;
- `6911a570`, the story, book decisions 7–9 and § Before shipping;
- `1c1d7d20`, ADR 0002;
- `b563d43e`, the failing tests, the test plan and the U3 re-aim;
- `67563473`, the implementation and the focus here.

19 files, 2259 insertions, 112 deletions.

**Story:** `engineering-team/stories/my-assistants/2-tag-and-untag-from-the-page.md` (Approved; § Resolved at the story gate; the Implementer's § Deviations)
**ADR:** `engineering-team/decisions/my-assistants/0002-tag-and-withdraw-from-the-browser-the-read-carries-what-they-need.md` (Accepted), with ADR 0001 for the read
**Test plan:** `engineering-team/stories/my-assistants/2-tag-and-untag-from-the-page.test-plan.md`
**Book:** `engineering-team/audits/my-assistants/book.md` (acceptance frame, no PRD)

**In short:** the code does what ADR 0002 says, sub-decision by sub-decision. The isolated gate, the host suites and all 38 browser tests pass. Two things block.

1. **A withdrawal stays on the instance where it was pressed, but the tagging it withdraws has already travelled.**
   - Staging, production and this machine all carry taggings to dcosl on a `#z`-filtered router stream, in both directions. A kind 5 has no `z`, and no stream carries kind 5.
   - So by the config and the code, Remove on staging leaves production's My Assistants still listing the Assistant, and a Change leaves it there with both chips.
   - This is the open bug `ledger/2026-09-27-revokes-do-not-travel.md`. ADR 0002 doesn't cite it, and its § Consequences tells the owner something that isn't so.
   - Book decision 7 ("as if the profile was never tagged") needs the owner's decision, made knowing this (Blocking 1).
2. **Nothing tests the withdrawal's signer guard.** The guard is in the code. But AC-7 asks for the wrong-key and no-extension case "for every tag, change and remove", and only Tag is tested. A mutant that drops the guard passes every suite (Blocking 2).

The rest is non-blocking. The most visible item: the search card says "No untagged profile matches." before the search has answered, and after a paste it briefly offers the previous query's profile (Non-blocking 1).

## Quality gates (run by reviewer, not trusted)

- [x] **`npm test`, by the network-isolated CI reproduction** (`ledger/2026-09-30-npm-test-step-leaks-fixtures.md`). Nothing ran against `localhost:7778`, and nothing could reach a relay. The steps:
  - a full clone of `feat/my-assistants` at `67563473`, copied into a Docker named volume with `COPYFILE_DISABLE=1 tar --no-xattrs`, and `chown -R root:root` inside it;
  - `npm ci` in `node:22-bookworm`, with network;
  - `GATE_LABEL=review-my-assistants-2 npm test` with `--network none` and `CI=true`.

  The verdict, read with `npm run -s gate:status -- --label review-my-assistants-2` (exit 0):

  > `20261001T010428Z-21-aff0 [review-my-assistants-2] started 2026-10-01T01:04:28.468Z on 67563473 — PASS, exit 0, 4231 passed, 0 failed, 591 skipped, 246/246 suites · /w/repo/tmp/gate-runs/20261001T010428Z-21-aff0.json`

  - **The record:** `node: v22.23.3`, `git: { commit: 67563473…, branch: feat/my-assistants, dirty: false }`.
  - **Against story 1's last gate** (`20260930T221058Z-20-1f63`, 4204 passed, 245 suites): one more suite and 27 more passes, which is exactly the new `my-assistants-actions`.
  - **Per suite:** `my-assistants-actions` 27/0/0, `my-assistants-page` 50/0/2 (the H-class skips with no network), `harness-lint` 76/0/0, `stack-free-npm-test` 6/0/1.
  - **No base run:** nothing failed, so there was nothing to separate.
  - **Cleanup:** the volume has been removed.
- [x] **The suites on the host**, each through its `run()` export (Node v24.18.0). I grepped each first for `strfry/publish`, `nak`, `method: 'POST'`, `firmware/install`, `docker exec`, `WebSocket`, `SimplePool` and `publishEverywhere`, and none matched. The only network use is `my-assistants-page`'s H-class, which makes two anonymous GETs.
  - `test/my-assistants-actions.test.js`: `{"pass":27,"fail":0,"skipped":0}`.
  - `test/my-assistants-page.test.js`: `{"pass":52,"fail":0,"skipped":0,"hExecuted":2}`.
  - `test/dictionary-concepts.test.js`: `{"pass":25,"fail":0,"skipped":0}`.
  - `test/stack-free-npm-test.test.js`: `{"pass":7,"fail":0}`.
- [x] **The container serves HEAD.**
  - A fresh build of HEAD's `ui/` into a scratch `outDir` gives `index-C_Vv2Mp_.js`. All 28 files are byte-identical (sha1) in the container's `dist/`, and `GET :7778/assistants` returns the same `index.html` bytes.
  - The sha1 of `src/api/assistant/myAssistants.js` and of `src/lib/my-assistant-tags/index.js` in the container equal HEAD's.
- [x] **Playwright against the container:** `BRAINSTORM_BASE_URL=http://localhost:7778 npx playwright test tests/brainstorm/my-assistants-actions.spec.js tests/brainstorm/my-assistants.spec.js tests/brainstorm/dictionary-concepts.spec.js --project=chromium` gave **38 passed**: 14 new, 15 of story 1's and 9 of the dictionary's. D6 passed this run.
  - Before running, I checked the three guards in the code they guard. The local post is `fetch('/api/strfry/publish')` (`ui/src/utils/nostrPublish.js:79`), which the spec mocks. `publishToRelays` returns before opening a socket when the policy says no (`:170-173`), and the spec answers the policy with `allowExternalPublish: false`. Every test also routes WebSockets to a handler that closes and counts them.
- [x] **Mutants**, each in a scratch clone of `67563473`, never in the repo. Each ran both Node suites, and the UI mutants also ran both My Assistants specs against their own build, served by `vite preview` on :4174.

  | Mutant | Node | Browser | Reading |
  |---|---|---|---|
  | M1: the withdrawal signs after `window.nostr.getPublicKey()`, not `getActiveSignerOrThrow()` (`publishProfileTag.js:147`) | 27/0 and 52/0 | 29 passed | **survives:** Blocking 2 |
  | M2: a failed refresh sets the error phase (`Index.jsx:56`, `if (!refresh)` dropped) | 27/0 and 52/0 | 29 passed | **survives:** Non-blocking 2 |
  | P1 (the plan's "a change withdraws even when its apply reached no relay"; `assistantActions.js:69` removed) | O3 fails | — | as the plan says |
  | P2 (the plan's "`definitionsFrom` accepts any author") | R4 fails | — | as the plan says |
  | P3 (the plan's "the refresh shows the loading line") | 27/0 and 52/0 | C12 and C10 fail | as the plan says, and C10 too |
  | P4: the taggings read drops its `#z` (`src/api/assistant/myAssistants.js:178`) | `my-assistants-page` U3 and U4 fail | — | the U3 re-aim still bites |

  The unmutated scratch clone builds the same `index-C_Vv2Mp_.js`, so the mutant builds differ from HEAD only by the mutation.
- [x] **A browser probe of the search card**, in the scratch clone, using the spec's own `setup` (all three guards), pressing nothing. It sampled the count line and the result names every 40 ms:
  - typing `xa` gave `No untagged profile matches. | (no cards)`, then `1 untagged profile | Xavi`;
  - pasting Yara's npub while Xavi showed gave `1 untagged profile | Xavi`, then `1 untagged profile | Yara the Unranked`;
  - a fresh paste gave `No untagged profile matches. | (no cards)`, then Yara.

  Sockets 0, posts 0.
- [x] **The read on real data**, read-only: `handleMyAssistants` called in the container with a session for the owner (Nous, `15f7dafc…`). No tag-federation relays are configured here, so only the local relay was read, and nothing was written. It answered 200:
  - `definitions.tapestry` found (`024abcc2…`) and `definitions.brainstorm` not found;
  - Nous' Assistant `a73a2980…` carries `tapestry` with one id and the address `profile-tag-my-tapestry-assistant-a73a2980-15f7dafc`;
  - the Local row `11f23fe4…` is untagged, with `retract: {}`.

  That matches the Implementer's § Deviations claim.
- [x] `bash scripts/harness-lint.sh`: clean (0 violations) before writing this file. `src/api/openapi.yaml` parses (`js-yaml`); the 200 schema has `definitions`, and the row items have `retract`.
- [x] **Hygiene sweeps** on every added line under `src/`, `ui/`, `test/` and `tests/`:
  - no `console.log` outside the test runner's report lines, no `debugger`, TODO, `nsec` or private-key read;
  - no 64-hex literal under `src/` or `ui/`;
  - no raw control bytes in any of the 19 files (checked with perl; BSD grep has no `-P`).
- [ ] _Lint, typecheck and build are not configured, so they were skipped._

## Spec adherence

- [ ] Every acceptance criterion has a passing test. AC-7's wrong-key and no-extension clause isn't tested for Remove (Blocking 2).
- [ ] No criterion is silently dropped. AC-5's meaning of "withdraw" doesn't hold across the instances this book ships to (Blocking 1).
- [x] No behavior added that isn't in the story.

| AC | Tests (all pass) | Notes |
|---|---|---|
| AC-1 find a profile | V1–V4; C1, C1b, C2 | The search speaks before it has answered (Non-blocking 1). |
| AC-2 tag a found profile | O1, T1, T2, R4, U1; C3 | "In its sorted place" isn't asserted. The order is story 1's `buildRows`, which story 1's C-class pins. |
| AC-3 open a row | V6; C4 | The untagged Local row isn't a toggle, per ADR sub-decision 9 and the Deviations. |
| AC-4 change the tag | V5, V6, O2; C5 | Apply first, then withdraw, in that order on the wire. Across instances, see Blocking 1. |
| AC-5 remove the tag | R1–R3, V8, O5; C6 | Complete on the instance where it's pressed (§ Withdraw semantics); not across instances (Blocking 1). |
| AC-6 Brainstorm unavailable | V7, O7, U2; C7 | The search card shows the reason once, above the results, rather than beside the first button. It reads fine. |
| AC-7 told, never lost | O3, O4, O6, S1–S3; C8–C12 | The wrong-key and no-extension clause is tested only for Tag (Blocking 2). The failed-refresh note is untested (Non-blocking 2). |

**Copy:** I compared all 14 § Copy strings byte for byte against `COPY` in `ui/src/pages/assistants/myAssistants.js:36-46`, including both busy ellipses (U+2026). All match, with curly apostrophes as § Copy asks. The result lines are `describeTaggingPublish`'s, with § ADR 4's subjects.

**The two new lines** (§ Deviations):
- "Search isn’t answering right now.";
- "The list couldn’t be re-read; it may not show this yet."

Both are in the page's tone and use curly apostrophes.

## ADR adherence

- [x] The files changed match § Implementation notes, including the allowed three-file split and the `openapi.yaml` entry.
- [x] Layering is respected. The server rule and `definitionsFrom` are pure. The view-model loads in Node, and the orchestration takes its publishers as `deps` (S3). Every wire shape is in `publishProfileTag.js` (S2).
- [x] No new dependencies and no new server route (`src/api/index.js` is untouched).

**Each sub-decision, against the code:**

1. **The read** (`src/api/assistant/myAssistants.js`):
   - `stancesByPair` (`:87-99`) groups every one of the viewer's taggings per (tag, profile), after the slug and signer checks, whatever its polarity.
   - `retractionOf` (`:113-118`) names every id and every distinct `39999:<viewer>:<d>`.
   - `myAssistantRows` (`:126-146`) attaches it only for the tags a row carries. The untagged Local row gets `retract: {}`.
   - The newest-stance rule is unchanged (`newestStances`, `:102-110`). It now runs over the groups, so `retract` holds every candidate, not just the newest.
   - `definitionsFrom` (`:153-164`) counts only the tag's own author at its own `d`, and takes the newest (R4, P2).
   - The definitions scan runs in parallel with the taggings scan (`:177-184`). A throw from either fails the read with the fixed 500 (U2). `federatedScan`'s local leg propagates, and its remote leg is swallowed (`src/api/profile-tags/index.js:131-139`).
2. **The tag list** (`src/lib/my-assistant-tags/index.js:22-28`): both authors come from identification-tags' My Tapestry Assistant entry, never re-typed. `definitionAddress` is at `:38-40`.
3. **The withdrawal** (`ui/src/utils/publishProfileTag.js:138-162`):
   - kind 5, one `e` per id, one `a` per address, `k` `39999`, content `withdrawn`;
   - it refuses an empty list before signing, and guards the signer (`:147`);
   - it returns `{ signed, result }` without throwing on delivery.

   `useProfileTags.revoke` is untouched.
4. **The order** (`ui/src/pages/assistants/assistantActions.js`):
   - an apply has `polarity: 1`, after the availability check (`:34-48`);
   - a change applies first and stops after a refused apply or one no relay took (`:66-76`, O3, P1);
   - Remove is one withdrawal of everything (`:79-82`).

   The subjects are as the ADR says. For a two-tag row, the subject names Brainstorm first, the row's order; the ADR's example puts Tapestry first, and nothing depends on it. One press at a time: `press` returns while `busy` (`Index.jsx:77`), and every action button is disabled while busy (C8).
5. **The refresh:** the rows stay on screen (`Index.jsx:45`, C12, P3). A failed refresh leaves them and adds the note (`:55-57`, `:141`), which is untested (Non-blocking 2). The open row stays open while listed (`:95`, `:155`). One small drift: the refresh re-fetches every row's profile, not only the new pubkeys' (Non-blocking 4).
6. **The result area** (`Index.jsx:128-143`): one region below the search card and above the count, with `role="status"`. It shows each report's message, `relayLine` per relay, `publishTone` as its tone, and a refusal as an error line.
7. **Search** (`ui/src/pages/assistants/AssistantSearch.jsx:29-50`):
   - it debounces for 250 ms, starts at 2 characters, asks for 10 results in the viewer's POV, and guards the sequence;
   - an exact key comes from `parseExactKey`, through `fetchProfilesChunked`, is offered first and isn't repeated;
   - listed profiles, the untagged Local one included, are left out (`searchCandidates`, V3);
   - a search error shows a line only when there's no exact key.
8. **Availability** (`tagAvailability`, `myAssistants.js:170-178`): a tag needs `found === true` and a string `eventId`. No `definitions` disables both tags (V7).
9. **Rows open** (`ui/src/pages/assistants/AssistantRow.jsx`):
   - the toggle is a native `<button aria-expanded>` inside the `<li>` (`:67-73`);
   - the panel is a sibling of that button (`:74-93`);
   - the untagged Local row renders a plain `<div>`, with no chevron and no `aria-expanded`;
   - its prompt link stays outside any button (`:94-98`).
10. **The pure parts** are in the view-model with the plan's seams, and the orchestration is non-pure with injected publishers.

**The Implementer's deviations, judged:**
- **The untagged Local row isn't a toggle:** it's ADR sub-decision 9, which the gate was asked to confirm. "Only that one" is true: the server emits a tagless row for Local only (`myAssistants.js:136`).
- **The two new lines:** fine (above).
- **`withdrawalOf(row, onlyKeys)`:** a small, logged extension of the ADR's signature.
- **The empty-withdrawal refusal:** that's ADR sub-decision 3; the Deviation records its words.
- **Three files:** allowed by § Implementation notes.
- **Brainstorm filled, Tapestry outlined:** the blueprint does the same (`blueprint/my-assistants-screen.html.txt:30-31`).
- **No live press on this machine:** consistent with ADR § Consequences. The real-data half is confirmed above.

None of these silently changes an ADR decision. One unlogged deviation, the refresh re-fetching every profile, is Non-blocking 4.

## Withdraw semantics

**On the instance where Remove is pressed, the withdrawal is complete.**
- **It names every version the read saw:**
  - every event for the pair, whether apply or dispute;
  - every address, the other-client address included (R1);
  - for older versions at one address, which `dedupeReplaceable` keeps out of the read (`src/api/profile-tags/index.js:162-174`), the `a` covers them.
- **strfry 1.1.0 honours both halves.** I read this in the container's `/usr/local/src/strfry/src/events.cpp`:
  - an `e` deletes the event when the authors match (`:333-338`);
  - the deletion is remembered by id and pubkey, so a re-import, such as the router's download, is refused as Deleted (`:274-277`);
  - an `a` deletes versions at or before the deletion's time (`:339-358`);
  - it refuses any later write at that address dated at or before the deletion (`:310-326`).
- **The read then drops the pair:** its newest is named by `e` (`myAssistants.js:69-75`, `:130`).

I found no way, on that instance, for Remove to leave a tagging that story 1's read still counts, with two narrow exceptions:
- On an instance with tag-federation relays configured, a relay that timed out at press time (`dlistFetch` answers `[]`) could hold an older tagging at a third address. The kind 5 doesn't name it, and once the newer one is gone it becomes the newest. None are configured here.
- The same-second case (Non-blocking 6).

**Across instances, it isn't complete** (Blocking 1).

## Security and POV

- **No new route and no server signing.** The read stays session-scoped, with no request parameter (story 1's U4 still passes).
- **The viewer's own key signs everything.** Both publishers call `getActiveSignerOrThrow` (issue #335) before signing. The withdrawal's guard is untested (Blocking 2).
- **Nothing is signed for, or against, someone else.**
  - An apply's target is any profile, which is the feature, and it's signed by the viewer.
  - A withdrawal's ids and addresses come only from the server's `retract`. That's built from events whose `pubkey === viewer` (`myAssistants.js:90`) and addresses of the form `39999:<viewer>:<d>` (`:116`).
  - The page never composes a kind 5 from a non-viewer pubkey. Even if it did, NIP-09 and strfry (`events.cpp:335`) ignore a deletion by anyone but the author.
- **No 64-hex literal** under `src/` or `ui/` (sweep, and S1).
- **The invariants:**
  - POV-first: the list and its `retract` are the viewer's own.
  - Permissionless: any profile can be tagged; story 1's read still counts any author's same-slug definition. The apply points at Nous' definition, a pointer choice for new taggings (book decision 4), not a gate on anyone's publishing.
  - Filter at read time: nothing derived is stored.

## Test quality

- **AC coverage:** see the table. Every AC has tests, and the gaps are Blocking 2 and Non-blocking 2.
- **The safety guards:** every Playwright test calls `setup()`, which installs the policy mock, the publish mock and the socket router. 13 of the 14 assert zero sockets. C1b (signed out, nothing pressed) doesn't assert the count (Non-blocking 7). The Node suite imports no publisher and passes fakes.
- **The U3 re-aim is legitimate.**
  - The only change to story 1's suites is the `taggingScans` helper (`test/my-assistants-page.test.js:176-178`): kind 39999 scans that carry `#z`. It's needed because the read gains a second kind 39999 scan.
  - U3 still demands exactly one such scan, with `{ kinds: [39999], authors: [viewer], '#z': [Z] }`.
  - P4, which drops `#z`, fails U3 and U4.
  - The one thing it no longer catches is an extra viewer-wide kind 39999 scan without `#z`. That scan would be harmless, since the rule filters by slug and signer.
- **The plan's mutant claims:** the three I re-ran (P1–P3) bite as stated.
- **New survivors:** M1 and M2.

## Scope

Nothing from story 3:
- no duties, no "Manage on Treasure Map", no on-map status;
- no "On your Treasure Map, but not tagged" section;
- no Duties tab and no kind 10040 read.

The only "Treasure" in the added lines is story 1's `TREASURE_MAP_PATH` import for the existing intro. No dispute, confirmation dialog, undo or bulk action. The untagged Local row keeps story 1's link (§ Resolved 3).

## Accessibility

- [x] The toggle is a native button, so Enter and Space work (C4). `aria-expanded` is set (C4). Its content is spans only, the panel buttons are its siblings, and the prompt link is outside it: no nested interactives.
- [x] The disabled states are native `disabled` (C7, C8). The search input has a real `<label>`, which the blueprint's `div` didn't.
- [ ] The live region and focus handling (Non-blocking 5).

## Concept-graph integrity

- [x] Handles are in `kind:pubkey:slug` form. The new addresses are built from the lib (`definitionAddress`) and the viewer, never typed.
- [x] Firmware reinstall: not needed. No concept definition changed (ADR § Consequences).
- [x] Orientation: the story and ADR name the four concepts, and no new code re-derives concepts.

## Things tests can't catch

- [x] **Secrets:** none (sweep).
- [x] **Debug code:** none.
- [x] **Commented-out code:** none.
- [ ] **Edge cases:** Blocking 1 (cross-instance); Non-blocking 1 (search pending and stale), 6 (same second) and 8 (`openKey`).
- [x] **Concurrency:**
  - The press guard plus disabled buttons stop a double press (C8).
  - Story 1's `latest` ticket also drops a stale refresh.
  - The search's `seq` guard drops a stale answer, but not a stale display (Non-blocking 1).
- [x] **Input at boundaries:** `parseExactKey` accepts only 64-hex or a decodable npub (V1). The server's `retract` and `definitions` come only from signature-checked relay data. A malformed definition address makes `authorOf` return null, and the apply publisher then refuses (`publishProfileTag.js:73-75`).

## House rules check

- [x] Concept Graph API authority respected.
- [x] No new lint, typecheck or build tooling.

## Product-guide adherence

No PRD. The copy matches § Copy (above). The search card, toggle, panel and Remove Tag follow the blueprint (`blueprint/my-assistants-screen.html.txt:17-31`, `:46`, `:86`). The one designed state the blueprint lacks, the search waiting for its answer, is missing here too (Non-blocking 1).

## Findings

### Blocking

1. **The withdrawal never reaches where the tagging went, so Remove and Change don't do what book decision 7 and AC-5 say on the instances this book ships to.**
   `ui/src/pages/assistants/Index.jsx:72` → `ui/src/utils/publishProfileTag.js:160`; `engineering-team/decisions/my-assistants/0002-tag-and-withdraw-from-the-browser-the-read-carries-what-they-need.md:236-240`; `engineering-team/stories/my-assistants/2-tag-and-untag-from-the-page.md:79-80`.
   - **Where the withdrawal goes:** this instance's relay, and `PUBLISH_RELAYS`, through `publishEverywhere`'s default. Those are purplepag.es, wot.grapevine.network, relay.primal.net, nos.lol and relay.damus.io (`ui/src/utils/nostrPublish.js:42-48`).
   - **Where the tagging goes:**
     - It carries the canonical nostr-user-tag `z` (`publishProfileTag.js:101`).
     - Staging and production each run a `nostrUserTag` stream, `both`, filtered by that `#z`, to `wss://dcosl.brainstorm.world`. I read this today from each host's public `GET /api/strfry/router-status`. This machine has the same stream (`/var/lib/brainstorm/router-state.json`).
     - Kind 5 has no `z`, and none of the three hosts has any stream that carries kind 5. Production's unfiltered `dcoslUpload` is kinds 9998, 9999, 39998 and 39999 only.
     - This is the open row `ledger/2026-09-27-revokes-do-not-travel.md`. Its census found two real revokes on tags.brainstorm.world whose taggings production and staging still hold.
   - **What follows.** This comes from the config and the code; it wasn't observed live, because no press is allowed on those stacks.
     - **On other instances:**
       - Tag an Assistant on staging, and the tagging reaches dcosl and then production.
       - Remove it on staging, and it leaves staging's list. But production's My Assistants still lists it: production's read holds the tagging and no kind 5 (`src/api/assistant/myAssistants.js:177-194`).
       - A Change leaves production showing both chips.
     - **On an instance that reads tags from dcosl** (`aTagFederationRelays`; OPEN.md row 25 recorded staging as a dcosl read-union instance on 2026-07-12, and I didn't re-check its current setting), two readers keep counting the withdrawn tagging, even on the instance where it was pressed:
       - the profile pages: profile-tags' `federatedScan` never reads kind 5 (`src/api/profile-tags/index.js:131-139`);
       - the Identification Tags check: `lookupByAddresses` reads local first, then the tag-federation relays, and never reads kind 5 (`src/api/assistant/attention.js:97-138`).

       For your own Assistant, that means the Local row says "Not tagged" and links to a page that can say the tagging is already there.
   - **Why it blocks:**
     - AC-5 defines a withdrawal as "the tagging no longer counts anywhere this app reads your stance, as if you had never tagged it". Book decision 7 (`book.md:65`) is the owner's answer at the gate.
     - ADR 0002 § Consequences (`:236-240`) tells the owner two things that aren't so:
       - "the read still hides them for this viewer" holds only on the instance that holds the kind 5;
       - "outside relays that ignore NIP-09 keep them" misplaces the cause: the deletion is never sent to the relays that carry the taggings.
     - Neither the ADR nor the story cites the open row. The owner approved decision 7 without it.
   - **In this diff's favour:** the withdrawal carries `k: 39999`. That makes the row's narrowest fix shape, `{"kinds":[5],"#k":["39999"]}` on the tag streams, work for these withdrawals, where the app's older id-only revoke wouldn't.
   - **Asked change:** back to the Architect for a dated ADR 0002 amendment, and to the owner for one of these:
     - **(a) Make the withdrawal travel.** At least, also send it to the relays the tagging streams use (dcosl), so dcosl deletes the tagging and read-union reads stop seeing it. Then add kind 5 to the tag streams (the row's `#k` shape) so hoarding instances get it too. That second step is router state, so it's the owner's call. Any code here needs a test that pins where the withdrawal is sent.
     - **(b) Narrow the promise, accurately.** Amend AC-5's definition and ADR § Consequences to say a withdrawal takes effect on the instance where it's pressed, and on the relays that took the kind 5. Say it doesn't yet reach other instances or dcosl's copy, nor the readers that federate to dcosl, until `2026-09-27-revokes-do-not-travel` is fixed. Cite the row in the story and in the book (§ Before shipping, or a known-limitations line), and have the owner re-confirm decision 7 under that meaning.
2. **Nothing tests the withdrawal's signer guard, on the one new signed-write path.**
   `ui/src/utils/publishProfileTag.js:147`; `tests/brainstorm/my-assistants-actions.spec.js:350-362`; `engineering-team/stories/my-assistants/2-tag-and-untag-from-the-page.test-plan.md:33-34`.
   - The guard is there and correct.
   - AC-7 asks, "for every tag, change and remove", that a missing extension, or one on a different key, publishes nothing, and that the page says why. The browser tests press only Tag for this (C9), and the O-class runs fake publishers.
   - Change is covered indirectly. Its apply goes first, through the guarded apply publisher (C9), and O3 pins that a refused apply withdraws nothing.
   - Remove goes straight to the withdrawal publisher, and no test reaches its guard. M1, which replaces the guard with a bare `getPublicKey()`, passes every Node test and all 29 browser tests.
   - **Why it matters:** without the guard, Remove with the extension on another account signs a kind 5 as that account, naming the viewer's event ids and addresses.
     - It deletes nothing, since NIP-09 needs the same author.
     - The page reports the relays accepting it.
     - It publicly links the two accounts.

     Issue #335 exists to prevent exactly this.
   - **Asked change:**
     - Add a browser case that opens a row and presses Remove, with signer `'other'` and with `'none'`. Assert that nothing is posted and that the app's words show. Extending C9's loop is enough.
     - Optionally, add an S-class sentinel that the withdrawal calls `getActiveSignerOrThrow` before `signEvent`.
     - The spec is the Tester's file, so route it to Phase 3, or record the Tester's sign-off on the addition.

### Non-blocking

1. **The search card says "No untagged profile matches." before the search has answered, and after a change of query it offers the previous answer's profiles** (`ui/src/pages/assistants/AssistantSearch.jsx:29-50`, `:73-77`).
   - **What the probe saw:**
     - typing `xa` showed the no-match line first;
     - a fresh paste of an npub showed it until the exact lookup returned, on the very path AC-1 adds for Assistants that don't rank yet;
     - pasting an npub while Xavi showed kept Xavi's card, with enabled Tag buttons, under Yara's npub until the answer came.
   - **Why:** `found` belongs to the previous query until the new answer lands.
   - **The pattern the ADR names:** `TagSomeoneModal` (ADR sub-decision 7) shows "Searching…" and holds back its no-match line (`ui/src/components/TagSomeoneModal.jsx:102`, `:180-187`).
   - **Suggested:** record which query `found` answers. While it differs from the box, show neither the line nor any card; that needs no new word. Or add a § Copy word for searching. It's worth folding into this round.
2. **The failed-refresh path (ADR sub-decision 5) has no test, and M2 survives.** Because the result area renders only in the ready phase (`ui/src/pages/assistants/Index.jsx:124-143`), a regression there would also hide the press's own report. Suggested test: a second read answering 500 after a press. The rows stay, the report shows, and "The list couldn’t be re-read…" follows.
3. **`ui/src/pages/assistants/assistantActions.js:22` re-types both slugs.**
   - The Tapestry slug's owner is identification-tags (ADR 0001 sub-decision 3; ADR 0002 sub-decision 2).
   - `definitions[key].address` already carries the slug, and `authorOf` (`:29-32`) already parses that address.
   - Taking the slug from it removes the second copy and any drift.
4. **Unlogged small deviation:** the refresh re-fetches every row's profile (`Index.jsx:52`), where sub-decision 5 says "the profiles of any new pubkeys". It's one batched call and harmless. Worth a § Deviations line.
5. **Accessibility:**
   - **The live region.** It's created together with its content and removed at each press (`Index.jsx:79`, `:128-129`). Many screen readers announce changes inside an existing live region but not a region inserted with its text, so the outcome may go unspoken. Keep the region mounted, empty between presses, and replace its content.
   - **Focus.** It drops to the page when the pressed button is disabled (`AssistantRow.jsx:81`, `:87`; `AssistantSearch.jsx:98`), and again when a tagged result leaves the search. Consider moving focus to the result region after a press.
   - **The reasons.** They aren't tied to their buttons (`AssistantRow.jsx:91`, `AssistantSearch.jsx:78-80`). This is minor, since disabled buttons can't take focus.
6. **Same-second re-apply at a withdrawn address.**
   - strfry refuses a write at an address whose kind 5 is dated at or after it (`events.cpp:310-326`), and the read's `>=` agrees (`src/api/assistant/myAssistants.js:74`).
   - So a Change back to the tag just withdrawn, inside the same second, gets its apply refused locally.
   - If an outside relay accepts that apply, `ok` is true (`assistantActions.js:69`). The change then withdraws the other tag, and the row can end with no chips on this instance.
   - Signing prompts and outside relays make one second very hard to hit. This is a note only.
7. **Test hygiene:**
   - C1b (`tests/brainstorm/my-assistants-actions.spec.js:187-192`) installs the guards but doesn't assert the socket count. It presses nothing.
   - C9's title says "nothing signed", but the test checks only posts (`:358`).
   - S1's file list (`test/my-assistants-actions.test.js:420`) leaves out the split files `AssistantRow.jsx` and `AssistantSearch.jsx`. My sweep found no 64-hex in either.
8. **`openKey` survives a Remove** (`Index.jsx:95`, `:155`). If the same profile is tagged again later in the session, its row comes back already open. Trivial.

### Harness friction

1. **The ADR phase missed an open bug about the very mechanism it chose.** `ledger/2026-09-27-revokes-do-not-travel.md` (opened 2026-09-27) and OPEN.md row 25's notes both say a kind 5 doesn't ride the `#z` tag streams. ADR 0002 (2026-09-30) relies on kind 5 and doesn't mention either. Nothing in the ADR template or the Architect's workflow asks for a search of OPEN.md and `ledger/` for open rows on the mechanisms a design relies on.
   - Suggested `meta` row: add that search, and a citation in § Consequences, to the ADR template's checklist.
2. **The isolated-gate recipe worked as the corrected row now writes it** (the chown, and `GATE_LABEL` at run time). One addition belongs in the same row: send the run's output outside the copied tree. I first redirected the log into the tree, which would have made the record start `dirty`, and that cost a restart. It's a note for `ledger/2026-09-30-npm-test-step-leaks-fixtures.md`, not a new row.

## Close-out

Not applicable this round. The story stays `Approved`: no status change and no completion detection, with story 3 still to build.

## Verdict
**CHANGES_REQUESTED**

There are two blocking issues:
- **Blocking 1:** the withdrawal doesn't travel where the tagging does, and the ADR misstates it. `ui/src/pages/assistants/Index.jsx:72`, `ui/src/utils/publishProfileTag.js:160`, ADR 0002 `:236-240`, story `:79-80`. It needs an owner decision, (a) or (b).
- **Blocking 2:** the withdrawal's signer guard is untested. `ui/src/utils/publishProfileTag.js:147`, `tests/brainstorm/my-assistants-actions.spec.js:350-362`.
