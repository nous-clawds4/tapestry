# ADR 0014: Render `/etc/brainstorm.conf` from the template via a Node-based renderer

**Status:** Proposed
**Date:** 2026-05-21
**Story:** `engineering-team/stories/16-entrypoint-conf-templates-source-of-truth.md`

## Context

Story #16 closes a class-of-bug surfaced during story #15's flag-flip: `docker/entrypoint.sh` regenerates `/etc/brainstorm.conf` on every container start from a 40-variable heredoc embedded in the entrypoint itself, while `config/brainstorm.conf.template` is consulted only by the bare-metal install path. The two have drifted dramatically (template has 16 variables; heredoc has 40), so the template is silently incomplete and any feature flag added to it (like story #13's `TASK_QUEUE_ENABLED`) never reaches fresh Docker containers.

The story specifies two ordered steps with a strict byte-equivalence guarantee between the new and old `/etc/brainstorm.conf`. This ADR makes the mechanical choices that determine how Step 1 (template backfill) and Step 2 (entrypoint swap) play out:

1. **Variable-substitution mechanism** for the new rendering step.
2. **Where to land the new task-queue.json template** + how the entrypoint installs it.
3. **Byte-equivalence verification mechanism** — how the Tester and Reviewer confirm zero semantic divergence.
4. **Drift sentinel** to prevent future regression.

### Grounded facts after reading the relevant source

- **`envsubst` is NOT in the `tapestry` image.** Confirmed via `docker exec tapestry which envsubst` returning empty. Repo-wide grep finds zero existing usages of `envsubst`. Adopting it requires a Dockerfile change (`apt install -y gettext-base`).
- **Node IS available at entrypoint time.** [entrypoint.sh:30-36](docker/entrypoint.sh:30) already invokes `node -e '...'` for owner-pubkey lookup before the `/etc/brainstorm.conf` heredoc runs. So a Node-based template renderer can run from the entrypoint without any new image dependency.
- **The existing conf-copy loop ([entrypoint.sh:130-134](docker/entrypoint.sh:130))** iterates a hard-coded list `for conffile in graperank whitelist blacklist nip56; do`. It strips the `.conf.template` suffix to produce `/etc/<name>.conf`. The task-queue file ends in `.json`, so it does not fit the existing pattern as-is.
- **Heredoc structure** ([entrypoint.sh:40-122](docker/entrypoint.sh:40)) has three kinds of values:
  1. **Literal strings** (e.g., `BRAINSTORM_BATCH_SIZE="100"`) — no substitution needed.
  2. **Bare env-var substitution** (e.g., `BRAINSTORM_RELAY_URL="${RELAY_URL}"`, `NEO4J_PASSWORD="${NEO4J_PASSWORD}"`) — single-variable substitutions against env state.
  3. **Composed env-var substitution** (e.g., `BRAINSTORM_MODULE_SRC_DIR="${BRAINSTORM_MODULE_BASE_DIR}src/"`) — one substitution embedded in a longer string.

  No command substitution (`$(...)`), no arithmetic, no conditionals, no `${VAR:-default}` patterns. The substitution surface is **plain `${VAR_NAME}` text replacement** — nothing fancier.

### Concept-graph impact

None. `/api/concept-graph/summaries` returns zero concepts matching template/entrypoint/config/conf/docker/envsubst/heredoc. **Firmware reinstall: no.**

## Options considered

### Option A — Node-based renderer at `tools/render-conf-template.js` (chosen)

Add a small Node script (~30 lines) that:

- Reads a template file from argv.
- Performs plain `${VAR_NAME}` text substitution against `process.env`.
- Refuses to interpret anything else (no `$(...)`, no shell, no eval).
- Throws an explicit error on undefined variables — surfaces config bugs at boot rather than silently emitting empty strings.
- Writes the rendered output to stdout (caller redirects to the target file).

The entrypoint changes from a heredoc to a one-line invocation:
```bash
node "${BRAINSTORM_MODULE_BASE_DIR}/tools/render-conf-template.js" \
  "${CONFIG_DIR}/brainstorm.conf.template" > /etc/brainstorm.conf
```

