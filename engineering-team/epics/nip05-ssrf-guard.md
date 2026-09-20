# Epic: nip05-ssrf-guard

**Created:** 2026-09-20
**Status:** Active
**Book:** `engineering-team/audits/nip05-ssrf-guard/book.md` (acceptance-frame)
**Provenance:** `engineering-team/stories/_intake.md` § "2026-05-17 — Bug: unauthenticated NIP-05
verification is a constrained SSRF surface", itself a security follow-up from the Story #6 review
(`engineering-team/reviews/6-nip05-checkmark-verification.md`, "Non-blocking #1"). Open since
2026-05-17; picked up 2026-09-20.

## Goal

NIP-05 verification takes a domain straight from user-supplied input and fetches
`https://<domain>/.well-known/nostr.json` from the server. Nothing checks where that domain points,
so the fetch can be aimed at loopback, private, link-local and other non-public addresses. Three
byte-identical copies of the fetch exist, one of them behind an unauthenticated endpoint.

Add **one** shared guard that classifies the host before the request leaves the process, wire all
three call sites to it, and export its address predicate so the published-assistant picture guard
(OPEN.md row 148, scheduled into `assistant-profile` #3) can reuse it instead of growing a second,
divergent copy.

## Stories (planned at kickoff)
`stories/nip05-ssrf-guard/`:
1. `1-shared-pre-fetch-address-guard.md` — `src/utils/ssrfGuard.js`, three call-site changes,
   stack-free behavioural test. Bug, Standard (Architecture skipped; the Architect's call is
   recorded inline in the intake entry).

## Key facts / guardrails
- **No new dependencies.** Core `dns.promises` + `net.isIP` only — the house rule against new
  tooling without an ADR applies, and the intake's Architect call already settled this.
- **Fail closed.** Empty host, DNS error, empty answer, any unexpected throw → reject. Each call
  site's existing downstream contract (`null` / `verified: false`) is unchanged, so a rejection is
  indistinguishable from a lookup failure to the caller.
- **The three `verifyNip05*` copies are not consolidated.** Consolidating them is a larger refactor
  the Story #6 review explicitly resisted; this epic changes one call per site.
- **Rate limiting is deliberately out.** No rate-limiting pattern exists anywhere in the repo to
  follow; inventing one is a cross-cutting concern for every unauthenticated endpoint and needs its
  own ratification. Recorded, not silently dropped.
- **DNS-rebinding TOCTOU stays open.** Resolve-then-fetch leaves a re-resolution gap that can only
  be closed airtight by pinning the vetted address into the socket (a new `undici` dependency).
  Out of scope, documented in the story, proposed as a follow-up row.
