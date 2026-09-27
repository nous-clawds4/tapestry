# Review: docs lane — `docs/TAGGING_EDGES_HANDOFF.md` (tagging-edges, stories 2–4)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-27
**Diff:** the untracked file `docs/TAGGING_EDGES_HANDOFF.md` (130 lines) on `docs/tagging-edges-handoff`, off `origin/staging` `bb5db99a`. Nothing else in the tree changed.
**Lane:** doc / one-liner (0-intake §3: Implementer + Reviewer). No story; this is the non-numbered review form.
**Inputs checked against:** epic `epics/tagging-edges.md`, ADR `decisions/tagging-edges/0001-tagging-edge-contract.md`, the story-1 review `reviews/tagging-edges/1-tagging-edge-contract.md`, BIBLE §6 / §24 / §30, and `docs/DICTIONARY_PAGE_HANDOFF.md` for the handoff convention.

## Quality gates (run by reviewer, not trusted)

- [x] **Regression check (the story suite, through the gate engine).** A docs-only change can't break code. The run confirms the tree is otherwise the reviewed `bb5db99a`. `dirtyCount: 1` is the untracked handoff.
  `20260927T154443Z-67242-89df [review-handoff-doc] started 2026-09-27T15:44:43.368Z on bb5db99a+dirty — PASS, exit 0, 82 passed, 0 failed, 0 skipped, 1/1 suites`
- [x] `bash scripts/harness-lint.sh`: exit 0, `harness-lint: clean (0 violations)`. The handoff isn't mentioned.
- [x] **The five relative links in § 1 all resolve** from `docs/`.
- [x] **Convention.** The file matches `docs/DICTIONARY_PAGE_HANDOFF.md`: an H1 of the form `Handoff — … (Tapestry)`, the `**Status:** 🔴 OPEN: …` line first, a quoted "Repo metadata. Not part of the handoff text." block, then a `---` rule. `bash scripts/whats-open.sh` already lists `docs/TAGGING_EDGES_HANDOFF.md`, so the metadata's "`/whats-open` lists this file while it reads 🔴" holds.
- [ ] _Playwright, lint, typecheck and build: not applicable or not configured._

## Claims adherence (docs-mode)

I reproduced every verifier finding I rely on myself, at `bb5db99a` and in the running `tapestry` container. "Holds" means the command or source read confirmed the claim.

