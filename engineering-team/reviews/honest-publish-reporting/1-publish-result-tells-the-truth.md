# Review: Story 1 — The publish result tells the truth about what each relay did

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-07
**Diff:** `git diff origin/staging...HEAD` (implementation commit `4b5f00f4`; branch `fix/honest-publish-reporting`)

## Quality gates (run by reviewer, not trusted)

- [x] **Targeted suites — run by me, all green.** The implementation suite plus every suite that
      constrains it or exercises a publish path:

      honest-publish-reporting        10 passed, 0 failed, 0 skipped
      global-publish-gate              8 passed, 0 failed
      honest-broadcast-reporting      15 passed, 0 failed, 0 skipped
      treasure-map-relay-presence     35 passed, 0 failed
      tl-treasure-map-optin-publish   23 passed, 0 failed
      event-tagging-write-path        19 passed, 0 failed
      event-tagging-core              15 passed, 0 failed
      publish-export-a-concept         3 passed, 0 failed

- [x] **`npm test` (full) — `Overall: FAIL`, and the failures are pre-existing, not caused by this
      diff.** Three suites fail: `tl-membership-method-selector` (11/1), `tl-weighted-sum-method`
      (6/2/1 skipped), `tl-certainty-method` (4/3). All three open with the same `L0 GUARD` refusal:
      `BRAINSTORM_PUBLISH_LOCAL_ONLY must be active … (got {"success":true,"allowExternalPublish":true})`.
      This is **OPEN.md row 191**. The remaining assertions in those suites (`LB` score slots, `LP`
      prune) fail downstream of the guard, because the fixtures were never published.

      **Verified rather than assumed:** the same three suites were run with the implementation
      stashed (pre-fix code) and produced byte-identical results —

      | suite | pre-fix | post-fix |
      |---|---|---|
      | tl-membership-method-selector | `pass=11 fail=1 skipped=0` | `11 passed, 1 failed, 0 skipped` |
      | tl-weighted-sum-method | `pass=6 fail=2 skipped=1` | `6 passed, 2 failed, 1 skipped` |
      | tl-certainty-method | `pass=4 fail=3 skipped=0` | `4 passed, 3 failed, 0 skipped` |

      The causal argument stands independently of the arithmetic: an `L0 GUARD` reading the
      deployment's publish *policy* has no connection to how a relay's *answer* is classified.

- [x] `harness-lint.sh` — clean (0 violations).
- [ ] `npm run test:playwright` — not applicable; no browser flow changed.
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._

## Spec adherence

- [x] Every acceptance criterion has a passing test.

  | AC | Test | Status |
  |---|---|---|
  | AC-1 accepts ⇒ success; refuses ⇒ failure | `B1`, `B2` | pass |
  | AC-2 unreachable ⇒ failure | `B3` | pass |
  | AC-3 never answers ⇒ bounded failure | `B4` | pass |
  | AC-4 dead consumer branches wake up | `I1`, `S1` | pass |
  | AC-5 local-only gate unchanged | `G1` | pass |
  | AC-6 no unhandled rejection | `R1` | pass |
  | ADR Option B — `details` map | `D1` | pass |
  | edge: mixed relay set | `B5` | pass |

- [x] No criterion silently dropped.
- [x] No behavior added that isn't in the story. The one addition beyond the ADR's literal notes —
      the synchronous-throw guard — restores error containment the *previous* code had (its inner
      `try/catch` absorbed a throw from `pool.publish`) and which the rewrite would otherwise have
      lost. That is preservation, not scope creep. See Non-blocking #3 on its test status.

## ADR adherence

- [x] Files changed match the implementation notes: only `ui/src/utils/nostrPublish.js`.
- [x] **All seven "verify, do not edit" files confirmed untouched** (`git diff --quiet` per file):
      `publishProfileTag.js`, `publishTagPin.js`, `dispositionActions.js`, `useProfileActions.js`,
      `ConceptDetail.jsx`, `TreasureMapRelayPresence.jsx`, `broadcastOutcome.js`. The story's central
      claim — that the consumers were already correct and only the signal was a lie — held: no
      consumer needed an edit.
- [x] Classification reads the fulfilled **value**, not just settled status (`nostrPublish.js:105-113`),
      which is the ADR's decisive constraint. `unreachable` is derived from the
      `"connection failure:"` prefix, exactly as specified.
- [x] Hand-rolled 5s timer deleted rather than repaired; no `Promise.race` reintroduced.
- [x] Per-relay `pool.publish([relay], …)` retained (the normalizeURL-duplicate sub-decision).
- [x] `successes`/`failures` follow caller relay order (`:157-161`).
- [x] Local-only guard still precedes `new SimplePool()` and the literal `pool.publish` substring
      survives — `test/global-publish-gate.test.js` (8/8) enforces both.
- [x] Unused `const results =` binding removed.
- [x] No new dependencies. No new lint/typecheck/build tooling.

## Concept-graph integrity

