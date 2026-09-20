# Story 1: One shared pre-fetch address guard for NIP-05 verification

**Status:** Done
**Created:** 2026-09-20
**Type:** Bug

## Background

NIP-05 verification parses a domain out of user-supplied input with
`/^(?:([\w.+-]+)@)?([\w_-]+(\.[\w_-]+)+)$/` and then fetches
`https://<domain>/.well-known/nostr.json?name=<name>` **from the server**. The domain group matches
IP literals and internal names, and nothing anywhere in `src/` classifies an address before the
request goes out — `git grep -nE 'isPrivate|link-?local|net\.isIP|dns\.(lookup|resolve)' -- src`
returns one unrelated hit (`src/algos/nip85/publish_nip85_10040.mjs:54`, resolving a relay hostname)
and no guard. The server can therefore be induced to make requests to hosts only it can reach.

Three byte-identical copies of the fetch exist:

| Call site | Function | Reachability |
|---|---|---|
| `src/api/nip05.js:125` | `verifyNip05Identifier()` | `GET /api/nip05/verify` — **unauthenticated** |
| `src/api/search/profiles/meili/index.js:54` | `verifyNip05()` | public search path |
| `src/api/admin/index.js:18` | `verifyNip05()` | owner-gated |

Existing mitigations are real but partial: the scheme is hardcoded `https://`, there is a 5s timeout,
and the fetched body is never returned to the caller (a boolean or a resolved pubkey only). What
remains is a constrained oracle — which is the posture the Story #6 review accepted as non-blocking
*on the condition that this follow-up happen*.

Open since 2026-05-17. The Architect's call is recorded inline in the intake entry
(`engineering-team/stories/_intake.md` lines 77–146); Architecture is skipped per Standard/Bug rules.

## User-facing description

As the operator of a Brainstorm instance, I want NIP-05 lookups to refuse to talk to hosts that are
not publicly routable, so that a stranger typing an identifier into the search box cannot use my
server as a probe against the network it sits on.

## Acceptance criteria

Guard behaviour (`src/utils/ssrfGuard.js`):

- [ ] Given an IPv4 literal in a non-public range — `0/8`, `10/8`, `100.64/10`, `127/8`,
      `169.254/16`, `172.16/12`, `192.0.0/24`, `192.0.2/24`, `192.168/16`, `198.18/15`,
      `198.51.100/24`, `203.0.113/24`, `224/4`, `240/4`, `255.255.255.255` — when the guard
      classifies it, then it is rejected.
- [ ] Given an IPv4 literal outside those ranges, when the guard classifies it, then it is allowed.
- [ ] Given an IPv6 literal that is unspecified (`::`), loopback (`::1`), link-local (`fe80::/10`),
      unique-local (`fc00::/7`), multicast (`ff00::/8`) or documentation (`2001:db8::/32`), when the
      guard classifies it, then it is rejected — in both compressed and expanded notation.
- [ ] Given an IPv4-mapped (`::ffff:10.0.0.5`), IPv4-compatible (`::127.0.0.1`) or NAT64
      (`64:ff9b::169.254.169.254`) IPv6 address, when the guard classifies it, then the embedded
      IPv4 address is unwrapped and re-classified, and a non-public embedded address is rejected.
- [ ] Given a hostname whose DNS answer contains **any** non-public address, when the guard resolves
      it, then it is rejected (all answers are inspected, not just the first).
- [ ] Given a hostname under a private suffix (`.local`, `.internal`, `.home.arpa`) or with no dot,
      when the guard classifies it, then it is rejected without a DNS round trip.
- [ ] Given an empty host, a DNS error, or an empty DNS answer, when the guard runs, then it
      rejects — the guard fails closed and never throws out to its caller's happy path.

Redirect handling *(ratified at the Planning gate: refuse all redirects)*:

- [ ] Given a guarded fetch, when the request is made, then redirects are **not** followed —
      `redirect: 'manual'`, so no second request can be aimed anywhere by the response.
- [ ] Given a response with any 3xx status, when the guard returns, then the call site treats it as
      a failed lookup (`null`), exactly as it treats a non-`ok` response today.
- [ ] Given a public host that answers 2xx, when the guard returns, then the response is passed
      through unchanged and the call site's parsing is untouched.

