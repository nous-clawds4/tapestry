# Review: Story 1 — The Duty Menu page and its check

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-11
**Diff:** `git diff 2d67d055~1..b5c732ed`, attributed commit by commit:
- Code: `b2477a93` (the implementation) and `b5c732ed` (ADR 0001 Amendment 2). These are the only commits in the range that touch `src/`, `ui/` or `BIBLE.md`.
- Tests: `2d67d055` (Phase 3) and `d8cdb0fe` (Amendment 2's tests). Neither touches `src/` or `ui/`, and neither implementation commit touches `test/` or `tests/`.
- Docs: `2a4e63ab` (ADR Amendment 2 and the story's Deviations).
- Unrelated: `d891b4a8`, `07f167b1` (ADR duty-menus-and-self-maps/0003), `5570cebe`, `43d930eb` (this book's shared-lines notes) and `0a04c929`, `ddeb1c13`, `2cb7a2c6`, `a8a8578a` (book assistant-shared-categories). All of them touch only `engineering-team/` docs.

**Story:** `engineering-team/stories/assistant-duty-menu/1-the-duty-menu-page-and-its-check.md` (with § Deviations and the Amendment 2 notes)
**ADR:** `engineering-team/decisions/assistant-duty-menu/0001-a-duty-menu-check-beside-the-others.md` (Accepted; Amendments 1 and 2)
**Test plan:** `engineering-team/stories/assistant-duty-menu/1-the-duty-menu-page-and-its-check.test-plan.md`
**Spec:** `protocols/drafts/duty-menus.md` §§ 3–6.1, 8.1, 12; ADR `duty-menus-and-self-maps/0003` sub-decision 11 (accepted; its § 6.1 edit has not landed in the spec yet)

## Quality gates (run by reviewer, not trusted)

- [x] **`npm test`** on `b5c732ed`, clean tree, label `duty-menu-reviewer`. `npm run gate:status`:

  > `20261011T210326Z-20170-8287 [duty-menu-reviewer] started 2026-10-11T21:03:26.821Z on b5c732ed — PASS, exit 0, 5665 passed, 0 failed, 582 skipped, 301/301 suites`

  The counts match the Implementer's last green run, `20261011T204641Z-17132-2f2a` (5665 / 0 / 582, on `d4cead14+dirty` before the rebase). The suites this story owns or re-aims:
  - `assistant-duty-menu-check` 55 / 0 / 0, `assistant-duty-menu-page` 11 / 0 / 0;
  - `assistant-duty-cards` 12 / 0, `assistant-management-page` 23 / 0 / 1, `assistant-identification-tags-page` 16 / 0;
  - `assistant-relay-list-publish` 32 / 0 / 1, `assistant-attention` 38 / 0 / 1, `assistant-outbox-check` 29 / 0;
  - `assistant-profile-check` 33 / 0, `assistant-trusted-content` 30 / 0.

  Each skip is a live H-class test (no stack here).
- [x] **Playwright, chromium.** I built `ui/` at `b5c732ed` with `vite build` into the session scratchpad, and served it with `vite preview` on :4199 (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`).
  - `tests/brainstorm/assistant-duty-menu.spec.js` alone: **12 passed** (B0–B11).
  - Together with the re-aimed and neighbouring specs (`assistant-alert`, `assistant-attention`, `assistant-management-page`, `assistant-profile-check`, `assistant-trusted-content`, `assistant-outbox-relays`): **75 passed, 4 skipped** (4.5 m). The four skips are `assistant-management-page` B8 for the four built pages (identification-tags, profile, outbox-relays, duty-menu).
  - I stopped the server afterwards. The tree is clean.
- [x] `bash scripts/harness-lint.sh`: **clean (0 violations)**.
- [x] `src/api/openapi.yaml` parses (`js-yaml`), and the attention block carries `offer`, `published` and `current`.
- [x] **Shared lines.** `git fetch origin staging` moved `origin/staging` to `57fbb432`. HEAD is its ancestor, a fast-forward: two assistant-shared-categories commits on top, `5fff2054` (design) and `57fbb432` (that book's intentionally failing tests). `git merge-tree --write-tree HEAD origin/staging` is **clean, exit 0, tree `9fff3bf3`**.
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._ The UI's `vite build` succeeds.

## Spec adherence

- [x] Every acceptance criterion has a passing test, and each is met in the code, not only tested:
  - **AC-1, whose Assistant.** `attention.js:308-319` passes the session's `{ viewer, assistantPubkey }`. `dutyMenu.js` never reads `req` (S1), and U4 sends a nosy query, params and body that change nothing. Visitors and viewers with no Assistant here get nothing (U1, U2).
  - **AC-2, the offer.**
    - `buildOffer` (`src/lib/duty-menu/index.js:138-147`) gives the K1 rows at R1's relay.
    - `resolveOfferInputs` (`dutyMenu.js:98-123`) reads `BRAINSTORM_RELAY_URL` through `isPublicHost`, the first not-plainly-private `aDListRelays` entry unless `isPublishLocalOnly()`, and gives Scores to the Owner and to `status === 'active'` customers.
    - A throwing customer lookup gives no Scores, and the offer still answers.
    - It re-reads the settings on every check (U11). Lists are offered to every Assistant, the owner's commitment.
    - No `39998:`/`39999:` key, no family key, no empty relay (L9, L10).
  - **AC-3, which menu.** Round 2 runs one strict local scan beside the hinted and offered relays (`dutyMenu.js:187-191`). The newest of every answer by `newest()` counts (`:195-198`). A newest version that fails `isDutyMenu` means no menu (U16, U31). "Finished" means the scan succeeded or a relay answered (`:193`, U18).
  - **AC-4, current and the mark.** `sameRows` compares sets of `tag|key|relay` (`index.js:117-129`). `done = finished && published && current` (`dutyMenu.js:218-220`). The owner's answer 3(b) holds: an empty offer with no menu is pending (U26). The hub's two readings follow from `CHECKED_ACTIONS` (`actions.js:273`), and the Treasure Map card stays a placeholder (C2, C4, B1, B2).
  - **AC-5, the page.** `DutyMenu.jsx` has the states, both panels, the mark from `assistantAttention`, one status line only when finished (Amendment 1 item 1), and the public line (D1–D5, P1–P6, B3–B10).
  - **AC-6, one request, read-only.** The page only reads `useAssistantAttention()` (D4, B11: one GET, no parameters, nothing but GETs). Nothing is signed or published. See NB6 on "stored".
- [x] No criterion is silently dropped. AC-2's amendment (R1) and the List kinds (K1) are logged in § Deviations, as are the Amendment 2 items.
- [x] No behavior beyond the story. The relays the offer names are read on top of § 8.1's three places, as ADR sub-decision 3 says.

**§ Copy, word for word.** I checked each sentence in `ui/src/pages/assistant/dutyMenuCopy.js:152-174` against § Copy as amended, and they match. That includes the amended none line, "No Duty Menu was found for your Assistant.", which is no longer the status line's sentence. The hub's words come from `ASSISTANT_COPY`.

## ADR adherence

- [x] **Option A, R1, K1**, as decided.
- [x] **Sub-decision 1.**
  - `src/lib/nous.js` is the one place Nous' key is written (S2). `src/lib/duty-menu` is pure CommonJS (L1).
  - `isDutyMenu` checks the § 6.1 conditions plus Amendment 2's fifth.
  - `readMenuRows` drops, normalizes and dedupes after the drops. A `not-offered` relay is `null` (Amendment 1 items 4 and 5).
  - `normalizeMenuKey` mirrors `entryOf` (`treasureMapCategories.mjs:30-47`; L7 pins the agreement). The kind-slot test is `editTreasureMap.js:31`'s.
- [x] **Sub-decision 2** (with Amendment 1 items 2 and 3) is as written. The `isLocalOnly` seam defaults to `isPublishLocalOnly()` (S5), and both offer relays pass through `normalizeRelayUrl`.
- [x] **Sub-decision 3**, two rounds:
  - Round 1 reads the Map through `lookupNewest`/`treasureMapRelays`, and both 10002s through `lookupNewestReplaceable` over the outside profile-publish relays.
  - The Nous list is cached for one hour, and a miss is never cached (`dutyMenu.js:131-138`; U21, U22). A failed hint lookup shrinks round 2 (`attempt`, U20).
  - The guard applies to event-named relays only.
- [x] **Sub-decision 4.** The answer has exactly the seven fields (U3). `DUTY_MENU_CHECK_FAILED` is the frozen check-failed shape (U27).
- [x] **Sub-decision 5**, the provisional rules: dropped rows sit out the duplicate check, and naddr segments are compared as written.
- [x] **Sub-decision 6.**
  - `duty-menu` joins `CHECKED_ACTIONS` after `outbox-relays`. The entry gets the ADR's `alertCriteria` and `planningNotes: null`.
  - `ACTION_PAGES['duty-menu']` is set. `categoryOf` mirrors `appliesTo` (P3), and `statusLine` is pure.
  - The page never calls `refresh()`.
- [x] **Sub-decision 7.** A fifth `allSettled` entry behind a `checkDutyMenu` seam, the `DUTY_MENU` constant, a log line on failure, and a new paragraph in the header comment (see NB9).
- [x] **Amendment 1**, items 1–8. The `openapi.yaml` and BIBLE §11 lines (item 7) are checked under Docs below. The `relay-list-publish` S3 re-aim (item 8) is checked under test quality.
- [x] **Amendment 2.**
  - Item 1: `index.js:36,65-67`.
  - Item 2: `dutyMenu.js:180-181`. The relays are normalized, put through `outsideOnly` (which de-duplicates), and then the first `MAX_RELAYS` (50) go on to the guard and round 2. The offer's relays are added after the cap (U32).
  - Item 3: `dutyMenuCopy.js:161`.
- [x] Files match the Implementation notes. Every logged deviation (the `readWithinBudget`/`newest` exports, the offer panel on failure, the check-failed words, `categoryOf('*')`, the Map hints, the hex case) is in § Deviations. One small gap is not logged: NB4.
- [x] No new dependencies, and no new tooling.

## Security

- **SSRF, event-named relays.** Every relay taken from an event is guarded before any connection:
  - the Map's element 3 for entries naming the Assistant;
  - the Assistant's 10002 write relays;
  - Nous' 10002 write relays.

  The order is normalize, then `outsideOnly`, then cap at 50, then `isPublicRelayHostWithin(hostname)` with its 3 s budget, failing closed (a throw becomes `null`). Only accepted URLs reach `readWithinBudget` (`dutyMenu.js:180-190`). U14 pins "refused never read" against "accepted read", and U32 pins the cap.
- **The round-1 lookups read configured relays only.**
  - `lookupNewest` for the Map reads `treasureMapRelays(d)` = `outsideOnly(mapDefaultRelays())` (`setup/status.js:243-245`). Those come from `BRAINSTORM_NIP85_HOME_RELAY` and Relay Settings' `aTrustedAssertionRelays` and `aPopularGeneralPurposeRelays` (`currentMap.js:19-26`).
  - Both `lookupNewestReplaceable` calls read `outsideOnly(getConfiguredPublishRelays())` (`dutyMenu.js:146-150`).

  No event-named relay is read in round 1. The offer's relays are configured: the instance relay, which `outsideOnly` drops, and an `aDListRelays` entry passed through the synchronous private check. They are read unguarded, as the ADR says.
- **Forged events.** `readRelayEvents` re-checks kind and author and verifies every signature (`relaySource.js:274-286`). `mine` (`dutyMenu.js:195`) keeps only kind 39999, author A, `d` = `duty-menu`.
- **Session-only:** yes (AC-1 above). **Read-only:** nothing signs, publishes or imports into strfry (S1). See NB6 for the customer store. **No secrets.** The only 64-hex literal added is Nous' community key, which the CLAUDE.md hardcoding rule doesn't cover (it covers the per-deployment TA key). No TA pubkey is hardcoded.
- **Residual:** DNS rebinding between the guard's lookup and the connect (NB11). This is the house guard's known, ledgered gap.

## Correctness against the spec

- **§ 6.1.** All five conditions:
  - kind;
  - the first `d`;
  - exactly one `p`, equal to the author (lower-cased);
  - Nous' `z`, exactly;
  - the fifth: no `["z","list"]`, and no `39998:<64 hex>:concept-header` `z` from any author, matching ADR 0003 sub-decision 11's wording.

  L3, L4 and L12 test each condition with passing and failing cases. NB4 and NB5 are corner cases.
- **§ 8.1.**
  - All three places plus the local relay, with § 8.1's filter (U12).
  - The latest version by `created_at`, with the lowest id on a tie, across the local scan and every answering relay (U15).
  - If the newest version isn't a menu, there is none, even when an older version is one (U16, U31). A relay that doesn't answer within the budget is skipped (U19).
- **§ 5.** A `duty` row with a missing, empty or non-`ws(s)://` relay is dropped. An unparseable kind slot is dropped, and so are `39998:` and `39999:`. The first row per normalized key wins, after the drops (L5, L6). Probed: `3039x:tag:` becomes `3039x:tag`, `39998:dlist-header` becomes `39998`, and `39999:` is dropped.
- **Normalization** agrees with `entryOf`, line for line, and L7 pins it.

## Performance and robustness

- **Failure isolation.** A throw inside the check is isolated: `allSettled` turns it into `check-failed`, and the other actions still answer with a 200 (U27). A dutyMenu.js that fails to *load* is not isolated (NB3, confirmed by a probe).
- **Nous cache.** It is module-level and in memory only. Only a found list is cached, for one hour, and a miss never is. Concurrent misses just look the list up twice.
- **Latency.** The hub's one answer now waits on this check:
  - **Steady state:** every hub load waits for the slowest event-named or offered relay, up to the 8 s budget. This happens even when the local relay holds the menu (NB1; U19 runs about 8.2 s for exactly this reason).
  - **Worst case:** measured at about **23.9 s** in a probe (NB2), against the ADR's estimate of about 19 s and about 13 s for the hub before this story.

  Both are bounded. Neither breaks an AC.

## Test quality

- **The `assistant-relay-list-publish` S3 re-aim** (`test/assistant-relay-list-publish.test.js:580`) is narrow. Only `src/api/assistant/dutyMenu.js` is exempt, and only while it names none of `createPublishRelayListHandler`, `handlePublishRelayList` or `publishAssistantRelayListFor`. Those are the module's only functions apart from the guard; its other exports are constants. The sentinel's intent, that nothing publishes a relay list at Assistant creation, still holds. The duty-menu S1 independently forbids signing and publishing in the check. The re-aim is not weakened, though an allow-list would be tighter (NB10).
- **Other re-aims.**
  - `assistant-duty-cards` now pins the Treasure Map card as the one placeholder, and asserts `PLACEHOLDER_CARDS` is exactly `['treasure-map']`, so it can't pass vacuously.
  - The four `checkDutyMenu` stubs keep the other suites' scan and read counts honest. The browser specs carry the Duty Menu as pending, so their counts hold. `assistant-attention` B4 goes 7 → 6, correctly.
- **Negative assertions have positive pairs:** U13, U14, U16, U31, L12, C6, S1 and D4. None of the tests I read is vacuous.
- **Gaps** (non-blocking):
  - Round 1's outside reads are barely exercised: the fixtures hold the Map and both 10002s locally.
  - The real guard is not run here. `relay-list-publish` pins it.

## Concept-graph integrity

- [x] No concept definitions change, so no firmware reinstall is needed. The handles are cited in `kind:pubkey:slug` form. `39998:<Nous>:duty-menu` is a string in a `z`, not a graph concept.
- [ ] Re-verifying the handles against a live graph (ADR § Context) was not possible here (no stack). Nothing in the diff depends on it.
- [x] The new code reads no concept data, so `/summaries` doesn't apply.

## Things tests can't catch

- [x] No secrets, no leftover debug output (only `console.error` on real failures, as the sibling checks do), no commented-out code, no TODOs.
- [x] Error paths: customer lookup, hint lookups, guard, scan and relay reads each fail soft.
- [x] Concurrency: the cache races are benign.
- [x] Input validation at the boundaries: URLs normalized (no userinfo or fragment), hosts guarded.

## House rules check

- [x] Concept Graph API authority respected. No new lint, typecheck or build tooling.
- [x] The TA pubkey is never hardcoded.

## Hub, UI and docs

- **Hub.** The Treasure Map card is still an always-marked, always-counted placeholder (C4, `assistant-duty-cards` C3–C7, W1, S1). The count line and the Alert follow the two readings (C3, C5, B2).
- **Page states:** signed out, no Assistant, Checking…, request failed, unfinished, check-failed, none, current, out of date, and empty offer. All of them are shown in the browser except check-failed, which goes through the same branch as request failed (`DutyMenu.jsx:69-70`).
- **`openapi.yaml`** is accurate: the description gives the full offer rule, and the schema carries `offer`, `published` and `current`.
- **BIBLE §11** (`BIBLE.md:527`) is accurate in outline but simplified (NB12).
- **`attention.js` header:** the new paragraph is accurate. Two surrounding lines are not (NB9).

## Shared lines

- `duty-menus.md` is unchanged since intake (`git log` shows its last commit as `427b0123`, round 3). ADR `duty-menus-and-self-maps/0003` sub-decision 11 is accepted and followed by Amendment 2. When its § 6.1 edit lands, the book's recheck should confirm `CONCEPT_HEADER_Z` against the final wording (NB4).
- `origin/staging` is a clean fast-forward of HEAD, so there is no conflict now. The parallel book assistant-shared-categories edits the same lines next:
  - `attention.js`, through `trustedContentActions` and the header;
  - `actions.js`, where `assistantAttention` gains `shared`;
  - `openapi.yaml`'s attention block;
  - the single long BIBLE §11 row.

  It builds on top of this story's lines and already lists `DutyMenu.jsx` as reading only `needsAttention` and `done`, so it is compatible. Its `57fbb432` re-aims `trustedContentFixtures.js`, which this story's browser spec reads (`TC.DONE_COPY`, `TC.done`, `TC.trio`). Adding `shared: null` there is harmless. Note that the gate on the staging *tip* is red until that book's implementation lands, which is unrelated to this story.

## Findings

### Blocking
None.

### Non-blocking
1. **`src/api/assistant/dutyMenu.js:186-191`; ADR 0001 § Consequences (`0001-…md:276`).** Round 2 always reads every hinted and offered relay beside the local scan. That is right by § 8.1's "latest version counts" and by sub-decision 3. But it means that in steady state every hub load waits for the slowest of those relays, up to 8 s, before any hub mark resolves (U19: the local menu is found and the answer still waits about 8 s). The ADR's "in steady state round 2's local scan finds it" implies the outside reads are then saved, and they are not. *Optional:* correct that sentence, and add an OPEN row to measure the hub answer's time on staging (invariant 3: measure).
2. **ADR 0001 sub-decision 3, "Worst case" (`0001-…md:215`).** The real bound is about 24 s, not about 19 s. A probe measured 23.9 s: a 4.9 s scan, a 7.9 s Map read, a 3 s guard and an 8 s round 2. The round-1 lookups are local-first, so strfry's 5 s scan timeout runs in series before their 8 s outside read. Before this story the hub's worst case was about 13 s. *Optional:* state the real bound.
3. **`src/api/assistant/attention.js:342`.** The failure path calls `require('./dutyMenu')` again, the module whose check failed. If `dutyMenu.js` fails to load (rather than throwing inside the check), the fallback throws too, and the whole answer becomes a 500. A probe confirmed it: `status 500 {"success":false,"error":"Could not check assistant attention"}`. `OUTBOX_CHECK_FAILED` and `PROFILE_CHECK_FAILED` live in `attention.js` and don't have this problem. `trustedContentActions` (`:290`) has the same pattern, so this follows a house precedent. *Optional:* keep the constant in `attention.js`, or guard the require.
4. **`src/lib/duty-menu/index.js:36`.** The `/i` flag also folds the case of `concept-header`. So `39998:<hex>:CONCEPT-HEADER`, which is a different `d` and names no concept header, is refused (probe: `false`). The logged deviation covers only the hex. This is harmless over-refusal. *Optional:* use `/^39998:[0-9a-fA-F]{64}:concept-header$/`, or log it, and recheck when the § 6.1 edit lands.
5. **`src/lib/duty-menu/index.js:57-68`.** `isDutyMenu(event, author)` never compares `event.pubkey` with `author`; it relies on the caller's `mine` filter (`dutyMenu.js:195`). Probe: an event by another key whose `p` names A passes `isDutyMenu(e, A)`. That is correct here, but it is a trap for story 2 and the § 8.2 reader that the ADR says will reuse this function. *Optional:* also require `event.pubkey`, lower-cased, to equal `author`.
6. **`src/api/assistant/dutyMenu.js:74-79`.** The default `getCustomer` calls `CustomerManager#initialize()`, which creates `customers.json` if it is missing (`src/utils/customerManager.js:26-39`). `getUserClassification.js:54-55` and `middleware/auth.js:310-311` make the same calls, and on any instance with a signed-in non-Owner they run first, so nothing new is written in practice. Still, AC-6's "nothing stored" holds only because of those earlier calls; nothing in the check itself ensures it, and S1 cannot see this.
7. **`ui/src/pages/assistant/DutyMenu.jsx:125-126`.** A found menu with no rows leaves the published panel showing only its heading and mark. That is the 3(b) case, and also § 11's withdrawal. § Copy has no words for it, so it is not a defect of this story. *Optional:* give it a line in story 2's § Copy.
8. **`ui/src/pages/assistant/DutyMenu.jsx:70`.** For `check-failed`, the panel says "Could not check: this instance did not answer.", though the instance did answer (its check threw). This is logged and mirrors Outbox Relays.
9. **`src/api/assistant/attention.js:10, :48`.** "Three actions are checked" was stale before this diff; five checks now feed seven actions. "nothing is stored anywhere" is no longer true: `dutyMenu.js` keeps Nous' list in memory, as its own header says (`dutyMenu.js:25`). *Optional:* fix both lines.
10. **`test/assistant-relay-list-publish.test.js:580`.** The S3 exemption is a deny-list. It is sound today, but an allow-list (only `isPublicRelayHostWithin` from `relayListPublish`) would be tighter.
11. **`src/api/assistant/dutyMenu.js:182` (DNS rebinding).** The guard resolves with c-ares, and `readRelayEvents` resolves again when it connects. That is the gap in ledger `2026-09-20-nip05-guard-leaves-dns-rebinding-open`. This story widens its reach:
    - the read runs automatically on every hub load;
    - it reads relays named by the viewer's own Map and by an outside key's (Nous') 10002;
    - `ws://` is allowed, so TLS gives no backstop.

    The attacker gets nothing back but signed, filtered events. *Optional:* add this reader to the ledger row.
12. **`BIBLE.md:527`.** The row says Lists and Concepts are offered "at this instance's public relay". It leaves out the Concepts fallback to a DList relay and the guard and 50-relay cap on event-named relays. `openapi.yaml` has the fallback.
13. **The test plan:**
    - `:315-316` cite `7f9fdf92` and `6f9bd983`, which are not ancestors of HEAD. They were rebased to `b2477a93` and `2a4e63ab`.
    - `:158`'s "Not run here: this container has no node_modules" is no longer true; the browser spec now runs 12/12.

    Docs only.
14. **Duplicate reads per hub load.** The check reads the viewer's Map again (trusted content also reads it) and the Assistant's 10002 again (the outbox check also reads it). Both reads are local-first, so this matters only for the measurement in NB1.

### Harness friction *(each becomes an OPEN.md row, type `meta`)*
1. Phase artifacts record commit hashes that a later rebase orphans. Here the test plan cites `7f9fdf92` and `6f9bd983`, and the Implementer's gate ran on `d4cead14+dirty`. Nothing checks that a cited hash is reachable from the branch.
2. Committing per-phase failing tests to the shared `staging` line leaves the tip's gate red for every other book between that book's Phase 3 and Phase 4. Now `57fbb432` (assistant-shared-categories); earlier `d8cdb0fe` (this book), which the other book had to note as "known base reds". The gate verdict on the tip is ambiguous unless the reviewer runs on their own commit, as done here.

## Verdict
**PASS**

The diff meets AC-1 to AC-6 as amended and conforms to ADR 0001 with its two amendments. The gate is green, 5665 / 0 on `b5c732ed`, and the browser spec passes 12/12. The SSRF ordering is right: event-named relays are normalized, put through `outsideOnly`, capped at 50 and guarded before any connection, and round 1 reads configured relays only. The findings above are latency and documentation points, corner cases of the library's API, and one house-precedent isolation gap. None of them breaks a criterion or the ADR's decisions.

## On PASS (same commit)
- [ ] Story `**Status:**` flipped to `Done` in place. *Left to the main session, which commits this review and flips the status.*
- [ ] Completion detection: left to the main session. Story 2 (the publish button) is still to come, so the book's "One-click publish" bullet is open and the book is not complete.
