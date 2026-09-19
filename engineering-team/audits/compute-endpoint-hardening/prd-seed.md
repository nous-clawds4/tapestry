# PRD Seed: Admin computation endpoint access & input safety

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/compute-endpoint-hardening/audit.md`
**Anchor:** acceptance frame in `book.md`
**Confidence:** high
**Date:** 2026-09-19

> Reverse-engineered baseline in PRD shape. This was a **security fix** (unauthenticated remote command injection on a real-time compute endpoint), not a feature, so the PRD framing is thin — recorded so the product/security posture is legible and the generalizations are visible for the next phase.

## 1. Product vision
`[FROM FRAME]` Admin/owner-only computation endpoints must (a) accept only well-formed input, (b) run their server-side programs without a shell, and (c) refuse callers who are not the owner. `[INFERRED]` The underlying posture: expensive, privileged real-time computations are an operator tool, not a public API, and must not become a foothold.

## 2. Personas
- `[INFERRED]` **Operator/owner** — the only legitimate caller of real-time compute endpoints (pagerank generation, etc.).
- `[INFERRED]` **Anonymous remote party** — must be unable to reach or influence server-side execution through these endpoints.

## 3. Scope (as-built)
`[FROM FRAME]` In scope this book: input validation + shell-free invocation + owner-auth gate on `personalized-pagerank`, dead-twin removal, regression coverage, and backport to the two sandbox hosts. Out of scope: broadening the auth middleware's matching logic; other endpoints' shell-string call sites (tracked separately).

## 4. Domain model
`[INFERRED]` None touched. Purely request-validation, subprocess-invocation, and auth-gating layers.

## 5. Design rules (as-built)
`[INFERRED]` Emergent rules worth ratifying across the codebase:
- **Never build a subprocess command as a shell string from client input** — validate strictly, then `execFile`/`spawn` with an argument vector. (This book fixed one site; OPEN.md row 328 tracks ~16 more `exec(\`strfry scan …\`)` sites to converge.)
- **Owner-only endpoints must be gated for every method they expose**, not just POST — the middleware's owner-list was POST-only, which is how a GET slipped through.
- A parameter used as both a subprocess argument and a filesystem path segment must be validated tightly enough to be safe for both (64-hex covers both here).

## 6. Carry-forward & open questions
Promoted from audit §6:
- **log-and-exit unhandled-rejection backstop** (shared carry-forward) — would have contained this class too.
- **Shell-string call-site cleanup** (OPEN.md row 328) — the largest remaining instance of the same anti-pattern.
- **A systematic auth-coverage audit** — are there other owner-intended endpoints gated for only some methods? `[UNKNOWN — worth a scan]`

## 7. What product must validate
- [ ] Is a codebase-wide "no shell strings from client input" + "gate owner endpoints for all methods" sweep worth scheduling now (it maps onto OPEN.md row 328 + a method-coverage audit)? `[security/operator decision]`
- [ ] Should real-time compute endpoints move behind a clearer owner-only API boundary (vs. per-endpoint gating)? `[UNKNOWN — product/architecture input needed]`
