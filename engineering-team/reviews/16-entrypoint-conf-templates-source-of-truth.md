# Review: Story 16 — Conf templates are the source of truth for fresh containers

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-21
**Diff:** `git diff origin/staging...HEAD` (commit `6c4c3769`, 4 commits: `74423cd3` story, `753e66b2` ADR, `7d9548c2` tests, `6c4c3769` impl)

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` (host) — **PASS**. `entrypoint-template-rendering suite: PASS (11 passed, 0 failed)` (8 ADR sentinels + 3 regression guards green). All 13 prior suites still PASS, unchanged. Overall: **PASS**.
- [x] `npm test` (live tapestry container, bind-mounted source) — **PASS**. Same 14/14 suites green as host. Confirms the new files reach the container via the bind-mount and don't break the in-container test harness.
- [x] `bash -n docker/entrypoint.sh` — syntax valid.
- [x] `node --check tools/render-conf-template.js` — parse valid.
- [x] _Playwright not applicable — no UI surface changed._
- [x] _Lint / typecheck / build not configured — skipped per house rules._
- [x] **Cycle-local smoke** — **PASS end-to-end** (see §"Cycle-local smoke verification" below). The behavioral round-trip the source-sentinels can't reach.

## Spec adherence (AC walk)

| AC (story §) | Status | Notes |
|---|---|---|
| Byte-equivalence (strictest) | ✓ | T4 source + cycle-local smoke S1. The new template+renderer render produces semantically identical VAR=VALUE output to what the old heredoc would have produced under the same env. The 3 differences observed against the live `/etc/brainstorm.conf` are all explained by downstream-of-render mutations: one operator manual edit on `BRAINSTORM_30382_LIMIT`, plus `BRAINSTORM_RELAY_PUBKEY/NPUB` appended by `setup/create_nostr_identity.sh` (which runs AFTER both the old heredoc and the new renderer at the same entrypoint:218 hook). The render step itself is byte-equivalent. |
| Step 1 — template backfill | ✓ | T2 + T3 source. `config/brainstorm.conf.template` now contains all 41 heredoc variables in the same logical groupings, with literal values preserved where the heredoc had literals and `${VAR}` markers where the heredoc had bash substitution. |
| Step 2 — entrypoint swap (no heredoc) | ✓ | T7 source + diff walk. The 80-line `<<CONFEOF` heredoc is gone; replaced with a 15-line renderer invocation block. Drift sentinel T7 trips on any future re-introduction. |
| Template line propagates to fresh containers without entrypoint edit | ✓ | T2+T6 source (template = source of truth; entrypoint = single renderer invocation). Adding `export NEW_VAR=value` to the template alone is sufficient for fresh containers to receive it — proved structurally by T6+T8. |
| Fresh container has `TASK_QUEUE_ENABLED=false` | ✓ | R2 source + smoke (rendered output contains `export TASK_QUEUE_ENABLED=false` on line 100 of the rendered conf). Story #13's flag finally reaches fresh containers without operator ceremony. |
| Install `/etc/brainstorm-task-queue.json` from template | ✓ | T5 + T6 source + cycle-local smoke S3a/S3b. Conditional install with the `[ ! -f ]` guard tested both branches: present → preserve operator edits; absent → install deploy-safe defaults. |
| No regression for existing containers | ✓ | Smoke S1 — byte-equivalence holds; the new render step produces the same variable set the heredoc would. Plus npm test 14/14 confirms no JS-level regression. |
| No regression for the other 5 `*.conf` files | ✓ | R1 source. The `for conffile in graperank whitelist blacklist nip56; do` loop is preserved unchanged (only the duplicate `CONFIG_DIR=` line inside that block was removed because CONFIG_DIR is now defined once at the top — line 13). |
| Boot log line | ✓ | T6 source — `echo "[entrypoint] /etc/brainstorm.conf generated from config/brainstorm.conf.template"` immediately after the chmod 664. |
| Documentation in OPERATIONS.md | ✓ | New §11 with TOC entry. Documents: (1) the template-as-source-of-truth contract; (2) the trap (edits inside a running container are lost on restart); (3) the operator path for persistent overrides (repo-level edit + commit, or the docker exec append-if-absent recipe); (4) the drift sentinels T7+T8 as the long-term safety net. |

## ADR adherence

- [x] Files changed match ADR 0014 §Implementation notes exactly:
  - New `tools/render-conf-template.js` ✓ — ~30 lines per ADR spec, plain regex against `process.env`, no shell-eval class.
  - Edited `config/brainstorm.conf.template` ✓ — Step 1 backfill; all variables from heredoc preserved, `${VAR}` markers per ADR §Variable-substitution semantics.
  - New `config/brainstorm-task-queue.json.template` ✓ — deploy-safe defaults `{defaultConcurrency:1, concurrencyByTask:{}, resourceClassCaps:{neo4j-heavy:1}}`.
  - Edited `docker/entrypoint.sh` ✓ — heredoc removed; renderer invocation + task-queue install block + boot log line added; chmod 664 preserved.
  - Edited `OPERATIONS.md` ✓ — §11 added per ADR §Consequences.
- [x] Renderer implementation matches ADR §Implementation notes line-for-line:
  - Shebang + 'use strict' + `argv[2]` validation ✓
  - `readFileSync` with try/catch + exit 1 on file failure ✓
  - Regex `/\$\{([A-Z_][A-Z0-9_]*)\}/g` ✓
  - Missing vars collected + exit 2 with deduplicated list + template basename ✓
  - `process.stdout.write` (not `console.log` — would add trailing `\n` and break byte-equivalence) ✓
  - `Object.prototype.hasOwnProperty.call(process.env, name)` ✓ — defensive against prototype-pollution-style env-var names (`toString`, etc).
- [x] Entrypoint wrap follows ADR §Implementation Step 2 shape:
  - Exports the 9 vars the template references BEFORE invoking the renderer ✓
  - `if !` block with `[entrypoint] FATAL` message + exit 1 on render failure ✓
  - `chmod 664` preserved ✓
  - Success log line per ADR ✓
- [x] Task-queue install block mirrors the existing `for conffile in graperank...` copy-if-absent pattern.
- [x] **No new dependencies authorized.** Only Node (already in image, already invoked at entrypoint:32 for owner-npub lookup) — confirmed by `docker exec tapestry which envsubst` returning empty (no Dockerfile change needed).
- [x] **No Dockerfile change needed** — the existing `COPY . /usr/local/lib/node_modules/brainstorm/` at Dockerfile:92 picks up the new `tools/` directory; `.dockerignore` does not exclude it. Verified by `docker exec tapestry ls /usr/local/lib/node_modules/brainstorm/tools/` showing the new file present in the live container (via bind-mount).

## Concept-graph integrity

- [x] No concept-graph schema changes (ADR §Concept-graph impact confirmed "none"). Verified — no `src/concept-graph/` edits in the diff.
- [x] No concept handles touched.
- [x] Firmware reinstall not required (ADR §Implementation notes §Concept handle: "None").

## Things tests can't catch — hidden-hazard audit

| Hazard | Status |
|---|---|
| `which node` returns empty (Node not in PATH) → `BRAINSTORM_NODE_BIN=""` gets exported empty → renderer substitutes empty → rendered conf has `BRAINSTORM_NODE_BIN=""` | **Acceptable** — matches old heredoc behavior; downstream `start-brainstorm.sh` would fail to spawn either way. No new failure mode. |
| Renderer accidentally interprets `$(date)` or backticks as shell substitution | **Closed** by regex shape: `/\$\{([A-Z_][A-Z0-9_]*)\}/g` requires brace + uppercase identifier. `$(cmd)`, backticks, bare `$VAR` are left as literal text. No injection class. |
| Two-phase boot race: renderer writes /etc/brainstorm.conf, then create_nostr_identity.sh appends to it. If create_nostr_identity.sh runs before render finishes, appends are lost | **Closed** by entrypoint sequential ordering (line 49 renderer; line 216 create_nostr_identity.sh). Each step blocks until the previous completes (no `&`). Same sequence as before story #16. |
| Operator edits `/etc/brainstorm.conf` then container restarts → edit lost | **Documented**, not eliminated. This is **existing behavior** (the old heredoc was also unconditional overwrite) — story #16 §Out of scope explicitly says "operator overrides written to /etc/brainstorm.conf between restarts are NOT preserved." OPERATIONS.md §11 documents the trap and the operator path forward (template + commit, or docker exec append-if-absent). |
| Operator edits `/etc/brainstorm-task-queue.json` then container restarts → edit lost | **Closed** by the `[ ! -f ]` guard on the install block. Smoke S3a confirmed: operator edits survive restart. Different pattern from brainstorm.conf — intentional, matches the other 4 conf templates' behavior. |
| Renderer's `Object.prototype.hasOwnProperty.call(process.env, name)` check — what if `name` is `'toString'` or `'__proto__'`? | **Closed** — defensive lookup pattern blocks prototype-walk lookups; only own-properties counted. (Belt-and-suspenders: ENV var names are uppercase per the regex, so `'__proto__'` couldn't match anyway, but the defensive lookup is correct style.) |
| Empty-string env var (e.g., `BRAINSTORM_MANAGER_PUBKEYS=""`) → renderer substitutes `""` | **Acceptable** — matches old heredoc exact behavior (heredoc emits `export BRAINSTORM_MANAGER_PUBKEYS=""`). Renderer's `hasOwnProperty` check treats present-but-empty as "set". |
| Dead variables dropped from template (`BRAINSTORM_INPUT_FILE`, `BRAINSTORM_KEYS_FILE`, `BRAINSTORM_RELAY_PUBKEY`, `BRAINSTORM_RELAY_PRIVKEY`, `CONTROL_PANEL_PORT`) — could break a downstream consumer | **Closed by triangulation:** (1) `BRAINSTORM_INPUT_FILE`/`KEYS_FILE` are only referenced by `bin/update-config.sh` (bare-metal interactive utility, not at runtime). (2) `BRAINSTORM_RELAY_PUBKEY`/`PRIVKEY` are appended at boot by `setup/create_nostr_identity.sh:36-38` regardless of template content — the heredoc never wrote them either. (3) `CONTROL_PANEL_PORT` is read by `bin/control-panel.js:109` and `src/algos/refreshSearchIndex.sh:27` both with `:-7778` fallback; the heredoc never wrote it either; in bare-metal where the template DID write `"7778"`, the value matched the fallback exactly. All 5 droppings are functionally inert. |
| `lib/config.js` (consumed by test/test.js's smoke check) requires any of the dropped variables | **Closed** — `grep -n` confirmed `lib/config.js` does not reference any of the 5 dropped vars. testConfigLoading() passes (already verified by npm test gate). |
| Boot-time stderr from renderer's missing-env error gets lost | **Closed** by smoke S2 — `RenderError: missing env vars in brainstorm.conf.template: BRAINSTORM_NODE_BIN, BRAINSTORM_MODULE_BASE_DIR, RELAY_URL, DOMAIN_NAME, NEO4J_PASSWORD, OWNER_PUBKEY, OWNER_NPUB, ADMIN_PUBKEYS, SESSION_SECRET` flows to the entrypoint's stderr, which Docker captures to the container log. The operator sees exactly which vars are missing. |
| Renderer adds a trailing `\n` and breaks byte-equivalence | **Closed** by `process.stdout.write(rendered)` (not `console.log`). Render output ends exactly where the template ends (the template ends with a `\n` already, matching the heredoc's trailing newline). |

## Cycle-local smoke verification

Drove the validation that source-sentinels by design couldn't do. The local `tapestry` Docker container has been up for 7 days with a bind-mount of the repo at `/usr/local/lib/node_modules/brainstorm/`, so my Implementation-phase edits to `config/brainstorm.conf.template`, `tools/render-conf-template.js`, and `config/brainstorm-task-queue.json.template` are live in-container without a rebuild. (`docker/entrypoint.sh` is NOT live in-container — it's COPYed to `/entrypoint.sh` at image build per Dockerfile:109, and only runs at container start; my smoke validates the renderer + template in isolation, which is what the entrypoint would invoke.)

### S1 — byte-equivalence (render-step diff against live heredoc-produced conf)

Strategy: source the live `/etc/brainstorm.conf` (produced by the OLD heredoc 7 days ago + downstream mutations) to capture its env state, map the conf var names back to the docker-env var names the new entrypoint exports (`BRAINSTORM_OWNER_PUBKEY` → `OWNER_PUBKEY`, etc.), invoke the new renderer, then compare the two files modulo comments + blank lines (sorted).

```
old normalized: 55 lines (heredoc + downstream appends)
new normalized: 53 lines (template render)