For the task-queue.json case, the entrypoint gets a small new block (mirroring the existing `for conffile in graperank ...` pattern but adapted for the .json extension and conditional-copy semantic):
```bash
if [ ! -f /etc/brainstorm-task-queue.json ] && [ -f "${CONFIG_DIR}/brainstorm-task-queue.json.template" ]; then
  cp "${CONFIG_DIR}/brainstorm-task-queue.json.template" /etc/brainstorm-task-queue.json
  chmod 644 /etc/brainstorm-task-queue.json
  echo "Installed /etc/brainstorm-task-queue.json from template"
fi
```

The task-queue.json template does NOT need substitution — it's literal JSON with hard-coded defaults `{"defaultConcurrency":1,"concurrencyByTask":{},"resourceClassCaps":{"neo4j-heavy":1}}`. Plain copy.

**Pros**
- **No new image dependency.** Node is already in the container; the renderer is one .js file in the repo.
- **Predictable substitution semantics.** Regex-based `${VAR_NAME}` replacement — only env vars get substituted, nothing else. Cannot accidentally execute `$(date)` or backticks if someone adds them to the template later.
- **Explicit error on undefined.** Operator gets a clear "missing env var" message at boot, not a silently-empty rendered conf file.
- **Easy to unit-test.** The Tester's existing Node-runner pattern can directly require + invoke the renderer against fixture templates, with full assertion power. No "exec a shell command and inspect output" awkwardness.
- **Bare-metal install path is also fixable** by having `setup/install-control-panel.sh` call the same renderer (out of scope here but the door is open).
- **Simple to extend** with `${VAR:-default}` support later if the operator wants soft defaults; pure regex match in the renderer.

**Cons**
- One new file. ~30 lines of Node.
- The entrypoint now depends on Node being available at entrypoint time. It already is (line 30-36) so this is a no-op cost — but worth noting as an architectural constraint.
- The Implementer has to remember to backfill the template (Step 1) before flipping the entrypoint (Step 2). The byte-equivalence verification is the safety net.

### Option B — `envsubst` via Dockerfile addition

Add `apt install -y gettext-base` to the Dockerfile so `envsubst` is available in the image. Entrypoint becomes:
```bash
envsubst '$DOMAIN_NAME $OWNER_PUBKEY ...' < template > /etc/brainstorm.conf
```

**Pros:** standard, well-known UNIX tool. Explicit allowlist of variables (the quoted list).

