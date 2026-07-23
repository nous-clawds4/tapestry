# Build Audit: Relationship Primitives (Neo4j-only add/delete)

**Book:** `engineering-team/audits/relationship-primitives/book.md`
**Date:** 2026-07-22
**Branch / commit range:** `27004981` (arming baseline) .. `8e9888b9` (staging merge, PR #413); post-merge process commits (journal, completion report, this close) on `feat/relationship-primitives`
**Provenance:** Acceptance-frame
**Confidence:** high

> As-built record for the first Direction-mode run of the "second brain" graph-editing primitives. Anchor: the operator's 2026-07-18 ask, restated as a 9-bullet acceptance frame, refreshed pre-arming 2026-07-21 (operator-ratified) for the post-`security-auth-exposure` surface.

## 1. What shipped

- **Add a single typed relationship** between two existing Neo4j nodes — owner-gated, whitelist-validated, idempotent (`created` / `already-existed`), strfry-free — `stories/relationship-primitives/1-relationship-add-delete-primitives.md`
- **Delete a single typed relationship** — targeted (never a sweep), discriminated (`deleted` / `not-found`), strfry-free — same story.
- **Loud precondition failures** naming the missing node or rejected relationship type (whitelist = the two class-thread membership types via the firmware alias layer; net-new types like `HAS_SUBGOAL` rejected) — same story.
- **Read-only deployment probe** (`GET /api/normalize/relationship-primitives`, credential-free, zero side effects, static literal) + missing-sibling 404 contrast — the book's deployment-evidence mechanism — `stories/relationship-primitives/2-read-only-deployment-probe.md`
- **Firmware-install overwrite hazard documented** at the point of use (module header + `note` field on graph-changing responses); install behavior untouched — story #1.

## 2. Epics & stories rolled up

### Epic: `relationship-primitives`
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 relationship-add-delete-primitives | Both mutation operations, owner gate, whitelist, idempotency contract, hazard documentation | Done | `reviews/relationship-primitives/1-relationship-add-delete-primitives.md` (PASS) |
| #2 read-only-deployment-probe | The deployment-evidence probe + sibling contrast (operator-ruled fix-forward) | Done | `reviews/relationship-primitives/2-read-only-deployment-probe.md` (PASS) |

## 3. As-built inventory

Derived from the diff (`git diff 27004981..8e9888b9` — src/ changes are exactly the three files below plus tests):

- **User-facing (API, owner-gated):** `POST /api/normalize/add-relationship`, `POST /api/normalize/delete-relationship` — body `{fromUuid, toUuid, relType}`; in-handler `isOwner(req) || req.localTrusted` gate (403 for authenticated non-owners; middleware 401 for unauthenticated remote); responses `{success, operation, result, relType, from:{uuid,labels}, to:{uuid,labels}[, deletedCount][, note]}`; 404 names missing uuid(s), 400 carries the `allowed` list.
- **User-facing (API, public read):** `GET /api/normalize/relationship-primitives` → static `{success, surface, operations[]}`.
- **Code:** `src/api/normalize/relationships.js` (new; import surface exactly `lib/neo4j-driver`, `middleware/auth`, `./firmware` — under S-class test), `src/api/normalize/probe.js` (new; zero requires — under S-class test), `src/api/normalize/index.js` (route registrations only).
- **Domain:** no concepts added or modified; no firmware reinstall; no graph schema change. The whitelist is a code-level construct over the existing firmware alias layer (`CLASS_THREAD_TERMINATION` → `HAS_ELEMENT`, `CLASS_THREAD_PROPAGATION` → `IS_A_SUPERSET_OF`).
- **Tests:** `test/relationship-primitives.test.js` (23) + `test/relationship-primitives-probe.test.js` (9), registered in the runner's live gating chain.
- **Data & contracts:** no event kinds, no stored shapes, no strfry writes (structurally and behaviorally asserted).

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame 8(a): deployment proof via "a 401/403-class answer proves deployment where a 404 would disprove it" | The premise was **falsified** (default-deny answers 401 before route matching; global CORS answers OPTIONS 204 on every path — both verified). Proof delivered instead by the story-#2 probe: 200-JSON vs sibling 404-HTML. | constraint-discovered → operator-ruled fix-forward | Tester falsification (story #1 test plan caveat; journal 2026-07-21T09:33Z); operator ruling 2026-07-21 (journal ANSWER entry) | None user-facing; adds one public read route | Probe pattern available for future books' deployment evidence |
| 2 | Story #1 ADR usage example sketched `"relType":"HAS_ELEMENT"` | Header example uses the canonical slug `CLASS_THREAD_TERMINATION` | interpretation | The ratified S2 test forbids whitelisted alias literals anywhere in the module, comments included (Implementer deviation log, story #1) | None (docs-level) | — |
| 3 | Frame bullet 4 "delete is targeted… never a bulk sweep" | Degenerate case: N>1 pre-existing same-type parallel edges between a pair are all removed, `deletedCount:N` (not producible via the add op) | interpretation | ADR 0001 Consequences — "still the named type between the named pair, in the named direction" | Negligible (state not producible through this surface) | — |
| 4 | — (not specified) | The probe deliberately reports **registration, not behavior** (no health/version metadata) | intentional-change | Story #2 scope note + ADR 0002 (health-endpoint scope creep banned) | Deployment evidence only, by design | — |

**Undocumented work:** none — the src/ diff is exactly the three files above, all story/ADR-covered. (Range also carries the harness's own artifacts — stories, ADRs, plans, reviews, journal — all process-documented.)

## 5. Quality state at close

- Test gate at close (`npm test`, full — three runs, recorded honestly): **run 1** (router active): H8 and H4 each failed with the canonical drift signature (+1 router event inside each bracket), all 30 other tests green; **run 2** (launched in a measured quiet window that closed mid-run): probe 9/9, H8 drift-failed again (+2); **run 3** (strfry-router quiesced for the run, restarted after): **Overall PASS, exit 0 — `relationship-primitives 23/0`, `relationship-primitives-probe 9/0`.** The only failing suite row in run 3 is the pre-existing repo-wide harness-lint L9 (BIBLE.md last-updated lag), which predates the book and sits in the runner's non-gating block. The three-run sequence is itself the live demonstration of process finding row 75 (§7). Logs: session scratchpad `close-gate-run{,2,3}.log`.
- Known open issues: `respondMissingNodes` called without `await` inside `try` at `relationships.js:164,:201` — vanishingly narrow hung-request window; one-word fix (review #1, non-blocking; OPEN.md row 77). `PROBE_RESPONSE` not `Object.freeze`d (review #2, optional hardening; folded into row 77).
- Debt logged by ADRs: whitelist extension path for core-node wiring types needs cardinality-safety thought (ADR 0001); probe `operations[]` sync burden guarded by S-class cross-check (ADR 0002); label-free uuid lookup accepts a node scan at operator traffic, escape hatch documented (ADR 0001).
- `isOwner` ≡ `isOwnerOrAdmin` — the gate admits admin pubkeys, identical to the ADR-pinned wipe.js template; conformant here, tracked by the separately-scoped authenticated-non-owner follow-up (intake 2026-07-21).

## 6. Carry-forward register

- [ ] **`HAS_SUBGOAL` whitelist extension** — frame-excluded from this book; the second-brain queue's story 3 declares the dependency (from ADR 0001 Out-of-scope / book pre-arming refresh).
- [ ] **Firmware-install overwrite protection** — documentation-only here by operator decision (2026-07-18); a real installer guard is its own epic. The second-brain queue's story 8 (export/restore) is the interim protection.
- [ ] **Whitelist growth to core-node wiring types** — needs a cardinality-safety design first (ADR 0001 Consequences).
- [ ] **Un-awaited error-path + freeze hardening** — OPEN.md row 77 (trivial; next touch).
- [ ] **Wider authenticated-non-owner gap on the admin-mutation surface** — pre-existing scoped follow-up (intake 2026-07-21), not this book's.

## 7. Process findings (harness)

Retro inputs: `journal.md` (all process entries), reviews' harness-friction notes, `scripts/harness-stats.sh` (run at retro: 135 story / 116 adr / 117 test / 122 impl / 153 review phase commits repo-lifetime — this book adds its 2-story set at the smallest viable book size). Each finding, one terminal state; portability (Direction ↔ human-gated) noted:

| Finding | Source | Terminal state |
|---|---|---|
| Judge blinding over-read voided a Gate-1 APPROVE; mechanical bounded-`sed` extraction adopted mid-run, held for 10 subsequent spawns, zero breaks | journal 2026-07-21T08:45Z | **OPEN.md row 63 (updated)** — second occurrence recorded; the pattern-anchored `sed` recipe added as the working fix candidate. Ports to any judged flow. |
| **Silent role stalls ×5** — subagents completed background work but their completion surfaced late (up to ~5h); recovered every time by Director-side heartbeat + nudge (~20–40 min cost each) | journal 2026-07-22T01:45Z, 02:45Z, 03:38Z; nudges 04:10Z/04:52Z | **OPEN.md row 74 (new)** — proposal: standing heartbeat-watch procedure in the direct-feature skill (goalpost-class → next run), and/or harness-level notification reliability. Ports to human-gated flows (any role wait). |
| **Equality-bracket tests are deterministically brittle under a live publisher** — H8/H4 strfry count brackets fail whenever strfry-router syncs mid-bracket; cost three full-suite re-runs + a control experiment across the book | journal 2026-07-21T18:08Z/18:30Z; reviews #1/#2 two-run records | **OPEN.md row 75 (new)** — proposal: tester-role guidance for drift-tolerant negative assertions (scoped scans or documented quiesce prerequisite). Ports everywhere. |
| **Anchored-append journaling lost a heading** — an Edit-applied journal entry landed body-only and stranded out of order; repaired by amendment commit `9595a02e` (restored heading + editorial marker) | review #2 harness-friction; journal amendment | **OPEN.md row 76 (new)** — proposal: append journal entries by file-append, not anchor-matched edits; candidate harness-lint rule for headingless journal fragments. |
| Epic-roster status annotations went stale (both stories read "Draft" after their Done flips) | reviews #1/#2 harness-friction | **Declined** — instances fixed in this close commit (epic roster now Done); the roster duplicates story `Status:` by design and the close reconciles it; a lint rule would outweigh the defect at current scale. |
| Completion-report timestamp conflation (8(c) journaling vs merge time) flagged by the blinded completion judge as journal-internal | final audit verdict; journal 06:55Z correction | **Declined** — corrected same-day in the journal with the evidence's own timestamps; the general report-accuracy lesson is already OPEN.md row 64 (tallies/claims derived from the journal at assembly time). |
| Reviewer run-1 raw log lives only in the reviewer's session scratchpad (judge caveat: not independently reachable) | Gate-5 #2 verdict | **Declined** — inherent to scratchpad lifecycle; every checkable claim reproduced independently by the judge; durable evidence (suite files, registered runs, journal captures) suffices. |