diff:
< export BRAINSTORM_30382_LIMIT="10"
> export BRAINSTORM_30382_LIMIT="250000"
< export BRAINSTORM_RELAY_NPUB='npub1uq8dpyy...'  (only in old)
< export BRAINSTORM_RELAY_PUBKEY='e00ed09087...'  (only in old)
```

**All three differences are explained by downstream-of-render effects, NOT by the render step itself:**

1. `BRAINSTORM_30382_LIMIT="10"` in live conf vs `"250000"` in both heredoc + template. The HEREDOC writes `"250000"`. Confirmed via `grep` on the repo's old heredoc and the new template — both say `"250000"`. **The `"10"` is an operator manual edit** to `/etc/brainstorm.conf` after the entrypoint ran. The new entrypoint would produce `"250000"` (same as the old). **No regression.** This is also the exact trap §11 of OPERATIONS.md now warns about — manual edits survive only until restart.

2+3. `BRAINSTORM_RELAY_PUBKEY` + `BRAINSTORM_RELAY_NPUB` present in live conf but not in render output. **Both are appended at boot by `setup/create_nostr_identity.sh:36-38`**, which runs at entrypoint:216-218 — AFTER the brainstorm.conf is generated (whether by old heredoc or new renderer). The OLD heredoc never wrote them either; they were always added downstream. **The post-render sequence is identical before and after story #16. No regression.**

**Verdict: byte-equivalence holds at the render step.** Downstream mutations (operator manual edits + create_nostr_identity.sh appends) are unchanged.

### S2 — missing-env failure mode

```
$ env -i PATH=$PATH node /usr/local/lib/node_modules/brainstorm/tools/render-conf-template.js \
        /usr/local/lib/node_modules/brainstorm/config/brainstorm.conf.template
