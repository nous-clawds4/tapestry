# ADR 0001: Scope the "writes nothing to strfry" brackets to this instance's own author identity

**Status:** Accepted
**Date:** 2026-08-10
**Story:** `engineering-team/stories/test-suite-hermeticity/1-narrow-strfry-write-assertion-brackets.md`

## Context

Two H-class tests prove an operation writes no event to strfry by bracketing it with a
`GET /api/strfry/scan/count` and requiring the two counts to be equal:

- `test/relationship-primitives.test.js:679` — **H8**, around a full add + delete cycle.
- `test/relationship-primitives-probe.test.js:319` — **H4**, around three repeated probes.

Both call a local `strfryEventCount()` helper (`relationship-primitives.test.js:261`,
`relationship-primitives-probe.test.js:166`) that passes the **empty filter** `{}` — the entire
corpus, ~6.6M events on this machine. `scanCount.js:9-18` passes the filter straight through to
`strfry scan --count`, so any valid nostr filter is available; the empty one is a choice, not a
constraint.

**The failure mechanism is arithmetic, not chance.** Measured 2026-08-10 on the local stack with
`strfry-router` in its normal running state: one whole-corpus count takes **6–7 seconds** and each
test performs two, while the router ingests **~0.8 events/second** continuously (+165 events over
one 10-minute window). The bracket is held open across roughly two 6-second scans while events
arrive every second, so the counts differ for reasons that have nothing to do with the operation.
Six consecutive standalone H4 runs went **5 red / 1 green**. OPEN.md row 150 measured ~40% in July;
it is 83% now.

Over the *same* 10-minute window, a count scoped to this instance's own author identity returned
**exactly one distinct value across 30 samples — zero drift** — and took **0.06s** instead of 6–7s.
The corpus the bracket watches moved 165 times; the subset this instance could have authored moved
not at all.

### What actually guards the invariant

Decisive for how much risk a narrowing carries. ADR `relationship-primitives/0001` chose its module
layout precisely so the strfry-free contract would be **structurally auditable** — in its words, "a
far stronger no-strfry guarantee than behavioral spying alone." That structural guard exists, is
exhaustive, and is stack-free:

- `relationship-primitives.test.js:507` **S1** asserts `relationships.js`'s import surface is
  *exactly* `['../../lib/neo4j-driver', '../../middleware/auth', './firmware']` — an exhaustive
  allow-list, not a blacklist — and separately that nothing matching `child_process`, `nostr-tools`,
  `assistantKeys`, `publishToStrfry`, or `signAndFinalize` appears.
- `relationship-primitives-probe.test.js:221` **S1** asserts `probe.js` contains **no `require(`
  calls at all**.

A module that cannot require `child_process`, `nostr-tools`, or `assistantKeys` has no route to
strfry. So H8/H4 are the **runtime confirmation** of an invariant whose **primary guard is
structural, exhaustive, and never flaky**. What the runtime bracket adds over S1 is coverage of
*transitive* writes — something reached through the three allowed imports — which the non-recursive
import check cannot see. That residual coverage is the thing this ADR must preserve.

### What this instance can author

`src/api/strfry/commands/publishEvent.js:38-53`: server-side signing resolves through
`getOwnerAssistantKeys()` — the Tapestry Assistant key, and only that. `signAs: 'client'` requires
an already-signed event supplied by the caller (`publishEvent.js:57`), which no H-class test
supplies. H8's mutations arrive over the container loopback (`loopbackPost`,
`relationship-primitives.test.js:215`),
i.e. the `req.localTrusted` class that *is* permitted to mint TA-signed events. So the TA identity is
both the only author this instance's server can produce and the author reachable on the exact path
under test.

### Constraints

- **The TA pubkey is per-deployment and must never be hardcoded** (CLAUDE.md). Nine suites already
  resolve it at runtime via `GET /api/assistant/pubkey` (e.g. `capture-a-goal-and-see-it.test.js:150`).
- **Narrow filters are the established in-repo pattern.** Seven other suites bracket strfry counts
  with `{kinds:[39999], '#d':[dTag]}` and none are flaky. These two are the only whole-corpus
  holdouts.
- No new lint/typecheck infrastructure (CLAUDE.md); no new dependency.

## Options considered

### Option A — Scope the bracket filter to `authors: [<runtime TA pubkey>]`

Both `strfryEventCount()` helpers take the resolved TA pubkey and count only TA-authored events.
Equality still means "no new event", but over the only author this instance can produce.

**Pros:** removes 100% of the observed flake in one axis — every event in the measured drift is
network traffic from other authors. Immune to an old TA event *round-tripping* back from
`dcosl.brainstorm.world`: strfry deduplicates by event id, so re-receiving an event it already holds
cannot raise the count. Keeps AC-2's teeth exactly where the story wants them — a TA-signed publish
through `/api/strfry/publish` during the bracket still moves the number. ~100× faster (0.06s vs
6–7s), removing ~26s from a full gate. Matches the pattern seven other suites already use.

**Cons:** gives up detection of a hypothetical write authored by a *non*-TA key. Does not exclude a
genuinely concurrent TA publish by another process on this instance (a firmware reinstall, a
scheduled task).

### Option B — Quiesce `strfry-router` around the bracket from inside the suite

Automate the row-150 remedy: `docker exec tapestry supervisorctl stop strfry-router`, bracket,
restart.

**Pros:** preserves the whole-corpus assertion verbatim; zero coverage given up.

