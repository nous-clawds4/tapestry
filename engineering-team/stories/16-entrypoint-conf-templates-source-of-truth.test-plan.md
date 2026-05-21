# Test Plan: Story 16 — Entrypoint reads `/etc/brainstorm.conf` from `config/brainstorm.conf.template` (templates as source of truth)

**Story:** `engineering-team/stories/16-entrypoint-conf-templates-source-of-truth.md`
**ADR:** `engineering-team/decisions/0014-entrypoint-template-rendering.md`
**Date:** 2026-05-21

## Test posture

Source/structural **sentinels** at `test/entrypoint-template-rendering.test.js` pin the ADR-required shape: a Node-based renderer at `tools/render-conf-template.js`, a backfilled `config/brainstorm.conf.template` containing every variable the current heredoc writes, a sibling `config/brainstorm-task-queue.json.template`, an entrypoint that invokes the renderer + installs the task-queue JSON + logs the rendering, and two drift sentinels guarding against future regression. The **behavioral round-trip** — fresh container with no pre-existing `/etc/brainstorm.conf` boots; the entrypoint log carries `[entrypoint] /etc/brainstorm.conf generated from ...template`; the resulting `/etc/brainstorm.conf` is byte-equivalent to today's heredoc output for the same env — is reproducible only against the live Docker stack and is the **authoritative cycle-local smoke** that the Reviewer drives, per project precedent.

This split matches stories #12, #13, #15 — source-sentinels in CI run on every npm test (cheap, fast, regression-proof); behavioral smoke runs against the live stack (proves the end-to-end is wired up).

## Coverage map

One sentinel per acceptance criterion, with the byte-equivalence AC drawing the heaviest concentration (T2/T3/T4 cover the variable-set inclusion, the `${VAR}`-substitution discipline, and the actual rendered VAR=VALUE equivalence respectively). Drift sentinels (T7/T8) cover the future-regression class. Regression sentinels (R1/R2/R3) protect prior wins.

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC: Step 1 — template backfill / **byte-equivalence (variable inclusion)** | `T2: template contains every variable the heredoc writes` | `test/entrypoint-template-rendering.test.js` | source sentinel |
| AC: Step 1 — template backfill / **byte-equivalence (${VAR} substitution discipline)** | `T3: template replaces literal placeholder values with ${VAR} references` | `test/entrypoint-template-rendering.test.js` | source sentinel |
| AC: **Byte-equivalence (rendered VAR=VALUE equivalence)** | `T4: rendering the template via render-conf-template.js with fixture env produces the expected VAR=VALUE pairs` | `test/entrypoint-template-rendering.test.js` | unit/integration (spawns the renderer) |
| AC: Step 2 — entrypoint swap (no heredoc) | `T7: docker/entrypoint.sh contains NO <<CONFEOF heredoc` | `test/entrypoint-template-rendering.test.js` | source sentinel (drift) |
| AC: Adding a new `export VAR=value` line to template is sufficient (template = source of truth) | Covered transitively by T2 + T6 (T6 pins entrypoint invokes renderer; T2 pins every var the heredoc had is in the template, so any *future* additional line in the template will likewise render through) | — | — |
| AC: Fresh containers contain `export TASK_QUEUE_ENABLED=false` | `R2: brainstorm.conf.template still carries TASK_QUEUE_ENABLED=false` (regression guard) + the template AC of T4's fixture render (TASK_QUEUE_ENABLED=false is in the expected pairs map) | `test/entrypoint-template-rendering.test.js` | source sentinel + integration |
| AC: Install `/etc/brainstorm-task-queue.json` from template | `T5: brainstorm-task-queue.json.template exists, parses, has resourceClassCaps.neo4j-heavy=1` + `T6: entrypoint references brainstorm-task-queue.json.template + writes /etc/brainstorm-task-queue.json` | `test/entrypoint-template-rendering.test.js` | source sentinel |
| AC: No regression for existing containers (heredoc-equivalent variable set) | T4 (byte-equivalence assertion on rendered pairs) | `test/entrypoint-template-rendering.test.js` | integration |
| AC: No regression for the other five `*.conf` files | `R1: entrypoint still iterates [graperank, whitelist, blacklist, nip56] templates` | `test/entrypoint-template-rendering.test.js` | source sentinel (regression) |
| AC: Boot log makes new behavior observable | `T6` asserts `echo "[entrypoint] /etc/brainstorm.conf generated from config/brainstorm.conf.template"` is present | `test/entrypoint-template-rendering.test.js` | source sentinel |
| Drift sentinel (future regression class) | `T7` (no `<<CONFEOF` heredoc) + `T8` (exactly one `render-conf-template.js` invocation) | `test/entrypoint-template-rendering.test.js` | source sentinel |
| AC: Renderer existence + structure | `T1: tools/render-conf-template.js exists, is parseable, uses ${VAR_NAME} regex + process.env` | `test/entrypoint-template-rendering.test.js` | source sentinel + `node --check` parse |
| Story-#13 regression guard: feature-flag default preserved | `R2: brainstorm.conf.template still carries TASK_QUEUE_ENABLED=false` | `test/entrypoint-template-rendering.test.js` | source sentinel (regression) |
| Story-#15 regression guard: task-queue.json defaults preserved | `T5` pins `resourceClassCaps[neo4j-heavy]=1` + `defaultConcurrency=1` | `test/entrypoint-template-rendering.test.js` | source sentinel |
| File-permissions regression | `R3: entrypoint still chmods /etc/brainstorm.conf to 664` | `test/entrypoint-template-rendering.test.js` | source sentinel (regression) |
| AC: `OPERATIONS.md` documents the contract | Deferred to **cycle-local smoke** (Reviewer eyeballs the OPERATIONS.md diff against the AC). A source sentinel for documentation prose is brittle and bloats the test suite; the Reviewer is the verification surface for this AC. | — | smoke |