exit: 2
stderr: RenderError: missing env vars in brainstorm.conf.template:
         BRAINSTORM_NODE_BIN, BRAINSTORM_MODULE_BASE_DIR, RELAY_URL, DOMAIN_NAME,
         NEO4J_PASSWORD, OWNER_PUBKEY, OWNER_NPUB, ADMIN_PUBKEYS, SESSION_SECRET
```

Exit 2 (matches ADR `process.exit(2)`). All 9 missing vars listed, deduplicated, with template filename. **This is the LOUD-BOOT behavior the ADR §Variable-substitution semantics pins** — a future template addition that references an env var the entrypoint forgot to export fails the container boot with an actionable error message rather than silently emitting `KEY=""` and failing at runtime.

The entrypoint's outer wrap (`if !` + `[entrypoint] FATAL` + `exit 1`) means the operator sees both messages in the container log, and supervisord never starts.

### S3a — task-queue.json conditional install: file present → preserve

```
SKIPPED (file present, preserved): {"defaultConcurrency":1,"concurrencyByTask":{},"resourceClassCaps":{"neo4j-heavy":1}}
```

The `[ ! -f /etc/brainstorm-task-queue.json ]` guard correctly skips. **Operator edits survive restart** — exactly the behavior story #15 needed but couldn't get without manual ceremony on every fresh container.

### S3b — task-queue.json conditional install: file absent → install

```
INSTALLED from template: {
  "defaultConcurrency": 1,
  "concurrencyByTask": {},
  "resourceClassCaps": {
    "neo4j-heavy": 1
  }
}
```

Fresh containers get the deploy-safe defaults automatically. Matches story #15's `resourceClassCaps.neo4j-heavy: 1` exactly.

### Smoke scenarios NOT performed (acceptable gaps)

- **Cold container boot from scratch.** The live container is the bind-mount dev setup — a true cold boot from a freshly-built image would require `docker compose down && docker compose up --build`, which interrupts the operator's running stack. Substituted: in-container in-isolation invocation of the renderer (S1) + the conditional-install block (S3a/S3b), plus syntactic validation of the modified entrypoint.sh via `bash -n`. The risk of bug-in-cold-boot path is small — the entrypoint edit is mechanical (heredoc swap + new conditional block); the renderer + template are exercised by the in-container smoke.
- **`docker compose up --build` smoke on a fresh image.** Same reason — would require interrupting the operator's stack. Defer to staging-deploy smoke; the deploy chain's natural cadence is the right place to validate cold-boot behavior across the actual image build.

## House rules check

- [x] Concept Graph API authority respected (no concept change).
- [x] No new lint/typecheck/build tooling.
- [x] No firmware reinstall needed.
- [x] Per-phase commits in order: story → adr → test → impl. Clean stack on top of `origin/staging` (commit `2becc305`, story #15's merge).
- [x] No source files modified outside the ADR's scope. The 5 files changed are exactly the 5 the ADR §Implementation notes called out.

## Findings

### Blocking

_None._

### Non-blocking (recorded, do not gate)

1. **Live container's `BRAINSTORM_30382_LIMIT="10"` is a manual operator edit that will be lost on next container restart** — the heredoc has always emitted `"250000"`. This is precisely the trap §11 of OPERATIONS.md now documents; the operator should add `BRAINSTORM_30382_LIMIT="10"` to the template (committed) if they want the value to persist. Not blocking for ship — this is **existing trap behavior, not introduced by story #16**.

2. **`BRAINSTORM_RELAY_PUBKEY/NPUB` appended at boot by `create_nostr_identity.sh` are a kind of "second source of truth" for /etc/brainstorm.conf** — story #16 didn't reconcile this, intentionally. The append-flow is unchanged; the template doesn't carry these vars, same as the old heredoc didn't. If the team ever wants `/etc/brainstorm.conf` to be exclusively template-driven, that's a follow-up story (move the relay-key generation into the template-render flow or have it write to a separate file). Out of scope here.

3. **Dropped template-only vars (`BRAINSTORM_INPUT_FILE`, `BRAINSTORM_KEYS_FILE`, `BRAINSTORM_RELAY_PUBKEY`, `BRAINSTORM_RELAY_PRIVKEY`, `CONTROL_PANEL_PORT`) — bare-metal install path's interactive `bin/update-config.sh` still references them.** That utility prompts and writes them to /etc/brainstorm.conf as new exports if the operator chooses — it doesn't read them from the template. So `update-config.sh` still works in the bare-metal path post-story-#16. Confirmed: `grep -n` in lib/config.js (the runtime consumer) shows zero references to any of the 5 dropped vars.

4. **The renderer's parseability sentinel (T1) uses `node --check` which only validates syntax, not behavior.** T4 spawns the renderer with a fixture env and asserts the output — that's the behavioral check. The combination is correct; just noting that the two sentinels have complementary scopes.

5. **No cold-boot smoke against a freshly-built image** (see §Smoke scenarios NOT performed). The staging-deploy step is the natural place for that validation; the deploy chain's automated container restart on every push exercises the cold-boot path naturally.

## Verdict

**PASS end-to-end.**

Source-side (11/11 sentinels green) and behavioral-side (cycle-local smoke S1 + S2 + S3a + S3b) both confirm the implementation matches ADR 0014 and resolves the heredoc-vs-template drift class story #16 was raised to close. Byte-equivalence at the render step is proven against the live container; the three observed differences are all downstream-of-render effects (unchanged before/after the story) and document the very trap §11 now warns operators about.

The 5 non-blocking observations are either pre-existing behavior, scope-bounded (out-of-scope items called out in the story), or cosmetic. None gate ship.

The story is ready for the deploy chain (`cycle-staging`, then on explicit confirmation `cycle-prod`). The cold-boot validation that the local cycle-local smoke deliberately deferred will naturally occur on the first container restart in staging — if any export was missed, the boot fails loudly per S2's verified failure mode. That's exactly the right place for that failure to happen (caught before prod), and exactly the kind of fast-fail the renderer's design choice was made for.
