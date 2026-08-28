# Story 1: Entrypoint memory override

**Status:** Done
**Created:** 2026-08-28
**Type:** Bug *(Light lane — workflows/light-profile.md: Implementer + Reviewer, one human stop
at Gate B; no irreversibility trigger fires (single-repo config path). Scoped gate:
`node -e "Promise.all(['./test/neo4j-sizing-override.test.js','./test/entrypoint-template-rendering.test.js'].map(p=>require(p).run())).then(rs=>{const f=rs.reduce((s,r)=>s+r.fail,0);console.log('TOTAL_FAIL='+f);process.exit(f?1:0)})"`)*

## Background
`docker/entrypoint.sh` sizes Neo4j at every container start from `/proc/meminfo` `MemTotal` —
truthful on a dedicated droplet, but on a shared Docker VM it counts RAM belonging to a dozen
sibling containers. On this dev machine the formula's medium branch produced 6792m heap
(AlwaysPreTouch) + 6792m pagecache + 3396m tx for a 496MB store, and the kernel OOM-killed
Neo4j 1,328 times over six weeks (OPEN.md row 185, fixed in-container 2026-08-28 — a hotfix
that any container restart or rebuild erases, because the entrypoint regenerates the config).
Staging's droplet, by contrast, is healthy: the same formula yields 8038/8038/4019 on 32.9GB
for a 6.6GB store, with zero OOM events in 130 days of host kernel history.

## User-facing description
As the operator of a shared-VM dev machine, I want to pin Neo4j's memory profile in my local
`.env`, so that container restarts and rebuilds can never resurrect the crash loop — while
every deployment that sets nothing (all droplets) keeps provably identical behavior.

## Acceptance criteria
- [x] AC-1: With none of `BRAINSTORM_NEO4J_HEAP_MB` / `_CACHE_MB` / `_TX_MAX_MB` set — or set
      to the empty string — the entrypoint's computed values and written config lines are
      identical to today's: the formula reproduces staging's live 8038/8038/4019 from its
      measured MemTotal (32,866,228 kB), pinned behaviorally.
- [x] AC-2: With a var set, its value is used verbatim in the written config. Vars are
      independent; an overridden heap does **not** re-derive the tx ceiling — a coherent
      profile sets all three (documented in the script comment).
- [x] AC-3: `docker-compose.yml` passes the three vars through with empty defaults; the
      entrypoint logs a single note line when any override is active, in `set -e`-safe form.
- [x] AC-4: The local `.env` carries 2048/1024/1024; after image rebuild + container recreate,
      the live config shows the override, Neo4j is healthy, and the concept-graph API answers.
- [x] AC-5: After this change deploys to staging, its live config still reads exactly
      8038/8038/4019 with Neo4j up — the droplet no-change proof.
- [x] AC-6: `entrypoint-template-rendering` guard suite stays green.

## Design note *(Light profile — provisional here, ratified at Gate B)*
- **Chosen approach:** three `VAR="${BRAINSTORM_…:-$VAR}"` lines inserted in
  `docker/entrypoint.sh` immediately after the formula computes `NEO4J_TX_MAX_MB` (and before
  the config-writing block), plus an `if/fi`-guarded note line (`set -e`-safe). Compose gains
  three `${VAR:-}` pass-throughs after `ALLOW_INDEXING` (the established opt-in pattern).
  `:-` (not `-`) so compose's empty-string injection on droplets behaves as unset. Test suite
  `test/neo4j-sizing-override.test.js` extracts the sizing block from the real script, stubs
  `grep`/`nproc` as shell functions, and executes it under env combinations — pinning staging's
  real values, the branch thresholds, override-verbatim, empty≡unset, and per-var independence;
  S-class assertions pin the compose plumbing and the block's position before the writer.
- **Rejected alternative:** store-size-driven sizing — rejected by the operator (2026-08-28,
  row 186): it would silently resize the healthy droplets, the exact "fix what ain't broken"
  hazard this design exists to avoid.
- **Blast radius:** `docker/entrypoint.sh` (4 logic lines + comment + note), `docker-compose.yml`
  (3 env pass-throughs + comment), new test suite + `test/test.js` registration, local `.env`
  (untracked), OPEN.md row 186. The deploy workflows' `sed` on compose touches only the ports
  line — no interaction.
- **Rollout mechanics:** droplets receive the change at their next deploy rebuild and, with no
  env set, regenerate identical config; the local machine rebuilds + recreates in-story
  (named volume `tapestry-neo4j` persists — the definitive store is untouched, principle 4).

## Edge cases & not-covered
- E1: compose injects **empty strings** for unset host vars — `:-` expansion treats empty as
  unset, so droplets hit the formula path even though the vars "exist" in the environment.
- E2: partial override (heap only) → heap verbatim, cache and tx stay formula-derived (from the
  *computed* heap) — documented independence, pinned by a test.
- E3: the formula's 24000MB branch threshold — this machine's ~23,982MB sits just under it
  (medium branch, 7GB reserve); the pin covers both branches so a future formula edit can't
  silently move the boundary.
- **Not covered:** re-deriving tx from an overridden heap (rejected — more logic on the shared
  path); the legacy host-install script `setup/install-neo4j.sh` (unused in the container
  path; row 186 notes it).

## Linked artifacts
- ADR: — (no trigger; Design note above)
- Test suite: `test/neo4j-sizing-override.test.js` (+ guard `entrypoint-template-rendering`)
- Review: `engineering-team/reviews/neo4j-sizing/1-entrypoint-memory-override.md`

Link by path only — never record verdicts or round history in this file.
