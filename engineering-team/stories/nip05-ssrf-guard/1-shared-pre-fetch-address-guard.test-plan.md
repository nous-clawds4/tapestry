# Test Plan: Story 1 — One shared pre-fetch address guard for NIP-05 verification

**Story:** `engineering-team/stories/nip05-ssrf-guard/1-shared-pre-fetch-address-guard.md`
**ADR:** none — Architecture skipped per Standard/Bug; the Architect's call is recorded inline in
`engineering-team/stories/_intake.md` lines 77–146.
**Date:** 2026-09-20

One suite, `test/nip05-ssrf-guard.test.js`, registered in `test/registry.js`. Entirely stack-free:
no live control panel, no real network, no real DNS. Five lettered surfaces (A–E) matching the
story's acceptance-criterion groups.

## Coverage map

| Criterion | Test | Level |
|---|---|---|
| Non-public IPv4 literals rejected (15 ranges, 24 addresses) | `A1` | unit |
| Public IPv4 literals allowed — incl. the just-outside neighbours of every range | `A2` | unit |
| Non-public IPv6 literals rejected, compressed **and** expanded | `A3` | unit |
| Public IPv6 literals allowed | `A4` | unit |
| Embedded IPv4 (mapped / compatible / NAT64) unwrapped and re-classified | `A5` | unit |
| Guard says yes only to a parsed public IP (junk, decimals, `0x` forms rejected) | `A6` | unit |
| Hostname resolving to a private address rejected | `B1` | unit + stub DNS |
| Hostname resolving to a public address allowed | `B2` | unit + stub DNS |
| **Every** address in the answer inspected, not just the first (v4 and v6) | `B3` | unit + stub DNS |
| IP literal host classified directly, no DNS round trip; bracketed IPv6 unbracketed | `B4` | unit + stub DNS |
| Private host suffixes rejected, no DNS round trip | `B5` | unit + stub DNS |
| Classification follows the resolver, not the spelling of the host | `B6` | unit + stub DNS |
| Non-public domain → zero outbound requests at all three call sites, returns `null` | `C1` | integration |
| Public domain still verifies, same URL, same return value | `C2` | integration |
| `GET /api/nip05/verify` contract unchanged (`{ verified: false }`) | `C3` | integration |
| Request carries `redirect: 'manual'` (and still carries the 5s abort signal) | `D1` | integration |
| A 3xx is a failed lookup, not a hop — 301/302/303/307/308 | `D2` | integration |
| DNS error rejects | `E1` | unit + stub DNS |
| Empty / null DNS answer rejects | `E2` | unit + stub DNS |
| Empty or malformed host rejects without reaching the resolver | `E3` | unit + stub DNS |
| Guard never throws out to its caller | `E4` | unit + stub DNS |

## Edge cases

- [x] **Range boundaries.** A2 asserts the addresses immediately outside each rejected range are
      still allowed (`172.15.255.255` / `172.32.0.1`, `100.63.255.255` / `100.128.0.1`,
      `169.253.0.1`, `198.17.255.255` / `198.20.0.1`, `192.167.1.1` / `192.169.1.1`). A guard that
      over-rejects breaks NIP-05 for real users, which is the failure mode nobody would notice.
- [x] **Notation.** The same IPv6 address in compressed and fully-expanded form (A3), and embedded
      IPv4 in both dotted and hex notation (`::ffff:10.0.0.5` and `::ffff:a00:5`) (A5).
- [x] **Not-a-blanket-deny.** A4, A5's last assertion and C2 all exist so that "reject everything"
      cannot pass this suite.
- [x] **Bracketed IPv6** — the form `URL.hostname` yields (B4). Unreachable through the NIP-05
      regex, but `assistant-profile` #3 will pass URLs through the same predicate.
- [x] **Mixed DNS answers** — one public and one private address for the same name (B3). Checking
      only `addresses[0]` is the natural implementation bug.
- [x] **Alternate IPv4 encodings** — octal, hex, short-form, decimal, `nip.io`-style DNS embedding
      (B6). These are what a guard that pattern-matches the *input string* misses. Handled here by
      construction: the guard asks the same resolver `fetch` will ask and classifies the answer.
      Verified against the real `getaddrinfo` on 2026-09-20 — `0x7f.0.0.1`, `127.1`, `0xa.0.0.5`,
      `010.0.0.5` and `127.0.0.1.nip.io` all resolve to a private address and are all rejected.
      B6 pins the intent with a stub rather than those spellings, because which of them a
      platform's `getaddrinfo` accepts differs between macOS and Linux.
