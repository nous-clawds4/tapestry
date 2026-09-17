# Test Plan: Story 1 — The publish result tells the truth about what each relay did

**Story:** `engineering-team/stories/honest-publish-reporting/1-publish-result-tells-the-truth.md`
**ADR:** `engineering-team/decisions/honest-publish-reporting/0001-per-relay-publish-classification.md`
**Date:** 2026-09-07

## Coverage map

| Criterion | Test | Test file | Level |
|---|---|---|---|
| AC-1 (accepts ⇒ success; refuses ⇒ failure) | `B1`, `B2` | `test/honest-publish-reporting.test.js` | behavioral (real module, fake relay) |
| AC-2 (unreachable ⇒ failure) | `B3` | same | behavioral |
| AC-3 (never answers ⇒ bounded failure) | `B4` | same | behavioral |
| AC-4 (dead consumer branches wake up) | `I1` (real primitive → real `broadcastOutcome`), `S1` (the `publishOrThrow` contract it leans on) | same | integration + structural |
| AC-5 (local-only gate unchanged) | `G1` | same | behavioral, own process |
| AC-6 (no unhandled rejection) | `R1` | same | behavioral |
| ADR 0001 Option B (`details` map) | `D1` | same | behavioral |

## Edge cases

- [x] **A mixed relay set in one call** (`B5`) — accept + refuse + unreachable together, asserting the
      partition rather than one relay at a time. The per-relay loop is where an index or ordering
      mistake would hide.
- [x] **Unreachable vs. refused are distinguished** (`D1`) — not just "both are failures." These are
      the two shapes that arrive differently from the library, and a fix that conflates them still
      leaves a deploy undiagnosable.
- [x] **The relay's own reason survives** (`D1`) — a failure with no reason string is not actionable.
- [x] **Kept-local claims neither success nor failure** (`G1`) — and opens **zero** sockets, asserted
      by counting fake-socket constructions, not by reading source.
- [ ] **Concept Graph API unavailable** — not applicable; this story touches no concept and makes no
      graph call (confirmed during Architecture).
- [ ] **Empty relay list** — deliberately untested: no caller can produce one (every call site passes a
      non-empty constant or a `new Set` union), and pinning behavior the spec does not constrain would
      only tie the Implementer's hands.

## Test infrastructure

- **Runner:** the existing hand-rolled Node runner (`node test/test.js`). No new framework.
  Registered in `test/test.js` alongside the other suites.
- **Seam:** nostr-tools' own `useWebSocketImplementation()` — its supported injection point for
  non-browser environments. A `FakeRelaySocket` drives the four real relay behaviors (accept, refuse,
  silent, unreachable) so the assertions run against the **real** `publishToRelays`.
  **No production code changes for testability.**
- **Fixtures:** none on disk. Relay behavior is keyed by URL, one unique URL per test, so tests cannot
  interfere. One dummy signed event.
- **Firmware state:** none required.
- **Live stack:** not required. The suite is fully hermetic and passes with the stack down.

### Two findings that shaped this plan

**1. The predecessor's testability finding is stale, and that matters.**
`test/honest-broadcast-reporting.test.js` records that "no ui/src module is executed anywhere in this
runner — every ui/src reference in every suite is read as TEXT," and so tested a pure CJS core instead.
Node 24 can now `require()` an ES module, and `nostrPublish.js` is loadable because it has **zero
extensionless relative imports** (its only import is the bare specifier `nostr-tools/pool`). Its
consumers import `'./nostrPublish'` without the extension — Vite resolves that, Node does not — so they
remain text-only. That is the exact boundary this suite works within: **execute the primitive and the
CJS core; pin the consumers structurally.**

**2. Testing only a pure core is how this defect survived five months.**
`broadcastOutcome.js` is correct. Its suite is green. The wiring beneath it was a lie, and the green
core sat on top of it. Repeating that move here would build a second correct core over a possibly-broken
wire, so `I1` deliberately drives the **real** primitive into the **real** core — the one test whose
absence let the bug hide.

**3. The ESM/CJS twin trap.** `require.resolve('nostr-tools/pool')` returns the **CJS** build, a
different module instance; injecting a fake socket there silently does nothing to the ESM copy that
`nostrPublish.js` imports, and every test would then exercise real network calls while appearing to
work. The suite resolves from `ui/` (the repo root carries an older nostr-tools, 2.10.4 vs 2.23.3) and
steps across to the `esm` sibling. `B1` would still pass under the mistake; `G1`'s socket count is what
would expose it.

## How to run

```bash
node test/honest-publish-reporting.test.js
```

Whole suite (note: unrelated `trusted-lists` suites hard-FAIL without the flag — OPEN.md row 191):

```bash
BRAINSTORM_PUBLISH_LOCAL_ONLY=true npm test
```

## Verification

The new tests fail with the current code. Confirmed 2026-09-07 at commit `9d59223a`:

