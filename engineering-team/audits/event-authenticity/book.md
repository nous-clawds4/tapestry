# Book of Work: Event authenticity — verify client-published event signatures

**Slug:** event-authenticity
**Status:** Open
**Opened:** 2026-09-11
**Closed:** —

## Intent anchor

Acceptance frame (no PRD). The bounded ask: close audit finding **F1** — the client-signed publish path writing forged events into the definitive graph without app-level signature verification.

### Acceptance frame

- [ ] A client-published event whose signature is **not valid for its claimed author** is rejected and never reaches the relay, the Neo4j graph, or the tapestry LMDB store.
- [ ] A validly-signed event from **any** pubkey still publishes — permissionless publishing is preserved (the gate is authenticity, not authorization).
- [ ] A forged event that reuses an existing element's `d`-tag cannot delete or overwrite the genuine element.
- [ ] The `signAs:'assistant'` owner gate is unchanged; app-level verification does not rely solely on the relay's import behavior.
- [ ] Shipped through `staging` → `main`/prod (the exposure is live on both); public-facing text kept minimal until prod is patched.

## Epics in this book
- `event-authenticity` — story 1 closes F1. (F3 — the io-import no-verify path — is anticipated future scope, a separate book.)

## Companion operator-side tasks (NOT code)
- Sandbox propagation (`feat/tags`, `feat/communities`, `feature-magic-carpet`, `feat/curate`) is deferred by the operator and is **not** part of this book.

## Provenance
- **Mode:** Acceptance-frame *(no PRD; frame confirmed at kickoff 2026-09-11)*
- **Confidence at close:** —

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/event-authenticity/audit.md`
- Product feedback: `engineering-team/audits/event-authenticity/prd-seed.md`
