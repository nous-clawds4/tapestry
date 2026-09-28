# Test Plan: Story 3 — The real-time path

**Story:** `engineering-team/stories/tagging-edges/3-real-time-path.md`
**ADR:** `engineering-team/decisions/tagging-edges/0003-real-time-path.md` (Decision sections, and clarifications T1–T34)
**Date:** 2026-09-28

## Coverage map

Every acceptance criterion maps to tests in the engine suite, plus tests in the other suites for its pieces. The ids
below are the tests whose names cite that criterion. The planner, store, wrapper and wiring tests cite the ADR section
or T-clarification they pin; the index at the end lists them all.

| Criterion | Tests | Level |
|---|---|---|
| **AC-1** — a stored tagging shows up within a minute, whatever way in; a 10,000 burst within 5 min | RE9–RE13 (create, update, move, id-only resolution, back-dated), RE54 / RE66 (the 16 MiB kept budget, the element read inside it), RE65 (20,100 past the cap), RE55 / RE67 (the catch-up share under live load), RE56, RE77; planner RP9, RP12, RP43; live SL17 | engine (fakes), unit, live |
| **AC-2** — a revoke within a minute; the relay decides; only the author's deletion; no count limit | RE13–RE20, RE32, RE49, RE52, RE56, RE61; planner RP14–RP22 (resolution, author filter, the 255-byte cap, spelling), RP67, RP69 | engine, unit |
| **AC-3** — a failed read, an unavailable graph, bad setup or a crash loses nothing and removes nothing wrongly | RE21–RE30 (a wipe with prompts queued, scan failures, graph down, parking, lost races, bad identity, the schema rule appearing at 67 s), RE49, RE50, RE58 (bounded memory in a child process), RE59, RE76–RE78; RP11, RP49; wrapper RW9, RW19; SWR69; SR77 | engine, unit, child |
| **AC-4** — catch-up within 5 min after any downtime; no start backfills; a lost record is not a first start | RE5–RE8 (first start, the baseline minus live deliveries), RE24, RE30–RE37 (restart catch-up, back-dated arrivals, candidate revokes, the re-sent older version, lost record, identity change, the backlog cap), RE51, RE57 (10,000 at restart), RE62 / RE63 (catch-up deferred, never skipped), RE64, RE70, RE74 / RE75 (the journal flush timer, flush on SIGTERM); RP26, RP48, RP52, RP69; RS10, RS15, RS23; SS40 | engine, unit, store |
| **AC-5** — ships off, owner switch, off within 5 s, recovers alone, independent of follows, alongside the pass | RE2–RE4, RE38, RE73 (off with a write hung), RE39 / RE40 (residuals 1 and 2 repaired), RE41 / RE71 (dead pass, no loop), RE42, RE68–RE70 (re-look and catch-up after a pass), RE72; routes RR2–RR17, RR23 (the auth matrix, unlink on a failed off-write); wrapper RW1–RW22; SS34; SWR61, SWR62, SWR67; RP6, RP53 | engine, route, child, static |
| **AC-6** — status readable without a shell, at most a minute stale, no credential or address | RE17, RE26, RE27, RE43–RE46, RE51, RE64, RE68, RE76, RE79; routes RR2, RR5–RR7, RR17, RR19, RR22, RR24, RR25, RR27, RR28; RS18, RS21; RP65, RP66; SWR67, SWR71; SS37, SS38 | engine, route, unit, static |
| **AC-7** — nothing else moves; exactly the nine properties; only `TAGS` removals; writes only through the port | RE42, RE47 (≤ 25 rows in `(from, to)` order), RE48, RE53; SWR63, SWR64 (no new write statement), SR76 (`writer: 'pass'`) | engine, static |
| **Docs** (story docs task: BIBLE §6) | S2C9 (re-aimed: the status line no longer says the path is not built yet) | static |

## Suites and levels

| Suite | Level | Tests | What it covers |
|---|---|---|---|
| `test/tagging-edges-realtime-plan.test.js` | unit (pure) | 79 | Every export T2 lists, with T1–T19, T25, T32 and T33, table-driven. Purity and the no-64-hex guard. |
| `test/tagging-edges-realtime-engine.test.js` | integration over fakes | 79 | The criteria end to end through the T20 seam. The fakes (`test/helpers/taggingEdgesRealtimeFakes.js`) model strfry 1.1.0's store and deletion rules, a live subscription, strict scans with failure injection, a graph port with fingerprint verify, the store, the pass's report, and a clock. Tests drive simulated time and assert only the criteria's bounds. RE58 runs the engine in a child Node with a 160 MB heap. |
| `test/tagging-edges-realtime-routes.test.js` | store (real temp dir) and routes (fake req/res) | 52 | T21, T22, T26, T27, T32, T33: the canonical switch form, the record checksum, the journal torn tail, the auth matrix, the status computation. |
| `test/tagging-edges-realtime-wrapper.test.js` | child processes (bash) | 22 | T23, T28, T34: idle while off, conf re-read per start, backoff and its reset, TERM forwarding, the single-instance lock, pgrep safety. On macOS a perl `flock` shim stands in for util-linux `flock` on PATH. |
| `test/strfry-scan-strict.test.js` (amended) | unit | +10, SS9 re-aimed | `onEvent` streaming and its completeness, array filters, `\/` escaping, `filter-too-large` before spawn, the widened redactor, a throwing handler. |
| `test/tagging-edges-state-routes.test.js` (amended) | unit | +1 (ST23) | C20: `lockHeld` compares inodes. |
| `test/tagging-edges-wiring.test.js` (amended) | static | +11 | The supervisord block, pgrep-safe names, no pass machinery in realtime code, `READ_KEYS` read-only, `readAt` / `readKeys`, the routes and their owner gate, both `lockHeld` callers passing `file`, `run.sh`'s shape. |
| `test/tagging-edge-contract.test.js` | static | S2C9 re-aimed | BIBLE §6's status line. |
| `test/tagging-edges-runner.test.js` (amended) | ports | +2 | Pre-image lines carry `writer: 'pass'`; `resolveIdentities` still exported after the extraction. |
| `test/tagging-edges-live.test.js` (amended, opt-in) | live | +3 | `readAt` / `readKeys` against a real Neo4j (read-only), and a `limit:0` websocket smoke test. Skipped with a note where the stack is not reachable. |

## Edge cases

- **Floods anyone can publish.** Padded 130 KB taggings (RE54, RE58). One author's multi-`d` events at one address
  (RE58). Id-only taggings naming 500 KB elements (RE66). A journal of max-size kind-5 lines (RE58). A kind-5 stream
  during `waiting-graph`. Junk `a` targets under a fresh key (RP15).
