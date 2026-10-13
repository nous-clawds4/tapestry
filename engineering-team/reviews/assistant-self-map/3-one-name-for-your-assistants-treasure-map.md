# Review: Story 3 — One name for your Assistant's Treasure Map

**Reviewer:** Claude (acting as Reviewer), with a second, independent reader (no write access to the repo, no
`npm test`; nothing written under `/var/lib/brainstorm`, which still holds only `customers/`). I reproduced the
reader's findings before recording them, by my own script or by rerunning its check.
**Date:** 2026-10-13
**Diff:** `git diff 8650d48 121ae0f`:
- `1bf674c`: the Tester's work. The shared fixture is re-aimed to § Copy; N1–N6 are new; and there is the test plan.
- `121ae0f`: the Implementer's work. Words in `assistantTreasureMapCopy.js`, `actions.js` and `selfMapPublish.js`, the
  comments pointing to story 3's § Copy, and an occurrence on ledger row `2026-10-13-duties-tab-b8-reads-row-early`.

Reviewed at `7d1f0fc`, which merges `origin/staging` at `b619550`: documents only, another book's story
(`about-this-instance` #1), touching nothing here.

There is no ADR: the owner skipped Architecture at the Planning gate, because § Copy names every line.

## Quality gates (run by reviewer, not trusted)

- [x] **`npm test`** on `7d1f0fc`, a clean tree, on a quiet machine (load average 0.00). `npm run gate:status`:

  > `20261013T214701Z-8415-2b43 [s3-review] started 2026-10-13T21:47:01.378Z on 7d1f0fc1 — PASS, exit 0, 5991 passed, 0 failed, 582 skipped, 308/308 suites`
- [x] **Playwright, chromium.** I built `ui/` at `7d1f0fc` and served it with `vite preview` on :4184, then stopped it
  by its pid (the port then freed). I ran `assistant-self-map` and the nine hub specs: **120 passed, 1 failed, 5
  skipped**, 5.7 m.
  - The failure is `assistant-duties-settings` B8, the known flake on ledger row
    `2026-10-13-duties-tab-b8-reads-row-early`, with the same reading ("wss://typed.example" not yet in the row).
    Story 3 changes nothing under `ui/src/pages/settings`.
  - In the Implementation's checks the spec failed B8 once in eight solo runs on story 3's build, so it isn't only
    load. This occurrence is on the row (harness friction below).
  - Every self-Map test passed, N6 included.
- [x] `bash scripts/harness-lint.sh`: **clean**.
- [x] **Shared lines.** `origin/staging` moved to `b619550` (documents only) and is merged as `7d1f0fc`.
- [x] _Lint, typecheck, build: not configured — skipped._

## Spec adherence

| Criterion | Evidence | Result |
|---|---|---|
| **AC-1**, the page says § Copy's words | The reader parsed § Copy's page table and compared both columns, mechanically, with the copy module at `8650d48` and `121ae0f`, the Owner's line called with a count: **21/21 rows, Now and New, 0 mismatches**. P1, P2, P4, Q1 and Q2 compare through the re-aimed fixture. N1 and N2 find no "self-Map" in the words or the page's code. N6 finds none on screen in ten states, after a Turn off's report, or on the hub. | Met |
| **AC-2**, the press says § Copy's words | The same comparison of the press table with `selfMapPublish.js`: **5/5 rows**. The subject was also run through the shared summary and local-failure sentences ("Your Assistant's Treasure Map was saved on this instance's relay and accepted by 1 of 2 relays. …"). P1, P2, E3, E4, E7, C2, W6 and W7 compare with `!==`, and N4 checks thirteen kinds of press answer. | Met |
| **AC-3**, the hub says § Copy's words | The hub table: **1/1 row**. C1 checks it, as do the hub's own suites (management page D4, duty cards C3, through `dutyCardsFixtures.js`). N5 finds no "self-Map" in anything the hub module exports. No screen shows this card's criteria line (only the generic action page shows criteria, and this card has its own page), so it is pinned in the module, as the test plan says. | Met |
| **AC-4**, only words change | Masking every string literal and comment, all three changed source files are identical before and after (my scan). The reader's token check agrees: non-string tokens identical in each file, and every changed token is a value, never a key. N3 confirms the copy module keeps all 49 key paths and its 6 exports. Every test of states, buttons, requests and answers passes unchanged apart from the words it reads. | Met |

- [x] Every acceptance criterion has a passing test.
- [x] No criterion is silently dropped.
- [x] No behaviour added: only words and comments changed.

**Completeness.** The reader swept `ui/src` and every server message that reaches the page. The "self-Map" left is
in:
- comments, identifiers, ids and classNames;
- the route string and log lines;
- an internal error that the press logs but never returns (it answers "This instance did not answer; nothing was
  published.");
- `routeAccess.js`'s `why` record, which is never served.

All of these are under the hood, as § Out of scope allows.

## ADR adherence

- [x] **No ADR.** The path the owner confirmed was Planning, Test Design, Implementation, Review. The changed files
  are exactly the three that hold § Copy's lines.
- [x] No new dependencies.

## Concept-graph integrity

- [x] No concept, event shape or tag changes. No firmware reinstall needed.

## Things tests can't catch

- [x] No secrets, no debug logging, no commented-out code.
- [x] **Truth of the new lines.** The reader checked each against the code paths, and I checked the ones below:
  - `status.notPublished` shows only when something listable is live and nothing is listed;
  - the state lines track the remembered choice;
  - the Owner's note matches what the press replaces (only the entries naming the Assistant).

  The exceptions are S3-N1 to S3-N3 below, all wording.

## House rules check

- [x] No new tooling. The TA pubkey is not involved.

## Findings

### Blocking

None.

### Non-blocking

All five are on ledger row `2026-10-13-treasure-map-wording-followups`. S3-N1 to S3-N3 are wording questions for the
owner, likely settled with the next change on what on and off mean. Each is a judgement about approved wording, not a
deviation from § Copy.

1. **S3-N1 — the "should" panel for the Owner** (`ui/src/pages/assistant/AssistantTreasureMap.jsx:233–235`).
   - Under the new heading "What your Assistant's Treasure Map should list", the unchanged explainer "Only the duties
     that are live now, each at the relay where it is published." reads as "the map should hold only live duties".
   - For the Owner, the map also holds this instance's entries naming other Assistants, and keeps them. Under the old
     heading it was true.
   - The published panel's heading has the same shape, but the Owner's line beneath it names the other entries.
2. **S3-N2 — "None is live yet" against a live line.**
   - When the Assistant Duties list offers `39998` without `39999`, a bare `39998` duty is live but can't be listed:
     the key also covers `39999`.
   - **Reproduced** by me with `evaluateSelfMap`: offer `39998` only gives `shouldSay []`, current true, and the line
     `["39998","offered","live-unclaimed"]`, which reads "Live, but your Assistant's Treasure Map doesn't list it yet."
   - A Turn on then answers "…None is live yet, so nothing was published.", which contradicts that line. The old words
     ("Nothing is live to claim yet") held.
   - The line's own "yet", for a duty that can never be listed, predates story 3.
3. **S3-N3 — the on and off lines.**
   - While on, "Remove your Assistant's duties from its Treasure Map" shows even when nothing is listed or no map
     exists. Pressed then, it only turns the setting off.
   - "…is set to list its live duties" can read as automatic, which only story 4's upkeep makes true.
4. **S3-N4 — two lines no Node test pins word for word.**
   - The Owner's line's new ending ("not your Assistant's own duties") is pinned only by browser B5, and the page's
     own report subject (`press.subject`) by no test. That subject appears in the report's fallback lines, e.g.
     `"Your Assistant's Treasure Map" was not published.`
   - **Reproduced:** rewording both still passes the page suite (22/0).
   - The fix is an equality check in P1 or Q1.
5. **S3-N5 — records.**
   - `src/api/assistant/selfMapPublish.js:12` and `:133` still call the upkeep "story 3's automation"; it is now
     story 4.
   - The test plan calls P1 "word for word": it checks presence, and only the Owner's line's lead. Its "AC-1, on
     screen" row omits B5, B7, B9 and B11.
   - AC-3 speaks of the card showing its criteria; no screen shows them for this card.

**Older, unchanged by story 3** (observations):
- A duty listed at the wrong relay gets both "Live, but … doesn't list it yet." and "… lists this, but it isn't
  live." The one-verb rule now makes the contradiction word for word; it was there before.
- `ownerLine(1)` reads "Its 1 other entries".
- Over HTTP, a signed-out press gets the session middleware's "Sign in to do this." before the route's own refusal.

### Harness friction

- **B8 of `assistant-duties-settings` failed in both combined browser runs on story 3's builds** (the Implementation's
  and this review's), and once alone. Story 2's last three combined runs passed it.
  - Story 3 adds N6, a long test of eleven page loads, and the runner uses two workers in parallel. So it plausibly
    adds load beside B8.
  - The fix is still B8's own wait (the row's Fix shape). Both occurrences are on row
    `2026-10-13-duties-tab-b8-reads-row-early`.

## Verdict

**PASS**

Story 3 does exactly what its § Copy says.
- Every one of the 27 approved lines is in the code word for word, and the old words matched before.
- Nothing a person can see says "self-Map".
- Only string contents and comments changed: the code with them masked is identical.
- The gate passes (5991 / 0). The browser specs pass apart from B8's known flake (120 / 1 / 5 skipped).

The non-blocking points are wording questions for the owner (S3-N1 to S3-N3) and small test and record fixes (S3-N4,
S3-N5), all on one ledger row.

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place, and its `- Review:` link points here.
- [x] Completion detection: the book is not complete (the chat has the reckoning). `/close-book` is not offered.
