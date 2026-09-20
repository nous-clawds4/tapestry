# Book of Work: NIP-05 SSRF guard

**Slug:** nip05-ssrf-guard
**Status:** Closed
**Opened:** 2026-09-20
**Closed:** 2026-09-20

## Intent anchor

**Acceptance frame (no PRD)** — from `engineering-team/stories/_intake.md` § "2026-05-17 — Bug:
unauthenticated NIP-05 verification is a constrained SSRF surface", whose asks were confirmed
verbatim at triage and whose Architect's call is recorded inline there (Architecture skipped).

### Acceptance frame

- [x] One shared guard, used by all three NIP-05 verification call sites, rejects a domain
      **before** any outbound fetch when the host is — or resolves to — a loopback, private,
      link-local or otherwise non-public address.
- [x] The guard fails closed: an unresolvable host, an empty host, a DNS error or an empty
      answer all reject, and each call site's existing downstream semantics
      (`verified: false` / lookup-failed / `null`) are unchanged.
- [x] The predicate is exported so the `assistant-profile` #3 story can reuse it for
      OPEN.md row 148 (the published-assistant picture guard's RFC1918 gap).
- [x] A stack-free behavioural test covers the address classes the intake names, and is
      shown red against the unguarded code before the fix lands.
- [x] Rate limiting (intake ask #2) is deliberately **not** added; the reason is recorded
      in the story and carried into the close.

## Epics in this book
- `nip05-ssrf-guard` — the shared pre-fetch address guard and its three call sites.

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** high — the anchor was written at intake from a 2026-05-17 intake entry that recorded the asks verbatim, and every frame bullet is checkable against the diff.

## Close artifacts
- Build audit: `engineering-team/audits/nip05-ssrf-guard/audit.md`
- Product feedback: `engineering-team/audits/nip05-ssrf-guard/prd-seed.md`

**Shipped:** PR #703, merged to `staging` 2026-09-20T18:12:43Z (`ab22b6f5`); deploy run 35528326026 green; smoke-tested on staging.brainstorm.world. **Not yet promoted to production** — that is a separate, operator-approved `/cycle-prod` run.