- [x] **Empty input** (E3), **resolver throws** (E4), **empty answer** (E2).
- [ ] Concurrent calls — not covered; the guard holds no state.
- [ ] Concept Graph API unavailable / concept handle not found — not applicable; the guard sits
      below the concept layer and reads no concept.

## Test infrastructure

- **Framework:** the repo's hand-rolled runner. `test/nip05-ssrf-guard.test.js` exports `run()` and
  is registered in `test/registry.js`; `npm test` drives it through `test/helpers/gateRunner.js`.
- **Concept Graph API:** not used. This suite never skips — it has no live-stack precondition, so
  it is real signal on a machine with no Docker stack.
- **DNS stubbing:** `guardWithDns(stub)` patches `dns.promises.lookup`, loads a **second, throwaway
  copy** of the guard (which captures the resolver in a load-time destructure), then restores both
  the patch and the `require` cache entry. The gate loads every suite up front into one process, so
  a permanent monkeypatch would silently follow later suites around; this one cannot escape.
- **`fetch` stubbing:** `withFetchSpy()` swaps `global.fetch` for a recorder and restores it in a
  `finally`. Safe because `gateRunner` runs suites sequentially (`for` + `await`,
  `test/helpers/gateRunner.js:165`).
- **Fixtures:** none. All inputs are literals in the file.

## Note for the Implementer — two seams this suite needs

1. `verifyNip05` is currently **not** exported from `src/api/admin/index.js` or
   `src/api/search/profiles/meili/index.js` (only `src/api/nip05.js` exports
   `verifyNip05Identifier`). C1/C2/D1/D2 call the real functions, so both modules must add the
   existing function to `module.exports`. That is a visibility change only — no behaviour moves.
2. The guard must capture its resolver at module load
   (`const { lookup } = require('dns').promises;`), not per call, or `guardWithDns` cannot isolate
   it.

## What D1 proves and D2 does not

`D1` is the load-bearing redirect test: it asserts the option the code passes to `fetch`. Today that
option is `undefined`, which is Node's `redirect: 'follow'` default — that *is* the gap.

`D2` cannot prove the gap, and the plan should not claim it does: redirect following happens
**inside** `fetch`, so a stubbed `fetch` can never demonstrate a hop being followed. D2's job is to
pin the post-fix contract — once `redirect: 'manual'` is set, a 3xx surfaces to the caller and every
call site must map it to `null` rather than parsing it. Both are needed; neither alone is enough.

## How to run

```
npm test
```

Or the single suite through its `run()` export (never `node test/nip05-ssrf-guard.test.js` — the
file exports `run()` and does not self-execute):

```
node -e 'require("./test/nip05-ssrf-guard.test.js").run()'
```

Node 22 is required (CI's version). Below 18 there is no global `fetch` and the C/D surfaces
misreport.

## Verification

The new tests fail with the current code. Confirmed 2026-09-20 at commit `45b0b121`, Node v22.23.2:

```
  FAIL  A1: every non-public IPv4 literal is rejected
        src/utils/ssrfGuard.js must exist and be requirable (Cannot find module '.../src/utils/ssrfGuard.js')
  ...
  FAIL  C1: a non-public domain produces ZERO outbound requests at all three call sites
        src/api/nip05.js verifyNip05Identifier (unauthenticated GET /api/nip05/verify): a lookup for
        10.0.0.5 must not leave the process; it made 1 request(s):
        https://10.0.0.5/.well-known/nostr.json?name=alice
  FAIL  C3: GET /api/nip05/verify answers verified:false for a non-public domain
        the unauthenticated endpoint must make no outbound request for a non-public domain; it made 1
  FAIL  D1: the request is made with redirect:"manual" so no response can steer a second one
        src/api/nip05.js verifyNip05Identifier (unauthenticated GET /api/nip05/verify): the fetch must
        pass redirect:'manual' — otherwise a 302 from a public host aims the next request wherever it
        likes; got undefined

nip05-ssrf-guard: 0 passed, 20 failed, 0 skipped
```

C1's message is the bug stated as evidence: a request for `10.0.0.5` left the process.
