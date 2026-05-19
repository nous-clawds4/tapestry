# Story 10: Header→ConceptGraph self-describing tag (hybrid)

**Status:** Approved
**Created:** 2026-05-19
**Type:** Feature

## Background
A single fetched kind-39998 Header cannot self-resolve its concept off-relay — the `IS_THE_CONCEPT_GRAPH_FOR` Neo4j edge is invisible without the graph. Discovery established that the Concept Graph node's a-tag is **deterministically computable** from the Header (`39999:<pubkey>:<slug>-concept-graph`, per `src/api/normalize/index.js:643`). Ratified design **C (hybrid)**: new headers carry an explicit pointer tag; resolution is **tag-if-present, else compute** the deterministic a-tag. This is the keystone primitive that later unblocks stream #5 (element/superset materialization). Tracked under ADR 0006 §"Out of scope"; ADR 0007 designs it.

## User-facing description
As a consumer of a community-published concept, given only the curator's 39998 Header, I can locate its Concept Graph (and thence the full concept) — because the Header is self-describing (or deterministically computable), with no reliance on a Neo4j edge I can't see off-relay.

## Acceptance criteria
- [ ] A new Header from `POST /api/normalize/create-concept` carries a concept-graph pointer tag whose value is exactly `39999:<header-pubkey>:<header-dtag>-concept-graph`.
- [ ] Firmware reinstall produces firmware headers carrying the tag; deterministic ⇒ re-runs identical (idempotent), strfry-replaceable.
- [ ] Headers **without** the tag remain resolvable via the documented compute rule (rule documented in BIBLE; the *consumer* is stream #5, not this story).
- [ ] Zero behavior change for anything not reading the tag (nothing reads it yet).
- [ ] BIBLE documents the tag **and** the `tag-else-compute` resolution contract (§5/§8 + glossary).

## Concepts touched
- Every kind-39998 ConceptHeader emitted by `create-concept` / firmware install (gains one tag). No existing prod header is re-emitted (compute-fallback covers them — the point of hybrid C).

## Out of scope
- Consumption/traversal of the pointer — that **is** stream #5 (element/superset materialization).
- Any mass re-emit/backfill/re-derivation of existing prod headers (hybrid C deliberately avoids this; legacy/firmware headers resolve via the compute fallback).
- Changes to materialization, REFERENCES, the firmware `communityReference`, or export.

## Open questions (resolved in Architecture / ADR 0007)
- Exact tag key/shape — descriptive custom `["concept-graph","39999:…"]` vs NIP-01 `["a","39999:…","","concept-graph"]`. BIBLE §5 protocol surface; ratified by the user at ADR time.

## Linked artifacts
- ADR: `engineering-team/decisions/0007-header-conceptgraph-tag.md` (Accepted; Option A — descriptive `concept-graph` tag, hybrid tag-else-compute)
- Test plan: `engineering-team/stories/10-header-conceptgraph-tag.test-plan.md` (T1 sentinel; behavioral AC-1/AC-2 deferred to cycle-local smoke — authoritative, Reviewer-required)
- Review: `engineering-team/reviews/10-header-conceptgraph-tag.md` — **PASS (code/ADR/scope)**; behavioral acceptance gated on the Reviewer-required cycle-local smoke S1/S2