```
  ✓ B1 a relay that accepts the event is reported as a success
  ✗ B2 a relay that refuses the event (OK:false) is reported as a failure, not a success
      the relay answered OK:false — reporting it as a success is the defect. Got {"successes":["wss://refused-2…"],"failures":[]}
  ✗ B3 a relay that cannot be connected to is reported as a failure
      an unreachable relay must not be a success. nostr-tools RESOLVES (does not reject) with a
      "connection failure: …" string here … Got {"successes":["wss://unreachable-3…"],"failures":[]}
  ✗ B4 a relay that connects but never answers is reported as a failure, within a bounded wait
      a relay that never acknowledged must not be a success; got {"successes":["wss://silent-4…"],"failures":[]}
  ✗ B5 a mixed relay set is partitioned correctly in one call
      only the accepting relay belongs in successes; got ["wss://accept-5…","wss://refused-6…","wss://unreachable-7…"]
  ✗ D1 each relay carries a status and a reason distinguishing refused from unreachable
      the result must carry a per-relay details map (ADR 0001); got ["successes","failures"]
  ✗ I1 when no relay accepted, the real broadcast core classifies the real result as not-delivered
      … Expected 'not-delivered', got 'published' from {"successes":["wss://refused-11…","wss://unreachable-12…"],"failures":[]}
  ✗ R1 a refused publish leaves no unhandled promise rejection
      … nothing ever attaches a handler to the relay's promise — its rejection escapes to the user's
      console. Saw 1: ["refused-r1-only"]
  ✓ G1 with the local-only guard on, the publish is kept local and no socket is opened
  ✓ S1 publishOrThrow still derives external success from successes.length

honest-publish-reporting: 3 passed, 7 failed, 0 skipped
```

**The three passes are load-bearing, not filler.** `B1` is the regression guard that a fix must not
break the happy path; `G1` pins the local-only gate the story puts out of scope; `S1` pins the
consumer contract AC-4 depends on. Every failure names the expected behavior and prints the actual
result, so an Implementer reading only the output knows what to build.

---

# Follow-up (2026-09-08): the suite must not run against the wrong nostr-tools

**Guard suite:** `test/honest-publish-reporting-ci-guard.test.js`
**Repairs:** `test/honest-publish-reporting.test.js`
**Mode:** the ADR-template carve-out for a change whose deliverable IS a test change (OPEN.md row
167) — the Tester writes the guard; Phase 4 repairs the suite beneath it and may not edit the guard.

## What went wrong

The shipped suite failed the required `stack-free` check on `main` (`D1`, 9 passed / 1 failed).

The suite resolves nostr-tools with `require.resolve('nostr-tools/pool', { paths: [UI] })`, meaning
to get ui/'s pinned copy — the one Vite bundles into production. But **`paths:` falls back to
ancestor `node_modules`**, and CI runs `npm ci` at the repo root only
(`.github/workflows/test.yml:36`), so `ui/node_modules` never exists there. Resolution silently
landed on the repo root's nostr-tools **2.10.4** instead of ui/'s **2.23.3**, and the two report a
failed connection differently:

| version | `onerror` | settled shape | classified |
|---|---|---|---|
| 2.23.3 (ui/, ships to prod) | `reject("connection failed")`, caught by `pool.publish` | **fulfilled** `"connection failure: …"` | `unreachable` ✅ |
| 2.10.4 (repo root, CI) | `reject(ev.message ‖ "websocket error")` | **rejected** `"connection refused"` | `refused` ❌ |

**The original plan named this exact hazard** — "the repo root carries an older nostr-tools (2.10.4
vs 2.23.3)" — and guarded the wrong failure mode: the CJS/ESM twin trap was handled, the
absent-`node_modules` ancestor fallback was not.

Production was never affected: Vite builds from `ui/` against the pin. What was false is the
suite's own claim to be exercising the shipped code — in CI it exercised a library 13 minor versions
older, while still appearing to pass 9 of 10.

## What the guard requires

| # | Requirement |
|---|---|
| `Q1` | the suite exports `nostrToolsVersionGate({resolved, pinned})` and `SKIP_REASON`, so the skip decision is testable rather than buried |
| `Q2` | a mismatch produces a skip reason **naming both versions** (tested with the real 2.10.4 / 2.23.3 pair) |
| `Q3` | matching versions do **not** skip |
| `Q4` | the expected version is read from `ui/package-lock.json`, **never hardcoded** — a literal rots at the next dependency bump, the same class of failure as the bug being fixed |
| `Q5` | **the suite does not skip where ui/'s pinned deps are installed** |

`Q5` is the load-bearing one. A gate that always skips would turn CI green while silently deleting
every assertion the story depends on — a worse outcome than the failure it replaces. `Q5` fails if
the fix takes that shortcut.

**Explicitly rejected fix:** making `D1` accept either `refused` or `unreachable`. That assertion
encodes ADR 0001's decisive constraint (an unreachable relay *fulfils*, so status alone is not
enough); loosening it would remove the single most valuable line in the suite.

## Verification

Guard fails against the current suite — confirmed 2026-09-08:

```
  ✗ Q1 the suite exposes a nostr-tools version gate
        … got undefined
  ✗ Q2 the gate skips when the resolved nostr-tools is not the version ui/ pins
  ✗ Q3 the gate runs when the resolved nostr-tools IS the version ui/ pins
  ✗ Q4 the pinned version is read from ui/package-lock.json, never hardcoded
  ✗ Q5 the suite does NOT skip here, where ui/ pinned deps are installed
honest-publish-reporting-ci-guard: 0 passed, 5 failed, 0 skipped
```

**CI's condition reproduced locally** by moving `ui/node_modules/nostr-tools` aside:

```
honest-publish-reporting: 9 passed, 1 failed, 0 skipped     # identical to CI
```

That is the exact command Phase 4 must turn into a run where the relay-behavior tests **skip**
(`fail === 0`), while the same suite with ui/ deps present still reports **10 passed, 0 skipped**.

## Out of scope

- Installing `ui/` dependencies in CI. That would give CI real coverage of the shipped version, but
  it is a workflow change with its own cost and belongs to a separate decision.
- The deeper fragility this exposed: `startsWith('connection failure:')` in
  `ui/src/utils/nostrPublish.js` depends on a nostr-tools **internal message format**, not a public
  contract. A future bump could silently turn `unreachable` back into `accepted` — regressing into
  the very bug this story fixed. ADR 0001 chose that signal knowingly as the only one available;
  nothing currently pins it. Belongs in the ledger, not in this fix.