| § | Claim | Result | Evidence |
|---|---|---|---|
| Status | Story 1 in prod since 2026-09-27 via #764, #765 | Holds | #764 `feat/tagging-edges→staging` merged 13:23:50Z. #765 `staging→main` merged 13:35:33Z. "Deploy to Tapestry" on `297ff9d4` succeeded at 13:35:36Z. |
| Meta | 115 claims (98/15/2); `72469bde` | Holds | Matches `audits/tagging-edges/book.md:60-62`. `72469bde` is an ancestor of `bb5db99a`, and `identificationTaggings.js:72` is the same line at both commits. |
| 1 | Paths, "Binding for later stories", clarifications 1–13, BIBLE §6 subsection, contract exports | Holds | ADR :187 and 13 numbered clarifications at :409-447. BIBLE.md:292. `contract.js:279-286`. |
| 1 | Open review items = R2-NB1–3 | **Imprecise** | The epic (:26-39) also carries R2-4–10 into story 2. They're still open: the test plan still ends in a blank line (R2-9), and no commit after `ee95b510` touches the ADR, the review or the story. |
| 2.1 | Patch, `REDIS_ALLOW_KINDS = {3, 10000, 1984}`, `RPUSH` only on `Written` | Holds | Container `WriterPipeline.h:11-13, :166-173`. `Dockerfile:19, :26-33`. |
| 2.1 | Only `WriterPipeline` users push; `RelayWriter` doesn't | Holds | `cmd_import.cpp:53`, `cmd_sync.cpp:116`, `cmd_stream.cpp:36`, `cmd_router.cpp:226`. `RelayWriter.cpp:65` calls `writeEvents` directly. |
| 2.1 | "rebuilding strfry from scratch on every droplet (5–15 min, OPERATIONS.md)" | **Imprecise** | OPERATIONS.md:94 and :264 give 5–15 min for a *first* build on a new droplet. A patch edit busts the cache at `Dockerfile:19`, so the figure is borrowed. |
| 2.1 | Consumer: one event at a time, auto-commit, 3/10000 replace, 1984 add-only, no properties, no `created_at` guard, lost on error | Holds | `redis-consumer.js:34-105, :142-167`. |
| 2.2 | "bash + jq + APOC" | **Imprecise** | Steps 2–4 are Node (`kind*EventsTo*.js`, `getCurrent*FromNeo4j.js`, `calculate*Updates.js`). |
| 2.2 | "Per kind, each one:" steps 1–5 (per-author files, per-author diff) | **Wrong** | `reconcileAll.sh:142-193` (header :17-21) diffs FOLLOWS with a global sorted merge-join: `extractFollowsToTSV.js` + `kind3EventsToFollowsTSV.js` → `sort -u` → `comm` → awk → APOC. It writes no per-author files and never calls `getCurrentFollowsFromNeo4j.js` or `calculateFollowsUpdates.js`. It's the only existing full-sweep diff, and story 2 is a full sweep. |
| 2.2 | The step list ends at apply | Nit | Each kind also runs `apocCypherCommand2_*`, which stamps `kind<N>EventId`/`kind<N>CreatedAt`. ADR task-queue-scheduler/0020:12 says not to trust it. |
| 2.2 | "(story #23, …)" | Nit | The story is `stories/task-queue-scheduler/23-…`. A bare #23 collides with this book's numbering. |
| 2.2 | Watermark, 1 h overlap, 6 h cap | Holds | `reconcileRecent.sh:43-46, :130`. |
| 2.2 | "Deletions are detected by set-diff only" | **Imprecise** | REPORTS are never deleted. No `reportsToDelete` command exists. `REPORTS_DELETED=0` appears in all four tasks (`reconcileAll.sh:134`, `reconcileNetwork.sh:191`, `reconcileRecent.sh:202`, `reconcileAuthor.sh:124`), and the consumer is add-only for 1984. |
| 2.2 | Dead: "`reconciliation.sh --mode engine` and its `POST /api/reconciliation`" | **Wrong** | The route is live. It's at `src/api/index.js:286`, owner-gated (`auth.js:405`), and execs `reconciliation.sh` (`api/pipeline/reconcile/commands/execute.js:31`). The legacy page `/legacy/home.html` calls it (`public/pages/home.html:1022-1023`, served 200). `--mode engine` isn't a flag: the modes are `recent\|all\|author` (`reconciliation.sh:10-16, :45`). Only the registry key is gone. |
| 2.2 | The other dead items | Holds, with a gap | `src/pipeline/reconcile/*`, `processNostrEvents.sh`, `eventsToRelationships.js`, `optimized-processor.js` and `negentropySync.sh` are referenced only from docs. But the sibling `batch/transfer.sh` is live via `POST /api/batch-transfer` (`index.js:285`, `transfer.js:31`, `control-panel.html:925`, `home.html:1018`). |
| 2.2 | "a recency window never sees it; only a full sweep does" | **Imprecise** | `reconcileNetwork.sh:128` and `reconcileAuthor.sh:82` dump without `--recent` (`since: 0`), so they see late history for their own authors. sync and router go through `WriterPipeline`, so late kinds 3/10000/1984 also reach the stream. The conclusion does hold for taggings. |
| 2.2 | Taggings arrive via `#z` router streams in `router-state.json`; kind 5 doesn't travel | Holds | Production's public `GET /api/strfry/router-status` (read today) has 39999 `#z` streams and no kind-5 filter. `router-presets.json` has 2 occurrences of 39999. |
| 2.3 | "The only ETL control surface…"; reconcile tasks "can only be added" as scheduled entries | **Imprecise** | This is true of the React panel only. `/legacy/task-explorer.html` (200) runs any registry task via `POST /api/run-task` (`task-explorer.html:1866`). `/legacy/home.html` still has the Batch Transfer and Reconciliation buttons. |
| 2.3 | StreamingETLPanel details; control POST not owner-gated; wipe.js idiom | Holds | `RelaySettings.jsx:1310, :2071` (2216 lines). `index.js:478`, and `streaming-etl/index.js` has no `isOwner`. `wipe.js:14`. |
| 2.3 | "tracked by the 2026-07-21 intake entry" | Nit | The entry (`_intake.md:1814-1844`, unmarked) scopes the class but never names `/api/streaming-etl/control`. |
| 2.4 | "each entry … becomes a BullMQ Job Scheduler" | Nit | Only enabled, valid and registered entries do (`scheduler.js:188-197`). |
| 2.4 | Registry, `neo4j-heavy` cap 1, BIBLE §24, ADR 0023, TASK_* events | Holds | BIBLE.md:1634, :1659. `reconcileRecent.sh` trap. |
| 3 | Don't copy the replace-set or window diff; derive through the module; REPORTS-shape row | Holds | Consistent with the epic's guardrails (:49-51) and ADR 0001's binding (:187-201). |
| 3 | `scanLocalStrict` "rejects a non-zero exit" | **Imprecise** | It also has a 5 s default kill (`status.js:36, :57, :77-80`). Reused as-is, it would kill a full sweep. It is exported (:290). |
| 3 | "Refuse a mass delete past a threshold (see `reconcileNetwork.sh`'s refusal guards)" | **Wrong** | `reconcileNetwork.sh:76-88` refuses an unconstrained author predicate (a whole-graph scan), not a delete count. `grep -iE 'refus\|mass\|threshold\|MAX_DEL'` over `src/pipeline/reconciliation/` finds only those lines. The guard is new work (ADR 0001:197-199, epic :24, :71). |
| 3 | Story 3's REQ subscriber sees every write path; `nostr-search/src/ingest.js` precedent | Holds | Container `RelayReqMonitor`. `ingest.js:211-230` (`resync`). |
| 4.1 | The local stack has no taggings or follows | Holds | Local `strfry scan --count`: 0 kind-39999 events with either `nostr-user-tag` stamp, and 0 kind-3 events. |
| 4.3 | A new constraint makes instances report "not set up" | Holds | Verifier evidence (`neo4j-constraints.js`, `FirmwareExplorer.jsx:64, :541`); paths exist. |
| 4.6 | Lazy `require` of `profile-tags` (the `:72` precedent) | **Imprecise** | `:72` reads `NOSTR_USER_TAG_Z_TAG`, a full z string. The exports (`profile-tags/index.js:1835-1869`) don't include `LEGACY_Z_TAG_PUBKEY` (:49), but the contract takes bare pubkeys (`contract.js:131-132`). |
| 4 end | "both stamp pubkeys (lowercase 64-hex)" as already binding | Nit | ADR :197 and the epic (:69-71) say 64-hex. "lowercase" is carry-forward R2-5, for story 2's ADR. |
| 5 | "The `POST` Cypher endpoint is owner-gated." | **Wrong** | Only write Cypher is (`queryPost.js:35`). Reads are public: `PUBLIC_MUTATIONS` (`auth.js:485`), BIBLE.md:513, and the same on `origin/main`. Probe through nginx in-container with no session: `{"cypher":"RETURN 1 AS x"}` → `{"success":true,…}`. A signed-in non-owner, non-customer session is refused (`auth.js:383-385, :432-439`). Story 1 left open whether the NostrUser ends exist (`stories/…/1-tagging-edge-contract.md:145-147`, "no host access") because of this belief. That is § 4 decision 2. |
| 5 | Node 16 fails exactly 3 suites; zsh `:t` trap | Holds | `gate:status --list` rows `20260927T125823Z-69070-ae0d` and `…124211Z-4360-960f` fail exactly those three suites. `zsh -c 'VAR=39998:abc; echo "$VAR:tag"'` → `39998:abcag`. |
| 6 | W19 on hold, #761; contract step 2 | Holds | `worksheet.md:209-219`. `gh issue view 761` → OPEN. `contract.js:129-135`. |
| 6 | "The Pins draft proposes republishing with `polarity "0"` as a revoke" | Nit | `pins.md:122` (§ 4) and open question 2 (:240) cover *pinnings*, not taggings. The "graph readers bucket" part is ADR 0001's rule; no TAGS reader exists yet. |
| — | Ledger row ids cited (7) | Holds | All are `ledger/<id>.md` files. |

