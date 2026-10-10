# Build Audit: Relay stream gaps — router streams that keep what they're meant to bring, and a scheduled catch-up

**Book:** `engineering-team/audits/relay-stream-gaps/book.md`
**Date:** 2026-10-10
**Branch / commit range:** `3eb333fe..4aa2a6fb` on `staging`, from the commit before the first book commit (`005facff`, story 1's draft) to the merge of PR #834. Other books' work interleaves in that range. The book's work reached `staging` in five ways:
- **Direct docs commits on `staging`:** `005facff`–`9c977c2e`. These are stories 1–2 (drafted and approved) and ADRs 0001–0002 (proposed, then accepted).
- **PR #787** (`ff3d4e6c`, deploy #543): a router-hardening fix from 2026-09-30 that the book built on. Its provenance is a ledger row, not a story (§4, Undocumented work).
- **PR #826** (`49427c29`, deploy #544): stories 1 and 2.
- **PR #831** (`4487a3f0`, deploy #551): story 3.
- **PR #834** (`4aa2a6fb`, deploy #554): the staging verification record, ADR 0003 wording fixes and four ledger rows.

**Commits and deploys:**
- **Commits.** 33 non-merge commits name the book: 4 `story`, 7 `adr` plus 2 `docs(adr)`, 8 `test`, 3 `impl` plus 1 `feat` and 1 `fix`, 5 `review`, and 2 `docs`. `harness-stats` counts 27 phase commits for the epic.
- **Merge resolutions.** None changed the book's code. The book's files are identical between each branch's last commit before its PR merged and the merged tree: `36600afd` against `49427c29` for stories 1–2, and `8dab8bc6` against `4487a3f0` for story 3.
- **After the PASS, before the PR.** Stories 1–2 gained two commits with no further review round, both sweeping that round's non-blocking findings: `1fdef447` (two additive tests, R2-5) and `36600afd` (comments, docs and ledger rows; its message records gate `20261009T045855Z-7286-5d26` PASS).
- **Staging: deployed and verified** (§5, and `book.md` § Staging verification).
- **Production: stories 1–2 only.**
  - **How they got there.** PR #829 promoted `staging` to `main` at 20:13Z on 2026-10-09, carrying #787 and #826. `deploy-tapestry` run #140 succeeded; production's router has been up since about 20:23Z.
  - **Before their staging check finished.** At that point bullet 1 had not been checked live, and bullet 2 was still at limit 5 (§4 #11).
  - **Its limits.** Production's saved stream limits are 5, 0 or none (read from `GET /api/strfry/router-status` on 2026-10-10), so the patched router refetches at most 5 per connect there.
  - **Not promoted:** story 3 (#831, merged to `staging` 41 minutes after #829) and #834.

**Provenance:** Acceptance-frame. There is no PRD. The operator's ask was restated at kickoff on 2026-10-09 as four bullets and confirmed by the operator the same day (`book.md`).

**Confidence:** **high** for what the code does, **medium** for the frame as it plays out on staging, **none** for production: stories 1–2 run there unverified, and story 3 isn't there.
- **Code.** Every story passed review by a fresh reviewer: story 1 in two rounds, story 2 in one, story 3 in two. Each strfry 1.1.0 behaviour the ADRs rely on was run in a sandbox build of the real binary, not assumed:
  - an in-place reload, and that a replaced file ends reloads;
  - a rejected config, half-applied;
  - a configured limit honoured on connect;
  - `strfry sync` output, and how a relay refuses negentropy.

  The merged story-3 head's full gate passed (§5).
- **Staging, observed:**
  - the router was not restarted by stream changes (uptime);
  - with limits at 500, WoT lost nothing across three deploys;
  - the kind-0 events lost before `userProfiles` had a limit came back when it reconnected with one.
- **Staging, inferred:**
  - that the *other* streams stayed connected during a change. This follows from the uptime plus the sandbox's per-stream reconnect (ADR 0001 Verified evidence 1). No per-stream log was read on staging.
  - AC-5's catch-up. Staging went from lacking 3 of 392 dcosl concept headers to holding all 393 after two scheduled runs, but the productive run's count was overwritten by the next run.
  - That `userProfiles` at limit 500 survives a deploy. It was seen only on a reconnect, not across a deploy.
- **Unknown:** why the WoT stream connected 1.5–3.5 minutes after the container started at deploys #544–#546. The router's log was never read (OPEN.md row `2026-10-10-router-boots-with-empty-streams`).

> The Build Audit is the as-built record. It does not propose changes — that is `prd-seed.md`'s job.

## 1. What shipped

- **Changing streams no longer knocks out the others.** On the Router Management tab (`/tapestry/settings/relays`), turning a stream on or off, saving streams (add, edit, delete, import a preset) and Restore Defaults now rewrite `/etc/strfry-router-tapestry.config` **in place**. strfry 1.1.0's router reloads the file and reconnects only the streams whose direction, filter or relays changed. — `stories/done/relay-stream-gaps/1-stream-changes-without-router-restart.md`
  - **Success means the router took the change.** It is reported only after the router's log shows the reload: a `Loading router config file` line with no `Failed to parse router config` after it.
  - **A change strfry rejects is rolled back and reported** with strfry's reason. The rollback's own reload is confirmed before the next change may run. Changes are serialized.
  - **The router still restarts as a fallback,** and the response says so. That happens when the router isn't running, when no reload is logged within 3 s, or when the rollback is itself rejected. The Restart button still restarts it on demand.
- **A stream's Limit now does what it says.** The image's strfry is patched (`patches/strfry-router/apply-patches.sh`, one line in `connOpen`) to send a stream's configured `limit` instead of 0. So on every connect, a download or both-direction stream gets up to N of each relay's newest matching events, then streams live. A blank or 0 limit stays live only. — `stories/done/relay-stream-gaps/2-stream-limit-refetches-on-reconnect.md`
  - New streams and every shipped preset default to 500, `treasureMaps` included. strfry relays cap a request at 500.
  - The editor's field reads **Limit (fetched on connect)** and explains itself. A stream's card says `(fetches up to N on connect)` or `(live only: nothing fetched on connect)`.
  - A negative limit is dropped when a stream is saved.
  - Streams already saved on an instance keep their limits until the operator raises them (product decision 2).
- **Saved negentropy-sync presets, run on a schedule.** On the Negentropy Sync tab, the operator can save the form (relay, direction, kinds, authors, tag filters) as a named preset. — `stories/done/relay-stream-gaps/3-scheduled-negentropy-sync-presets.md`
  - **The tab.** Each preset is listed with an on/off switch, **Load** and **Delete**, and its last run: when, ✓ with the events in and out, ✗ with the reason, or skipped.
  - **The checks.** A preset must narrow what it syncs (kinds, authors or a tag filter), and the server checks values strfry would reject.
  - **The task.** A new Scheduled Task, **Sync Negentropy Presets**, runs every switched-on preset one at a time, in the one-shot sync's slot.
  - **The window.** Each run covers events since that preset's last successful run less an hour, or the last 7 days on a first run.
  - **Refusals.** A relay that refuses negentropy is stopped about a minute after its notice and named in its own words.
  - **Mid-run changes.** A preset switched off or deleted before its turn isn't synced.
  - **Shipping state.** The task ships switched off. A fresh install gets a disabled entry at 6 hours; an existing instance adds it from the Add dialog, which pre-fills 6 hours.
- **The contracts are written down.** BIBLE §14 (in-place reload, the three restart fallbacks, the Limit) and the API table (five preset endpoints); `docs/CONFIGURATION.md` (the reload and the presets file); OPERATIONS.md ("What a deploy does"); `docs/TAG_FEDERATION_OPS.md` (`tagDeletions` at limit 500, and what a stream can still miss).

## 2. Epics & stories rolled up

### Epic: `relay-stream-gaps` (Done at this close)
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 stream-changes-without-router-restart | In-place reload confirmed from the router's log; rollback confirmed; serialized changes; restart only as a reported fallback | Done | `reviews/done/relay-stream-gaps/1-stream-changes-without-router-restart.md`: round 1 asked for two changes (an unconfirmed rollback could let a queued change report false success; operator docs contradicted the code). The fixes went through ADR 0001 Amendment 1. Round 2 PASS (gate `20261009T044542Z-29808-8d09`) |
| #2 stream-limit-refetches-on-reconnect | strfry router patch, Dockerfile wiring, presets at 500, editor wording, negative limit dropped | Done | `reviews/done/relay-stream-gaps/2-stream-limit-refetches-on-reconnect.md`: PASS in one round (gate `20261009T043710Z-1434-7dcc`) |
| #3 scheduled-negentropy-sync-presets | Presets store, validation, runner and task script; registry task with a 6-hour timeout; seed; Add-dialog pre-fill; the tab's presets UI | Done | `reviews/done/relay-stream-gaps/3-scheduled-negentropy-sync-presets.md`: PASS with eight non-blocking findings. The owner chose to fix two before the PR, through ADR 0003 Amendment 2. Round 2 PASS (gate `20261009T203009Z-5726-d2a7`) |

**Epic close-out at this close.** All three stories are Done and on the shared line (`staging`), so step 9 applies as written. The epic reads Done. Its story, ADR and review folders moved under `done/relay-stream-gaps/` (one `git mv` per area). The eight ledger rows that pointed into those folders now point at `done/` paths. Production is not a condition of step 9; its state is in the header and §6 #1.

## 3. As-built inventory

Derived from what PRs #826 and #831 brought into `staging`:
- `git diff 49427c29^1 49427c29`: 27 files. Code is 6 files (+322 −77); tests are 6 files (+1329 −9).
- `git diff 4487a3f0^1 4487a3f0`: 23 files. Code is 9 files (+869 −3); tests are 2 files (+2112).

- **User-facing.**
  - **Router Management tab** (`ui/src/pages/settings/RelaySettings.jsx`). The Limit field's label and hint; `DEFAULT_STREAM_LIMIT = 500` for new streams; the card wording; the delete confirm no longer says it restarts the router.
  - **Negentropy Sync tab** (same file). **Save as preset** with a name; the inline floor message; **Saved presets** rows with a switch, Load, Delete and a last-run line; the explainer; and `Scheduled preset "<name>" is syncing…` while a scheduled run holds the slot. The tab polls `/status` every 5 s only then.
  - **Scheduled Tasks Add dialog** (`ui/src/pages/settings/scheduledTasks/AddOrEditEntryModal.jsx`). It pre-fills a task's `suggestedIntervalHours` for a new entry.
- **Server.**
  - **`src/api/strfry/routerConfig.js`.**
    - New: `classifyReloadLog`, `readLogSince`, `waitForReload` and `RouterRejectedError`.
    - `applyConfig(state, prev)` resolves `applied: 'reloaded' | 'restarted'`. `withRouterLock` serializes the mutating handlers.
    - Constants pinned to strfry 1.1.0's log strings and `/var/log/supervisor/strfry-router-error.log`.
    - `sanitizeStreamFilter` drops a negative `limit`, and the module exports `requireOwnerOrLocal`.
  - **`src/api/strfry/routerStatus.js`.** `getRouterProcessStatus()`.
  - **`src/api/strfry/negentropySync.js`.**
    - `isSyncActive()`, `runStrfrySync(relay, dir, filter, { timeoutMs, stallMs, presetName })` and `relayMessageOf(line)`.
    - `/status` reports `source: 'preset'` and `presetName`. The one-shot handlers are unchanged.
  - **`src/api/strfry/negentropyPresets.js` (new).**
    - Store and lock; `validatePreset`, `windowSince`, `parseSyncOutput` and `runEnabledPresets`.
    - `RELAY_STALL_MS` (60 s), and the routes.
  - **`src/manage/negentropySync/syncPresets.sh` (new).** A loopback `curl -m 21600`, structured task events, and exit 1 when any preset failed.
  - **`src/manage/taskQueue/taskRegistry.json`.** The `syncNegentropyPresets` task, with a 6-hour `forceKill` timeout (ADR 0003 Amendment 1) and `suggestedIntervalHours: 6`, and its log file.
  - **`src/api/scheduled-tasks/index.js`.** The `seed:syncNegentropyPresets` fresh-install seed (disabled), and `suggestedIntervalHours` passed through.
  - **`src/api/index.js`.** `registerNegentropyPresetRoutes`.
- **Image.** `patches/strfry-router/apply-patches.sh` (new; sed plus a fail-loud grep, idempotent). `Dockerfile` copies it and runs it after the Redis patches, before `make`; the `STRFRY_REF` comment names both patch directories. `setup/router-presets.json`: every preset's `limit` is 500.
- **Domain.** No concept, handle or schema changed, and no firmware reinstall is needed (each ADR's "Firmware reinstall required? No"). The relays are plain URL strings; no TA pubkey literal was added.
- **Data & contracts.**
  - **New file** `/var/lib/brainstorm/negentropy-presets.json` on the `tapestry-data` volume (`NEGENTROPY_PRESETS_PATH` overrides it): `{ version: 1, presets: [{ id, name, relay, dir, filter, enabled, createdAt, updatedAt, lastRun?, lastSuccessAt? }] }`. It is written by temp file and rename.
  - **New routes:**
    - `GET /api/strfry/negentropy-presets`, readable by anyone who can reach the API;
    - `POST` on the same path, plus `…/toggle`, `…/delete` and `…/run`, which are owner or loopback only.
  - **Router responses** gain `applied`, and a rejected change answers HTTP 500 with strfry's reason.
  - **The router config file** is only ever rewritten in place (ADR 0001 invariant).
  - **No new event kind.**
- **Tests.**
  - New: `test/router-config-reload-in-place.test.js` (41), `test/router-stream-limit-on-connect.test.js` (26, with a fixture of strfry 1.1.0's `connOpen`) and `test/negentropy-sync-presets.test.js` (95).
  - Re-aimed: `router-stream-tag-filters` R1 and S3, and `strfry-router-saved-state` P, V2 and V6.
  - Counts are from the merged gate `20261009T204409Z-15557-f7a7`.
- **Harness.**
  - The book, epic, three stories, three test plans, three ADRs (0001 with one amendment, 0003 with two) and three reviews (five rounds).
  - Fourteen ledger rows: nine opened by the book before this close, five at it.
  - Dated updates to rows `2026-09-27-strfry-redis-never-reconnects`, `2026-09-27-revokes-do-not-travel`, `2026-10-10-ten-minute-schedule-blocks-merges` and `2026-10-10-router-boots-with-empty-streams`.
  - Recurrence notes on OPEN.md rows 316 and 310, and a note on row 25 (the dcosl presets at limit 500).

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame bullet 2: "on every (re)connect, a stream fetches up to its limit of the newest matching events … so short gaps refill themselves" | It does, but only for streams whose saved limit has been raised. Saved streams are not migrated. Staging's 13 streams were raised to 500 by the owner (complete by about 02:22Z, 2026-10-10). Production's are 5, 0 (WoT) or none (`userProfiles`, `treasureMaps`) | intentional-change | Story 2 product decision 2: "Streams already saved on each instance are not changed" | On any instance, nothing improves until the operator raises the limits | §6 #1 |
| 2 | Frame bullet 2: "short gaps refill themselves" | They do. But every deploy's hole is wider than it needs to be: the router boots with an empty `streams {}` until the control panel's `initRouter()` runs, and at three deploys WoT connected 1.5–3.5 minutes late, for an unknown reason | constraint-discovered | Staging verification (`book.md`); `docker/entrypoint.sh:242–261`; OPEN.md row `2026-10-10-router-boots-with-empty-streams` | At limit 500, no WoT loss was seen at staging's rates. At limit 5 it lost 1–2 events per deploy | §6 #3 |
| 3 | Frame bullet 1: changes "no longer interrupt the other streams" | True for accepted changes. A change strfry rejects can be half-applied: groups are configured in name order. The rollback's reload then reconnects streams. If the rollback is itself rejected, the restart fails too, and the advice "Press Restart" can't help | constraint-discovered | ADR 0001 Amendment 1 and Verified evidence 5; review 1 round 2, R2-1 | Rare. It needs a saved value that strfry rejects, and those pass the save checks today | §6 #4 |
| 4 | Frame bullet 3: "Each preset can be switched on or off, and the enabled ones run on a schedule" | One shared task and schedule. It ships off, and existing instances get no seeded entry: the operator adds it from the Add dialog | intentional-change | Story 3 product decision 2 and § Out of scope (no per-preset schedules); ADR 0003 Option B rejected | An operator has to add the task and switch it on once | §6 #2, #12 |
| 5 | Frame bullet 3: content the router missed "then arrives without anyone running a sync by hand" | Within a window: since the preset's last success less an hour (7 days on a first run), by `created_at`. Events backdated before the window are never fetched. A preset must name kinds, authors or a tag filter | interpretation | Story 3 product decisions 1 and 3; ADR 0003 § Consequences ("Backdated events can still slip by"); OPEN.md row 25 (the 1.3M junk events an unfiltered dcosl sync would bring) | A backdated event needs Load + Start, the one-off full sync | §6 #11 |
| 6 | Story 3 AC-4: the tab shows "how many events it brought in" | Only the latest run is kept. On staging the catch-up's run (3 headers in) was replaced ten minutes later by `✓ 0 in, 0 out` | constraint-discovered | Staging AC-5 check; OPEN.md row `2026-10-10-presets-keep-last-productive-run` | The operator can't tell "nothing was missing" from "the catch-up worked" | §6 #6 |
| 7 | ADR 0003 § Consequences: "The task fails in the panel's history when any preset failed" | The script reports failure correctly, but the Scheduled Tasks history shows every script task's run as a success. That bug predates the book | constraint-discovered | Review 3 round 1, non-blocking 2; OPEN.md row `2026-10-09-task-history-misses-script-failures` | Judge a presets run by each preset's last-run line, not by the history | §6 #5 |
| 8 | Story 3 AC-4: "why it failed (e.g. the relay doesn't support negentropy …)" | After review: stopped about 60 s after a relay's NOTICE or CLOSED, and named in its words. Still not covered: a relay that ignores `NEG-OPEN` costs 10 minutes and reads as a timeout. The one-shot Start has no stall rule. A relay's notice text reaches the log raw and can inflate the counts | deferred | ADR 0003 Amendment 2 ("Not changed"); review 3 round 2, R2-1 and R2-2; OPEN.md rows `2026-10-10-negentropy-silent-or-refusing-relays` and `2026-10-09-presets-relay-text-handling` | A silent relay holds the slot for 10 minutes per run. A hostile relay could forge a line in the owner's own log | §6 #7, #8 |
| 9 | ADR 0003 (as accepted): the presets list is "readable by any signed-in user" | It is readable by anyone who can reach the API, as the router config and the sync status already are. The ADR was corrected at #834 | interpretation | Review 3 round 1, finding 5 | Relay URLs, filters and last-run errors are public. A relay URL with a token in its query string would be exposed | — |
| 10 | Story 2 AC-4: "A blank or 0 limit is shown as 'live only'" | It is, in the hint and on the card. But a blank field shows a grey "500" placeholder, which the ADR mandated | interpretation | Review 2, non-blocking 4 | Someone skimming may read 500 as the value that applies | §6 #13 |
| 11 | Frame bullet 4: "Each of the above is verified on staging before production" | All three are now verified on staging: bullets 1–2 observed, bullet 3 inferred (§5). But stories 1–2 reached production first. PR #829 (staging → `main`, 20:13Z 2026-10-09) carried #826 about six hours before bullets 1–2 were checked on staging (2026-10-10, about 02:05–02:33Z). Story 3 is not promoted | interpretation | The owner chose a full promotion (PR #829's body lists "Book `relay-stream-gaps` (#826; stories 1–2 reviewed PASS; book still Open)"). Whether that was meant to waive this bullet for stories 1–2 is not recorded | Production ran the in-place reload and the limit patch before they were seen working live. Nothing has been observed going wrong there; nothing has been observed at all | §6 #1 |

**Undocumented work.** The book's own diff has none. Every file in PRs #826, #831 and #834 traces to a story, an ADR or amendment, a test plan, or a review finding swept in a named commit. Examples of the last two: `docs/TAG_FEDERATION_OPS.md` and the row-25 note come from the review 2 sweep `36600afd`, and the `requireOwnerOrLocal` export from test plan choice 1. One piece of code in the book's sequence has no story, ADR or review:
- **PR #787** — `src/api/strfry/routerConfig.js` and docs, +689 −62, no story/ADR provenance and no review. It is router hardening written on 2026-09-30 against ledger row `2026-09-30-router-saved-state-revalidation`. It was merged into `staging` on 2026-10-09 (`ff3d4e6c`) as the base the book built on.
  - No review file covers it, and the PR has no GitHub review.
  - Story 1's review states it was not reviewed. That reviewer did run #787's own tests after story 1's test plan re-aimed them.
  - Its code has since passed every gate the book ran.
  - Recorded as a process finding (§7, OPEN.md row `2026-10-10-ledger-fix-pr-merged-unreviewed`).

**Per-instance state changed during verification** (operational, not in any diff):
- Staging's 13 streams raised to limit 500 by the owner.
- One preset, `dcosl headers` (`wss://dcosl.brainstorm.world`, down, kind 39998), switched on.
- A **Sync negentropy presets** entry on a 10-minute test interval. At 02:42Z on 2026-10-10 that entry read `enabled: false`, still at 10 minutes, last run 02:02:58Z (§6 #2).

## 5. Quality state at close

- **`npm test` at close,** after the book flip, the epic close-out and this close's ledger rows, over the tree this close leaves behind:
  `20261010T025301Z-26650-f183 [book-close-relay-stream-gaps-final] started 2026-10-10T02:53:01.240Z on 61ed3fa5+dirty — PASS, exit 0, 5510 passed, 0 failed, 591 skipped, 290/290 suites`
  - `+dirty` is this close, uncommitted, on `61ed3fa5` (the current `staging`). The book's three suites pass: 41/0, 26/0 and 95/0. No stack ran this session, so the live suites skipped.
  - An earlier run over a mid-close tree (`20261010T025015Z-30269-a442`) was stopped by hand at 225/290 suites when further edits followed. It is not a result.
  - `bash scripts/harness-lint.sh` is clean over the closed tree, with the book Closed, the epic Done and its folders under `done/` (L2 satisfied).
- **The book's gates.**
  - **Merged story-3 head** (`f851e0d7`, story 3 with staging merged in):
    `20261009T204409Z-15557-f7a7 [rsg3-merged] started 2026-10-09T20:44:09.680Z on f851e0d7 — PASS, exit 0, 5480 passed, 0 failed, 591 skipped, 289/289 suites`.
  - **Story 1, round 2:** `20261009T044542Z-29808-8d09` PASS, 5184/0/590.
  - **Story 2:** `20261009T043710Z-1434-7dcc` PASS, 5212/0/581.
  - **Story 3, both rounds** (`20261009T185907Z-29733-9632` and `20261009T203009Z-5726-d2a7`): FAIL, but only on six suites belonging to another book, with identical counts in the baseline. Each round differed from its baseline only in `negentropy-sync-presets`: 72/0, then 95/0.
- **Live evidence beyond `npm test`:**
  - A strfry 1.1.0 build with the image's patch sets ran in the session sandbox (ADR 0001 Verified evidence 1–5, ADR 0002 Verified evidence, ADR 0003 Verified evidence 1–14). The reviewers re-ran the parts they relied on.
  - Story 3's UI was built with `vite build` from a `git archive` export (this checkout has no `ui/node_modules`).
  - The presets suite was stable in 5 of 5 sequential runs and in 6 of 6 parallel runs under CPU load.
- **Staging** (`book.md` § Staging verification has the full record):
  - **Bullet 1, verified.** The router restarted at 02:18:42Z (deploy #555, another session's docs push) and ran without a break through the owner's limit edits on `userProfiles` and `treasureMaps` (after about 02:22Z) and the owner's toggle check. At 02:42:50Z its uptime read 0:24:08.
  - **Bullet 2, verified.**
    - **At limit 5:** the deploy log shows the patch applied (#544). WoT kept exactly the newest 5 as of a moment 1.5–3.5 minutes after container start at #544–#546, losing 1–2 events per deploy.
    - **At limit 500:** WoT lost nothing at #553 (its one in-outage event, 02:05:13Z, came back), #554 or #555.
    - **`userProfiles`**, without a limit until about 02:22Z, lost 2 events at #553 and 1 at #554. All three (02:05:02Z, 02:05:13Z, 02:15:17Z) are now on staging, refetched when it reconnected with limit 500 after the owner's in-place edit, with no router restart.
    - **All 13 streams** are at limit 500.
  - **Bullet 3, AC-5 met (inferred).**
    - Preset `dcosl headers` ran on a 10-minute test interval at 01:32:58Z and 01:42:58Z, then every 10 minutes until 02:02:58Z.
    - Staging had lacked 3 of the 392 dcosl kind-39998 headers (20:58Z on 2026-10-09). Afterwards it held all 393.
    - The dcosl kind-9999 items the preset doesn't cover (4 from the last week) were still missing. That suggests the headers came from the preset and not from some other path.
    - The first run's count wasn't kept (§4 #6).
  - **Bullet 4.** Staging is verified for all three. Stories 1–2 had already reached production (PR #829, 20:13Z 2026-10-09) before the staging checks of bullets 1–2; story 3 has not been promoted (§4 #11).
- **Known open issues.** These ledger rows, all OPEN:
  - `2026-10-09-router-accepts-values-strfry-rejects`, `2026-10-09-task-history-misses-script-failures`, `2026-10-09-presets-relay-text-handling`, `2026-10-09-bk1-seed-match-char-window`;
  - `2026-10-09-router-patch-sed-macos` (filed by `assistant-trusted-content-status`, in this book's lane);
  - `2026-10-10-presets-keep-last-productive-run`, `2026-10-10-router-boots-with-empty-streams`, `2026-10-10-negentropy-silent-or-refusing-relays`, `2026-10-10-presets-review-polish`, `2026-10-10-ten-minute-schedule-blocks-merges`;
  - and from this close, `2026-10-10-docs-only-push-redeploys-staging` and `2026-10-10-delete-branch-relay-stream-gaps-story2`.
- **Debt the ADRs logged.**
  - **strfry log coupling.** The control panel now depends on two strfry 1.1.0 log strings and the router's stderr path. If they drift, the fallback restarts on every change, which is the old behaviour, not a silent failure.
  - **In-place invariant.** The router config must only be rewritten in place.
  - **Two patch directories.** The strfry patch set is now two directories, and a `STRFRY_REF` bump re-verifies both.
  - **Patch script portability.** The patch script uses GNU `sed -i`, which fails on macOS gates (row `2026-10-09-router-patch-sed-macos`).
  - **Stall heuristic.** The presets' 60-second rule can stop a slow sync that follows an unrelated notice. That is recorded and retried, never silent.
  - **Router Redis client.** After `docker restart tapestry-redis`, the router's Redis client recovers only through Restart or a deploy (row `2026-09-27-strfry-redis-never-reconnects`, dated update).

## 6. Carry-forward register

- [ ] **1. Production.** Stories 1–2 are already there (PR #829) but have not been checked there.
  - **Now:** raise production's saved stream limits so the patched router has something to refetch (`tag`-family and `tagDeletions` 5, WoT 0, `userProfiles` and `treasureMaps` none, read 2026-10-10). **Done 2026-10-10:** the owner raised them; at 03:17Z all 14 production streams read limit 500, and the router's uptime ran unbroken from the 2026-10-09 20:23Z deploy through the edits, so story 1's in-place reload also holds on production.
  - **Story 3:** promote it on the owner's go (`/cycle-prod`), then add the **Sync Negentropy Presets** task, switch it on at 6 hours, and save the presets wanted.
  - **Verify:** run the staging checks on production. (§4 #1, #11)
- [ ] **2. Staging's presets task.** It is switched off at a 10-minute interval (02:42Z). Set it to 6 hours, then switch it on; at 10 minutes it blocks the safe-to-merge check (row `2026-10-10-ten-minute-schedule-blocks-merges`).
- [ ] **3. Streams up with the router after a deploy,** and why WoT connected minutes late. Render the config from `router-state.json` in the entrypoint, and read the router's log after a deploy. (§4 #2; row `2026-10-10-router-boots-with-empty-streams`; recipe row `2026-10-10-staging-delivery-check-recipe`)
- [ ] **4. Values strfry rejects** pass the router's save checks: non-hex `authors`/`ids`, and negative `since`/`until` (and `kinds`, row 31(b)). The restart-failed message's advice is also wrong in that case. (§4 #3; row `2026-10-09-router-accepts-values-strfry-rejects`)
- [ ] **5. Scheduled Tasks history shows failed script runs as successes.** (§4 #7; row `2026-10-09-task-history-misses-script-failures`)
- [ ] **6. Keep a preset's last productive run** on the tab. (§4 #6; row `2026-10-10-presets-keep-last-productive-run`)
- [ ] **7. Silent and refusing relays outside the presets' stall rule:** the one-shot Start, and relays that ignore `NEG-OPEN`. (§4 #8; row `2026-10-10-negentropy-silent-or-refusing-relays`)
- [ ] **8. Relay text hygiene:** control characters in the log, and relay lines feeding the counts. (§4 #8; row `2026-10-09-presets-relay-text-handling`)
- [ ] **9. Review polish:** a second auth layer, the tab noticing later scheduled runs, the sticky pre-fill, and literal timeout texts. (row `2026-10-10-presets-review-polish`)
- [ ] **10. Test and tooling fragility:** BK1's 1,800-character window (row `2026-10-09-bk1-seed-match-char-window`) and the router patch's GNU `sed` (row `2026-10-09-router-patch-sed-macos`).
- [ ] **11. What still slips past both mechanisms:**
  - events backdated before a preset's window (§4 #5);
  - the upload direction after a router restart, since the router never uploads what was written while it was down (story 2 § Out of scope). An `up` or `both` preset covers it on its schedule;
  - content no stream or preset covers, such as staging's 4 missing dcosl kind-9999 items. The unfiltered `dcosl`/`dcosl2` presets stay off (OPEN.md row 25).
- [ ] **12. Preset scope the story ruled out:** per-preset schedules, one preset model across Router Management and Negentropy Sync, starter presets, and sharing presets between instances. (story 3 § Out of scope; §4 #4)
- [ ] **13. The Limit field's grey "500" placeholder** when blank means live only. (§4 #10; review 2, non-blocking 4)
- [ ] **14. Offer the router patch upstream** to hoytech/strfry. (ADR 0002 § Out of scope)
- [ ] **15. Docs-only pushes redeploy staging,** with a router restart and killed tasks each time. (row `2026-10-10-docs-only-push-redeploys-staging`)
- [ ] **16. The stale remote branch** `relay-stream-gaps-story2`. (row `2026-10-10-delete-branch-relay-stream-gaps-story2`)

**Ticked or annotated in earlier audits at this close** (the §6 items this book touched):
- `audits/sync-panel-tag-filters/audit.md` §6:
  - "Router Management tag filters" is **ticked**. It was resolved by book `router-stream-tag-filters` in July and never ticked.
  - "saved filter presets / persistence" is **annotated**: shipped for the Negentropy Sync panel. Three sub-items remain.
- `audits/router-stream-tag-filters/audit.md` §6:
  - "OPEN.md #31 hardening trio" is **annotated**: a negative `limit` is dropped. The rest of (b) is in a ledger row, and negative `kinds` in neither.
  - "Inherited … saved presets across both panels" is **annotated**: the sync panel's presets shipped. The cross-panel model and four other items remain.
- `audits/my-assistants/audit.md` §6, "Catch up on withdrawals missed while a router restarts", is **annotated**. The catch-up tools exist on staging. Production has stories 1–2 but `tagDeletions` at limit 5 and no presets; a kind-5 preset and `k`-less revokes remain. Row `2026-09-27-revokes-do-not-travel` gained the same dated update.

None of those items is ticked as resolved by this book, because each bundles parts it didn't build.

## 7. Process findings (harness)

**Measured at retro time** (`bash scripts/harness-stats.sh`, 2026-10-10):
- 1573 phase commits, 27 of them for this epic.
- 277 reviews decided, with a headline kick-back rate of 0% (final verdicts only) and 66 with kick-back history; re-review churn 3.
- 9 books open (this one at 1 day) and 73 closed.
- Cycle-time median 0 d. Each of the three stories read 0 d.

This book's own record: one of its five review rounds sent work back (story 1 round 1). Two more rounds were the owner's choice to fix PASS-review findings before merging (story 3, Amendment 2).

**What held.**
- Every strfry behaviour a design rested on was run against a real 1.1.0 build before it was relied on. This found:
  - that a rejected config is half-applied (review 1);
  - that a negative limit already broke the whole config (review 2);
  - how a relay refuses negentropy (Amendment 2).
- The Tester read the launcher before writing tests and caught the missing task timeout at Test Design, before any code existed.
- Fresh reviewers re-derived their own earlier suggested wording as new claims (story 1 round 2, reviewer rule 10). That found the third restart trigger the docs omitted.
- The Architect checked an orchestrator's brief against the code instead of taking it as given (finding 6 below).

| # | Finding | Source | Terminal state |
|---|---|---|---|
| 1 | The Reviewer's wiring says to commit and to flip the story's status. Every brief in this book reserved both, and each review recorded the conflict: story 2, story 3 round 1, story 3 round 2. The book-close brief did the same. Ports to both flows | Review 2 § Harness friction 1; review 3 § Harness friction 1 and round 2 § Harness friction 1 | OPEN.md row 316 (meta; existing). Story 2's occurrence and an escalation note added at this close |
| 2 | This checkout has no `ui/node_modules`, so the Implementer only transpiled the JSX. The Reviewer's `git archive` + `npm ci --ignore-scripts` + `vite build` fallback took about a minute. Ports to both flows | Review 3 § Harness friction 2 | OPEN.md row `2026-10-09-ui-build-without-node-modules` (meta; existing, filed in this book) |
| 3 | ADR 0003 designed a new registry task without reading the launcher's default: `taskRegistry.json` `options_default` gives a 30-minute timeout with `forceKill`. A presets run can legitimately take longer. The Tester caught it, which led to Amendment 1. Ports to both flows (same Architect) | ADR 0003 Amendment 1 (it cites the Tester's Test Design note); test plan T10 | **Operator-ratified harness commit `87935ed9`** (2026-10-10, at the gate): one sentence in `engineering-team/roles/architect.md`, How to act step 3 (read the defaults a new piece inherits from the framework it plugs into, e.g. a registry task's 30-minute `forceKill` timeout), plus its `engineering-team/CHANGELOG.md` row |
| 4 | A staging check of a reconnect fix was first read from per-minute counts ("events published during downtime were recovered"). Only a per-event timeline against the deploy job's container stop and start times showed the newest-N boundaries and the late connect. Ports to both flows (Director smoke and human-gated verification read the same data) | Orchestrator's staging notes; `book.md` § Staging verification | OPEN.md row `2026-10-10-staging-delivery-check-recipe` (meta; new) |
| 5 | A restart of the cloud session's container killed a background Reviewer run mid-review, and its work was lost. The re-run's brief told it to write the review file as it went | Orchestrator observation | **Declined:** one occurrence, and an environment event rather than a harness defect. The mitigation lives in how the orchestrator briefs long-running subagents. If it recurs, file a `meta` row for "write the review file incrementally" in the Reviewer role |
| 6 | The orchestrator's brief to the Architect for Amendment 2 asserted something false: that the one-shot path shares `runStrfrySync`. The Architect checked the code and wrote the truth into the amendment ("They share the slot and `buildCommand` … but not `runStrfrySync`") | ADR 0003 Amendment 2, Finding 1 item 3 | **Declined:** the role's "Read the relevant code. Don't guess." (`roles/architect.md` step 3) worked as designed. No change would add protection the role doesn't already require |
| 7 | Running a suite file directly can exit 0 without running a test. `router-stream-tag-filters`, `treasure-maps-router-preset` and `strfry-router-first-boot-config` did so in review 2. Ports to both flows | Review 2 § Harness friction 2 | OPEN.md row 310 (meta; existing). Recurrence appended at this close |
| 8 | Story 3's AC-5 check needed a short schedule (test plan step 4). Left at 10 minutes, it made the safe-to-merge check permanently unsafe, and another book's close PR (#833) had to merge on an override | Close PR #833; test plan § AC-5 steps 4 and 7 | OPEN.md row `2026-10-10-ten-minute-schedule-blocks-merges` (bug; existing). Update appended: the entry now reads switched off, still at 10 minutes |
| 9 | A non-trivial ledger-row fix (PR #787, +689 −62, a new suite) merged to `staging` as this book's base with no Reviewer pass and no GitHub review. `workflows/0-intake.md` allows out-of-cycle hotfixes only when trivial. Ports to both flows | §4 Undocumented work; review 1 header | OPEN.md row `2026-10-10-ledger-fix-pr-merged-unreviewed` (meta; new) |
| 10 | A process-shaped Implementer deviation: the fresh-install seed was written compactly to fit a test's 1,800-character regex window | Story 3 § Deviations; review 3, non-blocking 6 | OPEN.md row `2026-10-09-bk1-seed-match-char-window` (cleanup; existing, filed in this book) |
| 11 | A full `staging` → `main` promotion (PR #829) carried stories 1–2 to production about six hours before the staging check the book's frame required (bullet 4). The PR listed the book as still Open, but nothing in `/cycle-prod` reads open books' frames, and no waiver is recorded. Ports to both flows | §4 #11; PR #829's body; `deploy-tapestry` run #140 | OPEN.md row `2026-10-10-promotion-ignores-book-staging-condition` (meta; new) |

The deploy side effect of docs-only pushes is an ops loose end, not a harness lesson. It is filed under step 11 as row `2026-10-10-docs-only-push-redeploys-staging` (§6 #15).
