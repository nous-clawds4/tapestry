# Review: Story 5 — Update list shows what my assistant would do, built only from reads it could complete

**Reviewer:** Claude (independent reviewer subagent)
**Date:** 2026-09-13
**Diff:** `git diff 434b0ff0 6bd1a46d` (20 files). Every commit since ADR 0005 was accepted:
- `85fbdddf`, the tests;
- `a50e7f70`, the implementation;
- `498010d9`, docs;
- `68eefaff`, Amendment 2;
- `a1992ed2`, its tests;
- `733f0a49`, its implementation;
- `6bd1a46d`, docs.

Neither implementation commit touches a test file (`git show --name-only … -- test/` is empty for both).

- Story: `engineering-team/stories/curated-dlist-update/5-update-list-preview.md`
- ADR: `engineering-team/decisions/curated-dlist-update/0005-update-preview-and-honest-reads.md` (Amendments 1 and 2)
- Test plan: `engineering-team/stories/curated-dlist-update/5-update-list-preview.test-plan.md` (with § Amendment 2)
- Context: `engineering-team/epics/curated-dlist-update.md` (story 5's entry and its carry-forwards); ADR 0001 (the copy
  convention).

> **At a glance.** No blocking items. The code does what ADR 0005 says, with its two amendments. Every deviation is
> recorded, and each is a fair reading.
>
> What I checked beyond the suites:
> - the strict endpoint against real relays;
> - the UI build against the bundle the container serves;
> - the planner on cases the suite doesn't pin.
>
> All three agree with the ADR. The preview never proposes from a read it couldn't complete. I found no path, even
> through an incomplete read the code can't detect, that proposes a wrong deletion; the one residual path is the
> ADR's recorded debt (§ Things tests can't catch).
>
> Four non-blocking findings:
> - a slow rank provider now moves Simple Lists' scores (Non-blocking 1);
> - the new warnings reach two more Simple Lists pages (Non-blocking 2);
> - the fan-out on a large list (Non-blocking 3);
> - a note for story 6 on the header read (Non-blocking 4).

## Quality gates (run by reviewer, not trusted)

- [x] **The story's six suites**, each through its exported `run()` (the test plan's gate; OPEN.md row 310): **152
      passed, 0 failed**:
      - `curated-dlist-update-update-preview` 34/0
      - `curated-dlist-update-curation-method` 24/0
      - `my-curated-dlists-items` 23/0
      - `curated-dlist-update-read-only-curation` 13/0
      - `treasure-map-relay-presence` 35/0
      - `event-page-read-path` 23/0
- [x] **Every other suite whose source names a changed file** (found by grep over `test/`), through `run()`: **285
      passed, 0 failed**:
      - `community-reference-nostr-relay-stub` 4/0
      - `curated-dlist-update-pointer-switch` 12/0
      - `dlist-curation-map-entries` 14/0
      - `dlist-curation-panel` 18/0
      - `dlist-curation-tl-panel` 19/0
      - `dlist-curation-merge-preserve` 16/0
      - `live-feed-read-path` 37/0
      - `my-curated-dlists-headers` 16/0
      - `my-curated-dlists-page` 19/0
      - `note-surfaces-read-path` 28/0
      - `profile-content-card` 18/0
      - `publish-export-a-concept` 3/0
      - `tl-treasure-map-optin-publish` 23/0
      - `tl-treasure-map-panel` 18/0
      - `treasure-map-panel-summary` 18/0
      - `treasure-map-relay-sync` 22/0

      Together, 22 suites and 437 tests, with 0 failures. These cover the test plan's 20 neighbours.
      - Each suite's matching lines for publish or POST are regexes over source. None makes a write request.
      - `publish-export-a-concept` and `tl-treasure-map-optin-publish` are source-read suites.
- [x] **The tests fail without the change.** I ran the suites on `git archive` snapshots in the scratchpad.
      - At `85fbdddf`, the tests commit:
        - the new suite: 3 passed, 27 failed. Only U5, R1 and R2 pass;
        - `my-curated-dlists-items`: 22/1 (S3);
        - `curated-dlist-update-read-only-curation`: 12/1 (S4);
        - `curated-dlist-update-curation-method`: 24/0.
      - At `a1992ed2`, Amendment 2's tests: 31 passed, 3 failed (U11, S9, D3).

      Both match the test plan's § Verification exactly.