- **Races.**
  - A version and its revoke heard in one round (RE19).
  - A version heard after a round's scan spawned (planner shrink tests).
  - A revoke of an old version, then a re-apply during a pass, then a wipe (RE39, RE40; the discard rule in RP46–RP47
    and RP76).
  - Element and address scans returning the same event (RP41).
  - A dead pass with `endedAt` null (RE41, RE71, RE72).
- **Relay rules.** Cross-author `e` and `a` deletions; an id-only revoke followed by an older version re-sent; a
  256-byte `a` target; non-canonical kind spellings; upper-case hex in ids and pubkeys (RP13, RP17, RP18, RP72).
- **Timing.**
  - A schema rule appearing at 67 s, a moment on no poll beat (RE29).
  - Reconnects 3 s apart (RE62, RE63).
  - Five lost races (RE78).
  - Different refusal codes (RE76).
  - A write hung at switch-off (RE73).
  - A TERM during a backoff sleep (RW20).
- **Persistence.**
  - A torn journal tail (RS11–RS14).
  - A tampered record (RS8).
  - A lost record and changed identities (RE36).
  - A missing `status.json`, versus an unreadable one (RR19–RR22).

## Test infrastructure

- **Runner.** Node's built-in runner through the gate registry (`test/registry.js`; the four new suites are
  registered). Hand-rolled suites in the house style; no new framework.
- **Node.** Every suite was run on Node 16.17.0 (the host) and on Node 22.23.3 x64 (CI parity, a scratchpad binary).
- **Stack.** No live stack is needed, except for the opt-in live suite, which skips without `NEO4J_*` or a reachable
  relay. No test writes to a graph or relay outside its own fakes and temp dirs. The local 7,030 dev `TAGS` are never
  touched.
- **Firmware state.** No `POST /api/firmware/install` precondition; no concept changes.
- **Fixtures.**
  - `test/helpers/taggingEdgesFixtures.js` (story 2): fake pubkeys only, never a deployment's TA and never the ADR
    0015 literal.
  - `test/helpers/taggingEdgesRealtimeFakes.js` (new): the fake relay, subscription, scan, graph, store, state and
    clock. Opt-in latency is available for the time-window tests.
- **Wrapper suite on macOS.** It needs `bash`, `perl` (for the `flock` shim when util-linux `flock` is absent) and
  `ps`.

## Changes to earlier suites

- **SS9** (story 2) is re-aimed from `spawn` to `filter-too-large`. The size check before spawn makes the real E2BIG
  path unreachable (T31). SS8 still pins `spawn` for a spawn that throws.
- **S2C9's last check** (story 2's re-aim of story 1's check) is re-aimed at story 3's BIBLE docs task. It is red
  until the Implementer rewrites BIBLE §6's status line.
- No other existing test changed outcome. Per suite, before → after:

  | Suite | Before | After |
  |---|---|---|
  | strfry-scan-strict | 30 pass | 30 pass (SS9 moved to red; its 29 others and SS33 pass) |
  | state-routes | 54 | 54 |
  | wiring | 60 | 60 |
  | contract | 97 | 96 (S2C9) |
  | runner | 75 | 75 |
  | sweep | 55 | 55 |

## Clarifications for the owner to ratify

ADR 0003 § "Clarifications (Test Design, 2026-09-28)" holds T1–T34. They fix every interface the suites call:

- **T1–T24:** module exports and signatures, the maps, journal lines, the engine seam and deps, the store, the routes,
  the wrapper's seams and `lockHeld`.
- **T25–T33:** the answers to about 50 questions the suite writers and the blind implementers raised. These include
  container types, record shapes, canonical forms and error-path answers.
- **T34:** the wrapper's healthy-run seam.