**Consistency.** The document agrees with the epic's guardrails, ADR 0001's binding and BIBLE §6/§30 wherever it restates them. The exceptions are the "lowercase" nit and the R2 scope in § 1, both listed above. It stores no trust, POV or count, and principle 4 is cited where deletes are discussed.

## ADR adherence / Concept-graph integrity / House rules
Not applicable to a handoff doc: it contains no code, handles or concept definitions, and adds no tooling. It hardcodes no TA pubkey, and § 4.6 restates the ADR 0015 "never a new literal" rule.

## Things tests can't catch
- [x] No secrets. No hosts, keys or tokens beyond public hostnames.
- [x] Scope: one new file, nothing else touched.
- Disclosure: while probing, I also sent one **write** Cypher (`CREATE (n:ReviewProbe)`) without a session. It was refused with 403, as the gate should. A follow-up read (`MATCH (n:ReviewProbe) RETURN count(n)` → 0) confirms nothing was written.

## Findings

### Blocking (wrong claims; each needs the exact replacement)

1. **docs/TAGGING_EDGES_HANDOFF.md:45-50**: the five-step universal is false for `reconcileAll`'s follows phase, which is the only full-sweep precedent. The replacement also folds in should-fix S3 (Node), N1 (step 6) and N2 (story ref). Replace lines 45–50 with:
   ```
   - **The four tasks:** `reconcileRecent`, `reconcileNetwork`, `reconcileAll` and `reconcileAuthor`, all in `src/pipeline/reconciliation/` (story `task-queue-scheduler` #23, ADR `task-queue-scheduler/0020`). They are bash + jq + Node + APOC. Per kind, each one follows these steps, except `reconcileAll`'s follows phase (below):
     1. dumps strfry to JSONL (`strfryToKind*Events.sh`);
     2. writes one file per author;
     3. extracts that author set's current edges from Neo4j (`getCurrent*FromNeo4j.js`);
     4. diffs the two sets per author (`calculate*Updates.js`);
     5. applies the result with `apoc.periodic.iterate` + `apoc.load.json` (`apocCypherCommands/`);
     6. stamps each author's NostrUser with `kind<N>EventId` / `kind<N>CreatedAt` from the dump (`apocCypherCommand2_*`). This is bookkeeping only; ADR `task-queue-scheduler/0020` rejects it as an edge-correctness signal.
   - **`reconcileAll` diffs FOLLOWS differently.** It runs a global sorted merge-join over the whole edge set: `extractFollowsToTSV.js` + `kind3EventsToFollowsTSV.js` → `sort -u` → `comm` → awk → APOC (`reconcileAll.sh:142-193`). It is the only existing full-sweep diff, so it is the precedent to read for story 2's sweep.
   ```
