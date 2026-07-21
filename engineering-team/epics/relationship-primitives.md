# Epic: relationship-primitives

**Created:** 2026-07-21
**Status:** Open

## Goal

Give the Tapestry operator **strfry-free primitives for editing the Neo4j reference graph directly**, starting with the two smallest: **add** and **delete** a single, typed relationship between two nodes that already exist in Neo4j. The governing premise (operator, verbatim, 2026-07-18): *"The information in neo4j should be considered the reference; it is 'me', the second brain of the tapestry owner / operator, or perhaps the brain of the tapestry assistant -- or perhaps both. Strfry is simply one format by which information can be communicated between one tapestry instance and another."* These primitives edit the reference without minting, re-signing, or publishing any nostr event.

This epic realizes the acceptance frame of book `engineering-team/audits/relationship-primitives/book.md` (**armed Direction-mode run**, armed 2026-07-21).

## Why it matters

Today the only way to add or remove a single relationship between two arbitrary existing nodes is raw Cypher — no existence checks, no relationship-type whitelist, no idempotency contract, no structured result — and **no single-edge delete exists anywhere** on the API surface; every existing composite write bakes in node-type assumptions and strfry emission. These primitives are the first of a planned family of "second brain" graph-editing tools, and they unblock routine graph curation that currently requires the operator to hand-write Cypher.

They also land on a freshly **secured** surface: unauthenticated mutations are now default-deny (epic `security-auth-exposure`), and default-deny alone still admits *authenticated non-owners* — so each operation must carry its own explicit owner gate (acceptance-frame refresh, 2026-07-21).

## Stories

1. `stories/relationship-primitives/1-relationship-add-delete-primitives.md` — both operations (add + delete) in one story — operator-ratified in the book's story-count rationale: they share a whitelist, a validation path, and a test harness. **Draft.**

## Key facts / guardrails

- **One story for both operations.** The book's total story cap (fix-forward included) is 3.
- **Whitelist limited to firmware-aliased relationship types.** Net-new custom types (e.g. `HAS_SUBGOAL` for the upcoming `second-brain` work) are excluded from this run and arrive as a post-book whitelist extension.
- **Firmware-install overwrite hazard is documentation-only** in this book (operator decision, 2026-07-18). Changing install's behavior is a separate epic; treating it as anything else is frame-changing.
- **Staging verification is read-only** (deployment probe only); all functional evidence is captured against the local stack; the deploy-safety `safe-to-merge` check is run against staging and journaled before this book's merge. See the book's autonomy ceiling.
