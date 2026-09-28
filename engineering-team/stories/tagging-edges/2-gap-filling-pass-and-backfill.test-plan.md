# Test Plan: Story 2 — The gap-filling pass and backfill

**Story:** `engineering-team/stories/tagging-edges/2-gap-filling-pass-and-backfill.md`
**ADR:** `engineering-team/decisions/tagging-edges/0002-gap-filling-pass.md` (binding context: `tagging-edges/0001` as
amended by 0002, and `src/lib/tagging-edges/contract.js`)
**Date:** 2026-09-27

Seven suites and one fixture helper, 359 tests, 278 of them new for story 2. Six suites are new. Story 1's contract
suite gains 16 tests (S2C1–S2C16); one of them, S2C9, replaces story 1's "no pipeline writes TAGS yet" check. Every
suite is stack-free except the live one, which is read-only by default and skips without a local Neo4j. Fixture
pubkeys are fake 64-hex values. The canonical identity is a parameter of the contract, so a fake stands in for it and
is kept different from the local one. No deployment's TA and no copy of the ADR 0015 literal appears.

| Suite | Tests | Unit under test | Level |
|---|---|---|---|
| `test/tagging-edge-contract.test.js` (extended) | 97 (81 story 1, 16 S2C) | R2-NB2, R2-10, the `stamp` export; BIBLE §6, §11, §16, Last updated | unit, doc |
| `test/tagging-edges-sweep.test.js` | 54 (SW) | `src/lib/tagging-edges/sweep.js`, the pure planner | unit |
| `test/strfry-scan-strict.test.js` | 27 (SS) | `src/lib/strfryScanStrict.js` | integration, fake strfry on PATH |
| `test/tagging-edges-runner.test.js` | 62 (SR) | `src/pipeline/tagging-edges/reconcileTaggingEdges.js` | fake ports; child process; source |
| `test/tagging-edges-state-routes.test.js` | 49 (ST 19, RT 30) | `src/pipeline/tagging-edges/state.js`, `src/api/tagging-edges/index.js`, the task channels | unit on a temp dir; handlers with fake req/res |
| `test/tagging-edges-wiring.test.js` | 54 (SWR) | registry, seed, both rule lists, setup script, boot-hook call, routes; `graph.js`; the wrapper | static; unit; fake driver |
| `test/tagging-edges-live.test.js` | 16 (SL: 7 read-only, 9 sandbox) | `graph.js` and `sweep.js` against the local Neo4j | live, local stack only |
| `test/helpers/taggingEdgesFixtures.js` | — | shared identities, events, READ_ALL rows | helper |

## Coverage map

Test ids only; each suite's names are full sentences, and the test index below groups them.

