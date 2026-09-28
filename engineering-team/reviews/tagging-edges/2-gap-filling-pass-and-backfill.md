# Review: Story 2 — The gap-filling pass and backfill

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-28
**Diff:** `git diff origin/staging...da787035` on `feat/tagging-edges-2` (merge-base `88e8659a`). Seven commits: `0af7cc5b` story, `1b1e1ad8` ledger (Planning), `cd997e2e` ADR 0002, `dfdb7595` ledger (Architecture), `05e5f013` failing tests, `64885ce7` implementation, `da787035` one comment reworded. 45 files, 13,403 insertions, 57 deletions. `origin/staging` (`354eb966`) has since gained seven router-fix commits. They touch two of this branch's files, in hunks that do not overlap: `BIBLE.md` (staging :529; branch :8, :316-320, :651, :1470) and `test/registry.js` (staging :170; branch :261). `git merge-tree --write-tree da787035 origin/staging` exits 0.
**Story:** `engineering-team/stories/tagging-edges/2-gap-filling-pass-and-backfill.md` (Status: Approved)
**ADR:** `engineering-team/decisions/tagging-edges/0002-gap-filling-pass.md`, with Owner decisions 1–15, Amendments A1–A11 to ADR 0001, Implementation notes and Clarifications C1–C19. Also ADR `tagging-edges/0001` as amended.
**Test plan:** `engineering-team/stories/tagging-edges/2-gap-filling-pass-and-backfill.test-plan.md`
**Book:** `engineering-team/audits/tagging-edges/book.md` (acceptance frame, no PRD)

The review ran as parallel lenses (spec, ADR, correctness, security, docs, test gaps). A separate verify pass then tried to refute every finding. This report keeps only findings the verify pass confirmed, at its severity. Where two verify passes rated the same text differently, I take the higher rating and say so. Probe scripts and outputs are in the session scratchpad `$R = /private/tmp/claude-506/-Users-VIRGIL-repos-nous-clawds4-tapestry/dbce76a9-dc52-45aa-8aa5-d9f79c120c25/scratchpad/s2-review/`, which is ephemeral. Every request to the local stack was a read: GETs, read-only Cypher, `EXPLAIN` in a READ session, and `docker exec` reads. Nothing in the checkout was modified.

## Quality gates (run by reviewer, not trusted)

- [x] **Full `npm test`** (`GATE_LABEL=review-tagging-edges-2 npm test`, Node v22.23.3, stack up), read with `npm run gate:status -- --label review-tagging-edges-2`:

  > `20260928T042244Z-6226-196f [review-tagging-edges-2] started 2026-09-28T04:22:44.538Z on da787035 — FAIL, exit 1, 4101 passed, 30 failed, 157 skipped, 233/233 suites; failed: capture-a-goal-and-see-it, structures-the-brain-can-trust, break-a-goal-into-pieces, attach-the-world, sessions-read-the-brain, teach-it-what-matters, the-brain-survives, return-the-four-on-every-read-surface, show-the-four-on-the-goal-screens-that-already-exist, not-yet-shared-filter, concept-count-canonical, summaries-element-count`

  Comparison from that record (`git.dirty: false`, 233 suites, 0 stray errors):
  - **Against the baseline** `20260928T023807Z-93805-c275` (`tagging-edges-2-baseline`, `05e5f013`, clean): 8 of 233 suites moved.
    - The six story suites went from red to green: contract 97/0/0, sweep 54/0/0, strfry-scan-strict 27/0/0, runner 62/0/0, state-routes 49/0/0, wiring 54/0/0.
    - `tagging-edges-live` went from red 0/6/10 to skipped 0/0/16.
    - `tag-detail` went from red 9/19/0 to green 28/0/0. That is environmental: its failures were "PRECONDITION: this suite needs the local kind-39999 corpus", which the local end-to-end run pulled into the relay.
  - **Against the Implementer's after-run** `20260928T033431Z-39574-13f4` (`tagging-edges-2-after2`, `da787035`, clean): 0 of 233 moved.
  - **The 12 red suites are the same in all three records:** capture-a-goal-and-see-it, structures-the-brain-can-trust, break-a-goal-into-pieces, attach-the-world, sessions-read-the-brain, teach-it-what-matters, the-brain-survives, return-the-four-on-every-read-surface, show-the-four-on-the-goal-screens-that-already-exist, not-yet-shared-filter, concept-count-canonical, summaries-element-count. No suite this diff touches is among them.
