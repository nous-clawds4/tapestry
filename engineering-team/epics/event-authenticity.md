# Epic: event-authenticity

**Created:** 2026-09-11
**Status:** Done (story 1 shipped to staging + prod 2026-09-11, branch merged; book `audits/event-authenticity/` Closed. F3/F4/F5 are a SEPARATE future epic/book — not a reopening of this Done epic, which would trip harness-lint L2 per OPEN.md row 268.)

## Goal

**Events that mutate the relay, the Neo4j graph, or the tapestry store must have a signature that is verified — in the application — as valid for their claimed author, before any write.** The web-of-trust and the local-first "definitive me" graph are only trustworthy if a node attributed to an author was actually signed by that author.

This epic is distinct from `security-auth-exposure` (which closed the *session/authorization* surface — the login bypass, the loopback bypass, default-deny). That epic is Done and its books are Closed; per the harness (OPEN.md row 268) new work opens here rather than reopening it. This epic is about **authenticity of published/ingested events**, not who is logged in.

## Why it matters

Publishing is permissionless by design (anyone may publish their own signed events — CLAUDE.md invariant 2), so the system must **not** gate publishing by author. But that makes signature authenticity load-bearing: the only thing separating "the TA published this" from "someone claimed to be the TA" is signature verification. Where that verification is missing, an unauthenticated caller can forge assistant-/owner-authored nodes into the graph and — because replaceable events are keyed by `d`-tag — destroy genuine locally-authored state by impersonation (violating the local-first standard, BIBLE §30).

## Stories

1. `stories/event-authenticity/1-verify-client-published-event-signatures.md` — verify the signature of client-published events (`POST /api/strfry/publish`, `signAs:'client'`) before they reach the relay/graph/store (audit finding **F1**, Critical, live). **Done** (review PASS 2026-09-11; shipped staging→prod, verified live).

*(Related audit findings are each a **separate future epic/book** — NOT reopened under this Done epic (harness-lint L2, OPEN.md row 268): **F3** — the io-import path ingesting events with `--no-verify` (+ its Cypher-injection), an authenticity sibling that would get its own epic. **F4/F5** are authorization gaps, not authenticity — the authenticated-non-owner track.)*

## Key facts / guardrails

- **Signature authenticity, never author authorization.** The fix must verify that the claimed author signed the event; it must not reject events from "unknown" authors. A valid self-signed event from any pubkey stays publishable.
- **Verify at the app boundary.** Do not rely on the relay's own `strfry import` verification as the sole gate — the derived Neo4j/LMDB writes happen in the app and must be gated by an app-level check.
- **Don't disturb the shipped auth surface.** `PUBLIC_MUTATIONS`, the `localTrusted` bypass, and the `signAs:'assistant'` owner gate (ADR `security-auth-exposure/0001`, `/0002`) stay as-is.
