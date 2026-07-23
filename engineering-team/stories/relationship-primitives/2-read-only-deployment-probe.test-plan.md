# Test Plan: Story 2 — Read-only deployment probe for the primitives surface

**Story:** `engineering-team/stories/relationship-primitives/2-read-only-deployment-probe.md`
**ADR:** `engineering-team/decisions/relationship-primitives/0002-read-only-deployment-probe.md`
**Date:** 2026-07-21

## Coverage map

Suite: `test/relationship-primitives-probe.test.js` (new file; registered in `test/test.js` exactly on story #1's pattern — require + run call + skip-aware summary line + LIVE `overallOk` chain entry before the severed terminator + `totalSkipped` array entry). Three classes per ADR decision 5, on the split ratified by `test-hermeticity-ci/0001`: U (stack-free unit, always gates), S (stack-free source assertions, always gate), H (live local stack, per-test `SKIP` when unreachable).

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 Answers without credentials | `U1: the probe handler answers 200 with the exact static evidence body … to a bare credential-free request` (bare `req` — no session, no credentials, no body) | `test/relationship-primitives-probe.test.js` | unit (U) |
| AC-1 Answers without credentials (remote class) | `H1: a credential-free host-side GET of the probe answers 200 application/json with the exact evidence body` — host→`:7778` IS the unauthenticated-remote class (ADR `security-auth-exposure/0001`) | same | integration (H) |
| AC-2 The answer evidences the primitives surface | `U1` (exact ADR decision-3 literal: `surface` + `operations` naming both primitives); `H1` (same body over the wire); `S2: the GET probe route is registered inside registerNormalizeRoutes — the same delivery unit as the primitives`; `S3: every operation the probe advertises is a registered POST in normalize/index.js` (honesty cross-check under future renames) | same | unit + source + integration |
| AC-3 Missing-route contrast | `H2: the missing-route contrast — the probe and the named unregistered sibling answer OBSERVABLY differently (200 JSON vs 404 non-JSON)` — asserts the full pair: sibling `GET /api/normalize/relationship-primitives-missing-sibling` → 404 `text/html` `Cannot GET …`, probe → 200 JSON, statuses differ AND content classes differ | same | integration (H) |
| AC-4 Zero side effects | `S1: probe.js contains NO require calls at all` (empty import surface — structurally cannot reach neo4j-driver/child_process/nostr-tools/./firmware/fs; this is also the Neo4j-non-access guarantee, per ADR decision 5 no live Neo4j assertion is needed); `U2: two consecutive handler calls produce byte-identical bodies`; `H4: repeated probes write NOTHING to strfry — scan counts bracket equal around three identically-answered GETs`; `H3: an unauthenticated host-side POST to the probe path stays 401` (no capability beyond answering; story #1's auth untouched) | same | source + unit + integration |
| AC-5 Constitutes bullet 8(a) evidence on staging | H1 + H2 rehearse the exact reproducible request pair (probe + named sibling) locally. The staging capture itself is the **Director's journaled read-only exercise, not a test** (ADR decision 5; story "Delivery"): `curl -si https://staging.brainstorm.world/api/normalize/relationship-primitives` and `…/relationship-primitives-missing-sibling`, both statuses and bodies journaled. | same (rehearsal) + Director's journal | evidence capture |

Deliberate pre-implementation exception (mirrors story #1's H7): **H3 passes today** — default-deny (ADR `security-auth-exposure/0002`) answers unauthenticated mutations before route matching, so the 401 exists with or without the probe. It is a regression guard on the ratified auth layering; post-implementation it proves registering the GET opened no credential-free mutation on the same path. Every other test (U1, U2, S1, S2, S3, H1, H2, H4) fails now for feature-missing reasons.

## Edge cases

- [x] Bare request object (no session key at all, not merely empty) — U1 drives the handler with `{}`; the probe must need nothing from the request.
- [x] Repeated calls / statelessness — U2 (byte-identical serialized bodies, unit) and H4 (byte-identical raw wire bodies across three GETs, live). Catches any timestamp/counter/computed field, which the ADR explicitly bans.
- [x] Sibling path is a *prefix-superset* of the probe path (`relationship-primitives-missing-sibling` contains `relationship-primitives`) — S2's regex pins the closing quote so a sloppy prefix-match registration can't satisfy it; H2 exercises both paths independently.
- [x] Probe advertising an operation that doesn't exist (evidence rot after a rename) — S3 cross-checks every `operations` entry against a registered `app.post` in `index.js`.
- [x] Mutation capability sneaking in beside the GET — H3 (unauthenticated POST to the exact probe path stays 401).
- [x] Concept Graph API unavailable — irrelevant by design: the probe touches no graph (story "Concepts touched: none"); nothing here calls concept-graph endpoints.
- [x] Stack absent — all four H tests return `SKIP` individually (per-test guard via `stackAvailable()`, host reachability only — no docker dependency, since every H request is deliberately host-side); U/S always run and gate.

Not tested (out of scope by story/ADR): health/monitoring fields, other surfaces' deployment, any change to `relationships.js` / `auth.js` (story #1's suite S1/S2 already pin `relationships.js` byte-level; this suite never touches that file's assertions).

## Test infrastructure

- Test framework: Node built-in runner (`node test/test.js` via `npm test`). No Playwright — no UI surface in this story.
- Control panel: `http://localhost:7778` (`BRAINSTORM_BASE_URL` overrides; port per AGENTS.md §1 — code default 7778 confirmed on this machine). H-class is **host-side only** by design: host→`:7778` peers as the Docker bridge gateway = the unauthenticated remote caller class (ADR `security-auth-exposure/0001`), which is exactly who the probe exists to answer. No container-loopback calls, no fixtures, no teardown — the suite is read-only end to end.
- Firmware state: **none required.** No `POST /api/firmware/install` precondition; the probe touches no concepts (ADR: "Firmware reinstall required? No").
- Graph state: none required. No nodes created; nothing to clean up.
- Fixtures: none.
- H4 drift sensitivity (H8-class note, carried from story #1's plan): `GET /api/strfry/scan/count` equality is drift-sensitive when the strfry router / scheduled tasks are actively syncing events. The bracket is tight (counts immediately before/after three fast GETs) to minimize the window, and the failure message instructs: quiesce the concurrent publisher and re-run. A count-drift failure is an environment artifact, not a feature failure — same semantics as story #1's H8.

## How to run

```
npm test
```

New suite alone (fast):
```
node test/relationship-primitives-probe.test.js
```

## Verification

The new tests fail with the current code, for feature-missing reasons (`src/api/normalize/probe.js` absent; no GET registered on the normalize mount). Confirmed 2026-07-21 at commit `64d71be7` (working tree: this suite + its `test/test.js` registration only), stack **up** (local Docker stack running; H-class live).

Standalone run of the new suite — 8 failing feature-missing, 1 deliberate pre-implementation pass (H3), 0 skipped:

```
--- relationship-primitives-probe tests (epic relationship-primitives, Story 2) ---
  FAIL  U1 (AC-1, AC-2): the probe handler answers 200 with the exact static evidence body — success:true, surface:"relationship-primitives", operations naming both primitives — to a bare credential-free request
        src/api/normalize/probe.js does not exist yet — the read-only deployment probe (ADR relationship-primitives/0002 Option A) is not implemented.
  FAIL  U2 (AC-4): two consecutive handler calls produce byte-identical bodies — nothing computed, nothing stateful, no timestamp
        src/api/normalize/probe.js does not exist yet — the read-only deployment probe (ADR relationship-primitives/0002 Option A) is not implemented.
  FAIL  S1 (AC-4): probe.js contains NO require calls at all — the empty import surface IS the zero-side-effect guarantee
        src/api/normalize/probe.js does not exist yet — the read-only deployment probe (ADR relationship-primitives/0002 Option A) is not implemented.
  FAIL  S2 (AC-2): the GET probe route is registered inside registerNormalizeRoutes — the same delivery unit as the primitives
        normalize/index.js must require ./probe — the probe module is not wired into the delivery unit (ADR relationship-primitives/0002 Implementation notes).
  FAIL  S3 (AC-2): every operation the probe advertises is a registered POST in normalize/index.js — the evidence stays honest if the primitives are renamed
        src/api/normalize/probe.js does not exist yet — the read-only deployment probe (ADR relationship-primitives/0002 Option A) is not implemented.
  FAIL  H1 (AC-1, AC-2): a credential-free host-side GET of the probe answers 200 application/json with the exact evidence body
        GET /api/normalize/relationship-primitives (host-side = the unauthenticated remote class) must answer 200 — got status=404, body=<!DOCTYPE html>… <pre>Cannot GET /api/ — the probe route is not implemented (AC-1).
  FAIL  H2 (AC-3): the missing-route contrast — the probe and the named unregistered sibling answer OBSERVABLY differently (200 JSON vs 404 non-JSON)
        GET /api/normalize/relationship-primitives must answer 200 JSON while its sibling 404s — got status=404, body=<!DOCTYPE html>… <pre>Cannot GET /api/. Pre-implementation both paths answer the identical 404: that IS the falsified mechanism this story exists to fix (AC-3).
  PASS  H3 (AC-4): an unauthenticated host-side POST to the probe path stays 401 — the GET added no credential-free mutation capability
  FAIL  H4 (AC-4): repeated probes write NOTHING to strfry — scan counts bracket equal around three identically-answered GETs
        bracketed probe #1 must answer 200 JSON — got status=404, body=<!DOCTYPE html>… <pre>Cannot GET /api/ — the probe route is not implemented.

relationship-primitives-probe: 1 passed, 8 failed, 0 skipped
```

Full `npm test` (same commit, stack up) — final summary tail, verbatim:

```
relationship-primitives suite:                   FAIL (22 passed, 1 failed)
relationship-primitives-probe suite:             FAIL (1 passed, 8 failed)
Total skipped:                                   51
Overall:                                         FAIL
```

(exit code 1 — the new suite's entry in the LIVE `overallOk` chain is exactly the gate the Implementer must turn green.)

Diffing this run's per-suite summary table against the Director's prior full-run baseline (`review-run1.log`, 2026-07-21) shows **exactly two deltas and nothing else** — every other suite line is byte-identical, including `Total skipped: 51` and `harness-lint suite: FAIL (28 passed, 1 failed)`:

1. `relationship-primitives-probe suite: FAIL (1 passed, 8 failed)` — **the new suite, failing as intended.**
2. `relationship-primitives suite: FAIL (22 passed, 1 failed)` — story #1's H8 only, and it is the artifact its own plan documents (drift-sensitive strfry count bracket): `scan count went 5994898 -> 5994900. If a concurrent publisher (scheduled task / sync) is suspected, quiesce it and re-run.` A Director-side judge `npm test` was live on the same stack during this run's bracket window (two events published mid-bracket). Re-run standalone on the uncontended stack immediately after, per the message's instruction — fully green:

   ```
   node test/relationship-primitives.test.js
   …
   relationship-primitives: 23 passed, 0 failed, 0 skipped   (exit 0)
   ```

The harness-lint failure is the known pre-existing baseline, verified directly: `bash scripts/harness-lint.sh` → `VIOLATION L9 BIBLE.md — 'Last updated: 2026-07-02' lags the last git change (2026-07-20) by 18d (>14)`. It predates this story, appears identically in the baseline run, and sits in the severed (non-gating) block of the `overallOk` chain.
