# Test Plan: Story 5 — Event-tagging write path

**Story:** `engineering-team/stories/event-tagging/5-event-tagging-write-path.md`
**ADR:** `engineering-team/decisions/event-tagging/0005-event-tagging-write-path.md`
**Date:** 2026-06-30

## Approach

One CJS suite — `test/event-tagging-write-path.test.js` — wired into `test/test.js`. Two layers.

**The testability decision (follows the ADR, mirrors Story 4).** The risky logic is the **1/2/3-publish sequence decision**, **sign-all-then-publish**, **ordered stop-on-failure**, the **deterministic header pick**, and **dual-z passthrough**. The ADR (Option A + E) factors all of it into a **pure orchestrator** `applyEventTagging({ ...inputs, deps })` in the Story-1 core, with **signing / transport / discovery / clock injected** as `deps = { findHeaders, sign, publish, now }`. That makes every acceptance criterion deterministically testable **in-process with fakes** — no browser, no relay, no real signer, no Vite. The fakes record sign order, publish order, and `findHeaders` calls, and can be told to reject a given sign or fail a given publish.

The thin React hook (`ui/src/hooks/useEventTagging.js` or `ui/src/utils/publishEventTag.js`) is JSX/ESM and can't be loaded by the CJS runner, so it is covered by **source-contract** checks (text assertions over the file) — the same shape Story 4 used for its server module. The one genuine integration risk the ADR calls out — the **Vite alias resolving + transforming the CJS core** — is a **manual `cycle-local` verification** (see *Manual verification* below), not an automated test, because the CJS runner can't run the bundler.

1. **Orchestrator unit tests (the meat).** Drive `applyEventTagging` with fake deps across all three sequences and every failure/edge path.
2. **Source-contract.** Core exports the orchestrator and stays pure (no injected-thing literals); the hook consumes the core (no inlined wire shape), signs via NIP-07, publishes through the **guarded** `publishOrThrow`, and composes z-namespaces from the canonical literal + the **runtime** TA (never a foreign hardcode).

## Coverage map

| Criterion (AC) | Test name | Layer |
|---|---|---|
| 1-publish (existing header), apply | `sequence 'a' (existing header): exactly ONE assertion published; descriptor z = the existing header coord; polarity 1` | orchestrator |
| 1-publish, dispute (polarity −1, same address) | `sequence 'a' dispute: polarity -1 at the SAME deterministic address as the apply` | orchestrator |
| 2-publish (tag exists, no header), ordered | `sequence 'b' (tag exists, no header): publishes header THEN assertion, in order; assertion refs the just-built header` | orchestrator |
| 3-publish (brand-new tag), ordered | `sequence 'c' (brand-new tag): publishes tag-element, header, assertion in dependency order; each refs the prior` | orchestrator |
| Sequence chosen by discovery | `sequence is chosen by discovery: SAME existing tagInput → 1 publish when a header exists, 2 when none` | orchestrator |
| Sequence chosen by discovery (new tag skips read) | `brand-new tag does NOT consult findHeaders (a new tag definitionally has no header)` | orchestrator |
| NIP-07 signing / sign-all-then-publish | `sign-all-then-publish: a signer rejection mid-plan publishes nothing (clean abort)` | orchestrator |
| Ordered publish, stop on failure → harmless partial | `ordered publish stops on first failure: dependents are NOT attempted; failedAt is returned with the landed prefix` | orchestrator |
| Retry re-does only the missing tail (no dup) | `retry is safe: a full re-run lands at identical (replaceable) coordinates — no duplicate of an already-published prefix` | orchestrator |
| Dual-z federation | `dual-z federation: tag-element, header, and assertion each carry BOTH the canonical and local concept-z` | orchestrator |
| Replaceability / flip | `replaceability: re-apply and apply↔dispute reuse the SAME deterministic assertion d (no duplicate)` | orchestrator |
| Malformed input refused, not published | `malformed input throws before any publish AND before any sign (no orphan events)` | orchestrator |
| Header pick is deterministic (ADR open-q 2) | `pickHeader: prefers a header under the canonical authority; otherwise tie-breaks by author ascending` | orchestrator |
| Addressable target → `a` not `e` (edge) | `addressable target ({address}): the assertion references it via a, not e` | orchestrator |
| Return shape `{ sequence, published[], failedAt? }` | `return shape: published[] entries carry {kind, address, id}; id round-trips from the signer` | orchestrator |
| Consume the core (no re-inline) | `source: the core exports applyEventTagging` | source-contract |
| Core purity (deps injected, not embedded) | `source: the orchestrator stays pure (no signer/transport/clock literals in the core)` | source-contract (invariant) |
| Local-only (build invariant) + NIP-07 + reuse | `source: the thin UI hook consumes the core (no inlined wire shape), signs via NIP-07, and publishes through the GUARDED publishOrThrow` | source-contract |
| Dual-z (no foreign hardcode) | `source: the hook composes z-namespaces from the canonical literal + the RUNTIME TA — never a foreign hardcode` | source-contract |

### Notes on two ACs that map indirectly

- **Local-only (AC).** The orchestrator is pure and transports *only* through the injected `publish`; the guard itself lives in `publishOrThrow` → `publishEverywhere` (Story 2). So this AC is split: the orchestrator tests prove no out-of-band transport (publish-count equals landed-count, purity guard bans `fetch`/`wss`), and the source-contract proves the hook wires `publish` → the **guarded** `publishOrThrow`. The guard's runtime behavior is already covered by the `global-publish-gate` suite (Story 2) and re-confirmed in the manual `cycle-local` smoke.
- **The "unverifiable" state is unreachable (AC-5).** Asserted directly inside the stop-on-failure test: when the header publish fails, only the reusable tag-element may have landed, and `published[]` must never contain an assertion whose header did not land.

