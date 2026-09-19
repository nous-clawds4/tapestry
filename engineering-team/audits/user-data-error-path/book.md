# Book of Work: Harden an error path in a user-data handler

**Slug:** user-data-error-path
**Status:** Open
**Opened:** 2026-09-18
**Closed:** —
**Gating:** **Human-gated.** Every phase gate is answered by the operator. This book is deliberately **not** run in Direction mode: it hardens a live error path on a public deployment, which is where a human belongs at each gate. There is no `## Direction mode` section by design.

## Intent anchor

**Acceptance frame (no PRD)** — restated and confirmed with the operator on 2026-09-18. Completion is *judged* against the bullets below.

> **Disclosure discipline (SECURITY.md; OPEN.md rows 276, 278).** The repo is public and this error path is live and unpatched at kickoff. The mechanism, the file:line, the endpoint-as-trigger, and the repro are held out-of-band — none of them appear in this book, the story, the test plan, the review, any commit message, or any ledger row until the fix is deployed. Public text says no more than "harden an error path in a user-data handler". The specifics live in an operator-held private note. The fix branch stays local until the operator approves the PR; push, merge, staging smoke, promote and production smoke run back to back to keep the disclosure window short.

### Acceptance frame

- [ ] An error path in a user-data handler is hardened so that the failure it currently mishandles instead produces a well-formed `500` JSON response and leaves the process running.
- [ ] A regression test exercises that error path (handler invoked with its datastore unreachable) and asserts both a `500` JSON response is sent and the process survives; it is red before the change and green after.
- [ ] Three further undeclared-identifier tidies in the same area, found in the same read-only sweep, are corrected with no behaviour change on any reachable path.
- [ ] Whether the server entry point should adopt a global unhandled-rejection / uncaught-exception policy is *raised* to the operator with options; the decision is the operator's and is recorded, not made inside this book.
- [ ] Shipped through the normal cycle: PR into `staging`, staging smoke, then — on operator approval — promotion to `main` and production smoke.
- [ ] After the fix is live on production, the out-of-band specifics are written into the records that need them (row 325 closed with the plain cause; `docs/SMOKE_TEST.md`, `OPERATIONS.md` §9.5, and the 2026-09-18 smoke-test intake entry corrected), through a separate doc-lane review.

## Epics in this book
- `user-data-error-path` — harden the error path, tidy the neighbouring identifiers, raise the process-level policy question.

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** —

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/user-data-error-path/audit.md`
- Product feedback: `engineering-team/audits/user-data-error-path/prd-seed.md`
