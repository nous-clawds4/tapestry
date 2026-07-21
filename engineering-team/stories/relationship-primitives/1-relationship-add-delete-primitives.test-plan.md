# Test Plan: Story 1 — Strfry-free relationship add/delete primitives

**Story:** `engineering-team/stories/relationship-primitives/1-relationship-add-delete-primitives.md`
**ADR:** `engineering-team/decisions/relationship-primitives/0001-strfry-free-relationship-primitives.md`
**Date:** 2026-07-21

One suite — `test/relationship-primitives.test.js` — on the ADR §6 ratified U/S/H class split. Registered in `test/test.js` exactly as sibling suites are (require + run call + skip-aware summary line + **live** `overallOk` chain, before the severed terminator per OPEN.md #43 + `totalSkipped` array).

## Coverage map

Every acceptance criterion maps to at least one test; the book's minimum floor (eight cases + no-strfry-write) is called out in the **Floor** column.

| Criterion | Test name | Floor case | Level |
|---|---|---|---|
| AC-1 Add is idempotent | `U9` created vs already-existed discrimination (scripted rows) | — | unit |
| AC-1 Add is idempotent | `H1` add-new → 200 `created`, exactly 1 edge in Neo4j | add-new | live |
| AC-1 Add is idempotent | `H2` identical repeat → 200 `already-existed`, still exactly 1 edge | add-idempotent | live |
| AC-2 Delete is targeted | `U10` deleted vs not-found discrimination, `deletedCount` reported | — | unit |
| AC-2 Delete is targeted | `H3` delete-existing → only the named type+direction removed; reverse-direction and other-type decoy edges survive (never a sweep) | delete-existing | live |
| AC-2 Delete is targeted | `H4` repeat delete → 200 `not-found`, `deletedCount:0`, nothing removed | delete-missing | live |
| AC-3 Preconditions fail loudly | `U5` missing/empty body fields → 400 naming the field, zero Cypher | — | unit |
| AC-3 Preconditions fail loudly | `U6` unknown relType incl. story-named `HAS_SUBGOAL` → 400 + allowed list, zero Cypher | rejected relType | unit |
| AC-3 Preconditions fail loudly | `U7` firmware-aliased but non-whitelisted (`IS_THE_CONCEPT_FOR` / canonical `CLASS_THREAD_INITIATION`) → 400, both operations | rejected relType | unit |
| AC-3 alias-layer resolution | `U8` canonical slug `CLASS_THREAD_TERMINATION` accepted; only the resolved alias reaches Cypher text (injection boundary) | — | unit |
| AC-3 alias-layer resolution | `S2` whitelist built via `firmware.relAlias(...)`; no whitelisted Neo4j alias as a raw string literal | — | structural |
| AC-3 Preconditions fail loudly | `U11` nonexistent uuid → 404 naming exactly the missing uuid(s), add + delete | nonexistent node | unit |
| AC-3 Preconditions fail loudly | `H5` nonexistent endpoint node → 404 naming the missing uuid, live | nonexistent node | live |
| AC-3 Preconditions fail loudly | `H6` non-whitelisted relType → 400 + allowed list, both routes, live | rejected relType | live |
| AC-4 Owner-gated | `U1`/`U2` unauthenticated-shaped caller → 403 from add/delete **before any Cypher**, zero child_process calls | non-owner 403 | unit |
| AC-4 Owner-gated | `U3` authenticated **non-owner** session → 403 from both operations before any Cypher | non-owner 403 (both ops) | unit |
| AC-4 locally reachable | `U4` `req.localTrusted` passes the gate on both operations | — | unit |
| AC-4 locally reachable | `H1`–`H6` success paths all go through container loopback (`docker exec tapestry curl`) — the trusted-local calling convention itself | — | live |
| AC-4 unauthenticated remote denied | `H7` host-side POST → 401 (host→`:7778` **is** the remote path) | — | live |
| AC-4 route registration | `S3` both POSTs registered in `registerNormalizeRoutes` under the fixed mount | — | structural |
| AC-5 Strfry-free | `S1` import surface exactly `{neo4j-driver, ./firmware, middleware/auth}`; no `child_process`/`nostr-tools`/`assistantKeys`/`publishToStrfry`/`signAndFinalize` | no-strfry (structural) | structural |
| AC-5 Strfry-free | every U test: child_process call delta = 0 across each handler invocation | no-strfry | unit |
| AC-5 Strfry-free | `H8` `GET /api/strfry/scan/count` equality bracketing a full add+delete cycle | no-strfry (behavioral) | live |
| AC-5 hazard documented | `S4` module header cites `firmware/install` and explains the overwrite hazard | — | structural |
| AC-5 hazard documented | `U9`/`U10`/`H1`/`H3` — `note` matching `/install/i` on `created`/`deleted`; `U9`/`U10` — no note on the non-mutating outcomes (ADR decision-5 table) | — | unit + live |

## Edge cases

- [x] Empty body / missing single field / empty-string field (`U5` — three sub-cases).
- [x] Unknown vs known-but-unwhitelisted relType, both alias and canonical spellings (`U6`, `U7`).
- [x] One node missing vs both nodes missing — `missing[]` names exactly the absent uuid(s) (`U11`).
- [x] Decoy survival: same type reverse direction; other whitelisted type same direction (`H3`, `H4`).
- [x] Stack absent (H-class per-test SKIP; U/S still gate — ADR `test-hermeticity-ci/0001`).

**Deliberately not tested** (spec pins them as non-policy or unreachable via the primitives; testing would add brittleness with no AC): self-loop `fromUuid === toUuid` (ADR: not specially rejected — primitives carry no policy); degenerate N>1 parallel edges (`deletedCount:N` — not producible via add); the concurrent-add `created`-vs-`already-existed` misattribution (accepted caveat); driver-failure 500 (generic error path, no scriptable contract worth pinning).

## Test infrastructure

- Framework: Node built-in runner — `npm test` (entry `test/test.js`); suite also runs standalone: `node test/relationship-primitives.test.js`. No Playwright (no UI surface in this story).
- **U-class** (stack-free, gates CI): a scripted stub for `src/lib/neo4j-driver` is injected into `require.cache` **before** `relationships.js` loads (pre-require pattern from `test/strfry-wipe-owner-gate.test.js`); handlers driven with mock req/res. Every invocation is wrapped in wrap-and-delegate child_process call counting (delta must be 0). The discrimination tests script the ADR-pinned row contract (`alreadyExisted`/`deletedCount`/`fromLabels`/`toLabels`; zero rows ⇒ diagnostic uuid lookup — the diagnostic stub rows carry both `uuid` and `n.uuid` key spellings so the test pins the *contract*, not a Cypher alias choice). The Implementer is bound to that row shape by the approved ADR's Implementation notes.
- **S-class** (stack-free, gates CI): source assertions on `src/api/normalize/relationships.js` and `src/api/normalize/index.js`.
- **H-class** (live local stack; **per-test SKIP when unreachable** — the `test/deploy-safety-status.test.js` pattern): success paths via container loopback — `docker exec tapestry curl -s -X POST http://127.0.0.1:7778/…` (`test/customize-pin-curation-publish.test.js` precedent) — because host→`:7778` is remote by design (ADR `security-auth-exposure/0001`). SKIP means: either the host control panel (`$BRAINSTORM_BASE_URL`, default `http://localhost:7778`) or the `docker exec tapestry` loopback probe is unavailable; both must answer for H tests to run. Overrides: `TAPESTRY_CONTAINER` (default `tapestry`), `TAPESTRY_CONTAINER_PORT` (default `7778`), `BRAINSTORM_BASE_URL`.
- **H-class ordering**: H1→H8 are order-dependent (they share the fixture pair and build on one another's edge state); the runner executes them in listed order.
- Firmware state: **no** `POST /api/firmware/install` precondition — the whitelist is a code construct over the existing alias layer (`firmware/active/` in-repo files back the U-class `relAlias` resolution; verified present: `CLASS_THREAD_TERMINATION → HAS_ELEMENT`, `CLASS_THREAD_PROPAGATION → IS_A_SUPERSET_OF`).
- Fixtures (self-cleaning, book ceiling): two throwaway `:NostrEvent` nodes with uuids `test-relprim-<stamp>-a/-b`, created via `POST /api/neo4j/query` over the same loopback (its write gate admits `localTrusted`); decoy edges via the same path; torn down in the suite's `finally` with `DETACH DELETE` filtered to those exact uuids, and a residue count check that WARNs with the manual-cleanup Cypher if anything is left. Firmware and `39998:<TA>:shared-concept` structure are never touched. Verified after the pre-implementation run: `MATCH (n) WHERE n.uuid STARTS WITH "test-relprim-" RETURN count(n)` → `0`.

## Known caveats (documented for the Implementer/Reviewer)

1. **`H7` passes pre-implementation.** Default-deny (ADR `security-auth-exposure/0002`) 401s unauthenticated mutations *before route matching*, so the host-side 401 holds even while the route is missing. It is a regression guard on the ratified auth layering, not a feature-missing signal — and it also means the Director's staging "401 proves the route is deployed" probe cannot distinguish a deployed route from a missing one by status alone (the ADR's claim there is optimistic; flagging for the phase journal).
2. **`H8` race window.** The scan-count equality brackets a single tight add+delete cycle rather than the whole H sequence (same guarantee, smaller concurrent-publish window). Local relay measured quiescent (drift 0 over 4 s); if a scheduled task or sync publishes inside the bracket the test fails with an explicit "quiesce and re-run" message.
3. **Runner-global `cp.exec` stub.** `test/strfry-wipe-owner-gate.test.js` replaces `child_process.exec` non-delegating at module load for the whole runner process. This suite's counting wrappers delegate and restore, and its own shell-outs use `execFileSync` (unaffected). No action needed; noted so nobody "fixes" the interplay blind.

## How to run

```
npm test                                     # full runner (U/S gate; H SKIPs stack-free)
node test/relationship-primitives.test.js    # this suite alone
```

## Verification

The new tests fail with the current code, for feature-missing reasons (`src/api/normalize/relationships.js` does not exist; the routes 404 on loopback). Confirmed 2026-07-21 at commit `c70e5771` (clean tree + these test-only changes), local stack **running** (so H-class ran live rather than SKIPping):

```
--- relationship-primitives tests (epic relationship-primitives, Story 1) ---
  FAIL  U1 (AC-4): unauthenticated-shaped caller (empty session, not localTrusted) gets 403 from ADD before any Cypher and with zero child_process calls
        src/api/normalize/relationships.js does not exist yet — the strfry-free relationship add/delete module (ADR relationship-primitives/0001 Option A) is not implemented.
  [U2–U11, S1, S2, S4 — same feature-missing failure]
  FAIL  S3 (AC-4): both routes are registered as POSTs on the fixed /api/normalize mount in normalize/index.js
        normalize/index.js must require ./relationships (the two-line registration — ADR Option A).
  FAIL  H1 (AC-1): ADD creates the relationship — 200 result:created, labels echoed, and exactly one HAS_ELEMENT edge exists in Neo4j
        POST /api/normalize/add-relationship (container loopback) must answer 200 {success:true} — got status=404, body=… Cannot POST /api… — the add primitive is not implemented.
  [H2–H6, H8 — same 404 route-missing failure]
  PASS  H7 (AC-4): a host-side unauthenticated remote POST is denied with 401 (default-deny, before the handler)

relationship-primitives: 1 passed, 22 failed, 0 skipped
```

Full-runner check: `npm test` exits 1 with `relationship-primitives suite: FAIL (1 passed, 22 failed)` in the results table; every pre-existing suite reports exactly its prior status (known baseline: the harness-lint suite's single L9 BIBLE.md staleness row — untouched).