## Edge cases

- [x] **Signer rejection** mid-plan → throw, nothing published (clean all-or-nothing abort — enabled by addressable coordinates).
- [x] **Publish failure** at the header step → only the reusable tag-element lands; assertion never attempted; `failedAt` returned.
- [x] **Flip apply↔dispute** and **re-apply** → identical deterministic `d` / address (latest-wins, no duplicate).
- [x] **Addressable target** (`{address}`) → `a` tag, not `e`.
- [x] **Brand-new tag never reads** `headers-for-tag` (the discovery is only needed to disambiguate an *existing* tag).
- [x] **Several existing headers** (multiple authors) → deterministic pick (canonical authority preferred; tie-break author ascending).
- [x] **Malformed asserter / target** → validation throw *before* any sign or publish (no orphan), asserted to be a genuine validation error (not a missing-function artifact).
- [ ] **Vite CJS-core resolution** — not unit-testable here; covered by manual `cycle-local` (below).

## Test infrastructure

- Runner: `node test/test.js`. No new framework, no build, no stack.
- The orchestrator layer needs **nothing running** — pure function + injected fakes. The source-contract layer is file reads.
- **To be created by the Implementer:** `applyEventTagging` (and a documented `pickHeader`) in `src/lib/event-tagging`; the thin hook/util under `ui/src/`; the `ui/vite.config.js` alias (or ESM-shim fallback) so the hook imports the single-source CJS core.
- Fakes: `makeDeps({ headers, failSignAt, failPublishAt })` returns `{ deps, rec }` where `rec` records `signed[]`, `published[]`, and `findHeadersCalls[]`. The fake signer stamps a deterministic `id` derived from the event `d`-tag so published ids map back to roles.

## How to run

```
npm test
```

(Orchestrator + source-contract layers run with no stack; they are deterministic and never skip.)

## Manual verification (the one real integration risk — ADR consequence)

After implementation, the Implementer must confirm the Vite build resolves + transforms the CJS core via the alias (ESM-shim fallback if fussy), using `cycle-local`:

- Build `ui/` and smoke the bundle on `:8080` — the hook imports `applyEventTagging` from the aliased core without a build/interop error.
- With the Story-2 guard **on**, exercise apply/dispute on a note and confirm in the local strfry that the 1/2/3 events land **locally only** (no external publish).

## Verification

The new tests fail with the current code. Confirmed on 2026-06-30 at commit `dff8070a`:

```
--- event-tagging write-path tests (epic event-tagging, Story 5) ---
  FAIL  sequence 'a' (existing header): exactly ONE assertion published; descriptor z = the existing header coord; polarity 1
        c.applyEventTagging is not a function
  FAIL  sequence 'a' dispute: polarity -1 at the SAME deterministic address as the apply
        c.applyEventTagging is not a function
  FAIL  sequence 'b' (tag exists, no header): publishes header THEN assertion, in order; assertion refs the just-built header
        c.applyEventTagging is not a function
  FAIL  sequence 'c' (brand-new tag): publishes tag-element, header, assertion in dependency order; each refs the prior
        c.applyEventTagging is not a function
  FAIL  sequence is chosen by discovery: SAME existing tagInput → 1 publish when a header exists, 2 when none
        c.applyEventTagging is not a function
  FAIL  brand-new tag does NOT consult findHeaders (a new tag definitionally has no header)
        c.applyEventTagging is not a function
  FAIL  sign-all-then-publish: a signer rejection mid-plan publishes nothing (clean abort)
        sign-all must reach the signer before aborting (expected 1 signed before the rejection, got 0)
  FAIL  ordered publish stops on first failure: dependents are NOT attempted; failedAt is returned with the landed prefix
        c.applyEventTagging is not a function
  FAIL  retry is safe: a full re-run lands at identical (replaceable) coordinates — no duplicate of an already-published prefix
        c.applyEventTagging is not a function
  FAIL  dual-z federation: tag-element, header, and assertion each carry BOTH the canonical and local concept-z
        c.applyEventTagging is not a function
  FAIL  replaceability: re-apply and apply↔dispute reuse the SAME deterministic assertion d (no duplicate)
        c.applyEventTagging is not a function
  FAIL  malformed input throws before any publish AND before any sign (no orphan events)
        malformed asserterPubkey must throw a validation error, got c.applyEventTagging is not a function
  FAIL  pickHeader: prefers a header under the canonical authority; otherwise tie-breaks by author ascending
        c.applyEventTagging is not a function
  FAIL  addressable target ({address}): the assertion references it via a, not e
        c.applyEventTagging is not a function
  FAIL  return shape: published[] entries carry {kind, address, id}; id round-trips from the signer
        c.applyEventTagging is not a function
  FAIL  source: the core exports applyEventTagging
        src/lib/event-tagging must export applyEventTagging()
  PASS  source: the orchestrator stays pure (no signer/transport/clock literals in the core)
  FAIL  source: the thin UI hook consumes the core (no inlined wire shape), signs via NIP-07, and publishes through the GUARDED publishOrThrow
        expected the write-path hook/util at one of: ui/src/hooks/useEventTagging.js | ui/src/utils/publishEventTag.js
  FAIL  source: the hook composes z-namespaces from the canonical literal + the RUNTIME TA — never a foreign hardcode
        write-path hook/util must exist (see previous test)

event-tagging-write-path: 1 passed, 18 failed
```

The single PASS is the **core-purity invariant** — a regression guard that is correctly green now and goes red only if the Implementer adds I/O to the core. Every feature-bearing AC test is red for the right reason: the orchestrator (`applyEventTagging`) and the UI hook do not exist yet, and the sign/validation behaviors they assert are absent.
