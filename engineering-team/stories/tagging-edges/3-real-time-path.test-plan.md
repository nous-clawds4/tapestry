# Test Plan: Story 3 — The real-time path

**Story:** `engineering-team/stories/tagging-edges/3-real-time-path.md`
**ADR:** `engineering-team/decisions/tagging-edges/0003-real-time-path.md` (Decision sections, clarifications T1–T34,
Amendment A1, A1-1…A1-21, and A1 clarifications 1–25)
**Date:** 2026-09-28; A1 pass 2026-09-29; review round 1 pass 2026-09-29

**Amendment A1 (2026-09-29).** Implementation was sent back to Architecture. The ADR gained Amendment A1: a lineage
per address replaces H, a by-id revoke resolves only as its address's top, the gate has clauses (i) and (ii), and
nothing discards a revoke. The owner accepted it with decision 11. This plan now covers A1 as well. Each section below
keeps its round-1 text and adds an A1 part:
- a coverage table for A1-1…A1-18 and the amended owner decisions;
- three new suites (lineage, resilience, property);
- the re-aims and deletions in the planner and engine suites;
- the new harness controls;
- a validation of the A1 pass against a scratch reference;
- the red phase on the round-1 working tree.

Where round-1 text names H, `discardSupersededRevokes` or a discard, A1 governs.

**Review round 1 (2026-09-29).** The review (`engineering-team/reviews/tagging-edges/3-real-time-path.md`) asked for
changes. The owner ratified its recommendation, and ADR 0003 gained A1 clarifications 20–25 (`d9d0ccf8`). This pass
adds 17 tests, 8 of them in a new suite, and re-aims one:
- **Clarifications 20–23 are pinned, and pass now.** The code already does each: RX20, RX21 (20), RX22 (21), RX23
  (22) and RL28 (23).
- **Clarifications 24 and 25 need no new test.** 24 corrects the docs' account of strfry's defect. 25's "no
  subscription with a bad identity" is RE28's existing assertion.
- **Four tests are red until the Implementer's round-1 fixes,** each for the reason the review names:
  - SWR72 and RE81 cover conform item 1(e). The pass's schema reads keep no transaction time-out, and the path passes
    its own.
  - RX24 covers conform item 1(f). A catch-up merges its work at a database-refusal park into the parked entry.
  - RX25 covers Blocking 2. An unexpected error in a catch-up step ends that catch-up and backs off.
- **A new suite, `test/tagging-edges-realtime-subscription.test.js` (RSUB1–RSUB8),** drives the real websocket client
  against an in-process `ws` relay (review non-blocking 8). It passes now.
- **S2C16 is re-aimed:** some Last-updated entry records story 2, not the newest one (ledger row
  `2026-09-29-newest-entry-doc-tests-go-stale`).

§ Review round 1 below has the coverage, the red phase and its validation.

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

### Amendment A1 (2026-09-29)

A1 adds tests to the criteria as follows:
- AC-1: RX2–RX6, RX15, RX18, RX19 and RE80. The minute is held under time-outs, stalls and a padded catch-up.
- AC-2: RL1–RL4, RL18 and RL22. These are the stale by-e family and clause (ii)'s intended case.
- AC-3: RL5–RL8, RL10, RL15, RX1 and RX7–RX10. Nothing is lost to an empty read, a discard or a journal fault, and
  nothing is removed wrongly.
- AC-4: RL9, RL11–RL14, RE7 and RE8. These cover the census and the first start's own catch-up.
- AC-6: RE79, RL17, RX14 and RX17.
- The property suite (RF1–RF36) asserts every criterion's safety side after every operation.

The table maps each A1 rule and each amended owner decision to the tests that cite it.

| A1 item | What it pins | Tests |
|---|---|---|
| **A1-1** the lineage replaces H | `{S, B, R, L}`, no H; `heard` counts addresses whose top is not in `S` | RP8, RP26, RP63, RP80, RP84, RP92; RE79; RX11 |
| **A1-2** learning, placed at the capture | a delivery makes the top; a read or scan placed under a later learning teaches nothing; an empty read changes nothing; the graph's version joins `older` | RP23, RP24, RP68, RP80–RP83; RL5–RL7, RL15, RL23, RL24; RF8, RF9 |
| **A1-3** resolution | an `e` target resolves only as its address's top; an `a` target through a lineage, `S` or the graph's keys; foreign counts only resolving targets | RP14–RP16, RP19, RP20, RP22, RP72, RP90; RE18, RE19; RL1, RL3, RL6; RF2–RF5 |
| **A1-4** the gate | clause (i) X = G; clause (ii) X the top and G in `older`; the copy taken before the round's own read is learned; a non-id `eventId` satisfies neither | RP67, RP68, RP70, RP71, RP81, RP91, RP96; RL1–RL4, RL18, RL22, RL23; RF1, RF6, RF7 |
| **A1-5** no discards; 8 by-e revokes | `discardSupersededRevokes` gone; put-backs, re-looks, replay and `c` carry prompts; at most 8 by-e revokes per entry, the most recently merged | RP2, RP61, RP71, RP75, RP89, RP95, RP96; RE18; RL2, RL8, RL16, RL22; RF18 |
| **A1-6** record and journal | absolute `v` / `o` lines, lineage rows, the `e` epoch, streamed replay, the demotion at `journal-unreadable`, the compaction cadence | RP58–RP60, RP62, RP63, RP92–RP94; RE58; RL10–RL12, RL16, RL24; RX7–RX12 |
| **A1-7** compaction and bounds | the cap of 8 `older` ids; `pruneLineage`'s four drop conditions, the cut, the pass exception | RP25, RP83, RP85–RP88; RL16, RL26, RL27; RX13; RF18 |
| **A1-8** the census | one key read before the REQ, no retry, a 10 s deadline the engine enforces; `older` with no top; placed under the scan, not at a held address | RP15, RP82; RE7; RL9, RL12–RL14, RL25; RF10–RF12, RF17 |
| **A1-9** the catch-up | arrivals learned; rule 2 names lineage tops; found revokes journaled as `d`; the unfed backlog in `pending` | RP30, RP70; RL2, RL7, RL11; RX9; RF9 |
| **A1-10** the first start | the census first; the buffer learned, then the scan placed; one catch-up with trigger `start` | RE7, RE8; RL9, RL12; RX7 (a); RF27, RF28 |
| **A1-11** no start hold | restored work and live prompts run while a catch-up fails or backs off | RX1 |
| **A1-12** parked prompts persist | parked rows `{a, code, attempts, nextAt, entry}`; replay merges the entry into `pending` | RP75, RP78, RP95; RL10 |
| **A1-13** time-outs | no bisection of a timed-out group; the stall-or-slow test and the regroup; read-alone marks; one single time-out per round; parking after three; the stall guard | RX2–RX5, RX15–RX19 |
| **A1-14** the catch-up share | `maxBytes` = what is left of the fifth, for address scans and element reads; no bisection under the share; lane 4 | RE54, RE67, RE80; RX5, RX6 |
| **A1-15** why the lineage follows store order | a revoke of an old version never removes a newer one unless a notice was lost | RP90; RL3, RL15, RL19–RL21; RX7; RF1, RF7 |
| **A1-16** owner decisions | see the four rows below | — |
| **A1-17** interfaces | T2's 32 functions, T3's lineage functions, T6–T8, T10, T15, T16, T19, T20, T25, T29, T33 as amended | RP2, RP3, RP8, RP14, RP15, RP23–RP25, RP30, RP59–RP61, RP63, RP64, RP70, RP75, RP80–RP96; RE7; RX11 |
| **A1-18** settlements | `subscription.connected: false` after a stop; `lastReflectedAt` not moved by a held decision; the mark survives put-backs; a timed-out fake scan costs its `timeoutMs` | RE38, RX14; RL17; RX15; harness (below) |
| **Decision 2** what counts as a revoke | the address with `revokeApplies`; by id the recorded version, or the top over it (clause ii); what waits for the pass, a non-id `eventId` included | RP67, RP81, RP91; RL4, RL12, RL24; RF14, RF17 |
| **Decision 5** corners that wait for the pass | the first corner widened; the second corner; the census window (fourth corner); the lost-record corner widened | RL14; RF10–RF13, RF15, RF16 (the classifier excuses only these) |
| **Decision 10** residuals beyond the minute | delete-hides-next-write; a deletion drained while the read that first shows its target runs | RL15 (a dropped connection, and strfry's delete-hides-next-write, as the fakes model it); RE56 (a subscription that stops delivering); RF27, RF28 (excused from the minute only) |
| **Decision 11** the lost-notice removal (accepted) | clause (ii) stands; its three shapes remove | RL18–RL21 (documentation: they assert the removal; they would invert if the decision were declined), RL23; RP67, RP91; RF1 |
| **A1 clarification 11** time-outs | the one-single-time-out limit counts any one-address or one-id scan; marked singles in ascending order of their own consecutive time-outs, ties by queue order; the bounds per case (two time-outs plus a round when another read answered first, three when the group was its round's only read) | RX2, RX3 (titles already state the limit and both bounds), RX18 |
| **A1 clarification 12** time-out parks | not counted in `dbRefused`, each single time-out in `failedReads.relay`, the park in `parked`; a catch-up does not lift one (its arrivals, looks and found revokes merge into the parked entry); a live new version while the parking round holds the address lifts it at once, with the mark and the park's level; a successful write does not lift one | RX16, RX17, RX19; RX3 (the write) |
| **A1 clarification 13** pass-overlap ties | `endedAt >= graphReadAt` and `graphReadAt <= deadSeenAt` overlap; `startedAt < commitAt` stays strict | RP53 (re-aimed) |

Decision 9's new ceilings are pinned where a test can see them: the never-answering bound (RX2, RX3) and the journal
cadence (RX12). The heap figures are the Implementer's Evidence, not a test.

### Review round 1 (2026-09-29)

The review's items and the A1 clarifications the owner ratified from it (20–23), plus two corrections of fact (24,
25). "Red now" means red on `feat/tagging-edges-3` at `d9d0ccf8`, the code the review read.

Review round 1 adds tests to the criteria as follows:
- AC-1: RX20, RSUB1 and RSUB2. A lone change through a stall keeps the minute, and the path hears what the relay
  delivers.
- AC-2: RX22 and RL28. A revoke is not held back by a time-out park or a compaction.
- AC-3: RX21, RX23, RX24, RX25, RSUB4–RSUB6 and RSUB8.
- AC-4: RX25. No catch-up is wedged, the safety diff included.
- AC-6: RX23, RX25 and RSUB4. The counts and the last error, and no relay text in a close reason.
- The ADR's rule that story 2's pass does not change: SWR72 and RE81.

| Item | What it pins | Tests | Now |
|---|---|---|---|
| **A1 clarification 20** single time-outs park only while other relay reads answer | a lone change through a total stall is never parked: it backs off 5→60 s, each time-out counts in `failedReads.relay`, and it is reflected within 60 s plus a round of the relay answering | RX20 | pass |
| | a never-answering address read alone, never marked, beside answering traffic, is still parked after its third counted time-out (5 min) | RX21 | pass |
| **A1 clarification 21** a live revoke lifts a time-out park | the author's kind-5, resolving at the parked address, lifts the park at once, keeping the read-alone mark and the park's level; it costs one more single read (re-parked at 30 min), or removes the relationship at once once the address answers | RX22 | pass |
| **A1 clarification 22** element singles count in `failedReads.element` | a one-id element time-out adds to `failedReads.element`, not `failedReads.relay`, and counts toward the park (parked after three) | RX23 | pass |
| **A1 clarification 23** the compaction keeps what was learned since the key read | a version a round learned and wrote between a catch-up's key read and its capture stays in `older` through the compaction, so a revoke of the later top removes it (clause ii) | RL28 | pass |
| **A1 clarification 24** strfry's defect as read in its source | docs only. The fakes model one newest deleted, hiding one write (`relay.deleteHidesNextWrite`: RL15). A wipe that deafens live delivery until a reconnect is a subscription that stops delivering, which the safety diff catches (RE56). | — | — |
| **A1 clarification 25** no subscription with a bad identity | already pinned: no subscribe call, scan or write, and `waiting-setup` | RE28, RE30 | pass |
| **Blocking 1(e)** conform: `readSchema` keeps no default for the pass | the port: `readSchema()`, `ensureTagsConstraint`'s reads, and a real pass's pre-flight and snapshot-conflict re-read run their SHOW statements with no transaction time-out; `readSchema({ timeoutMs })` runs both with it | SWR72 | **red**: each runs with 30 s |
| | the path: every `readSchema` call it makes passes a finite, positive `timeoutMs` | RE81 | **red**: it passes none |
| **Blocking 1(f)** conform: a catch-up merges into a refusal park | at a safety diff, a database-refusal park is not re-queued: the catch-up's arrival merges into the parked entry (record.json's parked row names it), no write before the park's timer, a retry at it | RX24 | **red**: the diff's round writes 174.5 s after the park |
| **Blocking 2** a catch-up step's unexpected error | the catch-up ends `failed` (status `catchUp.last`, a `lastError` with its stage), backs off 5→60 s, and a later catch-up completes; the status then says `live` | RX25 | **red**: `catching-up` for good |
| **Blocking 3, 4** docs | the strfry defect's wording (24) and the bad-identity wording (25) | — | — |
| **Non-blocking 8** the websocket client had no test | the real `subscription.js` against an in-process `ws` relay: the REQ, EOSE and EVENT order, other ids ignored, NOTICE and CLOSED, pings and pongs, refused and dropped connections, `close()`, T29's asynchronous callbacks | RSUB1–RSUB8 | pass |
| **Harness friction 1** (ledger row `2026-09-29-newest-entry-doc-tests-go-stale`) | S2C16 asks that some Last-updated entry records story 2, whichever is newest | S2C16 (re-aimed) | pass |

