# Story 1: Verify the signature of client-published events before they mutate the graph

**Status:** Done
**Created:** 2026-09-11
**Type:** Bug (security / event authenticity)
**Epic:** `event-authenticity`

## Background

`POST /api/strfry/publish` is intentionally reachable without a session (it is the server dependency of all client-signed publishing — the permissionless, decentralized-first write path; ADR `security-auth-exposure/0002` allowlists it). Its `signAs:'assistant'` branch is owner/localTrusted-gated. Its `signAs:'client'` branch, however, takes the caller's event and publishes it **without the application verifying the signature** (`src/api/strfry/commands/publishEvent.js:58`), and downstream a derived write lands tag/graph nodes in Neo4j (the local-first "definitive me" graph) and the LMDB tapestry store (`src/api/strfry/tapestryBrainWrite.js`, `src/api/normalize/helpers.js`).

Because nothing in the app checks that the event was actually signed by its claimed `pubkey`, a remote unauthenticated caller can present an event that *claims* to be authored by the instance's Tapestry Assistant (or owner) but that they did not sign, and have it treated as authentic — forging TA-authored nodes into the graph. Worse, because a replaceable tag-element is keyed by its `d`-tag, reusing an existing element's identity **overwrites/deletes the genuine element first** — a destructive edit to locally-authored state (violates the local-first standard, CLAUDE.md invariant 4 / BIBLE §30).

Surfaced by the 2026-09-11 auth-surface audit (finding F1, Critical); confirmed live on staging + prod. The audit read the code path end to end; the *one* unconfirmed premise is whether the relay's own `strfry import` verification backstops this — the exec callback rejects only on a non-zero exit and the relay may exit 0 while logging a rejected event. That premise is for the Architect to confirm empirically; the fix must not depend on it.

Full technical detail is held privately (session advisory) — repo is PUBLIC; keep public text at pointer level until patched.

## User-facing description

As the instance and the web-of-trust that reads its graph, I want every event published through the control panel to carry a signature that is **valid for its claimed author**, so that no one can forge assistant-/owner-authored nodes into the definitive graph or destroy genuine ones by impersonation.

## Acceptance criteria

Testable from outside (a caller hitting `POST /api/strfry/publish`):

- [ ] Given a **forged** client event (well-formed, claiming an author's `pubkey`, but whose signature is not valid for that pubkey), when it is published via the client path, then it is **rejected** with an error and is **not** written to the relay, the Neo4j graph, or the tapestry LMDB store.
- [ ] Given a **validly-signed** event from **any** pubkey (self-signed, correct signature), when it is published via the client path, then it publishes as before — permissionless publishing is preserved; the gate is signature **authenticity**, never author **authorization**.
- [ ] Given a forged event that reuses an existing element's identity (`d`-tag), when it is rejected, then the **genuine element is not deleted or overwritten** (the destructive path is closed by rejecting before any write).
- [ ] The `signAs:'assistant'` path remains owner/`localTrusted`-gated exactly as today (no regression).
- [ ] Verification is performed **in the application** before the relay/graph/store write — it does not rely solely on the relay's import behavior.

## Concepts touched

The events being protected are tag-elements (kind 39999) published under tag concepts (e.g. the `tag` / `nostr-user-tag` families) and the derived nodes in the local-first tapestry graph. This story does not change any concept definition — it protects the write boundary. The Architect should resolve exact handles via `/api/concept-graph/summaries` if needed; no firmware reinstall is expected.

## Out of scope

- **F3** (the io-import path ingesting events with `--no-verify`, plus its Cypher-injection), **F4** (`trusted-list/publish` missing an auth gate), **F5** (the POST-only owner-gate class) — related audit findings, each its own future story in this epic or the authorization track. This story is only the `strfry/publish` client path.
- Author-based gating of publishing (would violate decentralized-first / permissionless publishing — principle 2). The fix is signature verification only.
- Sandbox propagation (`feat/tags` etc.) — deferred by the operator.
- Rate-limiting / spam control on the publish endpoint (a relay write-policy concern, not authenticity).

## Open questions

- Does `strfry import` reject a bad-signature event with a non-zero exit, or exit 0 while logging it? (Architecture — the empirical probe; the fix is app-level regardless.)
- Exactly where the verification belongs so that **both** the relay publish and the derived Neo4j/LMDB writes are gated by it (Architecture).

## Linked artifacts
- ADR: `engineering-team/decisions/event-authenticity/0001-verify-client-published-event-signatures.md`
- Test plan: `engineering-team/stories/event-authenticity/1-verify-client-published-event-signatures.test-plan.md`
- Review: `engineering-team/reviews/event-authenticity/1-verify-client-published-event-signatures.md`
