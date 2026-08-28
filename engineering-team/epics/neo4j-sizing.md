# Epic: neo4j-sizing

**Created:** 2026-08-28
**Status:** Active
**Book:** `engineering-team/audits/neo4j-sizing/book.md` (acceptance-frame, **Light profile
trial** #2 — workflows/light-profile.md; Bug lane)
**Provenance:** Operator request 2026-08-28 (in-session), out of the row-185 Neo4j crash-loop
diagnosis: the entrypoint's dynamic sizing trusts `MemTotal`, which on a shared Docker VM counts
RAM belonging to other containers. Design ratified in-session (OPEN.md row 186): opt-in env
override, droplet defaults untouched and regression-pinned; store-size-driven sizing rejected.

## Goal
A shared-VM dev machine can pin Neo4j to a sane memory profile via `.env`, durably across
container restarts and rebuilds — while every deployment that sets nothing keeps byte-identical
config, provably.

## Stories
`stories/neo4j-sizing/`:
1. `1-entrypoint-memory-override.md` — the override + compose plumbing + regression pins +
   local durable profile. Bug, Light lane.

## Decisions
None — no irreversibility trigger (single-repo config path, no wire format, no new dependency);
Design note in the story.