## Suites and levels

| Suite | Level | Tests | What it covers |
|---|---|---|---|
| `test/tagging-edges-realtime-plan.test.js` | unit (pure) | 93 (A1: 79 − 3 deleted + 17 new; 30 re-aimed) | Every export T2 lists, with T1–T19, T25, T32 and T33, table-driven. Purity and the no-64-hex guard. A1: the six lineage functions and their cap, placement under a later learning, `pruneLineage` and its pass exception, the gate's clauses, the 8 by-e revokes, absolute `v` / `o` lines, the epoch, parked entries. |
| `test/tagging-edges-realtime-engine.test.js` | integration over fakes | 81 | The criteria end to end through the T20 seam. The fakes (`test/helpers/taggingEdgesRealtimeFakes.js`) model strfry 1.1.0's store and deletion rules, a live subscription, strict scans with failure injection, a graph port with fingerprint verify, the store, the pass's report, and a clock. Tests drive simulated time and assert only the criteria's bounds. RE58 runs the engine in a child Node with a 160 MB heap. A1: 80 (RE80 new); RE7, RE8, RE38, RE54, RE58, RE67 and RE79 re-aimed, RE18 and RE19 retitled. Review round 1: 81 (RE81 new, conform item 1(e): the path passes its own schema-read time-out). |
| `test/tagging-edges-realtime-lineage.test.js` (A1, new) | integration over fakes | 28 | A1-20's engine scenarios 1–7, 11, 12, 13, 15 and 16: the stale by-e family, a reconnect gap, a read between a revoke's store and its delivery, catch-up arrivals, put-backs and re-looks, first-start revokes, parked revokes across compaction and restart, found revokes across a wipe, the census, a read that cannot be placed, a flooded address, `lastReflectedAt`. RL18–RL21 are clause (ii)'s intended case and decision 11's three shapes, as documentation. RL22–RL27 come from mutation passes. Review round 1: RL28, A1 clarification 23 (the compaction cut with interleaved rounds). |
| `test/tagging-edges-realtime-resilience.test.js` (A1, new) | integration over fakes | 25 | A1-20's scenarios 8, 9, 10, 14 and 17: no start hold, A1-13's time-outs and stalls, the padded share, journal faults (torn appends, a read failing part-way, the demotion, the epoch), replay exactness over fixed seeds; then the compaction cadence, the pass exception, the final status, and the read-alone mark (RX15); then A1 clarifications 11 and 12 on time-out parks and the singles' order (RX16–RX19). Review round 1: A1 clarifications 20–22 (RX20–RX23), conform item 1(f) (RX24) and Blocking 2 (RX25). Time-out tests wait scan costs on the fake clock (`relay.scanWaits`). |
| `test/tagging-edges-realtime-property.test.js` (A1, new) | property over fakes, deterministic | 36: 28 by default + 8 opt-in | A1-20's fuzzer. By default (RF1–RF28, well under 30 s): an oracle self-check, the 17 fixtures in `test/fixtures/tagging-edges-realtime-property/` (16 shrunk traces and one hand-written flood) replayed with the verdict each must have under A1, fixture hygiene, determinism, and 3 seeds × 150 steps in each of the eight modes. With `TAGGING_EDGES_PROPERTY=1`, RF29–RF36 run the fuller campaign, 8 modes × 20 seeds × 150 steps (about 55 s here); otherwise they are skipped with that reason. It asserts I1–I4 (no removal while the relay held an accepted version; every removal justified by A1-4 in relay terms; no create for a baseline version; writes carry the contract's properties), off within 5 s, no status leak, the two caps, and in healthy modes the minute outside A1-16's corners. |
| `test/tagging-edges-realtime-routes.test.js` | store (real temp dir) and routes (fake req/res) | 52 | T21, T22, T26, T27, T32, T33: the canonical switch form, the record checksum, the journal torn tail, the auth matrix, the status computation. |
| `test/tagging-edges-realtime-wrapper.test.js` | child processes (bash) | 22 | T23, T28, T34: idle while off, conf re-read per start, backoff and its reset, TERM forwarding, the single-instance lock, pgrep safety. On macOS a perl `flock` shim stands in for util-linux `flock` on PATH. |
| `test/tagging-edges-realtime-subscription.test.js` (review round 1, new) | the real module against an in-process `ws` relay on the loopback | 8 | Review non-blocking 8: `subscription.js`, the one websocket client, which every other suite fakes. The REQ with `limit:0` forced and the subscription id, EOSE then EVENT order, other subscription ids and stray frames ignored, NOTICE and CLOSED with their fixed reasons, pings and a missing pong, refused and dropped connections, `close()` sending CLOSE and firing no `onClose`, and T29's asynchronous callbacks. The ping, pong and handshake time-outs run on subscribe()'s own seams, so it takes about 3 s. It never reads the module's other exports. |
| `test/strfry-scan-strict.test.js` (amended) | unit | +10, SS9 re-aimed | `onEvent` streaming and its completeness, array filters, `\/` escaping, `filter-too-large` before spawn, the widened redactor, a throwing handler. |
| `test/tagging-edges-state-routes.test.js` (amended) | unit | +1 (ST23) | C20: `lockHeld` compares inodes. |
| `test/tagging-edges-wiring.test.js` (amended) | static, and the port on a fake driver | +12 | The supervisord block, pgrep-safe names, no pass machinery in realtime code, `READ_KEYS` read-only, `readAt` / `readKeys`, the routes and their owner gate, both `lockHeld` callers passing `file`, `run.sh`'s shape. Review round 1: SWR72, conform item 1(e) (no default schema-read time-out for the pass). |
| `test/tagging-edge-contract.test.js` | static | S2C9 re-aimed; S2C16 re-aimed (review round 1) | BIBLE §6's status line. S2C16: some Last-updated entry records story 2, whichever is newest. |
| `test/tagging-edges-runner.test.js` (amended) | ports | +2 | Pre-image lines carry `writer: 'pass'`; `resolveIdentities` still exported after the extraction. |
| `test/tagging-edges-live.test.js` (amended, opt-in) | live | +3 | `readAt` / `readKeys` against a real Neo4j (read-only), and a `limit:0` websocket smoke test. Skipped with a note where the stack is not reachable. |

## Edge cases

- **Floods anyone can publish.** Padded 130 KB taggings (RE54, RE58). One author's multi-`d` events at one address
  (RE58). Id-only taggings naming 500 KB elements (RE66). A journal of max-size kind-5 lines (RE58). A kind-5 stream
  during `waiting-graph`. Junk `a` targets under a fresh key (RP15).
- **Races.**
  - A version and its revoke heard in one round (RE19).
  - A version heard after a round's scan spawned (planner shrink tests).
  - A revoke of an old version, then a re-apply during a pass, then a wipe (RE39, RE40; RP71). Round 1's discard rule
    (RP47, RP76, RP77) is deleted under A1-5; the gate's clauses now decide it.
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
- **Amendment A1.**
  - *Stale by-id deletions.* A deletion of v1 drained while the round that writes v2 is in its scan, element read or
    write. The same deletion held in a catch-up's unfed backlog behind 6,500 arrivals, or arriving after v2 was heard,
    with and without a pass writing v2. A revoke that goes stale while it waits. (RL1–RL4, RL22; RF2–RF7.)
  - *Lost and late notices.* A notice held so that a read falls between a store and its delivery (RL6, RF8). A notice
    lost to a dropped connection, or to strfry's delete-hides-next-write (RL15). A reconnect gap with an empty read
    before the catch-up (RL5, RF10).
  - *The census.* It records a backfilled version (RL12). It is placed under the scan at an address a restored lineage
    holds (RL13), and joins no `older` there (RL25). It is hung, late, or failing (RE7, RL14).
  - *Floods at one address.* 30 versions heard (RL16), and twelve each revoked by id with the graph down (RF18): `older`
    and an entry's by-e revokes stop at 8.
  - *Time-outs and stalls.* One never-answering address among 200 (RX2), three at once (RX3), a 2-minute Redis-style
    stall (RX4), a live group timing out beside a padded share (RX5), and an address that keeps changing while its
    reads never answer (RX15).
  - *Journal faults.* A torn append in the first start's drain, and every prefix of random journals (RX7). A journal
    that cannot be opened (RX8). A read that throws EIO part-way (RX9). A truncation that fails after a re-baseline,
    with a crash then or later (RX10).
  - *A padded catch-up.* 2,400 addresses of about 50 KB, 300 ms per strfry process, beside a live tagging every 3 s
    (RX6). Id-only arrivals with 40 KB elements beside 130 KB live versions (RE80).
- **Review round 1.**
  - *Time-out parks.* A lone change through a 3-minute total stall (RX20). An unmarked never-answering address beside
    answering traffic (RX21). A live revoke at a time-out park, the address still never answering or answering again
    (RX22). An id-only tagging whose element never answers (RX23).
  - *Refusal parks and catch-ups.* A refusal park across a safety diff, with a newer version whose notice was lost
    (RX24). A key-read row the engine cannot read (RX25). A version learned and written between a catch-up's key read
    and its capture, the address's one read after the capture failing (RL28).
  - *The websocket.* A relay that never pongs, refuses the upgrade, never completes the handshake, terminates or
    closes the socket, or sends NOTICE, CLOSED, other subscriptions' messages and stray frames (RSUB1–RSUB8).

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

### Amendment A1 (2026-09-29)

