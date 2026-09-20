# Review: Story 1 — One shared pre-fetch address guard for NIP-05 verification

**Story:** `engineering-team/stories/done/nip05-ssrf-guard/1-shared-pre-fetch-address-guard.md`
**Test plan:** `engineering-team/stories/done/nip05-ssrf-guard/1-shared-pre-fetch-address-guard.test-plan.md`
**ADR:** none — Architecture skipped per Standard/Bug; the Architect's call is recorded inline in
`engineering-team/stories/_intake.md` lines 77–146.
**Reviewed:** 2026-09-20
**Diff:** `origin/staging..fix/nip05-ssrf-guard`

## What shipped

`src/utils/ssrfGuard.js` (new, 276 lines), three one-line call-site changes plus two `module.exports`
additions, and a 21-test stack-free suite registered in `test/registry.js`.

The guard is four layers, each usable on its own: `isPublicAddress(ip)` (pure, sync),
`hasPrivateHostSuffix(host)` (pure, sync), `isPublicHostname(host)` (resolve + classify every
answer), `guardedFetch(url, opts)` (the above + refuse redirects). No new dependencies — core
`dns.promises` and `net.isIP`, as the Architect's call required.

## Acceptance criteria

Every criterion in the story maps to at least one passing test; the coverage map in the test plan is
accurate and I re-ran it rather than taking it on faith.

| Group | Criteria | Tests | Result |
|---|---|---|---|
| IPv4 / IPv6 / embedded-IPv4 literals | 5 | `A1`–`A5` | met |
| Predicate says yes only to a classified public IP | 1 | `A6` | met |
| Hostname resolution, all answers inspected, literals + suffixes | 4 | `B1`–`B5` | met |
| Redirects refused | 3 | `D1`, `D2` | met |
| Call sites: no request for a non-public domain; public unchanged | 2 | `C1`–`C3` | met |
| Fail-closed | 1 | `E1`–`E4` | met |
| Predicates exported for `assistant-profile` #3 | 1 | `A1`–`A6`, `B5` exercise the exports | met |

## Gates

**`bash scripts/harness-lint.sh` — clean, 0 violations.** Read from `$?`, not from stdout.

**`npm test` — `Overall: FAIL`, and that needs stating plainly rather than summarising away.**

Run `nip05-ssrf-guard-after`, record `tmp/gate-runs/20260920T175711Z-56785-339e.json`, Node v22.23.2,
local Docker stack up (only 13 suites skipped, so the live layer genuinely ran):

| | passed | failed | skipped | suites F |
|---|---|---|---|---|
| Baseline `ledger-row-identity-close-final` (2026-09-20T04:39, staging) | 3238 | 51 | 139 | 15 |
| After this branch | 3292 | 51 | 139 | 15 |

