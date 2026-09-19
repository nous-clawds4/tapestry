# Epic: compute-endpoint-hardening

**Created:** 2026-09-19
**Status:** Open
**Book:** `engineering-team/audits/compute-endpoint-hardening/book.md` (acceptance-frame)
**Provenance:** Operator request, 2026-09-19 in-session ("item 2"), following the `user-data-error-path`
fix. A read-only sweep surfaced an admin computation endpoint that trusts client input; the specifics
are held out-of-band (SECURITY.md; live and unpatched on public deployments) — see the book for the
disclosure discipline.

## Goal

Harden and restrict an admin computation endpoint: strictly validate its inputs, invoke its
subprocess without a shell, and require owner authentication to reach it. Remove a dead duplicate of
its command module. Pin the behaviour with a regression test.

## Stories (planned at kickoff)
`stories/compute-endpoint-hardening/`:
1. `1-harden-and-restrict-compute-endpoint.md` — validate inputs, shell-free subprocess invocation,
   owner-auth gate, delete the dead duplicate, regression test. Bug, Standard (Architecture skipped as
   obvious).

## Key facts / guardrails
- **Public text is generic only** — no endpoint name, no vulnerability class, no repro, in any tracked
  file or commit until the fix is live on production.
- **Branch stays local until the ship gate** (OPEN.md row 278). Expedited: push → merge → staging →
  promote → prod back to back once approved.
- **Targeted auth gate**, not a broad middleware change: gate this endpoint by adding its path to the
  middleware's existing GET-scoped owner-only lists (data-only) rather than altering the shared
  owner-list *matching logic*, which could affect other routes.