- **Registration: still to do.** The three new suites are not yet in `test/registry.js`. Until they are,
  `stack-free-npm-test`'s G5 fails, and it names exactly these three files (checked on 2026-09-29: 6 pass, 1 fail).
  The Test Design commit adds three plain entries after `tagging-edges-realtime-wrapper.test.js`:
  - `tagging-edges-realtime-lineage.test.js`;
  - `tagging-edges-realtime-resilience.test.js`;
  - `tagging-edges-realtime-property.test.js`. The gate runs its default part. The opt-in campaign (RF29–RF36) counts
    as 8 visible skips, with the reason `TAGGING_EDGES_PROPERTY=1`. A1-20 asks for the fuzzer outside the default
    gate; the suite meets that by gating only its fuller campaign.
- **Fakes** (`test/helpers/taggingEdgesRealtimeFakes.js`, extended; its header documents each control). A round-1
  test sees none of these unless it sets them, except the first.
  - *A1-18's settlement.* A scan that fails `timeout` costs its `timeoutMs` of fake time (`relay.timeoutsCostTime`,
    true by default). Every round-1 test passes either way.
  - *Scans.* `relay.neverAnswers` (addresses or element ids whose scans time out), `relay.stallUntil` (a Redis-style
    stall), `relay.latencyMs` as the per-strfry-process cost, and `relay.scanWaits`. With `scanWaits`, a scan's cost
    is waited on the fake clock, so ticks and deliveries interleave with it. Each scan call records `timeoutMs`,
    `maxBytes`, `cost`, `hang` and `stalledMs`. `scanAddresses()` / `scanIds()` name what a scan asked for.
  - *Live notices.* `relay.holdNotices` / `releaseNotices()` (a late notice), `relay.loseNotice` (a notice never
    sent), and `relay.deleteHidesNextWrite` (ledger row `2026-09-29-strfry-delete-hides-next-write`).
  - *The graph.* `graph.readDelay(op, {proc, nth, at})`: a read that answers late or never. `readKeys` with `nth` 1
    is a baseline start's census.
  - *The journal.* `store.tearAppend` (a crash mid-append), `store.journalReadFailsAfter` (a streamed read that
    throws EIO part-way), and `store.truncateFails` / `crashOnTruncateFail`. Inspectors: `journalLines()`,
    `journalEntries()`, `epochLines()`, `recordEpoch()`, `recordLog`, `faultLog`.
  - *Driving.* A process killed while `start()` or `tick()` is in flight ends that call and `drive()` with
    `{ killed: true }`; a killed process is never ticked again.
- **Property fixtures.** `test/fixtures/tagging-edges-realtime-property/*.json`: the shrunk traces of review rounds 1
  and 2 and of A1's own campaigns, plus a hand-written flood. Each names its origin, what it documents, and the
  verdicts A1 allows; RF19 checks that every file is replayed by a test. The fuzzer takes its randomness from a seeded
  mulberry32 and its time from the fake clock only, so a seed replays exactly (RF20).
- **Planner containers A1-17 left open.** The planner suite fixes these (see the questions below):
  - `pruneLineage`'s `graphKeys`: a Map from address to eventId;
  - `keep`: a Set of addresses;
  - `learnedAfter`: a Map from address to a Set of ids;
  - `scannedIds`: a Set.

  It reads a lineage through `lineageValue` (`{top, older: [ids]}`) and compares `older` as a set.
- **Review round 1 (2026-09-29).**
  - *Registration.* `test/registry.js` gains `tagging-edges-realtime-subscription.test.js` after the other realtime
    suites. `stack-free-npm-test`'s G5 passes with it (7/7).
  - *The fakes.* The graph port's `readSchema(opts)` logs the `timeoutMs` it is given, as `readAt`, `readKeys` and
    `readAll` already do (RE81 reads it). No other test sees a change.
  - *The new suite's relay* is a `ws` `WebSocketServer` on 127.0.0.1, port 0, in the test's own process. `autoPong:
    false` makes a relay that never answers a ping. A refused connection uses a port nothing listens on, an HTTP
    server that answers the upgrade with 503, or a TCP server that never answers. Every server, client and socket is
    closed in `finally`, so the suite's process exits by itself.
  - *Two conventions the new engine-level tests share.* A test that needs the 10-minute safety diff first waits for
    the first start's own catch-up to complete, and counts from its start (RX24, RX25). A test that injects an
    unexpected error wraps the fake graph port's `readKeys` for that world alone (RX25).