| Criterion | Tests | File | Level |
|---|---|---|---|
| **AC-1** — the first run fills every tagging; later runs pick up late arrivals; missing people added once, keyed by pubkey; `a`-named tags resolve; id-only tags stay unresolved until an element arrives; an element resolves under its identity `d` | S2C1–S2C4 (R2-NB2), S2C6–S2C8 (`stamp`) | contract | unit |
| | SW9 (one full scan: no `since`, `until`, `limit`), SW10–SW13, SW24, SW40 (canonical, local and both stamps), SW42 | sweep | unit |
| | SR29, SR36 (`added = taggingsRead − refused.total`), SR61 | runner | fake ports |
| | SWR15, SWR19, SWR24, SWR25, SWR45, SWR46 | wiring | static, fake driver |
| | SL9 (a missing tagger added once, carrying nothing else) | live | sandbox |
| **AC-2** — the relationship follows the relay's current version, newer or older; moves to a new person; R2-NB1; never overwrites another writer's change; agreement changes nothing | SW16–SW22, SW26–SW32 (rule table, labels, resolution kept, fixed point), SW33–SW34 (parity), SW35 (R2-NB1 table), SW41 | sweep | unit |
| | SR29 (the graph read resolves before the scan starts), SR37, SR51, SR55 | runner | fake ports |
| | SWR17, SWR18, SWR20, SWR21, SWR40–SWR42, SWR46–SWR48, SWR53 | wiring | fake driver |
| | SL1, SL4; SL11–SL14 (create race, lock first, FLOAT repaired, move under the rule) | live | read-only; sandbox |
| **AC-3** — removed when the relay holds nothing or a refused version, only while it still holds the version decided from; the relay wins over a deletion; bad addresses left and counted; nothing else removed | S2C5 (R2-10) | contract | unit |
| | SW8, SW14, SW15, SW23, SW25, SW45, SW50, SW52 | sweep | unit |
| | SR29 (no kind-5 scan), SR38 | runner | fake ports |
| | SWR14, SWR16 | wiring | static |
| **AC-4** — a failed or incomplete read changes nothing and names the read; a bad identity refuses and names it | SW7 | sweep | unit |
| | SS1–SS27 | strfry-scan-strict | fake strfry |
| | SR9, SR14–SR20 (identities, each source), SR21–SR22, SR23–SR26, SR28, SR30–SR33 | runner | fake ports |
| | SWR49 (a failed verify re-read commits nothing; with SR53, the partial stop of owner decision 8) | wiring | fake driver |
| **AC-5** — over the limit, removals held and everything else applied; each pass judges its own; owner-only confirmation, one run, still-due entries only | SW4, SW36–SW39, SW43–SW49, SW53 | sweep | unit |
| | SR40–SR47 | runner | fake ports |
| | ST6–ST8, ST11–ST15; RT8–RT20 (RT9b included), RT21–RT26, RT27–RT29 | state-routes | temp dir; handlers |
| | SWR2, SWR11 | wiring | static |
| **AC-6** — one relationship per tagging from deploy, with no owner step; the pass creates the rule or refuses; both checks agree; the Dashboard offers the fix | SWR7–SWR10, SWR22, SWR27–SWR31, SWR54, SWR32–SWR38 (boot hook), SWR51, SWR52 | wiring | static, unit, fake driver |
| | SR23–SR26, SR34, SR35 | runner | fake ports |
| | SL6, SL7; SL10 (a second relationship at one address refused) | live | read-only; sandbox |
| | S2C12 | contract | doc |
| **AC-7** — every run leaves a report that survives a restart; the pass runs only as a task; never two at once; a stopped pass reads failed and stopped | ST1–ST5, ST9–ST10, ST16–ST19; RT1–RT7 | state-routes | temp dir; handlers |
| | SR1–SR13, SR48–SR54, SR56–SR62 | runner | fake ports; child process; source |
| | SWR1, SWR3–SWR6, SWR50 | wiring | static |
| **AC-8** — nothing else moves; a written relationship carries only the definition's values | SW3, SW18, SW22, SW27 | sweep | unit |
| | SR48, SR62 | runner | fake ports |
| | SWR14–SWR16, SWR20, SWR24, SWR25 | wiring | static, unit |
| | SL2, SL15 | live | read-only; sandbox |
| **Docs task — BIBLE** (the only docs task a test checks) | S2C9–S2C11, S2C13–S2C16 | contract | doc (reads `BIBLE.md`) |

### ADR decisions and bindings each suite pins