2. **docs/TAGGING_EDGES_HANDOFF.md:56**: `reconciliation.sh` is not dead, and `--mode engine` is not a flag. The fix also covers N6 (`batch/transfer.sh`). Delete the line
   `  - \`reconciliation.sh --mode engine\` and its \`POST /api/reconciliation\`;`
   and insert after line 60 (the end of the dead list):
   ```
   - **Superseded but still routed, do not copy or extend:**
     - `reconciliation.sh` (ADR `task-queue-scheduler/0018`'s `--mode recent|all|author` engine). ADR `task-queue-scheduler/0020` removed it from the task registry, but `POST /api/reconciliation` (`src/api/index.js:286`) still runs it from the legacy home page;
     - `batch/transfer.sh`, an add-only kind 3/10000/1984 loader, via `POST /api/batch-transfer` (`src/api/index.js:285`), also on the legacy pages.
   ```
3. **docs/TAGGING_EDGES_HANDOFF.md:96**: the cited "refusal guards" aren't a delete-count threshold, and no precedent exists. Replace
   `  - Refuse a mass delete past a threshold (see \`reconcileNetwork.sh\`'s refusal guards). A failed or empty relay read …`
   with
   `  - Refuse a mass delete past a threshold. This guard is new work: no existing reconciler counts deletions. The nearest pattern is \`reconcileNetwork.sh:76-88\`, which refuses an unconstrained author selection (a whole-graph scan), not a delete count; its \`fail()\` helper (:78: log, \`TASK_ERROR\`, exit before touching the graph) is the shape to copy. A failed or empty relay read …` (the rest of the line unchanged).