- **The scratch reference is not durable.** The A1 reference the suites were validated against lives only in the
  session scratchpad (`amend/ref-a1`, from the ADR's `amend/d2/wt` prototype). It was never committed and is on no
  branch. The Implementer works from the ADR and these tests.

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

### Amendment A1 (2026-09-29)

A1-20 lists the test impact. It is applied as follows. Every re-aimed test keeps its id; its title now states the A1
behaviour and cites the A1 item.

**Planner suite** (79 → 93): 30 re-aimed, one edited, 3 deleted, 17 new.

| Tests | Change | A1 item |
|---|---|---|
| RP2, RP3 | Exports: `LIMITS` and 32 functions, with the six lineage functions in and `discardSupersededRevokes` out. The lib index re-exports them and no dropped name. | A1-17 T2; A1-5 |
| RP8 | `newMaps()` → `{S, B, R, L}` with no H. `recordId`'s `which` is `'S' \| 'R'` and never touches L. L values are `{top, older: Set \| null}`. | A1-1; A1-17 T3 |
| RP14, RP16, RP19, RP20, RP22, RP72 | An `e` target resolves only as its address's top: an `S`-only id, an `older` id or a census id resolves nothing. Foreign counts only targets that resolve. | A1-3; A1-17 T6 |
| RP15 | An `a` target resolves through a lineage (a census lineage included), `S` or the graph's keys. | A1-3; A1-8 |
| RP23, RP24 | `shrinkOnRead` touches `S`, `R` and `B` only. An empty read changes no lineage, and a late deletion of the top still resolves. | A1-2; A1-17 T7 |
| RP25 | `compact(maps, scannedIds, captureSeq)`, which leaves the lineage alone. | A1-7; A1-17 T8 |
| RP26 | Arrivals: a top learned but not completed is an arrival. | A1-1; T9 |
| RP30, RP70 | Rule 2 names lineage tops, never `older` or `S`-only ids. A dropped-over-cap version that is still the top is found and removed through clause (ii). | A1-9; A1-17 T10; A1-4 |
| RP58 | Twelve line types (absolute `v`, `o`, `e`). This is an edit; it passes before and after, because `journalLine` is plain JSON. | A1-6 |
| RP59–RP63 | Replay from no record takes absolute `v` and `o` lines. `x` drops ids from `S`, `R` and `B` only. `c` answers only its version prompt and keeps every revoke. Bad lines are skipped and counted. The record's lineage rows and the top index are restored. | A1-6; A1-5; A1-17 T19 |
| RP64, RP69, RP75, RP78, RP79 | Built through `learnVersion` rather than H. RP75 also restores parked rows with `entry`, and RP78 counts a parked row's entry among `pending`'s entries. | A1-17 T3, T19; A1-12 |
| RP67, RP68 | The gate's clauses: a version and its id-only revoke in one round remove through clause (ii). A read placed under a later learning teaches nothing. | A1-2; A1-3; A1-4; decisions 2, 11 |
| RP71 | The control flips: a kept `e:v1` cannot remove a pass-written v2, and `e:v2` would. | A1-4; A1-5 |
| RP53 | Re-aimed. The pass-overlap ties overlap: a pass that ended exactly at the graph read, or was first seen dead exactly then, overlaps; one that started exactly at the commit still does not. Two rows added, 1 ms before the graph read on each side. It passed on the round-1 tree before; it is now red there (the strict ties). | A1 clarification 13 (amends T25) |
| RP47, RP76, RP77 | **Deleted.** `discardSupersededRevokes` and replay's `v`-line discard are gone. RP96 inverts RP76: replay carries prompts unchanged, and the gate holds the stale revoke. | A1-5; A1-17 T15, T33 |
| RP80–RP96 | **New.** The lineage functions (RP80–RP84). `pruneLineage`: its drop conditions, what it keeps after the capture, the cut, and `keepOlder` (RP85–RP88). The entry cap (RP89). Resolution as versions are learned (RP90). The gate's clauses and the non-id `eventId` (RP91). Absolute lines and prefixes (RP92). The epoch (RP93). Malformed `v` / `o` lines (RP94). Parked entries (RP95). No discard at replay (RP96). | A1-1…A1-8, A1-12, A1-17 |

**Engine suite** (79 → 80).

| Test | Change | A1 item |
|---|---|---|
| RE7 | Re-aimed. A first start's only graph contact before `started.json` is the census: one `readKeys`, no retry, no schema check, before the REQ. It holds the REQ at most 10 s when the graph is down, the key read never answers, or it answers after 15 s. Then the start proceeds. The old title was "no graph contact before started.json". | A1-8; A1-10 step 1; A1-17 T20, T29 |
| RE8 | Re-aimed. The first start's own catch-up brings a relationship the backfill left behind up to the relay's version within 60 s, and creates nothing in `B`. The original look assertion had become vacuous. | A1-10 step 4 |
| RE18, RE19 | Retitled only; the assertions are unchanged. The newer version is the top when the kind-5 drains. The kind-5 names the top, and clause (ii) removes. | A1-3; A1-4; A1-5 |
| RE38 | Adds: the final status after a stop says `subscription.connected: false` (all four cases). | A1-18 |
| RE54 | Retitled, with one fixture check: no catch-up runs during the burst, so the 8 MiB cap is checked for live scans only. | A1-14 |
| RE58 | Case (c)'s hand-written journal line takes the absolute shape `{t:'v', id, a, top, older}`. The removal then comes from rule 2 and clause (ii). | A1-6; A1-9; A1-4 |
| RE67 | The share keeps at most 3.2 MiB before a round's first live address. Each share scan passes `maxBytes` ≤ what is left of the fifth. | A1-14 |
| RE79 | `heard` counts addresses whose top is not in `S`. Two addresses, one heard in two versions, give 2. | A1-1; A1-17 T29 |
| RE80 | **New.** The share's element reads are bounded by the share's bytes too. | A1-14 |

**Unchanged.** The routes, wrapper, scanner, state-routes, wiring, contract, runner and sweep suites are unchanged by
A1. They are green on both the round-1 working tree and the reference: 52, 22, 40, 55, 71, 97, 77 and 55. The
contract's S2C9 now passes, because the working tree's BIBLE §6 already carries the Implementer's status line.

### Review round 1 (2026-09-29)

Every earlier test keeps its id and its outcome, except S2C16. Per suite, before → after:

| Suite | Change | Before | After |
|---|---|---|---|
| engine | RE81 new (conform 1(e)) | 80 | 81 |
| lineage | RL28 new (clarification 23) | 27 | 28 |
| resilience | RX20–RX25 new (clarifications 20–22, conform 1(f), Blocking 2) | 19 | 25 |
| wiring | SWR72 new (conform 1(e)) | 71 | 72 |
| contract | S2C16 re-aimed | 97 | 97 |
| subscription | new suite, RSUB1–RSUB8 | — | 8 |
| `test/helpers/taggingEdgesRealtimeFakes.js` | `readSchema(opts)` logs `timeoutMs` | — | — |
| `test/registry.js` | the subscription suite registered | — | — |

**S2C16, re-aimed** (ledger row `2026-09-29-newest-entry-doc-tests-go-stale`; review harness friction 1). It asked
that BIBLE's newest Last-updated entry (before the first `; prior:`) name tagging-edges #2. So story 3's entry had to
mention #2 to keep it green. It now asks that some entry, whichever it is, end in the house form "— tagging-edges #2 /
ADR 0002". It passes now, and fails on a line where no entry does (checked in scratch). The Tester guidance the ledger
row also names (`engineering-team/workflows/3-test-design.md`: write "an entry records X") is outside the Tester's
files here, and is left to that row.

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

### Amendment A1 (2026-09-29): questions for the Architect and the owner

A1-17 fixes the interfaces. The A1 pass leaves these readings open, or pins one reading of them. None blocks the red
phase. Each needs a ruling (an A1 clarification) before the Implementer relies on the reading.

*From the validation's mutation pass:*
1. **The order of a round's marked singles (M77).** A1-13 bounds the delay at "two time-outs plus a round", but no
   rule fixes the order in which a round reads its marked singles. The reference reads first the singles with fewer
   time-outs of their own. With the reverse order (mutant M77), every suite passes. Yet a slow single due beside newly
   marked co-members then goes first each round and defers them until it is parked, which breaks the bound. Should
   A1-13 state the order, or does the bound hold only for A1-20's scenarios?
2. **`dbRefused` and time-out parks (M40).** A1-13 parks a timing-out address "like a refused write". The reference
   counts it in `failedReads.relay` but not in `dbRefused`. Counting it in `dbRefused` too (mutant M40) passes every
   suite. Should `counts.dbRefused` include time-out parks (byReason `timeout`)?
3. **A new version while the round that parks its address is in flight** (RX15's reference fix). Is it "a new event at
   that address", retried at once with the park's level and the mark? Or does the park absorb it? RX15 pins only that
   the mark survives.
4. **`pruneLineage` and `learnedAfter` (RP86).** RP86 reads A1-7's fourth drop condition as a `pruneLineage` input:
   a lineage where `learnedAfter` names ids is never dropped. Under that reading, the engine's own keep for learned
   addresses is redundant. RL27 pins the engine-level outcome under either reading. Please confirm.
5. **A1-13 at a stall's last round** (raised by the reference builder). "If another scan in the same round answered …
   marked" conflicts with "So after a Redis stall the addresses come back in their usual groups" when a group times out
   just before the relay comes back. The reference counts only answers before the group's own time-out. The cost is
   that a group first in its round waits three time-outs, not two. RX4 pins the stall outcome, "the addresses come
   back in their usual groups".

*From the suites:*
6. **Container types.** The planner suite fixes `pruneLineage`'s `keep` as a Set of addresses, `learnedAfter` as a Map
   from address to Set of ids, `graphKeys` as a Map and `scannedIds` as a Set. Please ratify these.
7. **Shapes the suite leaves open.** `lineageAt`'s `older` may be a Set, an array or null; `lineageValue` must return an
   array copy. `droppedAddresses` may be a count or a list. `learnVersion`'s options argument may be omitted.
8. **RP83 and a re-learned id at the cap.** A re-learned id comes back while `older` holds 8. Does it leave `older`
   before the old top joins, so nothing drops, or after, so the oldest drops? RP83 pins only what holds under both
   orders.
9. **RP91: a string `eventId` that is not an id.** A1-4 says "missing or not a string", and decision 2 says "missing or
   not an id". RP91 pins decision 2's reading: a non-hex or upper-case-hex `eventId` satisfies neither clause, even
   when that string sits in `older`.
10. **RP93: the epoch.** When `record.json` has an epoch and no `e` line matches it, no journal line applies; RP93 pins
    that. Two points are open: whether other generations' lines count toward `skippedLines`, and how a pre-A1 record
    with no epoch replays.
11. **A1-5's "most recently merged".** RP89 counts a re-merge with a newer `created_at` as recent. A re-merge with an
    older `created_at` is open. RL16 asserts only distinct revokes, each merged once.

### Review round 1 (2026-09-29): readings the new tests choose

None needs a ruling before the Implementer's round-1 fixes; each is the review's asked change, read narrowly.
1. **RX25, Blocking 2.** The test takes the review's first option: the catch-up ends `failed`, then backs off 5 to 60 s
   before its next key read. Routing the error to `crash()`, the second option, would fail it. It asserts that
   `lastError` is set with some stage, and does not fix which stage (`catch-up` or `unexpected`).
2. **RX24, conform 1(f).** "Retried at its timer" is read as a write attempt 5 minutes after the park (−5 s / +15 s).
   The park's other exits (a start, a new event there, the next successful write) are not exercised: the test keeps
   the world quiet so that only the timer can lift it.
3. **RE81, conform 1(e).** Any finite, positive `timeoutMs` passes; the value is the Implementer's. SWR72's part (d)
   fixes the port's side: `readSchema({ timeoutMs })` runs both SHOW statements with it.
4. **RSUB1–RSUB8.** The five close reasons are `subscription.js`'s documented fixed texts, pinned exactly. The ADR
   fixes only that they carry nothing of the relay's text (AC-6). A rewording of one fails its test. The suite never
   reads the exports the review calls unused (non-blocking 9).

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

## Validation of the A1 pass (2026-09-29)

- **The reference realisation.** `amend/ref-a1` is a scratch worktree in the session scratchpad. It is the ADR's A1
  prototype (`amend/d2/wt`) completed by a Test Design reference builder with the rules A1-21 lists as not
  prototyped:
  - A1-13: the stall-or-slow test, the regroup, one single time-out per round, and parking after three;
  - A1-6: the epoch, the demotion at `journal-unreadable`, and the compaction cadence;
  - A1-7: the pass rule, judged from a report read taken with the catch-up's key read;
  - A1-18: the final status.

  The builder checked these with its own probes (9/9) before the suites ran. **The reference is not durable. It was
  never committed and is on no branch.** It is not the implementation; it exists only to show that the suites pin
  nothing beyond A1.
- **How the suites were checked.** The main checkout's `test/helpers/*.js`, the five A1 suites and the property
  fixtures were copied into the reference's `test/`. Each suite then ran in its own process through its `run()`
  export, on Node 22.23.3 x64 and on Node 16.17.0.
- **The writers' self-checks.** Each suite's writer ran their suite against the reference, with their own mutants.
  RL22 comes from the lineage writer's pass: it was the only test to catch "clause (ii) accepts an older target".
- **Two reference bugs, found by the tests and fixed in scratch.** In both cases the reference diverged from the A1
  text. The tests were not bent to it.
  - *RP86.* A1-7 drops a lineage only when "nothing was learned there after the scan's capture". A1-17 gives
    `pruneLineage` that input as `learnedAfter`. The reference's pure `pruneLineage` ignored it for the drop, and only
    its engine compensated. Scratch fix: a lineage whose address `learnedAfter` names is never dropped.
  - *RX15.* A1-13: "The mark stays until its own read succeeds". A1-18: "The item's read-alone mark survives
    put-backs". The fault: a marked, never-answering address received a new version while its read-alone scan was in
    flight, and that scan's time-out parked it. The reference's park left the fresh pending item unmarked. The next
    round read the address in a usual group of 8, which timed out twice. 13 of 100 other authors' taggings were then
    reflected 64–79 s after their store, which misses AC-1's minute. Scratch fix: a fresh item waiting at a parked
    address is unparked at once, with the park's level and the mark (question 3 above).
- **Aligned to the A1 clarifications, in scratch.** ADR 0003's A1 clarifications 11–13 settle questions 1–3 above.
  The reference was changed in two places:
  - *Clarification 13.* `passOverlaps` counts the graph-read ties as overlapping (`endedAt >= graphReadAt`,
    `graphReadAt <= deadSeenAt`). `startedAt < commitAt` stays strict.
  - *Clarification 12, the catch-up.* A catch-up's arrival, look or found revoke at a time-out-parked address merges
    into the parked entry, and does not lift the park. Before, every catch-up lifted it, so a never-answering address
    cost one 20 s time-out at each safety diff.

  The rest was already the reference's behaviour: the order of the marked singles (clarification 11), the counts
  (clarification 12), and clarification 12's live-delivery rule, which is the RX15 fix. In the reference a catch-up
  feeds its backlog only between activities. So no catch-up item waits at an address while the round that parks it
  holds it.
- **Green on the reference** (after both fixes and the alignment): 716 pass, 0 fail, 8 skipped, across the thirteen
  story suites:

  | Suite | Result |
  |---|---|
  | plan | 93/0 |
  | engine | 80/0 |
  | lineage | 27/0 |
  | resilience | 19/0 |
  | property | 28/0, with 8 opt-in skips. With `TAGGING_EDGES_PROPERTY=1`: 36/0/0 (the campaign, about 50–55 s). |
  | routes | 52/0 |
  | wrapper | 22/0 |
  | strfry-scan-strict | 40/0 |
  | state-routes | 55/0 |
  | wiring | 71/0 |
  | contract | 97/0 |
  | runner | 77/0 |
  | sweep | 55/0 |

  The five A1 suites give the same results on Node 16.17.0.
- **The mutation pass.** The validating Tester made 79 single-behaviour mutants of the reference (the base being the
  reference with the RP86 fix) and ran them in three rounds. A fourth round followed the A1 clarifications.
  - Round 1: 67 mutants, 10 survivors.
  - Each survivor got a test, and each test was proven to kill its mutant while passing on the reference: RL23–RL27,
    RE80 and RX15. RX15 also found the park bug above.
  - Round 2 added 10 more mutants, and round 3 two more (M81, and M82 = M48 + M81). That left 76 of 79 killed, with
    M40 and M77 surviving where A1 left the behaviour open (questions 1 and 2 above).
  - Round 4 came after the A1 clarifications, on the aligned reference. It added eight mutants: M83a and M83b (the
    pass-overlap ties strict again), M83c (a pass that started at the commit overlaps), M84 (a catch-up lifts a
    time-out park), M85 (a new version delivered while the round that parks its address holds it is absorbed by the
    park), M87 (a catch-up's entry at a time-out park is dropped), M88 (a single time-out is not counted in
    `failedReads.relay`) and M89 (`parked` leaves out time-out parks). RP53 was re-aimed and RX16–RX19 added. Each
    new test was proven to kill its mutant while passing on the reference: M40 by RX17, M77 by RX18, M83a–c by RP53,
    M84 by RX16 and RX19, M85 by RX19, M87 by RX16, M88 by RX17 and RE22, and M89 by RX3 and RX15–RX17.
  - All 87 mutants were then re-run on the aligned reference, each suite in its own Node 22 process.
  - Final: **86 of 87 killed.**
  - Survivor: M48, which is equivalent under the RP86 fix. The engine's keep for learned addresses is redundant once
    `pruneLineage` guards on `learnedAfter`.

  | A1 rule | Mutants (what each breaks) | Killed by |
  |---|---|---|
  | A1-3 resolution | M01a an `older` id resolves; M01b an `S` id resolves (round 1's S ∪ H) | RP14, RP19, RP20, RP63, RP68, RP82, RP90; RL3 |
  | A1-4 the gate | M02 clause (ii) in any order; M03 any by-e revoke passes (T16 before A1); M04 clause (ii) deleted; M04b a non-hex `eventId` passes; M32 the gate's copy taken after this round's read is learned | RP67, RP68, RP70, RP71, RP81, RP83, RP91, RP96; RE19, RE33, RE58; RL2, RL4–RL8, RL12, RL13, RL15, RL22, **RL23**, RL25; RF8, RF21 |
  | A1-2 learning | M05 / M05b an empty read drops the lineage or its `older`; M06a / M06b a read placed under a later learning still teaches (planner, engine); M07a / M07b / M07c the graph's version never joins (anywhere, beside a round's read, beside a catch-up scan); M27 catch-up arrivals not learned; M33 the capture taken after the scan answers | RP24, RP68, RP81, RP90; RL5–RL8, RL13, RL15, **RL24**; RX11; RF8 |
  | A1-8, A1-10 census and first start | M08 no census; M09 no placement under the scan; M52 the census joins at held addresses; M37 no engine deadline; M70 a 20 s deadline; M55 the census retried; M31 no first-start catch-up; M65 the buffer learned after the scan | RE7, RE8; RL9, RL12–RL14, **RL25**; RX7; RF9, RF12, RF27, RF28 |
  | A1-5, A1-7 caps | M10 / M11 no cap on `older` / on by-e revokes; M54 / M53 the cap drops the newest | RP83, RP89; RL16; RF18 |
  | A1-7 compaction | M12 no cut; M13 no drop; M50 `keep` ignored; M49 the cut ignores `learnedAfter`; M81 the drop ignores `learnedAfter`; M82 neither guard; M14a / b / c the pass exception off, blind to a run alive at the key read, or always on; (M48 equivalent) | RP85–RP88; **RL26**, **RL27**; RX13 |
  | A1-6 record and journal | M15a relative replay; M15b relative `v` lines written; M46 no `o` lines; M16 the epoch ignored; M67 the epoch reused; M17 no demotion; M44 / M43 a part-way read drops its prefix / is not reported; M36 `c` discards revokes; M23 compaction at 1 MB whatever the record | RP61, RP92, RP93, RP95; RE33; RL16, RL21, RL24, RL25; RX1, RX7–RX13 |
  | A1-9, A1-12 catch-up and parking | M24 found revokes not journaled; M25 the unfed backlog left out of `pending`; M26a / M26b parked entries not written / not replayed; M34 no rule 2; M60 rule 2 names every top | RP30, RP70, RP75, RP78, RP95; RE33, RE58; RL5, RL10, RL11, RL15, RL16, RL21, RL25 |
  | A1-11 | M28 round 1's start hold | RX1 |
  | A1-14 the share | M18a share bisected; M18b share address scans at 8 MiB; M18c share element reads at 8 MiB; M74 no first-address-alone; M75 heavy ids before live | RE67, **RE80**; RX5, RX6 |
  | A1-13 time-outs | M19 marked singles after lane 4; M20a always mark; M20b never mark; M20c a stall-guard trip still marks; M20d group time-outs bisected; M20e mark without the regroup; M21 no one-single-per-round limit; M22a / M22b no parking / parking after 4; M39 / M39b the mark lost under a fresh item / at an unpark; M41 a write unparks time-out parks; M76 no stall guard; M80 a park leaves a fresh item unmarked | RE22; RX2–RX5, **RX15**, RX16–RX19 |
  | A1 clarification 11, the singles' order | M77 marked singles with the most time-outs of their own first | RX18 |
  | A1 clarification 12, time-out parks | M40 a time-out park counted in `dbRefused`; M88 a single time-out not in `failedReads.relay`; M89 `parked` leaves out time-out parks; M84 a catch-up lifts a time-out park; M87 a catch-up's entry at one dropped; M85 a new version delivered during the parking round absorbed by the park | RE22; RX3, RX15, RX16, RX17, RX19 |
  | A1 clarification 13, pass-overlap ties | M83a / M83b the ties strict (T25 before the clarification); M83c a start at the commit overlaps | RP53 |
  | A1-1, A1-18 status | M29 `lastReflectedAt` moves on a held decision; M30 connected after a stop; M42 `heard` counts every lineage | RE38, RE79; RL17; RX11, RX14 |

  Tests in bold were added by this pass. RX16–RX19 and RP53's re-aim came from the A1 clarifications (round 4).

## How to run

```
npm test
```

A single suite runs through its `run()` export, for example
`node -e "require('./test/tagging-edges-realtime-engine.test.js').run()"`, or directly with
`node test/tagging-edges-realtime-engine.test.js`. The wrapper suite needs `bash`; the live suite needs `NEO4J_URI` /
`NEO4J_USER` / `NEO4J_PASSWORD`. A full run's result is read from its record (`npm run gate:status`).

The A1 suites run the same way, each in its own process:

```
node -e "require('./test/tagging-edges-realtime-lineage.test.js').run()"
node -e "require('./test/tagging-edges-realtime-resilience.test.js').run()"
node -e "require('./test/tagging-edges-realtime-property.test.js').run()"
TAGGING_EDGES_PROPERTY=1 node -e "require('./test/tagging-edges-realtime-property.test.js').run()"
```

The last line adds the fuller campaign (RF29–RF36, 8 modes × 20 seeds × 150 steps, about 55 s here). A failing
property run prints its seed and mode, so it replays exactly. Node 22 is CI parity; these suites give the same results
on the host's Node 16.17.0.

The review round 1 suite runs the same way, in about 3 s of real time, on the loopback only:

```
node -e "require('./test/tagging-edges-realtime-subscription.test.js').run()"
```

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

**Red phase for Amendment A1.** Run on 2026-09-29 on the round-1 working tree: branch `feat/tagging-edges-3` at
`3fc9b9ff`, with the uncommitted round-1 implementation (T1–T34 without A1) and this pass's test changes. Each suite
ran in its own process through its `run()` export, on Node 22.23.3 x64. Node 16.17.0 gives the same counts. The
counts below are the re-run after the A1 clarifications pass (RP53 re-aimed, RX16–RX19 added): all thirteen suites on
Node 22.23.3; the planner and resilience suites also on Node 16.17.0, with the same counts.

```
tagging-edges-realtime-plan        pass 46 fail 47          — A1 exports missing; pre-A1 maps and replay; RP53; RP89; RP91
tagging-edges-realtime-engine      pass 74 fail 6           — RE7, RE8, RE38, RE67, RE79, RE80
tagging-edges-realtime-lineage     pass 5  fail 22          — RL1–RL17, RL23–RL27
tagging-edges-realtime-resilience  pass 0  fail 19          — RX1–RX19
tagging-edges-realtime-property    pass 15 fail 13 skip 8   — RF2–RF11, RF18, RF27, RF28 (opt-in: 20 / 16)
tagging-edges-realtime-routes      pass 52 fail 0
tagging-edges-realtime-wrapper     pass 22 fail 0
strfry-scan-strict                 pass 40 fail 0
tagging-edges-state-routes         pass 55 fail 0
tagging-edges-wiring               pass 71 fail 0
tagging-edge-contract              pass 97 fail 0
tagging-edges-runner               pass 77 fail 0
tagging-edges-sweep                pass 55 fail 0
stack-free-npm-test                pass 6  fail 1           — G5: the three new suites are not yet registered
```

Across the thirteen story suites: 609 pass, 107 fail, 8 skipped. With `TAGGING_EDGES_PROPERTY=1` the property suite
gives 20 pass, 16 fail: the campaign adds RF32, RF33 and RF35. G5 turns green once the three suites are registered
(§ Test infrastructure). Every failure is an A1 assertion, or the pre-A1
behaviour A1 forbids. None is an import error or a typo; every failing test's message was checked.

- **Planner.** Four kinds of failure:
  - A missing A1 export ("does not export learnVersion() / lineageValue() / pruneLineage() yet"): RP8, RP14–RP16,
    RP19, RP20, RP22–RP26, RP30, RP67–RP72, RP80–RP88, RP90, RP96.
  - The pre-A1 maps `{S, H, B, R}` with no L: RP59–RP64, RP75, RP78, RP79, RP92–RP95. Their deeper checks are pre-A1
    too: a `v` or `c` line discards revokes, parked entries are ignored, there is no epoch, and relative `v` lines are
    accepted.
  - Pre-A1 behaviour: RP89 keeps 9 by-e revokes, and in RP91 a by-e revoke acts whatever it names (10 of 17 cases).
  - Exports: RP2 and RP3 (six exports missing, `discardSupersededRevokes` still exported).
  - RP53 (A1 clarification 13): the strict ties — a pass that ended exactly at the graph read, or was first seen dead
    exactly then, does not overlap (2 of 17 cases).
- **Engine.**
  - RE7: no census; the graph port sees no `readKeys` before `started.json`, in all 3 cases.
  - RE8: no start catch-up, so P5 is not brought up within 60 s.
  - RE38: `subscription.connected` is still true after the exit (4 cases).
  - RE67 and RE80: the share's scans pass `maxBytes` 8 MiB, and RE67's share keeps 6.38 MiB before the first live
    address.
  - RE79: `heard` is 3, which counts the ids in H, not the 2 addresses.
- **Lineage.**
  - RL1–RL4: the relationship is removed on a stale by-id deletion.
  - RL5–RL8: the revoke is lost to an empty read or to a discard, so there is no removal within 5 minutes or 60 s.
  - RL9, RL12 and RL14: there is no census and no first-start catch-up. RL14 sees 0 key reads before the REQ, not 1.
  - RL10: the parked row has no entry. RL11: the revoke is lost after the wipe, and there is no unfed-backlog row.
    RL13: there is no lineage row.
  - RL15: an empty read dropped v2 from H, so the stale revoke is never found.
  - RL16: `v` lines are relative, and the entry keeps 1 by-e revoke, not 8. RL17: `lastReflectedAt` moved.
  - RL23: round 1 discards `e:v2` when the read returns R.
  - RL24: the `v` lines carry no top or `older`, there are no `o` lines, and catch-up arrivals are not learned.
  - RL25: after the re-baseline, rule 2 over S ∪ H never finds the deletion.
  - RL26 and RL27: `record.json` has no lineage rows.
- **Resilience.**
  - RX1: the start hold keeps restored work waiting while the catch-up fails.
  - RX2–RX5: timed-out groups are bisected and re-read in their round; RX3's 120 other taggings are never reflected.
  - RX6: rounds keep 4.95 MiB of share before the first live read.
  - RX7 and RX11: replay's maps have no L.
  - RX8, RX12 and RX13: the record has no lineage rows, and compaction runs at 1 MB whatever the record's size.
  - RX9: the part-way read's prefix is not kept. RX10: the record has no epoch. RX14: still connected after a stop.
  - RX15: the marked address is re-read in groups of 2–3.
  - RX16–RX19 (A1 clarifications 11 and 12): round 1 has no read-alone marks and no time-out parks. RX16 and RX17
    never see the never-answering address parked (the status's `parked` stays 0). In RX18 round 1 bisects the
    co-members' timed-out group in its round, each half's time-out costing 20 s, so they are not reflected within 45 s. In RX19 the address, never parked, is read
    again only after its 20 s backoff, not at once.
- **Property.**
  - RF2–RF7: a wrongful by-id removal (I2).
  - RF8–RF11: a revoke left to the pass that A1's verdicts do not allow.
  - RF18: the flood never reaches the caps, because there are no absolute lines and the entry holds 1 revoke.
  - RF27 and RF28: a first-start revoke misses the minute.

**What passes on the round-1 tree, and why.**
- Planner: the 45 unchanged tests, plus RP58. RP58 was edited, but `journalLine` is plain JSON either way. (RP53
  passed here until its A1 clarification 13 re-aim.)
- Engine: 70 unchanged tests, plus RE18, RE19, RE54 and RE58.
  - RE18, RE19 and RE54 are retitles, or a fixture check round 1 also meets.
  - RE58's absolute `v` line removes through H on round 1, and through clause (ii) under A1. So this re-aim does not
    tell the two apart; RP59, RP92 and RX7 carry the absolute-line semantics.
- Lineage: RL18–RL22, behaviour A1 keeps.
  - RL18 is clause (ii)'s intended case, which round 1 resolved through H.
  - RL19–RL21 are decision 11's removals, which the round-1 gate also makes.
  - RL22's stale revoke is discarded on round 1 and inert under A1.
- Property: RF1, RF12–RF17 and RF19–RF26. These are the oracle's self-check, fixtures whose allowed verdicts
  (reflected, or a named corner) round 1 also meets, fixture hygiene, determinism, and the non-healthy modes' three
  seeds, which are safe on round 1.

**Green on the reference:** see § Validation of the A1 pass (712 pass, 0 fail, 8 skipped; the opt-in campaign
36/0/0).

### Review round 1 (2026-09-29)

**Red phase.** Run on branch `feat/tagging-edges-3` at `d9d0ccf8` (the code the review read, with the ADR's
clarifications 20–25) plus this pass's test changes. Each suite ran in its own process through its `run()` export, on
Node 22.23.3 x64. The new and re-aimed tests give the same outcomes on Node 16.17.0.

```
tagging-edges-realtime-plan          pass 93  fail 0
tagging-edges-realtime-engine        pass 80  fail 1          — RE81
tagging-edges-realtime-lineage       pass 28  fail 0
tagging-edges-realtime-resilience    pass 23  fail 2          — RX24, RX25
tagging-edges-realtime-property      pass 28  fail 0  skip 8
tagging-edges-realtime-routes        pass 52  fail 0
tagging-edges-realtime-wrapper       pass 22  fail 0
tagging-edges-realtime-subscription  pass 8   fail 0
tagging-edge-contract                pass 97  fail 0
tagging-edges-wiring                 pass 71  fail 1          — SWR72
tagging-edges-runner                 pass 77  fail 0
stack-free-npm-test                  pass 7   fail 0
harness-lint                         pass 76  fail 0
```

Four tests are red, each on the behaviour the review asks to change. None is an import error:
- **SWR72** (conform 1(e), the port). `readSchema()` runs both SHOW statements with a 30 s transaction time-out. So do
  `ensureTagsConstraint`'s four reads and all eight of a real pass's schema reads: six in its pre-flight, two in its
  conflict re-read. Its part (d), `readSchema({ timeoutMs: 7000 })`, already passes.
- **RE81** (conform 1(e), the path). All 4 of the path's `readSchema` calls pass no `timeoutMs`.
- **RX24** (conform 1(f)). The safety diff's catch-up re-queues the refusal-parked address, and its round attempts a
  write 174.5 s after the park, before the 5-minute timer.
- **RX25** (Blocking 2). The catch-up that met the unexpected error never ends. `catchUp.last` stays the earlier
  `done`, and the status says `catching-up`, with `lastError` stage `unexpected`.

Every other test passes, the five new pins of clarifications 20–23 and the eight subscription tests included, as the
review's reading of the code predicts.

**Validation, in scratch** (`r1fix/tester/mut` in the session scratchpad; never committed, not durable).
- *A conform realisation.* A copy of the tree took four small edits:
  - `readSchema` keeps no default, passing a time-out only when given one;
  - the path calls `readSchema({ timeoutMs: 30 s })`;
  - `feedCatchUp` merges a catch-up's work into any parked entry, not only a time-out park;
  - `catchUpStep` catches a step's unexpected error and calls `failCatchUp(c, 'unexpected', err)`.

  All thirteen suites above were green on it: 93, 81, 28, 25, 28 (+8 skipped), 52, 22, 8, 97, 72, 77, 7 and 76. The
  opt-in property campaign gave 36/0/0. So the four red tests ask for nothing beyond the review's fixes, and no
  earlier test depends on the behaviour they change.
- *A mutation pass over the passing pins.* Sixteen single-behaviour mutants of the current code, each killed by the
  test named:

  | Mutant | Killed by |
  |---|---|
  | every single time-out counts toward the park (A1-13's literal rule) | RX20 (the status shows the lone change parked) |
  | only a marked address's time-outs count | RX21 (never parked), RX23 |
  | a live revoke does not lift a time-out park | RX22 (the address joins the others' group, unmarked), both cases |
  | an element single's time-out counts in `failedReads.relay` | RX23 |
  | the compaction keeps only what was learned after the capture | RL28 (`older` loses v2) |
  | the REQ keeps a caller's `limit` | RSUB1 |
  | any subscription id is taken | RSUB3 |
  | a NOTICE reports the relay's own text | RSUB4 |
  | no pings / no pong time-out | RSUB5 (each) |
  | a dropped connection reported as refused | RSUB6 |
  | EOSE reported twice | RSUB2 |
  | `close()` sends no CLOSE / fires `onClose` | RSUB7 (each) |
  | a refused URL reported from inside `subscribe()` | RSUB8 |
  | BIBLE's line records story 2 in no entry | S2C16 |

## Test index

Rows are the tests' titles, cut at about 150 characters. The A1 pass rewrote the rows of the re-aimed and retitled
tests, deleted RP47, RP76 and RP77 (their ids are not reused), and added RP80–RP96, RE80 and the lineage,
resilience and property suites. The A1 clarifications pass re-aimed RP53 and added RX16–RX19. Review round 1 added
RE81, RL28, RX20–RX25, SWR72 and the subscription suite (RSUB1–RSUB8), and re-aimed S2C16.

### Pure planner (`src/lib/tagging-edges/realtime.js`) — `test/tagging-edges-realtime-plan.test.js` (93)

| Id | Behaviour |
|---|---|
| RP1 | realtime.js sits in src/lib/tagging-edges/ and is pure CommonJS — it requires only its siblings, uses no clock, timer, randomness, hashing, process… |
| RP2 | realtime.js exports every name T2 lists as A1-17 amends it — LIMITS and the 32 functions, learnVersion, learnOlder, lineageAt, lineageValue, setLin… |
| RP3 | src/lib/tagging-edges/index.js re-exports every realtime.js name, as the same value — the six lineage functions included — and no dropped name (ADR… |
| RP4 | LIMITS holds exactly the Implementation notes' keys and values — the byte values as numbers — and is frozen |
| RP5 | src/lib/strfryScanStrict.js re-exports realtime.js's escapeFilterArgv — the same function — so scanStrict and the planner size filters with the one… |
| RP6 | escapeFilterArgv is JSON.stringify(filter) with every "/" written "\\/" — JSON-equivalent, for a filter or an array of filters — so no argv carries… |
| RP7 | filterArgvBytes is the escaped text's UTF-8 byte length — not its character count, and counting each "\\/" as two bytes |
| RP8 | newMaps() gives fresh, empty { S: Map, B: Set, R: Map, L: Map } — no H; recordId(maps, which, id, address, seq) sets one { a, seq } entry in S or R… |
| RP9 | subscriptionFilters gives exactly two live-only filters — stamped kind 39999 with both nostr-user-tag stamps, and kind 5 — each with limit 0 and no… |
| RP10 | when the two identities are equal, the #z list names the stamp once |
| RP11 | subscriptionFilters throws, building nothing, when either identity is one checkIdentity refuses — missing, null, empty, upper-case, 63 hex or not hex |
| RP12 | promptFromVersion gives { address, id } for a kind 39999 carrying either nostr-user-tag stamp — the contract edge's address, or a refusal's address… |
| RP13 | a version printed with upper-case hex — its id, its pubkey or both — yields no prompt: the contract refuses it at step 1 with no address, so prompt… |
| RP14 | a deletion's e target resolves only while it is the top of its address's lineage — the latest version the path learned there, completed (in S) or n… |
| RP15 | a deletion's a target resolves only at an address the path knows — one a lineage holds (a census lineage with no top included), one S records an id… |
| RP16 | an a target counts only up to 255 UTF-8 bytes — an address of exactly 255 bytes resolves, one of 256 (still a tagging address) is ignored even when… |
| RP17 | an a target whose kind is spelled any other way — leading zeros, a plus sign, a space — or that names another kind is no tagging address and resolv… |
| RP18 | a live a target spelling its pubkey in upper-case hex resolves at the lower-case address the path knows, and the by-a prompt's target is that norma… |
| RP19 | another author's kind-5 prompts nothing — each of its targets that resolves to a known tagging of someone else adds 1 to foreign, an e target only… |
| RP20 | prompts are de-duplicated by (address, by, target) — the top named in both cases, an address named in both pubkey spellings — while an e and an a a… |
| RP21 | anything that is not a well-formed kind 5 gives { prompts: [], matchedNothing: true, foreign: 0 }, even when it names a recorded id |
| RP22 | one kind-5 naming its author's top id, an id nobody recorded and another author's top id gives one prompt, foreign 1 and matchedNothing false (T6 a… |
| RP23 | shrinkOnRead drops, from S and R (refusedSeen), the ids recorded at the address at or before the capture, other than the id the read returned, and… |
| RP24 | an empty read (returnedId null) drops the S, R and B ids recorded at the address up to the capture — an entry recorded at the capture itself includ… |
| RP25 | compact(maps, scannedIds, captureSeq) keeps every S and R entry recorded after the scan began; otherwise S and R keep only scanned ids, and B becom… |
| RP26 | an arrival is a scanned id not in S — one never learned (back-dated history arrives the same way) and one learned (its address's top) but not yet c… |
| RP27 | a look-only prompt goes to (i) an address where the graph records another event id, or (ii) an address the graph does not hold whose scanned id is… |
| RP28 | an (id, address) in refusedSeen gets no look-only prompt, under (i) or (ii); without that entry the same scan gives both |
| RP29 | an arrival's address is never also a look-only prompt — not when the graph records another id there, nor in either order of a conflict at one addre… |
| RP30 | deletion candidates are the graph's event ids the scan no longer finds, plus each lineage top the scan no longer finds at an address the graph hold… |
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
| RP48 | a create is held as pre-existing while the relay's version is in the baseline, whatever prompted the look; a version not in it — one stored during… |
| RP49 | a not-on-relay removal acts only with a revoke prompt — a queued version prompt, a look, both, or nothing is held as removal-not-prompted, so a wip… |
| RP50 | a by-a revoke lets a not-on-relay removal act only through revokeApplies on a well-formed stored edge — a deletion as new as the stored createdAt o… |
| RP51 | a non-tagging removal (the relay now holds a refused version there) acts with a version prompt at the address or a valid revoke, and is held otherw… |
| RP52 | an update, a move, a none and a leave always act — never held, not even with the relay's version in the baseline and nothing but a look prompting |
| RP53 | a pass overlaps a round when it started before the round committed and it ended at or after the graph read, is still alive, or is dead with endedAt… |
| RP54 | a dead pass with endedAt null re-looks once — the round whose graph read came before the path first saw it dead overlaps it; the re-look round, rea… |
| RP55 | roundOrder takes catch-up entries first (up to the share), then live, then re-looks, then the rest of the catch-up, each by seq |
| RP56 | with more catch-up work than its share, the round takes the 100 lowest-seq catch-up entries, then every live entry, then the re-looks, then the rem… |
| RP57 | a round holds at most 500 addresses — the catch-up share and the live lane first, then re-looks while room is left |
| RP58 | journalLine writes each of the twelve line types as one compact JSON line ending in its only newline, which parses back to the object — a newline o… |
| RP59 | replayJournal from no record applies an absolute v (its address's lineage set to the line's top and older, and a version prompt), an o (the lineage… |
| RP60 | an x line drops exactly the ids it lists from S, refusedSeen and B, and leaves the lineage — ids it lists stay in older, and an unlisted S id and a… |
| RP61 | a c line records the id in S and clears the entry's version only when it is that id — keeping every revoke, a by-e revoke naming a version since re… |
| RP62 | a torn, garbled, non-object or unknown-type line is skipped and counted, and the lines after it still apply; an empty line is ignored, not counted;… |
| RP63 | replayJournal restores the record's seen and refusedSeen with seq 0, its lineage rows — [a, top] with older omitted when empty, [a, top, [older…]],… |
| RP64 | re-looks are one per (address, runId), their entries merged by mergePrompt's rules — the latest version, per (by, target) the revoke with the great… |
| RP65 | allowErrorCode passes E-codes, Neo4j status codes, ServiceUnavailable, SessionExpired and the ScanError codes through unchanged |
| RP66 | allowErrorCode turns anything else into 'error' — a host name, host:port, [::1]:port, an IP, a URI, a near-miss of an allowed pattern, a code with… |
| RP67 | a version and its id-only revoke heard in one round — the revoke resolves as A's top, and the round's empty read removes the relationship recording… |
| RP68 | a version heard after a round's scan spawned, then revoked by id — the read, placed under that later learning, teaches nothing, and its shrink leav… |
| RP69 | a re-sent older version after an id-only revoke is created after downtime — the read that returned the newer version dropped the older one from S a… |
| RP70 | a version dropped over the backlog cap and then revoked by id is found by the catch-up — still learned as A's top, it is a deletion candidate (rule… |
| RP71 | a by-id revoke, then a re-apply at the same address during an overlapping pass, then a wipe — the entry keeps the revoke (nothing is discarded), ye… |
| RP72 | a kind-5 whose own pubkey is written in upper-case hex is not isEvent-shaped, so it resolves nothing live — no prompt, no foreign count, matchedNot… |
| RP73 | gateAction treats a null ctx.entry as an empty entry — a create is held only by the baseline, a not-on-relay or non-tagging removal is held as remo… |
| RP74 | roundOrder places an address queued in more than one lane once, at its earliest position — the catch-up share before live, live before re-looks, re… |
| RP75 | replayJournal restores the record's pending [{ a, entry, lane, attempts, notBefore }], rechecks [{ a, runId, entry }] and parked [{ a, code, attemp… |
| RP78 | replayJournal's pending holds entries only — each value is a T15 entry with exactly the keys version, revokes and look — whether restored from reco… |
| RP79 | replayJournal keeps the FIRST k time for a run — deadSeenAt[runId] is when the path first saw the run not alive, so a later k line for the same run… |
| RP80 | learnVersion(maps, address, id, { under: false }) makes the id its address's top, the previous top joining older — the first version learned has no… |
| RP81 | a read placed under a later learning teaches nothing — learnVersion(…, { under: true }) returns false and leaves the lineage exactly as it was, at… |
| RP82 | learnOlder(maps, address, id) joins the graph's version to older below the top, returning true, and changes nothing, returning false, when the line… |
| RP83 | older never holds more than 8 ids — learning a ninth drops the oldest-learned, whether it joins as a replaced top or as the graph's version; a vers… |
| RP84 | lineageValue(maps, address) gives { top, older: [ids] } — a copy, as record.json and the journal carry it — and lineageAt the same top and older id… |
| RP85 | pruneLineage drops a lineage when its top is not in the stamp scan (a census lineage has none), the graph's keys do not hold its address, and no wo… |
| RP86 | pruneLineage keeps a lineage where something was learned after the scan's capture — an address in learnedAfter — though its top is not in the scan,… |
| RP87 | at every lineage it keeps, pruneLineage cuts older to the id the graph's keys recorded there plus the ids learned there after the scan's capture —… |
| RP88 | while a pass may still write from an older read (keepOlder), pruneLineage drops no lineage and cuts no older — the same maps without it are dropped… |
| RP89 | an entry keeps at most 8 by-e revokes, the most recently merged — a ninth distinct by-e revoke drops the least recently merged, a by-e revoke merge… |
| RP90 | as versions are learned at an address, a by-e deletion resolves only for the one learned last — each earlier one stops resolving the moment a later… |
| RP91 | gateAction's by-e rule — a by-e revoke naming X lets a removal of the relationship recording G act only when (i) X = G, or (ii) X is the top of ctx… |
| RP92 | every replayed line that changes a lineage is absolute — a v {id, a, top, older} line sets L(a) to exactly its top and older and adds a version pro… |
| RP93 | replay applies only the record's journal generation — the lines after the e {epoch} line matching record.epoch; lines before it, and an older gener… |
| RP94 | a v line lacking its top or older — T19's old relative form — is skipped and counted and prompts nothing; so is an o line lacking older, with an ol… |
| RP95 | replay merges each parked row's entry into pending at its address — by mergePrompt's rules where the record also holds a pending row there — while… |
| RP96 | journal replay carries prompts unchanged — a v line at an address discards no revoke: the pending entry and the re-looks there keep every by-e revo… |

### Engine (`realtime/index.js`, through the T20 seam over fakes) — `test/tagging-edges-realtime-engine.test.js` (81)

| Id | Behaviour |
|---|---|
| RE1 | the engine module exports createEngine, run and defaultDeps, and createEngine(deps) returns start, tick, handleSignal and status |
| RE2 | run(deps) with the switch off leaves exit code 0 on deps.proc.exitCode, waits only through deps.sleep in steps of at most 250 ms, never calls proce… |
| RE3 | run(deps) with the switch on runs the path; when the owner turns it off at about 10.5 s, run resolves with deps.proc.exitCode 0 within 5 s of the off |
| RE4 | with the switch missing, unreadable or off at start, tick() answers { exit: 0 } within 5 s and nothing happens — no subscription, no relay scan, no… |
| RE60 | start() and tick() never call deps.sleep — through a first start, a burst, a graph outage, failing relay reads and idle minutes, every wait belongs… |
| RE5 | a first start subscribes once to the relay the environment names, with exactly the two filters (both nostr-user-tag stamps, and kind 5), limit 0 an… |
| RE6 | a tagging stored after the subscription opened — before the baseline scan, or while it runs — is live-delivered and created within 60 s; the pre-ex… |
| RE7 | a first start's only graph contact before started.json is the census — one key read, with no retry and no schema check, before the REQ — and the ce… |
| RE8 | the first start's catch-up brings a relationship the backfill left behind the relay up to the relay's version within 60 s, and creates nothing wher… |
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
| RE18 | a revoke by id of the older version, arriving with a newer version, removes nothing: the newer version is its address's top when the kind-5 is drai… |
| RE19 | a version heard but not yet written, then revoked by id at once, is removed within 60 s — the kind-5 names its address's top, and the relationship… |
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
| RE81 | the path's schema check passes a transaction time-out of its own — every readSchema call it makes, while a rule is missing (the 15 s re-checks) and on… |
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
| RE80 | the catch-up share's element reads are bounded by the share's bytes too — with 150 arrivals naming their tags only by id (tag elements of about 40… |
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
| RE79 | the status's seen is the size of S, and heard counts the addresses whose latest learned version is not in S — three taggings in the first start's b… |
| RE47 | every write goes through the port's applyCreates / applyLocked in calls of at most 25 rows sorted by (from, to) — creates, updates and moves by the… |
| RE48 | before a write drops a key outside the nine, the relationship's pre-image is appended under the path's session id (run-id grammar) with writer 'rea… |
| RE53 | the catch-up reads the graph's keys as plain { address, eventId } rows and ignores those whose address is missing or not a tagging address — even w… |

### Lineage (Amendment A1, engine over fakes) — `test/tagging-edges-realtime-lineage.test.js` (28)

| Id | Behaviour |
|---|---|
| RL1 | a by-id deletion of v1 stored after v2 replaced it (strfry acts on nothing) and drained while the round that writes v2 is still in flight — during… |
| RL2 | a by-id revoke of v1 that a restart's catch-up found, still waiting in its unfed backlog (behind 6,500 arrivals) when Alice re-applies v2, which is… |
| RL3 | a by-id deletion of v1 that arrives after v2 was heard (strfry acts on nothing) prompts nothing — when v2 leaves the relay with no event before its… |
| RL4 | while the path is off, v2 replaces v1 and a by-id deletion names v1 — stale (after v2), revoked first (before v2), or after v2 was heard before the… |
| RL22 | a by-id revoke that goes stale while it waits is inert — Alice revokes v2 by id (strfry deletes it) and then publishes v3 before the revoke's round… |
| RL5 | v2 is heard while its reads fail, the websocket drops, and Alice revokes v2 by id in the gap; v2's retry then reads the address EMPTY before the re… |
| RL6 | a read of the address taken after Alice's by-id revoke of the heard v2 was stored but before its notice was delivered (strfry's change notice lags… |
| RL7 | a version stored while the path was down is found by the restart's catch-up as an arrival and learned there; when Alice revokes it by id while its… |
| RL8 | put-backs and re-looks carry revoke prompts unchanged — the round holding v2 and Alice's by-id revoke of v2 is put back after a failed read under t… |
| RL9 | at the first start (the backfill wrote v1), Alice's revoke of v1 stored right after the REQ — by id or by address, buffered, delivered on a first c… |
| RL10 | a revoke-gated removal the database keeps refusing is parked with its prompts: record.json's parked row carries its entry, so after a compaction, a… |
| RL11 | a revoke a catch-up found survives a stop before its round even when the relay then loses the kind-5 — a restart then a wipe (the found revoke's d… |
| RL12 | the census records a backfilled version — v1 replaced the backfill's v0 before the switch-on: the first start's record.json carries v0 under the ba… |
| RL13 | the census is placed under the scan at an address a restored lineage already holds — a lost record's re-baseline replays a lineage whose top is X,… |
| RL14 | a census whose one key read never answers, or answers after 15 s, holds a first start's REQ at most 10 s — the engine enforces its own deadline, th… |
| RL15 | a read that cannot be placed teaches nothing — a round's read returns v3 while v2's late notice is drained after its capture (v3's own notice never… |
| RL16 | a flooded address stays bounded — 30 versions at one address, each heard, leave every absolute v line at most 8 older ids (the cap reached, never p… |
| RL17 | lastReflectedAt is not moved by a decision the gate held — a version prompt, then a relay wipe before its round: the removal is held (removalsNotPr… |
| RL18 | clause (ii)'s intended case — v2 heard at the address whose relationship records v1, then Alice's by-id revoke of v2, removes the relationship reco… |
| RL19 | DOCUMENTATION of owner decision 11 (accepted 2026-09-29), shape (a) — the relationship records Y; X replaces Y and is heard, and Alice revokes X by… |
| RL20 | DOCUMENTATION of owner decision 11 (accepted 2026-09-29), shape (b) — X is stored with its notice late, and Y replaces it with its notice lost; a l… |
| RL21 | DOCUMENTATION of owner decision 11 (accepted 2026-09-29), shape (c) — the relationship records G and the path's top is X; a third version W replace… |
| RL23 | the gate judges a by-id revoke against the lineage as it stood before the round's own read was learned — the relationship records v1 (a pass wrote… |
| RL24 | the graph's version joins older under the version a read or a scan placed — so where the path never heard the version the graph records (another wr… |
| RL25 | the census joins no older at an address a restored lineage already holds — a lost record's re-baseline replays a lineage whose top is X, while the… |
| RL26 | a catch-up's compaction keeps in older the versions learned after its scan's capture — v2 and then v3 are heard while a restart's catch-up is still… |
| RL27 | a catch-up's compaction keeps the lineage of a version learned after its scan's capture, though its top is not in the scan, the graph's keys did no… |
| RL28 | a catch-up's compaction keeps in older a version a round learned and wrote between the catch-up's key read and its scan's capture — v2 is heard while… |

### Resilience (Amendment A1, engine over fakes) — `test/tagging-edges-realtime-resilience.test.js` (25)

| Id | Behaviour |
|---|---|
| RX1 | with the start catch-up failing and backing off — its stamp scan exiting non-zero, or its key read timing out, every try — a live change and the re… |
| RX2 | one never-answering address among 200 live taggings delays the others read with it by at most A1-13's bound — three round-scan time-outs plus a rou… |
| RX3 | with three never-answering addresses, other authors' taggings stored every 3 s over 6 minutes are each reflected within 60 s; no round has more tha… |
| RX4 | a Redis-style stall of 2 minutes at ordinary traffic (a tagging every 2 s) — every scan waiting until the relay answers or its 20 s time-out — neve… |
| RX5 | a live group that times out once while its round's catch-up share answered is not bisected in its round; its addresses are marked and read alone —… |
| RX6 | beside a restart's catch-up of 2,400 padded addresses (about 50 KB each, 120 MB in all: a share's 100 addresses weigh more than its 3.2 MiB, less t… |
| RX7 | prefix and torn-append replay never invert a lineage — (a) a first start whose buffered delivery Y the baseline scan's X outranks, torn in the appe… |
| RX8 | a start whose journal cannot be read demotes every restored top into its older — so after a version Z the path had heard leaves with no event, the… |
| RX9 | a journal read that fails part-way keeps the state built so far — a revoke prompt whose line was read before the failure still removes its relation… |
| RX10 | a truncation that fails after a lost record's re-baseline replays none of the older generation — whether the process dies at the failed truncation… |
| RX11 | replay exactness as a property — over fixed seeds of random floods at one address, new addresses, deletions by id and address, silent departures, r… |
| RX12 | the compaction cadence — a round-end compaction runs once the journal passes the larger of 1 MB and a quarter of record.json, not before: with a sm… |
| RX13 | the pass exception is judged from a report read taken with each catch-up's key read — a lineage whose version left the relay and the graph is kept… |
| RX14 | after a stop — a deploy's SIGTERM or the owner turning it off — the final status says subscription.connected false (A1-18 "After a stop, the final… |
| RX15 | the read-alone mark lasts until the address's own read succeeds — a never-answering address that keeps receiving new versions (one every 4 s), besi… |
| RX16 | a catch-up does not lift a time-out park — a never-answering address parked after its third single time-out costs no time-out at the next safety di… |
| RX17 | a time-out park is not a database refusal — a never-answering address parked after three single time-outs leaves counts.dbRefused at zero, with no… |
| RX18 | a round reads its marked singles fewest own consecutive time-outs first, ties by queue order — a never-answering single X is due again after its fi… |
| RX19 | a live delivery of a new version at an address while the round that parks it holds it lifts the park at once — a never-answering address X, marked… |
| RX20 | a lone change through a total relay stall is never parked — a tagging stored alone as a 3-minute Redis-style stall begins is read alone (a one-address… |
| RX21 | a never-answering address beside answering traffic is still parked after three — stored alone, it is never read in a group (so never marked to be read… |
| RX22 | a live revoke lifts a time-out park at once — at an address the backfill wrote, a never-answering newer version is heard, marked and parked after thre… |
| RX23 | a one-id element time-out counts in counts.failedReads.element, not in counts.failedReads.relay — an id-only tagging whose tag element's reads never a… |
| RX24 | a catch-up does not lift a database-refusal park — an address parked after two refused writes, three minutes before the 10-minute safety diff, with a… |
| RX25 | an unexpected error in a catch-up step ends that catch-up and never wedges catch-ups — the 10-minute safety diff's key read answers a row the engine c… |

### Property (Amendment A1, the fuzzer; RF29–RF36 opt-in) — `test/tagging-edges-realtime-property.test.js` (36)

| Id | Behaviour |
|---|---|
| RF1 | the oracle is not vacuous — I1 flags a removal while the relay held an accepted version, I2 a removal only an OLDER version’s deletion explains, an… |
| RF2 | a deletion of the baseline version, stored just after a round reads the address, never removes the newer version heard after it once a wipe takes t… |
| RF3 | a deletion naming, in upper-case hex, only a replaced version and an id never stored there never removes the relationship a pass wrote from its old… |
| RF4 | a deletion naming the replaced baseline version never removes the relationship a pass wrote from its older read of the newer version, gone with no… |
| RF5 | a deletion naming an already-replaced version, stored while the newer one is held, never removes the relationship a pass then writes for the newer… |
| RF6 | the same with a pass and no other fault (no latency, yields or injections): the stale deletion kept in the entry never removes the pass’s relations… |
| RF7 | round 1’s NEW-3 — a deletion that acted on an older version never removes the relationship a later batch wrote, once that version leaves with no ev… |
| RF8 | round 1’s NEW-1 — a round reading the address between a revoke’s store and its delivery still applies the revoke: reflected (A1-2, A1-3) [test/fixt… |
| RF9 | round 1’s NEW-2 — a version the path first learns as a catch-up arrival, revoked by id, is removed: reflected (A1-2, A1-9) [test/fixtures/tagging-e… |
| RF10 | round 1’s F4 variant 2 — a revoke in a reconnect gap is not lost to an empty read before the catch-up: reflected, or decision 5’s first corner wide… |
| RF11 | a revoke stored in the first start’s census window and then wiped: reflected, or the evidence-gone corner (A1-8, A1-16 (5)) [test/fixtures/tagging-… |
| RF12 | a lost record’s re-baseline with its census, then a by-id revoke of a later version: reflected (A1-8, A1-16 (5) lost-record corner) [test/fixtures/… |
| RF13 | a version stored just before a crash and never drained, revoked by id while down: reflected, or decision 5’s second corner (A1-16 (5)) [test/fixtur… |
| RF14 | an address deletion spelling the pubkey in upper case, delivered while the path did not know the address (stored in a reconnect gap, written by the… |
| RF15 | A1-21’s first miss — a version learned in the last flush interval before a crash, then revoked by id while the restarted path reconnects: reflected… |
| RF16 | A1-21’s second miss — a lost journal and a silent departure at an address a restored lineage held: reflected, or the widened lost-record corner (A1… |
| RF17 | healthy, with a pass — an address deletion spelling the pubkey in upper case, stored in the first start’s census window before the path knew the ad… |
| RF18 | a flood at one address — twelve versions, each revoked by id while it is the top, with the graph down, then a round under a live pass: the lineage… |
| RF19 | every fixture file is replayed by a test, and each names its origin, what it documents and its verdict (A1-20: "replaying the shrunk traces as fixt… |
| RF20 | a seed replays exactly — two runs of one seed and mode give the same operations, graph writes, journal and record (T20: the engine takes time and r… |
| RF21 | mode base (none) — seeds 1, 2, 3 × 150 steps hold I1–I4, off within 5 s, no status leak and the bounds (A1-20) |
| RF22 | mode ly (latency+yields) — seeds 1, 2, 3 × 150 steps hold I1–I4, off within 5 s, no status leak and the bounds (A1-20) |
| RF23 | mode iy (inject+yields) — seeds 1, 2, 3 × 150 steps hold I1–I4, off within 5 s, no status leak and the bounds (A1-20) |
| RF24 | mode lost (lost+pass+yields+inject) — seeds 1, 2, 3 × 150 steps hold I1–I4, off within 5 s, no status leak and the bounds (A1-20) |
| RF25 | mode all (pass+latency+yields+inject) — seeds 1, 2, 3 × 150 steps hold I1–I4, off within 5 s, no status leak and the bounds (A1-20) |
| RF26 | mode pass (pass) — seeds 1, 2, 3 × 150 steps hold I1–I4, off within 5 s, no status leak and the bounds (A1-20) |
| RF27 | mode healthy (healthy+yields+inject) — seeds 1, 2, 3 × 150 steps hold I1–I4, off within 5 s, no status leak and the bounds, and every change and re… |
| RF28 | mode healthyp (healthy+pass+yields) — seeds 1, 2, 3 × 150 steps hold I1–I4, off within 5 s, no status leak and the bounds, and every change and rev… |
| RF29 | campaign, mode base (none) — 20 fixed seeds × 150 steps hold every asserted property (A1-20; opt-in: TAGGING_EDGES_PROPERTY=1) |
| RF30 | campaign, mode ly (latency+yields) — 20 fixed seeds × 150 steps hold every asserted property (A1-20; opt-in: TAGGING_EDGES_PROPERTY=1) |
| RF31 | campaign, mode iy (inject+yields) — 20 fixed seeds × 150 steps hold every asserted property (A1-20; opt-in: TAGGING_EDGES_PROPERTY=1) |
| RF32 | campaign, mode lost (lost+pass+yields+inject) — 20 fixed seeds × 150 steps hold every asserted property (A1-20; opt-in: TAGGING_EDGES_PROPERTY=1) |
| RF33 | campaign, mode all (pass+latency+yields+inject) — 20 fixed seeds × 150 steps hold every asserted property (A1-20; opt-in: TAGGING_EDGES_PROPERTY=1) |
| RF34 | campaign, mode pass (pass) — 20 fixed seeds × 150 steps hold every asserted property (A1-20; opt-in: TAGGING_EDGES_PROPERTY=1) |
| RF35 | campaign, mode healthy (healthy+yields+inject) — 20 fixed seeds × 150 steps hold every asserted property (A1-20; opt-in: TAGGING_EDGES_PROPERTY=1) |
| RF36 | campaign, mode healthyp (healthy+pass+yields) — 20 fixed seeds × 150 steps hold every asserted property (A1-20; opt-in: TAGGING_EDGES_PROPERTY=1) |

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

### Subscription (review round 1, the real module against an in-process relay) — `test/tagging-edges-realtime-subscription.test.js` (8)

| Id | Behaviour |
|---|---|
| RSUB1 | on open the client sends exactly one message, the REQ ["REQ", "tagging-edges-realtime", …filters]: the caller's filters in their order, each a copy wi… |
| RSUB2 | the relay's EOSE is reported once through onEose, then each EVENT for the subscription through onEvent — the event object as the relay sent it, in the… |
| RSUB3 | messages for another subscription id — EVENT, EOSE and CLOSED — and frames that are no message for this one (text that is not JSON, JSON that is not a… |
| RSUB4 | a NOTICE, or a CLOSED for the subscription, ends the connection — the relay's side closes, onClose is called once with the fixed reason 'filter refuse… |
| RSUB5 | the client pings on its interval — a relay that answers each ping with a pong keeps the connection open (several pings, no onClose), and a relay that… |
| RSUB6 | a connection that never opens — nothing listening at the port, a relay that refuses the websocket upgrade (HTTP 503), or a handshake that never comple… |
| RSUB7 | close() is the caller's end — on an open subscription it sends ["CLOSE", "tagging-edges-realtime"], then closes the socket (the relay sees a normal cl… |
| RSUB8 | a URL the client refuses at once (it is not a URL) is reported like a refused connection, later — onClose({ reason: 'connection refused' }) from a lat… |

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

### Wiring (story 2 suite, amended) — `test/tagging-edges-wiring.test.js` (12)

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
| SWR72 | readSchema keeps no default transaction time-out for the pass — readSchema() with no argument runs SHOW CONSTRAINTS and SHOW INDEXES with no time-out… |

### Contract / BIBLE (story 1 suite, re-aimed) — `test/tagging-edge-contract.test.js` (2)

| Id | Behaviour |
|---|---|
| S2C9 | BIBLE §6's TAGS status line says what writes TAGS and how it runs — task reconcileTaggingEdges, GET /api/tagging-edges/status — no longer says no p… |
| S2C16 | BIBLE's Last updated line records story 2 — one of its entries (the texts between its "; prior:" separators), whichever it is, ends in the house form… |

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
