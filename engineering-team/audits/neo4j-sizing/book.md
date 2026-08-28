# Book of Work: Neo4j Sizing Override

**Slug:** neo4j-sizing
**Status:** Open
**Opened:** 2026-08-28
**Closed:** —
**Strictness:** Light (trial) — workflows/light-profile.md *(second trial book; single Bug-lane
story: Implementer + Reviewer, one human stop at Gate B)*

## Intent anchor

**Acceptance frame (no PRD)** — the operator's ask, restated and confirmed (2026-08-28 session,
following the row-185 crash-loop diagnosis): make Neo4j memory sizing survive shared-VM dev
machines **without changing the healthy droplets in any way** — "don't fix what ain't broken."
Design ratified by the operator in-session and pinned in OPEN.md row 186: an **opt-in env
override**, formula-default untouched and regression-pinned; store-size-driven sizing explicitly
rejected.

### Acceptance frame

- [ ] **Override:** `docker/entrypoint.sh` honors `BRAINSTORM_NEO4J_HEAP_MB` / `_CACHE_MB` /
      `_TX_MAX_MB` verbatim when set; unset **or empty** ⇒ the existing formula runs unchanged
      and the written config is byte-identical to today's.
- [ ] **Plumbing:** `docker-compose.yml` passes the three vars through with empty defaults
      (the `ALLOW_INDEXING` pattern) — no warnings and no behavior change on droplets that
      never set them.
- [ ] **Regression pins:** a suite reproduces today's real values from the formula (staging's
      8038/8038/4019 from its measured MemTotal) and proves override-verbatim,
      empty≡unset, and the documented per-var independence.
- [ ] **Local durability:** the dev profile (2048/1024/1024) lives in the gitignored local
      `.env`; the local container is rebuilt + recreated on the new image and comes up healthy
      with the override active — the row-185 in-container hotfix is superseded, and a future
      `docker restart`/rebuild can no longer resurrect the crash loop.
- [ ] **Droplet no-change proof:** after the staging deploy of this change, staging's live
      `neo4j.conf` still reads exactly 8038/8038/4019, Neo4j up, zero OOM events.
- [ ] **Ledger:** row 186 flipped DONE with its attribution corrected (the live generator is
      `docker/entrypoint.sh`, not the legacy host-install script).

## Epics in this book
- `neo4j-sizing` — the entrypoint memory override.

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** —

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/neo4j-sizing/audit.md`
- Product feedback: `engineering-team/audits/neo4j-sizing/prd-seed.md`