**Cons:**
- **New image dependency.** Touches the Dockerfile, expands image size, adds a build-cache-bust risk.
- **No `${VAR:-default}` support.** If we ever want soft defaults, we'd need a different mechanism anyway.
- **Variable allowlist must be maintained** in the entrypoint alongside the template — partial drift hazard (adding a `${NEW_VAR}` to template + forgetting to add to envsubst's allowlist = silent failure).
- Harder to unit-test (have to invoke a shell command).

Rejected.

### Option C — Pure-bash `eval cat <<EOF` shim

```bash
TEMPLATE_CONTENT="$(cat config/brainstorm.conf.template)"
eval "cat > /etc/brainstorm.conf <<CONFEOF
$TEMPLATE_CONTENT
CONFEOF"
```

**Pros:** zero new code, zero new dependency. Pure bash.

**Cons:**
- **Injection class.** `${VAR}` substitution works, but so does `$(...)`, backticks, and arithmetic. If a future contributor adds (or accidentally creates via a typo) `$(rm -rf ...)` or similar in the template, it executes as root. Template is repo-controlled, so the practical risk is low — but the class is wide open.
- Newline/quote handling in default values is more fragile.
- Harder to unit-test.

Rejected. The injection class is worth avoiding even for repo-controlled content; the cost of the Node renderer is small enough.

### Option D — Source the template, then re-emit

```bash
source config/brainstorm.conf.template
declare -p VAR1 VAR2 ... > /etc/brainstorm.conf
```

**Pros:** uses bash's existing substitution natively.

**Cons:** requires enumerating every variable name to emit. Same maintenance burden as Option B's allowlist. Plus, `declare -p` output format differs from the heredoc's `export VAR="value"` style; byte-equivalence becomes harder.

Rejected.

## Decision

**We chose Option A — Node-based renderer.**

Reasons:
- It's the only option that adds **zero new image dependencies** and **zero new injection class**, while staying within the existing tooling (Node is already in the image and used by the entrypoint).
- The substitution surface in the template is plain `${VAR_NAME}` — exactly what a 5-line regex handles cleanly. We don't need shell-power; we need predictable text replacement.
- Unit-testability is a real advantage given the byte-equivalence AC. The Tester can drive the renderer directly from a Node test against multiple env fixtures, asserting exact output.
- It generalizes: future templates beyond brainstorm.conf could use the same renderer trivially.

What we are trading away: a small amount of "this is just a shell script" simplicity. Acceptable given the explicit predictability + testability gains.

### Variable-substitution semantics

The renderer recognizes exactly two forms:
- `${VAR_NAME}` — replaced with `process.env.VAR_NAME`. Throws `RenderError: missing env var "VAR_NAME"` if undefined.
- Literal text — left as-is.

NOT recognized (intentional — these stay as literal text):
- `$(command)` — never executed.
- `` `command` `` — never executed.
- `$VAR_NAME` (no braces) — left as literal. Forcing `${VAR_NAME}` braces makes the substitution boundaries unambiguous and matches the existing heredoc's style.
- `${VAR:-default}` — left as literal text in this story. May be added in a future enhancement if operator need surfaces (e.g., for feature-flag soft defaults).

### Where the new task-queue.json template lives

`config/brainstorm-task-queue.json.template`. Same directory as the other six templates. Content is the deploy-safe default literal JSON (no substitution needed); operators tune `resourceClassCaps` and concurrency knobs by editing the live `/etc/brainstorm-task-queue.json` after first install.

### Byte-equivalence verification

Two complementary mechanisms:

1. **Tester-authored source-sentinel test** at `test/entrypoint-template-rendering.test.js` that:
   - Reads the OLD heredoc content from the current `docker/entrypoint.sh` (delimited by `<< CONFEOF` and `CONFEOF`).
   - Reads the NEW template content from `config/brainstorm.conf.template`.
   - Sets a fixed fixture env (specific values for `BRAINSTORM_MODULE_BASE_DIR`, `DOMAIN_NAME`, `RELAY_URL`, `NEO4J_PASSWORD`, `OWNER_PUBKEY`, `OWNER_NPUB`, `ADMIN_PUBKEYS`, `SESSION_SECRET`, `BRAINSTORM_NODE_BIN`).
   - Renders the OLD heredoc by writing the heredoc text to a temp file and running `bash -c 'cat <<HEREDOC ... HEREDOC'`.
   - Renders the NEW template via the Node renderer.
   - Normalizes both (strip comments lines starting with `#`, strip blank lines, sort `export VAR=VALUE` lines alphabetically).
   - Asserts the two normalized strings are identical.

   This test passes pre-Step-2 (heredoc and template both produce the same byte-equivalent normalized output, because the template was backfilled to match in Step 1). After Step 2 (heredoc removed), the test can no longer compare — the Tester adapts it to instead snapshot-test against a known-good rendered output (preserves regression protection going forward).

2. **One-time impl-side script** at `tools/diff-brainstorm-conf-render.sh`:
   - Sets a fixture env.
   - Runs the OLD heredoc-based path (against a snapshot of pre-Step-2 entrypoint.sh).
   - Runs the NEW template + renderer path.
   - Side-by-side diff output for the Implementer + Reviewer to eyeball during impl and review.

   This script is **deliberately temporary** — kept in the impl PR for review use, then deleted as part of Step 2's cleanup (or moved to `tools/legacy/` for posterity if the team wants the artifact preserved).

### Drift sentinel for future

A small source-sentinel test that asserts:
- `docker/entrypoint.sh` does not contain a heredoc that writes to `/etc/brainstorm.conf` (regex `<<\s*CONFEOF` should match zero times after Step 2).
- `docker/entrypoint.sh` DOES contain exactly one invocation of `render-conf-template.js` (regex match exactly one).

This catches the most likely future regression: someone re-introduces a heredoc, or adds a second write-path that bypasses the renderer.

## Consequences

**Enabled**
- Fresh containers automatically get every variable currently declared in `config/brainstorm.conf.template` — including story #13's `TASK_QUEUE_ENABLED` and any future feature flags.
- Fresh containers automatically get `/etc/brainstorm-task-queue.json` with the deploy-safe defaults.
- Bare-metal installs (`setup/install-control-panel.sh`) are incidentally fixed by Step 1's backfill — the template they consume becomes complete.
- The Node renderer can be reused by future stories that introduce other Node-process-rendered config files. Pattern established.

**Constrained / made harder**
- The template now contains env-var references (`${OWNER_PUBKEY}`, `${SESSION_SECRET}`, etc.) that won't render correctly outside the entrypoint context. If anyone tries to "just `source` the template" for some other purpose, those references won't resolve. Mitigation: template gets a header comment explaining the `${VAR}` syntax and where the variables come from.
- Step 1 (template backfill) is **substantial textual work** — 24 variables to add to the template in the right order, with the right quoting, with `${VAR}` markers where the heredoc uses bash substitution. The byte-equivalence AC + test is what makes this safe.
- The entrypoint now depends on `tools/render-conf-template.js` being present at the correct path under `BRAINSTORM_MODULE_BASE_DIR`. If the Dockerfile doesn't currently COPY the `tools/` directory, the Implementer must add that.

**Follow-up debt (out of scope here)**
- **Other templates' rendering.** This story switches only `brainstorm.conf`. The other five (`graperank`, `whitelist`, `blacklist`, `nip56`, `concept-graph`) continue using the existing "cp if not present" pattern. If they ever need substitution, the renderer is there.
- **Bare-metal install path verification.** Step 1 fixes the bare-metal path by making the template complete. The Reviewer should confirm during smoke or file a follow-up if a residual gap surfaces.
- **`${VAR:-default}` soft-default support** — add to the renderer if/when operator need surfaces.
- **Operator-friendly override mechanism** (env-var-set-in-docker-compose-overlay overrides template default) — separate story.

**Firmware reinstall required?** No.

## Implementation notes

The Implementer reads this section verbatim.

### Step 1 — Template backfill (do this first, separately commit if it helps reviewers)

**Edit `config/brainstorm.conf.template`** to contain every variable the current `docker/entrypoint.sh` heredoc writes, in the same logical order. For each variable in the heredoc at [entrypoint.sh:40-122](docker/entrypoint.sh:40):

- **Literal values** (e.g., `BRAINSTORM_BATCH_SIZE="100"`): copy verbatim.
- **Env-var references** (e.g., `${NEO4J_PASSWORD}`, `${OWNER_PUBKEY}`, `${ADMIN_PUBKEYS}`, `${SESSION_SECRET}`, `${RELAY_URL}`, `${DOMAIN_NAME}`, `${BRAINSTORM_NODE_BIN}`, `${BRAINSTORM_MODULE_BASE_DIR}`): preserve the `${VAR}` reference in the template — the Node renderer will substitute at boot.
- Maintain the heredoc's grouping (`# File paths`, `# WoT relays`, `# NIP-85 relays`, `# Popular general purpose relays`, `# NIP-85 configuration`, `# Performance tuning`, `# Relay configuration`, `# Neo4j configuration`, `# Strfry configuration`, `# Owner`, `# Security`, `# Process all tasks interval`, `# Actions`) as section comments in the template. Helps reviewers diff against the heredoc.

The template's existing variables (`STRFRY_DOMAIN`, `NEO4J_USER`, `NEO4J_PASSWORD`, `BRAINSTORM_BATCH_SIZE`, etc.) that have **literal default values** (e.g., `STRFRY_DOMAIN="your.relay.com"`, `NEO4J_PASSWORD="neo4j"`) need to be **replaced with the `${VAR}` form** so they get substituted at boot from the entrypoint's env state — otherwise byte-equivalence fails (the heredoc writes `${DOMAIN_NAME}`'s actual value, not the literal `"your.relay.com"`).

Concretely, lines like:
```
export STRFRY_DOMAIN="your.relay.com"
export BRAINSTORM_RELAY_URL="wss://your.relay.com"
export NEO4J_PASSWORD="neo4j"
```
become:
```
export STRFRY_DOMAIN="${DOMAIN_NAME}"
export BRAINSTORM_RELAY_URL="${RELAY_URL}"
export NEO4J_PASSWORD="${NEO4J_PASSWORD}"
```

`BRAINSTORM_INPUT_FILE` and `BRAINSTORM_KEYS_FILE` and `BRAINSTORM_RELAY_PUBKEY` and `BRAINSTORM_RELAY_PRIVKEY` and `CONTROL_PANEL_PORT` are template-only variables (not in the heredoc). The Implementer's call: keep them or drop them? The heredoc does not emit them, so **drop them** to preserve byte-equivalence — these were dead variables that bare-metal installs may have been writing but never functionally needed (verify in smoke if any code actually reads them; if so, they need to be added to the heredoc's set, then the template, so we don't regress bare-metal).

The story #13 addition `export TASK_QUEUE_ENABLED=false` is the ONE variable that goes into the template WITHOUT being in the old heredoc — that's the entire point of story #16. The byte-equivalence test should explicitly allow this addition.

After Step 1, run the Tester's byte-equivalence test. It should pass.

### Step 2 — Entrypoint swap

**Create `tools/render-conf-template.js`** (new file):
```js
#!/usr/bin/env node
// Render a config template to stdout by substituting ${VAR_NAME} against process.env.
// Story #16 / ADR 0014.
//
// Usage:  node tools/render-conf-template.js <template-path>
// Output: substituted template on stdout. Exit 0 on success.
// Errors: nonzero exit + stderr message on unknown ${VAR} reference (missing env var)
//         or file-read failure.
//
// Substitution rules: ${VAR_NAME} only. Bare $VAR, $(cmd), backticks, ${VAR:-default}
// are left as literal text — this renderer is intentionally NOT a shell evaluator.

const fs = require('fs');
const path = require('path');

const templatePath = process.argv[2];
if (!templatePath) {
  console.error('Usage: render-conf-template.js <template-path>');
  process.exit(1);
}

let content;
try { content = fs.readFileSync(templatePath, 'utf8'); }
catch (e) { console.error(`Failed to read template ${templatePath}: ${e.message}`); process.exit(1); }

const VAR_REF = /\$\{([A-Z_][A-Z0-9_]*)\}/g;
const missing = [];
const rendered = content.replace(VAR_REF, (_match, name) => {
  if (Object.prototype.hasOwnProperty.call(process.env, name)) return process.env[name];
  missing.push(name);
  return '';
});
if (missing.length) {
  console.error(`RenderError: missing env vars in ${path.basename(templatePath)}: ${[...new Set(missing)].join(', ')}`);
  process.exit(2);
}
process.stdout.write(rendered);
```

**Edit `docker/entrypoint.sh`** ([line 39-122](docker/entrypoint.sh:39)):
- Remove the entire `# Generate /etc/brainstorm.conf` block (the `cat > ... << CONFEOF ... CONFEOF` heredoc).
- Replace with:
```bash
# Render /etc/brainstorm.conf from the template (story #16 / ADR 0014).
# See config/brainstorm.conf.template. Variable substitution against the env
# state set above. The renderer rejects unknown ${VAR} references with
# nonzero exit, so a missing env var fails the boot loudly.
if ! node "${BRAINSTORM_MODULE_BASE_DIR}/tools/render-conf-template.js" \
        "${BRAINSTORM_MODULE_BASE_DIR}config/brainstorm.conf.template" > /etc/brainstorm.conf; then
  echo "[entrypoint] FATAL: render of /etc/brainstorm.conf failed" >&2
  exit 1
fi
chmod 664 /etc/brainstorm.conf
echo "[entrypoint] /etc/brainstorm.conf generated from config/brainstorm.conf.template"
```

Keep `chmod 664` (matches existing behavior, line 124).

**Add the task-queue.json install block** after the existing `for conffile in graperank ...` loop (around line 134):
```bash
# Install /etc/brainstorm-task-queue.json on fresh containers (story #16 / ADR 0014).
if [ ! -f /etc/brainstorm-task-queue.json ] && [ -f "${CONFIG_DIR}/brainstorm-task-queue.json.template" ]; then
  cp "${CONFIG_DIR}/brainstorm-task-queue.json.template" /etc/brainstorm-task-queue.json
  chmod 644 /etc/brainstorm-task-queue.json
  echo "[entrypoint] Installed /etc/brainstorm-task-queue.json from template"
fi
```

**Create `config/brainstorm-task-queue.json.template`** (new file):
```json
{
  "defaultConcurrency": 1,
  "concurrencyByTask": {},
  "resourceClassCaps": {
    "neo4j-heavy": 1
  }
}
```

### Dockerfile

Verify `tools/` is COPIED into the image. Check `docker/Dockerfile` or whichever Dockerfile builds the `tapestry` image. If `tools/` isn't currently copied, add `COPY tools/ /usr/local/lib/node_modules/brainstorm/tools/` (or whichever destination matches `BRAINSTORM_MODULE_BASE_DIR`).

If it's already copied as part of a wildcard `COPY . .` or similar, no change needed — verify in cycle-local smoke.

### Tests

The Tester writes:

1. **Byte-equivalence test** at `test/entrypoint-template-rendering.test.js`:
   - T1: `tools/render-conf-template.js` exists and is parseable.
   - T2: `config/brainstorm.conf.template` contains every variable name that the heredoc currently writes (extracted by regex from `docker/entrypoint.sh`). The list is hardcoded once at this story; the test does not require entrypoint.sh's heredoc to exist after Step 2.
   - T3: With a fixed env fixture, rendering the new template via the Node renderer + normalizing (strip comments/blanks, sort by variable name) produces output that contains every `VAR=VALUE` pair the old heredoc would produce under the same env. Plus the new line `TASK_QUEUE_ENABLED=false`.
   - T4: `config/brainstorm-task-queue.json.template` exists and parses as JSON containing `resourceClassCaps.neo4j-heavy = 1`.
   - T5: `docker/entrypoint.sh` references `tools/render-conf-template.js` and contains a conditional install block for `brainstorm-task-queue.json`.

2. **Drift sentinel** (folded into the same suite):
   - T6: `docker/entrypoint.sh` does NOT contain a `<<\s*CONFEOF` heredoc writing to `/etc/brainstorm.conf` (catches future heredoc re-introduction).
   - T7: `docker/entrypoint.sh` contains exactly one invocation of `render-conf-template.js` (catches future multi-render proliferation).

3. **One-time diff helper** at `tools/diff-brainstorm-conf-render.sh` — for the Reviewer to eyeball the actual rendered output during smoke. Deleted as part of the impl PR's final cleanup commit, OR moved to `tools/legacy/` if the team prefers to keep it.

### Smoke

Cycle-local (Reviewer):
- Boot a fresh container WITHOUT a pre-existing `/etc/brainstorm.conf`. Observe the entrypoint log: `[entrypoint] /etc/brainstorm.conf generated from config/brainstorm.conf.template`. Then `[entrypoint] Installed /etc/brainstorm-task-queue.json from template`.
- Diff the resulting `/etc/brainstorm.conf` against what the heredoc would produce for the same env. Zero semantic differences (modulo comments + blanks).
- Verify `TASK_QUEUE_ENABLED=false` is present.
- Verify `/etc/brainstorm-task-queue.json` exists with the expected content.
- Restart the container: `/etc/brainstorm.conf` is regenerated (unconditional overwrite, same as today's heredoc behavior); `/etc/brainstorm-task-queue.json` is preserved (conditional copy, matches the other `*.conf` template behavior).

### Concept handle

None. No new concepts.

## Out of scope

- **Reconciling already-deployed long-running containers.** Operators handle via the manual `docker exec ...` recipe from story #15's flag-flip.
- **Migrating the other five conf files to the renderer.** Their existing conditional-copy works correctly for fresh containers; no need to touch.
- **`${VAR:-default}` soft-default support.** Future enhancement if operator need surfaces.
- **Env-var-overlay-based override mechanism** (e.g., docker-compose env_file lets operator force `TASK_QUEUE_ENABLED=true` per environment). Separate story.
- **Bare-metal install path code changes.** Step 1's template backfill incidentally fixes the bare-metal path. If a residual gap surfaces, separate story.
- **Comment / whitespace fidelity** between old and new rendered output. Semantic content (variable names + values) is what byte-equivalence pins.
- **A drift sentinel that walks `brainstormConfig.get()` call sites** across the JS codebase to assert every consumed variable is in the template. Useful but heavier; can be added later.