- [x] **Full `npm test`: not re-run.** The three recorded runs are in the story's § Deviations. I judged them
      sufficient, for four reasons:
      - `733f0a49` → `6bd1a46d` is docs-only (OPEN.md row 293 and the story's Deviations). So the recorded full run at
        `733f0a49` ran this story's final code.
      - Every suite that reads a changed file passes in my own run (above).
      - I corroborated the one red beyond the known set. That is `most-pinned-tag-index-publish`, alongside row 191's
        four and `summaries-element-count` L5. A read-only GET of `/api/profile-tags/index?sort=most-pinned&limit=200`
        returns 200 rows, and 183 of them are that suite's `mpt-` fixtures. That is row 293's diagnosis to the number.
      - A re-run would add two more fixtures to the shared stack (row 293; Harness friction 1).
- [x] **The strict endpoint, live and read-only.** I sent GETs through the running server. Its
      `src/api/_shared/relaySource.js` and `src/api/relay/fetchEvents.js` are byte-identical to `6bd1a46d`'s.
      - A refusing relay with `strict=1` answers `success: false` and "Could not read ws://127.0.0.1:9: Received
        network error or non-101 status code.".
      - The community relay answers `success: true`, with 2 events.
      - The two together answer `success: true`, with the refusing relay under `unreachable`.
      - Without `strict`, the refusing relay still answers `success: true` with no events (row 314, unchanged for the
        other callers).
- [x] **The UI build.** `vite build` (7.3.1) of `6bd1a46d` into the scratchpad produced `index-DQ3Z7m9F.js`. That is
      the bundle the container serves on `:7778` and through nginx. So the recorded local checks ran on this exact
      code.
      - The bundle carries "Nothing to propose", "Your list is up to date.", "Keep, flagged", "publishing isn…", "No
        follow list for the point of view" and "the votes on the community relay".
      - It carries `strict=1` three times: the two curation hooks and the rank read.
      - It carries no "Update list isn…".
- [x] **`npm run test:playwright`: not applicable.** The test plan has no Playwright half. I did not repeat the
      signed-in render: there is no NIP-07 signer in an automated browser. The orchestrator's fetch-stub checks are
      recorded, and the bundle hash above ties them to this code.
- [x] **`bash scripts/harness-lint.sh`** at `6bd1a46d`: clean (0 violations), apart from the standing WAIVED and INFO
      lines. With this review saved, it reports one violation, L1: the story's Status still reads `Approved`. That
      clears when the orchestrator flips it to `Done` (§ On PASS).
- [x] **Hygiene.**
      - `git diff --check 434b0ff0 6bd1a46d` is clean.
      - No added line has `console.*`, a 64-hex literal or `taPubkey`.
      - No changed UI file signs, POSTs or publishes (grep).
      - `package.json` is unchanged, so there is no new dependency.
- [x] _Lint and typecheck are not configured, so they were skipped. There is no build step beyond the UI's, checked
      above._

## Spec adherence
- [x] Every acceptance criterion has a passing test.
- [x] No criterion is silently dropped.
- [x] No behavior is added beyond the story. The two ratings pages' warnings are within AC-6's allowance
      (Non-blocking 2).

| AC | Tests (all passing) | My own check |
|---|---|---|
| AC-1 a preview on my own list, which writes nothing | S4, S6, S8; re-aims items S3, read-only S4 and R1, curation-method S8 | `UpdateListButton` (`ui/src/pages/grapevine/CuratedDListItems.jsx:117–130`) is enabled with `onClick={onToggle}` and `aria-expanded` on my own lists (`:126`). The read-only branch keeps story 3's button and words exactly (`:122–123`). `UpdatePreview.jsx` imports only `useTrust` and `useProfiles` (`:1–2`). Every read the preview adds is a GET. |
| AC-2 what the preview is based on | S5 | `UpdatePreview.jsx:52–58`: the method, with the Trusted List's d-tag or "no list chosen"; the point of view, by name and short pubkey; "Cutoff (≥)"; and the browser-only line. |
| AC-3 what it proposes | U6, U9, S5 | `updatePlan` (`ui/src/utils/treasureMap.js:953–985`) and the groups (`UpdatePreview.jsx:37–48`). My spot check through the real `candidateVerdicts` gave copy akita (2), skipped beagle (1), refresh corgi (3), delete dingo (0), one unchanged, and the upgrade. An empty shared list reaches `ready`, keeping each copy as "can't be found", and doesn't hang on "Checking…". |
| AC-4 a failed or incomplete read proposes nothing | V1–V4, F1–F5, S1, S2, U1–U4, U7, U8 | The live strict reads above. The header decides first (`treasureMap.js:922–923`), then the two lists (`:925–926`), then the verdicts (`:928–929`), then `ready`. Spot checks: a header problem blocks even with a pointer present, and an unknown state reads `checking`; one failed vote chunk of three fails the source; verdicts from a different read block, through the `undecided` guard (`:981`). |
| AC-5 the same verdicts as the panel | U5, U4, S6, S9, U10, U11, D3 | **First bullet.** The panel's candidates (`curatedItemRows`, `treasureMap.js:584–595`) and the planner's (`:957`) apply the same `q` rule. In my spot check through the real functions, the two candidate sets and every verdict are equal. U5 pins the per-item independence. **Second bullet, as Amendment 2 §3 meets it.** With candidates shown, every failed read that blocks the preview also makes the panel incomplete: my list through `panelIncomplete` (`CuratedDListItems.jsx:253`), the shared list through §6 or the both-sources branch (`:259`), and the votes or weights through `candidateVerdicts`. Header states and problems are not reads the panel depends on; the amendment accepts a complete panel beside a header-blocked preview. With candidates off, the panel shows no verdict at all. Turning candidates on reuses the same keyed reads, so it shows the same failure at once. |
| AC-6 nothing else moves | S2, R1, R2, D1, D2, S8 | Nothing is scheduled, and nothing is written onto the header. Simple Lists' weight values are unchanged in both new error cases: 0 for Follow List (`ui/src/hooks/useTrustWeights.js:53–62`), and null for an unsuccessful rank read, as before (`:119–128`). Only the warning is new. `trustError` gates no control (`DListItems.jsx:370` is its only render). See Non-blocking 1 and 2. |

## ADR adherence
- [x] The changed files match Implementation notes 1–9 one for one. Beyond them are only the tests, the test plan,
      the story, ADR 0005's amendments and OPEN.md rows 292–293.
- [x] Layering is respected:
  - a DI-by-parameter server reader beside the probe;
  - an injectable handler;
  - pure, dependency-injected util functions;
  - hooks keyed on content;
  - one items section feeding both verdict sets from one set of reads.
- [x] No new dependency.

**Section by section.**
- **§1.**
  - `readRelayEvents` (`src/api/_shared/relaySource.js:238`) keeps every validly signed event that matches.
  - A failed connection, an early close or no EOSE is `unreachable`.
  - The helpers comment counts four.
  - The strict branch reads each relay in parallel (`src/api/relay/fetchEvents.js:103–108`), merges the events by
    id, and answers the two shapes.
  - The nostr-tools requires moved into the non-strict path (`:110–113`).
- **§2.** Both curation hooks add `&strict=1`. `useCurationHeaders` and the other callers are untouched.
- **§3.** Chunks of 50 (`treasureMap.js:702`). A source fails when any of its chunks failed (`:732`). A relay chunk of
  5,000 or more votes is capped (`:720`).
- **§4.** `relayTruncated` (`:532`, `:550`), with its source note (`CuratedDListItems.jsx:146`).
- **§5.** Both errors, with the ADR's words (`useTrustWeights.js:61`, `:122`), and the rank read made strict (`:112`).
- **§6.** `candidateVerdicts`' `incomplete`, with §6's three phrases, through `listReadGaps` (`treasureMap.js:844`).
- **§7.** `updatePlan`, in Amendment 1's order, with the inputs and output named.
- **§8.**
  - The button; `previewOpen`; the shared read while candidates or the preview show (`CuratedDListItems.jsx:214`);
  - votes on every shared item (`:241`); two verdict sets (`:254–255`); the preview rendered (`:338`);
  - the detail page's `headerState` (`CuratedDListDetail.jsx:86–90`, `:136`).
- **§9.** Both superseded notes, and row 314.
- **Amendment 2.**
  - The panel's verdicts wait on `judging` (`CuratedDListItems.jsx:237`), carry my list's gaps (`:253`), and name a
    failed vote source as the votes (`treasureMap.js:799–800`).
  - ADR 0004's note says so.

**Deviations from the ADR, each with its reference.** All are recorded in the story's § Deviations. I found none
unrecorded, apart from the consequences in Non-blocking 1 and 2.

| # | Where | ADR says | Code does | My reading |
|---|---|---|---|---|
| D1 | `relaySource.js:268` | §1: no EOSE inside the budget is `unreachable` | opens the subscription with `eoseTimeout: queryTimeoutMs + 1000` | **Necessary, and verified.** In the container's nostr-tools 2.10.4, a subscription sends its own EOSE after `params.eoseTimeout \|\| relay.baseEoseTimeout` (4,400 ms: `lib/cjs/abstract-relay.js:183`, `:443`, `:455`). Without this, a silent relay would read as a complete, empty answer. The probe's same gap is filed as row 292. |
| D2 | `fetchEvents.js:34–47`, `:103` | §1: "the whole read is bounded by FETCH_TIMEOUT_MS" | bounds each relay's read by it, in parallel; also accepts `strict=true` | **Fair, and better.** In parallel, the whole read is bounded the same way. A slow relay becomes one entry under `unreachable`, and the others' answers are kept, which §1's "some unreachable → success: true" needs. A late reader still closes its own socket, and nostr-tools' 4.4 s connect timeout sits inside the 5 s `withTimeout`, so a timed-out connect leaves no socket behind. `strict=true` is harmless. |
| D3 | `treasureMap.js:703`, `:720` | §3: chunks, with no order given | sends the chunks in parallel; a relay's cap counts the events it returned, before filtering | **Fair.** Counting before filtering is the right side: the relay stopped at its limit whatever it returned. The load is Non-blocking 3. |
| D4 | `treasureMap.js:844–851` | §6–§7 name the phrases | one helper, `listReadGaps(record, what)`; the planner drops duplicate reasons | **Fair.** Amendment 2 then adopted the helper by name. |
| D5 | `treasureMap.js:780`, `:805–808` | §6 | `incomplete` ignores non-strings; with votes or weights failed, the reason is those reads alone | **Fair.** It is story 4's summary, and Amendment 2 §3 allows the panel and the preview to name different reads. |
| D6 | `treasureMap.js:855–866` | open | words for the header's states and problems | **Fair.** Each completes "couldn't check …". |
| D7 | `treasureMap.js:923`, `:963–964`, `:981` | not named | an unknown header state reads `checking`; an undecided item blocks; a copy whose `q` names neither address nor id is kept as not found; the first coordinate `q` and the first 64-hex `q` are used | **Fair; every case fails safe.** My spot checks: an unknown state reads `checking`, not `ready`. An address-only copy of a present original is read as edited, so it is offered as a refresh, which re-copies with a proper version `q`. |
| D8 | `treasureMap.js:960`, `:968`, `:973`, `:982–983` | §7: entries name their item | a copy's entries use the copy's own `name`; a not-found entry's `routeId` is its address, else its version; each group sorted by name | **Fair.** The name is what my list shows. |
| D9 | `UpdatePreview.jsx:37–48`, `:61` | §8: six groups, each with a count | shows only non-empty groups; `unchanged` isn't shown; the method lines repeat the panel's | **Fair.** §8 names six groups, and `unchanged` isn't one of them. The repeated lines are cosmetic. |
| D10 | `CuratedDListItems.jsx:241` | §8: votes for every shared item | reads them whenever candidates or the preview show | **As written.** It is what makes the two verdict sets one read. |
| D11 | `CuratedDListItems.jsx:237`, `:253`, `:259` | Amendment 2 §1 | waits on `judging`; `panelIncomplete`; the both-sources branch left as story 4's | **Fair under Amendment 2 §3.** The preview names both lists there. |

## Concept-graph integrity
- [x] The story's handles are in `kind:pubkey:slug` form (`39998:<TA>:list`, `39998:<TA>:tapestry-assistant`). The
      code builds none.
- [x] No firmware reinstall is needed: no concept definitions change (ADR § Consequences).
- [x] Not applicable: there is no concept work to orient through `/summaries`.

## Things tests can't catch
- [x] No secrets in committed files.
- [x] No leftover debug logging. The `console.log` lines in `useTrustWeights.js` predate this story.
- [x] No commented-out code.
- [x] **Error paths: can a read that is incomplete, without saying so, propose a wrong deletion?** I traced each such
      read through the planner. None proposes a wrong deletion, except the ADR's own recorded debt (the last case).
  - **A relay with a lower item cap than ours.** This is the ADR's recorded debt: it answers a capped read as complete.
    - It can hide originals. Their copies are then kept, flagged as not found, never deleted (`treasureMap.js:967–970`).
    - It can hide copies. Their originals then come back as "copy". In story 6, the re-copy lands on the same `copy-`
      address (ADR 0001 §4), so it replaces rather than duplicates.
  - **A delete needs both** the copy and its found, unedited original, with a decided verdict (`:971–978`).
  - **The one residual path** is silently capped votes on a relay whose cap is below 5,000. The ADR records it; the
    community relay advertises 10,000.
- [x] **Concurrency and races.**
  - **Votes.** `useItemVotes` answers only for the exact ids it read (`ui/src/hooks/useItemVotes.js:24–36`; the guard
    is `:36`).
  - **Lists.** `useListItems` clears on an empty key and re-reads by key. Opening the preview while candidates show
    reuses the same read.
  - **Weights.** Readiness is by own keys. In the Follow List branch, `setWeights` and `setError` run in the same
    async continuation, which React 19 batches (`useTrustWeights.js:57–62`). So no render shows ready weights without
    the error.
  - **The strict timer** is cleared in `finally` (`fetchEvents.js:44–46`).
- [x] **Security.** Strict mode adds no new outbound exposure.
  - `/api/relay/external` was already public, and already dialled any ws/wss URL.
  - `/api/relay/presence`, also public (`src/api/index.js:315–316`), already returns the connect errors.
  - The UI's relay URLs are the constant community relay or Treasure Map values, sent through `encodeURIComponent`.
- [x] **Moving the `ws` require.** The container runs Node 22.22.2, which has a native `WebSocket`. So the old
      module-level `globalThis.WebSocket` guard never fired, and the twelve server modules that use nostr-tools
      without setting it lose nothing.

**The four architecture invariants.**
- The plan is this viewer's, under this browser's method, point of view and cutoff, and the preview says so.
- Votes from anyone are kept; the strict reader drops only bad signatures and off-filter kinds and authors.
- Nothing new is stored.
- There is no graph write (principle 4).

## House rules check
- [x] The Concept Graph API's authority is respected (no concept work).
- [x] No new lint, typecheck or build tooling.
- [x] No TA pubkey literal (S8, and my grep of the added lines).

## Product-guide adherence *(when the story traces to a PRD)*
- [x] Not applicable. The book is an acceptance frame with no PRD, and there is no style or design guide to check.

## Findings

### Blocking
None.

### Non-blocking
1. **A slow rank provider now moves Simple Lists' scores** (`ui/src/hooks/useTrustWeights.js:112`, `:119–128`).
   - **Before.** The non-strict read gave each relay nostr-tools' default EOSE timeout: `abstract-pool.js:578` passes
     `eoseTimeout: params.maxWait`, which is unset, so the relay's own 4,400 ms applies. A rank provider slower than
     4.4 s therefore answered with whatever arrived, silently partial.
   - **Now.** The strict read waits 5 s for a real EOSE. A slower provider reads as failed: every weight is null, and
     the warning shows.
   - **So** ADR §5's "Scores don't move on either page" holds for the two cases it names, but not for this one.
   - **Why it doesn't block.** It moves in the honest direction the book's guardrail asks for, and strfry answers such a
     query in milliseconds.
   - **Ask:** record the qualifier, in ADR 0005's Consequences or in the book's audit.
2. **The two new warnings reach two more Simple Lists pages** (`ui/src/pages/lists/DListRatings.jsx:562`,
   `ui/src/pages/events/DListItemRatings.jsx:466`).
   - **What happens.** Both pages render `useTrustWeights`' `error`. So they now also say "No follow list for the point
     of view in this instance's strfry" and "Couldn't read the rank provider …". Their weights, and so their
     numbers, are unchanged.
   - **Why it doesn't block.** Both are Simple Lists routes (`ui/src/App.jsx:287`, `:303`, under "Simple Lists"). So
     AC-6's "Where its trust weights couldn't be read, it may now also say so" covers them.
   - **The gap.** Neither ADR 0005's facts nor the Deviations name these two callers.
   - **Ask:** list them in the book's audit.
3. **The fan-out on a large list** (`ui/src/utils/treasureMap.js:703`).
   - **What happens.** At the 500-item ceiling, one preview sends 10 vote chunks at once to each source. On the relay
     side each is a strict GET, and each opens a fresh websocket from the server to the community relay. On the local
     side each is a `strfry scan` process (`spawn`, `src/api/strfry/queries/scan.js:86`, so the event loop isn't
     blocked). With the two list reads and the rank read, that is about 13 connections at once.
   - **Why it doesn't block.** A relay that throttles connections per IP fails chunks, which reads as "couldn't
     check": safe. Today's list has two items, which is one chunk.
   - **Ask:** if large lists appear, send the chunks two or three at a time. Optionally, record the fan-out in ADR
     0005's Consequences.
4. **For story 6: the header read stays non-strict** (ADR §2; `CuratedDListDetail.jsx:57–59`, `:86–90`).
   - **What happens.** The preview's state, older-link line and shared list all come from `useCurationHeaders`.
     Here its failure modes are safe:
     - a header that isn't local and whose relay is unreachable reads as `missing`, which blocks;
     - only this instance holds the assistant's key, so a local copy of my own assistant's header can't be older
       than the relay's.
     At worst, a stale older-link read proposes an upgrade that is already done.
   - **Ask (story 6):** read the header strictly, or re-read it, before signing the upgrade. Story 6 acts on that
     read.

**The docs** are accurate.
- **The superseded notes.** ADR 0004 and `my-curated-dlists` ADR 0003 each have a Status parenthetical and a one-line
  note citing ADR 0005 by short name (D1, D3).
- **Row 280** says strict mode exists, which reads opt in, and which callers stay open.
- **Row 292's facts** match the container's library. **Row 293's diagnosis** matches the index page (183 of 200 rows).
- **The test plan's Verification numbers** are exactly what I reproduced.

### Harness friction *(anything the process itself got wrong this story — stale doc, wrong port/path, contradictory instruction; each becomes an OPEN.md row, type `meta`)*
1. **The Reviewer role's "Run `npm test`" now costs the shared stack something.**
   - **The conflict.** `engineering-team/roles/reviewer.md` (step 1) and workflow 5 require a full run every review.
     But each full run leaves two pinned fixture tags on the shared local stack (row 293). Those fixtures already fill
     183 of the tag index's 200 rows, and they made `most-pinned-tag-index-publish` fail.
   - **What happened instead.** Stories 4 and 5 both skipped the re-run on their brief's word, not by a rule.
   - **Candidate:** until row 293's teardown lands, let a review rest on two things:
     - a recorded full run at the same code, with a docs-only delta verified;
     - every suite that reads a changed file.

   CLAUDE.md's "bind-mounted, source edits are live" line is also still standing. The container shows only named
   volumes. It is already tracked as rows 198, 226 and 253, so this needs no new row.

## Verdict
**PASS**

**Why.**
- Every acceptance criterion has a passing test.
- I ran the gate myself: 22 suites and 437 tests, with 0 failures. The tests fail without the change, exactly as the
  test plan records.
- The implementation follows ADR 0005 and both amendments. Its eleven deviations are recorded, and each is a fair
  reading; the one that matters most (D1) I verified against the container's library.
- The endpoint behaves as specified against real relays.
- The UI bundle is byte-identical to the one the local checks ran on.
- The preview never proposes from a read it couldn't complete. Even the incomplete reads the code can't detect can't
  make it propose a wrong deletion, beyond the ADR's recorded debt.
- Nothing blocks. What remains is two records for the book's audit (Non-blocking 1 and 2), an optional throttle
  (Non-blocking 3), and one note for story 6 (Non-blocking 4).

## On PASS (same commit)
- [ ] Story `**Status:**` flipped to `Done` in place. Left to the orchestrator: this run's brief reserves the status
      flip, the review link and the commit.
- [ ] Completion detection is reported in the chat, not in this file.