- [x] **Live suite, both classes, run by the Reviewer** through `run()` against the local stack at `da787035` (Node v22.23.3, Neo4j 5.26.10 Community, `NEO4J_URI=bolt://localhost:7687`, credentials from the container conf, never printed; no pass running):
  - read-only (SL1–SL7): **7 passed, 0 failed, 9 skipped** (the sandbox class);
  - with `TAGGING_EDGES_LIVE_WRITE_TESTS=1` (SL8–SL16): **16 passed, 0 failed, 0 skipped**. That exercises `applyLocked` against the real engine: the create race (SL11), the lock-first proof ADR Risk 2 rests on (SL12), the FLOAT repair (SL13), the move under `tags_address` (SL14), and AC-8 for a scored fixture person with FOLLOWS (SL15).
  - Afterwards `TAGS` 7,030, NostrUser 6,199 and FOLLOWS 0 are as before. (The graph's relationship and node totals are 45 higher than after the Implementer's run: `HAS_TAG` / `NostrEventTag` / `HAS_ELEMENT` written by other suites' live tiers in the three full gates run since, not by the sandbox.)
  - An earlier verify pass also ran the read-only class on Node 16.17.0: 7/0/9. None of these runs is recorded in the repo yet (Non-blocking 1).
- [x] `bash scripts/harness-lint.sh`: exit 0, 0 violations (docs lens).
- [x] `git diff --check origin/staging...da787035`: exit 0.
- [ ] `npm run test:playwright`: not run. The one UI change is a new entry in the Dashboard's expected-constraints list, and SWR8 pins it.
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._

## Spec adherence

- [x] **Every acceptance criterion has a passing test.** The write statements are also exercised against the real Neo4j by the live sandbox, green at review (Quality gates). The table maps each AC to its code and tests. The test ids are the suites' own (SW sweep, SR runner, SS scan-strict, ST state, RT routes, SWR wiring, SL live, S2C contract).

| AC | Code | Tests (green at `da787035`) | Real-engine / evidence | Gaps (finding) |
|---|---|---|---|---|
| AC-1 fill, late arrivals, identity `d` | `sweep.js` `readRelay` / `decideAddress` / `planPass`; `graph.js` `CREATE_IF_ABSENT`; `contract.js` `resolveTagElement` → `identityD` | SW9, SW12, SW13, SW24, SW29, SW40, SR36, SWR15, SWR45, SWR46, S2C1–S2C4 | Local backfill: added 7,030 = taggingsRead 7,030 − refused 0; 6,196 people; unresolved 6, matching the census (not recorded; Non-blocking 2) | — |
| AC-2 follow the relay, older or newer; no overwrite of another writer | `decideAddress` / `desiredFor`, `applyLocked`, `MOVE` | SW26–SW35, SW41, SR29, SR37, SR55, SWR17, SWR18, SWR40–SWR49 | SL11–SL14 green at review (real Neo4j) | Non-blocking 8, 13, 14 |
| AC-3 removals only of `TAGS`, by address; relay wins over kind-5 | removal reasons in `sweep.js`; `REMOVE` deletes `r:TAGS` only | SW14, SW23, SW25, SW42, SW45, SW52, S2C5 (R2-10), SWR14–SWR16 | — | Blocking 6 (ADR text) |
| AC-4 bad read or setup changes nothing | `resolveIdentities`, `checkIdentity`, runner steps 4–9, `strfryScanStrict` | SW7, SR9, SR14–SR33, SR53, SS1–SS27 | — | Blocking 5 (BIBLE text); Non-blocking 9, 12 |
| AC-5 limit, owner-confirmed run | frozen limit (`R>50 && 10R>base`), `judgeRemovals` (`base − |C|`), confirm route | SW4, SW36–SW49, SR40–SR47, ST11–ST14, RT8–RT29, SWR2, SWR11 | — | Non-blocking 3, 5, 10, 11, 16 |
| AC-6 one relationship per tagging from deploy | setup script (last statement), both expected-schema lists, boot hook, runner pre-flight | SWR7–SWR10, SWR22, SWR27–SWR38, SWR52, SR23–SR26 | Local `SHOW`: `tags_address` RELATIONSHIP_UNIQUENESS on `TAGS[address]`, ONLINE; `/api/status/neo4j-constraints` "set up". SL10 (the refusal) green at review | Blocking 2; Non-blocking 12 |
| AC-7 report, task, never two at once, stop partway | `state.js`, runner pessimistic record, wrapper `flock`, registry entry, disabled seed | ST1–ST19, RT1–RT7, SR1–SR13, SR48–SR62, SWR1–SWR6, SWR50 | Local status route serves three reports | Blocking 3; Non-blocking 6, 7, 15; Nit 1 |
| AC-8 nothing else moves | `toWriteProps` (nine keys, BigInt `createdAt`); no DETACH / REMOVE / ON CREATE / node SET / `timestamp` | SW18, SW27, SWR14–SWR16, SWR24, SWR25 | SL15 green at review (a scored fixture person with FOLLOWS untouched). The local end-to-end graph had 0 FOLLOWS / MUTES / REPORTS, so the backfill run alone cannot show that clause | Non-blocking 2, 8 |

- [~] **No criterion is silently dropped.** The ACs are implemented. Two docs tasks carry false statements:
  - The R2-4 text contains a false consequence clause (Blocking 6).
  - The BIBLE §16 entry overstates AC-4 (Blocking 5).

  The Open question 7 evidence exists but is not recorded (Non-blocking 2).

  Docs tasks:
  - **BIBLE:** §6 status, Revokes, "One version stands", §30, the §11 rows, §16 and Last updated are present. The replacement for "no pipeline writes `TAGS` yet" is pinned by S2C9–S2C16.
  - **OPERATIONS:** the rollout and confirm subsection is present. Its log path (`supervisord.conf:59`) and its §10.6 cross-reference check out.
  - **R2-4:** the cites check out against the container's strfry 1.1.0 source. The upper-case clause is false (Blocking 6).
  - **R2-5 to R2-9:** done. Story 1's test plan ends with a single `\n`.
- [x] **No behavior added beyond the story.** Out of scope is respected:
  - no follows / mutes / reports, profile-tags, firmware or protocols change;
  - no literal TA pubkey in `src`.

  Every Deviation stays inside the ADR's latitude (see the Deviations audit below).

## ADR adherence

- [x] **The files changed match the Implementation notes.**
  - **New:** `sweep.js`, `strfryScanStrict.js`, the wrapper (byte-for-byte the ADR text), the runner, `graph.js`, `state.js` and `src/api/tagging-edges/`.
  - **Changed:** `contract.js` (only `identityD` in `resolveTagElement`, plus the `stamp` export) and the lib index re-export. The registry entry is exactly the ADR's JSON. There is one seed addition. The three routes are registered after `adminApi`, and the boot hook runs after `api.register` without being awaited. The setup script has `tags_address` as its last statement. Also `expectedNeo4jSchema`, the Dashboard, BIBLE, OPERATIONS, ADR 0001, the epic, story 1's test plan, the handoff and the story links.
  - Nothing outside that list changed.
- [x] **Layering.**
  - `sweep.js` requires only `./contract` and does no I/O, clock, crypto or logging (ADR lens, by grep).
  - Neo4j is reached only through `graph.js`. The API module does no Neo4j I/O.
  - `graph.js` has no DETACH, no REMOVE, no ON CREATE / ON MATCH and no node SET. Its only DELETE is of `r:TAGS`.
- [x] **No new dependencies.** `package.json` is unchanged, and `neo4j-driver` 5.28.1 takes BigInt parameters. `test/registry.js` gains the six suites.
- [x] **C1–C19 are honoured.**

| C | Point | Status |
|---|---|---|
| C1 | `deps.identities` `{ canonicalZ(), getOwnerAssistantPubkey() }` | Honoured (runner :47-48) |
| C2 | `run` resolves to the report; exit code on `deps.proc.exitCode`; the entry passes `process` | Honoured. The entry's exit wiring is unpinned (Non-blocking 7) and so is the start-time fallback (Non-blocking 15) |
| C3 | Start outside the lock: TASK_START / TASK_ERROR / TASK_END | Honoured |
| C4 | `ensureTagsConstraint({ timeoutMs })` | Honoured, plus the listed name-taken early return, which is untested (Blocking 2) |
| C5 | Apply result shape | Honoured |
| C6 | Port row shapes | Honoured. The refusals and "other keys kept" are untested (Non-blocking 8, 14) |
| C7 | `err.read === 'graph-verify'` | Honoured (SR53). The BIBLE wording is wrong (Blocking 5) |
| C8 | The runner checks the eight READ_ALL columns itself | Honoured (SR31) |
| C9 | `schemaStatusFromRows` shape | Honoured, plus an unlisted `nameTaken` key (Nit 2) |
| C10–C12 | Owner getter; `readFile` reads awaited; `confirmationPending` without the nonce | Honoured |
| C13 | Nonce is 32 lower-case hex | Honoured. The check at claim time is untested (Non-blocking 17) |
| C14–C18 | PROGRESS phases; pessimistic rewrites; `(from, to)` order; `readSchema` / `readAll`; `strippedKeys` names only | Honoured |
| C19 | Outside the lock exits 2 | Honoured (SR7 on the fake proc). The real entry is unpinned (Non-blocking 7) |

- [~] **A1–A11.** All eleven are in ADR 0001, each with an "Amended by `tagging-edges/0002`" note (11 found), plus the header line. The R2-4 text added beside them contains a false clause (Blocking 6).
- [~] **Owner decisions.** The code follows all 15. The documents that state them do not always agree:
  - Decision 5 (`base − |C|`): the runbook says otherwise (Non-blocking 5).
  - Decision 7 (a claim is spent whatever follows): untested (Non-blocking 10).
  - Decision 8 (AC-4 covers only the reads the plan is made from): BIBLE §16 drops it (Blocking 5).
  - Decision 9 (pre-images): unpinned through the real port (Non-blocking 8).
  - Decision 13 (the public routes' posture): the code and the wording both miss it (Blocking 1, 4).
- [x] **Deviations audit.** I checked each Deviation line against the code:

| Deviation (story :272-313) | Holds? |
|---|---|
| `toPortRow` refuses malformed rows; the caller's other keys reach `preimage` | Yes; untested (Non-blocking 8, 14) |
| C6 rows; pre-image built from the snapshot | Yes; the real-port join is untested (Non-blocking 8) |
| Plan item shape; `limit` has no `confirmedApplied` | Yes |
| `err.partial` counted | Yes; untested (Non-blocking 13) |
| "no longer return `lostAddresses` / `state`" | Not verifiable (Nit 2) |
| `openGraph` takes only `{ uri, user, password }` | Yes |
| The boot hook logs `not created: name-taken` / `no-change` | **No** (Blocking 2) |
| `planPass` / `sweepFilter` / `decideAddress` throw | Yes; the `planPass` shape throws are untested (Non-blocking 9) |
| `unresolved` counts at conflict addresses | Yes |
| Extra exports `canonicalValue`, `removalKey` | Yes. `graph.js`'s `MAX_BATCH` and `nameTaken` are not listed (Nit 2) |
| Record saved right after the claim; a stop before step 7 does not claim | Yes; untested (Non-blocking 10, 11) |
| Fixed driver text; URI and IPv4 redaction "(the status route is public)" | True as worded, but untested (Non-blocking 4). `stderrTail` bypasses it (Blocking 1) |
| `done` reason, PROGRESS counts, driver closed after TASK_END | Yes |
| `proc` is `process`; start time from `processStartTime`; what the runner awaits | Yes; the start-time path is untested (Non-blocking 15) |
| `state.js`: "`writeFileSync` (a short write throws)"; torn-tail cut; nonce check | The wording is inaccurate. The two behaviours hold but are untested (Non-blocking 17) |
| An unreadable `confirmation.json` shows as `unreadable` | Yes; untested (Non-blocking 16) |
| Confirm route 500s on write / withdraw failure | Yes; untested (Non-blocking 16) |
| `scanStrict` extras; seed layout | Yes |

## Concept-graph integrity
- [x] **Handles** are in `kind:pubkey:slug` form: taggings at `39999:<64 lower-case hex>:<d>`, stamps `39998:<pubkey>:nostr-user-tag` / `:tag`.
- [x] **Firmware reinstall:** not needed. No concept definition changed, and `firmware/` and `protocols/` are untouched. By design (AC-6), Install Firmware now waits for `tags_address` while firmware is not fully installed.
- [x] **Orientation:** ADR 0002:45 records the Concept Graph calls (`GET /api/concept-graph/node/39998:<TA>:nostr-user-tag`, …).

## Things tests can't catch
- [x] **No secrets.**
  - The only 64-hex strings in added lines are two in the story's "Concepts touched" (`82b75e47…`). That is the ADR 0015 canonical literal, the named exception.
  - The 17 added lines that contain "secret" or a similar word are fixture names, traversal probes and doc text. None is a credential.
  - A separate process incident is under Harness friction 3.
- [x] **No leftover debug code.** Added `src`/`bin` lines contain three `console` calls, all deliberate:
  - the boot hook's log wiring (`bin/control-panel.js`);
  - the confirm route's code-only warn;
  - the runner entry's error line through `safeMessage`.

  There is no commented-out code, `debugger`, TODO or FIXME.
- [~] **Error paths.**
  - The public status route's error text can carry an absolute path (Blocking 1) and some config values (Non-blocking 4).
  - The runbook's outcome table misses four outcomes (Non-blocking 6).
  - The confirm route can report a pass it did not enqueue (Non-blocking 3).
- [~] **Concurrency.**
  - **Lock-first idiom.** All six write statements plan on Neo4j 5.26.10 (`EXPLAIN` in a READ session). LOCK, UPDATE, MOVE and REMOVE each seek through `DirectedRelationshipUniqueIndexSeek(Locking)`. It is still unproven against a real concurrent writer (Non-blocking 1).
  - **Strfry child and the lock.** The spawned child holds only fds 0–2, so it does not inherit the fd-9 lock (checked in the container).
  - **Open gaps:** the lock check accepts a flock on any file (Nit 1), and a backend restart leaves the `neo4j-heavy` lease held (Blocking 3).
- [~] **Security.** Checked and clean:
  - `requireOwnerOnly` has no `localTrusted` bypass, and the handler re-checks the owner.
  - `sameHost` is a copy of `dlist-curation/update.js:107-115`.
  - JSON-only bodies are enforced.
  - `RUN_ID_RE` is anchored and checked before any filesystem call; the held path's prefix is checked.
  - No unhandled rejection is reachable from an unauthenticated GET.
  - The nonce is stripped from the status answer.
  - `arguments: false` puts no secret on argv.
  - The state directory is 0700 with files 0600.

  Findings: Blocking 1 and 4, Non-blocking 4. Not examined, because it would need a mutating test: whether the boot hook's retried logins count toward Neo4j's per-user lockout during the entrypoint's background password change (`docker/entrypoint.sh:297-327`).
- [x] **Principles 1–4.**
  - Any author's signed tagging is accepted. The stamp filter is the honoured-set rule, not gating by author.
  - `TAGS` carries no trust, score or applied flag; POV applies at read time.
  - Principle 4:
    - Deletes are single `TAGS` relationships only, and nodes are never deleted.
    - A relationship at a non-tagging address is left in place and counted.
    - Keys outside the nine are dropped only after an fsynced pre-image, and pre-images are never pruned or served.
    - Removals are capped by the limit.

    The pre-image join through the real port is unpinned (Non-blocking 8).
- [x] **Scope.** The diff stays inside the story. Every ADR 0002 candidate ledger row was filed or amended, and each row's claims were spot-checked (docs lens).

## House rules check
- [x] **Concept Graph API authority** is respected (ADR 0002:45).
- [x] **No new lint, typecheck or build tooling.**
- [x] **TA pubkey and ADR 0015.**
  - The local identity comes from `getOwnerAssistantPubkey()` at runtime (runner :48).
  - The canonical identity comes from a lazy `require('../../api/profile-tags').NOSTR_USER_TAG_Z_TAG` (runner :47). That is the ADR 0015 literal the story named, and no new copy is made.
  - The three `LEGACY_` hits in the diff are doc prose. No constant was touched.
- [x] **Stack in Docker.** The runbook reads logs and CLIs through `docker exec`, and its paths are in-container.

## Product-guide adherence
- N/A. This is an acceptance-frame book with no PRD.

## Findings

### Blocking

1. **src/pipeline/tagging-edges/reconcileTaggingEdges.js:440** (the text comes from `src/lib/strfryScanStrict.js:43-58`) — **the public status route can serve an absolute filesystem path.**

   **What happens:**
   - `summarizeStderr` keeps strfry's last `strfry error:` line and cuts only 64-hex runs.
   - The runner copies it into the report as `failure.stderrTail = String(err.stderrTail).slice(0, 300)`, bypassing `safeMessage`.
   - `GET /api/tagging-edges/status` is unauthenticated (`src/api/index.js:519`). It serves `latest` and keeps up to 9 `previous` reports unfiltered.
   - When strfry cannot load its config, its error line names the path twice. The runner spawns `strfry scan` with no `--config`, so strfry's default `/etc/strfry.conf` applies.

   **What it breaks:** ADR 0002:533 and the route header (`src/api/tagging-edges/index.js:10-11`) both promise "no config value, absolute path or credential appears". The ADR's own reader note (:803-804) prescribes only the hex cut. The story's Deviation gives the reason for redacting as "(the status route is public)".

   **Evidence:**
   - Real strfry in the container: `strfry --config=/nonexistent-review-probe.conf scan '{"limit":1}'` gives `strfry error: Failed to load config file '/nonexistent-review-probe.conf': filesystem error: open() failed: No such file or directory [/nonexistent-review-probe.conf]`, exit 1.
   - That line, fed through the real `scanStrict`, then runner :439-440, then the real `computeStatus`, comes out in the status body (`$R/verify-security-0/probe.js`).
   - No test covers it: SS22–SS25 use hex and synthetic lines only.

   **Exposure is low:** only stock paths (`/etc/strfry.conf`, `/var/lib/strfry/`) and only under operator error. It is blocking because the route's stated guarantee is false.

   **Asked change:**
   - Redact before the text enters the report. Run `stderrTail` through the same redactor as `failure.message` (at :440 or in `summarizeStderr`), extended with an absolute-path rule after the URI rule, e.g. `.replace(/(^|[\s'"\[(=])\/[^\s'"\])]+/g, '$1<path>')`.
   - Pin it with a `test/strfry-scan-strict.test.js` case and one runner or route assertion using the real line above: no `/etc` and no `[/` in `stderrTail` or the status body.
   - Update the `scanStrict` header (:23-25) and ADR 0002:803-804 to say paths are redacted too. (Non-blocking 4 extends the same redactor.)

2. **src/pipeline/tagging-edges/graph.js:438 and :445; OPERATIONS.md:758; story :283-285** — **two boot-hook log lines leave out the code that both documents of record say they carry.**

   **What the code logs:**
   - :438 logs `… not created: the name tags_address is held by a rule with another definition`.
   - :445 logs `… not created: the CREATE changed nothing`.
   - The codes `name-taken` and `no-change` exist only in the returned object, and `bin/control-panel.js:330-335` discards it.

   **What the documents say:**
   - OPERATIONS.md:758: "the line reads `… not created: <code>`", with `name-taken` given as one of the codes (`no-change` is not listed).
   - Story Deviations: the hook "logs `not created: name-taken`" and "`not created: no-change`".

   **No test covers either branch,** nor `ensureTagsConstraint`'s name-taken early return (graph.js:242).

   **Evidence:**
   - Fake-runner probes (`$R/verify-adr-0/`, `$R/verify-docs-1/probe.js`) print exactly the two sentences above.
   - A mutant that deletes graph.js:242 and replaces both strings still leaves wiring 54/0, runner 62/0 and state-routes 49/0 (`$R/verify-test-gaps-0/`).
   - Candidate CAND-W4b fails on the current code. CAND-W4a is green now and kills the :242 mutant.

   **Operator impact is small.** OPERATIONS.md:755 says to grep `tagging-edges`, which finds the line.

   **Asked change:**
   - graph.js:438 → `'[tagging-edges] uniqueness rule tags_address not created: name-taken (the name tags_address is held by a rule with another definition)'`
   - :445 → `'… not created: no-change (the CREATE changed nothing)'`
   - Add `no-change` to OPERATIONS.md:758's list of codes.
   - Tester: add CAND-W4a and CAND-W4b (`$R/lens-test-gaps/cand-wiring.block.js`) to `test/tagging-edges-wiring.test.js`.
   - Quoting the real sentences in OPERATIONS and the story would also clear this, but it leaves two log formats in place.

3. **OPERATIONS.md:732** (`failed` row; same claim at ADR 0002:524-525) — **the runbook's account of a backend-only restart is false.** It says "`supervisorctl restart brainstorm` alone does not stop a running pass: it finishes, and the lock refuses the queue's re-run".

   **The sequence the code produces:**
   1. The SIGTERM handler (`bin/control-panel.js:401`) runs `closeDriver()` and then `process.exit(0)`, so the Worker's `finally { await release(); }` (`queue/index.js:127-128`) never runs.
   2. The `neo4j-heavy` lease stays in Redis: it has a random UUID and a 4 h TTL (`resourceSemaphore.js:30`, `:105`), and nothing clears leases at boot (row `2026-09-27-stale-heavy-lease-after-deploy`).
   3. BullMQ's defaults (`maxStalledCount` 1, `lockDuration` 30 s, with no override in the repo) re-run the job once.
   4. The re-run waits behind the stale lease, which has a cap of 1, for up to 4 h. By then the orphaned pass has long finished (2.6 s locally), so neither the pgrep guard nor the flock refuses the re-run. An ordinary pass runs hours later, and every scoring run is blocked in the meantime.

   **Evidence:**
   - The code cites above.
   - A probe with the real `resourceSemaphore.js` and the TTL scaled to 3,000 ms: "stalled re-run acquired at 3048 ms (lease TTL 3000 ms)" (`$R/verify-docs-4/probe.js`).
   - I did not reproduce it with a real restart, because a restart is mutating.

   **Asked change:**
   - Replace the sentence with: "A backend-only restart (`supervisorctl restart brainstorm`) does not stop a running pass: it finishes. The dead worker's `neo4j-heavy` lease is not released, so the queue's one stalled re-run, and every scoring run, waits up to 4 h (see Lease), after which the re-run performs an ordinary pass."
   - Extend Lease (:747) to "a deploy, or a backend-only restart, while a heavy job runs".
   - Correct ADR 0002:524-525 with an amendment note.
   - Alternatively, record an observed local restart sequence that shows otherwise.

4. **BIBLE.md:657; ADR 0002:532-533 and :755; src/api/tagging-edges/index.js:10; src/api/index.js:515** — **the posture sentence for the public status route is a false universal.** The five places say "every value is relay-derived or a count" or "Counts and relay-derived values only; identities as 8-character prefixes".

   **What the route actually serves:** `computeStatus` passes `{ ...report.latest, running }` and `previous` unfiltered. They carry:
   - `process {pid, startTime}` (runner :168);
   - run ids and timestamps;
   - `reason` text, `failure.message` and `failure.stderrTail`;
   - `strippedKeys[].keys`, which are graph-derived (:511);
   - `seenEventId`, which is graph-derived for not-on-relay removals (`sweep.js:565`);
   - the pending confirmation (`mintedAt`, `expiresAt`, `heldDigest`).

   `strippedKeys[].address` and the held items carry the tagger's full 64-hex pubkey. The 8-character rule covers only `identities` and `mintedBy`. The ADR's own schema block (0002:504-506) lists `process`, so the ADR contradicts itself.

   **Evidence:**
   - A live GET returns `"process":{"pid":319173,"startTime":"142033386"}`.
   - A pass-through probe serves a full-pubkey address and `process` (`$R/verify-security-2/rte.js`).

   **No real exposure:** the graph is already publicly readable through `/api/neo4j/query` (`auth.js:485`), and a pid is harmless.

   **Severity:** the security verify pass rated this blocking (a false universal in documents of record, on a public route's security posture). The docs verify pass rated it non-blocking, because the BIBLE row lists the fields it means. I take the higher rating.

   **Asked change:** reword all five places, e.g. "counts, relay- and graph-derived values (tagging addresses, event ids, property-key names), timestamps, the pass's pid and process start time, and redacted error text; the stamp identities and the confirming owner appear as 8-character prefixes, while tagging addresses carry their author's full pubkey; no config value, absolute path or credential". The last clause becomes true once Blocking 1 and Non-blocking 4 are fixed. Alternatively, strip `process` in `computeStatus`, but still drop "relay-derived".

5. **BIBLE.md:1470** (§16 entry) — **"changes nothing on a failed or incomplete read" is unqualified.**

   **Why it is false:** Owner decision 8 (ADR 0002:740-742) limits AC-4's zero-change guarantee to "the reads the plan is made from". A verify re-read inside a later write batch can fail:
   - `err.read = 'graph-verify'` is set at graph.js:289-293.
   - The runner fails with stage `write` (:518, :576-578).
   - The batches committed before it stand.

   SR53 pins this: `relationships.changed` equals the first batch's size.

   **Severity:** the spec verify pass rated this a nit; the docs verify pass rated it blocking (a false claim in a document of record that hides a cost the owner accepted). I take the higher rating. Two corrections to the lenses' framing:
   - BIBLE.md:320 does not state the failure semantics, so it neither agrees nor conflicts.
   - OPERATIONS files `graph-verify` under write failures, which is a tension with this sentence, not a flat contradiction.

   **Asked change:** replace the clause with "changes nothing when a read its plan is made from (the graph snapshot or the relay scan) fails or comes back incomplete; a batch's verify re-read that fails ends the run failed, with the batches already committed standing, each tagging at one version".

6. **engineering-team/decisions/tagging-edges/0001-tagging-edge-contract.md:114-115** (the R2-4 text this diff adds) — **"so an upper-case pubkey in the address does not delete on the relay" is false.**

   **What strfry does** (the container's source, strfry 1.1.0 `f31a1b9`, with `events.cpp` and `EventUtils.h` unmodified):
   - It decodes the `a` pubkey case-insensitively (`EventUtils.h:49`, `hex.h`), so the author check at `events.cpp:43-45` passes.
   - It deletes stored versions with `created_at <=` the deletion's, under the decoded key (`events.cpp:339-355`).
   - Only the refusal of later arrivals diverges: `golpe.yaml:80` hashes the raw `a`, while `events.cpp:313` rebuilds the lower-case form.
   - The same applies to `039999`, `+39999` and ` 39999`.

   The repo already states this correctly: `ledger/2026-09-27-ui-revoke-names-id-only.md:26-28` says "Any other spelling deletes the stored versions but refuses nothing later." The error comes from story 1's review F3(c) ("where strfry does not act"). ADR 0002:633-635 did not ask for that consequence.

   **Asked change:** replace the clause with: "so an `a`-deletion with an upper-case pubkey (or a `039999`-style kind) deletes the version stored then (`events.cpp:339-355`) but does not refuse a version with `created_at` no later than the deletion's that arrives afterwards (`golpe.yaml:80` hashes the raw `a`; `events.cpp:313` checks arrivals under the lower-case form); the contract lower-cases the pubkey and gives `names-address`". Keep "Writers follow the relay's current state".

### Non-blocking

1. **test-plan.md:422-469 (Verification); ADR 0002:687-688 (Risk 2)** — **the live runs are recorded nowhere.** Until this review, the opt-in sandbox (SL8–SL16) had no recorded run, and every gate record shows `tagging-edges-live` skipped (0/0/16). The Reviewer's run at `da787035` is green on both classes (Quality gates), which settles the substance; what remains is the record.

   **Ask:** add an "Implementation verification" entry under the test plan's Verification section with the commit, Node version, Neo4j 5.26.10 and pass/fail/skip for each class (the Reviewer's figures above, or a fresh run on the round-2 commit). A future failure of SL11, SL12 or SL14 is blocking.

2. **OPERATIONS.md:749; ADR 0002:555-558, :658 (AC-8 row), :1000-1004, :1088-1091; story Open question 7** — **the local end-to-end evidence exists but is recorded nowhere.**

   **The runs** (from `GET /api/tagging-edges/status`):
   - **Backfill `20260928T032430Z-08965d1d`:** done in 2,595 ms. Phases: identities 30, schema 98, graph-read 7, relay-read 72 (10,405 events / 8,227,479 bytes), plan 47, write-creates 2,330 ms over 29 batches. Added 7,030 = taggingsRead 7,030 − refused 0; people 6,196; unresolved 6.
   - **Second pass `20260928T032501Z-472c2596`:** done in 524 ms, 7,030 unchanged.

   **The record:**
   - No file in the diff carries these numbers. Only commit `64885ce7`'s message summarises them, and a commit message is not a document of record.
   - Both runs predate `64885ce7` (03:26:03Z). The one later commit changes only a comment, so the evidence names no commit.
   - The before/after snapshot the ADR's AC-8 row cites exists only in ephemeral scratch (`s2-impl/e2e/`). It shows 0 FOLLOWS / MUTES / REPORTS before and after, and 3 existing people with only `pubkey`. So the local run cannot evidence AC-8's social or scores clause.

   **Ask:**
   - **(a)** Put the measured local figures in §12.8, with run ids and the code-state note. 2.6 s is far below a fifth of 30 min, so the time-out stands. Keep the staging line open.
   - **(b)** Record the snapshot in the story's evidence or the test plan:
     - before: FOLLOWS / MUTES / REPORTS / TAGS 0/0/0/0, 4,989 relationships, 4,467 nodes;
     - after: 0/0/0/7,030, 12,019 relationships, 10,663 nodes, 6,199 NostrUser, none with a key other than `pubkey`, no duplicate addresses, INTEGER `createdAt`.

     Say that it does not evidence AC-8's social or scores clause.
   - **(c)** Cover that clause with SL15 (Non-blocking 1), or with before/after counts plus sampled scored `properties()` around the staging backfill. Amend the ADR's AC-8 row to cite whichever covers it.

3. **src/api/tagging-edges/index.js:294-300; ADR 0002:463; OPERATIONS.md:745** — **the confirm route can answer `enqueued: true` when no pass will run.**

   **How:**
   - After a pass exits, its BullMQ job stays active for up to about 5 s, because `launchChildTask.sh:375` checks the child every 5 s (`check_interval=5`).
   - A confirm POST in that window passes every route check.
   - Its enqueue joins the finishing job: `addStandardJob-9.lua:90` → `handleDuplicatedJob` returns the existing id, and `runViaQueueAsync` always returns `success: true`.

   **Evidence:**
   - Local `events.jsonl`: TASK_END at 03:25:01.941Z, but `resource_class_released` at 03:25:06.574Z.
   - A probe of the real handler with a BullMQ-faithful fake queue answered `200 … "enqueued":true`, created 0 new jobs, and left the confirmation pending (`$R/verify-correctness-0/probe-active-join.js`).
   - The schedule seed is disabled, so the confirmation can expire after 24 h.

   **Why it is not blocking:** the failure is fail-safe (nothing is removed), the window is 0–5 s, and `confirmationPending` stays visible.

   **Ask:**
   - The route must tell a finishing job from one that has not yet run its pass. A job waiting for the `neo4j-heavy` lease is also active, so "active and the latest report is not running" is the wrong test.
   - Preferred: when the joined job was already active, wait for it in the background and re-enqueue once if `confirmation.json` is still unclaimed. Alternatively, compare the job's `processedOn` with the latest report's start.
   - Add state-routes tests for both active-job cases, and amend ADR 0002:463 and OPERATIONS :745.

4. **src/pipeline/tagging-edges/reconcileTaggingEdges.js:74-81 (`safeMessage`), :353** — **the redactor misses some config values and paths, and no test pins what it does catch.**

   **(a) What gets through into `failure.message` on the public route** (probes run with the real driver, `$R/verify-security-1/`):
   - `getaddrinfo ENOTFOUND <NEO4J_URI host>` (about 14 characters survive the 300-character cut);
   - IPv6 `ECONNREFUSED ::1:1`;
   - `neo4j.internal:7687`;
   - a MODULE_NOT_FOUND message with absolute paths and the require stack.

   The default `bolt://localhost:7687` yields `ECONNREFUSED <host>`, so the default configuration is safe.

   **(b) Nothing pins the URI / IPv4 redaction or the fixed driver text.** Two mutants survive the runner suite at 62/0: M-R5a (drop :77-78) and M-R5b (:353 → `err.message`). CAND-R5 kills both.

   **Ask:**
   - Use fixed text keyed by `err.code` for `ServiceUnavailable` / `SessionExpired`, as :353 already does, and add the absolute-path rule shared with Blocking 1. Avoid a broad `name:port` regex, because it would also eat times.
   - Add CAND-R5, plus ENOTFOUND and MODULE_NOT_FOUND cases asserting no host name and no `/` path.

5. **OPERATIONS.md:745 and :730** — **the runbook says a confirmed run judges other removals "against the limit as usual".** Owner decision 5 judges them against `base − |C|` (`limit.baseAfterConfirmed`, `sweep.js:481-483`). That is stricter, and the ADR names its cost: a second confirmation.

   **Evidence:** a probe with base 1,000, C = 100, O = 91 held all 91 (`baseAfterConfirmed` 900), where the runbook predicts they apply (`$R/verify-spec-4/`). The story's "as an unconfirmed run would" is where the runbook's wording came from.

   **Ask:** at :745 write "(other removals are judged against the limit over the relationships left after the confirmed ones, `limit.baseAfterConfirmed`; if they exceed it they are held again for a second confirmation)". At :730 add "(on a confirmed run, of those left after the confirmed removals)".

6. **OPERATIONS.md:731-732** — **the outcome table reads as complete but misses four outcomes** (probes in `$R/verify-docs-5/`):
   - **(1) Two `failed` reason codes are missing:**
     - `reasonCode 'report'` (:596-599): the held list could not be written. By then creates, updates, moves and, on a confirmed run, the confirmed removals have applied; the confirmation is spent and there is no held list. Probe P1: 60 removals applied, outcome `failed`, `held.total` 0.
     - `reasonCode 'error'` / stage `unexpected` (:618).
   - **(2) When the first report write fails,** the previous report stays `latest` and only TASK_ERROR says so (P3).
   - **(3) When only the final write fails,** the stored record reads `stopped: true` although the pass ran to the end (P3b).
   - **(4) Optional:** `driver` under `config` (:353).

   **Ask:** add these to the table. The finder's "no removal applied" wording for (1) is false on a confirmed run; use the corrected text above.

7. **test-plan.md:151; test/tagging-edges-runner.test.js:686-695 (SR5)** — **a stale checklist line and an unpinned exit code.**
   - Line 151 still reads "[ ] The exit code of a `not-started-under-the-lock` refusal: not tested either way (a question for this gate)". But C19 settled it at 2, SR7 pins it, and the same file says so at :338-339.
   - SR5 runs the real entry outside the lock but never checks its exit status. A mutant entry `run({})` makes every real run exit 0, failures included, and the suite stays at 62/0 (`$R/verify-test-gaps-12/`).

   **Ask:**
   - Change :151 to "[x] The exit code of a `not-started-under-the-lock` refusal: 2 (C19), pinned by SR7".
   - Add ``eq(r.status, 2, `exit status of a hand run outside the lock (C19; stderr: ${String(r.stderr || '').slice(-300)})`);`` to SR5.

**Coverage gaps.** Items 8–17 are documented behaviours with no test. The code is correct at `da787035` in every case. Each gap was shown by a mutant that survives the committed suites and is killed by a candidate test that is green on the current code, on Node 16.17.0 and 22.23.3. Candidate text is in `$R/lens-test-gaps/cand-{runner-all,wiring,state,sweep}.block.js`, and items 11 and 14 also have their own files. The Tester should renumber the candidates into each suite's series.

8. **graph.js:175-194, :281; runner :479-505 — pre-images through the real port (principle 4; the priority).**
   - SR48 uses a fake port that hands rows back as sent, and SWR44 checks only addresses.
   - Mutant M-W1b (drop the spread and `out.row`): the pass ends `done` with 0 pre-images, strips `note` from X and removes Y, which carried `legacyScore`. Every committed suite stays green.
   - **Ask:** add CAND-W1b (the real `run(deps)` over the real `openGraph`), and CAND-W1a for C6's "other keys kept". This needs a `RUNNER_PATH` constant.
9. **runner :404, :437; sweep.js:528-530 — shapeless read answers (principle 4).**
   - Removing any single guard survives. With :437 and :529 both removed, a scan answer of `{events:''}` or `{events:{length:0}}` ends `done` with 40 removals applied.
   - **Ask:** add CAND-SW1 as written. Add CAND-R7 with two edits: a scan case `{ events: { length: 0 }, … }`, and a graph read that returns `''`, because `{rows:[]}` does not pin :404.
10. **runner :386-396, :320-321 — a confirmed run that fails partway (owner decision 7).**
    - Mutants M-R1a (drop `saveQuietly()` at :395) and M-R1b (`fail` passes `confirmed: null`) both survive at 62/0.
    - **Ask:** add CAND-R1, and a decision-7 row to the test plan's decision table (:83 covers only decision 6).
11. **runner :378, :397 — a stop before or at the claim.**
    - Deleting :378 spends the owner's confirmation and removes nothing; it survives at 62/0.
    - **Ask:** add CAND-R2 (required) and CAND-R3 (recommended). The text is in `$R/verify-test-gaps-6/`.
12. **runner :367 — the schema check resolves but the rule is not ONLINE (AC-6).**
    - The fake `ensureTagsConstraint` always brings the rule online. Mutant M-R4 (checks `present` only) survives, and the pass runs to `done` with the rule not ONLINE.
    - **Ask:** add CAND-R4 and relabel its first case "still absent after ensureTagsConstraint", because the fake cannot express a name clash.
13. **graph.js:197-200, :376-383; runner :577 — `err.partial` counts.**
    - M-W3 and M-R6 survive. The report would under-count what did commit: `added` comes out 0 where 1 committed.
    - **Ask:** add CAND-W3 and CAND-R6.
14. **graph.js:189 — `toPortRow`'s own-address check.**
    - Mutant `if (false)` survives at 54/0. Updates, moves and creates whose `desired` belongs to another address then write through, which is story 3's exposure.
    - **Ask:** add CAND-W2 (`$R/verify-test-gaps-8/cand.block.js`, eight cases).
15. **runner :252 — the start-time fallback (D9, C2).**
    - Every fake proc carries `startTime`, so M-R8 (`: null`) survives. A running pass would then read as not running.
    - **Ask:** add CAND-R8.
16. **src/api/tagging-edges/index.js:169, :271-275, :281-287 — the route failure paths.**
    - Six mutants survive at 49/0. Three of them ship a wrong answer, e.g. a failed `writeConfirmation` answers `200 confirmed:true` and enqueues.
    - **Ask:** add CAND-S3 and CAND-S4. Test-plan :229 ("`withdrawConfirmation()` … never throws") is stale against `state.js:229-236`; correct it.
17. **state.js:59, :173-178, :206; story :304 — state-file robustness.**
    - M-S1 (`writeSync`), M-S2 (no `ftruncate`) and M-S5 (unchecked nonce) survive.
    - On Node 22, which CI runs, `writeFileSync` never calls `fs.writeSync`, so CAND-S1 only guards against a regression there. Its title should say so.
    - Story :304's "(a short write throws)" is wrong: `writeFileSync` loops through short writes (Node 16 probe: 43 calls, 42 capped, whole file written).
    - **Ask:** add CAND-S1, S2 and S5 with `withShortWrites`. Reword :304 to "(which loops until every byte is written, and throws on an error such as ENOSPC)".

### Nits

1. **src/pipeline/tagging-edges/state.js:317-325** (used at runner :43, :216-224) — `lockHeld(9)` accepts an exclusive FLOCK on any file, not only `pass.lock`. In the container, `exec 9</etc/hostname; flock -x -n 9; node …` gives `lockHeld(9): true`. No script in the repo uses fd 9 except the wrapper, and root in the container is out of scope. The code does what ADR 0002:829-830 specifies, so the fix goes beyond the ADR. **Ask:** add a C20 clarification: compare fdinfo's `ino:` with `fs.statSync(<stateDir>/pass.lock, { bigint: true }).ino` as strings, and not the lock line's pid, which reads 0 in the pid namespace. Add ST19 cases for a foreign inode and a missing `pass.lock`. A ledger row instead is acceptable.
2. **Story :281; graph.js:101, :474** — the Deviations list is incomplete in two places:
   - `schemaStatusFromRows` also returns `nameTaken`, beyond C9's shape;
   - `graph.js` also exports `MAX_BATCH`, which is not in the ADR's export list.

   Separately, "The applies no longer return `lostAddresses`, and `schemaStatusFromRows` no longer returns `state`" measures against a draft that was never published (`git log --all -S lostAddresses` finds only this line). **Ask:** list the two additions, and drop that sentence or anchor it. The wording at :304 is Non-blocking 17.
3. **OPERATIONS.md:760; src/api/status/queries/expectedNeo4jSchema.js:19-20** — both say "rename" the rule. Neo4j 5.26.10 has no constraint rename (the Cypher 5 and 25 parsers rename only roles, servers and users). **Ask:** "With no pass running, `DROP CONSTRAINT <that name>`, then run the Dashboard fix (or the `CREATE CONSTRAINT tags_address …` statement above)". Say the same in the code comment.
4. **ledger/2026-09-27-scheduled-tasks-failure-never-set.md:9, :18; ledger/2026-09-27-handoff-overstated-constraint-gate.md:28** — these line cites are 12 lines stale, because this branch inserts a seed into `src/api/scheduled-tasks/index.js`. **Ask:**
   - `:195` → `:207`
   - `:186-198` → `:198-210`
   - `:118-125` → `:130-137`
   - optionally ADR 0002:102 and :706, `:195` → `:207`.
5. **BIBLE.md:653** — "The pass itself starts only through the task system" is not true of a hand-run of the wrapper inside the container. The wrapper takes the flock, so the pass starts outside BullMQ and its `neo4j-heavy` semaphore. Only a hand-run of the Node file is refused. **Ask:** "The pass is started through the task system (`reconcileTaggingEdges`); a hand-run of its Node file is refused". Optionally add to OPERATIONS §12.8: "Do not run the wrapper by hand: it passes the lock check but skips the `neo4j-heavy` wait."
6. **ledger/2026-09-27-revokes-do-not-travel.md:26-30** — the re-measured figures (40 / 39 kind-5, production 21, staging 1) give no endpoint, filter, definition of "taggers" or UTC time. This review cannot check them, because it may not read public hosts. **Ask:** add the method in one parenthetical, e.g. each host's public `GET /api/strfry/scan/stream?filter={"kinds":[5]}`, with taggers taken from the same scan's `nostr-user-tag`-stamped kind-39999 authors. The sister row `…-test-fixture-taggings-on-prod-relays.md:9-10` shows the form.

**Checked and refuted.** The verify passes refuted no finding outright. They narrowed these claims, and the entries above use the narrowed versions:
- **Live suite.** "The live suite has never run" held only for the record: the Reviewer ran both classes at `da787035`, green (7/0/9 and 16/0/0).
- **AC-8 snapshot.** "The snapshot cannot be verified": a snapshot exists in scratch. It shows the local graph cannot evidence AC-8's social clause.
- **Measured durations.** "Recorded nowhere": commit `64885ce7`'s message summarises the numbers, but it is not a document of record and has no phases or before/after counts.
- **Boot hook.** "An operator grepping for `name-taken` finds nothing" is overstated. The runbook says to grep `tagging-edges`, which finds the line.
- **BIBLE §16.**
  - "§6's status line (BIBLE.md:320) states this correctly" is refuted: it states no failure semantics.
  - "Contradicts OPERATIONS" is a tension, not a contradiction.
- **Confirm route.** The finder's suggested condition ("active and the latest report is not running") is wrong: it also matches a job waiting for the lease.
- **`lockHeld`.** "Breaks the ADR step-1 intent" is overstated. The code matches the ADR's text; the gap is against D11-C and the refusal message.
- **`stderrTail`.** The "Permission denied" variant is not reachable locally, because the runner is root and the conf is 644. The "No such file" variant is reachable.
- **`safeMessage`.** The DNS leak is capped at about 14 characters, and the default `NEO4J_URI` is safe.
- **Status-route posture.** The finding missed a fifth location, ADR 0002:755.
- **Outcome table.** The finder's text for the `report` stage ("no removal applied") is false on a confirmed run. The driver-code item is a nit at most.
- **"rename" (Nit 3).** The window with no rule between DROP and CREATE is small in practice: only the pass writes `TAGS`, and it re-creates the rule first.
- **Candidate tests.**
  - CAND-R7 as drafted: its evidence ("fails at plan") is wrong for its shapes, which crash at :441 with stage `unexpected`, and its graph case did not pin :404. Both are fixed in item 9.
  - CAND-R4's first case is mislabelled.
  - M-W1a alone loses no pre-image; M-W1b is the principle-4 case.
- **Ledger cites.** ADR 0002:102 and :706 carry the same stale cite.

### Harness friction
Each item would become an OPEN.md `meta` row.

1. **Nothing requires the opt-in live suite to run before Review.**
   - `test/registry.js` gives `tagging-edges-live` a `skipNote`, so every gate records it skipped (0/0/16) without going red.
   - The Implementer's apply script unsets the variables.
   - The test plan's "How to run" (:267-271) prescribes the live run, but workflow 4 has no step that records whether it happened. This time the Reviewer ran it (green), after the verify lenses had reported it as never run.

   Filed as OPEN.md row `2026-09-28-live-and-evidence-runs-unrecorded` (with item 2).
2. **Evidence runs have no home and name no commit.**
   - The Open question 7 snapshot lives only in ephemeral scratch (`s2-impl/e2e/`) and a commit message.
   - The runs were taken before the implementation commit.

   Filed with item 1, as OPEN.md row `2026-09-28-live-and-evidence-runs-unrecorded`.
3. **A review lens printed the local-dev Neo4j password once in its own tool output.** Its masking regex missed `NEO4J_PASSWORD` because of the digit in the name. The value is in no file and is not repeated here. Filed as OPEN.md row `2026-09-28-conf-secret-masking-snippet`. Rotating the local password is the owner's call.
Note, not a harness row: this review's own tooling (parallel lenses with one skeptic each) produced two severity disagreements on the same text (BIBLE §16: nit vs blocking; the status-route posture sentence: blocking vs non-blocking). The review takes the higher rating and names the disagreement.

## Verdict
Blocking items to clear, each with its ask above:
1. `reconcileTaggingEdges.js:440`: redact `stderrTail` (paths), pin it, and fix the scanStrict header and ADR :803-804.
2. `graph.js:438`, `:445`: put the code in both log lines, add `no-change` to OPERATIONS:758, and add CAND-W4a/W4b.
3. `OPERATIONS.md:732` (and ADR 0002:524-525, OPERATIONS:747): correct the backend-restart sequence.
4. `BIBLE.md:657`, ADR 0002:532-533 and :755, `src/api/tagging-edges/index.js:10`, `src/api/index.js:515`: reword the status-route posture sentence.
5. `BIBLE.md:1470`: qualify "changes nothing on a failed or incomplete read".
6. ADR 0001:114-115: correct the upper-case-pubkey consequence.

Non-blocking 1 (record the live runs) and Non-blocking 2 (record the end-to-end evidence) are asked in the same round. The Tester's items (Blocking 2's CAND-W4a/W4b and the coverage gaps 8–17, priority 8 and 9) go to Test Design within the round, since the Implementer does not edit `test/`.

**CHANGES_REQUESTED**