**The failed-suite sets are identical** — same 15 names, compared programmatically, not by eye:
`tag-detail`, `capture-a-goal-and-see-it`, `structures-the-brain-can-trust`,
`break-a-goal-into-pieces`, `attach-the-world`, `sessions-read-the-brain`, `the-proposal-loop`,
`teach-it-what-matters`, `the-brain-survives`, `return-the-four-on-every-read-surface`,
`show-the-four-on-the-goal-screens-that-already-exist`, `recognizable-published-ta-profile`,
`not-yet-shared-filter`, `concept-count-canonical`, `summaries-element-count`. New failures vs
baseline: **none**. Failures fixed: none (none were this story's job). The failing-test count is
identical at 51, so nothing moved inside those suites either. This is the standing red recorded in
OPEN.md row 289.

`nip05-ssrf-guard.test.js`: **PASS, 21/0/0.** It has no live-stack precondition, so it is real
signal on a machine with no Docker — it cannot quietly become a skip.

**Red-first confirmed.** All 20 tests failed at `45b0b121` before the guard existed; `C1`'s failure
message is the bug stated as evidence — *"a lookup for 10.0.0.5 must not leave the process; it made
1 request(s): https://10.0.0.5/.well-known/nostr.json?name=alice"*.

## What I checked beyond the tests

**No fourth call site.** `git grep -n 'well-known/nostr.json' -- src` returns exactly the three
outbound fetches, all now guarded; the other hits are the server's own NIP-05 *handler* and comments.

**Alternate IP encodings — the classic way around a guard like this.** I ran the real resolver
against octal, hex, short-form, decimal and `nip.io`-style spellings. `0x7f.0.0.1`, `127.1`,
`0xa.0.0.5`, `010.0.0.5` and `127.0.0.1.nip.io` all resolve to a private address and are all
rejected. This works because the guard classifies the **resolver's answer**, not the input string,
and asks the same resolver `fetch` will ask (`dns.lookup`/getaddrinfo in both cases) — so the guard's
view and the destination cannot disagree about a spelling.

One case is worth recording because it looks like a miss and is not: `0177.0.0.1` is **allowed** on
this host, because macOS's `getaddrinfo` resolves it to `177.0.0.1` — a genuinely public address,
and the one `fetch` would connect to. On a platform that reads it as octal it resolves to
`127.0.0.1` and the guard rejects it. Either way the guard agrees with the destination, which is the
property that matters. Test `B6` pins that intent with a stub rather than asserting the spellings
themselves, since platform behaviour differs and asserting it would be a CI flake.

**Boundary correctness, both directions.** A guard that over-rejects breaks NIP-05 for real users
and nobody notices. `A2` asserts the addresses immediately outside every rejected IPv4 range are
still allowed (`172.15.255.255`/`172.32.0.1`, `100.63.255.255`/`100.128.0.1`, `169.253.0.1`,
`198.17.255.255`/`198.20.0.1`, `192.167.1.1`/`192.169.1.1`); `A4`, `A5`'s last assertion and `C2`
exist so "reject everything" cannot pass the suite.

**The stubbing does not leak.** The gate loads every suite into one process up front, so a permanent
monkeypatch would silently follow later suites around. `guardWithDns` patches `dns.promises.lookup`,
loads a *second, throwaway* copy of the guard, then restores both the patch and the `require` cache
entry in a `finally`; `withFetchSpy` restores `global.fetch` in a `finally`, which is safe because
`gateRunner` runs suites sequentially (`test/helpers/gateRunner.js:165`). The identical baseline
numbers above are the empirical check on this.

**Real-resolver integration.** Stubs can hide an integration bug, so I also exercised the unstubbed
path: `isPublicHostname('example.com')` → true, `'localhost'` → false, `'brainstorm.world'` → true;
`guardedFetch('https://127.0.0.1:1/…')` → `null` in 1ms with no connection attempted;
non-`https` and unparseable URLs → `null`.

**Architecture invariants (CLAUDE.md).** Not engaged. The guard is network hygiene below the concept
layer: no POV, no trust signal, no concept handle, no stored derivation, and no TA pubkey — so
principles 1–4 and the per-deployment-pubkey rule have nothing to bind to here. Worth stating
explicitly so a future reader does not go looking.

## Findings

**Blocking: none.**

**Non-blocking 1 — the 5s budget now also covers DNS, and that part cannot be aborted.** Each call
site starts its 5s timer, then `guardedFetch` resolves before fetching. `dns.promises.lookup` takes
no abort signal, so a pathologically slow resolver can overrun the budget. The failure mode is
benign: the timer fires, the controller aborts, `fetch` is then called with an already-aborted
signal and throws, and the existing `catch` returns `null` — fail-closed, as before. Worth knowing
rather than fixing.

**Non-blocking 2 — every verification now costs one extra DNS lookup.** Normally served from the OS
resolver cache; in the worst case it adds a round trip to a user-facing search. This is the price of
the guard, not a defect, but it is the kind of thing that should be a conscious cost.

**Non-blocking 3 — pre-existing: `verifyNip05(null)` throws in the admin and meili copies.** Both do
`nip05Address.match(...)` *outside* their `try`, so a null argument is a `TypeError` rather than
`null`. `src/api/nip05.js` already guards this with `String(nip05Address || '')`. Untouched by this
story and unreachable from the routed paths; noted because exporting the two functions makes it
marginally easier to reach. Not worth a row.

**Non-blocking 4 — the IPv6 classification is a denylist, not a global-unicast allowlist.** Only
`2000::/3` is global unicast; the guard rejects the specific non-public blocks the Architect's call
named (plus `2001:db8::/32`) and allows the rest, so unallocated space such as `fb00::1` is allowed.
No practical gap — private IPv6 networks use ULA `fc00::/7` or link-local `fe80::/10`, both
rejected, and unallocated space is not routed anywhere. Recorded as a deliberate boundary so nobody
reads it later as an oversight.

## Deliberate omissions, each with a row

The story is explicit about what it does not do, and none of it is left to memory:

- Redirects are no longer followed at all — ratified at the Planning gate over the alternative of
  guarding each hop. **The accepted cost is a real behaviour change**: a domain serving
  `/.well-known/nostr.json` behind a redirect verified before and does not now. Fail-closed
  (`verified: false`, never a false positive), and NIP-05 does not require clients to follow
  redirects — but it is silent from the user's side. OPEN.md row
  `2026-09-20-nip05-verification-no-longer-follows-redirects`, with the fix shape if it bites.
- DNS rebinding stays open — closing it needs `undici` as a direct dependency. OPEN.md row
  `2026-09-20-nip05-guard-leaves-dns-rebinding-open`.
- Rate limiting deliberately not added; the finding is that **no** endpoint in the repo is
  throttled and there is no pattern to follow. OPEN.md row
  `2026-09-20-public-endpoints-have-no-rate-limiting`.
- The three `verifyNip05*` copies are still three copies — the Story #6 review resisted that
  refactor and this story honours it.

## Reuse for OPEN.md row 148

`isPublicAddress` and `hasPrivateHostSuffix` are named exports and are what row 148 needs:
`isPubliclyReachable()` in `src/api/assistant/index.js` admits `192.168.1.50:7777`, `10.0.0.5`,
`172.16.4.2` and `nas.internal` today. `hasPrivateHostSuffix` covers `.internal` and `.home.arpa`
(row 148's explicit ask) plus `.local`, `.lan`, `.intranet`, `.private` and bare labels;
`isPublicAddress` covers RFC1918 and IPv6 ULA. `B4` already pins the bracketed-IPv6 form that
`URL.hostname` yields, which is the shape that story will pass in. Row 148 is scheduled into
`assistant-profile` #3 and is **not** touched here — that story must also move its deliberately
independent mirror predicate in `test/recognizable-published-ta-profile.test.js`, which row 148 says
has the identical gap. (That suite is in the standing-red set above, both before and after.)

## Verdict

PASS

The story's asks are met, the intake's three asks are all discharged (guard shared by all three call
sites; rate limiting decided and recorded, not silently dropped; a focused behavioural test), the
gate is no worse than its baseline by an exact comparison, and everything deliberately left undone
has a row rather than a good intention.