**Cons:** a read-only test suite would mutate the running stack, and a crashed or interrupted run
leaves the router stopped — a failure mode strictly worse than the flake it fixes. Requires
`docker exec` rights the host-side H-class deliberately does not assume. Keeps the 6–7s scans.
The story places this out of scope and makes choosing it a kick-back.

### Option C — Option A plus a `since:` lower bound on the bracket window

Add `since: <bracket open − skew margin>` so only freshly-created TA events count.

**Pros:** would exclude old TA events arriving mid-bracket.

**Cons:** buys nothing Option A doesn't already have — strfry's id-dedup already makes a re-synced
old event a no-op on the count. Meanwhile it couples the assertion to **host↔container clock skew**:
the test computes `since` on the macOS host while `created_at` is stamped inside the Docker VM, and
if the container clock lags, a real write falls below `since` and is **missed** — a false green,
the one failure direction worse than a false red. It also does not exclude the concurrent-TA-publish
case, which is the only residual Option A actually has. Cost without benefit.

### Option D — Delete the behavioral brackets; rely on the S-class structural guard alone

**Pros:** removes the flake absolutely; the structural guard is genuinely the stronger of the two.

**Cons:** S1's import check is **non-recursive** — it proves `relationships.js` doesn't require
strfry, not that nothing reachable *through* `./firmware`, `../../lib/neo4j-driver`, or
`../../middleware/auth` writes an event. That transitive coverage is exactly what the runtime
bracket contributes, and deleting a test is not what the story asked for.

## Decision

We chose **Option A** because the entire measured flake lives in one axis — author — and removing
that axis costs only the detection of a write this instance's server has no way to sign
(`publishEvent.js:38-53`) from modules that structurally cannot sign at all
(`relationship-primitives.test.js:507`). The narrowing is a strict improvement in signal: today the
assertion is wrong 83% of the time, which is not weaker coverage than Option A — it is *no usable
coverage*, plus a standing tax.

Option C is rejected for trading a real hazard (clock-skew false greens) for a benefit strfry's
id-dedup already provides. Option B is rejected on the story's terms. Option D is rejected because
the transitive-write coverage is real.

**Accepted residual:** a concurrent TA-authored publish by another process on this instance during
the bracket will still fail the test. This is honest signal — something on this instance really did
write — and the failure message must say so rather than sending the reader back to the router.

## Consequences

- **Enables:** a full `npm test` on a router-connected instance without stopping `strfry-router`;
  OPEN.md row 150 closes and its escalated "quiesce, don't merely re-run" guidance is withdrawn.
- **Enables:** ~26s off every full gate (four whole-corpus scans at 6–7s become four indexed ones).
- **Constrains:** both suites now require `GET /api/assistant/pubkey` to answer before their
  bracketed test can run. This must be a **loud failure, never a silent fallback** — see
  implementation notes.
- **Follow-up:** the two `strfryEventCount()` helpers stay duplicated, one per suite, matching how
  the other seven suites each inline their own filter. Extracting a shared test helper is not worth
  a new module boundary here.
- **Firmware reinstall required?** No. No concept definition changes; no source file outside
  `test/` changes.

## Implementation notes

Test-file edits belong to **Phase 3 (Tester)**, not Phase 4 — the Implementer's diff on this story
is expected to be empty under `test/`. Recorded here as the design the Tester implements.

- **File: `test/relationship-primitives-probe.test.js`** — `strfryEventCount()` (line 166) takes the
  resolved TA pubkey and sends
  `filter={"authors":["<ta>"]}` instead of `{}`. Drop the 60s timeout to something appropriate for an
  indexed query; keep it generous enough not to become its own flake.
- **File: `test/relationship-primitives.test.js`** — the same change to `strfryEventCount()`
  (line 261).
- **TA resolution:** follow the established runtime pattern — `GET ${HOST_BASE}/api/assistant/pubkey`,
  as `capture-a-goal-and-see-it.test.js:150` and eight other suites do. Resolve once and memoize per
  run, alongside the existing `stackAvailable()` memoization. **Never hardcode** (CLAUDE.md,
  per-deployment TA rule).
- **Failure modes must be loud.** If `/api/assistant/pubkey` does not answer a 64-hex pubkey, the
  bracketed test **fails** with that as the reason. It must not fall back to `{}` (which restores the
  flake) and must not `SKIP` (which deletes the assertion while showing green). The existing
  per-test `SKIP` on `stackAvailable()` is unchanged and still correct — that is "no stack", a
  different condition from "stack present but identity unresolvable".
- **Rewrite both assertion messages.** The current text — *"If a concurrent publisher (scheduled task
  / sync) is suspected, quiesce it and re-run"* (`relationship-primitives.test.js:695`,
  `relationship-primitives-probe.test.js:338`) — is the row-150 guidance AC-4 requires withdrawn.
  Replace with text stating that the count is scoped to this instance's own TA identity, so a change
  means **this instance authored an event** — either the operation under test (a real defect) or a
  concurrent TA publish on this machine — and explicitly **not** router traffic.
- **Update both file-header comments** where they describe the bracket (`relationship-primitives.test.js:43`,
  `relationship-primitives-probe.test.js:36`) so the doc block matches what the test measures.
- **OPEN.md row 150** → `DONE`, pointing at this ADR and the story.

## Out of scope

- The other seven suites' strfry brackets — already narrow, not flaky.
- CI, the stack-free/live-API split, Playwright — OPEN.md row 13, epic-level out of scope.
- Any change to `src/api/strfry/queries/scanCount.js` — the endpoint already accepts arbitrary
  filters; only the callers are wrong.
- Extracting a shared `strfryEventCount` test helper.