Call sites:

- [ ] Given a non-public domain, when any of the three `verifyNip05*` functions is called, then **no
      outbound request is made** and the function returns `null`, exactly as it does today for a
      lookup failure — so `GET /api/nip05/verify` still answers `{ verified: false }` and the search
      and admin paths are unchanged.
- [ ] Given a public domain, when any of the three is called, then behaviour is byte-for-byte what
      it is today.

Reuse:

- [ ] The address predicate and the private-suffix predicate are named exports of
      `src/utils/ssrfGuard.js`, so `assistant-profile` #3 can satisfy OPEN.md row 148 by importing
      them rather than writing a second copy.

## Concepts touched

None — this is server-side network hygiene below the concept layer. No concept-graph handle is read
or written by the guard.

## Out of scope

- **Consolidating the three `verifyNip05*` functions.** They stay where they are and each gains one
  call. The Story #6 review explicitly resisted the larger refactor.
- **Rate limiting `GET /api/nip05/verify`** (intake ask #2) — **ratified at the Planning gate 2026-09-20: not added, and the decision
  is recorded rather than deferred silently.** No rate-limiting pattern exists anywhere in the repo
  to follow: no `express-rate-limit`, `express-slow-down`, `axios` or `got` dependency, and no
  `rate.?limit` / `429` / `throttl` reference under `src/`. Every other unauthenticated endpoint
  (`/.well-known/nostr.json`, `/api/search/profiles/meili`, `/api/auth/*`) is equally unthrottled,
  so throttling one endpoint is a cross-cutting change that belongs to its own story under the "no
  new tooling without an ADR" house rule. The guard itself removes the reason to hammer this
  endpoint — there is no longer an internal target to amplify into. Proposed as a follow-up row.
- **DNS-rebinding TOCTOU.** The guard resolves, then `fetch` resolves again; a host that answers a
  public address to the first query and a private one to the second slips through. Closing it
  airtight means pinning the vetted address into the socket via a custom `undici` dispatcher — a new
  dependency and a materially larger change. The residual gap stays bounded by the mitigations this
  story does not remove (https-only, 5s timeout, body never returned → at most an existence/timing
  signal, never content exfiltration). Proposed as a follow-up row.
- **OPEN.md row 148 itself.** This story exports the predicates; `assistant-profile` #3 does the
  picture-guard fix and the matching change to its mirror predicate in
  `test/recognizable-published-ta-profile.test.js`.

## Open questions

Both were put to the operator at the Planning gate on 2026-09-20 and are now **resolved**.

1. **Redirects — RESOLVED: refuse them all.** The intake's Architect call specified a guard that runs
   before the fetch and did not mention redirects, but Node's global `fetch` follows them by
   default, so a first-hop-only guard is bypassed by anyone who controls a public domain and answers
   `302 → <non-public host>` — cheaper than the DNS-rebinding case the intake deliberately left
   open. Three dispositions were offered (guard every hop / refuse all redirects / first hop only);
   the operator chose **refuse all redirects**: `redirect: 'manual'`, any 3xx is a failed lookup.
   **Known cost, accepted:** a domain that serves `/.well-known/nostr.json` via a redirect —
   apex → `www`, or a CDN-level scheme/host canonicalisation — will stop verifying where it
   verifies today. The NIP-05 spec does not require clients to follow redirects and the failure is
   fail-closed (`verified: false`, never a false positive), but it is a real behaviour change for
   legitimate domains, so it is called out here, in the review, and in a follow-up row rather than
   discovered in the field.
2. **Rate limiting — RESOLVED: not added, reason recorded.** The operator confirmed the intake's
   Architect call. See Out of scope above; a follow-up row proposes org-wide public-endpoint
   throttling as its own story.

## Linked artifacts
- ADR: none — Architecture skipped per Standard/Bug; the Architect's call is recorded inline in
  `engineering-team/stories/_intake.md` lines 77–146.
- Test plan: `engineering-team/stories/done/nip05-ssrf-guard/1-shared-pre-fetch-address-guard.test-plan.md`
- Review: `engineering-team/reviews/done/nip05-ssrf-guard/1-shared-pre-fetch-address-guard.md`