4. **docs/TAGGING_EDGES_HANDOFF.md:123**: read Cypher is public, so § 4 decision 2 can be measured. Replace
   `The \`POST\` Cypher endpoint is owner-gated.`
   with
   ``Only write Cypher is owner-gated on `POST /api/neo4j/query` (`src/api/neo4j/queryPost.js:35`); read Cypher is public (BIBLE's API table; `PUBLIC_MUTATIONS` in `src/middleware/auth.js:485`). So each host's graph can be measured read-only with no session, for example how many taggers and targets already have NostrUser nodes (§ 4 decision 2, which story 1 left open). Send the query signed out: a signed-in non-owner, non-customer session is refused (`auth.js:383-385`).``

### Should-fix (imprecise; not blocking on their own)

- **S1, :21**: replace `§ "Re-review" (R2-NB1–3)` with `§ "Re-review": R2-NB1–3 (acceptance criteria) and doc nits R2-4–10 (story 2 docs tasks), as carried in the epic`.
- **S2, :32**: replace `Adding a kind means editing that set literal and rebuilding strfry from scratch on every droplet (5–15 min, OPERATIONS.md).` with `Adding a kind means editing that set literal. The edit busts the Docker cache at \`Dockerfile:19\`, so every host's next deploy recompiles strfry and rebuilds every later image layer. OPERATIONS.md §3 puts a cold first build at 5–15 min.`
- **S3, :45**: "bash + jq + APOC" → "bash + jq + Node + APOC". This is folded into Blocking 1.
- **S4, :52**: replace `**Deletions are detected by set-diff only.**` with `**Deletions (FOLLOWS and MUTES only; REPORTS are add-only in both legs) are detected by set-diff only.**`.
- **S5, :61**: replace `That history keeps its original \`created_at\`, so a recency window never sees it; only a full sweep does.` with `That history keeps its original \`created_at\`, so \`reconcileRecent\`'s window never sees it. Only a pass that dumps without \`since\` does: \`reconcileAll\`, or \`reconcileNetwork\` / \`reconcileAuthor\` for their authors. For kinds 3/10000/1984 the stream sees it too, because \`sync\` and \`router\` go through \`WriterPipeline\`. Taggings have no such push.`
- **S6, :65**: replace `**The only ETL control surface** is` with `**The only ETL control surface in the React control panel** is`.
- **S7, :69**: replace `They can only be added as entries in the neighbouring **📅 Scheduled Tasks** sub-tab (\`ScheduledTasksPanel\`, \`scheduledTasks/AddOrEditEntryModal.jsx\`, \`src/api/scheduled-tasks/\`).` with `The React control panel can only schedule them, as entries in the neighbouring **📅 Scheduled Tasks** sub-tab (\`ScheduledTasksPanel\`, \`scheduledTasks/AddOrEditEntryModal.jsx\`, \`src/api/scheduled-tasks/\`). The legacy Task Explorer (\`/legacy/task-explorer.html\`) can run any registry task on demand through \`POST /api/run-task\`, and the legacy home page (\`/legacy/home.html\`) still carries Batch Transfer and Reconciliation buttons wired to the routes in § 2.2.`
- **S8, :95**: replace `Read strfry with a strict scanner that rejects a non-zero exit (\`scanLocalStrict\` in \`src/api/setup/status.js\`), never an exec-with-20-MB-buffer scanner.` with `Read strfry with a strict scanner that rejects on a spawn error, a non-zero exit or a timeout (\`scanLocalStrict\` in \`src/api/setup/status.js\`), never an exec-with-20-MB-buffer scanner. Its default budget is 5 s (\`LOCAL_SCAN_TIMEOUT_MS\`), so pass a \`{ timeoutMs }\` sized for a full sweep.`
- **S9, :117**: replace `A lazy \`require\` of \`src/api/profile-tags\` (the \`src/api/assistant/identificationTaggings.js:72\` precedent), or an ADR 0015 amendment` with `A lazy \`require\` of \`src/api/profile-tags\` (precedent: \`src/api/assistant/identificationTaggings.js:72\`, which reads \`NOSTR_USER_TAG_Z_TAG\`). That module exports only the full z strings, not \`LEGACY_Z_TAG_PUBKEY\`, and the contract takes bare pubkeys, so the writer either parses the pubkey out of \`NOSTR_USER_TAG_Z_TAG\` or adds the constant to the exports. Or an ADR 0015 amendment`. Keep the rest of the line.

### Nits

- **N1, :50**: add step 6. Folded into Blocking 1.
- **N2, :45**: `(story #23,` → `(story \`task-queue-scheduler\` #23,`. Folded into Blocking 1.
- **N3, :68**: replace `This is tracked by the 2026-07-21 intake entry "gate authenticated-non-owner access to admin mutations".` with `It falls in the class scoped by the open 2026-07-21 intake entry "gate authenticated-non-owner access to admin mutations", whose inventory does not name this route yet.`
- **N4, :81**: replace `each entry in \`/var/lib/brainstorm/scheduled-tasks.json\` becomes a BullMQ Job Scheduler.` with `each enabled entry with a valid schedule in \`/var/lib/brainstorm/scheduled-tasks.json\` becomes a BullMQ Job Scheduler (one per entry, \`sched:<entryId>\`).`
- **N5, :119**: replace `refuse to start without both stamp pubkeys (lowercase 64-hex);` with `refuse to start without both stamp pubkeys (64-hex per ADR 0001; story 2's ADR adds "lowercase", carry-forward R2-5);`.
- **N6, :60**: `batch/transfer.sh` is still routed. Folded into Blocking 2.
- **N7, :130**: replace `**The Pins draft** proposes republishing with \`polarity "0"\` as a revoke that propagates. The contract already stores \`"0"\` raw, and graph readers bucket it as neutral.` with `**The Pins draft** (§ 4, open question 2) proposes unpinning a *pinning* by republishing it with \`polarity "0"\`, because deletions propagate unreliably. If taggings adopt the same revoke, the contract already stores \`"0"\` raw, and ADR 0001's reader rule buckets it as neutral.`

### Harness friction
1. **This review isn't committed.** The calling workflow limited this run to writing this one file, with no stage and no commit. Workflow 5 says "commit the review file regardless of verdict", so the orchestrating session must commit it with the handoff's next round.
2. The handoff's false § 5 claim repeats a belief already recorded in story 1 (`1-tagging-edge-contract.md:146-147`: "no host access from this machine"). Once Blocking 4 lands, the handoff is the correction of record. The story file is historical and needs no edit.

## Verdict
**CHANGES_REQUESTED**

## Re-review (2026-09-27)

**Diff:** the same untracked `docs/TAGGING_EDGES_HANDOFF.md`, now 134 lines, on `docs/tagging-edges-handoff` at `bb5db99a`. Nothing else changed apart from this review file.
**Method:** per reviewer.md step 10, every corrected sentence is re-checked as a new claim, including the wording round 1 suggested. Each row below was re-derived from source or a command in this round, not taken from round 1.

### Quality gates (run by reviewer, not trusted)

- [x] **Regression check (the story suite, through the gate engine).** Host Node is v16.17.0; this suite doesn't depend on the Node 16 gaps.
  `20260927T155427Z-86474-1af1 [rereview-handoff-doc] started 2026-09-27T15:54:27.826Z on bb5db99a+dirty — PASS, exit 0, 82 passed, 0 failed, 0 skipped, 1/1 suites`
- [x] `bash scripts/harness-lint.sh`: exit 0, `harness-lint: clean (0 violations)`.
- [x] **Live read-only probe for Blocking 4.** One signed-out `POST /api/neo4j/query` with `{"cypher":"RETURN 1 AS x"}` to each of tapestry, staging and tags.brainstorm.world returned `{"success":true,"data":[{"x":1}],…}` on all three. No write Cypher and no other POST was sent.

### Round-1 corrections: applied, and true?

| Item | Applied at | Faithful? | Is the new text true? |
|---|---|---|---|
| B1 | :45-52 | Verbatim | Steps 1–6 hold for all four tasks: dumps, per-pubkey converters, `--authorsFromDir` extractors, `calculate*Updates.js`, `apocCypherCommand1_*` (`apoc.periodic.iterate` + `apoc.load.json`), and the `apocCypherCommand2_*` stamps (`SET …kind<N>CreatedAt, …kind<N>EventId`). ADR 0020:12, :21. The merge-join description matches `reconcileAll.sh:143-193`. **The last sentence of :52 is false.** See R2-B1. |
| B2 | :56 removed; :62-64 added | Verbatim | Holds. `index.js:285, :286`. `execute.js:31` and `transfer.js:31` exec the scripts. `home.html:1018, :1023` and `control-panel.html:925` call the routes, and `bin/control-panel.js:277` serves them under `/legacy/`. ADR 0018's title and table (:48-50) give `--mode recent\|all\|author`, as does `reconciliation.sh:10-16`. Only the four `reconcile*` registry keys remain; `reconciliation` survives only in the legacy `processAllTasks` `children` list (`taskRegistry.json:84`). `transfer.sh:8`: add-only. Completeness nit R2-N2. |
| B3 | :100 | Applied; the `:78` anchor was dropped, which is harmless | `fail()` is at `reconcileNetwork.sh:78`: it logs, emits `TASK_ERROR` and exits 1. The guards at :80-88 run before the first graph read (:138). No threshold exists (`git grep -iE 'refus\|mass\|threshold\|MAX_DEL'`). **But "no existing reconciler counts deletions" is false.** See R2-B2. |
| B4 | :127 | Applied; line anchors and the BIBLE pointer dropped, which is harmless because the metadata says to prefer names | Holds. `queryPost.js:35` gates only `isWrite`. `auth.js:485` `PUBLIC_MUTATIONS`. `auth.js:384-385` + `:432-439` refuse a signed-in non-owner, non-customer session. Identical on `origin/main`, `origin/staging` and `origin/feat/tags` (local refs). The live probe above confirms that reads are public on all three hosts. |
| S1 | :21 | Verbatim | Holds: epic :24-39. |
| S2 | :32 | Verbatim | Holds. `Dockerfile:19` is the `COPY patches/strfry-redis/` layer ahead of the strfry build (:26-33). OPERATIONS.md:94 is in §3 (:84-99). |
| S4 | :54 | Verbatim | Holds. `redis-consumer.js:90` ("never deletes"). `REPORTS_DELETED=0` in all four tasks. |
| S5 | :65 | Verbatim | Holds. `reconcileNetwork.sh:128` and `reconcileAuthor.sh:82` call the dumpers without `--recent`, which leaves `SINCE_TIMESTAMP=0` (`strfryToKind3Events.sh:3`). In the container's strfry source, `cmd_sync.cpp:116` and `cmd_router.cpp:226` construct `WriterPipeline`, and `WriterPipeline.h:163-170` pushes on `Written`. |
| S6 | :69 | Verbatim | Holds. |
| S7 | :73 | Applied; the `/legacy/home.html` path was dropped, which is harmless | Holds, except that "any" is too broad. The page is `public/pages/manage/task-explorer.html`, served at `/legacy/task-explorer.html`. `:1866` calls `/api/run-task` (`index.js:293`). See nit R2-N1. |
| S8 | :99 | Verbatim | Holds. `status.js:36` (`5000`), `:57` (`{ timeoutMs = LOCAL_SCAN_TIMEOUT_MS }`), and `:73-81` (rejects on a spawn error, a non-zero exit or a timeout). |
| S9 | :121 | Verbatim | Holds. `identificationTaggings.js:72` (`canonicalZ()` → `require('../profile-tags').NOSTR_USER_TAG_Z_TAG`). The exports at `profile-tags/index.js:1835-1869` omit `LEGACY_Z_TAG_PUBKEY` (:49). `contract.js:72-74` `stamp()` takes a bare pubkey. "only" is imprecise; see nit R2-N3. |
| N3 | :72 | Verbatim | Holds. `_intake.md:1814` carries no status marker, and its entry never mentions `streaming-etl`. |
| N4 | :85 | Verbatim | Mostly holds. `scheduler.js:189-190` also requires a registered task. See nit R2-N4. |
| N5 | :123 | Verbatim | Holds. |
| N7 | :134 | Verbatim | Holds. `pins.md:122` ("The second is proposed because deletions propagate unreliably") and open question 2 at :240. ADR 0001:222-224 gives the reader bucket. |

**Whole-file consistency after the edits.** The cross-references agree: § 2.3's "routes in § 2.2" (:73) with :62-64, the mass-delete guard at :100 with the binding line at :123, and § 5 (:127) with § 4 decision 2. The metadata at :7 is still accurate. Only the two sentences below contradict the code, and both came from round 1's own suggested text.

### Findings

#### Blocking (wrong claims; exact replacements)

1. **R2-B1, docs/TAGGING_EDGES_HANDOFF.md:52.** "It is the only existing full-sweep diff" is contradicted by `reconcileAll.sh`'s own header (:7-16: "full consistency across the ENTIRE graph"; Phases A and C are a "full strfry dump → converter (no filter) → per-pubkey files"). Its mutes and reports phases (:105-141, `extract_and_dump_no_filter`, :93-100) sweep every author through steps 1–6. What makes the follows phase unique is that its diff isn't per author, not that it's a full sweep. Replace
   `It is the only existing full-sweep diff, so it is the precedent to read for story 2's sweep.`
   with
   ``Its mutes and reports phases are full sweeps too, but they run steps 1–6 over every author, with no author filter (`reconcileAll.sh:105-141`). So `reconcileAll` is the only full sweep among the four tasks, and its follows phase is their only diff that isn't per author. Read both before designing story 2's sweep.``
2. **R2-B2, docs/TAGGING_EDGES_HANDOFF.md:100.** Every reconciler counts its deletions *before* applying them: `reconcileAll.sh:114, :184`; `reconcileNetwork.sh:171, :209`; `reconcileRecent.sh:180, :222`; `reconcileAuthor.sh:106, :140`. Each then emits the count as `deleted` in its drift event. None refuses on the count. Replace
   `This guard is new work: no existing reconciler counts deletions.`
   with
   ``This guard is new work: every existing reconciler counts its deletions before applying them (for example `reconcileAll.sh:114`, `:184`), but only to report drift, and none refuses on the count.``

#### Nits (optional; not blocking)

- **R2-N1, :73.** `reconcileAuthor` can't get its `--pubkey` through `/api/run-task`: `buildTaskCommand` passes only customer, limit and warmStart args (`runTask.js:76-101`), and the registry entry has `"arguments": false`. So it fails at `reconcileAuthor.sh:57`. Replace `can run any registry task on demand through \`POST /api/run-task\`,` with ``can start any registry task on demand through `POST /api/run-task` (`reconcileAuthor` fails there: the route can't pass its `--pubkey`),``.
- **R2-N2, :64.** `transfer.sh` is also reachable through two active registry tasks: `callBatchTransfer` (`callBatchTransfer.sh:22`) and `callBatchTransferIfNeeded` (`callBatchTransferIfNeeded.sh:48`). Replace `via \`POST /api/batch-transfer\` (\`src/api/index.js:285\`), also on the legacy pages.` with ``via `POST /api/batch-transfer` (`src/api/index.js:285`, also on the legacy pages) and the active registry tasks `callBatchTransfer` / `callBatchTransferIfNeeded`.``
- **R2-N3, :121.** `profile-tags` also exports `TA_PUBKEY` (:55, runtime `getOwnerAssistantPubkey()`), which is the local stamp's pubkey. Replace `That module exports only the full z strings, not \`LEGACY_Z_TAG_PUBKEY\`,` with ``Of the ADR 0015 literal, that module exports only full z strings (`NOSTR_USER_TAG_Z_TAG`, `TAG_PINNING_Z_TAG`), not `LEGACY_Z_TAG_PUBKEY` (its `TA_PUBKEY` export is the runtime TA, the local stamp's pubkey),``.
- **R2-N4, :85.** Replace `each enabled entry with a valid schedule in` with `each enabled entry with a valid schedule and a registered task in`.