| ADR item | Tests |
|---|---|
| D1 — a Node runner behind a bash wrapper that `exec`s it | SWR5, SWR50, SR4, SR5 |
| D2 — the strict reader; one scan over four `#z` stamps; no kind-5 read | SS1–SS27, SW9–SW11, SR29, SR59 |
| D3 and A1 — follow the relay's current version; parity with `standingEdge`, two divergences | SW29, SW33, SW34 |
| D4 — lock, re-read, verify in JS, act | SW19–SW21, SWR17, SWR40–SWR44, SWR49, SL12 |
| D5 — R2-NB1 by binding the pass | SW17, SW35, SL13 |
| D6 — a bare keyed `MERGE` adds people | SWR15, SWR45, SWR46, SL9, SL15 |
| D7 — a move deletes, then creates, in one statement | SWR18, SW28, SL14 |
| D8 — the owner-only, single-use confirmation record | ST11–ST14, RT8–RT20, RT27–RT29, SR27, SR28, SR41–SR47, SWR2, SWR11 |
| D9 — pessimistic report first, then liveness | ST2–ST5, ST16–ST18, RT1, RT2, SR8–SR11, SR56 |
| D10 — `neo4j-heavy` | SWR3 |
| D11 — the kernel `flock` | SWR50, ST19, SR4–SR7 |
| D12 — the boot hook | SWR10, SWR32–SWR38 |
| R2-NB3 (A4) and the rule table | SW23–SW31, SW42 |
| The limit's base and confirmed runs (owner decisions 4, 5) | SW36–SW39, SW45–SW48, SR42 |
| A refused start neither spends nor invalidates a confirmation (owner decision 6) | SR28, SR46 |
| Keys outside the nine dropped after their pre-image (owner decision 9) | SW18, ST9, ST10, SR48, SR49, SR62 |
| Resolution kept for the same version (owner decision 10) | SW22, SW30, SW31 |
| The three routes (owner decision 13) | RT5–RT26, SWR11 |
| `--lock-busy` writes no report (owner decision 15) | SR4, SR6 |
| Structured events | SR6, SR7, SR12, SR13, SR57 |
| Time-outs, batch size, sort order | SR39, SR58–SR60, SWR44, SWR46, SWR52, SWR53, SS26 |
| Purity and ADR 0015 | SW1 (story 1's purity and no-64-hex guards cover the folder), SR2, SR3, SWR12 |

## Test index

- **tagging-edge-contract, S2C (16):** S2C1–S2C4 R2-NB2 (an element's identity `d`); S2C5 R2-10 (the retire path);
  S2C6–S2C8 the `stamp` export and the export list; S2C9–S2C16 BIBLE (status line, Revokes, "One version stands",
  `tags_address`, the §30 class, the §11 routes, the §16 entry, Last updated).
- **tagging-edges-sweep, SW (54):** SW1–SW6 surface, constants, vocabularies, `RUN_ID_RE`; SW7 `checkIdentity`; SW8
  `isTaggingAddress`; SW9–SW11 `sweepFilter`, `isExpectedScanEvent`; SW12–SW15 `readRelay`; SW16–SW18
  `storedFromRow`; SW19–SW21 `fingerprint`; SW22 `desiredFor`; SW23–SW32 `decideAddress`; SW33–SW35 parity and
  R2-NB1; SW36–SW39 `judgeRemovals`; SW40–SW51 `planPass`; SW52 the relay wins over a kind-5; SW53 `heldLines`; SW54
  the port's row shape.
- **strfry-scan-strict, SS (27):** SS1–SS5 complete reads; SS6–SS18 one code for each kind of incomplete read; SS19
  split UTF-8; SS20–SS21 size; SS22–SS25 `stderrTail`; SS26–SS27 the defaults.
- **tagging-edges-runner, SR (62):** SR1–SR3 surface, lazy requires, no 64-hex; SR4–SR7 lock busy, not under the lock;
  SR8–SR13 pessimistic record, `previous`, `runId`, events; SR14–SR20 identities; SR21–SR22 config and the pass's own
  driver; SR23–SR26 schema pre-flight; SR27–SR28 when the claim happens; SR29–SR35 reads and snapshot conflicts;
  SR36–SR40 apply order, batches, limit; SR41–SR47 confirmation flows; SR48–SR53 pre-images, stops, partial failure;
  SR54 exit codes; SR55–SR62 report fields, PROGRESS, time-outs, sort, `strippedKeys`.
- **tagging-edges-state-routes, ST (19) and RT (30):** ST1–ST5 the report store; ST6–ST8 held file and digest;
  ST9–ST10 pre-images; ST11–ST15 confirmation records and pruning; ST16–ST19 `/proc` and fdinfo; RT1–RT7
  `computeStatus` and GET status; RT8–RT20 the confirm route, with RT9b; RT21–RT26 GET held; RT27–RT29 the task
  channels.
- **tagging-edges-wiring, SWR (54):** SWR1–SWR11 static sentinels; SWR12–SWR23 the statement audit; SWR24–SWR31 and
  SWR54 pure helpers; SWR32–SWR38 the boot hook; SWR39–SWR49 and SWR51–SWR53 the port against a fake driver; SWR50 the
  wrapper.
- **tagging-edges-live, SL (16):** SL1–SL7 read-only; SL8–SL16 the opt-in write sandbox.

## Edge cases

- [x] Every bypass the story asks Test Design to probe (row `2026-09-22-rule-stories-need-bypass-probing`):
  - each identity missing, empty, non-string, 63 or 65 characters, non-hex, upper-case or mixed-case (SW7,
    SR14–SR19);
  - a malformed value from the environment or the conf (SR15, SR16);
  - a time-out, a failed exit, a signal, or a truncated answer (SS6, SS10–SS13, SR32);
  - a failed tag-element read, which is the one relay scan (SR32);
  - a failed deletion read: none is made (SR29);
  - removals counted toward the limit, and moves not (SW43, SR40);
  - a confirmation by no session, a loopback call, an admin (injected, and on the house admin list), a stranger, a
    task argument or a schedule entry (RT8–RT10, RT9b, RT27–RT29);
  - a confirmed run whose read would remove what the confirmed report did not hold, an empty read included (SW38,
    SW47, SR42).
- [x] Canonical and local identities different; taggings carrying each stamp alone and both (SW40, SR36).
- [x] Hostile run ids on both routes and in `readHeld`: `../`, `%2F`, an absolute path, NUL, arrays and objects (ST7,
      RT13, RT23).
- [x] A multi-byte character split across pipe writes (SS19); E2BIG (SS9); a stderr flood (SS25); a production-sized
      scan (SS21).
- [x] Integers: 2^53+1 through the fingerprint and `readAll` (SW21, SWR53, SL4); `neo4j.int` counts (SWR40, SWR45);
      BigInt against number typing (SL1, SL2).
- [x] Concurrency: concurrent claims (ST12), the withdraw race both ways (RT19, RT20), a create race (SWR47, SL11),
      lock first (SL12), snapshot conflicts with the rule ONLINE and gone (SR34, SR35), a transient commit retry
      counted once (SWR48).
- [x] Crashes and stops:
  - a crash between the temp write and the rename (ST3, ST5);
  - SIGTERM between batches (SR50);
  - ENOSPC on a pre-image (SR49);
  - a failure after a committed batch (SR52, SR53);
  - a stale running record (SR11);
  - a zombie, a reused pid, and a process name containing `) Z ` (ST16–ST18).
- [x] Limit boundaries (SW36, SW46), a base beside left-in-place rows (SW45), and no memory between passes (SW49).
- [ ] "Restart → stopped": the ADR says the Tester does not pin it. Liveness is covered (ST17, ST18, RT2).
- [ ] The exit code of a `not-started-under-the-lock` refusal: not tested either way (a question for this gate).
- [ ] The Dashboard banner and fix button in a browser: SWR8 checks the list only; there is no Playwright test.
- [ ] The wrapper's real `flock` and `exec`: it is read as text (SWR50), because it sources `/etc/brainstorm.conf`.
- [ ] The boot hook against a real Neo4j, and the real queue: an injected runner (SWR32–SWR38) and a faked
      `runViaQueueAsync` (RT17) stand in.
- [ ] A full pass against a shared graph, or a published tagging: never, by the ADR (Seams → Live). The local
      end-to-end run and the staging backfill are evidence, not tests.

## Test infrastructure

- **Framework:** the gate engine (`npm test` → `test/test.js`, suites in `test/registry.js`); read a run with
  `npm run gate:status`. Each suite also runs alone through its `run()` export. Hand-rolled house style; no new
  framework.
- **Registration:** six lines after `tagging-edge-contract.test.js` in `test/registry.js` (G5 of
  `test/stack-free-npm-test.test.js` passes with them).
  - `tagging-edges-sweep.test.js`
  - `strfry-scan-strict.test.js`
  - `tagging-edges-runner.test.js`
  - `tagging-edges-state-routes.test.js`
  - `tagging-edges-wiring.test.js`
  - `tagging-edges-live.test.js`, with a `skipNote` such as `no local Neo4j in the environment (NEO4J_URI /
    NEO4J_USER / NEO4J_PASSWORD)`.
- **Node:** the host runs v16.17.0 and CI runs Node 22. No suite uses global `fetch`, `structuredClone` or
  `node:test`. Red counts are identical on 16.17.0 and 22.23.3 (a scratch x64 build).
- **Fake strfry on PATH** (strfry-scan-strict): a throwaway shell script, first on PATH, from the
  `test/setup-status.test.js` X1–X4 pattern. It records its argv, writes prepared stderr, prints prepared stdout one
  pipe write per part, then exits, kills itself with a signal, or hangs. Its modes cover the ADR's list: ok, fail,
  hang, truncated, logline, dup-id, off-filter, not-object, split-utf8, signal, stderr-error, too-large, and strfry
  absent. SS3, SS8, SS9 and SS27 inject `spawnImpl` instead. SS27 needs about 1 GB of memory and about 3 s.
- **Fake ports** (runner): all eleven ports (`now`, `randomId`, `lock`, `state`, `identities`, `env`, `openGraph`,
  `scan`, `emit`, `proc`, `signals`) are faked and share one call log. The planner is the real `sweep.js`. The real
  entry runs in a child process only for `--lock-busy` and for a hand run outside the lock, with no `NEO4J_*` and no
  identity in its environment.
- **Fake driver** (wiring): neo4j-driver's `driver` factory is swapped, for one test, for an in-memory graph. It
  answers the ADR's statements and SHOW with real Records, real ResultSummary counters and `neo4j.int` counts.
  - `ensureTagsConstraint` waits on a fake clock.
  - The boot hook takes an injected runner, sleep and log.
  - The fresh-install seed is read in a child process with a temp `SCHEDULED_TASKS_CONFIG_PATH`.
- **Fake `/proc` and an fs tracer** (state-routes):
  - An injected `readFile` serves `/proc/<pid>/stat` and fdinfo, never the host's `/proc`.
  - A tracer on `fs`, `fs.promises` and `FileHandle` records every call under the temp state directory. It also
    simulates the crash between temp write and rename, and a pass claiming right after the route writes.
  - RT9b alone points `TAPESTRY_SETTINGS_PATH` at a temp `settings.json` naming the admin. It restores the variable
    and forgets the house modules afterwards.
- **Live read-only suite:**
  - It takes `NEO4J_URI`, `NEO4J_USER` and `NEO4J_PASSWORD` from the environment only. It never reads
    `/etc/brainstorm.conf` and never prints the password.
  - The URI must name a local host and carry no credentials; anything else skips.
  - Missing variables or an unreachable Bolt port skip every test.
  - `TAPESTRY_REQUIRE_LIVE=1` turns an all-skipped read-only class into a failure.
  - Once the modules exist, a read-only test with no stack skips with its reason.
- **Opt-in write sandbox:** `TAGGING_EDGES_LIVE_WRITE_TESTS=1`, off by default.
  - It works only on per-run random fake pubkeys, checked absent first.
  - It needs `tags_address` ONLINE: restart the backend after implementing, so the boot hook creates it.
  - It writes only its own fixtures through the pass's own port, and deletes only them, never with `DETACH`.
  - It runs no pass, reads no relay and publishes nothing.
  - Do not run it while a `reconcileTaggingEdges` pass runs on the same stack.
- **Firmware state:** none. No concept definition changes (ADR: "Firmware reinstall required? No").
- **Fixtures:** `test/helpers/taggingEdgesFixtures.js` holds:
  - fake identities (`CANONICAL`, `LOCAL`, `OTHER_DEPLOY`, people, `pubkeyOf(label)`);
  - stamps;
  - builders for taggings, elements, non-taggings, deletions and bulk taggings;
  - a lazy `contractEdge`;
  - READ_ALL rows (`storedRow`, `storedRowFor`).

  It mirrors story 1's fixtures, so the parity test reads the same truth table. It is pure: nothing under `src/` is
  required at load. Every suite is hermetic: temp directories come from `fs.mkdtempSync(os.tmpdir())` and are removed,
  and env is restored.

### Shapes the suites fix where the ADR is silent

These are Test Design choices. Each suite's header records them, and none widens a criterion.

- **Handlers:** `handleX(req, res, deps)`, the `handleSetupStatus` precedent. `deps` carries `readFile`,
  `isQueueAvailable`, `runViaQueueAsync` and `getOwnerPubkey()`.
- **`state.js`:**
  - `writeHeld(runId, list)` and `readHeld(runId)` return the list.
  - `claimConfirmation(runId)` returns the record (itself or as `.record`), or nothing when there is none.
  - `withdrawConfirmation()` is truthy or falsy and never throws.
  - `isAlive` takes the report record (`process: { pid, startTime }`).
  - `heldDigest` is lower-case hex.
  - `state.js` creates `held/`, `claimed/` and `preimages/` itself.
- **The runner's ports:**
  - `now()` returns milliseconds and `randomId()` 8 hex characters.
  - `lock.held()`.
  - `scan(filter, { timeoutMs, isExpected })`.
  - `emit(eventType, metadata)`.
  - `proc` is `{ pid, argv, exitCode }`.
  - `signals.on(...)`.
  - `mintedAt` and `expiresAt` are ISO-8601 strings.
- **`graph.js`:**
  - `CYPHER` is keyed by the ADR's statement labels.
  - `applyLocked` kinds are `'update'`, `'move'` and `'remove'`, the report's `lostRace` keys.
  - `ensureTagsConstraintOnBoot` returns a promise.
- **`sweep.js`:** open shapes are read tolerantly: `desired` edge-shaped or `{ from, to, props }`; `byAddress` a Map
  or an object; `conflicts` a count, Set, Map or array. The exception is SW54 (C6).

## How to run

```
npm test
```

Only the story-2 suites, through the gate engine (writes a run record):

```
node -e "require('./test/helpers/gateRunner').runGate({ suites: ['tagging-edge-contract','tagging-edges-sweep','strfry-scan-strict','tagging-edges-runner','tagging-edges-state-routes','tagging-edges-wiring','tagging-edges-live'].map((s) => ({ file: s + '.test.js' })), label: 'tagging-edges-2' })"
npm run gate:status -- --label tagging-edges-2
```

One suite alone:

```
node -e "require('./test/tagging-edges-runner.test.js').run().then(r=>console.log(JSON.stringify({pass:r.pass,fail:r.fail,skipped:r.skipped})))"
```

The live suite against the local stack: read-only first, then the opt-in sandbox.

```
NEO4J_URI=bolt://localhost:<published Bolt port> NEO4J_USER=neo4j NEO4J_PASSWORD=… node -e "require('./test/tagging-edges-live.test.js').run()"
TAGGING_EDGES_LIVE_WRITE_TESTS=1 NEO4J_URI=… NEO4J_USER=… NEO4J_PASSWORD=… node -e "require('./test/tagging-edges-live.test.js').run()"
```

## Clarifications for the owner to ratify

The suites pin these where ADR 0002 is silent or ambiguous. On approval they go into ADR 0002 as a "Clarifications
(Test Design, 2026-09-27)" section, as story 1's did into ADR 0001.

- **C1.** `deps.identities` is `{ canonicalZ(), getOwnerAssistantPubkey() }`; the second returns the result of
  `src/utils/assistantKeys.js`'s helper. The runner reads the env and conf sources itself, from `deps.env`. (The test
  uses the helper's own name, which the ADR names at :105.)
- **C2.** `run(deps)` resolves to the final report and leaves the exit code on `deps.proc.exitCode`:
  - 0 for done or held;
  - 2 for refused;
  - 1 for failed;
  - 0 for `--lock-busy`.

  It never calls `process.exit`. The `require.main` entry passes `process` as `proc`.
- **C3.** A start outside the lock emits TASK_START, TASK_ERROR and then TASK_END `{ outcome: 'not-started',
  reasonCode: 'not-started-under-the-lock', why }`, and touches no file.
- **C4.** `ensureTagsConstraint({ timeoutMs })`:
  - sends `CREATE_TAGS_CONSTRAINT` in its own auto-commit statement, and only when the rule is not present;
  - then re-reads the SHOW rows until the owned index is ONLINE or `timeoutMs` passes;
  - resolves to `schemaStatusFromRows`' answer from its last read;
  - rejects with the Neo4j error when the CREATE fails.

  The runner refuses `schema` unless `tagsAddress` is present and online.
- **C5.** Each apply resolves `{ applied, lostRace, nodesCreated, transientRetries, appliedAddresses }`, with
  `applied === appliedAddresses.length`. The report attributes `added`, `changedBy`, `removedBy`, `unresolved`,
  `strippedKeys` and `confirmed.removalsApplied` to those rows only.
- **C6.** Port row shapes:
  - `applyLocked(kind, rows)` takes rows `{ address, snapshot, desired }`; a removal has no `desired`.
  - `applyCreates` takes `{ address, desired }`.
  - The port computes `fingerprint(snapshot)` and `toWriteProps(desired)` itself.
  - `planPass` items are these rows; extra keys are ignored.
- **C7.** A failed verify re-read rejects `applyLocked` with `err.read === 'graph-verify'`; the runner copies it to
  `failure.read`.
- **C8.** Runner step 8 checks every snapshot row for the eight READ_ALL columns itself (`props` an array), whatever
  port supplied the rows.
- **C9.** `schemaStatusFromRows` returns `{ tagsAddress, nostrUserPubkey }`, each `{ present, online, name,
  underAnotherName }`.
  - `present` means the definition is listed.
  - `online` means its owned index is ONLINE.
  - The pass needs `tags_address` present and online, and `nostrUser_pubkey` present.
- **C10.** `handleConfirmHeldRemovals` reads the owner through an injected `getOwnerPubkey()`, defaulting to the
  configured `BRAINSTORM_OWNER_PUBKEY`.
- **C11.** The handlers make every read through the injected `readFile` (`readFileSync`-shaped; awaiting it works):
  `report.json`, `confirmation.json`, the held file and `/proc/<pid>/stat`. They pass it on to `isAlive(record,
  { readFile })`.
- **C12.** `confirmationPending` carries every field of the record except `nonce`, and may add derived keys such as
  `expired`. The nonce appears nowhere in the answer.
- **C13.** The confirm route mints `nonce` as 32 lower-case hex characters (`crypto.randomBytes(16)`). The name
  `claimed/<runId>-<nonce>.json` is then built only from checked grammars.
- **C14.** Each PROGRESS event names its phase as `metadata.phase`, using the report's `phases[].phase` names, with its
  `ms`. The events come in the ADR's nine-phase order.
- **C15.** Every rewrite of the record before the final report keeps `outcome: 'failed'`, `stopped: true`,
  `reasonCode: 'stopped'`, `running: true` and the run's `runId`. That covers each phase boundary and at least every
  10 write batches.
- **C16.** Within each write call, rows are ordered by the desired edge's `(from, to)`. The order is pinned only within
  a batch.
- **C17.** `readSchema()` and `readAll()`:
  - `readSchema()` returns `{ constraints, indexes }`, the SHOW rows as plain objects, and writes nothing.
  - `readAll({ timeoutMs })` runs READ_ALL in one `executeRead` with `{ timeout: timeoutMs }`.
  - It resolves to a plain array of rows keyed by the eight columns, with driver values untouched, so Integers stay
    lossless.
- **C18.** `strippedKeys` holds one entry per edge that lost a key, names only, for the first 100 such edges.

**Ruled by the owner at this gate (2026-09-27):** C2, C9 (present only), C12 and C13 as written; a hand run outside the
lock exits 2 (C19 in ADR 0002, pinned by SR7); SS27 keeps only its over-limit half. The clarifications are recorded in
ADR 0002 § "Clarifications (Test Design, 2026-09-27)". The questions as they were put:

- **C2:** the alternative is that the entry maps `run()`'s result itself. Exit codes would then be tested only through
  the child entry (SR4 today), and the 0 / 2 / 1 mapping would lose its coverage.
- **C9:** whether `nostrUser_pubkey` must also be ONLINE. The suites chose present only, as runner step 6 reads.
- **C12 and C13:** allowing derived keys in `confirmationPending`, and fixing the nonce at 32 hex characters.
- **Not tested either way:** the exit code of a `not-started-under-the-lock` refusal. "The same way" as `--lock-busy`
  suggests 0; the blind reference exits 2.
- **SS27's cost:** about 1 GB of memory. The alternative keeps only its "256 MiB + 1 byte is too large" half.

## Validation of the suite itself (2026-09-27)

**Against a blind reference.** A reference implementation was written from the ADR alone, blind to the tests, in a
separate worktree. It was run on Node 16.17 and 22.23, as it stands and with the clarifications above bridged in.
Counts are pass / fail.

| Suite | Current tree (red) | Reference as written | Reference with bridges |
|---|---|---|---|
| tagging-edge-contract | 82 / 15 | 97 / 0 | 97 / 0 |
| tagging-edges-sweep | 0 / 54 | 53 / 1 (SW54, C6) | 54 / 0 |
| strfry-scan-strict | 0 / 27 | 27 / 0 | 27 / 0 |
| tagging-edges-runner | 0 / 62 | 7 / 55 (C1 hides everything) | 62 / 0 |
| tagging-edges-state-routes | 1 / 48 | 38 / 10 before RT9b (C10 ×9, C11 RT5) | 49 / 0 with RT9b |
| tagging-edges-wiring | 0 / 54 | 44 / 10 (C6 ×9, C7 SWR49) | 54 / 0 |
| tagging-edges-live | 0 / 6, 10 skipped | 16 skipped | 16 skipped |
| applicability-republish, setup-status (neighbours: BK1's seed window, X1) | — | 8 / 0 and 38 / 0 (2 skipped) | same |

**Triage of the reference's failures.**

- **Test bug, test fixed:** S2C11's matcher now also accepts a revoke that named only the newer version's id.
- **ADR silent, clarification written and bridged into the reference:** C1, C2, C3, C6, C7, C8, C10 and C11. The
  bridge diff touches the reference's `index.js`, `sweep.js`, `graph.js` and `reconcileTaggingEdges.js`.
- **Reference bug, no test change:**
  - RT14: the reference reads `/proc/<pid>/stat` before it checks that the posted `runId` is the latest report's. The
    ADR puts that check before any file other than `report.json`. The bridged run confirms the test.
  - SR31 and SR7 are the reference's to fix (C8 and C3).

**Self-checks while writing.** Each of these edits to the reference fails the matching new test:

- saving every 11 batches (SR56);
- dropping the `(from, to)` sort (SR60);
- reader defaults of 5 s (SS26) and 255 MiB (SS27).

**Mutation run.** The mutants ran against a copy of the bridged reference. The unbridged one fails 55 runner tests
before any mutation, so it cannot show kills. Each mutant ran in a fresh process against the six stack-free suites.
The copy was restored byte for byte after each one. All 20 requested mutants (29 variants) were killed, and so were
four of the six extra variants (M1b, M2b, M8b, M14b):

| Mutant | Killed by |
|---|---|
| M1 relay read before the graph read; M1b scan started beside it | SR29, SR30, SR31, SR56 |
| M2 confirmed run judged against `base`, not `base − \|C\|`; M2b also reported that way | SW38, SW47, SW48 (+ SW39, SR42 for M2b) |
| M3 base counts left-in-place rows | SW45, SW48 |
| M4a admin admitted (injected); M4b `localTrusted` admitted; M4c house `isOwner(req) \|\| localTrusted` | RT9; RT10; RT10 (localTrusted half) |
| M5a `heldPath` unchecked; M5b `handleHeld` serves the query `runId` unchecked; M5c no grammar check | ST7; RT23, RT24; RT23 |
| M6 stored edge kept over an older relay version | SW28, SW29, SW32, SW42 |
| M7 conflicting relay address dropped, not marked | SW15, SW50, SR61 |
| M8 claim before the identity check; M8b claim before config and schema | SR14–SR16, SR18, SR19, SR21, SR24, SR27, SR28; SR21, SR24, SR27, SR28 |
| M9a/b a SET on NostrUser (CREATE_IF_ABSENT, MOVE) | SWR14, SWR15 |
| M10 CREATE_IF_ABSENT without the absence check | SWR19, SWR39, SWR46–SWR48 |
| M11a applied move counted as removed; M11b moves counted toward the limit | SR38, SR40; SW43 |
| M12a/b floor or fraction compared with `>=` | SW36, SW49; SW36, SW43, SW46 |
| M13 `checkIdentity` accepts upper case | SW7, SR13–SR16, SR18, SR28 |
| M14 pessimistic record first written after the graph read; M14b after the schema checks | SR8, SR9 |
| M15a/b removals before creates | SR38, SR49, SR57; SR38, SR49 |
| M16 fingerprint ignores raw non-scalar values | SW21, SWR41 |
| M17a/b keep rule ignores `tagEventId` | SW22, SW31 |
| M18 boot hook stops on `Security.Unauthorized` | SWR34 |
| M19 `scanStrict` skips unparseable lines | SS14 |
| M20 claim honoured without the digest check | SR44 |

- **M4d survived:** the handler also admitted an admin named in the house admin list
  (`require('../../utils/config').isAdminPubkey`). RT9 put the admin only in the injected dependencies, and no test
  filled the house list. **RT9b** was added before RT10. It points `TAPESTRY_SETTINGS_PATH` at a temp
  `settings.json` naming the admin, and first asserts that the house list really names them, so it cannot pass for the
  wrong reason. On the bridged reference it passes: 49 / 0 on Node 16.17.0 and 22.23.3. With M4d applied it fails:
  "answered 200 … expected 403". It also kills M4a, M4c and M4e directly. M4e is the handler gated by the house
  `isOwner(req)` alone; before RT9b only RT12–RT20 caught it, and only because this host has no
  `/etc/brainstorm.conf`.
- **Kills that rest on one test** (no change needed): M4a (RT9), M4b (RT10), M5a (ST7), M5c (RT23), M11b (SW43), M18
  (SWR34), M19 (SS14, one case), M20 (SR44).

## Verification

The new tests fail on the current code. Confirmed on 2026-09-27 at commit `dfdb7595`, plus the uncommitted suites,
each suite through its `run()` export. Node v16.17.0 and v22.23.3 give identical counts:

```
tagging-edge-contract: 82 passed, 15 failed
tagging-edges-sweep: 0 passed, 54 failed
strfry-scan-strict: 0 passed, 27 failed
tagging-edges-runner: 0 passed, 62 failed, 0 skipped
tagging-edges-state-routes: 1 passed, 48 failed, 0 skipped
tagging-edges-wiring: 0 passed, 54 failed
tagging-edges-live: 0 passed, 6 failed, 10 skipped
```

Failure reasons, grouped:

- **contract (15):**
  - S2C1–S2C4: the element's first `d` is still used (R2-NB2, today's behaviour).
  - S2C6–S2C8: `stamp` is not exported.
  - S2C9–S2C16: BIBLE is not updated yet.

  The 82 passing are story 1's 81 and S2C5 (R2-10, behaviour shipped with clarification 9).
- **sweep (54):** 53 `tagging-edges sweep planner not implemented yet (require … Cannot find module)`; 1 (SW1)
  `sweep.js does not exist yet`.
- **strfry-scan-strict (27):** `src/lib/strfryScanStrict.js not implemented yet`.
- **runner (62):**
  - 46 `reconcileTaggingEdges.js not implemented yet (require failed …)`;
  - 5 `… (no such file)` (the child-process and source tests);
  - 10 multi-case tests whose 42 cases all fail on the same missing module;
  - 1 `sweep.js not implemented yet`.
- **state-routes (48):**
  - 40 `state.js not implemented yet`, RT9b among them, since its fixture needs `state.js`;
  - 6 `src/api/tagging-edges/index.js not implemented yet`;
  - 2 `taskRegistry.json has no reconcileTaggingEdges entry yet`.

  RT28 passes on purpose: that behaviour is already right.
- **wiring (54):**
  - 42 `graph.js not implemented yet`;
  - 12 wiring not added yet: the registry entry (5), the key count, the fresh-install seed, the server list, the
    Dashboard list, the setup script's last statement, the boot-hook call and the route registration.
- **live (6 failed, 10 skipped):**
  - SL2–SL7 fail on `graph.js not implemented yet`, checked before any stack is looked for;
  - SL1 skips (no `NEO4J_*` in the environment);
  - SL8–SL16 skip (the sandbox is not opted in).

Every failure is a missing module or export, missing wiring or BIBLE text, or today's behaviour differing where the
story changes it (R2-NB2, `stamp`). None is a syntax error, and no suite crashes on load.
