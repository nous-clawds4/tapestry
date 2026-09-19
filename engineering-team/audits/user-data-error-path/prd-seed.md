# PRD Seed: Control-panel resilience to datastore outages

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/user-data-error-path/audit.md`
**Anchor:** acceptance frame in `book.md`
**Confidence:** high *(the frame was explicit and the change is small)*
**Date:** 2026-09-19

> Reverse-engineered baseline in PRD shape. This book was a **reliability/robustness fix**, not a feature, so most PRD sections are thin by nature — recorded so the product team can see the resilience posture the fix established and decide whether to invest further.

## 1. Product vision
`[FROM FRAME]` A transient datastore (Neo4j) outage should degrade a **single request**, not the whole control panel. `[INFERRED]` The control panel is an operator/admin surface plus public read APIs; its availability during and just after deploys (when Neo4j is still binding) matters because real visitors hit it in that window.

## 2. Personas
- `[INFERRED]` **Deployment operator** — ships releases and watches the smoke; wants a clean post-deploy window and cheap diagnosis when something fails.
- `[INFERRED]` **Anonymous visitor** — hits public read APIs (`get-user-data`, `get-user-counts`, search); should never see a whole-process outage because one datastore-backed call failed.

## 3. Scope (as-built)
`[FROM FRAME]` In scope this book:
- A user-data handler's datastore-error branch returns a well-formed `500` JSON and keeps the process alive.
- The smoke procedure waits for Neo4j-readiness (not just HTTP readiness) before firing datastore-backed calls.
- Three neighbouring latent undeclared-identifier bugs tidied.
Out of scope (deferred): a process-wide unhandled-rejection backstop; broader input/error-path audits of other handlers.

## 4. Domain model
`[INFERRED]` None touched. No concepts, handles, schema, or event kinds. The change is purely in the request/error-handling layer.

## 5. Design rules (as-built)
`[INFERRED]` Emergent rules worth ratifying:
- A datastore-backed handler must **answer** (well-formed error) rather than let a rejection escape to the process. (This book fixed one site; the backstop below generalizes it.)
- Post-deploy verification must gate datastore-backed checks on **datastore readiness**, not HTTP readiness (`get-user-counts.verifiedFollowerCount` non-null ×3). `[recorded in docs/SMOKE_TEST.md]`

## 6. Carry-forward & open questions
Promoted from audit §6:
- **Global unhandled-rejection / uncaught-exception backstop** for the server entry — operator chose **log-and-exit**; not yet built. This is the main product-relevant next step: it turns "one hardened site" into "any future mishandled async failure degrades one request, not the process."
- Residual doc-hygiene (§8 citations) and other-area undeclared identifiers (OPEN.md row 329) — engineering cleanups, no product decision needed.

## 7. What product must validate
- [ ] Is process-level resilience (the log-and-exit backstop) worth a dedicated small effort now, or left as opportunistic hardening? `[product/operator decision]`
- [ ] Is there appetite for a broader error-path audit of the other public read handlers, or is per-incident fixing sufficient? `[UNKNOWN — product input needed]`