- [x] No concept handles introduced or altered; the diff writes nothing to the graph.
- [x] **Firmware reinstall not required** — correctly called out in the ADR, and confirmed here: no
      concept definition changed.
- [x] ADR 0015's deliberate literal TA pubkey in `publishProfileTag.js` is untouched (verified present).

## Things tests can't catch

- [x] No secrets. The only 64-hex strings in the diff are `'a'.repeat(64)`-style test fixtures.
- [x] No leftover debug logging. Every `console.log` in the new test file is runner output matching
      the house pattern; the one `console.info` in `publishToRelays` is pre-existing gate logging.
- [x] No commented-out code.
- [x] **Error paths independently exercised by me**, not taken on the Implementer's word:
      - malformed relay URL (`'not a url'`) → `failures`, `status: 'unreachable'`, no throw, and the
        sibling relay in the same call still attempted.
      - `'__proto__'` as a relay URL → lands in `failures`; **`Object.prototype` is not polluted**
        (checked directly). See Non-blocking #2 for the cosmetic wart.
      - duplicate relay URLs → both entries in `failures`, one `details` key. See Non-blocking #4.
- [x] Concurrency: relays still publish in parallel via `Promise.all` over `relays.map`; `pool.close`
      still runs in `finally` on every path, including the throw path.
- [x] Security: no new input reaches a sink. Relay URLs are passed to nostr-tools as before.

## House rules check

- [x] Concept Graph API authority respected (orientation performed at Architecture; no BIBLE re-derivation).
- [x] No new lint/typecheck/build tooling.
- [x] Per-deployment TA pubkey rule respected — no new hardcode; the ADR 0015 exception left alone.

## Findings

### Blocking

None.

### Non-blocking

1. **`test/honest-publish-reporting.test.js:96-101`** — `useWebSocketImplementation(FakeRelaySocket)`
   mutates the nostr-tools ESM pool module **process-globally and is never restored**, so every
   `SimplePool` created later in the same `npm test` process gets the fake socket.
   *Verified harmless today:* only five suites run after this one (`not-yet-shared-filter`,
   `share-from-shared-by-me`, `treasure-map-relay-presence`, `treasure-map-relay-sync`,
   `treasure-map-panel-summary`) and **none executes nostr-tools at runtime** — all are text-based
   structural suites. But it is a live trap: a future suite added after this one that uses SimplePool
   would silently talk to a fake relay and could pass for the wrong reason.
   *Optional improvement:* restore the real implementation when the suite finishes, or document the
   hazard at the injection site. Worth an OPEN.md row either way.

2. **`ui/src/utils/nostrPublish.js:140`** — `const details = {}`. A relay URL of `__proto__` is
   reachable (relay lists come from user-authored kind-10002), and it lands in `failures` while
   getting **no own property** in `details`, so the two disagree. Not a security issue — I confirmed
   `Object.prototype` is untouched. *Optional improvement:* `Object.create(null)`.

3. **`ui/src/utils/nostrPublish.js:150-155`** — the synchronous-throw guard is correct (I reproduced
   the throw and verified the guard catches it), but it is **untested**. It was discovered during
   Phase 4, after the Tester's lane had closed, and Phase 4 correctly declined to touch `test/`. This
   is not a coverage regression — the old code's equivalent `catch` was equally untested — but the
   classification contract now has a path no test pins. *Ask:* a follow-up test in the Tester's lane.

4. **`ui/src/utils/nostrPublish.js:157-161`** — duplicate relay URLs in one call produce duplicate
   entries in `successes`/`failures` but a single `details` key. Pre-existing behavior for the arrays;
   every caller dedupes with `new Set`. Noted, not asked.

5. **Deploy-watch, carried from the story's open question.** How many of the eight paths were
   *actually* failing in production is still unknown and answerable only after this ships. Publish
   actions also become genuinely slower — up to ~4.4s against unresponsive relays where they
   previously returned in ~0ms — because they now actually wait. ADR 0001 named this trade; it is
   correct, and it is user-visible.

### Harness friction

1. **`BRAINSTORM_PUBLISH_LOCAL_ONLY=true npm test` looks like it satisfies the `tl-*` suites' L0
   GUARD, and does not.** The guard reads `/api/publish-policy` from the **running container**, so a
   shell-level env var has no effect; the flag must be set on the container. OPEN.md row 191 records
   the FAIL-vs-SKIP question but not this wrong-lever trap, which cost this story two ~30-minute full
   suite runs before the cause was identified. Worth appending to row 191.

## Verdict

**PASS**

The diff does exactly what the story asked and no more: one file, one behavior, eight consumers left
untouched because they were already right. The ADR's hardest constraint — that an unreachable relay
*fulfils* rather than rejects — is honored in the code and pinned by a test that fails without it.
Every acceptance criterion has a passing test I ran myself, the full-suite red is proven pre-existing
by a stashed-change comparison rather than asserted, and the two behaviors I probed beyond the tests
(malformed URL, `__proto__`) hold up. The non-blocking items are genuine but none of them can produce
a wrong answer for a user today.

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection performed; result reported in chat, not recorded here.
