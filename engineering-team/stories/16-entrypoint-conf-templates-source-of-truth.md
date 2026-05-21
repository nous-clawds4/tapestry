# Story 16: Conf-template-driven entrypoint as the single source of truth for fresh container state

**Status:** Approved
**Created:** 2026-05-21
**Type:** Bug (latent class-of-bug: silent template-vs-heredoc drift)

## Background

While reviewing why story #15's flag-flip required a manual `>> /etc/brainstorm.conf` step on long-running containers, we discovered that `docker/entrypoint.sh` regenerates `/etc/brainstorm.conf` on every container restart from a **heredoc embedded in the entrypoint script itself** ([entrypoint.sh:40-122](docker/entrypoint.sh:40)) — not from `config/brainstorm.conf.template`. The template file is consulted only by the bare-metal install path in `setup/install-control-panel.sh`; it has **no effect on Docker deployments at all**.

This means story #13's addition of `export TASK_QUEUE_ENABLED=false` to `config/brainstorm.conf.template` was **inert at Docker runtime**. A brand-new container spun up today does NOT contain `TASK_QUEUE_ENABLED` in its `/etc/brainstorm.conf`; the variable falls back to its code default (`false`) every time, and any operator wanting to flip the flag must manually add the line. The "story #13 shipped the flag" + "operator must manually backfill the line on each container" pattern is a class-of-bug that will repeat on every future feature flag added to a template.