#### Harness friction

1. Round 1's friction item 1 still stands. This review is uncommitted because the caller limited the run to appending to this one file. The orchestrating session must commit it with the handoff.
2. No new row. Both blocking claims are round 1's own suggested sentences, adopted verbatim. This is exactly the case reviewer.md step 10 exists for, and the rule caught them. While verifying, the zsh `"$b:src/…"` modifier trap that the handoff's § 5 records also swallowed a `git show` here, which is live evidence that § 5 is accurate.

**CHANGES_REQUESTED**

## Re-review 2 (2026-09-27)

**Diff:** the same untracked `docs/TAGGING_EDGES_HANDOFF.md`, still 134 lines, at `bb5db99a`. A full re-read against the round-2 text shows only lines 52, 64, 73, 85, 100 and 121 changed. Each changed sentence is re-checked as a new claim (reviewer.md step 10); the three that reword my suggestions were re-derived separately.

### Quality gates (run by reviewer)
- [x] Regression check: `20260927T155749Z-6680-77fa [rereview2-handoff-doc] started 2026-09-27T15:57:49.234Z on bb5db99a+dirty — PASS, exit 0, 82 passed, 0 failed, 0 skipped, 1/1 suites`
- [x] `bash scripts/harness-lint.sh`: exit 0, `harness-lint: clean (0 violations)`.
- No host requests this round.

