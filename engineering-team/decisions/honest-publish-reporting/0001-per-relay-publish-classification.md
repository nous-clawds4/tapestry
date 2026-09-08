# ADR 0001: Classify each relay from what that relay actually did

**Status:** Accepted
**Date:** 2026-09-07
**Story:** `engineering-team/stories/honest-publish-reporting/1-publish-result-tells-the-truth.md`

## Context

`publishToRelays` (`ui/src/utils/nostrPublish.js:92-120`) is the single browser-side chokepoint for
external publishing. It reports every relay as a success because it races an **array** against a
timeout:

```js
await Promise.race([
  pool.publish([relay], signedEvent),   // Promise<string>[] — NOT a thenable
  new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000)),
]);
successes.push(relay);                  // unconditional
```

Eight shipped paths branch on the resulting `{successes, failures}`. All eight are already written
correctly; each has a failure branch that is merely unreachable. The story's acceptance criteria
therefore reduce to one question: **what does `publishToRelays` return, and how is it derived?**

### Constraints that bind the design

1. **`SimplePool.publish(relays, event)` returns `Promise<string>[]`** — one promise per relay, in
   input order (`nostr-tools@2.23.3`, `abstract-pool.d.ts:52-56`).
2. **Failure arrives in two different shapes, and one of them looks like success.** Per
   `nostr-tools/lib/esm/index.js`:
   - accepted → **fulfilled** with the relay's `OK` reason string (`:949-950`)
   - refused (`OK: false`) → **rejected** with `Error(reason)` (`:951-952`)
   - publish timed out → **rejected** with `Error('publish timed out')` (`:834`)
   - **cannot connect → fulfilled with the string `"connection failure: <err>"`** (`:1324-1327`)

   Classifying on settled *status* alone therefore still reports unreachable relays as successes.
   This is the single most important fact in this ADR.
3. **The library already bounds the wait.** `AbstractRelay.publishTimeout = 4400` ms (`:607`) and
   `SimplePool.maxWaitForConnection = 3000` ms (`:1107`, `:1377`). The hand-rolled 5 s timer is
   redundant, not merely broken.
4. **ADR `event-tagging/0002` establishes this file as the single shared chokepoint**, on the
   explicit rationale that "enforcement at the single shared chokepoint makes coverage structural,
   not per-caller discipline." That reasoning extends to honest classification. Its `skippedByGate`
   path and the fail-open policy read are unchanged by this ADR.
5. **`test/global-publish-gate.test.js:126`** asserts the local-only guard precedes any socket via a
   literal `indexOf('pool.publish')`. The substring must survive.
6. **The partial-failure tolerance is deliberate and out of scope** (story). `publishOrThrow` keeps
   throwing only when local *and* external both fail.

### Concepts

None. Orientation via `/api/concept-graph/summaries` → `/node/<handle>/neighbors` on
`39998:<TA>:nostr-relay` confirms relays are graph-modeled entities, but this change writes nothing
to the graph, defines no concept, and alters no schema. **No firmware reinstall.**

## Options considered

### Option A — Fix the classification, keep the `{successes, failures}` shape

Await the promises properly and classify each relay, inspecting the fulfilled **value** so a
`"connection failure: …"` resolution counts as a failure. Return shape unchanged.

- **Pros.** Smallest possible diff. Zero consumer churn — all eight callers work untouched. Every
  acceptance criterion is met.
- **Cons.** Discards information the function has already computed. A caller that needs to know
  *why* a relay failed — refused vs. unreachable vs. silent — cannot find out. When the previously
  silent failures start surfacing on deploy, the only signal an operator gets is a list of URLs.

### Option B — Same classification, plus a per-relay detail map (chosen)

Identical classification, and additionally return `details`: one entry per relay recording its
outcome and the reason string the relay or the library supplied.

```js
{
  successes: ['wss://a'],                       // unchanged
  failures:  ['wss://b', 'wss://c'],            // unchanged
  details: {
    'wss://a': { status: 'accepted',    reason: '' },
    'wss://b': { status: 'refused',     reason: 'blocked: not in whitelist' },
    'wss://c': { status: 'unreachable', reason: 'connection failure: …' },
  },
}
```

`status` is one of `accepted` | `refused` | `unreachable` | `timeout`.

- **Pros.** Backward-compatible superset: all eight consumers still work untouched, so the story's
  "no consumer edits expected" holds. The distinction is *already computed* by the classification
  logic — exposing it is nearly free. Gives the deploy a diagnostic signal precisely when
  long-silent failures begin to appear.
- **Cons.** A wider public shape than any caller consumes on day one. Mitigated by the fact that
  `failures` alone is provably insufficient for the deploy (see Consequences).

### Option C — Replace the shape with a per-relay result array

Return `[{ relay, status, reason }]` and delete `successes`/`failures`.

- **Pros.** The cleanest model of the domain; no redundant representations.
- **Cons.** Breaks all eight consumers plus `classifyBroadcast` and both `publishOrThrow`-shaped
  guards. Converts a contained bug fix into a cross-cutting refactor, directly contradicting the
  story's scope, and enlarges exactly the diff whose blast radius the story exists to contain.
  Rejected on scope, not on modelling grounds.

## Decision

We chose **Option B**.

Option C is the better data model and the wrong change to make now: the story's whole thesis is that
the consumers are correct and only the signal is a lie, so the fix should replace the lie and touch
nothing else. Option A is Option B minus information the code already has.