A related gap: `brainstorm-task-queue.json` (the per-class concurrency config introduced by story #15) has **no install logic in the entrypoint at all**. Operators must create the file manually on every fresh instance, in addition to the brainstorm.conf line.

The other five conf files (`graperank`, `whitelist`, `blacklist`, `nip56`, plus `concept-graph`) already use a template-driven copy-if-absent loop ([entrypoint.sh:130-134](docker/entrypoint.sh:130)) — fresh containers get them correctly from their templates. The trap is **specific to brainstorm.conf** (heredoc duplication) and **`brainstorm-task-queue.json`** (no install path).

This story closes the class by making the templates the **single source of truth** for Docker-fresh container state, eliminating the heredoc duplication and adding install logic for the task-queue config.

### Critical prerequisite discovered at planning gate (2026-05-21)

A direct comparison of the heredoc (40 variables) against `config/brainstorm.conf.template` (16 variables) revealed **dramatic divergence**. The template has been getting selective edits (story #13's `TASK_QUEUE_ENABLED`, plus a few legacy lines from `setup/install-control-panel.sh`) but has **never** been maintained as a complete replacement for the heredoc. Switching the entrypoint to read from the template as-is would silently delete ~25 variables from fresh containers' `/etc/brainstorm.conf`, including:

- All `BRAINSTORM_MODULE_*_DIR` env vars (control panel boot would fail).
- All `BRAINSTORM_*_RELAYS` lists (WoT, NIP-85, popular general — the system's default relay sets).
- `BRAINSTORM_OWNER_PUBKEY` / `OWNER_NPUB` / `ADMIN_PUBKEYS` (owner auth would break).
- `SESSION_SECRET` (sessions would break).
- `STRFRY_PLUGINS_BASE` / `STRFRY_PLUGINS_DATA` (plugin loading would break).
- `BRAINSTORM_LOG_DIR` / `BRAINSTORM_BASE_DIR` (filesystem roots used everywhere).
- `BRAINSTORM_30382_LIMIT`, `BRAINSTORM_NEO4J_BROWSER_URL`, `BRAINSTORM_PROCESS_ALL_TASKS_INTERVAL`, and several action flags.

The work therefore breaks into **two ordered steps**, both inside this story:

**Step 1 — Backfill the template to match the heredoc.** Update `config/brainstorm.conf.template` so it contains every variable the heredoc currently writes, with the same values (literals for fixed values; `${VAR}` substitution markers for env-var-dependent values like `${DOMAIN_NAME}`, `${OWNER_PUBKEY}`, `${NEO4J_PASSWORD}`, `${SESSION_SECRET}`). After this step, the template is functionally complete but the entrypoint still uses the heredoc — verification is just diffing rendered template against heredoc output.

**Step 2 — Swap the entrypoint to read from the template.** With the diff clean, remove the heredoc and replace with a template-render call. Cycle-local smoke confirms the resulting `/etc/brainstorm.conf` is byte-equivalent to today's.

Step 1 is the larger and riskier of the two; Step 2 is mechanically simple once Step 1 is clean. The byte-equivalence AC below pins the safety guarantee for the swap.

## User-facing description

**As an operator** spinning up a fresh Tapestry container (new droplet, sandbox, or rebuild), **I want** the container's `/etc/brainstorm.conf` and `/etc/brainstorm-task-queue.json` to automatically contain every variable currently declared in the repo's `config/` templates, **so that** I don't have to remember to manually backfill missing variables introduced by recent stories — and so that every feature flag added to a template "just works" on the next fresh deploy without operator ceremony.

## Acceptance criteria

- [ ] **Byte-equivalence (strictest AC — the safety guarantee).** The `/etc/brainstorm.conf` produced by the new entrypoint on a fresh container start is **semantically equivalent** (every variable set with the same value) to the `/etc/brainstorm.conf` produced by today's entrypoint heredoc, given the same deploy-time env vars (`DOMAIN_NAME`, `RELAY_URL`, `NEO4J_PASSWORD`, `OWNER_PUBKEY`, `OWNER_NPUB`, `ADMIN_PUBKEYS`, `SESSION_SECRET`, plus any others the heredoc consumes). Verification mechanism: render once with the new path, once with the old, diff (modulo whitespace and comments). Zero semantic differences. The Tester / Reviewer is expected to drive this verification end-to-end against a sandbox container.
- [ ] **Step 1 — template backfill.** `config/brainstorm.conf.template` contains every variable the current heredoc writes, with the same values. Env-var-dependent values use `${VAR}` substitution markers consistent with the mechanism chosen by the Architect.
- [ ] **Step 2 — entrypoint swap.** `docker/entrypoint.sh` no longer contains a heredoc duplicating `brainstorm.conf` content. Instead, the entrypoint reads `config/brainstorm.conf.template` and writes the result to `/etc/brainstorm.conf` at container start.
- [ ] Adding a new `export VAR=value` line to `config/brainstorm.conf.template` and rebuilding the container image is sufficient — by itself — for fresh containers to receive that variable in `/etc/brainstorm.conf`. No corresponding change to `entrypoint.sh` is required for the variable to propagate.
- [ ] Specifically: on a fresh container start, `/etc/brainstorm.conf` contains `export TASK_QUEUE_ENABLED=false` (the line story #13 added to the template but which never reached fresh Docker deployments).
- [ ] `docker/entrypoint.sh` is extended to install `/etc/brainstorm-task-queue.json` on fresh containers from a new template (`config/brainstorm-task-queue.json.template` or equivalent), using the same conditional copy-if-absent pattern already used for `graperank.conf` et al. The template ships with the deploy-safe defaults: `{"defaultConcurrency":1,"concurrencyByTask":{},"resourceClassCaps":{"neo4j-heavy":1}}`.
- [ ] No regression for existing containers: when the new entrypoint runs against a container that already has values in `/etc/brainstorm.conf` (from a prior boot or operator edit), the resulting `/etc/brainstorm.conf` contains all the same variables that today's heredoc would produce, with the same values. (Operator overrides written to `/etc/brainstorm.conf` between restarts are NOT preserved — that's already the current behavior since the heredoc unconditionally overwrites; this story doesn't change that posture.)
- [ ] No regression for the other five `*.conf` files: their existing copy-if-absent loop continues to work unchanged.
- [ ] The boot log makes the new behavior observable: at minimum, a single line confirming `[entrypoint] /etc/brainstorm.conf generated from config/brainstorm.conf.template`.
- [ ] Documentation in `OPERATIONS.md` notes the new "template is single source of truth for fresh containers" contract, and explicitly notes the existing trap: edits to `/etc/brainstorm.conf` made manually inside a running container are lost on the next restart. Operators wanting persistent overrides must add them to the template (committed to the repo) or set them via deploy-environment variables.

## Concepts touched

- `docker/entrypoint.sh` (the script that runs at container startup)
- `config/brainstorm.conf.template` (currently inert at Docker runtime — becomes the source of truth)
- `config/brainstorm-task-queue.json.template` (new — companion to the json config introduced by story #15)
- `/etc/brainstorm.conf` and `/etc/brainstorm-task-queue.json` in the container
- Operator workflow for enabling new feature flags

## Out of scope

- **Reconciling already-deployed long-running containers** (staging, prod, tags). The operator handles those manually via the `docker exec ... if grep -q ... else echo >> ...` recipe used during story #15's flag-flip. This story benefits new containers spun up after the deploy lands.
- **Migrating operator edits made inside a running container to the template.** If the operator has manually set `TASK_QUEUE_ENABLED=true` inside a container's `/etc/brainstorm.conf` and we want that to persist across restarts, the operator should put it in the template (commit to repo) — or we should add env-var-driven overrides (a separate story).
- **Env-var-based overrides** (e.g., `${TASK_QUEUE_ENABLED:-false}` in the template, set via docker-compose env_file). Worth considering but adds design choices; defer to a follow-up if operator need surfaces.
- **Comment / blank-line fidelity** between template and generated conf. The semantic content is what matters; cosmetic differences are acceptable.
- **Restructuring the bare-metal install path** (`setup/install-control-panel.sh`). It reads the template directly without the heredoc-overlay. **Important corollary (noted at planning):** because the template was missing ~25 variables before Step 1 of this story, the bare-metal install path has very likely been producing incomplete `/etc/brainstorm.conf` files. This story's Step 1 backfill **incidentally fixes** the bare-metal install path as a side effect. No separate code change to `setup/install-control-panel.sh` is required, but the Reviewer should confirm during smoke that a freshly-rendered template would also produce a working bare-metal `/etc/brainstorm.conf` — or call out the gap as a separate follow-up story if it's broken in a way the template alone can't fix.
- **The five other conf templates**. Their entrypoint logic is already correct for fresh containers; no change.

## Open questions

**Resolved with operator at Planning (2026-05-21):**

- **Source of truth for `/etc/brainstorm.conf` in Docker** → **the template** (`config/brainstorm.conf.template`). Entrypoint heredoc is eliminated; variable substitution for environment-derived values handled by the template-rendering mechanism the Architect picks.
- **Install path for `/etc/brainstorm-task-queue.json` on fresh containers** → **yes, mirror the existing conditional-copy pattern**. Ship a new `config/brainstorm-task-queue.json.template` with the deploy-safe defaults.

**Deferred to Architect:**

- **Variable-substitution mechanism for the template.** The current heredoc uses bash `${VAR}` expansion against env vars set earlier in the entrypoint (`${DOMAIN_NAME}`, `${OWNER_PUBKEY}`, `${NEO4J_PASSWORD}`, `${SESSION_SECRET}`, `${ADMIN_PUBKEYS}`, etc.). Architect picks the rendering mechanism: `envsubst`, a small `eval cat <<EOF` shim, or a Node-based renderer. The choice has implications for the template's notation — `envsubst` requires bare `${VAR}` references that exist in the env at render time; `eval cat <<EOF` permits `${VAR:-default}` and conditional/arithmetic expressions but has injection risk if the template ever included untrusted content (low risk here — template is repo-controlled).
- **Where to land the new task-queue.json template.** `config/brainstorm-task-queue.json.template` is the obvious slot; Architect confirms.
- **Whether to ship a drift-sentinel test** that fails if `config/brainstorm.conf.template` and `docker/entrypoint.sh` ever disagree — even though the heredoc is being eliminated, an analogous drift could re-emerge if a future Architect adds entrypoint-specific overrides. Architect's call.
- **How to mechanize the byte-equivalence verification.** Possibilities: (a) cycle-local script that boots two sandbox containers (one with old entrypoint, one with new) and diffs the resulting `/etc/brainstorm.conf`; (b) a render-the-template-to-stdout helper that the Reviewer manually diffs against the heredoc-produced file; (c) a sentinel test that grep-asserts every variable name from the old heredoc appears in the new template. Architect picks the verification mechanism that gives highest confidence with lowest ceremony.

**Resolved at planning amendment (2026-05-21):**

- **Bare-metal install path scope** → **fixed incidentally by this story**, not as a separate story. The template backfill (Step 1) is exactly what the bare-metal path needed too. The Reviewer should confirm during smoke; if a residual bare-metal-only issue surfaces, it gets its own story.

## Linked artifacts

- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