### Round-2 items

| Item | Line | Applied | Is the new text true? |
|---|---|---|---|
| R2-B1 | :52 | Verbatim | Holds. Phases A and C (`reconcileAll.sh:105-141`) call `extract_and_dump_no_filter`, with the converter run without `--filterAuthorsFile` (:93-100). The only `comm` / `extractFollowsToTSV` use is in this file, per `git grep`. The other three tasks are windowed, predicate-scoped or single-author. |
| R2-B2 | :100 | Verbatim | Holds. The `*_DELETED=` counts at `reconcileAll.sh:114, :184` (and the matching lines in the other three tasks) precede each apply and feed only the drift events. No threshold exists. |
| R2-N1 | :73 | Reworded: "can run registry tasks … (not `reconcileAuthor`, whose `--pubkey` it cannot pass)" | Holds on both run paths. The direct `buildTaskCommand` (`runTask.js:76-106`) and the queue's `buildChildArgs` (`queue/processor.js`) add only `staticArgs`, the customer, limit and warmStart. `reconcileAuthor` has no `staticArgs` and `"arguments": false`. |
| R2-N2 | :64 | Reworded; "active" dropped | Holds. Both registry entries are `status: active`. `callBatchTransfer.sh:22` runs `transfer.sh` unconditionally; `callBatchTransferIfNeeded.sh:48` runs it when needed. |
| R2-N3 | :121 | Reworded: "exports the full z strings and the runtime `TA_PUBKEY`, but not `LEGACY_Z_TAG_PUBKEY`" | Holds on `TA_PUBKEY` (:55) and `LEGACY_Z_TAG_PUBKEY`. "the full z strings" overstates: `TAG_Z_TAG` (:59) isn't exported (`module.exports`, :1835-1869, has only `TAG_PINNING_Z_TAG` and `NOSTR_USER_TAG_Z_TAG`). The sentence's conclusion (parse the pubkey, or export the constant) is unaffected, so this is a nit, below. |
| R2-N4 | :85 | Verbatim | Holds. `scheduler.js:189-190`. |

**Consistency.** No other line changed, and the round-2 cross-reference checks still apply.

### Nit (optional; not blocking)
- **:121.** Replace `That module exports the full z strings and the runtime \`TA_PUBKEY\`` with ``That module exports two of the three full z strings (`NOSTR_USER_TAG_Z_TAG`, `TAG_PINNING_Z_TAG`; not `TAG_Z_TAG`) and the runtime `TA_PUBKEY` ``.

### Harness friction
1. Round 1's friction item 1 still stands: this review is uncommitted by instruction. The orchestrating session must commit it with the handoff.

**PASS**