### Why one suite, not split

All eight failing sentinels target the same `tools/` + `config/` + `docker/entrypoint.sh` triplet. Splitting into multiple test files would duplicate the variable-list constant (41 names) and the fixture-env block (9 values), inviting drift. One suite, 11 tests, clear pre/post split — matches the pattern stories #12, #13, #15 used.

## Edge cases

Things not in the acceptance criteria but worth covering inside the same suite or surfacing as Reviewer-watch items:

- [x] **Variable in fixture env but not in template.** Covered by T4 (the renderer succeeds; absent variables in expected map are detected as mismatches). Reviewer-watch: if the operator's deploy injects a new env var the template doesn't reference, the renderer silently ignores it (intentional — template controls what's emitted).
- [x] **Variable in template but not in fixture env (missing-env error).** Covered transitively by T4 — if the template references a `${VAR}` the fixture does not provide, the renderer should exit non-zero with a clear stderr message (ADR §Variable-substitution semantics pins this behavior). T4 will fail with the renderer's stderr surfaced.
- [x] **Composed substitutions like `${BRAINSTORM_MODULE_BASE_DIR}src/`.** Covered by T4's expected pairs (BRAINSTORM_MODULE_SRC_DIR=`/usr/local/lib/node_modules/brainstorm/src/` requires the inner `${}` to substitute and the trailing literal to concatenate correctly).
- [x] **TASK_QUEUE_ENABLED on fresh containers (the original motivating gap).** Covered by R2 (template carries the line) + T4 (rendered output contains `TASK_QUEUE_ENABLED=false`).
- [x] **Drift re-introduction.** Covered by T7 (no `<<CONFEOF` heredoc) + T8 (exactly one renderer invocation) — both will trip if a future commit re-introduces a heredoc or a second write-path.
- [x] **JSON.parse of the task-queue template.** Covered by T5's `readJsonSafe` — if the file is malformed JSON, the test fails meaningfully.
- [ ] **Stale `/etc/brainstorm.conf` from prior container run** (Reviewer-watch): the entrypoint unconditionally overwrites this file (matches today's heredoc behavior). Reviewer confirms via cycle-local smoke that a container with a pre-existing `/etc/brainstorm.conf` from a prior boot still gets it regenerated identically.
- [ ] **Dockerfile copies `tools/` directory** (Reviewer-watch / Implementer-checklist): the renderer must be present in the image at `${BRAINSTORM_MODULE_BASE_DIR}/tools/render-conf-template.js`. ADR §Dockerfile flags this; the Implementer verifies in cycle-local.
- [ ] **`brainstorm-task-queue.json` PRESERVED on container restart** (Reviewer-watch): the conditional install is `if [ ! -f ... ]`, matching the other four conf files. Reviewer confirms an operator-edited `/etc/brainstorm-task-queue.json` survives a container restart.
- [ ] **Bare-metal install path** (Reviewer-watch, AC §Out of scope but called out for confirmation): the template backfill incidentally fixes `setup/install-control-panel.sh`. Reviewer eyeballs / smokes if the residual gap surfaces; otherwise we close it as fixed.

## Test infrastructure

- **Framework:** Hand-rolled Node runner (`node test/test.js`). Matches the in-repo style; no jest/mocha. Each test is an `async fn` that throws on assertion failure; the runner reports per-test pass/fail; non-zero exit if any suite fails.
- **No external dependencies beyond Node stdlib.** `fs`, `path`, `child_process.spawnSync`. The renderer is a Node script — T1 uses `node --check` for parse validation; T4 uses `spawnSync` to drive an actual render with a controlled fixture env.
- **Fixture env (T4):** Nine variables fully control the renderer's behavior under the test:
  - `BRAINSTORM_MODULE_BASE_DIR` = `/usr/local/lib/node_modules/brainstorm/`
  - `BRAINSTORM_NODE_BIN` = `/usr/bin/node`
  - `DOMAIN_NAME` = `test.example.com`
  - `RELAY_URL` = `wss://test.example.com`
  - `NEO4J_PASSWORD` = `test-neo4j-pw`
  - `OWNER_PUBKEY` = 64 × `'a'`
  - `OWNER_NPUB` = `npub1testnpub`
  - `ADMIN_PUBKEYS` = `admin1,admin2`
  - `SESSION_SECRET` = `test-session-secret-32-bytes-xxx`
  - PATH inherited from the test runner's env so `node` resolves on macOS dev and Linux CI alike.
- **Concept Graph API:** not required for this story (no concept handles touched).
- **Firmware reinstall:** no.

## How to run

```
npm test
```

The suite registers as `entrypoint-template-rendering suite:` after `task-queue-neo4j-resource-class suite:` in `test/test.js`.

For the Reviewer's cycle-local smoke (behavioral round-trip; runs against the live Docker stack):

```bash
# Inside the tapestry container, with no pre-existing /etc/brainstorm.conf:
docker exec tapestry bash -c 'rm -f /etc/brainstorm.conf && /usr/local/lib/node_modules/brainstorm/docker/entrypoint.sh' 2>&1 | grep "\[entrypoint\]"
# Should see: [entrypoint] /etc/brainstorm.conf generated from config/brainstorm.conf.template

docker exec tapestry cat /etc/brainstorm.conf
# Diff this against the old heredoc-produced /etc/brainstorm.conf for the same env state.
# Zero semantic differences (modulo whitespace/comments).

docker exec tapestry cat /etc/brainstorm-task-queue.json
# Should contain: {"defaultConcurrency":1,"concurrencyByTask":{},"resourceClassCaps":{"neo4j-heavy":1}}
```

## Verification

The new tests fail with the current code (pre-impl, before Step 1 backfill and Step 2 swap). Confirmed on 2026-05-21 at commit `753e66b2`:

```
entrypoint-template-rendering suite:
  ✗ T1: tools/render-conf-template.js exists, is parseable Node, performs ${VAR_NAME} substitution against process.env (ADR 0014 §Implementation Step 2)
      Renderer does not exist at tools/render-conf-template.js (ADR 0014 §Implementation Step 2). Create the small Node script ...
  ✗ T2: config/brainstorm.conf.template contains every variable the heredoc writes (Step 1 byte-equivalence; ADR 0014 §Implementation Step 1)
      brainstorm.conf.template is missing 31 of 41 variables the docker/entrypoint.sh heredoc currently writes:
        BRAINSTORM_30382_LIMIT, BRAINSTORM_ACCESS, BRAINSTORM_ADMIN_PUBKEYS, BRAINSTORM_BASE_DIR,
        BRAINSTORM_CREATED_CONSTRAINTS_AND_INDEXES, BRAINSTORM_DEFAULT_NIP85_HOME_RELAY, ... (31 total)
  ✗ T3: template replaces literal placeholder values with ${VAR} references for env-var-dependent variables ...
      brainstorm.conf.template is missing required ${VAR} substitutions:
        STRFRY_DOMAIN="${DOMAIN_NAME}" (currently "your.relay.com"),
        BRAINSTORM_RELAY_URL="${RELAY_URL}" (currently "wss://your.relay.com"),
        NEO4J_PASSWORD="${NEO4J_PASSWORD}" (currently "neo4j"), ... (8 total)
  ✗ T4: rendering the template via render-conf-template.js with a fixture env produces the expected VAR=VALUE pairs ...
      renderer missing — T1 must pass first.
  ✗ T5: config/brainstorm-task-queue.json.template exists, parses as JSON, has resourceClassCaps.neo4j-heavy=1 ...
      config/brainstorm-task-queue.json.template is missing or not valid JSON ...
  ✗ T6: docker/entrypoint.sh invokes render-conf-template.js, installs brainstorm-task-queue.json from template, logs the rendering ...
      docker/entrypoint.sh does not reference render-conf-template.js ...
  ✗ T7: docker/entrypoint.sh contains NO <<CONFEOF heredoc writing to /etc/brainstorm.conf (drift sentinel) ...
      docker/entrypoint.sh contains 1 <<CONFEOF heredoc(s) — drift sentinel tripped ...
  ✗ T8: docker/entrypoint.sh contains EXACTLY ONE invocation of render-conf-template.js (drift sentinel) ...
      docker/entrypoint.sh has 0 invocations of render-conf-template.js — expected exactly 1 ...
  ✓ R1: docker/entrypoint.sh still installs the other conf templates (graperank/whitelist/blacklist/nip56) ...
  ✓ R2: config/brainstorm.conf.template still carries TASK_QUEUE_ENABLED=false ...
  ✓ R3: docker/entrypoint.sh still chmods /etc/brainstorm.conf to 664 after rendering ...

Test Results
-------------
entrypoint-template-rendering suite:             FAIL (3 passed, 8 failed)
Overall:                                         FAIL
```

The 13 sibling suites continue to PASS — no collateral damage from the new suite. Each of the 8 failures carries a right-reason message that points the Implementer at the exact gap (which file is missing, which variables are absent, which placeholder needs to become a `${VAR}` reference, which entrypoint block needs to be added). R1–R3 pass now and must continue passing post-impl — they guard the regression class.
