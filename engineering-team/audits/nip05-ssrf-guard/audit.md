# Build Audit: NIP-05 SSRF guard

**Book:** `engineering-team/audits/nip05-ssrf-guard/book.md`
**Date:** 2026-09-20
**Branch / commit range:** `f8b3f2a8..271fce37` (merged to `staging` as `ab22b6f5`, PR #703)
**Provenance:** Acceptance-frame
**Confidence:** high — the frame was written at intake from a 2026-05-17 intake entry that recorded
the requester's asks verbatim and an Architect's call inline. Every frame bullet is checkable
against the diff, and every file in the diff traces to story 1.

> The Build Audit is the as-built record — what the product *is* now. It does not propose changes;
> that is the seed's job.

## 1. What shipped

- **NIP-05 verification refuses to talk to hosts that are not publicly routable.** A domain that is,
  or resolves to, a loopback / private / link-local / CGNAT / documentation / multicast / reserved
  address is rejected before any request leaves the process — on all three verification paths,
  including the unauthenticated `GET /api/nip05/verify`.
  — `stories/done/nip05-ssrf-guard/1-shared-pre-fetch-address-guard.md`
- **One shared decision point.** `src/utils/ssrfGuard.js` is the single place that decides whether an
  address is public, so the answer cannot drift between the three copies of the fetch.
- **Redirects are no longer followed** on any NIP-05 verification fetch.
- **Two reusable predicates** (`isPublicAddress`, `hasPrivateHostSuffix`) are exported for
  `assistant-profile` #3 to satisfy OPEN.md row 148 without a second copy.
- **A stack-free regression suite** (21 tests) that has no live-stack precondition and therefore
  cannot quietly degrade to a skip.

## 2. Epics & stories rolled up

### Epic: `nip05-ssrf-guard` — **Done**, retired 2026-09-20

| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 shared-pre-fetch-address-guard | Shared guard + three call sites + 21-test suite | Done | `reviews/done/nip05-ssrf-guard/1-shared-pre-fetch-address-guard.md` — **PASS** |

No ADR: Architecture was skipped per Standard/Bug, and the Architect's call is recorded inline in
`engineering-team/stories/_intake.md` (the 2026-05-17 entry). Phase path run: Planning → Test
Design → Implementation → Review, committed at each boundary.

## 3. As-built inventory

**User-facing / endpoints** — no new routes, no new response shapes. Three internal functions gained
one call each; every caller's contract is unchanged:

| Path | Function | Reachability | Change |
|---|---|---|---|
| `src/api/nip05.js` | `verifyNip05Identifier` | `GET /api/nip05/verify` — unauthenticated | `fetch` → `guardedFetch`; `!resp.ok` → `!resp \|\| !resp.ok` |
| `src/api/search/profiles/meili/index.js` | `verifyNip05` | public search path | same |
| `src/api/admin/index.js` | `verifyNip05` | owner-gated | same |

**New module** — `src/utils/ssrfGuard.js` (276 lines), no new dependencies (core `dns.promises`,
`net.isIP`):

| Export | Kind | Contract |
|---|---|---|
| `isPublicAddress(ip)` | pure, sync | one literal address, v4 + v6; IPv4 embedded in IPv6 (mapped, compatible, NAT64) unwrapped and re-classified; anything unparseable is `false` |
| `hasPrivateHostSuffix(host)` | pure, sync | `.local`, `.internal`, `.home.arpa`, `.localhost`, `.lan`, `.intranet`, `.private`, bare `localhost`, and any dotless label |
| `isPublicHostname(host)` | async | resolve, require **every** answer public; never throws |
| `guardedFetch(url, opts)` | async | the above + `https:`-only + `redirect: 'manual'`; returns `null` on refusal |
| `MAX_REDIRECTS` | const `0` | the redirect policy, named |

Rejected IPv4: `0/8`, `10/8`, `100.64/10`, `127/8`, `169.254/16`, `172.16/12`, `192.0.0/24`,
`192.0.2/24`, `192.168/16`, `198.18/15`, `198.51.100/24`, `203.0.113/24`, `224/4`, `240/4`,
`255.255.255.255`. Rejected IPv6: `::`, `::1`, `fe80::/10`, `fc00::/7`, `ff00::/8`, `2001:db8::/32`.

**Domain:** none. The guard sits below the concept layer — no concept handle, no POV, no trust
signal, no stored derivation, no TA pubkey. CLAUDE.md's four architecture invariants and the
per-deployment-TA-pubkey rule have nothing to bind to here; stated explicitly so a future reader
does not go looking.

**Data & contracts:** unchanged. No event kinds, no stored shapes, no API routes added or altered.
Two `module.exports` additions (`verifyNip05` in the admin and meili modules) are a test seam, not a
route.

**Tests:** `test/nip05-ssrf-guard.test.js` (414 lines, 21 tests), registered in `test/registry.js`.

## 4. Deviations from intent

| # | Specified (frame) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | *(silent — neither the frame nor the Architect's call mentions redirects)* | Redirects refused outright on every NIP-05 fetch (`redirect: 'manual'`; any 3xx is a failed lookup) | added-beyond-scope | Node's global `fetch` follows redirects by default, so a first-hop-only guard is bypassed by anyone controlling a public domain that answers `302 → <non-public host>` — cheaper than the rebinding case the intake deliberately left open. Three options put to the operator at the Planning gate 2026-09-20; **operator chose the strictest** over guarding each hop. (story § Open questions 1) | **Real and user-visible.** A domain serving `/.well-known/nostr.json` behind a redirect verified before and does not now. Fail-closed (`verified: false`, never a false positive) and NIP-05 does not require clients to follow redirects — but silent from the user's side: a checkmark simply stops appearing. | OPEN.md row `2026-09-20-nip05-verification-no-longer-follows-redirects`, with the fix shape |
| 2 | "resolves the hostname and rejects loopback, private, link-local and other non-public results" | Also rejects private **host suffixes** (`.internal`, `.home.arpa`, `.local`, …) and dotless labels, without a DNS round trip | interpretation | Such names either fail to resolve (fail closed anyway) or resolve privately; rejecting by suffix is cheaper and is exactly what OPEN.md row 148 asks for. (story AC; review § Reuse) | None — strictly more refusals, all of non-public names | — |
| 3 | "the predicate" (singular) exported | **Two** predicates exported, plus `isPublicHostname` and `guardedFetch` | added-beyond-scope (minor) | Row 148 needs both the address check (RFC1918, ULA) and the suffix check (`.internal`, `.home.arpa`); exporting one would have forced `assistant-profile` #3 to write the other. (review § Reuse) | None | `assistant-profile` #3 imports these |
| 4 | *(not specified)* | `verifyNip05` added to `module.exports` in the admin and meili modules | added-beyond-scope (minor) | The behavioural tests C1/C2/D1/D2 call the real functions rather than a copy; neither was exported. Visibility only — no behaviour moves, neither is routed. (test-plan § Note for the Implementer) | None | — |
| 5 | "IPv6 loopback/ULA/link-local" | A **denylist** of named non-public blocks, not an allowlist of global unicast (`2000::/3`) | interpretation | Matches the block list the Architect's call enumerated. Unallocated space such as `fb00::1` is therefore allowed. (review § non-blocking 4) | None in practice — private IPv6 networks use ULA or link-local, both rejected; unallocated space is not routed | — |
| 6 | *(frame is silent; the intake's Architect call item 3 named it)* | DNS-rebinding TOCTOU left open | deferred | Closing it airtight needs the vetted address pinned into the socket via a custom `undici` dispatcher — a new direct dependency, which the "no new tooling without an ADR" house rule puts outside a bugfix. Bounded by the mitigations left in place: `https:`-only, 5s abort, body never returned. (intake Architect's call item 3; story § Out of scope) | Residual: an existence/timing signal, never content | OPEN.md row `2026-09-20-nip05-guard-leaves-dns-rebinding-open` |
| 7 | "rate limiting deliberately not added (say so explicitly)" | Not added; the finding recorded | as specified | No rate-limiting pattern exists anywhere in the repo to follow, and every unauthenticated endpoint is equally unthrottled. Operator ratified at the Planning gate. (story § Out of scope) | None | OPEN.md row `2026-09-20-public-endpoints-have-no-rate-limiting` |
| 8 | "each shown red against the unguarded code first" | 20 of 21 shown red first; **B6 was added during Review**, after the fix | process deviation | The reviewer's adversarial pass (alternate IP encodings against the real resolver) surfaced a design property worth pinning — that classification follows the resolver's answer, not the input string. It was never red, and it is honest to say so. (review § What I checked beyond the tests) | None | — |

**Undocumented work:** none. All 15 files in the diff trace to story 1; `git diff --name-only` was
walked file by file against the story.

## 5. Quality state at close

- **Test gate at close** (run after the book flip and the epic close-out, so it certifies the tree
  this close leaves behind). `npm run gate:status`:

  > `20260920T183609Z-50179-da10 [nip05-ssrf-guard-book-close] started 2026-09-20T18:36:09.602Z on
  > ab22b6f5+dirty — FAIL, exit 1, 3293 passed, 51 failed, 139 skipped, 209/209 suites; failed:
  > tag-detail, capture-a-goal-and-see-it, structures-the-brain-can-trust, break-a-goal-into-pieces,
  > attach-the-world, sessions-read-the-brain, the-proposal-loop, teach-it-what-matters,
  > the-brain-survives, return-the-four-on-every-read-surface,
  > show-the-four-on-the-goal-screens-that-already-exist, recognizable-published-ta-profile,
  > not-yet-shared-filter, concept-count-canonical, summaries-element-count`

  **The verdict is FAIL and this close does not round that off.** It is the *same* FAIL as the
  pre-book baseline: the same 15 suites, the same 51 failing tests, the same 139 skips — rows 288
  and 289, none of them in code this book touched. The passing count rose 3292 → 3293 against the
  story's own post-implementation run, which is exactly B6, the one test added during Review.
  `nip05-ssrf-guard: PASS (21 passed, 0 failed, 0 skipped)`.
- **Test gate during the story (implementation → review):** run `nip05-ssrf-guard-after`, record
  `20260920T175711Z-56785-339e`, Node v22.23.2, local stack up. `Overall: FAIL — 3292 passed, 51
  failed, 139 skipped across 209 suites`. Compared programmatically against the pre-book baseline
  `ledger-row-identity-close-final` (`20260920T043945Z-7994-0be6`, 3238/51/139): **the failed-suite
  sets are identical** — the same 15 suites, the same 51 failing tests. Zero new failures. That
  standing red is **OPEN.md row 289** (16 live suites red against this local instance), itself
  visible only because of **row 288** (the host's only Node is v16, below `engines`).
- **CI:** the `stack-free` job on PR #703 was green — `Overall: PASS — 2952 passed, 0 failed, 531
  skipped across 209 suites`, with `[209/209] nip05-ssrf-guard: PASS (21 passed, 0 failed, 0
  skipped)`.
- **Live verification on staging** (post-deploy, run 35528326026): positive control verifies
  (`{"verified":true}` for a real public domain, 214 ms); every non-public target refused in
  75–112 ms. Discriminating evidence, because timing alone was not conclusive — TEST-NET-1
  `192.0.2.1`, guaranteed to blackhole, answered in **0.078 s on staging (guarded)** vs **5.35 s on
  production (unguarded, promotion pending)**: prod spends its full 5 s abort actually trying to
  connect. The owner-gated third call site was not live-exercised (it needs owner auth); it is
  covered by the suite only.
- **Known open issues / accepted:** deviations 1, 5 and 6 above — each with a ledger row or an
  explicit "no practical impact" finding.
- **Debt logged:** no ADR, so no `Consequences` roll-up. The debt this book adds is exactly the
  three ledger rows in §6.

## 6. Carry-forward register

- [ ] **Redirects are no longer followed** — watch for a legitimate domain that stops verifying; fix
      shape (bounded manual follow, re-guarding each hop) is in the row. (§4 #1 · OPEN.md row
      `2026-09-20-nip05-verification-no-longer-follows-redirects`)
- [ ] **DNS rebinding** — evaluate `undici` as a direct dependency and pin the vetted address into
      the socket. Pairs naturally with the redirect item; both live in `guardedFetch`. (§4 #6 ·
      OPEN.md row `2026-09-20-nip05-guard-leaves-dns-rebinding-open`)
- [ ] **No endpoint in the repo is rate-limited** and there is no pattern to follow. Needs its own
      story + ADR: mechanism, unit of limiting, and the spoofable client-IP-behind-nginx problem.
      (§4 #7 · OPEN.md row `2026-09-20-public-endpoints-have-no-rate-limiting`)
- [x] **OPEN.md row 148** — `assistant-profile` #3 can now import `isPublicAddress` and
      `hasPrivateHostSuffix`. Note it must also move the deliberately independent mirror predicate
      `isPubliclyRoutable` in `test/recognizable-published-ta-profile.test.js`, which row 148 records
      as having the identical gap. That suite is in the standing-red set, before and after. *Resolved 2026-09-21 by `assistant-profile` #3 (ADR 0003): it imports both classifiers, and moved `isPubliclyRoutable` with the rule; row 148 DONE.*
- [ ] **Production promotion** — this book is live on `staging` only. Prod still has the unguarded
      behaviour (measured: 5.35 s vs 0.078 s). Promotion is a separate, operator-approved
      `/cycle-prod` run.

## 7. Process findings (harness)

Retro run on measurement: `scripts/harness-stats.sh` at close reads **225 reviews parsed, 223 final
PASS, 2 final CHANGES_REQUESTED, 0 % kick-back rate, 43 reviews with kick-back history**. A 0 %
final-kick-back rate across 225 reviews is worth naming — it means the *final* verdict is a poor
signal of review value in this harness; the 43 reviews carrying kick-back history are where the work
shows. Nothing in this book changes that, and no finding below rests on it.

| Finding | Source | Terminal state |
|---|---|---|
| **Moving an epic's folders under `done/` silently breaks every inbound reference, tree-wide.** The step-9 `git mv` here broke 7 pointers (story, test-plan, review, 3 ledger rows, `src/utils/ssrfGuard.js`, `test/nip05-ssrf-guard.test.js`). Checking precedent showed this is systemic, not a slip: `compute-endpoint-hardening` closed 2026-09-19 with three refs still pointing at its pre-`done/` path (its own `audit.md`, its epic file, and `test/harden-compute-endpoint.test.js`) and **zero** pointing at where its story actually lives. Workflow step 9 says to move the folders and says nothing about the references. | This close (step 9); precedent `audits/compute-endpoint-hardening/`, `test/harden-compute-endpoint.test.js:5` | **OPEN.md row `2026-09-20-done-move-breaks-inbound-refs`** — rewrote this book's 7 refs rather than copying the precedent; the systemic fix (a rule in `workflows/6-book-close.md` step 9, or a lint check) is the row's |
| **A citation copied from `_intake.md` carried a stale path into two new files.** The 2026-05-17 entry cites `engineering-team/reviews/6-nip05-checkmark-verification.md`; the file has lived at `reviews/search-and-router/6-…` since its epic was foldered. Copying intake prose forward propagates its stale paths. Caught only because the close checked that every `.md` pointer resolves. | Story Background + epic Provenance, both written this book | **Declined as a separate row** — it is one instance of the finding above (references not maintained across moves) and is covered by that row's fix shape. Fixed in the epic; the `_intake.md` occurrence is inside a verbatim quoted request and was deliberately left as written |
| **`docs/SMOKE_TEST.md` Tier 3 has no recipe for verifying a *negative*.** Tier 3 assumes the change is observable in a response ("hit it; verify the new behaviour is in effect"). This change's observable is the *absence* of an outbound request — no response shape differs. My first attempt used raw timing and was wrong: the private targets and `example.com` both answered in ~0.11 s, so the contrast proved nothing. What worked was a control whose time differs *by construction* — TEST-NET-1 against the unpromoted production instance (0.078 s vs 5.35 s). | This book's smoke test; `docs/SMOKE_TEST.md` Tier 3 | **OPEN.md row `2026-09-20-smoke-tier3-cannot-verify-a-negative`** |
| **Ports to the other flow?** Asked per finding. All three are flow-agnostic: the `done/` move, citation hygiene and the smoke-test gap bind Direction-mode and human-gated books identically. No flow-specific variant needed. | Retro step 7 | **Declined** — no port required; recorded so the question is visibly answered rather than skipped |
| **The packet brief's "verified" grep claim was false in the letter, true in substance.** The brief asserted `git grep -nE 'isPrivate\|link-?local\|net\.isIP\|dns\.(lookup\|resolve)' -- src` "returns nothing"; it returns one hit (`src/algos/nip85/publish_nip85_10040.mjs:54`, resolving a relay hostname — not a guard). Its candidate call-site list was also a guess naming three files that are not call sites. Neither misled the work, because the intake entry was authoritative and was read first. | Session packet brief (2026-09-13 triage) | **Declined** — the packet is an ephemeral session input, not a tracked harness surface or orientation doc, so it has no ledger home. Surfaced to the operator in the session report instead, which is the only durable channel it has |
