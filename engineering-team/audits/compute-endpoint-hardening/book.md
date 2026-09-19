# Book of Work: Harden and restrict an admin computation endpoint

**Slug:** compute-endpoint-hardening
**Status:** Closed
**Opened:** 2026-09-19
**Closed:** 2026-09-19 — fix live on all four public hosts (prod/staging #684→#685; tags/magic-carpet backported e8ca6597/ebb941b3), unauth → 401 verified on each; no exploitation found in operator log-checks. Operator-ratified close. Audit + prd-seed under this dir.
**Gating:** **Human-gated, expedited.** A live remotely-exploitable defect on public deployments; the operator answers the ship gates. Build phases run continuously (frame pre-approved); the outward-facing merges stop for approval.

## Intent anchor

**Acceptance frame (no PRD)** — restated and confirmed with the operator on 2026-09-19. Completion is *judged* against the bullets below.

> **Disclosure discipline (SECURITY.md; OPEN.md rows 276, 278) — stricter than row 325.** The repo is
> public and this defect is live and unpatched. Public text (this book, the story, the test plan, the
> review, every commit message, the PR title/body, any ledger row) must **not** name the endpoint, the
> vulnerability class, or the repro. Public wording is no more than *"restrict and harden an admin
> computation endpoint."* The mechanism, the endpoint, the verification and the exploit shape are held
> out-of-band in an operator-held private note and passed to each phase directly. The regression test
> and the fix diff necessarily encode the specifics, so the branch stays **local** until the operator
> approves the PR, and push → merge → staging → promote → prod run back to back to keep the window short.

### Acceptance frame

- [ ] An admin computation endpoint no longer executes attacker-controlled input as a subprocess
      argument in a way that could be interpreted by a shell (inputs strictly validated; the
      subprocess invoked without a shell).
- [ ] That endpoint is not reachable without owner authentication.
- [ ] A regression test proves both: a crafted input value cannot cause anything beyond the intended
      program to run, and an unauthenticated request is rejected.
- [ ] A dead duplicate of the endpoint's command module (present in the tree, loaded by nothing) is
      removed.
- [ ] Shipped via the gated cycle; public text stays generic until it is live on production.

## Epics in this book
- `compute-endpoint-hardening` — validate inputs, invoke the subprocess without a shell, and require
  owner auth on the endpoint; remove the dead duplicate.

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** high

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/compute-endpoint-hardening/audit.md`
- Product feedback: `engineering-team/audits/compute-endpoint-hardening/prd-seed.md`