`details` earns its place on a day-one need rather than on speculation. This change is expected to
surface failures that have been silent for five months across eight paths; whoever watches that
deploy needs to distinguish "the relay refused our event" from "the browser could not reach the
relay," because those have different causes and different fixes. `failures: ['wss://b']` cannot tell
them apart, and the information is sitting in the settled results either way.

### Two sub-decisions

**Keep the per-relay `pool.publish([relay], …)` call; do not switch to one `pool.publish(relays, …)`.**
The single-call form returns an index-aligned array and is more idiomatic, but it rejects duplicates
with `"duplicate url"` after applying `normalizeURL` (`:1311-1314`). Callers dedupe with `new Set`
(`publishTagPin.js:281,379`), which compares raw strings — so `wss://x.com` and `wss://x.com/`
survive the Set and would collide inside the library, turning a live relay into a spurious failure.
The per-relay call has `arr.length === 1`, making that branch unreachable. Keeping the current
structure is both safer and the smaller diff.

**Delete the hand-rolled 5 s timer rather than repair it.** The library already bounds both the
connection (3 s) and the publish (4.4 s) and rejects with `Error('publish timed out')`, which
classifies as `timeout`. Re-introducing a `Promise.race` — even a correct one — re-introduces the
shape of the original defect for no benefit. The trade is a worst case of ~7.4 s for a relay that
connects slowly and then goes silent, against the 5 s the broken timer nominally intended. Relays
are published to in parallel, so this bounds the whole call, not each relay in sequence. If a
tighter bound is ever wanted, race each **individual promise** (a real thenable) — never the array.

## Consequences

- **Enables:** the eight consumers' existing failure branches become reachable; `broadcastOutcome`'s
  `not-delivered` vocabulary becomes reachable for the first time; `publishOrThrow` can throw on a
  local strfry failure again; relay refusals stop producing unhandled promise rejections, because
  every promise now has a handler.
- **Constrains:** `details` is now part of the chokepoint's contract. It should stay derived — a
  presentation of the settled results, never a second source of truth alongside `successes` /
  `failures`.
- **Behavioral risk, deliberate:** failures silent since 2026-04-05 will begin surfacing across all
  eight paths at once. This is the point of the story, but it means the deploy should be watched.
  The story's open question — how many were *actually* failing in production — is answerable after
  this ships and not before; `details` is what makes the answer readable.
- **Follow-ups created:** (a) `TreasureMapRelayPresence`'s `runSync` may be able to drop its
  round-trip workaround once the primitive is trustworthy — deferred, and it should stay until
  OPEN.md row 201 (ack-before-queryable) is settled, since re-reading also guards a different race;
  (b) surfaces with no failure reporting at all could adopt `details`, which is new UX work and
  explicitly out of scope here.
- **Firmware reinstall required?** **No.** No concept definition changes.

## Implementation notes

- **File: `ui/src/utils/nostrPublish.js`** — rewrite the body of `publishToRelays` (`:92-120`) only.
  - Keep the `isExternalPublishAllowed()` guard and its early `skippedByGate` return exactly as they
    are, still ahead of `new SimplePool()` and `pool.publish`. Keep the literal `pool.publish`
    substring (constraint 5).
  - For each relay, `await Promise.allSettled(pool.publish([relay], signedEvent))` and classify the
    single settled entry:
    - `rejected`, message `'publish timed out'` → `timeout` → `failures`
    - `rejected`, anything else → `refused`, reason = the error message → `failures`
    - `fulfilled`, value is a string beginning `'connection failure:'` → `unreachable` → `failures`
    - `fulfilled` otherwise → `accepted`, reason = the value → `successes`
  - Preserve the existing `try/finally` so `pool.close(relays)` still runs on every path.
  - Remove the `setTimeout` race entirely, and the unused `const results =` binding at `:102`.
  - Order `successes` / `failures` deterministically (input relay order) so tests can assert on them.
- **Files NOT changed** — verify, do not edit: `ui/src/utils/publishProfileTag.js`,
  `ui/src/utils/publishTagPin.js`, `ui/src/utils/dispositionActions.js`,
  `ui/src/hooks/useProfileActions.js`, `ui/src/pages/concepts/ConceptDetail.jsx`,
  `ui/src/pages/grapevine/TreasureMapRelayPresence.jsx`, `src/lib/broadcastOutcome.js`. If any of
  these turns out to need an edit, that is a finding worth surfacing, not a silent fix.
- **`ui/src/utils/publishProfileTag.js:16`** carries a deliberate literal TA pubkey under the
  ADR 0015 named exception. Do not touch it.
- **Testing shape (Phase 3 owns this; recorded so the Tester has the mechanism).** The four cases are
  reachable only by controlling what `pool.publish` returns, so the suite needs a stubbed pool rather
  than another source-text regex — that substitution is the missing capability behind this defect
  surviving five months. `test/honest-broadcast-reporting.test.js` remains valid: its unit is
  `classifyBroadcast`, which is correct and unchanged.

## Out of scope

- OPEN.md row 201 (a relay acks before the event is queryable). Same family, separately tracked.
- Any change to the partial-failure tolerance, to `skippedByGate`, or to the fail-open policy read.
- New user-visible failure messaging on surfaces that have none today.
- Server-side publish paths; simplifying `runSync`; adopting `details` in any consumer.