A few readings the owner should know, beyond the interfaces:
- a kind-5 whose own pubkey is written in upper-case hex resolves nothing live and waits for the next catch-up
  (≤ 10 min; T25, added to owner decision 5's corners);
- a failed on-write never unlinks the switch (T27);
- restored pending work is treated as catch-up work (T33);
- the "no row succeeds" rule applies only to rows for two or more addresses (T32);
- a digit-led `d` value in error text may be cut by the widened redactor (T31, the ADR's New debt).

## Validation of the suite itself (2026-09-28)

- **Writers' self-checks.** Each suite's writer ran it against a private throwaway implementation and a mutation
  set, and every writer's mutants were caught. One planner mutant became equivalent under T25: an upper-case id
  never reaches that line.
- **A blind reference implementation.** An independent implementation was written from the ADR alone, in an isolated
  worktree, by agents told not to read the suites.
  - Against it the story-3 suites passed 544 of 546. The two failures were a test bug (RE43, fixed: it predated T32's
    `process.startedAt`) and the expected S2C9 docs check. So the suites pin nothing beyond the spec.
  - The blind implementers' questions became T33. After T33 the reference needed one line (`statusUnreadable` only
    when true), after which every suite passed except S2C9.
- **A mutation pass on the blind reference.**
  - 110 single-behaviour mutants: 87 killed (79%).
  - The planner caught 37/38, the store 7/7, the routes 13/14, the wrapper 8/9 and the scanner 9/10.
  - The engine caught only 13/32. Its misses came from repair paths masking each other, zero-time fakes, and bounds
    loose enough that a delayed mutant still passed.
  - Each of the 23 survivors got a test (RE62–RE79, the RE29 amendment, RP79, RR28, SS40, RW22), and each was proven
    to kill its mutant while passing on the reference.
  - Final counts on the reference: plan 79/79, engine 79/79 (32 s), routes 52/52, wrapper 22/22 (with T34), scanner
    40/40, state-routes 55/55, wiring 71/71, runner 77/77, sweep 55/55, contract 96/97 (S2C9).
- **Never committed.** The reference and mutation scratch live only in the session scratchpad. The Implementer writes
  the real code.

## How to run

```
npm test
```

A single suite runs through its `run()` export, for example
`node -e "require('./test/tagging-edges-realtime-engine.test.js').run()"`, or directly with
`node test/tagging-edges-realtime-engine.test.js`. The wrapper suite needs `bash`; the live suite needs `NEO4J_URI` /
`NEO4J_USER` / `NEO4J_PASSWORD`. A full run's result is read from its record (`npm run gate:status`).

## Verification

**Red phase.** Run on 2026-09-28 on the working tree at `5ccb7aba` plus this phase's test changes, which were
committed as the Test Design commit. Each suite ran through its `run()` export on Node 16.17.0:

```
tagging-edges-realtime-plan     pass 0  fail 79  — "src/lib/tagging-edges/realtime.js not implemented yet (require failed …)"
tagging-edges-realtime-engine   pass 0  fail 79  — "src/pipeline/tagging-edges/realtime/index.js not implemented yet (require failed …)"
tagging-edges-realtime-routes   pass 0  fail 52  — "…/realtime/store.js | src/api/tagging-edges/realtime.js not implemented yet"
tagging-edges-realtime-wrapper  pass 0  fail 22  — "src/pipeline/tagging-edges/realtime/run.sh not implemented yet (…ENOENT…)"
strfry-scan-strict              pass 30 fail 10  — SS9, SS31–SS40 (onEvent never called; no size check; no \/ escape; redactor)
tagging-edges-state-routes      pass 54 fail 1   — ST23 (lockHeld ignores the inode)
tagging-edges-wiring            pass 60 fail 11  — SWR61–SWR71 (no program block, run.sh, routes, READ_KEYS …)
tagging-edge-contract           pass 96 fail 1   — S2C9 (BIBLE §6 still says "not built yet")
tagging-edges-runner            pass 75 fail 2   — SR76, SR77 (writer field; identities module)
tagging-edges-sweep             pass 55 fail 0
tagging-edges-live              pass 0  fail 3  skip 16 — SL17–SL19 (the port lacks readAt / readKeys; no stack here)
stack-free-npm-test             pass 6  fail 0  skip 1  — every suite is registered (G5)
```

Every failure is the feature not existing, or a pre-existing module lacking the new behaviour. None comes from a
test-file error.

## Test index

### Pure planner (`src/lib/tagging-edges/realtime.js`) — `test/tagging-edges-realtime-plan.test.js` (79)

| Id | Behaviour |
|---|---|
| RP1 | realtime.js sits in src/lib/tagging-edges/ and is pure CommonJS — it requires only its siblings, uses no clock, timer, randomness, hashing, process… |
| RP2 | realtime.js exports every name T2 lists — LIMITS and the 27 functions |
| RP3 | src/lib/tagging-edges/index.js re-exports every realtime.js name, as the same value |
| RP4 | LIMITS holds exactly the Implementation notes' keys and values — the byte values as numbers — and is frozen |
| RP5 | src/lib/strfryScanStrict.js re-exports realtime.js's escapeFilterArgv — the same function — so scanStrict and the planner size filters with the one… |
| RP6 | escapeFilterArgv is JSON.stringify(filter) with every "/" written "\\/" — JSON-equivalent, for a filter or an array of filters — so no argv carries… |
| RP7 | filterArgvBytes is the escaped text's UTF-8 byte length — not its character count, and counting each "\\/" as two bytes |
| RP8 | newMaps() gives fresh, empty { S: Map, H: Map, B: Set, R: Map }; recordId(maps, which, id, address, seq) sets one { a, seq } entry in the named map… |
| RP9 | subscriptionFilters gives exactly two live-only filters — stamped kind 39999 with both nostr-user-tag stamps, and kind 5 — each with limit 0 and no… |
| RP10 | when the two identities are equal, the #z list names the stamp once |
| RP11 | subscriptionFilters throws, building nothing, when either identity is one checkIdentity refuses — missing, null, empty, upper-case, 63 hex or not hex |
| RP12 | promptFromVersion gives { address, id } for a kind 39999 carrying either nostr-user-tag stamp — the contract edge's address, or a refusal's address… |
| RP13 | a version printed with upper-case hex — its id, its pubkey or both — yields no prompt: the contract refuses it at step 1 with no address, so prompt… |
| RP14 | a deletion's e target resolves through the seen map, then the heard map, to one revoke prompt { type: 'revoke', kind5Id, created_at, by: 'e', targe… |
| RP15 | a deletion's a target resolves only at an address the path knows — a seen or heard id there, or the graph's keys — to a by-a revoke prompt; a kind-… |
| RP16 | an a target counts only up to 255 UTF-8 bytes — an address of exactly 255 bytes resolves, one of 256 (still a tagging address) is ignored even when… |
| RP17 | an a target whose kind is spelled any other way — leading zeros, a plus sign, a space — or that names another kind is no tagging address and resolv… |
| RP18 | a live a target spelling its pubkey in upper-case hex resolves at the lower-case address the path knows, and the by-a prompt's target is that norma… |
| RP19 | another author's kind-5 prompts nothing — each of its targets that resolves to a known tagging of someone else adds 1 to foreign — and a target the… |
| RP20 | prompts are de-duplicated by (address, by, target) — an id named in both cases, an address named in both pubkey spellings — while two ids at one ad… |
| RP21 | anything that is not a well-formed kind 5 gives { prompts: [], matchedNothing: true, foreign: 0 }, even when it names a recorded id |
| RP22 | one kind-5 naming its author's recorded id, an id nobody recorded and another author's recorded id gives one prompt, foreign 1 and matchedNothing f… |
| RP23 | shrinkOnRead drops, from S, H and R (refusedSeen), the ids recorded at the address at or before the capture, other than the id the read returned, a… |
| RP24 | an empty read (returnedId null) drops every id recorded at the address up to the capture — an entry recorded at the capture itself included, one re… |
| RP25 | compact keeps every entry recorded after the scan began; otherwise S and R keep only scanned ids, H keeps scanned or candidate ids not in S, and B… |
| RP26 | an arrival is a scanned id not in S — one never heard (back-dated history arrives the same way) and one heard but still pending in H alike — while… |
| RP27 | a look-only prompt goes to (i) an address where the graph records another event id, or (ii) an address the graph does not hold whose scanned id is… |
| RP28 | an (id, address) in refusedSeen gets no look-only prompt, under (i) or (ii); without that entry the same scan gives both |
| RP29 | an arrival's address is never also a look-only prompt — not when the graph records another id there, nor in either order of a conflict at one addre… |
| RP30 | deletion candidates are the graph's event ids the scan no longer finds, plus S or H ids it no longer finds at an address the graph holds with anoth… |
| RP31 | deletionScanFilters groups candidates by their address's author — each entry one pubkey, by e or a, its filter exactly { kinds: [5], authors: [pubk… |
| RP32 | one author with 1,600 candidate ids and 1,600 addresses of about 132 bytes (with slashes) gets several filters, each within the 100,000-byte argv b… |
| RP33 | an address over 255 bytes is left out of the #a targets (strfry acts on no longer value), while its id is still in an #e filter |
| RP34 | isExpectedDeletion accepts a kind 5 whose lower-cased pubkey is the requested one and that names a requested target by the requested tag — an e com… |
| RP35 | addressScanFilters splits addresses into chunks of at most 200 one-address filters { kinds: [39999], authors: [pk], '#d': [d] } — d everything afte… |
| RP36 | long d values of slashes and three-byte characters split a chunk below 200 filters, so each chunk's escaped argv stays within 100,000 UTF-8 bytes —… |
| RP37 | isExpectedAddressEvent accepts a kind 39999 whose lower-cased pubkey is a requested address's and that carries that address's d as any d tag of at… |
| RP38 | elementScanFilters gives filters { kinds: [39999], ids } of 1 to 1,000 ids, each within the argv budget, covering every id once — and no empty filt… |
| RP39 | isExpectedElementEvent accepts a kind 39999 whose lower-cased id was requested, and refuses another kind or an unrequested id — ids given as a plai… |
| RP40 | dedupeById keeps the first event per lower-cased id, in order |
| RP41 | the same event returned by the element read and an address scan — or by two address scans — is one result at its address, not a conflict |
| RP42 | an event returned for an address only through a second d — its identity d gives another address — is not at this address: the version whose identit… |
| RP43 | an element read's tag element resolves an id-only tagging though the element sits at another address; with no element the tagging reads unresolved |
| RP44 | relayAtAddress reads a version with no nostr-user-tag stamp, or nothing at all, as null; a stamped non-tagging as the contract's refusal; two versi… |
| RP45 | mergePrompt(null, prompt) starts an entry { version, revokes, look } from a version, revoke or look prompt, and never changes the entry it is given |
| RP46 | mergePrompt keeps the latest version prompt, de-duplicates revokes by (by, target) keeping the one with the greatest created_at together with that… |
| RP47 | discardSupersededRevokes drops the by-e revokes whose target is not the known version, and keeps the matching by-e revoke, every by-a revoke, the v… |
| RP48 | a create is held as pre-existing while the relay's version is in the baseline, whatever prompted the look; a version not in it — one stored during… |
| RP49 | a not-on-relay removal acts only with a revoke prompt — a queued version prompt, a look, both, or nothing is held as removal-not-prompted, so a wip… |
| RP50 | a by-a revoke lets a not-on-relay removal act only through revokeApplies on a well-formed stored edge — a deletion as new as the stored createdAt o… |
| RP51 | a non-tagging removal (the relay now holds a refused version there) acts with a version prompt at the address or a valid revoke, and is held otherw… |
| RP52 | an update, a move, a none and a leave always act — never held, not even with the relay's version in the baseline and nothing but a look prompting |
| RP53 | a pass overlaps a round when it started before the round committed and it ended after the graph read, is still alive, or is dead with endedAt null… |
| RP54 | a dead pass with endedAt null re-looks once — the round whose graph read came before the path first saw it dead overlaps it; the re-look round, rea… |
| RP55 | roundOrder takes catch-up entries first (up to the share), then live, then re-looks, then the rest of the catch-up, each by seq |
| RP56 | with more catch-up work than its share, the round takes the 100 lowest-seq catch-up entries, then every live entry, then the re-looks, then the rem… |
| RP57 | a round holds at most 500 addresses — the catch-up share and the live lane first, then re-looks while room is left |
| RP58 | journalLine writes each of the ten line types as one compact JSON line ending in its only newline, which parses back to the object — a newline or c… |
| RP59 | replayJournal from no record applies v (into H, and a version prompt), d (a revoke prompt), f (into refusedSeen), p (parked), k (a dead pass seen)… |
| RP60 | an x line drops exactly the ids it lists from S, H, refusedSeen and B — a version heard at that address before it but not listed, or after it, surv… |
| RP61 | a c line moves the id to S and clears the entry's version only when it is that id — deleting the pending entry when that leaves no version, no revo… |
| RP62 | a torn, garbled, non-object or unknown-type line is skipped and counted, and the lines after it still apply; an empty line is ignored, not counted;… |
| RP63 | replayJournal restores the record's seen, heard and refusedSeen with seq 0, its baseline and deadSeenAt, and applies the lines on top |
| RP64 | re-looks are one per (address, runId), their entries merged by mergePrompt's rules — the latest version, per (by, target) the revoke with the great… |
| RP65 | allowErrorCode passes E-codes, Neo4j status codes, ServiceUnavailable, SessionExpired and the ScanError codes through unchanged |
| RP66 | allowErrorCode turns anything else into 'error' — a host name, host:port, [::1]:port, an IP, a URI, a near-miss of an allowed pattern, a code with… |
| RP67 | a version and its id-only revoke heard in one round — the revoke resolves through H, and the round's empty read removes the older relationship |
| RP68 | a version heard after a round's scan spawned, then revoked by id — it stays in H through that read's shrink, and the revoke resolves and removes |
| RP69 | a re-sent older version after an id-only revoke is created after downtime — the read that returned the newer version dropped the older one from S a… |
| RP70 | a version dropped over the backlog cap and then revoked by id is found by the catch-up — a deletion candidate in its author's #e scan, whose kind-5… |
| RP71 | a by-id revoke, then a re-apply at the same address during an overlapping pass, then a wipe — the re-look removes nothing, because the re-apply dis… |
| RP72 | a kind-5 whose own pubkey is written in upper-case hex is not isEvent-shaped, so it resolves nothing live — no prompt, no foreign count, matchedNot… |
| RP73 | gateAction treats a null ctx.entry as an empty entry — a create is held only by the baseline, a not-on-relay or non-tagging removal is held as remo… |
| RP74 | roundOrder places an address queued in more than one lane once, at its earliest position — the catch-up share before live, live before re-looks, re… |
| RP75 | replayJournal restores the record's pending [{ a, entry, lane, attempts, notBefore }], rechecks [{ a, runId, entry }] and parked [{ a, code, attemp… |
| RP76 | replaying a v line applies discardSupersededRevokes at that address with the line's id, to the pending entry and to its re-looks, as the live path… |
| RP77 | discardSupersededRevokes(entry, null) keeps every revoke — by-e revokes of several ids and by-a revokes alike — with the version and look, since an… |
| RP78 | replayJournal's pending holds entries only — each value is a T15 entry with exactly the keys version, revokes and look — whether restored from reco… |
| RP79 | replayJournal keeps the FIRST k time for a run — deadSeenAt[runId] is when the path first saw the run not alive, so a later k line for the same run… |

### Engine (`realtime/index.js`, through the T20 seam over fakes) — `test/tagging-edges-realtime-engine.test.js` (79)

| Id | Behaviour |
|---|---|
| RE1 | the engine module exports createEngine, run and defaultDeps, and createEngine(deps) returns start, tick, handleSignal and status |
| RE2 | run(deps) with the switch off leaves exit code 0 on deps.proc.exitCode, waits only through deps.sleep in steps of at most 250 ms, never calls proce… |
| RE3 | run(deps) with the switch on runs the path; when the owner turns it off at about 10.5 s, run resolves with deps.proc.exitCode 0 within 5 s of the off |
| RE4 | with the switch missing, unreadable or off at start, tick() answers { exit: 0 } within 5 s and nothing happens — no subscription, no relay scan, no… |
| RE60 | start() and tick() never call deps.sleep — through a first start, a burst, a graph outage, failing relay reads and idle minutes, every wait belongs… |
| RE5 | a first start subscribes once to the relay the environment names, with exactly the two filters (both nostr-user-tag stamps, and kind 5), limit 0 an… |
| RE6 | a tagging stored after the subscription opened — before the baseline scan, or while it runs — is live-delivered and created within 60 s; the pre-ex… |
| RE7 | a first start takes its baseline while the graph is unavailable, and touches the graph not at all before started.json is written |
| RE8 | a deletion that prompts a look at pre-existing addresses creates nothing where the graph holds nothing (the backfill owns it), and brings a relatio… |
| RE9 | a tagging the relay stores is created within 60 s, the relationship exactly the contract's and its people added — back-dated years, either stamp or… |
| RE10 | a flipped stance on a relationship the backfill wrote is updated within 60 s |
| RE11 | a new version naming another person moves the relationship within 60 s, leaving none at the old person |
| RE12 | a tagging naming its tag only by id takes the tag's address and slug from the relay's tag element within 60 s; with no such element it is written u… |
| RE13 | a burst of 10,000 changes stored at once — 9,000 new taggings from 40 authors and 1,000 of Alice's taggings revoked by id in ten kind-5s — is refle… |
| RE54 | a round keeps at most 16 MiB of events — facing 500 taggings of about 130 KB each at once, no round reads them all: every round's successful addres… |
| RE66 | the element read stays within the round's kept budget — 60 taggings naming their tag only by id, whose tag elements are about 500 KB each (30 MiB i… |
| RE14 | the author's revoke by event id removes the relationship within 60 s — one the backfill wrote and one the path created |
| RE15 | the author's revoke by address (dated no earlier than the version) removes the relationship within 60 s |
| RE49 | an address deletion from the author dated before the recorded version is no revoke of it — when the tagging has already left the relay with no even… |
| RE16 | another author's kind-5 changes nothing — by id (stored, not honoured) or by address (refused) — even when the relay no longer holds the tagging fo… |
| RE17 | a kind-5 that is no tagging revoke — an unpin, a curated-list copy's deletion, an ordinary note deletion, one naming nothing held — changes nothing… |
| RE18 | a revoke by id of the older version, arriving with a newer version, removes nothing: the relationship follows the relay's version |
| RE19 | a version heard but not yet written, then revoked by id at once, is removed within 60 s — the revoke resolves through the heard map |
| RE20 | after an id-only revoke, the older version re-sent is created within 60 s of reaching the relay |
| RE52 | the author's kind-5 written with its own pubkey in upper-case hex resolves nothing live (it is not isEvent-shaped), but strfry acts on it, so the n… |
| RE61 | the author's live revoke naming the tagging's id in upper-case hex, or its address with the pubkey in upper-case hex, still removes the relationshi… |
| RE59 | a newer version and its id-only revoke stored in one batch are never announced as a version — the relay announces only the kind-5, which names an i… |
| RE21 | a relay wipe removes nothing — not with a version prompt queued at the wipe, not across the 10-minute safety diff, and not when a restart's catch-u… |
| RE22 | a relay read that fails — exits non-zero, times out, or is cut short after streaming its events — changes nothing for that tagging and removes noth… |
| RE23 | while the tag-element read fails, an id-only tagging is written neither resolved nor unresolved; once the read succeeds it is written resolved with… |
| RE24 | with the graph unavailable nothing is lost — the status says waiting-graph, and a create, an update and a revoke made meanwhile are all applied wit… |
| RE25 | a transaction time-out is transient — writes failing with TransactionTimedOut for 2 minutes are applied within 5 minutes after, and nothing is park… |
| RE26 | a change the database refuses with the same non-transient error every time is parked after exactly two rounds that each read its address and failed… |
| RE76 | a change the database refuses with a different non-transient code at every attempt is never parked — parking needs the same code twice — so over 40… |
| RE50 | when every single-row attempt in a round fails with one non-transient code and no row succeeds, the rows are re-queued with a 5→60 s backoff — neve… |
| RE27 | a relationship another writer changed between the path's read and its write is not overwritten, and the relay's version stands within 60 s of the r… |
| RE77 | a lost race is retried at once — the next write for the address comes within 1 s of simulated time of the one that lost, and the relay's version th… |
| RE78 | after five consecutive lost races at one address the next attempt waits 10 s — the gap between the 5th and 6th attempts is at least 10 s (9.5 s all… |
| RE28 | a bad identity — either stamp missing, empty, not 64 hex, upper-case or mixed-case — means no subscription, no relay scan and no graph write; the s… |
| RE29 | while a database rule is missing — tags_address absent or not ONLINE, or nostrUser_pubkey absent — the path writes nothing and its status names the… |
| RE30 | a bad identity after the first start waits and writes nothing; after a restart with it corrected, the path catches up on what the relay stored mean… |
| RE58 | memory stays bounded — in a child Node process capped at --max-old-space-size=160, over lean fakes: (a) 200 stamped taggings of about 130 KB in one… |
| RE31 | after downtime — a deploy (SIGTERM), a crash, or the owner turning it off and on — a new start catches up within 5 minutes: new taggings (back-date… |
| RE32 | after an id-only revoke, an older version re-sent while the path was down is created at the next start — the read that saw the newer version droppe… |
| RE33 | a version heard while the graph was unavailable, then revoked by id while the path was off, is removed after it comes back — the switch-off flushed… |
| RE74 | while the path waits for the graph — no round can run, so no round ends — a version heard meanwhile reaches journal.jsonl as its v line within 1 s:… |
| RE75 | a version the relay delivers in the same tick as a SIGTERM is in journal.jsonl when the path exits — SIGTERM flushes what was heard first, so a dep… |
| RE34 | a tagging stored while the subscription was dropped is reflected by the reconnect's catch-up within 5 minutes, and live delivery resumes |
| RE62 | a second reconnect within 30 s of the last catch-up still gets its catch-up — deferred to the 30 s mark, never skipped: a tagging stored across the… |
| RE63 | reconnects 3 s apart start at most one catch-up per 30 s — three drops within 6 s give one catch-up in the 30 s from the first |
| RE35 | with the relay unavailable for 3 minutes (connections refused, every scan failing), the taggings stored meanwhile are reflected within 5 minutes of… |
| RE36 | a lost record — record.json missing or unreadable, the journal unreadable, or the identities changed — is not a first start: the status reports the… |
| RE37 | past the backlog cap, live prompts are dropped and counted, and nothing is lost: 20,100 taggings stored while the graph is unavailable are all refl… |
| RE64 | at the backlog cap a re-look is still queued, never dropped — with exactly 20,000 live prompts waiting on an unavailable graph, the re-look an over… |
| RE65 | a burst of 20,100 taggings with the graph available — past the 20,000-address cap — is reflected in full within 5 minutes: the live prompts the cap… |
| RE51 | a round completes every address it decided, a refused version included — its id enters the seen map and refusedSeen — so the next start's catch-up… |
| RE55 | under a sustained live stream that alone fills every round — new versions every tick at 200 addresses of about 130 KB (more than the 16 MiB kept bu… |
| RE67 | a catch-up's reserved share is bounded by bytes as well as by addresses — with 150 arrivals and 50 live versions of about 130 KB each after a resta… |
| RE56 | a subscription that stays connected but stops delivering — a tagging, a revoke by id and a revoke by address stored meanwhile — is caught by the sa… |
| RE57 | a 10,000-change backlog stored while the path was stopped — 9,000 new taggings, back-dated years among them, and 1,000 of the backfill's relationsh… |
| RE38 | while busy, the switch going off — or becoming unreadable, or missing — or a SIGTERM makes tick() answer { exit: 0 } within 5 s; no write starts af… |
| RE73 | with a port call hung in flight — a write that never settles — the owner turning the switch off still makes tick() answer { exit: 0 } within 5 s: a… |
| RE39 | ADR 0002 residual 1 ("in place") — the relay goes v1 → v2 → v2 revoked by id → v1 re-sent while a pass runs, the path rewrites the relationship bac… |
| RE40 | ADR 0002 residual 2 ("create after delete") — a pass that read nothing at an address creates v1 there after the path created it and then removed it… |
| RE68 | a round that overlaps a live pass journals a re-look (r) for the address it looked at, under the pass's run id, and the status counts it in counts.… |
| RE69 | within 6 s of an overlapping pass ending, a re-look round reads again the address the overlapping round looked at — the 5 s re-look check, then a r… |
| RE70 | when a pass that overlapped a round ends, a catch-up runs within 45 s — the catch-up whose candidate scan finds a revoke of a version the pass wrot… |
| RE41 | a pass that dies with endedAt null causes no endless re-look loop — once its re-looks and catch-up are done, the path reads neither the graph nor t… |
| RE71 | RE41 with time passing inside every round (each relay scan takes 20 ms, each graph call 5 ms): a pass that dies with endedAt null still causes no e… |
| RE72 | a pass already dead with endedAt null when a process starts is recorded as seen dead at that start — the deadSeenAt a restart would restore (the jo… |
| RE42 | across a pass overlapping rounds, ending, and another dying, the engine never touches the pass's report writer, held lists, confirmations or lock,… |
| RE43 | the status carries every field the ADR lists — state, times, the relay and subscription, the catch-up, every count by its keys, the setup problem a… |
| RE44 | while running, the status is rewritten at least every 30 s — updatedAt is never more than 30 s old over two idle minutes |
| RE45 | the status never shows a credential or where the database or the relay is reached — for a relay failure whose stderr names redis:6379 and a config… |
| RE46 | the status's counts survive a restart — the next process continues from them, with the same firstStartedAt |
| RE79 | the status's seen is the size of S and heard the size of H — three taggings in the first start's baseline, and two heard while the graph is unavail… |
| RE47 | every write goes through the port's applyCreates / applyLocked in calls of at most 25 rows sorted by (from, to) — creates, updates and moves by the… |
| RE48 | before a write drops a key outside the nine, the relationship's pre-image is appended under the path's session id (run-id grammar) with writer 'rea… |
| RE53 | the catch-up reads the graph's keys as plain { address, eventId } rows and ignores those whose address is missing or not a tagging address — even w… |

### Store (`realtime/store.js`) and routes (`src/api/tagging-edges/realtime.js`) — `test/tagging-edges-realtime-routes.test.js` (52)

| Id | Behaviour |
|---|---|
| RS1 | createStore({ dir }) gives every method T21 names — readSwitch, writeSwitch, unlinkSwitch, readStarted, writeStarted, readRecord, writeRecord, open… |
| RS2 | writeSwitch writes <dir>/switch.json in the canonical compact form — one JSON object, no whitespace outside strings, exactly { version, on, changed… |
| RS3 | with no switch.json (a fresh install: the path ships off) readSwitch gives null |
| RS4 | a switch.json that is present but unreadable — not JSON, empty, torn mid-write, binary bytes, or a directory in its place — reads as { unreadable:… |
| RS5 | a switch.json that parses but is not an object whose "on" is a boolean — "on":"true", "on":"false", "on":1, "on":null, no "on", JSON null, an empty… |
| RS6 | unlinkSwitch removes switch.json, after which readSwitch gives null — the route's fallback when an off-write fails, since an unlink needs no free s… |
| RS7 | writeStarted writes <dir>/started.json and readStarted gives { version: 1, firstStartedAt } back from a fresh store (it survives a restart); before… |
| RS8 | writeRecord writes <dir>/record.json holding the body plus a sha256 that is exactly SHA-256 (lower-case hex) over the UTF-8 of JSON.stringify of th… |
| RS9 | with no record.json readRecord gives null |
| RS10 | a record.json that does not match its sha256 or its version reads as { unreadable: true, reason: "record-unreadable" } — a changed value, an added… |
| RS11 | openJournal() cuts a torn tail — the partial last line a crash mid-append leaves — back to just after the last newline byte, on disk and byte for b… |
| RS12 | after openJournal() cuts a torn tail, appending continues cleanly — the next line starts on a line of its own, never glued to the partial one — and… |
| RS13 | appendJournal(lines) appends in order and fsyncs the journal on every call; the bytes on disk are exactly the lines concatenated, and openJournal()… |
| RS14 | openJournal() on a journal whose last line ends in a newline changes nothing on disk and yields every line |
| RS15 | a journal that cannot be opened or read at all (a directory in its place) makes openJournal() answer { unreadable: true } without throwing — the lo… |
| RS16 | truncateJournal() empties the journal — journalBytes() is 0 and a fresh openJournal() yields no line and is not unreadable (a compaction is never a… |
| RS17 | journalBytes() is the journal's size in bytes — UTF-8 bytes, not characters — growing with each append (the compaction trigger at 1 MiB and the sta… |
| RS18 | writeStatus writes <dir>/status.json, whose JSON holds every field written — the file the public status route reads — and readStatus from a fresh s… |
| RS19 | every whole-file write is atomic — with each rename onto the target failing, writeSwitch, writeStarted, writeRecord and writeStatus each fail loudl… |
| RS20 | createStore({}) defaults its directory to <stateDir>/realtime — TAGGING_EDGES_STATE_DIR when set — and a write there makes realtime/ when missing,… |
| RS21 | the store writes only inside its own directory — the pass's report.json, held/ and pass.lock beside it are left byte for byte, and no file appears… |
| RS22 | every store method is synchronous — none returns a promise or other thenable — writeSwitch, readSwitch, unlinkSwitch, writeStarted, readStarted, wr… |
| RS23 | readRecord verifies the sha256 over the parsed record by T26's rule, not over the file's bytes — a record.json another writer left pretty-printed,… |
| RS24 | with no journal.jsonl (a first start) openJournal() gives { lines: [] } — not unreadable, no line — and a first appendJournal then starts the journ… |
| RR1 | src/api/tagging-edges/realtime.js exports computeRealtimeStatus, validateSwitch, handleRealtimeStatus and handleRealtimeSwitch |
| RR2 | computeRealtimeStatus takes on and onSince from the switch record alone — on: true gives on with onSince = its changedAt (as readSwitch or the raw… |
| RR3 | off shows at once — with switch.json off, missing or unreadable, the answer says on: false, onSince null and state "off" even while status.json sti… |
| RR4 | running and runningSince come from liveness and status.json's process alone — a status.json storing running: true, a runningSince and state "live"… |
| RR5 | stale is true exactly when the process is alive and status.json's updatedAt is missing, unparseable or more than 60 s old — 60 001 ms true, 60 000… |
| RR6 | every AC-6 figure status.json holds reaches the answer as it is — state, firstStartedAt, relay, subscription, lastReflectedAt, lastRound, catchUp (… |
| RR7 | the answer adds no text of its own — every string in it, runningSince included, is one status.json holds, the switch's changedAt or changedBy prefi… |
| RR8 | validateSwitch accepts only a JSON object whose on is a boolean — { on: true } and { on: false } give { ok: true, on } — and gives { ok: false, sta… |
| RR9 | POST switch with no session answers 401 — a loopback (req.localTrusted, 127.0.0.1) request included — and changes nothing: no file read, written or… |
| RR10 | POST switch from any session that is not the owner's answers 403 and changes nothing — a signed-in stranger (also on loopback), an admin (session f… |
| RR11 | POST switch answers 403 and changes nothing when the configured owner is not a lower-case 64-hex pubkey — empty, missing, null, upper-case or 63 ch… |
| RR12 | POST switch from the owner with an Origin naming another host answers 403 and changes nothing — another site, Origin null (a sandboxed frame), and… |
| RR13 | POST switch from the owner with a body that is not application/json answers 415 and changes nothing — text/plain, a form, multipart, no Content-Type |
| RR14 | POST switch from the owner whose on is not a boolean answers 400 before any file access — readFile, writeSwitch and unlinkSwitch never called — for… |
| RR15 | the owner, from the same host, with JSON, turns the path on and off — writeSwitch is called once with exactly { version: 1, on, changedAt: now as I… |
| RR16 | when writing an off switch fails — for lack of space (ENOSPC), an i/o error, or an error whose code is off the allow-list and whose message names a… |
| RR17 | a switch write that fails otherwise never answers success — turning on with ENOSPC answers 500, does not say on and unlinks nothing; an off-write w… |
| RR18 | GET status reads realtime/switch.json and realtime/status.json under stateDir() through the injected readFile (fs.readFileSync- or fs.promises-shap… |
| RR19 | GET status is public and still answers 200 when status.json is missing (the path never ran, or is off) — no session needed; on and onSince from swi… |
| RR20 | GET status with a switch.json that is present but unreadable — not JSON, empty, torn, a read error such as EACCES, or one that parses but is not an… |
| RR21 | without an injected isAlive, GET status judges liveness from /proc/<pid>/stat read through the injected readFile — the host's /proc is never consul… |
| RR22 | GET status when a read fails other than "missing" answers 200 and leaks nothing — a status.json that cannot be read (EACCES naming the absolute pat… |
| RR23 | on their default deps — as Express calls them, (req, res, next) — the owner's POST writes <TAGGING_EDGES_STATE_DIR>/realtime/switch.json through th… |
| RR24 | computeRealtimeStatus re-applies allowErrorCode to lastError.code and to the dbRefused.byReason keys — a status.json carrying neo4j.internal, neo4j… |
| RR25 | GET status re-applies the allow-list to what status.json holds — a status.json whose lastError.code is 'neo4j.internal' and whose dbRefused.byReaso… |
| RR26 | src/api/tagging-edges/realtime.js takes allowErrorCode from src/lib/tagging-edges/realtime.js — a require() by a relative path that resolves to tha… |
| RR27 | every time field the status answer carries is an ISO string — onSince (the switch's changedAt), runningSince (process.startedAt), firstStartedAt, r… |
| RR28 | dbRefused.byReason keys that collapse to 'error' under allowErrorCode have their counts summed — a status.json holding 'error' (1), neo4j.internal… |

### Wrapper (`realtime/run.sh`, child processes) — `test/tagging-edges-realtime-wrapper.test.js` (21)

| Id | Behaviour |
|---|---|
| RW1 | while switch.json is absent, {"version":1,"on":false,…}, empty, {"on":"true"} (a string) or not JSON, the wrapper starts no node process at all wit… |
| RW2 | the wrapper makes <TAGGING_EDGES_STATE_DIR>/realtime with mode 0700 and opens realtime/daemon.lock there at start, even while the switch is off |
| RW3 | switched on (canonical {"version":1,"on":true,…}) while it idles, the wrapper starts node within 4 s at a 1 s poll — it re-reads switch.json on eve… |
| RW4 | with {"version":1,"on":true,…} node is started through PATH as `node --max-old-space-size=384 <abs>/index.js`, where <abs>/index.js is the absolute… |
| RW5 | node runs with the conf's exported variables (the conf is sourced for the start), the wrapper's TAGGING_EDGES_STATE_DIR, and fd 8 open on <stateDir… |
| RW6 | the conf is re-read at every node start — an edit between two starts is seen by the second, and a variable only the first version exported is gone,… |
| RW7 | a node that exits at once — with 1, and with 0 — is restarted with backoff, not in a hot loop: in the 6.5 s after the first start there are 2 to 4… |
| RW8 | the wrapper itself never exits when node exits — after repeated quick node exits (with 1 and with 0) it is still running, so supervisord never sees… |
| RW9 | a conf that cannot be sourced (BRAINSTORM_CONF names a missing file) starts no node and does not stop the wrapper; once the conf appears, a later s… |
| RW10 | after node exits with the switch off, the wrapper does not start it again (no start for 3.5 s, the wrapper still running), and it starts node once… |
| RW11 | TERM to the wrapper (its pid alone) forwards TERM to node, waits for node to finish, and exits 0 — node is not started again |
| RW12 | INT to the wrapper forwards TERM — not INT, which a background job starts with ignored — to node, waits for it, and exits 0 |
| RW13 | TERM to an idle wrapper (switch off, no node) makes it exit 0 within a few seconds, starting no node |
| RW14 | a second wrapper on the same state dir, while the first holds realtime/daemon.lock and runs node, never starts node — it calls `sleep 30` through P… |
| RW15 | the lock is the kernel's, released with its holder — after the holding wrapper and its node are killed (a crash), a new wrapper on the same state d… |
| RW17 | run.sh calls `flock -n 8` through PATH by its bare name — every wrapper, idle ones included (it locks before its loop), calls the test's flock in t… |
| RW18 | after quick node exits — with 1, and with 0 — the wrapper backs off through PATH between starts: its sleeps are 1, 2, 4, 8, 16, 30, 30, 30 s, doubl… |
| RW19 | a conf whose source fails — it exports its variables, then its last command fails — starts no node: the per-start subshell is `( . "$BRAINSTORM_CON… |
| RW20 | TERM to the wrapper during a backoff sleep makes it exit 0 within 1 s, starting no node — its backoff sleeps run in the background and it `wait`s,… |
| RW21 | run.sh stays bash-3.2-compatible — a cheap static scan finds none of the bash-4-only syntax it knows (associative arrays, ${var,,} / ${var^^}, mapf… |
| RW22 | a healthy run resets the backoff — with T34's seam TAGGING_EDGES_REALTIME_HEALTHY_SECONDS=3, three node starts that exit 1 at once are backed off 1… |

### Strict scanner (story 2 suite, amended) — `test/strfry-scan-strict.test.js` (11)

| Id | Behaviour |
|---|---|
| SS9 | a filter too long for one command line (3.3 MB of JSON) is refused "filter-too-large" before spawn, and strfry never runs |
| SS31 | with onEvent, each event goes to onEvent as its line is read — in the order strfry printed it, unchanged, an event from an early pipe write before… |
| SS32 | with onEvent every completeness rule still holds — a duplicate, a truncated last line, an off-filter event, a stdout over maxBytes, a line that is… |
| SS33 | a filter may be an array of filters — strfry receives the array as its one filter argument (parsed back, equal to it; 2 and 200 one-address filters… |
| SS34 | the filter strfry receives on argv writes every "/" as "\\/" — for an object and for an array — so a publisher's #d naming the pass's pgrep pattern… |
| SS35 | the argv filter's byte size after the "\\/" escape is checked before spawn — over 100,000 bytes rejects ScanError "filter-too-large" with spawnImpl… |
| SS36 | escapeFilterArgv is exported beside scanStrict and is the very function src/lib/tagging-edges/realtime.js exports — JSON.stringify(filter) with eve… |
| SS37 | redactPublicText, widened for CF-3, replaces a letter-led host name with a port — dotted or single-label: neo4j.internal:7687, neo4j:7687, localhos… |
| SS38 | a "strfry error:" line naming host:port values the widened redactor covers — redis:6379 (which strfry's stderr always names), neo4j.internal:7687 a… |
| SS39 | an off-filter rejection says the event was refused by the caller's isExpected — with and without onEvent |
| SS40 | an onEvent that throws rejects the scan with the handler's own error and the scan never resolves — whether it throws on the first of four events (m… |

### State (story 2 suite, amended) — `test/tagging-edges-state-routes.test.js` (1)

| Id | Behaviour |
|---|---|
| ST23 | lockHeld(fd, { file }) is true only when a "FLOCK … WRITE" lock line is present AND fdinfo's ino: equals fs.statSync(file, { bigint: true }).ino —… |

### Wiring (story 2 suite, amended) — `test/tagging-edges-wiring.test.js` (11)

| Id | Behaviour |
|---|---|
| SWR61 | docker/supervisord.conf holds one [program:tagging-edges-realtime] block with the ADR's keys — command /bin/bash …/src/pipeline/tagging-edges/realt… |
| SWR62 | the program's name matches none of the words the task-queue sentinel forbids (queue\|worker\|bull\|taskqueue; test/task-queue-bullmq.test.js T9), and… |
| SWR63 | no realtime code touches the pass's machinery or the shared credential readers — no file under realtime/ (nor src/lib/tagging-edges/realtime.js or… |
| SWR64 | graph.js CYPHER gains one read, READ_KEYS — MATCH ()-[r:TAGS]->() RETURN r.address AS address, r.eventId AS eventId, with no write clause — and no… |
| SWR65 | the port's readAt(addresses, { timeoutMs }) runs READ_AT once, in one read transaction with that time-out, over $addresses with $scalarTypes, locki… |
| SWR66 | the port's readKeys({ timeoutMs }) runs READ_KEYS once, in one read transaction with that time-out, writing nothing, and resolves one plain { addre… |
| SWR67 | src/api/index.js registers GET /api/tagging-edges/realtime/status as a public read (the handler alone) and POST /api/tagging-edges/realtime/switch… |
| SWR68 | both lockHeld callers pass the lock file — the pass runner passes { file: <stateDir>/pass.lock } and the real-time engine passes { file: …/realtime… |
| SWR69 | run.sh is bash and sources the conf only inside the per-start subshell that execs Node — ( . <conf> && exec node --max-old-space-size=384 <run.sh's… |
| SWR70 | run.sh calls flock, sleep and node by their bare names, through PATH — never through an absolute or relative path, never with command -p — and neve… |
| SWR71 | the routes module takes allowErrorCode from src/lib/tagging-edges/realtime.js — it requires ../../lib/tagging-edges/realtime for it (destructured,… |

### Contract / BIBLE (story 1 suite, re-aimed) — `test/tagging-edge-contract.test.js` (1)

| Id | Behaviour |
|---|---|
| S2C9 | BIBLE §6's TAGS status line says what writes TAGS and how it runs — task reconcileTaggingEdges, GET /api/tagging-edges/status — no longer says no p… |

### Pass runner (story 2 suite, amended) — `test/tagging-edges-runner.test.js` (2)

| Id | Behaviour |
|---|---|
| SR76 | every pre-image record the pass appends carries writer: 'pass' — an update's and a removal's — beside the fields it already had (runId, address, ri… |
| SR77 | the runner still exports resolveIdentities, and it is the very function src/pipeline/tagging-edges/identities.js exports — moved there and re-expor… |

### Live, opt-in (story 2 suite, amended) — `test/tagging-edges-live.test.js` (3)

| Id | Behaviour |
|---|---|
| SL17 | readAt(addresses, { timeoutMs }) through the port openGraph builds, on the local graph and read-only — for up to 20 addresses the graph holds plus… |
| SL18 | readKeys({ timeoutMs }) through the port openGraph builds, on the local graph and read-only, resolves one plain { address, eventId } row per TAGS r… |
| SL19 | a limit:0 REQ carrying the real-time path's two subscription filters, sent to the local relay at ws://127.0.0.1:7777 only when a WebSocket handshak… |
